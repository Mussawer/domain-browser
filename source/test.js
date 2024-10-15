/* eslint handle-callback-err:0, no-magic-numbers:0, no-unused-vars:0 */
"use strict";

// Import
var events = require("events");
var equal = require("assert-helpers").equal;
var kava = require("kava");
var domain = require("./index.js");

// =====================================
// Tests

kava.suite("domain-browser", function(suite, test) {
	test("should work on throws", function(done) {
		var d = domain.create();
		d.on("error", function(err) {
			equal(err && err.message, "a thrown error", "error message");
			done();
		});
		d.run(function() {
			throw new Error("a thrown error");
		});
	});

	test("should be able to add emitters", function(done) {
		var d = domain.create();
		var emitter = new events.EventEmitter();

		d.add(emitter);
		d.on("error", function(err) {
			equal(err && err.message, "an emitted error", "error message");
			done();
		});

		emitter.emit("error", new Error("an emitted error"));
	});

	test("should be able to remove emitters", function(done) {
		var emitter = new events.EventEmitter();
		var d = domain.create();
		var domainGotError = false;

		d.add(emitter);
		d.on("error", function(err) {
			domainGotError = true;
		});

		emitter.on("error", function(err) {
			equal(
				err && err.message,
				"This error should not go to the domain",
				"error message"
			);

			// Make sure nothing race condition-y is happening
			setTimeout(function() {
				equal(domainGotError, false, "no domain error");
				done();
			}, 0);
		});

		d.remove(emitter);
		emitter.emit("error", new Error("This error should not go to the domain"));
	});

	test("bind should work", function(done) {
		var d = domain.create();
		d.on("error", function(err) {
			equal(err && err.message, "a thrown error", "error message");
			done();
		});
		d.bind(function(err, a, b) {
			equal(err && err.message, "a passed error", "error message");
			equal(a, 2, "value of a");
			equal(b, 3, "value of b");
			throw new Error("a thrown error");
		})(new Error("a passed error"), 2, 3);
	});

	test("intercept should work", function(done) {
		var d = domain.create();
		var count = 0;
		d.on("error", function(err) {
			if (count === 0) {
				equal(err && err.message, "a thrown error", "error message");
			} else if (count === 1) {
				equal(err && err.message, "a passed error", "error message");
				done();
			}
			count++;
		});

		d.intercept(function(a, b) {
			equal(a, 2, "value of a");
			equal(b, 3, "value of b");
			throw new Error("a thrown error");
		})(null, 2, 3);

		d.intercept(function(a, b) {
			throw new Error("should never reach here");
		})(new Error("a passed error"), 2, 3);
	});

	// Test asyncEventSequencer: Verifies correct event order and error handling
	test("asyncEventSequencer should maintain event order and handle errors", function (done) {
		var d = domain.create();
		var error = new Error("Deliberate error");
		var sequencer = d.asyncEventSequencer({
			event1: async () =>
				await new Promise((resolve) => setTimeout(resolve, 30)),
			event2: async () => {
				throw error;
			},
			event3: async () =>
				await new Promise((resolve) => setTimeout(resolve, 10)),
		});
	
		var errorCaught = false;
		d.on("error", (err) => {
			equal(err, error, "Domain should catch the async error");
			errorCaught = true;
		});
	
		sequencer
			.emitEvents("event1", "event2", "event3")
			.then(() => sequencer.waitForCompletion())
			.then(({ emissionOrder, completionOrder }) => {
				equal(
					emissionOrder.join(","),
					"event1,event2,event3",
					"Events should be processed in emission order"
				);
				equal(errorCaught, true, "Error should have been caught");
				done();
			})
			.catch(done);
	});

	// Test asyncEventSequencer: Checks concurrent event handling
	test("asyncEventSequencer should handle concurrent events correctly", function (done) {
		var d = domain.create();
		var sequencer = d.asyncEventSequencer({
			eventA: async () => {
				await new Promise((resolve) => setTimeout(resolve, 40));
			},
			eventB: async () => {
				await new Promise((resolve) => setTimeout(resolve, 20));
			},
		});
	
		sequencer.emitEvents("eventA", "eventB")
			.then(() => sequencer.waitForCompletion())
			.then(({ emissionOrder, completionOrder }) => {
				equal(
					emissionOrder.join(","),
					"eventA,eventB",
					"Emission order should be maintained"
				);
				equal(
					completionOrder.join(","),
					"eventB,eventA",
					"Completion order should reflect async durations"
				);
				done();
			})
			.catch(done);
	});

	// Tests the runAsync method: validates that it correctly handles and catches errors in asynchronous functions
	test("runAsync should handle async functions", function (done) {
		var d = domain.create();
		var error = new Error("async error");

		d.on("error", function (err) {
			equal(err, error, "Domain should catch the async error");
			done();
		});

		d.runAsync(function () {
			return new Promise(function (resolve, reject) {
				setTimeout(function () {
					reject(error);
				}, 10);
			});
		}).catch(function (err) {
			// This catch is to prevent the unhandled promise rejection
			// The actual error handling is done in the domain's error event
		});
	});

	// Tests the runAsync method: confirms that it properly resolves with the async function's result when no errors occur
	test("runAsync should resolve with the function's result", function (done) {
		var d = domain.create();
		var result = { success: true };

		d.runAsync(function () {
			return new Promise(function (resolve) {
				setTimeout(function () {
					resolve(result);
				}, 10);
			});
		})
			.then(function (value) {
				equal(
					value,
					result,
					"runAsync should resolve with the function's result"
				);
				done();
			})
			.catch(done);

		d.on("error", function (err) {
			done(new Error("Should not have caught an error"));
		});
	});
});
