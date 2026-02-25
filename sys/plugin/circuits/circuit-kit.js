// Shared utilities for circuit visualizations
window.CircuitKit = {
	COLORS: {
		OFF_W: '#d5d0c8', OFF_B: '#b5b0a8', OFF_T: '#8a857d',
		ON_A:  '#9d4a30', ON_C:  '#a05a5a', ON_S:  '#2d6a4f',
		SRF:   '#edeae6', HATCH: '#d0cbc3', DIM:   '#b5b0a8',
		FA_CLR:'#4a6a8a', BG_A:  '#f5ece8', BG_C:  '#f0e4e4', BG_S: '#e8f0ec'
	},

	// Returns an mk(tag, attrs, parent) function bound to a specific SVG element
	mkFor: function(svgEl) {
		return function(t, a, p) {
			var e = document.createElementNS('http://www.w3.org/2000/svg', t);
			for (var k in a) if (a.hasOwnProperty(k)) e.setAttribute(k, a[k]);
			(p || svgEl).appendChild(e);
			return e;
		};
	},

	sA: function(id, k, v) {
		var e = document.getElementById(id);
		if (e) e.setAttribute(k, v);
	},

	sT: function(id, t, f) {
		var e = document.getElementById(id);
		if (e) { e.textContent = t; e.setAttribute('fill', f); }
	},

	val: function(bits) {
		var out = 0;
		for (var i = 0; i < bits.length; i++) out += bits[i] << i;
		return out;
	}
};
