'use strict';

module.exports = sandbox_styles;

var newErrorLogs = require('./tools.js').servErrorLogs;
var modscript = require('./modscript.js').modscript;


function sandbox_styles(req, url, end) {
    var log = newErrorLogs();

    modscript(log, req, url, function(status, result) {
        if (status !== true) {
            if (typeof end == 'function') {
                end(false, log());
            };
            return;
        };

        var styles = result.styles;
        var mdurl = result.mdurl;
        var comment = '';
        var wcode = '';
        var code = '';

        if (styles) {
            var s = [], a, i;

            for (i=0; i < styles.length; i+=30) {
                s.push('/* ------------ */\n'
                    + styles.slice(i, i+30).map(function(x) {return '@import url('+JSON.stringify(''+x)+');\n'}).join('')
                );
            };

            wcode += s.join('');
        };


        var mds = {}, i;
        for (i in mdurl) {
            if (typeof mdurl[i] === 'string') {
                mds[i] = mdurl[i];
            };
        };

        if (wcode) {
            code += '\n/*MODULES:\n'+JSON.stringify(mds, null, " ")+'\n*/\n';
            code += '\n' + wcode;
        };

        end(true, code + log() );
    });
};


