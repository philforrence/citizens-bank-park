import { Mesh, Color, Vector4 } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { flatPolygon } from '../../geo.js';
import { LEVELS } from '../../layout.js';

// The Alley's floor: the brick promenade from the storefronts out to the field's edge (the rail over the
// pens, the back of the batter's eye), where the old floor stopped 8.5 m out and left a bare grey apron
// and ran on over the pens. Red clay pavers in a running bond along the Alley, bands of light concrete
// across it at the lamp posts, a concrete border along the counters and the rail; worn darker down the
// middle where 45,000 people walk, gum and a scatter of peanut shells, napkins and cup lids, thicker by
// the stands and later in the game. On the 27th the rain puddles in the low spots and rings them; at
// night warm pools of light under the lamps and in front of the counters.
//
//   const floor = promenade( parent, { pit, x0, x1, zBack, lamps, counters } )
//   floor.set( { litter, rain } )   (0..1 each, every frame)

const STREET = LEVELS.mainConcourse;

// where the pit's edge is behind center field at x: the farthest crossing of its outline (-z)
export function pitEdgeZ( pit, x ) {

	let best = Infinity;
	for ( let i = 0; i < pit.length; i ++ ) {

		const [ ax, az ] = pit[ i ], [ bx, bz ] = pit[ ( i + 1 ) % pit.length ];
		if ( ( ax - x ) * ( bx - x ) > 0 || ax === bx ) continue;
		const z = az + ( bz - az ) * ( x - ax ) / ( bx - ax );
		if ( z < best ) best = z;

	}

	return best;

}

