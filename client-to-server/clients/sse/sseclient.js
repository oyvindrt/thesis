var EventSource = require('eventsource');
var request = require('request');

var es;
var id;
var messagesReceived = 0;
var interval;
var serverAddr;

var responseTimes = [ ];

/* ---------------------------------------------------
	MOTHER PROCESS
--------------------------------------------------- */

process.on('message', function(message) {
	var obj = JSON.parse(message);
	if (obj.type === "connectToServer") {
		id = parseInt(obj.id);
		serverAddr = obj.addr;
		es = new EventSource(serverAddr + "/sse");
		setEsHandlers();
	}
	else if (obj.type === "go") {
		var timeBetweenEachMessage = obj.timeBetweenEachMessage;
		var timeBeforeChat = obj.timeBeforeChat;
		
		setTimeout(function() {
			
			interval = setInterval(function() {
				sendChatMessage();
			}, timeBetweenEachMessage);
			
		}, id*timeBeforeChat);
		
	}
	else if (obj.type === "timeup") {
		clearInterval(interval);
		sendTimeupMessage();
	}
});

/* ---------------------------------------------------
	SERVER SENT EVENTS
--------------------------------------------------- */

var setEsHandlers = function() {
	es.onopen = function() {
		process.send(JSON.stringify({"type": "connected"}));
	};

	es.onmessage = function(message) {
		var obj = JSON.parse(message.data);
		if (obj.type === "chat") {
			messagesReceived++;
			
			var diff = Date.now() - parseInt(obj.sent);
			//console.log(id + ": received my own message. Ping: " + diff);
			responseTimes.push(diff);
			
			//console.log("Mottatt melding: " + obj.payload);
		} else if (obj.type === "done") {
			var allRecv = false;
			var shouldHaveReceived = parseInt(obj.shouldHaveReceived);
			if (messagesReceived === shouldHaveReceived) {
				allRecv = true;
			}
			setTimeout(function() {
				process.send(JSON.stringify({
					"type": "done",
					"gotAll": allRecv,
					"ping": calculateAvgResponseTime()
				}));
			}, id*10);
			es.close();
		}
	};
	
	es.onerror = function(e) {
		es.close();
	};
};



/* ---------------------------------------------------
	CHAT MESSAGES TO SERVER
--------------------------------------------------- */

var sendChatMessage = function() {
	var httpOptions = {
		uri: (serverAddr + '/chat'),
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Connection': 'keep-alive'},
		form: {
			"type": "chat",
			"from": id,
			"sent": Date.now(),
			"payload": "Hello! How are you doing today?"
		}
	};
	
	request(httpOptions, function(error, response, body) {
		if (!error && response.statusCode === 200) {
			// SUCCESS
		} else if (error) {
			//console.log(error);
		}
	});
};

var sendTimeupMessage = function() {
	var httpOptions = {
		uri: (serverAddr + '/chat'),
		method: 'POST',
		headers: {'Content-Type': 'application/json', 'Connection': 'close'},
		form: {'type': 'timeup'}
	};
	
	request(httpOptions, function(error, response, body) {
		if (!error && response.statusCode === 200) {
			// SUCCESS
		} else if (error) {
			//console.log(error);
		}
	});
};

var calculateAvgResponseTime = function() {
	var avg = 0;
	for (var i = 0; i < responseTimes.length; i++) {
		avg += responseTimes[i];
	}
	avg = avg / responseTimes.length;
	
	return avg;
};
