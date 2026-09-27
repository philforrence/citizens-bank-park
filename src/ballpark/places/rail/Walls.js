import { Mesh, BufferGeometry, Float32BufferAttribute, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture, beam } from '../../geo.js';
import { drawWorldSeriesLogo, mlbLogo } from '../../Details2008.js';
import { Quads } from '../../Stands.js';
import { FOUL_TERRITORY, FT } from '../../layout.js';

// The walls round the rail, as they were for the Series:
//   - past each photographers' well, two navy pads printed drugfree.org/playhealthy with MLB's logo
//     (MLB's anti-drug campaign of 2008: the Commons photo of the 29th shows two past the 3B well), then
//     a navy World Series 2008 panel toward the corner (the audit's HP10);
//   - the backstop net's support cables: from the top of the net back up to the suite level's front,
//     the part of the net the TV shows (heston 2987300364 / 2986440011).

function panelMaterial( draw, label ) {

	const tex = typeof OffscreenCanvas === 'undefined' ? null : canvasTexture( 1024, 208, draw, label );
	const m = standard( { name: 'rail-wall-panel', roughness: 0.6, color: new Color( 0.02, 0.025, 0.08 ), textures: tex ? { wpTex: tex } : {},
		surface: ( tex ? 's.albedo = textureSample( wpTex, smpAnisoClamp, in.uv ).rgb * 0.82;' : '' ) +
			// printed vinyl on the pads: the pads' seams show through, it darkens and shines in the rain
			' let seam = smoothstep( 0.0, 0.015, abs( fract( in.uv.x * 3.44 + 0.5 ) - 0.5 ) ); s.albedo = s.albedo * mix( 0.6, 1.0, seam ) * ( 1.0 - 0.2 * frame.wet ); s.roughness = mix( 0.6, 0.3, frame.wet ); s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.35;' } );
	m.underwaterLighting = 'none';
	return m;

}

const drugfree = ( ctx, w, h ) => {

	ctx.fillStyle = '#1c2452';
	ctx.fillRect( 0, 0, w, h );
	ctx.fillStyle = '#ffffff';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';
	ctx.font = `700 ${ Math.round( h * 0.42 ) }px "Helvetica Neue", Arial, sans-serif`;
	ctx.fillText( 'drugfree.org/playhealthy', w * 0.2, h * 0.52, w * 0.76 );
	mlbLogo( ctx, w * 0.035, h * 0.22, w * 0.12, h * 0.56 );

};

const worldSeries = ( ctx, w, h ) => {

	ctx.fillStyle = '#10275f';
	ctx.fillRect( 0, 0, w, h );
	ctx.save();
	ctx.translate( w * 0.3, h * 0.04 );
	drawWorldSeriesLogo( ctx, w * 0.4, h * 0.92, { clear: false } );
	ctx.restore();

};

// a panel on the wall's face between A and B ( field [ x, z ] on the wall line ), from y0 to y1, read
// left to right from the field
function panel( q, A, B, y0, y1 ) {

	const len = Math.hypot( B[ 0 ] - A[ 0 ], B[ 1 ] - A[ 1 ] );
	let n = [ - ( B[ 1 ] - A[ 1 ] ) / len, ( B[ 0 ] - A[ 0 ] ) / len ];
	const mx = ( A[ 0 ] + B[ 0 ] ) / 2, mz = ( A[ 1 ] + B[ 1 ] ) / 2;
	if ( n[ 0 ] * ( 0 - mx ) + n[ 1 ] * ( - 38.9 - mz ) < 0 ) n = [ - n[ 0 ], - n[ 1 ] ];
	// seen from the field (facing -n) the right hand is ( n.z, -n.x )
	const right = [ n[ 1 ], - n[ 0 ] ];
	const [ L, R ] = ( B[ 0 ] - A[ 0 ] ) * right[ 0 ] + ( B[ 1 ] - A[ 1 ] ) * right[ 1 ] > 0 ? [ A, B ] : [ B, A ];
	const o = 0.035;
	const P = ( p, y ) => [ p[ 0 ] + n[ 0 ] * o, y, p[ 1 ] + n[ 1 ] * o ];
	q.tri( P( L, y0 ), P( R, y0 ), P( R, y1 ), [ n[ 0 ], 0, n[ 1 ] ], [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] );
	q.tri( P( L, y0 ), P( R, y1 ), P( L, y1 ), [ n[ 0 ], 0, n[ 1 ] ], [ 0, 1 ], [ 1, 0 ], [ 0, 0 ] );

}

