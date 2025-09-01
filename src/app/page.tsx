"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plane, Users, Clock, Shield } from "lucide-react";

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-6 py-12">
        <div className="flex justify-center">
          <Plane className="h-16 w-16 text-blue-600" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
          Welcome to LandSafe
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Track all your friends&apos; flights in one place for your reunion. Never miss an arrival again.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/board">View Flight Board</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/upload">Add Flights</Link>
          </Button>
        </div>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="text-center">
            <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <CardTitle className="text-lg">Group Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Add multiple flights and track all your friends&apos; arrivals in one dashboard.
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <Clock className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <CardTitle className="text-lg">Real-time Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Get live flight status updates including delays, gate changes, and arrival times.
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <Shield className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <CardTitle className="text-lg">Reliable Data</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Powered by aviation APIs for accurate and up-to-date flight information.
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <Plane className="h-8 w-8 text-orange-600 mx-auto mb-2" />
            <CardTitle className="text-lg">Easy Setup</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Simply upload a CSV file or manually add flights to get started immediately.
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Quick Start */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-center text-blue-900">Quick Start</CardTitle>
          <CardDescription className="text-center text-blue-700">
            Get started with LandSafe in just a few steps
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto mb-2 text-sm font-semibold">
                1
              </div>
              <h3 className="font-semibold text-blue-900">Add Flights</h3>
              <p className="text-sm text-blue-700">Upload a CSV or manually add your friends&apos; flight details</p>
            </div>
            <div>
              <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto mb-2 text-sm font-semibold">
                2
              </div>
              <h3 className="font-semibold text-blue-900">Monitor Status</h3>
              <p className="text-sm text-blue-700">Watch real-time updates on the flight board</p>
            </div>
            <div>
              <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto mb-2 text-sm font-semibold">
                3
              </div>
              <h3 className="font-semibold text-blue-900">Stay Informed</h3>
              <p className="text-sm text-blue-700">Get notified of delays and coordinate meetups</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
