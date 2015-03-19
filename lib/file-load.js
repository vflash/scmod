'use strict';
/*
    используется для загрузки файла целиком (json)
*/

module.exports = fileLoad;

var config = require('./load-config.js');
var accessDomain = require('./tools.js').accessDomain;
var HTTP = require('http');
var HTTPS = require('https');
var PATH = require('path');
var URL = require('url');
var FS = require('fs');

var CACHE = {length: 0};
var CACHE_OLD = {};
var CACHE_LIMIT_FILE = +config.CACHE_LIMIT_FILE || 2000;
var CACHE_LIMIT_SIZE = +config.CACHE_LIMIT_SIZE || 7000;
var CACHE_EXPIRES = +config.CACHE_EXPIRES || 5000;



function fileLoad(url, options, end) {
    var options = options || false;
    var src = URL.parse(url);

    src.port = src.port || (src.protocol === 'https:' ? '443' : '80');
    src.host = src.hostname + ':' + src.port;
    src.hash = null;

    if (src.protocol === 'file:') {
        FS.readFile((PATH.sep === '\\' ? (src.pathname||'').substr(1) : src.pathname), function (err, data) {
            if (err) {
                end(404, 'file:// not load');
                return;
            };

            end(true, data, false);
        });

        return;
    };

    if (!src.host || !/.\.[a-zA-Z]{2,7}$/.test(src.hostname) || /^\.|\.\.|[^\w\-\.]/.test(src.hostname)) {
        return end(400, 'bad url-hostname');
    };

    if ( !(src.protocol === 'http:' || src.protocol === 'https:') ) {
        return end(400, 'bad url-protocol');
    };


    var auth = options.authorization
        ? accessDomain(src.protocol, src.hostname, false) ? options.authorization : null
        : null
        ;

    var query = {
        rejectUnauthorized: false,
        method:'GET',
        headers: {},
        host: src.hostname,
        port: +src.port || (src.protocol === 'https:' ? 443 : 80),
        path: src.path
    };


    //CACHE
    var cacheKey = (auth ? auth : '') + '__' + URL.format(src);
    var cacheObj = CACHE[cacheKey];

    if (!cacheObj) {
        if (cacheObj = CACHE_OLD[cacheKey]) {
            CACHE[cacheKey] = cacheObj;
            CACHE.length += 1;
        };
    };

    if (cacheObj) {
        if (+new Date() - cacheObj.time < CACHE_EXPIRES) {
            end(true, cacheObj.data, cacheObj.contentType, cacheObj);
            return;
        };

        query.headers['if-modified-since'] = cacheObj.LastModified;
        query.headers['if-none-match'] = cacheObj.Etag;
    };

    if (auth) {
        query.headers.authorization = auth;
    };

    if (options.X_Forwarded_For) {
        query.headers['x-forwarded-for'] = options.X_Forwarded_For;
    };

    var client = src.protocol === 'https:' ? HTTPS.request(query) : HTTP.request(query);
    var comp = false;

    client.setTimeout(16000, function() {
        if (!comp) {
            comp = true;
            end(504, 'Gateway Timeout');
        };
    });

    client.on("error", function() {
        if (!comp) {
            comp = true;
            end(503, 'Service Unavailable');
        };
    });

    client.on('response'
        , function(res) {
            if (comp) return;

            if (res.statusCode === 304) {
                comp = true;

                cacheObj.time = +new Date();
                end(true, cacheObj.data, cacheObj.contentType, cacheObj);
                client.abort();
                return;
            };

            if (res.statusCode !== 200) {
                comp = true;

                end(res.statusCode);
                client.abort();
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

                if (!cacheObj) {
                    CACHE.length += 1;
                };

                var objResult = {
                    time: +new Date(),
                    LastModified: res.headers['last-modified'],
                    Etag: res.headers['etag'],
                    contentType: contentType,
                    data: data,
                };

                if (data.length <= CACHE_LIMIT_FILE) {
                    CACHE[cacheKey] = objResult;
                };

                end(true, data, contentType, objResult);
            });
        }
    );

    client.end();

    clearCache();
};

function clearCache() {
    if (CACHE.length > CACHE_LIMIT_SIZE) {
        CACHE_OLD = CACHE;
        CACHE = {length: 0};
    };
};


