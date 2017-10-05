var saltChannelSession = require('./../../src/saltchannel.js');
var util = require('./../../lib/util.js');

let mockSocket = {};
mockSocket.send = validateA1;
let sendA2;

let currentTest;
let passCount = 0;
let testCount = 0;

let expectedProtCount;
let byteZero = 9;
let byteOne = 1;
let badLength;
let badByte;

exports.run = () => {
	console.log("======= A1A2 TESTS STARTING =======");
	currentTest = "oneProt";
	runTest(send1Prot);
	
	currentTest = "twoProts";
	runTest(send2Prots);
	
	currentTest = "maxProts";
	runTest(send127Prots); 
	
	currentTest = "badPacketLength";
	runTest(sendBadPacketLength, badPacketLengthError);
	
	currentTest = "badPacketHeader1";
	runTest(sendBadPacketHeader1, badPacketHeaderError1);
	
	currentTest = "badPacketHeader2";
	runTest(sendBadPacketHeader2, badPacketHeaderError2);

	if (passCount === testCount) {
		console.log("======= ALL A1A2 TESTS PASSED! =======\n");
	} else {
		console.log("======= " + passCount + "/" + testCount +
			 " OF A1A2 TESTS PASSED! =======\n")
	}
}

function runTest(send, onErrorCallback) {
	testCount++;
	sendA2 = send;
	
	let sc = saltChannelSession(mockSocket);
	sc.setOnA2Response(onA2Response);
	sc.setOnerror(onErrorCallback);
	sc.a1a2();
}

/*
 * Creates a minimal correct A2 message containing a single
 * protocol tuple
 */
function send1Prot() {
	let a2 = new Uint8Array(23);
	
	expectedProtCount = 1;
	
	a2[0] = byteZero; // Packet type
	a2[1] = byteOne; // LastFlag
	a2[2] = expectedProtCount; // Count
	
	let p1 = "SC2-------";
	let p2 = "----------";
	
	for (let i = 0; i < 10; i++) {
		a2[3+i] = p1.charCodeAt(i);
		a2[13+i] = p2.charCodeAt(i);
	}
	
	let evt = {};
	evt.data = a2;
	mockSocket.onmessage(evt);
}

/*
 * Creates an A2 message containing two protocol tuples
 */
function send2Prots() {
	let a2 = new Uint8Array(43);
	
	expectedProtCount = 2;
	
	a2[0] = byteZero; // Packet type
	a2[1] = byteOne; // LastFlag
	a2[2] = expectedProtCount; // Count
	
	let p11 = "SC2-------";
	let p12 = "----------";
	let p21 = "SC3-------";
	let p22 = "unicorns--";
	
	for (let i = 0; i < 10; i++) {
		a2[3+i] = p11.charCodeAt(i);
		a2[13+i] = p12.charCodeAt(i);
		a2[23+i] = p21.charCodeAt(i);
		a2[33+i] = p22.charCodeAt(i);
	}
	
	let evt = {};
	evt.data = a2;
	mockSocket.onmessage(evt);
}

/*
 * Creates an A2 message containing 127 protocol tuples
 */
function send127Prots() {
	let a2 = new Uint8Array(2543);
	
	expectedProtCount = 127;
	
	a2[0] = byteZero; // Packet type
	a2[1] = byteOne; // LastFlag
	a2[2] = expectedProtCount; // Count
	
	let p1 = "SC2-------";
	let p2 = "----------";

	
	for (let i = 0; i < 127; i++) {
		for (let j = 0; j < 10; j++) {
			a2[3+10*i+j] = p1.charCodeAt(j);
			a2[13+10*i+j] = p2.charCodeAt(j);
		}
	}
	
	let evt = {};
	evt.data = a2;
	mockSocket.onmessage(evt);
}


function sendBadPacketLength() {
	badLength = 25;
	let a2 = new Uint8Array(badLength);
	
	expectedProtCount = 1;
	
	a2[0] = byteZero; // Packet type
	a2[1] = byteOne; // LastFlag
	a2[2] = expectedProtCount; // Count
	
	let p1 = "SC2-------";
	let p2 = "----------";
	
	for (let i = 0; i < 10; i++) {
		a2[3+i] = p1.charCodeAt(i);
		a2[13+i] = p2.charCodeAt(i);
	}
	
	let evt = {};
	evt.data = a2;
	mockSocket.onmessage(evt);
}

