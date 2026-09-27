import { Mesh, BufferGeometry, Float32BufferAttribute, Color } from '../../../engine/index.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { FOUL_TERRITORY, BASE, FOUL_WALL_HEIGHT, FT } from '../../layout.js';

// The backstop's cushions: separate teal vinyl pads, about 2.3 m long, 0.34 m tall and 0.41 m deep, sat
// on the top of the brick wall behind home plate between the dugouts, 4 cm proud of the brick with a
// rounded front edge and a hand's-width gap between them (heston's 2008 World Series photos,
// flickr 2987300364 and 2986440011). Each pad a little puffed at the middle of its face, its own shade
// of teal (some newer than others), the piping along the top edge, the odd scuff where a foul ball hit it.

const WALL = FOUL_WALL_HEIGHT * FT;
export const CUSHION = { y0: WALL - 0.32, y1: WALL + 0.02, front: 0.045, back: - 0.37 };

// the pad's section: ( t: toward the field from the wall line, y ), round from the bottom at the back
function profile() {

	const { y0, y1, front: f, back: b } = CUSHION;
	const P = [ [ b, y0 ], [ f - 0.035, y0 ] ];
	// the bottom front edge: a small round
	for ( let k = 1; k <= 3; k ++ ) {

		const a = - Math.PI / 2 + k / 3 * Math.PI / 2;
		P.push( [ f - 0.03 + Math.cos( a ) * 0.03, y0 + 0.03 + Math.sin( a ) * 0.03 ] );

	}

	// the face, then the big round over the top front edge (the piping runs along it)
	P.push( [ f, y1 - 0.075 ] );
	for ( let k = 1; k <= 5; k ++ ) {

		const a = k / 5 * Math.PI / 2;
		P.push( [ f - 0.07 + Math.cos( a ) * 0.07, y1 - 0.075 + Math.sin( a ) * 0.075 ] );

	}

	P.push( [ b + 0.02, y1 ], [ b, y1 - 0.02 ] );
	return P;

}

// how far round the section the piping runs (the middle of the round over the top front edge)
function pipeV() {

	const P = profile();
	let v = 0;
	for ( let i = 1; i < P.length; i ++ ) {

		v += Math.hypot( P[ i ][ 0 ] - P[ i - 1 ][ 0 ], P[ i ][ 1 ] - P[ i - 1 ][ 1 ] );
		if ( i === 8 ) return v;

	}

	return v;

}

// one pad from s0 to s1 along a wall segment ( a -> b, n toward the field ), pushed into the arrays
function pad( out, a, u, n, s0, s1, id ) {

	const P = profile();
	const np = P.length;
	// smooth normals round the section (the back is square: it's against the net's footing, unseen)
	const nrm = P.map( ( p, i ) => {

		const q = P[ ( i + np - 1 ) % np ], r = P[ ( i + 1 ) % np ];
		const e = [ r[ 0 ] - q[ 0 ], r[ 1 ] - q[ 1 ] ];
		const l = Math.hypot( ...e ) || 1;
		// outward (the section runs counter-clockwise in ( t, y ))
		return [ e[ 1 ] / l, - e[ 0 ] / l ];

	} );
	// the arc length round the section (v)
	const arc = [ 0 ];
	for ( let i = 1; i < np; i ++ ) arc.push( arc[ i - 1 ] + Math.hypot( P[ i ][ 0 ] - P[ i - 1 ][ 0 ], P[ i ][ 1 ] - P[ i - 1 ][ 1 ] ) );
	const L = s1 - s0;
	// rings along the pad: the ends rounded in (inset), the face puffed out toward the middle
	const cT = ( CUSHION.front + CUSHION.back ) / 2, cY = ( CUSHION.y0 + CUSHION.y1 ) / 2;
	const rings = [ [ 0, 0.8 ], [ 0.012, 0.95 ], [ 0.035, 1 ], [ L * 0.25, 1 ], [ L * 0.5, 1 ], [ L * 0.75, 1 ], [ L - 0.035, 1 ], [ L - 0.012, 0.95 ], [ L, 0.8 ] ];
	const base = out.pos.length / 3;
	const to3 = ( s, t, y ) => [ a[ 0 ] + u[ 0 ] * s + n[ 0 ] * t, y, a[ 1 ] + u[ 1 ] * s + n[ 1 ] * t ];
	for ( const [ ds, k ] of rings ) {

		const puff = Math.sin( Math.PI * ds / L ) * 0.012;
		for ( let i = 0; i < np; i ++ ) {

			let [ t, y ] = P[ i ];
			t = cT + ( t - cT ) * k;
			y = cY + ( y - cY ) * ( 0.9 + 0.1 * k );
			// the face (and the round over the top) puff out
			if ( t > CUSHION.front - 0.08 ) t += puff * Math.max( 0, nrm[ i ][ 0 ] );
			out.pos.push( ...to3( s0 + ds, t, y ) );
			const [ nt, ny ] = nrm[ i ];
			// the end rings lean out along the pad
			const end = k < 1 ? ( ds < L / 2 ? - 0.6 : 0.6 ) : 0;
			const vx = n[ 0 ] * nt + u[ 0 ] * end, vz = n[ 1 ] * nt + u[ 1 ] * end, l = Math.hypot( vx, ny, vz ) || 1;
			out.nrm.push( vx / l, ny / l, vz / l );
			out.uv.push( id * 10 + s0 + ds, arc[ i ] );

		}

	}

	const nr = rings.length;
	for ( let r = 0; r < nr - 1; r ++ ) for ( let i = 0; i < np; i ++ ) {

		const A = base + r * np + i, B = base + r * np + ( i + 1 ) % np, C = base + ( r + 1 ) * np + i, D = base + ( r + 1 ) * np + ( i + 1 ) % np;
		out.index.push( A, C, B, B, C, D );

	}

	// the end caps: a fan from the section's middle
	for ( const [ r, flip ] of [ [ 0, true ], [ nr - 1, false ] ] ) {

		const ds = rings[ r ][ 0 ];
		const c = out.pos.length / 3;
		out.pos.push( ...to3( s0 + ds + ( flip ? - 0.004 : 0.004 ), cT, cY ) );
		out.nrm.push( u[ 0 ] * ( flip ? - 1 : 1 ), 0, u[ 1 ] * ( flip ? - 1 : 1 ) );
		out.uv.push( id * 10 + s0 + ds, 0.2 );
		for ( let i = 0; i < np; i ++ ) {

			const A = base + r * np + i, B = base + r * np + ( i + 1 ) % np;
			if ( flip ) out.index.push( c, A, B );
			else out.index.push( c, B, A );

		}

	}

}

