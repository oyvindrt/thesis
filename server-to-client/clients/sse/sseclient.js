var EventSource = require('eventsource');

var ws;
var id;
var messagesReceived = 0;

process.on('message', function(message) {
	var obj = JSON.parse(message);
	if (obj.type === "connectToServer") {
		id = parseInt(obj.id);
		es = new EventSource(obj.uri);
		
		es.onopen = function() {
			process.send(JSON.stringify({"type": "connected"}));
		};

		es.onmessage = function(message) {
			var obj = JSON.parse(message.data);
			if (obj.type === "broadcast") {
				messagesReceived++;
			} else if (obj.type === "done") {
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
				es.close();
			}
		};
		
		es.onerror = function(e) {
			es.close();
		};
	}
});