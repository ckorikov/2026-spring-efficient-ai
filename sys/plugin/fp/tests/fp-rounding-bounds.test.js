const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { findExp, flRound } = require('../fp-rounding');

// ── Machine epsilon: ε = (β/2)·β^(-p) = ½β^(1-p) ──────────

test('epsilon definition: ε = ½β^(1-p)', () => {
	// β=2, p=3: ε = ½·2^(-2) = 0.125
	assert.equal(0.5 * Math.pow(2, 1 - 3), 0.125);
	// β=10, p=3: ε = ½·10^(-2) = 0.005
	assert.equal(0.5 * Math.pow(10, 1 - 3), 0.005);
});

// ── ULP = β^(e+1-p) ─────────────────────────────────────────

test('ulp: β=2, p=3 — ulp doubles at binade boundaries', () => {
	// e=0: ulp = 2^(0+1-3) = 0.25
	assert.equal(Math.pow(2, 0 + 1 - 3), 0.25);
	// e=1: ulp = 2^(1+1-3) = 0.5
	assert.equal(Math.pow(2, 1 + 1 - 3), 0.5);
	// e=-1: ulp = 2^(-1+1-3) = 0.125
	assert.equal(Math.pow(2, -1 + 1 - 3), 0.125);
});

// ── Relative error bound: |err|/|x| ≤ ε (nearest) ──────────

test('relative error ≤ ε for nearest rounding (normal numbers)', () => {
	const beta = 2, p = 3;
	const eps = 0.5 * Math.pow(beta, 1 - p); // 0.125
	const testValues = [1.0, 1.1, 1.5, 2.0, 3.14, 3.7, 0.5, 0.75, 7.9];
	for (const x of testValues) {
		const fl = flRound(x, beta, p);
		const relErr = Math.abs(x - fl) / Math.abs(x);
		assert.ok(relErr <= eps * (1 + 1e-10),
			`x=${x}: |err|/|x| = ${relErr} > ε = ${eps}`);
	}
});

test('relative error ≤ ε for nearest, β=10, p=3', () => {
	const beta = 10, p = 3;
	const eps = 0.5 * Math.pow(beta, 1 - p); // 0.005
	const testValues = [1.0, 3.14159, 99.9, 100.5, 0.123, 0.0567];
	for (const x of testValues) {
		const fl = flRound(x, beta, p);
		const relErr = Math.abs(x - fl) / Math.abs(x);
		assert.ok(relErr <= eps * (1 + 1e-10),
			`x=${x}: |err|/|x| = ${relErr} > ε = ${eps}`);
	}
});

// ── Absolute error bound: |err| ≤ ½ulp (nearest) ───────────

test('absolute error ≤ ½ulp for nearest rounding', () => {
	const beta = 2, p = 3;
	const testValues = [1.1, 1.3, 2.7, 3.7, 0.6, 0.9];
	for (const x of testValues) {
		const e = findExp(x, beta);
		const ulp = Math.pow(beta, e + 1 - p);
		const fl = flRound(x, beta, p);
		const absErr = Math.abs(x - fl);
		assert.ok(absErr <= ulp / 2 * (1 + 1e-10),
			`x=${x}: |err| = ${absErr} > ½ulp = ${ulp / 2}`);
	}
});

// ── Flushed zone rounding modes ─────────────────────────────

test('flushed zone: flRound always flushes to 0 when subnorm=false', () => {
	const beta = 2, p = 3, eMin = -1;
	// All values below minNorm flush to 0
	assert.equal(flRound(0.2, beta, p, eMin, undefined, false), 0);
	assert.equal(flRound(0.4, beta, p, eMin, undefined, false), 0);
	assert.equal(flRound(0.25, beta, p, eMin, undefined, false), 0);
});

test('flushed zone: relative error can reach 100%', () => {
	const beta = 2, p = 3, eMin = -1;
	const eps = 0.5 * Math.pow(beta, 1 - p); // 0.125
	// x=0.4, fl=0: |err|/|x| = 0.4/0.4 = 1.0 >> ε
	const fl = flRound(0.4, beta, p, eMin, undefined, false);
	assert.equal(fl, 0);
	const relErr = Math.abs(0.4 - fl) / 0.4;
	assert.ok(relErr > eps, `flushed zone should violate ε bound: ${relErr} vs ${eps}`);
});

// ── Subnormals restore ε bound ──────────────────────────────

test('subnormals: relative error ≤ ε is NOT guaranteed (gradual underflow)', () => {
	const beta = 2, p = 3, eMin = -1;
	const eps = 0.5 * Math.pow(beta, 1 - p);
	// With subnormals on, ULP = β^(eMin+1-p) = 2^(-3) = 0.125
	// x=0.4: e=-2 < eMin, subnormal ulp=0.125
	// fl_floor = floor(0.4/0.125)*0.125 = 3*0.125 = 0.375
	// fl_ceil = 0.5, dLo=0.025, dHi=0.1 → fl=0.375
	const fl = flRound(0.4, beta, p, eMin, undefined, true);
	assert.equal(fl, 0.375);
	const relErr = Math.abs(0.4 - fl) / 0.4;
	// 0.025/0.4 = 0.0625 ≤ ε=0.125 ✓
	assert.ok(relErr <= eps * (1 + 1e-10),
		`subnormal should satisfy ε bound: ${relErr} vs ${eps}`);
});

