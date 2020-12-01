import saltChannelSession from './../../src/saltchannel.js';
import * as util from './../../lib/util.js';
import nacl from './../../lib/nacl-fast-es.js';
import getTimeChecker from './../../src/time/typical-time-checker.js';

let clientSecret =
    util.hex2Uint8Array('fd2956eb37782aabddc97eaf3b9e1b075f4976770db56c11e866e8763fa073d8' +
                        '9cace2ed6af2e108bbabc69c0bb7f3e62a4c0bf59ac2296811a09e480bf7b0f7')
let clientSigKeyPair = nacl.sign.keyPair.fromSecretKey(clientSecret)
let clientEphKeyPair = {
    publicKey: util.hex2Uint8Array('159205ede53fe5334eaf26f15f80710453b6600e6df5c96bfb85dd593c86cf4f'),
    secretKey: util.hex2Uint8Array('e9f639ffd6cc1c1edd5ba28e0aecbbe15ad88478dbfcebc09ad80300880a3fa2')
    }

let serverSecret =
    util.hex2Uint8Array('7a772fa9014b423300076a2ff646463952f141e2aa8d98263c690c0d72eed52d' +
                        '07e28d4ee32bfdc4b07d41c92193c0c25ee6b3094c6296f373413b373d36168b')
let serverSigKeyPair = nacl.sign.keyPair.fromSecretKey(serverSecret)
let serverEphKeyPair = {
    publicKey: util.hex2Uint8Array('354200647ecfbcb1d5feeb7b2f59127fe1278ab4a632b505691f9a2f6a465065'),
    secretKey: util.hex2Uint8Array('942d5f9bb23b8380ce9a86ae52600ec675b922b64b1b294c8f94c44255a26fe0')
    }

let mockSocket = {
    close: closeMockSocket,
    readyState: 1
}

function closeMockSocket() {
    mockSocket.readyState = 3
}

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
let errorMsg
let badData
let m4Delayed
let passCount = 0
let testCount = 0
let multiAppPacketCount
let multiAppPacketFailed
let lastFlag

let bigPayload = util.hex2Uint8Array('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' +
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbcccccccccccccccccccccccccccccccccccccccc' +
    'ddddddddddddddddddddddddddddddddddddddddeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' +
    'ffffffffffffffffffffffffffffffffffffffff0000000000000000000000000000000000000000' +
    '11111111111111111111111111111111111111112222222222222222222222222222222222222222' +
    '33333333333333333333333333333333333333334444444444444444444444444444444444444444' +
    '55555555555555555555555555555555555555556666666666666666666666666666666666666666' +
    '77777777777777777777777777777777777777778888888888888888888888888888888888888888' +
    '9999999999999999999999999999999999999999ffffffffffffffffffffffffffffffffffffffff')

let timeKeeper
let timeChecker


exports.run = () => {
    console.log('======= HANDSHAKE TESTS STARTING! =======')

    testMinimal()

    testWithServSigKey()

    testSendAppPacket1()

    testSendAppPacket2()

    testReceiveAppPacket()

    testSendMultiAppPacket1()

    testSendMultiAppPacket2()

    testSendBigMultiAppPacket()

    testReceiveMultiAppPacket()

    testReceiveBadEncryption()

    testReceiveAfterError()

    testReceiveDelayed()

    testHandshakeAfterError()

    testReceiveLastFlag()

    testStateAfterReceivedLastFlag()

    testSendLastFlag()

    testStateAfterSentLastFlag()

    testWithBadServSigKey()

    testReceiveBadHeaderEnc1()

    testReceiveBadHeaderEnc2()

    testReceiveBadHeaderApp1()

    testReceiveBadHeaderApp2()

    testReceiveBadHeaderApp3()

    testReceiveBadHeaderM21()

    testReceiveBadHeaderM22()

    testReceiveBadTimeM2()

    testReceiveBadHeaderM31()

    testReceiveBadHeaderM32()

    testReceiveBadHeaderM33()

    testReceiveBadHeaderM34()

    testReceiveBadPubEph()

    if (passCount === testCount) {
        console.log('======= ALL ' + testCount + ' HANDSHAKE TESTS PASSED! =======\n')
    } else {
        console.log('======= ' + passCount + '/' + testCount +
             ' OF HANDSHAKE TESTS PASSED! =======\n')
    }
}

