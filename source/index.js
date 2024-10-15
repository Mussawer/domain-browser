// This file should be ES5 compatible
/* eslint prefer-spread:0, no-var:0, prefer-reflect:0, no-magic-numbers:0 */
"use strict";

module.exports = function() {
	// Import Events
	var events = require("events");

	// Export Domain
	var domain = {};
	domain.createDomain = domain.create = function() {
		var d = new events.EventEmitter();

		function emitError(e) {
			d.emit("error", e);
		}

		d.add = function(emitter) {
			emitter.on("error", emitError);
		};
		d.remove = function(emitter) {
			emitter.removeListener("error", emitError);
		};
		d.bind = function(fn) {
			return function() {
				var args = Array.prototype.slice.call(arguments);
				try {
					fn.apply(null, args);
				} catch (err) {
					emitError(err);
				}
			};
		};
		d.intercept = function(fn) {
			return function(err) {
				if (err) {
					emitError(err);
				} else {
					var args = Array.prototype.slice.call(arguments, 1);
					try {
						fn.apply(null, args);
					} catch (err) {
						emitError(err);
					}
				}
			};
		};
		d.run = function(fn) {
			try {
				fn();
			} catch (err) {
				emitError(err);
			}
			return this;
		};
		d.dispose = function() {
			this.removeAllListeners();
			return this;
		};
		d.asyncEventSequencer = function(eventMap) {
			const sequencePromises = new Map();  // Stores promises for each event execution
			const eventOrder = [];  // Tracks the order of event occurrences
			const completionOrder = [];  // Tracks the order of event completions
		
			for (const [eventName, handler] of Object.entries(eventMap)) {
				this.on(eventName, (...args) => {
					const promise = (async () => {
						try {
							await handler.apply(this, args);  // Execute the event handler
						} catch (error) {
							this.emit('error', error);  // Emit errors to the domain
						} finally {
							completionOrder.push(eventName);  // Record completion order
						}
					})();
					sequencePromises.set(eventName, promise);  // Store the execution promise
				});
			}
		
			return {
				waitForCompletion: async () => {
					await Promise.all(sequencePromises.values());  // Wait for all events to complete
					return { emissionOrder: eventOrder, completionOrder: completionOrder };  // Return both orders
				},
				emitEvents: async (...events) => {
					for (const event of events) {
						this.emit(event);  // Emit the event on the domain
						eventOrder.push(event);  // Record emission order
					}
				}
			};
		};
		
		// Executes an async function within the domain, handling both resolution and errors
		d.runAsync = function (fn) {
			var self = this;
			return new Promise(function (resolve, reject) {
				self.run(function () {  // Runs the function within the domain's context
					Promise.resolve()
						.then(function () {
							return fn();  // Executes the provided function
						})
						.then(resolve, function (err) {  // Handles successful resolution or errors
							emitError(err);  // Emits the error on the domain
							reject(err);  // Rejects the promise with the error
						});
				});
			});
		};
		d.enter = d.exit = function() {
			return this;
		};
		return d;
	};
	return domain;
}.call(this);
