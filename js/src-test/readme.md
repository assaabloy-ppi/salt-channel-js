Test Coverage
=============


Run all of the tests in the folder js/src-test/tests with Node.js like this:

	    node -r esm run.js


A1A2 Session Tests
------------------

*tests/a1a2test.js*

The following tests only tests the A1A2 functionality. A2 response
verification is limited to verifying that the response callback is
called with an array of {p1: aString, p1: anotherString} objects
and that aString and anotherString are strings of length 10. The
error message is verified for all tests where an error should be raised.

1. oneProt - Sends minimal A1 and receives minimal A2.
2. stateAfterA1A2 - Verifies that the state is 'closed' after a completed A1A2 session
3. twoProts - Sends minimal A1 and receives A2 with two protocol tuples
4. maxProts - Sends minimal A1 and receives 127 protocol tuples
5. nonInit - Try to initiate A1A2 before previous A1A2 has finished.
6. badPacketLength - Sends minimal A1 and receives A2 with bad packet length.
7. badPacketHeader1 - Sends minimal A1 and receives A2 with bad packet type in header.
8. badPacketHeader2 - Sends minimal A1 and receives A2 with bad second byte in header.
9. adressPub - Sends A1 with adressType 1 and server public key, receives minimal A2.
10. noSuchServer - Sends A1 with adressType 1 and server public key, receives A2 with NoSuchServer bit set
11. badAdressType - Attempts to do sc.a1a2(2, null). Raises error because the only valid types are 0 and 1
12. badCharInP1 - Sends minimal A1 and receives A2 with a space character in p1
13. badCharInP1 - Sends minimal A1 and receives A2 with a space character in p2
14. badCount1 - Sends minimal A1 and receives A2 with count = 0. Raises error because valid range is [1, 127]
15. badCount2 - Sends minimal A1 and receives A2 with count = 128. Raises error because valid range is [1, 127]





Handshake Session Tests
-----------------------

*tests/handshaketest.js*

The following tests test a series of different sessions that start
with a Salt Channel handshake. Both peers perform all of the
necessary crypto.

	let sc = saltchannel(mockSocket, threshold)
	let zeroByte = Uint8Array([0])
	let oneByte = Uint8Array([1])

All bytes are verified. For tests that raise an error the error message is
verified. "Handshake" means that a completely new Salt Channel is obtained.
"Use sc from X" means that the Salt Channel is reused from the previous
test, e.g. in order to be able to test to send or receive a message after
an error has occurred. "Send" and "receive" are with respect to the client,
i.e. "Receive an AppPacket with [...]" corresponds to the server sending an
AppPacket as described.

1. minimal - Handshake without server public key in M1
2. withServSigKey - Handshake with server public key in M1
3. sendAppPacket1 - Handshake. Do sc.send(false, zeroByte)
4. sendAppPacket2 - Handshake. Do sc.send(false, [zeroByte])
5. receiveAppPacket - Handshake. Receive an AppPacket with data = zeroByte from "server"
6. sendMultiAppPacket1 - Handshake. Do sc.send(false, [zeroByte, oneByte])
7. sendMultiAppPacket2 - Handshake. Do sc.send(false, zeroByte, oneByte)
8. receiveMultiAppPacket - Handshake. Receive a MultiAppPacket with zeroByte and oneByte from "server"
9. receiveBadEncryption - Handshake. Receive an undecrypteable encrypted message from "server".
10. receiveAfterError - Use sc from 9. Receive an AppPacket with data = zeroByte from "server"
11. receiveDelayed - Handshake, threshold = 20 ms. Receive an AppPacket with time = 2.
12. handShakeAfterError - Use sc from 11. Handshake. Verify message on thrown Error
13. receiveLastFlag - Handshake. Receive an EncryptedMessage with LastFlag set.
14. stateAfterReceivedLastFlag - Use sc from 13. Verify that Salt Channel is in the closed state
15. sendLastFlag - Handshake. Do sc.send(true, zeroByte)
16. stateAfterSentLastFlag - Use sc from 15. Verify that Salt Channel is in the closed state
17. withBadServSigKey - Handshake with server public key in M1 as 32 bytes of zero
18. receiveBadHeaderEnc1 - Handshake. Receive encrypted message with packet type = 1
19. receiveBadHeaderEnc2 - Handshake. Receive encrypted message with second header byte = 2
20. receiveBadHeaderApp1 - Handshake. Receive message with packet type = 0
21. receiveBadHeaderApp2 - Handshake. Receive AppPacket with second header byte = 1
22. receiveBadHeaderApp3 - Handshake. Receive MultiAppPacket with second byte = 1
23. receiveBadHeaderM21 - Begin handshake. Receive M2 with packet type = 3
24. receiveBadHeaderM21 - Begin handshake. Receive M2 with second header byte = 50
25. receiveBadTimeM2 - Begin handshake. Receive M2 with time = 20
26. receiveBadHeaderM31 - Begin handshake. Receive M3 with packet type = 0
27. receiveBadHeaderM32 - Begin handshake. Receive M3 with second byte = 1
28. receiveBadHeaderM33 - Begin handshake with server sig key. Receive M3 with unexpected server sig key.
29. receiveBadHeaderM34 - Begin handshake. Receive M3 with bad server sig key. Signature verification error.
30. receiveBadPubEph - Begin handshake. Receive bad public ephemeral. Server and client computes different session keys. Decryption error in M3.





