exports.hexStringToUint8Array = (str) => {
    str = str.trim().toLowerCase();
    if (str.substring(0,2) === '0x') {
        str = str.substring(2, str.length);
    }
    if (str.length % 2 !== 0) {
        throw new Error("String length has to be even. \n\t" +
            "Length: " + str.length);
    }
    var byte;
    var arr = [];
    for (var i = 0; i < str.length; i += 2) {
        byte = str.substring(i, i+2);
        if (!((/[0-9a-fA-F]{2}/).test(byte))) {
            throw new Error("Bad string format, must be hexadecimal.\n\t" +
                "String: " + str + "\n\t" +
                "Byte: " + byte + "\n\t" +
                "Pos: " + i);
        }
        arr.push(parseInt(byte, 16));
    }
    return new Uint8Array(arr);
}

exports.uint8ArrayEquals = (uints1, uints2) => {
	if (!(uints1 instanceof Uint8Array) ||
		!(uints2 instanceof Uint8Array)) {
		throw new Error("Expected Uint8Arrays");	
	}
	if (uints1.length !== uints2.length) {
		return false;
	}
	for (let i = 0; i < uints1.length; i++) {
		if (uints1[i] !== uints2[i]) {
			return false;
		}
	}
	return true;
}

exports.currentTimeMs = () => {
	if (!Date.now) {
		return new Date.getTime();
	} else {
		return Date.now();
	}
}

exports.isString = (s) => {
	return typeof s === "string" || s instanceof String;
}

/**
 * Parameters: 
 *		buffer1 	- an ArrayBuffer instance
 *		buffer2		- an ArrayBuffer instance
 *
 * Returns:
 *		true iff the two ArrayBuffers contains identical bytes
 *		false otherwise
 * 
 * Throws error: 
 *		if buffer1 and buffer2 are not ArrayBuffers
 */
exports.bufferEquals = (buffer1, buffer2) => {
	if (!(buffer1 instanceof ArrayBuffer) ||
		!(buffer2 instanceof ArrayBuffer)) {
		throw new Error("Expected ArrayBuffers");	
	}
	let bytes1 = new Uint8Array(buffer1);
	let bytes2 = new Uint8Array(buffer2);
	if (bytes1.length !== bytes2.length) {
		return false;
	}
	for (let i = 0; i < bytes1.length; i++) {
		if (bytes1[i] !== bytes2[i]) {
			return false;
		}
	}
	return true;
}

exports.buf2hex = (buffer) => { // buffer is an ArrayBuffer
	return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}