'use-strict'

var saltChannelSession = require('./../../src/saltchannel.js')
var nacl = require('./../../lib/nacl-fast.js')
var util = require('./../../lib/util.js')
 
let clientSecret = 
	util.hex2Uint8Arr('fd2956eb37782aabddc97eaf3b9e1b075f4976770db56c11e866e8763fa073d8' +
						'9cace2ed6af2e108bbabc69c0bb7f3e62a4c0bf59ac2296811a09e480bf7b0f7')
let clientSigKeyPair = nacl.sign.keyPair.fromSecretKey(clientSecret)
let clientEphKeyPair = {
	publicKey: util.hex2Uint8Arr('159205ede53fe5334eaf26f15f80710453b6600e6df5c96bfb85dd593c86cf4f'),
	secretKey: util.hex2Uint8Arr('e9f639ffd6cc1c1edd5ba28e0aecbbe15ad88478dbfcebc09ad80300880a3fa2')
	}

let serverSecret = 
	util.hex2Uint8Arr('7a772fa9014b423300076a2ff646463952f141e2aa8d98263c690c0d72eed52d' +
						'07e28d4ee32bfdc4b07d41c92193c0c25ee6b3094c6296f373413b373d36168b')
let serverSigKeyPair = nacl.sign.keyPair.fromSecretKey(serverSecret)
let serverEphKeyPair = {
	publicKey: util.hex2Uint8Arr('354200647ecfbcb1d5feeb7b2f59127fe1278ab4a632b505691f9a2f6a465065'),
	secretKey: util.hex2Uint8Arr('942d5f9bb23b8380ce9a86ae52600ec675b922b64b1b294c8f94c44255a26fe0')
	}


let mockSocket = {}
let sessionKey
let eNonce
let dNonce

let cEpoch
let sEpoch
let threshold 

let sc
let m1Hash
let m2Hash
const SIG_STR_1 = 'SC-SIG01'
const SIG_STR_2 = 'SC-SIG02'

let sigBytes1 = new Uint8Array([ SIG_STR_1.charCodeAt(0)
							,SIG_STR_1.charCodeAt(1)
							,SIG_STR_1.charCodeAt(2)
							,SIG_STR_1.charCodeAt(3)
							,SIG_STR_1.charCodeAt(4)
							,SIG_STR_1.charCodeAt(5)
							,SIG_STR_1.charCodeAt(6)
							,SIG_STR_1.charCodeAt(7)])

let sigBytes2 = new Uint8Array([ SIG_STR_2.charCodeAt(0)
							,SIG_STR_2.charCodeAt(1)
							,SIG_STR_2.charCodeAt(2)
							,SIG_STR_2.charCodeAt(3)
							,SIG_STR_2.charCodeAt(4)
							,SIG_STR_2.charCodeAt(5)
							,SIG_STR_2.charCodeAt(6)
							,SIG_STR_2.charCodeAt(7)])

let currentTest
let m4Delayed
let passCount = 0
let testCount = 0
let multiAppPacketCount = 0
let multiAppPacketFailed = false
let lastFlag


exports.run = () => {
	console.log('======= HANDSHAKE TESTS STARTING! =======')
	currentTest = 'testNoServSigKey'
	runTest(onHandshakeComplete, validateM1NoServSigKey)
	
	currentTest = 'testWithServSigKey'
	runTest(onHandshakeComplete, validateM1WithServSigKey, serverSigKeyPair.publicKey)

	currentTest = 'testWithAppPacket'
	runTest(echoAppMessage, validateM1NoServSigKey)
	
	currentTest = 'testWithMultiAppPacket'
	runTest(echoMultiAppMessage, validateM1NoServSigKey)
	
	currentTest = 'testWithBadEncryption'
	runTest(receiveBadEncryption, validateM1NoServSigKey)
	
	currentTest = 'testReceiveAfterBadEncryption'
	testCount++
	receiveAfterBadEncryption()
	
	currentTest = 'testWithDelayed'
	threshold = 20
	runTest(receiveDelayed, validateM1NoServSigKey)
	
	currentTest = 'testReceiveAfterDelayed'
	testCount++
	receiveAfterDelayed()
	
	currentTest = 'testreuseOldSaltChannel'
	reuseOldSaltChannel(onHandshakeComplete, validateM1NoServSigKey)
	
	currentTest = 'testLastFlag'
	testCount++
	receiveLastFlag()
	
	currentTest = 'testStateAfterLastFlag'
	testCount++
	stateAfterLastFlag()
	
	currentTest = 'testSendLastFlag'
	runTest(sendLastFlag, validateM1NoServSigKey)
	
	currentTest = 'testStateAfterSentLastFlag'
	testCount++
	stateAfterLastFlag()
		
	if (passCount === testCount) {
		console.log('======= ALL ' + testCount + ' HANDSHAKE TESTS PASSED! =======\n')
	} else {
		console.log('======= ' + passCount + '/' + testCount +
			 ' OF HANDSHAKE TESTS PASSED! =======\n')
	}
}

