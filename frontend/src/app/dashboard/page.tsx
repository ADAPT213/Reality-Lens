"use client";
import { useEffect, useState } from "react";
import io from "socket.io-client";

export default function Dashboard() {
  const [status, setStatus] = useState("disconnected");
  const [last, setLast] = useState<any>(null);
  const [chatHistory, setChatHistory] = useState<Array<{role: string; text: string}>>([]);
  const [question, setQuestion] = useState("");
  const [movePlan, setMovePlan] = useState<any[]>([]);
  const [heatmap, setHeatmap] = useState<any[]>([]);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4010";
    const socket = io(wsUrl, { withCredentials: true, transports: ['websocket', 'polling'] });
    socket.on("connect", () => setStatus("connected"));
    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("SHIFT_SNAPSHOT", (payload: any) => setLast(payload));
    return () => { socket.close(); };
  }, []);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setChatHistory((h) => [...h, { role: 'user', text: question }]);
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4010";
    try {
      const res = await fetch(`${apiUrl}/api/copilot/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setChatHistory((h) => [...h, { role: 'assistant', text: data.answer || 'No answer' }]);
    } catch (e) {
      setChatHistory((h) => [...h, { role: 'assistant', text: 'Error calling Copilot' }]);
    }
    setQuestion("");
  };

  const loadMovePlan = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4010";
    try {
      const res = await fetch(`${apiUrl}/api/slotting/move-plan?warehouseId=demo`);
      const data = await res.json();
      setMovePlan(data.items || []);
    } catch {}
  };

  const loadHeatmap = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4010";
    try {
      const res = await fetch(`${apiUrl}/api/slotting/heatmap?warehouseId=demo`);
      const data = await res.json();
      setHeatmap(data.tiles || []);
    } catch {}
  };

  return (
    <main className="space-y-6">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${status === "connected" ? "bg-green-500" : "bg-red-500"}`} />
        <span className="text-sm">WebSocket: {status}</span>
      </div>

      <section className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded border bg-white">
          <div className="text-sm text-slate-500">Picks/hour</div>
          <div className="text-2xl font-semibold">{last?.metrics?.picksPerHour || '-'}</div>
        </div>
        <div className="p-4 rounded border bg-white">
          <div className="text-sm text-slate-500">Avg Risk</div>
          <div className="text-2xl font-semibold">{last?.metrics?.avgRisk || '-'}</div>
        </div>
        <div className="p-4 rounded border bg-white">
          <div className="text-sm text-slate-500">Red Locations</div>
          <div className="text-2xl font-semibold">{last?.metrics?.redLocations || '-'}</div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="font-semibold mb-2">Latest Shift Data</h2>
          <pre className="text-xs bg-slate-100 p-3 rounded overflow-auto h-64">{JSON.stringify(last, null, 2)}</pre>
        </div>
        <div>
          <h2 className="font-semibold mb-2">Copilot Chat</h2>
          <div className="border rounded bg-white h-64 overflow-y-auto p-3 space-y-2 mb-2">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`text-sm ${msg.role === 'user' ? 'text-blue-700 font-medium' : 'text-slate-700'}`}>
                <span className="font-semibold">{msg.role === 'user' ? 'You' : 'Copilot'}:</span> {msg.text}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded px-3 py-2 text-sm"
              placeholder="Ask Copilot..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            />
            <button onClick={handleAsk} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Ask</button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Tonight's Moves</h2>
            <button onClick={loadMovePlan} className="text-sm px-3 py-1 rounded bg-slate-800 text-white">Refresh</button>
          </div>
          <div className="border rounded bg-white h-64 overflow-y-auto">
            {movePlan.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">No moves yet.</div>
            ) : (
              <ul className="divide-y">
                {movePlan.map((m: any, i: number) => (
                  <li key={i} className="p-3 text-sm">
                    <div className="font-medium">SKU {m.skuId}</div>
                    <div className="text-slate-600">{m.fromLocationId} → {m.toLocationId}</div>
                    <div className="text-slate-600">Δsec/pick: {m.expectedSecondsSavedPerPick} | Δrisk: {m.expectedRiskReduction}</div>
                    <div className="text-slate-500">Why: {m.rationale}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Slotting Heatmap</h2>
            <button onClick={loadHeatmap} className="text-sm px-3 py-1 rounded bg-slate-800 text-white">Refresh</button>
          </div>
          <div className="border rounded bg-white h-64 overflow-y-auto">
            {heatmap.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">No data.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-2">Location</th>
                    <th className="text-left p-2">Reach</th>
                    <th className="text-left p-2">Travel</th>
                    <th className="text-left p-2">Congestion</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmap.slice(0, 50).map((t: any, i: number) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{t.label}</td>
                      <td className="p-2">{t.reachBand || '-'}</td>
                      <td className="p-2">{t.travelCost}</td>
                      <td className="p-2">{t.congestion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
