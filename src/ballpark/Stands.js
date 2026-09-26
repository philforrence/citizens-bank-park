import { Group, Mesh, InstancedMesh, BufferGeometry, Float32BufferAttribute, Matrix4, Quaternion, Vector3, Color } from '../engine/index.js';
import { standard } from '../materials/Materials.js';

// Seating tiers, built the way real stands are: the front edge is a polyline of straight sections;
// each section's rows are straight and parallel to its front, rising step by step away from the
// field. Where sections meet at an angle the rows are mitred on the inside of the turn, and an aisle
// runs between every pair of sections (it widens toward the back where the bowl turns outward).
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
//   rise: n | ( r ) => n        riser height in front of row r (r >= 1)
//   section                     longest straight section (m); longer front segments are split
//   aisle                       aisle width (m)
//   seat                        seat spacing along a row (m)
//   skip: [ [ i0, i1 ] ]        front segment index ranges with no seats (landings, tunnels, cameras)
//   base                        bottom of the stepped block (m): the ground below the lower bowl, or
//                               the underside of an upper deck
//   frontWall: { height, thickness } a fascia / wall in front of the first row
//   back: { height }            a wall behind the last row
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

// the sections of a tier: straight pieces of its front, with the turn at each end
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

		// the turn at each end of the front segment: > 0 turning away from the rows (the section
		// opens up there: no mitre, a wedge aisle), < 0 toward them (mitre: rows get shorter)
		const turnAt = ( j ) => {

			if ( j <= 0 || j >= P.length - 1 ) return 0;
			const [ px, pz ] = P[ j - 1 ], [ cx, cz ] = P[ j ], [ qx, qz ] = P[ j + 1 ];
			const l1 = Math.hypot( cx - px, cz - pz ), l2 = Math.hypot( qx - cx, qz - cz );
			const a1 = Math.atan2( ( cz - pz ) / l1, ( cx - px ) / l1 ), a2 = Math.atan2( ( qz - cz ) / l2, ( qx - cx ) / l2 );
			let t = a2 - a1;
			while ( t > Math.PI ) t -= 2 * Math.PI;
			while ( t < - Math.PI ) t += 2 * Math.PI;
			// sign relative to the outward normal: turning toward n means the rows converge
			const cross = ( ( cx - px ) / l1 ) * nz - ( ( cz - pz ) / l1 ) * nx;
			return cross > 0 ? - Math.abs( t ) * Math.sign( t ) * Math.sign( cross ) : t * Math.sign( - cross || 1 );

		};

		// split long segments into sections
		const n = Math.max( 1, Math.ceil( len / ( tier.section || 1e9 ) ) );
		const skip = ( tier.skip || [] ).some( ( [ i0, i1 ] ) => k >= i0 && k <= i1 );
		for ( let s = 0; s < n; s ++ ) {

			const t0 = s / n, t1 = ( s + 1 ) / n;
			out.push( {
				k, a: [ ax + ( bx - ax ) * t0, az + ( bz - az ) * t0 ], len: len / n, ux, uz, nx, nz,
				// mitre (inside turns only) at the ends that are the front polyline's corners
				trim0: s === 0 ? mitre( P, k, nx, nz, true ) : 0,
				trim1: s === n - 1 ? mitre( P, k + 1, nx, nz, false ) : 0,
				seats: ! skip,
			} );
			void turnAt;

		}

	}

	return out;

}

// How much a row at offset d must be shortened per metre of offset at the polyline corner j (tan of
// half the turn) when the corner turns toward the rows; 0 when it turns away (the wedge aisle).
function mitre( P, j, nx, nz, atStart ) {

	if ( j <= 0 || j >= P.length - 1 ) return 0;
	const [ px, pz ] = P[ j - 1 ], [ cx, cz ] = P[ j ], [ qx, qz ] = P[ j + 1 ];
	// the neighbour segment's direction, pointing away from the corner
	const [ ex, ez ] = atStart ? [ px - cx, pz - cz ] : [ qx - cx, qz - cz ];
	const l = Math.hypot( ex, ez );
	// the neighbour bends toward the rows side when it points along +n
	const along = ( ex * nx + ez * nz ) / l;
	if ( along <= 1e-4 ) return 0;
	// angle between this segment's line and the neighbour: sin = along
	const theta = Math.asin( Math.min( 1, along ) );
	// the corner's interior half-angle is ( PI - theta ) / 2: rows are cut by d / tan of it
	return 1 / Math.tan( ( Math.PI - theta ) / 2 );

}

