'use-strict'

let saltChannelSession = require('./../../src/saltchannel.js')
let nacl = require('./../../lib/nacl-fast.js')
let util = require('./../../lib/util.js')
let getTimeKeeper = require('./../../src/time/typical-time-keeper.js')
let getTimeChecker = require('./../../src/time/typical-time-checker.js')
let getNullTimeKeeper = require('./../../src/time/null-time-keeper.js')
let getNullTimeChecker = require('./../../src/time/null-time-checker.js')


const session1M1Bytes = util.hex2ab('534376320100000000008520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a')
const session1M2Bytes = util.hex2ab('020000000000de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f')
const session1M3Bytes = util.hex2ab('0600e47d66e90702aa81a7b45710278d02a8c6cddb69b86e299a47a9b1f1c18666e5cf8b000742bad609bfd9bf2ef2798743ee092b07eb32a45f27cda22cbbd0f0bb7ad264be1c8f6e080d053be016d5b04a4aebffc19b6f816f9a02e71b496f4628ae471c8e40f9afc0de42c9023cfcd1b07807f43b4e25')
const session1M4Bytes = util.hex2ab('0600b4c3e5c6e4a405e91e69a113b396b941b32ffd053d58a54bdcc8eef60a47d0bf53057418b6054eb260cca4d827c068edff9efb48f0eb8454ee0b1215dfa08b3ebb3ecd2977d9b6bde03d4726411082c9b735e4ba74e4a22578faf6cf3697364efe2be6635c4c617ad12e6d18f77a23eb069f8cb38173')
const session1AppBytes = util.hex2ab('06005089769da0def9f37289f9e5ff6e78710b9747d8a0971591abf2e4fb')
const session1EchoBytes = util.hex2ab('068082eb9d3660b82984f3c1c1051f8751ab5585b7d0ad354d9b5c56f755')
const request = util.hex2ab('010505050505')

const session2A1Bytes = util.hex2ab('08000120000808080808080808080808080808080808080808080808080808080808080808')
const session2A2Bytes = util.hex2ab('098001534376322d2d2d2d2d2d4543484f2d2d2d2d2d2d')
const adress = util.hex2ab('0808080808080808080808080808080808080808080808080808080808080808')
const adressType = 1

const session3M1Bytes = util.hex2ab('534376320100010000008520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a')
const session3M2Bytes = util.hex2ab('020001000000de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f')
const session3M3Bytes = util.hex2ab('06005f545037bc60f771254bb562a5545193c6cdd969b86e299a47a9b1f1c18666e5cf8b000742bad609bfd9bf2ef2798743ee092b07eb32f55c386d4c5f986a22a793f2886c407756e9c16f416ad6a039bec1f546c28e53e3cdd8b6a0b728e1b576dc73c0826fde10a8e8fa95dd840f27887fad9c43e523')
const session3M4Bytes = util.hex2ab('06002541b8476e6f38c121f9f4fb63d99c09b32fff053d58a54bdcc8eef60a47d0bf53057418b6054eb260cca4d827c068edff9efb48f0eb93170c3dd24c413625f3a479a4a3aeef72b78938dd6342954f6c5deaa6046a2558dc4608c8eea2e95eee1d70053428193ab4b89efd6c6d731fe89281ffe7557f')
const session3App1Bytes = util.hex2ab('0600fc874e03bdcfb575da8035aef06178ac0b9744d8a0971591abf2e4fb')
const session3Echo1Bytes = util.hex2ab('060045bfb5a275a3d9e175bfb1acf36cc10a5585b4d0ad354d9b5c56f755')
const session3MultiBytes = util.hex2ab('060051f0396cdadf6e74adb417b715bf3e93cc27e6aef94d2852fd4229970630df2c34bb76ec4c')
const session3Echo2Bytes = util.hex2ab('06808ab0c2c5e3a660e3767d28d4bc0fda2d23fd515aaef131889c0a4b4b3ce8ccefcd95c2c5b9')
const multi1 = util.hex2ab('0104040404')
const multi2 = util.hex2ab('03030303')