export function promenade( parent, { pit, x0, x1, zBack, near = - 126, lamps = [], counters = [] } ) {

	// the outline: along the storefronts, then back along the field's edge (the pit's, no nearer than
	// `near`, so it doesn't spill over the whole concourse behind the corner seats)
	const xs = new Set( [ x0, x1 ] );
	for ( const [ x ] of pit ) if ( x > x0 && x < x1 ) {

		xs.add( x - 0.002 ); xs.add( x + 0.002 );

	}

	for ( let x = Math.ceil( x0 ); x < x1; x += 2 ) xs.add( x );
	const edge = ( x ) => Math.max( zBack, Math.min( pitEdgeZ( pit, x ) - 0.01, near ) );
	const along = [ ...xs ].sort( ( a, b ) => a - b ).map( ( x ) => [ x, edge( x ) ] );
	const contour = [ [ x0, zBack ], [ x1, zBack ], ...along.reverse() ];
	const geo = flatPolygon( contour, [], STREET + 0.014 );
	const L = lamps.slice( 0, 12 );
	while ( L.length < 12 ) L.push( [ 1e4, 1e4 ] );
	const C = counters.slice( 0, 12 );
	while ( C.length < 12 ) C.push( [ 1e4, 1e4 ] );
	const vec = ( pts ) => pts.map( ( [ x, z ] ) => `vec2f( ${ x.toFixed( 2 ) }, ${ z.toFixed( 2 ) } )` ).join( ', ' );
	const mat = standard( {
		name: 'alley-promenade', color: new Color( 0.3, 0.085, 0.05 ), roughness: 0.8, modules: [ commonModule ],
		uniforms: { alley: [ 'vec4f', new Vector4( 0, 0, 0, 0 ) ] }, // x litter, y rain (the puddles), z, w unused
		surface: /* wgsl */`
	// the field frame: x along the Alley, z out toward the field (uv, from the outline)
	let p = in.uv;
	let fw = fwidth( p.x ) + fwidth( p.y );
	// the bands of concrete across the Alley at the lamp posts (every 12 m), 1.4 m wide, and the borders:
	// 0.9 m along the counters, 0.6 m along the field's edge
	let bandX = abs( fract( ( p.x + 2.0 ) / 12.0 ) - 0.5 ) * 12.0;
	let edgeD = ${ ( - zBack ).toFixed( 2 ) } + p.y;
	var concrete = bandX > 5.3 || edgeD < 0.9;
	// the pavers: 20 x 10 cm, a running bond along the Alley; each its own shade of red and brown
	let bu = p.x / 0.2 + 0.5 * floor( p.y / 0.1 );
	let bv = p.y / 0.1;
	let cell = vec2f( floor( bu ), floor( bv ) );
	let hb = fract( sin( dot( cell, vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
	let fj = clamp( fw * 12.0 - 0.3, 0.0, 1.0 );
	let joint = mix( max( step( 0.92, fract( bu ) ), step( 0.86, fract( bv ) ) ), 0.16, fj );
	var brick = mat.color * mix( 0.72 + 0.5 * hb, 0.97, fj ) * mix( vec3f( 1.0 ), vec3f( 0.85, 0.95, 1.1 ), step( 0.85, hb ) * ( 1.0 - fj ) );
	brick = mix( brick, vec3f( 0.23, 0.21, 0.19 ), joint * 0.85 );
	// the concrete: broom-finished slabs, saw-cut every 1.5 m
	let cj = abs( fract( p / 1.5 ) - 0.5 ) * 1.5;
	let cut = ( 1.0 - smoothstep( 0.01, 0.01 + fw, min( 0.75 - cj.x, 0.75 - cj.y ) ) ) * ( 1.0 - clamp( fw * 20.0, 0.0, 1.0 ) );
	let conc = vec3f( 0.46, 0.44, 0.4 ) * ( 0.93 + 0.08 * mx_noise_float2( p * 3.0 ) ) * ( 1.0 - 0.35 * cut );
	var c = select( brick, conc, concrete );
	// worn and grimed down the middle of the walk, where the crowd goes
	let mid = 4.5;
	let traffic = exp( - pow( ( edgeD - mid ) / 3.5, 2.0 ) );
	c = c * ( 1.0 - 0.14 * traffic * ( 0.6 + 0.4 * mx_noise_float2( p * 0.7 ) ) );
	c = c * ( 0.9 + 0.12 * mx_noise_float2( p * 0.35 ) );
	// flattened gum: dark grey dots, most in front of the stands
	let gcell = floor( p / 0.35 );
	let gh = fract( sin( dot( gcell, vec2f( 41.3, 17.7 ) ) ) * 7543.21 );
	let gp = fract( p / 0.35 ) - vec2f( 0.5 ) - ( vec2f( fract( gh * 13.1 ), fract( gh * 7.7 ) ) - 0.5 ) * 0.6;
	let gum = step( 0.975 - 0.02 * traffic, gh ) * ( 1.0 - smoothstep( 0.035, 0.05, length( gp ) ) ) * ( 1.0 - fj );
	c = mix( c, vec3f( 0.12, 0.12, 0.12 ), gum * 0.8 );
	// litter: peanut shells, napkins, a cup lid, a crushed cup: more by the counters, more as the game goes
	let lcell = floor( p / 0.5 );
	let lh = fract( sin( dot( lcell, vec2f( 91.7, 33.1 ) ) ) * 9431.7 );
	let lp = fract( p / 0.5 ) - vec2f( 0.5 ) - ( vec2f( fract( lh * 17.3 ), fract( lh * 5.9 ) ) - 0.5 ) * 0.5;
	let nearCounter = exp( - edgeD / 3.0 );
	let litterK = mat.alley.x * ( 0.25 + 0.75 * nearCounter + 0.3 * traffic );
	let kind = fract( lh * 31.7 );
	let shell = step( 1.0 - 0.09 * litterK, lh ) * ( 1.0 - smoothstep( 0.02, 0.03, length( lp * vec2f( 1.0, 1.8 ) ) ) );
	let paper = step( 1.0 - 0.03 * litterK, fract( lh * 3.3 ) ) * ( 1.0 - smoothstep( 0.05, 0.065, max( abs( lp.x ), abs( lp.y * 1.4 ) ) ) );
	c = mix( c, vec3f( 0.45, 0.33, 0.18 ), shell * ( 1.0 - fj ) );
	c = mix( c, select( vec3f( 0.75, 0.74, 0.7 ), vec3f( 0.6, 0.05, 0.05 ), kind > 0.8 ), paper * ( 1.0 - fj ) );
	s.albedo = c;
	s.roughness = select( 0.82, 0.9, concrete ) - 0.1 * traffic;
	// the rain on the 27th: puddles in the low spots (the joints hold water first), rings where the drops
	// land; the shader's wet pass darkens and glosses the rest
	let rain = mat.alley.y;
	let low = mx_noise_float2( p * 0.45 ) * 0.6 + mx_noise_float2( p * 1.7 ) * 0.25 + joint * 0.25 - traffic * 0.1;
	let puddle = smoothstep( 0.45 - 0.35 * rain, 0.5 - 0.35 * rain, low ) * step( 0.01, rain );
	if ( puddle > 0.0 ) {
		s.albedo = s.albedo * mix( 1.0, 0.45, puddle );
		s.roughness = mix( s.roughness, 0.03, puddle );
		// the drops: a few rings spreading in each 0.6 m cell, on the puddles
		let rc = floor( p / 0.6 );
		let rh = fract( sin( dot( rc, vec2f( 27.1, 61.7 ) ) ) * 4375.85 );
		let ph = fract( frame.time * 1.3 + rh );
		let rp = fract( p / 0.6 ) - vec2f( 0.5 ) - ( vec2f( fract( rh * 7.1 ), fract( rh * 3.9 ) ) - 0.5 ) * 0.4;
		let ring = 1.0 - smoothstep( 0.0, 0.02, abs( length( rp ) - ph * 0.3 ) );
		let rip = ring * ( 1.0 - ph ) * puddle * rain;
		s.normal = normalize( in.N + vec3f( rp.x, 0.0, rp.y ) * rip * 3.0 );
	}
	// after dark: warm pools under the lamp posts and in front of the lit counters
	var lamps = array<vec2f, 12>( ${ vec( L ) } );
	var counters = array<vec2f, 12>( ${ vec( C ) } );
	var pool = 0.0;
	for ( var i = 0; i < 12; i ++ ) {
		let dl = p - lamps[ i ];
		pool += 1.6 * exp( - dot( dl, dl ) / 12.0 );
		let dc = ( p - counters[ i ] ) / vec2f( 3.5, 2.2 );
		pool += 1.1 * exp( - dot( dc, dc ) );
	}
	let night = smoothstep( 0.15, 0.7, frame.night );
	s.emissive = s.albedo * vec3f( 1.0, 0.8, 0.55 ) * pool * night * ( 1.0 + 1.5 * puddle );
`,
	} );
	mat.underwaterLighting = 'none';
	const mesh = new Mesh( geo, mat );
	mesh.name = 'alley-promenade';
	mesh.receiveShadow = true;
	parent.add( mesh );
	return {
		mesh, contour, edge,
		set( { litter = 0, rain = 0 } = {} ) {

			mat.uniforms.alley.value.set( litter, rain, 0, 0 );

		},
	};

}
