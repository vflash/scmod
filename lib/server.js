


var config = require('./load-config.js');
var HTTP = require('http');
require('http-xak');


process.nextTick(function() {
	HTTP.createServer(ServerHendler).listen(config.port, config.host||'127.0.0.1');
	console.log(
		'Server running at http://'+(config.host||'127.0.0.1')+':'+(config.port)+'/'
	);
});


var http_query = require('./file-load.js');
var http_proxy = require('./file-prox.js');

var sandbox = require('./cmd-sandbox.js');
var sandbox_styles = require('./cmd-sandbox_styles.js');
var scripts_pack = require('./cmd-script_pack.js');
var scripts_langs = require('./cmd-script_langs.js');
var styles_pack = require('./cmd-styles_pack.js');


var modscript = require('./modscript.js');
var genReplaceHash = require('./tools.js').genReplaceHash;
var newErrorLogs = require('./tools.js').servErrorLogs;
var normalizeURL = require('./tools.js').normalizeURL;
var dataToJSON = require('./tools.js').dataToJSON;
var formatURL = require('./tools.js').formatURL;
var aliasURL = require('./tools.js').aliasURL;
var jsToJSON = require('js-json').conv;
var prox = require('./file-prox.js');
var yaml = require('js-yaml');
var URL = require('url');

var NULL_FUNCTION = function(){};
var VERSION = require('../package.json').version



