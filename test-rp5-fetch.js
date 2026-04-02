// Test script to trigger RP5 fetch
const http = require('http');

console.log('Requesting archive page...');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/archive?id=524901&period=1', // Moscow
  method: 'GET',
  timeout: 60000
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`Response length: ${data.length} bytes`);
    console.log('Check server logs for RP5 parsing details');
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.on('timeout', () => {
  console.error('Request timed out');
  req.destroy();
});

req.end();
