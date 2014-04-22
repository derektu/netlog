# netlog

A simple network-based logger.

## How to install

* npm install

## Configuration & Run

* adjust configuration files: config/logdb.json && config/logserver.json
* To run the server: node index.js 

## Usage

A client application can upload log to netlog server via HTTP protocol:

* uri: (http://server/api/__appID__/__logID__/log) (__appID__, __logID__ are arbitrary string)
* method: POST
* content-type: application/json
* content-format: [ '__logdata__', '__logdata__', '__logdata__', ...]
* format of __logdata__ = __level__ '|' __message__, where __level__ is an integer: 0(verbose), 1(debug), 2(info), 3(warn), 4(error), 5(fatal)

To view logs, open your browser and points to (http://server), this will display a web UI to let you view the logs.

