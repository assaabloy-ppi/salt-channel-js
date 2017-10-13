salt-channel-js
===============

A JavaScript implementation of a [Salt Channel](https://github.com/assaabloy-ppi/salt-channel/) v2; 
client-side code that connects on top of WebSocket with binaryType set to "arraybuffer".

Table of Contents
=================

* [Status](#status)
  * [Log Entries](#log-entries)
* [Dependencies](#dependencies)
* [Usage](#usage)
  * [Initializing a Salt Channel](#initializing-a-salt-channel)
  * [Setting Functions for Receiving Messages from Salt Channel](#setting-functions-for-receiving-messages-from-salt-channel)
  * [The State of the Salt Channel](#the-state-of-the-salt-channel)
  * [The A1A2 Session](#the-a1a2-session)
  * [Initiating a Handshake](#initiating-a-handshake)
  * [Sending Messages on the Salt Channel](#sending-messages-on-the-salt-channel)
  * [Getting Telemetry Information](#getting-telemetry-information)
  * [Code Example with WebSocket](#code-example-with-websocket)
* [Testing](#testing)
  
Status
------

WORK IN PROGRESS.

### Log Entries

2017-10-13, Felix, Implementation compliant with V2 Draft7. Improved testing.

2017-10-10, Felix, cleanup, implementation closer to V2 Draft7. Functionality is tested.

2017-10-05, Felix, cleanup, Java test server removed, testing using a mocket WebSocket 

2017-06-15, Frans, repo created, a test server implemented in Java 
was created in dir java/. Did not move real JavaScript implementation yet.

Dependencies
------------

Salt Channel is based on [TweetNaCl](http://tweetnacl.cr.yp.to/) and SaltChannel.js uses [TweetNaCl.js](https://tweetnacl.js.org/#/) which has no dependencies.

Usage
-----

Download the [contents of the /js folder](https://github.com/assaabloy-ppi/salt-channel-js/tree/master/js) and include in your script using require. 

	let saltchannel = require('path/to/saltchannel.js')

### Initializing a Salt Channel


Salt Channel initialization requires a WebSocket and an optional threshold value. The threshold value specifies the tolerance for delayed packets in milliseconds. The higher the threshold value, the more a packet can be delayed without detection. The default value is 5000 ms.

	let sc = saltchannel(ws [, threshold])


### Setting Functions for Receiving Messages from Salt Channel

In order to receive messages from Salt Channel you must specify an appropriate callback for one or more events. 
* onA2Response(prots) is executed by sc when sc has received and parsed A2
* onSaltChannelError(err) is executed by sc when an error occurs in sc
* onHandshakeComplete() is executed by sc directly after sc has sent M4
* onMessage(message) is executed by sc when sc has decrypted and parsed a received message

It is recommended that you execute the set methods before executing a method that relies on a specific callback being set.

	sc.setOnA2Response(onA2Response) 
	sc.setOnerror(onSaltChannelError) 
	sc.setOnHandshakeComplete(onHandshakeComplete) 
	sc.setOnmessage(onMessage) 

### The State of The Salt Channel

A Salt Channel can be in five different states: 
1. 'init' - Initial state. You can execute a1a2 or handshake
2. 'a1a2' - During a1a2 execution. When the A2 callback has been executed the Salt Channel is put in 'init'
3. 'handshake' - During handshake execution
4. 'ready' - After handshake execution. Only state where it is allowed to send or receive messages
5. 'last' - From when a LastFlag has been read or set until the message has been dispatched to the callback or sent on the WebSocket. After 'last' the Salt Channel is put into 'init'

If an error occurs the Salt Channel is automatically put in the 'init' state. Callback functions are not reset, so it is possible to set all callbacks, execute a1a2 and on the a2response execute a handshake without having to set new callbacks.

	sc.getState()

### The A1A2 Session

The purpose of the A1A2 message exchange is to get information about which protocols the peer supports. To execute the A1A2 message exchange Salt Channel must be in the 'init' state and you need to set a function that receives the response. 

The a1a2 method takes an optional adressType and adress. If omitted the *any adress* type is used as default

	sc.a1a2()			// Initiate like this
	sc.a1a2(adressType, adress) // OR like this
	
	function onA2Response(prots) {
		for (let i = 0; i < prots.length; i++) {
			// Do something with prots[i].p1 and prots[i].p2
		}
	}

### Initiating a Handshake

In order to be able to send messages over a Salt Channel you must first execute a Salt Channel handshake. To execute a handshake Salt Channel must be in the 'init' state and you need to set a callback that is executed by the Salt Channel when the handshake is completed. It is also recommended that you set onerror and onmessage callbacks.

The handshake method takes the client signing key pair, an ephemeral key pair and optionally the public signing key of the server. If the servers public signing key is included as an argument it is sent to the server in M1. As a result the server may respond with NoSuchServer and LastFlag set in M2.

	sc.handshake(mySigKeyPair, myEphemeralKeyPair [, serverPublicSigKey])
	
	function onHandshakeComplete() {
		console.log(sc.getState()) // 'ready'
	}

### Sending Messages on the Salt Channel

When the onHandshakeComplete callback is executed you are free to send messages on the Salt Channel. The send method transparently support both AppPacket and MultiAppPacket. The send method takes a boolean value 'last' that specifies if this is the last message to be sent by this session, and either one or more Uint8Arrays or an array of Uint8Arrays. Therefore there are four different ways you can use the send method.

	sc.send(last, msg) 		// Sends an AppPacket with msg as data
	sc.send(last, [msg])	// Logically equivalent to previous row
	
	sc.send(last, msg1, msg2, msg3)		// Sends a MultiAppPacket with msg1, msg2, msg3 as data
	sc.send(last, [msg1, msg2, msg3])	// Logically equivalent to previous row

### Getting Telemetry Information

The getTelemetry method returns an object with information about number of bytes sent and received, and the start, end and total time for the handshake execution.

	let telemetry = sc.getTelemetry()
	
	console.log(telemetry.bytes.sent)
	console.log(telemetry.bytes.received)
	console.log(telemetry.handshake.start)
	console.log(telemetry.handshake.end)
	console.log(telemetry.handshake.total)

### Code Example With WebSocket

	let ws = new WebSocket(uri)
	ws.binaryType = "arraybuffer"
	let threshold = 1000
	
	let sc = saltChannelSession(ws, threshold)
	sc.setOnA2Response(onA2Response)
	sc.setOnerror(onSaltChannelError)
	sc.setOnHandshakeComplete(onHandshakeComplete)
	sc.setOnmessage(onMessage)
	
	ws.onopen = function(evt) {
		sc.handshake(mySigKeyPair, myEphemeralKeyPair, serverPublicSigKey)
	}

	function onA2Response(prots) {
		// prots is an array of {p1: aString, p2: anotherString }
	}
	
	function onSaltChannelerror(err) {
		// err is an Error object 
		// err.message is always set
	}
	
	function onHandshakeComplete() {
		// Now it's allowed to call sc.send()
		// to send messages to the server
	}
	
	function onMessage(message) {
		// message is a Uint8Array that was sent
		// from the server
	}

Testing
-------

The implementation is tested using node.js. To run all tests:

	node js/src-test/run.js

The readme.md file in js/src-test documents the test coverage. The folder js/src-test/tests contains the test scripts. All tests uses a mocked WebSocket to send and receive messages.