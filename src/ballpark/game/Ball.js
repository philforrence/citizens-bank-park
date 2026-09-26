import { Mesh, SphereGeometry, Color } from '../../engine/index.js';
import { standard } from '../../materials/Materials.js';

// The ball: a little larger than life (9 cm instead of 7.4) so you can follow it from the stands.
export class Ball {

	constructor( parent ) {

		const mat = standard( { name: 'baseball', color: new Color( 0.85, 0.84, 0.8 ), roughness: 0.5,
			surface: 's.emissive = vec3f( 0.25 ) * frame.night;' } );
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
