'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type Spell = 'none' | 'glitch' | 'neon' | 'mono' | 'scanlines';

export default function RealityRPGPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const threeRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cubeRef = useRef<THREE.Mesh | null>(null);
  const ringRef = useRef<THREE.Mesh | null>(null);
  const [ready, setReady] = useState(false);
  const [spell, setSpell] = useState<Spell>('none');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream as any;
          await videoRef.current.play();
        }
      } catch (e: any) {
        setError(e?.message || 'Unable to access camera');
      }
    };
    startCamera();
  }, []);

  useEffect(() => {
    if (!threeRef.current) return;

    const container = threeRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.01, 100);
    camera.position.set(0, 0, 2.5);
    cameraRef.current = camera;

    const light = new THREE.AmbientLight('#ffffff', 0.9);
    scene.add(light);
    const dir = new THREE.DirectionalLight('#ffffff', 0.6);
    dir.position.set(2, 3, 1);
    scene.add(dir);

    // Floating cube (artifact)
    const cubeGeom = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const cubeMat = new THREE.MeshStandardMaterial({ color: '#66ccff', metalness: 0.3, roughness: 0.2, emissive: '#0af', emissiveIntensity: 0.2 });
    const cube = new THREE.Mesh(cubeGeom, cubeMat);
    cube.position.set(0, 0, -0.5);
    scene.add(cube);
    cubeRef.current = cube;

    // Portal ring
    const ringGeom = new THREE.TorusGeometry(0.5, 0.07, 16, 100);
    const ringMat = new THREE.MeshStandardMaterial({ color: '#ff66cc', metalness: 0.4, roughness: 0.1, emissive: '#f0a', emissiveIntensity: 0.3 });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.position.set(0, -0.1, -1.2);
    scene.add(ring);
    ringRef.current = ring;

    const onResize = () => {
      if (!rendererRef.current || !cameraRef.current || !threeRef.current) return;
      const w = threeRef.current.clientWidth;
      const h = threeRef.current.clientHeight;
      rendererRef.current.setSize(w, h);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    let raf = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      if (cubeRef.current) {
        cubeRef.current.rotation.x = t * 0.6;
        cubeRef.current.rotation.y = t * 0.8;
        cubeRef.current.position.y = Math.sin(t) * 0.05;
      }
      if (ringRef.current) {
        ringRef.current.rotation.x = Math.sin(t * 0.5) * 0.2;
        ringRef.current.rotation.z = t * 0.4;
      }
      renderer.render(scene, camera);
    };
    animate();
    setReady(true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const el = threeRef.current;
    if (!el) return;
    // Apply simple post "spells" via CSS for MVP (no heavy postprocessing)
    const base = 'position:absolute; inset:0;';
    switch (spell) {
      case 'glitch':
        el.style.filter = 'contrast(1.2) saturate(1.3) hue-rotate(330deg)';
        el.style.mixBlendMode = 'screen';
        break;
      case 'neon':
        el.style.filter = 'drop-shadow(0 0 6px #0ff) drop-shadow(0 0 10px #f0f) saturate(1.4)';
        el.style.mixBlendMode = 'lighten';
        break;
      case 'mono':
        el.style.filter = 'grayscale(0.95) contrast(1.25)';
        el.style.mixBlendMode = 'normal';
        break;
      case 'scanlines':
        el.style.filter = 'contrast(1.1)';
        el.style.backgroundImage = 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)';
        break;
      default:
        el.style.filter = '';
        el.style.mixBlendMode = 'normal';
        el.style.backgroundImage = '';
    }
  }, [spell]);

  const handleTap = (e: React.MouseEvent) => {
    if (!placing || !threeRef.current || !cameraRef.current || !cubeRef.current) return;
    const rect = threeRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const vec = new THREE.Vector3(x, y, -0.5).unproject(cameraRef.current);
    cubeRef.current.position.copy(vec);
    cubeRef.current.position.z = -0.8; // keep roughly in front
  };

  const takePhoto = () => {
    if (!videoRef.current || !threeRef.current) return;
    const canvas = document.createElement('canvas');
    const w = threeRef.current.clientWidth;
    const h = threeRef.current.clientHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // draw camera frame
    ctx.drawImage(videoRef.current, 0, 0, w, h);
    // draw three canvas on top
    const threeCanvas = threeRef.current.querySelector('canvas');
    if (threeCanvas) ctx.drawImage(threeCanvas as HTMLCanvasElement, 0, 0);
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `reality-hack-${Date.now()}.png`;
    a.click();
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh', background: '#000' }} onClick={handleTap}>
      {/* Camera Layer */}
      <video ref={videoRef} playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />

      {/* 3D Layer */}
      <div ref={threeRef} style={{ position: 'absolute', inset: 0 }} />

      {/* HUD */}
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['none','glitch','neon','mono','scanlines'] as Spell[]).map(s => (
            <button key={s} onClick={() => setSpell(s)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #444', background: spell===s? '#0ea5e9':'#111', color: '#fff' }}>{s}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setPlacing(p => !p)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #444', background: placing? '#22c55e':'#111', color: '#fff' }}>{placing? 'Placing: ON':'Placing: OFF'}</button>
          <button onClick={takePhoto} style={{ padding: '8px 12px', borderRadius: 999, border: '2px solid #fff', background: '#dc2626', color: '#fff', fontWeight: 700 }}>Capture</button>
        </div>
      </div>

      {!ready && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', background: 'rgba(0,0,0,0.4)' }}>
          <div>Initializing Reality Engine…</div>
        </div>
      )}
      {error && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', background: 'rgba(0,0,0,0.6)', padding: 16, textAlign: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Camera access failed</div>
            <div style={{ opacity: 0.8 }}>{error}</div>
            <div style={{ marginTop: 12, opacity: 0.8 }}>Grant camera permission and reload, or use desktop webcam.</div>
          </div>
        </div>
      )}
    </div>
  );
}
