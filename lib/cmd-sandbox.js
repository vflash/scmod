
module.exports = sandbox;

var newErrorLogs = require('./tools.js').servErrorLogs;
var modscript = require('./modscript.js');


function sandbox(req, url, end) {
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

		if (styles && !req.sandbox_scrips) {
			var s = [], a, i;

			for (i=0; i < styles.length; i+=30) {
				s.push('<style type="text/css">\n'
					+ styles.slice(i, i+30).map(function(x) {return '@import url('+JSON.stringify(String(x))+');\n'}).join('')
					+ '</style>'
				);
			};

			wcode += '\n\t+ ' + JSON.stringify(s.join(''));
			comment += '\n/*STYLES:\n'+styles.join('\n')+'\n*/\n\n';
		};

		if (files.length) {
			var _files = files.map(function(v){return v.url});
			wcode += '\n\t+ '+JSON.stringify('<script src="' + _files.join('"></script><script src="') + '"></script>')
			comment += '\n/*SCRIPTS:\n'+_files.join('\n')+'\n*/\n';
		};

		var mds = {}, i;
		for (i in mods) {
			if (typeof mods[i] === 'string') {
				mds[i] = mods[i];
			};
		};
		
		
		if (wcode) {
			code += 'document.write(""' + wcode + '\n);\n';

			code += '\n/*MODULES:\n'+JSON.stringify(mds, null, " ")+'\n*/\n';
			code += comment;
		};


		end(true, code + log() );
	});
};





