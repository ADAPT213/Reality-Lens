// Phase 4 core app controller
import { XRAdapter } from "./js/webxr-adapter.js";
import { bindUI } from "./js/ui.js";
import { Modes } from "./js/modes.js";
import { Nodes } from "./js/nodes.js";

const App = {
  state: { mode: "architect" },
  init() {
    this.nodes = Nodes;
    this.modes = Modes;
    bindUI({
      onStartAR: () => this.startAR(),
      onModeChange: (m) => this.setMode(m),
    });
  },
  async startAR() {
    document.getElementById("status").textContent = "Requesting AR...";
    await XRAdapter.init({ onNodePlaced: () => this.updateNodeCount() });
    document.getElementById("status").textContent = "AR Active";
  },
  setMode(m) {
    this.state.mode = m;
    document.getElementById("status").textContent = "Mode: " + m;
  },
  updateNodeCount() {
    document.getElementById("nodeCount").textContent =
      "Nodes: " + this.nodes.count();
  },
};

window.addEventListener("DOMContentLoaded", () => App.init());
