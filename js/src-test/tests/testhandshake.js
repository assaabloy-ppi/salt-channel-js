var saltChannelSession = require('./../../src/saltchannel.js');
var nacl = require('./../../lib/nacl.js');
var util = require('./../../lib/util.js');
 
let clientSecret = util.hexStringToUint8Array('fd2956eb37782aabddc97eaf3b9e1b075f4976770db56c11e866e8763fa073d8' +
									'9cace2ed6af2e108bbabc69c0bb7f3e62a4c0bf59ac2296811a09e480bf7b0f7');
let clientPublic = util.hexStringToUint8Array('9cace2ed6af2e108bbabc69c0bb7f3e62a4c0bf59ac2296811a09e480bf7b0f7');
let clientSigKeyPair = {publicKey: clientPublic, secretKey: clientSecret};
let clientEphKeyPair = nacl.box.keyPair();

let serverSecret = util.hexStringToUint8Array('7a772fa9014b423300076a2ff646463952f141e2aa8d98263c690c0d72eed52d' +
									'07e28d4ee32bfdc4b07d41c92193c0c25ee6b3094c6296f373413b373d36168b');
let serverPublic = util.hexStringToUint8Array('07e28d4ee32bfdc4b07d41c92193c0c25ee6b3094c6296f373413b373d36168b');
let serverSigKeyPair = {publicKey: serverPublic, secretKey: serverSecret};
let serverEphKeyPair = nacl.box.keyPair();

let mockSocket = {};
let sessionKey;
let eNonce;
let dNonce;

let cEpoch;
let sEpoch;
const THRESHOLD = 5000; 

let sc;
let m1Hash;
let m2Hash;
const SIG_STR_1 = 'SC-SIG01';
const SIG_STR_2 = 'SC-SIG02';

let sigBytes1 = new Uint8Array([ SIG_STR_1.charCodeAt(0)
							,SIG_STR_1.charCodeAt(1)
							,SIG_STR_1.charCodeAt(2)
							,SIG_STR_1.charCodeAt(3)
							,SIG_STR_1.charCodeAt(4)
							,SIG_STR_1.charCodeAt(5)
							,SIG_STR_1.charCodeAt(6)
							,SIG_STR_1.charCodeAt(7)]);

let sigBytes2 = new Uint8Array([ SIG_STR_2.charCodeAt(0)
							,SIG_STR_2.charCodeAt(1)
							,SIG_STR_2.charCodeAt(2)
							,SIG_STR_2.charCodeAt(3)
							,SIG_STR_2.charCodeAt(4)
							,SIG_STR_2.charCodeAt(5)
							,SIG_STR_2.charCodeAt(6)
							,SIG_STR_2.charCodeAt(7)]);

let currentTest;
let passCount = 0;
let testCount = 0;


exports.run = () => {
	console.log('======= HANDSHAKE TESTS STARTING! =======');
	currentTest = 'testHandshake';
	runTest(validateM1NoServSigKey);
	
	if (passCount === testCount) {
		console.log('======= ALL HANDSHAKE TESTS PASSED! =======\n');
	} else {
		console.log('======= ' + passCount + '/' + testCount +
			 ' OF HANDSHAKE TESTS PASSED! =======\n')
	}
}

function runTest(validateM1) {
	testCount++;
	
	eNonce = new Uint8Array(nacl.secretbox.nonceLength);
	dNonce = new Uint8Array(nacl.secretbox.nonceLength);
	eNonce[0] = 2;
	dNonce[0] = 1;
	
	mockSocket.send = validateM1;
	
	sc = saltChannelSession(mockSocket);
	sc.setOnHandshakeComplete(onHandshakeComplete);
	
	sc.handshake(clientSigKeyPair, clientEphKeyPair);	
}

function validateM1NoServSigKey(message) {
	let bytes = new Uint8Array(message);
	
	if (bytes.length !== 42) {
		outcome(false, '  Bad packet length, expected 42, was ' + bytes.length);
	}
	
	let protocol = String.fromCharCode(bytes[0]);
	protocol += String.fromCharCode(bytes[1]);
	protocol += String.fromCharCode(bytes[2]);
	protocol += String.fromCharCode(bytes[3]);
	
	if (protocol !== 'SCv2') {
		outcome(false, '  Bad protocol indicator: ' + protocol);
		return;
	}
	
	if (bytes[4] !== 1) {
		outcome(false, '  Invalid packet type, expected 1, was ' + bytes[4]);
		return;
	}
	
	if(bytes[5] !== 0) {
		outcome(false, '  Unexpected server sig key included, expected 0, was ' + bytes[5]);
	}
		
	if (!(bytes[6] === 1 && bytes[7] === 0 &&
		bytes[8] === 0 && bytes[9] === 0)) {
		outcome(false, '  M1: Expected time to be set');
		return; 
	} 
	
	cEpoch = util.currentTimeMs();
	
	let publicEphemeral = new Uint8Array(bytes.buffer, 10);
	
	if (!util.uint8ArrayEquals(publicEphemeral, clientEphKeyPair.publicKey)) {
		outcome(false, '  Unexpected public ephemeral key from client');
		return;
	}
	
	sessionKey = nacl.box.before(publicEphemeral, serverEphKeyPair.secretKey);
	
	m1Hash = nacl.hash(bytes);

	sendM2NoServSigKey();
}

function sendM2NoServSigKey() {
	let m2 = new Uint8Array(38);
	
	m2[0] = 2;
	
	// Time is supported
	m2[2] = 1;
	
	for(let i = 0; i < 32; i++) {
		m2[6+i] = serverEphKeyPair.publicKey[i];
	}
	
	m2Hash = nacl.hash(m2);
	
	sEpoch = util.currentTimeMs();
	
	let evt = {data: m2};
	mockSocket.onmessage(evt);
	
	sendM3();
}

