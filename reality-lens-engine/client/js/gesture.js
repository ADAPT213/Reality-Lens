// Phase 6 mobile gestures + vibration minimal
export const Gesture = (function () {
  let pinchStartDist = null;
  let active = false;
  let reticleLocked = false;
  function distance(e1, e2) {
    const dx = e1.clientX - e2.clientX,
      dy = e1.clientY - e2.clientY;
    return Math.hypot(dx, dy);
  }
  window.addEventListener("touchstart", (e) => {
    active = true;
    if (navigator.vibrate) navigator.vibrate(10);
    if (e.touches.length === 2) {
      pinchStartDist = distance(e.touches[0], e.touches[1]);
    }
  });
  window.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2 && pinchStartDist) {
      const d = distance(e.touches[0], e.touches[1]);
      const scale = d / pinchStartDist;
      document.getElementById("status").textContent =
        "Pinch scale " + scale.toFixed(2);
    }
  });
  window.addEventListener("touchend", () => {
    active = false;
    pinchStartDist = null;
  });
  return {
    lockReticle() {
      reticleLocked = true;
    },
    unlockReticle() {
      reticleLocked = false;
    },
    isActive() {
      return active;
    },
  };
})();
