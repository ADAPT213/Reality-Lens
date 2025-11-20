"use client";
import React, { useEffect, useState } from 'react';
import { getJSON } from '../../lib/api';
import CameraCapture from '../../components/CameraCapture';
import { PageSkeleton } from '../../components/Skeletons';

interface DexSummary {
  totalLocations?: number; occupied?: number; empty?: number; occupancyRate?: number; aisles?: Array<{name:string;occupied:number;total:number}>; statusBreakdown?: Record<string, number>; lastScanAt?: string;
}
interface HeatTile { label: string; reachBand?: string; travelCost?: number; congestion?: number; }

export default function ClarityPage() {
  const [summary, setSummary] = useState<DexSummary | null>(null);
  const [heatmap, setHeatmap] = useState<HeatTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const s = await getJSON<DexSummary>('/v1/dexatronix/summary');
        const h = await getJSON<{tiles: HeatTile[]}>('/slotting/heatmap?warehouseId=demo');
        if (mounted) { setSummary(s); setHeatmap(h.tiles || []); }
      } catch (e: any) {
        if (mounted) setError(e.message || 'Failed loading clarity data');
      } finally { if (mounted) setLoading(false); }
    };
    load();
    const iv = setInterval(load, 45000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-100">Clarity Intelligence</h1>
        <p className="text-sm text-slate-400 max-w-xl">Unified human–machine operational insight: fusing Dex scan truth, slotting efficiency and visual observations into one adaptive loop.</p>
      </header>
      {error && (
        <div className="bg-dex-danger/10 border border-dex-danger/30 rounded p-4 text-sm text-dex-danger">
          <strong>Error:</strong> {error}
        </div>
      )}
      <section className="grid md:grid-cols-4 gap-4">
        <Metric label="Occupancy" value={summary ? `${(summary.occupancyRate! * 100).toFixed(1)}%` : '–'} />
        <Metric label="Locations" value={summary?.totalLocations ?? '–'} />
        <Metric label="Aisles" value={summary?.aisles?.length ?? '–'} />
        <Metric label="Hot Congestion" value={hotCongestion(heatmap)} />
      </section>
      <section className="grid md:grid-cols-3 gap-6">
        <div className="bg-dex-surfaceAlt rounded border border-dex-border p-4 flex flex-col">
          <h2 className="font-semibold mb-3">Aisle Snapshot</h2>
          <div className="space-y-2 overflow-y-auto max-h-72 pr-1">
            {summary?.aisles?.map(a => (
              <div key={a.name} className="flex items-center justify-between text-sm bg-dex-surface px-3 py-2 rounded border border-dex-border">
                <span className="font-medium">{a.name}</span>
                <span className="text-slate-400">{a.occupied}/{a.total}</span>
                <span className="text-xs text-dex-accent">{((a.occupied/a.total)*100).toFixed(0)}%</span>
              </div>
            )) || <div className="text-xs text-slate-500">No aisle data</div>}
          </div>
        </div>
        <div className="bg-dex-surfaceAlt rounded border border-dex-border p-4 flex flex-col">
          <h2 className="font-semibold mb-3">Slotting Heatmap (Sample)</h2>
          <div className="overflow-y-auto max-h-72">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400">
                  <th className="text-left font-medium p-2">Loc</th>
                  <th className="text-left font-medium p-2">Reach</th>
                  <th className="text-left font-medium p-2">Travel</th>
                  <th className="text-left font-medium p-2">Cong.</th>
                </tr>
              </thead>
              <tbody>
                {heatmap.slice(0,60).map(t => (
                  <tr key={t.label} className="border-t border-dex-border">
                    <td className="p-2">{t.label}</td>
                    <td className="p-2 text-slate-400">{t.reachBand||'–'}</td>
                    <td className="p-2 text-slate-400">{t.travelCost}</td>
                    <td className="p-2 text-slate-400">{t.congestion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-dex-surfaceAlt rounded border border-dex-border p-4 flex flex-col">
          <h2 className="font-semibold mb-3">Photo Capture & Annotation</h2>
          <p className="text-xs text-slate-400 mb-2">Capture rack/product anomalies and send to Vision for contextual labeling and slotting impact analysis.</p>
          <CameraCapture label="Capture Rack Photo" />
        </div>
      </section>
      <section className="bg-dex-surfaceAlt rounded border border-dex-border p-4">
        <h2 className="font-semibold mb-3">Status Breakdown</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          {summary?.statusBreakdown ? Object.entries(summary.statusBreakdown).map(([k,v]) => (
            <div key={k} className="bg-dex-surface rounded border border-dex-border p-3 flex flex-col">
              <span className="text-xs uppercase tracking-wide text-slate-500">{k}</span>
              <span className="text-sm font-semibold text-slate-200">{v}</span>
            </div>
          )) : <div className="text-xs text-slate-500">No status data.</div>}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-dex-surfaceAlt rounded border border-dex-border p-4 flex flex-col">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-lg font-semibold text-slate-200">{value}</span>
    </div>
  );
}

function hotCongestion(tiles: HeatTile[]) {
  if (!tiles.length) return '–';
  return tiles.slice().sort((a,b)=> (b.congestion||0)-(a.congestion||0))[0].label;
}
