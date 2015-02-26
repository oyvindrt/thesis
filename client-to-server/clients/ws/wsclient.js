var WebSocket = require('ws');

var ws;
var id;
var messagesReceived = 0;
var interval;

var responseTimes = [ ];


/* ---------------------------------------------------
	MOTHER PROCESS
--------------------------------------------------- */

process.on('message', function(message) {
	var obj = JSON.parse(message);
	if (obj.type === "connectToServer") {
		id = parseInt(obj.id);
		ws = new WebSocket(obj.addr);
		setWsHandlers();
	}
	else if (obj.type === "go") {
		var timeBetweenEachMessage = obj.timeBetweenEachMessage;
		var timeBeforeChat = obj.timeBeforeChat;
		
		setTimeout(function() {
			
			interval = setInterval(function() {
				ws.send(JSON.stringify({
					"type": "chat",
					"from": id,
					"sent": Date.now(),
					"payload": "Hello! How are you doing today?"
				}));
			}, timeBetweenEachMessage);
			
		}, id*timeBeforeChat);
		
	} else if (obj.type === "timeup") {
		clearInterval(interval);
		ws.send(JSON.stringify({
			"type": "timeup"
		}), function ack(error) {
			
		});
	}
});


/* ---------------------------------------------------
	CONNECTION TO SERVER
--------------------------------------------------- */

var setWsHandlers = function () {
	ws.on('open', function() {
		process.send(JSON.stringify({"type": "connected"}));
	});
	
	ws.on('message', function(message) {
		var obj = JSON.parse(message);
		if (obj.type === 'chat') {
			messagesReceived++;
			var diff = Date.now() - parseInt(obj.sent);
			responseTimes.push(diff);
			//if (id === 1) {
			//	console.log("My id is 1 and I just received a message. Ping is: " + diff);
			//}
		}
		else if (obj.type === "done") {
			ws.close();
			var allRecv = false;
			var shouldHaveReceived = parseInt(obj.shouldHaveReceived);
			if (messagesReceived === shouldHaveReceived) {
				allRecv = true;
			}
			setTimeout(function() {
				process.send(JSON.stringify({
					"type": "done",
					"gotAll": allRecv,
					"ping": {
						"avg": calculateAvgResponseTime(),
						"median": calculateMedianResponseTime()
					}
				}));
			}, id*10);
		}
	});
};


/* ---------------------------------------------------
	RESPONSE TIME CALCULATION
--------------------------------------------------- */

var calculateAvgResponseTime = function() {
	var avg = 0;
	for (var i = 0; i < responseTimes.length; i++) {
		avg += responseTimes[i];
	}
	avg = avg / responseTimes.length;
	
	return avg;
};

var calculateMedianResponseTime = function() {
	var median;
	responseTimes.sort(function(a, b){
		return a - b;
	});
	if (responseTimes.length % 2 === 0) {
		median = ((responseTimes[responseTimes.length/2] + responseTimes[(responseTimes.length/2)-1])/2);
	} else {
		median = responseTimes[(responseTimes.length+1) / 2];
	}
	return median;
};
