import { fieldBoundary, FOUL_TERRITORY, LEVELS } from '../../layout.js';
import { tierSections, rowHeights } from '../../Stands.js';
import { offsetPolyline } from '../../Bowl.js';
import { sectionAt } from '../../Concourse.js';
import { DUGOUT_ROOF } from '../../Field.js';

// Where the Phanatic can be and how he gets between those places, in the field frame (x, z metres from
// home plate, y up from the field): the warning track his ATV runs round, the dugout roofs, the aisles
// down through the field level seats (and the steps behind each dugout that come out onto its roof), the
// main concourse's ring round the infield at street level, and in Ashburn Alley the rail over the Rays'
// pen and Bull's BBQ. A way is a list of [ x, y, z ] points; walk it at a speed.

export const STREET = LEVELS.mainConcourse;

const len3 = ( a, b ) => Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] );

// A polyline to walk: at( s ) the point s metres along (and the flat heading there), `L` its length
export class Way {

	constructor( pts ) {

		this.pts = pts.filter( ( p, i ) => i === 0 || len3( p, pts[ i - 1 ] ) > 1e-3 );
		this.acc = [ 0 ];
		for ( let i = 1; i < this.pts.length; i ++ ) this.acc.push( this.acc[ i - 1 ] + len3( this.pts[ i - 1 ], this.pts[ i ] ) );
		this.L = this.acc[ this.acc.length - 1 ];

	}

	at( s ) {

		const P = this.pts, A = this.acc;
		s = Math.max( 0, Math.min( this.L, s ) );
		let i = 1;
		while ( i < P.length - 1 && A[ i ] < s ) i ++;
		const a = P[ i - 1 ], b = P[ i ] || a, l = ( A[ i ] - A[ i - 1 ] ) || 1;
		const k = ( s - A[ i - 1 ] ) / l;
		// the heading: flat, from the segment (a vertical step keeps the last one's)
		let j = i;
		while ( j > 1 && Math.hypot( P[ j ][ 0 ] - P[ j - 1 ][ 0 ], P[ j ][ 2 ] - P[ j - 1 ][ 2 ] ) < 1e-3 ) j --;
		const h0 = P[ j - 1 ], h1 = P[ j ] || h0;
		return {
			x: a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * k, y: a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * k, z: a[ 2 ] + ( b[ 2 ] - a[ 2 ] ) * k,
			yaw: Math.atan2( - ( h1[ 0 ] - h0[ 0 ] ), - ( h1[ 2 ] - h0[ 2 ] ) ),
		};

	}

	reversed() {

		return new Way( this.pts.slice().reverse() );

	}

	concat( w ) {

		return new Way( [ ...this.pts, ...( w.pts || w ) ] );

	}

}

export class Ways {

	constructor( { field, bowl } ) {

		this.field = field;
		// ---- the warning track: 2.2 m in from the fence (the ATV's line), from the left field corner round
		// to the right field corner, and on along the foul territory walls toward the dugouts
		const B = fieldBoundary();
		const inner = offsetPolyline( B, - 2.2, [ 0, - 40 ] );
		this.track = inner;
		// ---- the dugouts: the roof (its top DUGOUT_ROOF up) along its front, t metres back from the front
		// edge; the stairs behind its middle (the aisle between its two sections) come out onto it
		this.dugouts = {};
		for ( const d of field?.dugouts || [] ) this.dugouts[ d.side === 'third' ? '3B' : '1B' ] = d;
		// ---- the field level's seats: sections, their rows' heights, the aisles between them
		const tier = bowl?.tiers?.[ 0 ];
		this.tier = tier;
		this.secs = tier ? tierSections( tier ) : [];
		this.rowY = tier ? rowHeights( tier ) : [];
		this.backEdge = tier ? ( tier.start || 0 ) + tier.rows * tier.depth : 30;
		// ---- the main concourse's ring round the infield (People.js's walkers' line)
		this.ring = bowl?.path ? offsetPolyline( bowl.path, bowl.top + 4.2, [ 0, - 40 ] ) : null;
		this.ringWay = this.ring ? new Way( this.ring.map( ( [ x, z ] ) => [ x, STREET, z ] ) ) : null;

	}

	// ---- the roofs

	roofAt( side, s, t = 1.1 ) {

		const d = this.dugouts[ side ];
		const [ x, z ] = [ d.a[ 0 ] + d.ux * s + d.nx * t, d.a[ 1 ] + d.uz * s + d.nz * t ];
		return [ x, DUGOUT_ROOF, z ];

	}

	// facing the field from the roof (yaw), facing the crowd behind it
	roofFacing( side, toField = true ) {

		const d = this.dugouts[ side ];
		const f = toField ? [ - d.nx, - d.nz ] : [ d.nx, d.nz ];
		return Math.atan2( - f[ 0 ], - f[ 1 ] );

	}

