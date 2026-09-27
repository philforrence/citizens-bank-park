import { InstancedMesh, BufferGeometry, Float32BufferAttribute, Matrix4, Quaternion, Vector3, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';

// Blankets on the laps on the 29th (44 °F and a wind off the river): a fleece in Phillies red, a
// stadium blanket in plaid, grey, navy; the Baptistes under one for two. Draped from the hips over the
// knees and down the shins; when they stand it's left on the seat in a heap. One instanced draw.

// the drape in the seat's frame (origin on the tread under the seat's middle, facing -z)
function drapeGeometry() {

	const NX = 7, NZ = 9, pos = [], idx = [];
	for ( let j = 0; j <= NZ; j ++ ) for ( let i = 0; i <= NX; i ++ ) {

		const u = i / NX, v = j / NZ;
		const x = ( u - 0.5 ) * 0.62;
		// along: over the thighs from the hips (v 0) to the knees (v 0.6), then down the shins
		const along = v < 0.6 ? v / 0.6 : 1;
		let z = 0.04 - 0.47 * along, y = 0.6 + 0.05 * Math.sin( along * Math.PI * 0.9 );
		if ( v >= 0.6 ) {

			const d = ( v - 0.6 ) / 0.4;
			z = - 0.43 - 0.08 * Math.sin( d * 1.2 );
			y = 0.64 - 0.42 * d;

		}

		// the sides fall over the outsides of the thighs; a fold or two
		const side = Math.abs( u - 0.5 ) * 2;
		y -= 0.16 * Math.max( 0, side - 0.55 ) / 0.45 * ( v < 0.6 ? 1 : 0.4 );
		y += 0.012 * Math.sin( u * 19 + v * 7 );
		pos.push( x, y, z );

	}

	for ( let j = 0; j < NZ; j ++ ) for ( let i = 0; i < NX; i ++ ) {

		const a = j * ( NX + 1 ) + i, b = a + 1, c = a + NX + 1, d = c + 1;
		idx.push( a, c, b, b, c, d );

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setIndex( idx );
	g.computeVertexNormals();
	g.setAttribute( 'uv', new Float32BufferAttribute( pos.flatMap( ( v, k ) => k % 3 === 0 ? [ v ] : k % 3 === 2 ? [ v ] : [] ), 2 ) );
	g.computeBoundingSphere();
	return g;

}

export const BLANKET = {
	red: [ 0.3, 0.02, 0.03 ], plaid: [ 10.13, 0.05, 0.03 ], grey: [ 0.24, 0.24, 0.25 ], navy: [ 0.02, 0.03, 0.09 ], shared: [ 10.3, 0.02, 0.03 ],
};

export class Blankets {

	constructor( parent, fans ) {

		this.list = fans.filter( ( f ) => f.kit.blanket );
		const mat = standard( { name: 'home-blankets', roughness: 1, side: 'double', varyings: { vC: 'vec3f', vUV: 'vec2f' },
			vertex: 'o.vC = v.color.rgb; o.vUV = v.uv;',
			surface: /* wgsl */`
	var c = in.vs.vC;
	// a stadium blanket's plaid (r > 5): its colour, dark bands and a pale stripe both ways
	if ( c.r > 5.0 ) {
		c = vec3f( c.r - 10.0, c.g, c.b );
		let p = in.vs.vUV * vec2f( 9.0, 7.0 );
		let band = step( 0.62, fract( p.x ) ) + step( 0.62, fract( p.y ) );
		c = mix( c, c * 0.35, clamp( band, 0.0, 1.0 ) * 0.6 );
		c = mix( c, vec3f( 0.55, 0.52, 0.45 ), step( 0.93, fract( p.x + 0.3 ) ) * 0.7 + step( 0.93, fract( p.y + 0.3 ) ) * 0.7 );
	}
	// fleece: soft, a sheen at the edges
	s.albedo = c * ( 0.92 + 0.08 * sin( in.vs.vUV.x * 180.0 ) );
	s.roughness = 0.95;
	s.emissive = s.albedo * smoothstep( 0.15, 0.7, frame.night ) * 0.1;
` } );
		mat.underwaterLighting = 'none';
		mat.setDefine( 'DRY', 1 );
		this.mesh = new InstancedMesh( drapeGeometry(), mat, Math.max( 1, this.list.length ) );
		this.mesh.name = 'home-blankets';
		this.mesh.frustumCulled = false;
		this.mesh.castShadow = false;
		this.mesh.userData.dynamic = true;
		const col = new Color();
		this.list.forEach( ( f, i ) => this.mesh.setColorAt( i, col.setRGB( ...( BLANKET[ f.kit.blanket ] || BLANKET.red ) ) ) );
		this.mesh.count = 0;
		parent.add( this.mesh );
		this._m = new Matrix4(); this._q = new Quaternion(); this._v = new Vector3(); this._s = new Vector3(); this._up = new Vector3( 0, 1, 0 );

	}

	update( N ) {

		let n = 0;
		if ( ! N.first ) this.list.forEach( ( f, i ) => {

			const s = f.seat;
			// seated: over the lap; up: left in a heap on the seat
			const heap = f.up > 0.4 || f.away || f.driven;
			const wide = f.kit.blanket === 'shared' ? 1.85 : 1;
			// the shared one spans him and his neighbour on his right
			const off = f.kit.blanket === 'shared' ? - 0.25 : 0;
			this._q.setFromAxisAngle( this._up, s.yaw );
			this._s.set( wide, heap ? 0.35 : 1, heap ? 0.55 : 1 );
			this._v.set( s.x + s.rx * off + ( heap ? s.nx * 0.12 : 0 ), s.y + ( heap ? 0.24 : 0 ), s.z + s.rz * off + ( heap ? s.nz * 0.12 : 0 ) );
			this._m.compose( this._v, this._q, this._s );
			this.mesh.setMatrixAt( n, this._m );
			if ( n !== i ) {

				const c = new Color();
				this.mesh.setColorAt( n, c.setRGB( ...( BLANKET[ f.kit.blanket ] || BLANKET.red ) ) );

			}

			n ++;

		} );
		this.mesh.count = n;
		this.mesh.instanceMatrix.needsUpdate = true;
		if ( this.mesh.instanceColor ) this.mesh.instanceColor.needsUpdate = true;

	}

}
