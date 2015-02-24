var WebSocket = require('ws');
var cp = require('child_process');

var args = process.argv.slice(2);

var HOST = args[0];

var WAIT_TIME_BEFORE_CHAT = 3000;
var TIME_BETWEEN_EACH_MESSAGE = 1000;

var TEST_DURATION;

var server;

var clients = {
	count: parseInt(args[1]),
	
	clients: [ ],
	clientsConnected: 0,
	clientsFinished: 0,
	clientsNotReceivedAllMessages: 0,
	clientResponseTimes: {
		avg: [],
		median: []
	}
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
			createClients();
		}
	});
	server.on('close', function() {
		//console.log("Connection to the WS server is now closed");
	});
};


/* ---------------------------------------------------
	CLIENTS
--------------------------------------------------- */

var createClients = function() {
	for (var i = 0; i < clients.count; i++) {
		var client = cp.fork('./wsclient.js');
		clients.clients.push(client);
		client.send(JSON.stringify({"type": "connectToServer", "addr": ("ws://" + HOST + ':8000'), "id": (i+1)}));
		
		client.on('message', function(message) {
			var obj = JSON.parse(message);
			
			if (obj.type === 'connected') {
				clients.clientsConnected++;
				if (clients.clientsConnected === clients.count) {
					console.log("All clients are connected to the server");
					initiateChatPhase();
				}
			}
			else if (obj.type === 'done') {
				clients.clientResponseTimes.avg.push(obj.ping.avg);
				clients.clientResponseTimes.median.push(obj.ping.median);
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
					calculateAndPrintResponseTime();
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
		for (var i = 0; i < clients.clients.length; i++) {
			clients.clients[i].send(JSON.stringify({
				"type": "go",
				"timeBetweenEachMessage": TIME_BETWEEN_EACH_MESSAGE,
				"timeBeforeChat": timeBeforeClientStartsChatting
			}));
		}
	}, WAIT_TIME_BEFORE_CHAT);
};

var killAllClientProcesses = function() {
	for (var i = 0; i < clients.clients.length; i++) {
		clients.clients[i].kill();
	}
	console.log("All clients killed");
	process.exit(0);
};

var startTimer = function() {
	setTimeout(function() {
		informChildrenOfTimeup();
	}, TEST_DURATION+(WAIT_TIME_BEFORE_CHAT - 1000));
};

var informChildrenOfTimeup = function() {
	for (var i = 0; i < clients.clients.length; i++) {
		clients.clients[i].send(JSON.stringify({"type":"timeup"}));
	}
};

var calculateAndPrintResponseTime = function() {
	var avg = 0;
	var median;
	
	for (var i = 0; i < clients.clientResponseTimes.avg.length; i++) {
		avg += clients.clientResponseTimes.avg[i];
	}
	avg = avg / clients.clientResponseTimes.avg.length;
	
	clients.clientResponseTimes.median.sort(function(a, b){
		return a - b;
	});
	
	if (clients.clientResponseTimes.median.length % 2 === 0) {
		median = ((clients.clientResponseTimes.median[clients.clientResponseTimes.median.length/2] + clients.clientResponseTimes.median[(clients.clientResponseTimes.median.length/2)-1])/2);
	} else {
		median = clients.clientResponseTimes.median[(clients.clientResponseTimes.median.length+1) / 2];
	}
	
	console.log("--------------------------------------------------------------------------------");
	console.log("Average response time of all client average response times: " + avg.toFixed(2) + " ms");
	console.log("--------------------------------------------------------------------------------");
	console.log("Median response time of all client median response times: " + median.toFixed(2) + " ms");
	console.log("--------------------------------------------------------------------------------");
};

connectToServer();