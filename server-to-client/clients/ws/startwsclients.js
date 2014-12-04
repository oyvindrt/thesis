var cp = require('child_process');

var args = process.argv.slice(2);

var HOST = args[0];
var PORT = args[1];

var STATE = {
	NOT_FINISHED: 0,
	FINISHED: 1
};

var clients = {
	count: parseInt(args[2]),
	
	testClients: [ ],
	testClientsConnected: 0,
	testClientsFinished: 0,
	testClientsState: STATE.NOT_FINISHED,
	testClientsNotReceivedAllMessages: 0,
	
	pingClientState: STATE.NOT_FINISHED
};

console.log("Server address: http://" + HOST + ':' + PORT + "/sse");
console.log("Number of clients: " + clients.count);

var createClients = function() {
	for (var i = 0; i < clients.count; i++) {
		var client = cp.fork('./wsclient.js');
		clients.testClients.push(client);
		client.send(JSON.stringify({"type": "connectToServer", "addr": ("ws://" + HOST + ':' + PORT), "id": (i+1)}));
		
		client.on('message', function(message) {
			var obj = JSON.parse(message);
			
			if (obj.type === 'connected') {
				clients.testClientsConnected++;
				if (clients.testClientsConnected === clients.count) {
					console.log("All clients are connected to the server");
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

var createPingClient = function() {
	var pingClient = cp.fork('./../ping/ws/wspingclient.js');
	pingClient.send(JSON.stringify({"type": "connectToServer", "addr": ("ws://" + HOST + ':' + PORT)}));
	
	pingClient.on('message', function(message) {
		var obj = JSON.parse(message);
		
		if (obj.type === 'connected') {
			console.log("Ping client connected to server");
		}
		else if (obj.type === 'done') {
			console.log("--------------------------------------------------------------------------------");
			console.log("Average response time before broadcast: " + obj.avgResp.before.toFixed(2) + " ms");
			console.log("--------------------------------------------------------------------------------");
			console.log("Average response time under broadcast: " + obj.avgResp.under.toFixed(2) + " ms");
			console.log("--------------------------------------------------------------------------------");
			
			pingClient.kill();
			clients.pingClientState = STATE.FINISHED;
			if (clients.testClientsState === STATE.FINISHED) {
				process.exit(code=0);
			}
		}
	});
};

var killAllClientProcesses = function() {
	for (var i = 0; i < clients.testClients.length; i++) {
		clients.testClients[i].kill();
	}
	console.log("All clients killed");
	clients.testClientsState = STATE.FINISHED;
	if (clients.pingClientState === STATE.FINISHED) {
		process.exit(code=0);
	}
};

createClients();
createPingClient();