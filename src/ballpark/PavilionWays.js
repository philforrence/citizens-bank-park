import { Mesh, Color, Vector3 } from '../engine/index.js';
import { standard } from '../materials/Materials.js';
import { Quads } from './Stands.js';
import { beam } from './geo.js';
import { LEVELS } from './layout.js';

// FA1 (step 10, WA2-1, WA2-10, WA1-1, WA1-5): the ways up to the Pavilion (201-211) and the Pavilion Deck
// (301-310) in right field, which nothing reached. The Phillies' "Finding Your Seats" (the building's
// circulation, unchanged since 2004): 201-205 "Elevator or Stairs in Ashburn Alley", 301-305 "to the 200
// level and then additional stairs to the 300 level", 306-310 "elevator behind sect 112 up to the 200
// level then stairs"; the 2008 guide's family restrooms "behind 205 and 208" (the Pavilion's own concourse,
// up a storey and a half from the Alley). The Alley's stair as the 2008 photos draw the park's outfield
// steel (the rooftop bleachers' stair, the bridge by the 147/148 plate): maroon stringers and columns,
// galvanized treads with dark nosings and galvanized pipe rails; a two-flight switchback against the
// Pavilion's open end, an elevator in a precast tower beside it, a bridge from the top landing onto the
// Pavilion's concourse.
//
//   pavilionWays( bowl, { pav, deck } ) -> { banks }   (bowl._elevators builds the banks' doors and stops)
//
// Field frame throughout; every tread and landing is a walkable collider, every edge a rail collider.

const STREET = LEVELS.mainConcourse;
const RUN = 0.28; // a tread (11 in)

