'use strict';

var config = require('./load-config.js');
var HTTP = require('http');
require('http-xak');

var tick = global.setImmediate || process.nextTick;

tick(function() {
    HTTP.createServer(ServerHendler).listen(config.port, config.host||'127.0.0.1');
    console.log(
        'Server running at http://'+(config.host||'127.0.0.1')+':'+(config.port)+'/'
    );
});


var sandbox = require('./cmd-sandbox.js');
var sandbox_styles = require('./cmd-sandbox_styles.js');
var scripts_pack = require('./cmd-script_pack.js');
var scripts_langs = require('./cmd-script_langs.js');
var styles_pack = require('./cmd-styles_pack.js');
var cmd_modules = require('./cmd-modules.js');
var loadReplace = require('./load-replace.js');
var load = require('./load.js');


var modscript = require('./modscript.js');
var genReplaceHash = require('./tools.js').genReplaceHash;
var newErrorLogs = require('./tools.js').servErrorLogs;
var normalizeURL = require('./tools.js').normalizeURL;
var dataToJSON = require('./tools.js').dataToJSON;
var genRegExp = require('./tools.js').genRegExp;
var formatURL = require('./tools.js').formatURL;
var aliasURL = require('./tools.js').aliasURL;
var jsToJSON = require('js-json').conv;
var yaml = require('js-yaml');
var URL = require('url');

var NULL_FUNCTION = function(){};
var VERSION = require('../package.json').version


