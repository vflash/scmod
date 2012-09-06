'use strict';


var config = require('./config.js');
var HTTP = require('http');
var HTTPS = require('https');
var URL = require('url');
var PATH = require('path');
var qs = require('querystring');
var jsmin = require('./jsmin.js');
//var crypto = require('crypto');

//HTTP.globalAgent.maxSockets = 1;
HTTPS.globalAgent.maxSockets = 1;


HTTPS.globalAgent.addRequest = function(req, host, port) {
  var name = host + ':' + port;
  if (!this.sockets[name]) this.sockets[name] = [];
  
  if (!this.sockets[name].length || (this.requests[name]||false).length > (3 + this.sockets[name].length * 7)  ) {
	// If we are under maxSockets create a new one.
	req.onSocket(this.createSocket(name, host, port));

  } else {
	// We are over limit so we'll add it to the queue.
	if (!this.requests[name]) this.requests[name] = [];
	this.requests[name].push(req);
  }
};




var log = console.log;


process.nextTick(function() {
	//HTTP.createServer(serverHendler).listen(config.port, "127.0.0.1");
	HTTP.createServer(serverHendler).listen(config.port, config.host||'127.0.0.1');
	console.log('Server running at http://'+(config.host||'127.0.0.1')+':'+(config.port)+'/');
});