function sendM3() {
	m3 = new Uint8Array(102);

	m3[0] = 3;

	for (let i = 0; i < 32; i++) {
		m3[6+i] = serverPublic[i];
	}
		
	let concat = getConcat(sigBytes1);
	
	let signature = nacl.sign.detached(concat, serverSigKeyPair.secretKey);
	
	for (let i = 0; i < 64; i++) {
		m3[38+i] = signature[i];
	}
	
	let time = new Int32Array([util.currentTimeMs() - sEpoch]);
	time = new Uint8Array(time.buffer);
	
	m3[2] = time[0];
	m3[3] = time[1];
	m3[4] = time[2];
	m3[5] = time[3];
	
	let encrypted = encrypt(m3);
	let evt = {data: encrypted};
	mockSocket.send = validateM4;
	
	mockSocket.onmessage(evt);
}

function validateM4(message) {
	let encryptedMessage = new Uint8Array(message);
	let m4 = decrypt(encryptedMessage);
	
	if (util.isString(m4)) {
		outcome(false, m4);
		return;
	}
	
	if (m4[0] !== 4) {
		outcome(false, "  M4: Bad packet type, expected 4, was " + m4[0]);
		return;
	}
	
	if (m4[1] !== 0) {
		outcome(false, "  M4: Bad packet header, expected 0, was " + m4[1]);
		return
	}
	
	if (m4[2] === 0 && m4[3] === 0 
	  && m4[4] === 0 && m4[5] === 0) {
		outcome(false, '  M4: Expected time to be set');
		return;
	}
	
	let time = new Uint8Array(4);
	time[0] = m4[2];
	time[1] = m4[3];
	time[2] = m4[4];
	time[3] = m4[5];
	
	time = (new Int32Array(time.buffer))[0];
	
	if (util.currentTimeMs() - cEpoch > time + THRESHOLD ) {
		outcome(false, '  Delayed packet');
		return;
	}
	
	let clientSigKey = new Uint8Array(32);
	for (let i = 0; i < 32; i++) {
		clientSigKey[i] = m4[6+i];
	}
	
	if (!util.uint8ArrayEquals(clientSigKey, clientSigKeyPair.publicKey)) {
		outcome(false, "  Client signing key does not match expected");
		return;
	}
	
	let signature = new Uint8Array(64);
	for (let i = 0; i < 64; i++) {
		signature[i] = m4[38+i];
	}
	
	let concat = getConcat(sigBytes2);
	
	let success = nacl.sign.detached.verify(concat, signature, clientSigKey);
	
	if (!success) {
		outcome(false, "  Could not verify signature");
		return;
	}
	
}

function decrypt(message) {
	if (!(message[0] === 6 && message[1] === 0)) {
		return "  EncryptedMessage: Bad packet header, expected 6 0, was  " +
				+ message[0] + " " + message[1];
	}
	
	let bytes = new Uint8Array(message.byteLength - 2);
	let msg = new Uint8Array(message);
	
	for (let i = 0; i < message.byteLength - 2; i++) {
		bytes[i] = msg[i+2];
	}
			
	let clear = nacl.secretbox.open(bytes, dNonce, sessionKey);
	dNonce = increaseNonce2(dNonce);
	
	if (clear === false) {
		return "  EncryptedMessage: Failed to decrypt";
	}

	let copy = new Uint8Array(clear.length);
	for (let i = 0; i < copy.length; i++) {
		copy[i] = clear[i];
	}
	return copy;
}

function encrypt(clearBytes) {
	let body = nacl.secretbox(clearBytes, eNonce, sessionKey);
	eNonce = increaseNonce2(eNonce);

	let encryptedMessage = new Uint8Array(body.length + 2);
	encryptedMessage[0] = 6;
	for (let i = 0; i < body.length; i++) {
		encryptedMessage[2+i] = body[i];
	}

	return encryptedMessage;
}

function getConcat(sigBytes) {
	let concat = new Uint8Array(2*nacl.hash.hashLength + 8);
	for (let i = 0; i < 8; i++) {
		concat[i] = sigBytes[i];
	}
	for (let i = 0; i < nacl.hash.hashLength; i++) {
		concat[8+i] = m1Hash[i];
		concat[8+i+nacl.hash.hashLength] = m2Hash[i];
	}
	
	return concat;
}

function increaseNonce(nonce) {
	if (!(nonce instanceof Uint8Array)) {
		throw new Error("Expected Uint8Array. \n\t" +
					"Input: " + nonce);
	}
	if (!(nonce.length === nacl.secretbox.nonceLength)) {
		throw new Error("Unexpected nonce length. \n\t" +
					"Length: " + nonce.length);
	}
	nonce[0] += 1; // nonces are little endian
	for (let i = 0; i < 7; i++) {
		if (nonce[i] === 0) {
			nonce[i+1] += 1;
		} else {
			break;
		}
	}
	return nonce;
}


function increaseNonce2(nonce) {
	nonce = increaseNonce(nonce);
	nonce = increaseNonce(nonce);
	return nonce;
}

function onHandshakeComplete() {
	if (sc.getState() === 'ready') {
		outcome(true);
	} else {
		outcome(false, 'Status: ' + sc.getStatus);
	}
}

/*
 * Prints outcome of current test
 */
function outcome(success, msg) {
	if (success) {
		passCount++;
		console.log(currentTest + ' PASSED');
	} else {
		console.log(currentTest + ' FAILED! \n' + msg);
	}
}