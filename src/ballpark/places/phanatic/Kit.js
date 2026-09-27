import { BufferGeometry, Float32BufferAttribute, Matrix4, Matrix3, Vector3, Quaternion, Euler } from '../../../engine/index.js';

// A little merged-mesh builder for the Phanatic's things (the ATV, the launcher, the props): primitives
// placed by position, rotation and scale, each painted from a palette. The palette index goes into uv.x
// (the material's surface picks the colour: `i32( in.uv.x * N )`), and uv.y keeps the primitive's own v
// (0..1 along it: a tyre's tread, a stripe) or its u where `useU`.
//
//   const k = new Kit( N );
//   k.add( geo, pal, [ x, y, z ], [ rx, ry, rz ], [ sx, sy, sz ] );
//   const geometry = k.geometry();

export class Kit {

	constructor( n ) {

		this.n = n;
		this.pos = [];
		this.nrm = [];
		this.uv = [];
		this.index = [];
		this._m = new Matrix4();
		this._q = new Quaternion();
		this._e = new Euler();

	}

	// uv2: keep both of the primitive's uvs (a decal): u goes in the palette slot's fraction (the surface
	// reads it back as fract( in.uv.x * N )), v in uv.y
	add( geo, pal, p = [ 0, 0, 0 ], r = [ 0, 0, 0 ], s = [ 1, 1, 1 ], { useU = false, matrix = null, uv2 = false } = {} ) {

		const m = this._m.compose( new Vector3( ...p ), this._q.setFromEuler( this._e.set( r[ 0 ], r[ 1 ], r[ 2 ] ) ), new Vector3( ...( Array.isArray( s ) ? s : [ s, s, s ] ) ) );
		if ( matrix ) m.premultiply( matrix );
		const nm = new Matrix3().getNormalMatrix( m );
		const P = geo.getAttribute( 'position' ), N = geo.getAttribute( 'normal' ), U = geo.getAttribute( 'uv' );
		const base = this.pos.length / 3;
		const v = new Vector3(), n = new Vector3();
		const u = ( pal + 0.5 ) / this.n;
		for ( let i = 0; i < P.count; i ++ ) {

			v.fromBufferAttribute( P, i ).applyMatrix4( m );
			n.fromBufferAttribute( N, i ).applyMatrix3( nm ).normalize();
			this.pos.push( v.x, v.y, v.z );
			this.nrm.push( n.x, n.y, n.z );
			if ( uv2 && U ) this.uv.push( ( pal + 0.02 + 0.96 * U.getX( i ) ) / this.n, U.getY( i ) );
			else this.uv.push( u, U ? ( useU ? U.getX( i ) : U.getY( i ) ) : 0.5 );

		}

		const I = geo.index;
		if ( I ) for ( let i = 0; i < I.count; i ++ ) this.index.push( base + I.array[ i ] );
		else for ( let i = 0; i < P.count; i ++ ) this.index.push( base + i );
		return this;

	}

	// a tube from a to b ([ x, y, z ]), radius r, `seg` sides (a CylinderGeometry turned onto it)
	tube( geoOf, pal, a, b, r, seg = 8 ) {

		const d = new Vector3( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] );
		const L = d.length();
		if ( L < 1e-4 ) return this;
		const q = new Quaternion().setFromUnitVectors( new Vector3( 0, 1, 0 ), d.normalize() );
		const m = new Matrix4().compose( new Vector3( ( a[ 0 ] + b[ 0 ] ) / 2, ( a[ 1 ] + b[ 1 ] ) / 2, ( a[ 2 ] + b[ 2 ] ) / 2 ), q, new Vector3( r, L, r ) );
		return this.add( geoOf( seg ), pal, [ 0, 0, 0 ], [ 0, 0, 0 ], [ 1, 1, 1 ], { matrix: m } );

	}

	get triangles() {

		return this.index.length / 3;

	}

	geometry() {

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( this.pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( this.nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( this.uv, 2 ) );
		g.setIndex( this.index );
		g.computeBoundingSphere();
		return g;

	}

}
