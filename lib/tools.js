
var module = module.exports;

module.genReplaceHash = genReplaceHash;
module.servErrorLogs = servErrorLogs;
module.normalizeURL = normalizeURL;
module.dataToJSON = dataToJSON;
module.formatURL = formatURL;
module.aliasURL = aliasURL;

//require('./http-xak.js');

var jsToJSON = require('js-json').conv;
var PATH = require('path');
var URL = require('url');

function servErrorLogs() {
	var log = '';

	return function(type, value, x) {
		if (type == null) {
			return (log ? '\n/* ERROR COMPILE:\n' + log : '\n/* COMPILE OK ') +'*/';
		};

		switch(type) {
			case 'error': log += String(value)+'\n'; break;
			case 'debug': if (config.log) console.log(value);
		};
	};
};


function genReplaceHash(xurl, x) {
	var rp = {}, has, a, b, i, v;

	for (i in x) {
		if (typeof x[i] !== 'string' || !(v = x[i].trim()) ) continue;
		if (/^file:/.test(v)) continue;

		a = formatURL(xurl, i);
		b = formatURL(xurl, v);
		
		
		if (a && b) {
			has = true;
			rp[a] = b;
		};
	};

	return has ? rp : true; 
};


// востанавливает url
function formatURL(xurl, src, replaceHash) {
	if (typeof src !== 'string') {
		return src;
	};

	var x;

	if (src[0] == '.') {
		src = xurl.protocol + '//' + xurl.host + PATH.normalize((xurl.pathname||'/') + '-/../' + src);
	} else 
	if (src[0] == '/') {
		if (src[1] == '/') {
			src = normalizeURL(xurl.protocol + src); //
		} else {
			src = xurl.protocol + '//' + xurl.host + PATH.normalize(src);
		};
	} else 
	if (src.indexOf(':') === -1 ) {
		src = xurl.protocol + '//' + xurl.host + PATH.normalize((xurl.pathname||'/') + '-/../' + src);
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

	if (/^(https?|file):\/\//.test(url)) {
		return normalizeURL(url);
	};

	url = url + '';

	switch(x = url.substring(0, url.indexOf(':')) ) {
		case 'global': return url;

		case 'github':
			x = String(url).substring(7).replace(/^~\//, 'master/');

			x = /^[^\/]+\/[^\/]+\/[^\/]+$/.test(x) ? x.replace(/([^\/]+)$/, '$1/$1.json') 
				: /[^\/]+\/$/.test(x) ? x + 'index.json' 
				: x			
			;

			x = x.replace(/^([^\/]+)\/([^\/]+)\/([^\/]+)/, '$2/$3/$1')

			return normalizeURL('https://raw.github.com/' + x);

		case 'bitbucket':
			x = String(url).substring(10).replace(/^~\//, 'master/');

			x = /^[^\/]+\/[^\/]+\/[^\/]+$/.test(x) ? x.replace(/([^\/]+)$/, '$1/$1.json') 
				: /[^\/]+\/$/.test(x) ? x + 'index.json' 
				: x			
			;

			x = x.replace(/^([^\/]+)\/([^\/]+)\/([^\/]+)/, '$2/$3/raw/$1');

			return normalizeURL('https://bitbucket.org/' + x);

		default:
			return normalizeURL('http://' + url);
	};
};

function dataToJSON(type, data, log, url) {
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
				, (yaml ? 'error yaml' : 'error yaml no support') + ', module - ' + url + (yaml ? ('\n' + String(e)+'\n') : '')
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
					, 'error json, module - ' + url + '\n'+ String(e) + '\n'
				);
			};
		};
	};
	
	return mod_json;
};