function sendBadPacketHeader1() {
	badByte = 0;
	let a2 = new Uint8Array(badLength);
	
	expectedProtCount = 1;
	
	a2[0] = badByte; // Packet type
	a2[1] = byteOne; // LastFlag
	a2[2] = expectedProtCount; // Count
	
	let p1 = "SC2-------";
	let p2 = "----------";
	
	for (let i = 0; i < 10; i++) {
		a2[3+i] = p1.charCodeAt(i);
		a2[13+i] = p2.charCodeAt(i);
	}
	
	let evt = {};
	evt.data = a2;
	mockSocket.onmessage(evt);
}

function sendBadPacketHeader2() {
	badByte = 0;
	let a2 = new Uint8Array(badLength);
	
	expectedProtCount = 1;
	
	a2[0] = byteZero; // Packet type
	a2[1] = badByte; // LastFlag
	a2[2] = expectedProtCount; // Count
	
	let p1 = "SC2-------";
	let p2 = "----------";
	
	for (let i = 0; i < 10; i++) {
		a2[3+i] = p1.charCodeAt(i);
		a2[13+i] = p2.charCodeAt(i);
	}
	
	let evt = {};
	evt.data = a2;
	mockSocket.onmessage(evt);
}



/*
 * Validates A1 message.
 * Always {0x08, 0x00}
 */
function validateA1(message) {
	let a1 = new Uint8Array(message);
	let success = true;
	let msg = "";
	
	if (a1.length !== 2) {
		success = false;
		msg += "  Invalid A1 length. Expected 2, was " + a1.length + "\n";
	}
	
	if (a1[0] !== 8) {
		success = false;
		msg += "  Invalid first byte. Expected 8, was " + a1[0] + "\n";
	}
	
	if (a1[1] !== 0) {
		success = false;
		msg += "  Invalid second byte. Expected 0, was " + a1[1] + "\n";
	}
	
	if (!success) {
		outcome(success, msg);
		return;
	}
	
	sendA2();
}

/*
 * Checks the following properties of return value from reading A2
 * 		The expected number of array elements were returned
 *		The array elements contain members p1 and p2 that are strings
 *		The p1 and p2 strings are of length 10
 */
function onA2Response(prots) {
	let success;
	let msg = "";
	if (prots.length !== expectedProtCount ) {
		msg = "  Expected " + expectedProtCount + " protocol tuples, got " + prots.length;
		success = false;
	} else {
		success = true;
		for (let i = 0; i < prots.length; i++) {
			let p1 = prots[i].p1;
			let p2 = prots[i].p2;
			if (!util.isString(p1)) {
				msg += "  p1 of element " + i + " is not a string\n";
				success = false;
			} else {
				if (p1.length != 10) {
					msg += "  p1 of element " + i + " has bad length: " + p1.length + "\n";
					success = false;
				}
			}
			if (!util.isString(p2)) {
				msg += "  p2 of element " + i + " is not a string\n";
				success = false;
			} else {
				if (p2.length != 10) {
					msg += "  p2 of element " + i + " has bad length: " + p2.length + "\n";
					success = false;
				}
			}
		}
		
	}
	
	outcome(success, msg);
}

function badPacketLengthError(msg) {
	let success;
	if (msg === "SaltChannel error: Bad packet length: " + badLength) {
		success = true;
	} else {
		success = false;
	}
	
	let message = "  " + msg;
	outcome(success, message);
}

function badPacketHeaderError1(msg) {
	let success;
	if (msg === "SaltChannel error: Unsuspected packet type, expected 9, was: " + badByte) {
		success = true;
	} else {
		success = false;
	}
	
	let message = "  " + msg;
	outcome(success, message);
}

function badPacketHeaderError2(msg) {
	let success;
	if (msg === "SaltChannel error: Bad second header byte. Must be 1, was: " + badByte) {
		success = true;
	} else {
		success = false;
	}
	
	let message = "  " + msg;
	outcome(success, message);
}



/*
 * Prints outcome of current test
 */
function outcome(success, msg) {
	if (success) {
		passCount++;
		console.log(currentTest + " PASSED");
	} else {
		console.log(currentTest + " FAILED! \n" + msg);
	}
}