export function buildCushions( group ) {

	const out = { pos: [], nrm: [], uv: [], index: [] };
	const run = FOUL_TERRITORY.slice( 5, 9 );
	let id = 0;
	for ( let i = 0; i < run.length - 1; i ++ ) {

		const a = run[ i ], b = run[ i + 1 ];
		const len = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
		const u = [ ( b[ 0 ] - a[ 0 ] ) / len, ( b[ 1 ] - a[ 1 ] ) / len ];
		let n = [ - u[ 1 ], u[ 0 ] ];
		const mx = ( a[ 0 ] + b[ 0 ] ) / 2, mz = ( a[ 1 ] + b[ 1 ] ) / 2;
		if ( n[ 0 ] * ( 0 - mx ) + n[ 1 ] * ( - BASE * Math.SQRT2 - mz ) < 0 ) n = [ - n[ 0 ], - n[ 1 ] ];
		// pads about 2.3 m, a 2.5 cm gap between them; at the corners they stop short of the joint so
		// their backs don't cross
		const k = Math.max( 1, Math.round( len / 2.3 ) ), gap = 0.025, inset = 0.05;
		const step = ( len - 2 * inset ) / k;
		for ( let j = 0; j < k; j ++ ) pad( out, a, u, n, inset + j * step + gap / 2, inset + ( j + 1 ) * step - gap / 2, id ++ );

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( out.pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( out.nrm, 3 ) );
	g.setAttribute( 'uv', new Float32BufferAttribute( out.uv, 2 ) );
	g.setIndex( out.index );
	g.computeBoundingBox();
	g.computeBoundingSphere();

	const mat = standard( { name: 'backstop-cushions', color: new Color( 0.02, 0.15, 0.135 ), roughness: 0.42, modules: [ commonModule ],
		surface: /* wgsl */`
	// uv: x = pad * 10 + metres along, y = metres round the section from the bottom back edge
	let id = floor( in.uv.x / 10.0 );
	let sa = in.uv.x - id * 10.0;
	let hp = fract( sin( vec2f( id * 12.9898, id * 78.233 ) ) * 43758.5453 );
	// each pad its own teal: the newer ones deeper, the older ones sun-bleached a shade toward grey
	var c = mat.color * ( 0.9 + 0.2 * hp.x ) * mix( vec3f( 1.0 ), vec3f( 1.15, 1.0, 0.95 ), hp.y * 0.5 );
	// the vinyl: a faint pebbled grain, soft wrinkles where it's pulled round the top
	let fw = length( fwidth( in.uv ) );
	let grain = mx_noise_float2( in.uv * vec2f( 90.0, 90.0 ) ) * ( 1.0 - smoothstep( 0.002, 0.01, fw ) );
	let wrinkle = mx_noise_float2( vec2f( sa * 6.0 + id * 3.0, in.uv.y * 30.0 ) );
	c = c * ( 0.95 + 0.06 * grain + 0.05 * wrinkle );
	// the piping along the front top edge
	let pipe = 1.0 - smoothstep( 0.004, 0.009, abs( in.uv.y - ${ pipeV().toFixed( 4 ) } ) );
	c = mix( c, c * 0.62, pipe * ( 1.0 - clamp( fw * 60.0, 0.0, 0.8 ) ) );
	// scuffs: a foul ball's grey mark, the odd pale rub where the catcher's gone into it
	let sc = floor( vec2f( sa / 0.7, in.uv.y / 0.2 ) );
	let sh = fract( sin( dot( sc + id * 7.0, vec2f( 27.1, 61.7 ) ) ) * 43758.5453 );
	let sp = ( vec2f( sa, in.uv.y ) - ( sc + vec2f( fract( sh * 3.1 ), fract( sh * 5.7 ) ) * 0.6 + 0.2 ) * vec2f( 0.7, 0.2 ) ) / vec2f( 0.04, 0.035 );
	c = mix( c, vec3f( 0.22, 0.24, 0.22 ), ( 1.0 - smoothstep( 0.3, 1.0, length( sp ) ) ) * step( 0.72, sh ) * 0.55 );
	// the rain beads and runs on it: darker, glossier (its top soaks via the lighting's wet too)
	c = c * ( 1.0 - 0.2 * frame.wet );
	s.albedo = c;
	s.roughness = mix( 0.42, 0.18, frame.wet );
	s.sheenColor = vec3f( 0.05 );
	s.emissive = c * smoothstep( 0.2, 0.8, frame.night ) * 0.4;
` } );
	mat.underwaterLighting = 'none';
	const m = new Mesh( g, mat );
	m.name = 'backstop-cushions';
	m.castShadow = true;
	m.receiveShadow = true;
	group.add( m );
	return m;

}