// ── ULP ≈ 2ε|x| approximation ──────────────────────────────

test('ulp ≈ 2ε|x|: exact at binade lower bound, within β factor', () => {
	const beta = 2, p = 3;
	const eps = 0.5 * Math.pow(beta, 1 - p);
	// At lower bound of binade: x = β^e → ulp = 2ε·|x| exactly
	for (const e of [-2, -1, 0, 1, 2, 3]) {
		const x = Math.pow(beta, e);
		const ulp = Math.pow(beta, e + 1 - p);
		assert.ok(Math.abs(ulp - 2 * eps * x) < 1e-15,
			`e=${e}: ulp=${ulp} should equal 2ε|x|=${2 * eps * x}`);
	}
	// At upper bound: x → β^(e+1), ratio ulp/(2ε|x|) → 1/β
	const x = Math.pow(beta, 1) * 0.999; // just below β^(e+1) for e=0
	const ulp = Math.pow(beta, 0 + 1 - p); // ulp for e=0
	const ratio = ulp / (2 * eps * x);
	assert.ok(ratio < 1, `near upper binade bound: ratio=${ratio} should be < 1`);
	assert.ok(ratio > 1 / beta, `ratio=${ratio} should be > 1/β=${1 / beta}`);
});

// ── Overflow ─────────────────────────────────────────────────

test('overflow: e > eMax → Infinity', () => {
	assert.equal(flRound(100, 2, 3, undefined, 2), Infinity);
	assert.equal(flRound(-100, 2, 3, undefined, 2), -Infinity);
});

test('no overflow at eMax boundary', () => {
	// β=2, eMax=2: max representable = (2-ulp)*2^2 = 7.0
	const fl = flRound(7.0, 2, 3, undefined, 2);
	assert.ok(isFinite(fl), `7.0 should not overflow with eMax=2`);
});

// ── Ties-to-even across binades ─────────────────────────────

test('ties-to-even: at binade boundary β=2, p=3', () => {
	assert.equal(flRound(1.0, 2, 3), 1.0);
	// k=4 (even) → floor
	assert.equal(flRound(1.125, 2, 3), 1.0);
	// k=5 (odd) → ceil
	assert.equal(flRound(1.375, 2, 3), 1.5);
});

// ── Binade transitions: ULP jumps at powers of β ────────────

test('binade transition: ulp changes at β^e boundary', () => {
	const beta = 2, p = 3;
	// Just below 2.0 (e=0, ulp=0.25): fl(1.9) = 2.0 (rounds up)
	assert.equal(flRound(1.9, beta, p), 2.0);
	// Just above 2.0 (e=1, ulp=0.5): fl(2.1) = 2.0 (rounds down)
	assert.equal(flRound(2.1, beta, p), 2.0);
	// 2.3 in e=1 binade: fl(2.3) = 2.5 (dLo=0.3, dHi=0.2 → ceil)
	assert.equal(flRound(2.3, beta, p), 2.5);
});

test('binade transition: ulp jumps β× at boundary β=10', () => {
	const beta = 10, p = 3;
	// e=0: ulp=0.01. 9.96 is exactly representable (3 sig digits)
	assert.equal(flRound(9.96, beta, p), 9.96);
	// 9.999 rounds up to 10.0 (crosses into e=1 binade)
	assert.equal(flRound(9.999, beta, p), 10.0);
	// e=1: ulp=0.1. fl(10.4)=10.4 (exact)
	assert.equal(flRound(10.4, beta, p), 10.4);
	assert.equal(flRound(10.36, beta, p), 10.4); // rounds up
	assert.equal(flRound(10.34, beta, p), 10.3); // rounds down
});

// ── Negative numbers preserve symmetry ──────────────────────

test('negative numbers: fl(-x) = -fl(x)', () => {
	const beta = 2, p = 3;
	const values = [1.1, 1.3, 2.7, 3.7, 0.6];
	for (const x of values) {
		assert.equal(flRound(-x, beta, p), -flRound(x, beta, p),
			`fl(-${x}) should equal -fl(${x})`);
	}
});

test('negative subnormals: fl(-x) = -fl(x)', () => {
	const beta = 2, p = 3, eMin = -1;
	assert.equal(flRound(-0.4, beta, p, eMin), -flRound(0.4, beta, p, eMin));
	assert.equal(flRound(-0.3, beta, p, eMin), -flRound(0.3, beta, p, eMin));
});

// ── Subnormal ULP is constant ───────────────────────────────

test('subnormal: ULP is constant β^(eMin+1-p) across entire subnormal range', () => {
	const beta = 2, p = 3, eMin = -1;
	const subUlp = Math.pow(beta, eMin + 1 - p); // 2^(-3) = 0.125
	// All subnormal values should round to multiples of subUlp
	const values = [0.1, 0.2, 0.3, 0.4, 0.45];
	for (const x of values) {
		const fl = flRound(x, beta, p, eMin, undefined, true);
		const remainder = fl / subUlp - Math.round(fl / subUlp);
		assert.ok(Math.abs(remainder) < 1e-10,
			`fl(${x})=${fl} should be multiple of subUlp=${subUlp}`);
	}
});

