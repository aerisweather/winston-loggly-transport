const LogglyTransport = require('../../lib/LogglyTransport');
const assert = require('assert');
const winston = require('winston');
const nock = require('nock');
const clock = require('sinon-clock-singleton');
const sinon = require('sinon');
const _ = require('lodash');

describe('LogglyTransport', () => {

	beforeEach(() => {
		nock.disableNetConnect();
	});

	afterEach(() => {
		nock.enableNetConnect();
		nock.cleanAll();
	});

	it('should be exposed as winston.transports.Loggly', () => {
		assert.strictEqual(winston.transports.Loggly, LogglyTransport);
	});

	it('should be an instance of winston.Transport', () => {
		const transport = new LogglyTransport({
			subdomain: 'test-app',
			token: 'logglyToken123'
		});
		assert(transport instanceof winston.Transport);
	});

	it('should have a name on the prototype', () => {
		// Not totally sure why this is necessary,
		// but I see it on all the built-in transports
		assert.strictEqual(LogglyTransport.prototype.name, 'loggly');
	});

	describe('log', () => {

		it('should buffer logs, and send them in bulk to the Loggly API', (done) => {
			const transport = new LogglyTransport({
				bufferInterval: 100,
				token: 'logglyToken123',
				subdomain: 'test-app'
			});
			transport.once('error', err => done(err));

			clock.useFakeTimers(100);

			const bulkRequest = mockLoggly({
				token: 'logglyToken123',
				logs: [
					{
						level: 'info',
						message: 'Message A',
						foo: 'bar',
						timestamp: new Date(100).toISOString()
					},
					{
						level: 'warn',
						message: 'Message B',
						faz: 'baz',
						timestamp: new Date(110).toISOString()
					},
					{
						level: 'verbose',
						message: 'Message C',
						timestamp: new Date(120).toISOString()
					}
				]
			});
			
			// Send Message A (immediate)
			transport.log('info', 'Message A', { foo: 'bar' });

			// Send Message B (after 10ms)
			clock.tick(10);
			const onMessageBDone = sinon.spy(err => assert.ifError(err));
			transport.log('warn', 'Message B', { faz: 'baz' }, onMessageBDone);

			// Send Message C (after 20ms)
			clock.tick(10);
			transport.log('verbose', 'Message C');

			// Messages should be hanging out in the buffer
			assert.strictEqual(bulkRequest.isDone(), false, 'Should not have sent logs yet (buffering)');
			assert.strictEqual(onMessageBDone.called, false, 'Should not have called log callback');

			transport.once('logged', () => {
				try {
					// Messages should have been sent, now that buffer is clear
					assert.strictEqual(bulkRequest.isDone(), true, 'Should have sent loggly request, after 100ms');
					assert.strictEqual(onMessageBDone.callCount, 1, 'Should have called log callback');

					// Make sure time has passed...
					assert.strictEqual(Date.now(), 200, 'Should have waited 100ms to send logs');
				}
				catch (err) { return done(err); }

				done();
			});


			// Clear buffer interval
			clock.tick(80);
		});

		it('should clear the buffer, if more that `bufferSize` logs are sent', (done) => {
			const transport = new LogglyTransport({
				bufferInterval: 1e7,
				bufferSize: 3,
				token: 'logglyToken123',
				subdomain: 'test-app'
			});
			transport.once('error', err => done(err));

			clock.useFakeTimers(100);

			const bulkRequest = mockLoggly({
				token: 'logglyToken123',
				logs: [
					{
						level: 'info',
						message: 'Message A',
						timestamp: new Date(100).toISOString()
					},
					{
						level: 'info',
						message: 'Message B',
						timestamp: new Date(100).toISOString()
					},
					{
						level: 'info',
						message: 'Message C',
						timestamp: new Date(100).toISOString()
					}
				]
			});

			// Send 3 logs (hits bufferSize limit)
			transport.log('info', 'Message A');
			transport.log('info', 'Message B');
			transport.log('info', 'Message C');

			transport.on('logged', () =>{
				try {
					assert(bulkRequest.isDone(), 'Should have sent requests');

					// Make sure no time has passed
					assert.strictEqual(Date.now(), 100, 'should not have waiting to send logs');
				}
				catch (err) { return done(err); }
				done();
			})
		});

		it('should send tags to the Loggly API', (done) => {
			const transport = new LogglyTransport({
				subdomain: 'test-app',
				token: 'logglyToken123',
				tags: ['tagA', 'tagB'],
				bufferSize: 1
			});
			transport.once('error', err => done(err));

			clock.useFakeTimers(100);

			// Prepare Loggly API request
			const logglyReq = mockLoggly({
				token: 'logglyToken123',
				tags: ['tagA', 'tagB'],
				logs: [{
					level: 'info',
					message: 'Message A',
					timestamp: new Date().toISOString()
				}]
			});

			// Send log
			transport.log('info', 'Message A');

			transport.once('logged', () => {
				try {
					assert(logglyReq.isDone(), 'Loggly request was sent');
				}
				catch (err) { return done(err); }
				done();
			})
		});

		it('should send tags in meta data', (done) => {
			const transport = new LogglyTransport({
				subdomain: 'test-app',
				token: 'logglyToken123',
				tags: ['tagA', 'tagB'],
				bufferSize: 1
			});

			clock.useFakeTimers(100);

			// Prepare Loggly API request
			const logglyReq = mockLoggly({
				token: 'logglyToken123',
				tags: ['tagA', 'tagB'],
				logs: [{
					level: 'info',
					message: 'Message A',
					timestamp: new Date().toISOString(),
					// meta data tag is different than loggly request tag
					tags: ['foo']
				}]
			});

			transport.once('logged', () => {
				try {
					assert(logglyReq.isDone(), 'Loggly request was sent');
				}
				catch (err) { return done(err); }

				done();
			});
			transport.log('info', 'Message A', { tags: ['foo'] });
		});

		it('should emit errors from bad Loggly API responses', (done) => {
			const transport = new LogglyTransport({
				subdomain: 'test-app',
				token: 'logglyToken123',
				tags: ['tagA', 'tagB'],
				bufferSize: 1
			});

			clock.useFakeTimers(100);

			// Prepare Loggly API request
			const logglyReq = mockLoggly({
				token: 'logglyToken123',
				logs: [{
					level: 'info',
					message: 'Message A',
					timestamp: new Date().toISOString()
				}],
				statusCode: 503,
				response: { error: 'Loggly API failed' }
			});

			transport.on('error', err => {
				try {
					assert(/Loggly Error \(503\)/.test(err.message), 'error message');
					assert(logglyReq.isDone(), 'Loggly request was sent');
				}
				catch (err) { return done(err); }
				done();
			});
			transport.log('info', 'Message A');
		});

		it('should send Loggly API errors to the log callbacks', (done) => {
			const transport = new LogglyTransport({
				subdomain: 'test-app',
				token: 'logglyToken123',
				tags: ['tagA', 'tagB'],
				bufferSize: 1
			});

			clock.useFakeTimers(100);

			// Prepare Loggly API request
			const logglyReq = mockLoggly({
				token: 'logglyToken123',
				logs: [{
					level: 'info',
					message: 'Message A',
					timestamp: new Date().toISOString()
				}],
				statusCode: 503,
				response: { error: 'Loggly API failed' }
			});

			transport.log('info', 'Message A', {}, err => {
				try {
					assert(/Loggly Error \(503\)/.test(err.message), 'error message');
					assert(logglyReq.isDone(), 'Loggly request was sent');
				}
				catch (err) { return done(err); }
				done();
			});
		});

		it('should continue to send new logs to Loggly, after an error response', (done) => {
			const transport = new LogglyTransport({
				subdomain: 'test-app',
				token: 'logglyToken123',
				tags: ['tagA', 'tagB'],
				bufferSize: 1
			});

			clock.useFakeTimers(100);

			// Prepare Loggly API request
			const errorReq = mockLoggly({
				token: 'logglyToken123',
				logs: [{
					level: 'info',
					message: 'this one will fail',
					timestamp: new Date().toISOString()
				}],
				statusCode: 503,
				response: { error: 'Loggly API failed' }
			});

			transport.once('error', (err) => {
				try {
					assert(/503/.test(err), 'Received a 503 error');
					assert(errorReq.isDone(), 'First request sent to Loggly');

					const successReq = mockLoggly({
						token: 'logglyToken123',
						logs: [{
							level: 'info',
							message: 'this one will work',
							timestamp: new Date().toISOString()
						}]
					});

					transport.log('info', 'this one will work', {}, err => {
						try {
							assert.ifError(err);
							assert(successReq.isDone(), 'Second request was sent');
							done();
						}
						catch (err) {
							return done(err);
						}
					})
				}
				catch (err) {
					done(err);
				}
			});

			transport.log('info', 'this one will fail');
		});

		it('should not send logs, if opts.silent=true', (done) => {
			const transport = new LogglyTransport({
				subdomain: 'test-app',
				token: 'logglyToken123',
				bufferSize: 1,
				silent: true
			});
			transport.once('error', err => done(err));

			transport.log('info', 'message', {}, (err) => {
				try {
					assert.ifError(err);
					// Should not have sent a request (nock would error)
					done();
				}
				catch (err) { return done(err); }
			})
		});
		
	});

	function mockLoggly(opts) {
		opts = Object.assign({
			logs: [],
			response: { "response": "ok" },
			statusCode: 201,
			tags: null
		}, opts);

		if (!opts.token) {
			throw new Error(`MockLoggly requires a token`);
		}

		return nock(`https://logs-01.loggly.com`, {
			reqheaders: opts.tags ? {
				'X-LOGGLY-TAG': opts.tags.join(',')
			} : {}
		})
			.post(`/bulk/${opts.token}`, function() {
				// Loggly accepts newline-separated logs
				// See https://github.com/node-nock/nock/issues/533
				const postedLogs = this.body.toString()
					.split('\n')
					.map(logStr => JSON.parse(logStr));
				
				return _.isEqual(postedLogs, opts.logs);
			})
			.reply(opts.statusCode, opts.response);
	}
	
});