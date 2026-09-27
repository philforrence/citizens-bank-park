import { Mesh, BufferGeometry, Float32BufferAttribute, Color } from '../../../engine/index.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { FT } from '../../layout.js';

// Home plate as it is in the ground: a slab of whitened rubber flush with the clay, its black bevelled
// edge sloping down into the dirt. Worn: the rubber gone ivory, cut and scuffed by spikes, clay ground
// into its edges. Through each half inning the dirt builds up on it (dust kicked over it, the catcher's
// and the hitters' cleats, mud off their spikes in the rain) and at the change the plate umpire brushes
// it clean, leaving the swept streaks and the corners he never gets.
//
//   const plate = buildPlate( group );   plate.uniforms.dirt.value = 0..1

const W = 17 / 12 * FT / 2, D = 17 / 12 * FT, S = 8.5 / 12 * FT;
const TOP = 0.024, SKIRT = 0.02;

export function buildPlate( group ) {

	// the outline (counter-clockwise from above), the back tip at the origin
	const O = [ [ 0, 0 ], [ W, - ( D - S ) ], [ W, - D ], [ - W, - D ], [ - W, - ( D - S ) ] ];
	// out by the skirt, mitred
	const n = O.length;
	const out = O.map( ( c, i ) => {

		const p = O[ ( i + n - 1 ) % n ], q = O[ ( i + 1 ) % n ];
		const e1 = [ c[ 0 ] - p[ 0 ], c[ 1 ] - p[ 1 ] ], e2 = [ q[ 0 ] - c[ 0 ], q[ 1 ] - c[ 1 ] ];
		const l1 = Math.hypot( ...e1 ), l2 = Math.hypot( ...e2 );
		// outward normals ( the outline runs clockwise in x, z seen from above: -z up the page )
		const n1 = [ e1[ 1 ] / l1, - e1[ 0 ] / l1 ], n2 = [ e2[ 1 ] / l2, - e2[ 0 ] / l2 ];
		let m = [ n1[ 0 ] + n2[ 0 ], n1[ 1 ] + n2[ 1 ] ];
		const ml = Math.hypot( ...m );
		m = [ m[ 0 ] / ml, m[ 1 ] / ml ];
		const k = SKIRT / Math.max( 0.3, m[ 0 ] * n2[ 0 ] + m[ 1 ] * n2[ 1 ] );
		return [ c[ 0 ] + m[ 0 ] * k, c[ 1 ] + m[ 1 ] * k ];

	} );
	// make sure "out" is outside (flip the normals' sense if the outline runs the other way)
	const cx = O.reduce( ( a, p ) => a + p[ 0 ], 0 ) / n, cz = O.reduce( ( a, p ) => a + p[ 1 ], 0 ) / n;
	const outside = Math.hypot( out[ 2 ][ 0 ] - cx, out[ 2 ][ 1 ] - cz ) > Math.hypot( O[ 2 ][ 0 ] - cx, O[ 2 ][ 1 ] - cz );
	const skirt = outside ? out : O.map( ( c, i ) => [ 2 * c[ 0 ] - out[ i ][ 0 ], 2 * c[ 1 ] - out[ i ][ 1 ] ] );

	const pos = [], nrm = [], uv = [], index = [];
	const v = ( x, y, z, nx, ny, nz ) => {

		pos.push( x, y, z ); nrm.push( nx, ny, nz ); uv.push( x, z );
		return pos.length / 3 - 1;

	};
	// the top: a fan from the middle
	const c = v( cx, TOP, cz, 0, 1, 0 );
	const top = O.map( ( p ) => v( p[ 0 ], TOP, p[ 1 ], 0, 1, 0 ) );
	for ( let i = 0; i < n; i ++ ) index.push( c, top[ ( i + 1 ) % n ], top[ i ] );
	// the bevel, each side its own normal
	for ( let i = 0; i < n; i ++ ) {

		const j = ( i + 1 ) % n;
		const a = O[ i ], b = O[ j ], A = skirt[ i ], B = skirt[ j ];
		const ex = b[ 0 ] - a[ 0 ], ez = b[ 1 ] - a[ 1 ], el = Math.hypot( ex, ez );
		let nx = ez / el, nz = - ex / el;
		if ( nx * ( ( a[ 0 ] + b[ 0 ] ) / 2 - cx ) + nz * ( ( a[ 1 ] + b[ 1 ] ) / 2 - cz ) < 0 ) {

			nx = - nx; nz = - nz;

		}

		const ny = SKIRT / ( TOP - 0.001 ), l = Math.hypot( nx, ny, nz );
		const i0 = v( a[ 0 ], TOP, a[ 1 ], nx / l, ny / l, nz / l ), i1 = v( b[ 0 ], TOP, b[ 1 ], nx / l, ny / l, nz / l );
		const i2 = v( B[ 0 ], 0.001, B[ 1 ], nx / l, ny / l, nz / l ), i3 = v( A[ 0 ], 0.001, A[ 1 ], nx / l, ny / l, nz / l );
		index.push( i0, i1, i2, i0, i2, i3 );

	}

	// the top's triangles face up; the bevel's out: fix any that don't
	for ( let t = 0; t < index.length; t += 3 ) {

		const [ a, b, cc ] = [ index[ t ], index[ t + 1 ], index[ t + 2 ] ];
		const P = ( k ) => [ pos[ k * 3 ], pos[ k * 3 + 1 ], pos[ k * 3 + 2 ] ];
		const A = P( a ), B = P( b ), C = P( cc );
		const e1 = [ B[ 0 ] - A[ 0 ], B[ 1 ] - A[ 1 ], B[ 2 ] - A[ 2 ] ], e2 = [ C[ 0 ] - A[ 0 ], C[ 1 ] - A[ 1 ], C[ 2 ] - A[ 2 ] ];
		const f = [ e1[ 1 ] * e2[ 2 ] - e1[ 2 ] * e2[ 1 ], e1[ 2 ] * e2[ 0 ] - e1[ 0 ] * e2[ 2 ], e1[ 0 ] * e2[ 1 ] - e1[ 1 ] * e2[ 0 ] ];
		if ( f[ 0 ] * nrm[ a * 3 ] + f[ 1 ] * nrm[ a * 3 + 1 ] + f[ 2 ] * nrm[ a * 3 + 2 ] < 0 ) {

			index[ t + 1 ] = cc; index[ t + 2 ] = b;

		}

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
	g.setIndex( index );
	g.computeBoundingSphere();

	const mat = standard( { name: 'home-plate', color: new Color( 0.76, 0.74, 0.68 ), roughness: 0.7, modules: [ commonModule ],
		uniforms: { dirt: [ 'f32', 0 ] },
		surface: /* wgsl */`
	let p = in.uv; // field x, z (the back tip at the origin)
	let N = in.N;
	// distance in from the plate's edge (its five sides)
	let w = ${ W.toFixed( 4 ) }; let d = ${ D.toFixed( 4 ) }; let sd = ${ S.toFixed( 4 ) };
	let dSide = w - abs( p.x );
	let dFront = p.y + d;
	let dBack = ( - p.y - abs( p.x ) ) * 0.7071;
	let edge = max( min( min( dSide, dFront ), select( 1.0, dBack, p.y > - ( d - sd ) ) ), 0.0 );
	// the rubber: ivory, a faint mottling, cuts from spikes
	var c = mat.color * ( 0.94 + 0.08 * mx_noise_float2( p * 40.0 ) );
	let cut = smoothstep( 0.92, 0.97, mx_noise_float2( vec2f( p.x * 20.0 + p.y * 90.0, p.y * 8.0 ) ) );
	c = c * ( 1.0 - 0.3 * cut );
	// the clay: ground in along the edges always; over it through the half inning, brushed off at the change
	let rim = 1.0 - smoothstep( 0.0, 0.035, edge );
	let film = mat.dirt * ( 0.35 + 0.65 * smoothstep( 0.35, 0.75, mx_noise_float2( p * 14.0 ) * 0.5 + 0.5 ) );
	// the brush's streaks: swept off toward the front edge, heavier in the corners
	let sweep = 0.12 * ( 0.5 + 0.5 * sin( p.x * 260.0 + mx_noise_float2( p * 9.0 ) * 4.0 ) ) * ( 1.0 - smoothstep( 0.02, 0.08, edge ) );
	let clay = clamp( rim * 0.75 + film * 0.8 + sweep, 0.0, 1.0 );
	c = mix( c, vec3f( 0.36, 0.17, 0.08 ) * ( 0.8 + 0.3 * mx_noise_float2( p * 60.0 ) ), clay );
	// the bevel: black rubber, dirty
	let bevel = 1.0 - smoothstep( 0.93, 0.98, N.y );
	c = mix( c, mix( vec3f( 0.02 ), vec3f( 0.2, 0.09, 0.04 ), 0.35 + 0.4 * mx_noise_float2( p * 30.0 ) ), bevel );
	// in the rain: a film of muddy water on it
	c = c * ( 1.0 - 0.25 * frame.wet );
	s.albedo = c;
	s.roughness = mix( 0.7, 0.25, frame.wet ) * ( 1.0 + 0.2 * clay );
	s.emissive = c * smoothstep( 0.2, 0.8, frame.night ) * 0.35;
` } );
	mat.underwaterLighting = 'none';
	const m = new Mesh( g, mat );
	m.name = 'home-plate';
	m.receiveShadow = true;
	m.castShadow = false;
	m.userData.dynamic = true; // its own material and uniform; not merged
	group.add( m );
	return mat;

}
