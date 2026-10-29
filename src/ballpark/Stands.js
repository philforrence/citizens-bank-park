import { Group, Mesh, InstancedMesh, BufferGeometry, Float32BufferAttribute, Matrix4, Quaternion, Vector2, Vector3, Color } from '../engine/index.js';
import { triangulateShape } from '../engine/math/ShapeUtils.js';
import { standard } from '../materials/Materials.js';
import { beam, indexed } from './geo.js';

// Seating tiers, built the way real stands are: the front edge is a polyline of straight sections;
// each section's rows are straight and parallel to its front, rising step by step away from the
// field. Where sections meet at an angle the rows are mitred on the corner's bisector, and an aisle
// runs between every pair of sections.
//
//   buildTier( tier, { toWorld, colliders, materials } ) -> Group
//
// tier: {
//   name,
//   front: [ [ x, z ], ... ]   front edge of the first row, field frame (metres), in order
//   outward: [ x, z ]           a point on the field side: rows go away from it
//   y0                          height of the first row's tread
//   rows                        number of rows
//   depth                       row depth (m)
//   start                       the first row begins this far behind the front line (m)
//   frontY                      the bottom of the first row's riser
//   skipRows: ( k ) => n        no rows 0..n-1 in front of front segment k (a dugout there)
//   rise: n | ( r ) => n        riser height in front of row r (r >= 1)
//   section                     longest straight section (m); longer front segments are split
//   aisle                       aisle width (m)
//   seat                        seat spacing along a row (m)
//   skip: [ [ i0, i1 ] ]        front segment index ranges with no seats (landings, tunnels, cameras)
//   base                        bottom of the stepped block (m): the ground below the lower bowl, or
//                               the underside of an upper deck
//   frontWall: { top, ahead }   a fascia / wall in front of the first row, from `base` up to `top`
//                               (---- FW3: `ahead` m in front of it, a ledge between: the front row's feet
//                               stay behind it)
//   back: { height, wall }      a wall behind the last row (---- FA3: wall: true, a wall to the walker too;
//                               'aisles', open at each aisle's head, onto a concourse behind)
//   soffit                      an upper deck: its underside runs this far below the rows (m), and
//                               the stepped profile is closed at the tier's two ends
//   portals: { every, row, rows, width }   a tunnel portal (vomitory) in the middle of every `every`th
//                               section, `rows` rows deep from row `row`, `width` wide
//   ---- FA3 (step 10, the walk):
//   frontRail: { height, ahead, draw }   the lower tiers' front: a rail you can't walk or jump over, `height`
//                               over the first row's tread, `ahead` m in front of its front edge (the field's
//                               wall and its rail, the backstop's net); draw: true builds it too (the right
//                               field seats': a dark pipe rail with chain-link, glass at each aisle's foot)
//   ledge: d                    a section whose first rows are skipped (a dugout in front) starts its first
//                               tread this far back from the front line (the dugout's back), a rail on its front
//                               and down its two ends to the front line (the camera wells beside it)
//   endRail                     a rail up both ends of the tier (an upper deck's end over a drop)
//   parapet: { row, at, mouths, mouthRows, mouthWidth }   a parapet across the sections `at( S )` picks, in
//                               front of row `row`: concrete under glass and a pipe rail, and in the
//                               sections numbered `mouths` (among those picked) a tunnel's mouth under it,
//                               its approach cut `mouthRows` rows deep into the rows in front (the Diamond
//                               Club's: parapetMouth() says which seats it takes)
//   ---- end FA3
// }
export const SEAT_W = 0.5;
// ---- FW3 (C2W-22): what the stands' concrete is told by a face's uv: a tread (uv.x - TREAD_UV: how far
// from its section's end, the aisle the first 0.6 m; uv.y: back from its front edge), a riser, a step light
const TREAD_UV = 2000, RISER_UV = 1000, STEPLIGHT_UV = 3000;
// ---- end FW3

export function rowHeights( tier ) {

	const y = [ tier.y0 ];
	for ( let r = 1; r < tier.rows; r ++ ) y.push( y[ r - 1 ] + ( typeof tier.rise === 'function' ? tier.rise( r ) : tier.rise ) );
	return y;

}

// the top of the last row: where a concourse behind the tier sits
export function tierTop( tier ) {

	const y = rowHeights( tier );
	return y[ y.length - 1 ];

}

// the sections of a tier: straight pieces of its front, with the mitre at each end
export function tierSections( tier ) {

	const P = tier.front;
	const [ ox, oz ] = tier.outward;
	const out = [];
	// ---- B (home): pk, a section's place in the default split (the portals and anything else that
	// counts sections round the bowl keep their places when a tier splits a segment its own way)
	let pk = 0;
	// ---- end B
	for ( let k = 0; k < P.length - 1; k ++ ) {

		const [ ax, az ] = P[ k ], [ bx, bz ] = P[ k + 1 ];
		const len = Math.hypot( bx - ax, bz - az );
		if ( len < 0.05 ) continue;
		const ux = ( bx - ax ) / len, uz = ( bz - az ) / len;
		let nx = - uz, nz = ux;
		if ( nx * ( ( ax + bx ) / 2 - ox ) + nz * ( ( az + bz ) / 2 - oz ) < 0 ) {

			nx = - nx; nz = - nz;

		}

		// split long segments into sections
		const nDef = Math.max( 1, Math.ceil( len / ( tier.section || 1e9 ) ) );
		// ---- B (home): or into the tier's own count for this segment (tier.splits[ k ])
		const n = tier.splits?.[ k ] ?? nDef;
		// ---- end B
		const skip = ( tier.skip || [] ).some( ( [ i0, i1 ] ) => k >= i0 && k <= i1 );
		const skipRows = tier.skipRows ? tier.skipRows( k ) : 0;
		for ( let s = 0; s < n; s ++ ) {

			const t0 = s / n, t1 = ( s + 1 ) / n;
			out.push( {
				k, a: [ ax + ( bx - ax ) * t0, az + ( bz - az ) * t0 ], len: len / n, ux, uz, nx, nz,
				// signed mitres at the polyline's corners (collinear splits have none)
				m0: s === 0 ? mitre( P, k, ux, uz, nx, nz, true ) : 0,
				m1: s === n - 1 ? mitre( P, k + 1, ux, uz, nx, nz, false ) : 0,
				seats: ! skip, skipRows,
				pk: pk + Math.min( s, nDef - 1 ), // ---- B (home)
			} );

		}

		pk += nDef; // ---- B (home)

	}

	return out;

}

// At the polyline's corner j, a row at offset d from the front ends d * m short of the corner (m > 0:
// the corner turns toward the rows, they converge) or d * -m past it (m < 0: it turns away, the rows
// open out). m = tan( turn / 2 ): the rows of neighbouring sections meet on the corner's bisector.
function mitre( P, j, ux, uz, nx, nz, atStart ) {

	if ( j <= 0 || j >= P.length - 1 ) return 0;
	const [ px, pz ] = P[ j - 1 ], [ cx, cz ] = P[ j ], [ qx, qz ] = P[ j + 1 ];
	// the neighbour's direction, continuing the walk along the front
	const [ ex, ez ] = atStart ? [ cx - px, cz - pz ] : [ qx - cx, qz - cz ];
	const l = Math.hypot( ex, ez );
	if ( l < 1e-6 ) return 0;
	// turn from the incoming to the outgoing direction; toward n is "converging"
	const [ ix, iz, ox, oz ] = atStart ? [ ex / l, ez / l, ux, uz ] : [ ux, uz, ex / l, ez / l ];
	const turn = Math.atan2( ix * oz - iz * ox, ix * ox + iz * oz );
	// does the path turn toward the rows (they converge) or away (they open out)?
	const towardRows = ( ox - ix ) * nx + ( oz - iz ) * nz;
	if ( Math.abs( turn ) < 1e-4 ) return 0;
	const m = Math.tan( Math.min( Math.abs( turn ), 2.6 ) / 2 );
	return towardRows > 0 ? m : - m;

}

// ---- FA3 (WA1-2): where along section S (the tier's k-th) its portal's middle is. In the middle of the
// section (as FW3 built the 400s' boxes) the stair came up into a pocket of row 1 with seats either side
// and no way to an aisle past the seated fans; in 2008 the 400s' boxes stand beside an aisle (Commons
// 2008-03-29 2372257740: the lit box at an aisle's side, top left). With `atAisle`, the box's side is the
// aisle's edge, at the end its stair climbs toward (places/terrace/Build.js: the stair's way, k % 4 < 2
// toward the section's end), clear of the rows' mitre there
export const portalDir = ( k ) => k % 4 < 2 ? 1 : - 1;
// the parapet's tunnel mouth in section S, if it has one: { s (its middle along the row), w (half its
// width, walls and all), r0, r1 (the rows cut for its approach) }
export function parapetMouth( tier, secs, S ) {

	const PA = tier.parapet;
	if ( ! PA || ! PA.at( S ) ) return null;
	const j = secs.filter( ( T ) => PA.at( T ) ).indexOf( S );
	if ( ! PA.mouths.includes( j ) ) return null;
	return { s: S.len / 2, w: PA.mouthWidth / 2 + 0.2, r0: PA.row - PA.mouthRows, r1: PA.row };

}
export function portalS( tier, S, k ) {

	const PO = tier.portals;
	if ( ! PO.atAisle ) return S.len / 2;
	const A = tier.aisle ?? 1.2, w = PO.width / 2 + 0.3, dB = ( tier.start || 0 ) + ( PO.row + PO.rows ) * tier.depth;
	return portalDir( k ) > 0 ? S.len - Math.max( 0, S.m1 ) * dB - A / 2 - w : Math.max( 0, S.m0 ) * dB + A / 2 + w;

}
// ---- end FA3

