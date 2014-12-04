var WebSocket = require('ws');

var ws;
var id;
var messagesReceived = 0;

process.on('message', function(message) {
	var obj = JSON.parse(message);
	if (obj.type === "connectToServer") {
		id = parseInt(obj.id);
		ws = new WebSocket(obj.addr);
		ws.on('open', function() {
			process.send(JSON.stringify({"type": "connected"}));
		});
		
		ws.on('message', function(data) {
			var obj = JSON.parse(data);
			if (obj.type === "broadcast") {
				messagesReceived++;
			}
		});
		
		ws.on('close', function(code, reason) {
			ws = null;
			var obj = JSON.parse(reason);
			var shouldHaveReceived = parseInt(obj.shouldHaveReceived);
			var allRecv = false;
			if (messagesReceived === shouldHaveReceived) {
				allRecv = true;
			}
			setTimeout(function() {
				process.send(JSON.stringify({
					"type": "done",
					"gotAll": allRecv
				}));
			}, id*10);
		});
	}
});