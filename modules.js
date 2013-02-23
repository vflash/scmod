'use strict';


var HTTP = require('http');
var HTTPS = require('https');
var URL = require('url');
var PATH = require('path');
var qs = require('querystring');
var jsmin = require('./lib/jsmin.js');
var jsToJSON = require('./lib/js-json.js').conv;
//var crypto = require('crypto');

var yaml = false;
try {
	yaml = require('js-yaml');
} catch (e) {
	yaml = false;
};

var config = (function() {
		var x
		, a = ['./config.js', '/usr/local/etc/scmod/config.js', '/etc/scmod/config.js']
		, i = 0
		;

		while(x = a[i++]){
			try {
				x = require(x);
				return x;
			} catch(e) {};
        };

		x = require('config-simple.js');
        return x;
})();




//process.setMaxListeners(0);
//HTTP.globalAgent.maxSockets = 1;
HTTPS.globalAgent.maxSockets = 1;

HTTPS.globalAgent.addRequest = function(req, host, port) {
  var name = host + ':' + port, x;
  if (!this.sockets[name]) this.sockets[name] = [];
  
  if (!this.sockets[name].length || (this.requests[name]||false).length > (3 + this.sockets[name].length * 7)  ) {
	// If we are under maxSockets create a new one.
	req.onSocket(this.createSocket(name, host, port));
	
	//x.setMaxListeners(0)
	
	//console.log(x.setMaxListeners);

  } else {
	// We are over limit so we'll add it to the queue.
	if (!this.requests[name]) this.requests[name] = [];
	this.requests[name].push(req);
  };
};






process.nextTick(function() {
	//HTTP.createServer(serverHendler).listen(config.port, "127.0.0.1");
	HTTP.createServer(serverHendler).listen(config.port, config.host||'127.0.0.1');
	console.log('Server running at http://'+(config.host||'127.0.0.1')+':'+(config.port)+'/');
});


function NULL_FUNCTION(){};
function serverHendler(req, res) {
	var q = URL.parse(req.url, true), x;
	
	
	req.on('close', function() {
		res.writeHead = NULL_FUNCTION;
		res.write = NULL_FUNCTION;
		res.end = NULL_FUNCTION;
	});
	
	/*
	var tm = new Date();
	res.__end = res.end;
	res.end = function(x) {
		res.__end(x);
		console.log(new Date() - tm)
	};
	*/
	

	req.isLoadModuleLine = true; // грузить модули последовательно
	req.replaceHash = /true|1|on/.test(q.query.rep) || q.query.rep === '' ? false : true; // true - пустой , false - не инициализированный

	if (req.headers['x-real-ip']) {
		req.X_Forwarded_For = req.headers['x-real-ip'] + (req.headers['x-forwarded-for'] ? ', ' + req.headers['x-forwarded-for'] : '');

		if (String(req.X_Forwarded_For).split(',').length > 5 ) {
			endres(res, 400);
			return;
		};
	};

	if (String(q.pathname).indexOf('/test') === 0) {
		res.writeHead(404
			, {
				'Content-Type': 'application/x-javascript; charset=UTF-8',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
				'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
			}
		);

		res.end('// ok');

		if (config.log) console.log(req.headers);
		return;
	};

	if (String(q.pathname).indexOf('/file/') === 0) {
		file_prox(req, res, q);
		return;
	};

	if (q.query.auth !== 'base') {
		if (req.headers['authorization']) {
			req.headers['authorization'] = null;
		};

	} else {
		if (!req.headers['authorization']) {
			res.writeHead(401
				, {
					'Content-Type': 'application/x-javascript; charset=UTF-8',
					'Cache-Control': 'no-store, no-cache, must-revalidate',
					'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT',
					'WWW-Authenticate': 'Basic realm="Password Required"'
				}
			);

			res.end();
			return;
		};
	};




	/*
	var src = q.query.src || '';
	if (/^https?:\/\//.test(src) ) {
		src = normalizeURL(src);

	} else {
		if ((src[0] == '.' || src[0] == '/') && String(req.headers['referer']).indexOf('http://') === 0 ) {
			src = formatURL(URL.parse(String(req.headers['referer'])), src);

		} else {
			src = false;
		};
	};
	*/


	var src = aliasURL(q.query.src, false);
	if (!src) {
		return endres(res, 404);
	};

	function go() {
		go_cmd(req, res, src, q);
	};

	if (!q.query.rep || /^(false|true||0|1|off|on)$/.test(q.query.rep) ) {
		return go();
	};

	var url_replace = formatURL(URL.parse(src), q.query.rep);
	if (!url_replace) return go();

	http_query(url_replace, {authorization: req.headers['authorization'], X_Forwarded_For: req.X_Forwarded_For}
		, function(status, data, type) {
			if (status !== true) {
				endres(res, 400, '// error load "replace" file. status - ' + status);
				return;
			};

			var x = dataToJSON(type, data) || false;
			if (!x.replace || typeof x.replace !== 'object') {
				endres(res, 400, '// error data "replace" file ');
				return;
			};

			req.replaceHash = genReplaceHash(URL.parse(url_replace)
				, x.replace
			);

			go();
		}
	);
};