export function buildTier( tier, { toWorld, worldYaw, colliders, materials } ) {

	const group = new Group();
	group.name = tier.name;
	const ys = rowHeights( tier );
	// ---- B (home): a tier may set some sections' rows at their own heights (tier.rowY( S, r, y ))
	const rowY = ( S, r ) => tier.rowY ? tier.rowY( S, r, ys[ r ] ) : ys[ r ];
	// ---- end B
	const secs = tierSections( tier );
	const D = tier.depth, A = tier.aisle ?? 1.2, W = tier.seat ?? SEAT_W;
	const S0 = tier.start || 0; // the first row's front edge, this far behind the front line
	const base = tier.base ?? 0;
	const q = new Quads();
	const seatMats = [];
	const seatCols = [];
	const seatInfo = []; // for the crowd: the row (from the front) and, at a row's ends, the aisle's side
	const seatSec = []; // ---- SP1: each seat's section (the chunks below follow them)
	const _m = new Matrix4(), _q = new Quaternion(), _p = new Vector3(), _s = new Vector3( 1, 1, 1 ), _up = new Vector3( 0, 1, 0 );

	const portals = [];
	const PO = tier.portals;
	secs.forEach( ( S, k ) => {

		if ( ! PO || ! S.seats || S.len < PO.width + 3 || ( S.pk ?? k ) % PO.every !== Math.floor( PO.every / 2 ) ) return; // ---- B (home): pk
		portals.push( { S, s: portalS( tier, S, k ), r0: PO.row, r1: PO.row + PO.rows } ); // ---- FA3: portalS

	} );
	const inPortal = ( S, s, r ) => portals.some( ( p ) => p.S === S && r >= p.r0 - 1 && r < p.r1 && Math.abs( s - p.s ) < PO.width / 2 + 0.35 );
	// ---- FA1 (step 10, WA2-1): an `open` portal is a way in: its rows are cut out between its cheeks (a floor
	// at the mouth's level instead, walkable), the stair up to it comes from below (PavilionWays.js), and the
	// tier's row colliders are only 0.6 m deep, so the stair passes under the rows. The portals are listed
	// on the tier for that
	const cutAt = ( S, r ) => PO?.open ? portals.find( ( p ) => p.S === S && r >= p.r0 && r < p.r1 ) : null;
	// (and the row the mouth opens on has no seats across its section: a cross-aisle to the aisles each side)
	const crossAisle = ( S, r ) => PO?.open && portals.some( ( p ) => p.S === S && r === p.r0 - 1 );
	tier._portals = portals.map( ( p ) => ( { a: p.S.a, u: [ p.S.ux, p.S.uz ], n: [ p.S.nx, p.S.nz ], len: p.S.len, s: p.s, w: PO.width / 2 + 0.3, dF: S0 + p.r0 * tier.depth, dB: S0 + p.r1 * tier.depth, yF: ys[ p.r0 - 1 ] } ) );
	// ---- end FA1
	// ---- FA3 (WA1-2): the well over a portal's stair: rows r0..r1-1 open over its box, [ s0, s1 ] along the row
	// (the stair comes up through it from the concourse under the deck: places/terrace/Build.js); row r0 - 1
	// is the landing in front of its mouth. Their treads, risers and floors were whole: the walker under the
	// deck walked into a solid box, and inside it you stood in the steps
	const mouths = new Map();
	if ( tier.parapet ) for ( const S of secs ) {

		const m = parapetMouth( tier, secs, S );
		if ( m ) mouths.set( S, m );

	}
	const wellOf = ( S, r ) => {

		const p = portals.find( ( p ) => p.S === S && r >= p.r0 && r < p.r1 );
		if ( p ) return [ p.s - PO.width / 2 - 0.3, p.s + PO.width / 2 + 0.3 ];
		// (WA2-4) a parapet's tunnel: its approach cut into the rows in front of it
		const m = mouths.get( S );
		return m && r >= m.r0 && r < m.r1 ? [ m.s - m.w, m.s + m.w ] : null;

	};
	const inMouth = ( S, s, r ) => {

		const m = mouths.get( S );
		return !! m && r >= m.r0 && r < m.r1 && Math.abs( s - m.s ) < m.w + 0.3;

	};
	// a span [ a, b ] along the row, less the well
	const lessWell = ( well, a, b ) => well ? [ [ a, Math.min( b, well[ 0 ] ) ], [ Math.max( a, well[ 1 ] ), b ] ].filter( ( [ x, y ] ) => y - x > 0.02 ) : [ [ a, b ] ];
	// an upper deck's underside d back from its front line (parallel to the rake, `soffit` below the rows)
	const dUF = S0 - ( tier.frontWall?.ahead || 0 ), dUB = S0 + tier.rows * D;
	const underside = ( d ) => ys[ 0 ] - ( tier.soffit || 0 ) + Math.max( 0, d - dUF ) * ( ys[ ys.length - 1 ] - ys[ 0 ] ) / ( dUB - dUF );
	// ---- end FA3

	for ( const S of secs ) {

		const { a, len, ux, uz, nx, nz } = S;
		// the row's two ends at offset d (along the section's front line from a): the concrete follows
		// the mitres both ways; seats only get shorter (where the rows open out, the aisle widens)
		const ends = ( d ) => {

			const s0 = Math.min( len, S.m0 * d ), s1 = Math.max( s0, len - S.m1 * d );
			return [ s0, s1 ];

		};
		// seats run out to the corner's bisector too, where the rows open out as well as where they
		// converge (a narrow aisle there, not a wedge of bare steps)
		const seatEnds = ( d ) => ends( d );

		const at = ( s, d ) => [ a[ 0 ] + ux * s + nx * d, a[ 1 ] + uz * s + nz * d ];
		// seats face the field (-n): a turn of yaw takes the seat's own -z to ( -sin yaw, 0, -cos yaw )
		const yawSeat = Math.atan2( nx, nz );
		const first = S.skipRows || 0;
		for ( let r = first; r < tier.rows; r ++ ) {

			const d0 = S0 + r * D, d1 = S0 + ( r + 1 ) * D;
			const y = rowY( S, r ), yPrev = r > first ? rowY( S, r - 1 ) : ( first ? base : ( tier.frontY ?? base ) );
			const [ f0, f1 ] = ends( d0 ), [ b0, b1 ] = ends( d1 );
			if ( f1 - f0 < 0.05 && b1 - b0 < 0.05 ) continue;
			// ---- FA1 (WA2-1): the tread drawn and collided over [ f0, f1 ] at its front and [ b0, b1 ] at its back,
			// once, or twice either side of an open portal (a cut end paints no aisle: `cut0`, `cut1`)
			const well = portals.length || mouths.size ? wellOf( S, r ) : null; // ---- FA3 (WA1-2, WA2-4)
			const slab = ( f0, f1, b0, b1, cut0 = false, cut1 = false ) => {

				// tread
				const A0 = at( f0, d0 ), A1 = at( f1, d0 );
				// ---- FW3 (C2W-22): the tread in three pieces, its uv saying where on it a point is (TREAD_UV: the
				// distance from the section's end, so the aisle's first 0.6 m, and back from its front edge), for
				// the concrete's painted nosings and worn edges; the riser flagged, for its shade
				const w = Math.min( A / 2 + 0.6, ( f1 - f0 ) / 2 ), wb = Math.min( A / 2 + 0.6, ( b1 - b0 ) / 2 );
				const F = [ f0, f0 + w, f1 - w, f1 ].map( ( s ) => at( s, d0 ) ), Bq = [ b0, b0 + wb, b1 - wb, b1 ].map( ( s ) => at( s, d1 ) );
				const ua = [ cut0 ? 3 : 0, w, w, cut1 ? 3 : 0 ], ub = [ cut0 ? 3 : 0, wb, wb, cut1 ? 3 : 0 ];
				for ( let j = 0; j < 3; j ++ ) {

					// ---- FA3 (WA1-2): the middle piece open over a portal's well
					if ( well && j === 1 ) {

						for ( const [ sa, sb ] of lessWell( well, f0 + w, f1 - w ) ) {

							const a = [ ...at( sa, d0 ) ], b = [ ...at( sb, d0 ) ], c = [ ...at( sb, d1 ) ], dd = [ ...at( sa, d1 ) ];
							q.add( [ a[ 0 ], y, a[ 1 ] ], [ b[ 0 ], y, b[ 1 ] ], [ c[ 0 ], y, c[ 1 ] ], [ dd[ 0 ], y, dd[ 1 ] ], [ 0, 1, 0 ], TREAD_UV + w, TREAD_UV + w );

						}
						continue;

					}
					// ---- end FA3
					const a = [ F[ j ][ 0 ], y, F[ j ][ 1 ] ], b = [ F[ j + 1 ][ 0 ], y, F[ j + 1 ][ 1 ] ], c = [ Bq[ j + 1 ][ 0 ], y, Bq[ j + 1 ][ 1 ] ], dd = [ Bq[ j ][ 0 ], y, Bq[ j ][ 1 ] ];
					q.tri( a, b, c, [ 0, 1, 0 ], [ TREAD_UV + ua[ j ], 0 ], [ TREAD_UV + ua[ j + 1 ], 0 ], [ TREAD_UV + ub[ j + 1 ], D ] );
					q.tri( a, c, dd, [ 0, 1, 0 ], [ TREAD_UV + ua[ j ], 0 ], [ TREAD_UV + ub[ j + 1 ], D ], [ TREAD_UV + ub[ j ], D ] );

				}

				// riser in front of it (---- FA3: open over a portal's well)
				for ( const [ sa, sb ] of lessWell( well, f0, f1 ) ) {

					const E0 = at( sa, d0 ), E1 = at( sb, d0 );
					q.add( [ E0[ 0 ], yPrev, E0[ 1 ] ], [ E1[ 0 ], yPrev, E1[ 1 ] ], [ E1[ 0 ], y, E1[ 1 ] ], [ E0[ 0 ], y, E0[ 1 ] ], [ - nx, 0, - nz ], RISER_UV, RISER_UV );

				}
				void A0; void A1;
				// ---- end FW3

				// walkable: an oriented box under the tread (world frame)
				if ( colliders ) {

					// ---- FA3 (WA1-10): the whole tread, mitres and all, from the leftmost of its front and back ends to
					// the rightmost (FW6's fix to Bowl._walkable). It was the rectangle inside the mitred tread: a wedge
					// with no floor at every section joint (the corners' fans, whose rows open out twenty times wider
					// at the back than at the front, worst: half their top rows), and stood on, you dropped through to
					// the hollow or the deck below, 21.8 m down a shaft on the third base side. Over a joint the box
					// reaches onto the neighbour's tread, the same row at the same height (a few cm off by the Diamond
					// Club's low rows and the dugouts' skipped ones)
					const lo = Math.min( f0, b0 ), hi = Math.max( f1, b1 );
					// an upper deck's rows end at its underside, not 3 m down (under the 400s that hung 2 m below
					// the deck, into the stairs' headroom); the lower bowl's go down 3 m as before; (FA1) a tier with
					// open portals 0.6 m deep, so its stairs pass under the rows
					const bottom = PO?.open ? Math.max( base, y - 0.6 )
						: tier.soffit ? Math.min( y - 0.3, Math.max( base, underside( ( d0 + d1 ) / 2 ) ) ) : Math.max( base, y - 3 );
					for ( const [ sa, sb ] of lessWell( well, lo, hi ) ) {

						const cs = ( sa + sb ) / 2, hl = Math.max( 0.05, ( sb - sa ) / 2 );
						const [ cx, cz ] = at( cs, ( d0 + d1 ) / 2 );
						const w = toWorld( cx, cz );
						colliders.addBox( new Vector3( w.x, ( y + bottom ) / 2, w.z ), new Vector3( hl, ( y - bottom ) / 2, D / 2 ), worldYaw - Math.atan2( uz, ux ) + 0, { walkable: true, tag: tier.name } );

					}
					// ---- end FA3

				}

			};
			const cut = cutAt( S, r );
			if ( cut ) {

				const w = PO.width / 2 + 0.3;
				slab( f0, cut.s - w, b0, cut.s - w, false, true );
				slab( cut.s + w, f1, cut.s + w, b1, true, false );

			} else slab( f0, f1, b0, b1 );
			// ---- end FA1

			// seats: along the row between the aisles, centred
			if ( ! S.seats ) continue;
			const dSeat = d0 + D * 0.55;
			const [ s0, s1 ] = seatEnds( dSeat );
			const lo = s0 + A / 2, hi = s1 - A / 2;
			const n = Math.floor( ( hi - lo ) / W );
			if ( n < 1 ) continue;
			const start = lo + ( hi - lo - n * W ) / 2 + W / 2;
			for ( let i = 0; i < n; i ++ ) {

				if ( portals.length && ( inPortal( S, start + i * W, r ) || crossAisle( S, r ) ) ) continue; // ---- FA1: crossAisle
				if ( mouths.size && inMouth( S, start + i * W, r ) ) continue; // ---- FA3 (WA2-4)
				const [ x, z ] = at( start + i * W, dSeat );
				_q.setFromAxisAngle( _up, yawSeat );
				_m.compose( _p.set( x, y, z ), _q, _s );
				seatMats.push( _m.clone() );
				// a little fading from seat to seat
				const k = 0.9 + 0.2 * hash( x * 13.1 + z * 7.7 + r );
				seatCols.push( k );
				// the aisle at the row's first / last seat, as a side of the seat's own x axis ( cos yaw, -sin yaw )
				const xu = Math.cos( yawSeat ) * ux - Math.sin( yawSeat ) * uz;
				seatInfo.push( { row: r - first, rows: tier.rows - first, aisle: ( i === 0 ? - 1 : i === n - 1 ? 1 : 0 ) * Math.sign( xu ) } );
				seatSec.push( S );

			}

		}

	}

	// ---- FW3 (C2W-22): the aisles' steps. Where a row rises more than a comfortable step (the upper decks:
	// 46-62 cm a row), the aisle has a step half way up each row, a box over the tread's back half the
	// aisle's width (both halves meet on the sections' bisector); every fourth row a step light in its riser.
	// The field level's rows rise 10-22 cm: one step a row, as built
	for ( let k = 0; k < secs.length - 1; k ++ ) {

		const S = secs[ k ], T = secs[ k + 1 ];
		if ( ! S.seats && ! T.seats ) continue;
		const first = Math.max( S.skipRows || 0, T.skipRows || 0 );
		for ( let r = first; r < tier.rows - 1; r ++ ) {

			for ( const [ X, end ] of [ [ S, true ], [ T, false ] ] ) {

				const y = rowY( X, r ), h = ( rowY( X, r + 1 ) - y ) / 2;
				if ( h < 0.15 ) continue;
				const dm = S0 + ( r + 0.5 ) * D, d1 = S0 + ( r + 1 ) * D;
				const at = ( s, d ) => [ X.a[ 0 ] + X.ux * s + X.nx * d, X.a[ 1 ] + X.uz * s + X.nz * d ];
				// the aisle's half in this section at depth d: from its mitred end A/2 in
				const span = ( d ) => end ? [ X.len - X.m1 * d - A / 2, X.len - X.m1 * d ] : [ X.m0 * d, X.m0 * d + A / 2 ];
				const [ m0, m1 ] = span( dm ), [ e0, e1 ] = span( d1 );
				const P = ( s, d, yy ) => {

					const p = at( s, d );
					return [ p[ 0 ], yy, p[ 1 ] ];

				};
				const yt = y + h;
				// the top (a tread: its nosing painted like the rest), the riser, the side toward the seats
				q.tri( P( m0, dm, yt ), P( m1, dm, yt ), P( e1, d1, yt ), [ 0, 1, 0 ], [ TREAD_UV + ( end ? A / 2 : 0 ), 0 ], [ TREAD_UV + ( end ? 0 : A / 2 ), 0 ], [ TREAD_UV + ( end ? 0 : A / 2 ), D / 2 ] );
				q.tri( P( m0, dm, yt ), P( e1, d1, yt ), P( e0, d1, yt ), [ 0, 1, 0 ], [ TREAD_UV + ( end ? A / 2 : 0 ), 0 ], [ TREAD_UV + ( end ? 0 : A / 2 ), D / 2 ], [ TREAD_UV + ( end ? A / 2 : 0 ), D / 2 ] );
				q.add( P( m0, dm, y ), P( m1, dm, y ), P( m1, dm, yt ), P( m0, dm, yt ), [ - X.nx, 0, - X.nz ], RISER_UV, RISER_UV );
				const sIn = end ? m0 : m1, sIn1 = end ? e0 : e1, sg = end ? - 1 : 1;
				q.add( P( sIn, dm, y ), P( sIn1, d1, y ), P( sIn1, d1, yt ), P( sIn, dm, yt ), [ X.ux * sg, 0, X.uz * sg ], RISER_UV, RISER_UV );
				// the step light: a small lens low in the riser, toward the aisle's middle
				if ( r % 4 === 1 ) {

					const sl = end ? m1 - 0.22 : m0 + 0.22, o = - 0.006;
					const L0 = P( sl - 0.07, dm + o, y + h * 0.3 ), L1 = P( sl + 0.07, dm + o, y + h * 0.3 );
					q.add( L0, L1, [ L1[ 0 ], y + h * 0.3 + 0.05, L1[ 2 ] ], [ L0[ 0 ], y + h * 0.3 + 0.05, L0[ 2 ] ], [ - X.nx, 0, - X.nz ], STEPLIGHT_UV, STEPLIGHT_UV );

				}

			}

		}

	}
	// ---- end FW3

	// an upper deck's underside, parallel to the rake, and its two stepped end profiles
	if ( tier.soffit ) {

		const t = tier.soffit, yB = ys[ ys.length - 1 ];
		const dF = S0 - ( tier.frontWall?.ahead || 0 ), dB = S0 + tier.rows * D; // ---- FW3: from the wall
		for ( const S of secs ) {

			const e = ( d ) => [ Math.min( S.len, S.m0 * d ), Math.max( Math.min( S.len, S.m0 * d ), S.len - S.m1 * d ) ];
			const [ f0, f1 ] = e( dF ), [ b0, b1 ] = e( dB );
			const at = ( s, d ) => [ S.a[ 0 ] + S.ux * s + S.nx * d, S.a[ 1 ] + S.uz * s + S.nz * d ];
			const A0 = at( f0, dF ), A1 = at( f1, dF ), B1 = at( b1, dB ), B0 = at( b0, dB );
			const rake = ( yB - ys[ 0 ] ) / ( dB - dF );
			q.add( [ A0[ 0 ], ys[ 0 ] - t, A0[ 1 ] ], [ A1[ 0 ], ys[ 0 ] - t, A1[ 1 ] ], [ B1[ 0 ], yB - t, B1[ 1 ] ], [ B0[ 0 ], yB - t, B0[ 1 ] ], [ S.nx * rake, - 1, S.nz * rake ] );

		}

		// end caps: the stepped profile in the plane of the tier's first / last section end
		const profile = [ [ dF, ys[ 0 ] - t ] ];
		for ( let r = 0; r < tier.rows; r ++ ) profile.push( [ S0 + r * D, ys[ r ] ], [ S0 + ( r + 1 ) * D, ys[ r ] ] );
		profile.push( [ dB, yB - t ] );
		const pts2 = profile.map( ( [ d, y ] ) => new Vector2( d, y ) );
		const tris = triangulateShape( pts2.slice(), [] );
		for ( const [ S, end ] of [ [ secs[ 0 ], false ], [ secs[ secs.length - 1 ], true ] ] ) {

			const n = end ? [ S.ux, 0, S.uz ] : [ - S.ux, 0, - S.uz ];
			const P3 = profile.map( ( [ d, y ] ) => {

				const s = end ? Math.max( 0, S.len - S.m1 * d ) : Math.min( S.len, S.m0 * d );
				return [ S.a[ 0 ] + S.ux * s + S.nx * d, y, S.a[ 1 ] + S.uz * s + S.nz * d ];

			} );
			for ( const [ i, j, k ] of tris ) q.tri( P3[ i ], P3[ j ], P3[ k ], n );

		}

	}

	// the front of an upper deck: a solid rail you can't walk off
	if ( tier.frontWall && colliders ) {

		// ---- FA3 (WA1-7): up to the pipe rail on it (0.32 over the wall's top, below), not the wall's top: a
		// jump from the front row cleared the 0.75-1.0 m wall
		const top = ( tier.frontWall.top ?? ys[ 0 ] ) + 0.37;
		const bottom = ys[ 0 ] - ( tier.soffit || 1 );
		for ( const S of secs ) {

			const F0 = S0 - ( tier.frontWall.ahead || 0 ); // ---- FW3
			const s0 = Math.min( S.len, S.m0 * F0 ), s1 = Math.max( s0, S.len - S.m1 * F0 );
			const mid = ( s0 + s1 ) / 2;
			const cx = S.a[ 0 ] + S.ux * mid + S.nx * ( F0 - 0.1 ), cz = S.a[ 1 ] + S.uz * mid + S.nz * ( F0 - 0.1 );
			const w = toWorld( cx, cz );
			colliders.addBox( new Vector3( w.x, ( top + bottom ) / 2, w.z ), new Vector3( ( s1 - s0 ) / 2, ( top - bottom ) / 2, 0.12 ), worldYaw - Math.atan2( S.uz, S.ux ), { tag: tier.name + '-front' } );

		}

	}

	// the front wall / fascia and the back wall along the whole tier
	// a deck's front: a light grey precast band along the top over a maroon steel edge beam, the rest
	// of the front set back in the shade
	const fq = new Quads(), eq = new Quads();
	if ( tier.frontWall ) {

		const top = tier.frontWall.top ?? ys[ 0 ];
		const FA = tier.frontWall.ahead || 0, F0 = S0 - FA; // ---- FW3
		if ( top - base > 1.8 ) {

			wallAlong( fq, secs, F0, top - 1.0, top, - 1 );
			wallAlong( eq, secs, F0 + 0.05, top - 1.5, top - 1.0, - 1 );
			wallAlong( q, secs, F0 + 0.3, base, top - 1.5, - 1 );

		} else wallAlong( fq, secs, F0, base, top, - 1 );
		// ---- FW3: the ledge between the wall and the first row (its tread carried forward), and the wall's
		// back face above it
		if ( FA > 0 ) {

			for ( const S of secs ) {

				const e = ( d ) => [ Math.min( S.len, S.m0 * d ), Math.max( Math.min( S.len, S.m0 * d ), S.len - S.m1 * d ) ];
				const at = ( s, d ) => [ S.a[ 0 ] + S.ux * s + S.nx * d, S.a[ 1 ] + S.uz * s + S.nz * d ];
				const [ f0, f1 ] = e( F0 ), [ b0, b1 ] = e( S0 );
				const A0 = at( f0, F0 ), A1 = at( f1, F0 ), B1 = at( b1, S0 ), B0 = at( b0, S0 );
				q.add( [ A0[ 0 ], ys[ 0 ], A0[ 1 ] ], [ A1[ 0 ], ys[ 0 ], A1[ 1 ] ], [ B1[ 0 ], ys[ 0 ], B1[ 1 ] ], [ B0[ 0 ], ys[ 0 ], B0[ 1 ] ], [ 0, 1, 0 ] );

			}

			wallAlong( fq, secs, F0 + 0.12, ys[ 0 ], top, 1 );

		}
		// ---- end FW3

	}
	if ( tier.back ) wallAlong( q, secs, S0 + tier.rows * D, ys[ ys.length - 1 ], ys[ ys.length - 1 ] + tier.back.height, 1 );

	// galvanized pipe: handrails down the middle of each aisle in runs of three rows, and on an upper
	// deck a rail over its front wall
	const rq = new Quads();
	const RH = 0.9;
	for ( let k = 0; k < secs.length - 1; k ++ ) {

		const S = secs[ k ], T = secs[ k + 1 ];
		if ( ! S.seats && ! T.seats ) continue;
		const first = Math.max( S.skipRows || 0, T.skipRows || 0 );
		// the aisle's middle: on the bisector at the sections' corner
		const mid = ( r ) => {

			const d = S0 + ( r + 0.5 ) * D, s = S.len - S.m1 * d;
			return [ S.a[ 0 ] + S.ux * s + S.nx * d, rowY( S, r ) + RH, S.a[ 1 ] + S.uz * s + S.nz * d ];

		};
		for ( let r0 = first + 1; r0 < tier.rows - 1; r0 += 4 ) {

			const r1 = Math.min( tier.rows - 1, r0 + 2 );
			for ( let r = r0; r < r1; r ++ ) beam( rq, mid( r ), mid( r + 1 ), 0.045 );
			for ( const r of [ r0, r1 ] ) {

				const p = mid( r );
				beam( rq, [ p[ 0 ], rowY( S, r ), p[ 2 ] ], p, 0.04 );

			}

		}

	}

	if ( tier.frontWall ) {

		const top = tier.frontWall.top ?? ys[ 0 ], y = top + 0.32;
		for ( const S of secs ) {

			const d = S0 - ( tier.frontWall.ahead || 0 ) - 0.12; // ---- FW3: ahead
			const s0 = Math.min( S.len, S.m0 * d ), s1 = Math.max( s0, S.len - S.m1 * d );
			const P = ( s, yy ) => [ S.a[ 0 ] + S.ux * s + S.nx * d, yy, S.a[ 1 ] + S.uz * s + S.nz * d ];
			beam( rq, P( s0, y ), P( s1, y ), 0.05 );
			const n = Math.max( 1, Math.round( ( s1 - s0 ) / 2.2 ) );
			for ( let i = 0; i <= n; i ++ ) beam( rq, P( s0 + ( s1 - s0 ) * i / n, top ), P( s0 + ( s1 - s0 ) * i / n, y ), 0.04 );

		}

	}

	// ---- FA3 (step 10, the walk): the rails a fan can't get past, as colliders (and where nothing drew them, drawn)
	const box = ( S, sa, sb, d, y0, y1, th = 0.24, tag = tier.name + '-rail' ) => {

		// a wall along section S from sa to sb (along its front) at depth d (its middle), y0..y1
		if ( ! colliders || sb - sa < 0.02 || y1 - y0 < 0.02 ) return;
		const [ cx, cz ] = [ S.a[ 0 ] + S.ux * ( sa + sb ) / 2 + S.nx * d, S.a[ 1 ] + S.uz * ( sa + sb ) / 2 + S.nz * d ];
		const w = toWorld( cx, cz );
		colliders.addBox( new Vector3( w.x, ( y0 + y1 ) / 2, w.z ), new Vector3( ( sb - sa ) / 2, ( y1 - y0 ) / 2, th / 2 ), worldYaw - Math.atan2( S.uz, S.ux ), { tag } );

	};
	const wallLine = ( a, b, y0, y1, tag, th = 0.24 ) => {

		// a wall from a to b ([ x, z ], field frame), y0..y1
		const l = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
		if ( ! colliders || l < 0.02 ) return;
		const w = toWorld( ( a[ 0 ] + b[ 0 ] ) / 2, ( a[ 1 ] + b[ 1 ] ) / 2 );
		colliders.addBox( new Vector3( w.x, ( y0 + y1 ) / 2, w.z ), new Vector3( l / 2, ( y1 - y0 ) / 2, th / 2 ), worldYaw - Math.atan2( b[ 1 ] - a[ 1 ], b[ 0 ] - a[ 0 ] ), { tag } );

	};
	// (WA1-4, WA2-5) the lower tiers' fronts. At the foot of every aisle you stepped over the foul wall's
	// collider (0.17 m over the front row's tread) onto the field, off the right field seats over theirs (0.35
	// m under the front row) onto the track, and into the camera wells. In 2008 the field was closed: the low
	// wall and its pipe rail down the lines, the backstop's net behind home, a pipe rail with chain-link and
	// glass at each aisle's foot in right (Commons 2008-03-29 2371427833). The free camera (F) still goes
	// anywhere
	const FR = tier.frontRail, fr = new Quads(), fm = new Quads(), fg = new Quads();
	if ( FR ) {

		for ( const S of secs ) {

			const first = S.skipRows || 0;
			const dF = first && tier.ledge ? tier.ledge : S0 + first * D, y = rowY( S, first );
			const d = dF - ( FR.ahead ?? 0.12 );
			const s0 = Math.min( S.len, S.m0 * d ) - 0.15, s1 = Math.max( s0, S.len - S.m1 * d ) + 0.15;
			box( S, s0, s1, d, y - 1.2, y + FR.height );
			// (WA2-3) the dugouts: their sections' first rows start behind the dugout's back, 0.75 m back from
			// it (Field.js: 2.6 m deep and its 0.25 m wall, the rows 4 x 0.8 back): a slot you dropped into at
			// the foot of the aisle. A ledge at the first row's height carries its tread forward to the dugout's
			// back; a rail on its front over the roof's back edge and down both ends to the wall (the wells)
			if ( first && tier.ledge ) {

				const dR = S0 + first * D, e = ( dd ) => [ Math.min( S.len, S.m0 * dd ), Math.max( Math.min( S.len, S.m0 * dd ), S.len - S.m1 * dd ) ];
				const [ a0, a1 ] = e( dF ), [ c0, c1 ] = e( dR );
				const P = ( s, dd, yy ) => [ S.a[ 0 ] + S.ux * s + S.nx * dd, yy, S.a[ 1 ] + S.uz * s + S.nz * dd ];
				q.add( P( a0, dF, y ), P( a1, dF, y ), P( c1, dR, y ), P( c0, dR, y ), [ 0, 1, 0 ] );
				q.add( P( a0, dF, y - 0.4 ), P( a1, dF, y - 0.4 ), P( a1, dF, y ), P( a0, dF, y ), [ - S.nx, 0, - S.nz ], RISER_UV, RISER_UV );
				if ( colliders ) {

					const lo = Math.min( a0, c0 ), hi = Math.max( a1, c1 ), w = toWorld( ...[ 0, 2 ].map( ( i ) => P( ( lo + hi ) / 2, ( dF + dR ) / 2, 0 )[ i ] ) );
					colliders.addBox( new Vector3( w.x, y - 0.5, w.z ), new Vector3( ( hi - lo ) / 2, 0.5, ( dR - dF ) / 2 ), worldYaw - Math.atan2( S.uz, S.ux ), { walkable: true, tag: tier.name } );

				}
				// the rail on the roof's back edge and down the ends: dark green pipe, as the field's (Field.js)
				const R0 = ( s, dd ) => P( s, dd, y ), yr = y + 0.95;
				const runs = [ [ P( a0, dF, 0 ), P( a1, dF, 0 ) ] ];
				for ( const [ sF, sB ] of [ [ Math.min( S.len, S.m0 * ( S0 - 0.15 ) ), a0 ], [ Math.max( 0, S.len - S.m1 * ( S0 - 0.15 ) ), a1 ] ] ) {

					const A = P( sF, S0 - 0.15, 0 ), B = P( sB, dF, 0 );
					runs.push( [ A, B ] );
					wallLine( [ A[ 0 ], A[ 2 ] ], [ B[ 0 ], B[ 2 ] ], y - 1.2, y + FR.height );

				}
				for ( const [ A, B ] of runs ) {

					const l = Math.hypot( B[ 0 ] - A[ 0 ], B[ 2 ] - A[ 2 ] ), n = Math.max( 1, Math.round( l / 1.8 ) );
					const T = ( t, yy ) => [ A[ 0 ] + ( B[ 0 ] - A[ 0 ] ) * t, yy, A[ 2 ] + ( B[ 2 ] - A[ 2 ] ) * t ];
					beam( fr, T( 0, yr ), T( 1, yr ), 0.05 );
					beam( fr, T( 0, y + 0.45 ), T( 1, y + 0.45 ), 0.035 );
					for ( let k = 0; k <= n; k ++ ) beam( fr, T( k / n, y ), T( k / n, yr + 0.02 ), 0.05 );

				}
				void R0; void c0; void c1;

			}
			// drawn: the right field seats' front, a dark pipe rail on posts with chain-link under it, and at each
			// aisle's foot a taller panel, chain-link under glass
			if ( FR.draw ) {

				const P = ( s, yy ) => [ S.a[ 0 ] + S.ux * s + S.nx * ( dF - 0.12 ), yy, S.a[ 1 ] + S.uz * s + S.nz * ( dF - 0.12 ) ];
				const a0 = s0 + 0.15, a1 = s1 - 0.15, H = 1.0;
				beam( fr, P( a0, y + H ), P( a1, y + H ), 0.05 );
				beam( fr, P( a0, y + 0.06 ), P( a1, y + 0.06 ), 0.04 );
				const n = Math.max( 1, Math.round( ( a1 - a0 ) / 2.0 ) );
				for ( let k = 0; k <= n; k ++ ) beam( fr, P( a0 + ( a1 - a0 ) * k / n, y ), P( a0 + ( a1 - a0 ) * k / n, y + H + 0.03 ), 0.05 );
				fm.add( P( a0, y + 0.08 ), P( a1, y + 0.08 ), P( a1, y + H - 0.04 ), P( a0, y + H - 0.04 ), [ - S.nx, 0, - S.nz ], a0, a1 );
				// the aisle's foot at the section's two ends (A wide): its frame up to the glass's top
				for ( const [ g0, g1 ] of [ [ a0, a0 + A / 2 ], [ a1 - A / 2, a1 ] ] ) {

					const yg = y + 1.62;
					for ( const sg of [ g0, g1 ] ) beam( fr, P( sg, y + H ), P( sg, yg ), 0.045 );
					beam( fr, P( g0, yg ), P( g1, yg ), 0.045 );
					fg.add( P( g0, y + H + 0.03 ), P( g1, y + H + 0.03 ), P( g1, yg - 0.02 ), P( g0, yg - 0.02 ), [ - S.nx, 0, - S.nz ], g0, g1 );
					box( S, g0, g1, dF - 0.12, y + 1.0, yg + 0.05, 0.12 );

				}

			}

		}

	}
	// (WA1-5) an upper deck's two ends: the stepped end wall (the soffit's end caps) and a pipe rail up it.
	// Off the 300s' ends you fell 8-9 m onto the Arcade or the concourse, off the club seats' 7
	if ( tier.endRail ) {

		for ( const [ S, last ] of [ [ secs[ 0 ], false ], [ secs[ secs.length - 1 ], true ] ] ) {

			const sE = ( dd ) => last ? Math.max( 0, S.len - S.m1 * dd ) - 0.06 : Math.min( S.len, S.m0 * dd ) + 0.06;
			const P = ( dd, yy ) => [ S.a[ 0 ] + S.ux * sE( dd ) + S.nx * dd, yy, S.a[ 1 ] + S.uz * sE( dd ) + S.nz * dd ];
			const dF = S0 - ( tier.frontWall?.ahead || 0 );
			for ( let r = S.skipRows || 0; r < tier.rows; r ++ ) {

				const d0 = r === ( S.skipRows || 0 ) ? dF : S0 + r * D, d1 = S0 + ( r + 1 ) * D, y = rowY( S, r );
				const A = P( d0, 0 ), B = P( d1, 0 );
				wallLine( [ A[ 0 ], A[ 2 ] ], [ B[ 0 ], B[ 2 ] ], y - 0.6, y + 1.15, tier.name + '-end-rail', 0.12 );

			}
			// the rail: a pipe 1 m over the steps' nosings, a post every other row
			const yA = ys[ S.skipRows || 0 ] + 1.0, yB = ys[ tier.rows - 1 ] + 1.0;
			const dA = S0 + ( S.skipRows || 0 ) * D, dB = S0 + tier.rows * D - 0.1;
			beam( rq, P( dA - ( tier.frontWall?.ahead || 0 ) + 0.1, yA ), P( dA + 0.3, yA ), 0.05 );
			beam( rq, P( dA + 0.3, yA ), P( dB - D + 0.3, yB ), 0.05 );
			beam( rq, P( dB - D + 0.3, yB ), P( dB, yB ), 0.05 );
			for ( let r = S.skipRows || 0; r < tier.rows; r += 2 ) {

				const dd = S0 + ( r + 0.4 ) * D, yy = ys[ r ];
				const yt = yA + ( yB - yA ) * Math.max( 0, Math.min( 1, ( dd - dA - 0.3 ) / Math.max( 0.1, dB - D - dA ) ) );
				beam( rq, P( dd, yy ), P( dd, yt ), 0.04 );

			}

		}

	}
	// (WA1-5) the wall behind the top row (the 400s' fell 29.8 m to the street; the Arcade's opens onto its
	// concourse at the aisles' heads)
	if ( tier.back?.wall ) {

		const dB = S0 + tier.rows * D;
		for ( let k = 0; k < secs.length; k ++ ) {

			const S = secs[ k ], y = rowY( S, tier.rows - 1 );
			const s0 = Math.min( S.len, S.m0 * dB ) - 0.15, s1 = Math.max( s0, S.len - S.m1 * dB ) + 0.15;
			const gap = tier.back.wall === 'aisles' ? 0.85 : 0;
			box( S, s0 + ( k > 0 ? gap : 0 ), s1 - ( k < secs.length - 1 ? gap : 0 ), dB + 0.12, y - 0.6, y + tier.back.height + 0.1, 0.24, tier.name + '-back' );

		}

	}
	// (WA2-4) the Diamond Club closed off. Behind home its rows and the field level's above them were one
	// sweep from the backstop to the concourse; in 2008 the club's rows ended at a concrete parapet with
	// glass and a pipe rail on it (Commons 2008-03-29 2372257740, by 126-127; michealnichols 2006 from
	// 122-125, the rail across the rows), the club's members came up from the club under the stands by
	// tunnels whose mouths open under it, and 119-128 above were entered from the concourse. The parapet
	// in front of row PA.row: concrete to 0.55 m over that row's tread, glass to 1.05 with a pipe rail on
	// top, unbroken across the aisles (a gate in each, shut), a wall to the walker; each mouth a dark
	// opening under it, its approach steps down through the club's top rows between low walls
	const PA = tier.parapet, gq = new Quads(), mq2 = new Quads();
	if ( PA ) {

		for ( const S of secs ) {

			if ( ! PA.at( S ) ) continue;
			const dP = S0 + PA.row * D, yLo = rowY( S, PA.row - 1 ), yUp = rowY( S, PA.row );
			const yC = yUp + 0.55, yG = yUp + 1.05;
			const s0 = Math.min( S.len, S.m0 * dP ), s1 = Math.max( s0, S.len - S.m1 * dP );
			const P = ( s, dd, yy ) => [ S.a[ 0 ] + S.ux * s + S.nx * dd, yy, S.a[ 1 ] + S.uz * s + S.nz * dd ];
			const m = mouths.get( S );
			const yM = m ? rowY( S, m.r0 - 1 ) - 0.95 : 0;
			// the concrete: its face to the club (round the mouth), its top, its back to row PA.row
			const face = m ? [ [ s0, m.s - m.w + 0.2 ], [ m.s + m.w - 0.2, s1 ] ] : [ [ s0, s1 ] ];
			for ( const [ a, b ] of face ) q.add( P( a, dP - 0.25, yLo ), P( b, dP - 0.25, yLo ), P( b, dP - 0.25, yC ), P( a, dP - 0.25, yC ), [ - S.nx, 0, - S.nz ], RISER_UV, RISER_UV );
			q.add( P( s0, dP - 0.25, yC ), P( s1, dP - 0.25, yC ), P( s1, dP, yC ), P( s0, dP, yC ), [ 0, 1, 0 ] );
			q.add( P( s0, dP, yUp ), P( s1, dP, yUp ), P( s1, dP, yC ), P( s0, dP, yC ), [ S.nx, 0, S.nz ], RISER_UV, RISER_UV );
			// the glass in panels between posts, a pipe rail on top
			const n = Math.max( 1, Math.round( ( s1 - s0 ) / 1.5 ) );
			gq.add( P( s0, dP - 0.12, yC + 0.02 ), P( s1, dP - 0.12, yC + 0.02 ), P( s1, dP - 0.12, yG - 0.04 ), P( s0, dP - 0.12, yG - 0.04 ), [ - S.nx, 0, - S.nz ], s0, s1 );
			beam( rq, P( s0, dP - 0.12, yG ), P( s1, dP - 0.12, yG ), 0.05 );
			beam( rq, P( s0, dP - 0.12, yC + 0.03 ), P( s1, dP - 0.12, yC + 0.03 ), 0.035 );
			for ( let k = 0; k <= n; k ++ ) beam( rq, P( s0 + ( s1 - s0 ) * k / n, dP - 0.12, yC ), P( s0 + ( s1 - s0 ) * k / n, dP - 0.12, yG + 0.02 ), 0.045 );
			box( S, s0 - 0.1, s1 + 0.1, dP - 0.12, Math.min( yLo, yM ) - 0.3, yG + 0.1, 0.3, tier.name + '-parapet' );
			if ( ! m ) continue;
			// the mouth: dark, its lintel the parapet's concrete over it, a light inside at the top
			const ma = m.s - m.w + 0.2, mb = m.s + m.w - 0.2;
			mq2.add( P( ma, dP - 0.2, yM ), P( mb, dP - 0.2, yM ), P( mb, dP - 0.2, yC - 0.18 ), P( ma, dP - 0.2, yC - 0.18 ), [ - S.nx, 0, - S.nz ] );
			q.add( P( ma, dP - 0.25, yC - 0.18 ), P( mb, dP - 0.25, yC - 0.18 ), P( mb, dP - 0.25, yC ), P( ma, dP - 0.25, yC ), [ - S.nx, 0, - S.nz ], RISER_UV, RISER_UV );
			// its approach: steps down from row r0 - 1's tread to the mouth's floor, between walls the rows'
			// cut ends make, a pipe rail along their tops
			const dA = S0 + m.r0 * D, dB = dP - 0.25, yA = rowY( S, m.r0 - 1 ), nS = Math.max( 2, Math.round( ( yA - yM ) / 0.17 ) );
			for ( let j = 0; j < nS; j ++ ) {

				const da = dA + ( dB - dA ) * j / nS, db = dA + ( dB - dA ) * ( j + 1 ) / nS, yj = yA - ( yA - yM ) * ( j + 1 ) / nS, yp = yA - ( yA - yM ) * j / nS;
				q.add( P( ma, da, yj ), P( mb, da, yj ), P( mb, db, yj ), P( ma, db, yj ), [ 0, 1, 0 ] );
				q.add( P( ma, da, yj ), P( mb, da, yj ), P( mb, da, yp ), P( ma, da, yp ), [ S.nx, 0, S.nz ], RISER_UV, RISER_UV );

			}
			for ( const [ sw, side ] of [ [ ma, 1 ], [ mb, - 1 ] ] ) {

				for ( let r = m.r0; r < m.r1; r ++ ) {

					const da = S0 + r * D, db = Math.min( dB, S0 + ( r + 1 ) * D ), y = rowY( S, r );
					const fa = yA - ( yA - yM ) * ( da - dA ) / ( dB - dA ), fb = yA - ( yA - yM ) * ( db - dA ) / ( dB - dA );
					q.add( P( sw, da, fa ), P( sw, db, fb ), P( sw, db, y ), P( sw, da, y ), [ S.ux * side, 0, S.uz * side ], RISER_UV, RISER_UV );

				}
				const r0y = rowY( S, m.r0 ), r1y = rowY( S, m.r1 - 1 );
				beam( rq, P( sw - side * 0.1, dA + 0.1, r0y + 0.9 ), P( sw - side * 0.1, dB, r1y + 0.9 ), 0.045 );
				beam( rq, P( sw - side * 0.1, dA + 0.1, r0y ), P( sw - side * 0.1, dA + 0.1, r0y + 0.92 ), 0.045 );

			}

		}

	}
	if ( gq.count ) {

		const g = new Mesh( gq.geometry(), materials.frontGlass || materials.rail );
		g.name = tier.name + '-parapet-glass';
		if ( g.material.transparent ) g.layers.set( 2 );
		group.add( g );

	}
	if ( mq2.count ) {

		const mm = new Mesh( mq2.geometry(), materials.portalMouth );
		mm.name = tier.name + '-tunnel-mouths';
		group.add( mm );

	}
	// (WA1-2) a portal's box: its cheeks, its back and the face round its mouth are walls up to the pipe rail
	// round its top. Under the deck the stair's side clears the cheek (the cheek's foot at the deck's
	// underside, over the climber's head)
	// (an open portal, FA1's, walls itself: its top is flush with the rows and its stair comes up under the cheeks)
	for ( const p of PO?.open ? [] : portals ) {

		const { S } = p, w = PO.width / 2 + 0.3, mw = PO.width / 2 - 0.2;
		const dF = S0 + p.r0 * D, dB = S0 + p.r1 * D;
		const yF = ys[ Math.max( 0, p.r0 - 1 ) ], yTop = ys[ Math.min( tier.rows - 1, p.r1 - 1 ) ] + 1.1, mTop = Math.min( yTop - 0.3, yF + 2.3 );
		const uMid = tier.soffit ? underside( ( dF + dB ) / 2 ) : yF;
		const P = ( s, dd ) => [ S.a[ 0 ] + S.ux * s + S.nx * dd, S.a[ 1 ] + S.uz * s + S.nz * dd ];
		for ( const e of [ - 1, 1 ] ) wallLine( P( p.s + e * w, dF ), P( p.s + e * w, dB ), uMid, yTop + 1.05, tier.name + '-portal' );
		wallLine( P( p.s - w, dB ), P( p.s + w, dB ), yF - 0.5, yTop + 1.05, tier.name + '-portal' );
		for ( const e of [ - 1, 1 ] ) wallLine( P( p.s + e * mw, dF ), P( p.s + e * w, dF ), yF - 0.5, yTop + 1.05, tier.name + '-portal' );
		wallLine( P( p.s - mw, dF ), P( p.s + mw, dF ), mTop, yTop + 1.05, tier.name + '-portal' );

	}
	if ( fr.count ) {

		const m = new Mesh( fr.geometry(), materials.frontRail || materials.rail );
		m.name = tier.name + '-front-rail';
		m.castShadow = true;
		group.add( m );

	}
	for ( const [ qq, mat, nm ] of [ [ fm, materials.frontMesh, '-front-mesh' ], [ fg, materials.frontGlass, '-front-glass' ] ] ) {

		if ( ! qq.count || ! mat ) continue;
		const m = new Mesh( qq.geometry(), mat );
		m.name = tier.name + nm;
		if ( mat.transparent ) m.layers.set( 2 ); // the late (transparent) pass
		group.add( m );

	}
	// ---- end FA3

	// the portals: a concrete box rising out of the rows with the tunnel mouth in its face (dark, lit
	// inside after dark), a pipe rail round its top, EXIT over the mouth
	const pq = new Quads(), mq = new Quads();
	for ( const p of portals ) {

		const { S } = p;
		const w = PO.width / 2 + 0.3;
		const dF = S0 + p.r0 * D, dB = S0 + p.r1 * D;
		// (---- FA1: an open portal is a vomitory flush with the rows round it, its top a landing level with its
		// last row, railed: the 2008 photos of the Pavilion Deck show no boxes standing out of its rows)
		const yF = ys[ Math.max( 0, p.r0 - 1 ) ], yTop = ys[ Math.min( tier.rows - 1, p.r1 - 1 ) ] + ( PO.open ? 0.05 : 1.1 );
		const at = ( s, d, y ) => [ S.a[ 0 ] + S.ux * s + S.nx * d, y, S.a[ 1 ] + S.uz * s + S.nz * d ];
		const f = [ - S.nx, 0, - S.nz ];
		// the face: concrete round the mouth (2.3 m high, the portal's width less the cheeks)
		const m0 = p.s - PO.width / 2 + 0.2, m1 = p.s + PO.width / 2 - 0.2, mTop = Math.min( yTop - 0.3, yF + 2.3 );
		pq.add( at( p.s - w, dF, yF ), at( m0, dF, yF ), at( m0, dF, yTop ), at( p.s - w, dF, yTop ), f );
		pq.add( at( m1, dF, yF ), at( p.s + w, dF, yF ), at( p.s + w, dF, yTop ), at( m1, dF, yTop ), f );
		pq.add( at( m0, dF, mTop ), at( m1, dF, mTop ), at( m1, dF, yTop ), at( m0, dF, yTop ), f );
		if ( ! PO.open ) mq.add( at( m0, dF + 0.05, yF ), at( m1, dF + 0.05, yF ), at( m1, dF + 0.05, mTop ), at( m0, dF + 0.05, mTop ), f ); // ---- FA1: an open portal's mouth is open
		// the cheeks and the top
		for ( const e of [ - 1, 1 ] ) pq.add( at( p.s + e * w, dF, yF ), at( p.s + e * w, dB, yF ), at( p.s + e * w, dB, yTop ), at( p.s + e * w, dF, yTop ), [ S.ux * e, 0, S.uz * e ] );
		pq.add( at( p.s - w, dF, yTop ), at( p.s + w, dF, yTop ), at( p.s + w, dB, yTop ), at( p.s - w, dB, yTop ), [ 0, 1, 0 ] );
		// ---- FA1 (WA2-1): an open portal's floor at the mouth's level from the mouth back to where the stair comes
		// up through it (PavilionWays.js: the stair along the section at the box's middle depth, its well left
		// open), its back wall up to the row behind, the cheeks solid
		if ( PO.open ) {

			const dm = ( dF + dB ) / 2, hw = PO.stairWidth / 2 || 0.7;
			pq.add( at( p.s - w, dF, yF ), at( p.s + w, dF, yF ), at( p.s + w, dm - hw, yF ), at( p.s - w, dm - hw, yF ), [ 0, 1, 0 ] );
			pq.add( at( p.s - w, dm + hw, yF ), at( p.s + w, dm + hw, yF ), at( p.s + w, dB, yF ), at( p.s - w, dB, yF ), [ 0, 1, 0 ] );
			pq.add( at( p.s - w, dB, yF - 0.3 ), at( p.s + w, dB, yF - 0.3 ), at( p.s + w, dB, ys[ p.r1 - 1 ] ), at( p.s - w, dB, ys[ p.r1 - 1 ] ), f );
			if ( colliders ) {

				const box = ( s0, s1, d0, d1, y0, y1, o ) => {

					const c = at( ( s0 + s1 ) / 2, ( d0 + d1 ) / 2, 0 ), W = toWorld( c[ 0 ], c[ 2 ] );
					colliders.addBox( new Vector3( W.x, ( y0 + y1 ) / 2, W.z ), new Vector3( ( s1 - s0 ) / 2, ( y1 - y0 ) / 2, ( d1 - d0 ) / 2 ), worldYaw - Math.atan2( S.uz, S.ux ), o );

				};
				box( p.s - w, p.s + w, dF, dm - hw, yF - 0.3, yF, { walkable: true, tag: tier.name + '-portal' } );
				box( p.s - w, p.s + w, dm + hw, dB, yF - 0.3, yF, { walkable: true, tag: tier.name + '-portal' } );
				for ( const e of [ - 1, 1 ] ) box( p.s + e * w - 0.1, p.s + e * w + 0.1, dF, dB, yF - 0.3, yTop, { tag: tier.name + '-portal-cheek' } );
				box( p.s - w, p.s + w, dB, dB + 0.15, yF - 0.3, yTop, { tag: tier.name + '-portal-back' } );
				// its top a landing in the rows (walkable), its rail over the mouth solid
				box( p.s - w, p.s + w, dF, dB, yTop - 0.2, yTop, { walkable: true, tag: tier.name + '-portal-top' } );
				box( p.s - w, p.s + w, dF, dF + 0.1, yTop, yTop + 1.1, { tag: tier.name + '-portal-rail' } );
				for ( const e of [ - 1, 1 ] ) box( p.s + e * w - 0.05, p.s + e * w + 0.05, dF, dB, yTop, yTop + 1.1, { tag: tier.name + '-portal-rail' } );

			}

		}
		// ---- end FA1
		// the rail round its top edge
		const yr = yTop + 1.0;
		beam( rq, at( p.s - w, dF, yr ), at( p.s + w, dF, yr ), 0.05 );
		for ( const e of [ - 1, 1 ] ) {

			beam( rq, at( p.s + e * w, dF, yr ), at( p.s + e * w, dB, yr ), 0.05 );
			beam( rq, at( p.s + e * w, dF, yTop ), at( p.s + e * w, dF, yr ), 0.05 );

		}

	}

	if ( pq.count ) {

		const pm = new Mesh( pq.geometry(), materials.concrete );
		pm.name = tier.name + '-portals';
		pm.castShadow = true;
		pm.receiveShadow = true;
		group.add( pm );
		if ( mq.count ) { // ---- FA1

			const mouth = new Mesh( mq.geometry(), materials.portalMouth );
			mouth.name = tier.name + '-portal-mouths';
			group.add( mouth );

		}

	}

	if ( rq.count ) {

		const rails = new Mesh( rq.geometry(), materials.rail );
		rails.name = tier.name + '-rails';
		group.add( rails );

	}

	const concrete = new Mesh( q.geometry(), materials.concrete );
	concrete.name = tier.name + '-steps';
	concrete.castShadow = true;
	concrete.receiveShadow = true;
	group.add( concrete );
	for ( const [ qq, mat, nm ] of [ [ fq, materials.fascia || materials.concrete, '-front' ], [ eq, materials.edgeBeam || materials.concrete, '-edge-beam' ] ] ) {

		const m = new Mesh( qq.geometry(), mat );
		m.name = tier.name + nm;
		m.castShadow = true;
		m.receiveShadow = true;
		group.add( m );

	}

	// seats: instanced meshes in chunks so the frustum culling can drop the ones behind you; a fan in
	// nearly every seat (Crowd.js), its seat folded down, the empty ones folded up
	// ---- SP1 (speed): the chunks are compact pieces of the stands, not runs of 1,500 seats in the order
	// they were laid (which straddled two or three sections, 50 to 160 m across): whole sections,
	// neighbours merged up to SEAT_CHUNK. The frustum and the occlusion culling (engine
	// render/Occlusion.js) can only drop a chunk that is wholly out of view, and the crowd's pieces
	// (bands of rows within a chunk, Crowd.addChunk) stay within a section or two
	const SEAT_CHUNK = 900;
	const crowd = materials.crowd;
	// ---- FS1 (C4S-4): the seats sat on read their fans' vacated bit (the seats' material, SEAT_FOLD)
	if ( crowd?.idsBuf && ! crowd.off && ! materials.seat.bindings.cwIds ) {

		materials.seat.bindings.cwIds = { storage: crowd.idsBuf, access: 'read' };
		materials.seat.setDefine( 'SEAT_FOLD', 1 );

	}
	// ---- end FS1
	const c = new Color();
	const groups = [];
	for ( let i = 0; i < seatMats.length; ) {

		let j = i;
		while ( j < seatMats.length && seatSec[ j ] === seatSec[ i ] ) j ++;
		const g = groups[ groups.length - 1 ];
		if ( g && g[ 1 ] === i && j - g[ 0 ] <= SEAT_CHUNK ) g[ 1 ] = j;
		else groups.push( [ i, j ] );
		i = j;

	}

	for ( const [ i0, i1 ] of groups ) {

		const idx = [ ...Array( i1 - i0 ).keys() ].map( ( i ) => i0 + i );
		const taken = crowd ? idx.filter( ( i ) => crowd.occupied( seatMats[ i ] ) ) : [];
		const empty = crowd ? idx.filter( ( i ) => ! crowd.occupied( seatMats[ i ] ) ) : idx;
		const fan0 = crowd && ! crowd.off ? crowd.count : - 1; // (FS1: the first fan addChunk gives these seats, below)
		for ( const [ list, geo ] of [ [ empty, materials.seatGeometry ], [ taken, materials.seatDownGeometry ] ] ) {

			if ( ! list.length ) continue;
			const mesh = new InstancedMesh( geo, materials.seat, list.length );
			if ( geo === materials.seatDownGeometry && fan0 >= 0 ) mesh.drawParams = [ fan0 + 1, 0, 0 ]; // ---- FS1 (C4S-4)
			list.forEach( ( k, i ) => {

				mesh.setMatrixAt( i, seatMats[ k ] );
				mesh.setColorAt( i, c.setRGB( seatCols[ k ], seatCols[ k ], seatCols[ k ] ) );

			} );
			mesh.computeBoundingBox();
			mesh.computeBoundingSphere();
			mesh.name = tier.name + '-seats';
			mesh.receiveShadow = true;
			group.add( mesh );

		}

		// the fans: the crowd cuts them into pieces of rows itself (Crowd.addChunk)
		if ( crowd ) crowd.addChunk( group, taken.map( ( k ) => seatMats[ k ] ), tier.name, taken.map( ( k ) => seatInfo[ k ] ) );
		// ---- end SP1

	}

	group.userData.seats = seatMats.length;
	return group;

}

