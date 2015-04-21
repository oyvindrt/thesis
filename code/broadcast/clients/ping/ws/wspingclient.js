var WebSocket = require('ws');

var ws;
var broadcastStarted = false;
var broadcastEnded = false;
var interval;

var responseTime = {
	before: [ ],
	under: [ ]
};

process.on('message', function(message) {
	var obj = JSON.parse(message);
	if (obj.type === "connectToServer") {
		ws = new WebSocket(obj.addr);
		ws.on('open', function() {
			process.send(JSON.stringify({"type": "connected"}));
			initiatePingProgram();
		});

		ws.on('message', function(data) {
			var obj = JSON.parse(data);
			if (obj.type === "broadcast") {
				if (broadcastStarted === false) {
					broadcastStarted = true;
				}
			} else if (obj.type === "pong") {
				var diff = Date.now() - parseInt(obj.sent);
				if (broadcastStarted === false) {
					responseTime.before.push(diff);
				} else {
					responseTime.under.push(diff);
				}
			}
		});

		ws.on('close', function(code, reason) {
			clearInterval(interval);
			var obj = JSON.parse(reason);
			var avgs = calculateAvgResponseTime();
			process.send(JSON.stringify({
				"type": "done",
				"avgResp": avgs
			}));
		});
	}
});

var initiatePingProgram = function() {
	interval = setInterval(function() {
		if (ws.readyState === 1) {
			ws.send(JSON.stringify({"type": "ping", "sent": Date.now()}));
		}
	}, 50);
};

var calculateAvgResponseTime = function() {
	var ret = { };
	var avg = 0;
	for (var i = 0; i < responseTime.before.length; i++) {
		avg += responseTime.before[i];
	}
	ret.before = avg / responseTime.before.length;
	avg = 0;
	for (var i = 0; i < responseTime.under.length; i++) {
		avg += responseTime.under[i];
	}
	ret.under = avg / responseTime.under.length;
	return ret;
};
