// IEEE 754 generic floating-point: enumerate, encode, decode
(function (G) {
	var FpIEEE754 = {};

	function fpMaxVal(totalBits, expBits) {
		var M = totalBits - 1 - expBits;
		if (M < 0 || expBits < 1) return 0;
		var bias = (1 << (expBits - 1)) - 1;
		var eMax = (1 << expBits) - 2;
		var mMax = (1 << M) - 1;
		return (1 + mMax / (1 << M)) * Math.pow(2, eMax - bias);
	}

	function fpEnumerate(totalBits, expBits) {
		var M = totalBits - 1 - expBits;
		if (M < 0) return [];
		var bias = (1 << (expBits - 1)) - 1;
		var eMax = (1 << expBits) - 1;
		var maxM = 1 << M;
		var vals = [0];
		for (var e = 0; e < eMax; e++) {
			for (var m = 0; m < maxM; m++) {
				if (e === 0 && m === 0) continue;
				var abs = e === 0
					? (m / maxM) * Math.pow(2, 1 - bias)
					: (1 + m / maxM) * Math.pow(2, e - bias);
				if (isFinite(abs) && abs > 0) { vals.push(abs); vals.push(-abs); }
			}
		}
		return vals.sort(function (a, b) { return a - b; });
	}

	function fpToBits(v, totalBits, expBits) {
		var M = totalBits - 1 - expBits;
		if (M < 0) return '0'.repeat(totalBits);
		var bias    = (1 << (expBits - 1)) - 1;
		var eAllOne = (1 << expBits) - 1;
		var maxM    = 1 << M;
		var sign    = v < 0 ? 1 : 0;
		var abs     = Math.abs(v);
		var eBits, mBits;
		if (abs === 0) {
			eBits = 0; mBits = 0;
		} else {
			var floorExp = Math.floor(Math.log2(abs));
			var biasedE  = floorExp + bias;
			if (biasedE >= 1 && biasedE <= eAllOne - 1) {
				eBits = biasedE;
				mBits = Math.max(0, Math.min(maxM - 1, Math.round((abs / Math.pow(2, floorExp) - 1) * maxM)));
			} else if (biasedE < 1) {
				eBits = 0;
				mBits = Math.max(0, Math.min(maxM - 1, Math.round(abs * maxM * Math.pow(2, bias - 1))));
			} else {
				eBits = eAllOne - 1; mBits = maxM - 1;
			}
		}
		return sign.toString()
			+ eBits.toString(2).padStart(expBits, '0')
			+ mBits.toString(2).padStart(M, '0');
	}

	function fpFromBits(bits, totalBits, expBits) {
		var n = typeof bits === 'string' ? parseInt(bits, 2) : bits;
		var M    = totalBits - 1 - expBits;
		var bias = (1 << (expBits - 1)) - 1;
		var sign = (n >> (totalBits - 1)) & 1 ? -1 : 1;
		var e    = (n >> M) & ((1 << expBits) - 1);
		var m    = n & ((1 << M) - 1);
		if (e === 0) return sign * (m / (1 << M)) * Math.pow(2, 1 - bias);
		if (e === (1 << expBits) - 1) return m === 0 ? sign * Infinity : NaN;
		return sign * (1 + m / (1 << M)) * Math.pow(2, e - bias);
	}

	FpIEEE754.fpMaxVal    = fpMaxVal;
	FpIEEE754.fpEnumerate = fpEnumerate;
	FpIEEE754.fpToBits    = fpToBits;
	FpIEEE754.fpFromBits  = fpFromBits;

	if (typeof module !== 'undefined') module.exports = FpIEEE754;
	else G.FpIEEE754 = FpIEEE754;
}(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this));
