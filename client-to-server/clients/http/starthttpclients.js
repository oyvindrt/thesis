var cp = require('child_process');
var request = require('request');

var args = process.argv.slice(2);

var HOST = args[0];

var WAIT_TIME_BEFORE_CHAT = 3000;
var TIME_BETWEEN_EACH_MESSAGE = 1000;

var TEST_DURATION;

var server;

var clients = {
	count: parseInt(args[1]),
	
	clients: [ ],
	clientsStarted: 0,
	clientsFinished: 0,
	clientsNotReceivedAllMessages: 0,
	clientResponseTimes: []
};

console.log("Server address: http://" + HOST + ':8000/poll');
console.log("Number of clients: " + clients.count);


/* ---------------------------------------------------
	SERVER
--------------------------------------------------- */

var exhangeInfoWithServer = function() {
	var httpOptions = {
		uri: ('http://' + HOST + ':8000/info'),
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Connection': 'close'},
		form: {"type": "info", "numberOfClients": clients.count}
	};
	
	request(httpOptions, function(error, response, body) {
		if (!error && response.statusCode === 200) {
			var obj = JSON.parse(body);
			TEST_DURATION = parseInt(obj.testDuration);
			createClients();
		}
	});
};

var sendGetReadyToServer = function() {
	var httpOptions = {
		uri: ('http://' + HOST + ':8000/info'),
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Connection': 'close'},
		form: {"type": "getReady", "startingIn": WAIT_TIME_BEFORE_CHAT}
	};
	
	request(httpOptions, function(error, response, body) {
		if (!error && response.statusCode === 200) {
			// Success
		}
	});
};

var sendFinishedMessageToServerAndExit = function() {
	var httpOptions = {
		uri: ('http://' + HOST + ':8000/info'),
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Connection': 'close'},
		form: {"type": "finished"}
	};
	
	request(httpOptions, function(error, response, body) {
		if (!error && response.statusCode === 200) {
			// Finished message sent to the server. It's now safe to shut down.
			process.exit(0);
		}
	});
};


/* ---------------------------------------------------
	CLIENTS
--------------------------------------------------- */

var createClients = function() {
	for (var i = 0; i < clients.count; i++) {
		var client = cp.fork('./httpclient.js');
		clients.clients.push(client);
		client.send(JSON.stringify({"type": "startPoll", "host": HOST, "port": 8000, "id": (i+1)}));
		
		client.on('message', function(message) {
			var obj = JSON.parse(message);
			
			if (obj.type === 'pollingStarted') {
				clients.clientsStarted++;
				if (clients.clientsStarted === clients.count) {
					console.log("All clients are now polling the server");
					initiateChatPhase();
				}
			}
			else if (obj.type === 'done') {
				clients.clientResponseTimes.push(obj.ping);
				if (obj.gotAll === false) {
					clients.clientsNotReceivedAllMessages++;
					console.log("A client did not receive all messages from the server");
				}
				
				clients.clientsFinished++;
				
				if (clients.clientsFinished === clients.count) {
					if (clients.clientsNotReceivedAllMessages === 0) {
						console.log("All clients received all messages");
					}
					else {
						console.log(clients.clientsNotReceivedAllMessages + " clients did not receive all messages");
					}
					calculateAndPrintAverageResponseTime();
					killAllClientProcesses();
				}
			}
		});
	}
};

var initiateChatPhase = function() {
	
	sendGetReadyToServer();
	
	var timeBeforeClientStartsChatting = TIME_BETWEEN_EACH_MESSAGE / clients.count;
	
	startTimer();
	
	setTimeout(function() {
		for (var i = 0; i < clients.clients.length; i++) {
			clients.clients[i].send(JSON.stringify({
				"type": "go",
				"timeBetweenEachMessage": TIME_BETWEEN_EACH_MESSAGE,
				"timeBeforeChat": timeBeforeClientStartsChatting
			}));
		}
	}, WAIT_TIME_BEFORE_CHAT);
};

/* ---------------------------------------------------
	MISC
--------------------------------------------------- */

var startTimer = function() {
	setTimeout(function() {
		informChildrenOfTimeup();
	}, TEST_DURATION+WAIT_TIME_BEFORE_CHAT);
};

var informChildrenOfTimeup = function() {
	for (var i = 0; i < clients.clients.length; i++) {
		clients.clients[i].send(JSON.stringify({"type":"timeup"}));
	}
};

var calculateAndPrintAverageResponseTime = function() {
	var avg = 0;
	for (var i = 0; i < clients.clientResponseTimes.length; i++) {
		avg += clients.clientResponseTimes[i];
	}
	
	avg = avg / clients.clientResponseTimes.length;
	
	console.log("--------------------------------------------------------------------------------");
	console.log("Average response time under chat from all clients: " + avg.toFixed(2) + " ms");
	console.log("--------------------------------------------------------------------------------");
};

var killAllClientProcesses = function() {
	for (var i = 0; i < clients.clients.length; i++) {
		clients.clients[i].kill();
	}
	console.log("All clients killed");
	sendFinishedMessageToServerAndExit();
};

// Entry point
exhangeInfoWithServer();