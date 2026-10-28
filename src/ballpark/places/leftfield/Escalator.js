import { Mesh, Color } from '../../../engine/index.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { Quads } from '../../Stands.js';
import { canvasTexture } from '../../geo.js';
import { LEVELS } from '../../layout.js';
import { obox, pipe } from '../../ConcourseSteel.js';

// FW3 (CI-10, CI-12, gauntlet r2): the Left Field escalator and its corner of the plaza. The 2008 guide:
// "Left Field (behind Section 140) - Takes guests to the Arcade seating area and the West Hall of Fame Club
// Entrance. A second escalator takes guests from this area to the Terrace Level"; signs all round the
// concourse pointed to ESCALATOR and none was built. As mostlyphilliespics photographed it in September
// 2009 (unchanged since 2004) and a fan in August 2008 (the Schmitter's line beside it): a long escalator
// clad in brushed stainless, black handrails over solid stainless balustrades, under a pale green
// standing-seam canopy on maroon posts the whole way up, its sign at the foot (ESCALATOR TO ARCADE SEATING /
// PARTY SUITES / HALL OF FAME CLUB / TERRACE & TERRACE DECK SUITES), queue rails with red belts at the
// foot; at the top a steel landing and a bridge to the Arcade's walkway; on the plaza round it the white
// bell lamps on their posts, red bins, a program kiosk and two carts under red umbrellas.
//
//   buildEscalator( group, { foot: [ x, z ], top: [ x, z ], y0, y1 } ) -> { steps, path, meshes }
// Field frame. The steps move (the shader); riders are the caller's (path: foot and top, 3D).

const PAL = {
	steel: [ [ 0.62, 0.63, 0.64 ], 0.32, 0.9 ], black: [ [ 0.02, 0.02, 0.022 ], 0.45, 0 ], canopy: [ [ 0.47, 0.6, 0.53 ], 0.45, 0.35 ],
	maroon: [ [ 0.2, 0.028, 0.032 ], 0.6, 0 ], galv: [ [ 0.42, 0.43, 0.44 ], 0.45, 0.55 ], red: [ [ 0.45, 0.02, 0.03 ], 0.45, 0 ],
	white: [ [ 0.78, 0.77, 0.73 ], 0.5, 0 ], lamp: [ [ 0.9, 0.88, 0.8 ], 0.4, 0, [ 2.4, 2.1, 1.6 ] ], navy: [ [ 0.02, 0.04, 0.16 ], 0.5, 0 ],
	rubber: [ [ 0.03, 0.03, 0.03 ], 0.7, 0 ], plate: [ [ 0.32, 0.33, 0.34 ], 0.4, 0.8 ], yellow: [ [ 0.7, 0.55, 0.05 ], 0.5, 0 ],
};
const KEYS = Object.keys( PAL );
const f3 = ( c ) => `vec3f( ${ c.map( ( v ) => v.toFixed( 3 ) ).join( ', ' ) } )`;
const PAL_WGSL = /* wgsl */`
	var alb = array<vec3f, ${ KEYS.length }>( ${ KEYS.map( ( k ) => f3( PAL[ k ][ 0 ] ) ).join( ', ' ) } );
	var rm = array<vec2f, ${ KEYS.length }>( ${ KEYS.map( ( k ) => `vec2f( ${ PAL[ k ][ 1 ].toFixed( 2 ) }, ${ PAL[ k ][ 2 ].toFixed( 2 ) } )` ).join( ', ' ) } );
	var glo = array<vec3f, ${ KEYS.length }>( ${ KEYS.map( ( k ) => f3( PAL[ k ][ 3 ] || [ 0, 0, 0 ] ) ).join( ', ' ) } );
	let k = min( u32( max( in.uv.x, 0.0 ) ), ${ KEYS.length - 1 }u );
	s.albedo = alb[ k ];
	s.roughness = rm[ k ].x;
	s.metalness = rm[ k ].y;
	s.emissive = glo[ k ] * mix( 0.4, 1.6, smoothstep( 0.1, 0.7, frame.night ) );
	// the canopy's standing seams every 0.45 m (its uv.y runs across it)
	if ( k == 2u ) { s.albedo *= 0.85 + 0.15 * smoothstep( 0.42, 0.5, abs( fract( in.uv.y / 0.45 ) - 0.5 ) ); }
	// the stainless: brushed, a long sheen
	if ( k == 0u ) { s.albedo *= 0.9 + 0.1 * mx_noise_float2( in.P.xz * vec2f( 0.5, 40.0 ) ); }
`;

