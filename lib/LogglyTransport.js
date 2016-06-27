"use strict";
const winston = require('winston');

class LogglyTransport extends winston.Transport {
	
}

if (winston.transports.Loggly) {
	throw new Error('winston.transports.Loggly is already defined.');
}

winston.transports.Loggly = LogglyTransport;

module.exports = LogglyTransport;
