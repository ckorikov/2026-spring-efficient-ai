const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { fracRange, toBinary, fromBinary } = require('../fp-fixed');

test('fracRange: unsigned Q4.0 (4-bit integer)', () => {
	const r = fracRange(4, 0, false);
	assert.equal(r.min, 0);
	assert.equal(r.max, 15);
	assert.equal(r.step, 1);
	assert.equal(r.count, 16);
});

test('fracRange: signed Q4.0 (4-bit signed integer)', () => {
	const r = fracRange(4, 0, true);
	assert.equal(r.min, -8);
	assert.equal(r.max, 7);
	assert.equal(r.step, 1);
	assert.equal(r.count, 16);
});

test('fracRange: unsigned Q0.4 (4 fractional bits)', () => {
	const r = fracRange(0, 4, false);
	assert.equal(r.min, 0);
	assert.equal(r.step, 1 / 16);
	assert.equal(r.count, 16);
	assert.ok(Math.abs(r.max - 15 / 16) < 1e-12);
});

test('fracRange: signed Q2.5', () => {
	const r = fracRange(2, 5, true);
	// totalBits=7, step=1/32, count=128, min=-2, max=(64-1)/32=63/32=1.96875
	assert.equal(r.step, 1 / 32);
	assert.equal(r.count, 128);
	assert.equal(r.min, -2);
	assert.ok(Math.abs(r.max - 63 / 32) < 1e-12);
});

test('fracRange: 0 bits returns zeros', () => {
	const r = fracRange(0, 0, false);
	assert.equal(r.count, 0);
});

test('toBinary: unsigned Q4.0 integers', () => {
	assert.equal(toBinary(0,  4, false, 0), '0000');
	assert.equal(toBinary(1,  4, false, 0), '0001');
	assert.equal(toBinary(15, 4, false, 0), '1111');
});

test('toBinary: signed Q4.0', () => {
	assert.equal(toBinary(0,  4, true, 0), '0000');
	assert.equal(toBinary(7,  4, true, 0), '0111');
	assert.equal(toBinary(-1, 4, true, 0), '1111');
	assert.equal(toBinary(-8, 4, true, 0), '1000');
});

test('toBinary: fractional Q0.4', () => {
	// 0.5 = 0b1000 in Q0.4 (unsigned)
	assert.equal(toBinary(0.5, 4, false, 4), '1000');
	// 0.25 = 0b0100
	assert.equal(toBinary(0.25, 4, false, 4), '0100');
	// 0.0625 = 1/16 = 0b0001
	assert.equal(toBinary(1 / 16, 4, false, 4), '0001');
});

test('fromBinary: unsigned Q4.0 round-trip', () => {
	for (var v = 0; v <= 15; v++) {
		const bits = toBinary(v, 4, false, 0);
		assert.equal(fromBinary(bits, 4, false, 0), v);
	}
});

test('fromBinary: signed Q4.0 round-trip', () => {
	for (var v = -8; v <= 7; v++) {
		const bits = toBinary(v, 4, true, 0);
		assert.equal(fromBinary(bits, 4, true, 0), v);
	}
});

test('fromBinary: fractional Q0.4 round-trip', () => {
	const { fracRange } = require('../fp-fixed');
	const r = fracRange(0, 4, false);
	for (var i = 0; i < r.count; i++) {
		const v = r.min + i * r.step;
		const bits = toBinary(v, 4, false, 4);
		assert.ok(Math.abs(fromBinary(bits, 4, false, 4) - v) < 1e-12,
			`round-trip failed at v=${v}`);
	}
});
