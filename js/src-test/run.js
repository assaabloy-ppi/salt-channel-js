var a1a2 = require('./tests/a1a2test.js')
var handshake = require('./tests/handshaketest.js')
var session = require('./tests/sessiontest.js')
run()

function run() {
	a1a2.run()
	handshake.run()
	session.run()
}

