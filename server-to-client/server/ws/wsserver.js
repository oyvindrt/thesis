var WebSocket = require('ws');
var WebSocketServer = require('ws').Server;
var readline = require('readline');
var procmon = require('process-monitor');
var cp = require('child_process');

var BACKEND_ADDR = process.env.BACKEND_ADDR || "localhost";
var BACKEND_PORT = process.env.BACKEND_PORT || 9000;
var PORT = process.env.PORT || 8000;

var MESSAGE_FREQUENCY = undefined;
var NUMBER_OF_MESSAGES = undefined;

var startedBroadcast = false;
var finished = false;

var wss = new WebSocketServer({port: PORT});
var backend = new WebSocket('ws://' + BACKEND_ADDR + ':' + BACKEND_PORT);
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
			"shouldHaveReceived": NUMBER_OF_MESSAGES
		});
		for (var i = 0; i < wss.clients.length; i++) {
			wss.clients[i].close(1000, reasonObj);
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
		});
	});
};


/* ---------------------------------------------------
	SERVER
--------------------------------------------------- */

wss.on('connection', function(ws){
	
	ws.on('message', function(message) {
		var obj = JSON.parse(message);
		if (obj.type === 'ping') {
			ws.send(JSON.stringify({"type":"pong", "sent": obj.sent}));
		}
	});

	ws.on('close', function(reason) {
		if (wss.clients.length === 0) {
			//console.log("All connected clients disconnected");
		}
	});
});

var broadcast = function(message) {
	var msgToBroadcast = JSON.stringify(message);
	for (var i = 0; i < wss.clients.length; i++) {
		wss.clients[i].send(msgToBroadcast);
	}
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
