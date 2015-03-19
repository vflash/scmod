
require('http-xak');
var config = require('./load-config.js');

var cmd_langs = require('./cmd-script_langs.js');
var cmd_scripts = require('./cmd-script_pack.js');
var cmd_styles = require('./cmd-styles_pack.js');
var cmd_modules = require('./cmd-modules.js');
var modscript = require('./modscript.js');
var genReplaceHash = require('./tools.js').genReplaceHash;
var newErrorLogs = require('./tools.js').servErrorLogs;
var dataToJSON = require('./tools.js').dataToJSON;
var formatURL = require('./tools.js').formatURL;
var file_load = require('./file-load.js');
var PATH = require('path');
var URL = require('url');


function stdout(x) {process.stdout.write(x)};


process.nextTick(function() {
    config.log = false;
    //return;

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
            case '-cmd=scripts': cmd = 'scripts'; return;
            case '-cmd=styles': cmd = 'styles'; return;
            case '-cmd=langs': cmd = 'langs'; return;
            case '-debug': debug = true; config.log = true; return;
            case '-autokey': q.autokey = true; return;
            case '-pure': q.max = true; return;
            case '-yaml': q.yaml = 2; return;
            case '-max': q.max = true; return;
            case '-rep': q.rep = true; return;
            case '-all': q.all = true; return;
            case '-log': q.logFiles = true; return;
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

    /*
    var xpwd = URL.parse((process.env.PWD||'')+'/');
    if (!/https?\:/.test(xpwd.protocol)) {
        xpwd = URL.parse('file://local.' + xpwd.pathname);
    };
    */

    file = formatURL(xpwd, file);

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

    var url_replace = typeof q.rep === 'string' ? formatURL(xurl, /^\/([^\/]|$)/.test(q.rep) ? xStartHost + q.rep : q.rep ) : false;

    var req = {headers: {}, isLoadModuleLine: true, xStartHost: xStartHost, isLogFiles: q.logFiles};
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
                cmd_styles(file, req, res, !q.max, q.lang || false);
                break;

            case 'modules':
                req.isLoadModuleLine = true;
                cmd_modules(file, req, res, q);
                return;


            case 'scripts':
            default:
                req.isLoadModuleLine = true;
                cmd_scripts(file, req, res, !q.max, q.lang || false);
        };
    };

    function go() {
        if (!q.core) return go_cmd();

        var url_exclude = formatURL(xurl
            , /^\/([^\/]|$)/.test(q.core) ? xStartHost + q.core : q.core
            , req.replaceHash
        );

        var log = newErrorLogs();

        modscript(log, req, url_exclude
            , function(status, code, _files, _styles, _langs, _MDURL) {
                if (status !== true) return stdout(log()+'\n');
                req.excludeModules = arguments[5];
                go_cmd();
            }
        );
    };

    if (!q.rep || q.rep === true || !url_replace) {
        return go();
    };

    file_load(url_replace, {authorization: false, X_Forwarded_For: false}
        , function(status, data, type) {
            if (status !== true) {
                stdout('// error load "replace" file. status - ' + status+'\n');
                return;
            };

            var x = dataToJSON(type, data, false, url_replace) || false;
            if (!x.replace || typeof x.replace !== 'object') {
                stdout('// error data "replace" file \n')
                return;
            };

            req.replaceHash = genReplaceHash(URL.parse(url_replace)
                , x.replace
            );

            go();
        }
    );


});
