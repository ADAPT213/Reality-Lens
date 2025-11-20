// Minimal placeholder to avoid GitHub Pages breaking.
// Not a full polyfill; just prevents DOM errors.
window.XRWebGLLayer = window.XRWebGLLayer || class {
  constructor(session, context) {
    this.context = context;
  }
};
