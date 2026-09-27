import { Mesh, BufferGeometry, Float32BufferAttribute } from '../../engine/index.js';
import { standard } from '../../materials/Materials.js';
import { commonModule } from '../../engine/render/wgsl/common.js';
import { LEVELS } from '../layout.js';

// The third base concourse's floor on the night (Concourse3B.js): a skin a few millimetres over the
// sealed concrete, drawn only where something's on it. Its uv is the concourse's own ( s, d ), so what's
// on the floor follows the walkway: the rain tracked in from the Third Base Gate in shoe prints and
// puddles that thin out as they come in (on the 27th; dry prints of the same on the 29th), the rain the
// wind blew in under the deck's edge along the rail, the wet at the restroom doors where they've mopped,
// beer spilled in front of Brewerytown, and the litter of a sold-out game building up inning by inning:
// peanut shells, napkins, cups, straw wrappers, ticket stubs, gum. The AP on the 27th: fans "shuffle
// along in the rising puddles".
const STREET = LEVELS.mainConcourse;

export function floorSkin( W, { sEnd, gate, doors, spills, lamps = [] } ) {

	// a grid over the walkway from the rail to the stands, and out through the gate's mouth
	const pos = [], nrm = [], uv = [];
	const quad = ( s0, s1, d0, d1 ) => {

		const P = ( s, d ) => {

			const a = W.at( s, d );
			return [ a.x, STREET + 0.004, a.z ];

		};

		const c = [ [ s0, d0 ], [ s1, d0 ], [ s1, d1 ], [ s0, d0 ], [ s1, d1 ], [ s0, d1 ] ];
		// wound to face up
		const [ a, b ] = [ P( s0, d0 ), P( s1, d0 ) ], e = P( s0, d1 );
		const up = ( b[ 0 ] - a[ 0 ] ) * ( e[ 2 ] - a[ 2 ] ) - ( b[ 2 ] - a[ 2 ] ) * ( e[ 0 ] - a[ 0 ] );
		const order = up < 0 ? c : [ c[ 0 ], c[ 2 ], c[ 1 ], c[ 3 ], c[ 5 ], c[ 4 ] ];
		for ( const [ s, d ] of order ) {

			pos.push( ...P( s, d ) );
			nrm.push( 0, 1, 0 );
			uv.push( s, d );

		}

	};

	for ( let s = - 2; s < sEnd + 2; s += 2 ) for ( let d = 30.25; d < 44.7; d += 2.9 ) quad( s, s + 2, d, Math.min( 44.7, d + 2.9 ) );
	// the gate's mouth and the way in to the turnstiles
	for ( let s = gate[ 0 ] - 7; s < gate[ 0 ] + 7; s += 2 ) for ( let d = 44.7; d < gate[ 1 ]; d += 3 ) quad( s, s + 2, d, Math.min( gate[ 1 ], d + 3 ) );
	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
	g.computeBoundingBox();
	g.computeBoundingSphere();
	const f = ( v ) => v.toFixed( 2 );
	const mat = standard( {
		name: 'concourse3b-floor', roughness: 0.6, modules: [ commonModule ], depthBias: 8, depthBiasSlopeScale: 2,
		uniforms: { rainK: [ 'f32', 0.5 ], dryK: [ 'f32', 0 ], litterK: [ 'f32', 0.3 ] },
		surface: /* wgsl */`
	let cs = in.uv.x;
	let cd = in.uv.y;
	let h2 = fract( sin( vec2f( floor( cs / 0.31 ), floor( cd / 0.21 ) ) * vec2f( 12.9898, 78.233 ) ) * 43758.5453 );
	var a = 0.0;           // how much there is here (0: nothing, drawn as the concrete under it)
	var col = vec3f( 0.0 );
	var rough = 0.6;
	var wet = 0.0;
	// ---- the rain tracked in from the Third Base Gate: puddles by the turnstiles' way in, prints thinning
	// out along the walkway both ways from the gate'cs mouth
	let gs = cs - ${ f( gate[ 0 ] ) };
	let fromGate = length( vec2f( gs * 0.6, max( 0.0, 45.0 - cd ) * 1.4 ) );
	let inMouth = step( 44.7, cd );
	var trackK = smoothstep( 32.0, 2.0, fromGate );
	// the puddles: where the floor dips, in the mouth and just in from it
	let pn = mx_noise_float2( vec2f( cs, cd ) * 0.45 ) * 0.5 + 0.5;
	let puddle = smoothstep( 0.55, 0.62, pn ) * ( inMouth + smoothstep( 12.0, 3.0, fromGate ) * ( 1.0 - inMouth ) );
	wet = max( wet, puddle * mat.rainK );
	// ---- the wind'cs rain in under the deck'cs edge along the rail (the field side)
	let railWet = smoothstep( 31.8, 30.3, cd ) * ( 0.55 + 0.45 * smoothstep( 0.4, 0.7, mx_noise_float2( vec2f( cs * 0.3, cd ) ) ) );
	wet = max( wet, railWet * mat.rainK * 0.9 );
	// ---- the restroom doors: mopped, a wet fan out of each door
	${ doors.map( ( [ ds, dd ] ) => `wet = max( wet, smoothstep( 3.2, 0.6, length( vec2f( ( cs - ${ f( ds ) } ) * 0.8, cd - ${ f( dd ) } ) ) ) * ( 0.55 + 0.45 * mx_noise_float2( vec2f( cs, cd ) * 2.0 ) ) * max( 0.35, mat.rainK ) );` ).join( '\n\t' ) }
	// ---- shoe prints: soles and heels along the way people walk (mostly along the concourse), wet on the
	// 27th near the gate and the doors, a grey film of dried ones on the 29th
	// one print (or none) in each 0.4 x 0.34 m cell, anywhere in it, turned along the way (either way)
	// give or take; the heel a step behind the sole; sparser away from the walking lanes
	let pc = vec2f( floor( cs / 0.4 ), floor( cd / 0.34 ) );
	let ph = fract( sin( vec3f( dot( pc, vec2f( 12.9898, 78.233 ) ), dot( pc, vec2f( 39.3468, 11.1353 ) ), dot( pc, vec2f( 73.156, 52.235 ) ) ) ) * 43758.5453 );
	let pl = ( vec2f( fract( cs / 0.4 ), fract( cd / 0.34 ) ) - vec2f( 0.2 + ph.y * 0.6, 0.2 + ph.z * 0.6 ) ) * vec2f( 0.4, 0.34 );
	let pa = ( ph.z - 0.5 ) * 0.6 + select( 0.0, 3.1416, fract( ph.y * 7.0 ) > 0.5 );
	let q = vec2f( pl.x * cos( pa ) - pl.y * sin( pa ), pl.x * sin( pa ) + pl.y * cos( pa ) );
	let sole = length( vec2f( ( q.x - 0.03 ) / 0.068, q.y / 0.04 ) ) < 1.0 || length( vec2f( ( q.x + 0.085 ) / 0.033, q.y / 0.034 ) ) < 1.0;
	let lane = smoothstep( 0.35, 0.65, mx_noise_float2( vec2f( cs * 0.08, cd * 0.5 ) ) * 0.5 + 0.5 );
	let tread = max( trackK, wet * 0.8 ) * mat.rainK + 0.3 * mat.dryK;
	let printK = select( 0.0, 1.0, sole && ph.x < 0.45 * tread * ( 0.3 + 0.7 * lane ) ) * min( 1.0, 0.4 + tread );
	// ---- beer spilled in front of the stands (Brewerytown most of all): amber, sticky, glossy
	var spill = 0.0;
	${ spills.map( ( [ ss, sd, r ] ) => `spill = max( spill, smoothstep( ${ f( r ) }, ${ f( r * 0.4 ) }, length( vec2f( cs - ${ f( ss ) }, ( cd - ${ f( sd ) } ) * 1.3 ) + 0.35 * vec2f( mx_noise_float2( vec2f( cs, cd ) * 1.7 ), mx_noise_float2( vec2f( cd, cs ) * 1.7 ) ) ) ) );` ).join( '\n\t' ) }
	// ---- the litter, building up through the game
	let lc = vec2f( floor( cs / 0.45 ), floor( cd / 0.45 ) );
	let lh = fract( sin( vec3f( dot( lc, vec2f( 12.9898, 78.233 ) ), dot( lc, vec2f( 39.3468, 11.1353 ) ), dot( lc, vec2f( 73.156, 52.235 ) ) ) ) * 43758.5453 );
	let lp = ( vec2f( fract( cs / 0.45 ), fract( cd / 0.45 ) ) - vec2f( 0.2 + lh.y * 0.6, 0.2 + lh.z * 0.6 ) ) * 0.45;
	// more by the rail, the stands' lines and the bins; less down the middle where they walk
	let busyFloor = 0.35 + 0.65 * max( smoothstep( 32.5, 30.3, cd ), smoothstep( 41.5, 44.5, cd ) );
	let litter = step( lh.x, mat.litterK * 0.16 * busyFloor );
	var lcol = vec3f( 0.0 );
	var la = 0.0;
	let kind = fract( lh.x * 37.0 + lh.y * 11.0 );
	let ang = lh.z * 6.2832;
	let rp = vec2f( lp.x * cos( ang ) - lp.y * sin( ang ), lp.x * sin( ang ) + lp.y * cos( ang ) );
	if ( litter > 0.5 ) {
		if ( kind < 0.45 ) {
			// peanut shells, a little heap of them
			for ( var k = 0; k < 4; k ++ ) {
				let o = vec2f( sin( f32( k ) * 2.4 + lh.y * 9.0 ), cos( f32( k ) * 1.7 + lh.z * 7.0 ) ) * 0.035;
				if ( length( ( rp - o ) / vec2f( 0.018, 0.009 ) ) < 1.0 ) { lcol = vec3f( 0.42, 0.3, 0.17 ); la = 1.0; }
			}
		} else if ( kind < 0.62 ) {
			// a napkin, crumpled flat
			if ( abs( rp.x ) < 0.07 && abs( rp.y ) < 0.06 + 0.02 * sin( rp.x * 60.0 ) ) { lcol = vec3f( 0.72, 0.71, 0.68 ) * ( 0.85 + 0.15 * sin( rp.y * 90.0 ) ); la = 1.0; }
		} else if ( kind < 0.72 ) {
			// a squashed cup: red or white, its rim
			if ( length( rp / vec2f( 0.075, 0.04 ) ) < 1.0 ) { lcol = select( vec3f( 0.72, 0.7, 0.66 ), vec3f( 0.38, 0.02, 0.03 ), lh.y > 0.6 ); la = 1.0; }
		} else if ( kind < 0.82 ) {
			// a straw wrapper, a ticket stub
			if ( abs( rp.x ) < 0.09 && abs( rp.y ) < 0.006 ) { lcol = vec3f( 0.75 ); la = 1.0; }
			if ( lh.y > 0.7 && abs( rp.x - 0.04 ) < 0.035 && abs( rp.y ) < 0.018 ) { lcol = vec3f( 0.6, 0.55, 0.45 ); la = 1.0; }
		} else if ( kind < 0.9 ) {
			// a foil wrapper off a cheesesteak
			if ( length( rp / vec2f( 0.06, 0.05 ) ) + 0.2 * sin( atan2( rp.y, rp.x ) * 7.0 ) < 1.0 ) { lcol = vec3f( 0.65, 0.65, 0.67 ); la = 1.0; rough = 0.25; }
		} else {
			// gum, trodden black
			if ( length( rp ) < 0.012 ) { lcol = vec3f( 0.03 ); la = 1.0; }
		}
	}
	// gum everywhere, from years of it
	if ( length( rp ) < 0.008 && lh.z > 0.93 ) { lcol = vec3f( 0.04 ); la = 1.0; }
	// ---- the pools of light under the pendants after dark (a warm lift on the grey)
	var pool = 0.0;
	${ lamps.map( ( [ ls, ld ] ) => `pool = max( pool, smoothstep( 4.2, 0.4, length( vec2f( cs - ${ f( ls ) }, cd - ${ f( ld ) } ) ) ) );` ).join( '\n\t' ) }
	pool *= smoothstep( 0.2, 0.8, frame.night );
	// ---- put together: the wet (darker, glossy), the prints, the spills, the litter on top
	a = max( max( max( wet, printK ), max( spill, la ) ), pool * 0.5 );
	if ( a < 0.02 ) { discard; }
	// the concrete under it as the floor draws it (Bowl.js): the saw cuts every 1.8 m, the wear
	let pp = in.P.xz;
	let gj = abs( fract( pp / 1.8 ) - 0.5 ) * 1.8;
	let fw = fwidth( pp.x ) + 0.002;
	let joint = 1.0 - ( 1.0 - smoothstep( 0.012, 0.012 + fw, min( 0.9 - gj.x, 0.9 - gj.y ) ) ) * ( 1.0 - clamp( fw * 20.0, 0.0, 1.0 ) ) * 0.4;
	let concrete = vec3f( 0.36, 0.35, 0.33 ) * joint * ( 0.86 + 0.14 * mx_noise_float2( pp * 0.25 ) ) * ( 1.0 - 0.18 * smoothstep( 0.55, 0.8, mx_noise_float2( pp * 1.3 + vec2f( 7.0 ) ) ) );
	col = concrete * mix( 1.0, 0.55, max( wet, printK * 0.7 ) );
	rough = mix( 0.6, 0.06, max( wet, printK * 0.6 ) );
	if ( printK > 0.0 && mat.dryK > 0.5 && wet < 0.1 ) { col = concrete * 0.82; rough = 0.7; }
	col = mix( col, vec3f( 0.3, 0.19, 0.05 ), spill * 0.6 );
	rough = mix( rough, 0.12, spill );
	if ( la > 0.5 ) {
		col = lcol * mix( 1.0, 0.7, wet );
		rough = mix( 0.8, 0.3, wet );
	}
	s.albedo = col;
	s.roughness = rough;
	s.ao = 0.45;
	s.emissive = col * vec3f( 1.0, 0.86, 0.66 ) * pool * pool * 0.35;
	// the edges of the wet fade into the concrete (the skin shows the same concrete where it'cs thin)
	s.albedo = mix( concrete, s.albedo, smoothstep( 0.0, 0.25, a ) );
`,
	} );
	mat.underwaterLighting = 'none';
	mat.setDefine( 'DRY', 1 );
	const mesh = new Mesh( g, mat );
	mesh.name = 'concourse3b-floor';
	mesh.receiveShadow = true;
	mesh.userData.dynamic = true;
	return mesh;

}
