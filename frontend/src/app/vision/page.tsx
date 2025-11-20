'use client';
import { useState, useRef, useEffect } from 'react';

interface Rectangle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  locationCode: string;
  sku: string;
}

export default function VisionPage() {
  const [sessionId, setSessionId] = useState<string>('');
  const [imageSrc, setImageSrc] = useState<string>('');
  const [rectangles, setRectangles] = useState<Rectangle[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<Rectangle | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current && canvasRef.current && imageSrc) {
      const img = imgRef.current;
      const canvas = canvasRef.current;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      redraw();
    }
  }, [imageSrc, rectangles]);

  const redraw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    rectangles.forEach((r) => {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.width, r.height);
      ctx.fillStyle = '#00ff00';
      ctx.fillText(`${r.locationCode} | ${r.sku}`, r.x + 5, r.y + 15);
    });
    if (currentRect) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(currentRect.x, currentRect.y, currentRect.width, currentRect.height);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('warehouseId', 'WH-001');
    const res = await fetch('http://localhost:4010/api/v1/vision/upload?warehouseId=WH-001', {
      method: 'POST',
      body: formData,
    });
    const session = await res.json();
    setSessionId(session.id);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    setStartPos({ x, y });
    setDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !startPos) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    setCurrentRect({
      id: Date.now().toString(),
      x: Math.min(startPos.x, x),
      y: Math.min(startPos.y, y),
      width: Math.abs(x - startPos.x),
      height: Math.abs(y - startPos.y),
      locationCode: '',
      sku: '',
    });
    redraw();
  };

  const handleMouseUp = () => {
    if (currentRect && currentRect.width > 5 && currentRect.height > 5) {
      const locationCode = prompt('Location code (e.g. A-01):') || '';
      const sku = prompt('SKU code (e.g. SKU-001):') || '';
      setRectangles([...rectangles, { ...currentRect, locationCode, sku }]);
    }
    setDrawing(false);
    setStartPos(null);
    setCurrentRect(null);
  };

  const handleSavePickfaces = async () => {
    if (!sessionId || rectangles.length === 0) return;
    await fetch(`http://localhost:4010/api/v1/vision/${sessionId}/pickfaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickfaces: rectangles }),
    });
    alert('Pickfaces saved!');
  };

  const handleGeneratePlan = async () => {
    if (!sessionId) return;
    const res = await fetch(`http://localhost:4010/api/v1/vision/${sessionId}/generate-plan`, {
      method: 'POST',
    });
    const data = await res.json();
    setPlan(data.plan);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">SmartPick Vision</h1>
      <p className="text-gray-600 mb-6">Upload a rack photo, draw rectangles around pickfaces, label them, and generate a slotting plan.</p>

      <div className="mb-6">
        <label className="block mb-2 font-semibold">Upload Image:</label>
        <input type="file" accept="image/*" onChange={handleUpload} className="border p-2 rounded" />
      </div>

      {imageSrc && (
        <div className="mb-6 relative inline-block">
          <img ref={imgRef} src={imageSrc} alt="Warehouse" className="hidden" />
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="border-2 border-gray-300 cursor-crosshair"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        </div>
      )}

      {rectangles.length > 0 && (
        <div className="mb-6">
          <button onClick={handleSavePickfaces} className="bg-blue-600 text-white px-6 py-2 rounded mr-4">
            Save Mapping
          </button>
          <button onClick={handleGeneratePlan} className="bg-green-600 text-white px-6 py-2 rounded">
            Generate Plan
          </button>
        </div>
      )}

      {plan && (
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-2xl font-semibold mb-4">Move Plan</h2>
          <p className="text-sm text-gray-500 mb-4">Generated at: {plan.generatedAt}</p>
          <table className="w-full border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">SKU</th>
                <th className="border p-2">From</th>
                <th className="border p-2">To</th>
                <th className="border p-2">Priority</th>
                <th className="border p-2">Score Before</th>
                <th className="border p-2">Score After</th>
              </tr>
            </thead>
            <tbody>
              {(plan.items || []).map((item: any, i: number) => (
                <tr key={i}>
                  <td className="border p-2">{item.skuId}</td>
                  <td className="border p-2">{item.fromLocationId}</td>
                  <td className="border p-2">{item.toLocationId}</td>
                  <td className="border p-2">{item.priority}</td>
                  <td className="border p-2">{item.scoreBefore}</td>
                  <td className="border p-2">{item.scoreAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