class Pal extends Quads {

	constructor() {

		super();
		this.k = 0;

	}

	use( name ) {

		this.k = KEYS.indexOf( name );
		return this;

	}

	add( a, b, c, d, n, v0 = 0, v1 = 0 ) {

		this.tri( a, b, c, n, [ this.k + 0.5, v0 ], [ this.k + 0.5, v0 ], [ this.k + 0.5, v1 ] );
		this.tri( a, c, d, n, [ this.k + 0.5, v0 ], [ this.k + 0.5, v1 ], [ this.k + 0.5, v1 ] );

	}

	tri( a, b, c, n, ua = [ this.k + 0.5, 0 ], ub = [ this.k + 0.5, 0 ], uc = [ this.k + 0.5, 0 ] ) {

		super.tri( a, b, c, n, ua, ub, uc );

	}

}

function signTexture() {

	return canvasTexture( 512, 384, ( ctx, W, H ) => {

		ctx.fillStyle = '#f2f1ec';
		ctx.fillRect( 0, 0, W, H );
		ctx.strokeStyle = '#14254f';
		ctx.lineWidth = 10;
		ctx.strokeRect( 8, 8, W - 16, H - 16 );
		ctx.fillStyle = '#14254f';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = '700 46px "Helvetica Neue", Helvetica, Arial, sans-serif';
		ctx.fillText( 'ESCALATOR TO', W / 2, 62 );
		ctx.fillStyle = '#9e1b22';
		ctx.fillRect( 60, 96, W - 120, 4 );
		ctx.fillStyle = '#14254f';
		ctx.font = '700 34px "Helvetica Neue", Helvetica, Arial, sans-serif';
		[ 'ARCADE SEATING', 'PARTY SUITES', 'HALL OF FAME CLUB', 'TERRACE & TERRACE DECK SUITES' ].forEach( ( t, i ) => ctx.fillText( t, W / 2, 140 + i * 58, W - 50 ) );

	}, 'lfEscalatorSign' );

}