function testMinimal() {
    currentTest = 'minimal'
    testCount++

    newSaltChannelAndHandshake(verifyReady, validateM1NoServSigKey)
}

function testWithServSigKey() {
    currentTest = 'withServSigKey'
    testCount++

    newSaltChannelAndHandshake(verifyReady, validateM1WithServSigKey, serverSigKeyPair.publicKey)
}

function testSendAppPacket1() {
    currentTest = 'sendAppPacket1'
    testCount++

    newSaltChannelAndHandshake(doNothing, validateM1NoServSigKey)

    mockSocket.send = validateAppPacket

    sendAppPacket1()
}

function testSendAppPacket2() {
    currentTest = 'sendAppPacket2'
    testCount++

    newSaltChannelAndHandshake(doNothing, validateM1NoServSigKey)
    mockSocket.send = validateAppPacket

    sendAppPacket2()
}

function testReceiveAppPacket() {
    currentTest = 'receiveAppPacket'
    testCount++

    newSaltChannelAndHandshake(doNothing, validateM1NoServSigKey)

    sc.setOnMessage(receiveZeroByte)
    receiveAppPacket()
}

function testSendMultiAppPacket1() {
    currentTest = 'sendMultiAppPacket1'
    testCount++

    newSaltChannelAndHandshake(doNothing, validateM1NoServSigKey)

    mockSocket.send = validateMultiAppPacket

    sendMultiAppPacket1()
}

function testSendMultiAppPacket2() {
    currentTest = 'sendMultiAppPacket2'
    testCount++

    newSaltChannelAndHandshake(doNothing, validateM1NoServSigKey)

    mockSocket.send = validateMultiAppPacket

    sendMultiAppPacket2()
}

function testSendBigMultiAppPacket() {
    currentTest = 'testSendBigMultiAppPacket'
    testCount++

    newSaltChannelAndHandshake(doNothing, validateM1NoServSigKey)

    mockSocket.send = validateBigMultiAppPacket

    sendBigMultiAppPacket()
}

function testReceiveMultiAppPacket() {
    currentTest = 'receiveMultiAppPacket'
    testCount++
    multiAppPacketCount = 0;
    multiAppPacketFailed = false;

    newSaltChannelAndHandshake(doNothing, validateM1NoServSigKey)

    sc.setOnMessage(receiveTwoAppPacketData)
    receiveMultiAppPacket()
}

function testReceiveBadEncryption() {
    currentTest = 'receiveBadEncryption'
    testCount++
    errorMsg = 'EncryptedMessage: Could not decrypt message'

    newSaltChannelAndHandshake(doNothing, validateM1NoServSigKey)

    receiveBadEncryption()
}

function testReceiveAfterError() {
    currentTest = 'receiveAfterError'
    testCount++
    errorMsg = 'Received message when salt channel was not ready'

    receiveAppPacket()
}

function testReceiveDelayed() {
    currentTest = 'receiveDelayed'
    testCount++
    errorMsg = '(Multi)AppPacket: Detected a delayed packet'

    threshold = 20
    timeChecker = getTimeChecker(util.currentTimeMs, 10)
    newSaltChannelAndHandshake(doNothing, validateM1NoServSigKey)

    receiveDelayedPacket()
    timeChecker = undefined
    threshold = undefined
}

function testHandshakeAfterError() {
    currentTest = 'handShakeAfterError'
    testCount++

    handshakeAfterError()
}

function testReceiveLastFlag() {
    currentTest = 'receiveLastFlag'
    testCount++

    newSaltChannelAndHandshake(doNothing, validateM1NoServSigKey)
    sc.setOnMessage(receiveZeroByte)

    receiveLastFlag()
}

