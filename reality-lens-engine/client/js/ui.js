// Phase 3 UI bindings
export function bindUI(handlers) {
  const startBtn = document.getElementById("startAR");
  const modeSelect = document.getElementById("modeSelect");
  startBtn.addEventListener(
    "click",
    () => handlers.onStartAR && handlers.onStartAR(),
  );
  modeSelect.addEventListener(
    "change",
    (e) => handlers.onModeChange && handlers.onModeChange(e.target.value),
  );
}
