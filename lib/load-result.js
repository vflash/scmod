'use strict';
/*
    используется для загрузки файла целиком
*/

module.exports = Result;

var config = require('./load-config.js');
var accessDomain = require('./tools.js').accessDomain;
var regxMaster = require('./tools.js').regxMaster;
var formatURL = require('./tools.js').formatURL;
var Wait = new require('./tools.js').Task;

var CACHE = require('./load-cache.js');
var PATH = require('path');
var URL = require('url');
var FS = require('fs');

var jsToJSON = require('js-json').conv;
var yaml = require('js-yaml');
var jsmin = require('./jsmin');


function jsMIN(code, x) {
    try {
        return [true, jsmin("", code, 1)];
    } catch (e) {
        return [true, code];
    };
};

function dataToJSON(type, data, url) {
    if (type === 'yaml') {
        try {
            return [true, yaml.safeLoad(''+data)];

        } catch (e) {
            return ['error-to-json'
                , (yaml ? 'error yaml' : 'error yaml no support') + ', module - ' + url + (yaml ? ('\n' + ('' + e)+'\n') : '')
            ];
        };

    } else {
        try {
            return [true, JSON.parse(''+data)];

        } catch (e) {
            try {
                return [true
                    , JSON.parse(jsToJSON(''+data).trim())
                ];

            } catch (e) {
                return ['error-to-json'
                    , 'error json, module - ' + url + '\n'+ ('' + e) + '\n'
                ];
            };
        };
    };
};

