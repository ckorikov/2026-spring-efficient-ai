/**
 * Playing Cards — Reveal.js helper plugin
 *
 * Usage:
 * <div class="cards-board" data-layout="fan">
 *   <script type="application/json">
 *     [
 *       {"rank":"A","suit":"spades"},
 *       {"rank":"K","suit":"hearts"},
 *       {"rank":"Q","suit":"diamonds"},
 *       {"rank":"J","suit":"clubs"}
 *     ]
 *   </script>
 * </div>
 *
 * Or provide manual cards:
 * <div class="cards-board" data-layout="stack">
 *   <div class="playing-card" data-rank="10" data-suit="hearts"></div>
 * </div>
 */
(function () {
	var SUITS = {
		spades: { symbol: '♠', red: false },
		hearts: { symbol: '♥', red: true },
		diamonds: { symbol: '♦', red: true },
		clubs: { symbol: '♣', red: false }
	};

	function normalizeSuit(suit) {
		if (!suit) return 'spades';
		var key = String(suit).toLowerCase();
		return SUITS[key] ? key : 'spades';
	}

	function createCard(data) {
		var card = document.createElement('div');
		card.className = 'playing-card';
		if (data.face) card.setAttribute('data-face', data.face);
		if (data.rank !== undefined) card.setAttribute('data-rank', String(data.rank));
		if (data.suit !== undefined) card.setAttribute('data-suit', String(data.suit));
		return card;
	}

	function decorateCard(card, index, count) {
		var suitKey = normalizeSuit(card.getAttribute('data-suit'));
		var meta = SUITS[suitKey];
		var face = card.getAttribute('data-face') || 'front';
		var rank = card.getAttribute('data-rank') || '';

		card.setAttribute('data-suit', suitKey);
		card.style.setProperty('--i', index);
		card.style.setProperty('--count', count);

		if (meta.red) {
			card.style.setProperty('--card-suit-color', 'var(--r-accent)');
		} else {
			card.style.setProperty('--card-suit-color', 'var(--r-main-color)');
		}

		if (face !== 'back') {
			card.setAttribute('data-rank', rank || 'A');
			card.setAttribute('data-suit-symbol', meta.symbol);

			if (!card.querySelector('.playing-card-center')) {
				var center = document.createElement('div');
				center.className = 'playing-card-center';
				center.textContent = meta.symbol;
				card.appendChild(center);
			}
		} else {
			card.removeAttribute('data-suit-symbol');
		}
	}

	function hydrateBoard(board) {
		if (board.dataset.cardsBuilt) return;
		board.dataset.cardsBuilt = '1';

		var script = board.querySelector('script[type="application/json"]');
		if (script) {
			try {
				var list = JSON.parse(script.textContent);
				if (Array.isArray(list)) {
					list.forEach(function (item) {
						board.appendChild(createCard(item || {}));
					});
				}
			} catch (e) {
				console.warn('cards plugin: invalid JSON', e);
			}
			script.remove();
		}

		var cards = board.querySelectorAll('.playing-card');
		var count = cards.length;
		cards.forEach(function (card, index) {
			decorateCard(card, index, count);
		});
	}

	function initSlide(slide) {
		if (!slide) return;
		var boards = slide.querySelectorAll('.cards-board');
		boards.forEach(hydrateBoard);
	}

	if (typeof Reveal !== 'undefined') {
		Reveal.on('ready', function (e) { initSlide(e.currentSlide); });
		Reveal.on('slidechanged', function (e) { initSlide(e.currentSlide); });
	} else {
		document.addEventListener('DOMContentLoaded', function () {
			initSlide(document);
		});
	}
})();
