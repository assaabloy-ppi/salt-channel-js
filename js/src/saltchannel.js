var nacl = require('./../lib/nacl-fast.js')
var util = require('./../lib/util.js')

/**
 * JavaScript implementation of Salt Channel v2
 *
 */
module.exports = (ws, thresh = 5000) => {
	'use-strict'
	
	const THRESHOLD = thresh
	const SIG_STR_1 = 'SC-SIG01'
	const SIG_STR_2 = 'SC-SIG02'
	const VERSION_STR = 'SCv2'
	
	const STATE_INIT = 'init'
	const STATE_A1A2 = 'a1a2'
	const STATE_HAND = 'handshake'
	const STATE_READY = 'ready'
	const STATE_LAST = 'last'
	
	const ADDR_TYPE_ANY = 0
	const ADDR_TYPE_PUB = 1

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
	
	let timeSupported
	let cEpoch
	let sEpoch
	
	let telemetry
	let saltState
	
	// Set by calling corresponding set-function
	let onerror
	let onA2Response
	let onHandshakeComplete
	let onmessage
	
	init()
	
	function reset() {
		cEpoch = undefined
		sEpoch = undefined
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
		saltState = undefined
	
		init()
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
        	error('A1A2: Invalid internal state: ' + saltState)
        }
    }
    
    function sendA1(adressType = ADDR_TYPE_ANY, adress) {
    	let a1
    	if (adressType === ADDR_TYPE_ANY) {
        	a1 = new Uint8Array(5)
        	a1[0] = 8
        } else if (adressType === ADDR_TYPE_PUB) {
        	a1 = new Uint8Array(5 + adress.length)
        	a1[0] = 8
        	a1[2] = ADDR_TYPE_PUB
        	setUint16(a1, adress.length, 3)
        	a1.set(adress, 5)
        } else {
        	error('A1A2: Invalid adress type ' + adressType)
        	return
        }
        
        ws.onmessage = function(evt) {
            handleA2(evt.data)
        }
                
        ws.send(a1.buffer)
        
    }
    
    function handleA2(message) {
    	if (saltState !== STATE_A1A2) {
    		error('A2: Invalid internal state: ' + saltState)
    		return
    	}
        let a2 = new Uint8Array(message)
                
        // Packet type 9
        if (!validHeader(a2, 9, 1)) {
        	error('A2: Bad packet header. Expected 9 1, was ' + 
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
        		if (a2[offset] < low || a2[offset] > high) {
        			error('A2: Invalid char in p1 "' +
        				String.fromCharCode(a2[offset]) + '"')
        			return
        		}
        		if (a2[offset + 10] < low || a2[offset + 10] > high) {
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
        
        if (typeof onA2Response === 'function') {
        	onA2Response(prots)
        } else {
        	error('saltchannel.onA2Response not set')
        	return
        }
        
        // Do a hard reset and put session in init state
        reset()
    }
    
    // =================================================
	
	// =============== HANDSHAKE BEGIN =================
	
	function handshake(sigKeyPair, ephKeyPair, hostSigPub) {
		if (saltState === STATE_INIT) {
			telemetry.handshake.start = util.currentTimeMs().toFixed(2) - 0
			signKeyPair = sigKeyPair
			ephemeralKeyPair = ephKeyPair
			hostPub = hostSigPub
			saltState = STATE_HAND
			sendM1()
		} else {
			error('Handshake: Invalid internal state: ' + saltState)
		}
	}
	
	function sendM1() {
		let m1Len = (hostPub === undefined) ? 42 : 74
		let m1 = new Uint8Array(m1Len)
		
		m1.set(VERSION)

		// Header
		m1[4] = 1	// Packet type 1
		m1[5] = (hostPub === undefined) ? 0 : 128

		// Time	
		setInt32(m1, 1, 6)
				
		// ClientEncKey
		m1.set(ephemeralKeyPair.publicKey, 10)
	
		// ServerSigKey
		if (hostPub !== undefined) {
			m1.set(hostPub, 42)
		}
		m1Hash = nacl.hash(m1)
		
		ws.onmessage = function(evt) { 
			handleM2(evt) 
		}

		cEpoch = util.currentTimeMs()
		
		sendOnWs(m1.buffer)
	}
	
	function handleM2(evt) {
		if (saltState !== STATE_HAND) {
    		error('M2: Invalid internal state: ' + saltState)
    		return
    	}
    	
		telemetry.bytes.received += evt.data.byteLength
		
		// V2 of SaltChannel
		let m2 = new Uint8Array(evt.data)
		
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
		if (time === 1) {
			// Time supported by server	
			sEpoch = util.currentTimeMs()
			timeSupported = true
		} else if (time === 0){
			timeSupported = false
		} else {
			error('M2: Invalid time value ' + time)
			return
		}
		
		let serverPub = getUints(m2, 32, 6)
		
		sessionKey = nacl.box.before(serverPub, ephemeralKeyPair.secretKey)
				
		m2Hash = nacl.hash(m2)
		
		ws.onmessage = function(evt) { 
			handleM3(evt) 
		}
	}
	
	function handleM3(evt) {
		if (saltState !== STATE_HAND) {
    		error('M3: Invalid internal state: ' + saltState)
    		return
    	}
    	
		telemetry.bytes.received += evt.data.byteLength
		
		let b = new Uint8Array(evt.data)
		let m3 = decrypt(b)

		if (!m3) {
			return
		}
		// Header
		if (!validHeader(m3, 3, 0)) {
			error('Bad packet header. Expected 3 0, was ' + 
				m2[offset] + ' ' + m2[offset + 1 ])
			return
		}
		
		// Time	
		if (delayed(m3, 2)) {
			error('M3: Detected delayed packet')
			return
		}
		
		let serverPub = getUints(m3, 32, 6)
		
		if (hostPub !== undefined) {
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
			error('Could not verify signature')
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
		
		if (timeSupported) {
			setInt32(m4, cEpoch - util.currentTimeMs(), 2)
		}
		
		let encrypted = encrypt(false, m4)
		
		sendOnWs(encrypted.buffer)
		
		ws.onmessage = function(evt) { 
			onmsg(evt) 
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
    
	function setOnmessage(callback){
		onmessage = callback
	}
	// =================================================
	
	function getTelemetry() {
		return telemetry
	}
	
	function getState() {
		return saltState
	}
	
	function error(err) {
		err = 'SaltChannel error: ' + err
		if (typeof onerror === 'function') {
			onerror(new Error(err))
		} else {
			console.error('saltchannel.onerror not set')
			console.error(new Error(err))
		}
		
		// Do a hard reset and put session in init state
		reset()
	}
	
	function handshakeComplete() {
		saltState = STATE_READY
		telemetry.handshake.end = util.currentTimeMs().toFixed(2) - 0
		telemetry.handshake.total = (telemetry.handshake.end - telemetry.handshake.start)
		telemetry.handshake.total = telemetry.handshake.total.toFixed(2) - 0
		
		if (typeof onHandshakeComplete === 'function') {
			onHandshakeComplete()
		} else {
			error('saltchannel.onHandshakeComplete not set')
		}
	}
	
	function onmsg(evt) {
		if (saltState !== 'ready') {
			error('Received message when salt channel was not ready')
			return
		}
		
		let bytes = new Uint8Array(evt.data)
		telemetry.bytes.received += bytes.byteLength

		let clear = decrypt(bytes)
		
		if (!clear) {
			return
		}
		
		if (delayed(clear, 2)) {
			error('(Multi)AppPacket: Detected a delayed packet')
			return
		}
		
		if (typeof onmessage !== 'function') {			
			error('saltchannel.onmessage not set')
			return
		}
		
		if (validHeader(clear, 5, 0)) {
			handleAppPacket(clear)
		} else if (validHeader(clear, 11, 0)) {
			handleMultiAppPacket(clear)
		} else {
			error('(Multi)AppPacket: Bad packet header. ' +
			'Expected 5 0 or 11 0, was: ' + clear[0] + ' ' + clear[1])
			return
		}
		if (saltState === STATE_LAST) {
			reset()
		}
	}
	
	function handleMultiAppPacket(multiAppPacket) {
		let count = getUint16(multiAppPacket, 6)
		
		if (count === 0) {
			error('MultiAppPacket: Zero application messages')
			return
		}
		
		let offset = 2 + 4 + 2
		for (let i = 0; i < count; i++) {
			let length = getUint16(multiAppPacket, offset)
			offset += 2
			
			let data = getUints(multiAppPacket, length, offset)
			offset += length
			
			onmessage(data)
		}
	}
	
	function handleAppPacket(appPacket) {
		let data = getUints(appPacket, appPacket.length - 6, 6)
		onmessage(data)
	}
	
	function sendOnWs(message) {
		if (message instanceof ArrayBuffer) {
			telemetry.bytes.sent += message.byteLength
			ws.send(message)
		} else {
			error('Must only send ArrayBuffer')
		}
	}
	
	function decrypt(message) {
		if (validHeader(message, 6, 0)) {
			// Regular message
		} else if (validHeader(message, 6, 1)) {
			// Last message
			saltState = STATE_LAST;
		} else {
			error('Bad packet header. Expected ' + 6 + ' ' + 0 + 
			' was ' + message[0] + ' ' + message[1])
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
			error('Could not decrypt message')
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
	
	function delayed(uints, offset) {
		if (timeSupported) {
			let time = getInt32(uints, offset)
			let expectedTime = util.currentTimeMs() - cEpoch
			return expectedTime > time + THRESHOLD
		}
		
		return false
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
		let int32 = new Int32Array([data])		
		uints.set(int32, offset)
	}
	
	function getUint16(uints, offset) {
		let uint16 = new Uint8Array(2)
		uint16[0] = uints[offset++]
		uint16[1] = uints[offset]
		
		return (new Uint16Array(uint16.buffer))[0]
	}
	
	function setUint16(uints, data, offset) {
		let uint16 = new Uint16Array([data])
		uints.set(uint16, offset)
	}
	
	function send(last, arg) {
		if (last) {
			saltState = STATE_LAST
		}
		if (arguments.length < 2) {
			return
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
			reset()
		}
	}
	
	function sendAppPacket(last, data) {
		let appPacket = new Uint8Array(data.length + 6)
		
		appPacket[0] = 5
		appPacket.set(data, 6)
		
		if (timeSupported) {
			setInt32(appPacket, cEpoch - util.currentTimeMs(), 2)
		}
	
		let encrypted = encrypt(last, appPacket)
		sendOnWs(encrypted.buffer)
	}
	
	function sendMultiAppPacket(last, arr) {
		if (arr.length > 65535) {
			error('Too many application messages')
			return
		}
		let size = 2 + 4 + 2
		for (let i = 0; i < arr.length; i++) {
			if (arr[i].length > 65535) {
				error('Application message ' + i + ' too large')
				return
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
		
		if (timeSupported) {
			setInt32(multiAppPacket, cEpoch - util.currentTimeMs(), 2)
		}
		
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
		encryptedMessage[1] = last ? 1 : 0
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
		getTelemetry: getTelemetry,
		getState: getState,
		send: send,
		setOnA2Response: setOnA2Response,
		setOnerror: setOnerror,
		setOnHandshakeComplete: setOnHandshakeComplete,
		setOnmessage: setOnmessage
	}
}