// a wall along the tier at offset d (0 = its front edge), from y0 to y1, facing -n (side -1) or +n
function wallAlong( q, secs, d, y0, y1, side ) {

	for ( const S of secs ) {

		const s0 = Math.min( S.len, S.m0 * d ), s1 = Math.max( s0, S.len - S.m1 * d );
		const ax = S.a[ 0 ] + S.ux * s0 + S.nx * d, az = S.a[ 1 ] + S.uz * s0 + S.nz * d;
		const bx = S.a[ 0 ] + S.ux * s1 + S.nx * d, bz = S.a[ 1 ] + S.uz * s1 + S.nz * d;
		q.add( [ ax, y0, az ], [ bx, y0, bz ], [ bx, y1, bz ], [ ax, y1, az ], [ S.nx * side, 0, S.nz * side ] );

	}

}

function hash( x ) {

	const s = Math.sin( x ) * 43758.5453;
	return s - Math.floor( s );

}

// The seat's back (FW1, C2W-3: the seated crowd leans against it, Crowd.js): its front face z0 behind
// the seat's middle at its foot (y0 up), leaning back by `lean` radians to its top at y1
export const SEAT_BACK = { z0: 0.14, y0: 0.44, y1: 0.8, lean: 0.21, t: 0.035 };

// A folding stadium seat, low poly: seat pan and back (the tread under it reads as the frame). Origin
// at the floor under the seat's centre, facing -z.
export function seatGeometry( down = false ) {

	// An empty fold-down seat, facing -z, its origin on the tread under the seat's middle: a curved
	// back (top 0.8 m up), the pan folded up in front of it, and a dark cast standard with an armrest
	// on one side (the next seat's makes the other). Colours are per vertex: plastic blue, metal grey.
	const q = new Quads(), col = [];
	// (CB-12: a shade deeper and less saturated: the navy of the photos, Getty 84081873)
	const BLUE = [ 0.032, 0.075, 0.25 ], GREY = [ 0.04, 0.045, 0.052 ];
	const add = ( c, ...args ) => {

		q.add( ...args );
		for ( let i = 0; i < 6; i ++ ) col.push( ...c );

	};

	const w = 0.46 / 2;
	// the back: one panel leaning back 12 degrees, 4 cm thick (front, back, top)
	const lean = Math.tan( SEAT_BACK.lean ), b0 = SEAT_BACK.y0, b1 = SEAT_BACK.y1, bz = SEAT_BACK.z0, t = SEAT_BACK.t;
	const z = ( y ) => bz + ( y - b0 ) * lean;
	add( BLUE, [ - w, b0, z( b0 ) ], [ w, b0, z( b0 ) ], [ w, b1, z( b1 ) ], [ - w, b1, z( b1 ) ], [ 0, lean, - 1 ] );
	add( BLUE, [ w, b0, z( b0 ) + t ], [ - w, b0, z( b0 ) + t ], [ - w, b1, z( b1 ) + t ], [ w, b1, z( b1 ) + t ], [ 0, - lean, 1 ] );
	add( BLUE, [ - w, b1, z( b1 ) ], [ w, b1, z( b1 ) ], [ w, b1, z( b1 ) + t ], [ - w, b1, z( b1 ) + t ], [ 0, 1, 0 ] );

	if ( down ) {

		// the pan down, sat on: flat, 43 cm up, from the back to the front edge
		add( BLUE, [ - w + 0.01, 0.43, - 0.3 ], [ w - 0.01, 0.43, - 0.3 ], [ w - 0.01, 0.44, 0.14 ], [ - w + 0.01, 0.44, 0.14 ], [ 0, 1, 0 ] );

	} else {

		// the pan, folded up (75 degrees) in front of the back's lower half
		const pz = 0.02, p0 = 0.26, p1 = 0.62, tip = Math.tan( 0.26 );
		const zp = ( y ) => pz + ( y - p0 ) * tip;
		add( BLUE, [ - w + 0.01, p0, zp( p0 ) ], [ w - 0.01, p0, zp( p0 ) ], [ w - 0.01, p1, zp( p1 ) ], [ - w + 0.01, p1, zp( p1 ) ], [ 0, tip, - 1 ] );

	}
	// the standard: a cast leg from the tread, the armrest on top
	const sx = - w - 0.025;
	add( GREY, [ sx, 0, - 0.02 ], [ sx, 0, 0.2 ], [ sx, 0.6, 0.2 ], [ sx, 0.6, - 0.02 ], [ - 1, 0, 0 ] );
	add( GREY, [ sx - 0.005, 0.6, - 0.14 ], [ sx + 0.045, 0.6, - 0.14 ], [ sx + 0.045, 0.6, 0.22 ], [ sx - 0.005, 0.6, 0.22 ], [ 0, 1, 0 ] );
	const g = q.geometry();
	g.setAttribute( 'color', new Float32BufferAttribute( col, 3 ) );
	// ---- SP1 (speed): indexed, a quad's two triangles sharing their corners (geo.js indexed()): 24
	// vertices shaded a seat, not 36, for every one of the 45,000; the same triangles
	return indexed( g );
	// ---- end SP1

}

