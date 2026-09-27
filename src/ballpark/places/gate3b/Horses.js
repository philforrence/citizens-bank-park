import { InstancedMesh, Matrix4, Quaternion, Vector3, Sphere, Mesh, Color } from '../../../engine/index.js';
import { StorageBuffer } from '../../../engine/gpu/Texture.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { Mesher } from './Mesher.js';

// The Pennsylvania State Police's mounted patrol at the park (the Inquirer, 30 Oct 2008: "manure left by
// the horses from the Pennsylvania State Police mounted patrols"; Philadelphia's own mounted unit was
// disbanded from 2004 to 2011): two big horses, bay and black, in black tack with white leg wraps and
// reflective bands, standing their ground at the edge of Pattison with a trooper up on each, shifting
// a hoof, a head coming down and up, a tail flicking the rain off; a kid reaching up to pat a nose.
//
// A horse is one instanced mesh posed in the vertex shader: the body; the neck and head (raised and
// lowered about the withers); the tail (swung about its root); four legs, each an upper and a lower
// bone, stepping in a four-beat walk. Faces -z at yaw 0, like the people.

const K = 2; // vec4s per horse
// the joints: the legs' tops, knees and hocks, the withers, the tail's root
const LEG = {
	FL: { top: [ - 0.19, 1.08, - 0.7 ], knee: [ - 0.19, 0.55, - 0.72 ], off: 0.25, back: false },
	FR: { top: [ 0.19, 1.08, - 0.7 ], knee: [ 0.19, 0.55, - 0.72 ], off: 0.75, back: false },
	HL: { top: [ - 0.2, 1.18, 0.7 ], knee: [ - 0.2, 0.6, 0.86 ], off: 0.0, back: true },
	HR: { top: [ 0.2, 1.18, 0.7 ], knee: [ 0.2, 0.6, 0.86 ], off: 0.5, back: true },
};
const NECK = [ 0, 1.5, - 0.78 ], TAIL = [ 0, 1.46, 0.98 ];

