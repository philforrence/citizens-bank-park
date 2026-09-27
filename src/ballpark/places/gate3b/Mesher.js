import { BufferGeometry, Float32BufferAttribute } from '../../../engine/index.js';

// An indexed mesh built by hand: smooth normals where the builder gives them, optional extra
// attributes. Kept to position / normal / uv when it's static, so geo.batchStatic can merge it.
//
//   const m = new Mesher( { aBone: 1 } );
//   const a = m.v( [ x, y, z ], [ nx, ny, nz ], [ u, v ], { aBone: [ 3 ] } );
//   m.tri( a, b, c ); m.quad( a, b, c, d );
//   m.geometry()
export class Mesher {

	constructor( extra = {} ) {

		this.pos = [];
		this.nrm = [];
		this.uv = [];
		this.extra = Object.fromEntries( Object.entries( extra ).map( ( [ k, n ] ) => [ k, { n, a: [] } ] ) );
		this.index = [];

	}

	get count() {

		return this.pos.length / 3;

	}

	v( p, n = [ 0, 1, 0 ], uv = [ 0, 0 ], ex = {} ) {

		this.pos.push( p[ 0 ], p[ 1 ], p[ 2 ] );
		const l = Math.hypot( n[ 0 ], n[ 1 ], n[ 2 ] ) || 1;
		this.nrm.push( n[ 0 ] / l, n[ 1 ] / l, n[ 2 ] / l );
		this.uv.push( uv[ 0 ], uv[ 1 ] );
		for ( const k in this.extra ) {

			const e = this.extra[ k ], val = ex[ k ] || [];
			for ( let i = 0; i < e.n; i ++ ) e.a.push( val[ i ] || 0 );

		}

		return this.count - 1;

	}

	tri( a, b, c ) {

		this.index.push( a, b, c );

	}

	quad( a, b, c, d ) {

		this.index.push( a, b, c, a, c, d );

	}

	// a flat quad from four points (wound so it faces n), one normal, uv corners
	face( A, B, C, D, n, uv = [ [ 0, 0 ], [ 1, 0 ], [ 1, 1 ], [ 0, 1 ] ], ex = {} ) {

		const e1 = [ B[ 0 ] - A[ 0 ], B[ 1 ] - A[ 1 ], B[ 2 ] - A[ 2 ] ], e2 = [ C[ 0 ] - A[ 0 ], C[ 1 ] - A[ 1 ], C[ 2 ] - A[ 2 ] ];
		const cr = [ e1[ 1 ] * e2[ 2 ] - e1[ 2 ] * e2[ 1 ], e1[ 2 ] * e2[ 0 ] - e1[ 0 ] * e2[ 2 ], e1[ 0 ] * e2[ 1 ] - e1[ 1 ] * e2[ 0 ] ];
		const a = this.v( A, n, uv[ 0 ], ex ), b = this.v( B, n, uv[ 1 ], ex ), c = this.v( C, n, uv[ 2 ], ex ), d = this.v( D, n, uv[ 3 ], ex );
		if ( cr[ 0 ] * n[ 0 ] + cr[ 1 ] * n[ 1 ] + cr[ 2 ] * n[ 2 ] >= 0 ) this.quad( a, b, c, d );
		else this.quad( a, d, c, b );

	}

	// an axis-aligned box (centre c, size s), flat faces, uv in metres
	box( c, s, ex = {} ) {

		const [ x, y, z ] = c, hx = s[ 0 ] / 2, hy = s[ 1 ] / 2, hz = s[ 2 ] / 2;
		const P = ( i, j, k ) => [ x + i * hx, y + j * hy, z + k * hz ];
		this.face( P( - 1, - 1, 1 ), P( 1, - 1, 1 ), P( 1, 1, 1 ), P( - 1, 1, 1 ), [ 0, 0, 1 ], undefined, ex );
		this.face( P( 1, - 1, - 1 ), P( - 1, - 1, - 1 ), P( - 1, 1, - 1 ), P( 1, 1, - 1 ), [ 0, 0, - 1 ], undefined, ex );
		this.face( P( 1, - 1, 1 ), P( 1, - 1, - 1 ), P( 1, 1, - 1 ), P( 1, 1, 1 ), [ 1, 0, 0 ], undefined, ex );
		this.face( P( - 1, - 1, - 1 ), P( - 1, - 1, 1 ), P( - 1, 1, 1 ), P( - 1, 1, - 1 ), [ - 1, 0, 0 ], undefined, ex );
		this.face( P( - 1, 1, 1 ), P( 1, 1, 1 ), P( 1, 1, - 1 ), P( - 1, 1, - 1 ), [ 0, 1, 0 ], undefined, ex );
		this.face( P( - 1, - 1, - 1 ), P( 1, - 1, - 1 ), P( 1, - 1, 1 ), P( - 1, - 1, 1 ), [ 0, - 1, 0 ], undefined, ex );

	}

