/**
 * Created by Derek on 2014/4/20.
 */

/*
    class LogServer

    - 提供log相關的API(add log/get log), 以及broadcast live log的功能


    var options = { port: 9000 }:
    var LogServer = require('./lib/logserver.js');

    var logServer = new LogServer(options, logDB);
    logServer.run();
 */

// TODO: static file path
// TODO: socket-io support

var logger = require('./logger.js'),
    logcore = require('./logcore.js'),
    express = require('express'),
    util = require('util'),
    events = require('events'),
    bodyParser = require('body-parser'),
    socketio = require('socket.io');


// class LogServer
//
var LogServer = function(options, logDB) {
    var self = this;

    options = options || {};
    options.port = options.port || 9000;

    this.options = options;
    this.logDB = logDB;

    this.expressServer = express();
    this.expressServer.use(bodyParser());

    this.logDB.on('logrequest', function(logRequest) {
    });

    // uri: /api/appIDs
    //  return list of appID (as a JSON array of string)
    //  support JSONP ('callback=..')
    //
    this.expressServer.get('/api/appIDs', function(req, res) {
        try {
            logDB.getAppIDList(
                function(appIDList) {
                    res.jsonp(appIDList);
                },
                function(err) {
                    res.send(500, 'Error=' + err.toString());
                }
            );
        }
        catch(e) {
            res.send(500, 'Error=' + e.toString());
        }
    });

    // uri: /api/<appID>/logIDs
    //  return list of logID of <appID> (as a JSON array of string)
    //  support JSONP ('callback=..')
    //
    this.expressServer.get('/api/:appID/logIDs', function(req, res){
        try {
            logDB.getLogIDList(req.params.appID,
                function(logIDList) {
                    res.jsonp(logIDList);
                },
                function(err) {
                    res.send(500, 'Error=' + err.toString());
                }
            );
        }
        catch(e) {
            res.send(500, 'Error=' + e.toString());
        }
    });

    // uri: /api/<appID>/<logID>/log
    //  method: POST
    //  post data格式: ['logdata', 'logdata'], where 'logdata' = level|msg
    //  - level是一個number, 0=debug, 1=info, 2=warn, 3=error
    //  - msg為任意log message
    //
    //  note: Content-Type必須是 'application/json'
    //
    //  return: # of log筆數 received
    //
    //  support JSONP ('callback=..')
    //
    this.expressServer.post('/api/:appID/:logID/log', function(req, res) {
        try {
            var logRecords = parsePostLogs(req.body);
            var logRequest = new logcore.LogRequest(req.params.appID, req.params.logID);
            logRecords.forEach(function(logRecord) {
                logRequest.addLog(logRecord);
            });

            self.logDB.addLogRequest(logRequest);

            res.json(logRecords.length);
        }
        catch(e) {
            res.send(500, 'Error=' + e.toString());
        }
    });

    function SocketClient(logDB, socket) {
        var self = this;

        this.socket = socket;
        this.appID = '';
        this.logID = '';
        this.level = 0;
        this.filter = '';
        this.waitingForHistData = false;
        this.waitingLogQueue = [];

        logger.info('socket client[' + socket.id + ']: CONNECT');

        // called when logdata is generated
        //
        this.handleLogRequest = function(logRequest) {
            if (self.appID == logRequest.appID && self.logID == logRequest.logID) {
                // send log to client
                //
                if (self.waitingForHistData) {
                    self.waitingLogQueue.concat(self.filterLogs(logRequest.logs));
                }
                else {
                    self.sendLogToClient(logRequest.appID, logRequest.logID, self.filterLogs(logRequest.logs));
                }
            }
        };

        logDB.on('logrequest', this.handleLogRequest);

        this.socket.on('disconnect', function() {
            logDB.removeListener('logRequest', self.handleLogRequest);
            logger.info('socket client[' + this.id + ']: DISCONNECT');
        });

        // client send 'ref' request: ref = {appID=appID, logID=logID}
        //
        this.socket.on('ref', function(ref) {
            try {
                ref.appID = ref.appID || '';
                ref.logID = ref.logID || '';
                ref.count = ref.count || 0;
                ref.level = ref.level || 0;
                ref.filter = ref.filter || '';

                if (ref.appID != "" && ref.logID != "") {
                    self.appID = ref.appID;
                    self.logID = ref.logID;
                    self.level = ref.level;
                    self.filter = ref.filter;

                    if (ref.count > 0) {
                        self.waitingForHistData = true;
                        self.waitingLogQueue = [];

                        logDB.getLastNLogData(ref.appID, ref.logID, ref.count,
                            function success(logRecords) {
                                self.waitingForHistData = false;
                                self.sendLogToClient(ref.appID, ref.logID, self.filterLogs(logRecords));
                                self.sendLogToClient(ref.appID, ref.logID, self.waitingLogQueue);
                            },

                            function error(err) {
                                self.waitingForHistData = false;
                                self.sendLogToClient(ref.appID, ref.logID, self.waitingLogQueue);
                            }
                        );
                    }
                    else {
                        self.waitingForHistData = false;
                    }
                }
            }
            catch(e) {
                logger.error('error=' + e.toString());
            }
        });

        this.sendLogToClient = function(appID, logID, logs) {
            if (logs.length > 0 && appID == self.appID && logID == self.logID)
                self.socket.emit('logReady', logs);
        };

        this.filterLog = function(log) {
            return log.level >= self.level &&
                (self.filter == '' || log.msg.indexOf(self.filter) >= 0);
        }

        this.filterLogs = function(logs) {
            var filterLogs = [];
            logs.forEach(function(log) {
                if (self.filterLog(log))
                    filterLogs.push(log);
            });
            return filterLogs;
        }
    }

    // Entry point when a socket connection is made
    //
    this.handleSocketConnection = function(socket) {
        new SocketClient(self.logDB, socket);
    };

    // static files
    //
    var staticpath = __dirname + '/../web/';
    logger.info('staticpath=' + staticpath);
    this.expressServer.use(express.static(staticpath));

    this.run = function() {
        var server = this.expressServer.listen(self.options.port);

        this.sioServer = socketio.listen(server);
        this.sioServer.on('connection', this.handleSocketConnection);
    }

    function parsePostLogs(postData) {
        if (!Array.isArray(postData))
            throw "Invalid data format: expecting array of log string";

        var logRecords = [];
        postData.forEach(function(log) {
            var idx = log.indexOf('|');
            if (idx == -1)
                throw "Invalid log string format: expecting level|message";

            var level = log.substr(0, idx);
            var desc = log.substr(idx+1);

            logRecords.push(new logcore.LogRecord(level, desc));
        });
        return logRecords;
    }

};

util.inherits(LogServer, events.EventEmitter);

module.exports = LogServer;