function runTest(handshakeCompleteCb, validateM1, sigKey) {
	testCount++
	
	eNonce = new Uint8Array(nacl.secretbox.nonceLength)
	dNonce = new Uint8Array(nacl.secretbox.nonceLength)
	eNonce[0] = 2
	dNonce[0] = 1
	m4Delayed = false
	lastFlag = false
	
	mockSocket.send = validateM1
	
	sc = saltChannelSession(mockSocket, threshold)
	sc.setOnHandshakeComplete(handshakeCompleteCb)
	
	sc.handshake(clientSigKeyPair, clientEphKeyPair, sigKey)	
}

function reuseOldSaltChannel(handshakeCompleteCb, validateM1) {
	testCount++
	eNonce = new Uint8Array(nacl.secretbox.nonceLength)
	dNonce = new Uint8Array(nacl.secretbox.nonceLength)
	eNonce[0] = 2
	dNonce[0] = 1
	m4Delayed = false
	
	mockSocket.send = validateM1
	
	sc.setOnHandshakeComplete(handshakeCompleteCb)
		
	sc.handshake(clientSigKeyPair, clientEphKeyPair)
}

function validateM1NoServSigKey(message) {
	let m1 = new Uint8Array(message)
	
	if (m1.length !== 42) {
		outcome(false, '  Bad packet length, expected 42, was ' + m1.length)
		return
	}
	
	let protocol = String.fromCharCode(m1[0])
	protocol += String.fromCharCode(m1[1])
	protocol += String.fromCharCode(m1[2])
	protocol += String.fromCharCode(m1[3])
	
	if (protocol !== 'SCv2') {
		outcome(false, '  Bad protocol indicator: ' + protocol)
		return
	}
	
	if (m1[4] !== 1) {
		outcome(false, '  Invalid packet type, expected 1, was ' + m1[4])
		return
	}
	
	if(m1[5] !== 0) {
		outcome(false, '  Unexpected server sig key included, expected 0, was ' + m1[5])
		return
	}
		
	if (!(m1[6] === 1 && m1[7] === 0 &&
		m1[8] === 0 && m1[9] === 0)) {
		outcome(false, '  M1: Expected time to be set')
		return 
	} 
	
	cEpoch = util.currentTimeMs()
	
	let publicEphemeral = new Uint8Array(m1.buffer, 10)
	
	if (!util.uint8ArrayEquals(publicEphemeral, clientEphKeyPair.publicKey)) {
		outcome(false, '  Unexpected public ephemeral key from client')
		return
	}
	
	sessionKey = nacl.box.before(publicEphemeral, serverEphKeyPair.secretKey)
	
	m1Hash = nacl.hash(m1)

	sendM2()
}

