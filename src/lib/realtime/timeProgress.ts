// timeProgress.ts - Derive time-based progress + departed/landed flags using schedule/estimate/actual times.
import { clamp } from './geo';

export interface TimeProgressInput {
  schedDep?: string | null; schedArr?: string | null;
  estDep?: string | null; estArr?: string | null;
  actDep?: string | null; actArr?: string | null;
}

export interface TimeProgressResult {
  percent: number; // 0-100
  basis: 'time';
  departed: boolean;
  landed: boolean;
  eta?: string; // chosen arrival reference
  etd?: string; // chosen departure reference
  ete_minutes?: number;
}

function pick(...vals: (string | undefined | null)[]): string | undefined {
  return vals.find(v => !!v) || undefined;
}

export function computeTimeProgress(inp: TimeProgressInput): TimeProgressResult {
  const depRef = pick(inp.actDep, inp.estDep, inp.schedDep);
  const arrRef = pick(inp.actArr, inp.estArr, inp.schedArr);
  const departed = !!inp.actDep;
  const landed = !!inp.actArr;
  if (!depRef || !arrRef) {
    return { percent: 0, basis: 'time', departed, landed };
  }
  const now = Date.now();
  const depMs = new Date(depRef).getTime();
  const arrMs = new Date(arrRef).getTime();
  if (isNaN(depMs) || isNaN(arrMs) || arrMs <= depMs) {
    return { percent: landed ? 100 : 0, basis: 'time', departed, landed, eta: arrRef, etd: depRef };
  }
  let percent: number;
  if (landed) percent = 100;
  else if (!departed && now < depMs) percent = 0;
  else percent = ((now - depMs) / (arrMs - depMs)) * 100;
  percent = clamp(percent, 0, 100);
  const eteMinutes = landed ? 0 : Math.max(0, (arrMs - now) / 60000);
  return { percent: Math.round(percent), basis: 'time', departed, landed, eta: arrRef, etd: depRef, ete_minutes: eteMinutes };
}
