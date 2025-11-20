import React, { useState, useEffect } from "react";
import type { ClassifierResult } from "../utils/GestureClassifier";

interface GestureDebugPanelProps {
  latestGesture: ClassifierResult | null;
  onStartRecording: (name: string) => void;
  onStopRecording: () => void;
  isRecording: boolean;
}

export const GestureDebugPanel: React.FC<GestureDebugPanelProps> = ({
  latestGesture,
  onStartRecording,
  onStopRecording,
  isRecording,
}) => {
  const [gestureName, setGestureName] = useState("");
  const [gestureLog, setGestureLog] = useState<ClassifierResult[]>([]);

  useEffect(() => {
    if (latestGesture) {
      setGestureLog((prev) => [...prev.slice(-9), latestGesture]);
    }
  }, [latestGesture]);

  const handleRecord = () => {
    if (isRecording) {
      onStopRecording();
    } else {
      if (gestureName.trim()) {
        onStartRecording(gestureName.trim());
      }
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 150,
        left: 150,
        background: "rgba(10, 10, 20, 0.75)",
        backdropFilter: "blur(10px)",
        border: "2px solid rgba(0, 240, 255, 0.5)",
        borderRadius: 10,
        padding: 14,
        width: 280,
        color: "#f0f4ff",
        fontSize: 12,
        maxHeight: "30vh",
        overflow: "auto",
        zIndex: 1000,
        pointerEvents: "auto",
      }}
    >
      <h4 style={{ margin: "0 0 8px 0", fontSize: 13, fontWeight: 600 }}>
        Gesture Classifier
      </h4>

      {latestGesture && (
        <div
          style={{
            background: "linear-gradient(135deg, #1e8fff 0%, #6f60ff 100%)",
            padding: "8px 10px",
            borderRadius: 6,
            marginBottom: 10,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {latestGesture.gesture}
          </div>
          <div style={{ opacity: 0.9, fontSize: 11 }}>
            Confidence: {(latestGesture.confidence * 100).toFixed(1)}%
          </div>
          {latestGesture.metadata && (
            <div style={{ fontSize: 10, marginTop: 4, opacity: 0.8 }}>
              {JSON.stringify(latestGesture.metadata, null, 1).slice(0, 100)}
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <div style={{ marginBottom: 4, fontSize: 11, opacity: 0.8 }}>
          Record Custom Gesture:
        </div>
        <input
          type="text"
          value={gestureName}
          onChange={(e) => setGestureName(e.target.value)}
          placeholder="gesture_name"
          disabled={isRecording}
          style={{
            width: "100%",
            padding: "4px 6px",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 4,
            color: "#fff",
            fontSize: 11,
            marginBottom: 4,
          }}
        />
        <button
          onClick={handleRecord}
          style={{
            width: "100%",
            padding: "6px 8px",
            background: isRecording ? "#ff4444" : "#44ff44",
            border: "none",
            borderRadius: 4,
            color: "#000",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 11,
          }}
        >
          {isRecording ? "⏹ Stop Recording" : "⏺ Start Recording"}
        </button>
      </div>

      <div>
        <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>
          Recent Gestures:
        </div>
        <div
          style={{ display: "grid", gap: 2, maxHeight: 120, overflow: "auto" }}
        >
          {gestureLog
            .slice()
            .reverse()
            .map((g, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  padding: "4px 6px",
                  borderRadius: 4,
                  fontSize: 10,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{g.gesture}</span>
                <span style={{ opacity: 0.7 }}>
                  {(g.confidence * 100).toFixed(0)}%
                </span>
              </div>
            ))}
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 10, opacity: 0.6 }}>
        Try: wave, swipe, zoom, rotate, point
      </div>
    </div>
  );
};
