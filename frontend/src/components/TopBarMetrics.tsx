"use client";
import React, { useEffect, useState } from 'react';
import { getJSON } from '../lib/api';

interface DexSummary {
  occupancyRate?: number;
  totalLocations?: number;
  occupied?: number;
  empty?: number;
  lastScanAt?: string;
}

export default function TopBarMetrics() {
  const [summary, setSummary] = useState<DexSummary | null>(null);
  const [ts, setTs] = useState<number>(Date.now());

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await getJSON<DexSummary>('/v1/dexatronix/summary');
        if (mounted) setSummary(data);
      } catch {}
    };
    load();
    const iv = setInterval(() => { setTs(Date.now()); load(); }, 30000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-4 px-4 md:px-6 py-3 border-b border-dex-border bg-dex-surface/80 backdrop-blur sticky top-0 z-40">
      <div className="font-semibold tracking-wide text-slate-200">Clarity Console</div>
      <Metric label="Occupancy" value={summary ? `${(summary.occupancyRate! * 100).toFixed(1)}%` : '–'} accent />
      <Metric label="Locations" value={summary?.totalLocations ?? '–'} />
      <Metric label="Occupied" value={summary?.occupied ?? '–'} />
      <Metric label="Empty" value={summary?.empty ?? '–'} />
      <Metric label="Last Scan" value={summary?.lastScanAt ? timeAgo(summary.lastScanAt) : '–'} />
      <div className="ml-auto text-xs text-slate-500">Updated {new Date(ts).toLocaleTimeString()}</div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <div className={`flex flex-col min-w-[70px] ${accent ? 'text-dex-accent' : 'text-slate-300'}`}> 
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