function genReplaceHash(xurl, x) {
	//var xurl = URL.parse(url);
	var rp = {}, has, a, b, i;

	for (i in x) {
		a = formatURL(xurl, i);
		b = formatURL(xurl, x[i]);
		
		if (a && b) {
			has = true;
			rp[a] = b;
		};
	};
	
	return has ? rp : true; 
}

function go_cmd(req, res, src, q) {

	switch(q.pathname) {
		case '/json':
			view_json(req, src, function(status, data) {
				res.writeHead(200
					, {
						'Content-Type': status === true ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
						'Cache-Control': 'no-store, no-cache, must-revalidate',
						'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
					}
				);

				res.end(data);
			});
			return;
			
		case '/sandbox':
			req.isLoadModuleLine = false;

			sandbox(req, src, function(status, code) {
				res.writeHead(200
					, {
						'Content-Type': 'application/x-javascript; charset=UTF-8',
						'Cache-Control': 'no-store, no-cache, must-revalidate',
						'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
					}
				);

				res.end(code);
			});
			return;

		case '/sandbox_styles':
			req.isLoadModuleLine = false;

			sandbox_styles(req, src, function(status, code) {
				res.writeHead(200
					, {
						'Content-Type': 'text/css; charset=UTF-8',
						'Cache-Control': 'no-store, no-cache, must-revalidate',
						'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
					}
				);

				res.end(code);
			});
			return;

		case '/scripts': 
			script_pack(src, req, res, !('max' in q.query || q.query.min === 'false'), q.query.lang ? String(q.query.lang) : false);
			return;

		case '/styles':
			styles_pack(src, req, res, !('max' in q.query || q.query.min === 'false') );
			return;

		case '/langs':
			req.isLoadModuleLine = false;

			script_langs(src, req, res
				, q.query['for'] ? String(q.query['for']) : false
			);

			return;

		default:
			endres(res, 400);
	};	
};



function newErrorLogs() {
	var log = '';

	return function(type, value, x) {
		if (type == null) {
			return (log ? '\n/* ERROR COMPILE:\n' + log : '\n/* COMPILE OK ') +'*/';
		};

		if(type === 'error') {
			log += String(value)+'\n';
		};
	}
};



var auth_domains = config.auth_domains ? String(config.auth_domains).split(/\s+/) : false
function access_domain(protocol, host, allowed_domains) {
	if (protocol !== 'https:') return false;

	var m = auth_domains || [], i = 0, s;
	if (allowed_domains) {
	m = m.concat(String(allowed_domains).split(/\s+/));
	};

	for (host = String(host); i < m.length; i++) {
	if (s = m[i]) {
		if (s.charCodeAt(0) === 46 ? host.substr(-s.length) === s || host === s.substr(1) : host === s)  {
		return true;
		};
	};
	};

	return false;
};

function parse_cookie(s) {
		if (!s) return false;

		var u
		, a = s.split(';')
		, i = a.length
		, r = {}
		, j, v
		;

		while(i--) {
				v = a[i].trim();
				j = v.indexOf('=');

				if (j > 0) {
						r[v.substring(0, j)] = v.substr(j+1) || '';
				};
		};

		return r;
};




