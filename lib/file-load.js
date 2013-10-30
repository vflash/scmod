
/*
	используется для загрузки файла целиком (json)
*/

module.exports = fileLoad;


var accessDomain = require('./tools.js').accessDomain;
var HTTP = require('http');
var HTTPS = require('https');
var URL = require('url');
var FS = require('fs');


function fileLoad(url, options, end) {
	var src = URL.parse(url);

	if (src.protocol === 'file:') {
		FS.readFile(src.path, function (err, data) {
			if (err) {
				end(404, 'file:// not load');
				return;
			};

			end(true, data, false);
		});

		return;
	};

	if (!src.host || !/.\.[a-zA-Z]{2,7}$/.test(src.hostname) || /^\.|\.\.|[^\w\-\.]/.test(src.hostname)) {
		return end('bad url-hostname');
	};

	if ( !(src.protocol === 'http:' || src.protocol === 'https:') ) {
		return end('bad url-protocol');
	};

	options = options || false;

	var query = {
		rejectUnauthorized: false,
		method:'GET',
		headers: {
			'x-forwarded-for' : options.X_Forwarded_For || null,
			authorization: options.authorization ? accessDomain(src.protocol, src.host, false) ? options.authorization : null : null
		},

		host: src.host,
		port: src.protocol === 'https:' ? 443 : 80,
		path: src.path
	};


	var client = src.protocol === 'https:' ? HTTPS.request(query) : HTTP.request(query);
	var comp = false;

	client.setTimeout(16000, function() {
		if (!comp) {
			comp = true;
			end(504);
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