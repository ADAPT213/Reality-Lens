"use client";
import React, { useRef, useState } from 'react';

interface Props {
  onCapture?: (file: File) => void;
  label?: string;
}

export default function CameraCapture({ onCapture, label = 'Capture Photo' }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  const trigger = () => inputRef.current?.click();

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onCapture?.(file);
  };

  const uploadToVision = async () => {
    if (!preview || !inputRef.current?.files?.[0]) return;
    const file = inputRef.current.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('warehouseId', 'WH-001');
    setUploading(true);
    try {
      await fetch('http://localhost:4010/api/v1/vision/upload?warehouseId=WH-001', { method: 'POST', body: formData });
    } catch {}
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      <button onClick={trigger} className="px-4 py-2 rounded bg-dex-accent text-white text-sm font-medium">{label}</button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      {preview && (
        <div className="space-y-2">
          <img src={preview} alt="preview" className="max-h-48 rounded border border-dex-border" />
          <div className="flex gap-2">
            <button onClick={() => setPreview('')} className="px-3 py-1 text-xs rounded bg-dex-surfaceAlt text-slate-200">Clear</button>
            <button disabled={uploading} onClick={uploadToVision} className="px-3 py-1 text-xs rounded bg-dex-accentAlt text-white">{uploading ? 'Uploading…' : 'Send to Vision'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
