// 4-bit Ripple-Carry Adder
(function() {
	var COLORS = CircuitKit.COLORS;
	var sA = CircuitKit.sA, sT = CircuitKit.sT, val = CircuitKit.val;

	var OFF_W = COLORS.OFF_W, OFF_B = COLORS.OFF_B, OFF_T = COLORS.OFF_T;
	var ON_A = COLORS.ON_A, ON_C = COLORS.ON_C, ON_S = COLORS.ON_S;
	var SRF = COLORS.SRF, HATCH = COLORS.HATCH, FA_CLR = COLORS.FA_CLR;
	var BG_A = COLORS.BG_A, BG_C = COLORS.BG_C, BG_S = COLORS.BG_S;

	var sv, mk;
	var A = [0,0,0,0], B = [0,0,0,0], S = [0,0,0,0], C = new Array(5).fill(0);
	var Cin = 0;
	var SUB = '\u2080\u2081\u2082\u2083';

	// Layout
	var CX = [430,325,220,115];
	var Ay = 340, By = 375, FAy = 200, Sy = 55;
	var BW = 24, BH = 24, FAW = 68, FAH = 40;
	var WA = -14, WB = 14;

	function init(slide) {
		sv = slide.querySelector('#adder-svg');
		if (!sv || sv._done) return;
		sv._done = true;
		mk = CircuitKit.mkFor(sv);

		// Hatch pattern
		var defs = mk('defs', {});
		var pat = mk('pattern', {id:'ah',width:'6',height:'6',patternUnits:'userSpaceOnUse',patternTransform:'rotate(45)'}, defs);
		mk('line', {x1:'0',y1:'0',x2:'0',y2:'6',stroke:HATCH,'stroke-width':'0.7'}, pat);

		// Weight labels
		for (var b = 3; b >= 0; b--)
			mk('text', {x:CX[b],y:Ay-28,'text-anchor':'middle',fill:OFF_B,'font-size':'9'}).textContent = '2' + ['\u2070','\u00B9','\u00B2','\u00B3'][b];

		// Row labels
		mk('text', {x:CX[3]-50,y:Ay+6,'text-anchor':'end',fill:OFF_T,'font-size':'13','font-weight':'bold'}).textContent = 'A';
		mk('text', {x:CX[3]-50,y:By+6,'text-anchor':'end',fill:OFF_T,'font-size':'13','font-weight':'bold'}).textContent = 'B';

		// Per-bit elements
		for (var b = 0; b < 4; b++) {
			var cx = CX[b], awX = cx + WA, bwX = cx + WB;

			mk('line', {x1:awX,y1:Ay-BH/2,x2:awX,y2:FAy+FAH/2,stroke:OFF_W,'stroke-width':'1.8',id:'wA'+b});
			mk('line', {x1:bwX,y1:By-BH/2,x2:bwX,y2:FAy+FAH/2,stroke:OFF_W,'stroke-width':'1.8',id:'wB'+b});
			mk('line', {x1:cx,y1:FAy-FAH/2,x2:cx,y2:Sy+BH/2,stroke:OFF_W,'stroke-width':'1.8',id:'wS'+b});

			mk('rect', {x:cx-FAW/2,y:FAy-FAH/2,width:FAW,height:FAH,rx:'5',fill:'url(#ah)',stroke:OFF_B,'stroke-width':'1.5',id:'fB'+b});
			mk('text', {x:cx,y:FAy+4,'text-anchor':'middle','dominant-baseline':'middle',fill:OFF_T,'font-size':'11','font-weight':'bold',id:'fL'+b}).textContent = 'FA' + SUB[b];

			// Input A
			CircuitKit.mkBitInput(mk, awX, Ay, BW, BH, 'rA'+b, 'tA'+b, A, b, calc);

			// Input B
			CircuitKit.mkBitInput(mk, bwX, By, BW, BH, 'rB'+b, 'tB'+b, B, b, calc);

			// Sum output
			mk('rect', {x:cx-BW/2,y:Sy-BH/2,width:BW,height:BH,rx:'3',fill:SRF,stroke:OFF_B,'stroke-width':'1.3',id:'sB'+b});
			mk('text', {x:cx,y:Sy+5,'text-anchor':'middle',fill:OFF_T,'font-size':'14','font-weight':'800',id:'tS'+b}).textContent = '0';
			mk('text', {x:cx,y:Sy-18,'text-anchor':'middle',fill:OFF_B,'font-size':'8'}).textContent = 'S' + b;
		}

		// Carry chain — Cin
		var cinX = CX[0] + FAW/2 + 35;
		mk('line', {x1:CX[0]+FAW/2,y1:FAy,x2:cinX-BW/2-2,y2:FAy,stroke:OFF_W,'stroke-width':'1.8',id:'wCin'});
		var gCin = mk('g', {cursor:'pointer'});
		gCin.addEventListener('click', function() { Cin ^= 1; calc(); });
		mk('rect', {x:cinX-BW/2,y:FAy-BH/2,width:BW,height:BH,rx:'3',fill:SRF,stroke:OFF_B,'stroke-width':'1.3','stroke-dasharray':'4 3',id:'rCin'}, gCin);
		mk('text', {x:cinX,y:FAy+5,'text-anchor':'middle',fill:OFF_T,'font-size':'13','font-weight':'800',id:'tCin'}, gCin).textContent = '0';
		mk('text', {x:cinX,y:FAy-18,'text-anchor':'middle',fill:OFF_B,'font-size':'8'}).textContent = 'C\u1D62\u2099';

		// Inter-FA carry wires
		for (var i = 0; i < 3; i++) {
			var x1 = CX[i] - FAW/2, x2 = CX[i+1] + FAW/2;
			mk('line', {x1:x1,y1:FAy,x2:x2,y2:FAy,stroke:OFF_W,'stroke-width':'1.8',id:'wC'+(i+1)});
			mk('text', {x:(x1+x2)/2,y:FAy-9,'text-anchor':'middle',fill:OFF_B,'font-size':'7.5',id:'cL'+(i+1)}).textContent = 'C' + (i+1);
		}

		// Cout
		var coTurnX = CX[3] - FAW/2 - 20;
		mk('line', {x1:CX[3]-FAW/2,y1:FAy,x2:coTurnX,y2:FAy,stroke:OFF_W,'stroke-width':'1.8',id:'wCo'});
		mk('line', {x1:coTurnX,y1:FAy,x2:coTurnX,y2:Sy+BH/2,stroke:OFF_W,'stroke-width':'1.8',id:'wCoV'});
		mk('rect', {x:coTurnX-BW/2,y:Sy-BH/2,width:BW,height:BH,rx:'3',fill:'transparent',stroke:OFF_B,'stroke-width':'1.3','stroke-dasharray':'4 3',id:'coR'});
		mk('text', {x:coTurnX,y:Sy+5,'text-anchor':'middle',fill:OFF_T,'font-size':'14','font-weight':'800',id:'tCo'}).textContent = '0';
		mk('text', {x:coTurnX,y:Sy-18,'text-anchor':'middle',fill:OFF_B,'font-size':'8'}).textContent = 'C\u2092\u1D64\u209C';

		// Decimal values
		var dvX = CX[0] + 52;
		mk('text', {x:dvX,y:Ay+5,'text-anchor':'start',fill:OFF_T,'font-size':'12','font-weight':'bold',id:'dA'}).textContent = '= 0';
		mk('text', {x:dvX,y:By+5,'text-anchor':'start',fill:OFF_T,'font-size':'12','font-weight':'bold',id:'dB'}).textContent = '= 0';
		mk('text', {x:dvX,y:Sy+5,'text-anchor':'start',fill:ON_S,'font-size':'12','font-weight':'bold',id:'dS'}).textContent = '= 0';

		// S label
		mk('text', {x:coTurnX-30,y:Sy+5,'text-anchor':'end',fill:ON_S,'font-size':'12','font-weight':'bold'}).textContent = 'S';

		calc();
		gsap.from(sv.querySelectorAll('rect, line, text'), {opacity:0, duration:0.3, stagger:0.008, ease:'power2.out'});
	}

	function calc() {
		for (var b = 0; b < 4; b++) {
			var a = A[b], bb = B[b];
			sT('tA'+b, a, a ? ON_A : OFF_T);
			sA('rA'+b, 'stroke', a ? ON_A : OFF_B); sA('rA'+b, 'fill', a ? BG_A : SRF);
			sT('tB'+b, bb, bb ? ON_A : OFF_T);
			sA('rB'+b, 'stroke', bb ? ON_A : OFF_B); sA('rB'+b, 'fill', bb ? BG_A : SRF);
			sA('wA'+b, 'stroke', a ? ON_A : OFF_W);
			sA('wB'+b, 'stroke', bb ? ON_A : OFF_W);
		}
		sT('dA', '= ' + val(A), OFF_T);
		sT('dB', '= ' + val(B), OFF_T);

		// Cin
		sT('tCin', Cin, Cin ? ON_C : OFF_T);
		sA('rCin', 'stroke', Cin ? ON_C : OFF_B);
		sA('rCin', 'fill', Cin ? BG_C : SRF);
		sA('rCin', 'stroke-dasharray', Cin ? 'none' : '4 3');
		sA('wCin', 'stroke', Cin ? ON_C : OFF_W);

		// Compute
		var c = Cin; C[0] = Cin;
		for (var b = 0; b < 4; b++) {
			S[b] = A[b] ^ B[b] ^ c;
			C[b+1] = (A[b] & B[b]) | (A[b] & c) | (B[b] & c);
			c = C[b+1];
			var act = A[b] || B[b] || C[b];
			sA('fB'+b, 'stroke', act ? FA_CLR : OFF_B);
			sT('fL'+b, 'FA' + SUB[b], act ? FA_CLR : OFF_T);
		}

		// Carry wires
		for (var i = 1; i <= 3; i++) {
			var on = C[i];
			sA('wC'+i, 'stroke', on ? ON_C : OFF_W);
			sT('cL'+i, 'C'+i+(on ? '=1' : ''), on ? ON_C : OFF_B);
		}

		// Cout
		var co = C[4];
		sA('wCo', 'stroke', co ? ON_C : OFF_W);
		sA('wCoV', 'stroke', co ? ON_C : OFF_W);
		sA('coR', 'stroke', co ? ON_C : OFF_B);
		sA('coR', 'fill', co ? BG_C : 'transparent');
		sA('coR', 'stroke-dasharray', co ? 'none' : '4 3');
		sT('tCo', co, co ? ON_C : OFF_T);

		// Sum
		for (var b = 0; b < 4; b++) {
			var on = S[b];
			sA('wS'+b, 'stroke', on ? ON_S : OFF_W);
			sA('sB'+b, 'stroke', on ? ON_S : OFF_B);
			sA('sB'+b, 'fill', on ? BG_S : SRF);
			sT('tS'+b, S[b], on ? ON_S : OFF_T);
		}

		var total = val(S) + C[4] * 16;
		sT('dS', '= ' + total, ON_S);

		gsap.fromTo(
			[0,1,2,3].map(function(i) { return document.getElementById('sB'+i); }).concat([document.getElementById('coR')]).filter(Boolean),
			{scale:1.12, transformOrigin:'center center'},
			{scale:1, duration:0.25, ease:'back.out(2)'}
		);
	}

	SlideKit.registerInit('adder', init);

	// Position carry-return arrow based on actual element positions
	Reveal.on('slidechanged', positionCarryArrow);
	Reveal.on('ready', positionCarryArrow);
	function positionCarryArrow() {
		var from = document.getElementById('carry-from');
		var to = document.getElementById('carry-to');
		var svg = document.getElementById('carry-arrow-svg');
		var wrap = svg && svg.parentElement;
		if (!from || !to || !svg || !wrap) return;
		var wrapR = wrap.getBoundingClientRect();
		var fromR = from.getBoundingClientRect();
		var toR = to.getBoundingClientRect();
		var scale = wrapR.width / wrap.offsetWidth || 1;
		var arrowSize = 4;
		var gap = 3;
		var x1 = (fromR.left - wrapR.left) / scale - gap;
		var y1 = (fromR.top + fromR.height / 2 - wrapR.top) / scale;
		var x2 = (toR.left - wrapR.left) / scale - gap - arrowSize - 2;
		var y2 = (toR.top + toR.height / 2 - wrapR.top) / scale;
		var pad = 16;
		var xL = Math.min(x1, x2) - pad;
		var vx = xL - 2;
		var vy = Math.min(y1, y2) - 2;
		var vw = Math.max(x1, x2) - vx + arrowSize + 6;
		var vh = Math.abs(y2 - y1) + 4;
		svg.setAttribute('viewBox', vx + ' ' + vy + ' ' + vw + ' ' + vh);
		svg.style.left = vx + 'px';
		svg.style.top = vy + 'px';
		svg.style.width = vw + 'px';
		svg.style.height = vh + 'px';
		var accent = getComputedStyle(document.documentElement).getPropertyValue('--r-accent').trim() || '#9d4a30';
		svg.innerHTML = '<path d="M' + x1 + ' ' + y1 + ' C ' + xL + ' ' + y1 + ' ' + xL + ' ' + y2 + ' ' + x2 + ' ' + y2 + '" fill="none" stroke="' + accent + '" stroke-width="1.2" stroke-linecap="round"/>'
			+ '<polygon points="' + x2 + ',' + (y2 - arrowSize) + ' ' + (x2 + arrowSize + 2) + ',' + y2 + ' ' + x2 + ',' + (y2 + arrowSize) + '" fill="' + accent + '"/>';
	}
})();
