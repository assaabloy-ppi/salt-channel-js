import saltChannelSession from './../../src/saltchannel.js';
import * as util from './../../lib/util.js';
import nacl from './../../lib/nacl-fast-es.js';

let serverSecret =
	util.hex2Uint8Array('7a772fa9014b423300076a2ff646463952f141e2aa8d98263c690c0d72eed52d' +
						'07e28d4ee32bfdc4b07d41c92193c0c25ee6b3094c6296f373413b373d36168b')

let serverSigKeyPair = nacl.sign.keyPair.fromSecretKey(serverSecret)

let mockSocket = {
	close: closeMockSocket,
	readyState: 1
}

function closeMockSocket() {
	mockSocket.readyState = 3
}

let sendA2
let sc

let currentTest
let passCount = 0
let testCount = 0

let expectedProtCount
let byteZero = 9
let byteOne = 128
let badLength
let badByte
let errorMsg

exports.run = () => {
	console.log('======= A1A2 TESTS STARTING =======')

	mockSocket.send = validateA1Any
	currentTest = 'oneProt'
	runTest(send1Prot)

	currentTest = 'stateAfterA1A2'
	stateAfterA1A2()

	currentTest = 'twoProts'
	runTest(send2Prots)

	currentTest = 'maxProts'
	runTest(send127Prots)

	currentTest = 'nonInit'
	errorMsg = 'A1A2: Invalid internal state: a1a2'
	runTest(sendOnBadState)

	currentTest = 'badPacketLength'
	errorMsg = 'A2: Expected packet length 23 was 43'
	runTest(sendBadPacketLength)

	currentTest = 'badPacketHeader1'
	errorMsg = 'A2: Bad packet header. Expected 9 128, was 0 128'
	runTest(sendBadPacketHeader1)

	currentTest = 'badPacketHeader2'
	errorMsg = 'A2: Bad packet header. Expected 9 128, was 9 0'
	runTest(sendBadPacketHeader2)

	mockSocket.send = validateA1Pub
	currentTest = 'addressPub'
	runTest(send1Prot, 1, serverSigKeyPair.publicKey)

	mockSocket.send = validateA1ZeroPub
	currentTest = 'noSuchServer'
	errorMsg = 'A2: NoSuchServer exception'
	runTest(sendNoSuchServer, 1, new Uint8Array(32))

	mockSocket.send = null
	currentTest = 'badAdressType'
	errorMsg = 'A1A2: Unsupported adress type: 2'
	runTest2(null, 2, null)

	mockSocket.send = validateA1Any
	currentTest = 'badCharInP1'
	errorMsg = 'A2: Invalid char in p1 " "'
	runTest(sendBadCharInP1)

	currentTest = 'badCharInP2'
	errorMsg = 'A2: Invalid char in p2 " "'
	runTest(sendBadCharInP2)

	currentTest = 'badCount1'
	errorMsg = 'A2: Count must be in range [1, 127], was: 0'
	runTest(sendBadCount1)

	currentTest = 'badCount2'
	errorMsg = 'A2: Count must be in range [1, 127], was: 128'
	runTest(sendBadCount2)


	if (passCount === testCount) {
		console.log('======= ALL ' + testCount + ' A1A2 TESTS PASSED! =======\n')
	} else {
		console.log('======= ' + passCount + '/' + testCount +
			 ' OF A1A2 TESTS PASSED! =======\n')
	}
}

function runTest(send, adressType, adress) {
	testCount++
	sendA2 = send
	mockSocket.readyState = 1

	sc = saltChannelSession(mockSocket)
	sc.setOnA2Response(onA2Response)
	sc.setOnError(onError)
	sc.setOnClose(doNothing)
	sc.a1a2(adressType, adress)
}

