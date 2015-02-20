var WebSocket = require('ws');
var cp = require('child_process');

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
	testClientsResponseTimes: [],
	
	pingClient: undefined,
	pingClientState: STATE.NOT_FINISHED
};

console.log("Server address: ws://" + HOST + ':8000');
console.log("Number of clients: " + clients.count);


/* ---------------------------------------------------
	SERVER
--------------------------------------------------- */

var connectToServer = function() {
	server = new WebSocket("ws://" + HOST + ":8000", {protocol: "masterClient"});
	server.on('open', function() {
		server.send(JSON.stringify({
			"type": "info",
			"numberOfClients": clients.count
		}));
	});
	server.on('message', function(message) {
		var obj = JSON.parse(message);
		if (obj.type === 'info') {
			TEST_DURATION = parseInt(obj.testDuration);
			createPingClient();
		}
	});
	server.on('close', function() {
		console.log("Connection to the WS server is now closed");
	});
};


/* ---------------------------------------------------
	CLIENTS
--------------------------------------------------- */

var createClients = function() {
	for (var i = 0; i < clients.count; i++) {
		var client = cp.fork('./wsclient.js');
		clients.testClients.push(client);
		client.send(JSON.stringify({"type": "connectToServer", "addr": ("ws://" + HOST + ':8000'), "id": (i+1)}));
		
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
				
				clients.testClientsResponseTimes.push(obj.ping);
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
					calculateAndPrintAverageResponseTime();
					killAllClientProcesses();
				}
			}
		});
	}
};

var initiateChatPhase = function() {
	
	server.send(JSON.stringify({
		"type": "getReady",
		"startingIn": WAIT_TIME_BEFORE_CHAT
	}));
	server.close();
	
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
	var pingClient = cp.fork('./../ping/ws/wspingclient.js');
	clients.pingClient = pingClient;
	pingClient.send(JSON.stringify({"type": "connectToServer", "addr": ("ws://" + HOST + ':8000')}));
	
	pingClient.on('message', function(message) {
		var obj = JSON.parse(message);
		
		if (obj.type === 'connected') {
			console.log("Ping client connected to server");
			createClients();
		}
		else if (obj.type === 'done') {
			console.log("--------------------------------------------------------------------------------");
			console.log("Average response time under chat from ping client: " + obj.avgResponseTimeUnderChat.toFixed(2) + " ms");
			console.log("--------------------------------------------------------------------------------");
			
			pingClient.kill();
			clients.pingClientState = STATE.FINISHED;
			if (clients.testClientsState === STATE.FINISHED) {
				process.exit(0);
			}
		}
	});
};

var startTimer = function() {
	setTimeout(function() {
		informChildrenOfTimeup();
	}, TEST_DURATION+(WAIT_TIME_BEFORE_CHAT - 1000));
};

var informChildrenOfTimeup = function() {
	clients.pingClient.send(JSON.stringify({"type":"timeup"}));
	
	for (var i = 0; i < clients.testClients.length; i++) {
		clients.testClients[i].send(JSON.stringify({"type":"timeup"}));
	}
};

var calculateAndPrintAverageResponseTime = function() {
	var avg = 0;
	for (var i = 0; i < clients.testClientsResponseTimes.length; i++) {
		avg += clients.testClientsResponseTimes[i];
	}
	
	avg = avg / clients.testClientsResponseTimes.length;
	
	console.log("--------------------------------------------------------------------------------");
	console.log("Average response time under chat from all clients: " + avg.toFixed(2) + " ms");
	console.log("--------------------------------------------------------------------------------");
};

connectToServer();