
module.exports = new function() {
	return {
		port: 1778,
		host: '127.0.0.1',
		auth_domains: 'vflash.ru .vflash.ru .zzreader.com .timtoi.vn',
		gzip: true,
		log: true
	};

	var x
	, a = ['../config.js', '/usr/local/etc/scmod/config.js', '/etc/scmod/config.js']
	, i = 0
	;

	while(x = a[i++]){
		try {
			x = require(x);
			return x;
		} catch(e) {};
	};

	x = require('config-simple.js');
	return x;
};
