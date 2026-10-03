"use client";

import { useEffect, useRef } from "react";
import type * as THREE_NS from "three";

/**
 * Concept B — "Prisma". A faceted glass crystal (real transmission with
 * chromatic dispersion) floats over a live market tape. What passes through it
 * splits into separate lines: one price, several valuations.
 */
export function Prism() {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cleanup: (() => void) | undefined;
    let disposed = false;
    Promise.all([import("three"), import("three/examples/jsm/environments/RoomEnvironment.js")]).then(
      ([THREE, env]) => {
        if (!disposed) cleanup = mount(THREE, host, new env.RoomEnvironment());
      },
    );
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);
  return <div ref={hostRef} className="prism-canvas" aria-hidden="true" />;
}

function cssColor(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** A dark studio with three soft-box panels: crisp highlights on glass. */
function studio(THREE: typeof THREE_NS): THREE_NS.Scene {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x05070a);
  const panel = (w: number, h: number, intensity: number, pos: [number, number, number], color = 0xffffff) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(6, 2, 4, [0, 6, 2]); // top strip
  panel(2, 8, 2.2, [-7, 0, 3]); // left soft box
  panel(2, 8, 1.6, [7, 1, -2], 0x9db0ff); // cool rim
  panel(10, 1, 0.9, [0, -6, -4]); // floor bounce
  return env;
}

function mount(THREE: typeof THREE_NS, host: HTMLDivElement, room: THREE_NS.Scene) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = window.matchMedia("(max-width: 720px)").matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  void studio;
  const envTex = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  // --- market tape: a canvas texture behind the crystal ---
  const W = 2048;
  const H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const tape = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 8),
    // Opaque on purpose: transmissive materials only refract opaque objects.
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  tape.position.z = -2.4;
  scene.add(tape);

  // Deterministic random walk so the tape looks like a real series.
  const series = (seed: number, n: number, vol: number, drift: number) => {
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
    const out: number[] = [];
    let v = 0;
    for (let i = 0; i < n; i++) {
      v += drift + rnd() * vol;
      out.push(v);
    }
    return out;
  };
  const LEN = 900;
  const lines = [
    { data: series(7, LEN, 9, 0.35), color: "--signal", width: 5 },
    { data: series(29, LEN, 6, 0.22), color: "--series-3", width: 3 },
    { data: series(113, LEN, 7, 0.15), color: "--series-2", width: 3 },
  ];

  let dark = true;
  const drawTape = (t: number) => {
    const ink3 = cssColor("--ink-3", "#868c97");
    const line = cssColor("--line-strong", "rgba(255,255,255,0.14)");
    ctx.fillStyle = cssColor("--bg", "#0b0d10");
    ctx.fillRect(0, 0, W, H);
    // grid
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x - ((t * 40) % 128), 0);
      ctx.lineTo(x - ((t * 40) % 128), H);
      ctx.stroke();
    }
    for (let y = 64; y < H; y += 128) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    // series, scrolling left
    const offset = (t * 22) % (LEN - 300);
    lines.forEach((l, li) => {
      const slice = l.data.slice(Math.floor(offset), Math.floor(offset) + 300);
      const min = Math.min(...slice);
      const max = Math.max(...slice);
      ctx.strokeStyle = cssColor(l.color, "#5b7bf5");
      ctx.globalAlpha = li === 0 ? 0.9 : 0.7;
      ctx.lineWidth = l.width;
      ctx.lineJoin = "round";
      ctx.beginPath();
      slice.forEach((v, i) => {
        const x = (i / 299) * W;
        const y = H * (0.22 + li * 0.08) + (1 - (v - min) / (max - min || 1)) * H * 0.5;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    // numerals
    ctx.fillStyle = ink3;
    ctx.font = "500 26px 'IBM Plex Mono', ui-monospace, monospace";
    const labels = ["DCF 142.18", "EV/EBITDA 19.3×", "P/E 27.8×", "WACC 9.60%", "g 2.50%", "TV 76%"];
    labels.forEach((s, i) => {
      const x = ((i * 380 - t * 40) % (W + 400) + W + 400) % (W + 400) - 200;
      ctx.fillText(s, x, 60 + (i % 2) * 900);
    });
    tex.needsUpdate = true;
  };

  // --- the crystal ---
  const geo = new THREE.IcosahedronGeometry(1.2, 0);
  geo.scale(1, 1.3, 1);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.02,
    transmission: 1,
    thickness: 2.2,
    ior: 1.75,
    dispersion: 9,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    iridescence: 0.25,
    iridescenceIOR: 1.3,
    envMapIntensity: 0.75,
    specularIntensity: 1,
    flatShading: true,
  });
  const crystal = new THREE.Mesh(geo, glass);
  // Luminous facet edges: the cut of the crystal reads at any angle.
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32 }),
  );
  crystal.add(edges);
  scene.add(crystal);

  // A thin orbit ring for scale and motion.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.35, 0.006, 8, 220),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }),
  );
  ring.rotation.x = Math.PI / 2.25;
  scene.add(ring);

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 4, 5);
  scene.add(key);

  let lastTape = -1;
  const theme = () => {
    dark =
      document.documentElement.getAttribute("data-theme") === "dark" ||
      (document.documentElement.getAttribute("data-theme") !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    (ring.material as THREE_NS.MeshBasicMaterial).color.set(cssColor("--ink-3", "#868c97"));
    glass.attenuationColor = new THREE.Color(cssColor("--signal", "#5b7bf5")).lerp(new THREE.Color(0xffffff), 0.85);
    glass.attenuationDistance = 12;
    (edges.material as THREE_NS.LineBasicMaterial).color.set(dark ? 0xffffff : cssColor("--ink", "#101216"));
    renderer.toneMappingExposure = dark ? 1.0 : 0.9;
    lastTape = -1; // repaint the tape background for the new theme
  };
  theme();

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e: PointerEvent) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = camera.aspect < 1 ? 13 : 9;
    const shift = camera.aspect > 1.3 ? 2.1 : 0;
    crystal.position.set(shift, camera.aspect < 1 ? -1.2 : 0, 0);
    ring.position.copy(crystal.position);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let raf = 0;
  let visible = true;
  const start = performance.now();
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) loop();
  });
  io.observe(host);

  const frame = (now: number) => {
    const t = reduce ? 4 : (now - start) / 1000;
    // Redraw the tape at ~30 fps; it is the expensive part.
    if (t - lastTape > 1 / 30) {
      drawTape(t);
      lastTape = t;
    }
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    crystal.rotation.y = t * 0.22 + pointer.x * 0.5;
    crystal.rotation.x = 0.18 + pointer.y * 0.3;
    crystal.position.y += (Math.sin(t * 0.8) * 0.06 - (crystal.position.y - (camera.aspect < 1 ? -1.2 : 0))) * 0.05;
    ring.rotation.z = t * 0.1;
    renderer.render(scene, camera);
  };
  const loop = () => {
    cancelAnimationFrame(raf);
    const tick = (now: number) => {
      if (!visible || document.hidden) return;
      frame(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  if (reduce) frame(performance.now());
  else loop();

  const mo = new MutationObserver(theme);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    mo.disconnect();
    window.removeEventListener("pointermove", onMove);
    geo.dispose();
    glass.dispose();
    tex.dispose();
    envTex.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
