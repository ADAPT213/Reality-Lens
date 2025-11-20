// Unity Cloud Integration
const UNITY_CONFIG = {
  PROJECT_ID: 'reality-lens-ar-warehouse',
  API_ENDPOINT: 'https://cloud-build-api.unity3d.com/api/v1',
  WEBSOCKET_URL: 'wss://realtime.unity.com/ws'
};

// WebSocket connection to Unity Cloud
let unitySocket = null;

function connectUnityCloud() {
  try {
    unitySocket = new WebSocket(UNITY_CONFIG.WEBSOCKET_URL);
    unitySocket.onopen = () => {
      console.log('Connected to Unity Cloud');
      sendToUnity({ type: 'session_start', device: 'Samsung Galaxy S24 Ultra' });
    };
    unitySocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleUnityMessage(data);
    };
  } catch (error) {
    console.log('Unity Cloud connection failed:', error);
  }
}

function sendToUnity(data) {
  if (unitySocket && unitySocket.readyState === WebSocket.OPEN) {
    unitySocket.send(JSON.stringify(data));
  }
}

function handleUnityMessage(data) {
  switch(data.type) {
    case 'model_sync':
      console.log('Unity models synchronized');
      break;
    case 'placement_update':
      console.log('Object placement synced to Unity');
      break;
  }
}

function placeObject() {
  const marker = document.querySelector("#marker");
  const cube = document.querySelector("#cube");
  cube.setAttribute("visible", "true");
  
  // Send placement data to Unity Cloud
  const position = cube.getAttribute('position');
  sendToUnity({
    type: 'object_placed',
    object_id: 'pick_face_cube',
    position: position,
    timestamp: new Date().toISOString()
  });
}

function clearObjects() {
  const cube = document.querySelector("#cube");
  cube.setAttribute("visible", "false");
  
  // Notify Unity Cloud of cleared objects
  sendToUnity({
    type: 'objects_cleared',
    timestamp: new Date().toISOString()
  });
}

function scanQR() {
  window.location.href = "https://adapt213.github.io/Reality-Lens/qr-scan";
}

function openDashboard() {
  window.open("unity-dashboard.html", "_blank");
}

// Initialize Unity Cloud connection on load
window.addEventListener('load', () => {
  console.log('RealityLens AR initializing...');
  connectUnityCloud();
  
  // Send device info to Unity Cloud
  setTimeout(() => {
    sendToUnity({
      type: 'device_info',
      device: 'Samsung Galaxy S24 Ultra',
      browser: navigator.userAgent,
      ar_support: 'WebXR'
    });
  }, 2000);
});