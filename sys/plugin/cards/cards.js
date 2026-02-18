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

	function cardBit(card) {
		return card.getAttribute('data-face') === 'back' ? 0 : 1;
	}

	function setCardBack(card) {
		card.setAttribute('data-face', 'back');
		card.removeAttribute('data-suit-symbol');
	}

	function setCardFront(card) {
		card.removeAttribute('data-face');
		var suitKey = normalizeSuit(card.getAttribute('data-suit'));
		var meta = SUITS[suitKey];
		card.setAttribute('data-suit', suitKey);
		card.setAttribute('data-rank', card.getAttribute('data-rank') || 'A');
		card.setAttribute('data-suit-symbol', meta.symbol);

		var center = card.querySelector('.playing-card-center');
		if (!center) {
			center = document.createElement('div');
			center.className = 'playing-card-center';
			card.appendChild(center);
		}
		center.textContent = meta.symbol;
	}

	function bitsToValue(bits, method) {
		var raw = (bits[0] << 3) | (bits[1] << 2) | (bits[2] << 1) | bits[3];
		if (method === 'direct') {
			var sign = bits[0];
			var magnitude = (bits[1] << 2) | (bits[2] << 1) | bits[3];
			if (!sign) return magnitude;
			return magnitude === 0 ? '-0' : -magnitude;
		}
		if (method === 'ones') {
			if (!bits[0]) return raw;
			var inv = (~raw) & 0b1111;
			return inv === 0 ? '-0' : -inv;
		}
		if (method === 'twos') {
			return bits[0] ? raw - 16 : raw;
		}
		return raw;
	}

	function updateEncodingSlide(slide) {
		var board = slide.querySelector('.cards-board');
		if (!board) return;

		var cards = Array.prototype.slice.call(board.querySelectorAll('.playing-card'));
		if (cards.length !== 4) return;

		var bits = cards.map(cardBit);
		var method = slide.getAttribute('data-code-method') || 'direct';
		var value = bitsToValue(bits, method);

		var valueLabel = slide.querySelector('.encoded-value');
		if (valueLabel) {
			valueLabel.innerHTML = 'Закодировано <span class="text-ink">' + value + '</span> на <span class="text-ink">4 битах</span>';
		}

		cards.forEach(function (card, index) {
			var bitLabel = card.querySelector('.bit-label');
			if (!bitLabel) {
				bitLabel = document.createElement('span');
				bitLabel.className = 'bit-label';
				card.appendChild(bitLabel);
			}

			var suitKey = normalizeSuit(card.getAttribute('data-suit'));
			bitLabel.textContent = String(bits[index]);
			bitLabel.classList.toggle('is-red', SUITS[suitKey].red);
		});
	}

	function initEncodingCards(slide) {
		if (!slide || slide.dataset.codeMethodReady === '1') return;
		if (!slide.hasAttribute('data-code-method')) return;
		slide.dataset.codeMethodReady = '1';

		var board = slide.querySelector('.cards-board');
		if (!board) return;
		board.dataset.bitEncoding = '1';

		var cards = board.querySelectorAll('.playing-card');
		cards.forEach(function (card) {
			if (card.getAttribute('data-face') === 'back') {
				setCardBack(card);
			} else {
				setCardFront(card);
			}

			card.addEventListener('click', function () {
				if (card.getAttribute('data-face') === 'back') {
					setCardFront(card);
				} else {
					setCardBack(card);
				}
				updateEncodingSlide(slide);
			});
		});

		updateEncodingSlide(slide);
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
		initEncodingCards(slide);
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
