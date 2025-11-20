// Unity Cloud WebSocket Integration
const UNITY_WS_CONFIG = {
  endpoint: 'wss://cloud-build-api.unity3d.com/realtime',
  project_id: 'reality-lens-ar-warehouse',
  api_key: 'unity-cloud-api-key'
};

// Primary WebSocket for Unity Cloud
const unityWS = new WebSocket(UNITY_WS_CONFIG.endpoint);

// Backup WebSocket for local dashboard
const localWS = new WebSocket("ws://localhost:8088/ws");

// Unity Cloud message handler
unityWS.onopen = function() {
  console.log('Connected to Unity Cloud Build');
  sendUnityAuth();
};

unityWS.onmessage = function(event) {
  const data = JSON.parse(event.data);
  handleUnityCloudMessage(data);
};

unityWS.onerror = function(error) {
  console.log('Unity Cloud WebSocket error:', error);
};

// Local dashboard fallback
localWS.onopen = function() {
  console.log('Connected to local dashboard');
};

function sendUnityAuth() {
  unityWS.send(JSON.stringify({
    type: 'authenticate',
    project_id: UNITY_WS_CONFIG.project_id,
    api_key: UNITY_WS_CONFIG.api_key
  }));
}

function handleUnityCloudMessage(data) {
  switch(data.type) {
    case 'build_complete':
      console.log('Unity build completed:', data.build_id);
      broadcastToLocal(data);
      break;
    case 'model_update':
      console.log('3D model updated in Unity Cloud');
      broadcastToLocal(data);
      break;
    case 'session_data':
      console.log('AR session data from Unity:', data);
      break;
  }
}

function broadcastPlacement(x, y, z) {
  const placementData = {
    type: "placement",
    position: { x, y, z },
    timestamp: new Date().toISOString(),
    device: "Samsung Galaxy S24 Ultra"
  };
  
  // Send to Unity Cloud
  if (unityWS.readyState === WebSocket.OPEN) {
    unityWS.send(JSON.stringify(placementData));
  }
  
  // Send to local dashboard as backup
  if (localWS.readyState === WebSocket.OPEN) {
    localWS.send(JSON.stringify(placementData));
  }
}

function broadcastToLocal(data) {
  if (localWS.readyState === WebSocket.OPEN) {
    localWS.send(JSON.stringify(data));
  }
}

// Sync Unity Cloud build status
function syncUnityBuildStatus() {
  unityWS.send(JSON.stringify({
    type: 'get_build_status',
    project_id: UNITY_WS_CONFIG.project_id
  }));
}

// Auto-sync every 30 seconds
setInterval(syncUnityBuildStatus, 30000);