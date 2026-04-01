/**
 * CodeMirrorKit — auto-scaling CodeMirror for Reveal.js slides
 *
 * Usage: add data-init="codemirror" to a section containing a <textarea>.
 * Optional: data-lang="asm8" on textarea (default: python).
 *
 * Self-registers with SlideKit.
 */
(function() {
	// asm8 mode: integer, FP, and VU instruction sets
	CodeMirror.defineMode('asm8', function() {
		var mnemonics = /^(HLT|MOV|ADD|SUB|INC|DEC|CMP|JMP|JC|JNC|JZ|JNZ|JA|JNA|JB|JNB|JE|JNE|JAE|JBE|JNAE|JNBE|PUSH|POP|CALL|RET|MUL|DIV|AND|OR|XOR|NOT|SHL|SHR|SAL|SAR|DB)\b/i;
		var fpMnemonics = /^(FMOV|FMADD|FADD|FSUB|FMUL|FDIV|FCMP|FABS|FNEG|FSQRT|FCVT|FITOF|FFTOI|FSTAT|FCFG|FSCFG|FCLR|FCLASS)\b/i;
		var vuSync = /^(VSET|VFSTAT|VFCLR|VWAIT)\b/i;
		// VU async: mnemonic + optional .fmt + optional .cond + optional .mode
		var vuAsync = /^(VADD|VSUB|VMUL|VDIV|VMAX|VMIN|VDOT|VSQRT|VNEG|VABS|VCMP|VSEL|VMOV|VFILL)(\.(BF|O[23]|N[12]|[FHUI]))?(\.(EQ|NE|LT|LE|GT|GE))?(\.(vv|vs|vi|r))?\b/i;
		var registers = /^(A|B|C|D|SP|DP)\b/i;
		var fpRegs = /^(FPCR|FPSR|FH[A-D]|FQ[A-H]|FO[A-P]|FA|FB)\b/i;
		var vuRegs = /^(VFPSR|VA|VB|VC|VM|VL)\b/i;
		return {
			token: function(stream) {
				if (stream.match(';')) { stream.skipToEnd(); return 'comment'; }
				if (stream.match('"')) {
					while (!stream.eol()) { if (stream.next() === '"') break; }
					return 'string';
				}
				if (stream.match(/^0x[0-9a-f]+/i) || stream.match(/^[0-9][0-9a-f]*h\b/i) ||
					stream.match(/^[01]+b\b/) || stream.match(/^0o[0-7]+/) ||
					stream.match(/^[0-9]+d?\b/)) return 'number';
				if (stream.match(/^\.?\w+:/)) return 'tag';
				if (stream.match(/^@(page|include)\b/i)) return 'meta';
				if (stream.match(vuAsync)) return 'keyword';
				if (stream.match(fpMnemonics)) return 'keyword';
				if (stream.match(vuSync)) return 'keyword';
				if (stream.match(mnemonics)) return 'keyword';
				if (stream.match(fpRegs)) return 'variable-2';
				if (stream.match(vuRegs)) return 'variable-2';
				if (stream.match(registers)) return 'variable-2';
				stream.next();
				return null;
			}
		};
	});


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
