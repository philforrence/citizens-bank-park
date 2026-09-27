import { Mesh, Color, Vector3 } from '../../../engine/index.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';
import { LEVELS } from '../../layout.js';
import { Mesher } from './Mesher.js';
import { LIFT } from './Street.js';

// The plaza's furniture of October 2008: banners on the tall lamp poles (a red one with the P, as in
// Flickr beauwhite 2007 and pingnews 2007, and one for the World Series); the marquee on Pattison with
// its LED board over the red neon Phillies script and its blue stars (Flickr roadieshow, 27 Oct 2008,
// in the rain: "WORLD SERIES", "GAME 5 TONIGHT"...); the red and white balloon arch at McFadden's door
// (same photo); black round bins and wire ones (the photos of 2007-08); the TEAM STORE sandwich board
// on the plaza (Flickr talialeone, July 2008).

const STREET = LEVELS.mainConcourse;

export function buildFurniture( { group, exterior, colliders, field } ) {

	const y = ( h ) => STREET + LIFT + h;
	const banners = new Mesher(), steel = new Mesher(), bins = new Mesher(), wire = new Mesher(), board = new Mesher(), balloons = new Mesher(), maroon = new Mesher(), granite = new Mesher(), led = new Mesher(), neon = new Mesher(), green = new Mesher();
	const collide = ( x, z, r, h ) => {

		const w = field.toWorld( x, z );
		colliders.addCylinder( w.x, w.z, r, field.y0 + STREET, field.y0 + STREET + h );

	};

	// ---- the pole banners: two on each tall pole, on brackets out either side, printed both faces
	const tall = ( exterior?.lamps || [] ).filter( ( l ) => l[ 3 ] );
	for ( const [ i, [ x, , z ] ] of tall.entries() ) {

		const a = 0.4 + Math.PI / 4 + i * 0.3;
		for ( const [ side, u0 ] of [ [ 1, 0 ], [ - 1, 0.5 ] ] ) {

			const d = [ Math.cos( a ) * side, Math.sin( a ) * side ];
			const P = ( o, h ) => [ x + d[ 0 ] * o, y( h ), z + d[ 1 ] * o ];
			steel.tube( [ P( 0.1, 4.25 ), P( 0.72, 4.25 ) ], [ 0.018, 0.018 ], 4, { capB: true } );
			steel.tube( [ P( 0.1, 2.55 ), P( 0.72, 2.55 ) ], [ 0.018, 0.018 ], 4, { capB: true } );
			// the banner: 0.6 x 1.7, both faces, each reading the right way
			const n = [ - d[ 1 ], d[ 0 ] ];
			for ( const f of [ 1, - 1 ] ) {

				const N = [ n[ 0 ] * f, 0, n[ 1 ] * f ];
				// the text runs out from the pole when that's to the viewer's right
				const right = ( d[ 0 ] * N[ 2 ] - d[ 1 ] * N[ 0 ] ) > 0;
				const [ ua, ub ] = right ? [ u0, u0 + 0.5 ] : [ u0 + 0.5, u0 ];
				const off = f * 0.004;
				const Q = ( o, h ) => [ x + d[ 0 ] * o + n[ 0 ] * off, y( h ), z + d[ 1 ] * o + n[ 1 ] * off ];
				banners.face( Q( 0.12, 2.5 ), Q( 0.72, 2.5 ), Q( 0.72, 4.25 ), Q( 0.12, 4.25 ), N, [ [ ua, 1 ], [ ub, 1 ], [ ub, 0 ], [ ua, 0 ] ] );

			}

		}

	}

	// ---- the marquee on the plaza's Pattison edge: a granite base, two maroon columns, the neon script
	// and its stars, the LED board, the green name on top; facing the street
	const mq = [ - 90.5, 96.2 ], my = 0.25; // its place, the way it faces (a little west of south)
	const f = [ Math.sin( my ), Math.cos( my ) ], s = [ f[ 1 ], - f[ 0 ] ];
	const M = ( a, o, h ) => [ mq[ 0 ] + s[ 0 ] * a + f[ 0 ] * o, y( h ), mq[ 1 ] + s[ 1 ] * a + f[ 1 ] * o ];
	const slab = ( m, a0, a1, o0, o1, h0, h1 ) => {

		const B = ( a, o, h ) => M( a, o, h );
		m.face( B( a0, o1, h0 ), B( a1, o1, h0 ), B( a1, o1, h1 ), B( a0, o1, h1 ), [ f[ 0 ], 0, f[ 1 ] ] );
		m.face( B( a1, o0, h0 ), B( a0, o0, h0 ), B( a0, o0, h1 ), B( a1, o0, h1 ), [ - f[ 0 ], 0, - f[ 1 ] ] );
		m.face( B( a1, o1, h0 ), B( a1, o0, h0 ), B( a1, o0, h1 ), B( a1, o1, h1 ), [ s[ 0 ], 0, s[ 1 ] ] );
		m.face( B( a0, o0, h0 ), B( a0, o1, h0 ), B( a0, o1, h1 ), B( a0, o0, h1 ), [ - s[ 0 ], 0, - s[ 1 ] ] );
		m.face( B( a0, o1, h1 ), B( a1, o1, h1 ), B( a1, o0, h1 ), B( a0, o0, h1 ), [ 0, 1, 0 ] );

	};

	slab( granite, - 1.4, 1.4, - 0.55, 0.55, 0, 1.2 );
	for ( const a of [ - 2.3, 2.3 ] ) slab( maroon, a - 0.2, a + 0.2, - 0.2, 0.2, 0, 9.6 );
	slab( maroon, - 2.5, 2.5, - 0.25, 0.25, 3.2, 3.35 );
	slab( maroon, - 2.5, 2.5, - 0.25, 0.25, 7.9, 8.05 );
	slab( maroon, - 2.1, 2.1, - 0.18, 0.18, 3.35, 4.95 ); // the script's dark panel
	slab( maroon, - 2.1, 2.1, - 0.2, 0.2, 5.1, 7.8 ); // the LED board's case
	slab( green, - 2.3, 2.3, - 0.15, 0.15, 8.2, 9.4 ); // the name box
	// the faces, front and back: the LED board, the neon, the name (uv picks the atlas row)
	for ( const back of [ false, true ] ) {

		const o = back ? - 0.205 : 0.205, N = back ? [ - f[ 0 ], 0, - f[ 1 ] ] : [ f[ 0 ], 0, f[ 1 ] ];
		const [ a0, a1 ] = back ? [ 2.0, - 2.0 ] : [ - 2.0, 2.0 ];
		led.face( M( a0, o, 5.2 ), M( a1, o, 5.2 ), M( a1, o, 7.7 ), M( a0, o, 7.7 ), N, [ [ 0, 1 ], [ 1, 1 ], [ 1, 0 ], [ 0, 0 ] ] );
		const [ b0, b1 ] = back ? [ 1.95, - 1.95 ] : [ - 1.95, 1.95 ];
		const o2 = back ? - 0.185 : 0.185;
		neon.face( M( b0, o2, 3.45 ), M( b1, o2, 3.45 ), M( b1, o2, 4.85 ), M( b0, o2, 4.85 ), N, [ [ 0, 1 ], [ 1, 1 ], [ 1, 0.5 ], [ 0, 0.5 ] ] );
		const [ c0, c1 ] = back ? [ 2.2, - 2.2 ] : [ - 2.2, 2.2 ];
		const o3 = back ? - 0.155 : 0.155;
		neon.face( M( c0, o3, 8.25 ), M( c1, o3, 8.25 ), M( c1, o3, 9.35 ), M( c0, o3, 9.35 ), N, [ [ 0, 0.5 ], [ 1, 0.5 ], [ 1, 0 ], [ 0, 0 ] ] );

	}

	collide( mq[ 0 ], mq[ 1 ], 1.6, 3 );

	// ---- the balloon arch at McFadden's door (x -71.75, facing the plaza), red and white in clusters
	{

		const x0 = - 72.35, zc = 75, R = 2.1;
		let k = 0;
		for ( let i = 0; i <= 24; i ++ ) {

			const q = i / 24 * Math.PI;
			const cz = zc - Math.cos( q ) * R, cy = 0.3 + Math.sin( q ) * ( R + 0.9 );
			for ( let j = 0; j < 4; j ++ ) {

				const qq = j / 4 * Math.PI * 2 + i;
				const c = [ x0 + Math.cos( qq ) * 0.13, y( cy + Math.sin( qq ) * 0.13 ), cz + Math.sin( qq ) * 0.05 ];
				const col = ( i + j ) % 2;
				// a little sphere, its colour in uv.x
				const W = 8, H = 6, r = 0.14, first = balloons.count;
				for ( let b = 0; b <= H; b ++ ) for ( let a = 0; a <= W; a ++ ) {

					const th = b / H * Math.PI, ph = a / W * Math.PI * 2;
					const dn = [ Math.sin( th ) * Math.cos( ph ), Math.cos( th ) * 1.15, Math.sin( th ) * Math.sin( ph ) ];
					balloons.v( [ c[ 0 ] + dn[ 0 ] * r, c[ 1 ] + dn[ 1 ] * r, c[ 2 ] + dn[ 2 ] * r ], dn, [ col + 0.5, 0.5 ] );

				}

				for ( let b = 0; b < H; b ++ ) for ( let a = 0; a < W; a ++ ) {

					const A = first + b * ( W + 1 ) + a;
					balloons.quad( A, A + 1, A + W + 2, A + W + 1 );

				}

				k ++;

			}

		}

	}

	// ---- black round bins and wire ones round the plaza and the corner
	const binAt = [ [ - 118.5, 84.5 ], [ - 100.5, 90.5 ], [ - 86.5, 84 ], [ - 126.5, 56 ], [ - 126, 33 ], [ - 107, 27.5 ], [ - 79.5, 95 ], [ - 62, 98 ], [ - 134.5, 104 ], [ - 96.5, 47 ] ];
	for ( const [ i, [ x, z ] ] of binAt.entries() ) {

		if ( i % 4 === 3 ) {

			// wire: galvanized mesh on hoops
			wire.tube( [ [ x, y( 0 ), z ], [ x, y( 0.85 ), z ] ], [ 0.28, 0.3 ], 14 );
			steel.tube( [ [ x, y( 0.84 ), z ], [ x, y( 0.87 ), z ] ], [ 0.31, 0.31 ], 14 );
			steel.tube( [ [ x, y( 0.02 ), z ], [ x, y( 0.05 ), z ] ], [ 0.285, 0.285 ], 14 );

		} else {

			// black: a slatted drum, the domed lid with its opening
			bins.tube( [ [ x, y( 0 ), z ], [ x, y( 0.8 ), z ] ], [ 0.3, 0.31 ], 14, { capA: true } );
			bins.tube( [ [ x, y( 0.8 ), z ], [ x, y( 0.9 ), z ], [ x, y( 0.97 ), z ] ], [ 0.33, 0.28, 0.12 ], 14, { capB: true } );

		}

		collide( x, z, 0.33, 1 );

	}

	// ---- the TEAM STORE board on the plaza, toward the store
	{

		const x = - 110.6, z = 96.4, a = 0.35, c = Math.cos( a ), sn = Math.sin( a );
		const P = ( u, v, h ) => [ x + u * c + v * sn, y( h ), z - u * sn + v * c ];
		// two leaves leaning together (an A), printed both
		for ( const side of [ 1, - 1 ] ) {

			const top = P( - 0.32, side * 0.03, 1.05 ), top2 = P( 0.32, side * 0.03, 1.05 ), bot = P( - 0.32, side * 0.3, 0 ), bot2 = P( 0.32, side * 0.3, 0 );
			const [ ua, ub ] = side > 0 ? [ 0, 1 ] : [ 1, 0 ];
			board.face( bot, bot2, top2, top, [ sn * side, 0.25, c * side ], [ [ ua, 1 ], [ ub, 1 ], [ ub, 0 ], [ ua, 0 ] ] );

		}

	}

	// ---- materials
	const bannerTex = canvasTexture( 256, 384, ( ctx, w, h ) => {

		// left: red, the P in its roundel, PHILLIES; right: navy, WORLD SERIES 2008
		ctx.fillStyle = '#a8141e'; ctx.fillRect( 0, 0, 128, h );
		ctx.fillStyle = '#f2efe6'; ctx.beginPath(); ctx.arc( 64, 130, 50, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#a8141e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.font = 'italic 700 76px "Brush Script MT", "Snell Roundhand", Georgia, serif'; ctx.fillText( 'P', 61, 136 );
		ctx.fillStyle = '#f2efe6'; ctx.font = '800 20px Helvetica, Arial, sans-serif'; ctx.fillText( 'PHILLIES', 64, 260, 110 );
		ctx.fillStyle = '#1b2a57'; ctx.fillRect( 128, 0, 128, h );
		ctx.fillStyle = '#f2efe6'; ctx.font = '800 22px Helvetica, Arial, sans-serif';
		ctx.fillText( 'WORLD', 192, 110, 110 ); ctx.fillText( 'SERIES', 192, 140, 110 );
		ctx.fillStyle = '#c9a44a'; ctx.font = '800 40px Helvetica, Arial, sans-serif'; ctx.fillText( '2008', 192, 200, 110 );
		ctx.fillStyle = '#b3151f'; ctx.fillRect( 140, 250, 104, 8 );

	}, 'poleBanners' );
	const signsTex = canvasTexture( 1024, 512, ( ctx, w, h ) => {

		// top: the neon Phillies script, two blue stars; bottom: Citizens Bank Park in green
		ctx.fillStyle = '#0b0b0e'; ctx.fillRect( 0, 0, w, 256 );
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.fillStyle = '#ff3b2e';
		ctx.font = 'italic 700 170px "Brush Script MT", "Snell Roundhand", Georgia, serif';
		ctx.fillText( 'Phillies', w / 2, 120, w - 80 );
		ctx.fillRect( 180, 200, 700, 14 );
		ctx.fillStyle = '#3fb4ff';
		for ( const sx of [ 470, 610 ] ) {

			ctx.beginPath();
			for ( let i = 0; i < 10; i ++ ) {

				const q = - Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 26;
				ctx.lineTo( sx + Math.cos( q ) * r, 44 + Math.sin( q ) * r );

			}

			ctx.fill();

		}

		ctx.fillStyle = '#0f5a3c'; ctx.fillRect( 0, 256, w, 256 );
		ctx.fillStyle = '#7dffb8'; ctx.font = '600 120px "Gill Sans", "Trebuchet MS", sans-serif';
		ctx.fillText( 'Citizens Bank Park', w / 2 + 30, 386, w - 120 );

	}, 'marqueeSigns' );
	const ledTex = canvasTexture( 512, 1024, ( ctx, w, h ) => {

		const rows = [ [ 'WORLD SERIES', '#ffffff' ], [ 'GAME 5', '#ffd23a' ], [ 'TONIGHT 8:37', '#ffffff' ], [ 'RAYS vs PHILLIES', '#ff4a3a' ], [ 'GO PHILS!', '#ff4a3a' ], [ 'RED OCTOBER', '#ff2a2a' ], [ 'GAME 5 RESUMES', '#ffd23a' ], [ 'WORLD CHAMPIONS!', '#ffd23a' ] ];
		ctx.fillStyle = '#000'; ctx.fillRect( 0, 0, w, h );
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		rows.forEach( ( [ t, c ], i ) => {

			ctx.fillStyle = c;
			ctx.font = '800 78px "Arial Narrow", Helvetica, Arial, sans-serif';
			ctx.fillText( t, w / 2, i * 128 + 66, w - 30 );

		} );

	}, 'marqueeLED' );
	const bannerMat = standard( { name: 'w1-pole-banners', roughness: 0.75, textures: { pbTex: bannerTex }, surface: 's.albedo = textureSample( pbTex, smpAnisoClamp, in.uv ).rgb;' } );
	const ledMat = standard( { name: 'w1-marquee-led', color: new Color( 0.02, 0.02, 0.02 ), roughness: 0.2, modules: [ commonModule ], uniforms: { msg: [ 'f32', 0 ] }, textures: { mqLed: ledTex },
		surface: /* wgsl */`
	// the LED board: a grid of dots (the row of the atlas the message is on), bright at night, readable by day
	let row = floor( mat.msg + 0.5 );
	let cell = in.uv * vec2f( 160.0, 96.0 );
	let dot = 1.0 - smoothstep( 0.28, 0.45, length( fract( cell ) - 0.5 ) );
	let t = textureSampleLevel( mqLed, smpLinearClamp, ( floor( cell ) + 0.5 ) / vec2f( 160.0, 96.0 * 8.0 ) + vec2f( 0.0, row / 8.0 ), 0.0 ).rgb;
	s.albedo = vec3f( 0.02 ) + t * 0.1;
	s.emissive = t * dot * mix( 2.5, 6.0, smoothstep( 0.1, 0.7, frame.night ) );
	s.roughness = 0.15;
` } );
	ledMat.setDefine( 'DRY', 1 );
	const neonMat = standard( { name: 'w1-marquee-neon', roughness: 0.3, textures: { mqSigns: signsTex },
		surface: 'let t = textureSample( mqSigns, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.4; s.emissive = t * step( 0.35, max( t.r, max( t.g, t.b ) ) ) * mix( 1.2, 7.0, smoothstep( 0.1, 0.7, frame.night ) );' } );
	const boardTex = canvasTexture( 256, 384, ( ctx, w, h ) => {

		ctx.fillStyle = '#f3f1ea'; ctx.fillRect( 0, 0, w, h );
		ctx.strokeStyle = '#1b2a57'; ctx.lineWidth = 8; ctx.strokeRect( 8, 8, w - 16, h - 16 );
		ctx.fillStyle = '#1b2a57'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.font = '800 50px Helvetica, Arial, sans-serif'; ctx.fillText( 'TEAM', w / 2, 70 ); ctx.fillText( 'STORE', w / 2, 125 );
		ctx.fillStyle = '#b3151f'; ctx.beginPath(); ctx.moveTo( 40, 185 ); ctx.lineTo( 170, 185 ); ctx.lineTo( 170, 160 ); ctx.lineTo( 220, 205 ); ctx.lineTo( 170, 250 ); ctx.lineTo( 170, 225 ); ctx.lineTo( 40, 225 ); ctx.fill();
		ctx.fillStyle = '#f3f1ea'; ctx.font = '800 28px Helvetica, Arial, sans-serif'; ctx.fillText( 'OPEN', 105, 206 );
		ctx.fillStyle = '#1b2a57'; ctx.font = '700 30px Helvetica, Arial, sans-serif'; ctx.fillText( '9-5 MON-SAT', w / 2, 295 );
		ctx.font = '600 22px Helvetica, Arial, sans-serif'; ctx.fillText( '& ALL GAME DAYS', w / 2, 335 );

	}, 'teamStoreBoard' );
	const boardMat = standard( { name: 'w1-store-board', roughness: 0.5, side: 'double', textures: { tsTex: boardTex }, surface: 's.albedo = textureSample( tsTex, smpAnisoClamp, in.uv ).rgb;' } );
	const balloonMat = standard( { name: 'w1-balloons', roughness: 0.25, modules: [ commonModule ],
		surface: 's.albedo = select( vec3f( 0.5, 0.02, 0.03 ), vec3f( 0.82, 0.8, 0.78 ), in.uv.x > 1.0 );' } );
	const mats = [
		[ banners, bannerMat, 'w1-pole-banners', false ],
		[ steel, standard( { name: 'w1-furniture-steel', color: new Color( 0.4, 0.41, 0.42 ), roughness: 0.35, metalness: 0.8 } ), 'w1-furniture-steel', true ],
		[ bins, standard( { name: 'w1-bins', color: new Color( 0.02, 0.02, 0.022 ), roughness: 0.45, modules: [ commonModule ],
			surface: 's.albedo = mat.color * ( 1.0 - 0.6 * step( 0.5, fract( in.uv.x * 28.0 ) ) * step( in.P.y, 99.0 ) );' } ), 'w1-bins', true ],
		[ wire, standard( { name: 'w1-wire-bins', color: new Color( 0.5, 0.51, 0.52 ), roughness: 0.35, metalness: 0.8, alphaTest: 0.5, side: 'double', modules: [ commonModule ],
			surface: 'let g = abs( fract( vec2f( in.uv.x * 40.0, in.uv.y * 12.0 ) ) - 0.5 ); let fw = fwidth( in.uv.x * 40.0 ); s.alpha = max( step( 0.4 - fw, max( g.x, g.y ) ), clamp( fw * 0.6, 0.0, 0.6 ) );' } ), 'w1-wire-bins', false ],
		[ board, boardMat, 'w1-store-board', true ], [ balloons, balloonMat, 'w1-balloons', false ],
		[ maroon, exterior?.gateSteel || standard( { name: 'w1-marquee-steel', color: new Color( 0.13, 0.035, 0.03 ), roughness: 0.55, metalness: 0.4 } ), 'w1-marquee-steel', true ],
		[ granite, standard( { name: 'w1-marquee-base', color: new Color( 0.3, 0.14, 0.11 ), roughness: 0.3 } ), 'w1-marquee-base', true ],
		[ green, standard( { name: 'w1-marquee-box', color: new Color( 0.02, 0.1, 0.06 ), roughness: 0.4 } ), 'w1-marquee-box', false ],
		[ led, ledMat, 'w1-marquee-led', false ], [ neon, neonMat, 'w1-marquee-neon', false ],
	];
	for ( const [ m, mat, name, cast ] of mats ) {

		if ( ! m.count ) continue;
		mat.underwaterLighting = 'none';
		const mesh = new Mesh( m.geometry(), mat );
		mesh.name = name;
		mesh.castShadow = cast;
		mesh.receiveShadow = true;
		group.add( mesh );

	}

	return {
		obstacles: [ ...binAt.map( ( [ x, z ] ) => [ x, z, 0.5 ] ), [ mq[ 0 ], mq[ 1 ], 1.8 ], [ - 110.6, 96.4, 0.6 ] ],
		// the board's message: which row, by the night and the moment
		update( w, t ) {

			let rows;
			if ( w.celebrate ) rows = [ 7, 4 ];
			else if ( w.first ) rows = [ 0, 1, 2, 3, 4, 5 ];
			else rows = [ 0, 6, 3, 4, 5 ];
			ledMat.uniforms.msg.value = rows[ Math.floor( t / 3.5 ) % rows.length ];

		},
	};

}
