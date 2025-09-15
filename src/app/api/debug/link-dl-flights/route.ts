import { NextRequest, NextResponse } from "next/server";
import { linkDL1240AndDL275 } from "@/lib/manualConnections";

export async function POST(request: NextRequest) {
  try {
    const result = await linkDL1240AndDL275();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'DL1240 and DL275 have been linked successfully',
        flights: result.flights
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }
  } catch (error) {
    console.error('API error linking flights:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
