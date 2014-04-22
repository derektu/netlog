/**
 * Created by Derek on 2014/4/20.
 */

/*
    Main execution file for netlog
 */

var logger = require('./lib/logger.js');

    // configure global logger
    //
    logger.setLevel('debug');

var LogDB = require('./lib/logdb.js');
var LogServer = require('./lib/logserver.js');

var logServerOption = require('./config/logserver.json');
var logDBOption = require('./config/logdb.json');

var logDB = new LogDB(logDBOption);
var logServer = new LogServer(logServerOption, logDB);

logServer.run();