	// A tube along a path of points [ [ x, y, z ], ... ] with radii, n sides, smooth; uv: x round
	// (0..1), y along (m). Ends capped if asked.
	tube( path, radii, n = 6, { capA = false, capB = false, ex = {}, v0 = 0 } = {} ) {

		const rings = [];
		let along = v0;
		// a frame carried along the path (no twist flips)
		let prevSide = null;
		for ( let i = 0; i < path.length; i ++ ) {

			const p = path[ i ];
			const a = path[ Math.max( 0, i - 1 ) ], b = path[ Math.min( path.length - 1, i + 1 ) ];
			let d = [ b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] ];
			const dl = Math.hypot( ...d ) || 1;
			d = d.map( ( x ) => x / dl );
			let side;
			if ( prevSide ) {

				// project the last side onto this ring's plane
				const k = prevSide[ 0 ] * d[ 0 ] + prevSide[ 1 ] * d[ 1 ] + prevSide[ 2 ] * d[ 2 ];
				side = [ prevSide[ 0 ] - d[ 0 ] * k, prevSide[ 1 ] - d[ 1 ] * k, prevSide[ 2 ] - d[ 2 ] * k ];

			} else side = Math.abs( d[ 1 ] ) > 0.9 ? [ 1, 0, 0 ] : [ - d[ 2 ], 0, d[ 0 ] ];
			const sl = Math.hypot( ...side ) || 1;
			side = side.map( ( x ) => x / sl );
			prevSide = side;
			const up = [ d[ 1 ] * side[ 2 ] - d[ 2 ] * side[ 1 ], d[ 2 ] * side[ 0 ] - d[ 0 ] * side[ 2 ], d[ 0 ] * side[ 1 ] - d[ 1 ] * side[ 0 ] ];
			if ( i > 0 ) along += Math.hypot( p[ 0 ] - path[ i - 1 ][ 0 ], p[ 1 ] - path[ i - 1 ][ 1 ], p[ 2 ] - path[ i - 1 ][ 2 ] );
			const r = radii[ i ], ring = [];
			for ( let k = 0; k <= n; k ++ ) {

				const t = k / n * Math.PI * 2, c = Math.cos( t ), s = Math.sin( t );
				const nn = [ side[ 0 ] * c + up[ 0 ] * s, side[ 1 ] * c + up[ 1 ] * s, side[ 2 ] * c + up[ 2 ] * s ];
				ring.push( this.v( [ p[ 0 ] + nn[ 0 ] * r, p[ 1 ] + nn[ 1 ] * r, p[ 2 ] + nn[ 2 ] * r ], nn, [ k / n, along ], ex ) );

			}

			rings.push( { ring, d, p } );

		}

		for ( let i = 0; i < rings.length - 1; i ++ ) for ( let k = 0; k < n; k ++ ) {

			const a = rings[ i ].ring[ k ], b = rings[ i ].ring[ k + 1 ], c = rings[ i + 1 ].ring[ k + 1 ], d = rings[ i + 1 ].ring[ k ];
			this.quad( a, d, c, b );

		}

		const cap = ( R, dir ) => {

			const c = this.v( R.p, dir, [ 0.5, 0 ], ex );
			for ( let k = 0; k < n; k ++ ) {

				if ( dir === R.d ) this.tri( c, R.ring[ k ], R.ring[ k + 1 ] );
				else this.tri( c, R.ring[ k + 1 ], R.ring[ k ] );

			}

		};

		if ( capA ) cap( rings[ 0 ], rings[ 0 ].d.map( ( x ) => - x ) );
		if ( capB ) cap( rings[ rings.length - 1 ], rings[ rings.length - 1 ].d );
		return rings;

	}

	geometry() {

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( this.pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( this.nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( this.uv, 2 ) );
		for ( const k in this.extra ) g.setAttribute( k, new Float32BufferAttribute( this.extra[ k ].a, this.extra[ k ].n ) );
		g.setIndex( this.index );
		g.computeBoundingBox();
		g.computeBoundingSphere();
		return g;

	}

}

// a seeded random stream (mulberry32)
export function rng( seed ) {

	let a = ( seed * 2654435761 ) >>> 0;
	return () => {

		a = ( a + 0x6D2B79F5 ) >>> 0;
		let t = a;
		t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
		t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;

	};

}
