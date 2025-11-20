import React, { useState } from "react";
import { CameraFeed } from "./components/CameraFeed";
import { OverlayHUD } from "./components/OverlayHUD";
import { GestureDebugPanel } from "./components/GestureDebugPanel";
import type { ClassifierResult } from "./utils/GestureClassifier";

export const App: React.FC = () => {
  const [gesture, setGesture] = useState({
    leftHandOpen: false,
    rightHandOpen: false,
    handsTogether: false,
    poseStable: false,
  });

  const [classifierResult, setClassifierResult] =
    useState<ClassifierResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const handleStartRecording = (name: string) => {
    setIsRecording(true);
    console.log("Start recording:", name);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    console.log("Stop recording");
  };

  return (
    <>
      <CameraFeed
        onGesture={setGesture}
        onClassifierResult={setClassifierResult}
        enableClassifier={true}
      />
      <OverlayHUD gesture={gesture} />
      <GestureDebugPanel
        latestGesture={classifierResult}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        isRecording={isRecording}
      />
    </>
  );
};
