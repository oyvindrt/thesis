var WebSocket = require('ws');
var WebSocketServer = require('ws').Server;
var readline = require('readline');
var cp = require('child_process');

var args = process.argv.slice(2);

var HOST = args[0];
var PORT = args[1];

var MESSAGE_FREQUENCY;
var NUMBER_OF_MESSAGES;

var STATE = {
	NOT_STARTED: 0,
	STARTED: 1,
	FINISHED: 2
};

var clients = {
	clientsState: STATE.NOT_STARTED,
	monitorClientState: STATE.NOT_STARTED
};


var wss = new WebSocketServer({port: 8000});
var backend = new WebSocket('ws://' + HOST + ':' + PORT);
var rl = readline.createInterface({ input: process.stdin, output: process.stdout});
var monitor;

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
	}
	else if (obj.type === "backendReady") {
		console.log("Backend ready");
		startMonitor();
		rl.question("Press enter to start test", function() {
			backend.send(JSON.stringify({"type": "go"}));
		});
	}
	else if (obj.type === "getReady") {
		var waittime = parseInt(obj.wait);
		console.log("Starting in " + waittime + " ms...");
	}
	else if (obj.type === "broadcast") {
		
		if (clients.clientsState === STATE.NOT_STARTED) {
			clients.clientsState = STATE.STARTED;
			console.log("Starting broadcast!");
			monitor.send(JSON.stringify({"type": "broadcastStarting"}));
			clients.monitorClientState = STATE.STARTED;
		}
		broadcast(obj);
	}
	else if (obj.type === "done") {
		var reasonObj = JSON.stringify({
			"shouldHaveReceived": NUMBER_OF_MESSAGES
		});
		for (var i = 0; i < wss.clients.length; i++) {
			wss.clients[i].close(1000, reasonObj);
		}
		clients.clientsState = STATE.FINISHED;
		monitor.send(JSON.stringify({"type": "broadcastEnded"}));
		console.log("Connection to all clients closed. Broadcast is over.");
		if (clients.monitorClientState === STATE.FINISHED) {
			process.exit(0);
		}
		
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
			console.log("Average memory usage before broadcast: " + obj.before.memAvg.toFixed(2) + " KB (" + (obj.before.memAvg/1000).toFixed(2) + " MB)");
			console.log("--------------------------------------------------------------------------------");
			console.log("Average CPU load under broadcast: " + obj.under.cpuAvg.toFixed(2) + " %");
			console.log("Average memory usage under broadcast: " + obj.under.memAvg.toFixed(2) + " KB (" + (obj.under.memAvg/1000).toFixed(2) + " MB)");
			console.log("--------------------------------------------------------------------------------");
			monitor.kill();
			clients.monitorClientState = STATE.FINISHED;
			if (clients.clientsState === STATE.FINISHED) {
				process.exit(0);
			}
		}
	});
};
