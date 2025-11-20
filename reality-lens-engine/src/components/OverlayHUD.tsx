import React, { useEffect, useState } from "react";
import "../styles/hud.css";

interface OverlayHUDProps {
  gesture: {
    leftHandOpen: boolean;
    rightHandOpen: boolean;
    handsTogether: boolean;
    poseStable: boolean;
  };
}

export const OverlayHUD: React.FC<OverlayHUDProps> = ({ gesture }) => {
  const [rotation, setRotation] = useState(0);
  const [fps, setFps] = useState(60);
  const [planes, setPlanes] = useState(4);
  const [objects, setObjects] = useState(2);
  const [anchors, setAnchors] = useState(1);
  const [mode, setMode] = useState("INTERACTION");
  const [commandInput, setCommandInput] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation((prev) => (prev + 2) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const getGestureName = () => {
    if (gesture.handsTogether) return "HANDS TOGETHER";
    if (gesture.leftHandOpen && gesture.rightHandOpen) return "BOTH OPEN";
    if (gesture.leftHandOpen) return "LEFT OPEN";
    if (gesture.rightHandOpen) return "RIGHT OPEN";
    return "NONE";
  };

  const handleCommand = () => {
    if (commandInput.trim()) {
      console.log("Command:", commandInput);
      setCommandInput("");
    }
  };

  return (
    <>
      {/* Top Left - Gesture Indicator */}
      <div className="hud-gesture-panel">
        <div className="hud-hexagon">
          <div className="hand-icon">✋</div>
        </div>
        <div className="hud-gesture-text">
          Gesture: <span className="cyan">{getGestureName()}</span>
        </div>
      </div>

      {/* Top Center - Mode Display */}
      <div className="hud-mode-panel">
        <div className="hud-mode-hexagon">
          MODE: <span className="gold">{mode}</span>
        </div>
      </div>

      {/* Top Right - Radar Circle */}
      <div className="hud-radar">
        <div
          className="radar-outer"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className="radar-mark" />
          <div className="radar-mark" style={{ transform: "rotate(90deg)" }} />
          <div className="radar-mark" style={{ transform: "rotate(180deg)" }} />
          <div className="radar-mark" style={{ transform: "rotate(270deg)" }} />
        </div>
        <div className="radar-center" />
      </div>

      {/* Center - Main Reticle */}
      <div className="hud-reticle">
        <div
          className="reticle-outer"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className="crosshair" />
          <div className="crosshair" style={{ transform: "rotate(90deg)" }} />
        </div>
        <div
          className="reticle-inner"
          style={{ transform: `rotate(${-rotation * 2}deg)` }}
        >
          <div className="crosshair" />
          <div className="crosshair" style={{ transform: "rotate(90deg)" }} />
        </div>
        <div className="reticle-glow" />
        <div className="reticle-center" />
      </div>

      {/* Left Side - Quick Action Buttons */}
      <div className="hud-actions">
        <button className="action-btn" onClick={() => console.log("Spawn Orb")}>
          SPAWN ORB
        </button>
        <button
          className="action-btn"
          onClick={() => console.log("Open Portal")}
        >
          OPEN PORTAL
        </button>
        <button
          className="action-btn"
          onClick={() => console.log("Drop Anchor")}
        >
          DROP ANCHOR
        </button>
      </div>

      {/* Bottom Left - Voice Button */}
      <div className="hud-voice-btn">
        <div className="voice-hexagon">
          <div className="mic-icon">🎤</div>
        </div>
      </div>

      {/* Bottom Center - AI Command */}
      <div className="hud-command">
        <div className="command-label">AI COMMAND</div>
        <input
          type="text"
          className="command-input"
          placeholder="Type or Speak"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleCommand()}
        />
      </div>

      {/* Bottom Right - Child Mode Toggle */}
      <div className="hud-child-mode">
        <label className="child-toggle">
          <input type="checkbox" />
          <span>CHILD MODE</span>
        </label>
      </div>

      {/* Right Side - Stats Panel */}
      <div className="hud-stats">
        <div className="stat-item gold">FPS: {fps}</div>
        <div className="stat-item gold">Planes: {planes}</div>
        <div className="stat-item gold">Objects: {objects}</div>
        <div className="stat-item gold">Anchors: {anchors}</div>
      </div>
    </>
  );
};
