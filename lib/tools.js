'use strict';

var config = require('./load-config.js');
var module = module.exports;

module.genReplaceHash = genReplaceHash;
module.servErrorLogs = servErrorLogs;
module.accessDomain = accessDomain;
module.normalizeURL = normalizeURL;
module.dataToJSON = dataToJSON;
module.regxMaster = regxMaster;
module.genRegExp = genRegExp;
module.formatURL = formatURL;
module.aliasURL = aliasURL;
module.genUNIC = genUNIC;
module.Task = Task;

var jsToJSON = require('js-json').conv;
var CRYPTO = require('crypto');
var yaml = require('js-yaml');
var PATH = require('path');
var URL = require('url');

function servErrorLogs() {
    var log = '';

    return function(type, value, x) {
        if (type == null) {
            return (log ? '\n/* ERROR COMPILE:\n' + log : '\n/* COMPILE OK ') +'*/\n';
        };

        switch(type) {
            case 'error': log += ('' + value)+'\n'; break;
            case 'debug': if (config.log) console.log(value);
        };
    };
};

function genUNIC(type, value) {
    var unic = (CRYPTO.createHash('md5')
        .update(type||'').update(value)
        .digest('hex')
        .substr(0, 12)
    );

    return (type === 'value'
        ? '_' + parseInt(unic, 16).toString(36).substr(0,5)
        : parseInt(unic, 16).toString(36).substr(0,6)
    );
};

function genReplaceHash(xurl, map, xStartHost) {
    var rp = {}, has, und, a, b, i, v;

    for (i in map) {
        var v = map[i];

        if (
            !(v === null || typeof v === 'boolean' || typeof v === 'object' || typeof v === 'string')
        ) {
            continue;
        };

        if (typeof v === 'string') {
            if (!v.trim() || /^file:/.test(v)) {
                continue;
            };
        };

        b = typeof v === 'string' ? formatURL(xurl, v) : v;
        a = formatURL(xurl, i, false, xStartHost);

        if (a && b !== und) {
            has = true;
            rp[a] = b;
        };
    };

    return has ? rp : true;
};


// востанавливает url
function formatURL(xurl, url, replaceHash, xStartHost) {
    if (typeof url !== 'string') {
        return 'badurl:' + url;
    };

    if (typeof xurl !== 'string') {
        xurl = xurl.href;
    };

    var url = normalizeURL(url);

    if (/^\/([^\/]|$)/.test(url)) {
        if (xStartHost && xurl.indexOf(xStartHost) === 0) {
            url = xStartHost + url;
        };
    };

    url = aliasURL(URL.resolve(xurl, url));

    if (replaceHash && replaceHash !== true) {
        var und;
        if (replaceHash[url] != und) {
            return replaceHash[url];
        };

        var s = url.replace(/[^\/]+$/, '');
        for(; /^(file|https?):\/\/./.test(s);  s = s.replace(/[^\/]+\/+$/, '') ) {
            if (replaceHash[s] != und) {
                if (typeof replaceHash[s] === 'string') {
                    return replaceHash[s] + url.substring(s.length)
                } else {
                    return replaceHash[s];
                };
            };
        };
    };

    return url;
};


function port(protocol) {
    return protocol === 'https:' ? '443' : protocol === 'http:' ? '80' : null;
};

function normalizeURL(url) {
    var src = URL.parse(
        (url + '').trim().replace(/\/~$/, '\/pack.yaml').replace(/\/-$/, '\/pack.json')
    );

    src.port = +src.port || +port(src.protocol) || null;
    src.hash = null;
    if (src.hostname) {
        src.host = src.hostname + (src.port ? (port(src.protocol) != src.port ? ':' + src.port : '') : '');
    };

    if (src.pathname != null) {
        src.pathname = PATH.normalize(src.pathname);
    };

    return URL.format(src);
};

