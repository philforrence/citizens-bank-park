import { Mesh, SphereGeometry, Color } from '../../engine/index.js';
import { standard } from '../../materials/Materials.js';

// The ball: a little larger than life (9 cm instead of 7.4), and far off it grows so it never shrinks
// below a few pixels on screen: you can follow it from the upper deck.
export class Ball {

	constructor( parent ) {

		const mat = standard( { name: 'baseball', color: new Color( 0.85, 0.84, 0.8 ), roughness: 0.5,
			vertex: /* wgsl */`
	let c = ( v.model * vec4f( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
	// never under ~3 px across on screen: tan( fov / 2 ) from the projection, so zoomed-in TV cameras
	// don't blow it up
	let k = max( 1.0, 0.006 * length( frame.cameraPos - c ) * abs( frame.invProj[ 1 ][ 1 ] ) / 0.045 );
	let cp = ( v.prevModel * vec4f( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
	v.useWorld = true;
	v.worldPos = c + ( v.model * vec4f( v.position, 0.0 ) ).xyz * k;
	v.worldNormal = normalize( ( v.model * vec4f( v.normal, 0.0 ) ).xyz );
	v.prevWorldPos = cp + ( v.prevModel * vec4f( v.position, 0.0 ) ).xyz * k;
`,
			surface: 's.emissive = vec3f( 0.06 ) + vec3f( 0.25 ) * frame.night;' } );
		mat.underwaterLighting = 'none';
		this.mesh = new Mesh( new SphereGeometry( 0.045, 14, 10 ), mat );
		this.mesh.name = 'ball';
		this.mesh.castShadow = true;
		this.mesh.visible = false;
		parent.add( this.mesh );

	}

	set( p ) {

		if ( ! p ) {

			this.mesh.visible = false;
			return;

		}

		this.mesh.visible = true;
		this.mesh.position.set( p[ 0 ], p[ 1 ], p[ 2 ] );

	}

}