export function pavilionWays( bowl, { pav, deck } ) {

	const K = new Kit( bowl );
	const banks = [];
	const yPav = pav.y0 + ( pav.rows - 1 ) * pav.rise + 0.25; // the Pavilion's concourse (17.12)
	const dPav = pav.rows * pav.depth; // its front edge, back from the Pavilion's front line

	// ---------------------------------------------------------------- the Alley's stair and elevator
	// In the frame of the Pavilion's NW end: s along its front toward the pole (negative: out past its end,
	// over the Alley), d back from its front line (away from the field)
	const E = endFrame( pav.front[ 0 ], pav.front[ 1 ] );
	{

		const rise = yPav - STREET, n = Math.round( rise / 0.18 ), r = rise / n, n1 = Math.floor( n / 2 ), n2 = n - n1;
		const yMid = STREET + n1 * r;
		const dT = 11.0; // the top landing's front: on the concourse's depth (10.08-14.08)
		const dL = dT - n2 * RUN; // the half landing's back
		// the lower flight climbs toward the field, out past the end; the upper one back up beside the end
		K.flight( E, { s0: - 3.45, s1: - 2.05, d0: dL + n1 * RUN, dir: - 1, y0: STREET, n: n1, r } );
		K.landing( E, { s0: - 3.45, s1: - 0.3, d0: dL - 1.5, d1: dL, y: yMid, rails: [ 'd0', 's0' ], posts: true } );
		K.flight( E, { s0: - 1.75, s1: - 0.35, d0: dL, dir: 1, y0: yMid, n: n2, r } );
		// the top landing, a bridge from the elevator's upper door to the concourse
		const dD = dT + 2.6; // the elevator's doors (behind the concourse's stand at the Alley's end: Concourse)
		K.landing( E, { s0: - 4.6, s1: 0.06, d0: dT, d1: dD, y: yPav, rails: [ 'd0:-4.6:-1.8', 'd1:-1.9:0.06', 's0' ], posts: true } );
		// the elevator's tower behind it, its doors toward the field at both levels
		K.tower( E, { s0: - 4.5, s1: - 2.0, d0: dD, d1: dD + 2.6, y0: STREET, y1: yPav + 3.4 } );
		const door = E.at( - 3.25, dD ), out = [ - E.n[ 0 ], - E.n[ 1 ] ];
		banks.push( { stops: [
			{ name: 'Ashburn Alley', y: STREET, door, out },
			{ name: 'Pavilion', y: yPav, door, out },
		] } );
		// the Pavilion's open end: a pipe rail at every row's end, up to its concourse; the concourse's end
		// railed where the bridge doesn't meet it
		K.endRail( pav, E, 0, pav.rows );
		K.rail( E.at( 0.02, dPav ), E.at( 0.02, dT ), yPav );
		K.rail( E.at( 0.02, dD ), E.at( 0.02, dPav + 4 ), yPav );

	}

	// ---------------------------------------------------------------- the Pavilion's concourse
	// its back (the galleries' counters and the glass, drawn by Concourse and Bowl) solid, so you can't walk
	// through them and fall 10 m to the main concourse (WA1-5); its far end at The Break railed
	{

		const G = offsetPolyline( pav.front, dPav + 4 - 0.02 );
		for ( let i = 0; i < G.length - 1; i ++ ) K.wall( G[ i ], G[ i + 1 ], yPav, 2.4 );
		const m = pav.front.length - 1, Z = endFrame( pav.front[ m ], pav.front[ m - 1 ] );
		K.rail( Z.at( 0.02, dPav ), Z.at( 0.02, dPav + 4 ), yPav );
		K.endRail( pav, Z, 0, pav.rows, true );

	}

	// ---------------------------------------------------------------- the Deck's open ends and walkway
	{

		const D = endFrame( deck.front[ 0 ], deck.front[ 1 ] );
		const dTop = deck.rows * deck.depth, yTop = deck.y0 + ( deck.rows - 1 ) * deck.rise;
		K.endRail( deck, D, 0, deck.rows );
		K.rail( D.at( 0.02, dTop ), D.at( 0.02, dTop + 4 ), yTop );
		const m = deck.front.length - 1, Z = endFrame( deck.front[ m ], deck.front[ m - 1 ] );
		K.endRail( deck, Z, 0, deck.rows, true );
		K.rail( Z.at( 0.02, dTop ), Z.at( 0.02, dTop + 4 ), yTop );

	}

	// ---------------------------------------------------------------- the Deck's row-7 entrances
	// From the Pavilion's concourse a steel stair runs along it under the Deck and up through each open portal
	// (Stands.js: rows 8-12 cut out of every other section, the box over them, its mouth on row 7): 40
	// risers of 18 cm, its well railed on the box's floor, stepped off sideways at the top and out through
	// the mouth onto row 7 (a cross-aisle in that section) to the aisles. Each climbs the way that keeps its
	// foot on the concourse
	{

		const nearPav = ( x, z ) => {

			let best = Infinity;
			const P = pav.front;
			for ( let i = 0; i < P.length - 1; i ++ ) {

				const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ], dx = bx - ax, dz = bz - az;
				const t = Math.max( 0, Math.min( 1, ( ( x - ax ) * dx + ( z - az ) * dz ) / ( dx * dx + dz * dz || 1 ) ) );
				best = Math.min( best, Math.hypot( ax + dx * t - x, az + dz * t - z ) );

			}
			return best;

		};
		for ( const p of deck._portals || [] ) {

			const dm = ( p.dF + p.dB ) / 2, hw = 0.7, rise = p.yF - yPav, n = Math.round( rise / 0.18 ), r = rise / n;
			const along = ( s, d ) => [ p.a[ 0 ] + p.u[ 0 ] * s + p.n[ 0 ] * d, p.a[ 1 ] + p.u[ 1 ] * s + p.n[ 1 ] * d ];
			// the stair's frame: its "d" along the section, its "s" across it (the deck's depth)
			const F = { at: ( x, y ) => along( y, x ), n: p.u, u: p.n };
			let dir = 0;
			for ( const k of [ 1, - 1 ] ) {

				const top = p.s + k * ( p.w - 0.1 ), foot = top - k * n * RUN;
				const ok = [ foot, ( foot + top ) / 2 ].every( ( s ) => {

					const q = along( s, dm ), dd = nearPav( q[ 0 ], q[ 1 ] );
					return dd - hw > dPav + 0.1 && dd + hw < dPav + 3.2;

				} );
				if ( ok ) { dir = k; break; }

			}
			if ( ! dir ) continue;
			const top = p.s + dir * ( p.w - 0.1 ), foot = top - dir * n * RUN;
			K.flight( F, { s0: dm - hw, s1: dm + hw, d0: foot, dir, y0: yPav, n, r, open0: 4 } );
			// the well's rails on the box's floor: behind it the whole way, in front up to the last treads
			const s0 = p.s - dir * ( p.w - 0.05 ), s1 = top - dir * 4 * RUN;
			K.rail( along( s0, dm + hw + 0.06 ), along( p.s + dir * ( p.w - 0.05 ), dm + hw + 0.06 ), p.yF );
			K.rail( along( s0, dm - hw - 0.06 ), along( s1, dm - hw - 0.06 ), p.yF );
			// (where it goes, for the walks: its foot, its top, the floor beside the top, the mouth, row 7)
			( deck._stairs ||= [] ).push( { foot: along( foot - dir * 0.8, dm ), top: along( top - dir * 0.3, dm ), off: along( top - dir * 0.3, dm - hw - 0.5 ), mouth: along( p.s, p.dF - 0.4 ), y: p.yF } );
			// the well under the deck: dark round the hole
			K.well( along, p.s - p.w, p.s + p.w, dm - hw - 0.05, dm + hw + 0.05, ( d ) => deck.y0 - deck.soffit + d * ( ( deck.rows - 1 ) * deck.rise ) / ( deck.rows * deck.depth ) - 0.05 );

		}

	}

	K.build( bowl.group );
	return { banks };

}