function validateM1WithServSigKey(message) {
	let bytes = new Uint8Array(message)
	
	if (bytes.length !== 74) {
		outcome(false, '  Bad packet length, expected 42, was ' + bytes.length)
		return
	}
	
	let protocol = String.fromCharCode(bytes[0])
	protocol += String.fromCharCode(bytes[1])
	protocol += String.fromCharCode(bytes[2])
	protocol += String.fromCharCode(bytes[3])
	
	if (protocol !== 'SCv2') {
		outcome(false, '  Bad protocol indicator: ' + protocol)
		return
	}
	
	if (bytes[4] !== 1) {
		outcome(false, '  Invalid packet type, expected 1, was ' + bytes[4])
		return
	}
	
	if(bytes[5] !== 128) {
		outcome(false, '  Unexpected server sig key included, expected 128, was ' + bytes[5])
		return
	}
		
	if (!(bytes[6] === 1 && bytes[7] === 0 &&
		bytes[8] === 0 && bytes[9] === 0)) {
		outcome(false, '  M1: Expected time to be set')
		return 
	} 
	
	cEpoch = util.currentTimeMs()
	
	let publicEphemeral = new Uint8Array(bytes.buffer, 10, 32)
	
	if (!util.uint8ArrayEquals(publicEphemeral, clientEphKeyPair.publicKey)) {
		outcome(false, '  Unexpected public ephemeral key from client')
		return
	}
	
	let serverSigKey = new Uint8Array(bytes.buffer, 42, 32)
	if (!util.uint8ArrayEquals(serverSigKey, serverSigKeyPair.publicKey)) {
		outcome(false, '  Unexpected server sig key from client')
		return
	}
	
	sessionKey = nacl.box.before(publicEphemeral, serverEphKeyPair.secretKey)
	
	m1Hash = nacl.hash(bytes)

	sendM2()
}

function sendM2() {
	let m2 = new Uint8Array(38)
	
	m2[0] = 2
	
	// Time is supported
	m2[2] = 1
	
	for(let i = 0; i < 32; i++) {
		m2[6+i] = serverEphKeyPair.publicKey[i]
	}
	
	m2Hash = nacl.hash(m2)
	
	sEpoch = util.currentTimeMs()
	
	let evt = {data: m2}
	mockSocket.onmessage(evt)
	
	sendM3()
}

function sendM3() {
	m3 = new Uint8Array(102)

	m3[0] = 3

	for (let i = 0; i < 32; i++) {
		m3[6+i] = serverSigKeyPair.publicKey[i]
	}
		
	let concat = getConcat(sigBytes1)
	
	let signature = nacl.sign.detached(concat, serverSigKeyPair.secretKey)
	
	for (let i = 0; i < 64; i++) {
		m3[38+i] = signature[i]
	}
	
	let time = new Int32Array([util.currentTimeMs() - sEpoch])
	time = new Uint8Array(time.buffer)
	
	m3[2] = time[0]
	m3[3] = time[1]
	m3[4] = time[2]
	m3[5] = time[3]
	
	let encrypted = encrypt(m3)
	let evt = {data: encrypted}
	mockSocket.send = validateM4
	
	mockSocket.onmessage(evt)
}

function validateM4(message) {
	let encryptedMessage = new Uint8Array(message)
	let m4 = decrypt(encryptedMessage)
	
	if (util.isString(m4)) {
		outcome(false, m4)
		return
	}
	
	if (m4[0] !== 4) {
		outcome(false, '  M4: Bad packet type, expected 4, was ' + m4[0])
		return
	}
	
	if (m4[1] !== 0) {
		outcome(false, '  M4: Bad packet header, expected 0, was ' + m4[1])
		return
	}
	
	if (m4[2] === 0 && m4[3] === 0 
	  && m4[4] === 0 && m4[5] === 0) {
		outcome(false, '  M4: Expected time to be set')
		return
	}
	
	let time = new Uint8Array(4)
	time[0] = m4[2]
	time[1] = m4[3]
	time[2] = m4[4]
	time[3] = m4[5]
	
	time = (new Int32Array(time.buffer))[0]
	
	if (util.currentTimeMs() - cEpoch > time + threshold ) {
		outcome(false, '  M4: Delayed packet')
		m4Delayed = true
		return
	}
	
	let clientSigKey = new Uint8Array(32)
	for (let i = 0; i < 32; i++) {
		clientSigKey[i] = m4[6+i]
	}
	
	if (!util.uint8ArrayEquals(clientSigKey, clientSigKeyPair.publicKey)) {
		outcome(false, '  Client signing key does not match expected')
		return
	}
	
	let signature = new Uint8Array(64)
	for (let i = 0; i < 64; i++) {
		signature[i] = m4[38+i]
	}
	
	let concat = getConcat(sigBytes2)
	
	let success = nacl.sign.detached.verify(concat, signature, clientSigKey)
	
	if (!success) {
		outcome(false, '  Could not verify signature')
		return
	}
	
	
	switch (currentTest) {
		case 'testWithAppPacket':
		case 'testSendOneInArray':
			mockSocket.send = validateAppPacket
			break
		case 'testWithMultiAppPacket':
		case 'testSendAsTwoArgs':
			mockSocket.send = validateMultiAppPacket
			break
	}	
}

