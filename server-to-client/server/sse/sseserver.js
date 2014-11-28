var SSE = require('sse');
var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');
var multer = require('multer');
var procmon = require('process-monitor');
var WebSocket = require('ws');
var readline = require('readline');
var cp = require('child_process');

var MESSAGE_FREQUENCY = undefined;
var NUMBER_OF_MESSAGES = undefined;

var startedBroadcast = false;
var finished = false;

var clients = [ ];

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
		broadcast(obj);
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


/* ---------------------------------------------------
	SERVER
--------------------------------------------------- */

function SSEClient(req, res) {
	this.req = req;
	this.res = res;
}

var httpServer = express();

httpServer.get('/sse', function(req, res) {
	var obj = new SSEClient(req, res);
	clients.push(obj);
	req.socket.setTimeout(Infinity);
	
  	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive'
  	});
  	res.write('\n');

  	req.on("close", function() {
		for (var i = 0; i < clients.length; i++) {
			if (clients[i].req === req) {
				clients.splice(i, 1);
			}
		}
  	});
});

httpServer.get('/ping', function(req, res) {
	if (!startedBroadcast && !finished) {
		res.end(JSON.stringify({"type": "pong", "status": "before", "time": req.param('time')}));
	} else if (startedBroadcast && !finished) {
		res.end(JSON.stringify({"type": "pong", "status": "under", "time": req.param('time')}));
	} else if (finished) {
		res.end(JSON.stringify({"type": "pong", "status": "done"}));
	}
});

httpServer.listen(8000);

var broadcast = function(message) {
	var msgToBroadcast = JSON.stringify(message);
	for (var i = 0; i < clients.length; i++) {
		//doSend(clients[i], msgToBroadcast);
		clients[i].res.write("data: " + msgToBroadcast + "\n\n");
	}
}

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
