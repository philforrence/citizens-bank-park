import { Group, Mesh, BufferGeometry, Float32BufferAttribute, Vector2, Color } from '../engine/index.js';
import { triangulateShape } from '../engine/math/ShapeUtils.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { standard } from '../materials/Materials.js';

// The ground round the ballpark: worn asphalt (the parking lots of the South Philadelphia Sports
// Complex) out to the horizon, with a hole where the stadium's own ground is (Field.js).
// Units are metres; y is up.
const SIZE = 20000;

export class Ground {

	// hole: the stadium footprint in world [ x, z ]
	constructor( { scene, hole = null } ) {

		this.group = new Group();
		this.group.name = 'ground';
		scene.add( this.group );

		const h = SIZE / 2;
		const contour = [ new Vector2( - h, - h ), new Vector2( h, - h ), new Vector2( h, h ), new Vector2( - h, h ) ];
		const holes = hole ? [ hole.map( ( [ x, z ] ) => new Vector2( x, z ) ) ] : [];
		const tris = triangulateShape( contour, holes );
		const pts = contour.concat( ...holes );
		const pos = [], nrm = [];
		for ( const p of pts ) {

			pos.push( p.x, 0, p.y );
			nrm.push( 0, 1, 0 );

		}

		const index = [];
		for ( const [ a, b, c ] of tris ) index.push( a, c, b ); // counter-clockwise seen from above
		const geo = new BufferGeometry();
		geo.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		geo.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
		geo.setIndex( index );
		geo.computeBoundingBox();
		geo.computeBoundingSphere();

		this.material = standard( {
			name: 'ground',
			color: new Color( 0.1, 0.1, 0.095 ),
			roughness: 0.92,
			modules: [ commonModule ],
			surface: /* wgsl */`
	let xz = in.P.xz;
	// broad patches, then finer grain: worn asphalt
	let n = 0.5 + 0.28 * mx_noise_float2( xz * 0.04 ) + 0.14 * mx_noise_float2( xz * 0.5 ) + 0.07 * mx_noise_float2( xz * 6.0 );
	s.albedo = mat.color * ( 0.75 + 0.5 * n );
	// scrubby verges and vacant ground in broad patches between the streets and lots
	let verge = smoothstep( 0.15, 0.45, mx_noise_float2( xz * 0.012 + vec2f( 3.1, 7.7 ) ) );
	s.albedo = mix( s.albedo, vec3f( 0.1, 0.12, 0.06 ) * ( 0.8 + 0.4 * n ), verge * 0.7 );
`,
		} );
		this.material.underwaterLighting = 'none';
		const ground = new Mesh( geo, this.material );
		ground.name = 'ground-plane';
		ground.receiveShadow = true;
		ground.frustumCulled = false;
		this.group.add( ground );

	}

	heightAt( /* x, z */ ) {

		return 0;

	}

	update() {}

}
