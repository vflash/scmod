'use strict';
module.exports = script_pack;

var config = require('./load-config.js');
var newErrorLogs = require('./tools.js').servErrorLogs;
var genRegExp = require('./tools.js').genRegExp;
var formatURL = require('./tools.js').formatURL;
var modscript = require('./modscript.js').modscript;
var jsmin = require('./jsmin.js');
var load = require('./load.js');
var URL = require('url');



function script_pack(url, req, res, options) {
    var u
    , isLogFiles = !!req.isLogFiles
    , xStartHost = req.xStartHost
    , langKey = options.lang
    , log = newErrorLogs()
    , file_index = -1
    , files
    , langs
    ;

    modscript(log, req, url, function(status, result) {
        if (status !== true) {
            res.writeHead(200, {
                'content-type': 'application/x-javascript; charset=UTF-8'
            });

            res.end(log());
            return;
        };

        res.writeHead(200, {
            'content-type': 'application/x-javascript; charset=UTF-8'
        });

        files = result.scripts;
        langs = result.langs;

        if (files.length && isLogFiles) {
            var a = files.map(function(v){
                return xDelHost(v.src) + (v.vars ? '  - ('+ v.vars +')': '')
            });
            res.write('\n/*SCRIPTS:\n' + a.join('\n') + '\n*/\n\n');
        };

        res.write(result.code);
        next();
    });

    function next() {
        var file, i;

        do {
            i = ++file_index;
            if (i >= files.length || !files.length) {
                complite();
                return;
            };

            file = files[i];

        } while(!file);

        if (typeof file !== 'object') {
            complite();
            return;
        };

        var url = file.src;

        if (file.js_inc) {
            if (config.log) {
                console.log('inc \t ' + ('' + file.src).substr(0, 77));
            };

            res.write('\n\n/* -- inline code -- */\n');
            onLoad(true
                , new Result(null, {
                    data: file.src,
                    type: 'js',
                    src: 'js-inc:module-' + file.moduleID
                })
            );
            return;
        };


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
                , 'js'

                , (options.max ? null : {
                    name: 'jsmin'
                })

                , {
                    name: 'jsLang',
                    moduleJSON: file.moduleJSON,
                    langKey: langKey,
                    langs: langs
                }

                , (file.nowrap ? null : {
                    name: 'jswrap',
                    moduleID: file.moduleID,
                    args: file.vars
                })

                , (!options.eval ? null : {
                    name: 'jsEval',
                    xStartHost: xStartHost
                })
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







