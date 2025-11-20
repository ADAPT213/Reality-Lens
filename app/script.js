let xrSession = null;
let xrRefSpace = null;
let hitTestSource = null;

const statusEl = () => document.getElementById("status");

function setStatus(msg){ if (statusEl()) statusEl().innerText = msg; }

async function checkXR() {
  if (!navigator.xr) {
    alert("WebXR not supported");
    return false;
  }
  const isSupported = await navigator.xr.isSessionSupported?.("immersive-ar").catch(()=>false);
  if (!isSupported) {
    alert("AR session not supported");
    return false;
  }
  return true;
}

document.getElementById("startAR").addEventListener("click", async () => {
    if (!(await checkXR())) return;

    try {
        xrSession = await navigator.xr.requestSession("immersive-ar", {
            requiredFeatures: ["hit-test", "dom-overlay"],
            domOverlay: { root: document.body }
        });

        document.getElementById("startAR").style.display = "none";

        const glCanvas = document.createElement("canvas");
        const gl = glCanvas.getContext("webgl", { xrCompatible: true });

        const xrLayer = new XRWebGLLayer(xrSession, gl);
        xrSession.updateRenderState({ baseLayer: xrLayer });

        xrRefSpace = await xrSession.requestReferenceSpace("local");

        const viewerSpace = await xrSession.requestReferenceSpace("viewer");
        hitTestSource = await xrSession.requestHitTestSource({ space: viewerSpace });

        xrSession.requestAnimationFrame(onXRFrame);
        setStatus("Session started — move phone to find planes.");

    } catch (err) {
        alert("Failed to start AR: " + err);
    }
});

function onXRFrame(t, frame) {
    let session = frame.session;
    session.requestAnimationFrame(onXRFrame);

    const pose = frame.getViewerPose(xrRefSpace);
    if (!pose) return;

    const hits = frame.getHitTestResults(hitTestSource);
    if (hits.length > 0) {
        const hit = hits[0];
        const p = hit.getPose(xrRefSpace);
        if (p && p.transform && p.transform.position) {
          setStatus(`Hit @ x:${p.transform.position.x.toFixed(2)} y:${p.transform.position.y.toFixed(2)} z:${p.transform.position.z.toFixed(2)}`);
        }
    }
}