// a frame at a tier's end: a the end's front point, b the next point along the front
function endFrame( a, b ) {

	const l = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
	const u = [ ( b[ 0 ] - a[ 0 ] ) / l, ( b[ 1 ] - a[ 1 ] ) / l ];
	let n = [ - u[ 1 ], u[ 0 ] ];
	// away from the field (center field's middle is at (0, -40))
	if ( n[ 0 ] * ( a[ 0 ] - 0 ) + n[ 1 ] * ( a[ 1 ] + 40 ) < 0 ) n = [ - n[ 0 ], - n[ 1 ] ];
	return { a, u, n, at: ( s, d ) => [ a[ 0 ] + u[ 0 ] * s + n[ 0 ] * d, a[ 1 ] + u[ 1 ] * s + n[ 1 ] * d ] };

}

// the polyline moved d away from the field (as Bowl's offsetPolyline with outward [ 0, -40 ])
function offsetPolyline( P, d ) {

	const N = [];
	for ( let i = 0; i < P.length - 1; i ++ ) {

		const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
		const l = Math.hypot( bx - ax, bz - az ) || 1;
		let nx = - ( bz - az ) / l, nz = ( bx - ax ) / l;
		if ( nx * ( ( ax + bx ) / 2 ) + nz * ( ( az + bz ) / 2 + 40 ) < 0 ) {

			nx = - nx; nz = - nz;

		}

		N.push( [ nx, nz ] );

	}

	return P.map( ( p, i ) => {

		const a = N[ Math.max( 0, i - 1 ) ], b = N[ Math.min( N.length - 1, i ) ];
		let mx = a[ 0 ] + b[ 0 ], mz = a[ 1 ] + b[ 1 ];
		const ml = Math.hypot( mx, mz ) || 1;
		mx /= ml; mz /= ml;
		const k = 1 / Math.max( 0.3, mx * b[ 0 ] + mz * b[ 1 ] );
		return [ p[ 0 ] + mx * d * k, p[ 1 ] + mz * d * k ];

	} );

}

// The pieces, drawn into four batches (maroon steel, galvanized treads, galvanized pipe, precast) with
// their colliders
class Kit {

	constructor( bowl ) {

		this.bowl = bowl;
		this.field = bowl.field;
		this.colliders = bowl.colliders;
		this.yaw = bowl.ctx.worldYaw;
		this.steel = new Quads();
		this.treads = new Quads();
		this.pipe = new Quads();
		this.precast = new Quads();

	}

	// an oriented box collider: centre c [ x, z ], along u (half hu) and across it (half hn), y0..y1
	box( c, u, hu, hn, y0, y1, o ) {

		const w = this.field.toWorld( c[ 0 ], c[ 1 ] );
		this.colliders.addBox( new Vector3( w.x, this.field.y0 + ( y0 + y1 ) / 2, w.z ), new Vector3( hu, ( y1 - y0 ) / 2, hn ), this.yaw - Math.atan2( u[ 1 ], u[ 0 ] ), o );

	}

