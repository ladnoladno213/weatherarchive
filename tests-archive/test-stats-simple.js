// Простой тест для проверки /stats
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/stats?id=524901&years=1',
  method: 'GET'
};

console.log('Testing: http://localhost:3000/stats?id=524901&years=1');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✓ Success!');
      console.log('Response length:', data.length);
      if (data.includes('Статистика погоды')) {
        console.log('✓ Page title found');
      }
      if (data.includes('archiveTable')) {
        console.log('✓ Table found');
      }
    } else {
      console.log('✗ Error response:');
      console.log(data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error(`✗ Request failed: ${e.message}`);
  console.log('Make sure the server is running: node server.js');
});

req.end();
