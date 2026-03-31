(function (G) {
	var FpFmt = {};

	function fmtN(v, prec) {
		prec = prec || 4;
		if (v === 0) return '0';
		if (!isFinite(v)) return v > 0 ? '+∞' : '−∞';
		var a = Math.abs(v);
		if (a >= 1e-4 && a < 1e6) return parseFloat(v.toPrecision(prec)).toString();
		return v.toExponential(prec - 1);
	}

	FpFmt.fmtN = fmtN;

	if (typeof module !== 'undefined') module.exports = FpFmt;
	else G.FpFmt = FpFmt;
}(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this));
