# My master's thesis

My master's thesis is found in Thesis.pdf

All the code used to run the performance tests is found under in the folder 'code'.

### How to run the tests
Node.js is required to run the tests. It might also be required to increase the OS limit for user processes.
####Scenario 1
It is required to start the backend before the server. Once started, the backend listens on port 9000. The servers always listen on port 8000.
#####First, start the backend like this:
`$ node backend.js`
#####Then start the desired server like so:
`$ node <ws/sse/http>server.js <backend ip> <backend port>`

Example:
`$ node wsserver.js localhost 9000`
#####Lastly, start the clients:
`$ node start<ws/sse/http>clients.js <server ip> <server port> <client number>`

Example:
`$ node startwsclients.js localhost 8000 128`
####Scenario 2
#####First start the server like this:
`$ node <ws/sse/http>server.js <backend ip> <seconds the test should run>`

Example:
`$ node wsserver.js localhost 30`
#####Then start up the clients like so:
`$ node start<ws/sse/http>clients.js <server ip> <client number>`

Example:
`$ node startwsclients.js localhost 128`
