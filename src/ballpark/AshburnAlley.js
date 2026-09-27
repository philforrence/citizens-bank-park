import { Mesh, Color } from '../engine/index.js';
import { standard } from '../materials/Materials.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { Quads } from './Stands.js';
import { canvasTexture, beam, box } from './geo.js';
import { LEVELS } from './layout.js';

// Ashburn Alley's walk, the parts of it that aren't the buildings (Landmarks.js builds those): Memory
// Lane on the back of the batter's eye, and the rest of the "street fair" (see the functions below).
// Field frame, in the landmarks' group.

const STREET = LEVELS.mainConcourse;

// a string's pseudo-random 0..1
const hash = ( n ) => {

	const s = Math.sin( n * 12.9898 + 78.233 ) * 43758.5453;
	return s - Math.floor( s );

};

// ---------------------------------------------------------------- Memory Lane

// Memory Lane (2004-): "Three overlapping brick walls serve as the batter's eye in center field, and on
// the reverse side of them is a gallery of images from Philadelphia's baseball history". The back of the
// batter's eye in the Alley: plain terracotta brick, and on the tall middle wall a run of illustrated
// history panels at eye level (sepia pictures, the year, a caption) under little hood lamps, the first
// a title panel. `walls`: the batter's eye samples along the wall, { a, b, n (toward home), top, u0, u1 },
// `thick`: how far back the wall's back face is.
export function memoryLane( parent, walls, thick = 0.6 ) {

	const brick = standard( {
		name: 'memory-lane-brick', color: new Color( 0.33, 0.1, 0.065 ), roughness: 0.85,
		surface: /* wgsl */`
	let u = in.uv.x; let v = in.uv.y;
	let row = floor( v / 0.075 );
	let bu = u / 0.2 + 0.5 * ( row % 2.0 );
	let fr = clamp( fwidth( v ) / 0.075 * 1.5 - 0.25, 0.0, 1.0 );
	let fb = clamp( fwidth( bu ) * 1.5 - 0.25, 0.0, 1.0 );
	let mortar = clamp( mix( step( 0.88, fract( v / 0.075 ) ), 0.12, fr ) + mix( step( 0.93, fract( bu ) ), 0.07, max( fb, fr ) ), 0.0, 1.0 );
	let tone = mix( 0.82 + 0.3 * fract( sin( dot( vec2f( floor( bu ), row ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 ), 0.97, max( fr, fb ) );
	s.albedo = mix( mat.color * tone, vec3f( 0.5, 0.44, 0.38 ), mortar * 0.8 );
	// a soldier course at the foot, darker where the Alley's wet and scuffed
	s.albedo = s.albedo * ( 1.0 - 0.25 * ( 1.0 - smoothstep( ${ ( STREET + 0.05 ).toFixed( 3 ) }, ${ ( STREET + 0.35 ).toFixed( 3 ) }, v ) ) );
	s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.06;
`,
	} );
	brick.underwaterLighting = 'none';
	const q = new Quads();
	const back = ( p, n ) => [ p[ 0 ] - n[ 0 ] * thick, p[ 1 ] - n[ 1 ] * thick ];
	walls.forEach( ( w, i ) => {

		const A = back( w.a, w.n ), B = back( w.b, w.n );
		q.add( [ A[ 0 ], STREET - 0.02, A[ 1 ] ], [ B[ 0 ], STREET - 0.02, B[ 1 ] ], [ B[ 0 ], w.top, B[ 1 ] ], [ A[ 0 ], w.top, A[ 1 ] ], [ - w.n[ 0 ], 0, - w.n[ 1 ] ], w.u0, w.u1 );
		// the end of a step, where the next wall is lower (or there is none)
		for ( const [ nb, p, s ] of [ [ walls[ i - 1 ], w.a, - 1 ], [ walls[ i + 1 ], w.b, 1 ] ] ) {

			const lo = nb ? Math.min( nb.top, w.top ) : STREET;
			if ( w.top - lo < 0.05 || ( nb && nb.top > w.top ) ) continue;
			const dx = w.b[ 0 ] - w.a[ 0 ], dz = w.b[ 1 ] - w.a[ 1 ], l = Math.hypot( dx, dz ) || 1;
			const F = [ p[ 0 ] + w.n[ 0 ] * 0.05, p[ 1 ] + w.n[ 1 ] * 0.05 ], K = back( p, w.n );
			q.add( [ F[ 0 ], lo, F[ 1 ] ], [ K[ 0 ], lo, K[ 1 ] ], [ K[ 0 ], w.top, K[ 1 ] ], [ F[ 0 ], w.top, F[ 1 ] ], [ s * dx / l, 0, s * dz / l ], 0, thick );

		}

	} );
	const bm = new Mesh( q.geometry(), brick );
	bm.name = 'memory-lane-wall';
	bm.castShadow = true;
	bm.receiveShadow = true;
	parent.add( bm );

	// the panels along the tallest wall's back
	const run = walls.filter( ( w ) => w.top > STREET + 2.4 );
	if ( ! run.length ) return;
	const u0 = run[ 0 ].u0, u1 = run[ run.length - 1 ].u1;
	const at = ( u ) => {

		const w = run.find( ( r ) => u <= r.u1 + 1e-6 ) || run[ run.length - 1 ];
		const t = ( u - w.u0 ) / ( w.u1 - w.u0 || 1 );
		const p = [ w.a[ 0 ] + ( w.b[ 0 ] - w.a[ 0 ] ) * t, w.a[ 1 ] + ( w.b[ 1 ] - w.a[ 1 ] ) * t ];
		return { p: back( p, w.n ), n: w.n };

	};

	const COLS = 3, ROWS = 2, CW = 640, CH = 460;
	const tex = canvasTexture( CW * COLS, CH * ROWS, ( ctx ) => {

		PANELS.forEach( ( draw, i ) => {

			ctx.save();
			ctx.translate( ( i % COLS ) * CW, Math.floor( i / COLS ) * CH );
			ctx.beginPath(); ctx.rect( 0, 0, CW, CH ); ctx.clip();
			draw( ctx, CW, CH );
			ctx.restore();

		} );

	}, 'memoryLane' );
	const panelMat = standard( { name: 'memory-lane-panels', roughness: 0.35, textures: { bpMem: tex },
		surface: /* wgsl */`
	let t = textureSample( bpMem, smpAnisoClamp, in.uv ).rgb;
	s.albedo = t * 0.85;
	// under its hood lamp after dark: brightest at the top
	let pool = 1.0 - smoothstep( 0.0, 1.0, fract( in.uv.y * ${ ROWS }.0 ) );
	s.emissive = t * vec3f( 1.0, 0.88, 0.7 ) * smoothstep( 0.15, 0.7, frame.night ) * ( 0.12 + 0.4 * pool );
` } );
	const lampMat = standard( { name: 'memory-lane-lamps', color: new Color( 0.03, 0.03, 0.03 ), roughness: 0.5, metalness: 0.5,
		surface: 'if ( in.N.y < - 0.5 ) { s.emissive = vec3f( 1.0, 0.85, 0.6 ) * mix( 0.1, 4.0, smoothstep( 0.1, 0.7, frame.night ) ); }' } );
	const frameMat = standard( { name: 'memory-lane-frames', color: new Color( 0.02, 0.025, 0.022 ), roughness: 0.5, metalness: 0.4 } );
	for ( const m of [ panelMat, lampMat, frameMat ] ) m.underwaterLighting = 'none';
	const pq = new Quads(), lq = new Quads(), fq = new Quads();
	const N = Math.min( PANELS.length, Math.floor( ( u1 - u0 - 0.2 ) / 1.5 ) );
	const pitch = ( u1 - u0 - 0.2 ) / N, pw = pitch - 0.14, y0 = STREET + 0.8, y1 = STREET + 2.0;
	// the viewer faces the wall (toward home): which way along the wall is his right (the title panel
	// first, on his left)
	const E0 = at( u0 ), E1 = at( u1 );
	const right = ( - E0.n[ 1 ] ) * ( E1.p[ 0 ] - E0.p[ 0 ] ) + E0.n[ 0 ] * ( E1.p[ 1 ] - E0.p[ 1 ] ) > 0;
	for ( let k = 0; k < N; k ++ ) {

		const slot = right ? k : N - 1 - k;
		const ua = u0 + 0.1 + slot * pitch + 0.07, ub = ua + pw;
		const A = at( ua ), B = at( ub ), n = A.n;
		const [ L, R ] = right ? [ A.p, B.p ] : [ B.p, A.p ];
		const o = 0.045, off = ( p, d = o ) => [ p[ 0 ] - n[ 0 ] * d, p[ 1 ] - n[ 1 ] * d ];
		const Lp = off( L ), Rp = off( R );
		const cu = ( k % COLS ) / COLS, cv = Math.floor( k / COLS ) / ROWS;
		const nn = [ - n[ 0 ], 0, - n[ 1 ] ];
		pq.tri( [ Lp[ 0 ], y0, Lp[ 1 ] ], [ Rp[ 0 ], y0, Rp[ 1 ] ], [ Rp[ 0 ], y1, Rp[ 1 ] ], nn, [ cu, cv + 1 / ROWS ], [ cu + 1 / COLS, cv + 1 / ROWS ], [ cu + 1 / COLS, cv ] );
		pq.tri( [ Lp[ 0 ], y0, Lp[ 1 ] ], [ Rp[ 0 ], y1, Rp[ 1 ] ], [ Lp[ 0 ], y1, Lp[ 1 ] ], nn, [ cu, cv + 1 / ROWS ], [ cu + 1 / COLS, cv ], [ cu, cv ] );
		// the frame round it, standing off the brick
		const L2 = off( L, 0.03 ), R2 = off( R, 0.03 );
		const dx = R2[ 0 ] - L2[ 0 ], dz = R2[ 1 ] - L2[ 1 ], l = Math.hypot( dx, dz ), ex = dx / l * 0.05, ez = dz / l * 0.05;
		for ( const yy of [ y0 - 0.04, y1 + 0.04 ] ) beam( fq, [ L2[ 0 ] - ex, yy, L2[ 1 ] - ez ], [ R2[ 0 ] + ex, yy, R2[ 1 ] + ez ], 0.07 );
		for ( const P of [ [ L2[ 0 ] - ex, L2[ 1 ] - ez ], [ R2[ 0 ] + ex, R2[ 1 ] + ez ] ] ) beam( fq, [ P[ 0 ], y0 - 0.04, P[ 1 ] ], [ P[ 0 ], y1 + 0.04, P[ 1 ] ], 0.07 );
		// its hood lamp on a gooseneck arm
		const M = off( [ ( L[ 0 ] + R[ 0 ] ) / 2, ( L[ 1 ] + R[ 1 ] ) / 2 ], 0.0 ), H = off( M, 0.42 );
		beam( fq, [ M[ 0 ], y1 + 0.32, M[ 1 ] ], [ H[ 0 ], y1 + 0.42, H[ 1 ] ], 0.035 );
		const hx = dx / l * 0.28, hz = dz / l * 0.28;
		lq.add( [ H[ 0 ] - hx, y1 + 0.36, H[ 1 ] - hz ], [ H[ 0 ] + hx, y1 + 0.36, H[ 1 ] + hz ], [ H[ 0 ] + hx - n[ 0 ] * 0.12, y1 + 0.36, H[ 1 ] + hz - n[ 1 ] * 0.12 ], [ H[ 0 ] - hx - n[ 0 ] * 0.12, y1 + 0.36, H[ 1 ] - hz - n[ 1 ] * 0.12 ], [ 0, - 1, 0 ] );
		box( lq, [ H[ 0 ] - n[ 0 ] * 0.06, y1 + 0.42, H[ 1 ] - n[ 1 ] * 0.06 ], [ 0.14, 0.1, 0.14 ] );

	}

	for ( const [ g, m, name ] of [ [ pq, panelMat, 'memory-lane-panels' ], [ lq, lampMat, 'memory-lane-lamps' ], [ fq, frameMat, 'memory-lane-frames' ] ] ) {

		const mesh = new Mesh( g.geometry(), m );
		mesh.name = name;
		mesh.receiveShadow = true;
		parent.add( mesh );

	}

}

