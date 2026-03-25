// FP representation: base-β digit decomposition and formatting
(function (G) {
	var FpRepr = {};
	var DIGIT_EPS = 1e-12;
	var FpRounding = (typeof module !== 'undefined')
		? require('./fp-rounding')
		: G.FpRounding;
	var findExp = FpRounding.findExp;

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

	function digitChar(d) {
		return d < 10 ? String(d) : String.fromCharCode(87 + d);
	}

	// Core: format digits array as "d₀.d₁d₂… × β^e" and compute decoded value
	function fmtDigits(digits, beta, e, dotAfter) {
		var s = '';
		for (var i = 0; i < digits.length; i++) {
			if (i === dotAfter) s += '.';
			s += digitChar(digits[i]);
		}
		var html = s + ' × ' + beta + '<sup>' + e + '</sup>';
		var val = 0;
		for (var j = 0; j < digits.length; j++) {
			val += digits[j] * Math.pow(beta, e - j + (dotAfter - 1));
		}
		return { html: html, val: val };
	}

	// Normalized: d₀.d₁d₂…d_{p-1} × β^e
	function fmtFP(v, beta, p, contam) {
		if (!isFinite(v)) return { html: v > 0 ? '+∞' : '−∞', val: v };
		if (v === 0) {
			return { html: '0.' + Array(p).join('0') + ' × ' + beta + '<sup>0</sup>', val: 0 };
		}
		var bd = baseDigits(v, beta, p);
		var r = fmtDigits(bd.digits, beta, bd.e, 1);
		if (contam > 0) {
			// re-render with contamination coloring
			var clean = p - contam, s = '';
			for (var i = 0; i < p; i++) {
				if (i === 1) s += '.';
				if (i === clean) s += '<span class="fo-red">';
				s += digitChar(bd.digits[i]);
			}
			s += '</span>';
			r.html = s + ' × ' + beta + '<sup>' + bd.e + '</sup>';
		}
		if (v < 0) r.html = '−' + r.html;
		return r;
	}

	FpRepr.baseDigits = baseDigits;
	FpRepr.digitChar = digitChar;
	FpRepr.fmtFP = fmtFP;
	FpRepr.DIGIT_EPS = DIGIT_EPS;

	if (typeof module !== 'undefined') module.exports = FpRepr;
	else G.FpRepr = FpRepr;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