function ServerHendler(req, res) {
    var q = URL.parse(req.url, true), x;

    req.on('close', function() {
        res.writeHead = NULL_FUNCTION;
        res.write = NULL_FUNCTION;
        res.end = NULL_FUNCTION;
    });

    req.isLoadModuleLine = true; // грузить модули последовательно
    req.replaceHash = ('rep' in q.query) ? false : true; // true - пустой , false - не инициализированный

    if (req.headers['x-real-ip']) {
        req.X_Forwarded_For = req.headers['x-real-ip'] + (req.headers['x-forwarded-for'] ? ', ' + req.headers['x-forwarded-for'] : '');

        if (('' + req.X_Forwarded_For).split(',').length > 5 ) {
            endres(res, 400);
            return;
        };
    };

    if (/^\/test($|\?)/.test(q.pathname)) {
        res.writeHead(404
            , {
                'Content-Type': 'application/x-javascript; charset=UTF-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
            }
        );

        res.end('// ok' );

        if (config.log) console.log(req.headers);
        return;
    };


    if (/^\/ver($|\?)/.test(q.pathname)) {
        res.writeHead(200
            , {
                'Content-Type': 'application/x-javascript; charset=UTF-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
                //'Expires': new Date(new Date() + 60000 * 60 *24 * 10).toUTCString()
            }
        );

        res.end('// scmod: ' + VERSION);
        return;
    };


    if (/^\/code(-nwp)?\//.test(q.pathname) ) {
        res.writeHead(200
            , {
                'Content-Type': 'application/x-javascript; charset=UTF-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
                //'Expires': new Date(new Date() + 60000 * 60 *24 * 10).toUTCString()
            }
        );

        var x;

        if (('' + q.pathname).indexOf('/code-nwp/') === 0) {
            x = (q.pathname + '');
            x = decodeURIComponent( x.substr(x.lastIndexOf('/')+1) );

            res.end(x);

        } else {
            var qm = ('' + q.path).match(/\/code\/(\w+)\/([^\/]+)\/(.+)/) || false;
            var x = decodeURIComponent(qm[3]);

            // qm[2] = qm[2] ? (qm[2][0] === '-' ? qm[2].replace('-', 'module') : qm[2]) : 'module';

            res.end('__MODULE(\''+qm[1]+'\', function(global,'+qm[2]+',__zAgS_){\'use strict\';__zAgS_(function(){return[global,'+qm[2]+']});' + x + '});');

        };

        if (config.log) {
            console.log('inc \t' + x.substr(0, 77));
        };

        return;
    };


    if (/^\/prox-js\/./.test(q.pathname)) {
        prox_script(req, res, q);
        return;
    };

    if (/^\/prox-tr\/./.test(q.pathname)) {
        prox_jsTranslate(req, res, q);
        return;
    };

    if (/^\/prox-json\/./.test(q.pathname)) {
        // prox_json(req, res, q);
        // return;
    };

    if (/^\/prox-yaml\/./.test(q.pathname)) {
        // prox_yaml(req, res, q);
        // return;
    };


    if (q.query.auth == null) { //  !== 'base'
        if (req.headers['authorization']) {
            req.headers['authorization'] = null;
        };

    } else {

        if (!req.headers['authorization']) {
            res.writeHead(401
                , {
                    'Content-Type': 'application/x-javascript; charset=UTF-8',
                    'Cache-Control': 'no-store, no-cache, must-revalidate',
                    'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT',
                    'WWW-Authenticate': 'Basic realm="Password Required"'
                }
            );

            res.end();
            return;
        };
    };


    // -compatibility with old code
    if (req.headers['x-scmod-scheme']) {
        req.headers['x-scmod-host'] = req.headers['x-scmod-scheme'] + '://' + req.headers['x-scmod-host'];
    };


    var src = aliasURL(q.query.src, false);
    if (!src) {
        return endres(res, 404);
    };


    var xsrc = URL.parse(normalizeURL(src));
    var rgxHostName = /.\.[a-zA-Z]{2,7}$/;

    var xServ = URL.parse(
        normalizeURL(
            req.headers['x-scmod-host'] || ('http://' + (req.headers.host || 'unknown.host'))
        )
    );

    req.xStartHost = xServ.protocol + '//' + xServ.host;

    if (!rgxHostName.test(xsrc.hostname) ) {
        var referer = req.headers.referer ? URL.parse(normalizeURL(req.headers.referer)) : false;

        if (referer) {
            if (req.xStartHost !== (referer.protocol + '//' + referer.host)) {
                if (q.query.x302 != null || !rgxHostName.test(referer.hostname) ) {
                    return endres(res, 400, '// 400 Bad Request, src='+q.query.src); // xxxx
                };

                var xhost = URL.parse(xServ.href);
                xhost.query = q.query;
                xhost.search = null;
                xhost.path = null;
                xhost.pathname += q.pathname;
                xhost.query.src = formatURL(referer, q.query.src);

                if (xhost.pathname.indexOf('//') == 0) {
                    xhost.pathname = xhost.pathname.substr(1);
                };

                return endres(res, 302, URL.format(xhost) );
            };
        };

        src = formatURL(req.xStartHost, src);
        xsrc = URL.parse(q.query.src = src);
    };


    function go() {
        if (!q.query.core) {
            return go_cmd(req, res, src, q);
        };

        var url_exclude = formatURL(xsrc
            , /^\/([^\/]|$)/.test(q.core) ? (req.xStartHost||'') + q.core : q.core
            , req.replaceHash || false
        );
        var log = newErrorLogs();

        modscript(log, req, url_exclude
            , function(status) {

                if (status !== true) {
                    res.writeHead(200, {'content-type': 'text/plain; charset=UTF-8'});
                    res.end(log());
                    return;
                };

                req.excludeModules = arguments[5];
                go_cmd(req, res, src, q);
            }
        );
    };

    if (!q.query.rep) {
        return go();
    };

    var url_replace = formatURL(xsrc, q.query.rep);

    req.headerAuthorization = q.auth;
    loadReplace(req, url_replace, function(status, data) {
        if (status !== true) {
            endres(res, 400, data);
            return
        };

        go();
    });

};


