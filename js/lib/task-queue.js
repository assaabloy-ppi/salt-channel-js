export default function(){
    let buffer = [];

    async function add(task) {
        buffer.push({
            whenDone: undefined
        });

        let waitForMyTurn = new Promise(function (resolve) {
            let previous = buffer[buffer.length - 2];
            if (previous !== undefined) {
                previous.whenDone = resolve;
            } else {
                resolve();
            }
        });

        await waitForMyTurn;

        try {
            return await new Promise(task)
        }
        catch (e) {
            throw e;
        }
        finally {
            let item = buffer.shift();
            if (item.whenDone !== undefined){
                item.whenDone()
            }
        }
    }

    return {
        add: add
    }
}