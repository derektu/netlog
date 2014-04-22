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
        // generate unique log seq no
        //
        var keySeqNo = keyForSeqNo(logRequest.appID, logRequest.logID);
        self.redis.incrby([ keySeqNo, logRequest.logs.length ], function(err, response) {
            if (err) {
                self.emit('error', err);
                return;
            }

            var seqNo = parseInt(response, 10);
            logger.debug('seqno=' + seqNo);

            // key = keyLogList
            // list = array of log record
            //
            var keyLogList = keyForLogList(logRequest.appID, logRequest.logID);
            var multi = self.redis.multi();
            var i = 0, count = logRequest.logs.length;
            for ( ; i < count; i++) {
                logRequest.logs[i].seqno = seqNo - count + 1 + i;
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

    // return list of logs of appID/logID
    //  lastSeqNo = 欲讀取的最後一筆的seqno: 如果是0, 則從最新一筆開始
    //  count = # of 筆數
    //
    // 回傳資料為一個array, 裡面每一筆是一筆LogRecord, 順序是根據insertion的順序, 所以lastSeqNo是最後一筆
    //  onSuccess(array of logRecord)
    //  onError(error)
    //
    this.getLogData = function(appID, logID, lastSeqNo, count, onSuccess, onError) {
        // 取得最後一筆資料
        //
        var keyLogList = keyForLogList(appID, logID);
        self.redis.lindex([keyLogList, -1], function(err, response) {
            if (err != null) {
                onError(err);
                return;
            }

            if (response == null) {
                // cannot find any log
                onSuccess([]);
                return;
            }

            var logRecord = JSON.parse(response);

            var startIndex, endIndex;
            // 計算讀取範圍
            //
            if (lastSeqNo == 0 || lastSeqNo >= logRecord.seqno) {
                // 從logRecord往回讀 count筆
                //
                endIndex = -1;
            }
            else {
                endIndex = -1 * (logRecord.seqno - lastSeqNo + 1);
            }
            startIndex = endIndex - count + 1;

            logger.info("lrange start=" + startIndex + " end=" + endIndex);

            self.redis.lrange([keyLogList, startIndex, endIndex], function(err, response) {
                if (err != null) {
                    onError(err);
                    return;
                }

                var logRecords = [];
                response.forEach(function(record) {
                    logRecords.push(JSON.parse(record));
                });
                onSuccess(response);
            });
        });
    };

    function keyForSeqNo(appID, logID) {
        // key = prefix|appID|logID|seqno
        //
        return self.options.prefix + '|' + appID + '|' + logID + '|' + 'seqno';
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

