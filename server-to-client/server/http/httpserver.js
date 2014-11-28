//var http = require('http');
var express = require('express');
var procmon = require('process-monitor');
var WebSocket = require('ws');
var readline = require('readline');
var url = require('url');
var cp = require('child_process');

var MESSAGE_FREQUENCY = undefined;
var NUMBER_OF_MESSAGES = undefined;

var messagesSent = 0;
var startedBroadcast = false;
var finished = false;

var messages = [ ];
var defers = [ ];

var backend = new WebSocket('ws://localhost:9000');
var rl = readline.createInterface({ input: process.stdin, output: process.stdout});
var monitor = undefined;


/* ---------------------------------------------------
	BACKEND
--------------------------------------------------- */

backend.on('open', function() {
	console.log("Connected to backend");
});

backend.on('close', function() {
	backend = null;
});

backend.on('message', function(message) {
	var obj = JSON.parse(message);

	if (obj.type === "info") {
		getInfoAndSendToBackend();
	} else if (obj.type === "backendReady") {
		console.log("Backend ready");
		startMonitor();
		rl.question("Press enter to start test", function() {
			backend.send(JSON.stringify({"type": "go"}));
		});
	} else if (obj.type === "getReady") {
		var waittime = parseInt(obj.wait);
		console.log("Starting in " + waittime + " ms...");
	} else if (obj.type === "broadcast") {
		
		if (!startedBroadcast) {
			console.log("Starting broadcast!");
			startedBroadcast = true;
			monitor.send(JSON.stringify({"type": "broadcastStarting"}));
		}
		//broadcast(obj);
		
		/* OLD
		if (!startedBroadcast) {
			console.log("Starting broadcast!");
			startedBroadcast = true;
		}
		messages.push(obj);
		sendToAllDefers();
		*/
	} else if (obj.type === "done") {
		
		finished = true;
		var reasonObj = JSON.stringify({
			"type": "done",
			"shouldHaveReceived": NUMBER_OF_MESSAGES
		});
		for (var i = 0; i < clients.length; i++) {
			clients[i].res.end("data: " + reasonObj + "\n\n");
		}
		monitor.send(JSON.stringify({"type": "broadcastEnded"}));
		console.log("Connection to all clients closed. Benchmark finished.");
		*/
		
		/* OLD
		messages.push(obj);
		sendToAllDefers();
		console.log("Broadcast from backend is over.");
		finished = true;
		*/
		
		console.log("ENDED");
	}
});

var getInfoAndSendToBackend = function() {
	rl.question("How many messages? ", function(numMessages) {
		rl.question("How often (in milliseconds)? ", function(msgFreq) {
			MESSAGE_FREQUENCY = msgFreq;
			NUMBER_OF_MESSAGES = numMessages;
			if (MESSAGE_FREQUENCY > 0 && NUMBER_OF_MESSAGES > 0) {
				backend.send(JSON.stringify({
					"type": "info",
					"freq": MESSAGE_FREQUENCY,
					"num": NUMBER_OF_MESSAGES
				}));
			}
		})
	});
};


var httpServer = express();

httpServer.get('/poll', function(req, res) {
	var next = parseInt(req.query.next) || 0;
	res.contentType('application/json');
	//res.set('Connection', 'Keep-Alive');
	if ((messages.length-1) > next) {
		var newMessages = getAllMessagesFrom(next);
		res.send(JSON.stringify({
			"messages": newMessages
		}));
	} else {
		// DEFER
		defers.push({"next": next, "res": res});
	}
});

httpServer.listen(8000);

var sendToAllDefers = function() {
	for (var i = 0; i < defers.length; i++) {
		var newMessages = getAllMessagesFrom(defers[i].next);
		defers[i].res.send(JSON.stringify({
			"messages": newMessages
		}));
	}
	defers = [ ];
};

var getAllMessagesFrom = function(next) {
	var msgArr = [ ];
	for (var i = next; i < messages.length; i++) {
		msgArr.push(messages[i]);
	}
	return msgArr;
};


/* ---------------------------------------------------
	MONITOR
--------------------------------------------------- */

var startMonitor = function() {
	monitor = cp.fork('../../monitor/monitor');
	monitor.send(JSON.stringify({"type": "startMonitor", "pid": process.pid}));

	monitor.on('message', function(message) {
		var obj = JSON.parse(message);
		if (obj.type === 'stats') {
			console.log("--------------------------------------------------------------------------------");
			console.log("Average CPU load before broadcast: " + obj.before.cpuAvg.toFixed(2) + " %");
			console.log("Average memory usage before broadcast: " + obj.before.memAvg.toFixed(2) + " bytes");
			console.log("--------------------------------------------------------------------------------");
			console.log("Average CPU load under broadcast: " + obj.under.cpuAvg.toFixed(2) + " %");
			console.log("Average memory usage under broadcast: " + obj.under.memAvg.toFixed(2) + " bytes");
			console.log("--------------------------------------------------------------------------------");
			monitor.kill();
			process.exit(code=0);
		}
	});
};

