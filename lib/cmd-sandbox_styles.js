
module.exports = sandbox_styles;

var newErrorLogs = require('./tools.js').servErrorLogs;
var modscript = require('./modscript.js');


function sandbox_styles(req, url, end) {
    var log = newErrorLogs();

    modscript(log, req, url, function(status, code, files, styles, langs, mods) {
        if (status !== true) {
            if (typeof end == 'function') {
                end(false, log());
            };
            return;
        };

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
        for (i in mods) {
            if (typeof mods[i] === 'string') {
                mds[i] = mods[i];
            };
        };

        if (wcode) {
            code += '\n/*MODULES:\n'+JSON.stringify(mds, null, " ")+'\n*/\n';
            code += '\n' + wcode;
        };

        end(true, code + log() );
    });
};


