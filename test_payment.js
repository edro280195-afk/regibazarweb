const https = require('https');

const data = JSON.stringify({
    amount: 100,
    method: 'Efectivo',
    registeredBy: 'Admin',
    notes: 'Test'
});

const options = {
    hostname: 'regibazarapi.onrender.com',
    port: 443,
    path: '/api/orders/53/payments',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`);
    let responseData = '';
    res.on('data', d => {
        responseData += d;
    });
    res.on('end', () => {
        console.log('Response:', responseData);
    });
});

req.on('error', error => {
    console.error(error);
});

req.write(data);
req.end();