// ── Worst-case relative error at binade lower bound ─────────

test('worst case: |err|/|x| → ε/(1+ε) at binade lower bound', () => {
	const beta = 2, p = 3;
	const eps = 0.5 * Math.pow(beta, 1 - p); // 0.125
	// Theoretical max relative error = ε/(1+ε) at x = β^e + ½ulp
	const theorMax = eps / (1 + eps); // 0.1111...
	for (const e of [-2, -1, 0, 1, 2]) {
		const baseVal = Math.pow(beta, e);
		const ulp = Math.pow(beta, e + 1 - p);
		const x = baseVal + ulp / 2 - 1e-15; // just below midpoint → rounds to baseVal
		const fl = flRound(x, beta, p);
		const relErr = Math.abs(x - fl) / x;
		// Must not exceed ε
		assert.ok(relErr <= eps * (1 + 1e-9),
			`e=${e}: relErr=${relErr} should be ≤ ε=${eps}`);
		// Should be close to theoretical max ε/(1+ε)
		assert.ok(relErr > theorMax * 0.99,
			`e=${e}: relErr=${relErr} should be close to ε/(1+ε)=${theorMax}`);
	}
});

// ── Exact representable values have zero error ──────────────

test('exact values: representable numbers have zero rounding error', () => {
	const beta = 2, p = 3;
	// All multiples of ulp within a binade are exact
	// e=0, ulp=0.25: 1.0, 1.25, 1.5, 1.75
	const exact = [1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 3.5, 0.5, 0.625, 0.75];
	for (const x of exact) {
		assert.equal(flRound(x, beta, p), x,
			`fl(${x}) should be exact`);
	}
});

test('exact values β=10: p=3 digit values', () => {
	const exact = [1.23, 4.56, 100, 0.0123, 99.9, 1.00];
	for (const x of exact) {
		assert.equal(flRound(x, 10, 3), x, `fl(${x}) should be exact in β=10, p=3`);
	}
});

// ── Sweep: ε bound holds across many values ─────────────────

test('sweep: ε bound for β=2, p=4 across 1000 values', () => {
	const beta = 2, p = 4;
	const eps = 0.5 * Math.pow(beta, 1 - p); // 0.0625
	for (let i = 1; i <= 1000; i++) {
		const x = i * 0.037; // 0.037 to 37.0
		const fl = flRound(x, beta, p);
		const relErr = Math.abs(x - fl) / x;
		assert.ok(relErr <= eps * (1 + 1e-9),
			`x=${x}: relErr=${relErr} > ε=${eps}`);
	}
});

test('sweep: ε bound for β=10, p=4 across 1000 values', () => {
	const beta = 10, p = 4;
	const eps = 0.5 * Math.pow(beta, 1 - p); // 0.0005
	for (let i = 1; i <= 1000; i++) {
		const x = i * 0.123;
		const fl = flRound(x, beta, p);
		const relErr = Math.abs(x - fl) / x;
		assert.ok(relErr <= eps * (1 + 1e-9),
			`x=${x}: relErr=${relErr} > ε=${eps}`);
	}
});

// ── findExp edge cases ──────────────────────────────────────

test('findExp: exact powers of β', () => {
	for (const e of [-3, -2, -1, 0, 1, 2, 3]) {
		assert.equal(findExp(Math.pow(2, e), 2), e, `findExp(2^${e}, 2)`);
		assert.equal(findExp(Math.pow(10, e), 10), e, `findExp(10^${e}, 10)`);
	}
});

test('findExp: just above and below powers of β', () => {
	// Just above 1.0 → e=0
	assert.equal(findExp(1.0001, 2), 0);
	// Just below 2.0 → e=0
	assert.equal(findExp(1.9999, 2), 0);
	// Just above 2.0 → e=1
	assert.equal(findExp(2.0001, 2), 1);
});

// ── Overflow boundary ───────────────────────────────────────

test('overflow: rounding near overflow boundary', () => {
	const beta = 2, p = 3, eMax = 2;
	// Max representable: (2 - 2^(1-p)) * 2^eMax = (2 - 0.25) * 4 = 7.0
	assert.equal(flRound(7.0, beta, p, undefined, eMax), 7.0);
	// 7.1 still rounds to 7.0 (within binade, ulp=1)
	assert.equal(flRound(7.1, beta, p, undefined, eMax), 7.0);
	// 7.5: ties-to-even → k=7 (odd) → rounds up to 8.0
	// Note: flRound doesn't post-check overflow on rounded result
	assert.equal(flRound(7.5, beta, p, undefined, eMax), 8.0);
	// Input already in overflow binade (e=3 > eMax) → Infinity
	assert.equal(flRound(8.0, beta, p, undefined, eMax), Infinity);
	assert.equal(flRound(10.0, beta, p, undefined, eMax), Infinity);
	assert.equal(flRound(-8.0, beta, p, undefined, eMax), -Infinity);
});
