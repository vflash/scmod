'use strict';
module.exports = importStyles;

var newErrorLogs = require('./tools.js').servErrorLogs;
var smod = require('./modscript.js').smod;

function importStyles(url, req, res, options) {
    var log = newErrorLogs();

    smod(log, req, url, function(status
        , global_modules
        , global_scripts
        , global_styles
    ) {
        if (status !== true) {
            res.writeHead(400, {
                'content-type': 'application/x-javascript; charset=UTF-8'
            });

            res.end(log());
            return;
        };

        res.writeHead(200, {
            'content-type': 'application/x-javascript; charset=UTF-8'
        });


        var styles = global_styles.map(function(x) {
            var src = xDelHost(x.src);

            return '@import ' + src;
        })

        res.write(styles.join('\n') + '\n');
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

