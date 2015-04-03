'use strict';
module.exports = modules;

var newErrorLogs = require('./tools.js').servErrorLogs;
var modscript = require('./modscript.js').modscript;
var yaml = require('js-yaml');


function modules(url, req, res, options) {
    var log = newErrorLogs();

    modscript(log, req, url, function(status, result) {
        if (status !== true) {
            res.writeHead(404, {
                'content-type': 'application/x-javascript; charset=UTF-8'
            });

            res.end(log());
            return;
        };

        var gModules = result.gModules || {};

        res.writeHead(200, {
            'content-type': 'application/x-javascript; charset=UTF-8'
        });

        var r = {};

        for (var i in gModules) {
            var mod = gModules[i];
            if (mod && mod.src && mod.jsonData) {
                r[xDelHost(mod.src)] = mod.jsonData;
            };
        };

        if (options.yaml) {
            res.write(yaml.safeDump(r, {indent: options.yaml}));
        } else {
            res.write(JSON.stringify(r, null, "\t"));
        };

        res.end();
    });

    var xStartHost = req.xStartHost;
    function xDelHost(x) {
        x = x + '';
        return xStartHost && x.substr(0, xStartHost.length) === xStartHost
            ? x.substr(xStartHost.length)
            : x
        ;
    };

};

