const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { findExp, flRound } = require('../fp-rounding');

test('findExp: base 10', () => {
	assert.equal(findExp(1,   10), 0);
	assert.equal(findExp(9.9, 10), 0);
	assert.equal(findExp(10,  10), 1);
	assert.equal(findExp(100, 10), 2);
	assert.equal(findExp(0.1, 10), -1);
	assert.equal(findExp(0.01, 10), -2);
});

test('findExp: base 2', () => {
	assert.equal(findExp(1, 2), 0);
	assert.equal(findExp(2, 2), 1);
	assert.equal(findExp(3, 2), 1);
	assert.equal(findExp(4, 2), 2);
	assert.equal(findExp(0.5, 2), -1);
});

test('flRound: exact values are unchanged', () => {
	assert.equal(flRound(1.23, 10, 3), 1.23);
	assert.equal(flRound(100, 10, 3), 100);
	assert.equal(flRound(0,   10, 3), 0);
});

test('flRound: rounding down', () => {
	// fl(3.14159, β=10, p=3) → 3.14
	assert.equal(flRound(3.14159, 10, 3), 3.14);
});

test('flRound: rounding up', () => {
	// fl(3.146, β=10, p=3): dLo=0.006 > dHi=0.004 → 3.15
	assert.equal(flRound(3.146, 10, 3), 3.15);
});

test('flRound: ties-to-even (round half to even)', () => {
	// fl(2.5, β=10, p=1): k=2 (even) → round down to 2
	assert.equal(flRound(2.5, 10, 1), 2);
	// fl(3.5, β=10, p=1): k=3 (odd) → round up to 4
	assert.equal(flRound(3.5, 10, 1), 4);
	// fl(4.5, β=10, p=1): k=4 (even) → round down to 4
	assert.equal(flRound(4.5, 10, 1), 4);
});

test('flRound: negative values', () => {
	assert.equal(flRound(-3.14159, 10, 3), -3.14);
	assert.equal(flRound(-1.5, 10, 1), -2);
});

test('flRound: non-finite pass-through', () => {
	assert.equal(flRound(Infinity, 10, 3), Infinity);
	assert.ok(isNaN(flRound(NaN, 10, 3)));
});

test('flRound: base 2, p=3 (3 significand bits)', () => {
	// 1.001 × 2^0 = 1.125; fl(1.1, 2, 3) → 1.0 (rounds to 1.000)? let's verify
	// 1.1: e=0, ulp=2^(0+1-3)=2^(-2)=0.25, k=floor(1.1/0.25)=4, lo=1.0, hi=1.25
	// dLo=0.1, dHi=0.15 → closer to lo → 1.0
	assert.equal(flRound(1.1, 2, 3), 1.0);
	// 1.375: exact in binary (1.011) → unchanged
	assert.equal(flRound(1.375, 2, 4), 1.375);
});

test('flRound: Goldberg example β=10, p=3 — key intermediate', () => {
	// s(a=9, b=c=4.53): s = (9+4.53+4.53)/2 = 9.03
	// fl(4.53+4.53)=fl(9.06)=9.06 (exact in p=3)
	// fl(9+9.06)=fl(18.06)=18.1
	// fl(18.1/2)=fl(9.05)=9.05
	assert.equal(flRound(18.06, 10, 3), 18.1);
	assert.equal(flRound(9.05, 10, 3), 9.05);
	// fl(s-a) = fl(9.05-9) = fl(0.05) = 0.05 (ok, but catastrophic cancellation visible)
	const s = flRound(18.1 / 2, 10, 3);
	assert.equal(s, 9.05);
	const sma = flRound(s - flRound(9, 10, 3), 10, 3);
	assert.equal(sma, 0.05);
});

test('flRound: backward compatible without eMin/eMax', () => {
	assert.equal(flRound(0.001, 10, 3), 0.001);
});

test('flRound: subnormal β=10, p=3, eMin=-1', () => {
	// min normal = β^eMin = 0.1; subnormal ULP = 10^(-1+1-3) = 0.001
	assert.equal(flRound(0.05,   10, 3, -1), 0.050);
	assert.equal(flRound(0.0344, 10, 3, -1), 0.034);
	assert.equal(flRound(0.0346, 10, 3, -1), 0.035);
});

test('flRound: subnormal ULP is constant (no shrinkage near 0)', () => {
	// both 0.1 (normal) and 0.01 (subnormal) have same ULP = 0.001
	assert.equal(flRound(0.1,  10, 3, -1), 0.1);
	assert.equal(flRound(0.01, 10, 3, -1), 0.010);
});

test('flRound: flush to zero below min subnormal', () => {
	// min subnormal = 1 * 0.001 = 0.001; 0.0004 rounds to 0
	assert.equal(flRound(0.0004, 10, 3, -1), 0);
});

test('flRound: overflow → ±Infinity', () => {
	assert.equal(flRound( 1000, 10, 3, undefined, 1),  Infinity);
	assert.equal(flRound(-1000, 10, 3, undefined, 1), -Infinity);
});

test('flRound: no overflow at eMax boundary', () => {
	assert.notEqual(flRound(100, 10, 3, undefined, 2), Infinity);
});
