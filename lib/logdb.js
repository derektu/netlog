/**
 * Created by Derek on 2014/4/19.
 */

/*
    class LogDB

    var options = { host: "localhost", port: 6379, expire: 86400, prefix: "nl" }:

    var LogDB = require('./lib/logdb.js');
    var logDB = new LogDB(options);


    logDB.on('error', function(error) {..});
    logDB.on('logrequest', function(logRequest) {..});

 */

var logger = require('./logger.js'),
    redis = require('redis'),
    util = require('util'),
    events = require('events'),
    _s = require('underscore.string');

// class LogDB
//
var LogDB = function (options) {

    var self = this;

    options = options || {};
    options.redishost = options.redishost || 'localhost';
    options.redisport = options.redisport || 6379;
    options.expire = options.expire || 86400 * 2;   // 2 days
    options.prefix = options.prefix || 'nl';       // key prefix

    this.options = options;
    this.redis = redis.createClient(options.redisport, options.redishost);

    self.redis.on('error', function(error) {
        logger.error('redis error:' + error);
        self.emit('error', error);
    });


    // addLogRequest to database
    //  fire 'addLogRequest' event when it is done.
    //
    this.addLogRequest = function(logRequest) {
        // key = keyLogList
        // list = array of log record
        //
        var keyLogList = keyForLogList(logRequest.appID, logRequest.logID);
        var multi = self.redis.multi();
        var i = 0, count = logRequest.logs.length;
        for ( ; i < count; i++) {
            multi.rpush(keyLogList, JSON.stringify(logRequest.logs[i]));
        }

        // set TTL
        multi.expire(keyLogList, self.options.expire);

        multi.exec(function(err, replies) {
            if (err) {
                self.emit('error', err);
                return;
            }

            // notify that logs are added successfully
            //
            self.emit('logrequest', logRequest);
        });
    };

    // return list of appID
    //  onSuccess(array of appID)
    //  onError(error)
    //
    this.getAppIDList = function(onSuccess, onError) {
        self.redis.keys(getKeyPatternForLogList(), function(err, response) {
            if (err != null) {
                self.emit('error', err);
                onError(err);
                return;
            }

            var map = parseLogListKeys(response);
            var appIDList = [];

            if (map != null) {
                Object.keys(map).forEach(function(key){
                    appIDList.push(key);
                });
            }
            onSuccess(appIDList);
        });
    };

    // return list of logID (of the specified appID)
    //  onSuccess(array of appID)
    //  onError(error)
    //
    this.getLogIDList = function(appID, onSuccess, onError) {
        self.redis.keys(getKeyPatternForLogList(), function(err, response) {
            if (err != null) {
                onError(err);
                return;
            }

            var map = parseLogListKeys(response);
            var logIDList = [];

            if (map != null) {
                logIDList = map[appID] || [];
            }
            onSuccess(logIDList);
        });
    };


    this.getLastNLogData = function(appID, logID, count, onSuccess, onError) {
        var keyLogList = keyForLogList(appID, logID);
        self.redis.lrange([keyLogList, -1 * count, -1], function(err, response) {
            if (err != null) {
                onError(err);
                return;
            }

            var logRecords = [];
            response.forEach(function(record) {
                logRecords.push(JSON.parse(record));
            });

            onSuccess(logRecords);
        });

    }

    function keyForLogList(appID, logID) {
        // key = prefix|appID|logID|list
        //
        return self.options.prefix + '|' + appID + '|' + logID + '|' + 'list';
    }

    function getKeyPatternForLogList() {
        // pattern = prefix|*|*|list
        //
        return self.options.prefix + '|' + '*' + '|' + '*' + '|' + 'list';
    }

    // parse array of log list key and return map of AppID
    //  {
    //      <AppID1> : [ <LogID1>, <LogID2> .. ],
    //      <AppID2> : [ <LogID1>, <LogID2> .. ]
    //  }
    function parseLogListKeys(keys) {
        var mapAppID = {};

        keys.forEach(function(key) {
            var ids = parseLogListKey(key);
            if (ids != null) {
                // ids[0] = appID
                // ids[1] = logID
                //
                var logIDList = mapAppID[ids[0]];
                if (typeof(logIDList) == 'undefined') {
                    mapAppID[ids[0]] = [ ids[1] ];
                }
                else {
                    logIDList.push(ids[1]);
                }
            }
        });
        return mapAppID;
    }

    // extract the appID/logID parts in key (getKeyPatternForLogList)
    //  return [ appID, logID ]
    //
    function parseLogListKey(key) {
        var prefix = self.options.prefix + '|';
        if (!_s.startsWith(key, prefix))
            return null;

        key = key.slice(prefix.length);

        var match = key.match(/(.+)\|(.+)\|list/);
        if (match != null)
            return [match[1], match[2]];
        else
            return null;
    }

};

util.inherits(LogDB, events.EventEmitter);

module.exports = LogDB;