function ServerHendler(req, res) {
	var q = URL.parse(req.url, true), x;

	req.on('close', function() {
		res.writeHead = NULL_FUNCTION;
		res.write = NULL_FUNCTION;
		res.end = NULL_FUNCTION;
	});

	req.isLoadModuleLine = true; // грузить модули последовательно
	req.replaceHash = /true|1|on/.test(q.query.rep) || q.query.rep === '' ? false : true; // true - пустой , false - не инициализированный

	if (req.headers['x-real-ip']) {
		req.X_Forwarded_For = req.headers['x-real-ip'] + (req.headers['x-forwarded-for'] ? ', ' + req.headers['x-forwarded-for'] : '');

		if (String(req.X_Forwarded_For).split(',').length > 5 ) {
			endres(res, 400);
			return;
		};
	};

	if (/^\/test($|\?)/.test(q.pathname)) {
		res.writeHead(404
			, {
				'Content-Type': 'application/x-javascript; charset=UTF-8',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
				'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
			}
		);

		res.end('// ok' );

		if (config.log) console.log(req.headers);
		return;
	};


	if (/^\/ver($|\?)/.test(q.pathname)) {
		res.writeHead(200
			, {
				'Content-Type': 'application/x-javascript; charset=UTF-8',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
				'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
				//'Expires': new Date(new Date() + 60000 * 60 *24 * 10).toUTCString()
			}
		);

		res.end('// scmod: ' + VERSION);
		return;
	};


	if (/^\/code(-nwp)?\//.test(q.pathname) ) {
		res.writeHead(200
			, {
				'Content-Type': 'application/x-javascript; charset=UTF-8',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
				'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
				//'Expires': new Date(new Date() + 60000 * 60 *24 * 10).toUTCString()
			}
		);

		var x;

		if (String(q.pathname).indexOf('/code-nwp/') === 0) {
			x = (q.pathname + '');
			x = decodeURIComponent( x.substr(x.lastIndexOf('/')+1) );

			res.end(x);

		} else {
			var qm = String(q.path).match(/\/code\/(\w+)\/([^\/]+)\/(.+)/) || false;
			var x = decodeURIComponent(qm[3]);

			qm[2] = qm[2] ? (qm[2][0] === '-' ? qm[2].replace('-', 'module') : qm[2]) : 'module';

			res.end('__MODULE(\''+qm[1]+'\', function(global,'+qm[2]+',__zAgS_){\'use strict\';__zAgS_(function(){return[global,'+qm[2]+']});' + x + '});');

		};

		if (config.log) {
			console.log('inc \t' + x.substr(0, 77));
		};

		return;
	};


	if (String(q.pathname).indexOf('/file/') === 0) {
		file_prox(req, res, q);
		return;
	};


	if (q.query.auth == null) { //  !== 'base'
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


	if (false && (''+q.pathname).test(/^\/xcss\/(sass|scss|styles)\/{/)) {
		xcss_prox(req, res, q);
		return;
	};


	// -compatibility with old code
	if (req.headers['x-scmod-scheme']) {
		req.headers['x-scmod-host'] = req.headers['x-scmod-scheme'] + '://' + req.headers['x-scmod-host'];
	};


	var src = aliasURL(q.query.src, false);
	if (!src) {
		return endres(res, 404);
	};

	var xsrc = URL.parse(src), referer;
	if (!/.\.[a-zA-Z]{2,7}$/.test(xsrc.hostname) ) {
		var referer = req.headers.referer ? URL.parse(req.headers.referer) : false;

		if (q.query.x302 != null || !/.\.[a-zA-Z]{2,7}$/.test(referer.hostname) ) {
			return endres(res, 400, '// 400 Bad Request, src='+q.query.src); // xxxx
		};

		var xhost = URL.parse(req.headers['x-scmod-host'] || ('http://' + (req.headers.host || 'unknown.host')) );
		xhost.query = q.query;
		xhost.search = null;
		xhost.path = null;
		xhost.pathname += q.pathname;
		xhost.query.src = formatURL(referer, q.query.src);
		if (xhost.pathname.indexOf('//') == 0) {
			xhost.pathname = xhost.pathname.substr(1);
		};

		return endres(res, 302, URL.format(xhost) );
	};


	//console.log(req.headers)
	//console.log(q)


	req.xStartHost = xsrc.protocol + '//' + xsrc.host;

	function go() {
		if (!q.query.core) return go_cmd(req, res, src, q);

		var url_exclude = formatURL(xsrc, q.query.core, req.replaceHash || false);
		var log = newErrorLogs();

		modscript(log, req, url_exclude
			, function(status) {

				if (status !== true) {
					res.writeHead(200, {'content-type': 'text/plain; charset=UTF-8'});
					res.end(log());
					return;
				};

				req.excludeModules = arguments[5];
				go_cmd(req, res, src, q);
			}
		);
	};

	if (!q.query.rep || /^(false|true||0|1|off|on)$/.test(q.query.rep) ) {
		return go();
	};

	var url_replace = formatURL(xsrc, q.query.rep);
	if (!url_replace) return go();

	http_query(url_replace, {authorization: req.headers['authorization'], X_Forwarded_For: req.X_Forwarded_For}
		, function(status, data, type) {
			if (status !== true) {
				endres(res, 400, '// error load "replace" file. status - ' + status);
				return;
			};

			var x = dataToJSON(type, data, false, url_replace) || false;
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

function xcss_prox(req, res, q) {
	var qm = (''+q.path).match(/\/css\/(\w+)\/([^\/]+)\/(https?)\/(.+)/);
	var qm = {type: qm[1], value: qm[2], protocol: qm[3], url: qm[4]};



};

function file_prox(req, res, q) {
	var qm = String(q.path).match(/\/file\/(\w+)\/([^\/]+)\/(https?)\/(.+)/);
	/*
	qm[1] - module ID
	qm[2] - module vars
	qm[3] - src protocol
	qm[4] - src
	*/

	//console.log(qm);

	var file, code, q;

	if (qm) {
		qm[2] = qm[2] ? (qm[2][0] === '-' ? qm[2].replace('-', 'module') : qm[2]) : 'module';

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


	prox(file, req, res, true
		, '__MODULE(\''+qm[1]+'\', function(global,'+qm[2]+',__zAgS_){\'use strict\';__zAgS_(function(){return[global,'+qm[2]+']});'
		, '\n});'
	);
};



function go_cmd(req, res, src, q) {
	req.isLogFiles = ('log' in q.query) && q.query.log !== 'false';

	var options = {
		autokey: ('autokey' in q.query),
		yaml: ('yaml' in q.query) ? parseInt(q.query.yaml, 10) || 2 : false,
		for: q.query['for'] ? (''+q.query['for']) : false,
		lang: q.query.lang ? (''+q.query.lang) : false,
		pure: ('pure' in q.query),
		max: ('max' in q.query),
		log: ('log' in q.query),
		rep: ('rep' in q.query),
		all: q.query.all ? q.query.all : ('all' in q.query)
	};


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

		case '/sandbox_scripts':
			req.isLoadModuleLine = false;
			req.sandbox_scrips = true;

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
			scripts_pack(src, req, res, !options.max, options.lang);
			return;

		case '/styles':
			styles_pack(src, req, res, !options.max );
			return;

		case '/langs':
			req.isLoadModuleLine = false;

			scripts_langs(src, req, res, options);

			return;

		default:
			endres(res, 400);
	};
};


/*
	-------------------------- -----------------------------------
	-------------------------- -----------------------------------
	-------------------------- -----------------------------------
*/


function view_json(req, src, end) {
	http_query(src
		, {authorization: req.headers['authorization'], X_Forwarded_For: req.X_Forwarded_For}

		, function(status, data, type) {
			if (status !== true) {
				return end(false, 'status > ' + status);
			};

			var x;

			if (/\.yaml$/.test(src.replace(/\?.*$/, '')) || type === 'text/yaml' || type === 'application/yaml') {
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



function endres(res, status, data) {
	var text = {
		'204': '// 204 No Content',
		'400': '// 400 Bad Request',
		'404': '// 404 Not Found'
	};

	switch(status) {
		case 301: case 302:
			res.writeHead(status
				, {
					'Content-Type': 'text/plain; charset=utf-8',
					'Location': data
				}
			);

			res.end();
			break;

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
