// Test Aviation Weather API for METAR data
const https = require('https');

// Test with Moscow Sheremetyevo (UUEE)
const url = 'https://aviationweather.gov/api/data/metar?ids=UUEE&format=json&hours=48';

console.log('Fetching METAR data from:', url);

https.get(url, {
  headers: {
    'User-Agent': 'WeatherWebsite/1.0 (test script)'
  }
}, (res) => {
  console.log('Status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('\nReceived', json.length, 'METAR reports');
      
      if (json.length > 0) {
        console.log('\nFirst report:');
        console.log(JSON.stringify(json[0], null, 2));
        
        console.log('\nLast report:');
        console.log(JSON.stringify(json[json.length - 1], null, 2));
      }
    } catch (e) {
      console.error('Parse error:', e.message);
      console.log('Raw data:', data.substring(0, 500));
    }
  });
}).on('error', (e) => {
  console.error('Request error:', e.message);
});