// ---- FI1 (CI-1): the soffit as the 2008 photos show it (harpo42, May 2008, 129-130 by day: galvanized
// corrugated deck on maroon steel; auds, 27 Oct 2008, behind 125 and over Brewerytown at night: the deck
// dark, lit only near the HID domes). It was a pale self-lit office ceiling with a grid of strip lamps,
// brightest at night. Now: no lamps and no glow of its own (the domes are real lights, Concourse.js and
// LocalLights), just a little light bounced up off the floor after dark; the steel under the concourse
// decks is geometry (ConcourseSteel.js), so here only the deck's ribs and the faint lines of the joists it
// sits on, for the decks seen from afar.
// A deck's underside, for a surface shader (world position in.P): galvanized ribbed steel deck, mottled,
// the joists' lines every 3 m
export const SOFFIT_WGSL = /* wgsl */`
	{
		let sq = in.P.xz;
		let sfw = fwidth( sq.x ) + fwidth( sq.y ) + 0.001;
		let far = clamp( sfw * 6.0, 0.0, 1.0 );
		// the ribs every 0.3 m: lit crests, darker troughs, their mean far off
		let rib = 0.74 + 0.26 * smoothstep( 0.16, 0.3, abs( fract( sq.y / 0.3 ) - 0.5 ) );
		// the galvanizing's spangle and streaks, sheet by sheet (0.9 m by 6 m)
		let sh = fract( sin( dot( floor( sq / vec2f( 6.0, 0.9 ) ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
		var sc = vec3f( 0.27, 0.272, 0.268 ) * ( 0.84 + 0.16 * sh ) * mix( rib, 0.87, far );
		// where the deck sits on a joist, a dark line (far off only a hint)
		let jz = abs( fract( sq.x / 3.0 ) - 0.5 ) * 3.0;
		sc *= 1.0 - 0.45 * ( 1.0 - smoothstep( 0.05, 0.1, jz ) ) * ( 1.0 - far * 0.7 );
		let snk = smoothstep( 0.1, 0.7, frame.night );
		s.albedo = sc;
		s.roughness = 0.5;
		s.metalness = 0.25;
		// what the floor bounces up: daylight off the concourse by day, the domes' light after dark
		s.emissive = sc * mix( 0.13, 0.05, snk );
	}
`;
// ---- end FI1

