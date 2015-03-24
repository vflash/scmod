'use strict';
/*
    используется для загрузки файла целиком
*/

module.exports = load;

var config = require('./load-config.js');
var accessDomain = require('./tools.js').accessDomain;
var task = new require('./tools.js').Task();

var Result = require('./load-result.js');
var CACHE = require('./load-cache.js');
var HTTPS = require('https');
var HTTP = require('http');
var PATH = require('path');
var URL = require('url');
var FS = require('fs');

function port(protocol) {
    return protocol === 'https:' ? '443' : protocol === 'http:' ? '80' : null;
};


function load(url, options, end) {
    var options = options || false;
    var status304 = options.status304 ? 304 : true;
    var src = URL.parse(url);

    src.host = src.hostname + (src.port ? (port(src.protocol) != src.port ? ':' + src.port : '') : '');
    src.pathname = PATH.normalize(src.pathname);
    src.port = +src.port || +port(src.protocol) || null;
    src.hash = null;

    url = URL.format(src);

    var auth = options.authorization && src.protocol !== 'file:'
        ? accessDomain(src.protocol, src.hostname, false) ? options.authorization : null
        : null
        ;

    var cacheKey = 'key-' + url + (auth ? ' - ' + auth : '');
    var cacheObj = CACHE.get(cacheKey);

    if (cacheObj) {
        if (+new Date() - cacheObj.time < CACHE.EXPIRES) {
            end(status304, cacheObj);
            return;
        };
    };

    var fileType = (src.pathname||'').match(/\.(\w+)$/);
    var fileType = fileType ? fileType[1] : null;

    if (src.protocol === 'file:') {
        FS.readFile((PATH.sep === '\\' ? (src.pathname||'').substr(1) : src.pathname), function (err, data) {
            if (err) {
                end(404, {
                    data: 'file:// not load'
                });
                return;
            };

            end(true
                , new Result(cacheKey, {
                    time: +new Date(),
                    type: fileType,
                    data: data,
                    src:  URL.parse(url),
                    //LastModified: res.headers['last-modified'],
                    //Etag: res.headers['etag'],
                    //contentType: contentType,
                })
            );
        });
        return;
    };

    if (!src.host || !/.\.[a-zA-Z]{2,7}$/.test(src.hostname) || /^\.|\.\.|[^\w\-\.]/.test(src.hostname)) {
        return end('bad url-hostname', false);
    };

    if ( !(src.protocol === 'http:' || src.protocol === 'https:') ) {
        return end('bad url-protocol', false);
    };


    var end = task(cacheKey, end);
    if (!end) return;

    var query = {
        rejectUnauthorized: false,
        method:'GET',
        headers: {},
        host: src.hostname,
        port: +src.port || (src.protocol === 'https:' ? 443 : 80),
        path: src.path
    };

    if (cacheObj) {
        query.headers['if-modified-since'] = cacheObj.LastModified;
        query.headers['if-none-match'] = cacheObj.Etag;
    } else {
        query.headers['if-modified-since'] = options.LastModified;
        query.headers['if-none-match'] = options.Etag;
    };

    if (options.XForwardedFor) {
        query.headers['x-forwarded-for'] = options.XForwardedFor;
    };

    if (auth) {
        query.headers.authorization = auth;
    };

    var client = src.protocol === 'https:' ? HTTPS.request(query) : HTTP.request(query);
    var comp = false;

    client.setTimeout(16000, function() {
        if (!comp) {
            comp = true;
            end(504, {
                data: 'Gateway Timeout'
            });
        };
    });

    client.on("error", function() {
        if (!comp) {
            comp = true;
            end(503, {
                data: 'Service Unavailable'
            });
        };
    });

    client.on('response'
        , function(res) {
            if (comp) return;

            if (comp = res.statusCode == 304) {
                client.abort();

                if (cacheObj) {
                    cacheObj.time = +new Date();
                    end(status304, cacheObj);
                    return;
                };

                end(304, null);
                return;
            };

            if (comp = res.statusCode !== 200) {
                client.abort();

                end(res.statusCode, {
                    headers: res.headers,
                    data: null
                });
                return;
            };

            var contentType = (res.headers['content-type']||'').split(';')[0];
            var data = '';

            res.setEncoding('utf8');

            res.on('data', function(c) {
                data += c;
            });

            res.on('end', function() {
                if (comp) return;
                comp = true;

                end(true
                    , new Result(cacheKey, {
                        time: +new Date(),
                        type: fileType,
                        data: data,
                        src:  URL.parse(url),
                        LastModified: res.headers['last-modified'],
                        Etag: res.headers['etag'],
                        contentType: contentType
                    })
                );
            });
        }
    );

    CACHE.clear();
    client.end();
};





