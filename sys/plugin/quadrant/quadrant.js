/**
 * Quadrant Board — Reveal.js plugin
 *
 * Reads sticker data from <script type="application/json"> inside .quadrant-board,
 * axis labels from data-axis-* attributes, builds DOM and animates with GSAP.
 *
 * Dependencies: Reveal.js (required), GSAP 3.x (optional — entrance animation)
 */
(function () {
	var HEART_PATH = 'M8 14s-5.5-3.5-6.5-6.5C.5 4.5 2 2 4.5 2 6 2 7.5 3 8 4.5 8.5 3 10 2 11.5 2 14 2 15.5 4.5 14.5 7.5 13.5 10.5 8 14 8 14z';

	function heartSVG(color, filled) {
		return '<svg width="10" height="10" viewBox="0 0 16 16" style="display:block">' +
			'<path d="' + HEART_PATH + '" fill="' + (filled ? color : 'none') + '" stroke="' + color + '" stroke-width="1.2"/>' +
			'</svg>';
	}

	function buildBoard(slide) {
		var board = slide.querySelector('.quadrant-board');
		if (!board || board.dataset.built) return;
		board.dataset.built = '1';

		// Read data
		var script = board.querySelector('script[type="application/json"]');
		if (!script) return;
		var stickers = JSON.parse(script.textContent);
		script.remove();

		var axisTop = board.dataset.axisTop || '';
		var axisBottom = board.dataset.axisBottom || '';
		var axisLeft = board.dataset.axisLeft || '';
		var axisRight = board.dataset.axisRight || '';

		// Axes
		var vAxis = document.createElement('div');
		vAxis.className = 'quadrant-axis quadrant-axis-v';
		board.appendChild(vAxis);

		var hAxis = document.createElement('div');
		hAxis.className = 'quadrant-axis quadrant-axis-h';
		board.appendChild(hAxis);

		// Axis labels
		var labels = [
			{ text: axisTop, cls: 'quadrant-label quadrant-label-top' },
			{ text: axisBottom, cls: 'quadrant-label quadrant-label-bottom' },
			{ text: axisLeft, cls: 'quadrant-label quadrant-label-left' },
			{ text: axisRight, cls: 'quadrant-label quadrant-label-right' }
		];
		labels.forEach(function (l) {
			if (!l.text) return;
			var el = document.createElement('div');
			el.className = l.cls;
			el.textContent = l.text;
			board.appendChild(el);
		});

		// Corner marks
		var corners = [
			'quadrant-corner quadrant-corner-tl',
			'quadrant-corner quadrant-corner-tr',
			'quadrant-corner quadrant-corner-bl',
			'quadrant-corner quadrant-corner-br'
		];
		corners.forEach(function (cls) {
			var el = document.createElement('div');
			el.className = cls;
			board.appendChild(el);
		});

		// Stickers
		var stickerEls = [];
		stickers.forEach(function (s) {
			var el = document.createElement('div');
			el.className = 'quadrant-sticker';
			el.style.left = s.x + '%';
			el.style.top = s.y + '%';
			el.style.transform = 'translate(-50%, -50%) rotate(' + (s.rotate || 0) + 'deg)';

			var labelText = (s.label || '').replace(/\n/g, '<br>');
			el.innerHTML =
				'<div class="quadrant-sticker-text">' + labelText + '</div>' +
				'<div class="quadrant-sticker-votes">' +
					'<div class="quadrant-vote quadrant-vote-like">' +
						heartSVG('#d94040', true) +
						'<span>' + (s.likes || 0) + '</span>' +
					'</div>' +
					'<div class="quadrant-vote quadrant-vote-dislike">' +
						heartSVG('#2d2a26', true) +
						'<span>' + (s.dislikes || 0) + '</span>' +
					'</div>' +
				'</div>';

			board.appendChild(el);
			stickerEls.push(el);
		});

		// GSAP animation — opacity only; scale would overwrite the
		// inline translate(-50%,-50%) rotate() before layout resolves it.
		if (typeof gsap !== 'undefined') {
			gsap.set(stickerEls, { opacity: 0 });
			gsap.set([vAxis, hAxis], { opacity: 0 });

			gsap.to([vAxis, hAxis], { opacity: 1, duration: 0.4, ease: 'power2.out' });
			gsap.to(stickerEls, {
				opacity: 1,
				duration: 0.3, ease: 'power2.out',
				stagger: 0.04, delay: 0.2
			});
		}
	}

	function onSlide(e) { buildBoard(e.currentSlide); }

	Reveal.on('ready', onSlide);
	Reveal.on('slidechanged', onSlide);
})();