function testStateAfterReceivedLastFlag() {
    currentTest = 'stateAfterReceivedLastFlag'
    testCount++

    verifyClosed()
}

function testSendLastFlag() {
    currentTest = 'sendLastFlag'
    testCount++

    newSaltChannelAndHandshake(doNothing, validateM1NoServSigKey)

    mockSocket.send = validateAppPacketWithLastFlag

    sendLastFlag()
}

function testStateAfterSentLastFlag() {
    currentTest = 'stateAfterSentLastFlag'
    testCount++

    verifyClosed()
}

function testWithBadServSigKey() {
    currentTest = 'withBadServSigKey'
    testCount++
    errorMsg = 'M2: NoSuchServer exception'

    newSaltChannelAndHandshake(null, validateM1BadServSigKey, new Uint8Array(32))
}

function testReceiveBadHeaderEnc1() {
    currentTest = 'receiveBadHeaderEnc1'
    testCount++
    errorMsg = 'EncryptedMessage: Bad packet header. Expected 6 0 or 6 128, was 1 0'
    badData = new Uint8Array([1, 0])

    newSaltChannelAndHandshake(doNothing, validateM1NoServSigKey)
    receivebadHeaderEnc()
}

function testReceiveBadHeaderEnc2() {
    currentTest = 'receiveBadHeaderEnc2'
    testCount++
    errorMsg = 'EncryptedMessage: Bad packet header. Expected 6 0 or 6 128, was 6 2'
    badData = new Uint8Array([6, 2])

    newSaltChannelAndHandshake(doNothing, validateM1NoServSigKey)
    receivebadHeaderEnc()
}

function testReceiveBadHeaderApp1() {
    currentTest = 'receiveBadHeaderApp1'
    testCount++
    errorMsg = '(Multi)AppPacket: Bad packet header. Expected 5 0 or 11 0, was 0 0'
    badData = new Uint8Array([0, 0])

    newSaltChannelAndHandshake(doNothing, validateM1NoServSigKey)
    receivebadHeaderApp()
}

function testReceiveBadHeaderApp2() {
    currentTest = 'receiveBadHeaderApp2'
    testCount++
    errorMsg = '(Multi)AppPacket: Bad packet header. Expected 5 0 or 11 0, was 5 1'
    badData = new Uint8Array([5, 1])

    newSaltChannelAndHandshake(doNothing, validateM1NoServSigKey)
    receivebadHeaderApp()
}

function testReceiveBadHeaderApp3() {
    currentTest = 'receiveBadHeaderApp3'
    testCount++
    errorMsg = '(Multi)AppPacket: Bad packet header. Expected 5 0 or 11 0, was 11 1'
    badData = new Uint8Array([11, 1])

    newSaltChannelAndHandshake(doNothing, validateM1NoServSigKey)
    receivebadHeaderApp()
}

function testReceiveBadHeaderM21() {
    currentTest = 'receiveBadHeaderM21'
    testCount++
    errorMsg = 'M2: Bad packet header. Expected 2 0 or 2 129, was 3 0'
    badData = new Uint8Array([3, 0])

    newSaltChannelAndHandshake(null, sendBadM2)
}

function testReceiveBadHeaderM22() {
    currentTest = 'receiveBadHeaderM22'
    testCount++
    errorMsg = 'M2: Bad packet header. Expected 2 0 or 2 129, was 2 50'
    badData = new Uint8Array([2, 50])

    newSaltChannelAndHandshake(null, sendBadM2)
}

function testReceiveBadTimeM2() {
    currentTest = 'receiveBadTimeM2'
    testCount++
    errorMsg = 'M2: Invalid time value 20'
    badData = new Uint8Array([2, 0, 20])

    newSaltChannelAndHandshake(null, sendBadM2)
}

