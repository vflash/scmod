'use strict';
module.exports = prox;

var regxMaster = require('./tools.js').regxMaster;
var fileResult = require('./file-result.js');
var config = require('./load-config.js');
var load = require('./load.js');
var URL = require('url');
var wrap = {};
var mixLoad = require('./load-mix.js');

// em5 -> import(translate,wrapImport)
// js -> import(translate,wrapModule)
// common-js -> import(wrap+translate)
// sass -> import(cat) compile

// include, js, translate, wrap
// include, css, data:url

function prox(req, res, options) {
    //  /prox/{type}/{vars}/{protocol}/{file}
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


worker.sass = function(qm, result, end) {
    var log = function(){};

    function normUrl(url, prev) {
        if (/^[^\/\.]/.test(url)) url = '/src/' + url;
        if (!/\.sass$/.test(url)) url += '.sass';
        return formatURL(null, prev, url);
    };

    sassLoad(qm.url, false, function(status, result) {
        //console.log(result)

        var res = sass.render({
            file: '/' + qm.protocol + '/' + qm.file,
            data: result,
            indentedSyntax: true,
            outputStyle: 'nested',
            //sourceMapEmbed: true,
            //sourceMap: 'sss',

            importer: function(url, prev, done) {
                url = normUrl(url
                    , prev.replace(/^\/(file|https?)(\/.*)/, '$1:/$2')
                );

                load(url, false, function(status, res) {
                    done({
                        file: url.replace(/^\/(file|https?):\/(.*)/, '$1$2'),
                        contents: res.data
                    });
                });
            },

        }, function(error, res) {
            if (error) {
                end(false, error+'\n'+result);
                return;
            };

            end(true, res.css)
        });
    });

    return;


    modscript.smod(log, qm.req, qm.url, function(status
        , global_modules
        , global_scripts
        , global_styles
    ) {

        var mixreq = {}, files = {};
        for(var idMod in global_modules) {
            files[global_modules[idMod].src] = global_modules[idMod].src;
            mixreq[idMod] = global_modules[idMod].src;
        };

        mixLoad(mixreq, false, function(status, resmix) {
            if (status !== true) {
                console.dir(arguments);
                end();
                return;
            };

            var value = ''
            for(var idMod in resmix) {
                value += ',' + resmix[idMod].hashGet();
            };

            var sassHas = genHash(value)
            //console.log(sassHas);
            end();

        });


        return;

        var res = sass.render({
            //file: '/path/to/file.scss',
            file: '/' + qm.protocol + '/' + qm.file,
            data: result.data,
            indentedSyntax: true,
            //data: 'body{background:blue; a{color:black;}}',
            outputStyle: 'nested',
            sourceMapEmbed: true,
            sourceMap: 'sss',
            sourceComments: 'normal',
            importer: function(url, prev, done) {
                console.log('--->>', url, prev);

                url = normUrl(url
                    , prev.replace(/^\/(file|https?)(\/.*)/, '$1:/$2')
                );


                load(url, false, function(status, res) {
                    console.log('load >>', url, res.data);
                    done({
                        file: url.replace(/^\/(file|https?):\/(.*)/, '$1$2'),
                        contents: res.data
                    });
                });
                //console.log('imp',arguments)
            },

        }, function(error, result) {
            console.log('end',arguments);
            if (error) return;
            console.log(result.css+'')
        });


        //console.log(res)


    });
};

function sassLoad(url, opLoad, end) {
    function normUrl(url, prev) {
        if (/^[^\/\.]/.test(url)) url = '/src/' + url;
        if (!/\.sass$/.test(url)) url += '.sass';
        return formatURL(null, prev, url);
    };

    load(url, opLoad, function(status, result) {
        if (status !== true) {
            console.log('++', status, url)
            return;
        };

        var data = result.data;
        var deps = [];
        var das = {};

        result.get(['module'], function(status, result) {
            var a = result.modules;
            if (a) {
                for(var ix in a) {
                    deps.push(formatURL(null, url, a[ix]));
                };
                console.log(deps);
                loadNext();
                return;
            };

            end(true, data);
        });

        function loadNext() {
            var file = deps.shift();
            if (!file) {
                return compile();
            };

            sassLoad(file, opLoad, function(status, sass) {
               das[file] = sass;
               loadNext();
            });
        };

        function compile() {
            var regx = /(^|\n)([ ]*)@import\s+([^\s]+)[^\n]*/g;

            data = data.replace(regx, function(s, start, indent, inc) {
                var inc = normUrl(inc, url);
                console.log('<<', inc)

                return das[inc]
                    ? start + das[inc].replace(/(^|\n)/g, '$1' + indent)
                    : s
                    ;
            });

            end(true, data);
        };
    })
}
