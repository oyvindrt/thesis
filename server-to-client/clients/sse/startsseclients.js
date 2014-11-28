var cp = require('child_process');

var args = process.argv.slice(2);

var HOST = args[0];
var PORT = args[1];
var SSE_URI = "http://" + HOST + ':' + PORT + "/sse";
var NUMBER_OF_CLIENTS = parseInt(args[2]);

var clients = [ ];
var pingClient;
var connectedClients = 0;
var finishedClients = 0;
var readyClients = 0;

var numberOfClientsNotReceivedAllMessages = 0;
var responseTimeAvg = { };

console.log("URI: " + SSE_URI);
console.log("Number of clients: " + NUMBER_OF_CLIENTS);

var createClients = function() {
	for (var i = 0; i < NUMBER_OF_CLIENTS; i++) {
		var client = cp.fork('./sseclient.js');
		clients.push(client);
		client.send(JSON.stringify({"type": "connectToServer", "uri": SSE_URI, "id": (i+1)}));

		client.on('message', function(message) {
			var obj = JSON.parse(message);

			if (obj.type === 'connected') {
				connectedClients++;
				if (connectedClients === NUMBER_OF_CLIENTS) {
					console.log("All clients are connected to the server");
				}
			}
			else if (obj.type === 'done') {
				if (obj.gotAll === false) {
					numberOfClientsNotReceivedAllMessages++;
					console.log("A client did not receive all messages from the server");
				}

				finishedClients++;

				if (finishedClients === NUMBER_OF_CLIENTS) {
					if (numberOfClientsNotReceivedAllMessages === 0) {
						console.log("All clients received all messages");
					}
					else {
						console.log(numberOfClientsNotReceivedAllMessages + " clients did not receive all messages");
					}
					killAllClientProcesses();
				}
			}
		});
	}
};


var createPingClient = function() {
	pingClient = cp.fork('./ssepingclient.js');
	pingClient.send(JSON.stringify({"type": "startPingProgram", "host": HOST, "port": PORT}));

	pingClient.on('message', function(message) {
		var obj = JSON.parse(message);
		if (obj.type === 'pingProgramStarted') {
			console.log("Ping client connected to server");
		}
		else if (obj.type === 'done') {
			responseTimeAvg.before = obj.avgResp.before;
			responseTimeAvg.under = obj.avgResp.under;
			if (clients.length === 0) {
				printTimeoutAvgAndEndProcess();
			}
			pingClient.kill();
		}
	});
};


var printTimeoutAvgAndEndProcess = function() {
	console.log("--------------------------------------------------------------------------------");
	console.log("Average response time before broadcast: " + responseTimeAvg.before.toFixed(2) + " ms");
	console.log("--------------------------------------------------------------------------------");
	console.log("Average response time under broadcast: " + responseTimeAvg.under.toFixed(2) + " ms");
	console.log("--------------------------------------------------------------------------------");
	process.exit(code=0);
};

var killAllClientProcesses = function() {
	for (var i = 0; i < clients.length; i++) {
		clients[i].kill();
	}
	if (responseTimeAvg.before && responseTimeAvg.under) {
		printTimeoutAvgAndEndProcess();
	}
	console.log("All clients killed");
};

createClients();
createPingClient();