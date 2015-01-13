var express = require('express');
var WebSocket = require('ws');
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
	defers: [ ],
	deferState: STATE.NOT_STARTED,
	pingClientState: STATE.NOT_STARTED,
	monitorClientState: STATE.NOT_STARTED
};

var messages = [ ];

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
		if (clients.deferState === STATE.NOT_STARTED) {
			clients.deferState = STATE.STARTED;
			console.log("Starting broadcast!");
			monitor.send(JSON.stringify({"type": "broadcastStarting"}));
			clients.monitorClientState = STATE.STARTED;
		}
		messages.push(obj);
		sendToAllDefers();
	}
	else if (obj.type === "done") {
		var doneObj = {
			"type": "done",
			"shouldHaveReceived": NUMBER_OF_MESSAGES
		};
		
		messages.push(doneObj);
		sendToAllDefers();
		clients.deferState = STATE.FINISHED;
		monitor.send(JSON.stringify({"type": "broadcastEnded"}));
		console.log("Broadcast is over");
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

function Defer(req, res) {
	this.req = req;
	this.res = res;
	this.next = parseInt(req.query.next);
}

var httpServer = express();

httpServer.get('/poll', function(req, res) {
	var nextIndexToSend = parseInt(req.query.next) || 0;
	res.contentType('application/json');
	if (nextIndexToSend >= messages.length) {
		var defr = new Defer(req, res);
		clients.defers.push(defr);
	} else {
		var newMessages = getAllMessagesFrom(nextIndexToSend);
		res.send(JSON.stringify({
			"messages": newMessages
		}));
	}
});

httpServer.get('/ping', function(req, res) {
	if (clients.deferState === STATE.NOT_STARTED) {
		res.end(JSON.stringify({"type": "pong", "status": "before", "time": req.param('time')}));
	}
	else if (clients.deferState === STATE.STARTED) {
		res.end(JSON.stringify({"type": "pong", "status": "under", "time": req.param('time')}));
	}
	else if (clients.deferState === STATE.FINISHED) {
		res.end(JSON.stringify({"type": "pong", "status": "done"}));
		clients.pingClientState = STATE.FINISHED;
		if (clients.deferState === STATE.FINISHED && clients.monitorClientState === STATE.FINISHED) {
			exitIfNoMoreDefers();
		}
	}
});

httpServer.listen(8000);

var sendToAllDefers = function() {
	
	for (var i = 0; i < clients.defers.length; i++) {
		var newMessages = getAllMessagesFrom(clients.defers[i].next);
		clients.defers[i].res.send(JSON.stringify({
			"messages": newMessages
		}));
	}
	clients.defers = [ ];
	
	if (clients.pingClientState === STATE.FINISHED && clients.monitorClientState === STATE.FINISHED) {
		exitIfNoMoreDefers();
	}
};

var getAllMessagesFrom = function(next) {
	var msgArr = [ ];
	for (var i = next; i < messages.length; i++) {
		msgArr.push(messages[i]);
	}
	return msgArr;
};

var exitIfNoMoreDefers = function() {
	setTimeout(function() {
		if (clients.defers.length > 0) {
			sendToAllDefers();
		} else {
			process.exit(0);
		}
	}, 3000);
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
			console.log("---CPU--------------------------------------------------------------------------");
			console.log("Average idle CPU load before broadcast: " + obj.cpuBefore.toFixed(2) + " %");
			console.log("Average CPU load under broadcast: " + obj.cpuUnder.toFixed(2) + " %");
			console.log("---MEM--------------------------------------------------------------------------");
			console.log("Average idle memory usage before broadcast: " + obj.memBefore.toFixed(2) + " KB (" + (obj.memBefore/1000).toFixed(2) + " MB)");
			console.log("Memory after broadcast: " + obj.memAfter.toFixed(2) + " KB (" + (obj.memAfter/1000).toFixed(2) + " MB)");
			console.log("Delta: " + (obj.memAfter - obj.memBefore).toFixed(2) + " KB (" + (obj.memAfter/1000 - obj.memBefore/1000).toFixed(2) + " MB)");
			console.log("--------------------------------------------------------------------------------");
			monitor.kill();
			clients.monitorClientState = STATE.FINISHED;
			if (clients.deferState === STATE.FINISHED && clients.pingClientState === STATE.FINISHED) {
				exitIfNoMoreDefers();
			}
		}
	});
};
