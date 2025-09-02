// Simple test to verify comprehensive airport database
const fs = require('fs');

// Read the generated file
const content = fs.readFileSync('./airport_mappings.ts', 'utf8');

// Extract airport count
const matches = content.match(/Total airports: (\d+)/);
const airportCount = matches ? matches[1] : 'unknown';

console.log('Comprehensive Airport Database Test');
console.log('==================================');
console.log(`Total airports in database: ${airportCount}`);

// Test some specific airports by searching in the file
const testAirports = ['ATL', 'DFW', 'LAX', 'JFK', 'ORD', 'TPA', 'BWI', 'MIA', 'CLT', 'PHL'];

console.log('\nTesting specific airport mappings:');
for (const airport of testAirports) {
  const regex = new RegExp(`'${airport}': '([^']+)'`);
  const match = content.match(regex);
  if (match) {
    console.log(`✓ ${airport}: ${match[1]}`);
  } else {
    console.log(`✗ ${airport}: NOT FOUND`);
  }
}

// Show some random examples
console.log('\nSample airport mappings:');
const lines = content.split('\n').filter(line => line.match(/'\w{3}': '/));
for (let i = 0; i < 10; i++) {
  const randomLine = lines[Math.floor(Math.random() * lines.length)];
  if (randomLine) {
    const match = randomLine.match(/'(\w{3})': '([^']+)'/);
    if (match) {
      console.log(`${match[1]}: ${match[2]}`);
    }
  }
}
