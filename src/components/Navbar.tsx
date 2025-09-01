"use client";

import Link from "next/link";
import { Plane } from "lucide-react";

export function Navbar() {
  return (
    <nav className="border-b bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Plane className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">LandSafe</span>
          </Link>
          
          <div className="flex items-center space-x-6">
            <Link 
              href="/board" 
              className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              Flight Board
            </Link>
            <Link 
              href="/upload" 
              className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              Add Flights
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
