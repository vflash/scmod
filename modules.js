'use strict';


var config = require('./config.js');
var http = require('http');
var URL = require('url');
var PATH = require('path');
var qs = require('querystring');
var jsmin = require('./jsmin.js');

var log = console.log;






/*
'__MODULE('+key+', function(global, module, modules) {'++'\n});\n'
jsmd.zz7a.com/work?src=http://cc.com&path=''
jsmd.zz7a.com/dev?src=http://cc.com&path=''
*/



// http://zz7a.com/js/moon/moon.json





function http_query(url, end) {
	var src = URL.parse(url);
	
	var query = {
		method:'GET',
		headers: {},

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

	var client = src.protocol === 'https:' ? https.request(query) : http.request(query);

	client.setTimeout(6000, err);
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
	};

	return normalizeURL(src);
};

function normalizeURL(url) {
	var xurl = URL.parse(String(url).trim());

	url = xurl.protocol+'//'+xurl.host;
	if (xurl.pathname) url += PATH.normalize(xurl.pathname);
	if (xurl.search) url += xurl.search;

	return url
};


var smod = function(start_url, end_compite) {
	var modules = [];
	var modulesHash = {};
	var files = [];
	var stop;

	function get_module(url, modstack, end) {
		var virtmod = false;

		if (url === true) {
			virtmod = true;
		} else
		if (!/^https?:\/\//.test(url)) {
			if (String(url).substr(0,7) == 'global:') {
				virtmod = true;
			} else
			if (String(url).substr(0,3) == '://') {
				url = normalizeURL('http' + url);
			} else {
				url = normalizeURL('http://' + url);
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


		function loadModule(mod, end) {
			var x;


			if (modstack.indexOf(mod.src) != -1) {
				stop = true;
				//console.log(modstack.concat([mod.src]))
				end_compite(false, modstack.concat([mod.src]));
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

			var u
			, a = mod_json.files
			, i, l, x
			;

			if (a) {
				for(i=0, l = a.length; i<l; i+=1) {
					if (x = a[i]) {

						files.push({
							moduleID: xmod.id,
							id: files.length+1,
							//src: x
							src: formatURL(xurl, x)
							
						});

					};
				};
			};

			xmod.de = false;

			for(i in mods) {
				xmod.de = mods;
				break;
			};
			

			// log(xmod.waiting);
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

		if (!/\.json$/.test(xurl.pathname)) {
			mod_json = {files: [url]};
			modules_total = 0;
			complit(true);
			return;
		};



		http_query(url, function(status, data, type) {
			if (stop) return;

			if (status !== true) {
				modules_total = 0;
				mod_json = {};

				complit(true);
				return;
			};

			var json, x, i, j,v;


			data = jsmin("", String(data).trim(), 2);
			if (data.indexOf('{')) data = data.substr(data.indexOf('{'));


			try {
				mod_json = JSON.parse(data);
			} catch (e) {
				mod_json = {error: 'invalid json'};
			};
			
			if (mod_json.alias) {
				xmod.alias = String(mod_json.alias);
			};


			j = 0;
			if (x = mod_json.modules) {

				for (i in x) {
					var src = x[i];

					if (typeof src !== 'string') {
						//mods[i] = {id:0}; 
						modules.push(
							mods[i] = {id: modules.length + 1,src: false}
						);
						
						continue;
					};

					src = formatURL(xurl, src);

					loadModule(mods[i] = {src: src}
						, complit
					);

					j += 1;
				};
			};

			modules_total = j;
			complit(true);
		});

	};

	get_module(start_url, [], function() {
		end_compite(true, modules, files);
	});
};


//write('http://zz7a.com/js/moon/moon.json', func)
function write(url, end) {
	smod(url, function(status, global_modules, global_files) {
		log('end');

		if (status !== true) {
			return;
		};


		/*
		log('var __MODULES = {};');
		global_modules.forEach(function(x) {
			log('__MODULES['+(x.id)+'] = {}');
		});
		*/
		
		//log(global_modules)



		var DEPEND = {};
		var MDNAME = {};
		var MDS = {};

		global_modules.forEach(function(x) {
			MDS[x.id] = {};
			

			//console.log(x);

			var dep = [], nms = [], de = x.de, v, i;
			//log('- ', x)
			//log('> ', de)
			
			for (i in de) {
				if (v = de[i]) {
					nms.push(i);
					dep.push(v.id);
				};
			};

			if (dep.length) {
				DEPEND[x.id] = dep;
				MDNAME[x.id] = nms;
			};
		});


		//log('--------------------------------');
		//log(MDS);
		//log(DEPEND);


		var u
		, files = []
		, a = global_files
		, i = 0
		, x, v
		;

		while(x = a[i++]) {
			var url = 'http://'+String(config.server_host)+'/file/'+ x.moduleID+'/-';

			if (v = MDNAME[x.moduleID]) {
				url += '' + v.map(encodeURIComponent).join(',');
			};

			var xurl = URL.parse(x.src);
			url += '/' + (xurl.protocol == 'https:' ? 'https' : 'http')+'/'+xurl.host;
			if (xurl.pathname) url += PATH.normalize(xurl.pathname);
			if (xurl.search) url += xurl.search;

			//console.log(url);
			files.push(url);
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
		
		//jscode += jsmin("", String(__MODULE).trim(), 2).trim() + '\n';
		
		
		if (files.length) {
			jscode += 'document.write('+JSON.stringify('<script src="' + files.join('"></script><script src="') + '"></script>')+');\n'
			jscode += '/*\n'+files.join('\n')+'\n*/\n';
		};
		
		
		
		
		


		//console.log(jscode)
		if (typeof end == 'function') {
			end(true, jscode);
		};
		
	});
};


//smpack


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






var URL = require('url');
var http = require('http');

function prox(url, svreq, svres, xA, xB) {
	var q = URL.parse(url, true), x;

	console.log('prox js', url);

	http.Agent.defaultMaxSockets = 1;
	http.globalAgent.maxSockets = 2;


	var headers = {host: String(q.host)};
	
	

	//console.log(svreq.headers);
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

	if (x = svreq.headers['dnt']) {
		headers['DNT'] = x;
	};

	//headers['Connection'] = 'close'; //keep-alive


	http.get(
		{ 
			headers: headers,
			host: q.host, 
			path: q.path
		}

		, function(response) {
			var headers = response.headers, x;

			if (headers['set-cookie']) {
				delete(headers['set-cookie']);
			};
			
			if (headers['connection']) {
				delete(headers['connection']);
			};
			
			

			//headers['content-type'] = 'application/x-javascript; charset=UTF-8';

			if (response.statusCode != 200) {
				svres.writeHead(response.statusCode, headers);

				response.on('data', function(c){svres.write(c)});
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
			
			//response.setEncoding('utf8');
			
			response.on('data', function(chunk) {
				//console.log(chunk)
				if (first) {
					first = false;

					if (chunk[0] == 0xEF && chunk[1] == 0xBB && chunk[2] == 0xBF ) {
						svres.write(chunk.slice(0, 3));
						chunk = chunk.slice(3);
					};

					svres.write(xA);
				};
				
				svres.write(chunk);
			});

			response.on('end', function() {
				svres.end(xB+'            ');
			}); 
		}
	).on('error', function(e) {
		svres.writeHead(500, {});
		svres.end('500');
		
		console.log('error - 500');

	}).setTimeout(6000, function() {
		svres.writeHead(500, {});
		svres.end('503');
		
		console.log('error - 503');
	});
};

function serverHendler(req, res) {
	var q = URL.parse(req.url, true);
	var qm;

	//console.log(req.headers);


	if (String(q.pathname).indexOf('/file/') === 0) {
		qm = String(q.path).match(/\/file\/(\d+)\/-([^\/]*)\/(https?)\/(.+)/);
		/*
		qm[1] - module ID
		qm[2] - module vars
		qm[3] - src protocol
		qm[4] - src
		*/
		
		//console.log(qm);


		prox('http://' + qm[4], req, res
			, '__MODULE('+qm[1]+', function(global,module'+(qm[2] ? ','+qm[2] : '')+'){\'use strict\';'
			, '\nreturn [global,module'+(qm[2] ? ','+qm[2] : '')+']});'
			//, '\nreturn module});'
		);

		return;
	};

	if (q.pathname === '/loading') {
		return;
	};

	if (q.pathname === '/write') {
		var src = q.query.src || '';
		if (src.indexOf('http://') === 0) {
			src = normalizeURL(src);
		} else
		if ((src[0] == '.' || src[0] == '/') && String(req.headers['referer']).indexOf('http://') === 0 ) {
			src = formatURL(URL.parse(String(req.headers['referer'])), src);
		} else {
			src = false;
		};
		
		if (src) {
			write(src, function(status, code) {
				res.writeHead(200
					, {
						'Content-Type': 'application/x-javascript; charset=UTF-8',
						'Cache-Control': 'no-store, no-cache, must-revalidate',
						'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
					}
				);

				res.end(code);
			});

		} else {
			res.writeHead(404
				, {
					'Content-Type': 'application/x-javascript; charset=UTF-8',
					'Cache-Control': 'no-store, no-cache, must-revalidate',
					'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
				}
			);

			res.end('// error');
		};
		
		//console.log(src);
		//req.headers['referer']
		//var xurl = URL.parse(String(req.headers['referer']))
		//formatURL(xurl, src) {
		
		return;
	};
};
	

process.nextTick(function() {
	http.createServer(serverHendler).listen(config.port, "127.0.0.1");
	console.log('Server running at http://127.0.0.1:'+(config.port)+'/');
});