const session4M1Bytes = util.hex2ab('534376320101000000008520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a07e28d4ee32bfdc4b07d41c92193c0c25ee6b3094c6296f373413b373d36168b')
const session4M2Bytes = util.hex2ab('020000000000de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f')
const session4M3Bytes = util.hex2ab('06000dfa318c6337d600252260503124352ec6cddb69b86e299a47a9b1f1c18666e5cf8b000742bad609bfd9bf2ef2798743ee092b07eb3207d89eb0ec2da1f0c21e5c744a12757e6c0e71c752d67cc866257ef47f5d80bf9517203d2326737f1355fafd73d50b01c50a306b09cebed4c68d0a7cd6938a2a')
const session4M4Bytes = util.hex2ab('060002bc1cc5f1f04c93319e47602d442ec1b32ffd053d58a54bdcc8eef60a47d0bf53057418b6054eb260cca4d827c068edff9efb48f0ebfd3ad7a2b6718d119bb64dbc149d002100f372763a43f1e81ed9d557f9958240d627ae0b78c89fd87a7e1d49800e9fa05452cb142cbf4b39635bf19b2f91ba7a')
const session4AppBytes = util.hex2ab('06005089769da0def9f37289f9e5ff6e78710b9747d8a0971591abf2e4fb')
const session4EchoBytes = util.hex2ab('068082eb9d3660b82984f3c1c1051f8751ab5585b7d0ad354d9b5c56f755')


let clientSecret =
	util.hex2Uint8Array('55f4d1d198093c84de9ee9a6299e0f6891c2e1d0b369efb592a9e3f169fb0f79' +
						'5529ce8ccf68c0b8ac19d437ab0f5b32723782608e93c6264f184ba152c2357b')
let clientSigKeyPair = nacl.sign.keyPair.fromSecretKey(clientSecret)
let clientEphKeyPair = {
	publicKey: util.hex2Uint8Array('8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a'),
	secretKey: util.hex2Uint8Array('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a')
	}

let serverSecret =
	util.hex2Uint8Array('7a772fa9014b423300076a2ff646463952f141e2aa8d98263c690c0d72eed52d' +
						'07e28d4ee32bfdc4b07d41c92193c0c25ee6b3094c6296f373413b373d36168b')
let serverSigKeyPair = nacl.sign.keyPair.fromSecretKey(serverSecret)
let serverEphKeyPair = {
	publicKey: util.hex2Uint8Array('de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f'),
	secretKey: util.hex2Uint8Array('5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb')
	}

let sessionKey = util.hex2Uint8Array('1b27556473e985d462cd51197a9a46c76009549eac6474f206c4ee0844f68389')



let passCount = 0
let testCount = 0
let currentTest

let mockSocket = {}
let sc
let time
let timeKeeper

exports.run = () => {
	console.log('======= SESSION TESTS STARTING! =======')

	session1()

	session2()

	session3()

	session4()

	if (passCount === testCount) {
		console.log('======= ALL ' + testCount + ' SESSION TESTS PASSED! =======\n')
	} else {
		console.log('======= ' + passCount + '/' + testCount +
			 ' OF SESSION TESTS PASSED! =======\n')
	}
}

function session1() {
	currentTest = 'session1'
	testCount++

	mockSocket.send = session1M1

	time = 0
	timeKeeper = getNullTimeKeeper()
	sc = saltChannelSession(mockSocket, timeKeeper)
	sc.setOnHandshakeComplete(session1HandshakeComplete)
	sc.setOnClose(sessionClose)
	sc.setOnMessage(session1Echo)

	sc.handshake(clientSigKeyPair, clientEphKeyPair)

}
function session1M1(message) {
	if (!util.bufferEquals(message, session1M1Bytes)) {
		outcome(false, 'Unexpected M1 bytes')
		return
	}

	mockSocket.send = session1M4

	sendOnMockSocket(session1M2Bytes)
	sendOnMockSocket(session1M3Bytes)
}
function session1M4(message) {
	if (!util.bufferEquals(message, session1M4Bytes)) {
		outcome(false, 'Unexpected M4 bytes')
		return
	}
}
function session1HandshakeComplete() {
	if (sc.getState() !== 'ready') {
		outcome(false, 'Bad status: ' + sc.getStatus)
		return
	}
	mockSocket.send = session1App

	sc.send(false, request)
}
function session1App(message) {
	if (!util.bufferEquals(message, session1AppBytes)) {
		outcome(false, 'Bad app request bytes')
		return
	}

	sendOnMockSocket(session1EchoBytes)
}
function session1Echo(message) {
	if (!util.bufferEquals(message, request)) {
		outcome(false, 'Message did not match request')
		return
	}
}






function session2() {
	currentTest = 'session2'
	testCount++

	mockSocket.send = session2A1

	sc = saltChannelSession(mockSocket)
	sc.setOnA2Response(session2A2)
	sc.setOnClose(sessionClose)

	sc.a1a2(adressType, adress)

}
function session2A1(message) {
	if (!util.bufferEquals(message, session2A1Bytes)) {
		outcome(false, 'Message did not match expected A1')
		return
	}

	sendOnMockSocket(session2A2Bytes)
}
function session2A2(prots) {
	let p1 = 'SCv2------'
	let p2 = 'ECHO------'

	if (prots.length !== 1) {
		outcome(false, 'Bad prots length')
		return
	}
	if (p1 !== prots[0].p1) {
		outcome(false, 'p1 did not match expected')
		return
	}
	if (p2 !== prots[0].p2) {
		outcome(false, 'p2 did not match expected')
		return
	}
}




