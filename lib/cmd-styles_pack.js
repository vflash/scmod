
module.exports = styles_pack;

var newErrorLogs = require('./tools.js').servErrorLogs;
var formatURL = require('./tools.js').formatURL;
var file_proxy = require('./file-prox.js');
var modscript = require('./modscript.js');
var URL = require('url');




function styles_pack(url, req, res, cssmin) {
	var u
	, log = newErrorLogs()
	, prx = true
	, file_index = -1
	, files
	, file
	, xurl = URL.parse(url, true)
	, qurl
	;
	
	var xroo = req.xStartHost || (xurl.protocol + '//' + xurl.host);
	var xpoo = xurl.protocol + '//' + xurl.host;


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
			if (prx) {
				if (cssmin) {
					buffer.push(chunk);
				} else {
					res.write(chunk);
				};
			};
		},

		end: function() {
			if (prx) {
				if (cssmin) {
					var xb = Buffer.concat(buffer).toString();
					buffer.length = 0;
					
					xb = xb.replace(/(^|{|;|:|,|\n)\s+(?=}?)|[\t ]+(?=})|\s+(?= {)|\/\*([^\*]|\*(?=[^\/]))+\*\/\s*/g, '$1');

					// "(\\([^"]|")|[^"\n\\])*" текст в двойной кавычке
					// '(\\([^']|')|[^'\n\\])*' текст в ядрёной кавычке 
					


					var xroo_length = xroo.length;
					var xpoo_length = xpoo.length;
					var starthost = qurl.href.substr(0, xroo_length) === xroo;

					xb = xb.replace(/[:\s\(,]url\(\s*("(\\([^"]|")|[^"\n\\])+"|'(\\([^']|')|[^'\n\\])+'|[^)]+)\s*\)|"(\\([^"]|")|[^"\n\\])+"|'(\\([^']|')|[^'\n\\])*'/g
						, function(s, x) {
							if (!x || x.indexOf(':') !== -1) {
								return s;
							};
							
							if (x[0] === '\'') {
								x = '"' + x.slice(1, -1).replace(/\\(.)|(")/g, '\\$1$2') + '"';
							};

							if (x[0] === '"') {
								try {x = JSON.parse(x).trim()} catch(e) {
									return s;
								};
							};

							if (x[0] === '/' && starthost ) {
								x = xroo + x;
							};

							x = formatURL(qurl, x);

							if (x.substr(0, xroo_length) === xroo) {
								x = x.substr(xroo_length);

							} else {
								if (x.substr(0, xpoo_length) === xpoo) {
									x = x.substr(xpoo_length);
								};
							};

							return s.substr(0, 5) + JSON.stringify(x) + ')';
							
						}
					);

					res.write(xb);
				};
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

				res.end('// 404 '+ status);
				return;
			};


			res.writeHead(200, {
				'content-type': 'text/css; charset=UTF-8'
			});

			next();
		}
	);

	function next() {
		var i, src;

		do {
			i = ++file_index;
			if (i >= files.length || !files.length) {
				complite();
				return;
			};

			file = files[i];

		} while(!file);


		qurl = URL.parse(file, true);

		if (qurl.protocol === 'http:' || qurl.protocol === 'https:') {
			if (!qurl.host || !/.\.[a-zA-Z]{2,7}$/.test(qurl.hostname) || /^\.|\.\.|[^\w\-\.]/.test(qurl.hostname)) {
				res.write('\n\n/* ------ 1 BAD: ' + file + ' */\n');
				return next();
			};
		} else {
			if (qurl.protocol !== 'file:') {
				res.write('\n\n/* ------ 2 BAD: ' + file + ' */\n');
				return next();
			};
		};


		file = String(qurl.href).trim();

		//res.write('\n\n/* url: ' + file + ' */\n');
		//res.write('\n\n/* url: ' + file.replace(/^http:\/\/[^\/]+/, function(x) {return crypto.createHash('md5').update(x).digest('hex').substr(-7)}) + ' */\n');
		res.write('\n\n/* url: ' + file.replace(/^(https?|file):\/\/[^\/]+/, '---') + ' */ \n');
		
	

		prx = true;

		xreq.src = file;

		file_proxy(String(file), xreq, xres, false
			, false
			, false
		);
	};

	function complite() {
		res.write('\n'+log() );

		res.end();
	};
};







