var util = require('util');

var HTTPS = require('https');
var HTTP = require('http');
var Agent = HTTP.Agent;


var _requests_https = {};
var _requests_http = {};
var _sockets_https = {};
var _sockets_http = {};

function init_vflashFix(agent) {
	if (agent._init_vflashFix) return;
	agent._init_vflashFix = true;

	if (agent.createConnection == HTTP.globalAgent.createConnection ) {
		agent.requests = _requests_http;
		agent.sockets = _sockets_http;

	} else if (agent.createConnection == HTTPS.globalAgent.createConnection) {
		agent.requests = _requests_https;
		agent.sockets = _sockets_https;
	};
};

function getFreeSocket(sockets) {
	var i = sockets.length, s;

	while(s = sockets[--i]) {
		if (!s.busyWork && !s.destroyed) return s;
	};
};

Agent.prototype.addRequest = function(req, host, port, localAddress) {
	init_vflashFix(this);
	
	var self = this;
	var name = host + ':' + port;
	if (localAddress) {
		name += ':' + localAddress;
	};

	if (!this.sockets[name]) this.sockets[name] = [];
	//console.log('-- addRequest - '+ (this.sockets[name].length) +' --');

	var s;
	if (s = getFreeSocket(this.sockets[name])) {
		s.tmmrFree = clearTimeout(s.tmmrFree);
		s.busyWork = true;

		req.onSocket(s);
		return;

	};

	if (!this.requests[name]) this.requests[name] = [];
	this.requests[name].push(req);

	if (this.sockets[name].length < this.maxSockets) {
		// If we are under maxSockets create a new one.
		var s = this.createSocket(name, host, port, localAddress, req);
		s.busyWork = true; 

		s.on(s.getPeerCertificate ? 'secureConnect' : 'connect', function() {
			s.busyWork = false;
			s.emit('free');
		});

		s.on('error', function x_error() {
			if ( !(self.requests[name]||false).length || (this.sockets[name]||false).length ) {
				console.log('-- error connect --');
				return;
			};

			console.log('-- !! error req connect !! --');
		});
	};
};




Agent.prototype.createSocket = function(name, host, port, localAddress, req) {
  init_vflashFix(this);

  var self = this;
  var options = util._extend({}, self.options);
  options.port = port;
  options.host = host;
  options.localAddress = localAddress;

  options.servername = host;
  if (req) {
    var hostHeader = req.getHeader('host');
    if (hostHeader) {
      options.servername = hostHeader.replace(/:.*$/, '');
    }
  }

  var s = self.createConnection(options);
  
  if (!self.sockets[name]) self.sockets[name] = [];
  this.sockets[name].push(s);

  var onFree = function() {
	s.busyWork = true;

	if (s.destroyed) {
		//self.emit('free', s, host, port, localAddress);
		s.destroy();
		return;
	};

	if (self.requests[name] && self.requests[name].length) {
		//self.emit('free', s, host, port, localAddress);

		self.requests[name].shift().onSocket(s);
		if (self.requests[name].length === 0) {
			// don't leak
			delete self.requests[name];
		};
		return;
	};

	s.busyWork = false;
	s.tmmrFree = setTimeout(function() {
		//s.busyWork = true;
		//self.emit('free', s, host, port, localAddress);
		s.destroy();
	}, 1200);
  };
  var onClose = function(err) {
    // This is the only place where sockets get removed from the Agent.
    // If you want to remove a socket from the pool, just close it.
    // All socket errors end in a close event anyway.
    self.removeSocket(s, name, host, port, localAddress);
  };
  var onRemove = function() {
    // We need this function for cases like HTTP 'upgrade'
    // (defined by WebSockets) where we need to remove a socket from the pool
    //  because it'll be locked up indefinitely
    self.removeSocket(s, name, host, port, localAddress);
    s.removeListener('close', onClose);
    s.removeListener('free', onFree);
    s.removeListener('agentRemove', onRemove);
  };

  s.on('agentRemove', onRemove);
  s.on('free', onFree);
  s.on('close', onClose);

  return s;
};