function testReceiveBadHeaderM31() {
    currentTest = 'receiveBadHeaderM31'
    testCount++
    errorMsg = 'M3: Bad packet header. Expected 3 0, was 0 0'
    badData = new Uint8Array([0, 0])

    newSaltChannelAndHandshake(null, sendBadM3)
}

function testReceiveBadHeaderM32() {
    currentTest = 'receiveBadHeaderM32'
    testCount++
    errorMsg = 'M3: Bad packet header. Expected 3 0, was 3 1'
    badData = new Uint8Array([3, 1])

    newSaltChannelAndHandshake(null, sendBadM3)
}

function testReceiveBadHeaderM33() {
    currentTest = 'receiveBadHeaderM33'
    testCount++
    errorMsg = 'M3: ServerSigKey does not match expected'
    badData = new Uint8Array([3, 0, 20, 0, 0, 0, 12, 23, 34, 56])

    newSaltChannelAndHandshake(null, sendBadM3, serverSigKeyPair.publicKey)
}

function testReceiveBadHeaderM34() {
    currentTest = 'receiveBadHeaderM34'
    testCount++
    errorMsg = 'M3: Could not verify signature'
    badData = new Uint8Array([3, 0, 20, 0, 0, 0, 12, 23, 34, 56])

    newSaltChannelAndHandshake(null, sendBadM3)
}

function testReceiveBadPubEph() {
    currentTest = 'receiveBadPubEph'
    testCount++
    errorMsg = 'EncryptedMessage: Could not decrypt message'

    newSaltChannelAndHandshake(null, sendBadEphM2)
}

function newSaltChannelAndHandshake(handshakeCompleteCb, validateM1, sigKey) {
    eNonce = new Uint8Array(nacl.secretbox.nonceLength)
    dNonce = new Uint8Array(nacl.secretbox.nonceLength)
    eNonce[0] = 2
    dNonce[0] = 1
    m4Delayed = false
    lastFlag = false

    mockSocket.send = validateM1
    mockSocket.readyState = 1

    sc = saltChannelSession(mockSocket, timeKeeper, timeChecker)
    sc.setOnHandshakeComplete(handshakeCompleteCb)
    sc.setOnError(onError)
    sc.setOnClose(doNothing)

    sc.handshake(clientSigKeyPair, clientEphKeyPair, sigKey)
}

function handshakeAfterError() {
    eNonce = new Uint8Array(nacl.secretbox.nonceLength)
    dNonce = new Uint8Array(nacl.secretbox.nonceLength)
    eNonce[0] = 2
    dNonce[0] = 1
    m4Delayed = false
    lastFlag = false

    mockSocket.send = validateM1NoServSigKey

    sc.setOnHandshakeComplete(doNothing)

    try {
        sc.handshake(clientSigKeyPair, clientEphKeyPair)
    } catch (err) {
        if (err.message === 'Handshake: Invalid internal state: closed') {
            outcome(true)
        } else {
            outcome(false, 'Unexpected error message:\n  ' + err.message)
        }
    }
}

function verifyReady() {
    if (sc.getState() === 'ready') {
        outcome(true)
    } else {
        outcome(false, 'Status: ' + sc.getState())
    }
}

function verifyClosed() {
    if (sc.getState() === 'closed') {
        outcome(true)
    } else {
        outcome(false, 'State not closed, state: ' + sc.getState())
    }
}

