'use strict';

module.exports = styles_pack;

var newErrorLogs = require('./tools.js').servErrorLogs;
var modscript = require('./modscript.js');
var load = require('./load.js');




function styles_pack(url, req, res, options) {
    var u
    , isLogFiles = !!req.isLogFiles
    , xStartHost = req.xStartHost
    , log = newErrorLogs()
    , file_index = -1
    , files
    , file
    ;

    modscript(log, req, url
        , function(status, code, _files, _styles) {
            files = _styles;

            if (status !== true) {
                res.writeHead(200, {
                    'content-type': 'text/css; charset=UTF-8'
                });

                res.end(log());
                return;
            };


            res.writeHead(200, {
                'content-type': 'text/css; charset=UTF-8'
            });

            if (_styles.length && isLogFiles) {
                var a = _styles.map(function(v){return xDelHost(v)});
                res.write('\n/*STYLES:\n' + a.join('\n') + '\n*/\n\n');
            };


            next();
        }
    );

    function next() {
        var i, src;

        do {
            i = ++file_index;
            if (i >= files.length || !files.length) {
                complite();
                return;
            };

            file = files[i];

        } while(!file);

        var url = file;

        res.write('\n\n/* url: ' + xDelHost(url) + ' */\n');
        load(url
            , {
                authorization: (req.headers||false)['authorization'],
                XForwardedFor: req.X_Forwarded_For,
            }

            , onLoad
        );

        function onLoad(status, result) {
            if (status !== true) {
                log('error', 'error load ' + status + ', file - ' + url);
                res.write('/* error load ' + status + ' */');
                next();
                return;
            };

            var tasks = [
                , 'css'
                , options.max ? null : 'cssmin'
                , {
                    name: 'cssURL',
                    xStartHost: xStartHost
                }
            ];

            result.get(tasks, function(status, data) {
                if (status !== true) {
                    log('error', 'error compile ' + status + ', file - ' + url);
                    res.write('/* error compile ' + status + ' */');
                    next();
                    return
                };

                res.write(data);
                next();
            });
        };

    };

    function xDelHost(x) {
        x = x + '';

        return !xStartHost || x.substr(0, xStartHost.length) !== xStartHost
            ? x.replace(/^https?:\/\/[^\/]+/, '---')
            : x.substr(xStartHost.length)
        ;
    };

    function complite() {
        res.write('\n'+log() );
        res.end();
    };
};