function prox_script(req, res, q) {
    var qm = ('' + q.path).match(/\/prox-js\/(-|\+)\/(\w+)\/([^\/]+)\/(https?)\/(.+)/) || false;
    /*
    qm[1] - lang
    qm[2] - module ID
    qm[3] - module vars
    qm[4] - src protocol
    qm[5] - src
    */

    var moduleVARS = qm[3];
    var moduleID = qm[2];

    var file, code, q;

    if (qm) {
        moduleVARS = moduleVARS ? (moduleVARS.replace(/^-(,|$)/, 'module$1')) : 'module';

        var q = URL.parse((qm[4] == 'https' ? 'https://' : 'http://') + qm[5], true);

        if (!q.host || !/.\.[a-zA-Z]{2,7}$/.test(q.hostname) || /^\.|\.\.|[^\w\-\.]/.test(q.hostname) || !(q.protocol === 'http:' || q.protocol === 'https:') ) {
            file = false;

        } else {
            file = q.href;
        };
    };

    proxScript(req, res, {
        moduleVARS: moduleVARS,
        moduleID: moduleID,
        translate: qm[1] === '+',
        file: file,
        wrap: true,
    });
};

function prox_jsTranslate(req, res, q) {
    var qm = ('' + q.path).match(/\/prox-tr\/(\w+)\/(https?)\/(.+)/) || false;
    /*
    qm[1] - module ID
    qm[2] - src protocol
    qm[3] - src
    */
    var moduleID = qm[1];

    var file = false, q;

    if (qm) {
        var q = URL.parse((qm[2] == 'https' ? 'https://' : 'http://') + qm[3], true);

        if (!q.host || !/.\.[a-zA-Z]{2,7}$/.test(q.hostname) || /^\.|\.\.|[^\w\-\.]/.test(q.hostname) || !(q.protocol === 'http:' || q.protocol === 'https:') ) {
            file = false;

        } else {
            file = q.href;
        };
    };

    proxScript(req, res, {
        moduleID: moduleID,
        translate: true,
        file: file,
    });
};


function proxScript(req, res, q) {
    var moduleVARS = q.moduleVARS;
    var moduleID = q.moduleID;
    var file = q.file;

    if (!file) {
        res.writeHead(400
            , {
                'Content-Type': 'text/plain; charset=UTF-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
            }
        );

        res.end('// Bad Request');
        return;
    };

    load(file
        , {
            authorization: req.headers['authorization'],
            XForwardedFor: req.X_Forwarded_For,
            LastModified: req.headers['if-modified-since'],
            Etag: req.headers['if-none-match'],
            status304: true
        }

        , function(status, result) {
            if (status == 304) {
                if (req.headers['if-modified-since'] || req.headers['if-none-match']) {
                    res.writeHead(304
                        , {
                            'Last-Modified': req.headers['if-modified-since'],
                            'Etag': req.headers['if-none-match'],
                        }
                    );

                    res.end('');
                    return;
                };

                status = true;
            };

            if (status !== true) {
                console.log('--error ' + status + '--', file);

                res.writeHead(+status || 500
                    , {
                        'Last-Modified': req.headers['if-modified-since'],
                        'Etag': req.headers['if-none-match'],
                    }
                );

                res.end('');
                return;
            };

            var tasks = [];

            if (q.translate) {
                tasks.push({
                    moduleID: moduleID,
                    name: 'jsTranslate'
                });
            };

            if (q.wrap) {
                tasks.push({
                    name: 'jswrap',
                    moduleID: moduleID,
                    args: moduleVARS,
                    prox: true
                });
            };

            result.get(tasks, function(status, code) {
                res.writeHead(200
                    , {
                        'Content-Type': 'application/javascript; charset=utf8',
                        'Last-Modified': result.LastModified,
                        'Etag': result.Etag,
                    }
                );

                res.end(code);
            });
        }
    );

};


