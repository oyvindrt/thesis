var http = require('http');

//var Client = require('node-rest-client').Client;
//var httpclient = new Client();

var args = process.argv.slice(2);
var id = args[2];

var nextToReceive = 0;
var finished = false;

var httpAgent = new http.Agent();
httpAgent.maxSockets = 1;

var handleResponse = function(error, data) {
    if (error) {
        console.log(error);
    } else {
        var obj = JSON.parse(data);
        var arr = obj.messages;
        for (var i = 0; i < arr.length; i++) {
			if (arr[i].type === "done") {
				console.log("Broadcast is finished. " + id + " received a total of " + nextToReceive + " messages.");
				finished = true;
			}
			nextToReceive++;
		}
		if (!finished) {
			poll();
		}
    }
};

var poll = function() {
	var options = {
	    host: args[0],
	    port: args[1],
	    path: ('/poll?next=' + nextToReceive),
	   	agent: httpAgent
	};

	var data = "";

	http.get(options, function(response) {
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

poll();


/*
var poll = function() {
	httpclient.get(("http://" + args[0] + "/poll?next=" + nextToReceive), function(data, response) {
		var obj = JSON.parse(data);
		var arr = obj.messages;
		for (var i = 0; i < arr.length; i++) {
			//console.log("Got: " + nextToReceive);
			if (arr[i].type === "done") {
				console.log("Broadcast is finished. " + id + " received a total of " + nextToReceive + " messages.");
				finished = true;
			}
			nextToReceive++;
		}
		if (!finished) {
			poll();
		}
	});
}

poll();
*/
