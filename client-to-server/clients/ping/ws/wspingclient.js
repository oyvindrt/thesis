var WebSocket = require('ws');

var ws;
var chatStarted = false;
var interval;

var responseTime = [];

process.on('message', function(message) {
	var obj = JSON.parse(message);
	if (obj.type === "connectToServer") {
		ws = new WebSocket(obj.addr);
		TEST_DURATION = parseInt(obj.testDuration);
		
		ws.on('open', function() {
			process.send(JSON.stringify({"type": "connected"}));
		});

		ws.on('message', function(data) {
			var obj = JSON.parse(data);
			
			switch (obj.type) {
				case "chat":
					initiatePingProgram();
					break;
				case "pong":
					var diff = Date.now() - parseInt(obj.sent);
					responseTime.push(diff);
					//console.log(diff);
					break;
			}
		});
	} else if (obj.type === "timeup") {
		clearInterval(interval);
		ws.close();
		var avg = calculateAvgResponseTime();
		process.send(JSON.stringify({
			"type": "done",
			"avgResponseTimeUnderChat": avg
		}));
	}
});

var initiatePingProgram = function() {
	interval = setInterval(function() {
		if (ws.readyState === 1) {
			ws.send(JSON.stringify({"type": "ping", "sent": Date.now()}));
		}
	}, 50);
};

var calculateAvgResponseTime = function() {
	var avg = 0;
	for (var i = 0; i < responseTime.length; i++) {
		avg += responseTime[i];
	}
	avg = avg / responseTime.length;
	
	return avg;
};