const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { fp8Decode, fp8Encode, fp8MaxVal, fp8Enumerate, fp8ToBits } = require('../fp-fp8');

// ── E4M3FN ────────────────────────────────────────────────────

test('E4M3FN: decode zero', () => {
	assert.equal(fp8Decode(0x00, 'E4M3FN'), 0);
	assert.equal(fp8Decode(0x80, 'E4M3FN'), -0);
});

test('E4M3FN: decode 1.0', () => {
	// 1.0 = S=0, exp=7 (biased), m=0 → byte = 0_0111_000 = 0x38 = 56
	assert.equal(fp8Decode(0x38, 'E4M3FN'), 1.0);
});

test('E4M3FN: decode -1.0', () => {
	assert.equal(fp8Decode(0xB8, 'E4M3FN'), -1.0);
});

test('E4M3FN: decode 2.0', () => {
	// 2.0 = S=0, exp=8 (biased), m=0 → byte = 0_1000_000 = 0x40
	assert.equal(fp8Decode(0x40, 'E4M3FN'), 2.0);
});

test('E4M3FN: decode NaN (0x7F)', () => {
	assert.ok(isNaN(fp8Decode(0x7F, 'E4M3FN')));
	assert.ok(isNaN(fp8Decode(0xFF, 'E4M3FN')));
});

test('E4M3FN: max value = 448', () => {
	// 0x7E = 0_1111_110 → S=0, exp=15, m=6 → 2^(15-7) × (1+6/8) = 256×1.75 = 448
	assert.equal(fp8Decode(0x7E, 'E4M3FN'), 448);
	assert.equal(fp8MaxVal('E4M3FN'), 448);
});

test('E4M3FN: subnormal values', () => {
	// min positive subnormal: S=0, exp=0, m=1 → 2^(-6) × 1/8 = 1/512
	assert.ok(Math.abs(fp8Decode(0x01, 'E4M3FN') - 1 / 512) < 1e-12);
	// max subnormal: S=0, exp=0, m=7 → 2^(-6) × 7/8 = 7/512
	assert.ok(Math.abs(fp8Decode(0x07, 'E4M3FN') - 7 / 512) < 1e-12);
});

test('E4M3FN: enumerate count (254 finite values)', () => {
	// 256 total − 2 NaN (0x7F, 0xFF) = 254 finite (includes ±0)
	const fin = fp8Enumerate('E4M3FN');
	assert.equal(fin.length, 254);
});

test('E4M3FN: enumerate sorted', () => {
	const fin = fp8Enumerate('E4M3FN');
	for (var i = 1; i < fin.length; i++) {
		assert.ok(fin[i].value >= fin[i - 1].value,
			`not sorted at index ${i}: ${fin[i - 1].value} > ${fin[i].value}`);
	}
});

test('E4M3FN: encode 1.0 → 0x38', () => {
	assert.equal(fp8Encode(1.0, 'E4M3FN'), 0x38);
});

test('E4M3FN: encode -1.0 → 0xB8', () => {
	assert.equal(fp8Encode(-1.0, 'E4M3FN'), 0xB8);
});

test('E4M3FN: encode NaN → canonical NaN byte', () => {
	assert.ok(isNaN(fp8Decode(fp8Encode(NaN, 'E4M3FN'), 'E4M3FN')));
});

test('E4M3FN: encode round-trip (exact values)', () => {
	const exact = [0, 1, -1, 2, 0.5, 0.25, 448, -448];
	for (const v of exact) {
		const b = fp8Encode(v, 'E4M3FN');
		const dec = fp8Decode(b, 'E4M3FN');
		assert.equal(dec, v, `round-trip failed for ${v}: decoded ${dec}`);
	}
});

test('E4M3FN: fp8ToBits 1.0', () => {
	// 0x38 = 0_0111_000
	assert.equal(fp8ToBits(0x38, 'E4M3FN'), '0.0111.000');
});

// ── E5M2 ─────────────────────────────────────────────────────

test('E5M2: decode zero', () => {
	assert.equal(fp8Decode(0x00, 'E5M2'), 0);
});

test('E5M2: decode 1.0', () => {
	// 1.0 = S=0, exp=15 (biased), m=0 → byte = 0_01111_00 = 0x3C = 60
	assert.equal(fp8Decode(0x3C, 'E5M2'), 1.0);
});

test('E5M2: decode Infinity', () => {
	// 0x7C = 0_11111_00 → Infinity
	assert.equal(fp8Decode(0x7C, 'E5M2'), Infinity);
	assert.equal(fp8Decode(0xFC, 'E5M2'), -Infinity);
});

test('E5M2: decode NaN', () => {
	assert.ok(isNaN(fp8Decode(0x7D, 'E5M2')));
	assert.ok(isNaN(fp8Decode(0x7E, 'E5M2')));
	assert.ok(isNaN(fp8Decode(0x7F, 'E5M2')));
});

test('E5M2: max value = 57344', () => {
	// 0x7B = 0_11110_11 → S=0, exp=30, m=3 → 2^(30-15) × 1.75 = 57344
	assert.equal(fp8Decode(0x7B, 'E5M2'), 57344);
	assert.equal(fp8MaxVal('E5M2'), 57344);
});

test('E5M2: enumerate finite count', () => {
	// 256 − 4 NaN (exp=11111, m=01,10,11 for +/-) − 2 Inf = 250 finite
	const fin = fp8Enumerate('E5M2');
	assert.equal(fin.length, 248);
});

test('E5M2: encode 1.0 → 0x3C', () => {
	assert.equal(fp8Encode(1.0, 'E5M2'), 0x3C);
});

test('invalid format throws', () => {
	assert.throws(() => fp8Decode(0, 'E3M4'), /Unknown FP8 format/);
});
