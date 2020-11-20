import TaskQueue from './task-queue.js';

const SERVICE_UUID = 'bad3e900-4320-4a8c-b57e-4646484b53a1';
const TX_CHARACTERISTIC_UUID = '00000002-0000-1000-8000-00805f9b34fb';
const RX_CHARACTERISTIC_UUID = '00000003-0000-1000-8000-00805f9b34fb';

const MTU = 20;

const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

export function createFilterOptions(name){
    return {
        filters: [{
            namePrefix: name
        }],
        optionalServices: [SERVICE_UUID]
    }
}

export async function connect(device) {
    let txCharacteristic;
    let rxCharacteristic;
    let selectedDevice;
    let connectedServer;

    let sendQueue = TaskQueue();
    let receiveBuffer = new Uint8Array([]);

    let exposedFunctions = {
        onclose: () => console.log('onclose called'),
        onerror: (e) => console.error('Error: ', e),
        onmessage: () => console.log('onmessage called'),
        onopen: () => console.log('onopen called'),
        close: close,
        send: send,
        CONNECTING: CONNECTING,
        OPEN: OPEN,
        CLOSING: CLOSING,
        CLOSED: CLOSED,
        readyState: CLOSED
    };

    async function connectingToDevice(device) {
        exposedFunctions.readyState = CONNECTING;
        return await device.gatt.connect();
    }

    function connectedToServer(device, server) {
        console.log("Connected to GATT server:", server);
        device.addEventListener('gattserverdisconnected', onDisconnected);
    }

    async function getPrimaryService(server) {
        return await server.getPrimaryService(SERVICE_UUID);
    }

    async function getCharacteristics(service) {
        console.log('getCharacteristics for service: ' + service.uuid);

        let getCalls = [
            service.getCharacteristic(TX_CHARACTERISTIC_UUID),
            service.getCharacteristic(RX_CHARACTERISTIC_UUID)
        ];

        [txCharacteristic, rxCharacteristic] = await Promise.all(getCalls);
    }

    async function setupDataListener() {
        let handle = await rxCharacteristic.startNotifications();
        await handle.addEventListener('characteristicvaluechanged', receive);
        console.log('Listening for received data.');
        exposedFunctions.readyState = OPEN;
    }

    function onDisconnected() {
        exposedFunctions.onclose();
        exposedFunctions.readyState = CLOSED;
    }

    function receive(event) {
        let chunk = event.target.value.buffer;

        receiveBuffer = addByteArray(receiveBuffer, chunk);

        while (true) {
            if (receiveBuffer.length < 4){
                break;
            }
            let messageLength = bytesToIntLE(receiveBuffer, 0);
            if (messageLength <= 0) {
                throw "Incorrect messageLength: " + messageLength;
            }

            if (receiveBuffer.length < (4 + messageLength)){
                break;
            }

            let message = receiveBuffer.slice(4, 4+messageLength);
            receiveBuffer = receiveBuffer.slice(4+messageLength);

            exposedFunctions.onmessage({data: message});
        }
    }

    function send(data) {
        if (!((data instanceof ArrayBuffer) || (data instanceof Uint8Array))) {
            throw new TypeError('Must only send ArrayBuffer or Uint8Array')
        }

        let header = intToBytesLE(data.byteLength);
        let message = addByteArray(header, data);

        while (message.length !== 0) {
            let chunk = message.slice(0, MTU);
            message = message.slice(MTU);
            sendQueue.add(sendChunk(chunk));
        }
    }

    function sendChunk(chunk) {
        return async (resolve) => {
            await txCharacteristic.writeValue(chunk);
            resolve();
        }
    }

    function addByteArray(arrayA, arrayB){
        if (arrayA instanceof ArrayBuffer) {
            arrayA = new Uint8Array(arrayA)
        }
        if (arrayB instanceof ArrayBuffer) {
            arrayB = new Uint8Array(arrayB)
        }
        if (!(arrayA instanceof ArrayBuffer) || !(arrayB instanceof ArrayBuffer)) {
            arrayB = new Uint8Array(arrayB)
        }

        let returnArray = new Uint8Array(arrayA.length + arrayB.length);
        returnArray.set(arrayA);
        returnArray.set(arrayB, arrayA.length);

        return returnArray;
    }

    function intToBytesLE(num) {
        let arr = new ArrayBuffer(4);
        let view = new DataView(arr);
        view.setUint32(0, num, true);
        return arr;
    }

    function bytesToIntLE(arr, offset) {
        let data = new Uint8Array(arr, offset, offset + 4);
        let view = new DataView(data.buffer);
        return view.getInt32(0, true);
    }

    function close() {
        exposedFunctions.readyState = CLOSING;
        selectedDevice.gatt.disconnect();
    }

    async function constructor(device) {
        selectedDevice = device;
        connectedServer = await connectingToDevice(selectedDevice);
        connectedToServer(selectedDevice, connectedServer);
        let service = await getPrimaryService(connectedServer);
        await getCharacteristics(service);
        await setupDataListener();

        return exposedFunctions;
    }

    return await constructor(device);
}

export const BluetoothAvailability = {
    AVAILABLE: 0, // Device has hardware but it could be on or off
    NO_HARDWARE: 1, // Device is missing hardware
    NO_BROWSER_SUPPORT: 2 // Browser is missing functionality
};

export async function bluetoothAvailability() {
    if (navigator.bluetooth === undefined) {
        return BluetoothAvailability.NO_BROWSER_SUPPORT;
    }
    // https://webbluetoothcg.github.io/web-bluetooth/#availability-fingerprint
    else if (await navigator.bluetooth.getAvailability()){
        return BluetoothAvailability.AVAILABLE;
    } else {
        return BluetoothAvailability.NO_HARDWARE;
    }
}

export async function listenToBluetoothAvailability(callback) {
    try{
        navigator.bluetooth.addEventListener('availabilitychanged', async function () {
            callback(await bluetoothAvailability())
        });
    } catch (e) {
        console.warn(e);
    }
    callback(await bluetoothAvailability())
}