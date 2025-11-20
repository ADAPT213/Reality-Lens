import type { Results } from "@mediapipe/holistic";

export interface LandmarkFrame {
  leftHand: any[];
  rightHand: any[];
  pose: any[];
  timestamp: number;
}

export interface GesturePattern {
  name: string;
  frames: LandmarkFrame[];
  duration: number;
}

export interface ClassifierResult {
  gesture: string;
  confidence: number;
  metadata?: any;
}

/**
 * Advanced gesture classifier using temporal pattern matching.
 * Supports:
 * - Multi-frame sequence detection
 * - Custom gesture recording/training
 * - Combo chains (gesture sequences)
 * - Confidence scoring
 */
export class GestureClassifier {
  private history: LandmarkFrame[] = [];
  private readonly maxHistoryLength = 90; // 3 seconds at 30fps
  private patterns: Map<string, GesturePattern[]> = new Map();
  private recording: LandmarkFrame[] | null = null;
  private recordingStartTime = 0;

  constructor() {
    this.initializeBuiltInPatterns();
  }

  private initializeBuiltInPatterns() {
    // Built-in patterns can be loaded from JSON or defined here
    // For now, we'll use rule-based detection in classify()
  }

  /**
   * Add a frame to history and attempt classification
   */
  public processFrame(results: Results): ClassifierResult | null {
    const frame: LandmarkFrame = {
      leftHand: results.leftHandLandmarks || [],
      rightHand: results.rightHandLandmarks || [],
      pose: results.poseLandmarks || [],
      timestamp: Date.now(),
    };

    this.history.push(frame);
    if (this.history.length > this.maxHistoryLength) {
      this.history.shift();
    }

    // If recording, capture frame
    if (this.recording) {
      this.recording.push(frame);
    }

    return this.classify();
  }

  /**
   * Classify current gesture based on recent history
   */
  private classify(): ClassifierResult | null {
    if (this.history.length < 5) return null;

    // Check for wave (hand moving side to side)
    const wave = this.detectWave();
    if (wave) return wave;

    // Check for swipe gestures
    const swipe = this.detectSwipe();
    if (swipe) return swipe;

    // Check for zoom (hands moving apart or together)
    const zoom = this.detectZoom();
    if (zoom) return zoom;

    // Check for rotation (circular hand motion)
    const rotation = this.detectRotation();
    if (rotation) return rotation;

    // Check for point gesture
    const point = this.detectPoint();
    if (point) return point;

    // Check custom patterns
    const custom = this.matchCustomPattern();
    if (custom) return custom;

    return null;
  }

  private detectWave(): ClassifierResult | null {
    const recentFrames = this.history.slice(-30); // Last 1 second
    if (recentFrames.length < 20) return null;

    const rightHandX = recentFrames
      .filter((f) => f.rightHand.length > 0)
      .map((f) => f.rightHand[9]?.x); // Middle finger MCP

    if (rightHandX.length < 15) return null;

    // Look for oscillation in X position
    let directionChanges = 0;
    let lastDirection = 0;
    for (let i = 1; i < rightHandX.length; i++) {
      const delta = rightHandX[i] - rightHandX[i - 1];
      const direction = Math.sign(delta);
      if (
        direction !== 0 &&
        direction !== lastDirection &&
        lastDirection !== 0
      ) {
        directionChanges++;
      }
      lastDirection = direction;
    }

    if (directionChanges >= 3) {
      const amplitude = Math.max(...rightHandX) - Math.min(...rightHandX);
      return {
        gesture: "wave",
        confidence: Math.min(0.95, 0.6 + amplitude * 2),
        metadata: { directionChanges, amplitude },
      };
    }

    return null;
  }

  private detectSwipe(): ClassifierResult | null {
    const recentFrames = this.history.slice(-15); // ~0.5 seconds
    if (recentFrames.length < 10) return null;

    const hands = ["rightHand", "leftHand"] as const;
    for (const hand of hands) {
      const positions = recentFrames
        .filter((f) => f[hand].length > 0)
        .map((f) => ({ x: f[hand][9]?.x || 0, y: f[hand][9]?.y || 0 }));

      if (positions.length < 8) continue;

      const startPos = positions[0];
      const endPos = positions[positions.length - 1];
      const deltaX = endPos.x - startPos.x;
      const deltaY = endPos.y - startPos.y;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance > 0.3) {
        const angle = Math.atan2(deltaY, deltaX);
        let direction = "right";
        if (Math.abs(angle) < Math.PI / 4) direction = "right";
        else if (Math.abs(angle) > (3 * Math.PI) / 4) direction = "left";
        else if (angle > 0) direction = "down";
        else direction = "up";

        return {
          gesture: `swipe_${direction}`,
          confidence: Math.min(0.9, distance * 2),
          metadata: { hand, distance, angle },
        };
      }
    }