function http_query(url, options, end) {
	var src = URL.parse(url);

	if (!src.host || !/.\.[a-zA-Z]{2,7}$/.test(src.hostname) || /^\.|\.\.|[^\w\-\.]/.test(src.hostname)) {
		return end('bad url-hostname');
	};

	if ( !(src.protocol === 'http:' || src.protocol === 'https:') ) {
		return end('bad url-protocol');
	};

	options = options || false;

	var query = {
		method:'GET',
		headers: {
			'x-forwarded-for' : options.X_Forwarded_For || null,
			authorization: options.authorization ? access_domain(src.protocol, src.host, false) ? options.authorization : null : null
		},

		host: src.host,
		port: src.protocol === 'https:' ? 443 : 80,
		path: src.path
	};


	var client = src.protocol === 'https:' ? HTTPS.request(query) : HTTP.request(query);
	var comp = false;

	client.setTimeout(20000, function() {
		if (!comp) {
			comp = true;
			end(408);
		};
	});

	client.on("error", function() {
		if (!comp) {
			comp = true;
			end('connect');
		};
	});

	client.on('response'
		, function(res) {
			if (res.statusCode !== 200) {
				comp = true;
				return void(end(res.statusCode));
			};

			var contentType = (res.headers['content-type']||'').split(';')[0];
			var data = '';

			res.setEncoding('utf8');  

			res.on('data', function(c) {
				data += c;
			});

			res.on('end', function() {
				var token = false, x;

				if (comp) return;
				comp = true;

				end(true, data, contentType);
			});
		}
	);
	
	client.end();
};

function dataToJSON(type, data, log) {
	var mod_json = false;

	if (typeof log !== 'function') {
		log = function(){};
	};

	if (type === 'text/yaml' || type === 'application/yaml') {
		try {
			//mod_json = yaml.load(data);
			mod_json = yaml.safeLoad(data);

		} catch (e) {
			mod_json = false;

			log('error'
				, xmod.error = (yaml ? 'error yaml' : 'error yaml no support') + ', module - ' + url + (yaml ? ('\n' + String(e)+'\n') : '')
			);
		};

	} else {

		try {
			mod_json = JSON.parse(data);

		} catch (e) {
			try {
				mod_json = JSON.parse(jsToJSON(data).trim());

			} catch (e) {
				mod_json = false;

				log('error'
					, xmod.error = 'error json, module - ' + url + '\n'+ String(e) + '\n'
				);
			};
		};
	};
	
	return mod_json;
};


function view_json(req, src, end) {
	http_query(src
		, {authorization: req.headers['authorization'], X_Forwarded_For: req.X_Forwarded_For}

		, function(status, data, type) {
			if (status !== true) {
				return end(false, 'status > ' + status);
			};

			var x;

			if (type === 'text/yaml' || type === 'application/yaml') {
				try {
					end(true, JSON.stringify(yaml.safeLoad(data), null, "\t") );

				} catch (e) {
					end(false, data);
				};

				return;
			};

			data = jsToJSON(data).trim();

			try {
				end(true,
					JSON.stringify(JSON.parse(data), null, "\t")
				);

			} catch (e) {
				end(true, data);
			};
		}
	);	
};

/*

modules = {
	'http://....': null,
}

files = {
	'http://....': null,
}


globalLoadedFiles = {
	'http://....': null,
	'http://....': '.....code.....'
};
*/


function search(modules, url) {
	var i = modules.length, x;
	
	while(i--) {
		x = modules[i];

		if (x && x.src === url) {
			return x;
		};
	};
	
	return false;
};


// востанавливает url
function formatURL(xurl, src, replaceHash) {
	if (typeof src !== 'string') {
		return src;
	};

	var x;

	if (src[0] == '.') {
		src = xurl.protocol + '//' + xurl.host + PATH.normalize((xurl.pathname||'/') + '/../'+src);
	} else 
	if (src[0] == '/') {
		src = xurl.protocol + '//' + xurl.host + PATH.normalize(src);
	} else 
	if (src.substr(0, 3) == '://') {
		src = normalizeURL(xurl.protocol + src.substr(1)); //
	} else 
	if (String(src).indexOf(':') === -1 ) {
		src = xurl.protocol + '//' + xurl.host + PATH.normalize((xurl.pathname||'/') + '/../'+src);
	} else {
		src = normalizeURL(src);
	};

	src = aliasURL(src);

	if (typeof (replaceHash||false)[src] === 'string') {
		src = replaceHash[src];
	};

	return src;
};

function normalizeURL(url) {
	var xurl = URL.parse(String(url).trim());
	switch(xurl.protocol) {
		case 'http:': case 'https:':
			break;
		default:
			return url;
	};


	url = xurl.protocol+'//'+xurl.host;
	if (xurl.pathname) url += PATH.normalize(xurl.pathname);
	if (xurl.search) url += xurl.search;

	return url
};

