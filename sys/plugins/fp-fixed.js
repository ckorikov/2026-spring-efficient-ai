// Fixed-point Qm.n arithmetic: range computation and binary encoding
(function (G) {
	var FpFixed = {};

	function fracRange(m, n, signed) {
		var totalBits = m + n;
		if (totalBits === 0) return { min: 0, max: 0, step: 0, count: 0 };
		var count = 1 << totalBits;
		var step  = n > 0 ? 1 / (1 << n) : 1;
		if (signed) {
			var half = count / 2;
			return { min: -half * step, max: (half - 1) * step, step: step, count: count };
		}
		return { min: 0, max: (count - 1) * step, step: step, count: count };
	}

	function toBinary(val, totalBits, signed, fracBits) {
		var intVal = Math.round(val * (fracBits > 0 ? (1 << fracBits) : 1));
		if (signed && intVal < 0) intVal = (1 << totalBits) + intVal;
		var s = intVal.toString(2).padStart(totalBits, '0');
		if (s.length > totalBits) s = s.slice(-totalBits);
		return s;
	}

	function fromBinary(bits, totalBits, signed, fracBits) {
		var intVal = parseInt(bits, 2);
		if (signed && (intVal & (1 << (totalBits - 1)))) intVal -= (1 << totalBits);
		return intVal / (fracBits > 0 ? (1 << fracBits) : 1);
	}

	FpFixed.fracRange  = fracRange;
	FpFixed.toBinary   = toBinary;
	FpFixed.fromBinary = fromBinary;

	if (typeof module !== 'undefined') module.exports = FpFixed;
	else G.FpFixed = FpFixed;
}(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this));
