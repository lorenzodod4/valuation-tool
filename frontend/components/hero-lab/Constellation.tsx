"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE_NS from "three";

/**
 * Concept A — "Costellazione", in three acts:
 *   01 Market — thousands of points form a slowly turning sphere (every company);
 *   02 Price  — they fall into a candlestick chart of one stock, with the last
 *               price drawn as a horizontal line;
 *   03 Value  — the candles collapse into a football field of valuation ranges
 *               and the price line pivots into the vertical market-price marker.
 * The cursor parts the particles; the stepper jumps between acts.
 */

export const ACTS = ["Market", "Price", "Value"] as const;

const ROWS = [
  { label: "DCF", y: 1.05, lo: -1.35, hi: 0.35 },
  { label: "P/E", y: 0.35, lo: -0.75, hi: 0.95 },
  { label: "EV/EBITDA", y: -0.35, lo: -0.6, hi: 1.55 },
  { label: "EV/Sales", y: -1.05, lo: -1.0, hi: 1.35 },
];
const PRICE_X = 0.25;
const CANDLES = 26;
const CHART_W = 3.2;

// Deterministic price path (illustrative): open/high/low/close per candle.
function candleSeries() {
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out: Array<{ o: number; h: number; l: number; c: number }> = [];
  let price = 100;
  for (let i = 0; i < CANDLES; i++) {
    const o = price;
    const c = o * (1 + (rnd() - 0.44) * 0.075);
    const h = Math.max(o, c) * (1 + rnd() * 0.025);
    const l = Math.min(o, c) * (1 - rnd() * 0.025);
    out.push({ o, h, l, c });
    price = c;
  }
  const min = Math.min(...out.map((d) => d.l));
  const max = Math.max(...out.map((d) => d.h));
  const y = (v: number) => -1.25 + ((v - min) / (max - min)) * 2.5;
  return out.map((d) => ({ o: y(d.o), h: y(d.h), l: y(d.l), c: y(d.c), up: d.c >= d.o }));
}

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uStage;
  uniform vec3 uMouse;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute vec3 aChart;
  attribute vec3 aField;
  attribute float aRand;
  attribute float aKind;   // 1 = price-line particle
  attribute float aCandle; // 1 up, -1 down, 0 none
  varying float vAlpha;
  varying float vKind;
  varying float vRand;
  varying float vCandle;

  float stepMix(float s, float i) {
    float delay = aRand * 0.35;
    return smoothstep(delay, delay + 0.65, clamp(s - i, 0.0, 1.0));
  }

  void main() {
    float a = stepMix(uStage, 0.0);
    float b = stepMix(uStage, 1.0);
    vec3 p = mix(mix(position, aChart, a), aField, b);
    float settled = max(a, b);
    vec3 drift = vec3(
      sin(uTime * 0.6 + aRand * 31.0),
      cos(uTime * 0.5 + aRand * 17.0),
      sin(uTime * 0.4 + aRand * 11.0)
    ) * 0.035 * (1.0 - settled * 0.85);
    p += drift;

    vec4 world = modelMatrix * vec4(p, 1.0);
    vec3 d = world.xyz - uMouse;
    float push = smoothstep(0.85, 0.0, length(d)) * 0.45;
    world.xyz += normalize(d + 1e-4) * push;

    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    float size = uSize * (0.55 + aRand * 0.9) * (aKind > 0.5 ? 1.35 : 1.0);
    gl_PointSize = size * uPixelRatio * (6.0 / -mv.z);
    vAlpha = 0.35 + 0.65 * (1.0 - smoothstep(4.0, 11.0, -mv.z));
    vKind = aKind;
    vRand = aRand;
    // Candle colour only while the chart is on screen.
    vCandle = aCandle * a * (1.0 - b);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorPrice;
  uniform vec3 uUp;
  uniform vec3 uDown;
  uniform float uStage;
  varying float vAlpha;
  varying float vKind;
  varying float vRand;
  varying float vCandle;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.0, length(c));
    a = pow(a, 1.6) * 1.35;
    vec3 col = mix(uColorA, uColorB, step(0.965, vRand));
    col = mix(col, vec3(1.0), 0.18 * step(0.5, fract(vRand * 7.0)));
    col = mix(col, uUp, max(vCandle, 0.0));
    col = mix(col, uDown, max(-vCandle, 0.0));
    col = mix(col, uColorPrice, vKind * smoothstep(0.4, 1.0, uStage));
    gl_FragColor = vec4(col, a * vAlpha);
  }
