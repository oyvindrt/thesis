var http = require('http');

var broadcastEnded = false;

var serverAddr;
var serverPort;

var responseTime = {
	before: [ ],
	under: [ ]
};

http.globalAgent.maxSockets = 1;

process.on('message', function(message) {
	var obj = JSON.parse(message);
	if (obj.type === "startPingProgram") {
		serverAddr = obj.host;
		serverPort = parseInt(obj.port);
		setTimeoutForNewPing();
		process.send(JSON.stringify({"type": "pingProgramStarted"}));
	}
});

var setTimeoutForNewPing = function() {
	setTimeout(function() {
		sendPing(serverAddr, serverPort);
	}, 50);
};

var sendPing = function(host, port) {
	var options = {
		host: host,
		port: port,
		path: ('/ping?time=' + Date.now())
	};

	var data = "";

	http.get(options, function(response) {
		response.on('data', function(chunk) {
			data += chunk;
		});

		response.on('end', function() {
			handleResponse(null, data);
		});

		response.on('error', function(e) {
			handleResponse(e, null);
		});
	});
};

var handleResponse = function(e, data) {
	if (e) {
		console.log("Error message: " + e.message);
	} else {
		var obj = JSON.parse(data);
		if (obj.type === "pong") {
			if (obj.status === "before") {
				var diff = Date.now() - parseInt(obj.time);
				responseTime.before.push(diff);
				if (!broadcastEnded) {
					setTimeoutForNewPing();
				}
			}
			else if (obj.status === "under") {
				var diff = Date.now() - parseInt(obj.time);
				responseTime.under.push(diff);
				if (!broadcastEnded) {
					setTimeoutForNewPing();
				}
			}
			else if (obj.status === "done") {
				broadcastEnded = true;
				var avgs = calculateAvgResponseTime();
				process.send(JSON.stringify({
					"type": "done",
					"avgResp": avgs
				}));
			}
		}
	}
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