export function standsMaterials() {

	// after dark the bowl is lit by the towers and the concourse lights: a fill the spots alone don't
	// give (stronger on what faces up), and light fixtures in every soffit
	// double-sided: seen from below or behind, the treads and risers close the decks up (no seats
	// floating against the sky)
	const concrete = standard( { name: 'stands-concrete', color: new Color( 0.32, 0.31, 0.29 ), roughness: 0.85, side: 'double',
		surface: /* wgsl */`
	let nk = smoothstep( 0.15, 0.7, frame.night );
	// ---- FW3 (C2W-22): the steps read as steps (Getty 83458502, 27 Oct 2008: every tread's edge a line).
	// A tread: its front edge worn paler, a dark line of grime where the riser behind meets it, and in the
	// aisle the nosing painted a dull safety yellow; a riser in the tread's shade; a step light lit
	var lens = 0.0;
	if ( in.uv.x > ${ STEPLIGHT_UV - 1 }.0 ) {
		lens = 1.0;
		s.albedo = vec3f( 0.6, 0.58, 0.5 );
	} else if ( in.uv.x > ${ TREAD_UV - 1 }.0 && in.N.y > 0.6 ) {
		let ad = in.uv.x - ${ TREAD_UV }.0;
		let fv = fwidth( in.uv.y ) + 0.002;
		let nose = 1.0 - smoothstep( 0.05, 0.05 + fv, in.uv.y );
		let back = smoothstep( 0.6, 0.8, in.uv.y ) * ( 1.0 - clamp( fv * 6.0, 0.0, 1.0 ) );
		let aisle = 1.0 - smoothstep( 0.58, 0.64, ad );
		s.albedo = s.albedo * ( 1.0 + 0.18 * nose * ( 1.0 - aisle ) ) * ( 1.0 - 0.22 * back );
		s.albedo = mix( s.albedo, vec3f( 0.42, 0.34, 0.08 ), nose * aisle * 0.85 * ( 1.0 - clamp( fv * 3.0, 0.0, 0.6 ) ) );
	} else if ( in.uv.x > ${ RISER_UV - 1 }.0 && in.uv.x < ${ TREAD_UV - 1 }.0 && abs( in.N.y ) < 0.5 ) {
		s.albedo = s.albedo * 0.68;
	}
	// ---- end FW3
	s.emissive = s.albedo * nk * ( 0.06 + 0.06 * max( in.N.y, 0.0 ) ) + vec3f( 1.0, 0.86, 0.6 ) * lens * mix( 0.4, 2.2, nk );
	if ( in.N.y < - 0.6 ) {
${ SOFFIT_WGSL }
	}
` } );
	// navy seats; per-instance colour carries a little fading
	// each seat shades itself: the lower part of the row in the shadow of the row in front, a bright
	// top edge on the back, a sheen on the plastic; so rows stay readable far off
	// (---- SP3: worldFromDepth: 45,000 seats of a few pixels each, their world position from the pixel's
	// depth rather than a varying per vertex: engine MeshShader WORLD_FROM_DEPTH)
	const seat = standard( { name: 'seats', color: new Color( 1, 1, 1 ), roughness: 0.38, side: 'double', vertexColors: true, worldFromDepth: true,
		varyings: { vSeatY: 'f32' },
		defines: { SEAT_FOLD: 0 },
		// ---- FS1 (C4S-4): a seat whose fan has gone (Crowd.vacate: the delay's emptying, the 29th's filling)
		// folds its pan up as the empty seats' are (seatGeometry(): 75 degrees, in front of the back's lower
		// half), read from the crowd's ids (bit 31) for the seats built sat on (buildTier: drawParams, the
		// first fan + 1). They stayed down, a field of flat blue shelves where Getty 83511062 has every
		// empty seat's pan up
		vertex: /* wgsl */`
#if SEAT_FOLD
	if ( draw.params.y > 0.5 && v.normal.y > 0.9 && v.position.y < 0.5 ) {
		let fan = u32( draw.params.y + 0.5 ) - 1u + v.instance;
		if ( ( cwIds[ fan ].z >> 31u ) == 1u ) {
			let k = clamp( ( 0.14 - v.position.z ) / 0.44, 0.0, 1.0 );
			v.position = vec3f( v.position.x, 0.26 + 0.36 * k, 0.02 + 0.0956 * k );
			v.normal = vec3f( 0.0, 0.257, - 0.966 );
		}
	}
#endif
	o.vSeatY = v.position.y;
`, // ---- end FS1
		surface: /* wgsl */`
	let y = in.vs.vSeatY;
	let ao = mix( 0.38, 1.0, smoothstep( 0.2, 0.72, y ) );
	let rim = smoothstep( 0.74, 0.8, y ) * 0.35;
	s.albedo = s.albedo * ao + vec3f( rim * 0.12 );
	// CB-12 (gauntlet r1): after dark the empty seats went a near-black navy in the photos of the emptied
	// park on the 27th (Getty 84081873: ~(25, 26, 32)), a slate gleam only on the backs that catch the
	// banks; a 0.12 lift made whole blocks glow royal blue. The banks light them; the lift is a trace
	s.emissive = s.albedo * smoothstep( 0.15, 0.7, frame.night ) * 0.03;
` } );
	// galvanized steel for the rails
	// (---- FS1, C4S-7: dull, weathered galvanizing, a pale grey that catches the banks: smooth and mostly
	// metal it mirrored the night sky, every aisle's handrail and the Diamond Club's rail black bars where
	// Getty 83485581 and brownwall 2981780425 have them silver-grey under the lights)
	const rail = standard( { name: 'rails', color: new Color( 0.6, 0.61, 0.62 ), roughness: 0.55, metalness: 0.45 } );
	// the decks' fronts: light grey precast in 6 m panels with a drip groove under the top, over maroon
	// steel edge beams
	const fascia = standard( { name: 'deck-fascia', color: new Color( 0.58, 0.55, 0.49 ), roughness: 0.85, side: 'double',
		surface: /* wgsl */`
	let j = step( 0.992, fract( ( in.P.x + in.P.z ) / 6.0 ) );
	let g = 1.0 - step( 0.9, fract( in.P.y ) ) * step( fract( in.P.y ), 0.93 );
	s.albedo = mat.color * ( 1.0 - 0.3 * j ) * mix( 0.75, 1.0, g );
	s.emissive = s.albedo * smoothstep( 0.15, 0.7, frame.night ) * 0.14;
` } );
	const edgeBeam = standard( { name: 'deck-edge-beam', color: new Color( 0.155, 0.024, 0.018 ), roughness: 0.55, metalness: 0.3, side: 'double' } );
	// a portal's mouth: the dark tunnel, a lit ceiling at its top, EXIT in green over it
	const portalMouth = standard( { name: 'portal-mouth', color: new Color( 0.012, 0.012, 0.013 ), roughness: 0.9,
		surface: `
	let v = in.uv.y;
	s.emissive = vec3f( 1.0, 0.88, 0.66 ) * 0.12 * mix( 0.5, 1.0, frame.night );
` } );
	// ---- FA3 (WA2-5): the field level's own rails (buildTier's frontRail: the right field seats' front, the
	// rail over the dugouts' roofs): dark green painted pipe as the field wall's (Field.js), chain-link in
	// the panels (5 cm diamonds, a veil when finer than a pixel, as the left field's), clear glass a little
	// green at the aisles' feet (Commons 2008-03-29 2371427833)
	const frontRail = standard( { name: 'front-rail', color: new Color( 0.015, 0.05, 0.03 ), roughness: 0.45, metalness: 0.6 } );
	const frontMesh = standard( { name: 'front-mesh', color: new Color( 0.02, 0.05, 0.035 ), roughness: 0.5, metalness: 0.5, side: 'double', alphaTest: 0.5,
		surface: /* wgsl */`
	let p = vec2f( in.uv.x + in.uv.y, in.uv.x - in.uv.y ) / 0.05;
	let g = abs( fract( p ) - 0.5 );
	let fw = fwidth( p.x );
	let wire = step( 0.42 - fw, max( g.x, g.y ) );
	s.alpha = max( wire * step( fw, 0.9 ), clamp( fw * 0.35, 0.0, 0.15 ) );
` } );
	const frontGlass = standard( { name: 'front-glass', color: new Color( 0.06, 0.09, 0.08 ), roughness: 0.05, metalness: 0.1, transparent: true, depthWrite: false, side: 'double',
		surface: 's.alpha = 0.1 + 0.45 * pow( 1.0 - clamp( abs( dot( normalize( in.N ), normalize( frame.cameraPos - in.P ) ) ), 0.0, 1.0 ), 4.0 ); s.albedo = mat.color * ( 1.0 - 0.3 * frame.wet );' } );
	for ( const m of [ concrete, seat, rail, portalMouth, fascia, edgeBeam, frontRail, frontMesh, frontGlass ] ) m.underwaterLighting = 'none';
	return { concrete, seat, rail, portalMouth, fascia, edgeBeam, frontRail, frontMesh, frontGlass, seatGeometry: seatGeometry(), seatDownGeometry: seatGeometry( true ) };
	// ---- end FA3

}

