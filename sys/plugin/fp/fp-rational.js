// Exact rational arithmetic using BigInt
(function (G) {
	var FpRational = {};

	function Frac(n, d) {
		this.n = BigInt(n);
		this.d = d !== undefined ? BigInt(d) : 1n;
	}

	Frac.from = function (s) {
		s = String(s).trim();
		var neg = s[0] === '-';
		if (neg || s[0] === '+') s = s.slice(1);
		var dot = s.indexOf('.');
		if (dot === -1) { var nn = BigInt(s); return new Frac(neg ? -nn : nn); }
		var dec = s.length - dot - 1;
		var num = BigInt(s.replace('.', ''));
		var den = 10n ** BigInt(dec);
		return new Frac(neg ? -num : num, den);
	};

	Frac.prototype.add = function (b) {
		return new Frac(this.n * b.d + b.n * this.d, this.d * b.d);
	};
	Frac.prototype.sub = function (b) {
		return new Frac(this.n * b.d - b.n * this.d, this.d * b.d);
	};
	Frac.prototype.mul = function (b) {
		return new Frac(this.n * b.n, this.d * b.d);
	};
	Frac.prototype.div = function (b) {
		return new Frac(this.n * b.d, this.d * b.n);
	};
	Frac.prototype.toFloat = function () {
		return Number(this.n) / Number(this.d);
	};
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

	FpRational.Frac = Frac;

	if (typeof module !== 'undefined') module.exports = FpRational;
	else G.FpRational = FpRational;
}(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this));
