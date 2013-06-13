﻿
module.exports = script_langs;

var newErrorLogs = require('./tools.js').servErrorLogs;
var file_proxy = require('./file-prox.js');
var modscript = require('./modscript.js');
var jsmin = require('./jsmin.js');
var URL = require('url');


function script_langs(url, req, res, langsFor) {
	var u
	, log = newErrorLogs()
	, prx = true
	, file_index = -1
	, files
	, langs
	, mdurl
	, LNG = {}
	, file
	, modID
	;

	var langsFor = (function() {
		var m = [];

		if (typeof langsFor === 'string') {
			langsFor.split(',').forEach(function(v) {
				if (v = String(v).trim()) {
					if (m.indexOf('v') === -1) {
						m.push(v);
					};
				};
			});
		};

		if (m.length < 1) m.push('en')
		return m;
	})();


	var xreq = {
		X_Forwarded_For: req.X_Forwarded_For || null,

		headers: {
			'user-agent': (req.headers||false)['user-agent'],
			'authorization': (req.headers||false)['authorization']
		}
	};

	var buffer = [];

	var xres = {
		writeHead: function(status) {
			prx = status === 200;
		},

		write: function(chunk) {
			if (prx) buffer.push(chunk);
		},

		end: function() {
			var code = '', lang, x;

			try {
				code = jsmin("", buffer.join(''), 1);
			} catch (e) {
				res.write('jsmin error');
			};

			buffer.length = 0;


			var m = code.match(/\/\*([^*]|\*(?=[^\/]))+\*\/|\/(\\\\|\\\/|[^\/\n])+\/|\'(\\\\|\\\'|[^\'])*'|\"(\\\\|\\\"|[^\"])*\"/g) || false;
			var l = m.length, i = 0, x;

			var lang_new = LNG[modID] || {};
			var lang_old = langs[modID] || false;

			for(; i < l; i++)  {
				x = m[i];

				if (x.charCodeAt(0) !== 34) continue;

				try {
					x = JSON.parse(x)
				} catch (e) {
					//console.log('ups JSON.parse(lang)');
					continue;
				};

				LNG[modID] = lang_new;

				if (typeof lang_new[x] !== 'object') {
					var xs = lang_new[x] = {};
					
					langsFor.forEach(function(v) {
						var vp = (lang_old[x]||false)[v];
						xs[v] = typeof vp === 'string' ? vp : null;
					});
				};
			};

			next();
		}
	};


	modscript(log, req, url
		, function(status, code, _files, _styles, _langs, _mdurl) {
			if (status !== true) {
				res.writeHead(404, {
					'content-type': 'application/x-javascript; charset=UTF-8'
				});

				res.end('//404');
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

			file = files[i];

		} while(!file);

		if (typeof file !== 'object') {
			complite();
			return;
		};

		var u
		, shead = ''
		, sfoot = ''
		, url = file.src
		, q = URL.parse(url)
		;

		modID = file.moduleID;

		if (q.protocol === 'http:' || q.protocol === 'https:') {
			if (!q.host || !/.\.[a-zA-Z]{2,7}$/.test(q.hostname) || /^\.|\.\.|[^\w\-\.]/.test(q.hostname)) {
				res.write('\n\n/* ------ BAD: ' + url + ' */\n'); 
				log('error', 'bad host: ' + url );
				return next();
			};
		} else {
			if (q.protocol !== 'file:') {
				res.write('\n\n/* ------ BAD: ' + url + ' */\n');
				log('error', 'bad protocol: ' + url );
				return next();
			};
		};

		file_proxy(url, xreq, xres, false, shead, sfoot);
	};

	function complite() {
		var r = {}, i, x;

		for (i in LNG) {
			if (typeof mdurl[i] === 'string') {
				r[mdurl[i]] = LNG[i];
			};
		};

		res.write(JSON.stringify(r, null, "\t"));
		res.end();
	};
};