function getTime() {
	if (time === 0) {
		time++
		return 0
	}
	time++
	return time
}
function session3() {
	currentTest = 'session3'
	testCount++

	mockSocket.send = session3M1

	time = 0
	timeKeeper = getTimeKeeper(getTime)
	sc = saltChannelSession(mockSocket, timeKeeper)
	sc.setOnHandshakeComplete(session3HandshakeComplete)
	sc.setOnClose(sessionClose)
	sc.setOnMessage(session3Echo1)

	sc.handshake(clientSigKeyPair, clientEphKeyPair)

}
function session3M1(message) {
	if (!util.bufferEquals(message, session3M1Bytes)) {
		outcome(false, 'Unexpected M1 bytes')
		return
	}

	mockSocket.send = session3M4

	sendOnMockSocket(session3M2Bytes)
	sendOnMockSocket(session3M3Bytes)
}
function session3M4(message) {
	if (!util.bufferEquals(message, session3M4Bytes)) {
		outcome(false, 'Unexpected M4 bytes')
		return
	}
}
function session3HandshakeComplete() {
	if (sc.getState() !== 'ready') {
		outcome(false, 'Bad status: ' + sc.getStatus)
		return
	}

	mockSocket.send = session3App

	sc.send(false, request)
}
function session3App(message) {
	if (!util.bufferEquals(message, session3App1Bytes)) {
		outcome(false, 'Bad app request bytes')
		return
	}

	sendOnMockSocket(session3Echo1Bytes)
}
function session3Echo1(message) {
	if (!util.bufferEquals(message, request)) {
		outcome(false, 'Message did not match request')
		return
	}

	mockSocket.send = session3Multi

	sc.send(false, multi1, multi2)
}
function session3Multi(message) {
	if (!util.bufferEquals(message, session3MultiBytes)) {
		outcome(false, 'Mutli message did not match expected')
		return
	}
	sc.setOnMessage(session3Echo21)

	sendOnMockSocket(session3Echo2Bytes)
}
function session3Echo21(message) {
	if (!util.bufferEquals(message, multi1)) {
		outcome(false, 'Message did not match multi1')
		return
	}
	sc.setOnMessage(session3Echo22)
}
function session3Echo22(message) {
	if (!util.bufferEquals(message, multi2)) {
		outcome(false, 'Message did not match  multi2')
		return
	}
}






function session4() {
	currentTest = 'session4'
	testCount++

	mockSocket.send = session4M1

	time = 0
	timeKeeper = getNullTimeKeeper()
	sc = saltChannelSession(mockSocket, timeKeeper)
	sc.setOnHandshakeComplete(session4HandshakeComplete)
	sc.setOnClose(sessionClose)
	sc.setOnMessage(session4Echo)

	sc.handshake(clientSigKeyPair, clientEphKeyPair, serverSigKeyPair.publicKey)

}
function session4M1(message) {
	if (!util.bufferEquals(message, session4M1Bytes)) {
		outcome(false, 'Unexpected M1 bytes')
		return
	}

	mockSocket.send = session4M4

	sendOnMockSocket(session4M2Bytes)
	sendOnMockSocket(session4M3Bytes)
}
function session4M4(message) {
	if (!util.bufferEquals(message, session4M4Bytes)) {
		outcome(false, 'Unexpected M4 bytes')
		return
	}
}
function session4HandshakeComplete() {
	if (sc.getState() !== 'ready') {
		outcome(false, 'Bad status: ' + sc.getStatus)
		return
	}
	mockSocket.send = session4App

	sc.send(false, request)
}
function session4App(message) {
	if (!util.bufferEquals(message, session4AppBytes)) {
		outcome(false, 'Bad app request bytes')
		return
	}

	sendOnMockSocket(session4EchoBytes)
}
function session4Echo(message) {
	if (!util.bufferEquals(message, request)) {
		outcome(false, 'Message did not match request')
		return
	}
}










function sessionClose(state) {
	if (state !== 'last') {
		outcome(false, 'Expected close state to be "last"')
		return
	}
	outcome(true)
}

function sendOnMockSocket(data) {
	mockSocket.onmessage({data: data})
}

function outcome(success, msg) {
	if (success) {
		passCount++
		//console.log(testCount + '. ' + currentTest + ' PASSED')
	} else {
		console.log(testCount + '. ' + currentTest + ' FAILED! \n  ' + msg)
	}
}
