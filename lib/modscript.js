'use strict';


module.exports = modscript;


var genReplaceHash = require('./tools.js').genReplaceHash;
var dataToJSON = require('./tools.js').dataToJSON;
var formatURL = require('./tools.js').formatURL;
var fileLoad = require('./file-load.js');
var config = require('./load-config.js');
var jsmin = require('./jsmin.js');
var CRYPTO = require('crypto');
var PATH = require('path');
var URL = require('url');

function genUNIC(src, xStartHost, xsrc) {
	var x = typeof src !== 'string' ? xsrc || Math.random().toString() : src;
	var unic = CRYPTO.createHash('md5').update(x).digest('hex').substr(0, 12);

	/*
	var unic = CRYPTO.createHash('md5').update(
		typeof src !== 'string' ? Math.random().toString() :
			src.indexOf(xStartHost) !== 0 ? src : src.substr(xStartHost.length)
		).digest('hex')
		.substr(0, 12)
	;
	*/

	if (typeof src !== 'string') {
		return '_'+parseInt(unic, 16).toString(36).substr(0,5);
	};

	return parseInt(unic, 16).toString(36).substr(0,6);
};

function modscript(log, ureq, url, end) {
	var exclude = ureq.excludeModules || false;

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
			var LANGS = {};
			var TRMAP = {};


			global_modules.forEach(function(x) {
				if (exclude[x.id]) return;

				if (typeof x.src == 'object' || typeof x.src == 'boolean') {
					MDS[x.id] = x.src;
				};

				LANGS[x.id] = x.langs || false;
				MDURL[x.id] = x.src;

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

				var langs = x.langs, langKey = ureq.forSanboxTranslate;
				var autokey = langKey === 'key' ? x.autokey : false;

				if (langs && langKey) {
					for (i in langs) {
						if (v = langs[i] && langs[i][langKey]) {
							if (autokey && (typeof v === 'string') && (v[0] === '.') ) {
								v = autokey + v;
							};

							(TRMAP[x.id]||(TRMAP[x.id]={}))['_'+i] = v;
						};
					};
				};
				
				
			});


			//log('--------------------------------');
			//log(MDS);
			//log(DEPEND);


			var u
			, files = []
			, file, url
			, a = global_files
			, qhost = ureq.headers['x-scmod-host'] || ('http://' + (ureq.headers.host || 'unknown.host'))
			, i = 0
			, x, v
			;

			while(x = a[i++]) {
				if (exclude[x.moduleID]) continue;

				files.push(
					file = {
						moduleJSON: x.moduleJSON,
						moduleID: x.moduleID,
						nowrap: x.nowrap,
						js_inc: x.js_inc,
						src: ('' + x.src)
					}
				);

				if (x.nowrap) {
					if (x.js_inc) {
						file.url = qhost + '/code-nwp/' + x.moduleID + '/' + encodeURIComponent(x.src);

						continue;
					};

					file.url = ('' + x.src);
					continue;
				};


				var tr = TRMAP[x.moduleID] ? '+' : '-';
				var url = qhost + (x.js_inc ? '/code/' : '/file/'+tr+'/') + x.moduleID+'/';

				file.vars = 'module';
				if (v = MDNAME[x.moduleID]) {
					file.vars = v.map(encodeURIComponent).join(',');
				};

				url += file.vars;
				if (x.js_inc) {
					url += '/' + encodeURIComponent(x.src);

				} else {
					var xurl = URL.parse(x.src);
					url += '/' + (xurl.protocol == 'https:' ? 'https' : 'http')+'/'+xurl.host;
					if (xurl.pathname) url += PATH.normalize(xurl.pathname);
					if (xurl.search) url += xurl.search;
				};

				file.url = url;
			};


			var styles = false;

			if (a = global_styles) {
				for(styles = [], i = 0; x = a[i++];) {
					if (exclude[x.moduleID]) continue;

					styles.push(x.src);
				};

				if (!styles.length) {
					styles = false;
				};
			};


				// '<script src=""></script>'
			var jscode = '';

			if (exclude) {
				jscode += '__MODULE('
					+ JSON.stringify({
						MODULES: MDS, 
						DEPEND: DEPEND, 
						TRMAP: ureq.forSanboxTranslate ? TRMAP : void(0)
					})
					+ ');\n';

			} else {
				jscode += 'var __MODULE=(function(){\'use strict\';var global=window'
					+',MODULES='+JSON.stringify(MDS)
					+',DEPEND='+JSON.stringify(DEPEND)
					+',depend={}'
					+',TRMAP=' + JSON.stringify(TRMAP)
					+',Z;\n'
					+'return ' + jsmin("", String(__MODULE).trim(), 2).trim()
					+ '})();\n'
				;
			};

			if (typeof end == 'function') {
				end(true
					, jscode
					, files
					, styles
					, LANGS
					, MDURL
					, global_modules
				);
			};
		}
	);
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

		if (typeof url !== 'string' || !/^(https?|file):/.test(url) ) {
			virtmod = true;
		};

		var xurl = virtmod ? false : URL.parse(url);
		var modules_total = null;
		var modules_loaded = 0;

		var xmod = {
			id: genUNIC(url, ureq.xStartHost) || modules.length + 1,
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


		if (/[^\?]+.js(\?|\s*$)/.test(xurl.pathname)) {
			mod_json = {scripts: ['./' + url.replace(/^[^\?]*\//, '') ]};
			modules_total = 0;

			complit(true);
			return;
		};

		if (config.log) console.log('mod \t', url);

		fileLoad(url, {authorization: ureq.headers['authorization'], X_Forwarded_For: ureq.X_Forwarded_For}
			, function(status, data, type) {
				if (stop) return;

				if (status !== true) {
					modules_total = 0;
					mod_json = false;

					log('error'
						, xmod.error = 'error load '+(status)+', module - ' + url
					);

					stop = true;
					end_compite(false, 'load module');
					return;
				};

				mod_json = dataToJSON(type, data, log, url);
				if (!mod_json) xmod.error = 'invalid json';

				var x = mod_json.scmod;
				if (typeof x === 'object' && x !== null) {
					mod_json = x;
				};

				if (!replaceHash) {
					replaceHash = mod_json.replace ? genReplaceHash(xurl, mod_json.replace) : true;
				};

				mload(mod_json);
			}
		);

		function mload(mod_json) {
			var j = 0, i, x, z;

			xmod.jsonData = mod_json;

			if (mod_json.alias) {
				xmod.alias = String(mod_json.alias).trim();
			};

			pushStyle(styles, xmod, xurl, replaceHash, ureq
				, mod_json.stylesForce
			);

			if (x = mod_json.modules) {
				for (i in x) {
					var src = x[i];

					if (!src || typeof src !== 'string') {
						modules.push(
							mods[i] = {
								id: genUNIC(src, ureq.xStartHost, xmod.src+' - '+i) || modules.length + 1,
								src: typeof src === 'boolean' || typeof src === 'object' ? src : null
							}
						);

						continue;
					};

					src = src.trim();

					if (src.charCodeAt(0) === 33 && /^!!\[[\w\,]+\]\s+/.test(src)) {
						//v = src.substring(3, src.indexOf(']'));
						src = src.replace(/^!!\[[\w\,]+\]\s+/, '');

						//nowrap = nowrap || /(^|,)nowrap(,|$)/.test(v);
						//js_inc = /(^|,)js(,|$)/.test(v);
					};

					if (/^file:/.test(src)) src = 'badurl-a:' + src.trim();

					src = formatURL(xurl, src, replaceHash, false, ureq.xStartHost);

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

				var x = lineLoad.shift();
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

			xmod.autokey = (typeof mod_json.autokey === 'string' ? mod_json.autokey : false) || false;
			xmod.langs = mod_json.langs || false;
			xmod.nowrap = mod_json.nowrap ? true : false; // не обворачивать в модуль


			if (a = mod_json.scripts || mod_json.files) {
				for(i=0, l = a.length; i<l; i+=1) {
					if (typeof a[i] !== 'string') continue;

					if (x = a[i].trim() ) {
						nowrap = xmod.nowrap;
						js_inc = false;

						if (x.charCodeAt(0) === 33 && /^!!\[[\w\s\,-]+\]\s+/.test(x)) {
							v = x.substring(3, x.indexOf(']'));
							x = x.replace(/^!!\[[^\[\]]*\]\s+/, '');

							nowrap = nowrap || /(^|,)\s*nowrap\s*(,|$)/.test(v);
							js_inc = /(^|,)\s*(inc)\s*(,|$)/.test(v);
						};

						files.push({
                            moduleJSON: mod_json,
							moduleID: xmod.id,
							id: files.length+1,
							nowrap: nowrap,
							js_inc: js_inc,

							src: js_inc ? x : formatURL(xurl, (/^file:/.test(x) ? 'badurl-b:' + x : x), replaceHash, false, ureq.xStartHost)
						});
					};
				};
			};

			pushStyle(styles, xmod, xurl, replaceHash, ureq
				, mod_json.styles
			);

			/*
			if (a = mod_json.styles) {
				for(i=0, l = a.length; i<l; i+=1) {
					if (typeof a[i] !== 'string') continue;

					if (x = a[i].trim()) {
						styles.push({
							moduleID: xmod.id,
							src: formatURL(xurl, (/^file:/.test(x) ? 'badurl-c:'+x : x), replaceHash, false, ureq.xStartHost)
						});
					};
				};
			};
			*/

			xmod.de = false;

			for(i in mods) {
				xmod.de = mods;
				break;
			};


			while(x = xmod.waiting.pop()) x();
			// delete(xmod.waiting);

			xmod.loaded = true;

			end(true, xmod.id);
		};
	};
};

function pushStyle(styles, xmod, xurl, replaceHash, ureq, a) {
	if (!a) return;
	var i=0, l = a.length, x;

	for(; i<l; i+=1) {
		if (typeof a[i] !== 'string') continue;

		if (x = a[i].trim()) {
			styles.push({
				moduleID: xmod.id,
				src: formatURL(xurl, (/^file:/.test(x) ? 'badurl-c:'+x : x), replaceHash, false, ureq.xStartHost)
			});
		};
	};
};

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




function __MODULE(id, modfunc) {
	if (!id) {
		return Z = null;
	};

	if (typeof id === 'object') {
		Z = null;

		var i, x = id.DEPEND;
		for (i in x) {
			if (!DEPEND[i]) DEPEND[i] = x[i];
		};

		x = id.MODULES;
		for (i in x) {
			if (!MODULES[i]) MODULES[i] = x[i];
		};

		x = id.TRMAP;
		for (i in x) {
			if (!TRMAP[i]) TRMAP[i] = x[i];
		};

		return;
	};

	var args = depend[id];

	if (!MODULES[id]) MODULES[id] = {};

	if (!args) {
		var dp = DEPEND[id]||[], i=0, x;
		args = [global, MODULES[id]];

		while(x = dp[i++]) {
			args.push(MODULES[x]=MODULES[x]||{});
		};

		depend[id] = args;
		Z = id;

	} else {
		args[1] = MODULES[id];

		if (id !== Z) {
			// данный модуль уже подключен
			return;
		};
	};


	var dx; args.push(function(x) {dx = dx||x});
	var TR = TRMAP[id];
	args.push(
		TR ? function(x) {var v = TR['_'+x]; return v != null ? v : x} : function(x) {return x}
	);

	modfunc.apply(global, args);

	MODULES[id] = (depend[id] = dx())[1];
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

