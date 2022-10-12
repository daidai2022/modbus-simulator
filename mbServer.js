const net = require('net')
const modbus = require('jsmodbus')
const request = require('sync-request')
const netServer = new net.Server()
const coils = Buffer.alloc(10000)
const discrete = Buffer.alloc(10000)
const holding = Buffer.alloc(10000)
const input = Buffer.alloc(10000)

const adminAddr = process.argv[2];
const modbusPort = process.argv[3] || 8502;

const doRequest = function (action, type, address, count, values) {
    let response;
    try {
        switch(action){
            case "read": {
                response = request('GET',
                    `http://${adminAddr}/${type}?address=${address}&count=${count}`
                )?.body?.toString();
                break;
            }
            case "write": {
                response = request('POST',
                    `http://${adminAddr}/${type}?address=${address}&count=${count}`,
                    { json: values }
                )?.body?.toString();
                break;
            }
        }
        response = JSON.parse(response);
    } catch (error) {
        
    }
    return response;
}

const getBuffer = function(type){
    switch(type){
        case "coil": return server.coils;
        case "discrete": return server.coils;
        case "holding": return server.discrete;
        case "input": return server.input;
    }
}

const logAction = function (action, type, address, count, values) {
    switch(action){
        case "write": {
            console.log(`  --> ${action} ${type}: Addr: ${address} => ${JSON.stringify(values)} (${count})`)
            break;
        }
        case "read": {
            let value = [];
            let buffer = getBuffer(type);

            for (let index = 0; index < count; index++) {
                value.push(buffer.readUInt16BE((address + index) * 2));
            }
            console.log(`  <-- ${action} ${type}: Addr: ${address} => ${JSON.stringify(value)} (${count})`)
            
            break;
        }
    }
}

const preProcess = function (request) {
    const params = request.name.replace(/([A-Z])/g, ",$1").toLowerCase().split(",");
    let action = params[1];
    let type = "";

    let address = 0;
    let count = request.body.count;
    let values = [];
    
    switch(action) {
        case "write":{
            type = params[3].includes("coil") ? "coil" : "holding";
            address = request.body.address;
            values = count === 1 ? [request.body.value] : request.body.valuesAsArray;
            break;
        }
        case "read": {
            type = params[2];
            address = request.body.start;
            break;
        }
    }

    if (type.endsWith("s")) {
        type = type.slice(0, -1);
    }

    if (adminAddr !== undefined) {
        let data = doRequest(action, type, address, count, values);
        if (Array.isArray(data) && count === data.length) {
            let buffer = getBuffer(type);
            for (let index = 0; index < count; index++) {
                buffer.writeUInt16BE(data[index], (address + index) * 2);
            }
        }
    }

    logAction(action, type, address, count, values);
}

const server = new modbus.server.TCP(netServer, {
    coils: coils,
    discrete: discrete,
    holding: holding,
    input: input
})

server.on('connection', function (client) {
    console.log('Connection begin: ' + client.socket.remoteAddress)
    client.socket.on('close', function (exception) {
        console.log('Connection end: ' + client.socket.remoteAddress)
    });
    client.socket.on('error', (err) => {
        console.log(err);
    });
})

server.on('preReadCoils', function (request) { preProcess(request); });
server.on('preReadDiscreteInputs', function (request) { preProcess(request); });
server.on('preReadHoldingRegisters', function (request) { preProcess(request); });
server.on('preReadInputRegisters', function (request) { preProcess(request); });
server.on('preWriteSingleCoil', function (request) { preProcess(request); });
server.on('preWriteSingleRegister', function (request) { preProcess(request); });
server.on('preWriteMultipleCoils', function (request) { preProcess(request); });
server.on('preWriteMultipleRegisters', function (request) { preProcess(request); });

console.log(`Modbus server started at port ${modbusPort}`)
if (adminAddr === undefined) {
    console.log("Standalone mode enabled");
} else {
    console.log(`Connected with admin server: ${adminAddr}`);
}
netServer.listen(modbusPort)