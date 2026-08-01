const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/razorpay/order',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': 'csrf_token=dummytoken',
    'X-CSRF-Token': 'dummytoken'
  },
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(JSON.stringify({ orderId: 'FS-2026-00102' }));
req.end();
