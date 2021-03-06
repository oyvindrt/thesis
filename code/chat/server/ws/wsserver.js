var WebSocketServer = require('ws').Server;
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
	disconnected: 0,
	state: STATE.NOT_STARTED,
};

var monitor;
var monitorState = STATE.NOT_STARTED;

var wss = new WebSocketServer({port: 8000}, function() {
	console.log("Server started and listening for clients on port 8000");
	setWsHandlers();
});
var rl = readline.createInterface({ input: process.stdin, output: process.stdout});



/* ---------------------------------------------------
	SERVER
--------------------------------------------------- */

var setWsHandlers = function () {
	wss.on('connection', function(socket) {
		socket.on('message', function(message) {
			var obj = JSON.parse(message);
			if (obj.type === 'ping') {
				socket.send(JSON.stringify({"type":"pong", "sent": obj.sent}));
			}
			else if (obj.type === 'info') {
				clients.count = parseInt(obj.numberOfClients);
				socket.send(JSON.stringify({"type":"info", "testDuration":TEST_DURATION}));
			}
			else if (obj.type === 'getReady') {
				console.log("Get ready! Chat phase starting in " + (obj.startingIn/1000) + " seconds...");
				readyMonitor();
			}
			else if (obj.type === 'chat') {
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
			else if (obj.type === 'timeup') {
				if (clients.state !== STATE.SHUTTING_DOWN) {
					clients.state = STATE.SHUTTING_DOWN;
					monitor.send(JSON.stringify({"type":"done"}));
					broadcast({"type": "done", "shouldHaveReceived": messageCount});
					console.log("Server received timeup from clients");
				}
			} else if (obj.type === 'finished') {
				socket.close();
				clients.state = STATE.FINISHED;
				if (monitorState === STATE.FINISHED) {
					process.exit(0);
				}
			}
		});

		socket.on('close', function(reason) {
			clients.disconnected++;
			if (clients.disconnected === clients.count) {
				console.log("All connected clients disconnected");
			}
		});
	
	});
};


var broadcast = function(message) {
	var msgToBroadcast = JSON.stringify(message);
	for (var i = 1; i < wss.clients.length; i++) {
		// wss.clients[0] is the master client. No need to broadcast to him.
		if (wss.clients[i]) {
			wss.clients[i].send(msgToBroadcast);
		}
	}
};


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
			console.log("Memory footprint after chat: " + obj.memAfter.toFixed(2) + " KB (" + (obj.memAfter/1000).toFixed(2) + " MB)");
			console.log("--------------------------------------------------------------------------------");
			if (clients.state === STATE.FINISHED) {
				process.exit(0);
			}
		}
	});
};