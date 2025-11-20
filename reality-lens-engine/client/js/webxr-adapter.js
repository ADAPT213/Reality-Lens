// Phase 2 AR core logic only
import { Nodes } from "./nodes.js";

const XRAdapterImpl = {
  session: null,
  refSpace: null,
  hitSource: null,
  reticle: null,
  async init(opts) {
    if (!navigator.xr) {
      document.getElementById("status").textContent = "WebXR unsupported";
      return;
    }
    try {
      this.session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test", "dom-overlay"],
        optionalFeatures: ["hand-tracking", "depth-sensing"],
        domOverlay: { root: document.body },
      });
    } catch (e) {
      document.getElementById("status").textContent = "AR session failed";
      console.warn(e);
      return;
    }
    this.refSpace = await this.session.requestReferenceSpace("local");
    const viewerSpace = await this.session.requestReferenceSpace("viewer");
    this.hitSource = await this.session.requestHitTestSource({
      space: viewerSpace,
    });
    this.setupReticle();
    this.session.addEventListener("end", () => this.cleanup());
    window.addEventListener("click", (e) => this.handleTap(e, opts));
    const canvas = document.getElementById("xr-canvas");
    const gl = canvas.getContext("webgl2", { xrCompatible: true });
    await this.session.updateRenderState({
      baseLayer: new XRWebGLLayer(this.session, gl),
    });
    const onFrame = (t, frame) => {
      this.onXRFrame(frame);
      this.session.requestAnimationFrame(onFrame);
    };
    this.session.requestAnimationFrame(onFrame);
  },
  setupReticle() {
    this.reticle = document.createElement("div");
    Object.assign(this.reticle.style, {
      position: "absolute",
      width: "20px",
      height: "20px",
      border: "2px solid cyan",
      borderRadius: "50%",
      transform: "translate(-50%,-50%)",
      pointerEvents: "none",
      display: "none",
    });
    document.body.appendChild(this.reticle);
  },
  onXRFrame(frame) {
    if (!frame || !this.hitSource) return;
    const results = frame.getHitTestResults(this.hitSource);
    if (results.length > 0) {
      const pose = results[0].getPose(this.refSpace);
      if (pose) {
        this.reticle.style.display = "block";
        const m = pose.transform.matrix;
        const x = m[12],
          y = m[13],
          z = m[14];
        this.lastHit = { x, y, z, pose };
        this.reticle.style.left = window.innerWidth / 2 + "px";
        this.reticle.style.top = window.innerHeight / 2 + "px";
      }
    } else {
      this.reticle.style.display = "none";
      this.lastHit = null;
    }
  },
  async handleTap(_, opts) {
    if (!this.lastHit) return;
    const anchorCap = "createAnchor" in XRHitTestResult.prototype;
    let anchor = null;
    if (anchorCap) {
      try {
        anchor = await this.lastHit.pose.createAnchor();
      } catch {}
    }
    const node = { position: { ...this.lastHit }, anchor };
    Nodes.add(node);
    if (opts?.onNodePlaced) opts.onNodePlaced(node);
  },
  cleanup() {
    this.hitSource = null;
    this.session = null;
    if (this.reticle) this.reticle.remove();
  },
};

export const XRAdapter = XRAdapterImpl;