export function buildEscalator( group, { foot, top, y0 = LEVELS.mainConcourse, y1 = LEVELS.mainConcourse + 9.1, land = null } ) {

	const q = new Pal(), steps = new Quads(), sign = new Quads();
	const dx = top[ 0 ] - foot[ 0 ], dz = top[ 1 ] - foot[ 1 ], L = Math.hypot( dx, dz );
	const u = [ dx / L, dz / L ], w = [ - u[ 1 ], u[ 0 ] ];
	const FLAT = 2.2, HW = 0.82, rise = y1 - y0;
	// along the run (s from the foot's comb, metres horizontally), across (t), up from the floor at s
	const yAt = ( s ) => y0 + Math.max( 0, Math.min( rise, ( s / L ) * rise ) );
	const P = ( s, t, h ) => [ foot[ 0 ] + u[ 0 ] * s + w[ 0 ] * t, yAt( s ) + h, foot[ 1 ] + u[ 1 ] * s + w[ 1 ] * t ];
	const up = [ 0, 1, 0 ], slopeN = [ - u[ 0 ] * rise / L, 1, - u[ 1 ] * rise / L ];
	const S = [ - FLAT, 0, L, L + FLAT ];
	// the step band, flat at both ends, rising between (its own material: the steps move)
	let v = 0;
	for ( let i = 0; i < 3; i ++ ) {

		const a = S[ i ], b = S[ i + 1 ];
		const n = i === 1 ? slopeN : up;
		const seg = Math.hypot( b - a, yAt( b ) - yAt( a ) );
		steps.tri( P( a, - HW + 0.12, 0.05 ), P( a, HW - 0.12, 0.05 ), P( b, HW - 0.12, 0.05 ), n, [ - HW + 0.12, v ], [ HW - 0.12, v ], [ HW - 0.12, v + seg ] );
		steps.tri( P( a, - HW + 0.12, 0.05 ), P( b, HW - 0.12, 0.05 ), P( b, - HW + 0.12, 0.05 ), n, [ - HW + 0.12, v ], [ HW - 0.12, v + seg ], [ - HW + 0.12, v + seg ] );
		v += seg;

	}

	// the truss, clad: its sides from under the steps to the balustrade's top, the underside, the ends
	for ( let i = 0; i < 3; i ++ ) {

		const a = S[ i ], b = S[ i + 1 ];
		for ( const e of [ - 1, 1 ] ) {

			const t = e * HW;
			q.use( 'steel' ).add( P( a, t, - ( i === 1 ? 1.1 : 0.0 ) ), P( b, t, - ( i === 1 ? 1.1 : 0.0 ) ), P( b, t, 1.0 ), P( a, t, 1.0 ), [ w[ 0 ] * e, 0, w[ 1 ] * e ] );
			// the inner face of the balustrade, the deck along its foot, the handrail on it
			q.use( 'steel' ).add( P( a, t - e * 0.1, 0.05 ), P( b, t - e * 0.1, 0.05 ), P( b, t - e * 0.1, 0.92 ), P( a, t - e * 0.1, 0.92 ), [ - w[ 0 ] * e, 0, - w[ 1 ] * e ] );
			q.use( 'black' ).add( P( a, t - e * 0.13, 0.05 ), P( b, t - e * 0.13, 0.05 ), P( b, t - e * 0.13, 0.12 ), P( a, t - e * 0.13, 0.12 ), [ - w[ 0 ] * e, 0, - w[ 1 ] * e ] );
			q.use( 'rubber' );
			pipe( q, P( a, t - e * 0.05, 1.0 ), P( b, t - e * 0.05, 1.0 ), 0.045, 6 );
			// the top of the balustrade
			q.use( 'steel' ).add( P( a, t, 1.0 ), P( b, t, 1.0 ), P( b, t - e * 0.1, 0.92 ), P( a, t - e * 0.1, 0.92 ), up );

		}

		if ( i === 1 ) q.use( 'steel' ).add( P( a, - HW, - 1.1 ), P( b, - HW, - 1.1 ), P( b, HW, - 1.1 ), P( a, HW, - 1.1 ), [ 0, - 1, 0 ] );

	}

	// the comb plates at both ends, the newels' rounded ends (a box), the floor plate in front
	for ( const s of [ - FLAT, L + FLAT ] ) {

		const e = s < 0 ? - 1 : 1;
		q.use( 'plate' ).add( P( s, - HW, 0.02 ), P( s, HW, 0.02 ), P( s + e * 1.2, HW, 0.02 ), P( s + e * 1.2, - HW, 0.02 ), up );
		for ( const t of [ - HW + 0.05, HW - 0.05 ] ) {

			q.use( 'steel' );
			obox( q, P( s - e * 0.15, t, 0.5 ), [ u[ 0 ], 0, u[ 1 ] ], 0.3, up, 1.0, [ w[ 0 ], 0, w[ 1 ] ], 0.12 );
			q.use( 'rubber' );
			obox( q, P( s - e * 0.15, t, 1.0 ), [ u[ 0 ], 0, u[ 1 ] ], 0.32, up, 0.08, [ w[ 0 ], 0, w[ 1 ] ], 0.1 );

		}

		q.use( 'yellow' ).add( P( s - e * 0.02, - HW + 0.12, 0.06 ), P( s - e * 0.02, HW - 0.12, 0.06 ), P( s - e * 0.12, HW - 0.12, 0.06 ), P( s - e * 0.12, - HW + 0.12, 0.06 ), up );

	}

	// the canopy: a shallow gable on maroon posts every ~3.5 m both sides, 2.7 m over the steps, running
	// from the foot's flat to the top
	const CW = 1.55, HC = 2.75;
	const cs = [];
	for ( let s = - FLAT - 0.6; s <= L + FLAT + 0.6 + 1e-3; s += ( L + 2 * FLAT + 1.2 ) / 7 ) cs.push( s );
	for ( let i = 0; i < cs.length - 1; i ++ ) {

		const a = cs[ i ], b = cs[ i + 1 ];
		for ( const e of [ - 1, 1 ] ) {

			const n = [ w[ 0 ] * e * 0.3, 1, w[ 1 ] * e * 0.3 ];
			q.use( 'canopy' ).add( P( a, 0, HC + 0.35 ), P( b, 0, HC + 0.35 ), P( b, e * CW, HC ), P( a, e * CW, HC ), n, 0, CW );
			q.use( 'canopy' ).add( P( a, e * CW, HC - 0.04 ), P( b, e * CW, HC - 0.04 ), P( b, 0, HC + 0.31 ), P( a, 0, HC + 0.31 ), [ - n[ 0 ], - 1, - n[ 2 ] ], 0, CW );
			// the fascia along its edge
			q.use( 'canopy' ).add( P( a, e * CW, HC - 0.18 ), P( b, e * CW, HC - 0.18 ), P( b, e * CW, HC ), P( a, e * CW, HC ), [ w[ 0 ] * e, 0, w[ 1 ] * e ] );

		}

	}

	for ( const s of cs ) for ( const e of [ - 1, 1 ] ) {

		q.use( 'maroon' );
		obox( q, P( s, e * ( CW - 0.1 ), ( HC - 0.1 ) / 2 - ( s > 0 && s < L ? 1.1 : 0 ) * 0.5 ), [ u[ 0 ], 0, u[ 1 ] ], 0.14, up, HC - 0.1 + ( s > 0 && s < L ? 1.1 : 0 ), [ w[ 0 ], 0, w[ 1 ] ], 0.14 );
		q.use( 'maroon' );
		obox( q, P( s, 0, HC - 0.06 ), [ u[ 0 ], 0, u[ 1 ] ], 0.1, up, 0.12, [ w[ 0 ], 0, w[ 1 ] ], 2 * CW );

	}

	// the sign on the canopy's foot end, facing the plaza
	{

		const s = - FLAT - 0.62, yb = yAt( 0 ) + HC - 1.05, yt = yb + 0.95, hw = 0.72;
		const a = P( s, - hw, 0 ), b = P( s, hw, 0 );
		const n = [ - u[ 0 ], 0, - u[ 1 ] ];
		// (read from the plaza, looking up the run: the reader's right is +w)
		sign.tri( [ a[ 0 ], yb, a[ 2 ] ], [ b[ 0 ], yb, b[ 2 ] ], [ b[ 0 ], yt, b[ 2 ] ], n, [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] );
		sign.tri( [ a[ 0 ], yb, a[ 2 ] ], [ b[ 0 ], yt, b[ 2 ] ], [ a[ 0 ], yt, a[ 2 ] ], n, [ 0, 1 ], [ 1, 0 ], [ 0, 0 ] );
		q.use( 'navy' );
		obox( q, [ ( a[ 0 ] + b[ 0 ] ) / 2 + u[ 0 ] * 0.03, ( yb + yt ) / 2, ( a[ 2 ] + b[ 2 ] ) / 2 + u[ 1 ] * 0.03 ], [ w[ 0 ], 0, w[ 1 ] ], 2 * hw + 0.08, up, 1.03, [ u[ 0 ], 0, u[ 1 ] ], 0.04 );

	}

	// the queue rails at the foot: stanchions, red belts, a lane each side of the newels' mouth
	for ( const t of [ - 1.25, 1.25 ] ) {

		let prev = null;
		for ( let s = - FLAT - 1.2; s >= - FLAT - 6; s -= 1.6 ) {

			const p = P( s, t, 0 );
			q.use( 'black' );
			pipe( q, p, [ p[ 0 ], p[ 1 ] + 0.95, p[ 2 ] ], 0.025, 5 );
			obox( q, [ p[ 0 ], p[ 1 ] + 0.015, p[ 2 ] ], [ 1, 0, 0 ], 0.3, up, 0.03, [ 0, 0, 1 ], 0.3 );
			if ( prev ) q.use( 'red' ).add( [ prev[ 0 ], prev[ 1 ] + 0.84, prev[ 2 ] ], [ p[ 0 ], p[ 1 ] + 0.84, p[ 2 ] ], [ p[ 0 ], p[ 1 ] + 0.9, p[ 2 ] ], [ prev[ 0 ], prev[ 1 ] + 0.9, prev[ 2 ] ], [ w[ 0 ], 0, w[ 1 ] ] );
			prev = p;

		}

	}

	// the landing at the top and the bridge on to the Arcade's walkway: a steel deck on a maroon girder, a
	// galvanized pipe rail both sides
	if ( land ) {

		const a = P( L + FLAT + 1.0, 0, 0 ), b = [ land[ 0 ], y1, land[ 1 ] ];
		const bx = b[ 0 ] - a[ 0 ], bz = b[ 2 ] - a[ 2 ], bl = Math.hypot( bx, bz ), bu = [ bx / bl, bz / bl ], bw = [ - bu[ 1 ], bu[ 0 ] ];
		const B = ( s, t, h ) => [ a[ 0 ] + bu[ 0 ] * s + bw[ 0 ] * t, y1 + h, a[ 2 ] + bu[ 1 ] * s + bw[ 1 ] * t ];
		const BW = 1.6;
		q.use( 'galv' ).add( B( - 1.2, - BW, 0 ), B( bl, - BW, 0 ), B( bl, BW, 0 ), B( - 1.2, BW, 0 ), up );
		q.use( 'maroon' ).add( B( - 1.2, - BW, - 0.7 ), B( bl, - BW, - 0.7 ), B( bl, BW, - 0.7 ), B( - 1.2, BW, - 0.7 ), [ 0, - 1, 0 ] );
		for ( const e of [ - 1, 1 ] ) {

			q.use( 'maroon' ).add( B( - 1.2, e * BW, - 0.7 ), B( bl, e * BW, - 0.7 ), B( bl, e * BW, 0 ), B( - 1.2, e * BW, 0 ), [ bw[ 0 ] * e, 0, bw[ 1 ] * e ] );
			q.use( 'galv' );
			pipe( q, B( - 1.2, e * ( BW - 0.05 ), 1.07 ), B( bl, e * ( BW - 0.05 ), 1.07 ), 0.03, 6 );
			pipe( q, B( - 1.2, e * ( BW - 0.05 ), 0.55 ), B( bl, e * ( BW - 0.05 ), 0.55 ), 0.02, 5 );
			for ( let s = - 1.2; s <= bl + 1e-3; s += Math.max( 1, ( bl + 1.2 ) / Math.ceil( ( bl + 1.2 ) / 1.8 ) ) ) pipe( q, B( s, e * ( BW - 0.05 ), 0 ), B( s, e * ( BW - 0.05 ), 1.07 ), 0.022, 4 );

		}

		// its posts down to the plaza
		for ( const s of [ 0, bl * 0.5 ] ) {

			const p = B( s, 0, - 0.7 );
			q.use( 'maroon' );
			obox( q, [ p[ 0 ], ( y0 + p[ 1 ] ) / 2, p[ 2 ] ], [ bu[ 0 ], 0, bu[ 1 ] ], 0.36, up, p[ 1 ] - y0, [ bw[ 0 ], 0, bw[ 1 ] ], 0.36 );

		}

	}

	// the meshes: the palette, the moving steps, the sign
	const mat = standard( { name: 'lf-escalator', roughness: 0.5, side: 'double', modules: [ commonModule ], surface: PAL_WGSL } );
	const stepMat = standard( { name: 'lf-escalator-steps', color: new Color( 0.12, 0.12, 0.13 ), roughness: 0.45, metalness: 0.6, modules: [ commonModule ],
		surface: /* wgsl */`
	// uv: x across (m), y along the band (m). The steps climb at half a metre a second: each 0.4 m deep, its
	// cleats in fine ribs along the run, a yellow line at its back edge and its sides
	let fw = fwidth( in.uv.y ) + 0.001;
	let along = in.uv.y - frame.time * 0.5;
	let st = fract( along / 0.4 );
	let edge = 1.0 - smoothstep( 0.0, 0.03 + fw * 2.5, min( st, 1.0 - st ) * 0.4 );
	let rib = 0.75 + 0.25 * smoothstep( 0.3, 0.5, abs( fract( in.uv.x / 0.012 ) - 0.5 ) ) * ( 1.0 - clamp( fwidth( in.uv.x ) / 0.012, 0.0, 1.0 ) );
	let side = smoothstep( 0.62, 0.66, abs( in.uv.x ) );
	s.albedo = mix( vec3f( 0.11, 0.11, 0.115 ) * rib, vec3f( 0.6, 0.48, 0.05 ), max( side, step( 0.92, st ) ) * 0.9 );
	s.albedo *= 1.0 - 0.6 * edge * ( 1.0 - side );
` } );
	const signMat = standard( { name: 'lf-escalator-sign', roughness: 0.5, textures: { lfEsc: signTexture() },
		surface: 'let t = textureSample( lfEsc, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.85; s.emissive = t * 0.12 * smoothstep( 0.1, 0.7, frame.night );' } );
	const meshes = [];
	for ( const [ g, m, name ] of [ [ q, mat, 'lf-escalator' ], [ steps, stepMat, 'lf-escalator-steps' ], [ sign, signMat, 'lf-escalator-sign' ] ] ) {

		m.underwaterLighting = 'none';
		const mesh = new Mesh( g.geometry(), m );
		mesh.name = name;
		mesh.castShadow = m === mat;
		mesh.receiveShadow = true;
		// (the steps move: kept out of the static batching like the rest, which doesn't need it)
		group.add( mesh );
		meshes.push( mesh );

	}

	return { meshes, path: [ P( - FLAT, 0, 0.05 ), P( 0, 0, 0.05 ), P( L, 0, 0.05 ), P( L + FLAT, 0, 0.05 ) ], u, w, L, rise };

}