function horseGeometry() {

	const m = new Mesher( { aHorse: 2 } );
	const B = ( bone, part ) => ( { aHorse: [ bone, part ] } );
	// the body, rump to chest, a little deeper than wide
	const body = [ [ 0, 1.33, 1.02 ], [ 0, 1.3, 0.8 ], [ 0, 1.28, 0.4 ], [ 0, 1.28, 0.0 ], [ 0, 1.3, - 0.4 ], [ 0, 1.3, - 0.72 ], [ 0, 1.24, - 0.95 ] ];
	m.tube( body, [ 0.2, 0.36, 0.39, 0.41, 0.4, 0.35, 0.22 ], 12, { capA: true, capB: true, ex: B( 0, 0 ) } );
	// the neck up to the poll, the head down to the muzzle, the ears, the mane
	m.tube( [ [ 0, 1.42, - 0.78 ], [ 0, 1.65, - 1.05 ], [ 0, 1.92, - 1.3 ] ], [ 0.27, 0.2, 0.14 ], 10, { ex: B( 1, 1 ) } );
	m.tube( [ [ 0, 2.0, - 1.34 ], [ 0, 1.78, - 1.55 ], [ 0, 1.52, - 1.74 ] ], [ 0.13, 0.12, 0.09 ], 9, { capA: true, capB: true, ex: B( 1, 2 ) } );
	for ( const s of [ - 1, 1 ] ) m.tube( [ [ s * 0.06, 2.05, - 1.33 ], [ s * 0.08, 2.2, - 1.31 ] ], [ 0.035, 0.008 ], 5, { capB: true, ex: B( 1, 2 ) } );
	for ( let i = 0; i < 6; i ++ ) {

		const t0 = i / 6, t1 = ( i + 1 ) / 6;
		const at = ( t ) => [ 0, 1.52 + t * 0.44, - 0.8 - t * 0.52 ];
		const a = at( t0 ), b = at( t1 );
		m.face( [ 0, a[ 1 ] + 0.2, a[ 2 ] + 0.04 ], [ 0, b[ 1 ] + 0.18, b[ 2 ] + 0.04 ], [ 0.02, b[ 1 ] + 0.02, b[ 2 ] + 0.08 ], [ 0.02, a[ 1 ] + 0.02, a[ 2 ] + 0.08 ], [ 1, 0, 0 ], undefined, B( 1, 3 ) );
		m.face( [ 0, a[ 1 ] + 0.2, a[ 2 ] + 0.04 ], [ - 0.02, a[ 1 ] + 0.02, a[ 2 ] + 0.08 ], [ - 0.02, b[ 1 ] + 0.02, b[ 2 ] + 0.08 ], [ 0, b[ 1 ] + 0.18, b[ 2 ] + 0.04 ], [ - 1, 0, 0 ], undefined, B( 1, 3 ) );

	}

	// the tail, full, down past the hocks
	m.tube( [ [ 0, 1.46, 0.98 ], [ 0, 1.35, 1.12 ], [ 0, 1.0, 1.2 ], [ 0, 0.62, 1.18 ] ], [ 0.07, 0.1, 0.13, 0.08 ], 7, { capB: true, ex: B( 2, 3 ) } );
	// the legs: upper (bone 3 + 2i), lower (4 + 2i); a hoof
	Object.values( LEG ).forEach( ( L, i ) => {

		const [ x, y0, z0 ] = L.top, [ , yk, zk ] = L.knee;
		const up = L.back ? [ [ x, y0 + 0.05, z0 ], [ x, 0.9, z0 + 0.1 ], [ x, yk, zk ] ] : [ [ x, y0 + 0.05, z0 ], [ x, 0.8, z0 - 0.02 ], [ x, yk, zk ] ];
		m.tube( up, L.back ? [ 0.17, 0.11, 0.07 ] : [ 0.13, 0.09, 0.07 ], 7, { ex: B( 3 + i * 2, 4 ) } );
		const zf = zk + ( L.back ? - 0.06 : 0.0 );
		m.tube( [ [ x, yk, zk ], [ x, 0.2, zf ], [ x, 0.1, zf - 0.03 ] ], [ 0.055, 0.045, 0.05 ], 7, { ex: B( 4 + i * 2, 5 ) } );
		m.tube( [ [ x, 0.1, zf - 0.03 ], [ x, 0.0, zf - 0.07 ] ], [ 0.06, 0.075 ], 8, { capB: true, ex: B( 4 + i * 2, 6 ) } );

	} );
	// the saddle and its pad, the stirrups hanging; the reins from the bit up over the neck
	m.box( [ 0, 1.705, - 0.05 ], [ 0.72, 0.035, 0.85 ], B( 0, 7 ) );
	m.box( [ 0, 1.75, 0.0 ], [ 0.4, 0.08, 0.56 ], B( 0, 8 ) );
	m.box( [ 0, 1.8, 0.25 ], [ 0.36, 0.1, 0.07 ], B( 0, 8 ) );
	m.box( [ 0, 1.81, - 0.27 ], [ 0.24, 0.12, 0.08 ], B( 0, 8 ) );
	for ( const s of [ - 1, 1 ] ) {

		m.tube( [ [ s * 0.3, 1.66, - 0.12 ], [ s * 0.36, 1.1, - 0.12 ] ], [ 0.012, 0.012 ], 4, { ex: B( 0, 8 ) } );
		m.box( [ s * 0.37, 1.06, - 0.12 ], [ 0.05, 0.05, 0.12 ], B( 0, 8 ) );
		m.tube( [ [ s * 0.1, 1.6, - 1.68 ], [ s * 0.16, 1.62, - 1.2 ], [ s * 0.18, 1.72, - 0.6 ], [ s * 0.12, 1.95, - 0.35 ] ], [ 0.008, 0.008, 0.008, 0.008 ], 4, { ex: B( 1, 8 ) } );

	}

	return m.geometry();

}