function validateAppPacket(message) {
	let encryptedMessage = new Uint8Array(message)
	let appPacket = decrypt(encryptedMessage)
	
	if (appPacket.length !== 7) {
		outcome(false, '  Expected AppPacket.length 7, was ' + appPacket.length)
		return
	}
	if (appPacket[0] !== 5) {
		outcome(false, ' Expected AppPacket type, was ' + appPacket[0])
		return
	}
	if (appPacket[1] !== 0) {
		outcome(false, '  Expected zero byte, was ' + appPacket[1])
		return
	}
	
	let time = new Uint8Array(4)
	time[0] = appPacket[2]
	time[1] = appPacket[3]
	time[2] = appPacket[4]
	time[3] = appPacket[5]
	
	time = (new Int32Array(time.buffer))[0]
	
	if (util.currentTimeMs() - cEpoch > time + threshold ) {
		outcome(false, '  AppPacket delayed')
		return
	}
	
	if (appPacket[6] !== 0) {
		outcome(false, '  Unexpected data, expected 0, was ' + appPacket[6])
		return
	}
	
	outcome(true)
	
	let encrypted;
	switch (currentTest) {
		case 'testWithAppPacket':
			currentTest = 'receiveAppPacket'
			testCount++
			sc.setOnmessage(onAppPacket)
			
			encrypted = encrypt(appPacket)
			let evt = {data: encrypted}
			mockSocket.onmessage(evt)
			break	
	}
	
}

function validateMultiAppPacket(message) {
	let encryptedMessage = new Uint8Array(message)
	let multiAppPacket = decrypt(encryptedMessage)

	if (multiAppPacket.length !== 14) {
		outcome(false, '  Expected MultiAppPacket.length 14, was ' + multiAppPacket.length)
		return
	}
	if (multiAppPacket[0] !== 11) {
		outcome(false, ' Expected MultiAppPacket type, was ' + multiAppPacket[0])
		return
	}
	if (multiAppPacket[1] !== 0) {
		outcome(false, '  Expected zero byte, was ' + multiAppPacket[1])
		return
	}
	
	let time = new Uint8Array(4)
	time[0] = multiAppPacket[2]
	time[1] = multiAppPacket[3]
	time[2] = multiAppPacket[4]
	time[3] = multiAppPacket[5]
	
	time = (new Int32Array(time.buffer))[0]
	
	if (util.currentTimeMs() - cEpoch > time + threshold ) {
		outcome(false, '  MultiAppPacket delayed')
		return
	}
	
	if (multiAppPacket[6] !== 2 || multiAppPacket[7] !== 0) {
		outcome(false, '  Unexpected count, expected 2 0, was ' + 
				appPacket[6] + ' ' + appPacket[7])
		return
	}
	
	if (multiAppPacket[8] !== 1 || multiAppPacket[9] !== 0) {
		outcome(false, '  Unexpected length, expected 1 0, was ' + 
			appPacket[8] + ' ' + appPacket[9])
		return
	}
	
	if (multiAppPacket[10] !== 0) {
		outcome(false, '  Unexpected data, expected 0, was ' + appPacket[9])
		return
	}
	
	if (multiAppPacket[11] !== 1 || multiAppPacket[12] !== 0) {
		outcome(false, '  Unexpected length, expected 1 0, was ' + 
			appPacket[11] + ' ' + appPacket[12])
		return
	}
	
	if (multiAppPacket[13] !== 1) {
		outcome(false, '  Unexpected data, expected 1, was ' + appPacket[9])
		return
	}
	
	outcome(true)
	
	switch (currentTest) {
		case 'testWithMultiAppPacket':
			currentTest = 'receiveMultiAppPacket'
			testCount++
			sc.setOnmessage(onMultiAppPacket)
			
			let encrypted = encrypt(multiAppPacket)
			let evt = {data: encrypted}
			mockSocket.onmessage(evt)
			break
			
	}
}

