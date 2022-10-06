const net = require('net')
const modbus = require('jsmodbus')
const netServer = new net.Server()
const coils = Buffer.alloc(10000)
const discrete = Buffer.alloc(10000)
const holding = Buffer.alloc(10000)
const input = Buffer.alloc(10000)

const printRequest = function(request){
    if (request.name.startsWith("Write")) {
        let value;
        if (request.body.count === 1) {
            value = request.body.value;
        } else {
            value = request.body.valuesAsArray;
        }
        console.log(`[${new Date}]  --> ${request.name}: Addr: ${request.body.address} => ${JSON.stringify(value)} (${request.body.count})`)
    } else {
        let value = [];
        let buffer;
        if (request.name.includes("Coil")) { buffer = server.coils; }
        else if (request.name.includes("Discrete")) { buffer = server.discrete; }
        else if (request.name.includes("Holding")) { buffer = server.holding; }
        else if (request.name.includes("Input")) { buffer = server.input; }

        for (let index = 0; index < request.body.count; index++) {
            value.push(buffer.readUInt16BE((request.body.start + index) * 2));
        }
        console.log(`[${new Date}]  <-- ${request.name}: Addr: ${request.body.start} => ${JSON.stringify(value)} (${request.body.count})`)
    }
}

const server = new modbus.server.TCP(netServer, {
    coils: coils,
    discrete: discrete,
    holding: holding,
    input: input
})

server.on('connection', function (client) {
    console.log(`\n[${new Date}] Connection begin: ${client.socket.remoteAddress}`)
    client.socket.on('close', function(exception) {
        console.log(`[${new Date}] Connection end: ${client.socket.remoteAddress}`)
    });
    client.socket.on('error', (err) => {
        console.log(err);
    });
})

server.on('preReadCoils', function (request) { printRequest(request); });
server.on('preReadDiscreteInputs', function (request) { printRequest(request); });
server.on('preReadHoldingRegisters', function (request) { printRequest(request); });
server.on('preReadInputRegisters', function (request) { printRequest(request); });
server.on('preWriteSingleCoil', function (request) { printRequest(request); });
server.on('preWriteSingleRegister', function (request) { printRequest(request); });
server.on('preWriteMultipleCoils', function (request) { printRequest(request); });
server.on('preWriteMultipleRegisters', function (request) { printRequest(request); });



console.log(process.argv[2])
netServer.listen(process.argv[2] || 8502)

require("./logger");
