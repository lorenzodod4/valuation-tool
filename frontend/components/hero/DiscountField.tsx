"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE_NS from "three";
import {
  BASE_WACC,
  BREATH_PERIOD_S,
  WACC_SWING,
  fieldColumns,
  type FieldColumn,
} from "@/components/hero/discountFieldModel";

interface DiscountFieldProps {
  /** Element whose textContent shows the live discount rate (no re-renders). */
  rateLabelRef?: React.RefObject<HTMLElement | null>;
  onReady?: () => void;
}

const PLATE_H = 0.075;
const PLATE_GAP = 0.03;
const PLATE_STEP = PLATE_H + PLATE_GAP;
const COL_W = 0.58;
const BUILD_S = 1.4;

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * "Discount Field": each column is one year of projected free cash flow.
 * The wire outline is the nominal amount; the solid stack of plates is what
 * that cash is worth today. The gap between them is discounting — it widens
 * with time and breathes as the discount rate moves.
 */
export function DiscountField({ rateLabelRef, onReady }: DiscountFieldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !webglAvailable()) {
      setFailed(true);
      return;
    }

    let disposed = false;
    let cleanup: (() => void) | undefined;

    import("three").then((THREE) => {
      if (disposed) return;
      cleanup = mountScene(THREE, host, { rateLabelRef, onReady });
    }).catch(() => setFailed(true));

    return () => {
      disposed = true;
      cleanup?.();
    };
    // Mount once; the scene manages its own lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) return null;
  return <div ref={hostRef} className="discount-field-canvas" aria-hidden="true" />;
}

