const { test } = require('node:test');
const assert   = require('node:assert/strict');
const H        = require('../fp-heron');

// ── heronExact ──────────────────────────────────────────────────
test('heronExact: 3-4-5 right triangle', () => {
	assert.equal(H.heronExact(3, 4, 5).area, 6);
});

test('heronExact: equilateral side=2', () => {
	assert.ok(Math.abs(H.heronExact(2, 2, 2).area - Math.sqrt(3)) < 1e-12);
});

test('heronExact: degenerate (collinear)', () => {
	assert.equal(H.heronExact(3, 1, 2).area, 0);
});

// ── heronNaive vs heronKahan ────────────────────────────────────
test('Goldberg example: naive fails, Kahan succeeds (β=10, p=3)', () => {
	const exact  = H.heronExact(9, 4.53, 4.53).area;
	const naive  = H.heronNaive(9, 4.53, 4.53, 10, 3, -1, 2, true);
	const kahan  = H.heronKahan(9, 4.53, 4.53, 10, 3, -1, 2, true);
	assert.equal(naive.area, 0);
	assert.ok(Math.abs(kahan.area - exact) < 0.01);
});

test('well-conditioned 3-4-5: both agree', () => {
	const naive = H.heronNaive(3, 4, 5, 10, 6, -10, 10, true);
	const kahan = H.heronKahan(3, 4, 5, 10, 6, -10, 10, true);
	assert.ok(Math.abs(naive.area - 6) < 1e-10);
	assert.ok(Math.abs(kahan.area - 6) < 1e-10);
});

test('near-flat triangle: Kahan error <= naive error', () => {
	const a = 100, b = 50.001, c = 50.001;
	const exact = H.heronExact(a, b, c).area;
	const naive = H.heronNaive(a, b, c, 10, 4, -5, 5, true);
	const kahan = H.heronKahan(a, b, c, 10, 4, -5, 5, true);
	assert.ok(Math.abs(kahan.area - exact) <= Math.abs(naive.area - exact));
});

test('no eMin/eMax: unlimited precision range', () => {
	const naive = H.heronNaive(3, 4, 5, 10, 10);
	assert.ok(Math.abs(naive.area - 6) < 1e-6);
});

// ── ulpOf ───────────────────────────────────────────────────────
test('ulpOf: normal range', () => {
	assert.equal(H.ulpOf(1, 10, 3), 0.01);
	assert.equal(H.ulpOf(100, 10, 3), 1);
});

test('ulpOf: zero without eMin', () => {
	assert.equal(H.ulpOf(0, 10, 3), 0.01);
});

test('ulpOf: subnormal clamps to eMin', () => {
	assert.equal(H.ulpOf(0.005, 10, 3, -1), 0.001);
});

test('ulpOf: overflow returns Infinity', () => {
	assert.equal(H.ulpOf(5000, 10, 3, -1, 2), Infinity);
});
