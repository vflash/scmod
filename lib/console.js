'use strict';
require('http-xak');
var config = require('./load-config.js');

var cmd_langs = require('./cmd-script_langs.js');
var cmd_scripts = require('./cmd-script_pack.js');
var cmd_styles = require('./cmd-styles_pack.js');
var cmd_modules = require('./cmd-modules.js');
var modscript = require('./modscript.js').modscript;
var newErrorLogs = require('./tools.js').servErrorLogs;
var dataToJSON = require('./tools.js').dataToJSON;
var formatURL = require('./tools.js').formatURL;
var loadReplace = require('./load-replace.js');
var PATH = require('path');
var URL = require('url');


function stdout(x) {process.stdout.write(x)};
var tick = global.setImmediate || process.nextTick;


tick(function() {
    config.log = false;

    var debug = false, q = {max: false}, cmd = 'scripts', nocmd = true, hostLevel = 0, file;

    process.argv.forEach(function(v, index, array) {
        var x, i;

        /*
        if (v == process.mainModule.filename) {
            return void(nocmd = false);
        };

        if (nocmd) return;
        */
        if (index < 2) return;

        if (/^-\d+$/.test(v)) {
            hostLevel = -v;
            return;
        };

        switch(v) {
            //case '-cmd=sandbox': return;
            case '-cmd=modules': cmd = 'modules'; return;
            case '-cmd=scripts': cmd = 'scripts'; return;
            case '-cmd=styles': cmd = 'styles'; return;
            case '-cmd=langs': cmd = 'langs'; return;
            case '-debug': debug = true; config.log = true; return;
            case '-autokey': q.autokey = true; return;
            case '-pure': q.pure = true; return;
            case '-eval': q.eval = true; return;
            case '-yaml': q.yaml = 2; return;
            case '-max': q.max = true; return;
            case '-rep': q.rep = true; return;
            case '-all': q.all = true; return;
            case '-log': q.log = true; return;
        };

        if (v[0] !== '-') {
            return void(file = v);
        };

        i = v.indexOf('=');
        x = v.substr(0, i);
        v = v.substr(i+1).trim();

        switch(x) {
            case '-yaml': q.yaml = parseInt(v, 10) || 2; break; // login:pass
            case '-auth': q.auth = v || false; break; // login:pass
            case '-core': q.core = v || false; break;
            case '-rep': q.rep = v || false; break;
            case '-all': q.all = v || false; break;
            case '-lang': q.lang = v; break;
            case '-for': q.for = v; break;
        };
    });

    var xpwd = process.cwd() || '';
    if (PATH.sep === '\\' ) { // windows
        xpwd = '/' + xpwd.split(PATH.sep).join('/');
    };

    if (xpwd.length > 1) xpwd += '/';
    xpwd = URL.parse('file://local.' + xpwd);

    file = formatURL(null, xpwd, file);

    if (!file) {
        stdout('-- not file --\n');
        return;
    };

    var xurl = URL.parse(file);
    var xStartHost = xurl.href.substr(0, xurl.href.length - xurl.path.length);

    if (hostLevel > 0) {
        var ax = xurl.pathname.replace(/^(\/([^\/\?]+\/)+).*/, '$1').split('/'); ax.length -= hostLevel;
        xStartHost = xStartHost + ax.join('/');
    };

    var url_replace = (typeof q.rep === 'string'
        ? formatURL(xStartHost, xurl, q.rep, false)
        : false
    );

    var req = {headers: {}, isLoadModuleLine: true, xStartHost: xStartHost, isLogFiles: q.log};
    req.replaceHash = q.rep ? false : true; // true - пустой , false - не инициализированный

    if (q.auth) {
        req.headers['authorization'] = 'Basic ' + new Buffer(q.auth).toString('base64');
    };

    var res = {
        writeHead: function(status) {},
        write: function(data) {if (!debug && data) stdout(data+''); },
        end: function(data) {if (debug) return;
            if (data) stdout(data+'');
            process.exit();
        }
    };

    function go_cmd() {
        switch(cmd) {
            case 'modules':
                req.isLoadModuleLine = true;
                cmd_modules(file, req, res, q);
                break;

            case 'langs':
                req.isLoadModuleLine = true;
                cmd_langs(file, req, res, q);
                break;

            case 'styles':
                req.isLoadModuleLine = true;
                cmd_styles(file, req, res, q);
                break;

            case 'scripts':
            default:
                req.isLoadModuleLine = true;

                cmd_scripts(file, req, res, {
                    lang: q.lang,
                    max: q.max
                });
        };
    };

    function go() {
        if (!q.core) return go_cmd();

        var url_exclude = formatURL(req.xStartHost, xurl, q.core, req.replaceHash);
        var log = newErrorLogs();

        modscript(log, req, url_exclude, function(status, result) {
            if (status !== true) {
                return stdout(log()+'\n');
            };

            req.excludeModules = result.mdurl;
            go_cmd();
        });
    };

    if (!q.rep || q.rep === true || !url_replace) {
        return go();
    };

    req.headerAuthorization = q.auth;
    loadReplace(req, url_replace, function(status, data) {
        if (status !== true) {
            stdout(data);
            return
        };

        go();
    });

});