function aliasURL(url) {
	var x, u;

	if (!url) return false;

	if (/^https?:\/\//.test(url)) {
		return normalizeURL(url);
	};

	url = String(url).replace(/^github:~\//, 'github:master/');

	switch(x = url.substring(0, url.indexOf(':')) ) {
		case 'global': return url;

		case 'github':
			x = String(url).substring(String(url).indexOf(':') + 1);
			x = /[\w-]\.[\w-]{1,7}$/.test(x) ? x : x.replace(/(\/([\w-]+)$)/, '$1/$2.json'); 
			x = x.replace(/^([^\/]+)\/([^\/]+)\/([^\/]+)/, '$2/$3/$1')

			return normalizeURL('https://raw.github.com/' + x);

		default:
			return normalizeURL('http://' + url);
	};
};




function smod(log, ureq, start_url, end_compite) {
	var isLoadModuleLine = ureq.isLoadModuleLine ? true : false;
	var replaceHash = ureq.replaceHash || false;  // false - не указан , true - пустой
	var modules = [];
	var modulesHash = {};
	var files = [];
	var styles = [];
	var stop;

	get_module(start_url, [], function() {
		end_compite(true, modules, files, styles);
	});

	function get_module(url, modstack, end) {
		var virtmod = false, x;

		if (typeof url !== 'string' || !/^https?:/.test(url) ) {
			virtmod = true;
		};

		var xurl = virtmod ? false : URL.parse(url);
		var modules_total = null;
		var modules_loaded = 0;

		var xmod = {
			id: modules.length + 1,
			loaded: false,
			waiting: [],
			src: url
		};

		modules.push(xmod);

		if (typeof url === 'string') {
			modulesHash[url] = xmod;
			modstack.push(url);
		};

		var lineLoad = [];
		var lineSending = false;

		var mod_json, mods = {};

		if (virtmod) {
			modules_total = modules_loaded;

			mod_json = {};

			complit(true);
			return;
		};


		if (/\.js$/.test(xurl.pathname)) {
			mod_json = {files: [url]};
			modules_total = 0;

			complit(true);
			return;
		};

		if (config.log) console.log('mod \t', url);

		http_query(url, {authorization: ureq.headers['authorization'], X_Forwarded_For: ureq.X_Forwarded_For}
			, function(status, data, type) {
				if (stop) return;

				if (status !== true) {
					modules_total = 0;
					mod_json = false;

					log('error'
						, xmod.error = 'error load '+(status)+', module - ' + url
					);

					complit(false);
					return;
				};

				mod_json = dataToJSON(type, data, log);

				var x = mod_json.scmod;
				if (typeof x === 'object' && x.scmod !== null) {
					mod_json = x;
				};

				if (!replaceHash) {
					replaceHash = mod_json.replace ? genReplaceHash(xurl, mod_json.replace) : true;
				};

				mload(mod_json);
			}
		);
		
		function mload(mod_json) {
			var j = 0, i, x;

			if (mod_json.alias) {
				xmod.alias = String(mod_json.alias);
			};


			if (x = mod_json.modules) {
				for (i in x) {
					var src = x[i];

					if (!src || typeof src !== 'string') {
						modules.push(
							mods[i] = {
								id: modules.length + 1, 
								src: typeof src === 'boolean' || typeof src === 'object' ? src : null
							}
						);

						continue;
					};

					if (src.charCodeAt(0) === 33 && /^!!\[[\w\,]+\]\s+/.test(src)) {
						//v = src.substring(3, src.indexOf(']'));
						src = src.replace(/^!!\[[\w\,]+\]\s+/, '');

						//nowrap = nowrap || /(^|,)nowrap(,|$)/.test(v);
						//js_inc = /(^|,)js(,|$)/.test(v);
					};

					src = formatURL(xurl, src, replaceHash);

					(isLoadModuleLine || false ? loadModuleLine : loadModule)(mods[i] = {src: src}
						, complit 
					);

					j += 1;
				};
			};

			modules_total = j;
			complit(true);
		};

		function loadModuleLine(mod, end) {
			if (lineSending) {
				lineLoad.push([mod, end]);
				return;
			};

			lineSending = true;
			loadModule(mod, function(a,b,c) {
				end(a,b,c);

				lineSending = false;

				var x = lineLoad.pop();
				if (x) {
					loadModuleLine(x[0], x[1]);
				};
			});
		};

		function loadModule(mod, end) {
			var x;

			if (modstack.indexOf(mod.src) != -1) {
				stop = true;

				log('error', 'error recursive load modules:\n - '
					+ modstack.join('\n - ') + '\n - ' + mod.src
				);

				end_compite(false
					, modstack.concat([mod.src])
				);

				return;
			};

			if (x = search(modules, mod.src) ) {
				mod.id = x.id;
				if (x.loaded ) {
					modules_loaded += 1;
					return end(true);
				};

				x.waiting.push(function() {
					modules_loaded += 1;

					end(true);
				});

				return;
			};

			var xurl = mod.src;

			get_module(mod.src, modstack.concat(), function(status, id) {
				modules_loaded += 1;

				mod.id = id;
				end(true);
			});
		};


		var _complite = false;
		function complit() {
			if (stop || _complite|| modules_total != modules_loaded) {
				return;
			};

			_complite = true;

			var u, a, i, l, x, v, nowrap, js_inc;

			xmod.langs = mod_json.langs || false;
			xmod.nowrap = mod_json.nowrap ? true : false; // не обворачивать в модуль

			if (a = mod_json.scripts || mod_json.files) {
				for(i=0, l = a.length; i<l; i+=1) {
					x = a[i];

					if (typeof x === 'string') {
						nowrap = xmod.nowrap;
						js_inc = false;

						if (x.charCodeAt(0) === 33 && /^!!\[[\w\,]+\]\s+/.test(x)) {
							v = x.substring(3, x.indexOf(']'));
							x = x.replace(/^!!\[[\w\,]+\]\s+/, '');

							nowrap = nowrap || /(^|,)nowrap(,|$)/.test(v);
							js_inc = /(^|,)js(,|$)/.test(v);
						};

						files.push({
							moduleID: xmod.id,
							id: files.length+1,
							nowrap: nowrap,
							js_inc: js_inc,

							src: formatURL(xurl, x, replaceHash)
						});
					};
				};
			};

			if (a = mod_json.styles) {
				for(i=0, l = a.length; i<l; i+=1) {
					if (x = a[i]) {
						styles.push(formatURL(xurl, x, replaceHash));
					};
				};
			};

			xmod.de = false;

			for(i in mods) {
				xmod.de = mods;
				break;
			};

			if (!xmod.waiting) {
				console.log(xmod);
			};

			while(x = xmod.waiting.pop()) x();

			delete(xmod.waiting);

			xmod.loaded = true;

			end(true, xmod.id);
		};
	};
};



//write('http://zz7a.com/js/moon/moon.json', func)
function modscript(log, ureq, url, end) {
	smod(log||function(){}, ureq, url
		, function(status, global_modules, global_files, global_styles) {
			if (status !== true) {
				if (typeof end == 'function') end(false);
				return;
			};

			var DEPEND = {};
			var MDNAME = {};
			var MDURL = {};
			var MDS = {};
			var langs = {};


			global_modules.forEach(function(x) {
				//MDS[x.id] = typeof x.src === 'string' || x.src === true ? {} : x.src;
				MDS[x.id] = typeof x.src == 'object' || typeof x.src == 'boolean' ?  x.src : {};

				MDURL[x.id] = x.src;

				langs[x.id] = x.langs || false;

				//var dep = [], nms = [], de = x.de, v, i;
				var u
				, nms = [x.alias ? String(x.alias) : 'module']
				, de = x.de
				, dep = []
				, v, i
				;

				for (i in de) {
					if (v = de[i]) {
						if (i[0] === '_') continue;
						
						nms.push(i);
						dep.push(v.id);
					};
				};

				if (dep.length) {
					DEPEND[x.id] = dep;
				};

				MDNAME[x.id] = nms;
			});


			//log('--------------------------------');
			//log(MDS);
			//log(DEPEND);


			var u
			, files = []
			, file, url
			, a = global_files
			, qhost = ((ureq.headers['x-scmod-scheme'] || ureq.headers['x-real-protocol']) === 'https' ? 'https://' : 'http://') 
				+ String(ureq.headers['x-scmod-host'] || ureq.headers.host || 'unknown.host')
			, i = 0
			, x, v
			;

			while(x = a[i++]) {
				files.push(
					file = {
						moduleID: x.moduleID, 
						nowrap: x.nowrap,
						src: String(x.src)
					}
				);

				file.url = x.nowrap ? x.src : url;

				if (x.nowrap) {
					file.url = x.src;
					continue;
				};


				var url = qhost+'/file/'+ x.moduleID+'/';

				file.vars = 'module';
				if (v = MDNAME[x.moduleID]) {
					file.vars = v.map(encodeURIComponent).join(',');
					url += file.vars;
				};

				var xurl = URL.parse(x.src);
				url += '/' + (xurl.protocol == 'https:' ? 'https' : 'http')+'/'+xurl.host;
				if (xurl.pathname) url += PATH.normalize(xurl.pathname);
				if (xurl.search) url += xurl.search;

				file.url = url;
			};


			var styles = false;

			if (a = global_styles) {
				for(styles = [], i = 0; x = a[i++];) {
					styles.push(x);
				};

				if (!styles.length) {
					styles = false;
				};
			};


				// '<script src=""></script>'
			var jscode = '';

			jscode += 'var __MODULE=(function(){\'use strict\';var global=window'
				+',MODULES='+JSON.stringify(MDS)
				+',DEPEND='+JSON.stringify(DEPEND)
				+',depend={}'
				+';\n'
				+'return ' + jsmin("", String(__MODULE).trim(), 2).trim()
				+ '})();\n'
			;


			if (typeof end == 'function') {
				end(true
					, jscode
					, files
					, styles
					, langs
					, MDURL
				);
			};
		}
	);
};




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

		if (styles) {
			var s = [], a, i;

			for (i=0; i < styles.length; i+=30) {
				s.push('<style type="text/css">\n'
					+ styles.slice(i, i+30).map(function(x) {return '@import url('+JSON.stringify(String(x))+');\n'}).join('')
					+ '</style>'
				);
			};

			wcode += '\n\t+ ' + JSON.stringify(s.join(''));
			comment += '\n/*STYLES\n'+styles.join('\n')+'\n*/\n\n';
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
					+ styles.slice(i, i+30).map(function(x) {return '@import url('+JSON.stringify(String(x))+');\n'}).join('')
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
			/*
			if (jmin) {
				if (prx) buffer.push(chunk);
			} else {
				if (prx) res.write(chunk);
			};
			*/
		},

		end: function() {
			var code = buffer.join(''), lang, x;
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
			shead = '__MODULE('+file.moduleID+', function(global,'+(file.vars||'module')+'){\'use strict\';\n'
			sfoot = '\nreturn [global,'+(file.vars||'module')+']});'
		};


		if (!q.host || !/.\.[a-zA-Z]{2,7}$/.test(q.hostname) || /^\.|\.\.|[^\w\-\.]/.test(q.hostname)) {
			res.write('\n\n/* ------ BAD: ' + url + ' */\n'); 
			return next();
		};

		if ( !(q.protocol === 'http:' || q.protocol === 'https:') ) {
			res.write('\n\n/* ------ BAD: ' + url + ' */\n');
			return next();
		};

		res.write('\n\n/* url: ' + String(url).replace(/^https?:\/\/[^\/]+/, '---') + ' */\n');

		prox(xres.src = url, xreq, xres, false, shead, sfoot);
	};

	function complite() {
		//res.write('\n\n__MODULE=null;');

		res.write('\n'+log() );
		res.end();
	};
};

