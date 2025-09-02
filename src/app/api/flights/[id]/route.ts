import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

const prisma = getPrisma();

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
  const uid = request.cookies.get("uid")?.value;
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Flight ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const owned = await prisma.flight.findFirst({ where: { id, ...(uid ? { createdBy: uid } : { createdBy: null }) } });
    if (!owned) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // First, delete all related flight status snapshots
    await prisma.flightStatusSnapshot.deleteMany({ where: { flightId: id } });

    // Then delete the flight
    const deletedFlight = await prisma.flight.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Flight deleted successfully",
      data: deletedFlight,
    });
  } catch (error) {
    console.error("Error deleting flight:", error);
    
    // Check if flight doesn't exist
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: "Flight not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
