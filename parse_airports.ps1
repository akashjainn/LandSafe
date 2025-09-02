# Parse airport-codes.csv and generate IATA mappings
$csvPath = "c:\Users\akash\Downloads\airport-codes.csv"
$outputPath = "c:\Users\akash\Documents\LandSafe\airport_mappings.ts"

Write-Host "Parsing airport data..."

# Read and parse CSV
$airports = @{}
$lineCount = 0

Get-Content $csvPath | ForEach-Object {
    $lineCount++
    if ($lineCount -eq 1) { return } # Skip header
    
    $fields = $_ -split ','
    if ($fields.Count -ge 12) {
        $iataCode = $fields[9].Trim()
        $municipality = $fields[7].Trim()
        $region = $fields[6].Trim()
        $country = $fields[5].Trim()
        
        # Only process entries with valid 3-letter IATA codes
        if ($iataCode -match '^[A-Z]{3}$') {
            # Format location based on country
            $location = ""
            if ($country -eq "US") {
                # Extract state abbreviation from region (US-TX -> TX)
                if ($region -match '^US-([A-Z]{2})$') {
                    $state = $matches[1]
                    $location = "$municipality, $state"
                } else {
                    $location = $municipality
                }
            } else {
                # For international airports, use country
                $location = "$municipality, $country"
            }
            
            $airports[$iataCode] = $location
        }
    }
}

Write-Host "Found $($airports.Count) airports with valid IATA codes"

# Generate TypeScript mapping
$tsContent = @"
// Auto-generated airport mappings from airport-codes.csv
// Generated on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

export const IATA_CITY_COUNTRY_EXPANDED: Record<string, string> = {
"@

# Sort by IATA code for better organization
$sortedAirports = $airports.GetEnumerator() | Sort-Object Name

foreach ($airport in $sortedAirports) {
    $code = $airport.Name
    $location = $airport.Value.Replace("'", "\u0027").Replace('"', '\"')
    $tsContent += "`n  '$code': '$location',"
}

$tsContent = $tsContent.TrimEnd(',')
$tsContent += @"

};

// Total airports: $($airports.Count)
"@

# Write to file
$tsContent | Out-File -FilePath $outputPath -Encoding utf8

Write-Host "Generated TypeScript mappings in $outputPath"
Write-Host "Sample entries:"
$sortedAirports | Select-Object -First 10 | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Value)"
}