function mountScene(
  THREE: typeof THREE_NS,
  host: HTMLDivElement,
  opts: Pick<DiscountFieldProps, "rateLabelRef" | "onReady">,
): () => void {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = window.matchMedia("(max-width: 720px)").matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const target = new THREE.Vector3(0.15, 0.95, -1.4);

  // ---- Lights: soft key, cool rim, ambient fill ----
  const hemi = new THREE.HemisphereLight(0xffffff, 0x223044, 0.9);
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(5, 8, 6);
  const rim = new THREE.DirectionalLight(0x9db0ff, 1.4);
  rim.position.set(-6, 3, -6);
  scene.add(hemi, key, rim);

  // ---- Layout ----
  const columns0 = fieldColumns(BASE_WACC);
  const positions = columns0.map((c, i) => {
    const step = i + (c.isTerminal ? 0.55 : 0);
    return new THREE.Vector3(-2.6 + step * 1.05, 0, 0.9 - step * 0.62);
  });
  const maxPlates = columns0.map((c) => Math.ceil((c.nominal * 1.15) / PLATE_STEP) + 1);

  // ---- Materials (colours pulled from CSS tokens; refreshed on theme change) ----
  const coreMat = new THREE.MeshStandardMaterial({ metalness: 0.35, roughness: 0.32 });
  const terminalMat = new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.28 });
  const ghostLineMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 });
  const ghostFillMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.05, depthWrite: false });
  const curveMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.9 });
  const nominalCurveMat = new THREE.LineDashedMaterial({ transparent: true, opacity: 0.5, dashSize: 0.08, gapSize: 0.06 });
  const floorMat = new THREE.PointsMaterial({ size: small ? 0.028 : 0.022, transparent: true, opacity: 0.55, sizeAttenuation: true });

  function applyTheme() {
    const signal = new THREE.Color(cssVar("--signal", "#5b7bf5"));
    const ink3 = new THREE.Color(cssVar("--ink-3", "#868c97"));
    const ink4 = new THREE.Color(cssVar("--ink-4", "#5f6570"));
    const dark = document.documentElement.getAttribute("data-theme") === "dark" ||
      (document.documentElement.getAttribute("data-theme") !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    coreMat.color = signal;
    coreMat.emissive = signal.clone().multiplyScalar(dark ? 0.16 : 0.04);
    terminalMat.color = dark ? ink3.clone().lerp(signal, 0.25) : ink3.clone().lerp(signal, 0.45);
    terminalMat.emissive = signal.clone().multiplyScalar(dark ? 0.08 : 0.0);
    ghostLineMat.color = ink3;
    ghostFillMat.color = ink3;
    curveMat.color = signal;
    nominalCurveMat.color = ink3;
    floorMat.color = ink4;
    hemi.intensity = dark ? 0.75 : 1.25;
    rim.intensity = dark ? 1.6 : 0.6;
  }
  applyTheme();

  // ---- Present-value plates (one instanced mesh per material) ----
  const plateGeo = new THREE.BoxGeometry(COL_W, PLATE_H, COL_W);
  const yearPlateCount = maxPlates.slice(0, -1).reduce((a, b) => a + b, 0);
  const yearPlates = new THREE.InstancedMesh(plateGeo, coreMat, yearPlateCount);
  const tvPlates = new THREE.InstancedMesh(plateGeo, terminalMat, maxPlates[maxPlates.length - 1]);
  yearPlates.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tvPlates.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(yearPlates, tvPlates);

  // ---- Nominal ghosts ----
  const unitBox = new THREE.BoxGeometry(COL_W + 0.06, 1, COL_W + 0.06);
  unitBox.translate(0, 0.5, 0);
  const unitEdges = new THREE.EdgesGeometry(unitBox);
  const ghosts = columns0.map((c, i) => {
    const group = new THREE.Group();
    const lines = new THREE.LineSegments(unitEdges, ghostLineMat);
    const fill = new THREE.Mesh(unitBox, ghostFillMat);
    group.add(lines, fill);
    group.position.copy(positions[i]);
    group.scale.set(1, Math.max(c.nominal, 0.001), 1);
    scene.add(group);
    return group;
  });

  // ---- PV and nominal curves across the year tops ----
  const yearCount = columns0.length - 1;
  const curveGeo = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 64 }, () => new THREE.Vector3()),
  );
  const nominalGeo = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 64 }, () => new THREE.Vector3()),
  );
  const pvCurve = new THREE.Line(curveGeo, curveMat);
  const nominalCurve = new THREE.Line(nominalGeo, nominalCurveMat);
  scene.add(pvCurve, nominalCurve);

  function updateCurve(geo: THREE_NS.BufferGeometry, heights: number[], lift: number) {
    const pts = heights.slice(0, yearCount).map((h, i) =>
      new THREE.Vector3(positions[i].x, h + lift, positions[i].z),
    );
    const spline = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const sampled = spline.getPoints(63);
    const attr = geo.getAttribute("position") as THREE_NS.BufferAttribute;
    sampled.forEach((p, k) => attr.setXYZ(k, p.x, p.y, p.z));
    attr.needsUpdate = true;
    geo.computeBoundingSphere();
  }

  // ---- Floor: a receding dot lattice ----
  const floorPts: number[] = [];
  for (let x = -9; x <= 9; x += 0.42) {
    for (let z = -10; z <= 5; z += 0.42) {
      floorPts.push(x, 0, z);
    }
  }
  const floorGeo = new THREE.BufferGeometry();
  floorGeo.setAttribute("position", new THREE.Float32BufferAttribute(floorPts, 3));
  const floor = new THREE.Points(floorGeo, floorMat);
  floor.position.y = -0.02;
  scene.add(floor);

  // ---- Frame update ----
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();

  function layout(columns: FieldColumn[], build: number) {
    let yi = 0;
    let ti = 0;
    columns.forEach((c, i) => {
      const reveal = Math.min(1, Math.max(0, build * (columns.length + 2) - i));
      const present = Math.max(0, c.present) * easeOut(reveal);
      ghosts[i].scale.y = Math.max(0.001, c.nominal * easeOut(Math.min(1, reveal * 1.4)));
      for (let k = 0; k < maxPlates[i]; k += 1) {
        const bottom = k * PLATE_STEP;
        const fill = Math.min(1, Math.max(0, (present - bottom) / PLATE_H));
        p.set(positions[i].x, bottom + (PLATE_H * fill) / 2 + 0.002, positions[i].z);
        if (fill <= 0) s.set(0, 0, 0);
        else s.set(1, fill, 1);
        m.compose(p, q, s);
        if (c.isTerminal) tvPlates.setMatrixAt(ti++, m);
        else yearPlates.setMatrixAt(yi++, m);
      }
    });
    yearPlates.instanceMatrix.needsUpdate = true;
    tvPlates.instanceMatrix.needsUpdate = true;
    const k = easeOut(Math.min(1, build * 1.2));
    updateCurve(curveGeo, columns.map((c) => c.present * k), 0.06);
    updateCurve(nominalGeo, columns.map((c) => c.nominal * k), 0.06);
    nominalCurve.computeLineDistances();
  }

  // ---- Sizing ----
  const baseCam = new THREE.Vector3(7, 4.8, 8);
  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Pull back on narrow aspect ratios so the whole field stays in frame.
    const dist = camera.aspect < 1 ? 14 : camera.aspect < 1.3 ? 11.5 : 10.2;
    baseCam.set(dist * 0.62, dist * 0.42, dist * 0.68);
    // Portrait framing: nudge the aim toward the terminal tower so it stays in frame.
    target.x = camera.aspect < 1 ? 0.55 : 0.15;
    camera.updateProjectionMatrix();
  }

  // ---- Interaction: gentle pointer parallax ----
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  function onPointer(e: PointerEvent) {
    const r = host.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  }

  // ---- Loop with visibility gating ----
  let visible = true;
  let raf = 0;
  let start = performance.now();
  let lastRateText = "";
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !reduceMotion) loop();
  });
  io.observe(host);

  function frame(now: number) {
    const t = (now - start) / 1000;
    const build = reduceMotion ? 1 : Math.min(1, t / BUILD_S);
    const wacc = reduceMotion
      ? BASE_WACC
      : BASE_WACC + (WACC_SWING / 2) * Math.sin(Math.max(0, t - BUILD_S) * ((2 * Math.PI) / BREATH_PERIOD_S));
    layout(fieldColumns(wacc), build);

    const label = opts.rateLabelRef?.current;
    if (label) {
      const text = `${(wacc * 100).toFixed(2)}%`;
      if (text !== lastRateText) {
        label.textContent = text;
        lastRateText = text;
      }
    }

    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    const sway = reduceMotion ? 0 : Math.sin(t * 0.12) * 0.25;
    camera.position.set(
      baseCam.x + pointer.x * 0.9 + sway,
      baseCam.y - pointer.y * 0.5,
      baseCam.z - pointer.x * 0.5,
    );
    camera.lookAt(target);
    renderer.render(scene, camera);
  }

  function loop() {
    cancelAnimationFrame(raf);
    const tick = (now: number) => {
      if (!visible || document.hidden) return;
      frame(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  const ro = new ResizeObserver(() => {
    resize();
    if (reduceMotion) frame(performance.now());
  });
  ro.observe(host);
  resize();

  const themeObserver = new MutationObserver(() => {
    applyTheme();
    if (reduceMotion) frame(performance.now());
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onMedia = () => {
    applyTheme();
    if (reduceMotion) frame(performance.now());
  };
  media.addEventListener("change", onMedia);
  const onVisibility = () => {
    if (!document.hidden && !reduceMotion) loop();
  };
  document.addEventListener("visibilitychange", onVisibility);

  if (reduceMotion) {
    frame(performance.now());
  } else {
    window.addEventListener("pointermove", onPointer, { passive: true });
    start = performance.now();
    loop();
  }
  requestAnimationFrame(() => {
    host.dataset.ready = "true";
    opts.onReady?.();
  });

  return () => {
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    themeObserver.disconnect();
    media.removeEventListener("change", onMedia);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pointermove", onPointer);
    [plateGeo, unitBox, unitEdges, curveGeo, nominalGeo, floorGeo].forEach((g) => g.dispose());
    [coreMat, terminalMat, ghostLineMat, ghostFillMat, curveMat, nominalCurveMat, floorMat].forEach((mat) => mat.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  };
}

function easeOut(x: number): number {
  return 1 - (1 - x) ** 3;
}
