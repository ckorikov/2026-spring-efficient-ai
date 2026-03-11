(function () {
	function parseMantissa(str, base) {
		var dot = str.indexOf('.');
		var iStr = dot >= 0 ? str.slice(0, dot) : str;
		var fStr = dot >= 0 ? str.slice(dot + 1) : '';
		var val = iStr.length ? parseInt(iStr, base) : 0;
		for (var i = 0; i < fStr.length; i++) {
			val += parseInt(fStr[i], base) * Math.pow(base, -(i + 1));
		}
		return val;
	}
	function fmtDecoded(v) {
		if (!isFinite(v)) return '?';
		if (v === 0) return '0';
		var s = v.toPrecision(4);
		return parseFloat(s).toString();
	}
	function fillDecoded() {
		document.querySelectorAll('.fp-repr').forEach(function (el) {
			var m = el.getAttribute('data-m');
			var base = parseInt(el.getAttribute('data-base'));
			var exp = parseInt(el.getAttribute('data-exp'));
			var val = parseMantissa(m, base) * Math.pow(base, exp);
			var out = el.querySelector('.fp-val');
			if (out) out.textContent = '(' + fmtDecoded(val) + ')';
		});
	}
	document.addEventListener('DOMContentLoaded', fillDecoded);
})();
