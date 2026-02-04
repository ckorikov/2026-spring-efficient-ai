/**
 * CodeMirrorKit — auto-scaling CodeMirror for Reveal.js slides
 *
 * Usage: add data-init="codemirror" to a section containing a <textarea>.
 * Optional: data-lang="python" on textarea (default: python).
 *
 * Self-registers with SlideKit.
 */
(function() {
	var GAP = 32;
	var instances = [];
	var resizeBound = false;

	function init(slide) {
		var el = slide.querySelector('textarea');
		if (!el || el._cmDone) return;
		el._cmDone = true;

		var lang = el.getAttribute('data-lang') || 'python';
		var cm = CodeMirror.fromTextArea(el, {
			mode: lang,
			lineNumbers: true,
			lineWrapping: true,
			readOnly: false,
			viewportMargin: Infinity
		});

		var inst = { cm: cm, maxH: 0 };
		instances.push(inst);

		fixScale(inst);
		cm.on('changes', function() { capHeight(inst); });

		if (!resizeBound) {
			Reveal.on('resize', function() { instances.forEach(fixScale); });
			resizeBound = true;
		}
	}

	function fixScale(inst) {
		var scale = Reveal.getScale();
		if (!scale || scale === 1) { inst.cm.refresh(); return; }

		var wrapper = inst.cm.getWrapperElement();
		wrapper.style.transform = 'scale(' + (1/scale) + ')';
		wrapper.style.transformOrigin = '0 50%';
		wrapper.style.width = (scale * 100) + '%';

		var T = SlideKit.theme();
		var contentArea = T.slideH - T.contentTop - T.contentBottom - GAP;
		inst.maxH = Math.round(contentArea * scale);

		capHeight(inst);
		inst.cm.refresh();
	}

	function capHeight(inst) {
		if (!inst.maxH) return;
		var h = inst.cm.getScrollInfo().height;
		inst.cm.setSize(null, h > inst.maxH ? inst.maxH : 'auto');
	}

	SlideKit.registerInit('codemirror', init);
})();
