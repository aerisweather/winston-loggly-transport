const LogglyTransport = require('../../lib/LogglyTransport');
const assert = require('assert');
const winston = require('winston');

describe('LogglyTransport', () => {

	it('should be exposed as winston.transports.Loggly', () => {
		assert.strictEqual(winston.transports.Loggly, LogglyTransport);
	});

	it('should be an instance of winston.Transport', () => {
		assert(new LogglyTransport() instanceof winston.Transport);
	});
	
});