	// a rail (drawn: a pipe at 1.07 m and a mid rail, posts every 1.5 m; solid) from a to b at height y
	rail( a, b, y, { draw = true, h = 1.07 } = {} ) {

		const l = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
		if ( l < 0.05 ) return;
		const u = [ ( b[ 0 ] - a[ 0 ] ) / l, ( b[ 1 ] - a[ 1 ] ) / l ];
		this.box( [ ( a[ 0 ] + b[ 0 ] ) / 2, ( a[ 1 ] + b[ 1 ] ) / 2 ], u, l / 2, 0.06, y - 0.2, y + h + 0.05, { tag: 'fa1-rail' } );
		if ( ! draw ) return;
		beam( this.pipe, [ a[ 0 ], y + h, a[ 1 ] ], [ b[ 0 ], y + h, b[ 1 ] ], 0.05 );
		beam( this.pipe, [ a[ 0 ], y + 0.55, a[ 1 ] ], [ b[ 0 ], y + 0.55, b[ 1 ] ], 0.035 );
		const n = Math.max( 1, Math.round( l / 1.5 ) );
		for ( let k = 0; k <= n; k ++ ) {

			const x = a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * k / n, z = a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * k / n;
			beam( this.pipe, [ x, y, z ], [ x, y + h, z ], 0.045 );

		}

	}

	// a solid wall (collider only) from a to b, h high over y
	wall( a, b, y, h ) {

		const l = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
		if ( l < 0.05 ) return;
		const u = [ ( b[ 0 ] - a[ 0 ] ) / l, ( b[ 1 ] - a[ 1 ] ) / l ];
		this.box( [ ( a[ 0 ] + b[ 0 ] ) / 2, ( a[ 1 ] + b[ 1 ] ) / 2 ], u, l / 2 + 0.05, 0.08, y - 0.2, y + h, { tag: 'fa1-wall' } );

	}

	// One straight flight across s0..s1 of frame F, from d0 climbing the way dir (+-1) along d: n risers of
	// r from y0. Galvanized treads with a dark nosing strip, open risers, two maroon channel stringers, a
	// galvanized handrail and mid rail each side on posts every fourth tread; walkable treads and solid
	// sides (in pieces that follow the slope, so a flight beside it passes)
	flight( F, { s0, s1, d0, dir, y0, n, r, open0 = 0 } ) {

		const P = ( s, d, y ) => {

			const p = F.at( s, d );
			return [ p[ 0 ], y, p[ 1 ] ];

		};
		const dirV = [ F.n[ 0 ] * dir, F.n[ 1 ] * dir ];
		for ( let k = 1; k <= n; k ++ ) {

			const da = d0 + dir * ( k - 1 ) * RUN, db = d0 + dir * k * RUN, y = y0 + k * r;
			// the tread (5 cm plate), its nosing a dark strip at the front
			const a0 = P( s0, da, y ), a1 = P( s1, da, y ), b1 = P( s1, db, y ), b0 = P( s0, db, y );
			const up = [ 0, 1, 0 ];
			this.treads.add( a0, a1, b1, b0, up );
			const f = [ - dirV[ 0 ], 0, - dirV[ 1 ] ];
			this.treads.add( P( s0, da, y - 0.05 ), P( s1, da, y - 0.05 ), a1, a0, f );
			this.steel.add( P( s0, da + dir * 0.004, y + 0.002 ), P( s1, da + dir * 0.004, y + 0.002 ), P( s1, da + dir * 0.05, y + 0.002 ), P( s0, da + dir * 0.05, y + 0.002 ), up );
			const c = F.at( ( s0 + s1 ) / 2, ( da + db ) / 2 );
			this.box( c, dirV, RUN / 2 + 0.01, ( s1 - s0 ) / 2, y - 0.2, y, { walkable: true, tag: 'fa1-stair' } );

		}

		const d1 = d0 + dir * n * RUN, y1 = y0 + n * r;
		for ( const s of [ s0 - 0.06, s1 + 0.06 ] ) {

			// the stringer: a deep channel under the nosings' line
			beam( this.steel, P( s, d0, y0 - 0.05 ), P( s, d1, y1 - 0.05 ), 0.12 );
			beam( this.steel, P( s, d0, y0 - 0.2 ), P( s, d1, y1 - 0.2 ), 0.12 );
			beam( this.pipe, P( s, d0 - dir * 0.3, y0 + 0.95 ), P( s, d1, y1 + 0.95 ), 0.05 );
			beam( this.pipe, P( s, d0, y0 + 0.5 ), P( s, d1, y1 + 0.5 ), 0.035 );
			for ( let k = 0; k <= n; k += 4 ) {

				const d = d0 + dir * k * RUN, y = y0 + k * r;
				beam( this.pipe, P( s, d, y ), P( s, d, y + 0.95 ), 0.045 );

			}

			// the side: solid in pieces of four treads, each from under its low end to a rail over its high end
			for ( let k = 0; k < n; k += 4 ) {

				const k1 = Math.min( n, k + 4, s < s1 && open0 ? n - open0 : n ), da = d0 + dir * k * RUN, db = d0 + dir * k1 * RUN;
				if ( k1 <= k ) continue;
				this.box( F.at( s, ( da + db ) / 2 ), dirV, Math.abs( db - da ) / 2, 0.05, y0 + k * r - 0.3, y0 + k1 * r + 1.1, { tag: 'fa1-stair-side' } );

			}

		}

	}

