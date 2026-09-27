import { Group, Matrix4, Vector3 } from '../../engine/index.js';
import { LEVELS } from '../layout.js';

// The main concourse from behind home plate round to the third base side (sections 123 to 135): the
// walk in from the Third Base Gate to your seat, at street level, under the suite level and open to the
// field. Concourse.js built its bones (the stands and their kitchens, the drink rail, the section
// plates); this is the place itself on the night: the people, what stands about on the floor, what's on
// the TVs, the weather tracked in on everything.
//
// Field frame (in the Field's group): x, z metres from the back tip of home plate, -z toward center
// field, y up from the field; the concourse floor is at LEVELS.mainConcourse. Along the concourse the
// place works in its own ( s, d ) (Concourse3BKit.Walkway): s along it from behind home plate (s = 0 at
// x = 0) toward third, d out from the field level's front line.
const STREET = LEVELS.mainConcourse;
// the stretch: from behind home plate to the Hatfield Grill behind 135
export const S_END = 118;

export default class Concourse3B {

	constructor( { app, field, bowl } ) {

		this.app = app;
		this.field = field;
		this.bowl = bowl;
		this.group = new Group();
		this.group.name = 'concourse3b';
		this.concourse = app?.concourse;
		this._cover = null;

	}

	// The rain stays out from under the decks: a map of the top of whatever's overhead (the heights of the
	// decks, the stands, the roofs, the outer ring's floors) over the whole park, rasterized once from the
	// bowl's and the facade's meshes (not the thin things: rails, lamps, the light towers, the netting),
	// for the rain's shader (Rain.setCover). The drops under a roof, the concourse's among them, aren't
	// drawn.
	_rainCover() {

		const F = this.field;
		F.group.updateMatrixWorld( true );
		const inv = new Matrix4().copy( F.group.matrixWorld ).invert();
		const m = new Matrix4();
		const cell = 0.75, nx = 400, nz = 400, x0 = - 150, z0 = - 180;
		const H = new Float32Array( nx * nz ).fill( - 1e4 );
		const skip = /^(rails|tower-|lamp-|pa-speakers|club-mullions|camera-|roof-edge-lights|columns|elevator-|netting|drink-rail|sign-posts|section-)/;
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

		for ( const root of [ this.bowl.group, this.app?.exterior?.group, this.concourse?.group ] ) root?.traverse( ( o ) => {

			if ( ! o.isMesh || o.isInstancedMesh || o.material?.transparent || skip.test( o.material?.name || '' ) ) return;
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
		return { heights: H, x0, z0, cell, nx, cos: Math.cos( F.group.rotation.y ), sin: Math.sin( F.group.rotation.y ), y0: F.group.position.y };

	}

	update( dt, director ) {

		// the rain's cover, once the rain exists (it's made after the places)
		const rain = this.app?.rain;
		if ( rain?.setCover && ! this._coverSet ) {

			const t0 = performance.now();
			const cover = this._rainCover();
			rain.setCover( cover.heights, cover );
			this._coverSet = true;
			this.coverMs = Math.round( performance.now() - t0 );

		}

		void director;

	}

}