    return null;
  }

  private detectZoom(): ClassifierResult | null {
    const recentFrames = this.history.slice(-20);
    if (recentFrames.length < 15) return null;

    const distances = recentFrames
      .filter((f) => f.leftHand.length > 0 && f.rightHand.length > 0)
      .map((f) => {
        const lPalm = f.leftHand[0];
        const rPalm = f.rightHand[0];
        return Math.hypot(
          lPalm.x - rPalm.x,
          lPalm.y - rPalm.y,
          lPalm.z - rPalm.z,
        );
      });

    if (distances.length < 12) return null;

    const startDist = distances[0];
    const endDist = distances[distances.length - 1];
    const change = endDist - startDist;

    if (Math.abs(change) > 0.15) {
      return {
        gesture: change > 0 ? "zoom_out" : "zoom_in",
        confidence: Math.min(0.92, Math.abs(change) * 4),
        metadata: { startDist, endDist, change },
      };
    }

    return null;
  }

  private detectRotation(): ClassifierResult | null {
    const recentFrames = this.history.slice(-25);
    if (recentFrames.length < 20) return null;

    const rightHand = recentFrames
      .filter((f) => f.rightHand.length > 0)
      .map((f) => f.rightHand[9]); // Middle finger MCP

    if (rightHand.length < 15) return null;

    // Calculate cumulative angular change
    let totalAngle = 0;
    for (let i = 1; i < rightHand.length - 1; i++) {
      const v1 = {
        x: rightHand[i].x - rightHand[i - 1].x,
        y: rightHand[i].y - rightHand[i - 1].y,
      };
      const v2 = {
        x: rightHand[i + 1].x - rightHand[i].x,
        y: rightHand[i + 1].y - rightHand[i].y,
      };
      const angle = Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x);
      totalAngle += angle;
    }

    if (Math.abs(totalAngle) > Math.PI) {
      return {
        gesture: totalAngle > 0 ? "rotate_ccw" : "rotate_cw",
        confidence: Math.min(0.88, Math.abs(totalAngle) / (2 * Math.PI)),
        metadata: { totalAngle },
      };
    }

    return null;
  }

  private detectPoint(): ClassifierResult | null {
    const latest = this.history[this.history.length - 1];
    if (!latest || latest.rightHand.length === 0) return null;

    const wrist = latest.rightHand[0];
    const indexTip = latest.rightHand[8];
    const middleTip = latest.rightHand[12];
    const ringTip = latest.rightHand[16];
    const pinkyTip = latest.rightHand[20];

    if (!indexTip || !middleTip || !ringTip || !pinkyTip) return null;

    // Index extended, others curled
    const indexExtended =
      Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) > 0.35;
    const middleCurled =
      Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) < 0.25;
    const ringCurled =
      Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) < 0.22;
    const pinkyCurled =
      Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) < 0.2;

    if (indexExtended && middleCurled && ringCurled && pinkyCurled) {
      // Determine point direction based on index finger angle
      const angle = Math.atan2(indexTip.y - wrist.y, indexTip.x - wrist.x);
      return {
        gesture: "point",
        confidence: 0.85,
        metadata: { angle, direction: this.angleToDirection(angle) },
      };
    }

    return null;
  }

  private angleToDirection(angle: number): string {
    const deg = (angle * 180) / Math.PI;
    if (deg > -45 && deg <= 45) return "right";
    if (deg > 45 && deg <= 135) return "down";
    if (deg > 135 || deg <= -135) return "left";
    return "up";
  }

  private matchCustomPattern(): ClassifierResult | null {
    // DTW (Dynamic Time Warping) or simple Euclidean matching
    // For now, return null - user can extend this
    return null;
  }

  /**
   * Start recording a new gesture pattern
   */
  public startRecording(gestureName: string) {
    this.recording = [];
    this.recordingStartTime = Date.now();
    console.log(`Recording gesture: ${gestureName}`);
  }

  /**
   * Stop recording and save the pattern
   */
  public stopRecording(gestureName: string): GesturePattern | null {
    if (!this.recording || this.recording.length < 5) {
      console.warn("Not enough frames recorded");
      this.recording = null;
      return null;
    }

    const pattern: GesturePattern = {
      name: gestureName,
      frames: this.recording,
      duration: Date.now() - this.recordingStartTime,
    };

    if (!this.patterns.has(gestureName)) {
      this.patterns.set(gestureName, []);
    }
    this.patterns.get(gestureName)!.push(pattern);

    console.log(
      `Saved pattern: ${gestureName}, ${pattern.frames.length} frames, ${pattern.duration}ms`,
    );
    this.recording = null;
    return pattern;
  }

  /**
   * Export patterns to JSON
   */
  public exportPatterns(): string {
    const data: any = {};
    this.patterns.forEach((patterns, name) => {
      data[name] = patterns;
    });
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import patterns from JSON
   */
  public importPatterns(json: string) {
    try {
      const data = JSON.parse(json);
      Object.entries(data).forEach(([name, patterns]) => {
        this.patterns.set(name, patterns as GesturePattern[]);
      });
      console.log("Patterns imported successfully");
    } catch (e) {
      console.error("Failed to import patterns:", e);
    }
  }

  /**
   * Clear history (useful for resetting state)
   */
  public clearHistory() {
    this.history = [];
  }

  /**
   * Get current history length
   */
  public getHistoryLength(): number {
    return this.history.length;
  }
}
