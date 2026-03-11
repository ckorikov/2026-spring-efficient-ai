(function () {
	var DIGIT_EPS = 1e-12;

	function findExp(av, beta) {
		var e = Math.floor(Math.log(av) / Math.log(beta));
		if (Math.pow(beta, e + 1) <= av) e++;
		if (Math.pow(beta, e) > av) e--;
		return e;
	}

	function flRound(v, beta, p) {
		if (!isFinite(v) || v === 0) return v;
		var av = Math.abs(v), sgn = v < 0 ? -1 : 1;
		var e = findExp(av, beta);
		var ulp = Math.pow(beta, e + 1 - p);
		var k = Math.floor(av / ulp);
		var lo = k * ulp, hi = lo + ulp;
		var dLo = Math.abs(av - lo), dHi = Math.abs(av - hi);
		var fl;
		if (dLo < dHi) fl = lo;
		else if (dHi < dLo) fl = hi;
		else fl = (k % 2 === 0) ? lo : hi;
		return sgn * fl;
	}

	function fpOp(a, b, beta, p, op) {
		var fa = flRound(a, beta, p), fb = flRound(b, beta, p);
		var raw;
		switch (op) {
			case '+': raw = fa + fb; break;
			case '-': raw = fa - fb; break;
			case '*': raw = fa * fb; break;
			case '/': raw = fb !== 0 ? fa / fb : Infinity; break;
			default:  raw = NaN;
		}
		return flRound(raw, beta, p);
	}

	function fpSum(x, n, beta, p) {
		var s = flRound(0, beta, p);
		var fx = flRound(x, beta, p);
		for (var i = 0; i < n; i++) {
			s = flRound(s + fx, beta, p);
		}
		return s;
	}

	function flPair(x, y, beta, p) {
		return { x: flRound(x, beta, p), y: flRound(y, beta, p) };
	}

	function fpNaiveSqDiff(x, y, beta, p) {
		var f = flPair(x, y, beta, p);
		var x2 = flRound(f.x * f.x, beta, p);
		var y2 = flRound(f.y * f.y, beta, p);
		return flRound(x2 - y2, beta, p);
	}

	function fpFactoredDiff(x, y, beta, p) {
		var f = flPair(x, y, beta, p);
		return flRound(flRound(f.x - f.y, beta, p) * flRound(f.x + f.y, beta, p), beta, p);
	}

	function fpAddSubX(x, y, beta, p) {
		var f = flPair(x, y, beta, p);
		return flRound(flRound(f.x + f.y, beta, p) - f.x, beta, p);
	}

	// ── Exact rational arithmetic (BigInt) ────────────────
	function Frac(n, d) { this.n = BigInt(n); this.d = d ? BigInt(d) : 1n; }
	Frac.from = function (s) {
		s = String(s).trim();
		var neg = s[0] === '-'; if (neg || s[0] === '+') s = s.slice(1);
		var dot = s.indexOf('.');
		if (dot === -1) { var nn = BigInt(s); return new Frac(neg ? -nn : nn); }
		var dec = s.length - dot - 1;
		var num = BigInt(s.replace('.', ''));
		var den = 10n ** BigInt(dec);
		return new Frac(neg ? -num : num, den);
	};
	Frac.prototype.add = function (b) { return new Frac(this.n * b.d + b.n * this.d, this.d * b.d); };
	Frac.prototype.sub = function (b) { return new Frac(this.n * b.d - b.n * this.d, this.d * b.d); };
	Frac.prototype.mul = function (b) { return new Frac(this.n * b.n, this.d * b.d); };
	Frac.prototype.div = function (b) { return new Frac(this.n * b.d, this.d * b.n); };
	Frac.prototype.toFloat = function () { return Number(this.n) / Number(this.d); };
	Frac.prototype.toStr = function (maxDigits) {
		maxDigits = maxDigits || 12;
		var neg = (this.n < 0n) !== (this.d < 0n);
		var n = this.n < 0n ? -this.n : this.n;
		var d = this.d < 0n ? -this.d : this.d;
		var intPart = n / d, rem = n % d;
		if (rem === 0n) return (neg ? '−' : '') + intPart.toString();
		var s = (neg ? '−' : '') + intPart.toString() + '.';
		var count = 0;
		while (rem !== 0n && count < maxDigits) {
			rem *= 10n; s += (rem / d).toString(); rem = rem % d; count++;
		}
		if (rem !== 0n) s += '…';
		return s;
	};

	// ── Formatting ────────────────────────────────────────
	function fmtN(v, prec) {
		prec = prec || 4;
		if (v === 0) return '0';
		if (!isFinite(v)) return v > 0 ? '+∞' : '−∞';
		var a = Math.abs(v);
		if (a >= 1e-4 && a < 1e6) return parseFloat(v.toPrecision(prec)).toString();
		return v.toExponential(prec - 1);
	}

	function baseDigits(v, beta, p) {
		if (!isFinite(v) || v === 0) return { digits: [], e: 0 };
		var av = Math.abs(v);
		var e = findExp(av, beta);
		var digits = [], rem = av / Math.pow(beta, e);
		for (var i = 0; i < p; i++) {
			var d = Math.floor(rem + DIGIT_EPS);
			d = Math.max(0, Math.min(beta - 1, d));
			digits.push(d);
			rem = (rem - d) * beta;
		}
		return { digits: digits, e: e };
	}

	function contamCount(exact, fp, beta, p) {
		if (exact === fp) return 0;
		if (!isFinite(exact) || exact === 0) return fp === 0 ? 0 : p;
		var ed = baseDigits(exact, beta, p);
		var fd = baseDigits(fp, beta, p);
		if (ed.e !== fd.e) return p;
		for (var i = 0; i < p; i++) {
			if (ed.digits[i] !== fd.digits[i]) return p - i;
		}
		return 0;
	}

	function digitChar(d) { return d < 10 ? String(d) : String.fromCharCode(87 + d); }

	function fmtFP(v, beta, p, contam) {
		if (!isFinite(v)) return v > 0 ? '+∞' : '−∞';
		if (v === 0) return '0.' + Array(p).join('0') + '×' + beta + '<sup>0</sup>';
		var sgn = v < 0 ? '−' : '';
		var bd = baseDigits(v, beta, p);
		var clean = p - (contam || 0);
		var s = sgn;
		for (var i = 0; i < p; i++) {
			if (i === 1) s += '.';
			if (i === clean && contam > 0) s += '<span class="fo-red">';
			s += digitChar(bd.digits[i]);
		}
		if (contam > 0) s += '</span>';
		return s + '×' + beta + '<sup>' + bd.e + '</sup>';
	}

	function foUpdate() {
		var xs = document.getElementById('fo-x').value;
		var ys = document.getElementById('fo-y').value;
		var x = parseFloat(xs), y = parseFloat(ys);
		var beta = parseInt(document.getElementById('fo-beta').value);
		var p    = parseInt(document.getElementById('fo-p').value);
		var n    = parseInt(document.getElementById('fo-n').value);
		if (!isFinite(x) || !isFinite(y) || beta < 2 || p < 1 || n < 1) return;

		// Exact via rational arithmetic
		var fx = Frac.from(xs), fy = Frac.from(ys), fn = new Frac(n);
		var eAdd  = fx.add(fy);
		var eSub  = fx.sub(fy);
		var eMul  = fx.mul(fy);
		var eDiv  = y !== 0 ? fx.div(fy) : null;
		var eSum  = fx.mul(fn);
		var eSqD  = fx.mul(fx).sub(fy.mul(fy)); // x²−y² = (x−y)(x+y)

		var ops = [
			{ lbl: 'x + y',     exact: eAdd, fp: fpOp(x, y, beta, p, '+') },
			{ lbl: 'x − y',     exact: eSub, fp: fpOp(x, y, beta, p, '-') },
			{ lbl: 'x × y',     exact: eMul, fp: fpOp(x, y, beta, p, '*') },
			{ lbl: 'x / y',     exact: eDiv, fp: fpOp(x, y, beta, p, '/') },
			{ lbl: 'x + y − x', exact: fy,   fp: fpAddSubX(x, y, beta, p) },
			{ lbl: '\\(\\sum_{i=1}^{' + n + '} x\\)', exact: eSum, fp: fpSum(x, n, beta, p) },
			{ lbl: 'x² − y²',   exact: eSqD, fp: fpNaiveSqDiff(x, y, beta, p) },
			{ lbl: '(x−y)(x+y)', exact: eSqD, fp: fpFactoredDiff(x, y, beta, p) },
		];

		var html = '<table class="fo-table"><thead><tr>'
			+ '<th>операция</th><th>точное</th><th>fl</th><th>fl (β=' + beta + ')</th>'
			+ '<th>|err|</th><th>|err|/|res|</th>'
			+ '</tr></thead><tbody>';

		for (var i = 0; i < ops.length; i++) {
			var o = ops[i];
			var exact = o.exact ? o.exact.toFloat() : Infinity;
			var exactStr = o.exact ? o.exact.toStr(p + 2) : '−';
			var absErr = Math.abs(exact - o.fp);
			var relErr = exact !== 0 ? absErr / Math.abs(exact) : (o.fp === 0 ? 0 : 1);
			var c = contamCount(exact, o.fp, beta, p);
			html += '<tr>'
				+ '<td>' + o.lbl + '</td>'
				+ '<td class="fo-val">' + exactStr + '</td>'
				+ '<td class="fo-fp">' + fmtN(o.fp) + '</td>'
				+ '<td style="font-size:0.85em">' + fmtFP(o.fp, beta, p, c) + '</td>'
				+ '<td class="fo-err">' + fmtN(absErr) + '</td>'
				+ '<td class="fo-err">' + fmtN(relErr) + '</td>'
				+ '</tr>';
		}
		html += '</tbody></table>';
		var el = document.getElementById('fo-stats');
		el.innerHTML = html;
		if (window.MathJax) {
			if (MathJax.Hub) MathJax.Hub.Queue(["Typeset", MathJax.Hub, el]);
			else if (MathJax.typeset) MathJax.typeset([el]);
		}
	}

	var PRESETS = [
		{ label: 'x²−y²',           x: '1234',  y: '1233',  beta: 10, p: 4, n: 1,
		  desc: 'Catastrophic cancellation: x²−y² теряет все 4 цифры (3000 вместо 2467), а (x−y)(x+y) даёт точный ответ' },
		{ label: 'большое + малое',  x: '1000',  y: '0.001', beta: 10, p: 4, n: 1,
		  desc: 'Поглощение (absorption): fl(1000 + 0.001) = 1000, малое y исчезает. x+y−x = 0, а не y' },
		{ label: 'сумма в β=2',      x: '0.1',   y: '1',     beta: 2,  p: 4, n: 100,
		  desc: '0.1 в β=2 — бесконечная дробь (0.0001100…). При 100 сложениях ошибка округления накапливается' },
		{ label: 'сумма в β=10',     x: '0.1',   y: '1',     beta: 10, p: 4, n: 10000,
		  desc: '0.1 в β=10 представима точно. Даже за 10 000 шагов накопления ошибки нет' },
		{ label: 'деление 1/3',      x: '1',     y: '3',     beta: 10, p: 4, n: 1,
		  desc: '1/3 = 0.3333… — бесконечная периодическая дробь в β=10. Округление неизбежно' },
	];

	function setPreset(pr, idx) {
		document.getElementById('fo-x').value    = pr.x;
		document.getElementById('fo-y').value    = pr.y;
		document.getElementById('fo-beta').value = pr.beta;
		document.getElementById('fo-p').value    = pr.p;
		document.getElementById('fo-n').value    = pr.n;
		document.getElementById('fo-desc').textContent = pr.desc;
		document.querySelectorAll('.fo-preset').forEach(function (b) { b.classList.remove('active'); });
		var btn = document.querySelector('.fo-preset[data-idx="' + idx + '"]');
		if (btn) btn.classList.add('active');
		foUpdate();
	}

	function renderPresets() {
		var el = document.getElementById('fo-presets');
		if (!el) return;
		var html = '';
		for (var i = 0; i < PRESETS.length; i++) {
			html += '<button class="fo-preset" data-idx="' + i + '" title="' + PRESETS[i].desc + '">'
				+ PRESETS[i].label + '</button>';
		}
		el.innerHTML = html;
		el.querySelectorAll('.fo-preset').forEach(function (btn) {
			btn.addEventListener('click', function () {
				var i = parseInt(btn.dataset.idx);
				setPreset(PRESETS[i], i);
			});
		});
	}

	document.addEventListener('DOMContentLoaded', function () {
		['fo-x','fo-y','fo-beta','fo-p','fo-n'].forEach(function (id) {
			var el = document.getElementById(id);
			if (el) el.addEventListener('input', foUpdate);
		});
		renderPresets();
		setTimeout(function () { setPreset(PRESETS[0], 0); }, 150);
	});

	if (typeof Reveal !== 'undefined') {
		Reveal.on('slidechanged', function (e) {
			if (e.currentSlide && e.currentSlide.querySelector('#fo-stats'))
				setTimeout(foUpdate, 50);
		});
	}
})();
