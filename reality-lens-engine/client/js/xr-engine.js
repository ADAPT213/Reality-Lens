// Phase 7 desktop fallback & minimal engine loop
(function () {
  if (!navigator.xr) {
    const status = document.getElementById("status");
    status.textContent = "Simulator Mode";
    const canvas = document.getElementById("xr-canvas");
    const ctx = canvas.getContext("2d");
    let nodes = [];
    let cam = { x: 0, y: 0 };
    function draw() {
      canvas.width = innerWidth;
      canvas.height = innerHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0f0";
      nodes.forEach((n) =>
        ctx.fillRect(n.x - 5 - cam.x, n.y - 5 - cam.y, 10, 10),
      );
      requestAnimationFrame(draw);
    }
    draw();
    window.addEventListener("click", (e) => {
      nodes.push({ x: e.clientX + cam.x, y: e.clientY + cam.y });
      document.getElementById("nodeCount").textContent =
        "Nodes: " + nodes.length;
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "w") cam.y -= 10;
      if (e.key === "s") cam.y += 10;
      if (e.key === "a") cam.x -= 10;
      if (e.key === "d") cam.x += 10;
    });
    const dbg = document.createElement("div");
    Object.assign(dbg.style, {
      position: "fixed",
      bottom: "0",
      left: "0",
      background: "rgba(0,0,0,0.5)",
      color: "#fff",
      padding: "4px",
      font: "10px monospace",
    });
    dbg.textContent = "Desktop Fallback Active";
    document.body.appendChild(dbg);
  }
})();