function horseMaterial( info ) {

	const f = ( v ) => v.map( ( x ) => x.toFixed( 3 ) ).join( ', ' );
	const legs = Object.values( LEG );
	return standard( {
		name: 'w1-horses', roughness: 0.6, side: 'double', modules: [ commonModule ],
		storage: { horseInfo: info },
		attributes: { aHorse: 'vec2f' },
		varyings: { vHorse: 'vec2f', vLocal: 'vec3f', vCoat: 'f32' },
		vertex: /* wgsl */`
	// info: 0 (phase, walk, neck: how far the head's down, tail swish) 1 (coat, a shiver, -, -)
	let i0 = horseInfo[ v.instance * ${ K }u ];
	let i1 = horseInfo[ v.instance * ${ K }u + 1u ];
	let bone = u32( v.aHorse.x + 0.5 );
	var p = v.position;
	var n = v.normal;
	if ( bone == 1u ) {
		// the neck and head: down to graze or look, up, and a nod in the walk
		let a = i0.z + i0.y * 0.08 * sin( i0.x * 12.566 );
		let c = vec3f( ${ f( NECK ) } );
		let q = p - c;
		let cs = cos( a ); let sn = sin( a );
		p = c + vec3f( q.x, q.y * cs + q.z * sn, - q.y * sn + q.z * cs );
		n = vec3f( n.x, n.y * cs + n.z * sn, - n.y * sn + n.z * cs );
	}
	if ( bone == 2u ) {
		// the tail swinging from its root
		let a = i0.w;
		let c = vec3f( ${ f( TAIL ) } );
		let q = p - c;
		let cs = cos( a ); let sn = sin( a );
		p = c + vec3f( q.x * cs - q.z * sn * 0.0 + q.y * sn * 0.6, q.y, q.z ) ;
	}
	if ( bone >= 3u ) {
		// the legs: which, upper or lower; the swing of the upper about its top, the bend of the lower at
		// the knee (forward for the front legs' knees, back for the hocks)
		let li = ( bone - 3u ) / 2u;
		let lower = ( bone - 3u ) % 2u == 1u;
		var top = vec3f( 0.0 ); var knee = vec3f( 0.0 ); var off = 0.0; var back = 0.0;
		${ legs.map( ( L, i ) => `if ( li == ${ i }u ) { top = vec3f( ${ f( L.top ) } ); knee = vec3f( ${ f( L.knee ) } ); off = ${ L.off.toFixed( 2 ) }; back = ${ L.back ? '1.0' : '0.0' }; }` ).join( '\n\t\t' ) }
		let ph = ( i0.x + off ) * 6.2832;
		let swing = i0.y * 0.32 * sin( ph );
		let bend = i0.y * 0.7 * max( 0.0, cos( ph ) ) * select( - 1.0, 0.7, back > 0.5 );
		// the lower leg first (about the knee), then the whole leg (about the top)
		if ( lower ) {
			let q = p - knee;
			let cs = cos( bend ); let sn = sin( bend );
			p = knee + vec3f( q.x, q.y * cs - q.z * sn, q.y * sn + q.z * cs );
		}
		let q2 = p - top;
		let cs2 = cos( swing ); let sn2 = sin( swing );
		p = top + vec3f( q2.x, q2.y * cs2 - q2.z * sn2, q2.y * sn2 + q2.z * cs2 );
	}
	// the body rocks a little in the walk
	p.y += i0.y * 0.025 * sin( i0.x * 12.566 );
	v.useWorld = true;
	v.worldPos = ( v.model * vec4f( p, 1.0 ) ).xyz;
	v.worldNormal = normalize( ( v.model * vec4f( n, 0.0 ) ).xyz );
	o.vHorse = v.aHorse;
	o.vLocal = v.position;
	o.vCoat = i1.x;
`,
		surface: /* wgsl */`
	let part = i32( in.vs.vHorse.y + 0.5 );
	let L = in.vs.vLocal;
	let coat = in.vs.vCoat;
	// a bay (red-brown, black points), a dark bay, a black
	var body = mix( vec3f( 0.16, 0.06, 0.025 ), vec3f( 0.07, 0.03, 0.015 ), step( 0.5, coat ) );
	if ( coat > 1.5 ) { body = vec3f( 0.016, 0.014, 0.013 ); }
	let points = vec3f( 0.012, 0.01, 0.01 );
	var c = body * ( 0.9 + 0.12 * mx_noise_float3( L * 6.0 ) );
	var rough = 0.55;
	// the coat's sheen, the dapples
	if ( part == 4 || part == 5 ) { c = mix( c, points, smoothstep( 0.9, 0.6, L.y ) ); }
	if ( part == 3 ) { c = points; rough = 0.7; }
	if ( part == 2 ) {
		// the head: the bridle (black leather straps), a white blaze down the face on the bay
		let noseband = abs( L.y - ( 1.62 + ( L.z + 1.7 ) * - 0.9 ) ) < 0.025;
		let brow = abs( L.z + 1.42 ) < 0.02 && L.y > 1.85;
		let cheek = abs( abs( L.x ) - 0.1 ) < 0.02 && L.y > 1.6;
		if ( noseband || brow || cheek ) { c = vec3f( 0.01 ); rough = 0.35; }
		if ( coat < 0.5 && abs( L.x ) < 0.025 && L.z < - 1.4 && L.y > 1.6 ) { c = vec3f( 0.6, 0.58, 0.54 ); }
	}
	// the legs: white wraps from the fetlock up, a reflective band round them
	if ( part == 5 && L.y > 0.12 && L.y < 0.45 ) { c = vec3f( 0.72, 0.72, 0.7 ); rough = 0.9; if ( abs( L.y - 0.3 ) < 0.03 ) { c = vec3f( 0.8, 0.8, 0.6 ); } }
	if ( part == 6 ) { c = vec3f( 0.02, 0.018, 0.016 ); rough = 0.4; }
	// the saddle, the pad (navy with a gold edge: the State Police's), the reins
	if ( part == 7 ) { c = vec3f( 0.02, 0.025, 0.06 ); if ( abs( abs( L.x ) - 0.31 ) < 0.02 ) { c = vec3f( 0.45, 0.33, 0.08 ); } rough = 0.8; }
	if ( part == 8 ) { c = vec3f( 0.012, 0.01, 0.009 ); rough = 0.35; }
	// the rain: the coat soaked dark and shining
	let wet = frame.wet * select( 1.0, 0.4, part >= 6 );
	c = c * mix( 1.0, 0.7, wet );
	rough = mix( rough, 0.22, wet );
	s.albedo = c;
	s.roughness = rough;
	s.emissive = c * smoothstep( 0.15, 0.7, frame.night ) * 0.05 + select( vec3f( 0.0 ), vec3f( 0.25, 0.25, 0.18 ), part == 5 && abs( L.y - 0.3 ) < 0.03 ) * smoothstep( 0.15, 0.7, frame.night );
`,
	} );

}

