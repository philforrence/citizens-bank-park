import { Matrix4, Vector3 } from '../engine/index.js';

// The rain stays out from under the decks: a map of the top of whatever's overhead (the heights of the
// decks, the stands, the roofs, the outer ring's floors) over the whole park, rasterized once from the
// bowl's, the facade's and the concourse's meshes (not the thin things: rails, lamps, the light towers,
// the netting; not what moves), for the rain's shader (Rain.setCover). The drops under a roof, the
// concourse's among them, aren't drawn. Built by the app from whatever's in scope (W2 wrote it for the
// third base concourse), before the static batching takes the bowl's meshes apart; ~15 ms.
//
//   const cover = rainCover( field, [ bowl.group, exterior.group, concourse.group ] );
//   rain.setCover( cover.heights, cover );

const SKIP = /^(rails|tower-|lamp-|pa-speakers|club-mullions|camera-|roof-edge-lights|columns|elevator-|netting|drink-rail|sign-posts|section-)/;

export function rainCover( field, roots ) {

	const F = field;
	F.group.updateMatrixWorld( true );
	const inv = new Matrix4().copy( F.group.matrixWorld ).invert();
	const m = new Matrix4();
	const cell = 0.75, nx = 400, nz = 400, x0 = - 150, z0 = - 180;
	const H = new Float32Array( nx * nz ).fill( - 1e4 );
	const a = new Vector3(), b = new Vector3(), c = new Vector3();
	const tri = ( ax, ay, az, bx, by, bz, cx, cy, cz ) => {

		const minX = Math.max( 0, Math.floor( ( Math.min( ax, bx, cx ) - x0 ) / cell ) ), maxX = Math.min( nx - 1, Math.floor( ( Math.max( ax, bx, cx ) - x0 ) / cell ) );
		const minZ = Math.max( 0, Math.floor( ( Math.min( az, bz, cz ) - z0 ) / cell ) ), maxZ = Math.min( nz - 1, Math.floor( ( Math.max( az, bz, cz ) - z0 ) / cell ) );
		const den = ( bz - cz ) * ( ax - cx ) + ( cx - bx ) * ( az - cz );
		if ( Math.abs( den ) < 1e-6 ) return;
		for ( let iz = minZ; iz <= maxZ; iz ++ ) for ( let ix = minX; ix <= maxX; ix ++ ) {

			const px = x0 + ( ix + 0.5 ) * cell, pz = z0 + ( iz + 0.5 ) * cell;
			const l1 = ( ( bz - cz ) * ( px - cx ) + ( cx - bx ) * ( pz - cz ) ) / den;
			const l2 = ( ( cz - az ) * ( px - cx ) + ( ax - cx ) * ( pz - cz ) ) / den;
			const l3 = 1 - l1 - l2;
			if ( l1 < - 1e-4 || l2 < - 1e-4 || l3 < - 1e-4 ) continue;
			const y = l1 * ay + l2 * by + l3 * cy, i = ix + iz * nx;
			if ( y > H[ i ] ) H[ i ] = y;

		}

	};

	for ( const root of roots ) {

		// (a part that isn't drawn, ?only=, holds no rain off)
		if ( ! root || ! root.parent ) continue;
		root.traverse( ( o ) => {

			if ( ! o.isMesh || o.isInstancedMesh || o.userData.dynamic || o.material?.transparent || SKIP.test( o.material?.name || '' ) ) return;
			const g = o.geometry, P = g.getAttribute( 'position' );
			if ( ! P ) return;
			m.multiplyMatrices( inv, o.matrixWorld );
			const idx = g.index ? g.index.array : null, n = idx ? idx.length : P.count;
			for ( let k = 0; k < n; k += 3 ) {

				a.fromBufferAttribute( P, idx ? idx[ k ] : k ).applyMatrix4( m );
				b.fromBufferAttribute( P, idx ? idx[ k + 1 ] : k + 1 ).applyMatrix4( m );
				c.fromBufferAttribute( P, idx ? idx[ k + 2 ] : k + 2 ).applyMatrix4( m );
				tri( a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z );

			}

		} );

	}

	return { heights: H, x0, z0, cell, nx, cos: Math.cos( F.group.rotation.y ), sin: Math.sin( F.group.rotation.y ), y0: F.group.position.y };

}
