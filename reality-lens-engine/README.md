# Reality Lens Engine

A minimal, extensible React + TypeScript + MediaPipe Holistic starter for building camera‑driven spatial/gesture experiences ("reality sandbox").

## Features

- Live camera capture via MediaPipe `Camera`
- Holistic landmark stream (pose, face, hands) rendered to canvas
- Basic gesture state: open hands, hands together, pose stability
- Overlay HUD styled with blur + gradient states
- Fully typed React hook `useHolistic` for integration
- Vite fast dev server

## Getting Started

### 1. Install

```powershell
# From repository root
cd reality-lens-engine; npm install
```

### 2. Run Dev

```powershell
npm run dev
```

Open http://localhost:5173 (default Vite port).

### 3. Build

```powershell
npm run build
```

Artifacts output to `dist/`.

## Project Structure

```
reality-lens-engine/
  package.json        # scripts & deps
  tsconfig.json       # strict TS config
  public/index.html   # root HTML shell
  src/
    index.tsx         # React root mount
    App.tsx           # composition of camera + HUD
    hooks/useHolistic.ts  # core hook (MediaPipe lifecycle + gesture classification)
    components/
      CameraFeed.tsx  # video/canvas + inline gesture status
      OverlayHUD.tsx  # styled HUD panel
    styles/hud.css    # HUD styles
```

## Extending

| Capability            | Approach                                               | Notes                                                                        |
| --------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Advanced Gesture      | Replace naive distance heuristics with ML classifier   | Collect sample landmark frames, label, train small model (e.g. SVM) offline. |
| Segmentation FX       | Enable `enableSegmentation` option and mask background | Use `results.segmentationMask` draw to secondary canvas.                     |
| Multi-Stage Pipelines | Add event bus or RxJS to stream landmarks              | Decouple gesture detection from rendering.                                   |
| Networking            | WebSocket broadcast of gesture states                  | Enable collaborative sessions / multiplayer.                                 |
| Recording             | Capture landmark sequences to JSON                     | Useful for training gesture recognition.                                     |

## Hook API

```ts
const { videoRef, canvasRef, gesture } = useHolistic({
  onResults: (results, gesture) => {
    // custom logic per frame
  },
  width: 640,
  height: 480,
  enableSegmentation: false,
  selfieMode: true,
});
```

`gesture` shape:

```ts
interface GestureState {
  leftHandOpen: boolean;
  rightHandOpen: boolean;
  handsTogether: boolean;
  poseStable: boolean;
}
```

## Performance Tips

- Reduce `modelComplexity` for lower-end devices.
- Throttle custom heavy logic inside `onResults` using `requestAnimationFrame` batching.
- Avoid large shadow DOM trees; canvas rendering is already efficient.

## License

Internal / Proprietary (adjust as needed).

## Next Ideas

- Quest system mapping gestures to achievements.
- Spatial anchors using pose translation & orientation.
- Hand pose dynamic trail rendering (particles).
- Gesture combo chaining for "spell" activations.

---

Crafted for rapid experimentation. Build your reality layer. ✨
