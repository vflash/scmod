'use strict';
module.exports = sandbox;

var newErrorLogs = require('./tools.js').servErrorLogs;
var modscript = require('./modscript.js').modscript;


function sandbox(req, url, end) {
    var log = newErrorLogs();

    modscript(log, req, url, function(status, result) {
        if (status !== true) {
            if (typeof end == 'function') {
                end(false, log('js'));
            };
            return;
        };

        var scripts = result.scripts;
        var styles = result.styles;
        var mdurl = result.mdurl
        var code = result.code;

        var writeComment = true;
        var comment = '';
        var wcode = '';

        if (styles && !req.sandbox_scrips) {
            var s = [], a, i;

            for (var i=0; i < styles.length; i+=30) {
                s.push('<style type="text/css">\n'
                    + styles.slice(i, i+30).map(function(x) {return '@import url('+JSON.stringify(('' + x))+');\n'}).join('')
                    + '</style>'
                );
            };

            wcode += '\n\t+ ' + JSON.stringify(s.join(''));
            if (writeComment) {
                comment += '\n/*STYLES:\n'+styles.join('\n')+'\n*/\n\n';
            };
        };

        if (scripts.length) {
            var _files = scripts.map(function(v){return v.url});
            wcode += '\n\t+ '+JSON.stringify('<script src="' + _files.join('"></script><script src="') + '"></script>')
            if (writeComment) {
                comment += '\n/*SCRIPTS:\n'+_files.join('\n')+'\n*/\n';
            };
        };

        var mds = {}, i;
        for (var i in mdurl) {
            if (typeof mdurl[i] === 'string') {
                mds[i] = mdurl[i];
            };
        };

        if (wcode) {
            code += 'document.write(""' + wcode + '\n);\n';

            if (writeComment) {
                code += '\n/*MODULES:\n'+JSON.stringify(mds, null, " ")+'\n*/\n';
                code += comment;
            };
        };

        end(true, code + log('js'));
    });
};

