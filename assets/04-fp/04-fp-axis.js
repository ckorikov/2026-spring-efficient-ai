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

	// ── State ──────────────────────────────────────────────────
	const fracState = { total: 8, m: 2, n: 5, signed: true, clicked: null, hovered: null };
	const fpState   = { total: 8, expBits: 5, clicked: null, hovered: null };

	// ── Fixed-point helpers (точная копия из 03-integers) ──────
	function fracRange(m, n, signed) {
		const totalBits = m + n;
		if (totalBits === 0) return { min: 0, max: 0, step: 0, count: 0 };
		const count = 1 << totalBits;
		const step = n > 0 ? 1 / (1 << n) : 1;
		if (signed) {
			const half = count / 2;
			return { min: -half * step, max: (half - 1) * step, step, count };
		}
		return { min: 0, max: (count - 1) * step, step, count };
	}

	function toBinary(val, totalBits, signed, fracBits) {
		let intVal = Math.round(val * (fracBits > 0 ? (1 << fracBits) : 1));
		if (signed && intVal < 0) intVal = (1 << totalBits) + intVal;
		let s = intVal.toString(2).padStart(totalBits, '0');
		if (s.length > totalBits) s = s.slice(-totalBits);
		return s;
	}

	function fmtVal(v) { return v.toString(); }

	function drawAxis(canvasId, range, color, clickedVal, hoveredVal, totalBits, signed, fracBits) {
		const canvas = document.getElementById(canvasId);
		if (!canvas) return;
		const W = canvas.parentElement.offsetWidth;
		if (W === 0) return;
		canvas.width = W * DPR; canvas.height = 80 * DPR;
		canvas.style.width = W + 'px'; canvas.style.height = '80px';
		const ctx = canvas.getContext('2d');
		ctx.scale(DPR, DPR);
		const pad = 24, axisY = 46, axisLen = W - pad * 2;
		ctx.clearRect(0, 0, W, 80);

		if (range.count === 0) {
			ctx.fillStyle = COL_MUTED; ctx.font = '11px ' + FONT; ctx.textAlign = 'center';
			ctx.fillText('Нет значений (0 бит)', W / 2, axisY); return;
		}
		const { min, max, step, count } = range;
		const span = max - min;
		const xFor = v => span === 0 ? pad + axisLen / 2 : pad + ((v - min) / span) * axisLen;

		ctx.strokeStyle = COL_AXIS; ctx.lineWidth = 1;
		ctx.beginPath(); ctx.moveTo(pad, axisY); ctx.lineTo(W - pad, axisY); ctx.stroke();

		const maxTicks = Math.min(count, Math.floor(axisLen / 2));
		const tickStep = Math.max(1, Math.floor(count / maxTicks));
		ctx.strokeStyle = color + '55'; ctx.lineWidth = 1;
		for (let i = 0; i < count; i += tickStep) {
			const x = xFor(min + i * step);
			ctx.beginPath(); ctx.moveTo(x, axisY - 4); ctx.lineTo(x, axisY + 4); ctx.stroke();
		}

		ctx.fillStyle = color; ctx.font = 'bold 11px ' + FONT;
		ctx.textAlign = 'center'; ctx.strokeStyle = color; ctx.lineWidth = 2;
		[min, max].forEach(v => {
			const x = xFor(v);
			ctx.beginPath(); ctx.moveTo(x, axisY - 8); ctx.lineTo(x, axisY + 8); ctx.stroke();
			ctx.fillText(fmtVal(v), x, axisY + 20);
		});

		if (min < 0 && max > 0) {
			const zx = xFor(0);
			ctx.strokeStyle = COL_ZERO; ctx.lineWidth = 1.5;
			ctx.beginPath(); ctx.moveTo(zx, axisY - 10); ctx.lineTo(zx, axisY + 10); ctx.stroke();
			ctx.fillStyle = COL_ZERO; ctx.font = 'bold 11px ' + FONT; ctx.textAlign = 'center';
			ctx.fillText('0', zx, axisY + 20);
		}

		// hover takes priority over click; show label for both
		const displayVal = hoveredVal !== null ? hoveredVal : clickedVal;
		if (displayVal !== null) {
			const cx = xFor(displayVal);
			ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
			ctx.beginPath(); ctx.moveTo(cx, axisY - 26); ctx.lineTo(cx, axisY); ctx.stroke();
			ctx.setLineDash([]);
			ctx.fillStyle = color;
			ctx.beginPath(); ctx.arc(cx, axisY, 4, 0, Math.PI * 2); ctx.fill();

			const bin = toBinary(displayVal, totalBits, signed, fracBits);
			const decStr = fmtVal(displayVal);
			ctx.font = 'bold 11px ' + FONT;
			const charW = ctx.measureText('0').width;
			const prefix = decStr + '  ';
			const prefixW = ctx.measureText(prefix).width;
			const obW = ctx.measureText('0b').width;
			const brkW = ctx.measureText('[').width;
			const totalW = prefixW + brkW + obW + charW * totalBits + brkW;
			const lx = Math.max(totalW / 2 + 5, Math.min(cx, W - totalW / 2 - 5));
			const labelY = axisY - 30;
			ctx.fillStyle = BG;
			ctx.fillRect(lx - totalW / 2 - 2, labelY - 11, totalW + 4, 15);
			ctx.textAlign = 'left'; let curX = lx - totalW / 2;
			ctx.fillStyle = color; ctx.fillText(prefix, curX, labelY); curX += prefixW;
			ctx.fillStyle = COL_MUTED; ctx.fillText('[', curX, labelY); curX += brkW;
			ctx.fillText('0b', curX, labelY); curX += obW;
			for (let i = 0; i < totalBits; i++) {
				ctx.fillStyle = (signed && i === 0) ? COL_SIGN : (i < totalBits - fracBits ? COL_INT : COL_FBITS);
				ctx.fillText(bin[i], curX, labelY); curX += charW;
			}
			ctx.fillStyle = COL_MUTED; ctx.fillText(']', curX, labelY);
		}
	}

	// ── FP helpers ──────────────────────────────────────────────
	function fpMaxVal(totalBits, expBits) {
		const M = totalBits - 1 - expBits;
		if (M < 0 || expBits < 1) return 0;
		const bias = (1 << (expBits - 1)) - 1;
		const eMax = (1 << expBits) - 2;
		const mMax = (1 << M) - 1;
		return (1 + mMax / (1 << M)) * Math.pow(2, eMax - bias);
	}

	function fpEnumerate(totalBits, expBits) {
		const M = totalBits - 1 - expBits;
		if (M < 0) return [];
		const bias   = (1 << (expBits - 1)) - 1;
		const eMax   = (1 << expBits) - 1;
		const maxM   = 1 << M;
		const vals   = [0];
		for (let e = 0; e < eMax; e++) {
			for (let m = 0; m < maxM; m++) {
				if (e === 0 && m === 0) continue;
				const abs = e === 0
					? (m / maxM) * Math.pow(2, 1 - bias)
					: (1 + m / maxM) * Math.pow(2, e - bias);
				if (isFinite(abs) && abs > 0) { vals.push(abs); vals.push(-abs); }
			}
		}
		return vals.sort((a, b) => a - b);
	}

	function fpToBits(v, totalBits, expBits) {
		const M = totalBits - 1 - expBits;
		if (M < 0) return '0'.repeat(totalBits);
		const bias    = (1 << (expBits - 1)) - 1;
		const eAllOne = (1 << expBits) - 1;
		const maxM    = 1 << M;
		const sign    = v < 0 ? 1 : 0;
		const abs     = Math.abs(v);
		let eBits, mBits;
		if (abs === 0) {
			eBits = 0; mBits = 0;
		} else {
			const floorExp = Math.floor(Math.log2(abs));
			const biasedE  = floorExp + bias;
			if (biasedE >= 1 && biasedE <= eAllOne - 1) {
				eBits = biasedE;
				mBits = Math.max(0, Math.min(maxM - 1, Math.round((abs / Math.pow(2, floorExp) - 1) * maxM)));
			} else if (biasedE < 1) {
				eBits = 0;
				mBits = Math.max(0, Math.min(maxM - 1, Math.round(abs * maxM * Math.pow(2, bias - 1))));
			} else {
				eBits = eAllOne - 1; mBits = maxM - 1;
			}
		}
		return sign.toString()
			+ eBits.toString(2).padStart(expBits, '0')
			+ mBits.toString(2).padStart(M, '0');
	}

	function drawFPAxis(canvasId, totalBits, expBits, clickedVal, hoveredVal) {
		const canvas = document.getElementById(canvasId);
		if (!canvas) return;
		const W = canvas.parentElement.offsetWidth;
		if (W === 0) return;
		canvas.width = W * DPR; canvas.height = 80 * DPR;
		canvas.style.width = W + 'px'; canvas.style.height = '80px';
		const ctx = canvas.getContext('2d');
		ctx.scale(DPR, DPR);
		const pad = 24, axisY = 46, axisLen = W - pad * 2;
		ctx.clearRect(0, 0, W, 80);

		const M = totalBits - 1 - expBits;
		if (M < 0) {
			ctx.fillStyle = COL_MUTED; ctx.font = '11px ' + FONT; ctx.textAlign = 'center';
			ctx.fillText('Недостаточно бит', W / 2, axisY); return;
		}
		const maxV = fpMaxVal(totalBits, expBits);
		if (!isFinite(maxV) || maxV === 0) return;
		const xFor = v => pad + ((v + maxV) / (2 * maxV)) * axisLen;

		ctx.strokeStyle = COL_AXIS; ctx.lineWidth = 1;
		ctx.beginPath(); ctx.moveTo(pad, axisY); ctx.lineTo(W - pad, axisY); ctx.stroke();

		const vals = fpEnumerate(totalBits, expBits);
		ctx.strokeStyle = COL_INT + '55'; ctx.lineWidth = 1;
		let lastX = -9999;
		for (const v of vals) {
			const x = xFor(v);
			if (x >= pad - 1 && x <= W - pad + 1 && Math.abs(x - lastX) >= 0.5) {
				ctx.beginPath(); ctx.moveTo(x, axisY - 4); ctx.lineTo(x, axisY + 4); ctx.stroke();
				lastX = x;
			}
		}

		ctx.fillStyle = COL_INT; ctx.font = 'bold 11px ' + FONT;
		ctx.strokeStyle = COL_INT; ctx.lineWidth = 2; ctx.textAlign = 'center';
		[-maxV, maxV].forEach(v => {
			const x = xFor(v);
			ctx.beginPath(); ctx.moveTo(x, axisY - 8); ctx.lineTo(x, axisY + 8); ctx.stroke();
			const s = Math.abs(v) >= 1000 ? v.toFixed(0) : v.toPrecision(4);
			ctx.fillText(s, x, axisY + 20);
		});

		const zx = xFor(0);
		ctx.strokeStyle = COL_ZERO; ctx.lineWidth = 1.5;
		ctx.beginPath(); ctx.moveTo(zx, axisY - 10); ctx.lineTo(zx, axisY + 10); ctx.stroke();
		ctx.fillStyle = COL_ZERO; ctx.font = 'bold 11px ' + FONT;
		ctx.textAlign = 'center'; ctx.fillText('0', zx, axisY + 20);

		// hover takes priority over click; show label for both
		const displayVal = hoveredVal !== null ? hoveredVal : clickedVal;
		if (displayVal !== null) {
			const cx = xFor(displayVal);
			ctx.strokeStyle = COL_INT; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
			ctx.beginPath(); ctx.moveTo(cx, axisY - 26); ctx.lineTo(cx, axisY); ctx.stroke();
			ctx.setLineDash([]);
			ctx.fillStyle = COL_INT;
			ctx.beginPath(); ctx.arc(cx, axisY, 4, 0, Math.PI * 2); ctx.fill();

			const bin = fpToBits(displayVal, totalBits, expBits);
			const decStr = displayVal === 0 ? '0'
				: Math.abs(displayVal) < 0.001 ? displayVal.toExponential(2)
				: Math.abs(displayVal) >= 1000  ? displayVal.toFixed(0)
				: displayVal.toPrecision(4);
			ctx.font = 'bold 11px ' + FONT;
			const charW = ctx.measureText('0').width;
			const sepW  = ctx.measureText('|').width;
			const prefix = decStr + '  ';
			const prefixW = ctx.measureText(prefix).width;
			const obW = ctx.measureText('0b').width;
			const brkW = ctx.measureText('[').width;
			const totalW = prefixW + brkW + obW + charW + sepW + charW * expBits + sepW + charW * M + brkW;
			const lx = Math.max(totalW / 2 + 5, Math.min(cx, W - totalW / 2 - 5));
			const labelY = axisY - 30;
			ctx.fillStyle = BG;
			ctx.fillRect(lx - totalW / 2 - 2, labelY - 11, totalW + 4, 15);
			ctx.textAlign = 'left'; let curX = lx - totalW / 2;
			ctx.fillStyle = COL_INT;   ctx.fillText(prefix, curX, labelY); curX += prefixW;
			ctx.fillStyle = COL_MUTED; ctx.fillText('[',  curX, labelY); curX += brkW;
			ctx.fillStyle = COL_MUTED; ctx.fillText('0b', curX, labelY); curX += obW;
			// sign
			ctx.fillStyle = COL_SIGN;  ctx.fillText(bin[0], curX, labelY); curX += charW;
			ctx.fillStyle = COL_MUTED; ctx.fillText('|',    curX, labelY); curX += sepW;
			// exponent
			for (let i = 0; i < expBits; i++) {
				ctx.fillStyle = COL_INT; ctx.fillText(bin[1 + i], curX, labelY); curX += charW;
			}
			ctx.fillStyle = COL_MUTED; ctx.fillText('|', curX, labelY); curX += sepW;
			// mantissa
			for (let i = 0; i < M; i++) {
				ctx.fillStyle = COL_FBITS; ctx.fillText(bin[1 + expBits + i], curX, labelY); curX += charW;
			}
			ctx.fillStyle = COL_MUTED; ctx.fillText(']', curX, labelY);
		}
	}

	// ── Update ──────────────────────────────────────────────────
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
		const { total } = fpState;
		const eSl = document.getElementById('cmp-fp-e');
		eSl.max = total - 2; // total fixed at 8 → max E = 6
		fpState.expBits = Math.min(fpState.expBits, total - 2);
		eSl.value = fpState.expBits;
		const M    = Math.max(0, total - 1 - fpState.expBits);
		const maxV = fpMaxVal(total, fpState.expBits);
		const cnt  = (1 << total) - 2 * (1 << M);

		const fmtFP = v => isFinite(v) ? (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toPrecision(4)) : '∞';
		document.getElementById('cmp-fp-e-val').textContent    = fpState.expBits;
		document.getElementById('cmp-fp-e-lbl').textContent    = fpState.expBits;
		document.getElementById('cmp-fp-m-lbl').textContent    = M;
		document.getElementById('cmp-fp-min').textContent      = isFinite(maxV) ? ('−' + fmtFP(maxV)) : '−∞';
		document.getElementById('cmp-fp-max').textContent      = fmtFP(maxV);
		document.getElementById('cmp-fp-count').textContent    = cnt > 0 ? cnt.toLocaleString('ru') : '—';
		drawFPAxis('cmp-fp-canvas', total, fpState.expBits, fpState.clicked, fpState.hovered);
	}

	function redrawAll() { updateFrac(); updateFP(); }

	// ── Snap helpers ────────────────────────────────────────────
	function nearestFP(pixX, W) {
		const maxV = fpMaxVal(fpState.total, fpState.expBits);
		if (!isFinite(maxV) || maxV === 0) return null;
		const target = -maxV + ((pixX - 24) / (W - 48)) * 2 * maxV;
		const vals = fpEnumerate(fpState.total, fpState.expBits);
		let best = vals[0], bestD = Infinity;
		for (const v of vals) { const d = Math.abs(v - target); if (d < bestD) { bestD = d; best = v; } }
		return best;
	}

	function snapFrac(pixX, W) {
		const r = fracRange(fracState.m, fracState.n, fracState.signed);
		if (r.count === 0) return;
		const frac = (pixX - 24) / (W - 48);
		const val  = r.min + frac * (r.max - r.min);
		const idx  = Math.max(0, Math.min(r.count - 1, Math.round((val - r.min) / r.step)));
		fracState.clicked = r.min + idx * r.step;
	}

	function snapFP(pixX, W) {
		const best = nearestFP(pixX, W);
		if (best !== null) fpState.clicked = best;
	}

	// ── Init ────────────────────────────────────────────────────
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
			const frac = (e.clientX - r.left - 24) / (r.width - 48);
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
