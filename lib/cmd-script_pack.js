﻿
module.exports = script_pack;

var newErrorLogs = require('./tools.js').servErrorLogs;
var formatURL = require('./tools.js').formatURL;
var file_proxy = require('./file-prox.js');
var modscript = require('./modscript.js');
var jsmin = require('./jsmin.js');
var URL = require('url');



function script_pack(url, req, res, jmin, langKey) {
	var u
	, log = newErrorLogs()
	, prx = true
	, file_index = -1
	, files
	, langs
	, file
	, modID
	;

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
			if (prx = status === 200) return;

			log('error', 'error load '+status + ', file - ' + xres.src);
			res.write('/* error load '+status+' */');
		},

		write: function(chunk) {
			if (prx) buffer.push(chunk);
		},

		end: function(chunk) {
			if (chunk && prx) buffer.push(chunk);

			var code = Buffer.concat(buffer).toString(), lang, x;
			buffer.length = 0;

			if (jmin) {
				try {
					code = jsmin("", code, 1);
				} catch (e) {
					res.write('/* jsmin error */');
					code = '';

					log('error', 'error jsmin error, file - ' + xres.src);
				};
			};

			if (lang = langKey ? langs[modID] : false) {
				code = code.replace(/\/\*([^*]|\*(?=[^\/]))+\*\/|\/(\\\\|\\\/|[^\/\n])+\/|\'(\\\\|\\\'|[^\'])*'|\"(\\\\|\\\"|[^\"])*\"/g
					, function(x) {
						if (x.charCodeAt(0) !== 34) return x;

						try {
							var vs = lang[JSON.parse(x)] || false;
						} catch (e) {
							//console.log('ups JSON.parse(lang)');
							return x;
						};

						return typeof vs[langKey] === 'string' ? JSON.stringify(vs[langKey]) : x;
					}
				);
			};

			if (code) {
				res.write(code);
			};

			next();
		}
	};


	modscript(log, req, url
		, function(status, code, _files, _styles, _langs, _MDURL) {
			if (status !== true) {
				res.writeHead(200, {
					'content-type': 'application/x-javascript; charset=UTF-8'
				});

				res.end(log());
				return;
			};
			


			res.writeHead(200, {
				'content-type': 'application/x-javascript; charset=UTF-8'
			});

			res.write(code);

			files = _files;
			langs = _langs;

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

		modID = file.moduleID;

		var u
		, url = file.src
		, q = URL.parse(url)
		, shead = ''
		, sfoot = ''
		;


		if (!file.nowrap) {
			shead = '__MODULE('+file.moduleID+', function(global,'+(file.vars||'module')+',__zAgS_){\'use strict\';__zAgS_(function(){return[global,'+(file.vars||'module')+']});\n'
			sfoot = '\n});'
		};

		if (file.js_inc) {
			if (config.log) {
				console.log('inc \t ' + String(file.src).substr(0, 77));
			};

			res.write('\n\n/* -- inline code -- */\n');

			xres.writeHead(200);
			xres.end(new Buffer(shead + file.src + sfoot));

			return;
		};

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



		res.write('\n\n/* url: ' + String(url).replace(/^https?:\/\/[^\/]+/, '---') + ' */\n');
		file_proxy(xres.src = url, xreq, xres, false, shead, sfoot);
	};

	function complite() {
		//res.write('\n\n__MODULE=null;');

		res.write('\n'+log() );
		res.end();
	};
};






