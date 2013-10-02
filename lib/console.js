
var config = require('./load-config.js');

var scripts_pack = require('./cmd-script_pack.js');
var scripts_langs = require('./cmd-script_langs.js');
var styles_pack = require('./cmd-styles_pack.js');
var genReplaceHash = require('./tools.js').genReplaceHash;
var dataToJSON = require('./tools.js').dataToJSON;
var formatURL = require('./tools.js').formatURL;
var file_load = require('./file-load.js');
var URL = require('url');


function stdout(x) {process.stdout.write(x)};


process.nextTick(function() {
	config.log = false;
	//return;

	var q = {max: false}, cmd = 'scripts', nocmd = true, hostLevel = 0, file;
	process.argv.forEach(function(v, index, array) {
		var x, i;

		if (v == process.mainModule.filename) {
			return void(nocmd = false);
		};

		if (nocmd) return;

		if (/^-\d+$/.test(v)) {
			hostLevel = -v;
			return;
		};

		switch(v) {
			//case '-cmd=sandbox': return;
			case '-cmd=scripts': cmd = 'scripts'; return;
			case '-cmd=styles': cmd = 'styles'; return;
			case '-cmd=langs': cmd = 'langs'; return;
			case '-max': q.max = true; return;
			case '-rep': q.rep = true; return;
		};

		if (v[0] !== '-') {
			return void(file = v);
		};

		i = v.indexOf('=');
		x = v.substr(0, i);
		v = v.substr(i+1).trim();

		switch(x) {
			case '-core': q.core = v || false; break;
			case '-rep': q.rep = v || false; break;
			case '-lang': q.lang = v; break;
			case '-for': q.for = v; break;
		};
	});

	var xpwd = URL.parse((process.env.PWD||'')+'/');
	if (!/https?\:/.test(xpwd.protocol)) {
		xpwd = URL.parse('file://local.' + xpwd.pathname);
	};

	file = formatURL(xpwd, file);

	if (nocmd || !file) {
		stdout('-- not file --');
		return;
	};

	var xurl = URL.parse(file);
	var xStartHost = xurl.href.substr(0, xurl.href.length - xurl.path.length);

	if (hostLevel > 0) {
		var ax = xurl.pathname.replace(/^(\/([^\/\?]+\/)+).*/, '$1').split('/'); ax.length -= hostLevel;
		xStartHost = xStartHost + ax.join('/');
	};

	var url_replace = typeof q.rep === 'string' ? formatURL(xurl, /^\/([^\/]|$)/.test(q.rep) ? xStartHost + q.rep : q.rep ) : false;

	var req = {headers: {}, isLoadModuleLine: true, xStartHost: xStartHost};
	req.replaceHash = q.rep ? false : true; // true - пустой , false - не инициализированный

	var res = {
		writeHead: function(status) {},
		write: function(data) {if (data) stdout(data+''); },
		end: function(data) {if (data) stdout(data+''); }
	};

	function go_cmd() {
		switch(cmd) {
			case 'langs':
				req.isLoadModuleLine = false;

				scripts_langs(file, req, res, q['for']);
				break;
		
			case 'styles':
				styles_pack(file, req, res, !q.max, q.lang || false);
				break;

			case 'scripts':
			default:
				scripts_pack(file, req, res, !q.max, q.lang || false);
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
console.log(url_replace)

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