// Collects flat-shaded quads into one geometry; winding follows the normal given.
export class Quads {

	constructor() {

		this.pos = [];
		this.nrm = [];
		this.uv = [];
		this.count = 0;

	}

	add( a, b, c, d, n, u0 = 0, u1 = 1 ) {

		this.tri( a, b, c, n, [ u0, a[ 1 ] ], [ u1, b[ 1 ] ], [ u1, c[ 1 ] ] );
		this.tri( a, c, d, n, [ u0, a[ 1 ] ], [ u1, c[ 1 ] ], [ u0, d[ 1 ] ] );

	}

	tri( a, b, c, n, ua = [ 0, 0 ], ub = [ 0, 0 ], uc = [ 0, 0 ] ) {

		const e1 = [ b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] ], e2 = [ c[ 0 ] - a[ 0 ], c[ 1 ] - a[ 1 ], c[ 2 ] - a[ 2 ] ];
		const cx = e1[ 1 ] * e2[ 2 ] - e1[ 2 ] * e2[ 1 ], cy = e1[ 2 ] * e2[ 0 ] - e1[ 0 ] * e2[ 2 ], cz = e1[ 0 ] * e2[ 1 ] - e1[ 1 ] * e2[ 0 ];
		if ( cx * n[ 0 ] + cy * n[ 1 ] + cz * n[ 2 ] < 0 ) {

			[ b, c ] = [ c, b ];
			[ ub, uc ] = [ uc, ub ];

		}

		const l = Math.hypot( n[ 0 ], n[ 1 ], n[ 2 ] ) || 1;
		this.pos.push( ...a, ...b, ...c );
		for ( let i = 0; i < 3; i ++ ) this.nrm.push( n[ 0 ] / l, n[ 1 ] / l, n[ 2 ] / l );
		this.uv.push( ...ua, ...ub, ...uc );
		this.count ++;

	}

	geometry() {

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( this.pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( this.nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( this.uv, 2 ) );
		g.computeBoundingBox();
		g.computeBoundingSphere();
		return g;

	}

}