function runTest2(send, adressType, adress) {
	testCount++
	sendA2 = send

	sc = saltChannelSession(mockSocket)
	sc.setOnA2Response(onA2Response)
	sc.setOnError(onError)
	sc.setOnClose(doNothing)
	let success = false
	try {
		sc.a1a2(adressType, adress)
	} catch (err) {
		if (err.message === errorMsg) {
			success = true
		}
	}
	outcome(success, errorMsg)
}

function doNothing() {
	// Do nothing
}

/*
 * Creates a minimal correct A2 message containing a single
 * protocol tuple
 */
function send1Prot() {
	let a2 = new Uint8Array(23)

	expectedProtCount = 1

	a2[0] = byteZero // Packet type
	a2[1] = byteOne // LastFlag
	a2[2] = expectedProtCount // Count

	let p1 = 'SCc2------'
	let p2 = '----------'

	for (let i = 0; i < 10; i++) {
		a2[3+i] = p1.charCodeAt(i)
		a2[13+i] = p2.charCodeAt(i)
	}

	let evt = {}
	evt.data = a2.buffer
	mockSocket.onmessage(evt)
}

/*
 * Creates an A2 message containing two protocol tuples
 */
function send2Prots() {
	let a2 = new Uint8Array(43)

	expectedProtCount = 2

	a2[0] = byteZero // Packet type
	a2[1] = byteOne // LastFlag
	a2[2] = expectedProtCount // Count

	let p11 = 'SCv2------'
	let p12 = '-._AZaz9--'
	let p21 = 'SCv3------'
	let p22 = 'unicorns--'

	for (let i = 0; i < 10; i++) {
		a2[3+i] = p11.charCodeAt(i)
		a2[13+i] = p12.charCodeAt(i)
		a2[23+i] = p21.charCodeAt(i)
		a2[33+i] = p22.charCodeAt(i)
	}

	let evt = {}
	evt.data = a2.buffer
	mockSocket.onmessage(evt)
}

/*
 * Creates an A2 message containing 127 protocol tuples
 */
function send127Prots() {
	let a2 = new Uint8Array(2543)

	expectedProtCount = 127

	a2[0] = byteZero // Packet type
	a2[1] = byteOne // LastFlag
	a2[2] = expectedProtCount // Count

	let p1 = 'SCv2------'
	let p2 = '----------'


	for (let i = 0; i < 127; i++) {
		for (let j = 0; j < 10; j++) {
			a2[3+10*i+j] = p1.charCodeAt(j)
			a2[13+10*i+j] = p2.charCodeAt(j)
		}
	}

	let evt = {}
	evt.data = a2.buffer
	mockSocket.onmessage(evt)
}


function sendBadPacketLength() {
	badLength = 43
	let a2 = new Uint8Array(badLength)

	expectedProtCount = 1

	a2[0] = byteZero // Packet type
	a2[1] = byteOne // LastFlag
	a2[2] = expectedProtCount // Count

	let p1 = 'SCv2------'
	let p2 = '----------'

	for (let i = 0; i < 10; i++) {
		a2[3+i] = p1.charCodeAt(i)
		a2[13+i] = p2.charCodeAt(i)
	}

	let evt = {}
	evt.data = a2.buffer
	mockSocket.onmessage(evt)
}

function sendBadPacketHeader1() {
	badByte = 0
	let a2 = new Uint8Array(23)

	expectedProtCount = 1

	a2[0] = badByte // Packet type
	a2[1] = byteOne // LastFlag
	a2[2] = expectedProtCount // Count

	let p1 = 'SCv2------'
	let p2 = '----------'

	for (let i = 0; i < 10; i++) {
		a2[3+i] = p1.charCodeAt(i)
		a2[13+i] = p2.charCodeAt(i)
	}

	let evt = {}
	evt.data = a2.buffer
	mockSocket.onmessage(evt)
}

