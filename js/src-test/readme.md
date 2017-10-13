Test Coverage
=============

A1A2 Session Tests
------------------

The following tests only tests the A1A2 functionality. A2 response verification is limited to verifying that the response callback is called with an array of {p1: aString, p1: anotherString} objects and that aString and anotherString are strings of length 10. The error message is verified for all tests where an error should be raised.

1. oneProt - Sends minimal A1 and receives minimal A2. 
2. stateAfterA1A2 - Verifies that the state is 'init' after a completed A1A2 session
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

The following tests test a series of different sessions that start with a Salt Channel handshake.

	let sc = saltchannel(mockSocket, threshold)
	let zeroByte = Uint8Array([0])
	let oneByte = Uint8Array([1])

All bytes are verified. For tests that raise an error the error message is verified. "Handshake" means that a completely new Salt Channel is obtained. "Use sc from X" means that the Salt Channel is reused from the previous test, e.g. in order to be able to test to send or receive a message after an error has occurred. "Send" and "receive" are with respect to the client, i.e. "Receive an AppPacket with [...]" corresponds to the server sending an AppPacket as described.

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
12. handShakeAfterError - Use sc from 11. Handshake. 
13. receiveLastFlag - Handshake. Receive an EncryptedMessage with LastFlag set.
14. stateAfterReceivedLastFlag - Use sc from 13. Verify that Salt Channel is in the init state
15. sendLastFlag - Handshake. Do sc.send(true, zeroByte)
16. stateAfterSentLastFlag - Use sc from 15. Verify that Salt Channel is in the init state
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
