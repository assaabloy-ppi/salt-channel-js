salt-channel-js
===============

A JavaScript implementation of a [Salt Channel](https://github.com/assaabloy-ppi/salt-channel/) client.
Client-side code that connects on top of WebSocket or BLE (using [Web Bluetooth API](https://webbluetoothcg.github.io/web-bluetooth/)).


Table of Contents
=================

* [Status](#status)
  * [Log Entries](#log-entries)
* [Dependencies](#dependencies)
* [Usage](#usage)
  * [Usage example](#usage-example)
  * [Method overview](#method-overview)
  * [Initializing a Salt Channel](#initializing-a-salt-channel)
  * [Time keeping](#time-keeping)
  * [Time checking](#time-checking)
  * [Setting Functions for Receiving Messages from Salt Channel](#setting-functions-for-receiving-messages-from-salt-channel)
  * [The State of the Salt Channel](#the-state-of-the-salt-channel)
  * [The A1A2 Session](#the-a1a2-session)
  * [Initiating a Handshake](#initiating-a-handshake)
  * [Sending Messages on the Salt Channel](#sending-messages-on-the-salt-channel)
  * [Getting Telemetry Information](#getting-telemetry-information)
  * [Error handling](#error-handling)
  * [Code Example with WebSocket](#code-example-with-websocket)
* [Testing](#testing)




Status
======

Log Entries
-----------

2020-11-20, Jakub, BLE transport using Web Bluetooth API.

2019-06-12, Jakub, Converted from CommonJS into ES6 module.

2017-11-13, Felix, Implementation now closes the WebSocket when a session ends.

2017-11-10, Felix, Implementation no longer supports sequential sessions over the same WebSocket session. Because reference implementation in Java does not support this, which may cause confusion when using Salt Channel JS.

2017-11-01, Felix, Fix of fatal bug regarding bit order of protocol specification. All prior versions affected.

2017-10-25, Felix, saltchannel now passes ArrayBuffer on callback set with setOnMessage instead of Uint8Array.
Improved and completely updated error handling.

2017-10-17, Felix, implementation compliant with v2 Draft8. Call onclose when session is closed

2017-10-13, Felix, Implementation compliant with v2 Draft7. Improved testing.

2017-10-10, Felix, cleanup, implementation closer to v2 Draft7. Functionality is tested.

2017-10-05, Felix, cleanup, Java test server removed, testing using a mocket WebSocket

2017-06-15, Frans, repo created, a test server implemented in Java
was created in dir java/. Did not move real JavaScript implementation yet.







Dependencies
============

Salt Channel is based on [TweetNaCl](http://tweetnacl.cr.yp.to/) and SaltChannel.js uses [TweetNaCl.js](https://tweetnacl.js.org/) which has no dependencies.



Usage
=====

Download the source code and include using import.

    import saltchannel from 'path/to/saltchannel.js';

Usage example
-------------

There is a simple example in the [example.html](example.html) file showing how to establish Salt Channel connection over WS and/or BLE from within a web browser.

The easiest way to run it is to install a lightweight HTTP server e.g. [http-server](https://www.npmjs.com/package/http-server) based on [Node.js](https://nodejs.org/en/download/).
 
 `$ npm install http-server -g`
 
Since Web Bluetooth API can only be used from HTTPS context you need to have a certificate for the server.
You can generate a self-signed certificate using [openSSL](https://wiki.openssl.org/index.php/Binaries).

 `$ openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout key.pem -out cert.pem`
 
You then should start the server from the main project directory.

 `$ http-server -S -C cert.pem`
 
By default the server is listening on port 8080. In your Chrome browser go to:

 `https://localhost:8080/example.html`
 

Method overview
---------------

* [saltchannel(ws [, timeChecker [,timeKeeper]])](#initializing-a-salt-channel)
* [getState()](#the-state-of-the-salt-channel)
* [setOnA2Response(onA2Response)](#setting-functions-for-receiving-messages-from-salt-channel)
* [setOnError(onSaltChannelError)](#setting-functions-for-receiving-messages-from-salt-channel)
* [setOnHandshakeComplete(onHandshakeComplete)](#setting-functions-for-receiving-messages-from-salt-channel)
* [setOnMessage(onMessage)](#setting-functions-for-receiving-messages-from-salt-channel)
* [setOnClose(onClose)](#setting-functions-for-receiving-messages-from-salt-channel)
* [a1a2([adressType, adress])](#the-a1a2-session)
* [handshake(mySigKeyPair, myEphemeralKeyPair [, serverPublicSigKey])](#initiating-a-handshake)
* [send(last, msg1[, msg2, ...])](#sending-messages-on-the-salt-channel)
* [send(last, array)](#sending-messages-on-the-salt-channel)
* [getTelemetry()](#getting-telemetry-information)




Initializing a Salt Channel
---------------------------

Salt Channel initialization requires a WebSocket, optionally a time keeper
and a time checker can be supplied, if omitted a default time keeper and
checker will be used. If the peer does not support time stamping the null
time checker is always used. The folder js/src/time contains two
implementations each of time keeper and time checker, section
[Time keeping](#time-keeping) and [Time checking](#time-checking) documents
how to use them. A Salt Channel session can therefore be initialized in
the following ways:

    let sc
    // Like this with just a WebSocket
    sc = saltchannel(ws)
    // Or with a WebSocket and a time checker
    sc = saltchannel(ws, timeChecker)
    // Or with a WebSocket, time checker and a time keeper
    sc = saltchannel(ws, timeChecker, timeKeeper)
    // Or with a WebSocket and time keeper, and the second argument as undefined or null
    sc = saltchannel(ws, undefined, timeKeeper)




Time keeping
------------

The time keeper is used to compute the relative time since the first
message was sent. A time keeper must have two methods, *getTime* and
*reset*. The folder js/src/time contains a null and typical time keeper.
The null time keeper's getTime method always returns 0 and is
intended for when you do not want to use time stamping.

    import timeKeeperMaker from '/path/to/null-time-keeper.js';
    
    let timeKeeper = timeKeeperMaker()
    timeKeeper.getTime() // always 0

The typical time keeper requires a function that returns the current
time in milliseconds. The typical time keeper's getTime method returns
1 the first time, and the relative time, according to the supplied
function, since the first getTime invocation on every subsequent
invocation of the getTime method.

    import timeKeeperMaker from '/path/to/typical-time-keeper.js';

    // create a new time keeper using Date.now to keep time
    let timeKeeper = timeKeeperMaker(Date.now)
    timeKeeper.getTime() // always 1
    doWork()
    timeKeeper.getTime() // > 1

The reset method makes it possible to reuse the same time keeper by
putting the time keeper into a state that matches that of a newly
created time keeper, before the first getTime invocation. Thus it
is possible to reuse the same time keeper for multiple consecutive
Salt Channel sessions.

    import timeKeeperMaker from '/path/to/typical-time-keeper.js';
    
    // create a new time keeper using Date.now to keep time
    let timeKeeper = timeKeeperMaker(Date.now)
    timeKeeper.getTime() // always 1
    doWork()
    timeKeeper.getTime() // > 1
    timeKeeper.reset()
    timeKeeper.getTime() // always 1 because reset was called


Time checking
-------------

The time checker is used to decide if a packet has been delayed. A
time checker must have two methods, *delayed* and *reset*. The folder
js/src/time contains a null and typical time checker. The null time
checker's delayed method always returns false and is intended for
when the peer does not support time stamping.

    import timeCheckerMaker from '/path/to/null-time-checker.js';
    
    let timeChecker = timeCheckerMaker()
    timeChecker.delayed() // always false

The typical time checker requires a function that returns the current
time in milliseconds, and optionally a threshold value for what is
considered a delayed packet, a time in milliseconds. If the threshold
argument is omitted 5000 milliseconds is used. The typical time
checker's delayed method always returns false on the first invocation.
On subsequent invocation it returns true if the expected value of the
time value exceeds the supplied value plus the threshold, otherwise false.

    import timeCheckerMaker from '/path/to/typical-time-checker.js';
    
    let timeChecker = timeCheckerMaker(Date.now, 1000)
    timeChecker.delayed(1)  // false
    spinForTwoSeconds()
    timeChecker.delayed(2) // true because expected time > time + threshold

The reset method makes it possible to reuse the same time checker by
putting it into a state that matches that of a newly created time
checker, before the first delayed invocation. Thus it is possible to
reuse the same time checker for multiple consecutive Salt Channel sessions.

    import timeCheckerMaker from '/path/to/typical-time-checker.js';
    
    let timeChecker = timeCheckerMaker(Date.now, 1000)
    timeChecker.delayed(1)  // always false
    spinForTwoSeconds()
    timeChecker.delayed(2) // true because expected time > time + threshold
    timeChecker.reset()
    timeChecker.delayed(1) // false

The State of The Salt Channel
-----------------------------

A Salt Channel can be in five different states:
1. 'init' - Initial state. Possible to execute a1a2 or handshake.
2. 'a1a2' - During a1a2 execution. When the onA2Response callback has been executed the Salt Channel enters the 'closed' state.
3. 'handshake' - During handshake execution.
4. 'ready' - After handshake execution. Only state where it is possible to send or receive messages.
5. 'last' - From when a LastFlag has been read or set until the message has been dispatched to the callback or sent on the WebSocket. After 'last' the Salt Channel enters the 'closed' state.
6. 'error' - During onError callback. After 'error' the Salt Channel enters the 'closed' state.
7. 'closed' - After an error has occurred, when a packet with LastFlag set has been sent or received, or if the WebSocket is the 'closed' or 'closing' states. A Salt Channel that has entered the 'closed' state remains in the 'closed' state.
8. 'waiting' - If the WebSocket is in the 'connecting' state.

To get the current state of Salt Channel:

    sc.getState()




Setting Functions for Receiving Messages from Salt Channel
----------------------------------------------------------

In order to receive messages from Salt Channel you must specify an
appropriate callback for one or more events. It is recommended that
you execute the set methods before executing a method that relies
on a specific callback being set.

    sc.setOnA2Response(onA2Response)
    sc.setOnError(onSaltChannelError)
    sc.setOnHandshakeComplete(onHandshakeComplete)
    sc.setOnMessage(onMessage)
    sc.setOnClose(onClose)

* onA2Response(prots) - Executed by sc when sc has received and parsed A2
* onSaltChannelError(err) - Executed by sc when a fatal error occurs in sc
* onHandshakeComplete() - Executed by sc directly after sc has sent M4
* onMessage(message) - Executed by sc when sc has decrypted and parsed a received message. Message is an ArrayBuffer
* onClose(state) - Executed by sc when the session is closed, i.e. when a fatal error has occurred or when a packet with a LastFlag set has been sent or received. Executed after the onError callback.




The A1A2 Session
----------------

The purpose of the A1A2 message exchange is to get information
about which protocols the peer supports. To execute the A1A2 message
exchange Salt Channel must be in the 'init' state and you need
to set a function that receives the response.

The a1a2 method takes an optional adressType and adress. If omitted the *any adress* type is used as default.

    sc.a1a2()           // Initiate like this
    sc.a1a2(adressType, adress) // OR like this

    function onA2Response(prots) {
        for (let i = 0; i < prots.length; i++) {
            // Do something with prots[i].p1 and prots[i].p2
        }
    }




Initiating a Handshake
----------------------

In order to be able to send messages over a Salt Channel you must
first execute a Salt Channel handshake. To execute a handshake
Salt Channel must be in the 'init' state and you need to set a
callback that is executed by the Salt Channel when the handshake
is completed. It is also recommended that you set onerror and
onmessage callbacks.

The handshake method takes the client signing key pair, an ephemeral
key pair and optionally the public signing key of the server. If the
servers public signing key is included as an argument it is sent to
the server in M1. As a result the server may respond with
NoSuchServer and LastFlag set in M2.

    let mySigKeyPair = nacl.sign.keyPair()
    let myEphemeralKeyPair = nacl.box.keyPair()
    let serverPublicSigKey = util.hex2Uint8Arr('7add16c5f80d799dd78b3fa896ec1cf308d6826c5d87d4f004d2816b25dbe888')

    sc.handshake(mySigKeyPair, myEphemeralKeyPair [, serverPublicSigKey])

    function onHandshakeComplete() {
        console.log(sc.getState()) // 'ready'
    }




Sending Messages on the Salt Channel
------------------------------------

When the onHandshakeComplete callback is executed you are free to
send messages on the Salt Channel. The send method transparently
support both AppPacket and MultiAppPacket. The send method takes
a boolean value 'last' that specifies if this is the last message
to be sent by this session, and either one or more Uint8Arrays or
ArrayBuffers, or an array of Uint8Arrays or ArrayBuffers. Therefore
there are four different ways you can use the send method.

    let msg = getInterestingUint8Array()
    sc.send(last, msg)      // Sends an AppPacket with msg as data
    sc.send(last, [msg])    // Logically equivalent to previous row

    let msg1 = getInterestingUint8Array()
    let msg2 = getInterestingArrayBuffer()
    let msg3 = getInterestingUint8Array()
    let arr = [msg1, msg2, msg3]
    sc.send(last, msg1, msg2, msg3)     // Sends a MultiAppPacket with msg1, msg2, msg3 as data
    sc.send(last, arr)                  // Logically equivalent to previous row




Getting Telemetry Information
-----------------------------

The getTelemetry method returns an object with information about
number of bytes sent and received, and the time for the handshake
execution from before creating and sending M1 until after sending M4.

    let telemetry = sc.getTelemetry()

    console.log(telemetry.bytes.sent)
    console.log(telemetry.bytes.received)
    console.log(telemetry.handshake)




Error handling
--------------

Salt Channel assumes that it is handed an open WebSocket with the
attribute binaryType set to 'arraybuffer'. Salt Channel only
listens for message events, the code that uses Salt Channel must
handle all other necessary events.

If a fatal error occurs the callback set by the *setOnError*-method
is executed and the Salt Channel is put into the 'closed' state. To
avoid further errors the underlying WebSocket is closed by the Salt
Channel.

**sc.a1a2(adressType, adress)**
* Throws Error if Salt Channel is not in the 'init' state.
* Throws RangeError if adressType is not 0 or 1.
* Throws TypeError if adress is not ArrayBuffer or Uint8Array when adressType = 1.

**sc.handshake(mySigKeyPair, myEphemeralKeyPair [, serverPublicSigKey])**
* Throws Error if Salt Channel is not in the 'init' state.
* Throws TypeError if mySigKeyPair or myEphemeralKeyPair does not have properties publicKey and secretKey
* Throws TypeError if publicKey and secretKey properties are not Uint8Arrays of length 32 and 64 bytes respectively
* Throws TypeError if serverPublicSigKey is defined and not a Uint8Array of length 32 bytes.

**sc.send(last, data)**
* Throws Error if Salt Channel is not in the 'ready' state.
* Throws TypeError if data is not ArrayBuffer or Uint8Array or an array where all elements are ArrayBuffer or Uint8Array.
* Throws RangeError if the number of messages exceeds 65535.
* Throws RangeError if the size of a single message exceeds 65535 bytes when there are more than one message.

**sc.send(last, msg1, msg2, ...)**
* Throws Error if Salt Channel is not in the 'ready' state.
* Throws TypeError if msgK is not ArrayBuffer or Uint8Array, for k = 1, 2, ...
* Throws RangeError if the number of messages exceeds 65535.
* Throws RangeError if the size of a single message exceeds 65535 bytes when there are more than one message.




Code Example With WebSocket
---------------------------

    import SaltChannel from './saltchannel.js';

    let ws = new WebSocket(uri)
    ws.binaryType = "arraybuffer"

    let sc = SaltChannel(ws)
    sc.setOnA2Response(onA2Response)
    sc.setOnError(onSaltChannelError)
    sc.setOnHandshakeComplete(onHandshakeComplete)
    sc.setOnMessage(onMessage)
    sc.setOnClose(onClose)

    ws.onopen = function(evt) {
        sc.handshake(mySigKeyPair, myEphemeralKeyPair, serverPublicSigKey)
    }

    function onA2Response(prots) {
        // prots is an array of {p1: aString, p2: anotherString }
    }

    function onSaltChannelError(err) {
        // err is an Error object
        // err.message is always set
    }

    function onHandshakeComplete() {
        // Now it's allowed to call sc.send()
        // to send messages to the server
    }

    function onMessage(message) {
        // message is an ArrayBuffer that was sent
        // from the server
    }

    function onClose(status) {
        // status is either 'error' or 'last'
        // depending on why the Salt Channel closed
    }




Testing
-------

The folder js/src-test contains more detailed information about the tests in the readme.md file. 

The implementation is tested using Node.js and a browser. 

The Node.js tests in the folder js/src-test/tests use a mocked WebSocket
and verify against the protocol specification. 
The browser tests communicate with the
[Java reference implementation](https://github.com/assaabloy-ppi/salt-channel) over WebSocket.