function sendBadPacketHeader2() {
	badByte = 0
	let a2 = new Uint8Array(23)

	expectedProtCount = 1

	a2[0] = byteZero // Packet type
	a2[1] = badByte // LastFlag
	a2[2] = expectedProtCount // Count

	let p1 = 'SCv2------'
	let p2 = '----------'

	for (let i = 0; i < 10; i++) {
		a2[3+i] = p1.charCodeAt(i)
		a2[13+i] = p2.charCodeAt(i)
	}

	let evt = {}
	evt.data = a2.buffer
	mockSocket.onmessage(evt)
}


function sendNoSuchServer() {
	let a2 = new Uint8Array(3)
	a2[0] = 9
	a2[1] = 129
	let evt = {data: a2.buffer}

	mockSocket.onmessage(evt)
}

function sendOnBadState() {
	let success = false
	try {
		sc.a1a2()
	} catch (err) {
		if (err.message === errorMsg) {
			success = true
		}
	}
	outcome(success, 'Expected error to be thrown')
}

function sendBadCharInP1() {
	let a2 = new Uint8Array(23)

	expectedProtCount = 1

	a2[0] = byteZero // Packet type
	a2[1] = byteOne // LastFlag
	a2[2] = expectedProtCount // Count

	let p1 = 'SCv2 -----'
	let p2 = '----------'

	for (let i = 0; i < 10; i++) {
		a2[3+i] = p1.charCodeAt(i)
		a2[13+i] = p2.charCodeAt(i)
	}

	let evt = {}
	evt.data = a2.buffer
	mockSocket.onmessage(evt)
}

function sendBadCharInP2() {
	let a2 = new Uint8Array(23)

	expectedProtCount = 1

	a2[0] = byteZero // Packet type
	a2[1] = byteOne // LastFlag
	a2[2] = expectedProtCount // Count

	let p1 = 'SCv2------'
	let p2 = '--- ------'

	for (let i = 0; i < 10; i++) {
		a2[3+i] = p1.charCodeAt(i)
		a2[13+i] = p2.charCodeAt(i)
	}

	let evt = {}
	evt.data = a2.buffer
	mockSocket.onmessage(evt)
}

function sendBadCount1() {
	let a2 = new Uint8Array(3)

	expectedProtCount = 0

	a2[0] = byteZero // Packet type
	a2[1] = byteOne // LastFlag
	a2[2] = expectedProtCount // Count

	let evt = {}
	evt.data = a2.buffer
	mockSocket.onmessage(evt)
}

function sendBadCount2() {
	let a2 = new Uint8Array(23)

	expectedProtCount = 128

	a2[0] = byteZero // Packet type
	a2[1] = byteOne // LastFlag
	a2[2] = expectedProtCount // Count

	let evt = {}
	evt.data = a2.buffer
	mockSocket.onmessage(evt)
}

/*
 * Validates A1 message.
 * Always {0x08, 0x00}
 */
function validateA1Any(message) {
	let a1 = new Uint8Array(message)
	let success = true
	let msg = ''

	if (a1.length !== 5) {
		success = false
		msg += '  Invalid A1 length. Expected 5, was ' + a1.length + '\n'
	}

	if (a1[0] !== 8) {
		success = false
		msg += '  Invalid first byte. Expected 8, was ' + a1[0] + '\n'
	}

	if (a1[1] !== 0) {
		success = false
		msg += '  Invalid second byte. Expected 0, was ' + a1[1] + '\n'
	}

	if (a1[2] !== 0) {
		success = false
		msg += '  Invalid address type. Expected 0, was ' + a1[2]
	}

	if (a1[3] !== 0 || a1[4] !== 0) {
		success = false
		msg += '  Invalid address size. Expected 0 0, was ' +
			 a1[3] + ' ' + a1[4]
	}

	if (!success) {
		outcome(success, msg)
		return
	}

	sendA2()
}

