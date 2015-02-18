var WebSocket = require('ws');

var ws;
var id;
var messagesReceived = 0;
var interval;


/* ---------------------------------------------------
	MOTHER PROCESS
--------------------------------------------------- */

process.on('message', function(message) {
	var obj = JSON.parse(message);
	if (obj.type === "connectToServer") {
		id = parseInt(obj.id);
		ws = new WebSocket(obj.addr, {protocol: "testClient"});
		setWsHandlers();
	}
	else if (obj.type === "go") {
		var timeBetweenEachMessage = obj.timeBetweenEachMessage;
		var timeBeforeChat = obj.timeBeforeChat;
		
		setTimeout(function() {
			
			interval = setInterval(function() {
				ws.send(JSON.stringify({
					"type": "chat",
					"payload": "Hello! How are you doing today?"
				}));
			}, timeBetweenEachMessage);
			
		}, id*timeBeforeChat);
		
	} else if (obj.type === "timeup") {
		clearInterval(interval);
		ws.send(JSON.stringify({
			"type": "timeup"
		}));
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
			//console.log("Mottatt melding: " + obj.payload);
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
					"gotAll": allRecv
				}));
			}, id*10);
		}
	});
};