var http = require('http');
var id;
var messagesReceived = 0;
var httpRequestOptions = { };

process.on('message', function(message) {
	var obj = JSON.parse(message);
	if (obj.type === "connectToServer") {
		id = parseInt(obj.id);
		
		var httpAgent = new http.Agent();
		httpAgent.maxSockets = 1;
		
		httpRequestOptions.host = obj.host;
		httpRequestOptions.port = obj.port;
		httpRequestOptions.agent = httpAgent;
		
		poll();
		process.send(JSON.stringify({"type": "polling"}));
	}
});

var poll = function() {
	httpRequestOptions.path = ('/poll?next=' + messagesReceived);

	var data = "";

	http.get(httpRequestOptions, function(response) {
	    response.on('data', function(chunk) {
	        data += chunk;
	    });

	    response.on('end', function() {
	        handleResponse(null, data);
	    });

	    response.on('error', function(error) {
	        handleResponse(e);
	    });
	});
};

var handleResponse = function(error, data) {
    if (error) {
        console.log(error);
    } else {
        var obj = JSON.parse(data);
		if (obj.messages) {
			var arr = obj.messages;
			var done = false;
			for (var i = 0; i < arr.length; i++) {
				if (arr[i].type === "broadcast") {
					messagesReceived++;
				} else if (arr[i].type === "done") {
					done = true;
					var allRecv = false;
					var shouldHaveReceived = parseInt(arr[i].shouldHaveReceived);
					var exitCode = 0;
					if (messagesReceived === shouldHaveReceived) {
						allRecv = true;
						exitCode = 1;
					}
					setTimeout(function() {
						process.exit(exitCode);
						/*process.send(JSON.stringify({
							"type": "done",
							"gotAll": allRecv
						}));*/
					}, id*10);
					break;
				}
			}
			if (!done) {
				poll();
			}
		}
    }
};