function validateA1Pub(message) {
	let a1 = new Uint8Array(message)
	let success = true
	let msg = ''

	if (a1.length !== 37) {
		success = false
		msg += '  Invalid A1 length. Expected 37, was ' + a1.length + '\n'
	}

	if (a1[0] !== 8) {
		success = false
		msg += '  Invalid first byte. Expected 8, was ' + a1[0] + '\n'
	}

	if (a1[1] !== 0) {
		success = false
		msg += '  Invalid second byte. Expected 0, was ' + a1[1] + '\n'
	}

	if (a1[2] !== 1) {
		success = false
		msg += '  Invalid address type. Expected 1, was ' + a1[2]
	}

	if (a1[3] !== 32 || a1[4] !== 0) {
		success = false
		msg += '  Invalid address size. Expected 32 0, was ' +
			 a1[3] + ' ' + a1[4]
	}

	let pub = new Uint8Array(a1.buffer, 5)
	if (!util.uint8ArrayEquals(pub, serverSigKeyPair.publicKey)) {
		success = false
		msg += '  Unexpected adress'
	}

	if (!success) {
		outcome(success, msg)
		return
	}

	sendA2()
}

function validateA1ZeroPub(message) {
	let a1 = new Uint8Array(message)
	let success = true
	let msg = ''

	if (a1.length !== 37) {
		success = false
		msg += '  Invalid A1 length. Expected 37, was ' + a1.length + '\n'
	}

	if (a1[0] !== 8) {
		success = false
		msg += '  Invalid first byte. Expected 8, was ' + a1[0] + '\n'
	}

	if (a1[1] !== 0) {
		success = false
		msg += '  Invalid second byte. Expected 0, was ' + a1[1] + '\n'
	}

	if (a1[2] !== 1) {
		success = false
		msg += '  Invalid address type. Expected 1, was ' + a1[2]
	}

	if (a1[3] !== 32 || a1[4] !== 0) {
		success = false
		msg += '  Invalid address size. Expected 32 0, was ' +
			 a1[3] + ' ' + a1[4]
	}

	let pub = new Uint8Array(a1.buffer, 5)
	if (!util.uint8ArrayEquals(pub, new Uint8Array(32))) {
		success = false
		msg += '  Unexpected adress'
	}

	if (!success) {
		outcome(success, msg)
		return
	}
	sendA2()
}

/*
 * Checks the following properties of return value from reading A2
 * 		The expected number of array elements were returned
 *		The array elements contain members p1 and p2 that are strings
 *		The p1 and p2 strings are of length 10
 */
function onA2Response(prots) {
	let success
	let msg = ''
	if (prots.length !== expectedProtCount ) {
		msg = '  Expected ' + expectedProtCount + ' protocol tuples, got ' + prots.length
		success = false
	} else {
		success = true
		for (let i = 0; i < prots.length; i++) {
			let p1 = prots[i].p1
			let p2 = prots[i].p2
			if (!util.isString(p1)) {
				msg += '  p1 of element ' + i + ' is not a string\n'
				success = false
			} else {
				if (p1.length != 10) {
					msg += '  p1 of element ' + i + ' has bad length: ' + p1.length + '\n'
					success = false
				}
			}
			if (!util.isString(p2)) {
				msg += '  p2 of element ' + i + ' is not a string\n'
				success = false
			} else {
				if (p2.length != 10) {
					msg += '  p2 of element ' + i + ' has bad length: ' + p2.length + '\n'
					success = false
				}
			}
		}

	}

	outcome(success, msg)
}


function onError(err) {
	let success
	let msg = err.message
	if (msg === errorMsg) {
		success = true
	} else {
		success = false
	}

	outcome(success, '  ' + msg)
}


function stateAfterA1A2() {
	testCount++
	if (sc.getState() === 'closed') {
		outcome(true)
	} else {
		outcome(false, '  Invalid state after A1A2: ' + sc.getState())
	}
}


/*
 * Prints outcome of current test
 */
function outcome(success, msg) {
	if (success) {
		passCount++
		//console.log(currentTest + ' PASSED')
	} else {
		console.log(currentTest + ' FAILED! \n' + msg)
	}
}

