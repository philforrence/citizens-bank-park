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
	constructor( { scene, hole = null, grid = null } ) {

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
${ grid ? /* wgsl */`
	// ---- L: past the complex (Complex.js's streets and lamps end ~700 m out) South Philadelphia at night:
	// its grid of streets under sodium cobra heads, dots along the lines, far off a carpet of orange
	// thinning into the haze (ref/night harpo42 2982166921, from Chestnut St on Oct 28, 2008). grid: the
	// street grid's axis in the world (the field frame's x) and the park's centre
	let far = smoothstep( 720.0, 950.0, length( xz - vec2f( ${ grid.centre[ 0 ].toFixed( 1 ) }, ${ grid.centre[ 1 ].toFixed( 1 ) } ) ) );
	if ( far > 0.0 && frame.night > 0.05 ) {
		let gax = vec2f( ${ grid.axis[ 0 ].toFixed( 5 ) }, ${ grid.axis[ 1 ].toFixed( 5 ) } );
		let g = vec2f( dot( xz, gax ), dot( xz, vec2f( - gax.y, gax.x ) ) );
		// each axis blurred by the pixel's own footprint along it: seen low and far, the footprint runs
		// long toward the horizon and stays narrow across it, so the streets running away from you
		// become lines of light and the cross streets rows of dots (the way the city looks from the stands)
		let fx = fwidth( g.x ); let fy = fwidth( g.y );
		// the north-south streets every 64 m, the cross streets every 48 m, a lamp every 30 m along each
		let dA = abs( fract( g.x / 64.0 + 0.5 ) - 0.5 ) * 64.0;
		let lA = abs( fract( g.y / 30.0 + 0.5 ) - 0.5 ) * 30.0;
		let dB = abs( fract( g.y / 48.0 + 0.5 ) - 0.5 ) * 48.0;
		let lB = abs( fract( g.x / 30.0 + 0.5 ) - 0.5 ) * 30.0;
		let rx = 9.0 + fx * fx; let ry = 9.0 + fy * fy;
		// a 1-D gaussian 3 m wide blurred to r keeps its area (its peak falls as 3 / r); blurred past its
		// period P it's the period's average, 5.32 / P
		let gx = 3.0 * inverseSqrt( rx ); let gy = 3.0 * inverseSqrt( ry );
		let ax = mix( exp( - dA * dA / rx ) * gx, 5.32 / 64.0, smoothstep( 16.0, 45.0, fx ) );
		let ay = mix( exp( - lA * lA / ry ) * gy, 5.32 / 30.0, smoothstep( 7.5, 21.0, fy ) );
		let bx = mix( exp( - lB * lB / rx ) * gx, 5.32 / 30.0, smoothstep( 7.5, 21.0, fx ) );
		let by = mix( exp( - dB * dB / ry ) * gy, 5.32 / 48.0, smoothstep( 12.0, 34.0, fy ) );
		// each street its own: an avenue brighter, a side street dimmer, one with its lamps out
		let sA = hash21( vec2f( floor( g.x / 64.0 + 0.5 ), 3.7 ) );
		let sB = hash21( vec2f( 8.1, floor( g.y / 48.0 + 0.5 ) ) );
		let k = ax * ay * mix( 0.25, 1.5, sA * sA ) + bx * by * mix( 0.25, 1.5, sB * sB );
		// here and there a block with its lamps out, a dark park, the rail yards
		let dark = smoothstep( 0.25, 0.55, mx_noise_float2( xz * 0.0021 + vec2f( 11.3, 2.9 ) ) );
		s.emissive = vec3f( 1.0, 0.55, 0.2 ) * k * 3.0 * far * ( 1.0 - 0.85 * dark ) * smoothstep( 0.1, 0.6, frame.night );
	}
	// ---- end L
` : '' }
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
