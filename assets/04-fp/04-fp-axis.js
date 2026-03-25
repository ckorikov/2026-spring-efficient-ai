(function () {
	const BG        = '#f7f5f2';
	const COL_INT   = '#6a8fa5';
	const COL_FRAC  = '#a07060';
	const COL_SIGN  = '#a07070';
	const COL_FBITS = '#7a9a7a';
	const COL_AXIS  = '#c8c3bb';
	const COL_ZERO  = '#2d2a26';
	const COL_MUTED = '#a09a92';
	const DPR  = window.devicePixelRatio || 1;
	const FONT = '"IBM Plex Mono", monospace';
	const PAD  = 24;
	const AXIS_Y   = 46;
	const CANVAS_H = 80;

	const fracState = { total: 8, m: 2, n: 5, signed: true, clicked: null, hovered: null };
	const fpState   = { total: 8, expBits: 5, subnorm: false, clicked: null, hovered: null };

	const fracRange = FpFixed.fracRange;
	const toBinary  = FpFixed.toBinary;
	const fpMaxVal    = FpIEEE754.fpMaxVal;
	const fpEnumerate = FpIEEE754.fpEnumerate;
	const fpToBits    = FpIEEE754.fpToBits;

	function fmtVal(v) { return v.toString(); }

	function setupCanvas(canvasId) {
		const canvas = document.getElementById(canvasId);
		if (!canvas) return null;
		const W = canvas.parentElement.offsetWidth;
		if (W === 0) return null;
		canvas.width = W * DPR; canvas.height = CANVAS_H * DPR;
		canvas.style.width = W + 'px'; canvas.style.height = CANVAS_H + 'px';
		const ctx = canvas.getContext('2d');
		ctx.scale(DPR, DPR);
		ctx.clearRect(0, 0, W, CANVAS_H);
		return { ctx, W, axisLen: W - PAD * 2 };
	}

	function drawAxisLine(ctx, W) {
		ctx.strokeStyle = COL_AXIS; ctx.lineWidth = 1;
		ctx.beginPath(); ctx.moveTo(PAD, AXIS_Y); ctx.lineTo(W - PAD, AXIS_Y); ctx.stroke();
	}

	function drawZeroMark(ctx, xFor) {
		const zx = xFor(0);
		ctx.strokeStyle = COL_ZERO; ctx.lineWidth = 1.5;
		ctx.beginPath(); ctx.moveTo(zx, AXIS_Y - 10); ctx.lineTo(zx, AXIS_Y + 10); ctx.stroke();
		ctx.fillStyle = COL_ZERO; ctx.font = 'bold 11px ' + FONT; ctx.textAlign = 'center';
		ctx.fillText('0', zx, AXIS_Y + 20);
	}

	function drawEndpoints(ctx, endpoints, color, formatter) {
		ctx.fillStyle = color; ctx.font = 'bold 11px ' + FONT;
		ctx.textAlign = 'center'; ctx.strokeStyle = color; ctx.lineWidth = 2;
		for (const [v, x] of endpoints) {
			ctx.beginPath(); ctx.moveTo(x, AXIS_Y - 8); ctx.lineTo(x, AXIS_Y + 8); ctx.stroke();
			ctx.fillText(formatter(v), x, AXIS_Y + 20);
		}
	}

	function drawHoverMarker(ctx, cx, color) {
		ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
		ctx.beginPath(); ctx.moveTo(cx, AXIS_Y - 26); ctx.lineTo(cx, AXIS_Y); ctx.stroke();
		ctx.setLineDash([]);
		ctx.fillStyle = color;
		ctx.beginPath(); ctx.arc(cx, AXIS_Y, 4, 0, Math.PI * 2); ctx.fill();
	}

	function drawBitLabel(ctx, cx, W, decStr, segments) {
		ctx.font = 'bold 11px ' + FONT;
		const charW = ctx.measureText('0').width;
		const brkW  = ctx.measureText('[').width;
		const obW   = ctx.measureText('0b').width;
		const prefix = decStr + '  ';
		const prefixW = ctx.measureText(prefix).width;

		let contentW = 0;
		for (const seg of segments) {
			contentW += seg.sep ? ctx.measureText(seg.sep).width : 0;
			contentW += charW * seg.bits.length;
		}
		const totalW = prefixW + brkW + obW + contentW + brkW;
		const lx = Math.max(totalW / 2 + 5, Math.min(cx, W - totalW / 2 - 5));
		const labelY = AXIS_Y - 30;

		ctx.fillStyle = BG;
		ctx.fillRect(lx - totalW / 2 - 2, labelY - 11, totalW + 4, 15);
		ctx.textAlign = 'left';
		let curX = lx - totalW / 2;

		ctx.fillStyle = segments[0].color; ctx.fillText(prefix, curX, labelY); curX += prefixW;
		ctx.fillStyle = COL_MUTED; ctx.fillText('[', curX, labelY); curX += brkW;
		ctx.fillText('0b', curX, labelY); curX += obW;

		for (const seg of segments) {
			if (seg.sep) {
				ctx.fillStyle = COL_MUTED; ctx.fillText(seg.sep, curX, labelY);
				curX += ctx.measureText(seg.sep).width;
			}
			for (const ch of seg.bits) {
				ctx.fillStyle = seg.color; ctx.fillText(ch, curX, labelY); curX += charW;
			}
		}
		ctx.fillStyle = COL_MUTED; ctx.fillText(']', curX, labelY);
	}

	function fpFilteredValues(totalBits, expBits, subnorm) {
		const allVals = fpEnumerate(totalBits, expBits);
		if (subnorm) return allVals;
		const bias = (1 << (expBits - 1)) - 1;
		const minNormal = Math.pow(2, 1 - bias);
		return allVals.filter(v => v === 0 || Math.abs(v) >= minNormal);
	}

	function drawAxis(canvasId, range, color, clickedVal, hoveredVal, totalBits, signed, fracBits) {
		const setup = setupCanvas(canvasId);
		if (!setup) return;
		const { ctx, W, axisLen } = setup;

		if (range.count === 0) {
			ctx.fillStyle = COL_MUTED; ctx.font = '11px ' + FONT; ctx.textAlign = 'center';
			ctx.fillText('Нет значений (0 бит)', W / 2, AXIS_Y); return;
		}
		const { min, max, step, count } = range;
		const span = max - min;
		const xFor = v => span === 0 ? PAD + axisLen / 2 : PAD + ((v - min) / span) * axisLen;

		drawAxisLine(ctx, W);

		const maxTicks = Math.min(count, Math.floor(axisLen / 2));
		const tickStep = Math.max(1, Math.floor(count / maxTicks));
		ctx.strokeStyle = color + '55'; ctx.lineWidth = 1;
		for (let i = 0; i < count; i += tickStep) {
			const x = xFor(min + i * step);
			ctx.beginPath(); ctx.moveTo(x, AXIS_Y - 4); ctx.lineTo(x, AXIS_Y + 4); ctx.stroke();
		}

		drawEndpoints(ctx, [[min, xFor(min)], [max, xFor(max)]], color, fmtVal);
		if (min < 0 && max > 0) drawZeroMark(ctx, xFor);

		const displayVal = hoveredVal !== null ? hoveredVal : clickedVal;
		if (displayVal !== null) {
			const cx = xFor(displayVal);
			drawHoverMarker(ctx, cx, color);
			const bin = toBinary(displayVal, totalBits, signed, fracBits);
			const intBits = totalBits - fracBits;
			const segments = [];
			for (let i = 0; i < totalBits; i++) {
				const col = (signed && i === 0) ? COL_SIGN : (i < intBits ? COL_INT : COL_FBITS);
				const last = segments[segments.length - 1];
				if (last && last.color === col) { last.bits += bin[i]; }
				else { segments.push({ color: col, bits: bin[i] }); }
			}
			drawBitLabel(ctx, cx, W, fmtVal(displayVal), segments);
		}
	}

	function drawFPAxis(canvasId, totalBits, expBits, clickedVal, hoveredVal, subnorm) {
		const setup = setupCanvas(canvasId);
		if (!setup) return;
		const { ctx, W, axisLen } = setup;

		const M = totalBits - 1 - expBits;
		if (M < 0) {
			ctx.fillStyle = COL_MUTED; ctx.font = '11px ' + FONT; ctx.textAlign = 'center';
			ctx.fillText('Недостаточно бит', W / 2, AXIS_Y); return;
		}
		const maxV = fpMaxVal(totalBits, expBits);
		if (!isFinite(maxV) || maxV === 0) return;
		const xFor = v => PAD + ((v + maxV) / (2 * maxV)) * axisLen;

		drawAxisLine(ctx, W);

		const vals = fpFilteredValues(totalBits, expBits, subnorm);
		ctx.strokeStyle = COL_INT + '55'; ctx.lineWidth = 1;
		let lastX = -Infinity;
		for (const v of vals) {
			const x = xFor(v);
			if (x >= PAD - 1 && x <= W - PAD + 1 && Math.abs(x - lastX) >= 0.5) {
				ctx.beginPath(); ctx.moveTo(x, AXIS_Y - 4); ctx.lineTo(x, AXIS_Y + 4); ctx.stroke();
				lastX = x;
			}
		}

		const fmtFPVal = v => Math.abs(v) >= 1000 ? v.toFixed(0) : v.toPrecision(4);
		drawEndpoints(ctx, [[-maxV, xFor(-maxV)], [maxV, xFor(maxV)]], COL_INT, fmtFPVal);
		drawZeroMark(ctx, xFor);

		const displayVal = hoveredVal !== null ? hoveredVal : clickedVal;
		if (displayVal !== null) {
			const cx = xFor(displayVal);
			drawHoverMarker(ctx, cx, COL_INT);
			const bin = fpToBits(displayVal, totalBits, expBits);
			const storedExp = parseInt(bin.slice(1, 1 + expBits), 2);
			const bias = (1 << (expBits - 1)) - 1;
			const isSubn = storedExp === 0 && displayVal !== 0;
			const ulpExp = (storedExp > 0 ? storedExp - bias : 1 - bias) - M;
			const ulp = Math.pow(2, ulpExp);
			const fmtUlp = ulp >= 1 ? ulp.toString() : ulp.toExponential(1);
			const decStr = (displayVal === 0 ? '0'
				: Math.abs(displayVal) < 0.001 ? displayVal.toExponential(2)
				: Math.abs(displayVal) >= 1000  ? displayVal.toFixed(0)
				: displayVal.toPrecision(4))
				+ (isSubn ? ' sub' : '')
				+ '  ulp=' + fmtUlp;
			drawBitLabel(ctx, cx, W, decStr, [
				{ color: COL_SIGN,  bits: bin[0] },
				{ color: COL_INT,   bits: bin.slice(1, 1 + expBits), sep: '|' },
				{ color: COL_FBITS, bits: bin.slice(1 + expBits),    sep: '|' },
			]);
		}
	}

	function updateFrac() {
		const { total, n, signed } = fracState;
		const dataBits = signed ? total - 1 : total;
		const nSl = document.getElementById('cmp-frac-n');
		nSl.max = dataBits;
		fracState.n = Math.min(n, dataBits);
		fracState.m = dataBits - fracState.n;
		nSl.value = fracState.n;

		document.getElementById('cmp-frac-n-val').textContent      = fracState.n;
		document.getElementById('cmp-frac-fmt').textContent        = fracState.m + '.' + fracState.n;
		const r = fracRange(fracState.m, fracState.n, signed);
		document.getElementById('cmp-frac-min').textContent   = fmtVal(r.min);
		document.getElementById('cmp-frac-max').textContent   = fmtVal(r.max);
		document.getElementById('cmp-frac-step').textContent  = fmtVal(r.step);
		document.getElementById('cmp-frac-count').textContent = r.count;
		drawAxis('cmp-frac-canvas', r, COL_FRAC, fracState.clicked, fracState.hovered, total, signed, fracState.n);
	}

	function updateFP() {
		const { total, subnorm } = fpState;
		const eSl = document.getElementById('cmp-fp-e');
		eSl.max = total - 2; // total fixed at 8 → max E = 6
		fpState.expBits = Math.min(fpState.expBits, total - 2);
		eSl.value = fpState.expBits;
		const E    = fpState.expBits;
		const M    = Math.max(0, total - 1 - E);
		const bias = (1 << (E - 1)) - 1;
		const eMax = bias;
		const maxV = fpMaxVal(total, E);
		// count: all bitpatterns minus NaN/Inf (2 × mantissa configs) minus ±0 duplication (+0 already counted)
		// subnormals: 2 × (2^M − 1) values (excluding ±0)
		const subnormCnt = 2 * ((1 << M) - 1);
		const totalCnt   = (1 << total) - 2 * (1 << M); // excludes NaN/Inf
		const cnt = subnorm ? totalCnt : totalCnt - subnormCnt;

		const fmtFP = v => isFinite(v) ? (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toPrecision(4)) : '∞';
		document.getElementById('cmp-fp-e-val').textContent    = E;
		document.getElementById('cmp-fp-e-lbl').textContent    = E;
		document.getElementById('cmp-fp-m-lbl').textContent    = M;
		document.getElementById('cmp-fp-norm-lbl').textContent = subnorm ? 'норм. + субнорм.' : 'нормализованный';
		document.getElementById('cmp-fp-min').textContent      = isFinite(maxV) ? ('−' + fmtFP(maxV)) : '−∞';
		document.getElementById('cmp-fp-max').textContent      = fmtFP(maxV);
		document.getElementById('cmp-fp-emax').textContent     = eMax;
		document.getElementById('cmp-fp-count').textContent    = cnt > 0 ? cnt.toLocaleString('ru') : '—';
		drawFPAxis('cmp-fp-canvas', total, E, fpState.clicked, fpState.hovered, subnorm);
	}

	function redrawAll() { updateFrac(); updateFP(); }

	function nearestFP(pixX, W) {
		const maxV = fpMaxVal(fpState.total, fpState.expBits);
		if (!isFinite(maxV) || maxV === 0) return null;
		const target = -maxV + ((pixX - PAD) / (W - PAD * 2)) * 2 * maxV;
		const vals = fpFilteredValues(fpState.total, fpState.expBits, fpState.subnorm);
		let best = vals[0], bestD = Infinity;
		for (const v of vals) { const d = Math.abs(v - target); if (d < bestD) { bestD = d; best = v; } }
		return best;
	}

	function snapFrac(pixX, W) {
		const r = fracRange(fracState.m, fracState.n, fracState.signed);
		if (r.count === 0) return;
		const frac = (pixX - PAD) / (W - PAD * 2);
		const val  = r.min + frac * (r.max - r.min);
		const idx  = Math.max(0, Math.min(r.count - 1, Math.round((val - r.min) / r.step)));
		fracState.clicked = r.min + idx * r.step;
	}

	function snapFP(pixX, W) {
		const best = nearestFP(pixX, W);
		if (best !== null) fpState.clicked = best;
	}

	function init() {
		if (!document.getElementById('cmp-frac-n')) return;

		document.getElementById('cmp-frac-n').addEventListener('input', function () {
			fracState.n = +this.value; fracState.clicked = null; updateFrac();
		});
		document.getElementById('cmp-frac-canvas').addEventListener('click', function (e) {
			const r = this.getBoundingClientRect();
			snapFrac(e.clientX - r.left, r.width); updateFrac();
		});
		document.getElementById('cmp-frac-canvas').addEventListener('mousemove', function (e) {
			const r = this.getBoundingClientRect();
			const range = fracRange(fracState.m, fracState.n, fracState.signed);
			if (range.count === 0) return;
			const frac = (e.clientX - r.left - PAD) / (r.width - PAD * 2);
			const val  = range.min + frac * (range.max - range.min);
			const idx  = Math.max(0, Math.min(range.count - 1, Math.round((val - range.min) / range.step)));
			const best = range.min + idx * range.step;
			if (fracState.hovered !== best) { fracState.hovered = best; updateFrac(); }
		});
		document.getElementById('cmp-frac-canvas').addEventListener('mouseleave', function () {
			fracState.hovered = null; updateFrac();
		});

		document.getElementById('cmp-fp-e').addEventListener('input', function () {
			fpState.expBits = +this.value; fpState.clicked = null; updateFP();
		});
		document.getElementById('cmp-fp-subnorm').addEventListener('change', function () {
			fpState.subnorm = this.checked; fpState.clicked = null; updateFP();
		});
		document.getElementById('cmp-fp-canvas').addEventListener('click', function (e) {
			const r = this.getBoundingClientRect();
			snapFP(e.clientX - r.left, r.width); updateFP();
		});
		document.getElementById('cmp-fp-canvas').addEventListener('mousemove', function (e) {
			const r = this.getBoundingClientRect();
			const best = nearestFP(e.clientX - r.left, r.width);
			if (best !== null && fpState.hovered !== best) { fpState.hovered = best; updateFP(); }
		});
		document.getElementById('cmp-fp-canvas').addEventListener('mouseleave', function () {
			fpState.hovered = null; updateFP();
		});
	}

	document.addEventListener('DOMContentLoaded', init);
	window.addEventListener('load', redrawAll);
	window._fpAxisRedraw = redrawAll;
})();
