import { NextResponse } from 'next/server';
import { getQuotaStatus, resetQuota } from '@/lib/quota';

export async function GET() {
  try {
    const status = getQuotaStatus();
    return NextResponse.json({ 
      success: true, 
      quota: status,
      warning: status.remaining < 50 ? 'Low API quota remaining' : null
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to get quota status' }, { status: 500 });
  }
}

export async function POST() {
  try {
    resetQuota();
    const status = getQuotaStatus();
    return NextResponse.json({ 
      success: true, 
      message: 'Quota reset successfully',
      quota: status 
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to reset quota' }, { status: 500 });
  }
}