function aliasURL(url, indexFile) {
    var x, u;

    if (typeof url !== 'string') return false;

    indexFile = indexFile === false ? '' : indexFile || 'index.json';

    switch(url.substring(0, url.indexOf(':')) ) {
        case 'global': return url;

        case 'github':
            x = url.substring(7).replace(/^~\//, 'master/');

            x = /^[^\/]+\/[^\/]+\/[^\/]+$/.test(x) ? x.replace(/([^\/]+)$/, '$1/$1.json')
                : /[^\/]+\/$/.test(x) ? x + indexFile
                : x
            ;

            x = x.replace(/^([^\/]+)\/([^\/]+)\/([^\/]+)/, '$2/$3/$1');

            return normalizeURL('https://raw.githubusercontent.com/' + x);

        case 'bitbucket':
            x = url.substring(10).replace(/^~\//, 'master/');

            x = /^[^\/]+\/[^\/]+\/[^\/]+$/.test(x) ? x.replace(/([^\/]+)$/, '$1/$1.json')
                : /[^\/]+\/$/.test(x) ? x + indexFile
                : x
            ;

            x = x.replace(/^([^\/]+)\/([^\/]+)\/([^\/]+)/, '$2/$3/raw/$1');

            return normalizeURL('https://bitbucket.org/' + x);

        default:
            return url;
    };

};

function dataToJSON(type, data, log, url) {
    var mod_json = false;

    if (typeof log !== 'function') {
        log = function(){};
    };

    if (type === 'yaml' || type === 'text/yaml' || type === 'application/yaml' || /\.yaml$/.test(url.replace(/\?.*$/, ''))) {
        try {
            //mod_json = yaml.load(data);
            mod_json = yaml.safeLoad(''+data);

        } catch (e) {
            mod_json = false;

            log('error'
                , (yaml ? 'error yaml' : 'error yaml no support') + ', module - ' + url + (yaml ? ('\n' + ('' + e)+'\n') : '')
            );
        };

    } else {

        try {
            mod_json = JSON.parse(''+data);

        } catch (e) {
            try {
                mod_json = JSON.parse(jsToJSON(''+data).trim());

            } catch (e) {
                mod_json = false;

                log('error'
                    , 'error json, module - ' + url + '\n'+ ('' + e) + '\n'
                );
            };
        };
    };

    return mod_json;
};


var auth_domains = config.auth_domains ? ('' + config.auth_domains).split(/\s+/) : false
function accessDomain(protocol, host, allowed_domains) {
    if (!/^https?:$/.test(protocol) ) return false;

    var m = auth_domains || [], i = 0, s;
    if (allowed_domains) {
        m = m.concat(('' + allowed_domains).split(/\s+/));
    };

    for (host = ('' + host); i < m.length; i++) {
        if (s = m[i]) {
            if (s.charCodeAt(0) === 46 ? host.substr(-s.length) === s || host === s.substr(1) : host === s)  {
            return true;
            };
        };
    };

    return false;
};


var mapRegx = {
    str1: /'(?:\\(?:[^']|')|[^'\n\\])*'/, // строка в одерной кавычке
    str2: /"(?:\\(?:[^"]|")|[^"\n\\])*"/, // строка в двойной кавычке
    regx: /\/[^\*\/\n](?:\\\\|\\\/|[^\/\n])+\/[igm]{0,3}/,  // регулярка
    comment_att: /\/\*\!(?:[^*]|\*(?=[^\/]))*\*\//, // комментарий /*! .... */
    comment_spe: /\/\*\@(?:[^*]|\*(?=[^\/]))*\*\//, // комментарий /*@ .... */
    comment_mu: /\/\*(?:\s|[^*]|\*(?=[^\/]))*\*\//, // комментарий /* .... */
    comment_mi: /\/\/[^\n]*/, // комментарий
};

function genRegExp(a) {
    return new RegExp(
        a.map(
            function(x){
                if (typeof x === 'string') x = mapRegx[x];

                return x.source || '('+genRegExp(x).source+')';
            }
        ).join('|')
        , 'g'
    )
};

function regxMaster(irgx, conf) {
    conf = conf || false;
    var corx = {};

    return new RegExp(rxCreate(null, irgx.source), ''
        + (irgx.global ? 'g' : '')
        + (irgx.ignoreCase ? 'i' : '')
        + (irgx.multiline ? 'm' : '')
    );

    function rxCreate(name, rgs) {
        var res = rgs.replace(/\[:\w+:\]/g, function(x) {
            var name = x.slice(2, -2), q, r;

            if (q = corx[name]) return q;

            var tmp = conf[name];
            if (tmp === true || typeof tmp === 'string') {
                if (r = mapRegx[typeof tmp === 'string' ? tmp : name]) {
                    return corx[name] = r.source;
                };
                return x;
            };

            return tmp
                ? rxCreate(name, tmp.source)
                : x
                ;
        });

        return name
            ? corx[name] = res
            : res
            ;
    };
};


function Task() {
    var map = {};

    return function(key, end) {
        var waits = map[key];
        if (waits) {
            waits.push(end);
            return;
        };

        var waits = map[key] = [end];

        return function() {
            var i = 0, end;
            delete map[key];

            while(end = waits[i++]) {
                end.apply(this, arguments);
            };
        }
    };
};

