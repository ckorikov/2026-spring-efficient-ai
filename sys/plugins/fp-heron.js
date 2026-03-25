// Heron triangle area: naive vs Kahan-stable formulas
(function (G) {
	var FpHeron = {};
	var FpRounding = (typeof module !== 'undefined')
		? require('./fp-rounding')
		: G.FpRounding;
	var flRound = FpRounding.flRound;
	var findExp = FpRounding.findExp;

	function heronNaive(a, b, c, beta, p, eMin, eMax, subnorm) {
		var fl = function(v) { return flRound(v, beta, p, eMin, eMax, subnorm); };
		var sum3 = fl(fl(fl(a) + fl(b)) + fl(c));
		var s = fl(sum3 / 2);
		var sma = fl(s - fl(a));
		var smb = fl(s - fl(b));
		var smc = fl(s - fl(c));
		var prod = fl(fl(fl(s * sma) * smb) * smc);
		return { area: prod <= 0 ? 0 : fl(Math.sqrt(prod)) };
	}

	function heronKahan(a, b, c, beta, p, eMin, eMax, subnorm) {
		var fl = function(v) { return flRound(v, beta, p, eMin, eMax, subnorm); };
		var sides = [fl(a), fl(b), fl(c)].sort(function (x, y) { return y - x; });
		var A = sides[0], B = sides[1], C = sides[2];
		var t1 = fl(A + fl(B + C));
		var t2 = fl(C - fl(A - B));
		var t3 = fl(C + fl(A - B));
		var t4 = fl(A + fl(B - C));
		var prod = fl(fl(fl(t1 * t2) * t3) * t4);
		return { area: prod <= 0 ? 0 : fl(0.25 * Math.sqrt(prod)) };
	}

	function heronExact(a, b, c) {
		var s = (a + b + c) / 2;
		var prod = s * (s - a) * (s - b) * (s - c);
		return { area: prod <= 0 ? 0 : Math.sqrt(prod) };
	}

	function ulpOf(x, beta, p, eMin, eMax) {
		if (!isFinite(x) || x === 0) {
			return Math.pow(beta, (eMin !== undefined ? eMin : 0) + 1 - p);
		}
		var e = findExp(Math.abs(x), beta);
		if (eMax !== undefined && e > eMax) return Infinity;
		if (eMin !== undefined && e < eMin) e = eMin;
		return Math.pow(beta, e + 1 - p);
	}

	FpHeron.heronNaive = heronNaive;
	FpHeron.heronKahan = heronKahan;
	FpHeron.heronExact = heronExact;
	FpHeron.ulpOf = ulpOf;

	if (typeof module !== 'undefined') module.exports = FpHeron;
	else G.FpHeron = FpHeron;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
