import { Group, Mesh, InstancedMesh, BufferGeometry, Float32BufferAttribute, Matrix4, Quaternion, Vector2, Vector3, Color } from '../engine/index.js';
import { triangulateShape } from '../engine/math/ShapeUtils.js';
import { standard } from '../materials/Materials.js';
import { beam } from './geo.js';

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
//   frontWall: { top }          a fascia / wall in front of the first row, from `base` up to `top`
//   back: { height }            a wall behind the last row
//   soffit                      an upper deck: its underside runs this far below the rows (m), and
//                               the stepped profile is closed at the tier's two ends
//   portals: { every, row, rows, width }   a tunnel portal (vomitory) in the middle of every `every`th
//                               section, `rows` rows deep from row `row`, `width` wide
// }
export const SEAT_W = 0.5;

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
		const n = Math.max( 1, Math.ceil( len / ( tier.section || 1e9 ) ) );
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
			} );

		}

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

export function buildTier( tier, { toWorld, worldYaw, colliders, materials } ) {

	const group = new Group();
	group.name = tier.name;
	const ys = rowHeights( tier );
	const secs = tierSections( tier );
	const D = tier.depth, A = tier.aisle ?? 1.2, W = tier.seat ?? SEAT_W;
	const S0 = tier.start || 0; // the first row's front edge, this far behind the front line
	const base = tier.base ?? 0;
	const q = new Quads();
	const seatMats = [];
	const seatCols = [];
	const _m = new Matrix4(), _q = new Quaternion(), _p = new Vector3(), _s = new Vector3( 1, 1, 1 ), _up = new Vector3( 0, 1, 0 );

	const portals = [];
	const PO = tier.portals;
	secs.forEach( ( S, k ) => {

		if ( ! PO || ! S.seats || S.len < PO.width + 3 || k % PO.every !== Math.floor( PO.every / 2 ) ) return;
		portals.push( { S, s: S.len / 2, r0: PO.row, r1: PO.row + PO.rows } );

	} );
	const inPortal = ( S, s, r ) => portals.some( ( p ) => p.S === S && r >= p.r0 - 1 && r < p.r1 && Math.abs( s - p.s ) < PO.width / 2 + 0.35 );

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
		const yawSeat = Math.atan2( - nx, - nz ); // seats face the field (-n)
		const first = S.skipRows || 0;
		for ( let r = first; r < tier.rows; r ++ ) {

			const d0 = S0 + r * D, d1 = S0 + ( r + 1 ) * D;
			const y = ys[ r ], yPrev = r > first ? ys[ r - 1 ] : ( first ? base : ( tier.frontY ?? base ) );
			const [ f0, f1 ] = ends( d0 ), [ b0, b1 ] = ends( d1 );
			if ( f1 - f0 < 0.05 && b1 - b0 < 0.05 ) continue;
			// tread
			const A0 = at( f0, d0 ), A1 = at( f1, d0 ), B1 = at( b1, d1 ), B0 = at( b0, d1 );
			q.add( [ A0[ 0 ], y, A0[ 1 ] ], [ A1[ 0 ], y, A1[ 1 ] ], [ B1[ 0 ], y, B1[ 1 ] ], [ B0[ 0 ], y, B0[ 1 ] ], [ 0, 1, 0 ] );
			// riser in front of it
			q.add( [ A0[ 0 ], yPrev, A0[ 1 ] ], [ A1[ 0 ], yPrev, A1[ 1 ] ], [ A1[ 0 ], y, A1[ 1 ] ], [ A0[ 0 ], y, A0[ 1 ] ], [ - nx, 0, - nz ] );

			// walkable: an oriented box under the tread (world frame)
			if ( colliders ) {

				const cs = ( Math.max( f0, b0 ) + Math.min( f1, b1 ) ) / 2, hl = Math.max( 0.05, ( Math.min( f1, b1 ) - Math.max( f0, b0 ) ) / 2 );
				const [ cx, cz ] = at( cs, ( d0 + d1 ) / 2 );
				const w = toWorld( cx, cz );
				const bottom = Math.max( base, y - 3 );
				colliders.addBox( new Vector3( w.x, ( y + bottom ) / 2, w.z ), new Vector3( hl, ( y - bottom ) / 2, D / 2 ), worldYaw - Math.atan2( uz, ux ) + 0, { walkable: true, tag: tier.name } );

			}

			// seats: along the row between the aisles, centred
			if ( ! S.seats ) continue;
			const dSeat = d0 + D * 0.55;
			const [ s0, s1 ] = seatEnds( dSeat );
			const lo = s0 + A / 2, hi = s1 - A / 2;
			const n = Math.floor( ( hi - lo ) / W );
			if ( n < 1 ) continue;
			const start = lo + ( hi - lo - n * W ) / 2 + W / 2;
			for ( let i = 0; i < n; i ++ ) {

				if ( portals.length && inPortal( S, start + i * W, r ) ) continue;
				const [ x, z ] = at( start + i * W, dSeat );
				_q.setFromAxisAngle( _up, yawSeat );
				_m.compose( _p.set( x, y, z ), _q, _s );
				seatMats.push( _m.clone() );
				// a little fading from seat to seat
				const k = 0.9 + 0.2 * hash( x * 13.1 + z * 7.7 + r );
				seatCols.push( k );

			}

		}

	}

	// an upper deck's underside, parallel to the rake, and its two stepped end profiles
	if ( tier.soffit ) {

		const t = tier.soffit, yB = ys[ ys.length - 1 ];
		const dF = S0, dB = S0 + tier.rows * D;
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

		const top = tier.frontWall.top ?? ys[ 0 ];
		const bottom = ys[ 0 ] - ( tier.soffit || 1 );
		for ( const S of secs ) {

			const s0 = Math.min( S.len, S.m0 * S0 ), s1 = Math.max( s0, S.len - S.m1 * S0 );
			const mid = ( s0 + s1 ) / 2;
			const cx = S.a[ 0 ] + S.ux * mid + S.nx * ( S0 - 0.1 ), cz = S.a[ 1 ] + S.uz * mid + S.nz * ( S0 - 0.1 );
			const w = toWorld( cx, cz );
			colliders.addBox( new Vector3( w.x, ( top + bottom ) / 2, w.z ), new Vector3( ( s1 - s0 ) / 2, ( top - bottom ) / 2, 0.12 ), worldYaw - Math.atan2( S.uz, S.ux ), { tag: tier.name + '-front' } );

		}

	}

	// the front wall / fascia and the back wall along the whole tier
	if ( tier.frontWall ) wallAlong( q, secs, S0, base, tier.frontWall.top ?? ys[ 0 ], - 1 );
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
			return [ S.a[ 0 ] + S.ux * s + S.nx * d, ys[ r ] + RH, S.a[ 1 ] + S.uz * s + S.nz * d ];

		};
		for ( let r0 = first + 1; r0 < tier.rows - 1; r0 += 4 ) {

			const r1 = Math.min( tier.rows - 1, r0 + 2 );
			for ( let r = r0; r < r1; r ++ ) beam( rq, mid( r ), mid( r + 1 ), 0.045 );
			for ( const r of [ r0, r1 ] ) {

				const p = mid( r );
				beam( rq, [ p[ 0 ], ys[ r ], p[ 2 ] ], p, 0.04 );

			}

		}

	}

	if ( tier.frontWall ) {

		const top = tier.frontWall.top ?? ys[ 0 ], y = top + 0.32;
		for ( const S of secs ) {

			const d = S0 - 0.12;
			const s0 = Math.min( S.len, S.m0 * d ), s1 = Math.max( s0, S.len - S.m1 * d );
			const P = ( s, yy ) => [ S.a[ 0 ] + S.ux * s + S.nx * d, yy, S.a[ 1 ] + S.uz * s + S.nz * d ];
			beam( rq, P( s0, y ), P( s1, y ), 0.05 );
			const n = Math.max( 1, Math.round( ( s1 - s0 ) / 2.2 ) );
			for ( let i = 0; i <= n; i ++ ) beam( rq, P( s0 + ( s1 - s0 ) * i / n, top ), P( s0 + ( s1 - s0 ) * i / n, y ), 0.04 );

		}

	}

	// the portals: a concrete box rising out of the rows with the tunnel mouth in its face (dark, lit
	// inside after dark), a pipe rail round its top, EXIT over the mouth
	const pq = new Quads(), mq = new Quads();
	for ( const p of portals ) {

		const { S } = p;
		const w = PO.width / 2 + 0.3;
		const dF = S0 + p.r0 * D, dB = S0 + p.r1 * D;
		const yF = ys[ Math.max( 0, p.r0 - 1 ) ], yTop = ys[ Math.min( tier.rows - 1, p.r1 - 1 ) ] + 1.1;
		const at = ( s, d, y ) => [ S.a[ 0 ] + S.ux * s + S.nx * d, y, S.a[ 1 ] + S.uz * s + S.nz * d ];
		const f = [ - S.nx, 0, - S.nz ];
		// the face: concrete round the mouth (2.3 m high, the portal's width less the cheeks)
		const m0 = p.s - PO.width / 2 + 0.2, m1 = p.s + PO.width / 2 - 0.2, mTop = Math.min( yTop - 0.3, yF + 2.3 );
		pq.add( at( p.s - w, dF, yF ), at( m0, dF, yF ), at( m0, dF, yTop ), at( p.s - w, dF, yTop ), f );
		pq.add( at( m1, dF, yF ), at( p.s + w, dF, yF ), at( p.s + w, dF, yTop ), at( m1, dF, yTop ), f );
		pq.add( at( m0, dF, mTop ), at( m1, dF, mTop ), at( m1, dF, yTop ), at( m0, dF, yTop ), f );
		mq.add( at( m0, dF + 0.05, yF ), at( m1, dF + 0.05, yF ), at( m1, dF + 0.05, mTop ), at( m0, dF + 0.05, mTop ), f );
		// the cheeks and the top
		for ( const e of [ - 1, 1 ] ) pq.add( at( p.s + e * w, dF, yF ), at( p.s + e * w, dB, yF ), at( p.s + e * w, dB, yTop ), at( p.s + e * w, dF, yTop ), [ S.ux * e, 0, S.uz * e ] );
		pq.add( at( p.s - w, dF, yTop ), at( p.s + w, dF, yTop ), at( p.s + w, dB, yTop ), at( p.s - w, dB, yTop ), [ 0, 1, 0 ] );
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
		const mouth = new Mesh( mq.geometry(), materials.portalMouth );
		mouth.name = tier.name + '-portal-mouths';
		group.add( mouth );

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

	// seats: instanced meshes in chunks so the frustum culling can drop the ones behind you; a fan in
	// nearly every seat (Crowd.js), its seat folded down, the empty ones folded up
	const CHUNK = 1500;
	const crowd = materials.crowd;
	const c = new Color();
	for ( let i0 = 0; i0 < seatMats.length; i0 += CHUNK ) {

		const idx = [ ...Array( Math.min( CHUNK, seatMats.length - i0 ) ).keys() ].map( ( i ) => i0 + i );
		const taken = crowd ? idx.filter( ( i ) => crowd.occupied( seatMats[ i ] ) ) : [];
		const empty = crowd ? idx.filter( ( i ) => ! crowd.occupied( seatMats[ i ] ) ) : idx;
		for ( const [ list, geo ] of [ [ empty, materials.seatGeometry ], [ taken, materials.seatDownGeometry ] ] ) {

			if ( ! list.length ) continue;
			const mesh = new InstancedMesh( geo, materials.seat, list.length );
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

		if ( crowd ) crowd.addChunk( group, taken.map( ( k ) => seatMats[ k ] ), tier.name );

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

// A folding stadium seat, low poly: seat pan and back (the tread under it reads as the frame). Origin
// at the floor under the seat's centre, facing -z.
export function seatGeometry( down = false ) {

	// An empty fold-down seat, facing -z, its origin on the tread under the seat's middle: a curved
	// back (top 0.8 m up), the pan folded up in front of it, and a dark cast standard with an armrest
	// on one side (the next seat's makes the other). Colours are per vertex: plastic blue, metal grey.
	const q = new Quads(), col = [];
	const BLUE = [ 0.036, 0.1, 0.32 ], GREY = [ 0.04, 0.045, 0.052 ];
	const add = ( c, ...args ) => {

		q.add( ...args );
		for ( let i = 0; i < 6; i ++ ) col.push( ...c );

	};

	const w = 0.46 / 2;
	// the back: one panel leaning back 12 degrees, 4 cm thick (front, back, top)
	const lean = Math.tan( 0.21 ), b0 = 0.44, b1 = 0.8, bz = 0.14, t = 0.035;
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
	return g;

}

export function standsMaterials() {

	// after dark the bowl is lit by the towers and the concourse lights: a fill the spots alone don't
	// give (stronger on what faces up), and light fixtures in every soffit
	// double-sided: seen from below or behind, the treads and risers close the decks up (no seats
	// floating against the sky)
	const concrete = standard( { name: 'stands-concrete', color: new Color( 0.32, 0.31, 0.29 ), roughness: 0.85, side: 'double',
		surface: /* wgsl */`
	let nk = smoothstep( 0.15, 0.7, frame.night );
	s.emissive = s.albedo * nk * ( 0.06 + 0.06 * max( in.N.y, 0.0 ) );
	if ( in.N.y < - 0.6 ) {
		let g = abs( fract( in.P.xz / 5.0 ) - 0.5 );
		let fx = 1.0 - smoothstep( 0.04, 0.06, max( g.x, g.y * 2.5 ) );
		s.emissive += vec3f( 1.0, 0.86, 0.62 ) * fx * nk * 2.5;
		s.emissive += vec3f( 1.0, 0.8, 0.55 ) * nk * 0.05;
	}
` } );
	// navy seats; per-instance colour carries a little fading
	// each seat shades itself: the lower part of the row in the shadow of the row in front, a bright
	// top edge on the back, a sheen on the plastic; so rows stay readable far off
	const seat = standard( { name: 'seats', color: new Color( 1, 1, 1 ), roughness: 0.38, side: 'double', vertexColors: true,
		varyings: { vSeatY: 'f32' },
		vertex: 'o.vSeatY = v.position.y;',
		surface: /* wgsl */`
	let y = in.vs.vSeatY;
	let ao = mix( 0.38, 1.0, smoothstep( 0.2, 0.72, y ) );
	let rim = smoothstep( 0.74, 0.8, y ) * 0.35;
	s.albedo = s.albedo * ao + vec3f( rim * 0.12 );
	s.emissive = s.albedo * smoothstep( 0.15, 0.7, frame.night ) * 0.12;
` } );
	// galvanized steel for the rails
	const rail = standard( { name: 'rails', color: new Color( 0.55, 0.56, 0.57 ), roughness: 0.35, metalness: 0.8 } );
	// a portal's mouth: the dark tunnel, a lit ceiling at its top, EXIT in green over it
	const portalMouth = standard( { name: 'portal-mouth', color: new Color( 0.012, 0.012, 0.013 ), roughness: 0.9,
		surface: `
	let v = in.uv.y;
	s.emissive = vec3f( 1.0, 0.88, 0.66 ) * 0.12 * mix( 0.5, 1.0, frame.night );
` } );
	for ( const m of [ concrete, seat, rail, portalMouth ] ) m.underwaterLighting = 'none';
	return { concrete, seat, rail, portalMouth, seatGeometry: seatGeometry(), seatDownGeometry: seatGeometry( true ) };

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