// ---- the panels' pictures (drawn like old photographs: sepia, a little grain, a vignette)

const INK = ( a = 1 ) => `rgba( 52, 36, 22, ${ a } )`;
const CREAM = '#efe4cc';

// a panel's layout: the maroon band with MEMORY LANE, the picture on the left, the year, a title and the
// caption on the right; `picture( ctx, w, h )` draws in the picture's own frame
function panel( year, title, caption, picture ) {

	return ( ctx, W, H ) => {

		ctx.fillStyle = '#16140f';
		ctx.fillRect( 0, 0, W, H );
		ctx.fillStyle = '#f1e8d4';
		ctx.fillRect( 8, 8, W - 16, H - 16 );
		ctx.fillStyle = '#6e1b20';
		ctx.fillRect( 8, 8, W - 16, 52 );
		ctx.fillStyle = CREAM;
		ctx.font = '700 22px Georgia, serif';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText( 'MEMORY  LANE', 26, 35 );
		ctx.textAlign = 'right';
		ctx.font = 'italic 600 22px Georgia, serif';
		ctx.fillText( 'Philadelphia Baseball', W - 26, 35 );
		// the photograph
		const px = 24, py = 76, pw = 360, ph = H - 76 - 24;
		ctx.save();
		ctx.translate( px, py );
		ctx.beginPath(); ctx.rect( 0, 0, pw, ph ); ctx.clip();
		const bg = ctx.createLinearGradient( 0, 0, 0, ph );
		bg.addColorStop( 0, '#d8c6a0' ); bg.addColorStop( 0.6, '#c2a87c' ); bg.addColorStop( 1, '#9c8058' );
		ctx.fillStyle = bg;
		ctx.fillRect( 0, 0, pw, ph );
		picture( ctx, pw, ph );
		// grain and a vignette
		for ( let i = 0; i < 900; i ++ ) {

			ctx.fillStyle = hash( i * 3.1 + year.length ) > 0.5 ? 'rgba( 255, 245, 225, 0.08 )' : 'rgba( 40, 25, 10, 0.08 )';
			ctx.fillRect( hash( i * 7.7 ) * pw, hash( i * 5.3 + 1 ) * ph, 2, 2 );

		}

		const vg = ctx.createRadialGradient( pw / 2, ph / 2, ph * 0.3, pw / 2, ph / 2, pw * 0.75 );
		vg.addColorStop( 0, 'rgba( 30, 18, 8, 0 )' ); vg.addColorStop( 1, 'rgba( 30, 18, 8, 0.45 )' );
		ctx.fillStyle = vg;
		ctx.fillRect( 0, 0, pw, ph );
		ctx.restore();
		ctx.strokeStyle = '#2a2016'; ctx.lineWidth = 3; ctx.strokeRect( px, py, pw, ph );
		// the words
		const tx = px + pw + 18, tw = W - tx - 22;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
		ctx.fillStyle = '#6e1b20';
		ctx.font = `700 ${ year.length > 5 ? 38 : 62 }px Georgia, serif`;
		ctx.fillText( year, tx, 140, tw );
		ctx.fillStyle = '#1c1a16';
		ctx.font = '700 23px Georgia, serif';
		let y = 182;
		for ( const l of wrap( ctx, title, tw ) ) {

			ctx.fillText( l, tx, y );
			y += 27;

		}

		ctx.font = '17px Georgia, serif';
		ctx.fillStyle = '#3a342a';
		y += 8;
		for ( const l of wrap( ctx, caption, tw ) ) {

			ctx.fillText( l, tx, y );
			y += 21;

		}

	};

}

