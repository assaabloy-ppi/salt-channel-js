var nacl = require('./../lib/nacl.js');
var util = require('./../lib/util.js');

/**
 * JavaScript implementation of Salt Channel v2
 *
 */
module.exports = (ws, thresh) => {
	'use-strict';
	
	const THRESHOLD = (thresh === undefined) ? 5000 : thresh;
	const SIG_STR_1 = 'SC-SIG01';
	const SIG_STR_2 = 'SC-SIG02';

	const SIG_STR1_BYTES = new Uint8Array([ SIG_STR_1.charCodeAt(0)
							,SIG_STR_1.charCodeAt(1)
							,SIG_STR_1.charCodeAt(2)
							,SIG_STR_1.charCodeAt(3)
							,SIG_STR_1.charCodeAt(4)
							,SIG_STR_1.charCodeAt(5)
							,SIG_STR_1.charCodeAt(6)
							,SIG_STR_1.charCodeAt(7)]);

	const SIG_STR2_BYTES = new Uint8Array([ SIG_STR_2.charCodeAt(0)
							,SIG_STR_2.charCodeAt(1)
							,SIG_STR_2.charCodeAt(2)
							,SIG_STR_2.charCodeAt(3)
							,SIG_STR_2.charCodeAt(4)
							,SIG_STR_2.charCodeAt(5)
							,SIG_STR_2.charCodeAt(6)
							,SIG_STR_2.charCodeAt(7)]);
	
	let eNonce;
	let dNonce;
	let m1Hash;
	let m2Hash;
	let m1m2Hash;
	let sessionKey;
	let hostPub;
	let signKeyPair;
	let ephemeralKeyPair;
	let cEpoch;
	let sEpoch;
	
	
	let telemetry;
	let saltState;
	
	// Set by calling corresponding set-function
	let onerror;
	let onA2Response;
	let onHandshakeComplete;
	let onmessage;
	
	init();
	
	function reset() {
		cEpoch = undefined;
		sEpoch = undefined;
		eNonce = undefined;
		dNonce = undefined;
		m1Hash = undefined;
		m2Hash = undefined;
		m1m2Hash = undefined;
		sessionKey = undefined;
		hostPub = undefined;
		signKeyPair = undefined;
		ephemeralKeyPair = undefined;
	
		telemetry = undefined;
		saltState = undefined;
	
		onerror = undefined;
		onA2Response = undefined;
		onHandshakeComplete = undefined;
		onmessage = undefined;
		init();
	}
	
	function init() {
		eNonce = new Uint8Array(nacl.secretbox.nonceLength);
		dNonce = new Uint8Array(nacl.secretbox.nonceLength);
		eNonce[0] = 1;
		dNonce[0] = 2;
		
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
		
		saltState = "init";
	}
	
	// =========== A1A2 MESSAGE EXCHANGE ================
	function a1a2() {
		if (saltState === "init") {
			saltState = "a1a2";
        	sendA1();
        } else {
        	error("Invalid internal state: " + saltState);
        }
    }
    
    function sendA1() {
        let a1 = new Uint8Array(2);
        a1[0] = 8;
        
        ws.onmessage = function(evt) {
            handleA2(evt.data);
        };
                
        ws.send(a1.buffer);
        
    }
    
    function handleA2(message) {
        let a2 = new Uint8Array(message);
        
        let offset = 0;
        
        // Packet type 9
        if (a2[offset++] !== 9) {
            error("Unsuspected packet type, expected 9, was: " + a2[offset-1]);
            return;
        }
        
        // LastFlag must be set
        if (a2[offset++] !== 1) {
            error("Bad second header byte. Must be 1, was: " + a2[offset-1]);
            return;
        }
        
        let count = a2[offset++];
        
        if (count < 1) {
            error("Count must be 1 or greater, was: " + count);
            return;
        }
        
        if (a2.length !== count*20 + 3) {
            error("Bad packet length: " + a2.length);
            return;
        }
        
        let prots = [];
        
        for (let i = 0; i < count; i++) {
        	let p1 = "";
        	let p2 = "";
        	// TODO: prot strings may only contain chars
        	// corresponding to 0x21 to 0x7E
        	for (let j = 0; j < 10; j++) {
        		p1 += String.fromCharCode(a2[offset]);
        		p2 += String.fromCharCode(a2[offset + 10]);
        		offset++;
        	}
            
            prots[i] = {p1: p1, p2: p2};
        }
        
        // TODO: What to do here?!
        // Make it unusable?
        // Reset it to start a new session?
        
        if (typeof onA2Response === "function") {
        	onA2Response(prots);
        } else {
        	error("saltchannel.onA2Response not set");
        }
        
        // Do a hard reset and put session in init state
        reset();
    }
    
    // =================================================
	
	// =============== HANDSHAKE BEGIN =================
	
	function handshake(sigKeyPair, ephKeyPair, hostSigPub) {
		if (saltState === "init") {
			telemetry.handshake.start = Date.now().toFixed(2) - 0;
			signKeyPair = sigKeyPair;
			ephemeralKeyPair = ephKeyPair;
			hostPub = hostSigPub;
			saltState = "handshaking";
			sendM1();
		} else {
			error("Invalid internal state: " + saltState);
		}
	}
	
	function sendM1() {
		let bytes = new Uint8Array(42);
		
		let version = 'SCv2';
		
		bytes[0] = version.charCodeAt(0); 
		bytes[1] = version.charCodeAt(1);
		bytes[2] = version.charCodeAt(2);
		bytes[3] = version.charCodeAt(3);
		
		// Header
		bytes[4] = 1;	// Packet type 1
		bytes[5] = 0;
		
		// Time	
		bytes[6] = 1;
		bytes[7] = 0;
		bytes[8] = 0;
		bytes[9] = 0;
		
		cEpoch = util.currentTimeMs();
		
		// ClientEncKey
		for (let i = 0; i < 32; i++) {
			bytes[10+i] = ephemeralKeyPair.publicKey[i];
		}
	
		m1Hash = nacl.hash(bytes)
		
		ws.onmessage = function(evt) { 
			handleM2(evt); 
		};
		
		sendOnWs(bytes.buffer);
	};
	
	function handleM2(evt) {	
		telemetry.bytes.received += evt.data.byteLength;
		
		// V2 of SaltChannel
		let bytes = new Uint8Array(evt.data);
		
		// Header
		if (bytes[0] != 2) {
			error("Bad header \n\t" +
					"Expected type 2, was: " + bytes[0]);
			return;
		}
		// bytes[1] ignored
		
		// Time
		if (bytes[2] === 1 && bytes[3] === 0 && 
			bytes[4] === 0 && bytes[5] === 0) {
			// Time supported by server	
			sEpoch = util.currentTimeMs();
		} else {
			// Time not supported by server
			// TODO: Do something?
		}
		
		let serverPub = new Uint8Array(32);
		
		for (let i = 0; i < 32; i++) {
			serverPub[i] = bytes[6+i];
		}
		
		sessionKey = nacl.box.before(serverPub, ephemeralKeyPair.secretKey);
				
		m2Hash = nacl.hash(bytes);
		
		ws.onmessage = function(evt) { 
			handleM3(evt); 
		};
		
	};
	
	function handleM3(evt) {
		telemetry.bytes.received += evt.data.byteLength;
		
		let b = new Uint8Array(evt.data);
		let m3 = decrypt(b);

		// Header
		if (m3[0] != 3) {
			error("Bad header \n\t" +
			 		"Expected type 3, was: " + m3[0]);
			 return;
		}
		// m3[1] ignored
		
		// Time
		let time = new Uint8Array(4);
		time[0] = m3[2];
		time[1] = m3[3];
		time[2] = m3[4];
		time[3] = m3[5];
		
		time = (new Int32Array(time.buffer))[0];
		
		if (util.currentTimeMs() - cEpoch > time + THRESHOLD ) {
			error("Detected a delayed packet");
			return;
		}
		
		let serverPub = new Uint8Array(32);
		for (let i = 0; i < 32; i++) {
			serverPub[i] = m3[6+i];
		}
		
		let signature = new Uint8Array(64);
		for (let i = 0; i < 64; i++) {
			signature[i] = m3[38+i];
		}
		
		if (hostPub !== undefined && 
			!(util.bufferEquals(serverPub.buffer, hostPub.buffer))) {
			error("Unexpected server identity. \n\t" +
							"Expected: " + hostPub + "\n\t" +
							"Parsed: " + serverPub);
			return;
		}
		
		// Construct the message that was signed
		let concat = new Uint8Array(2*nacl.hash.hashLength + 8);
		
		for(let i = 0; i < 8; i++) {
			concat[i] = SIG_STR1_BYTES[i];
		}

		for (let i = 0; i < nacl.hash.hashLength; i++) {
			concat[8+i] = m1Hash[i];
			concat[8+i+nacl.hash.hashLength] = m2Hash[i];
		}
			
		let success = nacl.sign.detached.verify(concat, signature, serverPub);
		
		if (!success) {
			error("Could not verify signature: \n\t " +
    				"Message: " + concat + "\n\t" +
    				"Signature: " + signature + "\n\t" +
    				"PublicKey: " + serverPub);
    		return;
		}
		
		sendM4();
				
	}
	
	function sendM4() {
		// Create m4
		let m4 = new Uint8Array(102);
		
		// Header
		m4[0] = 4;
		m4[1] = 0;
		
		for (let i = 0; i < 32; i++) {
			m4[6+i] = signKeyPair.publicKey[i];
		}
		
		let concat = new Uint8Array(2*nacl.hash.hashLength + 8);
		
		for(let i = 0; i < 8; i++) {
			concat[i] = SIG_STR2_BYTES[i];
		}

		for (let i = 0; i < nacl.hash.hashLength; i++) {
			concat[8+i] = m1Hash[i];
			concat[8+i+nacl.hash.hashLength] = m2Hash[i];
		}		
		// We only send the signature, NOT the message
		let signature = nacl.sign.detached(concat, signKeyPair.secretKey);
		
		for (let i = 0; i < 64; i++) {
			m4[38+i] = signature[i];
		}
		
		let time = new Int32Array([util.currentTimeMs() - cEpoch]);
		time = new Uint8Array(time.buffer);
	
		m4[2] = time[0];
		m4[3] = time[1];
		m4[4] = time[2];
		m4[5] = time[3];
				
		let encrypted = encrypt(m4);
		
		sendOnWs(encrypted.buffer);
		
		ws.onmessage = function(evt) { 
			onmsg(evt); 
		};
				
		handshakeComplete();
	}
	
	// =================================================
	
	// ================ SET FUNCTIONS ==================
	function setOnA2Response(callback) {
    	onA2Response = callback;
    }
    
    function setOnerror(callback) {
    	onerror = callback;
    }
    
    function setOnHandshakeComplete(callback) {
    	onHandshakeComplete = callback;
    }
    
	function setOnmessage(callback){
		onmessage = callback;
	}
	// =================================================
	
	function close() {
		// TODO! What do we do when we close a 
		// salt channel session?! 
		// reset and set to init-state??
	}
	
	function getTelemetry() {
		return telemetry;
	}
	
	function getState() {
		return saltState;
	}
	
	function error(err) {
		err = "SaltChannel error: " + err;
		if (typeof onerror === "function") {
			onerror(err);
		} else {
			console.error("saltchannel.onerror not set");
			console.error(err);
		}
		
		// Do a hard reset and put session in init state
		reset();
	}
	
	function handshakeComplete() {
		console.log("sEpoch " + sEpoch);
		console.log("cEpoch " + cEpoch);
		saltState = "ready";
		telemetry.handshake.end = Date.now().toFixed(2) - 0;
		telemetry.handshake.total = (telemetry.handshake.end - telemetry.handshake.start).toFixed(2) - 0;
		
		if (typeof onHandshakeComplete === "function") {
			onHandshakeComplete();
		} else {
			error("saltchannel.onHandshakeComplete not set");
		}
	}
	
	function onmsg(evt) {
		let bytes = new Uint8Array(evt.data);
		telemetry.bytes.received += bytes.byteLength;

		let clear = decrypt(bytes);
		
		if (!(clear[0] === 5 && clear[1] === 0)) {
			error("Bad packet header. \n\t" +
						"Expected type 5, was: " + clear[0] + "\n\t" +
						"Expected zero, was: " + clear[1]);
		}
		
		// 4 bytes of time is ignored (clear[2], ..., clear[5])
	
		let data = new Uint8Array(clear.buffer.byteLength - 6);
		for (let i = 0; i < clear.buffer.byteLength; i++) {
			data[i] = clear[6+i];
		}
		
		if (typeof onmessage === "function") {			
			onmessage(data);
		} else {
			error("saltchannel.onmessage not set");
		}
	}
	
	function sendOnWs(message) {
		if (message instanceof ArrayBuffer) {
			telemetry.bytes.sent += message.byteLength;
			ws.send(message);
		} else {
			error("Must only send ArrayBuffer");
		}
	}
	
	function decrypt(message) {
		if (!(message[0] === 6 && message[1] === 0)) {
			error("Bad packet header \n\t" +
					"Expected type 6, was: " + message[0] + "\n\t" +
					"Expected zero, was: " + message[1]);
			return;
		}
		
		let bytes = new Uint8Array(message.byteLength - 2);
		let msg = new Uint8Array(message);
		
		for (let i = 0; i < message.byteLength - 2; i++) {
			bytes[i] = msg[i+2];
		}
				
		let clear = nacl.secretbox.open(bytes, dNonce, sessionKey);
		dNonce = increaseNonce2(dNonce);
		
		if (clear === false) {
			error("Could not decrypt message");
			return;
		}
	
		let copy = new Uint8Array(clear.length);
		for (let i = 0; i < copy.length; i++) {
			copy[i] = clear[i];
		}
		return copy;
	}
	
	function send(data) {
		let appPacket = new Uint8Array(data.buffer.byteLength + 6);
		
		appPacket[0] = 5;
		
		for (let i = 0; i < data.buffer.byteLength; i++) {
			appPacket[6+i] = data[i]; 
		}
	
		let encrypted = encrypt(appPacket);
		sendOnWs(encrypted.buffer);
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
	
	/**
	 * Parameters: 	
	 *		nonce	- a Uint8Array representing a NaCl secretbox nonce.
	 *					Can be thought of as an unsigned 192-bit integer
	 *					where only the 8 least significant bytes are increased
	 * 
	 * Returns: 	
	 *		a Uint8Array representing a NaCl secretbox nonce.
	 *			The original unsigned 192-bit integer + 1.
	 *
	 * Throws error:
	 *		if input is not a Uint8Array.
	 *		if input is not 24 bytes long.
	 */
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

	/**
	 * Parameters: 	A Uint8Array representing a NaCl secretbox nonce.
	 *			Can be thought of as an unsigned 192-bit integer (24 bytes).
	 * 
	 * Returns: 	
	 *		a Uint8Array representing a NaCl secretbox nonce.
	 *			The original unsigned 192-bit integer + 2.
	 *
	 * Throws error:
	 *		if input is not a Uint8Array.
	 *		if input is not 24 bytes long.
	 */
	function increaseNonce2(nonce) {
		nonce = increaseNonce(nonce);
		nonce = increaseNonce(nonce);
		return nonce;
	}
	
	return {
		a1a2: a1a2,
		close: close,
		handshake: handshake,
		getTelemetry: getTelemetry,
		getState: getState,
		setOnA2Response: setOnA2Response,
		setOnerror: setOnerror,
		setOnHandshakeComplete: setOnHandshakeComplete,
		setOnmessage: setOnmessage
	}
}













