"use strict";
const winston = require('winston');
const Loggly = require('loggly').Loggly;
const Rx = require('rx');

class LogglyTransport extends winston.Transport {
	constructor(opts) {
		opts = Object.assign({
			auth: null,
			json: true,
			proxy: null,
			token: null,
			tags: [],
			bufferInterval: 1000,
			bufferSize: 100
		}, opts);
		super(opts);

		this.opts = opts;

		if (!opts.subdomain) {
			throw new Error(`LogglyTransport requires a subdomain`);
		}

		if (!opts.token) {
			throw new Error(`LogglyTransport requires a token`);
		}

		this.loggly = new Loggly({
			subdomain: opts.subdomain,
			auth: opts.auth,
			json: opts.json,
			proxy: opts.proxy,
			token: opts.token,
			tags: opts.tags
		});

		this.log$ = new Rx.Subject();

		// Send logs to the Loggly API
		this.log$
			.bufferWithTimeOrCount(opts.bufferInterval, opts.bufferSize)
			.filter(events => events.length)
			.subscribe(
				// Send logs to Loggly API
				events => this.loggly
					.log(events.map(e => e.log), (err) => {
						// Fire callbacks for each log
						events
							.map(e => e.callback)
							.forEach(cb => cb(err, !err));

						if (err) {
							return this.emit('error', err);
						}

						this.emit('logged');
					}),
				err => this.emit('error', err)
			)
	}

	log(level, message, meta, callback) {
		if (this.silent) {
			return callback(null, true);
		}

		meta || (meta = {});

		const log = Object.assign(
			{
				level,
				message,
				timestamp: new Date().toISOString()
			},
			meta,
			// Assing tags, if they are set
			meta.tags ? {
				tags: this.opts.tags.concat(meta.tags)
			} : {}
		);

		this.log$.onNext({ log, callback: callback || noop })
	}
}

LogglyTransport.prototype.name = 'loggly';

if (winston.transports.Loggly) {
	throw new Error('winston.transports.Loggly is already defined.');
}

winston.transports.Loggly = LogglyTransport;

const noop = () => {
};

module.exports = LogglyTransport;
