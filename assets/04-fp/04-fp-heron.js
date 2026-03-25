(function () {
	var heronNaive = FpHeron.heronNaive;
	var heronKahan = FpHeron.heronKahan;
	var heronExact = FpHeron.heronExact;
	var ulpOf = FpHeron.ulpOf;

	function dist(A, B) {
		var dx = A.x - B.x, dy = A.y - B.y;
		return Math.sqrt(dx * dx + dy * dy);
	}
	function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
	function fmt(v, d) {
		if (v !== v) return 'NaN';
		if (!isFinite(v)) return v > 0 ? '+∞' : '−∞';
		if (Math.abs(v) < 1e-12) return '0';
		return Number(v).toFixed(d).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
	}
	function isValidTriangle(P1, P2, P3) {
		var a = dist(P1, P2), b = dist(P2, P3), c = dist(P3, P1);
		return a > 0.1 && b > 0.1 && c > 0.1
			&& (a + b > c + 0.001) && (a + c > b + 0.001) && (b + c > a + 0.001);
	}

	function getHInt(id, def)  { var el = document.getElementById(id); return el ? (parseInt(el.value) || def) : def; }
	function getHBool(id, def) { var el = document.getElementById(id); return el ? el.checked : def; }

	var state = {
		P1: { x: 120, y: 200 },
		P2: { x: 540, y: 200 },
		P3: { x: 330, y: 175 },
		scale: 9 / 420,
		drag: null,
		dragId: null,
		w: 660,
		h: 360,
		pad: 12
	};

	function sides() {
		var sc = state.scale || 1;
		return {
			a: dist(state.P1, state.P2) * sc,
			b: dist(state.P2, state.P3) * sc,
			c: dist(state.P3, state.P1) * sc
		};
	}

	function svgPoint(svg, ev) {
		var pt = svg.createSVGPoint();
		pt.x = ev.clientX;
		pt.y = ev.clientY;
		var ctm = svg.getScreenCTM();
		if (!ctm) return { x: state.w / 2, y: state.h / 2 };
		var p = pt.matrixTransform(ctm.inverse());
		return {
			x: clamp(p.x, state.pad, state.w - state.pad),
			y: clamp(p.y, state.pad, state.h - state.pad)
		};
	}

	function syncViewBox() {
		var svg = document.getElementById('heron-svg');
		if (!svg) return;
		var rect = svg.getBoundingClientRect();
		if (rect.width > 0 && rect.height > 0) {
			state.w = rect.width;
			state.h = rect.height;
		}
		svg.setAttribute('viewBox', '0 0 ' + state.w + ' ' + state.h);
	}

	function renderTriangle() {
		var svg = document.getElementById('heron-svg');
		if (!svg) return;
		syncViewBox();

		var p1 = state.P1;
		var p2 = state.P2;
		var p3 = state.P3;

		function edgeLabel(pa, pb, opp, txt, cls) {
			var mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
			var dx = mx - opp.x, dy = my - opp.y;
			var len = Math.sqrt(dx * dx + dy * dy) || 1;
			var off = 16;
			return '<text x="' + (mx + dx / len * off) + '" y="' + (my + dy / len * off) + '"'
				+ ' dominant-baseline="middle" class="heron-label ' + cls + '">' + txt + '</text>';
		}

		svg.innerHTML = ''
			+ '<polygon points="' + p1.x + ',' + p1.y + ' ' + p2.x + ',' + p2.y + ' ' + p3.x + ',' + p3.y + '" class="heron-tri-fill"></polygon>'
			+ '<line x1="' + p1.x + '" y1="' + p1.y + '" x2="' + p2.x + '" y2="' + p2.y + '" class="heron-edge-a"></line>'
			+ '<line x1="' + p2.x + '" y1="' + p2.y + '" x2="' + p3.x + '" y2="' + p3.y + '" class="heron-edge-b"></line>'
			+ '<line x1="' + p3.x + '" y1="' + p3.y + '" x2="' + p1.x + '" y2="' + p1.y + '" class="heron-edge-c"></line>'
			+ edgeLabel(p1, p2, p3, 'a', 'heron-label-a')
			+ edgeLabel(p2, p3, p1, 'b', 'heron-label-b')
			+ edgeLabel(p3, p1, p2, 'c', 'heron-label-c')
			+ '<circle cx="' + p1.x + '" cy="' + p1.y + '" r="7" class="heron-handle heron-handle-a" data-h="P1"></circle>'
			+ '<circle cx="' + p2.x + '" cy="' + p2.y + '" r="7" class="heron-handle heron-handle-b" data-h="P2"></circle>'
			+ '<circle cx="' + p3.x + '" cy="' + p3.y + '" r="7" class="heron-handle heron-handle-c" data-h="P3"></circle>';
	}

	function renderStats() {
		var out = document.getElementById('heron-stats');
		if (!out) return;
		var beta = getHInt('heron-beta', 10), p = getHInt('heron-p', 3);
		var eMax = getHInt('heron-emax', 2);
		var eMin = 1 - eMax;
		var subnorm = getHBool('heron-subnorm', true);
		var s = sides();
		var exact = heronExact(s.a, s.b, s.c);
		var naive = heronNaive(s.a, s.b, s.c, beta, p, eMin, eMax, subnorm);
		var stable = heronKahan(s.a, s.b, s.c, beta, p, eMin, eMax, subnorm);
		var ulp = ulpOf(exact.area, beta, p, eMin, eMax);
		var errNaive = Math.abs(naive.area - exact.area);
		var errStable = Math.abs(stable.area - exact.area);
		out.innerHTML = ''
			+ '<table class="heron-table"><thead><tr>'
			+ '<th>метод</th><th>площадь</th><th>|err|</th><th>ошибка (ulp)</th>'
			+ '</tr></thead><tbody>'
			+ '<tr><td>точно</td><td class="heron-good">' + fmt(exact.area, 6) + '</td><td>0</td><td>0</td></tr>'
			+ '<tr><td>Герон</td><td>' + fmt(naive.area, 6) + '</td><td>' + fmt(errNaive, 6) + '</td><td>' + fmt(errNaive / ulp, 1) + '</td></tr>'
			+ '<tr><td>Кэхэн</td><td class="heron-good">' + fmt(stable.area, 6) + '</td><td>' + fmt(errStable, 6) + '</td><td>' + fmt(errStable / ulp, 1) + '</td></tr>'
			+ '</tbody></table>';
	}

	function renderAll() {
		renderTriangle();
		renderStats();
	}

	function handleStart(ev) {
		var t = ev.target;
		if (!t || !t.dataset || !t.dataset.h) return;
		state.drag = t.dataset.h;
		state.dragId = ev.pointerId;
		var svg = document.getElementById('heron-svg');
		if (svg) svg.setPointerCapture(ev.pointerId);
		t.classList.add('is-drag');
		ev.preventDefault();
	}

	function handleMove(ev) {
		if (!state.drag) return;
		var svg = document.getElementById('heron-svg');
		if (!svg) return;
		var np = svgPoint(svg, ev);
		var old = { x: state[state.drag].x, y: state[state.drag].y };
		state[state.drag].x = np.x;
		state[state.drag].y = np.y;
		if (!isValidTriangle(state.P1, state.P2, state.P3)) {
			state[state.drag].x = old.x;
			state[state.drag].y = old.y;
			return;
		}
		renderAll();
	}

	function handleEnd(_ev) {
		if (!state.drag) return;
		var svg = document.getElementById('heron-svg');
		if (svg) {
			var h = svg.querySelector('[data-h="' + state.drag + '"]');
			if (h) h.classList.remove('is-drag');
			if (state.dragId != null) {
				try { svg.releasePointerCapture(state.dragId); } catch(_) { /* ignore */ }
			}
		}
		state.drag = null;
		state.dragId = null;
	}

	function setGoldbergExample() {
		syncViewBox();
		var w = state.w, h = state.h;
		var cx = w / 2, cy = h * 0.55;
		var halfA = w * 0.32;
		state.P1 = { x: cx - halfA, y: cy };
		state.P2 = { x: cx + halfA, y: cy };
		var pixB = 4.53 / 9 * (2 * halfA);
		var tri_h = Math.sqrt(Math.max(0, pixB * pixB - halfA * halfA));
		state.P3 = { x: cx, y: cy - tri_h };
		state.scale = 9 / (2 * halfA);
		renderAll();
	}

	function bindDrag() {
		var svg = document.getElementById('heron-svg');
		if (!svg) return;
		svg.addEventListener('pointerdown', handleStart);
		svg.addEventListener('pointermove', handleMove);
		svg.addEventListener('pointerup', handleEnd);
		svg.addEventListener('pointerleave', handleEnd);
		window.addEventListener('pointerup', handleEnd);
	}

	function init() {
		bindDrag();
		var exBtn = document.getElementById('heron-example');
		if (exBtn) exBtn.addEventListener('click', setGoldbergExample);
		['heron-beta', 'heron-p', 'heron-emax'].forEach(function(id) {
			var el = document.getElementById(id);
			if (el) el.addEventListener('input', renderStats);
		});
		var hSubEl = document.getElementById('heron-subnorm');
		if (hSubEl) hSubEl.addEventListener('change', renderStats);
		setGoldbergExample();
	}

	document.addEventListener('DOMContentLoaded', function () {
		setTimeout(init, 80);
	});

	if (typeof Reveal !== 'undefined') {
		Reveal.on('slidechanged', function (e) {
			if (e.currentSlide && e.currentSlide.querySelector('#heron-viz')) {
				setTimeout(renderAll, 80);
			}
		});
	}
})();
