const fs = require('fs');

// Haversine formula to calculate distance between two coordinates
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Parse NOAA ISD station history file
function parseISDStations(content) {
  const stations = [];
  const lines = content.split('\n');
  
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // ISD format (fixed width):
    // USAF (0-5), WBAN (7-11), STATION NAME (13-42), CTRY (43-44), ST (48-49), 
    // ICAO (51-54), LAT (57-64), LON (65-73), ELEV (74-81), BEGIN (82-89), END (91-98)
    
    const usaf = line.substring(0, 6).trim();
    const wban = line.substring(7, 12).trim();
    const name = line.substring(13, 43).trim();
    const country = line.substring(43, 45).trim();
    const lat = parseFloat(line.substring(57, 65).trim());
    const lon = parseFloat(line.substring(65, 74).trim());
    const elev = line.substring(74, 82).trim();
    const begin = line.substring(82, 91).trim();
    const end = line.substring(91, 99).trim();
    
    // Skip invalid coordinates
    if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    
    // Skip stations with no recent data (ended before 2020)
    if (end && end < '20200101') continue;
    
    // Create WMO-like ID from USAF number (first 5 digits)
    const wmoId = usaf.substring(0, 5);
    if (wmoId === '99999' || wmoId === '00000') continue;
    
    stations.push({
      wmoId: wmoId,
      usaf: usaf,
      wban: wban,
      name: name,
      country: country,
      lat: lat,
      lon: lon,
      elev: elev,
      begin: begin,
      end: end
    });
  }
  
  return stations;
}

// Find nearest station for a city
function findNearestStation(city, stations) {
  let nearest = null;
  let minDistance = Infinity;
  
  for (const station of stations) {
    const distance = haversineDistance(
      city.lat, city.lon,
      station.lat, station.lon
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearest = { ...station, distance };
    }
  }
  
  return nearest;
}

// Main processing function
async function generateWMOMapping() {
  console.log('Loading ISD station history...');
  const isdContent = fs.readFileSync('isd-history.txt', 'utf8');
  
  console.log('Parsing ISD stations...');
  const stations = parseISDStations(isdContent);
  console.log(`Found ${stations.length} active stations with valid coordinates`);
  
  // Load cities
  console.log('Loading cities database...');
  const cities = JSON.parse(fs.readFileSync('data/cities.json', 'utf8'));
  console.log(`Found ${cities.length} cities`);
  
  // Generate mapping
  console.log('Generating WMO mappings...');
  const mapping = {};
  const detailedMapping = {};
  const stats = {
    total: cities.length,
    mapped: 0,
    excellent: 0, // < 10km
    good: 0,      // 10-50km
    fair: 0,      // 50-100km
    poor: 0,      // > 100km
    byCountry: {}
  };
  
  for (const city of cities) {
    const nearest = findNearestStation(city, stations);
    
    if (nearest) {
      mapping[city.id] = nearest.wmoId;
      detailedMapping[city.id] = {
        wmoId: nearest.wmoId,
        usaf: nearest.usaf,
        wban: nearest.wban,
        stationName: nearest.name,
        distance: Math.round(nearest.distance * 10) / 10,
        lat: nearest.lat,
        lon: nearest.lon
      };
      stats.mapped++;
      
      // Track distance quality
      if (nearest.distance < 10) stats.excellent++;
      else if (nearest.distance < 50) stats.good++;
      else if (nearest.distance < 100) stats.fair++;
      else stats.poor++;
      
      // Track by country
      if (!stats.byCountry[city.cc]) {
        stats.byCountry[city.cc] = { total: 0, mapped: 0, avgDistance: 0, distances: [] };
      }
      stats.byCountry[city.cc].total++;
      stats.byCountry[city.cc].mapped++;
      stats.byCountry[city.cc].distances.push(nearest.distance);
      
      // Log progress every 100 cities
      if (stats.mapped % 100 === 0) {
        console.log(`Processed ${stats.mapped}/${cities.length} cities...`);
      }
    }
  }
  
  // Calculate average distances by country
  for (const country in stats.byCountry) {
    const distances = stats.byCountry[country].distances;
    const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
    stats.byCountry[country].avgDistance = Math.round(avg * 10) / 10;
    delete stats.byCountry[country].distances;
  }
  
  // Generate simple mapping file
  console.log('\nGenerating wmo-mapping.js...');
  let output = `// WMO Station ID mapping for cities\n`;
  output += `// Auto-generated from NOAA ISD station history\n`;
  output += `// Total cities: ${stats.total}, Mapped: ${stats.mapped}\n`;
  output += `// Quality: Excellent (<10km): ${stats.excellent}, Good (10-50km): ${stats.good}, Fair (50-100km): ${stats.fair}, Poor (>100km): ${stats.poor}\n\n`;
  output += `const wmoMapping = {\n`;
  
  const sortedKeys = Object.keys(mapping).sort((a, b) => parseInt(a) - parseInt(b));
  for (const id of sortedKeys) {
    output += `  ${id}: '${mapping[id]}',\n`;
  }
  
  output += `};\n\n`;
  output += `module.exports = wmoMapping;\n`;
  
  fs.writeFileSync('data/wmo-mapping.js', output);
  
  // Generate detailed mapping file
  console.log('Generating wmo-mapping-detailed.json...');
  fs.writeFileSync('data/wmo-mapping-detailed.json', JSON.stringify(detailedMapping, null, 2));
  
  // Print statistics
  console.log('\n=== MAPPING STATISTICS ===');
  console.log(`Total cities: ${stats.total}`);
  console.log(`Successfully mapped: ${stats.mapped} (${(stats.mapped/stats.total*100).toFixed(1)}%)`);
  console.log(`\nDistance Quality:`);
  console.log(`  Excellent (<10km):  ${stats.excellent} (${(stats.excellent/stats.mapped*100).toFixed(1)}%)`);
  console.log(`  Good (10-50km):     ${stats.good} (${(stats.good/stats.mapped*100).toFixed(1)}%)`);
  console.log(`  Fair (50-100km):    ${stats.fair} (${(stats.fair/stats.mapped*100).toFixed(1)}%)`);
  console.log(`  Poor (>100km):      ${stats.poor} (${(stats.poor/stats.mapped*100).toFixed(1)}%)`);
  
  console.log(`\nTop 20 countries by city count:`);
  const sortedCountries = Object.entries(stats.byCountry)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20);
  
  for (const [code, data] of sortedCountries) {
    console.log(`  ${code}: ${data.mapped}/${data.total} cities (avg distance: ${data.avgDistance}km)`);
  }
  
  console.log('\nDone!');
  console.log('Files saved:');
  console.log('  - data/wmo-mapping.js (simple mapping)');
  console.log('  - data/wmo-mapping-detailed.json (with station details)');
}

// Run the script
generateWMOMapping().catch(console.error);
