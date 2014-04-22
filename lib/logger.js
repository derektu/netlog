/**
 * Created by Derek on 2014/4/19.
 */

/*
    Global logger object

    var logger = require('./lib/logger.js');

    logger.setLevel('info');    // 'debug', 'info', 'warn', 'error'

    logger.info(..);
    logger.error(..);

 */

var winston = require('winston');

function Logger() {
    // default logger implementation instance
    //
    var _logger = new (winston.Logger)({
        transports: [
            new (winston.transports.Console)({
                level: 'debug'
            })
        ]
    });

    // change logger to another object
    //
    this.setLogger = function(logger) {
        _logger = logger;
    };

    // adjust level for each logger
    //
    this.setLevel = function(level) {
        _logger._names.forEach(function(name) {
            _logger.transports[name].level = level;
        });
    };

    this.debug = function(msg) {
        _logger.debug(msg);
    };

    this.info = function(msg) {
        _logger.info(msg);
    };

    this.warn = function(msg) {
        _logger.warn(msg);
    };

    this.error = function(msg) {
        _logger.error(msg);
    };
}

// singleton instance
//
module.exports = exports = new Logger();
