
const express = require('express')
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
const inputData = {
    "::ffff:192.168.1.42": [],
    "::ffff:192.168.1.43": [],
    "::ffff:192.168.1.44": []
};
let logData = {
    "::ffff:192.168.1.42": [],
    "::ffff:192.168.1.43": [],
    "::ffff:192.168.1.44": []
};;

const getIP = function(req){
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
}

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

app.put('/coil', (req, res) => {
    res.send('Hello World!')
})

app.get('/discrete', (req, res) => {
    res.send('Hello World!')
})

app.put('/discrete', (req, res) => {
    res.send('Hello World!')
})

app.get('/input', (req, res) => {
    res.send('Hello World!')
})

app.put('/input', (req, res) => {
    res.send('Hello World!')
})

app.get('/holding', (req, res) => {
    res.send('Hello World!')
})

app.put('/holding', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})