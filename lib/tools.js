
var config = require('./load-config.js');
var module = module.exports;

module.genReplaceHash = genReplaceHash;
module.servErrorLogs = servErrorLogs;
module.accessDomain = accessDomain;
module.normalizeURL = normalizeURL;
module.dataToJSON = dataToJSON;
module.genRegExp = genRegExp;
module.formatURL = formatURL;
module.aliasURL = aliasURL;
//require('./http-xak.js');

var jsToJSON = require('js-json').conv;
var yaml = require('js-yaml');
var PATH = require('path');
var URL = require('url');

function servErrorLogs() {
	var log = '';

	return function(type, value, x) {
		if (type == null) {
			return (log ? '\n/* ERROR COMPILE:\n' + log : '\n/* COMPILE OK ') +'*/\n';
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

		a = formatURL(xurl, i, false, false);
		b = formatURL(xurl, v, false, false);


		if (a && b) {
			has = true;
			rp[a] = b;
		};
	};

	return has ? rp : true;
};


// востанавливает url
function formatURL(xurl, src, replaceHash, aliasIndexFile, xStartHost) {
	if (typeof src !== 'string') {
		return src;
	};

	if (typeof xurl !== 'string') {
		xurl = URL.format(xurl);
	};

	if (xStartHost && src[0] === '/') {
		if (xurl.indexOf(xStartHost) === 0) {
			src = xStartHost + src;
		};
	};

	src = normalizeURL(
		URL.resolve(xurl, aliasURL(src, aliasIndexFile))
	);

	//src = aliasURL(src, aliasIndexFile);
	if (!replaceHash) return src;

	if (typeof replaceHash[src] === 'string') {
		return replaceHash[src];
	};

	var s = src.replace(/[^\/]+$/, '');
	for(; /^(file|https?):\/\/./.test(s);  s = s.replace(/[^\/]+\/+$/, '') ) {
		if (typeof replaceHash[s] === 'string') {
			return replaceHash[s] + src.substring(s.length)
		};
	};

	return src;
};

function normalizeURL(url) {
	url = (''+url).trim().replace(/\/~$/, '\/pack.yaml').replace(/\/-$/, '\/pack.json');

	var xurl = URL.parse(url);

	switch(xurl.protocol) {
		case 'http:': case 'https:':
			break;
		default:
			return url;
	};


	url = xurl.protocol+'//'+xurl.host;
	//if (xurl.pathname) url += PATH.normalize(xurl.pathname);
	if (xurl.pathname) {
		url += PATH.sep !== '\\' ? PATH.normalize(xurl.pathname)
			: PATH.normalize(xurl.pathname).split(PATH.sep).join('/') // fix windows PATH.sep
		;
	};
	if (xurl.search) url += xurl.search;

	return url
};

function aliasURL(url, indexFile) {
	var x, u;

	if (typeof url !== 'string') return false;

	indexFile = indexFile === false ? '' : indexFile || 'index.json';

	switch(url.substring(0, url.indexOf(':')) ) {
		case 'global': return url;

		case 'github':
			x = url.substring(7).replace(/^~\//, 'master/');

			x = /^[^\/]+\/[^\/]+\/[^\/]+$/.test(x) ? x.replace(/([^\/]+)$/, '$1/$1.json')
				: /[^\/]+\/$/.test(x) ? x + indexFile
				: x
			;

			x = x.replace(/^([^\/]+)\/([^\/]+)\/([^\/]+)/, '$2/$3/$1');

			return normalizeURL('https://raw.githubusercontent.com/' + x);

		case 'bitbucket':
			x = url.substring(10).replace(/^~\//, 'master/');

			x = /^[^\/]+\/[^\/]+\/[^\/]+$/.test(x) ? x.replace(/([^\/]+)$/, '$1/$1.json')
				: /[^\/]+\/$/.test(x) ? x + indexFile
				: x
			;

			x = x.replace(/^([^\/]+)\/([^\/]+)\/([^\/]+)/, '$2/$3/raw/$1');

			return normalizeURL('https://bitbucket.org/' + x);

		default:
			return url;
	};

};

function dataToJSON(type, data, log, url) {
	var mod_json = false;

	if (typeof log !== 'function') {
		log = function(){};
	};

	if (/\.yaml$/.test(url.replace(/\?.*$/, '')) || type === 'text/yaml' || type === 'application/yaml') {
		try {
			//mod_json = yaml.load(data);
			mod_json = yaml.safeLoad(''+data);

		} catch (e) {
			mod_json = false;

			log('error'
				, (yaml ? 'error yaml' : 'error yaml no support') + ', module - ' + url + (yaml ? ('\n' + String(e)+'\n') : '')
			);
		};

	} else {

		try {
			mod_json = JSON.parse(''+data);

		} catch (e) {
			try {
				mod_json = JSON.parse(jsToJSON(''+data).trim());

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


var auth_domains = config.auth_domains ? String(config.auth_domains).split(/\s+/) : false
function accessDomain(protocol, host, allowed_domains) {
	if (!/^https?:$/.test(protocol) ) return false;

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



var mapRegx = {
    str1: /'(?:\\(?:[^']|')|[^'\n\\])*'/, // строка в одерной кавычке
    str2: /"(?:\\(?:[^"]|")|[^"\n\\])*"/, // строка в двойной кавычке
    regx: /\/[^\*\/\n](?:\\\\|\\\/|[^\/\n])+\/\w+/,  // регулярка
    comment_att: /\/\*\!(?:[^*]|\*(?=[^\/]))*\*\//, // комментарий /*! .... */
    comment_spe: /\/\*\@(?:[^*]|\*(?=[^\/]))*\*\//, // комментарий /*@ .... */
    comment_mu: /\/\*(?:\s|[^*]|\*(?=[^\/]))*\*\//, // комментарий /* .... */
    comment_mi: /\/\/[^\n]*/, // комментарий
};

function genRegExp(a) {
	return new RegExp(
        a.map(
            function(x){
                if (typeof x === 'string') x = mapRegx[x];

                return x.source || '('+genRegExp(x).source+')';
            }
        ).join('|')
        , 'g'
    )
};