	// the steps behind the dugout's middle: from the concourse's ring down to the first row behind the
	// roof, and onto the roof (its middle, t metres back); `s` the spot along the roof to end at
	roofStairs( side, sEnd = null, tEnd = 1.2 ) {

		const d = this.dugouts[ side ];
		const sm = d.len / 2;
		const P = ( dist, y ) => [ d.a[ 0 ] + d.ux * sm + d.nx * dist, y, d.a[ 1 ] + d.uz * sm + d.nz * dist ];
		const pts = [];
		// from the ring (on the concourse, behind the aisle's head)
		const head = P( this.backEdge + 3.6, STREET );
		pts.push( head, P( this.backEdge + 0.3, STREET ) );
		// down the steps, row by row (a step every row, level treads)
		const tier = this.tier, D = tier?.depth || 0.8, S0 = tier?.start || 0.4;
		for ( let r = ( tier?.rows || 37 ) - 1; r >= 4; r -= 3 ) pts.push( P( S0 + r * D + D * 0.5, this.rowY[ r ] ?? STREET ) );
		pts.push( P( S0 + 4 * D + 0.25, this.rowY[ 4 ] ?? 1.62 ) );
		// up onto the roof over its back edge, and along it
		pts.push( P( 2.45, DUGOUT_ROOF ) );
		const [ ex, , ez ] = this.roofAt( side, sEnd ?? sm, tEnd );
		pts.push( [ ex, DUGOUT_ROOF, ez ] );
		return new Way( pts );

	}

	// ---- the aisles

	// the point on the aisle after section k (between sections k and k + 1) `dist` metres back from the
	// front of the seats' polyline; y its step's height (the concourse behind the last row)
	aisleAt( k, dist ) {

		const S = this.secs[ k ];
		const s = S.len - S.m1 * dist;
		const x = S.a[ 0 ] + S.ux * s + S.nx * dist, z = S.a[ 1 ] + S.uz * s + S.nz * dist;
		const tier = this.tier, D = tier.depth, S0 = tier.start || 0;
		const r = ( dist - S0 ) / D;
		const i = Math.max( 0, Math.min( this.rowY.length - 1, Math.floor( r ) ) );
		const y = dist > this.backEdge ? STREET : this.rowY[ i ];
		return [ x, y, z ];

	}

	// the aisle's way from the concourse down to row `row` (the seat beside it: `seat`, the side the fans
	// he visits sit on and which way they face)
	aisle( k, row ) {

		const tier = this.tier, D = tier.depth, S0 = tier.start || 0;
		const pts = [ this.aisleAt( k, this.backEdge + 3.6 ), this.aisleAt( k, this.backEdge + 0.3 ) ];
		for ( let r = tier.rows - 1; r >= row; r -= 2 ) pts.push( this.aisleAt( k, S0 + r * D + D * 0.5 ) );
		pts.push( this.aisleAt( k, S0 + row * D + D * 0.5 ) );
		return new Way( pts );

	}

	// the aisle boundary nearest a point (field frame)
	aisleNear( x, z ) {

		let best = 0, bd = Infinity;
		for ( let k = 0; k < this.secs.length - 1; k ++ ) {

			if ( ! this.secs[ k ].seats && ! this.secs[ k + 1 ].seats ) continue;
			const [ ax, , az ] = this.aisleAt( k, this.backEdge * 0.5 );
			const d = Math.hypot( ax - x, az - z );
			if ( d < bd ) {

				bd = d; best = k;

			}

		}

		return best;

	}

	sectionOf( k ) {

		const [ x, , z ] = this.aisleAt( k, this.backEdge );
		return sectionAt( x, z );

	}

	// ---- the concourse ring

	// the distance along the ring nearest a point
	ringS( x, z ) {

		const P = this.ring;
		let best = Infinity, bestS = 0, acc = 0;
		for ( let i = 0; i < P.length - 1; i ++ ) {

			const a = P[ i ], b = P[ i + 1 ], l = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
			const t = Math.max( 0, Math.min( 1, ( ( x - a[ 0 ] ) * ( b[ 0 ] - a[ 0 ] ) + ( z - a[ 1 ] ) * ( b[ 1 ] - a[ 1 ] ) ) / ( l * l ) ) );
			const d = Math.hypot( a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t - x, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t - z );
			if ( d < best ) {

				best = d; bestS = acc + t * l;

			}

			acc += l;

		}

		return bestS;

	}

	// the ring from s0 to s1 (either way round the infield)
	ringFrom( s0, s1 ) {

		const W = this.ringWay, pts = [];
		const n = Math.max( 1, Math.ceil( Math.abs( s1 - s0 ) / 3 ) );
		for ( let i = 0; i <= n; i ++ ) {

			const p = W.at( s0 + ( s1 - s0 ) * i / n );
			pts.push( [ p.x, p.y, p.z ] );

		}

		return new Way( pts );

	}

	// ---- the warning track

	// the track's way between two points on it (the shorter way round the fence from one to the other)
	trackWay( from, to ) {

		const T = this.track;
		const near = ( p ) => {

			let best = 0, bd = Infinity;
			T.forEach( ( q, i ) => {

				const d = Math.hypot( q[ 0 ] - p[ 0 ], q[ 1 ] - p[ 1 ] );
				if ( d < bd ) {

					bd = d; best = i;

				}

			} );
			return best;

		};

		const i0 = near( from ), i1 = near( to );
		const pts = [ [ from[ 0 ], 0, from[ 1 ] ] ];
		const step = i1 >= i0 ? 1 : - 1;
		for ( let i = i0; i !== i1 + step; i += step ) pts.push( [ T[ i ][ 0 ], 0, T[ i ][ 1 ] ] );
		pts.push( [ to[ 0 ], 0, to[ 1 ] ] );
		return new Way( pts );

	}

}

export { FOUL_TERRITORY };