function wrap( ctx, text, w ) {

	const out = [];
	let line = '';
	for ( const word of text.split( ' ' ) ) {

		const t = line ? line + ' ' + word : word;
		if ( ctx.measureText( t ).width > w && line ) {

			out.push( line );
			line = word;

		} else line = t;

	}

	if ( line ) out.push( line );
	return out;

}

// a ballplayer in an old photograph: flannels, a cap; pose angles for the arms and the stride
function player( ctx, x, y, s, { armL = 0.3, armR = - 0.3, stride = 0.12, bat = false, dark = false, letters = '' } = {} ) {

	ctx.save();
	ctx.translate( x, y );
	ctx.scale( s, s );
	const uni = dark ? '#5a4632' : '#e9dcc0', shade = dark ? '#3e2f20' : '#b9a57f';
	ctx.lineCap = 'round';
	// legs, in knickers and dark socks
	for ( const k of [ - 1, 1 ] ) {

		ctx.strokeStyle = uni; ctx.lineWidth = 16;
		ctx.beginPath(); ctx.moveTo( k * 8, - 60 ); ctx.lineTo( k * ( 10 + stride * 60 ), - 30 ); ctx.stroke();
		ctx.strokeStyle = INK( 0.9 ); ctx.lineWidth = 11;
		ctx.beginPath(); ctx.moveTo( k * ( 10 + stride * 60 ), - 30 ); ctx.lineTo( k * ( 12 + stride * 90 ), - 2 ); ctx.stroke();

	}

	// the body and the belt
	ctx.fillStyle = uni;
	ctx.beginPath(); ctx.roundRect( - 17, - 118, 34, 62, 8 ); ctx.fill();
	ctx.fillStyle = shade; ctx.fillRect( 3, - 118, 14, 62 );
	ctx.fillStyle = INK( 0.8 ); ctx.fillRect( - 17, - 62, 34, 5 );
	if ( letters ) {

		ctx.fillStyle = INK( 0.85 ); ctx.font = '700 9px Georgia, serif'; ctx.textAlign = 'center';
		ctx.fillText( letters, 0, - 98 );

	}

	// the arms
	for ( const [ k, a ] of [ [ - 1, armL ], [ 1, armR ] ] ) {

		ctx.strokeStyle = uni; ctx.lineWidth = 11;
		ctx.beginPath(); ctx.moveTo( k * 16, - 112 ); ctx.lineTo( k * 16 + Math.sin( a ) * 44 * k, - 112 + Math.cos( a ) * 44 ); ctx.stroke();

	}

	if ( bat ) {

		ctx.strokeStyle = INK( 0.9 ); ctx.lineWidth = 5;
		ctx.beginPath(); ctx.moveTo( 20, - 100 ); ctx.lineTo( 44, - 170 ); ctx.stroke();

	}

	// the head and the cap
	ctx.fillStyle = '#b39470';
	ctx.beginPath(); ctx.arc( 0, - 132, 13, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = INK( 0.85 );
	ctx.beginPath(); ctx.arc( 0, - 136, 13, Math.PI, 0 ); ctx.fill();
	ctx.fillRect( - 2, - 138, 20, 4 );
	ctx.restore();

}

// a crowd of hats and shoulders along the bottom of a picture
function crowd( ctx, w, y, n, s = 1 ) {

	for ( let i = 0; i < n; i ++ ) {

		const x = hash( i * 1.7 + y ) * w, yy = y + hash( i * 2.9 ) * 26 * s;
		ctx.fillStyle = INK( 0.45 + 0.4 * hash( i * 4.1 ) );
		ctx.beginPath(); ctx.ellipse( x, yy + 22 * s, 16 * s, 20 * s, 0, 0, Math.PI * 2 ); ctx.fill();
		ctx.beginPath(); ctx.arc( x, yy, 8 * s, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillRect( x - 12 * s, yy - 6 * s, 24 * s, 3 * s );

	}

}

const PANELS = [
	// the title panel
	( ctx, W, H ) => {

		ctx.fillStyle = '#16140f'; ctx.fillRect( 0, 0, W, H );
		ctx.fillStyle = '#6e1b20'; ctx.fillRect( 8, 8, W - 16, H - 16 );
		ctx.strokeStyle = '#e3cf9a'; ctx.lineWidth = 4; ctx.strokeRect( 26, 26, W - 52, H - 52 );
		ctx.fillStyle = '#f3ead6';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = '700 84px Georgia, serif';
		ctx.fillText( 'MEMORY', W / 2, H * 0.3 );
		ctx.fillText( 'LANE', W / 2, H * 0.5 );
		ctx.font = 'italic 30px Georgia, serif';
		ctx.fillText( 'Philadelphia Baseball  1883 - 2004', W / 2, H * 0.69 );
		ctx.font = '20px Georgia, serif';
		ctx.fillText( 'the Phillies, the Athletics, and the Negro Leagues', W / 2, H * 0.8 );
		// a little bell over it
		ctx.fillStyle = '#e3cf9a';
		ctx.beginPath(); ctx.moveTo( W / 2 - 16, H * 0.08 + 8 ); ctx.quadraticCurveTo( W / 2, H * 0.08 - 14, W / 2 + 16, H * 0.08 + 8 ); ctx.lineTo( W / 2 + 22, H * 0.08 + 26 ); ctx.lineTo( W / 2 - 22, H * 0.08 + 26 ); ctx.closePath(); ctx.fill();

	},
	panel( '1915', 'The Phillies\' first pennant', 'Grover Cleveland Alexander wins 31 games, and National League Park, the Baker Bowl at Broad and Lehigh, sees its first World Series.', ( ctx, w, h ) => {

		// the Baker Bowl's brick front: arched windows over the gates, the name across it
		ctx.fillStyle = '#8b6a48'; ctx.fillRect( 0, h * 0.18, w, h * 0.55 );
		ctx.fillStyle = '#6d5236'; ctx.fillRect( 0, h * 0.18, w, 14 );
		for ( let x = 16; x < w; x += 44 ) {

			ctx.fillStyle = INK( 0.75 );
			ctx.beginPath(); ctx.roundRect( x, h * 0.3, 26, 40, [ 13, 13, 0, 0 ] ); ctx.fill();
			ctx.beginPath(); ctx.roundRect( x - 2, h * 0.5, 30, 56, [ 15, 15, 0, 0 ] ); ctx.fill();

		}

		ctx.fillStyle = '#e8dcc2'; ctx.fillRect( w * 0.12, h * 0.21, w * 0.76, 22 );
		ctx.fillStyle = INK( 0.9 ); ctx.font = '700 15px Georgia, serif'; ctx.textAlign = 'center';
		ctx.fillText( 'NATIONAL LEAGUE BASE BALL PARK', w / 2, h * 0.21 + 16 );
		// bunting and the pennant on its pole
		ctx.strokeStyle = INK( 0.8 ); ctx.lineWidth = 3;
		ctx.beginPath(); ctx.moveTo( w * 0.8, h * 0.18 ); ctx.lineTo( w * 0.8, 0 ); ctx.stroke();
		ctx.fillStyle = '#efe6d0';
		ctx.beginPath(); ctx.moveTo( w * 0.8, 6 ); ctx.lineTo( w * 0.98, 20 ); ctx.lineTo( w * 0.8, 34 ); ctx.fill();
		crowd( ctx, w, h * 0.72, 46, 1.1 );

	} ),
	panel( '1910 - 1930', 'Connie Mack\'s Athletics', 'Shibe Park, Lehigh Avenue and 21st Street: five World Series for the A\'s (1910, 1911, 1913, 1929, 1930). The Phillies moved in in 1938.', ( ctx, w, h ) => {

		// Shibe Park's corner: the domed tower over the entrance, arched windows along the wings
		ctx.fillStyle = '#9a7b58'; ctx.fillRect( 0, h * 0.42, w, h * 0.35 );
		for ( let x = 8; x < w; x += 30 ) {

			ctx.fillStyle = INK( 0.7 );
			ctx.beginPath(); ctx.roundRect( x, h * 0.48, 18, 34, [ 9, 9, 0, 0 ] ); ctx.fill();

		}

		const tx = w * 0.5;
		ctx.fillStyle = '#b39572'; ctx.fillRect( tx - 46, h * 0.16, 92, h * 0.62 );
		ctx.fillStyle = INK( 0.75 );
		ctx.beginPath(); ctx.ellipse( tx, h * 0.16, 50, 44, 0, Math.PI, 0 ); ctx.fill();
		ctx.fillRect( tx - 3, h * 0.16 - 70, 6, 30 );
		for ( const yy of [ 0.26, 0.4 ] ) {

			ctx.beginPath(); ctx.roundRect( tx - 16, h * yy, 32, 40, [ 16, 16, 0, 0 ] ); ctx.fill();

		}

		ctx.fillStyle = '#efe6d0'; ctx.fillRect( tx - 40, h * 0.56, 80, 14 );
		ctx.fillStyle = INK( 0.9 ); ctx.font = '700 11px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText( 'SHIBE PARK', tx, h * 0.56 + 11 );
		// a Model T at the curb
		ctx.fillStyle = INK( 0.9 );
		ctx.fillRect( w * 0.1, h * 0.8, 70, 22 ); ctx.fillRect( w * 0.1 + 14, h * 0.74, 34, 20 );
		for ( const k of [ 12, 58 ] ) { ctx.beginPath(); ctx.arc( w * 0.1 + k, h * 0.86, 9, 0, Math.PI * 2 ); ctx.fill(); }
		crowd( ctx, w, h * 0.84, 18, 0.8 );

	} ),
	panel( '1925 . 1934', 'The Negro Leagues', 'Hilldale of Darby wins the 1925 Colored World Series; the Philadelphia Stars take the Negro National League in 1934.', ( ctx, w, h ) => {

		// a team picture: two rows in dark flannels, HILLDALE across the chests
		ctx.fillStyle = '#b29a74'; ctx.fillRect( 0, h * 0.62, w, h );
		for ( let i = 0; i < 6; i ++ ) player( ctx, 34 + i * 58, h * 0.66, 1.0, { armL: 0.15, armR: - 0.15, stride: 0.02, dark: true, letters: 'HILLDALE' } );
		for ( let i = 0; i < 5; i ++ ) player( ctx, 62 + i * 58, h * 0.99, 1.15, { armL: 0.2, armR: - 0.2, stride: 0.05, dark: i % 2 === 0, letters: i % 2 ? 'STARS' : 'HILLDALE' } );

	} ),
	panel( '1950', 'The Whiz Kids', 'On the season\'s last day at Ebbets Field, Dick Sisler\'s home run in the tenth wins the pennant. Robin Roberts pitches all ten innings.', ( ctx, w, h ) => {

		// the young team piled together, arms up
		ctx.fillStyle = '#b8a07a'; ctx.fillRect( 0, h * 0.7, w, h );
		for ( let i = 0; i < 7; i ++ ) player( ctx, 26 + i * 50, h * ( 0.9 + 0.04 * hash( i ) ), 1.05, { armL: 2.6 + 0.3 * hash( i * 3 ), armR: - 2.4 - 0.3 * hash( i * 5 ), stride: 0.1, letters: 'Phillies' } );
		ctx.fillStyle = INK( 0.3 ); ctx.fillRect( 0, h * 0.08, w, 30 );

	} ),
	panel( '1980', 'World Champions', 'October 21, 1980: Tug McGraw strikes out Willie Wilson at the Vet, and the Phillies win their first World Series.', ( ctx, w, h ) => {

		// the Vet's stands behind, McGraw leaping off the mound, arms up
		ctx.fillStyle = '#8f7757'; ctx.fillRect( 0, 0, w, h * 0.45 );
		for ( let r = 0; r < 7; r ++ ) crowd( ctx, w, 8 + r * 20, 40, 0.45 );
		ctx.fillStyle = '#c9b48f'; ctx.fillRect( 0, h * 0.45, w, h );
		ctx.fillStyle = '#b09670'; ctx.beginPath(); ctx.ellipse( w * 0.45, h * 0.9, 90, 22, 0, 0, Math.PI * 2 ); ctx.fill();
		player( ctx, w * 0.45, h * 0.8, 1.7, { armL: 2.9, armR: - 2.9, stride: 0.25, letters: 'Phillies' } );
		player( ctx, w * 0.82, h * 0.95, 1.3, { armL: 2.4, armR: - 2.7, stride: 0.2, letters: 'Phillies' } );

	} ),
];
