import { Mesh, Color, Vector3 } from '../../../engine/index.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';
import { LEVELS } from '../../layout.js';
import { Mesher } from './Mesher.js';

// FW2 (C2I-4, gauntlet r2): the World Series marquees. In October 2008 big white frame tents stood on
// the plazas and along the lots' Pattison sides on both nights: merchandise, hospitality, the sponsors,
// a Series mark printed on their roofs. On the 27th at 18:55 two of them fill the foreground in front of
// a gate's light towers, their roofs glowing from inside with the print in silhouette (7630606N06
// 2987956027); on the 29th at 18:51 a row of them lines the plaza and the lot's edge, the waiting crowd
// between (7630606N06 2988814584); inside one, racks of jackets under a white tent roof (Getty 83433586,
// Game 3). Here: a 6 x 12 m tent on the Third Base plaza off the walk to the gate, two along the 3B lot's
// Pattison side, two in the strip behind Lot K's fence. White vinyl on an aluminium frame: a gabled
// roof, a scalloped valance all round, walls on three sides and the fourth open to the walk; racks or
// tables inside; lit warm after dark, so the fabric glows (one lamp each among the local lights). The
// roof's print is an invented mark (WORLD SERIES and 2008 under stars in navy and red), not MLB's logo.
// Field frame; at: the middle, len along the ridge, wid across it, ang the ridge's heading, open the
// open long side (+1 / -1 across), kind: racks ('shop') or tables ('hospitality').

const STREET = LEVELS.mainConcourse;

export const TENTS = [
	{ at: [ - 115, 35 ], len: 12, wid: 6, ang: Math.PI / 2, open: - 1, kind: 'shop', y: STREET + 0.15 },
	{ at: [ - 62, 140 ], len: 15, wid: 10, ang: 0, open: - 1, kind: 'hospitality', y: STREET + 0.03 },
	{ at: [ - 35, 139 ], len: 12, wid: 6, ang: 0, open: - 1, kind: 'shop', y: STREET + 0.03 },
	{ at: [ 64, 140 ], len: 12, wid: 6, ang: 0, open: - 1, kind: 'shop', y: STREET + 0.03 },
	{ at: [ 150, 140 ], len: 15, wid: 10, ang: 0, open: - 1, kind: 'hospitality', y: STREET + 0.03 },
];

// where nobody parks, and the walkers keep out ( x, z, r )
export const TENT_CLEAR = TENTS.map( ( t ) => [ t.at[ 0 ], t.at[ 1 ], Math.hypot( t.len, t.wid ) / 2 + 1.5 ] );

let _mats = null;

