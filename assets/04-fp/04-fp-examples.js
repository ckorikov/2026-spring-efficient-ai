(function () {
	var fmtFP = FpRepr.fmtFP;
	var flRound = FpRounding.flRound;
	var findExp = FpRounding.findExp;

	var EMAX = 5;
	var COL_CLS = ['ieee754-col-m', 'ieee754-col-e', 'ieee754-col-t'];
	var FORMATS = [
		{ beta: 10, p: 3 },
		{ beta: 2, p: 24 },
		{ beta: 3, p: 3 }
	];
	var NUMBERS = [
		{ label: '0.5', value: 0.5 },
		{ label: '0.1', value: 0.1 },
		{ label: '1/3', value: 1 / 3 },
		{ label: '\\(\\pi\\)', value: Math.PI }
	];

	function isExact(v, beta, p) {
		var rounded = flRound(v, beta, p, 1 - EMAX, EMAX, true);
		return Math.abs(rounded - v) < 1e-15;
	}

	function dec(v) {
		var s = !isFinite(v) ? '?' : v === 0 ? '0' : parseFloat(v.toPrecision(4)).toString();
		return ' <span class="fp-val">(' + s + ')</span>';
	}

	function reprLine(r) { return r.html + dec(r.val); }

	function buildTable(containerId) {
		var el = document.getElementById(containerId);
		if (!el) return;
		var h = '<table class="ieee754-table" style="width:100%"><thead><tr>';
		h += '<th style="width:5em">число</th>';
		for (var f = 0; f < FORMATS.length; f++) {
			var fmt = FORMATS[f];
			h += '<th class="' + COL_CLS[f] + '">\\(\\beta\\!=\\!' + fmt.beta
				+ ',\\; p\\!=\\!' + fmt.p + '\\)</th>';
		}
		h += '</tr></thead><tbody>';
		for (var n = 0; n < NUMBERS.length; n++) {
			var num = NUMBERS[n];
			h += '<tr><td>' + num.label + '</td>';
			for (f = 0; f < FORMATS.length; f++) {
				fmt = FORMATS[f];
				var rounded = flRound(num.value, fmt.beta, fmt.p, 1 - EMAX, EMAX, true);
				var exact = isExact(num.value, fmt.beta, fmt.p);
				var cls = COL_CLS[f] + ' mono' + (exact ? '' : ' fpfmt-approx');
				var r = fmtFP(rounded, fmt.beta, fmt.p);
				h += '<td class="' + cls + '">' + reprLine(r);
				if (n === 0) {
					// neighbor: nudge 1 ulp toward original value
					var e = findExp(Math.abs(rounded), fmt.beta);
					var ulp = Math.pow(fmt.beta, e + 1 - fmt.p);
					var neighbor = rounded + (num.value < rounded ? -ulp : ulp);
					var r2 = fmtFP(neighbor, fmt.beta, fmt.p);
					h += '<br>' + reprLine(r2);
				}
				h += '<br><span class="fp-dots">…</span></td>';
			}
			h += '</tr>';
		}
		h += '</tbody></table>';
		h += '<p class="text-muted" style="font-size:11px;margin-top:8px;">'
			+ 'Во всех примерах \\(e_{\\mathrm{max}}=' + EMAX + '\\)</p>';
		el.innerHTML = h;
		if (typeof renderMathInElement === 'function') {
			renderMathInElement(el, {
				delimiters: [
					{ left: '\\(', right: '\\)', display: false },
					{ left: '\\[', right: '\\]', display: true }
				]
			});
		}
	}

	function init() { buildTable('fp-examples-table'); }

	if (typeof Reveal !== 'undefined') {
		Reveal.on('ready', function () { setTimeout(init, 50); });
	} else {
		document.addEventListener('DOMContentLoaded', init);
	}
})();
