function placeObject() {
  const marker = document.querySelector("#marker");
  const cube = document.querySelector("#cube");
  cube.setAttribute("visible", "true");
}

function clearObjects() {
  const cube = document.querySelector("#cube");
  cube.setAttribute("visible", "false");
}

function scanQR() {
  window.location.href = "https://adapt213.github.io/Reality-Lens/qr-scan";
}

function openDashboard() {
  window.location.href = "http://localhost:8088";
}