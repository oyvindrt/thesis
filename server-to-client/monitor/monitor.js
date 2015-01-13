var procmon = require('process-monitor');
var started = false;
var ended = false;
var monitor;

var cpuLoad = {
	before: [],
	under: []
};

var memLoad = {
	before: [],
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
		} else if (ended) {
			// Only record memory footprint at end
			memLoad.after.push(parseInt(stats.mem));
			
			var objToSend = { "type": "stats"};
			
			// IDLE CPU AND MEMORY
			var cpuAvg = 0;
			var memAvg = 0;
			
			for (var i = 0; i < cpuLoad.before.length; i++) {
				cpuAvg += cpuLoad.before[i];
				memAvg += memLoad.before[i];
			}
			
			cpuAvg = cpuAvg / cpuLoad.before.length;
			memAvg = memAvg / memLoad.before.length;
			
			objToSend.cpuBefore = cpuAvg;
			objToSend.memBefore = memAvg;
			
			// CPU UNDER LOAD
			cpuAvg = 0;
			
			for (var i = 0; i < cpuLoad.under.length; i++) {
				cpuAvg += cpuLoad.under[i];
			}
			
			cpuAvg = cpuAvg / cpuLoad.under.length;
			
			objToSend.cpuUnder = cpuAvg;
			
			// MEMORY FOOTPRINT AFTER
			objToSend.memAfter = parseInt(stats.mem);
		
			process.send(JSON.stringify(objToSend));
			monitor.stop();
		}
	});
}