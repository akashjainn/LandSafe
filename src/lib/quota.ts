// Monthly API quota management to prevent exceeding free tier limits
import fs from 'fs';
import path from 'path';

interface QuotaData {
  month: string; // YYYY-MM format
  callsUsed: number;
  lastReset: string;
}

const QUOTA_FILE = path.join(process.cwd(), 'api-quota.json');
const MAX_CALLS_PER_MONTH = 600;

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function loadQuotaData(): QuotaData {
  try {
    if (!fs.existsSync(QUOTA_FILE)) {
      const initialData: QuotaData = {
        month: getCurrentMonth(),
        callsUsed: 0,
        lastReset: new Date().toISOString()
      };
      fs.writeFileSync(QUOTA_FILE, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    
    const data = JSON.parse(fs.readFileSync(QUOTA_FILE, 'utf-8')) as QuotaData;
    
    // Reset if new month
    const currentMonth = getCurrentMonth();
    if (data.month !== currentMonth) {
      const resetData: QuotaData = {
        month: currentMonth,
        callsUsed: 0,
        lastReset: new Date().toISOString()
      };
      fs.writeFileSync(QUOTA_FILE, JSON.stringify(resetData, null, 2));
      return resetData;
    }
    
    return data;
  } catch (error) {
    console.error('Error loading quota data:', error);
    return {
      month: getCurrentMonth(),
      callsUsed: 0,
      lastReset: new Date().toISOString()
    };
  }
}

function saveQuotaData(data: QuotaData): void {
  try {
    fs.writeFileSync(QUOTA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving quota data:', error);
  }
}

export function canMakeApiCall(): boolean {
  const quota = loadQuotaData();
  return quota.callsUsed < MAX_CALLS_PER_MONTH;
}

export function incrementApiCall(): void {
  const quota = loadQuotaData();
  quota.callsUsed += 1;
  saveQuotaData(quota);
}

export function getQuotaStatus(): { used: number; limit: number; remaining: number; month: string } {
  const quota = loadQuotaData();
  return {
    used: quota.callsUsed,
    limit: MAX_CALLS_PER_MONTH,
    remaining: MAX_CALLS_PER_MONTH - quota.callsUsed,
    month: quota.month
  };
}

export function resetQuota(): void {
  const resetData: QuotaData = {
    month: getCurrentMonth(),
    callsUsed: 0,
    lastReset: new Date().toISOString()
  };
  saveQuotaData(resetData);
}
