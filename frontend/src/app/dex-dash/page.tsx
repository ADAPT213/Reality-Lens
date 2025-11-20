"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getJSON, postJSON } from "../../lib/api";

type DexSummary = {
  totalLocations: number;
  occupied: number;
  empty: number;
  occupancyRate: number;
  statusBreakdown?: Record<string, number>;
  aisles?: Array<{ name: string; total: number; occupied: number }>;
  lastScanAt?: string | null;
};

type DexLocation = {
  id: string;
  aisle?: string;
  bay?: string;
  level?: string;
  status?: string;
  updatedAt?: string;
  inventory?: Array<any>;
};

export default function DexDashPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DexSummary | null>(null);
  const [locations, setLocations] = useState<DexLocation[]>([]);
  const [aisleFilter, setAisleFilter] = useState<string>("");
  const [upTo, setUpTo] = useState<string>("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setError(null);
    try {
      const data = await getJSON<DexSummary>(`/v1/dexatronix/summary`);
      setSummary(data);
    } catch (e: any) {
      setError(e.message || "Failed to load summary");
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (aisleFilter.trim()) params.set("aisles", aisleFilter.trim());
      if (upTo.trim()) params.set("upTo", upTo.trim());
      params.set("pageSize", "100");
      const data = await getJSON<{ items?: DexLocation[] }>(`/v1/dexatronix/locations?${params.toString()}`);
      setLocations(data.items || []);
    } catch (e: any) {
      setError(e.message || "Failed to load locations");
    } finally {
      setLoading(false);
    }
  }, [aisleFilter, upTo]);

  const doTestConnection = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await getJSON<any>(`/v1/dexatronix/test`);
      setTestResult(res?.ok ? "Dex connection OK" : JSON.stringify(res));
    } catch (e: any) {
      setTestResult(null);
      setError(e.message || "Dex connection failed");
    } finally {
      setTesting(false);
    }
  }, []);

  const doSync = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const res = await postJSON<any>(`/v1/dexatronix/sync`);
      setSyncResult(res?.status || "Sync requested");
      await fetchSummary();
      await fetchLocations();
    } catch (e: any) {
      setSyncResult(null);
      setError(e.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [fetchSummary, fetchLocations]);

  useEffect(() => {
    fetchSummary();
    fetchLocations();
  }, [fetchSummary, fetchLocations]);

  const timeline = useMemo(() => {
    return [...locations]
      .filter((l) => !!l.updatedAt)
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
      .slice(0, 50);
  }, [locations]);

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dex Dash</h1>
        <div className="flex gap-2">
          <button onClick={doTestConnection} disabled={testing} className="px-3 py-2 text-sm rounded bg-slate-800 text-white">
            {testing ? "Testing…" : "Test Connection"}
          </button>
          <button onClick={doSync} disabled={syncing} className="px-3 py-2 text-sm rounded bg-blue-600 text-white">
            {syncing ? "Syncing…" : "Sync Now"}
          </button>
        </div>
      </div>

      {(testResult || syncResult || error) && (
        <div className="space-y-2">
          {testResult && <div className="text-sm text-green-700">{testResult}</div>}
          {syncResult && <div className="text-sm text-blue-700">{syncResult}</div>}
          {error && <div className="text-sm text-red-700">{error}</div>}
        </div>
      )}

      <section className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded border bg-white">
          <div className="text-xs text-slate-500">Total Locations</div>
          <div className="text-2xl font-semibold">{summary?.totalLocations ?? '-'}</div>
        </div>
        <div className="p-4 rounded border bg-white">
          <div className="text-xs text-slate-500">Occupied</div>
          <div className="text-2xl font-semibold">{summary?.occupied ?? '-'}</div>
        </div>
        <div className="p-4 rounded border bg-white">
          <div className="text-xs text-slate-500">Empty</div>
          <div className="text-2xl font-semibold">{summary?.empty ?? '-'}</div>
        </div>
        <div className="p-4 rounded border bg-white">
          <div className="text-xs text-slate-500">Occupancy</div>
          <div className="text-2xl font-semibold">{summary ? `${(summary.occupancyRate * 100).toFixed(1)}%` : '-'}</div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Run Timeline</h2>
            <div className="flex gap-2">
              <input
                placeholder="Filter aisles e.g. A1,B2"
                className="text-sm border rounded px-2 py-1"
                value={aisleFilter}
                onChange={(e) => setAisleFilter(e.target.value)}
              />
              <input
                type="date"
                className="text-sm border rounded px-2 py-1"
                value={upTo}
                onChange={(e) => setUpTo(e.target.value)}
              />
              <button onClick={fetchLocations} className="text-sm px-3 py-1 rounded bg-slate-800 text-white">
                {loading ? "Loading…" : "Apply"}
              </button>
            </div>
          </div>
          <div className="border rounded bg-white h-96 overflow-y-auto">
            {timeline.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">No recent events.</div>
            ) : (
              <ul className="divide-y">
                {timeline.map((l, i) => (
                  <li key={i} className="p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{l.aisle || '—'}{l.bay ? ` / ${l.bay}` : ''}{l.level ? ` / L${l.level}` : ''}</div>
                      <div className="text-xs text-slate-500">{l.updatedAt ? new Date(l.updatedAt).toLocaleString() : ''}</div>
                    </div>
                    <div className="text-slate-600">Status: {l.status || '-'} | Items: {l.inventory?.length ?? 0}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div>
          <h2 className="font-semibold mb-2">Environment Map (Aisles)</h2>
          <div className="border rounded bg-white p-3 h-96 overflow-y-auto">
            {summary?.aisles && summary.aisles.length > 0 ? (
              <ul className="space-y-2">
                {summary.aisles.map((a, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-slate-600">{a.occupied}/{a.total} occupied</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-500">No aisle data.</div>
            )}
          </div>
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Status Breakdown</h3>
            <div className="border rounded bg-white p-3">
              {summary?.statusBreakdown ? (
                <ul className="text-sm space-y-1">
                  {Object.entries(summary.statusBreakdown).map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between">
                      <span className="capitalize">{k}</span>
                      <span className="text-slate-600">{v as any}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-slate-500">No status data.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">History & Trends</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 border rounded bg-white">
            <div className="text-xs text-slate-500">Last Scan</div>
            <div className="text-lg font-semibold">{summary?.lastScanAt ? new Date(summary.lastScanAt).toLocaleString() : '-'}</div>
          </div>
          <div className="p-4 border rounded bg-white">
            <div className="text-xs text-slate-500">Hot Aisle (occupied)</div>
            <div className="text-lg font-semibold">{summary?.aisles?.slice().sort((a,b)=>b.occupied-a.occupied)[0]?.name || '-'}</div>
          </div>
          <div className="p-4 border rounded bg-white">
            <div className="text-xs text-slate-500">Cold Aisle (capacity)</div>
            <div className="text-lg font-semibold">{summary?.aisles?.slice().sort((a,b)=> (a.occupied/a.total) - (b.occupied/b.total))[0]?.name || '-'}</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">SaaS Tools</h2>
        <div className="grid grid-cols-3 gap-4">
          <ToolCard title="Slotting Optimizer" href="/dashboard" desc="Generate move plans and heatmaps." />
          <ToolCard title="Replenishment Predictor" href="/projects" desc="Forecast restock cycles by aisle." />
          <ToolCard title="Warehouse Health" href="/dashboard" desc="Monitor congestion and error hotspots." />
        </div>
      </section>
    </main>
  );
}

function ToolCard({ title, href, desc }: { title: string; href: string; desc: string }) {
  return (
    <a href={href} className="block border rounded bg-white p-4 hover:shadow-sm transition">
      <div className="text-lg font-semibold">{title}</div>
      <div className="text-sm text-slate-600">{desc}</div>
    </a>
  );
}