export class Horses {

	// spots: [ { at: [ x, z ], yaw, coat } ]; y: the ground's height
	constructor( { group, folk, y, spots } ) {

		this.info = new Float32Array( spots.length * K * 4 );
		this.buffer = new StorageBuffer( { label: 'horseInfo', count: Math.max( 1, spots.length ) * K, type: 'vec4f' } );
		const mat = horseMaterial( this.buffer );
		mat.setDefine( 'DRY', 1 );
		mat.underwaterLighting = 'none';
		this.mesh = new InstancedMesh( horseGeometry(), mat, spots.length );
		this.mesh.name = 'w1-horses';
		this.mesh.frustumCulled = false;
		this.mesh.castShadow = true;
		this.mesh.receiveShadow = true;
		this.mesh.userData.dynamic = true;
		const c = spots[ 0 ].at;
		this.mesh.boundingSphere = new Sphere( new Vector3( c[ 0 ], y, c[ 1 ] ), 12 );
		group.add( this.mesh );
		this.y = y;
		this.list = spots.map( ( s, i ) => ( { ...s, x: s.at[ 0 ], z: s.at[ 1 ], phase: i * 0.37, walk: 0, neck: 0.1, tail: 0, t: i * 11.3, step: 0 } ) );
		this._m = new Matrix4();
		this._q = new Quaternion();
		this._up = new Vector3( 0, 1, 0 );
		this.write();

	}

	update( dt ) {

		for ( const h of this.list ) {

			h.t += dt;
			// standing: a hoof shifted now and then (a step: a little of the walk and back), the head down
			// and up, the tail flicking
			const cyc = h.t % 17;
			h.walk = cyc > 11 && cyc < 12.4 ? Math.sin( ( cyc - 11 ) / 1.4 * Math.PI ) * 0.6 : 0;
			h.phase += dt * 0.8 * h.walk;
			h.neck = 0.1 + 0.25 * Math.max( 0, Math.sin( h.t * 0.13 + h.coat * 2 ) ) ** 3 - 0.1 * Math.max( 0, Math.sin( h.t * 0.41 ) ) ** 8;
			h.tail = 0.35 * Math.sin( h.t * 2.1 ) * Math.max( 0, Math.sin( h.t * 0.37 + h.coat ) ) ** 4;

		}

		this.write();

	}

	write() {

		const M = this._m;
		this.list.forEach( ( h, i ) => {

			this._q.setFromAxisAngle( this._up, h.yaw );
			M.compose( new Vector3( h.x, this.y, h.z ), this._q, new Vector3( 1, 1, 1 ) );
			this.mesh.setMatrixAt( i, M );
			this.info.set( [ h.phase, h.walk, h.neck, h.tail, h.coat, 0, 0, 0 ], i * K * 4 );

		} );
		this.mesh.instanceMatrix.needsUpdate = true;
		this.buffer.write( this.info );

	}

	// where a rider sits: the saddle's seat in the field frame
	seat( h ) {

		const s = Math.sin( h.yaw ), c = Math.cos( h.yaw );
		return [ h.x + s * 0.02, this.y + 1.8, h.z + c * 0.02 ];

	}

}

// what the horses leave behind on the pavement
export function manure( group, y, spots ) {

	const m = new Mesher();
	let k = 0;
	for ( const [ x, z ] of spots ) for ( let i = 0; i < 6; i ++ ) {

		const q = ( k ++ ) * 2.3;
		m.tube( [ [ x + Math.cos( q ) * 0.12, y, z + Math.sin( q ) * 0.12 ], [ x + Math.cos( q ) * 0.12, y + 0.07, z + Math.sin( q ) * 0.12 ] ], [ 0.07, 0.04 ], 6, { capB: true } );

	}

	const mesh = new Mesh( m.geometry(), standard( { name: 'w1-manure', color: new Color( 0.07, 0.05, 0.025 ), roughness: 0.5 } ) );
	mesh.name = 'w1-manure';
	group.add( mesh );

}
