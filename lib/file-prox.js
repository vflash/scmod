
/*
    используется для проксирования файла
*/

module.exports = fileProx;

var config = require('./load-config.js');
var accessDomain = require('./tools.js').accessDomain;
var HTTP = require('http');
var HTTPS = require('https');
var PATH = require('path');
var URL = require('url');
var FS = require('fs');


function filterProxHeaders(status, H) {
    var headers = {}, i;

    for (i in H) {
        switch(i) {
            case 'transfer-encoding':
            case 'content-length':
            case 'set-cookie':
            case 'connection':
                continue;
        };

        headers[i] = H[i];
    };
    
    return headers;
};


function fileProx(url, svreq, svres, UTFBOM, xA, xB) {
    //if (config.log) console.log('prox start - \t', url);
    var tms = new Date();

    var q = URL.parse(url, true), x;

    if (q.protocol === 'file:') {
        FS.readFile((PATH.sep === '\\' ? (q.path||'').substr(1) : q.path), {encoding: false}, function (err, chunk) {
            if (err) {
                svres.writeHead(404, {});
                svres.end('404');
                return;
            };

            svres.writeHead(200, {});

            if (chunk[0] == 0xEF && chunk[1] == 0xBB && chunk[2] == 0xBF ) {
                if (UTFBOM) svres.write(chunk.slice(0, 3));

                chunk = chunk.slice(3);
            };

            if (xA) svres.write(typeof xA === 'string' ? new Buffer(xA) : xA);

            svres.write(chunk);

            if (xB) svres.write(typeof xB === 'string' ? new Buffer(xB) : xB);

            svres.end();
        });

        return;
    };


    var headers = {host: String(q.host)};

    if (x = svreq.headers['if-modified-since']) {
        headers['If-Modified-Since'] = x;
    };
    if (x = svreq.headers['if-none-match']) {
        headers['If-None-Match'] = x;
    };
    if (x = svreq.headers['user-agent']) {
        headers['User-Agent'] = x;
    };
    if (x = svreq.headers['referer']) {
        headers['Referer'] = x;
    };

    if (x = svreq.headers['authorization']) {
        if (accessDomain(q.protocol, q.host)) {
            headers['Authorization'] = x;
        };
    };

    if (x = svreq.X_Forwarded_For ) {
        headers['X-Forwarded-For'] = x;
    };


    headers['Connection'] = 'keep-alive';


    var options = {
        rejectUnauthorized: false, 
        headers: headers,
        host: q.hostname, 
        port: +q.port || (q.protocol === 'https:' ? 443 : 80),
        path: q.path
    };
    var client = q.protocol === 'https:' ? HTTPS.request(options) : HTTP.request(options);
    var stop = false;

    client.setTimeout(16000, function() {
        svres.writeHead(504, {});
        svres.end('504');
        
        if (config.log) console.log('prox timeout - '+(new Date() - tms)+'ms - \t', url);

    });

    client.on('error', function(e) {
        if (stop) return;

        svres.writeHead(503, {});
        svres.end('503');
        
        if (config.log) {
            console.log('prox error - '+(new Date() - tms)+'ms - \t', url);
        };
    });

    client.on('response', function(response) {
        var headers = filterProxHeaders(response.statusCode, response.headers);
        var x;


        if (response.statusCode !== 200) {
            stop = true;

            if (config.log) {
                console.log('prox end - '+(new Date() - tms)+'ms - \t', url);
            };

            svres.writeHead(response.statusCode, headers);
            svres.end();

            response.resume();
            return;
        };

        //headers['content-type'] = 'application/x-javascript; charset=UTF-8';
        svres.writeHead(200, headers);

        var first = true;
        var datastart = true;


        response.on('data', function(chunk) {
            if (first) {
                first = false;

                if (chunk[0] == 0xEF && chunk[1] == 0xBB && chunk[2] == 0xBF ) {
                    if (UTFBOM) svres.write(chunk.slice(0, 3));

                    chunk = chunk.slice(3);
                };
            };


            if (chunk.length) {
                if (datastart) {
                    datastart = false;
                    if (xA) {
                        svres.write(typeof xA === 'string' ? new Buffer(xA) : xA);
                    };
                };

                svres.write(chunk);
            };
        });

        response.on('end', function() {
            stop = true;

            if (datastart) {
                svres.write(new Buffer('/* file null */') );

            } else {
                if (xB) svres.write(typeof xB === 'string' ? new Buffer(xB) : xB);
            };

            svres.end();
            
            if (config.log) console.log('prox finish - '+(new Date() - tms)+'ms - \t', url);
        }); 
    });

    client.end();
};