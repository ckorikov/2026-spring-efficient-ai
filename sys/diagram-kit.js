/**
 * DiagramKit — Paper.js primitives + GSAP stagger animation
 */
(function() {
	function block(x, y, w, h, label, opt) {
		opt = opt || {};
		var C = SlideKit.theme();
		var r = new paper.Path.Rectangle({
			point: [x - w/2, y - h/2], size: [w, h], radius: 3,
			strokeColor: opt.stroke || C.ink, strokeWidth: opt.sw || 1.5,
			fillColor: opt.fill || C.bg, dashArray: opt.dash || null
		});
		var t = new paper.PointText({
			point: [x, y + 4], content: label,
			fontFamily: 'IBM Plex Mono', fontSize: opt.fs || 9,
			fillColor: opt.tc || C.ink, justification: 'center'
		});
		return new paper.Group([r, t]);
	}

	function arrow(from, to) {
		var C = SlideKit.theme();
		var line = new paper.Path.Line({ from: from, to: to, strokeColor: C.muted, strokeWidth: 1 });
		var d = new paper.Point(to).subtract(new paper.Point(from)).normalize();
		var p = new paper.Point(to);
		var head = new paper.Path({
			segments: [p.subtract(d.rotate(25).multiply(5)), p, p.subtract(d.rotate(-25).multiply(5))],
			strokeColor: C.muted, strokeWidth: 1
		});
		return new paper.Group([line, head]);
	}

	function circle(x, y, r, label) {
		var C = SlideKit.theme();
		var c = new paper.Path.Circle({ center: [x, y], radius: r, strokeColor: C.ink, strokeWidth: 1.5, fillColor: C.bg });
		var t = new paper.PointText({ point: [x, y + 4], content: label, fontFamily: 'IBM Plex Mono', fontSize: 10, fillColor: C.ink, justification: 'center' });
		return new paper.Group([c, t]);
	}

	function staggerIn(els) {
		var targets = els.map(function(el) {
			var ty = el.position.y;
			el.opacity = 0;
			el.position.y = ty + 10;
			return ty;
		});
		paper.view.draw();

		var fired = false;
		return function trigger() {
			if (fired) return;
			fired = true;
			els.forEach(function(el, i) {
				var proxy = { opacity: 0, y: el.position.y };
				gsap.to(proxy, {
					opacity: 1, y: targets[i],
					delay: i * 0.06, duration: 0.35, ease: 'power2.out',
					onUpdate: function() {
						el.opacity = proxy.opacity;
						el.position.y = proxy.y;
						paper.view.draw();
					}
				});
			});
		};
	}

	window.DiagramKit = { block: block, arrow: arrow, circle: circle, staggerIn: staggerIn };
})();
