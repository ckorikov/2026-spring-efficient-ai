(function () {
	var DIGIT_EPS = FpRepr.DIGIT_EPS;
	var baseDigits = FpRepr.baseDigits;
	var fmtFP = FpRepr.fmtFP;

	function flAdd(a, b, beta, p, guard, eMin, eMax, subnorm) {
		if (a === 0) return flRound(b, beta, p, eMin, eMax, subnorm);
		if (b === 0) return flRound(a, beta, p, eMin, eMax, subnorm);
		var eA = findExp(Math.abs(a), beta);
		var eB = findExp(Math.abs(b), beta);
		var eMx = Math.max(eA, eB);
		var regWidth = guard ? p + 1 : p;
		var alignUlp = Math.pow(beta, eMx + 1 - regWidth);
		var tA = Math.sign(a) * Math.floor(Math.abs(a) / alignUlp + DIGIT_EPS) * alignUlp;
		var tB = Math.sign(b) * Math.floor(Math.abs(b) / alignUlp + DIGIT_EPS) * alignUlp;
		return flRound(tA + tB, beta, p, eMin, eMax, subnorm);
	}

	function fpOp(a, b, beta, p, op, guard, eMin, eMax, subnorm) {
		var fa = flRound(a, beta, p, eMin, eMax, subnorm), fb = flRound(b, beta, p, eMin, eMax, subnorm);
		switch (op) {
			case '+': return flAdd(fa, fb, beta, p, guard, eMin, eMax, subnorm);
			case '-': return flAdd(fa, -fb, beta, p, guard, eMin, eMax, subnorm);
			case '*': return flRound(fa * fb, beta, p, eMin, eMax, subnorm);
			case '/': return fb !== 0 ? flRound(fa / fb, beta, p, eMin, eMax, subnorm) : Infinity;
			default:  return NaN;
		}
	}

	function fpSum(x, n, beta, p, guard, eMin, eMax, subnorm) {
		var s = flRound(0, beta, p, eMin, eMax, subnorm);
		var fx = flRound(x, beta, p, eMin, eMax, subnorm);
		for (var i = 0; i < n; i++) {
			s = flAdd(s, fx, beta, p, guard, eMin, eMax, subnorm);
		}
		return s;
	}

	function fpKahanSum(x, n, beta, p, guard, eMin, eMax, subnorm) {
		var s = flRound(0, beta, p, eMin, eMax, subnorm);
		var c = flRound(0, beta, p, eMin, eMax, subnorm);
		var fx = flRound(x, beta, p, eMin, eMax, subnorm);
		for (var i = 0; i < n; i++) {
			var y = flAdd(fx, -c, beta, p, guard, eMin, eMax, subnorm);
			var t = flAdd(s, y, beta, p, guard, eMin, eMax, subnorm);
			c = flAdd(flAdd(t, -s, beta, p, guard, eMin, eMax, subnorm), -y, beta, p, guard, eMin, eMax, subnorm);
			s = t;
		}
		return s;
	}

	function flPair(x, y, beta, p, eMin, eMax, subnorm) {
		return { x: flRound(x, beta, p, eMin, eMax, subnorm), y: flRound(y, beta, p, eMin, eMax, subnorm) };
	}

	function fpNaiveSqDiff(x, y, beta, p, guard, eMin, eMax, subnorm) {
		var f = flPair(x, y, beta, p, eMin, eMax, subnorm);
		var x2 = flRound(f.x * f.x, beta, p, eMin, eMax, subnorm);
		var y2 = flRound(f.y * f.y, beta, p, eMin, eMax, subnorm);
		return flAdd(x2, -y2, beta, p, guard, eMin, eMax, subnorm);
	}

	function fpFactoredDiff(x, y, beta, p, guard, eMin, eMax, subnorm) {
		var f = flPair(x, y, beta, p, eMin, eMax, subnorm);
		var diff = flAdd(f.x, -f.y, beta, p, guard, eMin, eMax, subnorm);
		var sum  = flAdd(f.x,  f.y, beta, p, guard, eMin, eMax, subnorm);
		return flRound(diff * sum, beta, p, eMin, eMax, subnorm);
	}

	function fpAddSubX(x, y, beta, p, guard, eMin, eMax, subnorm) {
		var f = flPair(x, y, beta, p, eMin, eMax, subnorm);
		var add = flAdd(f.x, f.y, beta, p, guard, eMin, eMax, subnorm);
		return flAdd(add, -f.x, beta, p, guard, eMin, eMax, subnorm);
	}

	var Frac = FpRational.Frac;

	var fmtN = FpFmt.fmtN;

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

	// Factory: creates an update function for a focused slide.
	// pfx — ID prefix (e.g. 'fob'); opIdxs — which rows to show (0–6):
	//   0: x+y  1: x-y  2: x×y  3: x/y  4: x+y-x  5: x²-y²  6: (x-y)(x+y)
	function makeFoSlideUpdate(pfx, opIdxs) {
		return function () {
			var xEl = document.getElementById(pfx + '-x');
			var yEl = document.getElementById(pfx + '-y');
			if (!xEl || !yEl) return;
			var xs = xEl.value, ys = yEl.value;
			var x = parseFloat(xs), y = parseFloat(ys);
			var beta = parseInt(document.getElementById(pfx + '-beta').value);
			var p    = parseInt(document.getElementById(pfx + '-p').value);
			var emEl = document.getElementById(pfx + '-emax');
			var eMax = emEl ? parseInt(emEl.value) : undefined;
			var eMin = isFinite(eMax) ? 1 - eMax : undefined;
			var gEl  = document.getElementById(pfx + '-guard');
			var guard = gEl ? gEl.checked : false;
			if (!isFinite(x) || !isFinite(y) || beta < 2 || p < 1) return;

			var fx = Frac.from(xs), fy = Frac.from(ys);
			var eSqD = fx.mul(fx).sub(fy.mul(fy));
			var allOps = [
				{ lbl: 'x + y',      exact: fx.add(fy), fp: fpOp(x, y, beta, p, '+', guard, eMin, eMax) },
				{ lbl: 'x − y',      exact: fx.sub(fy), fp: fpOp(x, y, beta, p, '-', guard, eMin, eMax) },
				{ lbl: 'x × y',      exact: fx.mul(fy), fp: fpOp(x, y, beta, p, '*', guard, eMin, eMax) },
				{ lbl: 'x / y',      exact: y !== 0 ? fx.div(fy) : null, fp: fpOp(x, y, beta, p, '/', guard, eMin, eMax) },
				{ lbl: 'x + y − x',  exact: fy,   fp: fpAddSubX(x, y, beta, p, guard, eMin, eMax) },
				{ lbl: 'x² − y²',    exact: eSqD, fp: fpNaiveSqDiff(x, y, beta, p, guard, eMin, eMax) },
				{ lbl: '(x−y)(x+y)', exact: eSqD, fp: fpFactoredDiff(x, y, beta, p, guard, eMin, eMax) },
			];
			var ops = allOps.filter(function (_, i) { return opIdxs.indexOf(i) >= 0; });

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
					+ '<td style="font-size:0.85em">' + fmtFP(o.fp, beta, p, c).html + '</td>'
					+ '<td class="fo-err">' + fmtN(absErr) + '</td>'
					+ '<td class="fo-err">' + fmtN(relErr) + '</td>'
					+ '</tr>';
			}
			html += '</tbody></table>';
			var el = document.getElementById(pfx + '-stats');
			if (el) el.innerHTML = html;
		};
	}

	var fobUpdate = makeFoSlideUpdate('fob', [0, 1, 2, 3]);     // basic: +, -, ×, /
	var foaUpdate = makeFoSlideUpdate('foa', [0, 4]);            // big+small: x+y, x+y-x
	var focUpdate = makeFoSlideUpdate('foc', [1]);               // close sub: x-y
	var foqUpdate = makeFoSlideUpdate('foq', [5, 6]);            // quadratic: x²-y², (x-y)(x+y)


	function renderCombinedSumTable(exact, eSum, naiveResult, kahanResult, beta, p) {
		var rows = [
			{ lbl: 'точное',   val: exact,       str: eSum.toStr(p + 2), isExact: true },
			{ lbl: 'наивная Σ', val: naiveResult, str: null, isExact: false },
			{ lbl: 'Кэхэн Σ',  val: kahanResult,  str: null, isExact: false },
		];
		var html = '<table class="fo-table fo-table-combined"><thead><tr>'
			+ '<th>метод</th><th>результат</th><th>fl (β=' + beta + ')</th>'
			+ '<th>|err|</th><th>|err|/|res|</th>'
			+ '</tr></thead><tbody>';
		for (var i = 0; i < rows.length; i++) {
			var r = rows[i];
			var absErr = r.isExact ? 0 : Math.abs(exact - r.val);
			var relErr = r.isExact ? 0 : (exact !== 0 ? absErr / Math.abs(exact) : (r.val === 0 ? 0 : 1));
			var c = r.isExact ? 0 : contamCount(exact, r.val, beta, p);
			html += '<tr>'
				+ '<td class="fo-method">' + r.lbl + '</td>'
				+ '<td class="fo-val">' + (r.str || fmtN(r.val)) + '</td>'
				+ '<td style="font-size:0.85em">' + (r.isExact ? '—' : fmtFP(r.val, beta, p, c).html) + '</td>'
				+ '<td class="fo-err">' + (r.isExact ? '—' : fmtN(absErr)) + '</td>'
				+ '<td class="fo-err">' + (r.isExact ? '—' : fmtN(relErr)) + '</td>'
				+ '</tr>';
		}
		html += '</tbody></table>';
		var el = document.getElementById('fo-sum-combined');
		if (el) el.innerHTML = html;
	}

	function foSumUpdate() {
		var xs = document.getElementById('fo2-x').value;
		var x = parseFloat(xs);
		var beta = parseInt(document.getElementById('fo2-beta').value);
		var p    = parseInt(document.getElementById('fo2-p').value);
		var n    = parseInt(document.getElementById('fo2-n').value);
		var emEl = document.getElementById('fo2-emax');
		var eMax = emEl ? parseInt(emEl.value) : undefined;
		var eMin = isFinite(eMax) ? 1 - eMax : undefined;
		var gEl  = document.getElementById('fo2-guard');
		var guard = gEl ? gEl.checked : false;
		if (!isFinite(x) || beta < 2 || p < 1 || n < 1) return;
		var fx = Frac.from(xs), fn = new Frac(n);
		var eSum = fx.mul(fn);
		var exact = eSum.toFloat();
		renderCombinedSumTable(exact, eSum, fpSum(x, n, beta, p, guard, eMin, eMax), fpKahanSum(x, n, beta, p, guard, eMin, eMax), beta, p);
	}



	document.addEventListener('DOMContentLoaded', function () {
		// Per-slide ops controls
		[
			{ pfx: 'fob', fn: fobUpdate },
			{ pfx: 'foa', fn: foaUpdate },
			{ pfx: 'foc', fn: focUpdate },
			{ pfx: 'foq', fn: foqUpdate },
		].forEach(function (cfg) {
			['x', 'y', 'beta', 'p', 'emax'].forEach(function (id) {
				var el = document.getElementById(cfg.pfx + '-' + id);
				if (el) el.addEventListener('input', cfg.fn);
			});
			var gEl = document.getElementById(cfg.pfx + '-guard');
			if (gEl) gEl.addEventListener('change', cfg.fn);
		});
		var INIT_DELAY_MS = 150; // let Reveal finish layout before first render
		setTimeout(function () { fobUpdate(); foaUpdate(); focUpdate(); foqUpdate(); }, INIT_DELAY_MS);

		['fo2-x', 'fo2-n', 'fo2-beta', 'fo2-p', 'fo2-emax'].forEach(function (id) {
			var el = document.getElementById(id);
			if (el) el.addEventListener('input', foSumUpdate);
		});
		var fo2g = document.getElementById('fo2-guard');
		if (fo2g) fo2g.addEventListener('change', foSumUpdate);
		setTimeout(foSumUpdate, INIT_DELAY_MS);
	});

	if (typeof Reveal !== 'undefined') {
		Reveal.on('slidechanged', function (e) {
			var sl = e.currentSlide;
			if (!sl) return;
			if (sl.querySelector('#fob-stats')) setTimeout(fobUpdate, 50);
			if (sl.querySelector('#foa-stats')) setTimeout(foaUpdate, 50);
			if (sl.querySelector('#foc-stats')) setTimeout(focUpdate, 50);
			if (sl.querySelector('#foq-stats')) setTimeout(foqUpdate, 50);
			if (sl.querySelector('#fo-sum-combined')) setTimeout(foSumUpdate, 50);
		});
	}
})();
