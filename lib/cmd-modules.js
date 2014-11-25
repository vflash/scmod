
module.exports = modules;

var newErrorLogs = require('./tools.js').servErrorLogs;
var modscript = require('./modscript.js');
var yaml = require('js-yaml');


function modules(url, req, res, options) {
	var log = newErrorLogs();

	modscript(log, req, url
		, function(status, code, _files, _styles, _langs, _mdurl, _gmodules) {
			if (status !== true) {
				res.writeHead(404, {
					'content-type': 'application/x-javascript; charset=UTF-8'
				});

				res.end(log());
				return;
			};


			res.writeHead(200, {
				'content-type': 'application/x-javascript; charset=UTF-8'
			});

			var r = {};

			(_gmodules||[]).forEach(function(x) {
				if (x && x.src && x.jsonData) {
					r[xDelHost(x.src)] = x.jsonData;
				};
			});

			if (options.yaml) {
				res.write(yaml.safeDump(r, {indent: options.yaml}));
			} else {
				res.write(JSON.stringify(r, null, "\t"));
			};
	
			res.end();
		}
	);

	var xStartHost = req.xStartHost;
	function xDelHost(x) {
		x = x + '';
		return xStartHost && x.substr(0, xStartHost.length) === xStartHost
			? x.substr(xStartHost.length)
			: x
		;
	};

};



