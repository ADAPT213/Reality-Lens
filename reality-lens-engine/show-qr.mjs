import qrcode from "qrcode-terminal";
import os from "os";

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4 addresses
      const familyV4Value = typeof net.family === "string" ? "IPv4" : 4;
      if (net.family === familyV4Value && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

const ip = getLocalIP();
const port = "5173";
const url = `http://${ip}:${port}`;

console.log("\n🎯 Reality Lens Engine - Network Access\n");
console.log(`📱 Phone Access: ${url}`);
console.log(`💻 Local Access: http://localhost:${port}\n`);
console.log("📲 Scan QR code with your phone:\n");

qrcode.generate(url, { small: true });

console.log("\n✨ Make sure your phone is on the same WiFi network!\n");
console.log(`Primary IP: ${ip}`);
