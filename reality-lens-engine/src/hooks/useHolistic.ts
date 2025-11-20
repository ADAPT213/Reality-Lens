import { useEffect, useRef, useState, useCallback } from "react";
import type { Results } from "@mediapipe/holistic";
import {
  Holistic,
  POSE_CONNECTIONS,
  HAND_CONNECTIONS,
} from "@mediapipe/holistic";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { Camera } from "@mediapipe/camera_utils";
import {
  GestureClassifier,
  type ClassifierResult,
} from "../utils/GestureClassifier";

export interface GestureState {
  leftHandOpen: boolean;
  rightHandOpen: boolean;
  handsTogether: boolean;
  poseStable: boolean;
}

interface UseHolisticOptions {
  onResults?: (
    r: Results,
    gesture: GestureState,
    classifier?: ClassifierResult | null,
  ) => void;
  width?: number;
  height?: number;
  enableSegmentation?: boolean;
  selfieMode?: boolean;
  enableClassifier?: boolean;
}

export function useHolistic(options: UseHolisticOptions = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const holisticRef = useRef<Holistic | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const classifierRef = useRef<GestureClassifier | null>(null);

  const [gesture, setGesture] = useState<GestureState>({
    leftHandOpen: false,
    rightHandOpen: false,
    handsTogether: false,
    poseStable: false,
  });

  const [classifierResult, setClassifierResult] =
    useState<ClassifierResult | null>(null);

  const classifyGesture = useCallback((r: Results): GestureState => {
    const lh = r.leftHandLandmarks || [];
    const rh = r.rightHandLandmarks || [];
    const pose = r.poseLandmarks || [];

    // Very naive open-hand heuristic: compare average distances between wrist and fingertips
    const isOpen = (hand: any[]): boolean => {
      if (hand.length < 21) return false;
      const wrist = hand[0];
      const tips = [hand[4], hand[8], hand[12], hand[16], hand[20]].filter(
        Boolean,
      );
      const avgDist =
        tips.reduce(
          (acc, tip) =>
            acc + Math.hypot(tip.x - wrist.x, tip.y - wrist.y, tip.z - wrist.z),
          0,
        ) / tips.length;
      return avgDist > 0.4; // tuned empirically
    };

    const leftHandOpen = isOpen(lh);
    const rightHandOpen = isOpen(rh);

    let handsTogether = false;
    if (lh.length && rh.length) {
      const lPalm = lh[0];
      const rPalm = rh[0];
      const dist = Math.hypot(
        lPalm.x - rPalm.x,
        lPalm.y - rPalm.y,
        lPalm.z - rPalm.z,
      );
      handsTogether = dist < 0.15;
    }

    let poseStable = false;
    if (pose.length > 0) {
      // simple stability: shoulders to hips vertical alignment
      const leftShoulder = pose[11];
      const rightShoulder = pose[12];
      const leftHip = pose[23];
      const rightHip = pose[24];
      if (leftShoulder && rightShoulder && leftHip && rightHip) {
        const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
        const hipMidY = (leftHip.y + rightHip.y) / 2;
        poseStable = Math.abs(shoulderMidY - hipMidY) < 0.1;
      }
    }

    return { leftHandOpen, rightHandOpen, handsTogether, poseStable };
  }, []);

  const onResults = useCallback(
    (results: Results) => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      // Use actual canvas dimensions from DOM
      const rect = canvasRef.current.getBoundingClientRect();
      canvasRef.current.width = rect.width;
      canvasRef.current.height = rect.height;

      ctx.save();
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.drawImage(
        results.image,
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height,
      );

      // Draw landmarks
      if (results.poseLandmarks) {
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
          color: "#00FF00",
          lineWidth: 2,
        });
        drawLandmarks(ctx, results.poseLandmarks, {
          color: "#FFFFFF",
          lineWidth: 1,
        });
      }
      if (results.faceLandmarks) {
        drawLandmarks(ctx, results.faceLandmarks, {
          color: "#FFDD00",
          lineWidth: 1,
          radius: 1,
        });
      }
      if (results.leftHandLandmarks) {
        drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS, {
          color: "#FF0000",
          lineWidth: 2,
        });
        drawLandmarks(ctx, results.leftHandLandmarks, {
          color: "#FF8888",
          lineWidth: 1,
        });
      }
      if (results.rightHandLandmarks) {
        drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, {
          color: "#0000FF",
          lineWidth: 2,
        });
        drawLandmarks(ctx, results.rightHandLandmarks, {
          color: "#8888FF",
          lineWidth: 1,
        });
      }
      ctx.restore();

      const g = classifyGesture(results);
      setGesture(g);

      // Advanced gesture classification
      let advancedGesture: ClassifierResult | null = null;
      if (options.enableClassifier && classifierRef.current) {
        advancedGesture = classifierRef.current.processFrame(results);
        if (advancedGesture) {
          setClassifierResult(advancedGesture);
        }
      }

      options.onResults?.(results, g, advancedGesture);
    },
    [classifyGesture, options],
  );

  useEffect(() => {
    if (options.enableClassifier) {
      classifierRef.current = new GestureClassifier();
    }

    holisticRef.current = new Holistic({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
    });
    holisticRef.current.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: options.enableSegmentation || false,
      refineFaceLandmarks: true,
      selfieMode: options.selfieMode || true,
    });
    holisticRef.current.onResults(onResults);

    if (videoRef.current) {
      cameraRef.current = new Camera(videoRef.current, {
        onFrame: async () => {
          if (holisticRef.current && videoRef.current) {
            await holisticRef.current.send({ image: videoRef.current });
          }
        },
        width: 1280,
        height: 720,
      });
      cameraRef.current.start();
    }

    return () => {
      cameraRef.current?.stop();
      holisticRef.current?.close();
    };
  }, [
    onResults,
    options.width,
    options.height,
    options.enableSegmentation,
    options.selfieMode,
  ]);

  const startRecording = useCallback((name: string) => {
    classifierRef.current?.startRecording(name);
  }, []);

  const stopRecording = useCallback(() => {
    classifierRef.current?.stopRecording("custom");
  }, []);

  const exportPatterns = useCallback(() => {
    return classifierRef.current?.exportPatterns() || "";
  }, []);

  const importPatterns = useCallback((json: string) => {
    classifierRef.current?.importPatterns(json);
  }, []);

  return {
    videoRef,
    canvasRef,
    gesture,
    classifierResult,
    startRecording,
    stopRecording,
    exportPatterns,
    importPatterns,
    classifier: classifierRef.current,
  };
}