function styles_pack(url, req, res, cssmin) {
	var u
	, log = newErrorLogs()
	, prx = true
	, file_index = -1
	, files
	, file
	;

	var xreq = {
		X_Forwarded_For: req.X_Forwarded_For || null,

		headers: {
			'user-agent': (req.headers||false)['user-agent'],
			'authorization': (req.headers||false)['authorization']
		}
	};
	
	//console.log(req.headers)
	
	var buffer = [];

	var xres = {
		writeHead: function(status) {
			if (prx = status === 200) return;

			log('error', 'error load '+status+',  file - ' + xreq.src);

			res.write('/* error load, status: '+status+' */\n\n');
		},

		write: function(chunk) {
			// if (prx) res.write(chunk);
			if (cssmin) {
			    if (prx) buffer.push(chunk);
			} else {
			    if (prx) res.write(chunk);
			};
			
		},

		end: function() {
			if (cssmin) {
				res.write(
					buffer.join('').replace(/(^|{|;|:|,|\n)\s+(?=}?)|[\t ]+(?=})|\s+(?= {)|\/\*([^\*]|\*(?=[^\/]))+\*\/\s*/g, '$1')
				);

				buffer.length = 0;
			};

			next();
		}
	};


	modscript(log, req, url
		, function(status, code, _files, _styles) {
			files = _styles;

			if (status !== true) {
				res.writeHead(404, {
					'content-type': 'text/css; charset=UTF-8'
				});

				res.end('//404');
				return;
			};


			res.writeHead(200, {
				'content-type': 'text/css; charset=UTF-8'
			});

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


		var q = URL.parse(file, true), qm;
		var src;

		if (!q.host || !/.\.[a-zA-Z]{2,7}$/.test(q.hostname) || /^\.|\.\.|[^\w\-\.]/.test(q.hostname)) {
			res.write('\n\n/* ------ 1 BAD: ' + file + ' */\n');
			return next();
		};

		if ( !(q.protocol === 'http:' || q.protocol === 'https:') ) {
			res.write('\n\n/* ------ 2 BAD: ' + file + ' */\n');
			return next();
		};


		file = String(q.href).trim();

		//res.write('\n\n/* url: ' + file + ' */\n');
		//res.write('\n\n/* url: ' + file.replace(/^http:\/\/[^\/]+/, function(x) {return crypto.createHash('md5').update(x).digest('hex').substr(-7)}) + ' */\n');
		res.write('\n\n/* url: ' + file.replace(/^https?:\/\/[^\/]+/, '---') + ' */ \n');
		
	

		prx = true;

		xreq.src = file;
		prox(String(file), xreq, xres, false
			, ''
			, ''
		);
	};

	function complite() {
		res.write('\n'+log() );

		res.end();
	};
};



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

		if (!q.host || !/.\.[a-zA-Z]{2,7}$/.test(q.hostname) || /^\.|\.\.|[^\w\-\.]/.test(q.hostname)) {
			//res.write('\n\n/* ------ BAD: ' + file + ' */\n'); 
			return next();
		};

		if ( !(q.protocol === 'http:' || q.protocol === 'https:') ) {
			//res.write('\n\n/* ------ BAD: ' + file + ' */\n');
			return next();
		};

		prox(url, xreq, xres, false, shead, sfoot);
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




function __MODULE(id, modfunc) {
	var args = depend[id];

	if (!args) {
		var dp = DEPEND[id]||[], i=0, x;
		args = [global, MODULES[id]];

		while(x = dp[i++]) {
			args.push(MODULES[x]);
		};

		depend[id] = args;
	} else {
		args[1] = MODULES[id];
	};


	//try {
	var r = modfunc.apply(global, args);

	if ((r instanceof Array) && r.length == args.length) {
		r = [].concat(r);
		r[0] = global;

		MODULES[id] = r[1];
		depend[id] = r;
	};

	//} catch (e) {};
};






/*
mod=3&args=xxx,zzzz,dde_ssd&src=http://...

var __MODULE = (function() {
	var global = window;
	var MODULES = {1:{},2:{},3:{}};

	var DEPEND = {
	3: [2, 1]
	2: [1]
	};

	var depend = {
	// 3: [window, MODULE[3], {}, {}]
	};

	

	
	return function __MODULE(id, modfunc) {
	var args = depend[id];

	if (!args) {
		var dp = DEPEND[id], i, x;
		args = [global, MODULES[id]];

		while(x = dp[i++]) {
		args.push(MODULES[x]);
		};

		depend[id] = args;
	} else {
		args[1] = MODULES[id];
	};

	var r = modfunc.applay(global, args);

	if (r !== MODULE[id]) {
		MODULE[id] = r;
	};
	
	}
})();

__MODULE(2, function(global, module, zzzz, xxxx, eeee) {
	
return module
});

*/


/*
console.log(HTTPS.globalAgent);
setInterval(function() {
	console.log(HTTPS.globalAgent);
}, 2000)
*/

function prox(url, svreq, svres, UTFBOM, xA, xB) {
	if (config.log) console.log('prox \t', url);

	var q = URL.parse(url, true), x;
	var headers = {host: String(q.host)};

	if (x = svreq.headers['if-modified-since']) {
		headers['If-Modified-Since'] = x;
	};
	if (x = svreq.headers['if-none-match']) {
		headers['If-None-Match'] = x;
	};
	if (x = svreq.headers['user-agent']) {
		headers['User-Agent'] = x;
	};
	if (x = svreq.headers['referer']) {
		headers['Referer'] = x;
	};

	if (x = svreq.headers['authorization']) {
		if (access_domain(q.protocol, q.host)) {
			headers['Authorization'] = x;
		};
	};

	if (x = svreq.X_Forwarded_For ) {
		headers['X-Forwarded-For'] = x;
	};

	// http://vflash.ru/prx/https/vflash.timtoi.vn/js/lib/json.js



	//headers.host = 'vflash.ru';
	//var options = { headers: headers,host: 'vflash.ru', path: (q.protocol === 'https:' ? '/prx/https/' : 'prx/http/') + q.host + q.path};
	//var client = HTTP.request(options);

	var options = { headers: headers,host: q.host, path: q.path};
	var client = q.protocol === 'https:' ? HTTPS.request(options) : HTTP.request(options);

	client.setTimeout(4000, function() {
		svres.writeHead(500, {});
		svres.end('503');

		//console.log('error - 503');
	});

	//console.log(HTTPS.globalAgent);
	/*
	console.log(HTTPS.globalAgent);
	new function() {
	var s = HTTPS.globalAgent.sockets, i, x;
	for (i in s)  {
		console.log(s[i]);
	}
	};
	*/

	client.on('error', function(e) {
		svres.writeHead(500, {});
		svres.end('500');
		
		//console.log('error - 500');
	});

	client.on('response', function(response) {
		var headers = response.headers, x;

		if (headers['set-cookie']) {
			delete(headers['set-cookie']);
		};

		if (headers['connection']) {
			delete(headers['connection']);
		};


		if (headers['content-length']) {
			delete(headers['content-length']);
		};

		//headers['content-type'] = 'application/x-javascript; charset=UTF-8';

		if (response.statusCode != 200) {
			svres.writeHead(response.statusCode, headers);

			//response.on('data', function(c){svres.write(c)});
			response.on('end', function(){svres.end()});
			return;
		};

		headers['content-type'] = 'application/x-javascript; charset=UTF-8';

		if (x = headers['content-length']) {
			//headers['content-length'] = (+x + xA.length + xB.length) || 0;
			delete(headers['content-length']);
		};

		if (headers['transfer-encoding']) {
			delete(headers['transfer-encoding']);
		};

		svres.writeHead(200, headers);

		var first = true;
		var datastart = true;

		//response.setEncoding('utf8');




		response.on('data', function(chunk) {
			if (first) {
				first = false;

				if (chunk[0] == 0xEF && chunk[1] == 0xBB && chunk[2] == 0xBF ) {
					if (UTFBOM) svres.write(chunk.slice(0, 3));

					chunk = chunk.slice(3);
				};
			};


			if (chunk.length) {
				if (datastart) {
					datastart = false;
					svres.write(xA);
				};

				svres.write(chunk);
			};
		});

		response.on('end', function() {
			if (datastart) {
				svres.write('/* file null */');
			} else {
				svres.write(xB);
			};

			svres.end();
		}); 
	});

	client.end();
};


function endres(res, status, data) {
	var text = {
		'204': '// 204 No Content',
		'400': '// 400 Bad Request',
		'404': '// 404 Not Found' 
	};

	switch(status) {
		case 204: break;
		case 404: break;
		case 400: break;

		default:
			status = 400;
	};

	res.writeHead(status
		, {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'no-store, no-cache, must-revalidate',
			'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
		}
	);

	res.end(data || text[status] || '// ups');
};




function file_prox(req, res, q) {
	var qm = String(q.path).match(/\/file\/(\d+)\/([^\/]+)\/(https?)\/(.+)/);
	/*
	qm[1] - module ID
	qm[2] - module vars
	qm[3] - src protocol
	qm[4] - src
	*/

	//console.log(qm);

	var file;

	if (qm) {
		var q = URL.parse((qm[3] == 'https' ? 'https://' : 'http://') + qm[4], true);

		if (!q.host || !/.\.[a-zA-Z]{2,7}$/.test(q.hostname) || /^\.|\.\.|[^\w\-\.]/.test(q.hostname) || !(q.protocol === 'http:' || q.protocol === 'https:') ) {
			file = false;
		} else {
			file = q.href;
		};
	};

	if (!file) {
		res.writeHead(404
			, {
				'Content-Type': 'application/x-javascript; charset=UTF-8',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
				'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
			}
		);

		res.end('// error');
		return;
	};

	if (!qm[2]) qm[2] = 'module';

	if (qm[2][0] === '-') {
		qm[2] = qm[2].replace('-', 'module');
	};

	prox(file, req, res, true
		, '__MODULE('+qm[1]+', function(global,'+qm[2]+'){\'use strict\';'
		, '\nreturn [global,'+qm[2]+']});'
	);
};