Example Session Tests
---------------------

*tests/sessiontest.js*

With data as generated by saltchannel.dev.ExampleSessionN. Only the client
side performs any crypto. The server side verifies messages against ArrayBuffers.

	client signature key pair:
    	sec: 55f4d1d198093c84de9ee9a6299e0f6891c2e1d0b369efb592a9e3f169fb0f795529ce8ccf68c0b8ac19d437ab0f5b32723782608e93c6264f184ba152c2357b
    	pub: 5529ce8ccf68c0b8ac19d437ab0f5b32723782608e93c6264f184ba152c2357b
	client encryption key pair:
    	sec: 77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a
    	pub: 8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a
	server signature key pair:
    	sec: 7a772fa9014b423300076a2ff646463952f141e2aa8d98263c690c0d72eed52d07e28d4ee32bfdc4b07d41c92193c0c25ee6b3094c6296f373413b373d36168b
    	pub: 07e28d4ee32bfdc4b07d41c92193c0c25ee6b3094c6296f373413b373d36168b
	server encryption key pair:
    	sec: 5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb
    	pub: de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f

    session key: 1b27556473e985d462cd51197a9a46c76009549eac6474f206c4ee0844f68389

1. Handshake, request, response with LastFlag set. Time fields set to zero.

	request data:  010505050505
	response data: 010505050505

2. A1A2 session. Pubkey adress type. One prot in response.

	A1: AdressType = 1. Adress = [0x080808...] (32 bytes)
	A2: p1='SCv2------', p2='ECHO------'.

3. Handshake, request, response, request, response with LastFlag set. Time fields are 1, 2, 3, 4 for each peers messages.

	M1 time: 1
	M2 time: 1
	M3 time: 2
	M4 time: 2
	request data: 010505050505, time: 3
	response data: 010505050505, time: 3
	request data: 0104040404, 03030303, time: 4
	response data: 0104040404, 03030303, time: 4

4. Handshake with server sig key included, request, response with LastFlag set. Time fields set to zero.

	M1: ServerSigKeyIncluded: 1, ServerSigKey: 0x07e28d4ee32bfdc4b07d41c92193c0c25ee6b3094c6296f373413b373d36168b
	request data:  010505050505
	response data: 010505050505





Tests in browser
----------------

*browsertests/test.js*

Tests are run in the browser by opening index.html.

Due to the same-origin policy limitations files have to be served from 
localhost HTTP server e.g. [Chrome Web Server](https://github.com/kzahel/web-server-chrome) or,
in case of Firefox, the policy needs to be disabled:

    about:config -> security.fileuri.strict_origin_policy -> false

To run the tests make sure that /salt-channel/src-x/saltchannelx/ws/WsTestServer.java
in the [Java reference implementation](https://github.com/assaabloy-ppi/salt-channel)
is running on the localhost, then open the index.html file in a browser.
The index.html file imports and executes the *run* function from test.js ES6 module.

Test outcomes are written to the JavaScript console. The following tests are run:

1. A1A2 - Initiates an A1A2 session and verifies the prots array in onA2Response
2. AppPacket - Initiates a handshake and sends an AppPacket to the WebSocket server.
3. MultiAppPacket - Sends a MultiAppPacket to the WebSocket server.
4. Last - Sends an AppPacket to the WebSocket server with first byte 0x02, which indicates that the server should respond with the LastFlag set.
