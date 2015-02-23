var express = require('express');
var bodyParser = require('body-parser');
var multer = require('multer'); 

var readline = require('readline');
var cp = require('child_process');

var args = process.argv.slice(2);

var TEST_DURATION = args[0] * 1000;

var messageCount = 0;

var STATE = {
	NOT_STARTED: 0,
	STARTED: 1,
	SHUTTING_DOWN: 2,
	FINISHED: 3
};

var clients = {
	count: undefined,
	connections: [],
	state: STATE.NOT_STARTED
};

var monitor;
var monitorState = STATE.NOT_STARTED;

var rl = readline.createInterface({ input: process.stdin, output: process.stdout});


/* ---------------------------------------------------
	SERVER
--------------------------------------------------- */

function SSEClient(req, res) {
	this.req = req;
	this.res = res;
}

var httpServer = express();

httpServer.use(bodyParser.json()); 							// for parsing application/json
httpServer.use(bodyParser.urlencoded({ extended: true }));	// for parsing application/x-www-form-urlencoded
httpServer.use(multer());									// for parsing multipart/form-data

// INFO FROM MASTER CLIENT
httpServer.post('/info', function(req, res) {
	var obj = req.body;
	if (obj.type === 'info') {
		clients.count = parseInt(obj.numberOfClients);
		res.json({"type":"info", "testDuration":TEST_DURATION});
	}
	else if (obj.type === 'getReady') {
		console.log("Get ready! Chat phase starting in " + (obj.startingIn/1000) + " seconds...");
		readyMonitor();
		res.json();
	}
	else if (obj.type === 'finished') {
		clients.state = STATE.FINISHED;
		if (monitorState = STATE.FINISHED) {
			process.exit();
		}
	}
});

// SERVER SENT EVENTS
httpServer.get('/sse', function(req, res) {
	var obj = new SSEClient(req, res);
	clients.connections.push(obj);
	req.socket.setTimeout(Infinity);
	
  	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive'
  	});
  	res.write('\n');

  	req.on("close", function() {
		for (var i = 0; i < clients.connections.length; i++) {
			if (clients.connections[i].req === req) {
				clients.connections.splice(i, 1);
				if (clients.connections.length === 0) {
					console.log("All connected clients disconnected");
					if (monitorState === STATE.FINISHED) {
						exitInThreeSeconds();
					}
				}
			}
		}
  	});
});

// INCOMING CHAT MESSAGES
httpServer.post('/chat', function (req, res) {
	var obj = req.body;
	
	if (obj.type === "chat") {
		if (clients.state === STATE.NOT_STARTED) {
			clients.state = STATE.STARTED;
			monitor.send(JSON.stringify({"type": "chatStarting"}));
			monitorState = STATE.STARTED;
			console.log("Chat is live for " + (TEST_DURATION/1000) + " seconds...");
		}
		if (clients.state === STATE.STARTED) {
			messageCount++;
			broadcast(obj);
		}
	}
	else if (obj.type === "timeup") {
		if (clients.state !== STATE.SHUTTING_DOWN) {
			clients.state = STATE.SHUTTING_DOWN;
			monitor.send(JSON.stringify({"type":"done"}));
			console.log("Server received timeup from clients");
			broadcast({"type": "done", "shouldHaveReceived": messageCount});
		}
	}
	res.json();
});

httpServer.listen(8000, function() {
	console.log("HTTP server started and listening on port 8000");
});

var broadcast = function(message) {
	var msgToBroadcast = JSON.stringify(message);
	for (var i = 0; i < clients.connections.length; i++) {
		clients.connections[i].res.write("data: " + msgToBroadcast + "\n\n");
	}
}

/* ---------------------------------------------------
	MONITOR
--------------------------------------------------- */

var readyMonitor = function() {
	monitor = cp.fork('../../monitor/monitor');
	monitor.send(JSON.stringify({"type": "startMonitor", "pid": process.pid, "testDuration": TEST_DURATION}));
	
	monitor.on('message', function(message) {
		var obj = JSON.parse(message);
		if (obj.type === 'stats') {
			// Time to close test client connections.
			monitor.kill();
			monitorState = STATE.FINISHED;
			console.log("Chat finished");
			console.log("--------------------------------------------------------------------------------");
			console.log("CPU load under chat: " + obj.cpuAvgUnderChat.toFixed(2) + " %");
			console.log("--------------------------------------------------------------------------------");
			if (clients.state === STATE.FINISHED) {
				process.exit(0);
			}
		}
	});
};