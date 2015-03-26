'use strict';
module.exports = prox;

var regxMaster = require('./tools.js').regxMaster;
var fileResult = require('./file-result.js');
var config = require('./load-config.js');
var load = require('./load.js');
var URL = require('url');
var wrap = {};

// em5 -> import(translate,wrapImport)
// js -> import(translate,wrapModule)
// common-js -> import(wrap+translate)
// sass -> import(cat) compile

// include, js, translate, wrap
// include, css, data:url

function prox(req, res, options) {
    //  /prox/{type}/{module}/{vars}/{protocol}/{file}
    var xServ = URL.parse(req.url, true);
    var qm = ('' + xServ.path).match(/^\/prox\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(https?)\/(.+)/) || false;
    var qm = qm && {type: qm[1], module: qm[2], vars: qm[3], protocol: qm[4], file: qm[5]};

    // /prox/common-js/dddddz/-/,4/src/xfile-1.js

    if (!qm || !/^(?:common-js|json|js)$/.test(qm.type)) {
        endres(res, 400, '400 Bad Request')
        return;
    };

    var url = (qm.protocol === 'https' ? 'https://' : 'http://') + qm.file;
    qm.url = url;

    load(url
        , {
            authorization: req.headers['authorization'],
            X_Forwarded_For: req.X_Forwarded_For
        }

        , function(status, result) {
            wrap[qm.type](qm, result, function(status, result) {
                endres(res, 400, ''+result)
            });
        }
    )


};


function endres(res, status, data) {
    var text = {
        '204': '204 No Content',
        '400': '400 Bad Request',
        '404': '404 Not Found'
    };

    switch(status) {
        case 'css':
            break;

        case 'js':
            break;

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

// char, arg1, arg2
var rgxCommonJS2My = regxMaster(/[:str1:]|[:str2:]|[:comment_mu:]|[:comment_mi:]|[:regx:]|[:req:]/g, {
    comment_mu: true,
    comment_mi: true,
    regx: true,
    str2: true,
    str1: true,
    char: /^|[\s\(\;\:\&\|\=\<\>\+\-]/,
    value: /[:str1:]|[:str2:]/,
    v2: /,\s*([:value:])\s*/,
    req: /([:char:])require\(\s*([:value:])\s*(?:[:v2:])?\)/
});


wrap['common-js'] = function(qm, xfile, end) {
    // common-js -> import(wrap+translate)
    var isTranslate = /^\+/.test(qm.vars);

    end(true, wrap(xfile.data));
    return;

    function wrap(data) {
        var mp = {}, ix = 0;
        var data = (data + '').replace(rgxCommonJS2My, function(s, cha, arg1, arg2) {
            if (!arg1) return s;
            var i = mp[arg1];
            if (typeof i !== 'number' || i != i) {
                i = mp[arg1] = ix++;
            };

            return cha + 'REQUERY__[' + (i + 2) + ']';
        });

        var code = (''
            + '__MODULE(\'' + qm.module + '\',function(global,exports){'
                + 'arguments[arguments.length-1](function(){return module?module.exports:exports});'
                + 'var REQUERY_=arguments,module={exports: exports};'
                + data
            + '\n});'
        );

        return code;
        '+[expo]'
    };


    xfile.get(
        [
            {
                name: 'jsProxTranslate'
            }
        ]

        , function(status, data) {
            var data = (data + '').replace(rgxCommonJS2My, function(s, cha, arg1, arg2) {
                return cha + 'REQUERY_[' + arg1 + ']';
            });

            var code = (''
                + 'function(global,exports){'
                    + 'arguments[arguments.length-1](function() {return exports});'
                    + 'var REQUERY__=arguments,module={exports: exports};'
                    + data
                + '\n}'
            );
        }
    );
};

