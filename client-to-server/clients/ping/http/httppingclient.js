var http = require('http');

var broadcastEnded = false;

var serverAddr;
var serverPort;

var responseTime = [];

http.globalAgent.maxSockets = 1;

process.on('message', function(message) {
	var obj = JSON.parse(message);
	if (obj.type === "getReady") {
		serverAddr = obj.addr;
		serverPort = parseInt(obj.port);
		process.send(JSON.stringify({"type": "ready"}));
	}
	else if (obj.type === "go") {
		setTimeoutForNewPing();
	}
	else if (obj.type === "timeup") {
		broadcastEnded = true;
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
		var diff = Date.now() - parseInt(obj.time);
		responseTime.push(diff);
		//console.log(diff);
		if (!broadcastEnded) {
			setTimeoutForNewPing();
		} else {
			var avgs = calculateAvgResponseTime();
			process.send(JSON.stringify({
				"type": "done",
				"avgResponseTimeUnderChat": avgs
			}));
		}
	}
};

var calculateAvgResponseTime = function() {
	var avg = 0;
	for (var i = 0; i < responseTime.length; i++) {
		avg += responseTime[i];
	}
	avg = avg / responseTime.length;
	
	return avg;
};