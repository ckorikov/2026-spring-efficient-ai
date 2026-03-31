const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { Frac } = require('../fp-rational');

test('Frac: construction from integer', () => {
	const f = new Frac(3);
	assert.equal(f.toFloat(), 3);
});

test('Frac.from: parse integer string', () => {
	assert.equal(Frac.from('42').toFloat(), 42);
	assert.equal(Frac.from('-7').toFloat(), -7);
});

test('Frac.from: parse decimal string', () => {
	assert.equal(Frac.from('1.5').toFloat(), 1.5);
	assert.equal(Frac.from('0.25').toFloat(), 0.25);
	assert.equal(Frac.from('-3.14').toFloat(), -3.14);
});

test('Frac: add', () => {
	const result = Frac.from('1.5').add(Frac.from('0.5'));
	assert.equal(result.toFloat(), 2);
});

test('Frac: sub', () => {
	const result = Frac.from('1234').sub(Frac.from('1233'));
	assert.equal(result.toFloat(), 1);
	// Exact: no floating-point error
	assert.equal(result.toStr(), '1');
});

test('Frac: mul', () => {
	const result = Frac.from('1.5').mul(Frac.from('2'));
	assert.equal(result.toFloat(), 3);
});

test('Frac: div', () => {
	const result = Frac.from('1').div(Frac.from('3'));
	// 1/3 in float
	assert.ok(Math.abs(result.toFloat() - 1 / 3) < 1e-15);
});

test('Frac: x²-y² exact via mul/sub', () => {
	// (1234)² - (1233)² = (1234-1233)(1234+1233) = 1 × 2467 = 2467
	const x = Frac.from('1234'), y = Frac.from('1233');
	const naive = x.mul(x).sub(y.mul(y));
	assert.equal(naive.toStr(), '2467');
	assert.equal(naive.toFloat(), 2467);
});

test('Frac: toStr integer', () => {
	assert.equal(Frac.from('5').toStr(), '5');
	assert.equal(Frac.from('-3').toStr(), '−3');
});

test('Frac: toStr decimal — exact', () => {
	assert.equal(Frac.from('1.5').toStr(), '1.5');
	assert.equal(Frac.from('0.25').toStr(), '0.25');
});

test('Frac: toStr repeating — truncated with …', () => {
	const third = Frac.from('1').div(Frac.from('3'));
	const s = third.toStr(6);
	assert.ok(s.startsWith('0.333333'), `got: ${s}`);
	assert.ok(s.endsWith('…'), `expected ellipsis, got: ${s}`);
});

test('Frac: negation round-trip', () => {
	const a = Frac.from('3.7');
	const neg = new Frac(0).sub(a);
	assert.ok(Math.abs(neg.toFloat() + 3.7) < 1e-12);
});

test('Frac: large numbers stay exact', () => {
	const big = Frac.from('999999999999999');
	const result = big.mul(big);
	// JS Number can't hold this exactly, but Frac can
	assert.equal(result.toStr(), '999999999999998000000000000001');
});
