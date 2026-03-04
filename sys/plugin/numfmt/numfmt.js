/* ================================================================
 * numfmt.js — format conversion visualizer plugin
 *
 * Usage:
 *   NumFmtViz.create(element, config)
 *
 * Config options:
 *   fmtX        — source format id (default: 'float64')
 *   fmtY        — target format id (default: 'float32')
 *   qX          — Qm.n params for X: { m, n }   (default: {m:3,n:4})
 *   qY          — Qm.n params for Y: { m, n }   (default: {m:3,n:4})
 *   view        — [xMin, xMax, yMin, yMax]       (default: fit to formats)
 *   formats     — array of format ids to show as buttons (default: all)
 *   showIdeal   — show y=x ideal line (default: true)
 *   showSteps   — show quantization levels (default: true)
 *   showRange   — show format boundaries (default: true)
 *   height      — chart height in px (default: 280)
 * ================================================================ */

const NumFmtViz = (() => {

/* ──────────────────────────────────────────────────────────────
 * §1. FORMAT REGISTRY
 * ────────────────────────────────────────────────────────────── */
const FORMAT_REGISTRY = {
  int4: {
    label: 'Int4', desc: '4-бит целое (−8…7)',
    info: '<strong>Int4</strong> — 4-бит целое со знаком.<br>Диапазон: <code>-8</code>…<code>7</code>.',
    range: () => ({ min: -8, max: 7 }),
    fitRange: () => ({ min: -8, max: 7 }),
    convert: v => _clamp(Math.round(v), -8, 7),
    enumerate: (lo, hi) => _intRange(lo, hi, -8, 7),
  },
  int8: {
    label: 'Int8', desc: '8-бит целое (−128…127)',
    info: '<strong>Int8</strong> — 8-бит целое со знаком.<br>Диапазон: <code>-128</code>…<code>127</code>.',
    range: () => ({ min: -128, max: 127 }),
    fitRange: () => ({ min: -128, max: 127 }),
    convert: v => _clamp(Math.round(v), -128, 127),
    enumerate: (lo, hi) => _intRange(lo, hi, -128, 127),
  },
  int16: {
    label: 'Int16', desc: '16-бит целое',
    info: '<strong>Int16</strong> — 16-бит целое со знаком.<br>Диапазон: <code>-32768</code>…<code>32767</code>.',
    range: () => ({ min: -32768, max: 32767 }),
    fitRange: () => ({ min: -32768, max: 32767 }),
    convert: v => _clamp(Math.round(v), -32768, 32767),
    enumerate: (lo, hi, max) => _intRange(lo, hi, -32768, 32767, max),
  },
  uint8: {
    label: 'UInt8', desc: 'Беззнаковое 8-бит (0…255)',
    info: '<strong>UInt8</strong> — беззнаковое 8-бит.<br>Диапазон: <code>0</code>…<code>255</code>.',
    range: () => ({ min: 0, max: 255 }),
    fitRange: () => ({ min: 0, max: 255 }),
    convert: v => _clamp(Math.round(v), 0, 255),
    enumerate: (lo, hi) => _intRange(lo, hi, 0, 255),
  },
  qmn: {
    label: 'Qm.n', desc: 'Фиксированная точка',
    info: '<strong>Qm.n</strong> — фиксированная точка.<br><code>m</code> бит целой + <code>n</code> бит дробной части.',
    range: qp => { const s = 2 ** -qp.n; return { min: -(2 ** qp.m), max: 2 ** qp.m - s }; },
    fitRange: qp => { const s = 2 ** -qp.n; return { min: -(2 ** qp.m), max: 2 ** qp.m - s }; },
    convert: (v, qp) => { const s = 2 ** -qp.n; return _clamp(_roundN(v, s), -(2 ** qp.m), 2 ** qp.m - s); },
    enumerate: (lo, hi, max, qp) => {
      const s = 2 ** -qp.n;
      const minV = -(2 ** qp.m), maxV = 2 ** qp.m - s;
      const vals = [];
      for (let v = Math.max(minV, _roundN(lo, s)); v <= Math.min(maxV, hi); v += s) {
        vals.push(parseFloat(v.toPrecision(12)));
        if (vals.length > max) break;
      }
      return vals;
    },
  },
  fp4e2m1: {
    label: 'FP4 E2M1', desc: '4-бит float (OCP)',
    info: '<strong>FP4 E2M1</strong> — 4-бит float.<br>1 знак + 2 экспонента + 1 мантисса. Макс: ±<code>6</code>.',
    range: () => ({ min: -6, max: 6 }),
    fitRange: () => ({ min: -6, max: 6 }),
    convert: v => {
      if (v === 0) return 0;
      const s = Math.sign(v), a = Math.abs(v);
      const L = [0, .5, 1, 1.5, 2, 3, 4, 6];
      let b = 0, bd = a;
      for (const l of L) { const d = Math.abs(a - l); if (d < bd) { bd = d; b = l; } }
      return s * b;
    },
    enumerate: (lo, hi) => {
      const L = [0, .5, 1, 1.5, 2, 3, 4, 6], out = new Set();
      for (const l of L) {
        if (l >= lo && l <= hi) out.add(l);
        if (-l >= lo && -l <= hi) out.add(-l);
      }
      return [...out].sort((a, b) => a - b);
    },
  },
  fp8e4m3: {
    label: 'FP8 E4M3', desc: 'OCP 8-бит (4+3)',
    info: '<strong>FP8 E4M3</strong> — 8-бит float.<br>4 бита эксп., 3 бита мантиссы. Макс: ±<code>448</code>.',
    range: () => ({ min: -448, max: 448 }),
    fitRange: () => ({ min: -448, max: 448 }),
    convert: v => _convertFPx(v, 448, -9, -6, 3, 8),
  },
  fp8e5m2: {
    label: 'FP8 E5M2', desc: 'OCP 8-бит (5+2)',
    info: '<strong>FP8 E5M2</strong> — 8-бит float.<br>5 бит эксп., 2 бита мантиссы. Макс: ±<code>57344</code>.',
    range: () => ({ min: -57344, max: 57344 }),
    fitRange: () => ({ min: -500, max: 500 }),
    convert: v => _convertFPx(v, 57344, -16, -14, 2, 15),
  },
  float16: {
    label: 'Float16', desc: 'IEEE 754 half (1+5+10)',
    info: '<strong>Float16</strong> — IEEE 754 half.<br>1+5+10 бит. Макс: ±<code>65504</code>.',
    range: () => ({ min: -65504, max: 65504 }),
    fitRange: () => ({ min: -1000, max: 1000 }),
    convert: v => _convertFloat16(v),
  },
  bfloat16: {
    label: 'BFloat16', desc: 'Brain float (1+8+7)',
    info: '<strong>BFloat16</strong> — Brain Float 16.<br>1+8+7 бит. Диапазон ≈ Float32.',
    range: () => ({ min: -3.389e+38, max: 3.389e+38 }),
    fitRange: () => ({ min: -1000, max: 1000 }),
    convert: v => _truncFloat32(v, 0xFFFF0000, 0x00010000, 0x00008000, 0x00007FFF),
  },
  tf32: {
    label: 'TF32', desc: 'NVIDIA TensorFloat (1+8+10)',
    info: '<strong>TF32</strong> — NVIDIA TensorFloat-32.<br>1+8+10 бит. Диапазон как Float32, точность как Float16.',
    range: () => ({ min: -3.4028235e+38, max: 3.4028235e+38 }),
    fitRange: () => ({ min: -1000, max: 1000 }),
    convert: v => _truncFloat32(v, 0xFFFFE000, 0x00002000, 0x00001000, 0x00000FFF),
  },
  float32: {
    label: 'Float32', desc: 'IEEE 754 single (1+8+23)',
    info: '<strong>Float32</strong> — IEEE 754 single.<br>1+8+23 бит. Макс: ±<code>3.4×10³⁸</code>.',
    range: () => ({ min: -3.4028235e+38, max: 3.4028235e+38 }),
    fitRange: () => ({ min: -1000, max: 1000 }),
    convert: v => Math.fround(v),
  },
  float64: {
    label: 'Float64', desc: 'IEEE 754 double (1+11+52)',
    info: '<strong>Float64</strong> — IEEE 754 double.<br>1+11+52 бит. Макс: ±<code>1.8×10³⁰⁸</code>.',
    range: () => ({ min: -1.7976931348623157e+308, max: 1.7976931348623157e+308 }),
    fitRange: () => ({ min: -1000, max: 1000 }),
    convert: v => v,
  },
};

const ALL_FORMAT_IDS = Object.keys(FORMAT_REGISTRY);

/* ──────────────────────────────────────────────────────────────
 * §2. MATH HELPERS
 * ────────────────────────────────────────────────────────────── */
function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function _roundN(v, step) { return Math.round(v / step) * step; }

function _intRange(lo, hi, fmtMin, fmtMax, maxCount = 500) {
  const vals = [];
  for (let i = Math.max(fmtMin, Math.ceil(lo)); i <= Math.min(fmtMax, Math.floor(hi)); i++) {
    vals.push(i);
    if (vals.length > maxCount) break;
  }
  return vals;
}

function _convertFPx(v, maxVal, subExp, normThreshExp, mantBits, maxExp) {
  if (v === 0) return 0;
  const s = Math.sign(v);
  let a = Math.abs(v);
  if (a > maxVal) return s * maxVal;
  const subStep = 2 ** subExp;
  if (a < subStep * 0.5) return 0;
  if (a < 2 ** normThreshExp) return s * Math.max(subStep, _roundN(a, subStep));
  const e = _clamp(Math.floor(Math.log2(a)), normThreshExp, maxExp);
  return s * Math.min(maxVal, _roundN(a, 2 ** (e - mantBits)));
}

function _convertFloat16(v) {
  if (v === 0) return 0;
  const s = Math.sign(v);
  let a = Math.abs(v);
  if (a > 65504) return s * 65504;
  if (a < 5.96e-8) return 0;
  const SUBNORM = 6.103515625e-5;
  if (a < SUBNORM) return s * _roundN(a / SUBNORM, 1 / 1024) * SUBNORM;
  const e = Math.floor(Math.log2(a));
  return s * _roundN(a, 2 ** (e - 10));
}

const _f32buf = new Float32Array(1);
const _u32buf = new Uint32Array(_f32buf.buffer);
function _truncFloat32(v, mask, testBit, roundUp, roundDn) {
  if (v === 0 || !isFinite(v)) return v;
  _f32buf[0] = v;
  _u32buf[0] = (_u32buf[0] + ((_u32buf[0] & testBit) ? roundUp : roundDn)) & mask;
  return _f32buf[0];
}

/* ──────────────────────────────────────────────────────────────
 * §3. FORMAT ACCESSORS
 * ────────────────────────────────────────────────────────────── */
function _fmt(id) { return FORMAT_REGISTRY[id]; }
function _toFormat(v, id, qp) { return isFinite(v) ? _fmt(id).convert(v, qp) : v; }
function _getRange(id, qp) { return _fmt(id).range(qp); }
function _getFitRange(id, qp) { return _fmt(id).fitRange(qp); }

function _getRepresentable(id, qp, lo, hi, maxCount = 500) {
  const f = _fmt(id);
  if (f.enumerate) return f.enumerate(lo, hi, maxCount, qp);
  const range = hi - lo;
  const step = range / Math.min(maxCount * 5, 10000);
  if (!isFinite(step) || step <= 0) return [];
  const vals = new Set();
  for (let x = lo; x <= hi; x += step) {
    const v = f.convert(x, qp);
    if (isFinite(v)) vals.add(v);
    if (vals.size > maxCount) break;
  }
  return [...vals].sort((a, b) => a - b);
}

function _fmtLabel(id, qp) {
  let label = _fmt(id).label;
  if (id === 'qmn') label += ` (Q${qp.m}.${qp.n})`;
  return label;
}

function _fmtN(v) {
  if (Math.abs(v) >= 1e4) return v.toExponential(1);
  if (Math.abs(v) < 0.001 && v !== 0) return v.toExponential(2);
  if (Number.isInteger(v)) return String(v);
  return String(parseFloat(v.toPrecision(5)));
}

/* ──────────────────────────────────────────────────────────────
 * §4. VIZ INSTANCE
 * ────────────────────────────────────────────────────────────── */

function create(container, userConfig = {}) {
  /* --- resolve config --- */
  const cfg = Object.assign({
    fmtX:      'float64',
    fmtY:      'float32',
    qX:        { m: 3, n: 4 },
    qY:        { m: 3, n: 4 },
    view:      null,
    formats:   null,
    showIdeal: true,
    showSteps: true,
    showRange: true,
    height:    280,
  }, userConfig);

  const formatIds = cfg.formats || ALL_FORMAT_IDS;

  /* --- mutable state --- */
  const st = {
    fmtX: cfg.fmtX,
    fmtY: cfg.fmtY,
    qX: Object.assign({}, cfg.qX),
    qY: Object.assign({}, cfg.qY),
    showIdeal: cfg.showIdeal,
    showSteps: cfg.showSteps,
    showRange: cfg.showRange,
    viewXMin: 0, viewXMax: 1,
    viewYMin: 0, viewYMax: 1,
    dragging: false,
    dragStart: null,
    lastMouse: null,
  };

  /* --- build DOM --- */
  const uid = _uid();
  container.classList.add('numfmt-viz');
  container.innerHTML = `
    <div class="nf-view-bar">
      <div class="nf-view-axis nf-view-x">
        <span class="nf-view-lbl">X</span>
        <input class="nf-view-input" id="nf-xmin-${uid}" type="text">
        <span class="nf-view-sep">…</span>
        <input class="nf-view-input" id="nf-xmax-${uid}" type="text">
        <button class="nf-tb-btn" id="nf-zin-x-${uid}" title="Приблизить X">−</button>
        <button class="nf-tb-btn" id="nf-zout-x-${uid}" title="Отдалить X">+</button>
        <button class="nf-tb-btn" id="nf-fit-x-${uid}" title="Полный диапазон X">Полный</button>
      </div>
      <span class="nf-view-divider">|</span>
      <div class="nf-view-axis nf-view-y">
        <span class="nf-view-lbl">Y</span>
        <input class="nf-view-input" id="nf-ymin-${uid}" type="text">
        <span class="nf-view-sep">…</span>
        <input class="nf-view-input" id="nf-ymax-${uid}" type="text">
        <button class="nf-tb-btn" id="nf-zin-y-${uid}" title="Приблизить Y">−</button>
        <button class="nf-tb-btn" id="nf-zout-y-${uid}" title="Отдалить Y">+</button>
        <button class="nf-tb-btn" id="nf-fit-y-${uid}" title="Полный диапазон Y">Полный</button>
      </div>
    </div>
    <div class="nf-main-area">
      <div class="nf-y-col"></div>
      <div class="nf-chart-col">
        <div class="nf-chart-wrap">
          <canvas class="nf-chart-canvas"></canvas>
          <div class="nf-tooltip"></div>
        </div>
        <div class="nf-x-row"></div>
        <div class="nf-layers"></div>
      </div>
    </div>
    <div class="nf-legend">
      <div class="nf-legend-item"><div class="nf-legend-line curve"></div> Преобразование</div>
      <div class="nf-legend-item"><div class="nf-legend-line ideal"></div> y=x</div>
      <div class="nf-legend-item"><div class="nf-legend-line step-y"></div> Уровни целевого</div>
      <div class="nf-legend-item"><div class="nf-legend-line step-x"></div> Уровни исходного</div>
      <div class="nf-legend-item"><div class="nf-legend-line range-x"></div> Диапазон исх.</div>
      <div class="nf-legend-item"><div class="nf-legend-line range-y"></div> Диапазон цел.</div>
    </div>
    <div class="nf-hint">Колёсико — масштаб · Перетаскивание — сдвиг · Наведение — детали</div>
  `;

  /* --- grab elements --- */
  const yCol     = container.querySelector('.nf-y-col');
  const xRow     = container.querySelector('.nf-x-row');
  const chartWrap= container.querySelector('.nf-chart-wrap');
  const canvas   = container.querySelector('.nf-chart-canvas');
  const tooltip  = container.querySelector('.nf-tooltip');
  const layers   = container.querySelector('.nf-layers');
  const ctx      = canvas.getContext('2d');

  const inXMin = container.querySelector(`#nf-xmin-${uid}`);
  const inXMax = container.querySelector(`#nf-xmax-${uid}`);
  const inYMin = container.querySelector(`#nf-ymin-${uid}`);
  const inYMax = container.querySelector(`#nf-ymax-${uid}`);

  const MARGIN   = { top: 16, right: 16, bottom: 40, left: 48 };

  /* --- canvas sizing --- */
  function resizeCanvas() {
    // Use offsetWidth (ignores CSS transform scale); fall back only when truly zero
    const w = chartWrap.offsetWidth || chartWrap.getBoundingClientRect().width;
    if (!w) return;  // not visible yet — ResizeObserver will fire again
    const h = cfg.height;
    canvas.width  = w * devicePixelRatio;
    canvas.height = h * devicePixelRatio;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  /* --- coordinate transforms --- */
  function d2c(x, y) {
    const cw = parseFloat(canvas.style.width)  - MARGIN.left - MARGIN.right;
    const ch = parseFloat(canvas.style.height) - MARGIN.top  - MARGIN.bottom;
    return [
      MARGIN.left + (x - st.viewXMin) / (st.viewXMax - st.viewXMin) * cw,
      MARGIN.top  + (1 - (y - st.viewYMin) / (st.viewYMax - st.viewYMin)) * ch,
    ];
  }

  function c2d(cx, cy) {
    const cw = parseFloat(canvas.style.width)  - MARGIN.left - MARGIN.right;
    const ch = parseFloat(canvas.style.height) - MARGIN.top  - MARGIN.bottom;
    return [
      st.viewXMin + (cx - MARGIN.left) / cw * (st.viewXMax - st.viewXMin),
      st.viewYMin + (1 - (cy - MARGIN.top) / ch) * (st.viewYMax - st.viewYMin),
    ];
  }

  /* --- view helpers --- */
  function fitView() {
    const rx = _getFitRange(st.fmtX, st.qX);
    const ry = _getFitRange(st.fmtY, st.qY);
    const px = (rx.max - rx.min) * 0.15 || 1;
    const py = (ry.max - ry.min) * 0.15 || 1;
    st.viewXMin = rx.min - px; st.viewXMax = rx.max + px;
    st.viewYMin = ry.min - py; st.viewYMax = ry.max + py;
  }

  function niceStep(range, ticks) {
    const rough = range / ticks;
    const mag = 10 ** Math.floor(Math.log10(rough));
    const n = rough / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }

  /* ── DRAW ── */
  function draw() {
    const W = parseFloat(canvas.style.width);
    const H = parseFloat(canvas.style.height);
    const cw = W - MARGIN.left - MARGIN.right;
    const ch = H - MARGIN.top  - MARGIN.bottom;

    const xRange = st.viewXMax - st.viewXMin;
    const yRange = st.viewYMax - st.viewYMin;
    const xStep  = niceStep(xRange, 7);
    const yStep  = niceStep(yRange, 5);
    const xs = Math.ceil(st.viewXMin / xStep) * xStep;
    const ys = Math.ceil(st.viewYMin / yStep) * yStep;

    /* background */
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f0ede8';
    ctx.fillRect(MARGIN.left, MARGIN.top, cw, ch);

    ctx.save();
    ctx.beginPath();
    ctx.rect(MARGIN.left, MARGIN.top, cw, ch);
    ctx.clip();

    /* grid */
    ctx.strokeStyle = 'rgba(45,42,38,0.06)';
    ctx.lineWidth = 0.5;
    for (let gx = xs; gx <= st.viewXMax; gx += xStep) {
      const [cx] = d2c(gx, 0);
      ctx.beginPath(); ctx.moveTo(cx, MARGIN.top); ctx.lineTo(cx, MARGIN.top + ch); ctx.stroke();
    }
    for (let gy = ys; gy <= st.viewYMax; gy += yStep) {
      const [, cy] = d2c(0, gy);
      ctx.beginPath(); ctx.moveTo(MARGIN.left, cy); ctx.lineTo(MARGIN.left + cw, cy); ctx.stroke();
    }

    /* zero axes */
    ctx.strokeStyle = 'rgba(45,42,38,0.15)';
    ctx.lineWidth = 1;
    if (st.viewXMin <= 0 && st.viewXMax >= 0) {
      const [cx] = d2c(0, 0);
      ctx.beginPath(); ctx.moveTo(cx, MARGIN.top); ctx.lineTo(cx, MARGIN.top + ch); ctx.stroke();
    }
    if (st.viewYMin <= 0 && st.viewYMax >= 0) {
      const [, cy] = d2c(0, 0);
      ctx.beginPath(); ctx.moveTo(MARGIN.left, cy); ctx.lineTo(MARGIN.left + cw, cy); ctx.stroke();
    }

    /* range boundaries */
    if (st.showRange) {
      _drawRangeBound(_getRange(st.fmtX, st.qX), 'x', cw, ch);
      _drawRangeBound(_getRange(st.fmtY, st.qY), 'y', cw, ch);
    }

    /* ideal line y=x */
    if (st.showIdeal) {
      ctx.strokeStyle = 'rgba(160,112,96,0.3)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      const [x1, y1] = d2c(st.viewXMin, st.viewXMin);
      const [x2, y2] = d2c(st.viewXMax, st.viewXMax);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.setLineDash([]);
    }

    /* quantization levels */
    if (st.showSteps) {
      const yVals = _getRepresentable(st.fmtY, st.qY, st.viewYMin, st.viewYMax, 500);
      if (yVals.length < 400) {
        ctx.strokeStyle = 'rgba(90,138,90,0.14)'; ctx.lineWidth = 0.5;
        for (const rv of yVals) {
          const [, cy] = d2c(0, rv);
          ctx.beginPath(); ctx.moveTo(MARGIN.left, cy); ctx.lineTo(MARGIN.left + cw, cy); ctx.stroke();
        }
      }
      const xVals = _getRepresentable(st.fmtX, st.qX, st.viewXMin, st.viewXMax, 500);
      if (xVals.length < 400) {
        ctx.strokeStyle = 'rgba(106,143,165,0.14)'; ctx.lineWidth = 0.5;
        for (const rv of xVals) {
          const [cx] = d2c(rv, 0);
          ctx.beginPath(); ctx.moveTo(cx, MARGIN.top); ctx.lineTo(cx, MARGIN.top + ch); ctx.stroke();
        }
      }
    }

    /* conversion curve */
    const rangeX = _getRange(st.fmtX, st.qX);
    const rangeY = _getRange(st.fmtY, st.qY);
    const curveMin = Math.max(st.viewXMin, rangeX.min);
    const curveMax = Math.min(st.viewXMax, rangeX.max);
    if (curveMax > curveMin) {
      const samples = Math.min(cw * 2, 3000);
      const dx = (curveMax - curveMin) / samples;
      for (const pass of [
        { style: 'rgba(106,143,165,0.15)', width: 6 },
        { style: 'rgba(106,143,165,0.9)',  width: 1.5 },
      ]) {
        ctx.strokeStyle = pass.style;
        ctx.lineWidth = pass.width;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= samples; i++) {
          const xv = curveMin + i * dx;
          const yv = _clamp(_toFormat(xv, st.fmtY, st.qY), rangeY.min, rangeY.max);
          if (!isFinite(yv)) { started = false; continue; }
          const [cx, cy] = d2c(xv, yv);
          if (!started) { ctx.moveTo(cx, cy); started = true; } else ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
    }

    ctx.restore();

    /* margins (cover axis areas) */
    ctx.fillStyle = '#f7f5f2';
    ctx.fillRect(0, 0, MARGIN.left - 1, H);
    ctx.fillRect(0, H - MARGIN.bottom + 1, W, MARGIN.bottom);
    ctx.fillRect(MARGIN.left + cw + 1, 0, MARGIN.right, H);
    ctx.fillRect(0, 0, W, MARGIN.top - 1);

    /* axis labels */
    ctx.fillStyle = '#8a857d';
    ctx.font = '9px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let gx = xs; gx <= st.viewXMax; gx += xStep) {
      const [cx] = d2c(gx, 0);
      if (cx > MARGIN.left + 8 && cx < MARGIN.left + cw - 8) {
        ctx.fillText(_fmtN(gx), cx, H - MARGIN.bottom + 5);
      }
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let gy = ys; gy <= st.viewYMax; gy += yStep) {
      const [, cy] = d2c(0, gy);
      if (cy > MARGIN.top + 8 && cy < MARGIN.top + ch - 8) {
        ctx.fillText(_fmtN(gy), MARGIN.left - 6, cy);
      }
    }

    /* axis titles */
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#6a8fa5';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('Исходный (' + _fmtLabel(st.fmtX, st.qX) + ')', MARGIN.left + cw / 2, H - 14);

    ctx.save();
    ctx.translate(12, MARGIN.top + ch / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#a07060';
    ctx.textBaseline = 'middle';
    ctx.fillText('Целевой (' + _fmtLabel(st.fmtY, st.qY) + ')', 0, 0);
    ctx.restore();

    /* hover crosshair + tooltip */
    if (st.lastMouse) {
      const [mx, my] = st.lastMouse;
      if (mx >= MARGIN.left && mx <= MARGIN.left + cw && my >= MARGIN.top && my <= MARGIN.top + ch) {
        const [dxv] = c2d(mx, my);
        const yConv = _toFormat(dxv, st.fmtY, st.qY);
        const [hx, hy] = d2c(dxv, yConv);

        ctx.save();
        ctx.beginPath(); ctx.rect(MARGIN.left, MARGIN.top, cw, ch); ctx.clip();
        ctx.strokeStyle = 'rgba(106,143,165,0.35)'; ctx.lineWidth = 0.5; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(hx, MARGIN.top); ctx.lineTo(hx, MARGIN.top + ch); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(MARGIN.left, hy); ctx.lineTo(MARGIN.left + cw, hy); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#6a8fa5';
        ctx.beginPath(); ctx.arc(hx, hy, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        const err  = yConv - dxv;
        const relE = dxv !== 0 ? Math.abs(err / dxv) * 100 : 0;
        tooltip.innerHTML =
          `<span class="tl">Значение:</span> <span class="tv">${_fmtN(dxv)}</span><br>` +
          `<span class="tl">Целевой (${_fmt(st.fmtY).label}):</span> <span class="tv2">${_fmtN(yConv)}</span><br>` +
          `<span class="tl">Ошибка:</span> <span class="te">${_fmtN(err)} (${relE < 0.01 ? '<0.01' : relE.toFixed(2)}%)</span>`;
        let tx = mx + 12, ty = my - 52;
        if (tx + 200 > parseFloat(canvas.style.width)) tx = mx - 210;
        if (ty < 0) ty = my + 12;
        tooltip.style.left = tx + 'px';
        tooltip.style.top  = ty + 'px';
        tooltip.style.display = 'block';
      } else {
        tooltip.style.display = 'none';
      }
    }
  }

  function _drawRangeBound(range, axis, cw, ch) {
    const isX = axis === 'x';
    const color = isX ? 'rgba(106,143,165,' : 'rgba(160,112,96,';
    const viewMin = isX ? st.viewXMin : st.viewYMin;
    const viewMax = isX ? st.viewXMax : st.viewYMax;

    /* shade outside */
    ctx.fillStyle = color + '0.05)';
    const cLo = isX ? d2c(range.min, 0)[0] : d2c(0, range.min)[1];
    const cHi = isX ? d2c(range.max, 0)[0] : d2c(0, range.max)[1];
    if (isX) {
      if (cLo > MARGIN.left) ctx.fillRect(MARGIN.left, MARGIN.top, cLo - MARGIN.left, ch);
      if (cHi < MARGIN.left + cw) ctx.fillRect(cHi, MARGIN.top, MARGIN.left + cw - cHi, ch);
    } else {
      if (cHi > MARGIN.top) ctx.fillRect(MARGIN.left, MARGIN.top, cw, cHi - MARGIN.top);
      if (cLo < MARGIN.top + ch) ctx.fillRect(MARGIN.left, cLo, cw, MARGIN.top + ch - cLo);
    }

    /* dashed boundary */
    ctx.strokeStyle = color + '0.4)';
    ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    for (const val of [range.min, range.max]) {
      if (val <= viewMin || val >= viewMax) continue;
      if (isX) {
        const [cx] = d2c(val, 0);
        ctx.beginPath(); ctx.moveTo(cx, MARGIN.top); ctx.lineTo(cx, MARGIN.top + ch); ctx.stroke();
      } else {
        const [, cy] = d2c(0, val);
        ctx.beginPath(); ctx.moveTo(MARGIN.left, cy); ctx.lineTo(MARGIN.left + cw, cy); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  /* ── UI: format buttons ── */
  const yQInline = _buildQInline(st.qY, 'y');
  const xQInline = _buildQInline(st.qX, 'x');

  function _buildQInline(qObj, axis) {
    const wrap = document.createElement('div');
    wrap.className = 'nf-q-inline';
    for (const key of ['m', 'n']) {
      const lbl = document.createElement('label');
      lbl.textContent = key + ':';
      const inp = document.createElement('input');
      Object.assign(inp, { type: 'number', value: qObj[key], min: 1, max: 15 });
      inp.addEventListener('input', () => {
        qObj[key] = _clamp(parseInt(inp.value) || 1, 1, 15);
        updateAll();
      });
      wrap.append(lbl, inp);
    }
    return wrap;
  }

  function _syncQInputs() {
    for (const [wrap, obj] of [[yQInline, st.qY], [xQInline, st.qX]]) {
      const [mi, ni] = wrap.querySelectorAll('input');
      mi.value = obj.m; ni.value = obj.n;
    }
  }

  /* ── range input helpers ── */
  function syncRangeInputs() {
    inXMin.value = _fmtN(st.viewXMin);
    inXMax.value = _fmtN(st.viewXMax);
    inYMin.value = _fmtN(st.viewYMin);
    inYMax.value = _fmtN(st.viewYMax);
  }

  function applyRangeInputs() {
    const xn = parseFloat(inXMin.value), xx = parseFloat(inXMax.value);
    const yn = parseFloat(inYMin.value), yx = parseFloat(inYMax.value);
    if (isFinite(xn) && isFinite(xx) && xx > xn) { st.viewXMin = xn; st.viewXMax = xx; }
    if (isFinite(yn) && isFinite(yx) && yx > yn) { st.viewYMin = yn; st.viewYMax = yx; }
    draw();
  }

  for (const inp of [inXMin, inXMax, inYMin, inYMax]) {
    inp.addEventListener('change', applyRangeInputs);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') applyRangeInputs(); });
  }

  /* ── view buttons ── */
  function _zoomAxis(axis, factor) {
    if (axis === 'x') {
      const c = (st.viewXMin + st.viewXMax) / 2, h = (st.viewXMax - st.viewXMin) / 2 * factor;
      st.viewXMin = c - h; st.viewXMax = c + h;
    } else {
      const c = (st.viewYMin + st.viewYMax) / 2, h = (st.viewYMax - st.viewYMin) / 2 * factor;
      st.viewYMin = c - h; st.viewYMax = c + h;
    }
    syncRangeInputs(); draw();
  }

  function _fitAxis(axis) {
    const id = axis === 'x' ? st.fmtX : st.fmtY;
    const qp = axis === 'x' ? st.qX   : st.qY;
    const r  = _getRange(id, qp);
    const span = r.max - r.min;
    const pad  = isFinite(span) ? span * 0.15 : 0;
    const lo   = isFinite(r.min - pad) ? r.min - pad : r.min;
    const hi   = isFinite(r.max + pad) ? r.max + pad : r.max;
    // If resulting view span is infinite (e.g. float64), fall back to fitRange
    if (!isFinite(hi - lo)) {
      const fr = _getFitRange(id, qp);
      const fp = (fr.max - fr.min) * 0.15;
      if (axis === 'x') { st.viewXMin = fr.min - fp; st.viewXMax = fr.max + fp; }
      else              { st.viewYMin = fr.min - fp; st.viewYMax = fr.max + fp; }
    } else {
      if (axis === 'x') { st.viewXMin = lo; st.viewXMax = hi; }
      else              { st.viewYMin = lo; st.viewYMax = hi; }
    }
    syncRangeInputs(); draw();
  }

  container.querySelector(`#nf-zin-x-${uid}`) .addEventListener('click', () => _zoomAxis('x', 0.5));
  container.querySelector(`#nf-zout-x-${uid}`).addEventListener('click', () => _zoomAxis('x', 2));
  container.querySelector(`#nf-fit-x-${uid}`) .addEventListener('click', () => _fitAxis('x'));
  container.querySelector(`#nf-zin-y-${uid}`) .addEventListener('click', () => _zoomAxis('y', 0.5));
  container.querySelector(`#nf-zout-y-${uid}`).addEventListener('click', () => _zoomAxis('y', 2));
  container.querySelector(`#nf-fit-y-${uid}`) .addEventListener('click', () => _fitAxis('y'));

  /* ── format buttons ── */
  formatIds.forEach(id => {
    const btnY = document.createElement('button');
    btnY.className = 'nf-fmt-btn'; btnY.textContent = _fmt(id).label;
    btnY.title = _fmt(id).desc; btnY.dataset.fmt = id;
    btnY.addEventListener('click', () => { st.fmtY = id; updateAll(true); });
    yCol.appendChild(btnY);
    if (id === 'qmn') yCol.appendChild(yQInline);

    const btnX = document.createElement('button');
    btnX.className = 'nf-fmt-btn'; btnX.textContent = _fmt(id).label;
    btnX.title = _fmt(id).desc; btnX.dataset.fmt = id;
    btnX.addEventListener('click', () => { st.fmtX = id; updateAll(true); });
    xRow.appendChild(btnX);
  });
  xRow.appendChild(xQInline);

  /* ── layer toggles ── */
  function _mkToggle(label, title, key) {
    const btn = document.createElement('button');
    btn.className = 'nf-tb-btn' + (st[key] ? ' active' : '');
    btn.textContent = label; btn.title = title;
    btn.addEventListener('click', () => {
      st[key] = !st[key];
      btn.classList.toggle('active', st[key]);
      draw();
    });
    return btn;
  }
  const sepA = document.createElement('span'); sepA.className = 'nf-sep'; sepA.textContent = '·';
  const sepB = document.createElement('span'); sepB.className = 'nf-sep'; sepB.textContent = '·';
  layers.append(
    _mkToggle('y=x',      'Идеальная линия',          'showIdeal'),
    sepA,
    _mkToggle('ступени',  'Уровни квантования',        'showSteps'),
    sepB,
    _mkToggle('диапазон', 'Границы диапазона форматов','showRange'),
  );

  /* ── update cycle ── */
  function updateAll(doFit) {
    yCol.querySelectorAll('.nf-fmt-btn').forEach(b =>
      b.classList.toggle('active-y', b.dataset.fmt === st.fmtY));
    xRow.querySelectorAll('.nf-fmt-btn').forEach(b =>
      b.classList.toggle('active-x', b.dataset.fmt === st.fmtX));
    yQInline.classList.toggle('visible', st.fmtY === 'qmn');
    xQInline.classList.toggle('visible', st.fmtX === 'qmn');
    _syncQInputs();
    if (doFit) fitView();
    syncRangeInputs();
    draw();
  }

  /* ── mouse interaction ── */
  // getBoundingClientRect gives screen pixels; canvas.style.width is layout pixels.
  // Reveal.js scales slides via CSS transform, so we must divide by that scale.
  function _canvasPos(e) {
    const r = canvas.getBoundingClientRect();
    const sx = parseFloat(canvas.style.width)  / r.width;
    const sy = parseFloat(canvas.style.height) / r.height;
    return [(e.clientX - r.left) * sx, (e.clientY - r.top) * sy];
  }

  canvas.addEventListener('mousemove', e => {
    st.lastMouse = _canvasPos(e);
    if (st.dragging && st.dragStart) {
      const [mx, my] = st.lastMouse;
      const [sx, sy] = st.dragStart;
      const cw = parseFloat(canvas.style.width)  - MARGIN.left - MARGIN.right;
      const ch = parseFloat(canvas.style.height) - MARGIN.top  - MARGIN.bottom;
      st.viewXMin -= (mx - sx) / cw * (st.viewXMax - st.viewXMin);
      st.viewXMax -= (mx - sx) / cw * (st.viewXMax - st.viewXMin);
      st.viewYMin += (my - sy) / ch * (st.viewYMax - st.viewYMin);
      st.viewYMax += (my - sy) / ch * (st.viewYMax - st.viewYMin);
      st.dragStart = [mx, my];
      syncRangeInputs();
    }
    draw();
  });

  canvas.addEventListener('mousedown', e => {
    st.dragging = true;
    st.dragStart = _canvasPos(e);
    canvas.style.cursor = 'grabbing';
  });

  canvas.addEventListener('mouseup', () => {
    st.dragging = false; st.dragStart = null;
    canvas.style.cursor = 'crosshair';
  });

  canvas.addEventListener('mouseleave', () => {
    st.dragging = false; st.dragStart = null;
    st.lastMouse = null;
    tooltip.style.display = 'none';
    canvas.style.cursor = 'crosshair';
    draw();
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const [dx, dy] = c2d(..._canvasPos(e));
    const f = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    st.viewXMin = dx - (dx - st.viewXMin) * f;
    st.viewXMax = dx + (st.viewXMax - dx) * f;
    st.viewYMin = dy - (dy - st.viewYMin) * f;
    st.viewYMax = dy + (st.viewYMax - dy) * f;
    syncRangeInputs();
    draw();
  }, { passive: false });

  /* ── init ── */
  if (cfg.view) {
    [st.viewXMin, st.viewXMax, st.viewYMin, st.viewYMax] = cfg.view;
  } else {
    fitView();
  }
  syncRangeInputs();
  updateAll(false);

  // Resize whenever the chart container gets actual dimensions (handles hidden Reveal slides)
  const _ro = new ResizeObserver(() => { resizeCanvas(); draw(); });
  _ro.observe(chartWrap);

  /* expose public API */
  return { draw, updateAll, fitView, resizeCanvas, state: st };
}

/* ──────────────────────────────────────────────────────────────
 * §5. AUTO-INIT from data-attributes
 *   <div class="numfmt-viz"
 *        data-fmt-x="float64"
 *        data-fmt-y="float16"
 *        data-formats="float16,bfloat16,float32"
 *        data-view="-10,10,-10,10">
 *   </div>
 * ────────────────────────────────────────────────────────────── */
function autoInit(root) {
  (root || document).querySelectorAll('[data-numfmt]').forEach(el => {
    const d = el.dataset;
    const config = {};
    if (d.fmtX)    config.fmtX    = d.fmtX;
    if (d.fmtY)    config.fmtY    = d.fmtY;
    if (d.formats) config.formats = d.formats.split(',').map(s => s.trim());
    if (d.view)    config.view    = d.view.split(',').map(Number);
    if (d.height)  config.height  = +d.height;
    if (d.showIdeal  !== undefined) config.showIdeal  = d.showIdeal  !== 'false';
    if (d.showSteps  !== undefined) config.showSteps  = d.showSteps  !== 'false';
    if (d.showRange  !== undefined) config.showRange  = d.showRange  !== 'false';
    create(el, config);
  });
}

/* ──────────────────────────────────────────────────────────────
 * §6. UTILS
 * ────────────────────────────────────────────────────────────── */
let _uidCounter = 0;
function _uid() { return ++_uidCounter; }

return { create, autoInit, formats: FORMAT_REGISTRY };

})(); // NumFmtViz
