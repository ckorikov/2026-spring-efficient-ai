/**
 * SlideKit — theme reader, margin overlay, data-init dispatcher
 */
(function() {
	var inits = {};
	var defaults = { tr: '', bl: '', sub: '' };

	function configure(cfg) {
		if (cfg.tr !== undefined) defaults.tr = cfg.tr;
		if (cfg.bl !== undefined) defaults.bl = cfg.bl;
		if (cfg.sub !== undefined) defaults.sub = cfg.sub;
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

	function updateMargins(slide) {
		var corners = {
			tl: document.querySelector('.slide-margins .slide-corner-tl'),
			tr: document.querySelector('.slide-margins .slide-corner-tr'),
			bl: document.querySelector('.slide-margins .slide-corner-bl'),
			br: document.querySelector('.slide-margins .slide-corner-br')
		};

		// Top-left: data-tl (plain) or empty — structured header moved to .slide-header
		var header = slide.getAttribute('data-header');
		var dataTl = slide.getAttribute('data-tl');
		if (header !== null) {
			corners.tl.innerHTML = '';
		} else if (dataTl !== null) {
			corners.tl.textContent = dataTl;
		} else {
			corners.tl.innerHTML = '';
		}

		// Top-right: data-tr or default
		var dataTr = slide.getAttribute('data-tr');
		corners.tr.textContent = dataTr !== null ? dataTr : defaults.tr;

		// Bottom-left: data-bl or default
		var dataBl = slide.getAttribute('data-bl');
		corners.bl.textContent = dataBl !== null ? dataBl : defaults.bl;

		// Bottom-right: data-br or empty
		var dataBr = slide.getAttribute('data-br');
		corners.br.textContent = dataBr !== null ? dataBr : '';

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
