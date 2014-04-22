/**
 * Created by Derek on 2014/4/18.
 */

/*
    var logcore = require('lib/logcore.js');

    var logRecord = new logcore.LogRecord('info', 'msg1');

    var logRequest = new logcore.LogRequest('appID', 'logID');
    logRequest.addLog(logRecord);

    var logRecords = logRequest.logs;

*/

var logcore = exports;

// LogRecord: 一筆log記錄
//
logcore.LogRecord = function(level, msg) {
    this.level = level;
    this.msg = msg;
};

// LogRequest: 定義某個ap的log資料,
//  - 包含appID/logID, 以及多筆LogRecords (logs)
//
logcore.LogRequest = function(appID, logID) {
    this.appID = appID;
    this.logID = logID;
    this.logs = [];

    this.addLog = function(logRecord) {
        this.logs.push(logRecord);
    }
};




