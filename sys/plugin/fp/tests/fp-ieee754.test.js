const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { fpMaxVal, fpEnumerate, fpToBits, fpFromBits } = require('../fp-ieee754');

test('fpMaxVal: float16 (1+5+10)', () => {
	// bias=15, eMax=30, mMax=1023/1024 → 2^15 × 1.9990234375 ≈ 65504
	const max = fpMaxVal(16, 5);
	assert.equal(max, 65504);
});

test('fpMaxVal: float32 (1+8+23)', () => {
	// bias=127, eMax=254 → 2^127 × (1 + (2^23-1)/2^23) ≈ 3.4028235e38
	const max = fpMaxVal(32, 8);
	assert.ok(Math.abs(max - 3.4028234663852886e38) < 1e30, 'float32 max approximately correct');
});

test('fpMaxVal: 8-bit fp (1+4+3)', () => {
	// bias=7, eMax=14, mMax=7/8 → 2^7 × 1.875 = 240
	const max = fpMaxVal(8, 4);
	assert.equal(max, 240);
});

test('fpEnumerate: 4-bit fp (1+2+1) count', () => {
	// 1s+2e+1m: bias=1, eMax=3
	// subnormals: e=0, m=0,1 → 0, and e=0,m=1 → (1/2)*2^(1-1)=0.5 (+/-)
	// normals: e=1..2, m=0,1 → 4 positive values
	// e=3 is all-ones → Inf/NaN (excluded from finite)
	// finite positives: 0, 0.5, 1, 1.5, 2, 3; symmetrically negatives
	const vals = fpEnumerate(4, 2);
	assert.ok(vals.length > 0);
	assert.equal(vals[0], -vals[vals.length - 1]); // symmetric
	assert.equal(vals[Math.floor(vals.length / 2)], 0); // contains zero
});

test('fpEnumerate: float16 contains 0 and is symmetric', () => {
	const vals = fpEnumerate(16, 5);
	assert.equal(vals[Math.floor(vals.length / 2)], 0);
	assert.ok(vals.length > 1000);
	// Max value
	assert.equal(vals[vals.length - 1], 65504);
});

test('fpToBits: zero', () => {
	assert.equal(fpToBits(0, 8, 4), '00000000');
});

test('fpToBits: float16 — 1.0', () => {
	// float16: 1.0 = 0 01111 0000000000
	assert.equal(fpToBits(1.0, 16, 5), '0011110000000000');
});

test('fpToBits: float16 — -1.0', () => {
	assert.equal(fpToBits(-1.0, 16, 5), '1011110000000000');
});

test('fpToBits: float16 — 2.0', () => {
	// 2.0 = 0 10000 0000000000
	assert.equal(fpToBits(2.0, 16, 5), '0100000000000000');
});

test('fpFromBits: round-trip with fpToBits (float16)', () => {
	const vals = [1.0, -1.0, 2.0, 0.5, 100];
	for (const v of vals) {
		const bits = fpToBits(v, 16, 5);
		const decoded = fpFromBits(bits, 16, 5);
		assert.ok(Math.abs(decoded - v) / Math.abs(v) < 0.001,
			`round-trip failed for ${v}: got ${decoded}`);
	}
});

test('fpFromBits: infinity and NaN (float16)', () => {
	// Inf = 0 11111 0000000000 = 0111110000000000
	assert.equal(fpFromBits('0111110000000000', 16, 5), Infinity);
	assert.equal(fpFromBits('1111110000000000', 16, 5), -Infinity);
	assert.ok(isNaN(fpFromBits('0111111000000000', 16, 5)));
});
