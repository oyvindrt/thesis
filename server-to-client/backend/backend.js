var WebSocketServer = require('ws').Server;

var PORT = process.env.PORT || 9000;

var wss = new WebSocketServer({port: PORT});

var READY_TIME = 3000;
var MESSAGE_FREQUENCY = undefined;
var NUMBER_OF_MESSAGES = undefined;

var interval;

var TYPICAL_MESSAGE = JSON.stringify({
	"type": 	"broadcast",
	"payload": 	"This is a tweet. This is a tweet. This is a tweet. This is a tweet. This is a tweet. " +
				"This is a tweet. This is a tweet. This is a tweet......"
});

console.log("Size: " + TYPICAL_MESSAGE.length);

wss.on('connection', function(ws) {
	console.log("A new connection");
	
	ws.send(JSON.stringify({
		"type": "info"
	}));
	
	ws.on('message', function(message) {
		var obj = JSON.parse(message);
		if (obj.type === 'info') {
			MESSAGE_FREQUENCY = parseInt(obj.freq);
			NUMBER_OF_MESSAGES = parseInt(obj.num);
			sendReadyMsg(ws);
			console.log("Ready for broadcast");
		} else if (obj.type === 'go') {
			startSending(ws);
		}
	});
	
	ws.on('close', function(reason) {
		console.log("A connection has terminated");
	});
});

var sendReadyMsg = function(ws) {
	ws.send(JSON.stringify({
			"type": "backendReady",
	}));
};

var startSending = function(ws) {
	console.log("Initiating broadcast");
	ws.send(JSON.stringify({
			"type": "getReady",
			"wait": READY_TIME
	}));
	
	setTimeout(function() {
		interval = setInterval(function() {
			if (NUMBER_OF_MESSAGES > 0) {
				ws.send(TYPICAL_MESSAGE);
				NUMBER_OF_MESSAGES--;
			} else {
				clearInterval(interval);
				ws.send(JSON.stringify({"type": "done"}));
				console.log("Broadcast finished");
			}

		}, MESSAGE_FREQUENCY);
	}, READY_TIME);
};