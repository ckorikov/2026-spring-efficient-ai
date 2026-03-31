// FP rounding primitives: findExp + flRound (ties-to-even, base-β)
(function (G) {
	var FpRounding = {};

	// Returns e such that β^e ≤ |av| < β^(e+1)
	function findExp(av, beta) {
		var e = Math.floor(Math.log(av) / Math.log(beta));
		if (Math.pow(beta, e + 1) <= av) e++;
		if (Math.pow(beta, e) > av) e--;
		return e;
	}

	// Round v to p significant digits in base beta (round-to-nearest, ties-to-even).
	// Optional eMin, eMax: when e < eMin → subnormal (constant ULP) or flush-to-zero; e > eMax → ±Infinity.
	// subnorm: if true (default when eMin set), use gradual underflow; if false, flush to zero.
	function flRound(v, beta, p, eMin, eMax, subnorm) {
		if (subnorm === undefined && eMin !== undefined) subnorm = true;
		if (!isFinite(v) || v === 0) return v;
		var av = Math.abs(v),
			sgn = v < 0 ? -1 : 1;
		var e = findExp(av, beta);
		if (eMax !== undefined && e > eMax) return sgn * Infinity;
		if (eMin !== undefined && e < eMin) {
			// FTZ (flush-to-zero): flush entire subnormal range to 0, not round-to-nearest.
			if (!subnorm) return 0;
		}
		var ulp = (eMin !== undefined && e < eMin)
			? Math.pow(beta, eMin + 1 - p)
			: Math.pow(beta, e + 1 - p);
		var k = Math.floor(av / ulp);
		var lo = k * ulp,
			hi = lo + ulp;
		var dLo = Math.abs(av - lo),
			dHi = Math.abs(av - hi);
		var fl;
		if (dLo < dHi) fl = lo;
		else if (dHi < dLo) fl = hi;
		else fl = k % 2 === 0 ? lo : hi;
		return sgn * fl;
	}

	FpRounding.findExp = findExp;
	FpRounding.flRound = flRound;

	if (typeof module !== 'undefined') module.exports = FpRounding;
	else G.FpRounding = FpRounding;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
