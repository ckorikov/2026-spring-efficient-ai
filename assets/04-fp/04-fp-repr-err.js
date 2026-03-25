(function () {
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
			eMax: (function() { var v = parseInt(document.getElementById('re-emax').value); return isFinite(v) ? v : undefined; })(),
			eMin: (function() { var v = parseInt(document.getElementById('re-emax').value); return isFinite(v) ? 1 - v : undefined; })(),
			subnorm: (function() { var el = document.getElementById('re-subnorm'); return el ? el.checked : false; })(),
		};
	}

	function computeFP(x, beta, p, round, eMin, eMax, subnorm) {
		if (!isFinite(x) || x === 0) return null;
		round = round || 'nearest';
		var effRound = round;
		if (x < 0) {
			if (round === 'ceil') effRound = 'floor';
			else if (round === 'floor') effRound = 'ceil';
		}
		var ax = Math.abs(x);
		var e = Math.floor(Math.log(ax) / Math.log(beta));
		if (Math.pow(beta, e + 1) <= ax) e++;
		if (Math.pow(beta, e) > ax) e--;
		var isOverflow = eMax !== undefined && e > eMax;
		var isSubnormal = eMin !== undefined && e < eMin;

		if (isSubnormal && !subnorm) {
			var minNorm = Math.pow(beta, eMin);
			var dLo = ax, dHi = minNorm - ax;
			var fl;
			switch (effRound) {
				case 'nearest':
					if (dLo < dHi) fl = 0;
					else if (dHi < dLo) fl = minNorm;
					else fl = 0;
					break;
				case 'away':
					fl = (dLo < dHi) ? 0 : minNorm;
					break;
				case 'ceil':  fl = (ax === 0) ? 0 : minNorm; break;
				case 'floor': fl = 0; break;
				case 'trunc': fl = 0; break;
				default:      fl = (dLo <= dHi) ? 0 : minNorm;
			}
			var isDirected = (round === 'ceil' || round === 'floor' || round === 'trunc');
			var abs_err = Math.abs(ax - fl);
			return {
				x: ax, sign: x < 0 ? -1 : 1, e: e,
				ulp: minNorm, eps: 0.5 * Math.pow(beta, 1 - p),
				fl: fl, fl_floor: 0, fl_ceil: minNorm,
				abs_err: abs_err, rel_err: abs_err / ax, err_ulp: abs_err / minNorm,
				grid: [-minNorm, 0, minNorm, 2 * minNorm],
				directed: isDirected, isOverflow: false, isSubnormal: false,
				isFlushed: true, eMin: eMin, eMax: eMax
			};
		}
		if (isOverflow) {
			return {
				x: ax, sign: x < 0 ? -1 : 1, e: e,
				ulp: null, eps: 0.5 * Math.pow(beta, 1 - p),
				fl: Infinity, abs_err: Infinity, rel_err: Infinity, err_ulp: Infinity,
				grid: null, directed: false,
				isOverflow: true, isSubnormal: false, eMin: eMin, eMax: eMax
			};
		}

		var ulp = isSubnormal ? Math.pow(beta, eMin + 1 - p) : Math.pow(beta, e + 1 - p);
		var fl_k = Math.floor(ax / ulp);
		var fl_floor = fl_k * ulp;
		var fl_ceil  = fl_floor + ulp;

		dLo = Math.abs(ax - fl_floor); dHi = Math.abs(ax - fl_ceil);
		switch (effRound) {
			case 'nearest':
				if (dLo < dHi) fl = fl_floor;
				else if (dHi < dLo) fl = fl_ceil;
				else fl = (fl_k % 2 === 0) ? fl_floor : fl_ceil;
				break;
			case 'away':
				fl = (dLo < dHi) ? fl_floor : fl_ceil;
				break;
			case 'ceil':  fl = (ax === fl_floor) ? fl_floor : fl_ceil; break;
			case 'floor': fl = fl_floor; break;
			case 'trunc': fl = fl_floor; break;
			default:      fl = (dLo <= dHi) ? fl_floor : fl_ceil;
		}

		var eps     = 0.5 * Math.pow(beta, 1 - p);
		abs_err = Math.abs(ax - fl);
		var rel_err = abs_err / ax;
		isDirected = (round === 'ceil' || round === 'floor' || round === 'trunc');

		return {
			x: ax, sign: x < 0 ? -1 : 1,
			e: e, ulp: ulp, eps: eps,
			fl_floor: fl_floor, fl_ceil: fl_ceil, fl: fl,
			abs_err: abs_err, rel_err: rel_err, err_ulp: abs_err / ulp,
			grid: [fl_floor - ulp, fl_floor, fl_ceil, fl_ceil + ulp],
			directed: isDirected,
			isSubnormal: isSubnormal, isOverflow: false, eMin: eMin, eMax: eMax
		};
	}

	// ── β-format display ──────────────────────────────────

	function dc(d) { return d < 10 ? String(d) : String.fromCharCode(87 + d); }

	function updateRepr(info, beta, p) {
		var el = document.getElementById('re-repr');
		if (!el) return;
		if (!info || info.isOverflow) { el.innerHTML = ''; return; }

		var fl = info.sign * info.fl;
		var av = Math.abs(fl);

		if (av === 0) {
			var zeros = '';
			for (var i = 1; i < p; i++) zeros += '0';
			var eZ = info.eMin !== undefined ? info.eMin : 0;
			el.innerHTML = 'fl(x) = <span class="re-repr-d0 re-repr-zero">0</span>.'
				+ '<span class="re-repr-zero">' + zeros + '</span>'
				+ ' <span class="re-repr-mul">×</span> '
				+ beta + '<sup class="re-repr-exp">' + eZ + '</sup>'
				+ ' <span class="re-repr-mul">= 0</span>';
			return;
		}

		var isSub = info.isSubnormal;
		var useE;
		if (isSub && info.eMin !== undefined) {
			useE = info.eMin;
		} else {
			useE = Math.floor(Math.log(av) / Math.log(beta));
			if (Math.pow(beta, useE + 1) <= av) useE++;
			if (Math.pow(beta, useE) > av) useE--;
		}
		var rem = av / Math.pow(beta, useE);
		var digits = [];
		for (i = 0; i < p; i++) {
			var d = Math.floor(rem + 1e-12);
			d = Math.max(0, Math.min(beta - 1, d));
			digits.push(d);
			rem = (rem - d) * beta;
		}

		var cls = isSub ? 're-repr-sub' : 're-repr-norm';
		var sgn = fl < 0 ? '−' : '';
		var frac = '';
		for (i = 1; i < p; i++) frac += dc(digits[i]);

		el.innerHTML = 'fl(x) = ' + sgn
			+ '<span class="re-repr-d0 ' + cls + '">' + dc(digits[0]) + '</span>.'
			+ '<span class="' + cls + '">' + frac + '</span>'
			+ ' <span class="re-repr-mul">×</span> '
			+ beta + '<sup class="re-repr-exp">' + useE + '</sup>'
			+ ' <span class="re-repr-mul">= ' + fmtN(fl) + '</span>';
	}

	var fmtN = FpFmt.fmtN;

	// ── Canvas drawing ────────────────────────────────────

	var _markerPos = null;

	function drawAxis(canvas, info) {
		var dpr = window.devicePixelRatio || 1;
		var W = canvas.offsetWidth;
		canvas.width  = W * dpr;
		canvas.height = CANVAS_H * dpr;
		canvas.style.height = CANVAS_H + 'px';
		var ctx = canvas.getContext('2d');
		ctx.scale(dpr, dpr);

		_markerPos = null;

		if (info.isOverflow) {
			ctx.font = '600 16px ' + RE.FONT;
			ctx.fillStyle = RE.COL_ERR;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText('±∞  (e = ' + info.e + ' > e_max = ' + info.eMax + ')', W / 2, CANVAS_H / 2);
			ctx.textBaseline = 'alphabetic';
			return;
		}

		var sign = info.sign || 1;
		var dGrid, dX, dFl, dFloor, dCeil;
		if (sign < 0) {
			dGrid = [-info.grid[3], -info.grid[2], -info.grid[1], -info.grid[0]];
			dX = -info.x; dFl = -info.fl;
			dFloor = -info.fl_ceil; dCeil = -info.fl_floor;
		} else {
			dGrid = info.grid; dX = info.x; dFl = info.fl;
			dFloor = info.fl_floor; dCeil = info.fl_ceil;
		}

		var axY = PAD_T + (CANVAS_H - PAD_T - PAD_B) / 2;
		var pW  = W - PAD_L - PAD_R;
		var lo = dGrid[0], hi = dGrid[3];
		var span = hi - lo;
		var vlo = lo - span * 0.15, vhi = hi + span * 0.15;
		function px(v) { return PAD_L + (v - vlo) / (vhi - vlo) * pW; }

		ctx.font = '10px ' + RE.FONT;

		// Axis line
		ctx.strokeStyle = RE.COL_AXIS;
		ctx.lineWidth = 1.5;
		ctx.beginPath(); ctx.moveTo(PAD_L - 10, axY); ctx.lineTo(W - PAD_R + 10, axY); ctx.stroke();

		// Grid ticks & labels
		dGrid.forEach(function (gv) {
			var gx = px(gv);
			var isNearest = (Math.abs(gv - dFl) < info.ulp * 0.001);
			ctx.strokeStyle = isNearest ? RE.COL_NEAREST : RE.COL_GRID;
			ctx.lineWidth = isNearest ? 2.5 : 1;
			ctx.beginPath(); ctx.moveTo(gx, axY - 8); ctx.lineTo(gx, axY + 8); ctx.stroke();
			ctx.fillStyle = isNearest ? RE.COL_NEAREST : RE.COL_GRID;
			ctx.font = (isNearest ? '600 ' : '') + '10px ' + RE.FONT;
			ctx.textAlign = 'center';
			ctx.fillText(fmtN(gv), gx, axY + 20);
		});

		// ULP bracket
		var ffx = px(dFloor), fcx = px(dCeil);
		var bracY = axY + 30;
		ctx.strokeStyle = RE.COL_ULP; ctx.lineWidth = 1.2;
		ctx.beginPath(); ctx.moveTo(ffx, bracY - 4); ctx.lineTo(ffx, bracY + 4); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(ffx, bracY); ctx.lineTo(fcx, bracY); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(fcx, bracY - 4); ctx.lineTo(fcx, bracY + 4); ctx.stroke();
		ctx.fillStyle = RE.COL_ULP; ctx.font = '9px ' + RE.FONT; ctx.textAlign = 'center';
		ctx.fillText('ulp = ' + fmtN(info.ulp), (ffx + fcx) / 2, bracY + 13);

		// x marker
		var rx = px(dX);
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

		// Error arrow
		if (info.abs_err > info.ulp * 1e-9) {
			var flx = px(dFl);
			var errY = axY - 5;
			ctx.strokeStyle = RE.COL_ERR; ctx.lineWidth = 1.8;
			ctx.setLineDash([4, 2]);
			ctx.beginPath(); ctx.moveTo(rx, errY); ctx.lineTo(flx, errY); ctx.stroke();
			ctx.setLineDash([]);
			var aLen = 4;
			var dir = flx > rx ? 1 : -1;
			ctx.fillStyle = RE.COL_ERR;
			ctx.beginPath(); ctx.moveTo(flx, errY); ctx.lineTo(flx - dir*aLen, errY - aLen); ctx.lineTo(flx - dir*aLen, errY + aLen); ctx.fill();
			ctx.beginPath(); ctx.moveTo(rx, errY); ctx.lineTo(rx + dir*aLen, errY - aLen); ctx.lineTo(rx + dir*aLen, errY + aLen); ctx.fill();
			ctx.fillStyle = RE.COL_ERR; ctx.font = '9px ' + RE.FONT; ctx.textAlign = 'center';
			ctx.fillText('err', (rx + flx) / 2, errY - 6);
		}
	}

	// ── Stats table ───────────────────────────────────────

	function updateStats(info) {
		var el = document.getElementById('re-stats');
		if (!el) return;
		if (info.isOverflow) {
			el.innerHTML = '<table class="re-table"><tbody><tr>'
				+ '<td class="re-st-lbl">тип</td>'
				+ '<td class="re-st-val" style="color:' + RE.COL_ERR + '">переполнение (±∞)</td>'
				+ '</tr></tbody></table>';
			return;
		}
		var eps = info.eps;
		var zone = info.isFlushed ? 'flush→0' : info.isSubnormal ? 'субнорм.' : 'норм.';
		var zoneWarn = info.isFlushed || info.isSubnormal;
		var zoneColor = zoneWarn ? RE.COL_ERR : RE.COL_ULP;
		function row(lbl, val, inEps, warn) {
			var cls = warn ? ' style="color:' + RE.COL_ERR + '"' : '';
			return '<tr><td class="re-st-lbl">' + lbl + '</td>'
				 + '<td class="re-st-val">' + val + '</td>'
				 + '<td class="re-st-eps"' + cls + '>' + inEps + '</td></tr>';
		}
		var relInEps = info.rel_err / eps;
		var relWarn = !info.directed && relInEps > 1.001;
		el.innerHTML =
			'<table class="re-table"><thead><tr>'
			+ '<th></th><th>значение</th><th>в ε</th>'
			+ '</tr></thead><tbody>'
			+ '<tr><td class="re-st-lbl">тип</td><td class="re-st-val" style="color:' + zoneColor + '">' + zone + '</td><td></td></tr>'
			+ row('ε', fmtN(eps, 3), '1')
			+ row('ulp(x)', fmtN(info.ulp, 3), fmtN(info.ulp / eps, 3))
			+ row('|err|', fmtN(info.abs_err, 3), fmtN(info.abs_err / eps, 3))
			+ row('|err|/|x|', fmtN(info.rel_err, 3), fmtN(relInEps, 3), relWarn)
			+ '</tbody></table>';
	}

	// ── Main update ───────────────────────────────────────

	function reUpdate() {
		var par = readParams();
		if (!isFinite(par.x) || par.beta < 2 || par.p < 1) return;
		var info;
		if (par.x === 0 && _drag.active && _drag.grid && _drag.grid.grid) {
			var g = _drag.grid;
			info = {
				x: 0, sign: g.sign || 1, e: g.e, ulp: g.ulp, eps: g.eps,
				fl_floor: g.fl_floor, fl_ceil: g.fl_ceil, fl: 0,
				abs_err: 0, rel_err: 0, err_ulp: 0,
				grid: g.grid, directed: g.directed,
				isSubnormal: false, isOverflow: false, isFlushed: g.isFlushed,
				eMin: g.eMin, eMax: g.eMax
			};
		} else {
			if (par.x === 0) return;
			info = computeFP(par.x, par.beta, par.p, par.round, par.eMin, par.eMax, par.subnorm);
			if (!info) return;
			if (_drag.active && _drag.grid && _drag.grid.grid) {
				info.grid = _drag.grid.grid;
				info.fl_floor = _drag.grid.fl_floor;
				info.fl_ceil = _drag.grid.fl_ceil;
				info.ulp = _drag.grid.ulp;
			} else if (info.grid) {
				_lastInfo = info;
			}
		}
		var canvas = getCanvas();
		if (!canvas || canvas.offsetWidth === 0) return;
		drawAxis(canvas, info);
		updateRepr(info, par.beta, par.p);
		updateStats(info);
	}

	// ── Drag ──────────────────────────────────────────────

	var _drag = { active: false, grid: null, offsetPx: 0 };
	var _lastInfo = null;  // grid from last non-drag render

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

	function eventClient(e) {
		var src = (e.clientX != null) ? e : (e.touches && e.touches[0]);
		return { x: src ? src.clientX : 0, y: src ? src.clientY : 0 };
	}

	function startDrag(e) {
		var canvas = getCanvas();
		if (!canvas) return;
		var pt = eventClient(e); var cx = pt.x, cy = pt.y;
		if (!isNearMarker(canvas, cx, cy)) return;
		if (!_lastInfo || !_lastInfo.grid) return;
		_drag.active = true;
		_drag.grid = _lastInfo;
		var rect = canvas.getBoundingClientRect();
		var scale = cssScale(canvas);
		_drag.offsetPx = _markerPos.x - (cx - rect.left) * scale;
		canvas.classList.add('dragging');
		e.preventDefault();
	}

	function moveDrag(e) {
		var canvas = getCanvas();
		if (!canvas) return;
		var pt = eventClient(e); var cx = pt.x, cy = pt.y;
		if (!_drag.active) {
			canvas.classList.toggle('re-hover-x', isNearMarker(canvas, cx, cy));
			return;
		}
		var info = _drag.grid;
		if (!info || !info.grid) return;
		var dSign = info.sign || 1;
		var dGrid;
		if (dSign < 0) {
			dGrid = [-info.grid[3], -info.grid[2], -info.grid[1], -info.grid[0]];
		} else {
			dGrid = info.grid;
		}
		var rect = canvas.getBoundingClientRect();
		var scale = cssScale(canvas);
		var W = canvas.offsetWidth;
		var pW = W - PAD_L - PAD_R;
		var lo = dGrid[0], hi = dGrid[3];
		var span = hi - lo;
		var vlo = lo - span * 0.15, vhi = hi + span * 0.15;
		var canvasX = (cx - rect.left) * scale + _drag.offsetPx;
		var relX = (canvasX - PAD_L) / pW;
		var val = vlo + relX * (vhi - vlo);
		val = Math.max(dGrid[1], Math.min(dGrid[2], val));
		var ulpDigits = Math.max(0, -Math.floor(Math.log10(info.ulp))) + 1;
		var s = parseFloat(val.toFixed(ulpDigits));
		if (s < dGrid[1] || s > dGrid[2]) s = val;
		document.getElementById('re-x').value = s;
		reUpdate();
		e.preventDefault();
	}

	function endDrag() {
		if (!_drag.active) return;
		_drag.active = false;
		_lastInfo = _drag.grid;
		var canvas = getCanvas();
		if (canvas) canvas.classList.remove('dragging');
	}

	// ── Init ──────────────────────────────────────────────

	document.addEventListener('DOMContentLoaded', function () {
		['re-x','re-beta','re-p','re-emax'].forEach(function (id) {
			var el = document.getElementById(id);
			if (el) el.addEventListener('input', reUpdate);
		});
		var reSubEl = document.getElementById('re-subnorm');
		if (reSubEl) reSubEl.addEventListener('change', reUpdate);
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
