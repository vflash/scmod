'use strict';
module.exports = prox;

var regxMaster = require('./tools.js').regxMaster;
var formatURL = require('./tools.js').formatURL;
var fileResult = require('./file-result.js');
var genHash = require('./tools.js').genHash;
var modscript = require('./modscript.js');
var config = require('./load-config.js');
var mixLoad = require('./load-mix.js');
var load = require('./load.js');
var URL = require('url');
var worker = {};
//var sass = require('node-sass');


function prox(req, res, options) {
    //  /prox/{type}/{module}/{vars}/{protocol}/{file}
    var xServUrl = URL.parse(req.url, true);
    var qm = ('' + xServUrl.path).match(/^\/prox\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(https?)\/(.+)/) || false;
    var qm = qm && {type: qm[1], module: qm[2], vars: qm[3], protocol: qm[4], file: qm[5]};

    // /prox/common-js/dddddz/-/,4/src/xfile-1.js
    if (!qm || !/^(?:common-js|text|json|js)$/.test(qm.type)) {
        endres(res, 400, '400 Bad Request')
        return;
    };

    var url = (qm.protocol === 'https' ? 'https://' : 'http://') + qm.file;
    qm.url = url;
    qm.req = req;
    qm.res = res;

    worker[qm.type](qm, function(status, head, data) {
        endres(res, status, head, data);
    });
};


function endres(res, status, head, data) {
    switch(status) {
        case true:
        case 304:
        case 200:
            res.writeHead(status, head);
            res.end(data || null);
            return;

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

    var text = {
        '204': '204 No Content',
        '400': '400 Bad Request',
        '404': '404 Not Found'
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

function loadProx(qm, end) {
    var req = qm.req;

    load(qm.url
        , {
            authorization: req.headers['authorization'],
            XForwardedFor: req.X_Forwarded_For,
            LastModified: req.headers['if-modified-since'],
            Etag: req.headers['if-none-match'],
            status304: true
        }

        , function(status, result) {
            if (status == 304) {
                var reqLastModified = req.headers['if-modified-since'];
                var reqEtag = req.headers['if-none-match'];

                if (reqLastModified || reqEtag) {
                    if (result.LastModified === reqLastModified || result.Etag === reqEtag) {
                        end(304
                            , {
                                'Last-Modified': req.headers['if-modified-since'],
                                'Etag': req.headers['if-none-match'],
                            }
                        );
                        return;
                    };
                };

                status = true;
            };

            if (status !== true) {
                end(+status || 500
                    , {
                        'Last-Modified': req.headers['if-modified-since'],
                        'Etag': req.headers['if-none-match'],
                    }
                );

                return;
            };

            end(true, result);
        }
    );
};

worker['js'] = function(qm, end) {
    var moduleVARS = (qm.vars).replace(/^[+-],/, '');
    var moduleID = qm.module;
    var translate = /^\+/.test(qm.vars);
    var wrap = /^[\+\-],./.test(qm.vars);

    loadProx(qm, function(status, result) {
        if (status !== true) {
            end(status, result);
            return;
        };

        var tasks = [];

        if (translate) {
            tasks.push({
                moduleID: moduleID,
                name: 'jsTranslate'
            });
        };

        if (wrap) {
            tasks.push({
                name: 'jswrap',
                moduleID: moduleID,
                args: moduleVARS,
                prox: true
            });
        };

        result.get(tasks, function(status, code) {
            end(200
                , {
                    'Content-Type': 'application/javascript; charset=utf8',
                    'Last-Modified': result.LastModified,
                    'Etag': result.Etag,
                }
                , code
            );
        });
    });
};

worker['common-js'] = function(qm, end) {
    var translate = /^\+/.test(qm.vars);

    loadProx(qm, function(status, result) {
        if (status !== true) {
            end(status, result);
            return;
        };

        var tasks = [];

        if (translate) {
            tasks.push({
                moduleID: qm.module,
                name: 'jsTranslate'
            });
        };

        tasks.push({
            name: 'jswrap',
            moduleID: qm.module,
            type: 'common-js',
            prox: true
        });

        result.get(tasks, function(status, code) {
            end(200
                , {
                    'Content-Type': 'application/javascript; charset=utf8',
                    'Last-Modified': result.LastModified,
                    'Etag': result.Etag,
                }
                , code
            );
        });
    });
};

worker['text'] = function(qm, end) {
    loadProx(qm, function(status, result) {
        if (status !== true) {
            end(status, result);
            return;
        };

        var tasks = [
            {
                name: 'data2js',
                moduleID: qm.module,
                type: 'text',
                prox: true
            }
        ];

        result.get(tasks, function(status, code) {
            end(200
                , {
                    'Content-Type': 'application/javascript; charset=utf8',
                    'Last-Modified': result.LastModified,
                    'Etag': result.Etag,
                }
                , code
            );
        });
    });
};


worker['json'] = function(qm, end) {
    loadProx(qm, function(status, result) {
        if (status !== true) {
            end(status, result);
            return;
        };

        var tasks = [
            {
                name: 'json'
            },

            {
                name: 'data2js',
                moduleID: qm.module,
                type: 'json',
                prox: true

            }
        ];

        result.get(tasks, function(status, code) {
            end(200
                , {
                    'Content-Type': 'application/javascript; charset=utf8',
                    'Last-Modified': result.LastModified,
                    'Etag': result.Etag,
                }
                , code
            );
        });
    });
};
