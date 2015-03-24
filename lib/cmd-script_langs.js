'use strict';

module.exports = script_langs;

var newErrorLogs = require('./tools.js').servErrorLogs;
var regxMaster = require('./tools.js').regxMaster;
var modscript = require('./modscript.js');
var load = require('./load.js');
var yaml = require('js-yaml');

var jsRegx = regxMaster(/[:str1:]|[:str2:]|[:comment_mu:]|[:comment_mi:]|[:regx:]/g, {
    comment_mu: true,
    comment_mi: true,
    regx: true,
    str2: true,
    str1: true
});


function script_langs(url, req, res, options) {
    var u
    , langsFor = options.for
    , log = newErrorLogs()
    , file_index = -1
    , files
    , langs
    , mdurl
    , LNG = {}
    , modID
    ;

    var langsFor = (function() {
        var m = [];

        if (typeof langsFor === 'string') {
            langsFor.split(',').forEach(function(v) {
                if (v = ('' + v).trim()) {
                    if (m.indexOf('v') === -1) {
                        m.push(v);
                    };
                };
            });
        };

        if (m.length < 1) m.push('en')
        return m;
    })();

    modscript(log, req, url
        , function(status, code, _files, _styles, _langs, _mdurl) {
            if (status !== true) {
                res.writeHead(404, {
                    'content-type': 'application/x-javascript; charset=UTF-8'
                });

                res.end(log());
                return;
            };


            res.writeHead(200, {
                'content-type': 'application/x-javascript; charset=UTF-8'
            });


            files = _files;
            langs = _langs;
            mdurl = _mdurl;

            next();
        }
    );

    function next() {
        var i;

        do {
            i = ++file_index;

            if (i >= files.length || !files.length) {
                complite();
                return;
            };

            var file = files[i];

        } while(!file);

        if (typeof file !== 'object') {
            complite();
            return;
        };

        if (!options.all && !langs[file.moduleID]) {
            return next();
        };

        if (file.js_inc) {
            return next();
        };


        var modID = file.moduleID;
        var url = file.src;

        load(file.src
            , {
                authorization: (req.headers||false)['authorization'],
                XForwardedFor: req.X_Forwarded_For,
            }

            , function onLoad(status, result) {
                if (status !== true) {
                    log('error', 'error load ' + status + ', file - ' + url);
                    next();
                    return;
                };

                result.get(['js'], function(status, data) {
                    if (status !== true) {
                        log('error', 'error compile ' + status + ', file - ' + url);
                        next();
                        return
                    };

                    parse(data);
                });
            }
        );

        function parse(code) {
            var m = code.match(jsRegx) || false;
            var l = m.length, i = 0, x;
            var lang;

            var autokey = file.moduleJSON.autokey;
            if (!options.autokey || typeof autokey !== 'string') {
                autokey = false;
            };

            var lang_old = langs[modID] || false;
            var lang_new = LNG[modID] || {};

            for(; i < l; i++)  {
                x = m[i];

                if (x.charCodeAt(0) !== 34) continue;

                try {
                    x = JSON.parse(x)
                } catch (e) {
                    //console.log('ups JSON.parse(lang)');
                    continue;
                };

                if (!x || !x.trim()) continue;

                if (!lang_old[x]) {
                    var xfilter = false;
                    var xchar = false;

                    if (/(^|,)unicode(?=,|$)/.test(options.all) ) {
                        xfilter = xfilter || true;
                        if (/[^\x00-\xff]/i.test(x) ) {
                            xchar = true;
                        };
                    };

                    if (/(^|,)key(?=,|$)/.test(options.all) ) {
                        xfilter = xfilter || true;
                        if (/^\.[\w][\w\-\.]*$/i.test(x) ) {
                            xchar = true;
                        };
                    };

                    if (/(^|,)ru(?=,|$)/.test(options.all) ) {
                        xfilter = xfilter || true;
                        if (/[аА-яЯёЁ]/i.test(x) ) {
                            xchar = true;
                        };
                    };

                    if (!xfilter || !xchar) {
                        continue;
                    };
                };

                if (lang_new[x]) continue
                LNG[modID] = lang_new;

                var oldx = lang_old[x] || false;
                var newx = lang_new[x] = {};
                var autoLangKey = false;

                langsFor.forEach(function(lang) {
                    var value = oldx[lang];
                    if (lang === 'auto') {
                        autoLangKey = true;
                        return;
                    };

                    if (lang == 'key' && autokey && typeof value === 'string') {
                        if (value[0] === '.') {
                            value = autokey + value;
                        };
                    };

                    newx[lang] = value != null ? value : null;
                });

                if (autoLangKey && oldx) {
                    for(var langKey in oldx) {
                        if (oldx[langKey] != null && newx[langKey] == null) {
                            newx[langKey] = oldx[langKey];
                        };
                    };
                };

            };

            next();
        };
    };

    function complite() {
        var r = {}, i, x;

        if (!options.pure) {
            for(var modID in langs) {
                var lang_old = langs[modID];
                var lang_new = LNG[modID];
                if (!lang_new || !lang_old) continue;

                for (var j in lang_old) {
                    var old = lang_old[j];
                    if (old && typeof old === 'object' && !lang_new[j]) {
                        (lang_new[j] = old).deleted = true;
                    };
                };
            };
        };

        for (i in LNG) {
            if (typeof mdurl[i] === 'string') {
                r[xDelHost(mdurl[i])] = LNG[i];
            };
        };

        if (options.yaml) {
            //res.write(log());
            res.write(yaml.safeDump(r, {indent: options.yaml}));
        } else {
            //res.write(log());
            res.write(JSON.stringify(r, null, "\t"));
        };

        res.end();
    };

    var xStartHost = req.xStartHost;
    function xDelHost(x) {
        x = x + '';
        return xStartHost && x.substr(0, xStartHost.length) === xStartHost
            ? x.substr(xStartHost.length)
            : x
        ;
    };

};