`;

function cssColor(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

interface Controller {
  goTo: (act: number) => void;
}

export function Constellation() {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const ctrl = useRef<Controller | null>(null);
  const [act, setAct] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cleanup: (() => void) | undefined;
    let disposed = false;
    import("three").then((THREE) => {
      if (disposed) return;
      const m = mount(THREE, host, labelsRef.current, setAct);
      ctrl.current = m;
      cleanup = m.dispose;
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <div className="constellation">
      <div ref={hostRef} className="constellation-canvas" aria-hidden="true" />
      <div ref={labelsRef} className="constellation-labels" aria-hidden="true">
        {ROWS.map((r) => (
          <span key={r.label} data-label={r.label} data-act="2">{r.label}</span>
        ))}
        <span data-label="price" data-act="2" className="is-price">Market price</span>
        <span data-label="last" data-act="1" className="is-last">Last price</span>
        <span data-label="chart" data-act="1" className="is-caption">Share price · 2 years</span>
      </div>
      <div className="constellation-stepper" role="group" aria-label="Animation stages">
        {ACTS.map((name, i) => (
          <button
            key={name}
            type="button"
            aria-pressed={act === i}
            className={act === i ? "is-active" : undefined}
            onClick={() => ctrl.current?.goTo(i)}
          >
            <span className="num">0{i + 1}</span> {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function mount(
  THREE: typeof THREE_NS,
  host: HTMLDivElement,
  labels: HTMLDivElement | null,
  onAct: (act: number) => void,
) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = window.matchMedia("(max-width: 720px)").matches;
  const N = small ? 4200 : 11000;

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, 0, 7.2);

  // ---------------- particle states ----------------
  const candles = candleSeries();
  const lastClose = candles[candles.length - 1].c;
  const candleX = (i: number) => -CHART_W / 2 + (i + 0.5) * (CHART_W / CANDLES);
  const bodyH = candles.map((d) => Math.max(Math.abs(d.c - d.o), 0.03));
  const bodyTotal = bodyH.reduce((a, b) => a + b, 0);
  const pick = (r: number) => {
    let acc = 0;
    for (let i = 0; i < CANDLES; i++) {
      acc += bodyH[i] / bodyTotal;
      if (r <= acc) return i;
    }
    return CANDLES - 1;
  };

  const sphere = new Float32Array(N * 3);
  const chart = new Float32Array(N * 3);
  const field = new Float32Array(N * 3);
  const rand = new Float32Array(N);
  const kind = new Float32Array(N);
  const candleAttr = new Float32Array(N);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const priceCount = Math.floor(N * 0.06);
  const wickCount = Math.floor(N * 0.14);

  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    const shell = Math.random() < 0.78 ? 1.6 : 1.6 * Math.cbrt(Math.random());
    sphere.set([Math.cos(th) * rad * shell, y * shell, Math.sin(th) * rad * shell], i * 3);
    rand[i] = Math.random();
    const jz = (Math.random() - 0.5) * 0.12;

    if (i < priceCount) {
      // Price line: horizontal at the last close (act 2), vertical marker (act 3).
      kind[i] = 1;
      const t = Math.random();
      chart.set([-CHART_W / 2 + t * (CHART_W + 0.15), lastClose + (Math.random() - 0.5) * 0.015, jz * 0.2], i * 3);
      field.set([PRICE_X + (Math.random() - 0.5) * 0.02, (t - 0.5) * 3.0, jz * 0.2], i * 3);
    } else {
      const row = ROWS[i % ROWS.length];
      field.set(
        [row.lo + (row.hi - row.lo) * Math.random(), row.y + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.18],
        i * 3,
      );
      if (i < priceCount + wickCount) {
        const k = i % CANDLES;
        const d = candles[k];
        chart.set([candleX(k) + (Math.random() - 0.5) * 0.012, d.l + Math.random() * (d.h - d.l), jz * 0.4], i * 3);
        candleAttr[i] = d.up ? 1 : -1;
      } else {
        const k = pick(Math.random());
        const d = candles[k];
        const lo = Math.min(d.o, d.c);
        const w = (CHART_W / CANDLES) * 0.62;
        chart.set([candleX(k) + (Math.random() - 0.5) * w, lo + Math.random() * bodyH[k], jz], i * 3);
        candleAttr[i] = d.up ? 1 : -1;
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(sphere, 3));
  geo.setAttribute("aChart", new THREE.BufferAttribute(chart, 3));
  geo.setAttribute("aField", new THREE.BufferAttribute(field, 3));
  geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
  geo.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
  geo.setAttribute("aCandle", new THREE.BufferAttribute(candleAttr, 1));

  const uniforms = {
    uTime: { value: 0 },
    uStage: { value: 0 },
    uMouse: { value: new THREE.Vector3(99, 99, 99) },
    uSize: { value: small ? 3.4 : 3.0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uColorA: { value: new THREE.Color() },
    uColorB: { value: new THREE.Color() },
    uColorPrice: { value: new THREE.Color() },
    uUp: { value: new THREE.Color() },
    uDown: { value: new THREE.Color() },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const isDark = () =>
    document.documentElement.getAttribute("data-theme") === "dark" ||
    (document.documentElement.getAttribute("data-theme") !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const theme = () => {
    // Additive glow reads on graphite; on paper it would wash out.
    mat.blending = isDark() ? THREE.AdditiveBlending : THREE.NormalBlending;
    mat.needsUpdate = true;
    uniforms.uColorA.value.set(cssColor("--signal", "#5b7bf5"));
    uniforms.uColorB.value.set(cssColor("--series-2", "#da6a31"));
    uniforms.uColorPrice.value.set(cssColor("--ink", "#eef0f3"));
    uniforms.uUp.value.set(cssColor("--pos", "#3fbf8c"));
    uniforms.uDown.value.set(cssColor("--neg", "#f0776c"));
  };
  theme();
  const group = new THREE.Group();
  group.add(new THREE.Points(geo, mat));
  scene.add(group);

  // ---------------- pointer → world (z = 0 plane) ----------------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  let pointerInside = false;
  const onMove = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    pointerInside = Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1;
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = camera.aspect < 1 ? 7.9 : 7.2;
    group.position.x = camera.aspect > 1.3 ? 1.55 : 0;
    group.position.y = 0;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // ---------------- timeline ----------------
  // Each act holds, then morphs to the next; Value morphs back to Market.
  const HOLD = 3.4;
  const MORPH = 1.8;
  const SEG = HOLD + MORPH;
  const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  let clock = 0; // seconds along the 3-act cycle
  let last = performance.now();
  let stage = 0; // 0..2 continuous

  const stageAt = (t: number) => {
    const c = t % (3 * SEG);
    const k = Math.floor(c / SEG);
    const u = c - k * SEG;
    const m = u < HOLD ? 0 : ease((u - HOLD) / MORPH);
    if (k < 2) return k + m; // Market→Price, Price→Value
    return 2 * (1 - m); // Value→Market (straight back)
  };

  const v = new THREE.Vector3();
  const anchors = labels ? Array.from(labels.querySelectorAll<HTMLElement>("[data-label]")) : [];
  const placeLabels = (s: number) => {
    if (!labels) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    anchors.forEach((el) => {
      const key = el.dataset.label;
      const actIdx = Number(el.dataset.act);
      if (key === "price") v.set(PRICE_X, 1.65, 0);
      else if (key === "last") {
        // Narrow screens: sit above the line's end instead of beside it.
        const narrow = w < 560;
        v.set(narrow ? CHART_W / 2 : CHART_W / 2 + 0.22, narrow ? lastClose + 0.2 : lastClose, 0);
        el.style.translate = narrow ? "-100% -100%" : "0 -50%";
      }
      else if (key === "chart") v.set(-CHART_W / 2, 1.55, 0);
      else {
        const row = ROWS.find((r) => r.label === key);
        if (!row) return;
        v.set(row.lo - 0.12, row.y, 0);
      }
      v.applyMatrix4(group.matrixWorld).project(camera);
      el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
      el.style.opacity = String(Math.max(0, 1 - Math.abs(s - actIdx) / 0.25));
    });
  };

  let raf = 0;
  let visible = true;
  let reportedAct = -1;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) loop();
  });
  io.observe(host);

  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!reduce) clock += dt;
    const target = reduce ? 2 : stageAt(clock);
    stage += (target - stage) * Math.min(1, dt * 6); // smooths jumps from the stepper
    uniforms.uTime.value += dt;
    uniforms.uStage.value = stage;

    const sphereness = Math.max(0, 1 - stage);
    group.rotation.y = sphereness * (uniforms.uTime.value * 0.18);
    group.rotation.x = sphereness * 0.25;
    if (pointerInside) {
      ray.setFromCamera(ndc, camera);
      if (ray.ray.intersectPlane(plane, hit)) uniforms.uMouse.value.copy(hit);
    } else uniforms.uMouse.value.set(99, 99, 99);
    group.updateMatrixWorld();
    placeLabels(stage);

    const actNow = Math.round(stage);
    if (actNow !== reportedAct) {
      reportedAct = actNow;
      onAct(actNow);
    }
    renderer.render(scene, camera);
  };
  const loop = () => {
    cancelAnimationFrame(raf);
    last = performance.now();
    const tick = (now: number) => {
      if (!visible || document.hidden) return;
      frame(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  if (reduce) {
    stage = 2;
    frame(performance.now());
  } else loop();

  const mo = new MutationObserver(() => {
    theme();
    if (reduce) frame(performance.now());
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  return {
    /** Jump to an act: start that act's hold on the shared clock. */
    goTo(act: number) {
      clock = act * SEG + 0.01;
      if (reduce) {
        stage = act;
        frame(performance.now());
      }
    },
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("pointermove", onMove);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
