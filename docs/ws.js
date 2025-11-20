const ws = new WebSocket("wss://your-dashboard-endpoint/ws");

function broadcastPlacement(x,y,z){
  ws.send(JSON.stringify({
    type:"placement",
    pos:{x,y,z}
  }));
}