export function buildTier( tier, { toWorld, worldYaw, colliders, materials } ) {

	const group = new Group();
	group.name = tier.name;
	const ys = rowHeights( tier );
	const secs = tierSections( tier );
	const D = tier.depth, A = tier.aisle ?? 1.2, W = tier.seat ?? SEAT_W;
	const base = tier.base ?? 0;
	const q = new Quads();
	const seatMats = [];
	const seatCols = [];
	const _m = new Matrix4(), _q = new Quaternion(), _p = new Vector3(), _s = new Vector3( 1, 1, 1 ), _up = new Vector3( 0, 1, 0 );

	for ( const S of secs ) {

		const { a, len, ux, uz, nx, nz } = S;
		// the row's two ends at offset d (along the section's front line from a)
		const ends = ( d ) => {

			const s0 = Math.min( len, S.trim0 * d ), s1 = Math.max( s0, len - S.trim1 * d );
			return [ s0, s1 ];

		};

		const at = ( s, d ) => [ a[ 0 ] + ux * s + nx * d, a[ 1 ] + uz * s + nz * d ];
		const yawSeat = Math.atan2( - nx, - nz ); // seats face the field (-n)
		for ( let r = 0; r < tier.rows; r ++ ) {

			const d0 = r * D, d1 = ( r + 1 ) * D;
			const y = ys[ r ], yPrev = r ? ys[ r - 1 ] : ( tier.frontY ?? base );
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
			const [ s0, s1 ] = ends( dSeat );
			const lo = s0 + A / 2, hi = s1 - A / 2;
			const n = Math.floor( ( hi - lo ) / W );
			if ( n < 1 ) continue;
			const start = lo + ( hi - lo - n * W ) / 2 + W / 2;
			for ( let i = 0; i < n; i ++ ) {

				const [ x, z ] = at( start + i * W, dSeat );
				_q.setFromAxisAngle( _up, yawSeat );
				_m.compose( _p.set( x, y, z ), _q, _s );
				seatMats.push( _m.clone() );
				// a little fading from seat to seat
				const k = 0.9 + 0.2 * hash( x * 13.1 + z * 7.7 + r );
				seatCols.push( k );

			}

		}

		// the sides of the stepped block at the tier's two ends
		void 0;

	}

	// the front wall / fascia and the back wall along the whole tier
	if ( tier.frontWall ) wallAlong( q, secs, 0, base, tier.frontWall.top ?? ys[ 0 ], - 1 );
	if ( tier.back ) wallAlong( q, secs, tier.rows * D, ys[ ys.length - 1 ], ys[ ys.length - 1 ] + tier.back.height, 1, ends => ends );

	const concrete = new Mesh( q.geometry(), materials.concrete );
	concrete.name = tier.name + '-steps';
	concrete.castShadow = true;
	concrete.receiveShadow = true;
	group.add( concrete );

	// seats: one instanced mesh per chunk so the frustum culling can drop the ones behind you
	const CHUNK = 1500;
	for ( let i0 = 0; i0 < seatMats.length; i0 += CHUNK ) {

		const n = Math.min( CHUNK, seatMats.length - i0 );
		const mesh = new InstancedMesh( materials.seatGeometry, materials.seat, n );
		const c = new Color();
		for ( let i = 0; i < n; i ++ ) {

			mesh.setMatrixAt( i, seatMats[ i0 + i ] );
			const k = seatCols[ i0 + i ];
			mesh.setColorAt( i, c.setRGB( k, k, k ) );

		}

		mesh.computeBoundingBox();
		mesh.computeBoundingSphere();
		mesh.name = tier.name + '-seats';
		mesh.receiveShadow = true;
		group.add( mesh );

	}

	group.userData.seats = seatMats.length;
	return group;

}

// a wall along the tier at offset d (0 = its front edge), from y0 to y1, facing -n (side -1) or +n
function wallAlong( q, secs, d, y0, y1, side ) {

	for ( const S of secs ) {

		const s0 = Math.min( S.len, S.trim0 * d ), s1 = Math.max( s0, S.len - S.trim1 * d );
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
export function seatGeometry() {

	const q = new Quads();
	const w = 0.46 / 2;
	// pan: top and front edge, 0.44 m up, 0.40 deep
	const py = 0.44, pz0 = - 0.22, pz1 = 0.14;
	q.add( [ - w, py, pz0 ], [ w, py, pz0 ], [ w, py, pz1 ], [ - w, py, pz1 ], [ 0, 1, 0 ] );
	q.add( [ - w, py - 0.06, pz0 ], [ w, py - 0.06, pz0 ], [ w, py, pz0 ], [ - w, py, pz0 ], [ 0, 0, - 1 ] );
	// back: front and rear faces, leaning back 12 degrees, 0.48 high above the pan
	const lean = Math.tan( 0.21 );
	const b0 = py + 0.02, b1 = py + 0.52;
	const bz = pz1 + 0.02, t = 0.04;
	const z = ( y ) => bz + ( y - b0 ) * lean;
	q.add( [ - w, b0, z( b0 ) ], [ w, b0, z( b0 ) ], [ w, b1, z( b1 ) ], [ - w, b1, z( b1 ) ], [ 0, lean, - 1 ] );
	q.add( [ w, b0, z( b0 ) + t ], [ - w, b0, z( b0 ) + t ], [ - w, b1, z( b1 ) + t ], [ w, b1, z( b1 ) + t ], [ 0, - lean, 1 ] );
	q.add( [ - w, b1, z( b1 ) ], [ w, b1, z( b1 ) ], [ w, b1, z( b1 ) + t ], [ - w, b1, z( b1 ) + t ], [ 0, 1, 0 ] );
	// the standard between seats (one side is enough: the next seat's reads as the other)
	q.add( [ - w - 0.02, 0, - 0.05 ], [ - w - 0.02, 0, 0.18 ], [ - w - 0.02, py + 0.18, 0.18 ], [ - w - 0.02, py + 0.18, - 0.05 ], [ - 1, 0, 0 ] );
	return q.geometry();

}

export function standsMaterials() {

	const concrete = standard( { name: 'stands-concrete', color: new Color( 0.32, 0.31, 0.29 ), roughness: 0.85 } );
	// navy seats; per-instance colour carries a little fading
	const seat = standard( { name: 'seats', color: new Color( 0.012, 0.024, 0.11 ), roughness: 0.45, side: 'double' } );
	for ( const m of [ concrete, seat ] ) m.underwaterLighting = 'none';
	return { concrete, seat, seatGeometry: seatGeometry() };

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
