import { Mesh, Color } from '../../../engine/index.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { Mesher } from './Mesher.js';

// The rain coming off the edges on the 27th: a curtain of drips from the gate canopy's front edge and
// the store's, strings of drops falling past the people queuing under them, splashing at the foot.
// Each edge is a sheet the shader fills with falling drops (columns a few centimetres apart, each its own
// rhythm), only while it's raining.
//
//   buildDrips( group, [ [ [ x0, z0 ], [ x1, z1 ], yTop, yBottom ], ... ] )

export function buildDrips( group, edges ) {

	const m = new Mesher();
	for ( const [ A, B, y0, y1 ] of edges ) {

		const L = Math.hypot( B[ 0 ] - A[ 0 ], B[ 1 ] - A[ 1 ] );
		// uv: x along the edge (m), y down from it (m)
		m.face( [ A[ 0 ], y0, A[ 1 ] ], [ B[ 0 ], y0, B[ 1 ] ], [ B[ 0 ], y1, B[ 1 ] ], [ A[ 0 ], y1, A[ 1 ] ], [ B[ 1 ] - A[ 1 ], 0, A[ 0 ] - B[ 0 ] ], [ [ 0, 0 ], [ L, 0 ], [ L, y0 - y1 ], [ 0, y0 - y1 ] ] );

	}

	const mat = standard( { name: 'w1-drips', color: new Color( 0.7, 0.72, 0.75 ), roughness: 0.1, transparent: true, depthWrite: false, side: 'double', modules: [ commonModule ],
		surface: /* wgsl */`
	// columns every 7 cm (where the water gathers on the edge), each with its own drop rate; a drop is a
	// short bright streak falling at ~5 m/s, stretched by the motion
	let raining = smoothstep( 0.35, 0.6, frame.wet );
	let col = floor( in.uv.x / 0.07 );
	let h = fract( sin( vec2f( col * 12.9898, col * 78.233 ) ) * 43758.5453 );
	let x = fract( in.uv.x / 0.07 ) - 0.5;
	let rate = 0.9 + 1.6 * h.x;
	let len = 0.22;
	// how far this column's current drop has fallen
	let fall = fract( frame.time * rate + h.y ) * ( 5.0 / rate + 1.0 );
	let dy = in.uv.y - fall;
	let streak = smoothstep( - len, 0.0, dy ) * ( 1.0 - smoothstep( 0.0, 0.02, dy ) );
	let thin = 1.0 - smoothstep( 0.04, 0.09, abs( x ) );
	// some columns drip more than others; none where the edge is dry
	let busy = step( 0.35, fract( h.x * 7.3 ) );
	s.alpha = streak * thin * busy * raining * 0.55;
	s.albedo = vec3f( 0.75, 0.77, 0.8 );
	s.emissive = vec3f( 0.08, 0.08, 0.09 ) * s.alpha * smoothstep( 0.1, 0.7, frame.night );
` } );
	mat.setDefine( 'DRY', 1 );
	mat.underwaterLighting = 'none';
	const mesh = new Mesh( m.geometry(), mat );
	mesh.name = 'w1-drips';
	mesh.layers.set( 2 );
	group.add( mesh );
	return mesh;

}
