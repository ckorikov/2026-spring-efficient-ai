(function () {
	// ── Layout constants ───────────────────────────────────
	var PAD_L = 60, PAD_R = 60, PAD_T = 34, PAD_B = 48;
	var CANVAS_H = 130;
	var MARKER_R = 6, HIT_R = MARKER_R + 8;

	var RE = {
		COL_AXIS:    '#c8c3bb',
		COL_GRID:    '#8a857d',
		COL_NEAREST: '#6a8fa5',
		COL_X:       '#2d2a26',
		COL_ERR:     '#a07060',
		COL_ULP:     '#5a8a5a',
		COL_MUTED:   '#b5b0a8',
		FONT:        'IBM Plex Mono, monospace',
	};

	// ── Helpers ────────────────────────────────────────────
	function getCanvas() { return document.getElementById('re-canvas'); }

	function cssScale(canvas) {
		var r = canvas.getBoundingClientRect();
		return r.width > 0 ? canvas.offsetWidth / r.width : 1;
	}

	function readParams() {
		return {
			x:     parseFloat(document.getElementById('re-x').value),
			beta:  parseInt(document.getElementById('re-beta').value),
			p:     parseInt(document.getElementById('re-p').value),
			round: document.getElementById('re-round').dataset.value,
		};
	}

	function computeFP(x, beta, p, round) {
		if (!isFinite(x) || x === 0) return null;
		round = round || 'nearest';
		var ax = Math.abs(x);
		var e = Math.floor(Math.log(ax) / Math.log(beta));
		// Edge-case: floating log can be off by 1
		if (Math.pow(beta, e + 1) <= ax) e++;
		if (Math.pow(beta, e) > ax) e--;
		var ulp = Math.pow(beta, e + 1 - p);
		var fl_k = Math.floor(ax / ulp);
		var fl_floor = fl_k * ulp;
		var fl_ceil  = fl_floor + ulp;
		// Rounding mode
		var fl;
		var dLo = Math.abs(ax - fl_floor), dHi = Math.abs(ax - fl_ceil);
		switch (round) {
			case 'nearest': // ties-to-even
				if (dLo < dHi) fl = fl_floor;
				else if (dHi < dLo) fl = fl_ceil;
				else fl = (fl_k % 2 === 0) ? fl_floor : fl_ceil; // tie → even
				break;
			case 'away': // ties-away-from-zero
				fl = (dLo < dHi) ? fl_floor : fl_ceil;
				break;
			case 'ceil':  fl = (ax === fl_floor) ? fl_floor : fl_ceil; break;
			case 'floor': fl = fl_floor; break;
			case 'trunc': fl = fl_floor; break;
			default:      fl = (dLo <= dHi) ? fl_floor : fl_ceil;
		}
		var eps     = Math.pow(beta, 1 - p);
		var abs_err = Math.abs(ax - fl);
		var rel_err = abs_err / ax;
		var err_ulp = abs_err / ulp;
		var isDirected = (round === 'ceil' || round === 'floor' || round === 'trunc');
		return {
			x: ax, sign: x < 0 ? -1 : 1,
			e: e, ulp: ulp, eps: eps,
			fl_floor: fl_floor, fl_ceil: fl_ceil, fl: fl,
			abs_err: abs_err, rel_err: rel_err, err_ulp: err_ulp,
			grid: [fl_floor - ulp, fl_floor, fl_ceil, fl_ceil + ulp],
			directed: isDirected,
		};
	}

	function fmtN(v, prec) {
		prec = prec || 4;
		if (v === 0) return '0';
		var a = Math.abs(v);
		if (a >= 1e-4 && a < 1e5) return parseFloat(v.toPrecision(prec)).toString();
		return v.toExponential(prec - 1);
	}

	function drawAxis(canvas, info) {
		var dpr = window.devicePixelRatio || 1;
		var W = canvas.offsetWidth;
		canvas.width  = W * dpr;
		canvas.height = CANVAS_H * dpr;
		canvas.style.height = CANVAS_H + 'px';
		var ctx = canvas.getContext('2d');
		ctx.scale(dpr, dpr);

		var axY = PAD_T + (CANVAS_H - PAD_T - PAD_B) / 2;
		var pW  = W - PAD_L - PAD_R;

		var lo = info.grid[0], hi = info.grid[3];
		var span = hi - lo;
		var vlo = lo - span * 0.15, vhi = hi + span * 0.15;
		function px(v) { return PAD_L + (v - vlo) / (vhi - vlo) * pW; }

		ctx.font = '10px ' + RE.FONT;

		// Axis line
		ctx.strokeStyle = RE.COL_AXIS;
		ctx.lineWidth = 1.5;
		ctx.beginPath(); ctx.moveTo(PAD_L - 10, axY); ctx.lineTo(W - PAD_R + 10, axY); ctx.stroke();

		// Grid ticks & labels
		info.grid.forEach(function (gv) {
			var gx = px(gv);
			var isNearest = (Math.abs(gv - info.fl) < info.ulp * 0.001);
			ctx.strokeStyle = isNearest ? RE.COL_NEAREST : RE.COL_GRID;
			ctx.lineWidth = isNearest ? 2.5 : 1;
			ctx.beginPath(); ctx.moveTo(gx, axY - 8); ctx.lineTo(gx, axY + 8); ctx.stroke();
			ctx.fillStyle = isNearest ? RE.COL_NEAREST : RE.COL_GRID;
			ctx.font = (isNearest ? '600 ' : '') + '10px ' + RE.FONT;
			ctx.textAlign = 'center';
			ctx.fillText(fmtN(gv), gx, axY + 20);
		});

		// ULP bracket (between fl_floor and fl_ceil)
		var ffx = px(info.fl_floor), fcx = px(info.fl_ceil);
		var bracY = axY + 30;
		ctx.strokeStyle = RE.COL_ULP; ctx.lineWidth = 1.2;
		ctx.beginPath(); ctx.moveTo(ffx, bracY - 4); ctx.lineTo(ffx, bracY + 4); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(ffx, bracY); ctx.lineTo(fcx, bracY); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(fcx, bracY - 4); ctx.lineTo(fcx, bracY + 4); ctx.stroke();
		ctx.fillStyle = RE.COL_ULP; ctx.font = '9px ' + RE.FONT; ctx.textAlign = 'center';
		ctx.fillText('ulp = ' + fmtN(info.ulp), (ffx + fcx) / 2, bracY + 13);

		// Real x marker — dashed drop line from x to axis, then circle
		var rx = px(info.x);
		var markerY = axY - 20;
		ctx.strokeStyle = RE.COL_X; ctx.lineWidth = 1;
		ctx.setLineDash([3, 3]);
		ctx.beginPath(); ctx.moveTo(rx, markerY); ctx.lineTo(rx, axY); ctx.stroke();
		ctx.setLineDash([]);
		ctx.fillStyle = RE.COL_X;
		ctx.beginPath(); ctx.arc(rx, markerY, MARKER_R, 0, 2 * Math.PI); ctx.fill();
		ctx.fillStyle = '#fff'; ctx.font = '600 8px ' + RE.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.fillText('x', rx, markerY);
		ctx.textBaseline = 'alphabetic';
		_markerPos = { x: rx, y: markerY, r: HIT_R };

		// Error line (x → fl)
		var flx = px(info.fl);
		if (info.abs_err > 0) {
			var errY = axY - 5;
			ctx.strokeStyle = RE.COL_ERR; ctx.lineWidth = 1.8;
			ctx.setLineDash([4, 2]);
			ctx.beginPath(); ctx.moveTo(rx, errY); ctx.lineTo(flx, errY); ctx.stroke();
			ctx.setLineDash([]);
			// Arrow heads (double-headed)
			var aLen = 4;
			var dir = flx > rx ? 1 : -1;
			ctx.fillStyle = RE.COL_ERR;
			// Arrow at fl(x) end
			ctx.beginPath(); ctx.moveTo(flx, errY); ctx.lineTo(flx - dir*aLen, errY - aLen); ctx.lineTo(flx - dir*aLen, errY + aLen); ctx.fill();
			// Arrow at x end
			ctx.beginPath(); ctx.moveTo(rx, errY); ctx.lineTo(rx + dir*aLen, errY - aLen); ctx.lineTo(rx + dir*aLen, errY + aLen); ctx.fill();
			var midX = (rx + flx) / 2;
			ctx.fillStyle = RE.COL_ERR; ctx.font = '9px ' + RE.FONT; ctx.textAlign = 'center';
			ctx.fillText('err', midX, errY - 6);
		}
	}

	function updateStats(info) {
		var el = document.getElementById('re-stats');
		if (!el) return;
		var eps = info.eps;
		// Directed rounding (ceil/floor/trunc): bound is 1 ulp / ε
		// Nearest rounding: bound is ½ ulp / ½ε
		var bUlp = info.directed ? info.ulp : info.ulp / 2;
		var bEps = info.directed ? eps : eps / 2;
		function row(lbl, val, inEps, bound) {
			return '<tr><td class="re-st-lbl">' + lbl + '</td>'
				 + '<td class="re-st-val">' + val + '</td>'
				 + '<td class="re-st-eps">' + inEps + '</td>'
				 + '<td class="re-st-eps" style="color:#8a857d;font-style:italic">' + bound + '</td></tr>';
		}
		el.innerHTML =
			'<table class="re-table"><thead><tr>'
			+ '<th></th><th>значение</th><th>в ε</th><th>≤ граница</th>'
			+ '</tr></thead><tbody>'
			+ row('ε', fmtN(eps, 3), '1', '')
			+ row('ulp(x)', fmtN(info.ulp, 3), fmtN(info.ulp / eps, 3), '')
			+ row('|err|', fmtN(info.abs_err, 3),
				   fmtN(info.abs_err / eps, 3),
				   '≤ <span style="color:#b5b0a8">' + fmtN(bUlp, 3) + '</span>')
			+ row('|err|/|x|', fmtN(info.rel_err, 3),
				   fmtN(info.rel_err / eps, 3),
				   '≤ <span style="color:#b5b0a8">' + fmtN(bEps, 3) + '</span>')
			+ '</tbody></table>';
	}

	function reUpdate() {
		var par = readParams();
		if (!isFinite(par.x) || par.x === 0 || par.beta < 2 || par.p < 1) return;
		var info = computeFP(par.x, par.beta, par.p, par.round);
		if (!info) return;
		var canvas = getCanvas();
		if (!canvas || canvas.offsetWidth === 0) return;
		drawAxis(canvas, info);
		updateStats(info);
	}

	// ── Drag x on the canvas ────────────────────────────
	var _drag = { active: false, grid: null, offsetPx: 0 };
	var _markerPos = null; // {x, y, r} in CSS px, set by drawAxis

	function isNearMarker(canvas, clientX, clientY) {
		if (!_markerPos) return false;
		var rect = canvas.getBoundingClientRect();
		var scale = cssScale(canvas);
		var mx = (clientX - rect.left) * scale;
		var my = (clientY - rect.top) * scale;
		var dx = mx - _markerPos.x;
		var dy = my - _markerPos.y;
		return dx * dx + dy * dy <= _markerPos.r * _markerPos.r;
	}

	function startDrag(e) {
		var canvas = getCanvas();
		if (!canvas) return;
		var cx = e.clientX != null ? e.clientX : (e.touches && e.touches[0].clientX);
		var cy = e.clientY != null ? e.clientY : (e.touches && e.touches[0].clientY);
		if (!isNearMarker(canvas, cx, cy)) return;
		var par = readParams();
		var info = computeFP(par.x, par.beta, par.p, par.round);
		_drag.active = true;
		_drag.grid = info;
		var rect = canvas.getBoundingClientRect();
		var scale = cssScale(canvas);
		_drag.offsetPx = _markerPos.x - (cx - rect.left) * scale;
		canvas.classList.add('dragging');
		e.preventDefault();
	}
	function moveDrag(e) {
		var canvas = getCanvas();
		if (!canvas) return;
		var cx = e.clientX != null ? e.clientX : (e.touches && e.touches[0].clientX);
		var cy = e.clientY != null ? e.clientY : (e.touches && e.touches[0].clientY);
		if (!_drag.active) {
			canvas.classList.toggle('re-hover-x', isNearMarker(canvas, cx, cy));
			return;
		}
		var info = _drag.grid;
		if (!info) return;
		var rect = canvas.getBoundingClientRect();
		var scale = cssScale(canvas);
		var W = canvas.offsetWidth;
		var pW = W - PAD_L - PAD_R;
		var lo = info.grid[0], hi = info.grid[3];
		var span = hi - lo;
		var vlo = lo - span * 0.15, vhi = hi + span * 0.15;
		var canvasX = (cx - rect.left) * scale + _drag.offsetPx;
		var relX = (canvasX - PAD_L) / pW;
		var val = vlo + relX * (vhi - vlo);
		// Clamp to [fl_floor, fl_ceil] — keeps x inside one ULP interval
		val = Math.max(info.grid[1], Math.min(info.grid[2], val));
		if (val <= 0) return;
		document.getElementById('re-x').value = parseFloat(val.toPrecision(4));
		reUpdate();
		e.preventDefault();
	}
	function endDrag() {
		if (!_drag.active) return;
		_drag.active = false;
		var canvas = getCanvas();
		if (canvas) canvas.classList.remove('dragging');
	}

	document.addEventListener('DOMContentLoaded', function () {
		['re-x','re-beta','re-p'].forEach(function (id) {
			var el = document.getElementById(id);
			if (el) el.addEventListener('input', reUpdate);
		});
		document.querySelectorAll('.re-round-btn').forEach(function (btn) {
			btn.addEventListener('click', function () {
				document.querySelectorAll('.re-round-btn').forEach(function (b) { b.classList.remove('active'); });
				btn.classList.add('active');
				document.getElementById('re-round').dataset.value = btn.dataset.val;
				reUpdate();
			});
		});
		var canvas = getCanvas();
		if (canvas) {
			canvas.addEventListener('mousedown', startDrag);
			canvas.addEventListener('touchstart', startDrag, { passive: false });
			document.addEventListener('mousemove', moveDrag);
			document.addEventListener('touchmove', moveDrag, { passive: false });
			document.addEventListener('mouseup', endDrag);
			document.addEventListener('touchend', endDrag);
		}
		setTimeout(reUpdate, 150);
	});

	if (typeof Reveal !== 'undefined') {
		Reveal.on('slidechanged', function (e) {
			if (e.currentSlide && e.currentSlide.querySelector('#re-canvas'))
				setTimeout(reUpdate, 50);
		});
	}
})();