function materials() {

	if ( _mats ) return _mats;
	// the roof's print: white vinyl, the mark in the middle of each slope
	const print = canvasTexture( 1024, 512, ( ctx, W, H ) => {

		ctx.fillStyle = '#f4f3ef';
		ctx.fillRect( 0, 0, W, H );
		// the seams of the vinyl panels
		ctx.fillStyle = 'rgba( 0, 0, 0, 0.06 )';
		for ( let x = 0; x < W; x += W / 5 ) ctx.fillRect( x, 0, 3, H );
		const cx = W / 2, cy = H * 0.52;
		ctx.fillStyle = '#14254f';
		ctx.beginPath();
		ctx.roundRect( cx - 330, cy - 120, 660, 240, 40 );
		ctx.fill();
		ctx.strokeStyle = '#c8102e';
		ctx.lineWidth = 12;
		ctx.stroke();
		ctx.fillStyle = '#ffffff';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = '700 70px Georgia, "Times New Roman", serif';
		ctx.fillText( 'WORLD SERIES', cx, cy - 34, 600 );
		ctx.fillStyle = '#e8263c';
		ctx.font = '800 78px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( '2008', cx, cy + 58 );
		// stars either side of the year
		const star = ( x, y, r ) => {

			ctx.beginPath();
			for ( let k = 0; k < 10; k ++ ) {

				const a = - Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r;
				ctx.lineTo( x + Math.cos( a ) * rr, y + Math.sin( a ) * rr );

			}

			ctx.closePath();
			ctx.fill();

		};

		ctx.fillStyle = '#ffffff';
		for ( const s of [ - 1, 1 ] ) for ( let k = 0; k < 2; k ++ ) star( cx + s * ( 150 + k * 70 ), cy + 56, 22 );

	}, 'tent-print' );
	const night = 'smoothstep( 0.1, 0.7, frame.night )';
	// the vinyl: white, a little translucent: lit from inside after dark it glows, the print dark on it
	const roof = standard( {
		name: 'tent-roof', roughness: 0.45, side: 'double', textures: { tentPrint: print }, modules: [ commonModule ],
		surface: /* wgsl */`
	let t = textureSample( tentPrint, smpAnisoClamp, in.uv ).rgb;
	// the panels sag a little between the rafters (every 3 m along the ridge)
	s.albedo = t * ( 0.92 + 0.08 * abs( sin( in.uv.x * 15.7 ) ) );
	s.emissive = t * vec3f( 1.0, 0.86, 0.66 ) * ${ night } * 0.55;
	s.roughness = mix( 0.45, 0.2, frame.wet );
` } );
	const wall = standard( {
		name: 'tent-walls', color: new Color( 0.86, 0.86, 0.84 ), roughness: 0.5, side: 'double', alphaTest: 0.5, modules: [ commonModule ],
		surface: /* wgsl */`
	// uv: x along (m), y: 0..1 a wall, 2..3 the valance (scalloped along its foot), 4..5 a wall with a
	// row of clear windows
	var c = mat.color;
	let y = in.uv.y;
	if ( y > 1.5 && y < 3.5 ) {
		let f = fract( in.uv.x / 0.75 ) - 0.5;
		let edge = 2.0 + 0.16 * ( 1.0 - 4.0 * f * f );
		if ( y < edge ) { discard; }
		// a red band along the valance's hem
		if ( y < edge + 0.12 ) { c = vec3f( 0.42, 0.02, 0.03 ); }
	}
	// the panels between the legs (every 3 m) fall a shade darker toward their seams
	c = c * ( 0.86 + 0.14 * sin( fract( in.uv.x / 3.0 ) * 3.1416 ) );
	var glow = 0.28;
	if ( y > 3.5 ) {
		let wy = y - 4.0;
		let win = step( 0.55, wy ) * step( wy, 0.8 ) * step( 0.12, abs( fract( in.uv.x / 2.0 ) - 0.5 ) );
		c = mix( c, vec3f( 0.05, 0.06, 0.07 ), win * 0.85 );
		glow = mix( 0.28, 1.6, win );
	}
	s.albedo = c;
	s.emissive = c * vec3f( 1.0, 0.86, 0.66 ) * ${ night } * glow + vec3f( 1.0, 0.82, 0.6 ) * ${ night } * select( 0.0, 0.25, y > 3.5 && glow > 1.0 );
	s.roughness = mix( 0.5, 0.25, frame.wet );
` } );
	const frameM = standard( { name: 'tent-frame', color: new Color( 0.62, 0.63, 0.64 ), roughness: 0.35, metalness: 0.8 } );
	// inside: uv.x picks the part (0 cloth, 1 chrome, 2 jackets, 3 dark, 4 a lamp)
	const kit = standard( {
		name: 'tent-kit', roughness: 0.6, modules: [ commonModule ],
		surface: /* wgsl */`
	let part = i32( floor( in.uv.x ) );
	var c = vec3f( 0.8, 0.8, 0.78 ); var rough = 0.8; var metal = 0.0; var e = vec3f( 0.0 );
	switch part {
		case 1: { c = vec3f( 0.6 ); rough = 0.2; metal = 0.9; }
		case 2: {
			// a rack's worth of jackets: mostly red, some navy and white, shoulder to shoulder
			let k = floor( in.P.x * 6.0 + in.P.z * 6.0 );
			let h = fract( sin( k * 12.9898 ) * 43758.5453 );
			c = select( select( vec3f( 0.42, 0.02, 0.03 ), vec3f( 0.02, 0.03, 0.1 ), h > 0.7 ), vec3f( 0.75, 0.74, 0.7 ), h > 0.9 );
			c = c * ( 0.75 + 0.25 * abs( sin( ( in.P.x + in.P.z ) * 40.0 ) ) );
		}
		case 3: { c = vec3f( 0.03 ); rough = 0.5; }
		case 4: { c = vec3f( 1.0 ); e = vec3f( 1.0, 0.85, 0.62 ) * mix( 0.5, 6.0, ${ night } ); }
		default: {}
	}
	s.albedo = c;
	s.roughness = rough;
	s.metalness = metal;
	s.emissive = e;
` } );
	for ( const m of [ roof, wall, frameM, kit ] ) m.underwaterLighting = 'none';
	_mats = { roof, wall, frame: frameM, kit };
	return _mats;

}