function go_cmd(req, res, src, q) {
    var options = {
        autokey: ('autokey' in q.query),
        speed: ('speed' in q.query),
        yaml: ('yaml' in q.query) ? parseInt(q.query.yaml, 10) || 2 : false,
        for: q.query['for'] ? (''+q.query['for']) : false,
        lang: q.query.lang ? (''+q.query.lang) : false,
        pure: ('pure' in q.query),
        eval: ('eval' in q.query),
        max: ('max' in q.query),
        log: ('log' in q.query),
        rep: ('rep' in q.query),
        all: q.query.all ? q.query.all : ('all' in q.query)
    };

    req.isLogFiles = options.log;

    switch(q.pathname) {
        case '/json':
            view_json(req, src, options, function(status, data) {
                res.writeHead(200
                    , {
                        'Content-Type': status === true ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
                        'Cache-Control': 'no-store, no-cache, must-revalidate',
                        'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
                    }
                );

                res.end('' + data);
            });
            return;

        case '/sandbox':
            req.forSanboxTranslate = options.lang || false;
            req.isLoadModuleLine = false;

            sandbox(req, src, function(status, code) {
                res.writeHead(200
                    , {
                        'Content-Type': 'application/x-javascript; charset=UTF-8',
                        'Cache-Control': 'no-store, no-cache, must-revalidate',
                        'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
                    }
                );

                res.end(code);
            });
            return;

        case '/sandbox_scripts':
        case '/sandbox-scripts':
            req.forSanboxTranslate = options.lang || false;
            req.isLoadModuleLine = false;
            req.sandbox_scrips = true;

            sandbox(req, src, function(status, code) {
                res.writeHead(200
                    , {
                        'Content-Type': 'application/x-javascript; charset=UTF-8',
                        'Cache-Control': 'no-store, no-cache, must-revalidate',
                        'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
                    }
                );

                res.end(code);
            });
            return;

        case '/sandbox_styles':
        case '/sandbox-styles':
            req.isLoadModuleLine = false;

            sandbox_styles(req, src, function(status, code) {
                res.writeHead(200
                    , {
                        'Content-Type': 'text/css; charset=UTF-8',
                        'Cache-Control': 'no-store, no-cache, must-revalidate',
                        'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
                    }
                );

                res.end(code);
            });
            return;

        case '/scripts':
            req.isLoadModuleLine = !options.speed;
            scripts_pack(src, req, res, options);
            return;

        case '/styles':
            req.isLoadModuleLine = !options.speed;
            styles_pack(src, req, res, options);
            return;

        case '/langs':
            req.isLoadModuleLine = true;
            scripts_langs(src, req, res, options);
            return;

        case '/modules':
            req.isLoadModuleLine = true;
            cmd_modules(src, req, res, options);
            return;

        default:
            endres(res, 400);
    };
};


/*
    -------------------------- -----------------------------------
    -------------------------- -----------------------------------
    -------------------------- -----------------------------------
*/


function view_json(req, src, options, end) {
    load(src
        , {
            authorization: req.headers['authorization'],
            X_Forwarded_For: req.X_Forwarded_For
        }

        , function(status, result) {
            if (status !== true) {
                return end(false, 'status > ' + status);
            };

            result.get(['json'], function(status, data) {
                if (status == true) {
                    if (options.yaml) {
                        data = yaml.safeDump(data, {indent: options.yaml});
                    } else {
                        data = JSON.stringify(data, null, "\t");
                    };

                } else {
                    data = 'status > ' + status;
                };

                end(status, data);
            });
        }
    );
};


function endres(res, status, data) {
    var text = {
        '204': '// 204 No Content',
        '400': '// 400 Bad Request',
        '404': '// 404 Not Found'
    };

    switch(status) {
        case 301: case 302:
            res.writeHead(status
                , {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Location': data
                }
            );

            res.end();
            break;

        case 204: break;
        case 404: break;
        case 400: break;

        default:
            status = 400;
    };

    res.writeHead(status
        , {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
        }
    );

    res.end(data || text[status] || '// ups');
};