function doNothing() {
    // Do nothing
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

function sendAppPacket1() {
    if (sc.getState() !== 'ready') {
        outcome(false, 'Status: ' + sc.getState())
        return;
    }
    sc.send(false, new Uint8Array([0]).buffer)
}

function sendAppPacket2() {
    if (sc.getState() !== 'ready') {
        outcome(false, 'Status: ' + sc.getState())
        return;
    }
    sc.send(false, [new Uint8Array([0])])
}

function receiveAppPacket() {
    let appPacket = getAppPacket()
    let encrypted = encrypt(appPacket)

    sendOnMockSocket(encrypted)
}

function getAppPacket() {
    let appPacket = new Uint8Array(7)
    appPacket[0] = 5

    let time = new Int32Array([util.currentTimeMs() - sEpoch])
    time = new Uint8Array(time.buffer)

    appPacket.set(time, 2)

    return appPacket
}

function receiveZeroByte(message) {
    if (!(message instanceof ArrayBuffer)) {
        outcome(false, '  Expected ArrayBuffer from Salt Channel')
        return
    }
    if (util.uint8ArrayEquals(new Uint8Array(message), new Uint8Array(1))) {
        outcome(true);
    } else {
        outcome(false, '  Expected 1 zero byte, was ' + util.buf2hex(message));
    }
}

function sendMultiAppPacket1() {
    if (sc.getState() !== 'ready') {
        outcome(false, 'Status: ' + sc.getState())
        return;
    }
    sc.send(false, [new Uint8Array([0]).buffer, new Uint8Array([1])])
}

function sendMultiAppPacket2() {
    if (sc.getState() !== 'ready') {
        outcome(false, 'Status: ' + sc.getState())
        return;
    }
    sc.send(false, new Uint8Array([0]), new Uint8Array([1]).buffer)
}

function sendBigMultiAppPacket() {
    if (sc.getState() !== 'ready') {
        outcome(false, 'Status: ' + sc.getState())
        return;
    }
    sc.send(false, new Uint8Array([0]), bigPayload)
}

function receiveMultiAppPacket() {
    let multiAppPacket = getMultiAppPacket()
    let encrypted = encrypt(multiAppPacket)

    sendOnMockSocket(encrypted)
}

function getMultiAppPacket() {
    let multiAppPacket = new Uint8Array(14)
    multiAppPacket[0] = 11  // Type

    multiAppPacket[6] = 2   // Count

    multiAppPacket[8] = 1   // Length

    multiAppPacket[11] = 1  // Length
    multiAppPacket[13] = 1  // Data

    let time = new Int32Array([util.currentTimeMs() - sEpoch])
    time = new Uint8Array(time.buffer)
    multiAppPacket.set(time, 2)

    return multiAppPacket
}

function receiveTwoAppPacketData(message) {
    if (!(message instanceof ArrayBuffer)) {
        outcome(false, '  Expected ArrayBuffer from Salt Channel')
        return
    }
    if (util.uint8ArrayEquals(new Uint8Array(message), new Uint8Array([multiAppPacketCount++]))) {
        if (multiAppPacketCount === 2 && !multiAppPacketFailed) {
            outcome(true);
        }
    } else {
        outcome(false, '  Expected 1 zero byte, was ' + util.buf2hex(message));
        multiAppPacketFailed = true
    }
}

function receiveBadEncryption() {
    if (sc.getState() !== 'ready') {
        outcome(false, 'Status: ' + sc.getState())
        return;
    }

    let appPacket = new Uint8Array(7)
    appPacket[0] = 5

    let time = new Int32Array([util.currentTimeMs() - sEpoch])
    time = new Uint8Array(time.buffer)

    appPacket.set(time, 2)

    let encrypted = encrypt(appPacket)

    encrypted[5] = 0
    encrypted[6] = 0
    encrypted[7] = 0

    sendOnMockSocket(encrypted)
}

function receiveDelayedPacket() {
    if (sc.getState() !== 'ready') {
        outcome(false, 'Status: ' + sc.getState())
        return;
    }

    let appPacket = getAppPacket()

    appPacket[2] = 2    // Time
    appPacket[3] = 0
    appPacket[4] = 0
    appPacket[5] = 0

    let encrypted = encrypt(appPacket)
    sendOnMockSocket(encrypted)
}

function receiveLastFlag() {
    let appPacket = getAppPacket()
    let encrypted = encrypt(appPacket, true)

    sendOnMockSocket(encrypted)
}

function sendLastFlag() {
    if (sc.getState() !== 'ready') {
        outcome(false, 'Status: ' + sc.getState())
        return
    }
    sc.send(true, new Uint8Array(1));
}

function receivebadHeaderEnc() {
    let appPacket = getAppPacket()
    let encrypted = encrypt(appPacket)
    encrypted.set(badData)

    sendOnMockSocket(encrypted)
}

function receivebadHeaderApp() {
    let appPacket = getAppPacket()
    appPacket.set(badData)
    let encrypted = encrypt(appPacket)

    sendOnMockSocket(encrypted)
}

// ==================================================================
// ==================================================================
// ==================================================================
// =================== SERVER SIDE HANDSHAKE CODE ===================
// ============================ (sorta) =============================

function validateM1NoServSigKey(message) {
    if (!(message instanceof ArrayBuffer)) {
        outcome(false, '  Expected ArrayBuffer from Salt Channel')
        return
    }
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
        console.log(util.ab2hex(m1.buffer))
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
    if (!(message instanceof ArrayBuffer)) {
        outcome(false, '  Expected ArrayBuffer from Salt Channel')
        return
    }
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

    if(bytes[5] !== 1) {
        outcome(false, '  Unexpected server sig key included, expected 1, was ' + bytes[5])
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

function validateM1BadServSigKey(message) {
    if (!(message instanceof ArrayBuffer)) {
        outcome(false, '  Expected ArrayBuffer from Salt Channel')
        return
    }
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

    if(bytes[5] !== 1) {
        outcome(false, '  Unexpected server sig key included, expected 1, was ' + bytes[5])
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
    if (!util.uint8ArrayEquals(serverSigKey, new Uint8Array(32))) {
        outcome(false, '  Unexpected server sig key from client')
        return
    }

    sessionKey = nacl.box.before(publicEphemeral, serverEphKeyPair.secretKey)

    m1Hash = nacl.hash(bytes)

    sendM2NoSuchServer()
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

    sendOnMockSocket(m2)

    sendM3()
}

function sendM2NoSuchServer() {
    let m2 = new Uint8Array(38)

    m2[0] = 2
    m2[1] = 129 // NoSuchServer & LastFlag
    // Time is supported
    m2[2] = 1

    sendOnMockSocket(m2)
}

function sendBadM2() {
    let m2 = new Uint8Array(38)

    m2.set(badData)

    for(let i = 0; i < 32; i++) {
        m2[6+i] = serverEphKeyPair.publicKey[i]
    }

    m2Hash = nacl.hash(m2)

    sEpoch = util.currentTimeMs()

    sendOnMockSocket(m2)
}

function sendBadEphM2(m1) {
    let publicEphemeral = new Uint8Array(m1, 10, 32)
    sessionKey = nacl.box.before(publicEphemeral, serverEphKeyPair.secretKey)

    let m2 = new Uint8Array(38)
    m2[0] = 2
    m2[2] = 1
    m2.set(serverEphKeyPair.publicKey, 6)
    m2[6] = 0

    m2Hash = nacl.hash(m2)

    sEpoch = util.currentTimeMs()

    sendOnMockSocket(m2)

    sendM3()
}

function sendOnMockSocket(data) {
    mockSocket.onmessage({data: data.buffer})
}

function sendM3() {
    let m3 = new Uint8Array(102)

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

    mockSocket.send = validateM4

    let encrypted = encrypt(m3)
    sendOnMockSocket(encrypted)
}

function sendBadM3() {
    let m2 = new Uint8Array(38)
    m2[0] = 2
    m2[2] = 1
    for(let i = 0; i < 32; i++) {
        m2[6+i] = serverEphKeyPair.publicKey[i]
    }

    sendOnMockSocket(m2)

    let m3 = new Uint8Array(102)
    m3.set(badData)

    let encrypted = encrypt(m3)
    sendOnMockSocket(encrypted)
}

function validateM4(message) {
    if (!(message instanceof ArrayBuffer)) {
        outcome(false, '  Expected ArrayBuffer from Salt Channel')
        return
    }
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
}

// ==================================================================
// ==================================================================
// ==================================================================
// ========================== CRYPTO STUFF ==========================
// ==================================================================

function decrypt(message) {
    if (message[0] === 6 && message[1] === 0) {

    } else if (message[0] === 6 && message[1] === 128) {
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
    encryptedMessage[1] = last ? 128 : 0

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

// ==================================================================
// ==================================================================
// ==================================================================

function validateAppPacket(message) {
    if (!(message instanceof ArrayBuffer)) {
        outcome(false, '  Expected ArrayBuffer from Salt Channel')
        return
    }
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
}

function validateMultiAppPacket(message) {
    if (!(message instanceof ArrayBuffer)) {
        outcome(false, '  Expected ArrayBuffer from Salt Channel')
        return
    }
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
                multiAppPacket[6] + ' ' + multiAppPacket[7])
        return
    }

    if (multiAppPacket[8] !== 1 || multiAppPacket[9] !== 0) {
        outcome(false, '  Unexpected length, expected 1 0, was ' +
            multiAppPacket[8] + ' ' + multiAppPacket[9])
        return
    }

    if (multiAppPacket[10] !== 0) {
        outcome(false, '  Unexpected data, expected 0, was ' + multiAppPacket[10])
        return
    }

    if (multiAppPacket[11] !== 1 || multiAppPacket[12] !== 0) {
        outcome(false, '  Unexpected length, expected 1 0, was ' +
            multiAppPacket[11] + ' ' + multiAppPacket[12])
        return
    }

    if (multiAppPacket[13] !== 1) {
        outcome(false, '  Unexpected data, expected 1, was ' + multiAppPacket[13])
        return
    }

    outcome(true)
}

function validateBigMultiAppPacket(message) {
    if (!(message instanceof ArrayBuffer)) {
        outcome(false, '  Expected ArrayBuffer from Salt Channel')
        return
    }
    let encryptedMessage = new Uint8Array(message)
    let multiAppPacket = decrypt(encryptedMessage)

    if (multiAppPacket.length !== (bigPayload.length + 13)) {
        outcome(false, '  Expected MultiAppPacket.length ' + (bigPayload.length + 13) + ', was ' + multiAppPacket.length)
        return
    }

    if (multiAppPacket[6] !== 2 || multiAppPacket[7] !== 0) {
        outcome(false, '  Unexpected count, expected 2 0, was ' +
            multiAppPacket[6] + ' ' + multiAppPacket[7])
        return
    }

    if (multiAppPacket[8] !== 1 || multiAppPacket[9] !== 0) {
        outcome(false, '  Unexpected length, expected 1 0, was ' +
            multiAppPacket[8] + ' ' + multiAppPacket[9])
        return
    }

    if (multiAppPacket[10] !== 0) {
        outcome(false, '  Unexpected data, expected 0, was ' + multiAppPacket[10])
        return
    }

    let packetLength = new Uint8Array(2)
    let view = new DataView(packetLength.buffer);
    view.setUint16(0, bigPayload.length, true);

    if (multiAppPacket[11] !== packetLength[0] || multiAppPacket[12] !== packetLength[1]) {
        outcome(false, '  Unexpected length, expected ' + packetLength[0] + packetLength[1] + ', was ' +
            multiAppPacket[11] + ' ' + multiAppPacket[12])
        return
    }

    let payload = multiAppPacket.slice(13)

    if (!util.uint8ArrayEquals(payload, bigPayload)) {
        outcome(false, '  Unexpected data, expected ' + util.ab2hex(bigPayload.buffer) + ', was ' + util.ab2hex(payload.buffer))
        return
    }

    outcome(true)
}

function validateAppPacketWithLastFlag(message) {
    if (!(message instanceof ArrayBuffer)) {
        outcome(false, '  Expected ArrayBuffer from Salt Channel')
        return
    }
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


function outcome(success, msg) {
    if (success) {
        passCount++
        //console.log(testCount + '. ' + currentTest + ' PASSED')
    } else {
        console.log(testCount + '. ' + currentTest + ' FAILED! \n' + msg)
    }
}
