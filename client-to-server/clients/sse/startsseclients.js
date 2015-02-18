var cp = require('child_process');
var request = require('request');

var args = process.argv.slice(2);

var HOST = args[0];

var STATE = {
	NOT_FINISHED: 0,
	FINISHED: 1
};

var WAIT_TIME_BEFORE_CHAT = 3000;
var TIME_BETWEEN_EACH_MESSAGE = 1000;

var TEST_DURATION;

var server;

var clients = {
	count: parseInt(args[1]),
	
	testClients: [ ],
	testClientsConnected: 0,
	testClientsFinished: 0,
	testClientsState: STATE.NOT_FINISHED,
	testClientsNotReceivedAllMessages: 0,
	
	pingClient: undefined,
	pingClientState: STATE.NOT_FINISHED
};

console.log("Server address: http://" + HOST + ':8000');
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
			createPingClient();
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


/* ---------------------------------------------------
	CLIENTS
--------------------------------------------------- */

var createClients = function() {
	for (var i = 0; i < clients.count; i++) {
		var client = cp.fork('./sseclient.js');
		clients.testClients.push(client);
		client.send(JSON.stringify({"type": "connectToServer", "addr": ("http://" + HOST + ':8000'), "id": (i+1)}));
		
		client.on('message', function(message) {
			var obj = JSON.parse(message);
			
			if (obj.type === 'connected') {
				clients.testClientsConnected++;
				if (clients.testClientsConnected === clients.count) {
					console.log("All clients are connected to the server");
					// INFORM THE SERVER THAT BROADCAST IS ABOUT TO BEGIN
					initiateChatPhase();
				}
			}
			else if (obj.type === 'done') {
				if (obj.gotAll === false) {
					clients.testClientsNotReceivedAllMessages++;
					console.log("A client did not receive all messages from the server");
				}
				
				clients.testClientsFinished++;
				
				if (clients.testClientsFinished === clients.count) {
					if (clients.testClientsNotReceivedAllMessages === 0) {
						console.log("All clients received all messages");
					}
					else {
						console.log(clients.testClientsNotReceivedAllMessages + " clients did not receive all messages");
					}
					killAllClientProcesses();
				}
			}
		});
	}
};

var initiateChatPhase = function() {
	
	sendGetReadyToServer();
	
	var timeBeforeClientStartsChatting = 1000 / clients.count;
	
	startTimer();
	
	setTimeout(function() {
		for (var i = 0; i < clients.testClients.length; i++) {
			clients.testClients[i].send(JSON.stringify({
				"type": "go",
				"timeBetweenEachMessage": TIME_BETWEEN_EACH_MESSAGE,
				"timeBeforeChat": timeBeforeClientStartsChatting
			}));
		}
		clients.pingClient.send(JSON.stringify({"type": "go"}));
	}, WAIT_TIME_BEFORE_CHAT);
};

var killAllClientProcesses = function() {
	for (var i = 0; i < clients.testClients.length; i++) {
		clients.testClients[i].kill();
	}
	console.log("All clients killed");
	clients.testClientsState = STATE.FINISHED;
	if (clients.pingClientState === STATE.FINISHED) {
		process.exit(0);
	}
};


/* ---------------------------------------------------
	PING CLIENT
--------------------------------------------------- */

var createPingClient = function() {
	var pingClient = cp.fork('./../ping/http/httppingclient.js');
	clients.pingClient = pingClient;
	pingClient.send(JSON.stringify({"type": "getReady", "addr": HOST, "port": 8000}));
	
	pingClient.on('message', function(message) {
		var obj = JSON.parse(message);
		
		if (obj.type === 'ready') {
			console.log("Ping client ready");
			createClients();
		}
		else if (obj.type === 'done') {
			console.log("--------------------------------------------------------------------------------");
			console.log("Average response time under chat: " + obj.avgResponseTimeUnderChat.toFixed(2) + " ms");
			console.log("--------------------------------------------------------------------------------");
			
			pingClient.kill();
			clients.pingClientState = STATE.FINISHED;
			
			if (clients.testClientsState === STATE.FINISHED) {
				process.exit(0);
			}
		}
	});
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
	clients.pingClient.send(JSON.stringify({"type":"timeup"}));
	
	for (var i = 0; i < clients.testClients.length; i++) {
		clients.testClients[i].send(JSON.stringify({"type":"timeup"}));
	}
};


// Entry point
exhangeInfoWithServer();