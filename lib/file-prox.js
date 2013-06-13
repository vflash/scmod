
/*
	используется для проксирования файла
*/

module.exports = fileProx;


var HTTP = require('http');
var HTTPS = require('https');
var URL = require('url');
var FS = require('fs');


function fileProx(url, svreq, svres, UTFBOM, xA, xB) {
	//if (config.log) console.log('prox \t', url);

	var q = URL.parse(url, true), x;

	if (q.protocol === 'file:') {
		FS.readFile(q.path, {encoding: false}, function (err, chunk) {
			if (err) {
				svres.writeHead(404, {});
				svres.end('404');
				return;
			};

			svres.writeHead(200, {});

			if (chunk[0] == 0xEF && chunk[1] == 0xBB && chunk[2] == 0xBF ) {
				if (UTFBOM) svres.write(chunk.slice(0, 3));

				chunk = chunk.slice(3);
			};

			if (xA) svres.write(typeof xA === 'string' ? new Buffer(xA) : xA);

			svres.write(chunk);

			if (xB) svres.write(typeof xB === 'string' ? new Buffer(xB) : xB);

			svres.end();
		});

		return;
	};


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


	var options = {rejectUnauthorized: false, headers: headers,host: q.host, path: q.path};
	var client = q.protocol === 'https:' ? HTTPS.request(options) : HTTP.request(options);
	var stop = false;

	client.setTimeout(7000, function() {
		svres.writeHead(500, {});
		svres.end('503');

	});


	client.on('error', function(e) {
		if (stop) return;

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

		if (response.statusCode !== 200) {
			stop = true;

			svres.writeHead(response.statusCode, headers);
			client.abort();
			svres.end();
			return;
		};

		headers['content-type'] = 'application/x-javascript; charset=UTF-8';

		if (x = headers['content-length']) {
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
					if (xA) {
						svres.write(typeof xA === 'string' ? new Buffer(xA) : xA);
					};
				};

				svres.write(chunk);
			};
		});

		response.on('end', function() {
			stop = true;

			if (datastart) {
				svres.write(new Buffer('/* file null */') );

			} else {
				if (xB) svres.write(typeof xB === 'string' ? new Buffer(xB) : xB);
			};

			svres.end();
		}); 
	});

	client.end();
};