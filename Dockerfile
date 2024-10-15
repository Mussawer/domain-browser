FROM node:20-alpine
WORKDIR /domain-browser
COPY package*.json ./
RUN npm install
RUN apk add git
COPY . .
RUN npm run test

# DO NOT CHANGE ANY BELOW CODE
WORKDIR /
RUN apk update && apk add bash
COPY run_tests.sh ./
RUN chmod +x /run_tests.sh
ENTRYPOINT ["/bin/bash", "-s"]