var procmon = require('process-monitor');
var started = false;
var ended = false;
var monitor;

var cpuLoadUnderChat = [];

process.on('message', function(m) {
	var obj = JSON.parse(m);
	if (obj.type === "startMonitor") {
		var pid = parseInt(obj.pid);
		setupMonitor(pid);
	}
	else if (obj.type === "chatStarting") {
		monitor.start();
		console.log("Monitor starting");
	} else if (obj.type === "done") {
		ended = true;
	}
});

function setupMonitor(pid) {
	monitor = procmon.monitor({ pid: pid, interval: 50 });
	monitor.on('stats', function(stats) {
		cpuLoadUnderChat.push(parseFloat(stats.cpu));
		//console.log(stats.cpu);
		if (ended) {
			monitor.stop();
			console.log("Monitor stopped");
			
			var cpuAvg = 0;
			for (var i = 0; i < cpuLoadUnderChat.length; i++) {
				cpuAvg += cpuLoadUnderChat[i];
			}
			cpuAvg = cpuAvg / cpuLoadUnderChat.length;
			
			var memAfter = stats.mem;
			
			process.send(JSON.stringify({"type": "stats", "cpuAvgUnderChat":cpuAvg, "memAfter":memAfter}));
		}
	});
}