	// a landing: a steel deck s0..s1 x d0..d1 at y on a maroon frame, railed along the named edges ('d0',
	// 'd1', 's0', 's1', or 'd0:sa:sb' for part of one), columns at its corners down to the Alley
	landing( F, { s0, s1, d0, d1, y, rails = [], posts = false } ) {

		const P = ( s, d, yy ) => {

			const p = F.at( s, d );
			return [ p[ 0 ], yy, p[ 1 ] ];

		};
		this.treads.add( P( s0, d0, y ), P( s1, d0, y ), P( s1, d1, y ), P( s0, d1, y ), [ 0, 1, 0 ] );
		this.treads.add( P( s0, d0, y - 0.3 ), P( s0, d1, y - 0.3 ), P( s1, d1, y - 0.3 ), P( s1, d0, y - 0.3 ), [ 0, - 1, 0 ] );
		for ( const [ a, b ] of [ [ [ s0, d0 ], [ s1, d0 ] ], [ [ s1, d0 ], [ s1, d1 ] ], [ [ s1, d1 ], [ s0, d1 ] ], [ [ s0, d1 ], [ s0, d0 ] ] ] ) beam( this.steel, P( a[ 0 ], a[ 1 ], y - 0.16 ), P( b[ 0 ], b[ 1 ], y - 0.16 ), 0.28 );
		this.box( F.at( ( s0 + s1 ) / 2, ( d0 + d1 ) / 2 ), F.u, ( s1 - s0 ) / 2, ( d1 - d0 ) / 2, y - 0.3, y, { walkable: true, tag: 'fa1-landing' } );
		for ( const e of rails ) {

			const [ edge, a, b ] = e.split( ':' );
			const sa = a !== undefined ? Number( a ) : s0, sb = b !== undefined ? Number( b ) : s1;
			if ( edge === 'd0' ) this.rail( F.at( sa, d0 + 0.04 ), F.at( sb, d0 + 0.04 ), y );
			if ( edge === 'd1' ) this.rail( F.at( sa, d1 - 0.04 ), F.at( sb, d1 - 0.04 ), y );
			if ( edge === 's0' ) this.rail( F.at( s0 + 0.04, d0 ), F.at( s0 + 0.04, d1 ), y );
			if ( edge === 's1' ) this.rail( F.at( s1 - 0.04, d0 ), F.at( s1 - 0.04, d1 ), y );

		}

		if ( posts ) for ( const [ s, d ] of [ [ s0 + 0.15, d0 + 0.15 ], [ s1 - 0.15, d0 + 0.15 ], [ s0 + 0.15, d1 - 0.15 ], [ s1 - 0.15, d1 - 0.15 ] ] ) {

			beam( this.steel, P( s, d, STREET ), P( s, d, y - 0.3 ), 0.25 );
			const w = this.field.toWorld( ...F.at( s, d ) );
			this.colliders.addCylinder( w.x, w.z, 0.18, this.field.y0 + STREET, this.field.y0 + y - 0.3, { tag: 'fa1-post' } );

		}

	}

	// a dark well under a hole in a deck: its lining down from the soffit (yU( d ): the soffit's height d back)
	well( along, sa, sb, da, db, yU ) {

		const P = ( s, d, dy = 0 ) => {

			const p = along( s, d );
			return [ p[ 0 ], yU( d ) + dy, p[ 1 ] ];

		};
		this.dark ||= new Quads();
		this.dark.add( P( sa, da, - 0.3 ), P( sb, da, - 0.3 ), P( sb, da ), P( sa, da ), [ 0, 1, 0 ] );
		this.dark.add( P( sb, db, - 0.3 ), P( sa, db, - 0.3 ), P( sa, db ), P( sb, db ), [ 0, 1, 0 ] );

	}