function validateAppPacketLastFlag(message) {
	let encryptedMessage = new Uint8Array(message)
	let appPacket = decrypt(encryptedMessage)
	
	if (appPacket.length !== 7) {
		outcome(false, '  Expected AppPacket.length 7, was ' + appPacket.length)
		return
	}
	if (appPacket[0] !== 5) {
		outcome(false, ' Expected AppPacket type, was ' + appPacket[0])
		return
	}
	if (appPacket[1] !== 0) {
		outcome(false, '  Expected zero byte, was ' + appPacket[1])
		return
	}
	
	let time = new Uint8Array(4)
	time[0] = appPacket[2]
	time[1] = appPacket[3]
	time[2] = appPacket[4]
	time[3] = appPacket[5]
	
	time = (new Int32Array(time.buffer))[0]
	
	if (util.currentTimeMs() - cEpoch > time + threshold ) {
		outcome(false, '  AppPacket delayed')
		return
	}
	
	if (appPacket[6] !== 0) {
		outcome(false, '  Unexpected data, expected 0, was ' + appPacket[6])
		return
	}
	
	if (lastFlag) {
		outcome(true)
	} else {
		outcome(false, '  Expected lastFlag to have been set')
	}
}

function decrypt(message) {
	if (message[0] === 6 && message[1] === 0) {
		
	} else if (message[0] === 6 && message[1] === 1) {
		lastFlag = true
	} else {
		return '  EncryptedMessage: Bad packet header, was  ' +
				+ message[0] + ' ' + message[1]
	}
	
	let bytes = new Uint8Array(message.byteLength - 2)
	let msg = new Uint8Array(message)
	
	for (let i = 0; i < message.byteLength - 2; i++) {
		bytes[i] = msg[i+2]
	}
			
	let clear = nacl.secretbox.open(bytes, dNonce, sessionKey)
	dNonce = increaseNonce2(dNonce)
	
	if (clear === false) {
		return '  EncryptedMessage: Failed to decrypt'
	}

	let copy = new Uint8Array(clear.length)
	for (let i = 0; i < copy.length; i++) {
		copy[i] = clear[i]
	}
	return copy
}

function encrypt(clearBytes, last = false) {
	let body = nacl.secretbox(clearBytes, eNonce, sessionKey)
	eNonce = increaseNonce2(eNonce)

	let encryptedMessage = new Uint8Array(body.length + 2)
	encryptedMessage[0] = 6
	encryptedMessage[1] = last ? 1 : 0
	
	for (let i = 0; i < body.length; i++) {
		encryptedMessage[2+i] = body[i]
	}

	return encryptedMessage
}

function getConcat(sigBytes) {
	let concat = new Uint8Array(2*nacl.hash.hashLength + 8)
	for (let i = 0; i < 8; i++) {
		concat[i] = sigBytes[i]
	}
	for (let i = 0; i < nacl.hash.hashLength; i++) {
		concat[8+i] = m1Hash[i]
		concat[8+i+nacl.hash.hashLength] = m2Hash[i]
	}
	
	return concat
}

function increaseNonce(nonce) {
	if (!(nonce instanceof Uint8Array)) {
		throw new Error('Expected Uint8Array. \n\t' +
					'Input: ' + nonce)
	}
	if (!(nonce.length === nacl.secretbox.nonceLength)) {
		throw new Error('Unexpected nonce length. \n\t' +
					'Length: ' + nonce.length)
	}
	nonce[0] += 1 // nonces are little endian
	for (let i = 0; i < 7; i++) {
		if (nonce[i] === 0) {
			nonce[i+1] += 1
		} else {
			break
		}
	}
	return nonce
}


function increaseNonce2(nonce) {
	nonce = increaseNonce(nonce)
	nonce = increaseNonce(nonce)
	return nonce
}

function echoAppMessage() {
	if (sc.getState() !== 'ready') {
		outcome(false, 'Status: ' + sc.getStatus)
		return;
	} 
	sc.send(false, new Uint8Array([0]))
	currentTest = 'testSendOneInArray'
	testCount++
	sc.send(false, [new Uint8Array([0])])
}

function echoMultiAppMessage() {
	if (sc.getState() !== 'ready') {
		outcome(false, 'Status: ' + sc.getStatus)
		return;
	} 
	sc.send(false, [new Uint8Array([0]), new Uint8Array([1])])
	currentTest = 'testSendAsTwoArgs'
	testCount++
	sc.send(false, new Uint8Array([0]), new Uint8Array([1]))
}