// the tents into `group` (field frame); colliders (the walker), field (to the world). Returns their
// lamps ( field [ x, y, z ] ) for the local lights
export function buildTents( { group, colliders = null, field = null, cast = null } ) { // ---- FW3: cast (C2I-4)

	const M = materials();
	const roof = new Mesher(), wall = new Mesher(), fr = new Mesher(), kit = new Mesher();
	const lamps = [];
	for ( const T of TENTS ) {

		const { len, wid, open } = T, y0 = T.y;
		const ux = Math.cos( T.ang ), uz = Math.sin( T.ang ), wx = - uz, wz = ux;
		const P = ( a, y, b ) => [ T.at[ 0 ] + ux * a + wx * b, y0 + y, T.at[ 1 ] + uz * a + wz * b ];
		const He = 2.5, Hr = He + wid * 0.3, hl = len / 2, hw = wid / 2;
		const U = [ ux, 0, uz ], Wn = [ wx, 0, wz ];
		// the roof: two slopes, the print on each
		for ( const s of [ - 1, 1 ] ) {

			const n = [ wx * s * 0.6, 1, wz * s * 0.6 ];
			roof.face( P( - hl - 0.2, He - 0.05, s * ( hw + 0.2 ) ), P( hl + 0.2, He - 0.05, s * ( hw + 0.2 ) ), P( hl + 0.2, Hr, 0 ), P( - hl - 0.2, Hr, 0 ), n, s > 0 ? [ [ 0, 1 ], [ 1, 1 ], [ 1, 0 ], [ 0, 0 ] ] : [ [ 1, 1 ], [ 0, 1 ], [ 0, 0 ], [ 1, 0 ] ] );

		}

		// the gable ends (plain vinyl: the print's margin)
		for ( const e of [ - 1, 1 ] ) {

			const a = e * ( hl + 0.2 );
			const A = roof.v( P( a, He - 0.05, - hw - 0.2 ), [ ux * e, 0, uz * e ], [ 0.02, 0.98 ] ), B = roof.v( P( a, He - 0.05, hw + 0.2 ), [ ux * e, 0, uz * e ], [ 0.04, 0.98 ] ), C = roof.v( P( a, Hr, 0 ), [ ux * e, 0, uz * e ], [ 0.03, 0.9 ] );
			roof.tri( A, B, C );

		}

		// the valance all round under the eave, scalloped
		const val = ( a0, b0, a1, b1, n ) => {

			const L = Math.hypot( a1 - a0, b1 - b0 );
			wall.face( P( a0, He - 0.45, b0 ), P( a1, He - 0.45, b1 ), P( a1, He - 0.05, b1 ), P( a0, He - 0.05, b0 ), n, [ [ 0, 2 ], [ L, 2 ], [ L, 3 ], [ 0, 3 ] ] );

		};
		const H2 = hw + 0.2, L2 = hl + 0.2;
		val( - L2, - H2, L2, - H2, Wn.map( ( v ) => - v ) );
		val( - L2, H2, L2, H2, Wn );
		val( - L2, - H2, - L2, H2, U.map( ( v ) => - v ) );
		val( L2, - H2, L2, H2, U );
		// the walls: the back long side (windows in it) and both ends; the front open
		const back = - open;
		wall.face( P( - hl, 0, back * hw ), P( hl, 0, back * hw ), P( hl, He - 0.45, back * hw ), P( - hl, He - 0.45, back * hw ), Wn.map( ( v ) => v * back ), [ [ 0, 4 ], [ len, 4 ], [ len, 5 ], [ 0, 5 ] ] );
		for ( const e of [ - 1, 1 ] ) wall.face( P( e * hl, 0, - hw ), P( e * hl, 0, hw ), P( e * hl, He - 0.45, hw ), P( e * hl, He - 0.45, - hw ), U.map( ( v ) => v * e ), [ [ 0, 0 ], [ wid, 0 ], [ wid, 1 ], [ 0, 1 ] ] );
		// the kit's parts by uv.x (see the material)
		const kbox = ( c, sz, k ) => {

			const n0 = kit.count;
			kit.box( c, sz );
			for ( let i = n0; i < kit.count; i ++ ) {

				kit.uv[ i * 2 ] = k + 0.5;
				kit.uv[ i * 2 + 1 ] = 0.5;

			}

		};

		// the frame: legs every 3 m round the eaves, a rafter from each pair to the ridge, the ridge pole
		const nA = Math.max( 2, Math.round( len / 3 ) );
		for ( let k = 0; k <= nA; k ++ ) {

			const a = - hl + len * k / nA;
			for ( const s of [ - 1, 1 ] ) {

				fr.tube( [ P( a, - 0.1, s * hw ), P( a, He, s * hw ) ], [ 0.045, 0.045 ], 6 );
				fr.tube( [ P( a, He, s * hw ), P( a, Hr - 0.12, 0 ) ], [ 0.035, 0.035 ], 5 );
				// a ballast weight at each foot
				kbox( P( a, 0.12, s * hw ), [ 0.35, 0.24, 0.35 ], 3 );

			}

		}

		fr.tube( [ P( - hl, Hr - 0.12, 0 ), P( hl, Hr - 0.12, 0 ) ], [ 0.04, 0.04 ], 6 );
		for ( const s of [ - 1, 1 ] ) fr.tube( [ P( - hl, He, s * hw ), P( hl, He, s * hw ) ], [ 0.035, 0.035 ], 5 );
		// inside: racks of jackets or tables in white cloth, and two lamps under the ridge
		if ( T.kind === 'shop' ) {

			for ( let a = - hl + 2; a <= hl - 2; a += 2.5 ) for ( const b of [ - hw * 0.45, hw * 0.25 ] ) {

				const c = P( a, 0, b );
				kbox( [ c[ 0 ], c[ 1 ] + 1.55, c[ 2 ] ], [ Math.abs( ux ) * 1.8 + 0.05, 0.04, Math.abs( uz ) * 1.8 + 0.05 ], 1 );
				kbox( [ c[ 0 ], c[ 1 ] + 1.05, c[ 2 ] ], [ Math.abs( ux ) * 1.7 + Math.abs( wx ) * 0.5, 0.95, Math.abs( uz ) * 1.7 + Math.abs( wz ) * 0.5 ], 2 );
				for ( const e of [ - 0.9, 0.9 ] ) {

					const q = P( a + e, 0, b );
					kbox( [ q[ 0 ], q[ 1 ] + 0.8, q[ 2 ] ], [ 0.04, 1.6, 0.04 ], 1 );

				}

			}

			// the till at the back
			const t = P( 0, 0, back * ( hw - 1.0 ) );
			kbox( [ t[ 0 ], t[ 1 ] + 0.48, t[ 2 ] ], [ Math.abs( ux ) * 2.4 + Math.abs( wx ) * 0.7, 0.96, Math.abs( uz ) * 2.4 + Math.abs( wz ) * 0.7 ], 0 );

		} else {

			for ( let a = - hl + 2.2; a <= hl - 2; a += 3 ) for ( const b of [ - hw * 0.4, hw * 0.3 ] ) {

				const c = P( a, 0, b );
				kbox( [ c[ 0 ], c[ 1 ] + 0.55, c[ 2 ] ], [ 1.6, 1.1, 1.6 ], 0 );

			}

			// the bar along the back
			const t = P( 0, 0, back * ( hw - 1.0 ) );
			kbox( [ t[ 0 ], t[ 1 ] + 0.55, t[ 2 ] ], [ Math.abs( ux ) * ( len - 3 ) + Math.abs( wx ) * 0.8, 1.1, Math.abs( uz ) * ( len - 3 ) + Math.abs( wz ) * 0.8 ], 3 );

		}

		for ( const e of [ - 0.25, 0.25 ] ) {

			const l = P( e * len, Hr - 0.6, 0 );
			kbox( l, [ 0.3, 0.12, 0.3 ], 4 );
			lamps.push( l );

		}

		// ---- FW3 (C2I-4): the people in them (the plaza's Cast: gate3b/Cast.js's acts). In the shops (Getty
		// 83433586, Game 3: shoulder to shoulder at the racks under the tent roof) a clerk ringing up at the till
		// and one at the racks in the store's red, a buyer at the till, fans going through the jackets; in the
		// hospitality tents a bartender, the guests in knots round the tables with their drinks
		if ( cast ) {

			const at = ( a, b ) => {

				const p = P( a, 0, b );
				return [ p[ 0 ], p[ 2 ] ];

			};
			const lift = y0 - STREET - 0.15; // the Cast stands on the plaza's paving (its LIFT)
			const till = at( 0, back * ( hw - 0.45 ) ), front = at( 0, back * ( hw - 1.7 ) );
			if ( T.kind === 'shop' ) {

				cast.add( { at: till, face: front, act: 'sell', who: 'store', y: lift } );
				cast.add( { at: front, face: till, act: 'buy', y: lift, noRainGear: true } );
				cast.add( { at: at( hl * 0.55, back * ( hw - 0.6 ) ), face: at( hl * 0.55, 0 ), act: 'stand', who: 'store', y: lift } );
				let k = 0;
				for ( let a = - hl + 2; a <= hl - 2; a += 2.5 ) {

					if ( k ++ % 2 ) continue;
					// between the two rows of racks, looking at one
					const b = ( - hw * 0.45 + hw * 0.25 ) / 2;
					cast.add( { at: at( a + 0.3, b ), face: at( a + 0.3, k % 4 ? - hw * 0.45 : hw * 0.25 ), act: 'window', y: lift, noRainGear: true, when: ( w ) => ( w.k ?? 0.5 ) > 0.15 } );

				}

			} else {

				cast.add( { at: till, face: front, act: 'sell', who: 'store', y: lift } );
				for ( let a = - hl + 2.2; a <= hl - 2; a += 3 ) {

					const c = at( a, - hw * 0.4 );
					cast.group( c, 3, 1.25, { y: lift, noRainGear: true, acts: [ 'drink', 'talk', 'listen' ], when: ( w ) => ( w.k ?? 0.5 ) > 0.1 } );

				}

			}

		}
		// ---- end FW3

		// the walker can't walk through the walls
		if ( colliders && field ) {

			const yaw = field.group.rotation.y - T.ang;
			const wall2 = ( a, b, ha, hb ) => {

				const c = P( a, 0, b ), w = field.toWorld( c[ 0 ], c[ 2 ] );
				colliders.addBox( new Vector3( w.x, field.y0 + y0 + 1.2, w.z ), new Vector3( ha, 1.2, hb ), yaw, { tag: 'tent' } );

			};
			wall2( 0, back * hw, hl, 0.1 );
			for ( const e of [ - 1, 1 ] ) wall2( e * hl, 0, 0.1, hw );

		}

	}

	for ( const [ m, mat, name, cast ] of [ [ roof, M.roof, 'fw2-tent-roofs', true ], [ wall, M.wall, 'fw2-tent-walls', true ], [ fr, M.frame, 'fw2-tent-frames', false ], [ kit, M.kit, 'fw2-tent-kit', false ] ] ) {

		const mesh = new Mesh( m.geometry(), mat );
		mesh.name = name;
		mesh.castShadow = cast;
		mesh.receiveShadow = true;
		group.add( mesh );

	}

	return { lamps, clear: TENT_CLEAR };

}
