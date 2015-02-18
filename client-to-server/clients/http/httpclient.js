var http = require('http');
var request = require('request');

var id;
var done = false;
var messagesReceived = 0;
var interval;
var serverAddr;
var httpRequestOptions = { };

/* ---------------------------------------------------
	MOTHER PROCESS
--------------------------------------------------- */

process.on('message', function(message) {
	var obj = JSON.parse(message);
	if (obj.type === "startPoll") {
		id = parseInt(obj.id);
		serverAddr = "http://" + obj.host + ":" + obj.port;
		
		var httpAgent = new http.Agent();
		
		httpAgent.maxSockets = 1;		
		httpRequestOptions.host = obj.host;
		httpRequestOptions.port = obj.port;
		httpRequestOptions.agent = httpAgent;
		
		poll();
		process.send(JSON.stringify({"type": "pollingStarted"}));
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
	POLLING
--------------------------------------------------- */

var poll = function() {
	httpRequestOptions.path = ('/poll?next=' + messagesReceived);

	var data = "";

	http.get(httpRequestOptions, function(response) {
	    response.on('data', function(chunk) {
	        data += chunk;
	    });

	    response.on('end', function() {
	        handleResponse(null, data);
	    });

	    response.on('error', function(error) {
	        handleResponse(e);
	    });
	});
};

var handleResponse = function(error, data) {
    if (error) {
        console.log(error);
    } else {
        var obj = JSON.parse(data);
		if (obj.messages) {
			var arr = obj.messages;
			for (var i = 0; i < arr.length; i++) {
				if (arr[i].type === "chat") {
					messagesReceived++;
				} else if (arr[i].type === "done") {
					done = true;
					var allRecv = false;
					var shouldHaveReceived = parseInt(arr[i].shouldHaveReceived);
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
			}
			if (!done) {
				poll();
			}
		}
    }
};


/* ---------------------------------------------------
	CHAT MESSAGES TO SERVER
--------------------------------------------------- */

var sendChatMessage = function() {
	/*
	if (id === 1) {
		console.log("Client number 1 sends a message");
	} else if (id === 50) {
		console.log("Client number 50 sends a message");
	}
	*/
	var httpOptions = {
		uri: (serverAddr + '/chat'),
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Connection': 'keep-alive'},
		form: {"type": "chat", "payload": "Hello! How are you doing today?"}
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
