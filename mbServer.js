const net = require('net')
const modbus = require('jsmodbus')
const request = require('sync-request')

const express = require('express')
const bodyParser = require("body-parser");
const { exit } = require('process');
const { write } = require('fs');

const netServer = new net.Server()
const coils = Buffer.alloc(50000)
const discrete = Buffer.alloc(50000)
const holding = Buffer.alloc(50000)
const input = Buffer.alloc(50000)

const modbusPort = process.argv[2] || 8502;
const adminAddr = process.argv[3];

const app = express();
const port = 8000;
var data = {};

const DEFAULT_VALUE = 6;

const CHANGING_VALUE = {
    enable: true,
    type: "holding",
    addr: 30,
    min: 300,
    max: 400
}

const readValues = function (type, address, count) {
    let res = [];
    const buf = data[type];
    for (let i = 0; i < count; i++) {
        let v = (buf !== undefined && (buf[address + i] !== undefined)) ? buf[address + i] : DEFAULT_VALUE;
        if(CHANGING_VALUE.enable
            && (type === CHANGING_VALUE.type)
            && ((address + i) === CHANGING_VALUE.addr)) {
            if ((CHANGING_VALUE.current === undefined)
                || (CHANGING_VALUE.current < CHANGING_VALUE.min)
                || (CHANGING_VALUE.current > CHANGING_VALUE.max)) {
                CHANGING_VALUE.current = CHANGING_VALUE.min;
            } else {
                CHANGING_VALUE.current += 1;
            }
            v = CHANGING_VALUE.current;
        }
        res.push(v);
    }
    return res;
}

const writeValues = function (type, address, count, values) {
    if(data[type] === undefined)
        data[type] = [];

    const buf = data[type];
    for (let i = 0; i < count; i++) {
        buf[address + i] = values[i];
    }
}

const doRequest = function (action, type, address, count, values) {
    let response;
    try {
        if(adminAddr !== undefined) {
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
            console.log(`  <-> Sync with admin for ${response}`);
            response = JSON.parse(response);
        } else {
            switch (action) {
                case "read": {
                    console.log(`aaa ${type} ${address} ${count}`)
			response = readValues(type, address, count);
                    break;
                }
                case "write": {
                    writeValues(type, address, count, values);
                    break;
                }
            }
        }
    } catch (error) {
	console.log(error)
    }
    return response;
}

const getBuffer = function(type){
    switch(type){
        case "coil": return server.coils;
        case "discrete": return server.discrete;
        case "holding": return server.holding;
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

    let data = doRequest(action, type, address, count, values);
    if (Array.isArray(data) && count === data.length) {
        let buffer = getBuffer(type);
        for (let index = 0; index < count; index++) {
            buffer.writeUInt16BE(data[index], (address + index) * 2);
        }
    } else {
       console.log(`count=${data?.length}`)
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
    console.log(new Date().toISOString() + ' Connection begin: ' + client.socket.remoteAddress)
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


// -------------------------------------------- admin server
const getReqInfo = function(req){
    return {
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        mbAddress: parseInt(req.query.address),
        mbCount: parseInt(req.query.count)
    }
}

const logRequest = function(action, type, address, count, values){
    if(data.log === undefined){
        data.log = [];
    }

    data.log.push(`[${new Date().toISOString()}] action:${action} type:${type} addr:${address} count:${count} v:${values.toString()}`);
    if (data.log.length > 10000) {
        data.log.shift();
    }
}

const readData = function(req, type) {
    const address = reqInfo.mbAddress;
    const count = reqInfo.mbCount;

    logRequest("read", type, address, count, res);
    return readValues(type, address, count);
}

const writeData = function(req, type, values){
    const address = reqInfo.mbAddress;
    const count = reqInfo.mbCount;
    
    writeValues(type, address, count, values);

    logRequest("write", type, address, count, values);
}

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

/**
 * Modbus read
 */
app.get('/coil', (req, res) => {
    const resBuf = readData(req, "coil");
    res.setHeader('Content-Type', 'application/json');
    res.send(resBuf);
})

app.get('/discrete', (req, res) => {
    const resBuf = readData(req, "discrete");
    res.setHeader('Content-Type', 'application/json');
    res.send(resBuf);
})

app.get('/input', (req, res) => {
    const resBuf = readData(req, "input");
    res.setHeader('Content-Type', 'application/json');
    res.send(resBuf);
})

app.get('/holding', (req, res) => {
    const resBuf = readData(req, "holding");
    res.setHeader('Content-Type', 'application/json');
    res.send(resBuf);
})

/**
 * Modbus write
 */
app.post('/coil', (req, res) => {
    writeData(req, "coil", req.body);
    res.send("ok");
})

app.post('/holding', (req, res) => {
    writeData(req, "coil", req.body);
    res.send('ok')
})

app.get('/test', (req, res) => {
    const reqInfo = getReqInfo(req);
    res.send(`Request received from IP ${reqInfo.ip}`)
})

/**
 * Logging
 */
app.get('/log/clean', (req, res) => {
    data.log = [];
    res.status(200).send("Log history cleanup done!");  
})

app.get('/log', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(data.log));
})

/**
 * Control
 */
app.put('/set', (req, res) => {
    const reqInfo = getReqInfo(req);
    const address = reqInfo.mbAddress;
    const count = reqInfo.mbCount;
    const type = req.query.type;
    const values = req.body;

    res.setHeader('Content-Type', 'application/json');

    writeValues(type, address, count, values);

    logRequest("set", type, address, count, values);
    res.send(JSON.stringify(values));
})

/**
 * Server start
 */
app.listen(port, () => {
    console.log(`Admin server listening on port ${port}`)
})
