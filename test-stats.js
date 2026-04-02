// Test script to verify stats route
// Run: node test-stats.js
// Then open: http://localhost:3000/stats?id=524901 (Moscow)

const fetch = require('node-fetch');

async function testStats() {
  const testCases = [
    { id: 524901, name: 'Moscow', years: 1 },
    { id: 524901, name: 'Moscow', years: 3 },
    { id: 1508291, name: 'Tyumen', years: 1 },
  ];
  
  console.log('Testing /stats route...\n');
  
  for (const test of testCases) {
    const url = `http://localhost:3000/stats?id=${test.id}&years=${test.years}`;
    console.log(`Testing: ${test.name} (${test.years} year${test.years > 1 ? 's' : ''})`);
    console.log(`URL: ${url}`);
    
    try {
      const response = await fetch(url);
      const status = response.status;
      const contentType = response.headers.get('content-type');
      
      console.log(`Status: ${status}`);
      console.log(`Content-Type: ${contentType}`);
      
      if (status === 200) {
        const text = await response.text();
        const hasTable = text.includes('archiveTable');
        const hasTabs = text.includes('period-tabs');
        const hasData = text.includes('monthLabel');
        
        console.log(`✓ Has table: ${hasTable}`);
        console.log(`✓ Has tabs: ${hasTabs}`);
        console.log(`✓ Has data: ${hasData}`);
      } else {
        console.log(`✗ Failed with status ${status}`);
      }
    } catch (e) {
      console.log(`✗ Error: ${e.message}`);
    }
    
    console.log('');
  }
  
  console.log('Test complete!');
  console.log('Open http://localhost:3000/stats?id=524901 in your browser to see the stats page.');
}

testStats();
