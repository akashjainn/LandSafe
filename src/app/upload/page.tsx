"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Upload, FileText, Plus, Trash2, Download } from "lucide-react";
import { useBatchCreateFlights } from "@/hooks/useFlights";
import { parseCarrierFlightNumber } from "@/lib/types";

// Updated FlightRow type to include all referenced properties
type FlightRow = {
  id: number;
  label?: string;
  carrier?: string;
  number?: string;
  date?: string;
  origin?: string;
  destination?: string;
  notes?: string;
  flight?: string;
  airline?: string;
  flight_number?: string;
  name?: string;
  friend?: string;
  from?: string;
  departure?: string;
  dest?: string;
  to?: string;
  arrival?: string;
  comment?: string;
};

export default function UploadPage() {
  const router = useRouter();
  const [flightRows, setFlightRows] = useState<FlightRow[]>([
    { id: 1, date: new Date().toISOString().split('T')[0] }
  ]);
  const [isDragOver, setIsDragOver] = useState(false);
  const batchCreateMutation = useBatchCreateFlights();

  const handleFileUpload = (file: File) => {
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const csvFlights = results.data as FlightRow[];
        const newRows: FlightRow[] = csvFlights
          .filter(row => row.carrier || row.number || row.flight)
          .map((row, index) => {
            // Handle different CSV formats
            let carrier = row.carrier || row.airline;
            let number = row.number || row.flight_number;
            
            // If flight is provided as one field (e.g., "DL123")
            if (row.flight && !carrier && !number) {
              const parsed = parseCarrierFlightNumber(row.flight);
              if (parsed) {
                carrier = parsed.carrierIata;
                number = parsed.flightNumber;
              }
            }

            return {
              id: Date.now() + index,
              label: row.label || row.name || row.friend,
              flight: row.flight,
              carrier,
              number,
              date: row.date || new Date().toISOString().split('T')[0],
              origin: row.origin || row.from || row.departure,
              destination: row.destination || row.dest || row.to || row.arrival,
              notes: row.notes || row.comment,
            };
          });
        
        setFlightRows(newRows);
      },
      error: (error) => {
        console.error("CSV parsing error:", error);
        alert("Error parsing CSV file. Please check the format.");
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === "text/csv") {
      handleFileUpload(file);
    } else {
      alert("Please upload a CSV file.");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const addRow = () => {
    setFlightRows([
      ...flightRows,
      { 
        id: Date.now(),
        date: new Date().toISOString().split('T')[0]
      }
    ]);
  };

  const removeRow = (id: number) => {
    setFlightRows(flightRows.filter(row => row.id !== id));
  };

  const updateRow = (id: number, field: keyof FlightRow, value: string) => {
    setFlightRows(flightRows.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  const handleSubmit = async () => {
    // Validate and prepare data
    const validFlights = flightRows
      .filter(row => (row.flight && row.date) || (row.carrier && row.number && row.date))
      .map(row => ({
        label: row.label,
        date: row.date,
        originIata: row.origin,
        destIata: row.destination,
        notes: row.notes || row.label,
        ...(row.flight
          ? { flight: row.flight }
          : { carrier: row.carrier, number: row.number }
        ),
      }));

    if (validFlights.length === 0) {
      alert("Please add at least one valid flight with Flight (e.g., DL295) and Date.");
      return;
    }

    try {
      await batchCreateMutation.mutateAsync(validFlights);
      alert(`Successfully added ${validFlights.length} flight(s)!`);
      router.push("/board");
    } catch (error) {
      console.error("Error creating flights:", error);
      alert("Error adding flights. Please try again.");
    }
  };

  const downloadTemplate = () => {
    const csvContent = "label,flight,date,notes\n" +
      "John's Flight,DL295,2025-09-15,Arriving from LA\n" +
      "Sarah's Flight,AA456,2025-09-15,Connecting from Chicago";
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'landsafe_template.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Add Flights</h1>
        <p className="text-gray-600 mt-1">Upload flight details for your reunion group</p>
      </div>

      {/* Upload Section */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* CSV Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload CSV File
            </CardTitle>
            <CardDescription>
              Bulk upload multiple flights at once
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
            >
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">
                Drag and drop your CSV file here, or
              </p>
              <label className="cursor-pointer">
                <span className="text-blue-600 hover:text-blue-700 font-medium">
                  browse to upload
                </span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>
            <Button variant="outline" onClick={downloadTemplate} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download CSV Template
            </Button>
          </CardContent>
        </Card>

        {/* Manual Entry */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Manual Entry
            </CardTitle>
            <CardDescription>
              Add flights one by one manually
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4 text-sm text-gray-600">
              <p>Preferred CSV format (airports auto-fill):</p>
              <div className="bg-gray-50 p-3 rounded font-mono text-xs">
                label,flight,date,notes<br/>
                John,DL295,2025-09-15,From LA
              </div>
              <p className="text-xs">Also supported: legacy columns carrier,number,origin,destination.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flight Data Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Flight Details</CardTitle>
            <Button onClick={addRow} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Row
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {flightRows.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No flights added yet. Upload a CSV or add manually.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Friend/Label</TableHead>
                    <TableHead>Flight</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Origin</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flightRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Input
                          value={row.label || ""}
                          onChange={(e) => updateRow(row.id, "label", e.target.value)}
                          placeholder="Friend's name"
                          className="min-w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.flight || (row.carrier && row.number ? `${row.carrier}${row.number}` : "")}
                          onChange={(e) => updateRow(row.id, "flight", e.target.value.toUpperCase())}
                          placeholder="DL295"
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={row.date || ""}
                          onChange={(e) => updateRow(row.id, "date", e.target.value)}
                          className="w-36"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.origin || ""}
                          onChange={(e) => updateRow(row.id, "origin", e.target.value.toUpperCase())}
                          placeholder="LAX"
                          maxLength={3}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.destination || ""}
                          onChange={(e) => updateRow(row.id, "destination", e.target.value.toUpperCase())}
                          placeholder="JFK"
                          maxLength={3}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.notes || ""}
                          onChange={(e) => updateRow(row.id, "notes", e.target.value)}
                          placeholder="Additional notes"
                          className="min-w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRow(row.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit Section */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => router.push("/board")}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={batchCreateMutation.isPending || flightRows.length === 0}
          size="lg"
        >
          {batchCreateMutation.isPending ? "Adding Flights..." : `Add ${flightRows.filter(r => (r.flight && r.date) || (r.carrier && r.number && r.date)).length} Flight(s)`}
        </Button>
      </div>
    </div>
  );
}
