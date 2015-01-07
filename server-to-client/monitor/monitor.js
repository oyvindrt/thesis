var procmon = require('process-monitor');
var started = false;
var ended = false;
var monitor;

var cpuLoad = {
	before: [],
	under: [],
	after: []
};

var memLoad = {
	before: [],
	under: [],
	after: []
};

process.on('message', function(m) {
	var obj = JSON.parse(m);
	if (obj.type === "startMonitor") {
		var pid = parseInt(obj.pid);
		monitor = procmon.monitor({ pid: pid, interval: 50 }).start();
		setupMonitor();
	}
	else if (obj.type === "broadcastStarting") {
		started = true;
	}
	else if (obj.type === "broadcastEnded") {
		ended = true;
	}
});

function setupMonitor() {
	monitor.on('stats', function(stats) {
		if (!started && !ended) {
			cpuLoad.before.push(parseInt(stats.cpu));
			memLoad.before.push(parseInt(stats.mem));
		} else if (started && !ended) {
			cpuLoad.under.push(parseInt(stats.cpu));
			
			// Average is wrong, as V8 keeps the arrived messages in memeory for some time.
			//memLoad.under.push(parseInt(stats.mem));
		} else if (ended) {
			// Only record memory footprint at end?
			memLoad.under.push(parseInt(stats.mem));
			
			var objToSend = { "type": "stats", "before": {}, "under": {} };
		
			var cpuAvg = 0;
			var memAvg = 0;
		
			for (var i = 0; i < cpuLoad.before.length; i++) {
				cpuAvg += cpuLoad.before[i];
				memAvg += memLoad.before[i];
			}
		
			cpuAvg = cpuAvg / cpuLoad.before.length;
			memAvg = memAvg / memLoad.before.length;
		
			objToSend.before.cpuAvg = cpuAvg;
			objToSend.before.memAvg = memAvg;
		
			cpuAvg = 0;
			memAvg = 0;
		
			for (var i = 0; i < cpuLoad.under.length; i++) {
				cpuAvg += cpuLoad.under[i];
			}
			
			for (var i = 0; i < memLoad.under.length; i++) {
				memAvg += memLoad.under[i];
			}
		
			cpuAvg = cpuAvg / cpuLoad.under.length;
			memAvg = memAvg / memLoad.under.length;
		
			objToSend.under.cpuAvg = cpuAvg;
			objToSend.under.memAvg = memAvg;
		
			process.send(JSON.stringify(objToSend));
			monitor.stop();
		}
	});
}