	// the elevator's tower: precast panels with a reveal at each floor, a flat cap; solid
	tower( F, { s0, s1, d0, d1, y0, y1 } ) {

		const P = ( s, d, yy ) => {

			const p = F.at( s, d );
			return [ p[ 0 ], yy, p[ 1 ] ];

		};
		const C = [ [ s0, d0 ], [ s1, d0 ], [ s1, d1 ], [ s0, d1 ] ];
		for ( let i = 0; i < 4; i ++ ) {

			const [ sa, da ] = C[ i ], [ sb, db ] = C[ ( i + 1 ) % 4 ];
			const a = F.at( sa, da ), b = F.at( sb, db );
			// the outward normal of this face
			const mx = ( a[ 0 ] + b[ 0 ] ) / 2 - F.at( ( s0 + s1 ) / 2, ( d0 + d1 ) / 2 )[ 0 ], mz = ( a[ 1 ] + b[ 1 ] ) / 2 - F.at( ( s0 + s1 ) / 2, ( d0 + d1 ) / 2 )[ 1 ];
			const ml = Math.hypot( mx, mz );
			this.precast.add( P( sa, da, y0 ), P( sb, db, y0 ), P( sb, db, y1 ), P( sa, da, y1 ), [ mx / ml, 0, mz / ml ] );
			for ( const yy of [ y0 + 3.6, y0 + 7.2, y1 - 0.6 ] ) beam( this.steel, P( sa, da, yy ), P( sb, db, yy ), 0.08 );

		}

		this.precast.add( P( s0, d0, y1 ), P( s1, d0, y1 ), P( s1, d1, y1 ), P( s0, d1, y1 ), [ 0, 1, 0 ] );
		this.box( F.at( ( s0 + s1 ) / 2, ( d0 + d1 ) / 2 ), F.u, ( s1 - s0 ) / 2, ( d1 - d0 ) / 2, y0, y1, { tag: 'fa1-elevator' } );

	}

	// a tier's open end (frame F at the end, s 0 at the end): a pipe rail along each row's end, from row r0
	// to r1, and solid; `far`: the frame's u runs back into the tier from the other end
	endRail( t, F, r0, r1 ) {

		for ( let r = r0; r < r1; r ++ ) {

			const y = t.y0 + r * t.rise, da = ( t.start || 0 ) + r * t.depth, db = da + t.depth;
			const a = F.at( 0.04, da ), b = F.at( 0.04, db );
			this.box( F.at( 0.04, ( da + db ) / 2 ), F.n, t.depth / 2, 0.06, y - 0.4, y + 1.1, { tag: 'fa1-end-rail' } );
			beam( this.pipe, [ a[ 0 ], y + 1.0, a[ 1 ] ], [ b[ 0 ], y + 1.0, b[ 1 ] ], 0.05 );
			beam( this.pipe, [ a[ 0 ], y + 0.5, a[ 1 ] ], [ b[ 0 ], y + 0.5, b[ 1 ] ], 0.035 );
			beam( this.pipe, [ a[ 0 ], y, a[ 1 ] ], [ a[ 0 ], y + 1.0, a[ 1 ] ], 0.045 );

		}

	}

	build( group ) {

		const M = ( name, color, roughness, metalness ) => {

			const m = standard( { name, color: new Color( ...color ), roughness, metalness } );
			m.underwaterLighting = 'none';
			return m;

		};
		const mats = [
			[ this.steel, M( 'fa1-steel', [ 0.12, 0.03, 0.03 ], 0.6, 0.4 ), 'fa1-steel' ],
			[ this.treads, M( 'fa1-treads', [ 0.32, 0.33, 0.34 ], 0.6, 0.6 ), 'fa1-treads' ],
			[ this.pipe, M( 'fa1-pipe', [ 0.5, 0.51, 0.52 ], 0.42, 0.55 ), 'fa1-pipe' ],
			[ this.precast, M( 'fa1-precast', [ 0.55, 0.52, 0.46 ], 0.8, 0 ), 'fa1-precast' ],
			[ this.dark || new Quads(), M( 'fa1-well', [ 0.02, 0.02, 0.022 ], 0.9, 0 ), 'fa1-well' ],
		];
		for ( const [ q, m, name ] of mats ) {

			if ( ! q.count ) continue;
			const mesh = new Mesh( q.geometry(), m );
			mesh.name = name;
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			group.add( mesh );

		}

	}

}
