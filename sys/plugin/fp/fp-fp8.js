// OCP FP8 formats: E4M3FN and E5M2
//
// E4M3FN  — 1s + 4e + 3m, bias=7,  no Inf, NaN={0x7F,0xFF}, max=448
// E5M2    — 1s + 5e + 2m, bias=15, Inf/NaN standard,         max=57344
(function (G) {
	var FpFP8 = {};

	var FORMATS = {
		E4M3FN: { expBits: 4, manBits: 3, bias: 7  },
		E5M2:   { expBits: 5, manBits: 2, bias: 15 },
	};

	function _cfg(format) {
		var c = FORMATS[format];
		if (!c) throw new Error('Unknown FP8 format: ' + format + '. Use E4M3FN or E5M2.');
		return c;
	}

	function fp8Decode(byte, format) {
		var c   = _cfg(format);
		var eM  = c.expBits, mM = c.manBits;
		var msk = (1 << mM) - 1;
		var eMsk = (1 << eM) - 1;
		var s   = (byte >> 7) & 1;
		var e   = (byte >> mM) & eMsk;
		var m   = byte & msk;
		var sign = s ? -1 : 1;
		var maxE = (1 << eM) - 1;

		if (format === 'E4M3FN') {
			// NaN only when all exp+mantissa bits are 1
			if (e === maxE && m === msk) return NaN;
			if (e === 0) return sign * Math.pow(2, 1 - c.bias) * (m / (1 << mM));
			return sign * Math.pow(2, e - c.bias) * (1 + m / (1 << mM));
		} else { // E5M2
			if (e === maxE) return m === 0 ? sign * Infinity : NaN;
			if (e === 0) return sign * Math.pow(2, 1 - c.bias) * (m / (1 << mM));
			return sign * Math.pow(2, e - c.bias) * (1 + m / (1 << mM));
		}
	}

	function fp8Encode(v, format) {
		if (isNaN(v)) return 0x7F; // canonical NaN (0x7F = all-ones exp+man, both formats)
		var finite = fp8Enumerate(format);
		var best = 0, bestErr = Infinity;
		for (var i = 0; i < finite.length; i++) {
			var err = Math.abs(finite[i].value - v);
			if (err < bestErr) { bestErr = err; best = finite[i].byte; }
		}
		return best;
	}

	function fp8MaxVal(format) {
		var fin = fp8Enumerate(format);
		return fin.length > 0 ? fin[fin.length - 1].value : 0;
	}

	function fp8Enumerate(format) {
		var result = [];
		for (var b = 0; b < 256; b++) {
			var v = fp8Decode(b, format);
			if (isFinite(v)) result.push({ byte: b, value: v });
		}
		result.sort(function (a, b) { return a.value - b.value; });
		return result;
	}

	// Decode byte to bit string "S.EEEE.MMM" (E4M3FN) or "S.EEEEE.MM" (E5M2)
	function fp8ToBits(byte, format) {
		var c   = _cfg(format);
		var s   = (byte >> 7) & 1;
		var e   = (byte >> c.manBits) & ((1 << c.expBits) - 1);
		var m   = byte & ((1 << c.manBits) - 1);
		return s.toString()
			+ '.' + e.toString(2).padStart(c.expBits, '0')
			+ '.' + m.toString(2).padStart(c.manBits, '0');
	}

	FpFP8.fp8Decode    = fp8Decode;
	FpFP8.fp8Encode    = fp8Encode;
	FpFP8.fp8MaxVal    = fp8MaxVal;
	FpFP8.fp8Enumerate = fp8Enumerate;
	FpFP8.fp8ToBits    = fp8ToBits;

	if (typeof module !== 'undefined') module.exports = FpFP8;
	else G.FpFP8 = FpFP8;
}(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this));
