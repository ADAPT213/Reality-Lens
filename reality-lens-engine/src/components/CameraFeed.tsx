import React from "react";
import { useHolistic } from "../hooks/useHolistic";
import type { ClassifierResult } from "../utils/GestureClassifier";

interface CameraFeedProps {
  onGesture?: (gesture: any) => void;
  onClassifierResult?: (result: ClassifierResult | null) => void;
  enableClassifier?: boolean;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({
  onGesture,
  onClassifierResult,
  enableClassifier = false,
}) => {
  const { videoRef, canvasRef, gesture } = useHolistic({
    onResults: (_, g, classifier) => {
      onGesture?.(g);
      onClassifierResult?.(classifier || null);
    },
    enableClassifier,
  });

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#000",
      }}
    >
      <video
        ref={videoRef}
        style={{ display: "none" }}
        playsInline
        autoPlay
        muted
      />
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </div>
  );
};