var cssRegxUrl = regxMaster(/[:url:]|[:str1:]|[:str2:]|[:comment_mu:]/g, {
    url: /[:\s\(,]url\(\s*([:value:])\s*\)/,
    value: /[:str1:]|[:str2:]|[^\(\)]+/,
    comment_mu: true,
    comment_mi: true,
    str2: true,
    str1: true
});

var cssRegxMinf = regxMaster(/(^|{|;|:|,|\n)\s+(?=}?)|[\t ]+(?=})|\s+(?= {)|[:comment_mu:]\s*/g, {
    comment_mu: true,
    comment_mi: true
});

var jsRegx = regxMaster(/[:str1:]|[:str2:]|[:comment_mu:]|[:comment_mi:]|[:regx:]/g, {
    comment_mu: true,
    comment_mi: true,
    regx: true,
    str2: true,
    str1: true
});

function stringToString(s) {
    try {
        return JSON.parse(s).trim();
    } catch(e) {
        return null;
    };
};

function xDelHost(xStartHost, url) {
    var url = url + '';

    return !xStartHost || url.substr(0, xStartHost.length) !== xStartHost
        ? url.replace(/^https?:\/\/[^\/]+/, '---')
        : url.substr(xStartHost.length)
    ;
};

var tick = global.setImmediate || process.nextTick;

function Result(cacheKey, op) {
    var data = op.data || '';

    this.time = +new Date();
    this.wait = new Wait();
    this.type = op.type;
    this.LastModified = op.LastModified || null;
    this.Etag = op.Etag || null;
    this.contentType = op.contentType || null;
    this.data = data;
    this.src = typeof op.src === 'string' ? URL.parse(op.src) : op.src;
    this.cache = {};

    if (cacheKey) {
        if (data.length <= CACHE.FILE_SIZE) {
            CACHE.set(cacheKey, this);
        };
    };
};

Result.prototype = {
    constructor: Result,
    data: null,

    get: function(tasks, end) {
        var data = this.data;
        var self = this;
        var step = 0;

        function next_(data) {
            var task = tasks[step++];

            if (step > tasks.length) {
                end.call(self, true, data);
                return;
            };

            if (!task) {
                next(data);
                return;
            };

            if (typeof task === 'string') {
                task = {name: task};
            };

            var name = task.name;
            self[name](task, data, function(status, result) {
                if (status !== true) {
                    end.apply(self, arguments);
                    return;
                };

                next(result);
            })
        };

        function next(data) {
            tick(function() {
                next_(data);
            });
        };

        next(data);
    },

    module: function(op, data, end) {
        end.apply(null, dataToJSON(this.type, data, this.src.href))
    },

    json: function(end) {
        end.apply(null, dataToJSON(this.type, data, this.src.href))
    },

    cssmin: function(op, data, end) {
        end(true, data.replace(cssRegxMinf, '$1'));
    },

    cssURL: function(op, data, end) {
        var code = data;

        var xFileHost = this.src.protocol + '//' + this.src.host;
        var xStartHost = op.xStartHost || xFileHost; // локальный хост

        var isStartHost = xFileHost === xStartHost;
        var xSH_length = xStartHost.length;
        var xFH_length = xFileHost.length;
        var src = this.src;

        code = code.replace(cssRegxUrl
            , function(s, x) {
                if (!x || /^['"]?[a-z]+:/i.test(x) ) {
                    return s;
                };

                if (x[0] === '\'') {
                    x = '"' + x.slice(1, -1).replace(/\\(.)|(")/g, '\\$1$2') + '"';
                };

                if (x[0] === '"') {
                    x = stringToString(x);
                    if (x == null) {
                        return s;
                    };
                };

                x = URL.parse(x).href;


                if (x[0] === '/' && !isStartHost ) {
                    x = normalizeURL(xFileHost + x);
                } else {
                    x = formatURL(src, x);
                };


                if (xSH_length && x.substr(0, xSH_length) === xStartHost) {
                    x = x.substr(xSH_length);
                };

                return s.substr(0, 5) + JSON.stringify(x) + ')';
            }
        );

        end(true, code);
    },

    css: function(op, data, end) {
        end(true, data);
    },

    jsEval: function(op, data, end) {
        var code = 'eval('
            + JSON.stringify(
                data + '\n/**///@ sourceURL=' + JSON.stringify(xDelHost(op.xStartHost, this.src.href))
            )
            + ');\n'
        ;

        end(true, code);
    },

    jsmin: function(op, data, end) {
        end.apply(null, jsMIN(data));
    },

    jswrap: function(op, data, end) {
		var shead = '__MODULE(\'' + op.moduleID + '\', function(global,'
			+ (op.args || 'module') + ',__zAgS_){\'use strict\';__zAgS_(function(){return[global,'
			+ (op.args || 'module')
			+ ']});' + (!op.prox ? '\n' : '')
			;
		var sfoot = '\n});';

        end(true, shead + data + sfoot);

    },

    jsLang: function(op, data, end) {
        var code = data;

        var moduleJSON = op.moduleJSON;
        var langKey = op.langKey;
        var langs = op.langs;
        var lang;

        if (lang = langKey ? langs[op.moduleID] : false) {
            var autokey = moduleJSON.autokey;

            if (!autokey || langKey !== 'key' || typeof autokey !== 'string') {
                autokey = false;
            };

            code = code.replace(regz, function(x) {
                if (x.charCodeAt(0) !== 34) return x;

                try {
                    var vx, vs = lang[vx = '' + JSON.parse(x)] || '';
                } catch (e) {
                    return x;
                };

                var v = vs[langKey];
                if (v != null) {
                    if (langKey === 'key') {
                        if (v === false) return x;
                        if (v === true ) v = vx;

                        if (autokey && (typeof v === 'string') && (v[0] === '.') ) {
                            v = autokey + v;
                        };
                    };

                    return JSON.stringify(v);
                } else {
                    return x;
                };
            });
        };

        end(true, code);
    },

    jsTranslate: function(op, data, end) {
        var moduleID = op.moduleID;
        var code = data;

        code = code.replace(jsRegx, function(x) {
            return x.charCodeAt(0) === 34
                ? '__SCMODTR(' + x + ', \'' + moduleID + '\')'
                : x
                ;
        });

        end(true, code);
    },

    js: function(op, data, end) {
        end(true, data);
    },

};

