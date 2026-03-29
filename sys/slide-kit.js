/**
 * SlideKit — theme reader, margin overlay, data-init dispatcher
 */
(function() {
	var inits = {};
	var defaults = { tr: '', bl: '', sub: '', trUrl: '', blUrl: '' };

	function configure(cfg) {
		if (cfg.tr !== undefined) defaults.tr = cfg.tr;
		if (cfg.bl !== undefined) defaults.bl = cfg.bl;
		if (cfg.sub !== undefined) defaults.sub = cfg.sub;
		if (cfg.trUrl !== undefined) defaults.trUrl = cfg.trUrl;
		if (cfg.blUrl !== undefined) defaults.blUrl = cfg.blUrl;
	}

	function theme() {
		var s = getComputedStyle(document.documentElement);
		var v = function(n) { return s.getPropertyValue(n).trim(); };
		var px = function(n) { return parseInt(v(n), 10); };
		return {
			bg: v('--r-background-color'), ink: v('--r-main-color'),
			muted: v('--r-muted'), subtle: v('--r-subtle'), accent: v('--r-accent'),
			contentTop: px('--content-top'), contentBottom: px('--content-bottom'),
			slideH: Reveal.getConfig().height || 700
		};
	}

	function setCorner(el, text, url) {
		if (text && url) {
			var a = el.querySelector('a') || document.createElement('a');
			a.href = url;
			a.target = '_blank';
			a.textContent = text;
			a.onclick = function(e) { e.stopPropagation(); };
			if (!a.parentNode) { el.textContent = ''; el.appendChild(a); }
			el.style.pointerEvents = 'auto';
		} else {
			el.textContent = text;
			el.style.pointerEvents = '';
		}
	}

	function updateMargins(slide) {
		var header = slide.getAttribute('data-header');
		var cornerDefs = [
			{ pos: 'tl', fallback: '',         fallbackUrl: '', guard: function(v) { return (v !== null && header === null) ? v : ''; } },
			{ pos: 'tr', fallback: defaults.tr, fallbackUrl: defaults.trUrl },
			{ pos: 'bl', fallback: defaults.bl, fallbackUrl: defaults.blUrl },
			{ pos: 'br', fallback: '',         fallbackUrl: '' }
		];
		cornerDefs.forEach(function(def) {
			var el = document.querySelector('.slide-margins .slide-corner-' + def.pos);
			var val = slide.getAttribute('data-' + def.pos);
			var text = def.guard ? def.guard(val) : (val !== null ? val : def.fallback);
			var url = val === null ? def.fallbackUrl : '';
			setCorner(el, text, url);
		});

		// In-section header — consistent across all viewports
		updateSlideHeader(slide, header);
	}

	function updateSlideHeader(slide, header) {
		var el = slide.querySelector('.slide-header');
		if (header) {
			var sub = slide.getAttribute('data-sub') || defaults.sub;
			if (!el) {
				el = document.createElement('div');
				el.className = 'slide-header';
				slide.appendChild(el);
			}
			el.innerHTML =
				'<div class="slide-header-title">' + header + '</div>' +
				(sub ? '<div class="slide-header-sub">' + sub + '</div>' : '');
		} else if (el) {
			el.remove();
		}
	}

	function registerInit(name, fn) {
		inits[name] = fn;
	}

	function dispatchInit(slide) {
		var name = slide.getAttribute('data-init');
		if (name && inits[name]) {
			setTimeout(function() { inits[name](slide); }, 100);
		}
	}

	function initAllHeaders() {
		var slides = Reveal.getSlides();
		slides.forEach(function(slide) {
			updateSlideHeader(slide, slide.getAttribute('data-header'));
		});
	}

	function onSlide(e) {
		updateMargins(e.currentSlide);
		dispatchInit(e.currentSlide);
	}

	Reveal.on('slidechanged', onSlide);
	Reveal.on('ready', function(e) {
		initAllHeaders();
		onSlide(e);
	});

	window.SlideKit = { theme: theme, registerInit: registerInit, configure: configure };
})();