// The plaza's fittings round the escalator's foot (as the 2009 photo has them): the white bell lamps on
// their posts, red bins, a program kiosk in the Series' navy, two carts under red umbrellas; into the
// escalator's palette quads. at( a, b ): a point a metres along the run from its foot, b across.
export function plazaFittings( group, { at, y = LEVELS.mainConcourse, lamps = [], bins = [], kiosk = null, carts = [] } ) {

	const q = new Pal(), up = [ 0, 1, 0 ];
	const out = { lights: [] };
	for ( const [ x, z ] of lamps ) {

		q.use( 'black' );
		pipe( q, [ x, y, z ], [ x, y + 3.9, z ], 0.06, 8 );
		obox( q, [ x, y + 0.25, z ], [ 1, 0, 0 ], 0.26, up, 0.5, [ 0, 0, 1 ], 0.26 );
		// the bell: a white shade over the lantern
		q.use( 'white' );
		for ( let i = 0; i < 10; i ++ ) {

			const a0 = i / 10 * Math.PI * 2, a1 = ( i + 1 ) / 10 * Math.PI * 2;
			const r0 = 0.48, r1 = 0.12;
			q.add( [ x + Math.cos( a0 ) * r0, y + 4.05, z + Math.sin( a0 ) * r0 ], [ x + Math.cos( a1 ) * r0, y + 4.05, z + Math.sin( a1 ) * r0 ], [ x + Math.cos( a1 ) * r1, y + 4.4, z + Math.sin( a1 ) * r1 ], [ x + Math.cos( a0 ) * r1, y + 4.4, z + Math.sin( a0 ) * r1 ], [ Math.cos( ( a0 + a1 ) / 2 ), 0.9, Math.sin( ( a0 + a1 ) / 2 ) ] );

		}

		q.use( 'lamp' );
		obox( q, [ x, y + 3.82, z ], [ 1, 0, 0 ], 0.24, up, 0.34, [ 0, 0, 1 ], 0.24 );
		out.lights.push( [ x, y + 3.8, z ] );

	}

	for ( const [ x, z ] of bins ) {

		q.use( 'red' );
		obox( q, [ x, y + 0.5, z ], [ 1, 0, 0 ], 0.55, up, 1.0, [ 0, 0, 1 ], 0.55 );
		q.use( 'black' );
		obox( q, [ x, y + 1.03, z ], [ 1, 0, 0 ], 0.6, up, 0.06, [ 0, 0, 1 ], 0.6 );

	}

	if ( kiosk ) {

		const [ x, z ] = kiosk;
		q.use( 'navy' );
		obox( q, [ x, y + 1.1, z ], [ 1, 0, 0 ], 2.2, up, 2.2, [ 0, 0, 1 ], 1.4 );
		q.use( 'white' );
		obox( q, [ x, y + 2.45, z ], [ 1, 0, 0 ], 2.4, up, 0.5, [ 0, 0, 1 ], 1.6 );
		q.use( 'red' );
		obox( q, [ x, y + 2.75, z ], [ 1, 0, 0 ], 2.5, up, 0.1, [ 0, 0, 1 ], 1.7 );

	}

	for ( const [ x, z ] of carts ) {

		q.use( 'steel' );
		obox( q, [ x, y + 0.5, z ], [ 1, 0, 0 ], 1.9, up, 0.9, [ 0, 0, 1 ], 1.0 );
		q.use( 'black' );
		pipe( q, [ x, y + 0.95, z ], [ x, y + 2.5, z ], 0.025, 5 );
		for ( let i = 0; i < 8; i ++ ) {

			const a0 = i / 8 * Math.PI * 2, a1 = ( i + 1 ) / 8 * Math.PI * 2;
			q.use( i % 2 ? 'white' : 'red' );
			q.tri( [ x, y + 2.75, z ], [ x + Math.cos( a0 ) * 1.3, y + 2.3, z + Math.sin( a0 ) * 1.3 ], [ x + Math.cos( a1 ) * 1.3, y + 2.3, z + Math.sin( a1 ) * 1.3 ], [ 0, 1, 0 ] );

		}

	}

	void at;
	const mat = standard( { name: 'lf-plaza-fittings', roughness: 0.5, side: 'double', modules: [ commonModule ], surface: PAL_WGSL } );
	mat.underwaterLighting = 'none';
	const mesh = new Mesh( q.geometry(), mat );
	mesh.name = 'lf-plaza-fittings';
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	group.add( mesh );
	return out;

}
