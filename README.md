# LogglyTransport

A [Loggly](https://www.loggly.com/) transport for [winston](https://github.com/winstonjs/winston), with support for bulk log posts.

## Usage

LogglyTransport may be installed via npm:

```
npm install --save winston-loggly-transport
```

You can register LogglyTransport like any other winston transport:

```
const winston = require('winston');
const LogglyTransport = require('winston-loggly-transport');

// using the default logger
winston.add(LogglyTransport, {
  token: 'yourLogglyToken',
  subdomain: 'your-loggly-subdomain'
});

// or, with a new logger instance:
const logger = new winston.Logger({
  transports: [
    new LogglyTransport({
      token: 'yourLogglyToken',
      subdomain: 'your-loggly-subdomain'
    });
  ]
});

// Log like normal:
logger.info('A message to send to Loggly', { 
  some: { meta: 'data' }
});
```

## Options

The following options are available for `LogglyTransport`:

```
// All options are optional, unless otherwise marked
new LogglyTransport({
  // Your Loggly API token (required)
  token: 'yourLogglyToken',

  // Your Loggly subdomain (required)
  subdomain: 'your-loggly-subdomain',

  // Tags to apply to all logs
  tags: [],

  // Messages logged within this time period (ms) 
  // will be sent together in bulk
  bufferInterval: 1000,

  // If there are this many messages
  // in the buffer, they will be sent together in bulk
  // (even if bufferInterval is not yet complete)
  bufferSize: 100,

  // If set to true, no messages will be sent to Loggly
  silent: false,

  // Minimum level at which messages 
  // will be sent to Loggly
  level: null
});
```

## Comparison to `winston-loggly`

This library was built as an alternative to [`winston-loggly`](https://github.com/winstonjs/winston-loggly), to overcome a few issues in that library:

* `winston-loggly` [does not support bulk requests](https://github.com/winstonjs/winston-loggly/issues/45)
* `winston-loggly` is missing test coverage of basic behavior, making new development by an outside developer tricky.

On the other hand, this library is missing some behavior provided by `winston-loggly`:

* `winston-loggly-transport` does not yet support non-bulk requests
* `winston-loggly-transport` does not yet support tags on individual logs (because in bulk requests, only one set of tags may be specified for all logs)
* `winston-loggly-transport` does not yet support HTTP authorization
* `winston-loggly-transport` does not yet accept unique input names
* `winston-loggly-transport` does not yet support the `winston` streaming api.
* `winston-loggly-transport` does not yet support the `winston` query api.