function serverHendler(req, res) {
	var q = URL.parse(req.url, true), x;

	//console.log(req.headers);

	if (req.headers['x-real-ip']) {
		req.X_Forwarded_For = req.headers['x-real-ip'] + (req.headers['x-forwarded-for'] ? ', ' + req.headers['x-forwarded-for'] : '')
	};
	

	if (String(q.pathname).indexOf('/stoop') === 0) {
		return;
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
		if (req.headers['authorization']) req.headers['authorization'] = null;
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


	var src = q.query.src || '';

	if (/^https?:\/\//.test(src) ) {
	src = normalizeURL(src);
	} else
	if ((src[0] == '.' || src[0] == '/') && String(req.headers['referer']).indexOf('http://') === 0 ) {
	src = formatURL(URL.parse(String(req.headers['referer'])), src);
	} else {
	src = false;
	};

	
	if (!src) {
	return endres(res, 404);
	};
	

	req.isLoadModuleLine = true; // грузить модули последовательно

	switch(q.pathname) {
	case '/sandbox': case '/write': case '/dev':
		req.isLoadModuleLine = false;


		write(req, src, function(status, code) {
		res.writeHead(200
			, {
			'Content-Type': 'application/x-javascript; charset=UTF-8',
			'Cache-Control': 'no-store, no-cache, must-revalidate',
			'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT',
			'X-Forwarded-For': req.X_Forwarded_For
			}
		);

		res.end(code);
		});
		return;

	case '/pack':
		script_pack(src, req, res);
		return;
	case '/scripts': case '/jsmin':
		script_pack(src, req, res, true, q.query.lang ? String(q.query.lang) : false);
		return;
	case '/styles':
		styles_pack(src, req, res, q.query.min != 'false');
		return;
	case '/langs':
		req.isLoadModuleLine = false;

		script_langs(src, req, res, true, q.query.lang ? String(q.query.lang) : false);
		return;

	default:
		endres(res, 400);
	};

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

	if (config.log) console.log('mod \t', url);

	options = options || false;

	var query = {
	method:'GET',
	headers: {
		'x-forwarded-for' : options.x_forwarded_for || null,
		authorization: options.authorization ? access_domain(src.protocol, src.host, false) ? options.authorization : null : null
	},

	host: src.host,
	port: src.protocol === 'https:' ? 443 : 80,
	path: src.path
	};


	var comp = false;

	function err() {
	if (!comp) {
		comp = true;
		end();
	};
	};

	var client = src.protocol === 'https:' ? HTTPS.request(query) : HTTP.request(query);

	client.setTimeout(4000, err);
	client.on("error", err);

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

function formatURL(xurl, src) {

	if (src[0] == '.') {
	return xurl.protocol + '//' + xurl.host + PATH.normalize((xurl.pathname||'/') + '/../'+src);
	} else 
	if (src[0] == '/') {
	return xurl.protocol + '//' + xurl.host + PATH.normalize(src);
	} else 
	if (src.substr(0, 3) == '://') {
	src = xurl.protocol + src.substr(1);
	} else 
	if (String(src).indexOf(':') === -1 ) {
	
	return xurl.protocol + '//' + xurl.host + PATH.normalize((xurl.pathname||'/') + '/../'+src);
	};

	return normalizeURL(src);
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



function smod(ureq, start_url, end_compite) {
	var isLoadModuleLine = ureq.isLoadModuleLine ? true : false;
	var modules = [];
	var modulesHash = {};
	var files = [];
	var styles = [];
	var stop;

	get_module(start_url, [], function() {
		end_compite(true, modules, files, styles);
	});

	function get_module(url, modstack, end) {
		var virtmod = false;

		if (url === true) {
			virtmod = true;

		} else {
			if (!/^https?:\/\//.test(url)) {
				if (String(url).substr(0,7) == 'global:') {
					virtmod = true;
				} else
				if (String(url).substr(0,2) == '//') {
					url = normalizeURL('http' + url);
				} else {
					url = normalizeURL('http://' + url);
				};
			};
		};
		

		var xurl = virtmod ? false : URL.parse(normalizeURL(url));

		var modules_total = null;
		var modules_loaded = 0;

		var xmod = {
			id: modules.length + 1,
			loaded: false,
			waiting: [],
			src: url
		};

		modules.push(xmod);

		if (url !== true) {
			modulesHash[url] = xmod;
			modstack.push(url);
		};

		var lineLoad = [];
		var lineSending = false;

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
				//console.log(modstack.concat([mod.src]))

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

		var mod_json, mods = {};
		
		function complit() {
			if (stop || modules_total != modules_loaded) {
				return;
			};

			//log('complit mod', url);

			var u, a, i, l, x;

			xmod.langs = mod_json.langs || false;
			xmod.nowrap = mod_json.nowrap ? true : false; // не обворачивать в модуль

			if (a = mod_json.scripts || mod_json.files) {
				for(i=0, l = a.length; i<l; i+=1) {
					if (x = a[i]) {
						files.push({
							moduleID: xmod.id,
							id: files.length+1,
							nowrap: xmod.nowrap,
							src: formatURL(xurl, x)
						});
					};
				};
			};

			if (a = mod_json.styles) {
			for(i=0, l = a.length; i<l; i+=1) {
				if (x = a[i]) {
				styles.push(formatURL(xurl, x));
				};
			};
			};

			xmod.de = false;

			for(i in mods) {
			xmod.de = mods;
			break;
			};
			

			// log(xmod.waiting);
			if (!xmod.waiting) console.log(xmod);
			while(x = xmod.waiting.pop()) x();
			delete(xmod.waiting);


			xmod.loaded = true;
			end(true, xmod.id);
		};

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

		http_query(url, {authorization: ureq.headers['authorization'], 'x_forwarded_for': ureq.X_Forwarded_For}, function(status, data, type) {
			if (stop) return;

			if (status !== true) {
				modules_total = 0;
				mod_json = {
					error: 'not load module - ' + url,
				};

				complit(true);
				return;
			};

			var json, x, i, j,v;



			try {
				data = jsmin("", String(data).trim(), 2);
				if (data.indexOf('{')) data = data.substr(data.indexOf('{'));
				mod_json = JSON.parse(data);

			} catch (e) {
				mod_json = {
					error: 'invalid json',
					errmsg: String(e)
				};
				
				console.log(e);
			};


			if (mod_json.alias) {
				xmod.alias = String(mod_json.alias);
			};


			j = 0;
			if (x = mod_json.modules) {
				for (i in x) {
					var src = x[i];

					if (!src || typeof src !== 'string') {
						modules.push(
							mods[i] = {id: modules.length + 1, src: false}
						);

						continue;
					};


					src = formatURL(xurl, src);

					(isLoadModuleLine || true ? loadModuleLine : loadModule)(mods[i] = {src: src}
						, complit 
					);

					j += 1;
				};
			};

			modules_total = j;

			complit(true);
		});

	};
};



//write('http://zz7a.com/js/moon/moon.json', func)
function modscript(ureq, url, end) {
	smod(ureq, url, function(status, global_modules, global_files, global_styles) {

	if (status !== true) {
		if (typeof end == 'function') end();
		return;
	};

	var DEPEND = {};
	var MDNAME = {};
	var MDURL = {};
	var MDS = {};
	var langs = {};

	global_modules.forEach(function(x) {
		MDS[x.id] = {};
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
	, qhost = ((ureq.headers['x-scmod-scheme']||ureq.headers['x-real-protocol'])==='https' ? 'https://' : 'http://') 
		+ String(ureq.headers['x-scmod-host']||ureq.headers.host||'unknown.host')
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

	jscode += 'var __MODULE=(function(){var global=window'
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
	});
};


function write(req, url, end) {
	modscript(req, url, function(status, code, files, styles) {
	
	if (files.length) {
		var _files = files.map(function(v){return v.url});
		code += 'document.write('+JSON.stringify('<script src="' + _files.join('"></script><script src="') + '"></script>')+');\n'
		code += '/*\n scripts\n'+_files.join('\n')+'\n*/\n';
	};
	

	if (styles) {
		var s = [], a, i;

		for (i=0; i < styles.length; i+=30) {
		s.push('<style type="text/css">\n'
			+ styles.slice(i, i+30).map(function(x) {return '@import url('+JSON.stringify(String(x))+');\n'}).join('')
			+ '</style>'
		);
		};

		code += '\ndocument.write('+JSON.stringify(s.join(''))+');\n';
		code += '/*\n styles\n'+styles.join('\n')+'\n*/\n\n';
	};


	if (typeof end == 'function') {
		end(true, code);
	};
	});
};


function script_pack(url, req, res, jmin, langKey) {
	var u
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
		if (status === 200) return;

		prx = false;
	},

	write: function(chunk) {
		if (jmin) {
		if (prx) buffer.push(chunk);
		} else {
		if (prx) res.write(chunk);
		};
	},

	end: function() {
		if (jmin) {
		var code = '', lang, x;

		try {
			code = jsmin("", buffer.join(''), 1);
		} catch (e) {
			res.write('jsmin error');
		};

		buffer.length = 0;

		if (lang = langKey ? langs[modID] : false) {
			
			code = code.replace(/\/\*([^*]|\*(?=[^\/]))+\*\/|\/(\\\\|\\\/|[^\/\n])+\/|\'(\\\\|\\\'|[^\'])*'|\"(\\\\|\\\"|[^\"])*\"/g
				, function(x) {
					if (x.charCodeAt(0) !== 34) return x;

					try {
						var vs = lang[JSON.parse(x)] || false;
					} catch (e) {
						console.log('ups JSON.parse(lang)');
						return x;
					};

					return typeof vs[langKey] === 'string' ? JSON.stringify(vs[langKey]) : x;
				}
			);
		};

		res.write(code);
		};


		next();
	}
	};


	modscript(req, url, function(status, code, _files, _styles, _langs, _MDURL) {
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

	res.write(code);

	files = _files;
	langs = _langs;
	next();
	});

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

	var shead = '', sfoot = '', url, q;

	if (typeof file === 'object') {
		modID = file.moduleID;

		if (file.nowrap) {
		url = file.url;
		shead = '';
		sfoot = '';

		} else {
		url = file.src;
		

		shead = '__MODULE('+file.moduleID+', function(global,'+(file.vars||'module')+'){\'use strict\';'
		sfoot = '\nreturn [global,'+(file.vars||'module')+']});'
		};

		var q = URL.parse(url);

		if (!q.host || !/.\.[a-zA-Z]{2,7}$/.test(q.hostname) || /^\.|\.\.|[^\w\-\.]/.test(q.hostname)) {
		res.write('\n\n/* ------ BAD: ' + file + ' */\n'); 
		return next();
		};

		if ( !(q.protocol === 'http:' || q.protocol === 'https:') ) {
		res.write('\n\n/* ------ BAD: ' + file + ' */\n');
		return next();
		};

		res.write('\n\n/* url: ' + String(url).replace(/^https?:\/\/[^\/]+/, '---') + ' */\n');

		prox(url, xreq, xres, false, shead, sfoot);

		return;
	};
	};

	function complite() {
	res.write('\n\n__MODULE=null;');
	res.end();
	};
};

function styles_pack(url, req, res, cssmin) {
	var u
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
			if (status === 200) return;
			prx = false;

			res.write('/* error load, status: '+status+' */\n\n')
			//res.write('/* stop compile */\n')
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


	modscript(req, url, function(status, code, _files, _styles) {
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
	});

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
		prox(String(file), xreq, xres, false
			, ''
			, ''
		);
	};

	function complite() {
		res.end();
	};
};



function script_langs(url, req, res, jmin, langKey) {
	var u
	, prx = true
	, file_index = -1
	, files
	, langs
	, mdurl
	, LNG = {}
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
			if (status === 200) return;

			prx = false;
		},

		write: function(chunk) {
			if (jmin) {
				if (prx) buffer.push(chunk);
			} else {
				if (prx) res.write(chunk);
			};
		},

		end: function() {
			if (jmin) {
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
						console.log('ups JSON.parse(lang)');
						continue;
					};

					LNG[modID] = lang_new;

					if (typeof lang_new[x] !== 'object') {
						var xs = lang_new[x] = {};
						
						['vn', 'en'].map(function(v) {
							var vp = (lang_old[x]||false)[v];
							xs[v] = typeof vp === 'string' ? vp : null;
						});
					};
				};
			};

			next();
		}
	};


	modscript(req, url, function(status, code, _files, _styles, _langs, _mdurl) {
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
	});

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

	
	var shead = '', sfoot = '', url, q;

		if (typeof file === 'object') {
			modID = file.moduleID;

			if (file.nowrap) {
				url = file.url;
				shead = '';
				sfoot = '';

			} else {
				url = file.src;

				shead = '__MODULE('+file.moduleID+', function(global,'+file.vars+'){\'use strict\';'
				sfoot = '\nreturn [global,'+file.vars+']});'
			};

			var q = URL.parse(url);

			if (!q.host || !/.\.[a-zA-Z]{2,7}$/.test(q.hostname) || /^\.|\.\.|[^\w\-\.]/.test(q.hostname)) {
				//res.write('\n\n/* ------ BAD: ' + file + ' */\n'); 
				return next();
			};

			if ( !(q.protocol === 'http:' || q.protocol === 'https:') ) {
				//res.write('\n\n/* ------ BAD: ' + file + ' */\n');
				return next();
			};

			//res.write('\n\n/* url: ' + String(url).replace(/^https?:\/\/[^\/]+/, '---') + ' */\n');

			prox(url, xreq, xres, false, shead, sfoot);

			return;
		};
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
		
		console.log('error - 503');
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
		
		console.log('error - 500');
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

		//console.log(headers);

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
			//svres.write(xB);
			
			svres.end();
		}); 
	});

	client.end();
};


function endres(res, status) {
	switch(status) {
	case 400:
		res.writeHead(400
			, {
				'Content-Type': 'application/x-javascript; charset=UTF-8',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
				'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
			}
		);

		res.end('// 400 Bad Request');
		return;

	case 404:
		res.writeHead(404
			, {
				'Content-Type': 'application/x-javascript; charset=UTF-8',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
				'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
			}
		);

		res.end('// 404 Not Found');
		return;
	};
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
	if (qm[2][0] === '-') qm[2] = qm[2].replace('-', 'module');

	prox(file, req, res, true
		, '__MODULE('+qm[1]+', function(global,'+qm[2]+'){\'use strict\';'
		, '\nreturn [global,'+qm[2]+']});'
	);
};






