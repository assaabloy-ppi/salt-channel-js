import saltchannel from './../../src/saltchannel.js';
import * as util from './../../lib/util.js';
import nacl from './../../lib/nacl-fast-es.js';

let clientSecret = util.hex2Uint8Array('fd2956eb37782aabddc97eaf3b9e1b075f4976770db56c11e866e8763fa073d8' +
            '9cace2ed6af2e108bbabc69c0bb7f3e62a4c0bf59ac2296811a09e480bf7b0f7');
let clientSigKeyPair = nacl.sign.keyPair.fromSecretKey(clientSecret);
let clientEphKeyPair = {
  publicKey: util.hex2Uint8Array('8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a'),
  secretKey: util.hex2Uint8Array('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a')
};

let msg = new Uint8Array([1,3,3,3,3,3]);
let test;
let multiCount;

let ws;
let sc;

function handshake() {
  sc.handshake(clientSigKeyPair, clientEphKeyPair)
}

function a1a2() {
  sc.a1a2()
}

export function run(test) {
  newWebSocket(test)
  sc = saltchannel(ws)
  sc.setOnA2Response(onA2Response)
  sc.setOnError(onSaltChannelError)
  sc.setOnHandshakeComplete(onHandshakeComplete)
  sc.setOnMessage(onMessage)
  sc.setOnClose(onClose)
}

function newWebSocket(test) {
  ws = new WebSocket('ws:localhost:2034');
  ws.binaryType = 'arraybuffer';

  ws.onopen = function(evt) {
    switch (test) {
      case 'a1a2':
        a1a2()
        break
      case 'handshake':
        handshake()
        break
    }
  }

  ws.onclose = function(evt) {
    switch (test) {
      case 'a1a2':
        run('handshake')
        break
    }
  }
}

function onA2Response(prots) {
  let success = true
  let prot = prots[0]

  if (prot.p1 !== 'SCv2------') {
    success = false
  }
  if (prot.p2 !== '----------') {
    success = false
  }

  if (success) {
    console.log('A1A2 PASSED')
  } else {
    console.log('A1A2 FAILED')
  }
}

function onSaltChannelError(err) {
  // err is an Error object
  // err.message is always set
  ws.close() // So that no more messages arrive on a closed Salt Channel
}

function onHandshakeComplete() {
  test = 'AppPacket'
  sc.send(false, msg)
}

function onMessage(message) {
  switch (test) {
    case 'AppPacket':
      if (util.bufferEquals(message, msg.buffer)) {
        console.log('AppPacket PASSED')
      } else {
        console.log('AppPacket FAILED')
      }
      test = 'MultiAppPacket'
      multiCount = 0

      sc.send(false, msg, msg)
      break
    case 'MultiAppPacket':
      multiCount++
      if (util.bufferEquals(message, msg.buffer)) {
        if (multiCount === 2) {
          console.log('MultiAppPacket PASSED')
        }
      } else {
        console.log('MultiAppPacket FAILED')
      }
      if (multiCount === 2) {
        test = 'ReceiveLastFlag'
        msg[0] = 0x02 // "close"
        sc.send(false, msg)
      }
      break
    case 'ReceiveLastFlag':
      if (util.bufferEquals(message, msg.buffer)) {
        console.log('ReceiveLastFlag PASSED')
        msg[0] = 1 // "echo"
      } else {
        console.log('ReceiveLastFlag FAILED')
      }
      break
  }
}

function onClose(status) {

}