// 2x2 Array Multiplier
(function() {
	var COLORS = CircuitKit.COLORS;
	var sA = CircuitKit.sA, sT = CircuitKit.sT, val = CircuitKit.val;

	var OFF_W = COLORS.OFF_W, OFF_B = COLORS.OFF_B, OFF_T = COLORS.OFF_T;
	var ON_A = COLORS.ON_A, ON_C = COLORS.ON_C, ON_S = COLORS.ON_S;
	var SRF = COLORS.SRF, HATCH = COLORS.HATCH, FA_CLR = COLORS.FA_CLR;
	var BG_A = COLORS.BG_A, BG_C = COLORS.BG_C, BG_S = COLORS.BG_S;

	var sv, mk;
	var A = [0, 0];
	var B = [0, 0];
	var P = [0, 0, 0, 0];
	var columnSum = [0, 0, 0];
	var carry = [0, 0, 0, 0];

	var BW = 24, BH = 24, GW = 28, GH = 22, NW = 68, NH = 40;
	var AY = 340, BY = 375, PY = 50, RAIL_Y = 225, NODE_Y = 155;
	var PX = [450, 350, 250, 150];
	var AX = [PX[0] - 14, PX[1] - 14];
	var BX = [PX[0] + 14, PX[1] + 14];
	var NODE_TYPE = { 1: 'HA', 2: 'FA' };
	var SUB = ['\u2080', '\u2081', '\u2082', '\u2083', '\u2084', '\u2085', '\u2086', '\u2087'];

	function gateX(i, j) { return PX[i + j] + (i - j) * 28; }
	function gateY(j) { return 265; }

	function routeOrth(start, end, obstacles) {
		var step = 4;
		var minX = 56, maxX = 544, minY = 18, maxY = 396;
		var width = Math.floor((maxX - minX) / step) + 1;
		var height = Math.floor((maxY - minY) / step) + 1;

		function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
		function toNode(p) {
			return { x: clamp(Math.round((p.x - minX) / step), 0, width - 1), y: clamp(Math.round((p.y - minY) / step), 0, height - 1) };
		}
		function toPoint(n) { return { x: minX + n.x * step, y: minY + n.y * step }; }
		function blocked(x, y) {
			for (var r = 0; r < obstacles.length; r++) {
				var ob = obstacles[r];
				if (x >= ob.x1 && x <= ob.x2 && y >= ob.y1 && y <= ob.y2) return true;
			}
			return false;
		}

		var s = toNode(start), e = toNode(end);
		var size = width * height;
		var seen = new Array(size).fill(false);
		var prev = new Array(size).fill(-1);
		var qx = [], qy = [], qh = 0;

		function id(x, y) { return y * width + x; }
		function unsee(x, y) { if (x >= 0 && y >= 0 && x < width && y < height) seen[id(x, y)] = false; }
		function unblockAround(node, radius) {
			for (var dy = -radius; dy <= radius; dy++)
				for (var dx = -radius; dx <= radius; dx++)
					unsee(node.x + dx, node.y + dy);
		}

		for (var yy = 0; yy < height; yy++)
			for (var xx = 0; xx < width; xx++)
				if (blocked(minX + xx * step, minY + yy * step)) seen[id(xx, yy)] = true;

		seen[id(s.x, s.y)] = false;
		seen[id(e.x, e.y)] = false;
		unblockAround(s, 2);
		unblockAround(e, 2);

		qx.push(s.x); qy.push(s.y);
		seen[id(s.x, s.y)] = true;

		var found = false;
		while (qh < qx.length) {
			var cx = qx[qh], cy = qy[qh]; qh++;
			if (cx === e.x && cy === e.y) { found = true; break; }
			var n4 = [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]];
			for (var n = 0; n < 4; n++) {
				var nx = n4[n][0], ny = n4[n][1];
				if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
				var ni = id(nx, ny);
				if (seen[ni]) continue;
				seen[ni] = true;
				prev[ni] = id(cx, cy);
				qx.push(nx); qy.push(ny);
			}
		}

		if (!found) {
			if (start.x === end.x || start.y === end.y) return [start, end];
			return [start, { x: end.x, y: start.y }, end];
		}

		var pathNodes = [];
		var cur = id(e.x, e.y);
		while (cur !== -1) {
			var py = Math.floor(cur / width);
			var px = cur - py * width;
			pathNodes.push({ x: px, y: py });
			cur = prev[cur];
		}
		pathNodes.reverse();

		var points = [];
		for (var p = 0; p < pathNodes.length; p++) points.push(toPoint(pathNodes[p]));

		if (points.length) {
			var first = points[0];
			points[0] = { x: start.x, y: start.y };
			if (start.x !== first.x && start.y !== first.y) points.splice(1, 0, { x: first.x, y: start.y });
			var last = points[points.length - 1];
			if (end.x !== last.x && end.y !== last.y) points.push({ x: end.x, y: last.y });
			points[points.length - 1] = { x: end.x, y: end.y };
		}

		var simplified = [];
		for (var si = 0; si < points.length; si++) {
			var pt = points[si];
			if (!simplified.length) { simplified.push(pt); continue; }
			if (simplified.length === 1) { simplified.push(pt); continue; }
			var a = simplified[simplified.length - 2];
			var b = simplified[simplified.length - 1];
			if ((a.x === b.x && b.x === pt.x) || (a.y === b.y && b.y === pt.y))
				simplified[simplified.length - 1] = pt;
			else
				simplified.push(pt);
		}
		return simplified;
	}

	function init(slide) {
		sv = slide.querySelector('#multiplier-svg');
		if (!sv || sv._done) return;
		sv._done = true;
		mk = CircuitKit.mkFor(sv);

		var defs = mk('defs', {});
		var pat = mk('pattern', {id:'mh',width:'6',height:'6',patternUnits:'userSpaceOnUse',patternTransform:'rotate(45)'}, defs);
		mk('line', {x1:'0',y1:'0',x2:'0',y2:'6',stroke:HATCH,'stroke-width':'0.7'}, pat);

		mk('text', {x:AX[1]-BW/2-24,y:AY+6,'text-anchor':'end',fill:OFF_T,'font-size':'13','font-weight':'bold'}).textContent = 'A';
		mk('text', {x:BX[1]-BW/2-24,y:BY+6,'text-anchor':'end',fill:OFF_T,'font-size':'13','font-weight':'bold'}).textContent = 'B';
		mk('text', {x:PX[3]-50,y:PY+6,'text-anchor':'end',fill:ON_S,'font-size':'13','font-weight':'bold'}).textContent = 'P';
		for (var w = 0; w < 2; w++)
			mk('text', {x:PX[w],y:AY-28,'text-anchor':'middle',fill:OFF_B,'font-size':'9'}).textContent = '2' + ['\u2070','\u00B9'][w];

		var obstacles = [];
		function addObstacle(cx, cy, w, h, pad) {
			obstacles.push({ x1: cx - w/2 - pad, y1: cy - h/2 - pad, x2: cx + w/2 + pad, y2: cy + h/2 + pad });
		}
		for (var oi = 0; oi < 2; oi++) { addObstacle(AX[oi], AY, BW, BH, 2); addObstacle(BX[oi], BY, BW, BH, 2); }
		for (var oa = 0; oa < 2; oa++) for (var ob = 0; ob < 2; ob++) addObstacle(gateX(oa, ob), gateY(ob), GW, GH, 3);
		for (var ok = 1; ok <= 2; ok++) addObstacle(PX[ok], NODE_Y, NW, NH, 3);
		for (var op = 0; op < 4; op++) addObstacle(PX[op], PY, BW, BH, 2);

		for (var i = 0; i < 2; i++) {
			CircuitKit.mkBitInput(mk, AX[i], AY, BW, BH, 'mA'+i, 'mAt'+i, A, i, calc);
		}

		for (var j = 0; j < 2; j++) {
			CircuitKit.mkBitInput(mk, BX[j], BY, BW, BH, 'mB'+j, 'mBt'+j, B, j, calc);
		}

		for (var a = 0; a < 2; a++) {
			for (var b = 0; b < 2; b++) {
				var gx = gateX(a, b);
				var gy = gateY(b);
				var outPortY = gy - GH/2;

				var pPath = routeOrth({x:gx, y:outPortY}, {x:PX[a+b], y:RAIL_Y}, obstacles);
				mk('polyline', {points:pPath.map(function(pt){return pt.x+','+pt.y;}).join(' '),fill:'none',stroke:OFF_W,'stroke-width':'1.5',id:'mWp'+a+'_'+b});

				mk('rect', {x:gx-GW/2,y:gy-GH/2,width:GW,height:GH,rx:'5',fill:SRF,stroke:OFF_B,'stroke-width':'1.3',id:'mG'+a+'_'+b});
				mk('text', {x:gx,y:gy+3,'text-anchor':'middle',fill:OFF_T,'font-size':'11','font-weight':'600'}).textContent = '&';
			}
		}

		var WA_Y = [AY - BH/2 - 26, AY - BH/2 - 13];  // [302, 315] — separated per bit
		var WB_Y = AY + BH/2 + 6;  // 358 — safely below A boxes (352), trunk=5px from B box
		var GP_Y = gateY(0) + GH/2;
		for (var a = 0; a < 2; a++) {
			var ports_a = [gateX(a,0)-7, gateX(a,1)-7];
			var busX1 = Math.min(AX[a], ports_a[0], ports_a[1]);
			var busX2 = Math.max(AX[a], ports_a[0], ports_a[1]);
			mk('line', {x1:AX[a],y1:AY-BH/2,x2:AX[a],y2:WA_Y[a],stroke:OFF_W,'stroke-width':'1.5',id:'mVA'+a});
			mk('line', {x1:busX1,y1:WA_Y[a],x2:busX2,y2:WA_Y[a],stroke:OFF_W,'stroke-width':'1.5',id:'mHA'+a});
			mk('circle', {cx:AX[a],cy:WA_Y[a],r:'2.5',fill:OFF_W,id:'mJA'+a});
			for (var b = 0; b < 2; b++) {
				var px = gateX(a,b)-7;
				mk('line', {x1:px,y1:WA_Y[a],x2:px,y2:GP_Y,stroke:OFF_W,'stroke-width':'1.5',id:'mDA'+a+'_'+b});
			}
		}
		for (var b = 0; b < 2; b++) {
			var ports_b = [gateX(0,b)+7, gateX(1,b)+7];
			var busX1 = Math.min(BX[b], ports_b[0], ports_b[1]);
			var busX2 = Math.max(BX[b], ports_b[0], ports_b[1]);
			mk('line', {x1:BX[b],y1:BY-BH/2,x2:BX[b],y2:WB_Y,stroke:OFF_W,'stroke-width':'1.5',id:'mVB'+b});
			mk('line', {x1:busX1,y1:WB_Y,x2:busX2,y2:WB_Y,stroke:OFF_W,'stroke-width':'1.5',id:'mHB'+b});
			for (var a = 0; a < 2; a++) {
				var px = gateX(a,b)+7;
				var wid = 'mDB'+a+'_'+b;
				// Route around any A input box that the vertical drop would cross
				var bypassX = null;
				for (var ci = 0; ci < 2; ci++) {
					var axL = AX[ci] - BW/2 - 3, axR = AX[ci] + BW/2 + 3;
					if (px > axL && px < axR) { bypassX = axL; break; }
				}
				if (bypassX !== null) {
					var pts = px+','+WB_Y+' '+bypassX+','+WB_Y+' '+bypassX+','+GP_Y+' '+px+','+GP_Y;
					mk('polyline', {points:pts,fill:'none',stroke:OFF_W,'stroke-width':'1.5',id:wid});
				} else {
					mk('line', {x1:px,y1:WB_Y,x2:px,y2:GP_Y,stroke:OFF_W,'stroke-width':'1.5',id:wid});
				}
			}
		}

		mk('line', {x1:PX[0],y1:RAIL_Y,x2:PX[0],y2:PY+BH/2,stroke:OFF_W,'stroke-width':'1.8',id:'mWo0'});

		for (var k = 1; k <= 2; k++) {
			mk('line', {x1:PX[k],y1:RAIL_Y,x2:PX[k],y2:NODE_Y+NH/2,stroke:OFF_W,'stroke-width':'1.8',id:'mRail'+k});
			mk('rect', {x:PX[k]-NW/2,y:NODE_Y-NH/2,width:NW,height:NH,rx:'5',fill:'url(#mh)',stroke:OFF_B,'stroke-width':'1.5',id:'mN'+k});
			mk('text', {x:PX[k],y:NODE_Y+4,'text-anchor':'middle','dominant-baseline':'middle',fill:OFF_T,'font-size':'11','font-weight':'bold',id:'mNt'+k}).textContent = NODE_TYPE[k] + SUB[k];
			mk('line', {x1:PX[k],y1:NODE_Y-NH/2,x2:PX[k],y2:PY+BH/2,stroke:OFF_W,'stroke-width':'1.8',id:'mWo'+k});
		}

		mk('circle', {cx:PX[1],cy:RAIL_Y,r:'2.5',fill:OFF_W,id:'mJRail1'});
		mk('line', {x1:PX[1]-NW/2,y1:NODE_Y,x2:PX[2]+NW/2,y2:NODE_Y,stroke:OFF_W,'stroke-width':'1.8',id:'mCarry1'});
		mk('text', {x:(PX[1]+PX[2])/2,y:NODE_Y-9,'text-anchor':'middle',fill:OFF_B,'font-size':'7.5',id:'mCarryL1'}).textContent = 'C' + SUB[2];

		mk('polyline', {
			points: (PX[2]-NW/2)+','+NODE_Y+' '+PX[3]+','+NODE_Y+' '+PX[3]+','+(PY+BH/2),
			fill:'none', stroke:OFF_W, 'stroke-width':'1.8', id:'mWo7'
		});

		for (var out = 0; out < 4; out++) {
			mk('rect', {x:PX[out]-BW/2,y:PY-BH/2,width:BW,height:BH,rx:'3',fill:SRF,stroke:OFF_B,'stroke-width':'1.3',id:'mP'+out});
			mk('text', {x:PX[out],y:PY+5,'text-anchor':'middle',fill:OFF_T,'font-size':'14','font-weight':'800',id:'mPt'+out}).textContent = '0';
			mk('text', {x:PX[out],y:PY-18,'text-anchor':'middle',fill:OFF_B,'font-size':'8'}).textContent = 'P' + SUB[out];
		}

		var dvX = PX[0] + 52;
		mk('text', {x:dvX,y:AY+5,'text-anchor':'start',fill:OFF_T,'font-size':'12','font-weight':'bold',id:'mDA'}).textContent = '= 0';
		mk('text', {x:dvX,y:BY+5,'text-anchor':'start',fill:OFF_T,'font-size':'12','font-weight':'bold',id:'mDB'}).textContent = '= 0';
		mk('text', {x:dvX,y:PY+5,'text-anchor':'start',fill:ON_S,'font-size':'12','font-weight':'bold',id:'mDP'}).textContent = '= 0';

		calc();
		gsap.from(sv.querySelectorAll('rect, line, polyline, text'), {opacity:0, duration:0.28, stagger:0.006, ease:'power2.out'});
	}

	function calc() {
		for (var cc = 0; cc <= 2; cc++) { columnSum[cc] = 0; carry[cc] = 0; }
		carry[3] = 0;

		for (var i = 0; i < 2; i++) {
			sT('mAt'+i, A[i], A[i] ? ON_A : OFF_T);
			sA('mA'+i, 'stroke', A[i] ? ON_A : OFF_B);
			sA('mA'+i, 'fill', A[i] ? BG_A : SRF);
		}

		for (var j = 0; j < 2; j++) {
			sT('mBt'+j, B[j], B[j] ? ON_A : OFF_T);
			sA('mB'+j, 'stroke', B[j] ? ON_A : OFF_B);
			sA('mB'+j, 'fill', B[j] ? BG_A : SRF);
		}

		for (var a = 0; a < 2; a++) {
			var aClr = A[a] ? ON_A : OFF_W;
			sA('mVA'+a, 'stroke', aClr); sA('mHA'+a, 'stroke', aClr); sA('mJA'+a, 'fill', aClr);
			for (var b = 0; b < 2; b++) {
				sA('mDA'+a+'_'+b, 'stroke', aClr);
				var p = A[a] & B[b];
				columnSum[a + b] += p;
				sA('mWp'+a+'_'+b, 'stroke', p ? ON_C : OFF_W);
				sA('mG'+a+'_'+b, 'stroke', p ? ON_A : OFF_B);
				sA('mG'+a+'_'+b, 'fill', p ? BG_A : SRF);
			}
		}
		for (var b = 0; b < 2; b++) {
			var bClr = B[b] ? ON_A : OFF_W;
			sA('mVB'+b, 'stroke', bClr); sA('mHB'+b, 'stroke', bClr);
			for (var a = 0; a < 2; a++) sA('mDB'+a+'_'+b, 'stroke', bClr);
		}

		for (var k = 0; k <= 2; k++) {
			var total = columnSum[k] + carry[k];
			var sumBit = total & 1;
			carry[k + 1] = total >> 1;
			P[k] = sumBit;
		}
		P[3] = carry[3] & 1;

		var product = val(A) * val(B);
		for (var bit = 0; bit < 4; bit++) {
			P[bit] = (product >> bit) & 1;
			var on = P[bit];
			if (bit === 0) sA('mWo0', 'stroke', on ? ON_S : OFF_W);
			else if (bit === 3) sA('mWo7', 'stroke', on ? ON_S : OFF_W);
			else sA('mWo'+bit, 'stroke', on ? ON_S : OFF_W);
			sA('mP'+bit, 'stroke', on ? ON_S : OFF_B);
			sA('mP'+bit, 'fill', on ? BG_S : SRF);
			sT('mPt'+bit, on, on ? ON_S : OFF_T);
		}

		for (var col = 1; col <= 2; col++) {
			var active = columnSum[col] + carry[col] > 0;
			var colTotal = columnSum[col] + carry[col];
			var carryOut = colTotal >> 1;
			sA('mRail'+col, 'stroke', columnSum[col] ? ON_C : OFF_W);
			if (col === 1) sA('mJRail1', 'fill', columnSum[1] ? ON_C : OFF_W);
			sA('mN'+col, 'stroke', active ? FA_CLR : OFF_B);
			sA('mN'+col, 'fill', carryOut ? BG_C : 'url(#mh)');
			sT('mNt'+col, NODE_TYPE[col] + SUB[col], active ? FA_CLR : OFF_T);
		}

		var cOn = carry[2];
		sA('mCarry1', 'stroke', cOn ? ON_C : OFF_W);
		sT('mCarryL1', 'C' + SUB[2] + (cOn ? '=1' : ''), cOn ? ON_C : OFF_B);
		sA('mWo7', 'stroke', carry[3] ? ON_S : OFF_W);

		sT('mDA', '= ' + val(A), OFF_T);
		sT('mDB', '= ' + val(B), OFF_T);
		sT('mDP', '= ' + product, ON_S);

		gsap.fromTo(
			[0,1,2,3].map(function(i) { return document.getElementById('mP'+i); }).filter(Boolean),
			{scale:1.1, transformOrigin:'center center'},
			{scale:1, duration:0.22, ease:'back.out(2)'}
		);
	}

	SlideKit.registerInit('multiplier', init);
})();
