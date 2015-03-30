'use strict';

module.exports = {
    modscript: modscript,
    smod: smod
};


var genReplaceHash = require('./tools.js').genReplaceHash;
var dataToJSON = require('./tools.js').dataToJSON;
var formatURL = require('./tools.js').formatURL;
var genUNIC = require('./tools.js').genUNIC;
var load = require('./load.js');
var config = require('./load-config.js');
var jsmin = require('./jsmin.js');
var PATH = require('path');
var URL = require('url');


function modscript(log, ureq, url, end) {
    var forSanboxTranslate = ureq.forSanboxTranslate;
    var exclude = ureq.excludeModules || false;

    smod(log||function(){}, ureq, url, function(status
        , global_modules
        , global_scripts
        , global_styles
    ) {

        if (status !== true) {
            if (typeof end == 'function') {
                end(false, false);
            };
            return;
        };

        var DEPEND = {};
        var MDNAME = {};
        var MDURL = {};
        var MDS = {};
        var LANGS = {};
        var TRMAP = {};


        function oForEach(object, fn) {
            for (var i in object) fn(object[i], i)
        };

        oForEach(global_modules, function(x) {
            if (exclude[x.id]) return;

            if (typeof x.src == 'object' || typeof x.src == 'boolean') {
                MDS[x.id] = x.src;
            };

            LANGS[x.id] = x.langs || false;
            MDURL[x.id] = x.src;

            var u
            , nms = [x.alias ? ('' + x.alias) : 'module']
            , de = x.de
            , dep = []
            , v, i
            ;

            for (i in de) {
                if (v = de[i]) {
                    if (/^_/.test(i)) {
                        continue;
                    };

                    nms.push(i);
                    dep.push(v.id);
                };
            };

            if (dep.length) {
                DEPEND[x.id] = dep;
            };

            MDNAME[x.id] = nms;

            var langs = x.langs, langKey = forSanboxTranslate;
            var autokey = langKey === 'key' ? x.autokey : false;
            var key, v;

            if (langs && langKey) {
                for (key in langs) {
                    v = langs[key] && langs[key][langKey];
                    if (v != null) {
                        if (langKey === 'key') {
                            if (v === false) continue;
                            if (v === true ) v = key;

                            if (autokey && (typeof v === 'string') && (v[0] === '.') ) {
                                v = autokey + v;
                            };
                        };

                        (TRMAP[x.id]||(TRMAP[x.id]={}))['_'+key] = v;
                    };
                };
            };

        });


        //log('--------------------------------');
        //log(MDS);
        //log(DEPEND);


        var u
        , files = []
        , file, url
        , a = global_scripts
        , qhost = ureq.headers['x-scmod-host'] || ('http://' + (ureq.headers.host || 'unknown.host'))
        , i = 0
        , x, v
        ;

        while(x = a[i++]) {
            if (exclude[x.moduleID]) continue;

            files.push(
                file = {
                    moduleJSON: x.moduleJSON,
                    moduleID: x.moduleID,
                    nowrap: x.nowrap,
                    js_inc: x.js_inc,
                    type: x.type,
                    src: (x.src + '')
                }
            );

            if (x.nowrap) {
                if (x.js_inc) {
                    file.url = qhost + '/code-nwp/' + x.moduleID + '/' + encodeURIComponent(x.src);
                    continue;
                };

                if (TRMAP[x.moduleID]) {
                    file.url = qhost + '/prox-tr/' + x.moduleID + '/' + (x.src+'').replace(/^(https?):\/\//, '$1/');
                    continue;
                };

                file.url = ('' + x.src);
                continue;
            };


            var tr = TRMAP[x.moduleID] ? '+' : '-';
            var url = qhost + (x.js_inc ? '/code/' : '/prox-js/'+tr+'/') + x.moduleID+'/';

            file.vars = 'module';
            if (v = MDNAME[x.moduleID]) {
                file.vars = v.map(encodeURIComponent).join(',');
            };

            url += file.vars;

            if (x.js_inc) {
                url += '/' + encodeURIComponent(x.src);
            } else {
                url += '/' + (x.src+'').replace(/^(https?):\/\//, '$1/');
            };

            file.url = url;
        };


        var styles = false;

        if (a = global_styles) {
            for(styles = [], i = 0; x = a[i++];) {
                if (exclude[x.moduleID]) continue;

                styles.push(x.src);
            };

            if (!styles.length) {
                styles = false;
            };
        };


            // '<script src=""></script>'
        var jscode = '';

        if (forSanboxTranslate) {
            jscode += ''
                + 'var __SCMODTR=__SCMODTR||new '+jsmin("", ('' + __SCMODTR).trim(), 2)+';\n'
                + '__SCMODTR('+JSON.stringify(TRMAP)+');\n'
            ;
        };

        if (exclude) {
            jscode += '__MODULE('
                + JSON.stringify({
                    MODULES: MDS,
                    DEPEND: DEPEND
                })
                + ');\n'
            ;

        } else {
            jscode += ''
                +'var __MODULE=(function(){\'use strict\';var global=window'
                    +',MODULES='+JSON.stringify(MDS)
                    +',DEPEND='+JSON.stringify(DEPEND)
                    +',depend={}'
                    +',Z;\n'
                    +'return ' + jsmin("", ('' + __MODULE).trim(), 2).trim()
                + '})();\n'
            ;
        };

        if (typeof end == 'function') {
            end(true, {
                code: jscode,
                scripts: files,
                styles: styles,
                langs: LANGS,
                mdurl: MDURL,
                gModules: global_modules
            });
        };
    });
};


function smod(log, ureq, startURL, end_compite) {
    var isLoadModuleLine = ureq.isLoadModuleLine ? true : false;
    var replaceHash = ureq.replaceHash || false;  // false - не указан , true - пустой
    var modules = {};
    var files = [];
    var styles = [];
    var stop;

    function pushModule(mod) {
        modules[mod.id] = mod;
    };


    get_module('module', startURL, [], function() {
        end_compite(true, modules, files, styles);
    });

    function get_module(type, url, modstack, end) {
        var virtmod = false, x;

        if (typeof url !== 'string' || !/^(https?|file):/.test(url) ) {
            virtmod = true;
        };

        var xurl = virtmod ? false : URL.parse(url);
        var modules_total = null;
        var modules_loaded = 0;

        var xmod = {
            id: genUNIC(type, url),
            loaded: false,
            waiting: [],
            src: url
        };

        pushModule(xmod);

        if (typeof url === 'string') {
            modstack.push(url);
        };

        var lineSending = false;
        var lineLoad = [];

        var jsonModule = null;
        var mods = {}; // карты зависимостей

        if (virtmod) {
            modules_total = modules_loaded;
            jsonModule = {};

            complit(true);
            return;
        };


        /*
        if (/[^\?]+.js(\?|\s*$)/.test(xurl.pathname)) {
            type = 'common-js';
        };
        */

        switch(type) {
            case 'text':
            case 'json':
                modules_total = 0;
                jsonModule = {
                    scripts: ['!![' + type + '] ' + url]
                };

                complit(true);
                return;

            case 'common-js':
                modules_total = 0;
                jsonModule = {
                    scripts: ['!![common-js] ' + url]
                };
                complit(true);
                return;
        };




        if (config.log) {
            console.log('mod \t', url);
        };

        load(url
            , {
                authorization: ureq.headers['authorization'],
                XForwardedFor: ureq.X_Forwarded_For
            }

            , function(status, result) {
                if (stop) return;

                if (stop = !(status === true || status === 304)) {
                    modules_total = 0;
                    jsonModule = false;

                    log('error'
                        , xmod.error = 'error load '+(status)+', module - ' + url
                    );

                    end_compite(false, 'load module');
                    return;
                };

                result.get(['module'], function(status, res) {
                    if (stop = status !== true) {
                        jsonModule = false;

                        log('error'
                            , xmod.error = 'invalid module '+(status)+', module - ' + url
                        );

                        end_compite(false, 'load module');
                        return;
                    };

                    jsonModule = res || false;

                    var x = jsonModule.scmod;
                    if (x && typeof x === 'object') {
                        jsonModule = x;
                    };

                    if (!replaceHash) {
                        replaceHash = jsonModule.replace ? genReplaceHash(xurl, jsonModule.replace) : true;
                    };

                    mload(jsonModule);
                });
            }
        );

        function mload(jsonModule) {
            var j = 0, x, z;

            xmod.jsonData = jsonModule;

            if (jsonModule.alias) {
                xmod.alias = ('' + jsonModule.alias).trim();
            };

            pushFile(xmod, jsonModule.stylesForce);

            var moList;
            if (moList = jsonModule.modules) {
                for (var name in moList) {
                    var src = moList[name], type = 'module';

                    if (typeof src !== 'string' || !(src = src.trim()) ) {
                        if (src === null || typeof src === 'boolean' || typeof src === 'object') {
                            pushModule(
                                mods[name] = {
                                    id: genUNIC('value', xmod.src + ' - ' + name),
                                    type: 'value',
                                    src: src
                                }
                            );
                        };
                        continue;
                    };

                    var xMatch = src.match(/^(?:!!|\+)\[([\w\s\,-]+)\]\s+(.*)/);
                    if (xMatch) {
                        src = xMatch[2];

                        xMatch[1].split(/\s*,\s*/).forEach(function(x) {
                            switch(x) {
                                case 'string':
                                case 'json':
                                case 'text':
                                    type = x;
                                    break;
                            };
                        });
                    };

                    if (type === 'string') {
                        pushModule(
                            mods[name] = {
                                id: genUNIC('value', xmod.src + ' - ' + name),
                                type: 'value',
                                src: src
                            }
                        );
                        continue;
                    };

                    src = formatURL(xurl, /^file:/.test(src) ? 'badurl-a:' + src : src, replaceHash);
                    if (typeof src !== 'string') {
                        if (src === null || typeof src === 'boolean' || typeof src === 'object') {
                            pushModule(
                                mods[name] = {
                                    id: genUNIC('value', xmod.src + ' - ' + name),
                                    type: 'value',
                                    src: src
                                }
                            );
                        };

                        continue;
                    };

                    if (type === 'module') {
                        switch((/\.[\w]+$/.exec(src.replace(/\?.*$/, ''))||0)[0] ) {
                            case '.txt':
                            case '.inc':
                                type = 'text';
                                break;
                        };
                    };

                    mods[name] = {
                        id: genUNIC(type, src),
                        type: type,
                        src: src
                    };

                    (isLoadModuleLine ? loadModuleLine : loadModule)(
                        mods[name], complit
                    );

                    j += 1;
                };
            };

            modules_total = j;
            complit(true);
        };

        function loadModuleLine(mod, end) {
            if (lineSending) {
                lineLoad.push([mod, end]);
                return;
            };

            lineSending = true;
            loadModule(mod, function(a,b,c) {
                end(a,b,c);

                lineSending = false;

                var x = lineLoad.shift();
                if (x) {
                    loadModuleLine(x[0], x[1]);
                };
            });
        };

        function loadModule(mod, end) {
            var x;

            if (modstack.indexOf(mod.src) != -1) {
                stop = true;

                log('error', 'error recursive load modules:\n - '
                    + modstack.join('\n - ') + '\n - ' + mod.src
                );

                end_compite(false
                    , modstack.concat([mod.src])
                );

                return;
            };


            if (x = modules[mod.id]) {
                if (x.loaded) {
                    modules_loaded += 1;
                    return end(true);
                };

                x.waiting.push(function() {
                    modules_loaded += 1;
                    end(true);
                });

                return;
            };


            get_module(mod.type, mod.src, modstack.concat(), function(status, id) {
                modules_loaded += 1;

                end(true);
            });
        };


        var _complite = false;
        function complit() {
            if (stop || _complite|| modules_total != modules_loaded) {
                return;
            };

            _complite = true;


            xmod.autokey = (typeof jsonModule.autokey === 'string' ? jsonModule.autokey : false) || false;
            xmod.nowrap = jsonModule.nowrap ? true : false; // не обворачивать в модуль
            xmod.langs = jsonModule.langs || false;

            pushFile(xmod, jsonModule.scripts);
            pushFile(xmod, jsonModule.styles);
            pushFile(xmod, jsonModule.src);

            xmod.de = false;
            for(var i in mods) {
                xmod.de = mods;
                break;
            };


            while(x = xmod.waiting.pop()) {
                x();
            };

            xmod.loaded = true;

            end(true, xmod.id);
        };


        function pushFile(xmod, list) {
            if (!list) return;

            var i, l, x, value, nowrap, inc;

            for(i = 0, l = list.length; i < l; ++i) {
                if (typeof list[i] !== 'string' || !(value = list[i].trim()) ) {
                    continue;
                };

                var file = {
                    nowrap: !!xmod.nowrap,
                    id: files.length + 1,
                    moduleJSON: jsonModule,
                    moduleID: xmod.id
                };

                nowrap = xmod.nowrap;
                inc = false;

                var xMatch = value.match(/^(?:!!|\+)\[([\w\s\,-]+)\]\s+(.*)/);
                if (xMatch) {
                    value = xMatch[2];

                    xMatch[1].split(/\s*,\s*/).forEach(function(x) {
                        switch(x) {
                            case 'inc':
                                file.type = file.type || 'js';
                                file.js_inc = true;
                            case 'nostrict':
                            case 'nowrap':
                                file[x] = true;
                                break

                            case 'sass':
                            case 'scss':
                            case 'css':
                            case 'common-js':
                            case 'json':
                            case 'text':
                            case 'js':
                                file.type = x;
                                break
                        };
                    });
                };

                if (!file.inc) {
                    value = formatURL(xurl
                        , (/^file:/.test(value) ? 'badurl-b:' + value : value)
                        , replaceHash
                    );

                    if (typeof value !== 'string') {
                        continue;
                    };

                    if (!file.type) {
                        file.type = (/^[^\?]+\.([^\?\.\/]+)/.exec(value)||0)[1] || null;
                    };
                };


                if (file.type) {
                    file.src = value;

                    switch(file.type) {
                        case 'sass':
                        case 'scss':
                        case 'css':
                            styles.push(file);

                        default:
                            files.push(file);
                    };
                };
            };
        };

    };
};




var __SCMODTR = function(key, id) {
    var MMAP = {};
    return function(key, id) {
        if (typeof key === 'object') {
            if (key) {
                var x = key, i;
                for (i in x) {
                    if (!MMAP[i]) MMAP[i] = x[i];
                }
            };

            return
        };

        var map = MMAP[id];
        if (map) {
            var v = map['_'+key];
            if (v != null) return v
        };

        return key
    }
};


function __MODULE(id, modfunc) {
    if (!id) {
        return Z = null;
    };

    if (typeof id === 'object') {
        Z = null;

        var i, x = id.DEPEND;
        for (i in x) {
            if (!DEPEND[i]) DEPEND[i] = x[i];
        };

        x = id.MODULES;
        for (i in x) {
            if (!MODULES[i]) MODULES[i] = x[i];
        };

        return;
    };

    var args = depend[id];

    if (!MODULES[id]) MODULES[id] = {};

    if (!args) {
        var dp = DEPEND[id]||[], i=0, x;
        args = [global, MODULES[id]];

        while(x = dp[i++]) {
            args.push(MODULES[x]=MODULES[x]||{});
        };

        depend[id] = args;
        Z = id;

    } else {
        args[1] = MODULES[id];

        if (id !== Z) {
            // данный модуль уже подключен
            return;
        };
    };


    var dx; args.push(function(x) {dx = dx||x});
    modfunc.apply(global, args);

    MODULES[id] = (depend[id] = dx())[1];
};