function receiveBadEncryption() {
	if (sc.getState() !== 'ready') {
		outcome(false, 'Status: ' + sc.getStatus())
		return;
	} 
	
	sc.setOnerror(badEncryptionError)
	
	let appPacket = new Uint8Array(7)
	appPacket[0] = 5
	
	let time = new Int32Array([util.currentTimeMs() - sEpoch])
	time = new Uint8Array(time.buffer)
	
	appPacket.set(time, 2)
		
	let encrypted = encrypt(appPacket)
	
	encrypted[5] = 0
	encrypted[6] = 0
	encrypted[7] = 0
	
	let evt = {data: encrypted}
	mockSocket.onmessage(evt);
}

function sendLastFlag() {
	if (sc.getState() !== 'ready') {
		outcome(false, 'Status: ' + sc.getStatus())
		return
	}
	mockSocket.send = validateAppPacketLastFlag
	sc.send(true, new Uint8Array(1));
}

function receiveDelayed() {
	if (sc.getState() !== 'ready') {
		outcome(false, 'Status: ' + sc.getStatus)
		return;
	} 
	
	sc.setOnerror(delayedPacketError)
	
	let appPacket = new Uint8Array(7)
	appPacket[0] = 5
	
	appPacket[2] = 2
	
	let encrypted = encrypt(appPacket)
	let evt = {data: encrypted}
	mockSocket.onmessage(evt)
	
}

function receiveAfterBadEncryption() {
	sc.setOnerror(notReadyError)
	
	let appPacket = new Uint8Array(7)
	appPacket[0] = 5
	
	let time = new Int32Array([util.currentTimeMs() - sEpoch])
	time = new Uint8Array(time.buffer)
	
	appPacket.set(time, 2)
		
	let encrypted = encrypt(appPacket)
	
	let evt = {data: encrypted}
	mockSocket.onmessage(evt);
}

function receiveAfterDelayed() {
	receiveAfterBadEncryption()
}

function receiveLastFlag() {
	sc.setOnmessage(onAppPacket)
	let appPacket = new Uint8Array(7)
	appPacket[0] = 5
	
	let time = new Int32Array([util.currentTimeMs() - sEpoch])
	time = new Uint8Array(time.buffer)
	
	appPacket.set(time, 2)
		
	let encrypted = encrypt(appPacket, true)
	
	let evt = {data: encrypted}
	mockSocket.onmessage(evt);
}

function stateAfterLastFlag() {
	if (sc.getState() !== 'init') {
		outcome(false, '  Unexpected state after last flag ' + sc.getState())
		return 
	}
	outcome(true)
}



function onAppPacket(message) {
	if (util.uint8ArrayEquals(message, new Uint8Array(1))) {
		outcome(true);
	} else {
		outcome(false, '  Expected 1 zero byte, was ' + util.buf2hex(message));
	}
}

function onMultiAppPacket(message) {
	if (!util.uint8ArrayEquals(message, new Uint8Array([multiAppPacketCount++]))) {
		outcome(false, '  Expected 1 zero byte, was ' + util.buf2hex(message));
		multiAppPacketFailed = true
	} else {
		if (multiAppPacketCount === 2 && !multiAppPacketFailed) {
			outcome(true);
		}
	}
}

function badEncryptionError(err) {
	let success
	let msg = err.message
	if (msg === 'SaltChannel error: Could not decrypt message') {
		success = true
	} else {
		success = false
	}
	
	outcome(success, '  ' + msg)
}

function delayedPacketError(err) {
	let success
	let msg = err.message
	if (msg === 'SaltChannel error: (Multi)AppPacket: Detected a delayed packet') {
		success = true
	} else {
		success = false
	}
	
	outcome(success, '  ' + msg)
}

function notReadyError(err) {
	let success
	let msg = err.message
	if (msg === 'SaltChannel error: Received message when salt channel was not ready') {
		success = true
	} else {
		success = false
	}
	
	outcome(success, '  ' + msg)
}

function onHandshakeComplete() {	
	if (sc.getState() === 'ready') {
		outcome(true)
	} else {
		outcome(false, 'Status: ' + sc.getStatus)
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