export function buildWalls( group, M ) {

	const F = FOUL_TERRITORY;
	const dq = new Quads(), wq = new Quads();
	for ( const [ a, b ] of [ [ F[ 4 ], F[ 3 ] ], [ F[ 9 ], F[ 10 ] ] ] ) {

		const len = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
		const at = ( s ) => [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * s / len, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * s / len ];
		panel( dq, at( 0.35 ), at( 4.75 ), 0.14, 1.06 );
		panel( dq, at( 4.95 ), at( 9.35 ), 0.14, 1.06 );
		panel( wq, at( 9.8 ), at( 14.3 ), 0.14, 1.06 );

	}

	for ( const [ q, mat ] of [ [ dq, panelMaterial( drugfree, 'wallDrugfree' ) ], [ wq, panelMaterial( worldSeries, 'wallWorldSeries' ) ] ] ) {

		const m = new Mesh( q.geometry(), mat );
		m.name = 'rail-wall-panels';
		m.receiveShadow = true;
		group.add( m );

	}

	// the net's support cables: from its top, back and up to the suite level's front
	const H = 30 * FT, back = 0.3;
	const run = F.slice( 5, 9 );
	const cq = new Quads();
	const cables = [ [ 0, 0.35 ], [ 1, 0.25 ], [ 1, 0.75 ], [ 2, 0.65 ] ];
	for ( const [ i, t ] of cables ) {

		const A = run[ i ], B = run[ i + 1 ];
		const len = Math.hypot( B[ 0 ] - A[ 0 ], B[ 1 ] - A[ 1 ] );
		let n = [ - ( B[ 1 ] - A[ 1 ] ) / len, ( B[ 0 ] - A[ 0 ] ) / len ];
		if ( n[ 0 ] * ( 0 - A[ 0 ] ) + n[ 1 ] * ( - 38.9 - A[ 1 ] ) > 0 ) n = [ - n[ 0 ], - n[ 1 ] ]; // away from the field
		const p = [ A[ 0 ] + ( B[ 0 ] - A[ 0 ] ) * t + n[ 0 ] * back, A[ 1 ] + ( B[ 1 ] - A[ 1 ] ) * t + n[ 1 ] * back ];
		// up to the suites' fascia: about 21 m back, 12.5 m up; sagging a little on the way
		const q = [ p[ 0 ] + n[ 0 ] * 21, p[ 1 ] + n[ 1 ] * 21 ];
		const N = 6;
		for ( let k = 0; k < N; k ++ ) {

			const f0 = k / N, f1 = ( k + 1 ) / N;
			const y = ( f ) => H + ( 12.5 - H ) * f - 0.6 * Math.sin( Math.PI * f );
			beam( cq, [ p[ 0 ] + ( q[ 0 ] - p[ 0 ] ) * f0, y( f0 ), p[ 1 ] + ( q[ 1 ] - p[ 1 ] ) * f0 ], [ p[ 0 ] + ( q[ 0 ] - p[ 0 ] ) * f1, y( f1 ), p[ 1 ] + ( q[ 1 ] - p[ 1 ] ) * f1 ], 0.016 );

		}

	}

	// the net's top: a cable along it, the net hung from it
	for ( let i = 0; i < run.length - 1; i ++ ) {

		const A = run[ i ], B = run[ i + 1 ];
		const len = Math.hypot( B[ 0 ] - A[ 0 ], B[ 1 ] - A[ 1 ] );
		let n = [ - ( B[ 1 ] - A[ 1 ] ) / len, ( B[ 0 ] - A[ 0 ] ) / len ];
		if ( n[ 0 ] * ( 0 - A[ 0 ] ) + n[ 1 ] * ( - 38.9 - A[ 1 ] ) > 0 ) n = [ - n[ 0 ], - n[ 1 ] ];
		beam( cq, [ A[ 0 ] + n[ 0 ] * back, H, A[ 1 ] + n[ 1 ] * back ], [ B[ 0 ] + n[ 0 ] * back, H, B[ 1 ] + n[ 1 ] * back ], 0.02 );

	}

	const cm = new Mesh( cq.geometry(), M.cable );
	cm.name = 'backstop-cables';
	cm.castShadow = false;
	group.add( cm );

}
