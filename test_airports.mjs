// Test script to verify comprehensive airport database
import { IATA_CITY_COUNTRY_EXPANDED } from './airport_mappings';
import { iataToCity, formatAirportWithCity } from './src/lib/airports';

// Test common US airports
const testAirports = ['ATL', 'DFW', 'LAX', 'JFK', 'ORD', 'DEN', 'LAS', 'PHX', 'MCO', 'CLT', 'MIA', 'SEA', 'IAH', 'BOS', 'SFO', 'DTW', 'PHL', 'LGA', 'BWI', 'DCA', 'MSP', 'TPA'];

console.log('Testing Comprehensive Airport Database:');
console.log('=====================================');

for (const airport of testAirports) {
  const cityInfo = iataToCity(airport);
  const formatted = formatAirportWithCity(airport);
  console.log(`${airport}: ${cityInfo || 'NOT FOUND'} | Formatted: {code: "${formatted.code}", city: "${formatted.city || 'N/A'}"}`);
}

console.log('\nTotal airports in database:', Object.keys(IATA_CITY_COUNTRY_EXPANDED).length);

// Test a few random airports from the database
console.log('\nSample from comprehensive database:');
const allAirports = Object.keys(IATA_CITY_COUNTRY_EXPANDED);
for (let i = 0; i < 10; i++) {
  const randomAirport = allAirports[Math.floor(Math.random() * allAirports.length)];
  console.log(`${randomAirport}: ${IATA_CITY_COUNTRY_EXPANDED[randomAirport]}`);
}
