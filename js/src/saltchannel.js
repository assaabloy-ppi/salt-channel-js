import * as util from './../lib/util.js';
import nacl from './../lib/nacl-fast-es.js';
import getTimeKeeper from './time/typical-time-keeper.js';
import getTimeChecker from './time/typical-time-checker.js';
import getNullTimeChecker from './time/null-time-checker.js';

/**
 * JavaScript implementation of Salt Channel v2
 *
 */
export default function(ws, timeKeeper, timeChecker) {
	'use-strict'

	const SIG_STR_1 = 'SC-SIG01'
	const SIG_STR_2 = 'SC-SIG02'
	const VERSION_STR = 'SCv2'

	const STATE_INIT = 'init'
	const STATE_A1A2 = 'a1a2'
	const STATE_HAND = 'handshake'
	const STATE_READY = 'ready'
	const STATE_LAST = 'last'
	const STATE_ERR = 'error'
	const STATE_CLOSED = 'closed'
	const STATE_WAITING = 'waiting'

	const ADDR_TYPE_ANY = 0
	const ADDR_TYPE_PUB = 1

	const WS_CONNECTING = 0
	const WS_OPEN = 1
	const WS_CLOSING = 2
	const WS_CLOSED = 3

	const SIG_STR1_BYTES = new Uint8Array([ SIG_STR_1.charCodeAt(0)
							, SIG_STR_1.charCodeAt(1)
							, SIG_STR_1.charCodeAt(2)
							, SIG_STR_1.charCodeAt(3)
							, SIG_STR_1.charCodeAt(4)
							, SIG_STR_1.charCodeAt(5)
							, SIG_STR_1.charCodeAt(6)
							, SIG_STR_1.charCodeAt(7) ])

	const SIG_STR2_BYTES = new Uint8Array([ SIG_STR_2.charCodeAt(0)
							, SIG_STR_2.charCodeAt(1)
							, SIG_STR_2.charCodeAt(2)
							, SIG_STR_2.charCodeAt(3)
							, SIG_STR_2.charCodeAt(4)
							, SIG_STR_2.charCodeAt(5)
							, SIG_STR_2.charCodeAt(6)
							, SIG_STR_2.charCodeAt(7) ])

	const VERSION = new Uint8Array([ VERSION_STR.charCodeAt(0)
							, VERSION_STR.charCodeAt(1)
							, VERSION_STR.charCodeAt(2)
							, VERSION_STR.charCodeAt(3) ])



	let eNonce
	let dNonce
	let m1Hash
	let m2Hash
	let m1m2Hash
	let sessionKey
	let hostPub
	let signKeyPair
	let ephemeralKeyPair

	timeKeeper = (timeKeeper) ? timeKeeper : getTimeKeeper(util.currentTimeMs)
	timeChecker = (timeChecker) ? timeChecker : getTimeChecker(util.currentTimeMs)

	let telemetry
	let saltState

	// Set by calling corresponding set-function
	let onerror
	let onA2Response
	let onHandshakeComplete
	let onmessage
	let onclose

	init()

	function close() {
		eNonce = undefined
		dNonce = undefined
		m1Hash = undefined
		m2Hash = undefined
		m1m2Hash = undefined
		sessionKey = undefined
		hostPub = undefined
		signKeyPair = undefined
		ephemeralKeyPair = undefined

		telemetry = undefined
		let state = saltState
		saltState = STATE_CLOSED

		timeKeeper.reset()
		timeChecker.reset()

		ws.close()

		if (typeof onclose === 'function') {
			onclose(state)
		} else {
			console.error('saltchannel.onClose not set')
			console.error(state)
		}
	}

	function init() {
		eNonce = new Uint8Array(nacl.secretbox.nonceLength)
		dNonce = new Uint8Array(nacl.secretbox.nonceLength)
		eNonce[0] = 1
		dNonce[0] = 2

		telemetry = {
			bytes: 	{
					sent: 0,
					received: 0
				},
			handshake: {
					start: 0,
					end: 0,
					total: 0
				}
		}

		saltState = STATE_INIT
	}

	// =========== A1A2 MESSAGE EXCHANGE ================
	function a1a2(adressType, adress) {
		if (saltState === STATE_INIT) {
			saltState = STATE_A1A2
        	sendA1(adressType, adress)
        } else {
        	throw new Error('A1A2: Invalid internal state: ' + saltState)
        }
    }

    function sendA1(adressType = ADDR_TYPE_ANY, adress) {
    	let a1
    	switch (adressType) {
    		case ADDR_TYPE_ANY:
    			a1 = getA1Any()
    			break
    		case ADDR_TYPE_PUB:
    			a1 = getA1Pub(adress)
    			break
    		default:
    			throw new RangeError('A1A2: Unsupported adress type: ' + adressType)
    	}

        ws.onmessage = function(evt) {
            handleA2(evt.data)
        }

        sendOnWs(a1.buffer)

    }

    function getA1Any() {
    	let a1 = new Uint8Array(5)
    	a1[0] = 8
    	return a1
    }

    function getA1Pub(adress) {
    	if (adress instanceof ArrayBuffer) {
    		adress = new Uint8Array(adress)
    	} else if (!(adress instanceof Uint8Array)) {
    		throw new TypeError('A1A2: Expected adress to be ArrayBuffer or Uint8Array')
    	}
		let a1 = new Uint8Array(5 + adress.length)
        a1[0] = 8
        a1[2] = ADDR_TYPE_PUB
        setUint16(a1, adress.length, 3)
        a1.set(adress, 5)
        return a1
    }

    function handleA2(message) {
    	if (saltState !== STATE_A1A2) {
    		error('A2: Invalid internal state: ' + saltState)
    		return
    	}
        let a2 = new Uint8Array(message)

        if (validHeader(a2, 9, 129)) {
        	error('A2: NoSuchServer exception')
        	return
        }
        if (!validHeader(a2, 9, 128)) {
        	error('A2: Bad packet header. Expected 9 128, was ' +
        		a2[0] + ' ' + a2[1])
        	return
        }
        let offset = 2
        let count = a2[offset++]

        if (count < 1 || count > 127) {
            error('A2: Count must be in range [1, 127], was: ' + count)
            return
        }

        if (a2.length !== count*20 + 3) {
            error('A2: Expected packet length ' + (count*20 + 3) +
            	' was ' + a2.length)
            return
        }

        let prots = []
        let low = 33
        let high = 126
        for (let i = 0; i < count; i++) {
        	let p1 = ''
        	let p2 = ''

        	for (let j = 0; j < 10; j++) {
        		if (!validPStringChar(a2[offset])) {
        			error('A2: Invalid char in p1 "' +
        				String.fromCharCode(a2[offset]) + '"')
        			return
        		}
        		if (!validPStringChar(a2[offset + 10])) {
        			error('A2: Invalid char in p2 "' +
        				String.fromCharCode(a2[offset + 10]) + '"')
        			return
        		}
        		p1 += String.fromCharCode(a2[offset])
        		p2 += String.fromCharCode(a2[offset + 10])
        		offset++
        	}

            prots[i] = {p1: p1, p2: p2}
        }

        saltState = STATE_LAST

        if (typeof onA2Response === 'function') {
        	onA2Response(prots)
        } else {
        	console.error('saltchannel.onA2Response not set')
        }

        close()
    }

    function validPStringChar(byteValue) {
    	// '-' to '9' in ASCII
    	if (byteValue >= 45 && byteValue <= 57) {
    		return true
    	}
    	// 'A' to 'Z' in ASCII
    	if (byteValue >= 65 && byteValue <= 90) {
    		return true
    	}
    	// '_' in ASCII
    	if (byteValue === 95) {
    		return true
    	}
    	// 'a' to 'z' in ASCII
    	if (byteValue >= 97 && byteValue <= 122) {
    		return true
    	}

    	return false
    }

    // =================================================

	// =============== HANDSHAKE BEGIN =================

	function handshake(sigKeyPair, ephKeyPair, hostSigPub) {
		verifySigKeyPair(sigKeyPair)
		verifyEphKeyPair(ephKeyPair)
		verifyHostSigPub(hostSigPub)
		if (saltState === STATE_INIT) {
			telemetry.handshake.start = util.currentTimeMs().toFixed(2) - 0
			signKeyPair = sigKeyPair
			ephemeralKeyPair = ephKeyPair
			hostPub = hostSigPub
			saltState = STATE_HAND
			sendM1()
		} else {
			throw new Error('Handshake: Invalid internal state: ' + saltState)
		}
	}

	function verifySigKeyPair(keyPair) {
		let pub = keyPair.publicKey
		let sec = keyPair.secretKey
		if (!pub || !sec) {
			throw new TypeError('sigKeyPair must have publicKey and secretKey properties')
		}
		if (!(pub instanceof Uint8Array) ||
			!(sec instanceof Uint8Array)) {
			throw new TypeError('sigKeyPair.publicKey & sigKeyPair.secretKey must be Uint8Array')
		}
		if (pub.length !== nacl.sign.publicKeyLength ||
			sec.length !== nacl.sign.secretKeyLength) {
			throw new TypeError('sigKeyPair.publicKey & sigKeyPair.secretKey must be 32 and 64 bytes')
		}
	}
	function verifyEphKeyPair(keyPair) {
		let pub = keyPair.publicKey
		let sec = keyPair.secretKey
		if (!pub || !sec) {
			throw new TypeError('ephKeyPair must have publicKey and secretKey properties')
		}
		if (!(pub instanceof Uint8Array) ||
			!(sec instanceof Uint8Array)) {
			throw new TypeError('ephKeyPair.publicKey & ephKeyPair.secretKey must be Uint8Array')
		}
		if (pub.length !== nacl.box.publicKeyLength ||
			sec.length !== nacl.box.secretKeyLength) {
			throw new TypeError('ephKeyPair.publicKey & ephKeyPair.secretKey must be 32 and 64 bytes')
		}
	}
	function verifyHostSigPub(key) {
		if (key) {
			if (!(key instanceof Uint8Array)) {
				throw new TypeError('hostSigPub must be Uint8Array')
			}
			if (key.length !== nacl.sign.publicKeyLength) {
				throw new TypeError('hostSigPub must be 32 bytes')
			}
		}
	}

	function sendM1() {
		let m1Len = (hostPub) ? 74 : 42
		let m1 = new Uint8Array(m1Len)

		m1.set(VERSION)

		// Header
		m1[4] = 1	// Packet type 1
		m1[5] = (hostPub) ? 1 : 0

		// Time
		setInt32(m1, timeKeeper.getTime(), 6)

		// ClientEncKey
		m1.set(ephemeralKeyPair.publicKey, 10)

		// ServerSigKey
		if (hostPub) {
			m1.set(hostPub, 42)
		}
		m1Hash = nacl.hash(m1)

		ws.onmessage = function(evt) {
			handleM2(evt.data)
		}

		sendOnWs(m1.buffer)
	}

	function handleM2(data) {
		if (saltState !== STATE_HAND) {
    		error('M2: Invalid internal state: ' + saltState)
    		return
    	}

		telemetry.bytes.received += data.byteLength

		// V2 of SaltChannel
		let m2 = new Uint8Array(data)

		// Header
		if (validHeader(m2, 2, 0)) {

		} else if (validHeader(m2, 2, 129)) {
			error('M2: NoSuchServer exception')
			return;
		} else {
			error('M2: Bad packet header. Expected 2 0 or 2 129, was '
				+ m2[0] + ' ' + m2[1])
			return
		}

		// Time
		let time = getInt32(m2, 2)
		if (time === 0) {
			timeChecker = getNullTimeChecker()
		} else if (time !== 1){
			error('M2: Invalid time value ' + time)
			return
		}

		let serverPub = getUints(m2, 32, 6)

		sessionKey = nacl.box.before(serverPub, ephemeralKeyPair.secretKey)

		m2Hash = nacl.hash(m2)

		ws.onmessage = function(evt) {
			handleM3(evt.data)
		}
	}

	function handleM3(data) {
		if (saltState !== STATE_HAND) {
    		error('M3: Invalid internal state: ' + saltState)
    		return
    	}

		telemetry.bytes.received += data.byteLength

		let b = new Uint8Array(data)
		let m3 = decrypt(b)

		if (!m3) {
			return
		}
		// Header
		if (!validHeader(m3, 3, 0)) {
			error('M3: Bad packet header. Expected 3 0, was ' +
				m3[0] + ' ' + m3[1])
			return
		}

		// Time
		let time = getInt32(m3, 2)
		if (timeChecker.delayed(time)) {
			error('M3: Detected delayed packet')
			return
		}

		let serverPub = getUints(m3, 32, 6)

		if (hostPub) {
			if (!util.uint8ArrayEquals(serverPub, hostPub)) {
				error('M3: ServerSigKey does not match expected')
				return
			}
		}

		let signature = new Uint8Array(64)
		for (let i = 0; i < 64; i++) {
			signature[i] = m3[38+i]
		}

		// Construct the message that was signed
		let concat = new Uint8Array(2*nacl.hash.hashLength + 8)
		concat.set(SIG_STR1_BYTES)
		concat.set(m1Hash, 8)
		concat.set(m2Hash, 8 + nacl.hash.hashLength)

		let success = nacl.sign.detached.verify(concat, signature, serverPub)

		if (!success) {
			error('M3: Could not verify signature')
    		return
		}

		sendM4()

	}

	function sendM4() {
		// Create m4
		let m4 = new Uint8Array(102)

		// Header
		m4[0] = 4

		m4.set(signKeyPair.publicKey, 6)

		let concat = new Uint8Array(2*nacl.hash.hashLength + 8)
		concat.set(SIG_STR2_BYTES)
		concat.set(m1Hash, 8)
		concat.set(m2Hash, 8 + nacl.hash.hashLength)
		// We only send the signature, NOT the message
		let signature = nacl.sign.detached(concat, signKeyPair.secretKey)

		m4.set(signature, 38)

		setInt32(m4, timeKeeper.getTime(), 2)

		let encrypted = encrypt(false, m4)

		sendOnWs(encrypted.buffer)

		ws.onmessage = function(evt) {
			onmsg(evt.data)
		}

		handshakeComplete()
	}

	// =================================================

	// ================ SET FUNCTIONS ==================
	function setOnA2Response(callback) {
    	onA2Response = callback
    }

    function setOnerror(callback) {
    	onerror = callback
    }

    function setOnHandshakeComplete(callback) {
    	onHandshakeComplete = callback
    }

	function setOnmessage(callback) {
		onmessage = callback
	}

	function setOnclose(callback) {
		onclose = callback
	}
	// =================================================

	function getTelemetry() {
		return telemetry
	}

	function getState() {
		switch (ws.readyState) {
			case WS_OPEN:
				return saltState
			case WS_CLOSED:
			case WS_CLOSING:
				return STATE_CLOSED
			case WS_CONNECTING:
				return STATE_WAITING
		}
	}

	function error(msg) {
		saltState = STATE_ERR
		if (typeof onerror === 'function') {
			onerror(new Error(msg))
		} else {
			console.error('saltchannel.onerror not set')
			console.error(new Error(msg))
		}

		close()
	}

	function handshakeComplete() {
		saltState = STATE_READY
		let end = util.currentTimeMs().toFixed(2) - 0
		let start = telemetry.handshake.start

		telemetry.handshake = end - start

		if (typeof onHandshakeComplete === 'function') {
			onHandshakeComplete()
		} else {
			console.error('saltchannel.onHandshakeComplete not set')
		}
	}

	function onmsg(data) {
		if (saltState !== STATE_READY) {
			error('Received message when salt channel was not ready')
			return
		}

		let bytes = new Uint8Array(data)
		telemetry.bytes.received += bytes.byteLength

		let clear = decrypt(bytes)

		if (!clear) {
			return
		}

		let time = getInt32(clear, 2)
		if (timeChecker.delayed(time)) {
			error('(Multi)AppPacket: Detected a delayed packet')
			return
		}

		if (validHeader(clear, 5, 0)) {
			handleAppPacket(clear)
		} else if (validHeader(clear, 11, 0)) {
			handleMultiAppPacket(clear)
		} else {
			error('(Multi)AppPacket: Bad packet header. ' +
			'Expected 5 0 or 11 0, was ' + clear[0] + ' ' + clear[1])
			return
		}
		if (saltState === STATE_LAST) {
			close()
		}
	}

	function handleMultiAppPacket(multiAppPacket) {
		let count = getUint16(multiAppPacket, 6)

		if (count === 0) {
			error('MultiAppPacket: Zero application messages')
			return
		}

		if (typeof onmessage !== 'function') {
			console.error('saltchannel.onMessage not set')
			return
		}

		let offset = 2 + 4 + 2
		for (let i = 0; i < count; i++) {
			let length = getUint16(multiAppPacket, offset)
			offset += 2

			let data = getUints(multiAppPacket, length, offset)
			offset += length

			onmessage(data.buffer)
		}
	}

	function handleAppPacket(appPacket) {
		if (typeof onmessage !== 'function') {
			console.error('saltchannel.onMessage not set')
			return
		}
		let data = getUints(appPacket, appPacket.length - 6, 6)
		onmessage(data.buffer)
	}

	function sendOnWs(message) {
		if (message instanceof ArrayBuffer) {
			telemetry.bytes.sent += message.byteLength
			ws.send(message)
		} else {
			throw new TypeError('Must only send ArrayBuffer on WebSocket')
		}
	}

	function decrypt(message) {
		if (validHeader(message, 6, 0)) {
			// Regular message
		} else if (validHeader(message, 6, 128)) {
			// Last message
			saltState = STATE_LAST;
		} else {
			error('EncryptedMessage: Bad packet header. Expected 6 0 or 6 128, was '
				+ message[0] + ' ' + message[1])
			return null
		}

		let bytes = new Uint8Array(message.byteLength - 2)
		let msg = new Uint8Array(message)

		for (let i = 0; i < message.byteLength - 2; i++) {
			bytes[i] = msg[i+2]
		}

		let clear = nacl.secretbox.open(bytes, dNonce, sessionKey)
		dNonce = increaseNonce2(dNonce)

		if (!clear) {
			error('EncryptedMessage: Could not decrypt message')
			return null
		}
		// clear.length < clear.buffer.byteLength
		clear = new Uint8Array(clear)
		// clear.length == clear.buffer.byteLength

		return clear
	}

	function validHeader(uints, first, second, offset = 0) {
		if (uints[offset] !== first | uints[offset + 1] !== second) {
			return false
		}
		return true
	}

	function getUints(from, length, offset = 0) {
		let uints = new Uint8Array(length)

		for (let i = 0; i < length; i++) {
			uints[i] = from[offset++]
		}

		return uints
	}

	function getInt32(uints, offset) {
		let int32 = new Uint8Array(4)
		int32[0] = uints[offset++]
		int32[1] = uints[offset++]
		int32[2] = uints[offset++]
		int32[3] = uints[offset++]

		return (new Int32Array(int32.buffer))[0]
	}

	function setInt32(uints, data, offset) {
		let view = new DataView(uints.buffer);
		view.setUint32(offset, data, true);
	}

	function getUint16(uints, offset) {
		let uint16 = new Uint8Array(2)
		uint16[0] = uints[offset++]
		uint16[1] = uints[offset]

		return (new Uint16Array(uint16.buffer))[0]
	}

	function setUint16(uints, data, offset) {
		let view = new DataView(uints.buffer);
		view.setUint16(offset, data, true);
	}

	function send(last, arg) {
		if (saltState !== STATE_READY) {
			throw new Error('Invalid state: ' + saltState)
		}
		if (last) {
			saltState = STATE_LAST
		}

		if (arguments.length === 2) {
			if (util.isArray(arg)) {
				if (arg.length === 1) {
					sendAppPacket(last, arg[0])
				} else {
					sendMultiAppPacket(last, arg)
				}
			} else {
				sendAppPacket(last, arg)
			}
		} else {
			// turn arguments into an array
			let arr = []
			for (let i = 1; i < arguments.length; i++) {
				arr[i-1] = arguments[i]
			}
			sendMultiAppPacket(last, arr)
		}

		if (saltState === STATE_LAST) {
			close()
		}
	}

	function sendAppPacket(last, data) {
		if (data instanceof ArrayBuffer) {
			data = new Uint8Array(data)
		} else if (!(data instanceof Uint8Array)) {
			throw new TypeError('Expected data to be ArrayBuffer or Uint8Array')
		}

		let appPacket = new Uint8Array(data.length + 6)

		appPacket[0] = 5
		appPacket.set(data, 6)

		setInt32(appPacket, timeKeeper.getTime(), 2)

		let encrypted = encrypt(last, appPacket)
		sendOnWs(encrypted.buffer)
	}

	function sendMultiAppPacket(last, arr) {
		if (arr.length > 65535) {
			throw new RangeError('Too many application messages')
		}
		let size = 2 + 4 + 2
		for (let i = 0; i < arr.length; i++) {
			if (arr[i] instanceof ArrayBuffer) {
				arr[i] = new Uint8Array(arr[i])
			} else if (!(arr[i] instanceof Uint8Array)) {
				throw new TypeError('Expected data to be ArrayBuffer or Uint8Array')
			}
			if (arr[i].length > 65535) {
				throw new RangeError('Application message ' + i + ' too large')
			}
			size += 2 + arr[i].length
		}

		let multiAppPacket = new Uint8Array(size)
		multiAppPacket[0] = 11

		let offset = 6
		setUint16(multiAppPacket, arr.length, offset)

		offset = 8
		for (let i = 0; i < arr.length; i++) {
			writeMessage(multiAppPacket, arr[i], offset)
			offset += arr[i].length + 2
		}

		setInt32(multiAppPacket, timeKeeper.getTime(), 2)

		let encrypted = encrypt(last, multiAppPacket)
		sendOnWs(encrypted.buffer)
	}

	function writeMessage(multiAppPacket, uints, offset) {
		setUint16(multiAppPacket, uints.length, offset)
		offset += 2
		multiAppPacket.set(uints, offset)
	}

	function encrypt(last, clearBytes) {
		let body = nacl.secretbox(clearBytes, eNonce, sessionKey)
		eNonce = increaseNonce2(eNonce)

		let encryptedMessage = new Uint8Array(body.length + 2)
		encryptedMessage[0] = 6
		encryptedMessage[1] = last ? 128 : 0
		encryptedMessage.set(body, 2)

		return encryptedMessage
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

	return {
		a1a2: a1a2,
		handshake: handshake,
		send: send,

		getTelemetry: getTelemetry,
		getState: getState,

		setOnA2Response: setOnA2Response,
		setOnError: setOnerror,
		setOnHandshakeComplete: setOnHandshakeComplete,
		setOnMessage: setOnmessage,
		setOnClose: setOnclose
	}
}
