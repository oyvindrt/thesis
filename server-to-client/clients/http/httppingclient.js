var http = require('http');

var broadcastStarted = false;
var broadcastEnded = false;
var interval;

var responseTime = {
	before: [ ],
	under: [ ]
};

http.globalAgent.maxSockets = 1;

process.on('message', function(message) {
	var obj = JSON.parse(message);
	if (obj.type === "startPingProgram") {
		initiatePingProgram(obj.host, parseInt(obj.port));
		process.send(JSON.stringify({"type": "pingProgramStarted"}));
	}
});

var initiatePingProgram = function(host, port) {
	interval = setInterval(function() {
		sendPing(host, port);
	}, 50);
};

var sendPing = function(host, port) {
	var options = {
		host: host,
		port: port,
		path: ('/ping?time=' + Date.now())//,
	   	//agent: httpAgent // false
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
		console.log("DET SKJEDDE EN FEIL GITT");
		console.log("Error message: " + e.message);
		console.log(e);
	} else {
		var obj = JSON.parse(data);
		if (obj.type === "pong") {
			if (obj.status === "before") {
				var diff = Date.now() - parseInt(obj.time);
				responseTime.before.push(diff);
			}
			else if (obj.status === "under") {
				var diff = Date.now() - parseInt(obj.time);
				responseTime.under.push(diff);
			}
			else if (obj.status === "done") {
				clearInterval(interval);
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
