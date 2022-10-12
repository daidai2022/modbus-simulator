
const express = require('express')
const bodyParser = require("body-parser");
const app = express()
const port = 8000

const coilsData = {
    "::ffff:192.168.1.42": [],
    "::ffff:192.168.1.43": [],
    "::ffff:192.168.1.44": []
};
const discreteData = {
    "::ffff:192.168.1.42": [],
    "::ffff:192.168.1.43": [],
    "::ffff:192.168.1.44": []
};
const holdingData = {
    "::ffff:192.168.1.42": [],
    "::ffff:192.168.1.43": [],
    "::ffff:192.168.1.44": []
};
const inpostData = {
    "::ffff:192.168.1.42": [],
    "::ffff:192.168.1.43": [],
    "::ffff:192.168.1.44": []
};
let logData = {
    "::ffff:192.168.1.42": [],
    "::ffff:192.168.1.43": [],
    "::ffff:192.168.1.44": []
};

const getIP = function(req){
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
}

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/coil', (req, res) => {
    let resBuf = [];

    const ip = getIP(req);
    if (coilData[ip] === undefined) {
        return res;
    }

    const address = req.query.address;
    const count = req.query.count;

    for (let index = 0; index < count; index++) {
        let value = coilData[ip][address + index];
        if (value === undefined) {
            value = 0;
        }
        resBuf.push(value);
    }

    res.send(resBuf);
})

app.post('/coil', (req, res) => {
    console.log(req.body)
    res.send("ok");
})

app.get('/discrete', (req, res) => {
    res.send('Hello World!')
})

app.get('/input', (req, res) => {
    let value = Math.floor(Math.random()*100);
    console.log(value);
    res.send([4,10,20,30,0,0,0,0,0,value])
})

app.get('/holding', (req, res) => {
    res.send('Hello World!')
})

app.post('/holding', (req, res) => {
    console.log(req.body)
    res.send('Hello!')
})

app.post('/log', (req, res) => {
    console.log(req.body)
    res.send('Logged')
})

app.get('/test', (req, res) => {
    console.log("aa");
    res.send(`Request received from IP ${getIP(req)}`)
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})