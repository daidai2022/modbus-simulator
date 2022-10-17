
const express = require('express')
const bodyParser = require("body-parser");
const { exit } = require('process');

const app = express()
const port = 8000

var data = {};

/**
 * Init server
 */

const IP_PREFIX = "::ffff:";
{
    try {
        const fs = require('fs');
        const path = './config.json';
        if(!fs.existsSync(path)){
            const config = {
                client:[]
            }
            fs.writeFileSync(path, JSON.stringify(config, null, 2));
        }
        let config = JSON.parse(fs.readFileSync(path));

        config.client.forEach(ip => {
            data[`${IP_PREFIX}${ip}`] = {
                coil: [],
                discrete: [],
                holding: [],
                input: [],
                log: []
            }
        });
    } catch (error) {
        console.log(error);
        exit();
    }
}


const getReqInfo = function(req){
    return {
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        mbAddress: req.query.address,
        mbCount: req.query.count
    }
}

const logAction = function(ip, action, type, address, count, values){
    let obj = data[ip];
    if (obj !== undefined) {
        obj.log.push({
            timestamp: new Date(),
            action: action,
            type: type,
            address: address,
            count: count,
            values: values
        });
        if (obj.log.length > 10000) {
            obj.log.shift();
        }
    }
}

const readData = function(req, type) {
    const reqInfo = getReqInfo(req);
    const address = reqInfo.mbAddress;
    const count = reqInfo.mbCount;

    let res = [];
    const obj = data[reqInfo.ip];
    if (obj !== undefined) {
        const buf = obj[type];
        for (let i = 0; i < count; i++) {
            res.push(buf[address + i] !== undefined ? buf[address + i] : 0);
        }
        logAction(reqInfo.ip, "read", address, count, res);
    } else {
        console.log("Unregistered IP: " + reqInfo.ip);
    }
    
    return res;
}

const writeData = function(req, type, values){
    const reqInfo = getReqInfo(req);
    const address = reqInfo.mbAddress;
    const count = reqInfo.mbCount;
    
    const obj = data[reqInfo.ip];
    if (obj !== undefined) {
        const buf = obj[type];
        for (let i = 0; i < count; i++) {
            buf[address + i] = values[i];
        }
        logAction(reqInfo.ip, "write", address, count, values);
    } else {
        console.log("Unregistered IP: " + reqInfo.ip);
    }
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
    const ip = `${IP_PREFIX}${req.query.address}`;
    if (data[ip] !== undefined) {
        data[ip].log = [];
        res.status(200).send("Log history cleanup done!");
    } else {
        res.status(404).send("IP address not registered!"); 
    }
})

app.get('/log', (req, res) => {
    const ip = `${IP_PREFIX}${req.query.address}`;
    res.setHeader('Content-Type', 'application/json');
    if (data[ip] !== undefined) {
        res.send(JSON.stringify(data[ip]?.log));
    } else {
        res.send(JSON.stringify({error: "IP address not registered!"}));
    }
})

app.get('/list', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(Object.keys(data)));
})

/**
 * Control
 */
app.put('/set', (req, res) => {
    const reqInfo = getReqInfo(req);
    const address = reqInfo.mbAddress;
    const count = reqInfo.mbCount;
    const type = req.query.type
    const values = req.body;

    const targetIP = `${IP_PREFIX}${req.query.target}`;

    const obj = data[targetIP];
    res.setHeader('Content-Type', 'application/json');
    if (obj !== undefined) {
        const buf = obj[type];
        for (let i = 0; i < count; i++) {
            buf[address + i] = values[i];
        }
        logAction(reqInfo.ip, "set", address, count, values);
        res.send(JSON.stringify(values));
    } else {
        res.send(JSON.stringify({error: "IP " + reqInfo.ip + " address not registered!"}));
    }
})

/**
 * Server start
 */
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})