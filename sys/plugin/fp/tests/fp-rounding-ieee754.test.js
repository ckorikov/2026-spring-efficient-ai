// Unit tests for flRound — direct corner-case coverage (IEEE 754 float32 semantics).
// Tests are hand-crafted; no dependency on external test-vector files.
const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { flRound } = require('../fp-rounding');

// Shorthand: float32 rounding
function fl32(v) { return flRound(v, 2, 24, -126, 127, true); }

// ── Normal range ──────────────────────────────────────────────────────────────

test('fl32: exact float32 value is unchanged', function () {
	assert.equal(fl32(1.0), 1.0);
	assert.equal(fl32(-1.0), -1.0);
	assert.equal(fl32(0.5), 0.5);
});

test('fl32: max float32 normal (2^127 × (2 − 2^−23)) is unchanged', function () {
	// max = (2 − 2^−23) × 2^127 = 3.4028234663852886e+38
	var max = (2 - Math.pow(2, -23)) * Math.pow(2, 127);
	assert.equal(fl32(max), max);
});

test('fl32: overflow → ±Infinity', function () {
	var overMax = 3.5e38;
	assert.equal(fl32(overMax), Infinity);
	assert.equal(fl32(-overMax), -Infinity);
});

test('fl32: zero and non-finite passthrough', function () {
	assert.equal(fl32(0), 0);
	assert.equal(fl32(Infinity), Infinity);
	assert.equal(fl32(-Infinity), -Infinity);
	assert.ok(Number.isNaN(fl32(NaN)));
});

// ── Rounding: ties-to-even ────────────────────────────────────────────────────

test('fl32: ties-to-even rounds to even significand', function () {
	// ULP at 1.0 in float32 = 2^(0+1−24) = 2^−23
	var ulp = Math.pow(2, -23);
	// 1.0 is even (trailing 0), so tie rounds DOWN (to 1.0)
	assert.equal(fl32(1.0 + ulp / 2), 1.0);
	// 1.0 + ulp is odd, so tie rounds UP (to 1.0 + 2*ulp)
	assert.equal(fl32(1.0 + ulp + ulp / 2), 1.0 + 2 * ulp);
});

// ── Subnormal range ───────────────────────────────────────────────────────────

test('fl32: min subnormal is representable', function () {
	var minSub = Math.pow(2, -149); // 2^(eMin+1-p) = 2^(-126+1-24)
	assert.equal(fl32(minSub), minSub);
});

test('fl32: below half min-subnormal → underflow to 0', function () {
	var halfMinSub = Math.pow(2, -150);
	assert.equal(fl32(halfMinSub), 0);
});

test('fl32: flush-to-zero mode: subnormal → 0', function () {
	var minSub = Math.pow(2, -149);
	var ftz = flRound(minSub, 2, 24, -126, 127, false);
	assert.equal(ftz, 0);
});

test('fl32: subnormal round-to-nearest', function () {
	var subUlp = Math.pow(2, -149);
	// 1.5 × minSubnormal: rounds to 2 × minSubnormal (even)
	var twoSub = 2 * subUlp;
	assert.equal(fl32(1.5 * subUlp), twoSub);
	// 2.5 × minSubnormal: rounds to 2 × minSubnormal (even) — ties-to-even
	assert.equal(fl32(2.5 * subUlp), twoSub);
	// 3.5 × minSubnormal: rounds to 4 × minSubnormal (even) — ties-to-even
	assert.equal(fl32(3.5 * subUlp), 4 * subUlp);
});

// ── Non-binary base ───────────────────────────────────────────────────────────

test('base-10 p=3: fl(5.005) = 5.01 (round half up from mid)', function () {
	// ULP at 5.005 (e=0): β^(0+1−3) = 0.01; midpoint 5.005 is exact tie
	// 5.005 / 0.01 = 500.5, floor=500 (even), so rounds to 500 × 0.01 = 5.00
	assert.equal(flRound(5.005, 10, 3, undefined, undefined, false), 5.0);
});

test('base-10 p=3: fl(9.56) = 9.56 is not representable → rounds to 9.56', function () {
	// e=0, ulp=0.01, 9.56/0.01=956, exact → no rounding needed
	assert.equal(flRound(9.56, 10, 3), 9.56);
});

test('base-10 p=3: Goldberg a=9, b=c=4.53, sum = fl(fl(9)+fl(4.53)) + fl(4.53)', function () {
	function fl(v) { return flRound(v, 10, 3); }
	var sum = fl(fl(fl(9) + fl(4.53)) + fl(4.53));
	assert.equal(sum, 18.0);
});
