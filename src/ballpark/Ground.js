import { Group, Mesh, PlaneGeometry, BoxGeometry, CylinderGeometry, Vector3, Color } from '../engine/index.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { standard } from '../materials/Materials.js';

// Step 1 placeholder world: flat ground out to the horizon, a faint 10 m grid near the camera to judge
// distances, and a small test block (a flight of stairs up to a platform, and a few pillars) to check
// walking, stepping and sun shadows. The ballpark replaces all of this.
//
// Units are metres; y is up. heightAt() is the terrain the walker stands on (colliders add decks and
// stairs on top).
const SIZE = 20000;
const GRID = 10; // m between grid lines

export class Ground {

	constructor( { scene, colliders } ) {

		this.group = new Group();
		this.group.name = 'ground';
		scene.add( this.group );

		const geo = new PlaneGeometry( SIZE, SIZE, 1, 1 );
		geo.rotateX( - Math.PI / 2 );
		this.material = standard( {
			name: 'ground',
			color: new Color( 0.16, 0.16, 0.15 ),
			roughness: 0.92,
			modules: [ commonModule ],
			surface: /* wgsl */`
	let xz = in.P.xz;
	// broad patches, then finer grain: worn asphalt
	let n = 0.5 + 0.28 * mx_noise_float2( xz * 0.04 ) + 0.14 * mx_noise_float2( xz * 0.5 ) + 0.07 * mx_noise_float2( xz * 6.0 );
	s.albedo = mat.color * ( 0.75 + 0.5 * n );
	// faint grid lines every ${ GRID } m, fading out with distance
	let g = abs( fract( xz / ${ GRID }.0 + 0.5 ) - 0.5 ) * ${ GRID }.0;
	let line = 1.0 - smoothstep( 0.03, 0.07, min( g.x, g.y ) );
	let fade = 1.0 - smoothstep( 25.0, 90.0, length( in.P - frame.cameraPos ) );
	s.albedo = mix( s.albedo, vec3f( 0.4 ), line * fade * 0.5 );
`,
		} );
		this.material.underwaterLighting = 'none';
		const ground = new Mesh( geo, this.material );
		ground.name = 'ground-plane';
		ground.receiveShadow = true;
		ground.frustumCulled = false;
		this.group.add( ground );

		this._buildTestBlock( colliders );

	}

	// flat everywhere for now (the field, the bowl and the plaza come from colliders and meshes)
	heightAt( /* x, z */ ) {

		return 0;

	}

	update() {}

	// A flight of 10 stairs (0.18 m rise, 0.3 m run, like a stadium aisle) up to a 6 x 6 m platform, and
	// three 6 m pillars, 12 m in front of the start.
	_buildTestBlock( colliders ) {

		const concrete = standard( { name: 'test-concrete', color: new Color( 0.52, 0.5, 0.47 ), roughness: 0.85 } );
		concrete.underwaterLighting = 'none';
		const add = ( geo, x, y, z ) => {

			const m = new Mesh( geo, concrete );
			m.position.set( x, y, z );
			m.castShadow = true;
			m.receiveShadow = true;
			this.group.add( m );
			return m;

		};

		const RISE = 0.18, RUN = 0.3, STEPS = 10, WIDTH = 3;
		const x0 = 0, z0 = - 12; // foot of the stairs, climbing toward -z
		for ( let i = 0; i < STEPS; i ++ ) {

			const top = ( i + 1 ) * RISE;
			const cz = z0 - ( i + 0.5 ) * RUN;
			add( new BoxGeometry( WIDTH, top, RUN ), x0, top / 2, cz );
			colliders.addBox( new Vector3( x0, top / 2, cz ), new Vector3( WIDTH / 2, top / 2, RUN / 2 ), 0, { walkable: true } );

		}

		const H = STEPS * RISE, P = 6;
		const pz = z0 - STEPS * RUN - P / 2;
		add( new BoxGeometry( P, H, P ), x0, H / 2, pz );
		colliders.addBox( new Vector3( x0, H / 2, pz ), new Vector3( P / 2, H / 2, P / 2 ), 0, { walkable: true } );

		for ( const [ x, z ] of [ [ - 8, - 14 ], [ 8, - 14 ], [ 8, - 24 ] ] ) {

			add( new CylinderGeometry( 0.4, 0.4, 6, 24 ), x, 3, z );
			colliders.addCylinder( x, z, 0.4, 0, 6 );

		}

	}

}
