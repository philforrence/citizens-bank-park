import { Vector3, Mesh } from '../../../engine/index.js';
import { offsetPolyline } from '../../Bowl.js';
import { Quads, tierSections } from '../../Stands.js';
import { STREET } from './Frame.js';

// ---- FA2 (step 10, WA2-2): the way up to the Scoreboard Porch (241-245) and Harry the K's upstairs, and
// what holds you there. The Phillies' "Finding Your Seats": 241-245 "Left Field Gate: Elevator behind sect
// 141 or Stairs on either side of Scoreboard"; a photo of March 29, 2008 (Commons, the pennants on the
// Alley) has the east one: a steel stair rising from the Alley's west end to a bridge on maroon steel
// with X-bracing, galvanized rails, by the 147/148 plate; the whole Porch from the 3B side the same day has
// the walkway behind its top row with people standing along it, a pipe rail at the rows' back open at
// each aisle, Harry's patio rail behind, and a stair off each end. Round 1 drew the walkway between Harry's
// patio and the Porch's back only (no colliders, no way up); nothing behind the rest of the Porch.
//
// Here, in the board's frame (Frame.js: local x along the Porch, +x toward the pole; local z away from
// home), field heights:
//   the walkway behind the Porch's top row the whole length of the deck at the patio's height (Harrys.js
//     draws it, `harrys.walkway`), a pipe rail at its front open at each of the deck's aisles (a step up
//     from the top row there), a rail along its back where it's open, its ends;
//   the east stair: two flights and the bridge between them, from the Alley's west end up to the
//     walkway's east end; the west stair the same off its west end into the left field corner;
//   the elevator behind 141 at the walkway's west end (an E stop at each level, LeftField.update);
//   colliders for Harry's house (its walls, the bars' counters, the rooms' floors, the patio's).
// Every floor is a walkable box and every rail a solid one (Colliders.js): the walker climbs 0.62, so a
// rail over a drop is a collider 1.8 m high (a jump of 1.08 + the step clears 1.7) with the 1.07 m pipe
// drawn; a rail with no drop behind it (the patio's) is 1.1.
export const RAIL = 1.07, HIGH = 1.8;
const RISE = 8.4 / 46, GOING = 0.28, FLIGHT = 22 * GOING, LANDING = 1.7, STAIR_W = 1.6;

// colliders in the field frame (the bowl's ctx turns them into the world)
export function fieldColliders( bowl ) {

	const C = bowl.ctx;
	const box = ( c, u, hx, hz, y0, y1, walkable, tag ) => {

		const w = C.toWorld( c[ 0 ], c[ 1 ] );
		return C.colliders.addBox( new Vector3( w.x, ( y0 + y1 ) / 2, w.z ), new Vector3( Math.max( 0.02, hx ), Math.max( 0.02, ( y1 - y0 ) / 2 ), Math.max( 0.02, hz ) ), C.worldYaw - Math.atan2( u[ 1 ], u[ 0 ] ), { walkable, tag } );

	};
	return {
		box,
		// a wall or rail along a-b (field points), y0..y1, t thick
		wall( a, b, y0, y1, tag, t = 0.12 ) {

			const l = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
			if ( l < 0.05 ) return;
			box( [ ( a[ 0 ] + b[ 0 ] ) / 2, ( a[ 1 ] + b[ 1 ] ) / 2 ], [ ( b[ 0 ] - a[ 0 ] ) / l, ( b[ 1 ] - a[ 1 ] ) / l ], l / 2 + t / 2, t / 2, y0, y1, false, tag );

		},
		// a floor over the quad a-b-c-d (a-b along its front), its top at y, `deep` thick (as Bowl._walkable)
		floor( a, b, c, d, y, tag, deep = 0.3 ) {

			const ux = b[ 0 ] - a[ 0 ], uz = b[ 1 ] - a[ 1 ], len = Math.hypot( ux, uz );
			if ( len < 0.05 ) return;
			const u = [ ux / len, uz / len ];
			let nx = - u[ 1 ], nz = u[ 0 ];
			if ( ( d[ 0 ] - a[ 0 ] ) * nx + ( d[ 1 ] - a[ 1 ] ) * nz < 0 ) { nx = - nx; nz = - nz; }
			let s0 = 0, s1 = len, t1 = 0;
			for ( const p of [ c, d ] ) {

				const s = ( p[ 0 ] - a[ 0 ] ) * u[ 0 ] + ( p[ 1 ] - a[ 1 ] ) * u[ 1 ];
				s0 = Math.min( s0, s ); s1 = Math.max( s1, s );
				t1 = Math.max( t1, ( p[ 0 ] - a[ 0 ] ) * nx + ( p[ 1 ] - a[ 1 ] ) * nz );

			}
			const sm = ( s0 + s1 ) / 2, tm = t1 / 2;
			box( [ a[ 0 ] + u[ 0 ] * sm + nx * tm, a[ 1 ] + u[ 1 ] * sm + nz * tm ], u, ( s1 - s0 ) / 2, t1 / 2, y - deep, y, true, tag );

		},
		cylinder( x, z, r, y0, y1, tag ) {

			const w = C.toWorld( x, z );
			bowl.colliders.addCylinder( w.x, w.z, r, bowl.field.y0 + y0, bowl.field.y0 + y1, { tag } );

		},
	};

}

// The deck's back line in the board's frame, as a function of local x (its rows' back edge: Bowl's lf-deck)
export function porchBackLine( bowl, F ) {

	const t = bowl?.upper?.find( ( u ) => u.name === 'lf-deck' );
	if ( ! t ) return null;
	const back = offsetPolyline( t.front, t.rows * t.depth, t.outward ).map( ( p ) => F.local( p[ 0 ], p[ 1 ] ) );
	// (from the pole's end to the Alley's: local x falling)
	const at = ( x ) => {

		for ( let i = 0; i < back.length - 1; i ++ ) {

			const [ ax, az ] = back[ i ], [ bx, bz ] = back[ i + 1 ];
			if ( ( x <= ax && x >= bx ) || i === back.length - 2 || ( i === 0 && x > ax ) ) return az + ( bz - az ) * ( x - ax ) / ( bx - ax );

		}
		return back[ 0 ][ 1 ];

	};
	at.x0 = back[ back.length - 1 ][ 0 ]; // the Alley's end
	at.x1 = back[ 0 ][ 0 ]; // the pole's end
	at.pts = back;
	at.tier = t;
	at.top = t.y0 + ( t.rows - 1 ) * t.rise;
	// the aisles between its sections where they meet the back (local x)
	const secs = tierSections( t ), dB = t.rows * t.depth;
	at.aisles = [];
	for ( let k = 0; k < secs.length - 1; k ++ ) {

		const S = secs[ k ], s = S.len - S.m1 * dB;
		at.aisles.push( F.local( S.a[ 0 ] + S.ux * s + S.nx * dB, S.a[ 1 ] + S.uz * s + S.nz * dB )[ 0 ] );

	}
	return at;

}

// a switchback stair in the board's frame: the lower flight from the foot at local x `xf` climbing along
// `dir` (+1 / -1 in local x) over local z [ za0, za0 + STAIR_W ], the landing (the bridge), the upper
// flight back over [ zb0, zb0 + STAIR_W ] to the top at x = xf; y0 to y1. Drawn into the Kit (maroon
// stringers and columns, concrete in steel pans, galvanized rails), colliders as it goes. Returns the
// top's x and the landing's.
export function stairTower( K, Pk, CL, F, { xf, dir, za0, zb0, y0, y1, tag, open = {} } ) {

	const n = Math.round( ( y1 - y0 ) / RISE ), h = ( y1 - y0 ) / n, n1 = Math.floor( n / 2 ), n2 = n - n1;
	const yMid = y0 + n1 * h;
	const xL0 = xf + dir * ( n1 - 1 ) * GOING, xL1 = xL0 + dir * LANDING;
	const zlo = Math.min( za0, zb0 ), zhi = Math.max( za0, zb0 ) + STAIR_W;
	const L = ( x, z ) => F.field( x, z );
	const tread = ( xa, xb, z0, y, yPrev ) => {

		// the tread (concrete in its pan), the riser in front, the nosing
		const x0 = Math.min( xa, xb ), x1 = Math.max( xa, xb );
		K.use( 'concrete' ).box( Pk, ( x0 + x1 ) / 2, y - 0.03, z0 + STAIR_W / 2, x1 - x0, 0.06, STAIR_W - 0.1 );
		K.use( 'maroon' ).box( Pk, xa, ( y + yPrev ) / 2, z0 + STAIR_W / 2, 0.02, y - yPrev, STAIR_W - 0.1 );
		K.use( 'galv' ).box( Pk, xa, y - 0.015, z0 + STAIR_W / 2, 0.05, 0.03, STAIR_W - 0.12 );
		CL.floor( L( xa, z0 ), L( xa, z0 + STAIR_W ), L( xb, z0 + STAIR_W ), L( xb, z0 ), y, tag, y - STREET + 0.05 );

	};
	// the lower flight: treads 1 .. n1 - 1, the n1th riser up to the landing
	for ( let k = 1; k < n1; k ++ ) tread( xf + dir * ( k - 1 ) * GOING, xf + dir * k * GOING, za0, y0 + k * h, y0 + ( k - 1 ) * h );
	K.use( 'maroon' ).box( Pk, xL0, ( yMid + yMid - h ) / 2, za0 + STAIR_W / 2, 0.02, h, STAIR_W - 0.1 );
	// the upper flight, from the landing's near edge back to the top
	for ( let k = 1; k < n2; k ++ ) tread( xL0 - dir * ( k - 1 ) * GOING, xL0 - dir * k * GOING, zb0, yMid + k * h, yMid + ( k - 1 ) * h );
	const xTop = xL0 - dir * ( n2 - 1 ) * GOING;
	K.use( 'maroon' ).box( Pk, xTop, y1 - h / 2, zb0 + STAIR_W / 2, 0.02, h, STAIR_W - 0.1 );
	// the landing: a steel deck across both flights on a maroon girder
	K.use( 'concrete' ).box( Pk, ( xL0 + xL1 ) / 2, yMid - 0.04, ( zlo + zhi ) / 2, LANDING, 0.08, zhi - zlo );
	K.use( 'maroon' ).box( Pk, ( xL0 + xL1 ) / 2, yMid - 0.35, ( zlo + zhi ) / 2, LANDING + 0.1, 0.5, zhi - zlo + 0.1 );
	CL.floor( L( xL0, zlo ), L( xL0, zhi ), L( xL1, zhi ), L( xL1, zlo ), yMid, tag, yMid - STREET + 0.05 );
	// the stringers: a deep maroon channel each side of each flight
	for ( const [ z0, ya, yb, xa, xb ] of [ [ za0, y0, yMid, xf - dir * GOING * 0.5, xL0 ], [ zb0, yMid, y1, xL0, xTop ] ] ) for ( const zz of [ z0 + 0.04, z0 + STAIR_W - 0.04 ] ) {

		const pa = L( xa, zz ), pb = L( xb, zz );
		K.use( 'maroon' ).bar( [ pa[ 0 ], ya - 0.2, pa[ 1 ] ], [ pb[ 0 ], yb - 0.2, pb[ 1 ] ], 0.3 );

	}
	// the columns under the landing and the top, X-braced between them (the photo's frame)
	const col = ( x, z, yTop ) => K.use( 'maroon' ).box( Pk, x, ( STREET + yTop ) / 2, z, 0.25, yTop - STREET, 0.25 );
	for ( const z of [ zlo + 0.15, zhi - 0.15 ] ) {

		col( xL1 - dir * 0.15, z, yMid - 0.6 );
		col( xL0 + dir * 0.15, z, yMid - 0.6 );

	}
	for ( const z of [ zlo + 0.15, zhi - 0.15 ] ) {

		const a = Pk( xL0 + dir * 0.15, STREET + 0.3, z ), b = Pk( xL1 - dir * 0.15, yMid - 0.7, z );
		const c = Pk( xL0 + dir * 0.15, yMid - 0.7, z ), d = Pk( xL1 - dir * 0.15, STREET + 0.3, z );
		K.use( 'maroon' ).bar( a, b, 0.12 );
		K.use( 'maroon' ).bar( c, d, 0.12 );

	}
	// the rails: a galvanized pipe rail (top, mid, pickets) along each flight's open side and round the
	// landing; colliders the flight's length (from the street: you don't walk under it)
	const pipeRail = ( xa, ya, xb, yb, z ) => {

		const a = Pk( xa, ya, z ), b = Pk( xb, yb, z );
		K.use( 'galv' ).bar( [ a[ 0 ], ya + RAIL, a[ 2 ] ], [ b[ 0 ], yb + RAIL, b[ 2 ] ], 0.05 );
		K.use( 'galv' ).bar( [ a[ 0 ], ya + 0.5, a[ 2 ] ], [ b[ 0 ], yb + 0.5, b[ 2 ] ], 0.03 );
		const l = Math.abs( xb - xa ), m = Math.max( 1, Math.round( l / 0.13 ) );
		for ( let i = 0; i <= m; i ++ ) {

			const x = xa + ( xb - xa ) * i / m, y = ya + ( yb - ya ) * i / m;
			K.use( 'galv' ).bar( Pk( x, y, z ), Pk( x, y + ( i % 11 === 0 ? RAIL : RAIL - 0.04 ), z ), i % 11 === 0 ? 0.05 : 0.014 );

		}

	};
	// the lower flight's sides
	const sideA = za0 < zb0 ? za0 : za0 + STAIR_W, sideB = za0 < zb0 ? zb0 + STAIR_W : zb0;
	pipeRail( xf, y0 + h, xL0, yMid, sideA );
	CL.wall( L( xf, sideA ), L( xL1, sideA ), STREET, yMid + HIGH, tag + '-rail' );
	// between the flights: one rail, the upper flight's
	const zIn = za0 < zb0 ? za0 + STAIR_W + ( zb0 - za0 - STAIR_W ) / 2 : zb0 + STAIR_W + ( za0 - zb0 - STAIR_W ) / 2;
	pipeRail( xL0, yMid, xTop, y1, zIn );
	CL.wall( L( xf, zIn ), L( xL0, zIn ), STREET, y1 + HIGH * 0.6, tag + '-rail' );
	// the upper flight's outer side, unless the top runs on there (open.upper)
	if ( ! open.upper ) {

		pipeRail( xL0, yMid, xTop, y1, sideB );
		CL.wall( L( xL0, sideB ), L( xTop, sideB ), STREET, y1 + HIGH, tag + '-rail' );

	}
	// round the landing's far end
	{

		const a = Pk( xL1, yMid, zlo ), b = Pk( xL1, yMid, zhi );
		K.use( 'galv' ).bar( [ a[ 0 ], yMid + RAIL, a[ 2 ] ], [ b[ 0 ], yMid + RAIL, b[ 2 ] ], 0.05 );
		K.use( 'galv' ).bar( [ a[ 0 ], yMid + 0.5, a[ 2 ] ], [ b[ 0 ], yMid + 0.5, b[ 2 ] ], 0.03 );
		for ( let z = zlo; z <= zhi + 1e-3; z += ( zhi - zlo ) / Math.round( ( zhi - zlo ) / 0.13 ) ) K.use( 'galv' ).bar( Pk( xL1, yMid, z ), Pk( xL1, yMid + RAIL, z ), 0.014 );
		CL.wall( L( xL1, zlo ), L( xL1, zhi ), STREET, yMid + HIGH, tag + '-rail' );
		// the landing's sides past the flights
		CL.wall( L( xL0, zlo ), L( xL1, zlo ), yMid - 0.1, yMid + HIGH, tag + '-rail' );
		CL.wall( L( xL0, zhi ), L( xL1, zhi ), yMid - 0.1, yMid + HIGH, tag + '-rail' );
		pipeRail( xL0, yMid, xL1, yMid, zlo );
		pipeRail( xL0, yMid, xL1, yMid, zhi );

	}
	return { xTop, xL0, xL1, yMid, n, h };

}

// Everything up there: called by LeftField with Harry's (Harrys.js's out) once the house is built. Returns
// the walkway's mesh (a rain roof), the elevator's stops and the stairs.
export function buildPorchAccess( place, K, F, H, slabMat ) {

	const bowl = place.bowl;
	const back = H.porchLine;
	if ( ! bowl?.ctx || ! back ) return null;
	const CL = fieldColliders( bowl );
	const Pk = K.frame( F );
	const L = ( x, z ) => F.field( x, z );
	const { XL, XR, FZ, ZB, PY, UR, DR, DN, TOP } = H;
	const out = { stops: [] };

	// ---- where things go along the walkway (local x, the Alley's end x0 to the pole's x1): a top landing
	// past each end of the deck, the stairs beside them (each tower's flights 6.2 m and its bridge 1.7)
	const W = { x0: back.x0 - 1.8, x1: back.x1 + 1.8 };
	const span = ( n => ( n - 1 ) * GOING + LANDING )( 23 );
	// (each tower square to the board's frame, behind the deck's back line wherever it runs along it: the
	// line slopes, more steeply off the pole's end)
	const xE = W.x0 + 1.8, xEL0 = xE + 22 * GOING, xEL1 = xE + span, bE = Math.max( back( xE ), back( xEL1 ) );
	const xW = W.x1 - 1.8, xWL0 = xW - 22 * GOING, xWL1 = xW - span, bW = Math.max( back( xW ), back( xWL1 ) );
	// the walkway's outline: its back edge (zo) and whether it's open there (a rail of its own)
	const outer = ( x ) => {

		if ( x <= xE ) return [ bE + 3.0 + STAIR_W + 0.05, true ];
		if ( x < xEL0 ) return [ bE + 3.0, false ];
		if ( x <= xEL1 ) return [ bE + 3.0, true ];
		if ( x >= xW ) return [ bW + 3.0 + STAIR_W + 0.05, true ];
		if ( x > xWL0 ) return [ bW + 3.0, false ];
		if ( x >= xWL1 ) return [ bW + 3.0, true ];
		if ( x >= XL && x <= XR ) return [ FZ - 4.6, false ];
		if ( x >= XL - 1.5 && x <= XR + 1.5 ) return [ FZ, true ];
		return [ back( x ) + 3.0, true ];

	};
	const cuts = new Set( [ W.x0, W.x1, xE, xEL0, xEL1, xW, xWL0, xWL1, XL - 1.5, XL, XR, XR + 1.5 ] );
	for ( let x = Math.ceil( W.x0 ); x < W.x1; x += 1.5 ) cuts.add( x );
	const xs = [ ...cuts ].filter( ( x ) => x >= W.x0 && x <= W.x1 ).sort( ( a, b ) => a - b );
	const slices = [];
	for ( let i = 0; i < xs.length - 1; i ++ ) {

		const x0 = xs[ i ], x1 = xs[ i + 1 ];
		if ( x1 - x0 < 0.02 ) continue;
		const [ zo, open ] = outer( ( x0 + x1 ) / 2 );
		slices.push( { x0, x1, zb0: back( x0 ) + 0.02, zb1: back( x1 ) + 0.02, zo, open } );

	}
	W.slices = slices;
	out.walkway = W;
	// its slab: the concrete top, the underside 0.35 lower, the edges (Harry's walkway's material)
	const q = new Quads();
	const P = ( x, y, z ) => {

		const [ fx, fz ] = F.field( x, z );
		return [ fx, y, fz ];

	};
	const D = ( x, z ) => {

		const [ dx, dz ] = F.dir( x, z );
		return [ dx, 0, dz ];

	};
	for ( let i = 0; i < slices.length; i ++ ) {

		const s = slices[ i ];
		q.add( P( s.x0, PY, s.zb0 ), P( s.x1, PY, s.zb1 ), P( s.x1, PY, s.zo ), P( s.x0, PY, s.zo ), [ 0, 1, 0 ] );
		q.add( P( s.x0, PY - 0.35, s.zo ), P( s.x1, PY - 0.35, s.zo ), P( s.x1, PY - 0.35, s.zb1 ), P( s.x0, PY - 0.35, s.zb0 ), [ 0, - 1, 0 ] );
		q.add( P( s.x1, PY - 0.35, s.zo ), P( s.x0, PY - 0.35, s.zo ), P( s.x0, PY, s.zo ), P( s.x1, PY, s.zo ), D( 0, 1 ) );
		// the step in its outline between slices
		const n = slices[ i + 1 ];
		if ( n && Math.abs( n.zo - s.zo ) > 0.01 ) {

			const sg = n.zo > s.zo ? 1 : - 1;
			q.add( P( s.x1, PY - 0.35, s.zo ), P( s.x1, PY - 0.35, n.zo ), P( s.x1, PY, n.zo ), P( s.x1, PY, s.zo ), D( - sg, 0 ) );

		}

	}
	for ( const [ x, sg ] of [ [ W.x0, - 1 ], [ W.x1, 1 ] ] ) {

		const zb = back( x ), zo = outer( x - sg * 0.01 )[ 0 ];
		q.add( P( x, PY - 0.35, zb ), P( x, PY - 0.35, zo ), P( x, PY, zo ), P( x, PY, zb ), D( sg, 0 ) );

	}
	const walk = new Mesh( q.geometry(), slabMat );
	walk.name = 'porch-walkway';
	walk.receiveShadow = true;
	walk.castShadow = true;
	place.group.add( walk );
	out.mesh = walk;

	// ---- its colliders: a floor a slice, a rail along its front over the top row open at the aisles, along
	// its back where it's open, across its ends
	// (boxes square to the board's frame: a box fitted to a slice's sloping front reached 0.7 m past its end
	// at the back, into the stairs' top treads)
	for ( const s of slices ) {

		const zf = ( s.zb0 + s.zb1 ) / 2 - 0.02;
		CL.box( L( ( s.x0 + s.x1 ) / 2, ( zf + s.zo ) / 2 ), F.dir( 1, 0 ), ( s.x1 - s.x0 ) / 2, ( s.zo - zf ) / 2, PY - 0.35, PY, true, 'porch-walkway' );

	}
	const railFront = ( xa, xb ) => {

		if ( xb - xa < 0.1 ) return;
		const za = back( xa ) + 0.06, zb = back( xb ) + 0.06;
		CL.wall( L( xa, za ), L( xb, zb ), PY - 0.45, PY + 1.1, 'porch-walkway-rail' );
		const m = Math.max( 1, Math.round( ( xb - xa ) / 1.8 ) );
		for ( let i = 0; i <= m; i ++ ) {

			const x = xa + ( xb - xa ) * i / m;
			K.use( 'galv' ).bar( Pk( x, PY, back( x ) + 0.06 ), Pk( x, PY + RAIL, back( x ) + 0.06 ), 0.05 );

		}
		K.use( 'galv' ).bar( Pk( xa, PY + RAIL, za ), Pk( xb, PY + RAIL, zb ), 0.05 );
		K.use( 'galv' ).bar( Pk( xa, PY + 0.55, za ), Pk( xb, PY + 0.55, zb ), 0.035 );

	};
	const gaps = back.aisles.map( ( x ) => [ x - 0.65, x + 0.65 ] ).sort( ( a, b ) => a[ 0 ] - b[ 0 ] );
	let x = W.x0;
	for ( const [ g0, g1 ] of gaps ) {

		if ( g1 < W.x0 || g0 > W.x1 ) continue;
		railFront( x, Math.max( x, g0 ) );
		x = Math.max( x, g1 );
		// a step up from the aisle's top row to the walkway (the rows' top 0.44 under it): a half riser in
		// concrete, its nosing painted
		const gx = ( g0 + g1 ) / 2, bz = back( gx ), yTop = back.top;
		K.use( 'concrete' ).box( Pk, gx, ( yTop + PY ) / 2 - 0.11, bz - 0.21, 1.2, PY - yTop - 0.22, 0.42 );
		K.use( 'cream' ).box( Pk, gx, ( yTop + PY ) / 2 + 0.005, bz - 0.4, 1.2, 0.012, 0.04 );
		CL.box( L( gx, bz - 0.21 ), F.dir( 1, 0 ), 0.6, 0.21, yTop - 0.3, ( yTop + PY ) / 2, true, 'porch-aisle-step' );

	}
	railFront( x, W.x1 );
	const railBack = ( xa, za, xb, zb ) => {

		CL.wall( L( xa, za ), L( xb, zb ), PY - 0.4, PY + HIGH, 'porch-walkway-rail' );
		K.use( 'galv' ).bar( Pk( xa, PY + RAIL, za ), Pk( xb, PY + RAIL, zb ), 0.05 );
		K.use( 'galv' ).bar( Pk( xa, PY + 0.55, za ), Pk( xb, PY + 0.55, zb ), 0.035 );
		K.use( 'galv' ).bar( Pk( xa, PY, za ), Pk( xa, PY + RAIL, za ), 0.05 );
		const l = Math.hypot( xb - xa, zb - za ), m = Math.max( 1, Math.round( l / 0.13 ) );
		for ( let i = 1; i < m; i ++ ) {

			const t = i / m;
			K.use( 'galv' ).bar( Pk( xa + ( xb - xa ) * t, PY + 0.06, za + ( zb - za ) * t ), Pk( xa + ( xb - xa ) * t, PY + RAIL - 0.04, za + ( zb - za ) * t ), 0.014 );

		}

	};
	for ( const s of slices ) if ( s.open ) railBack( s.x0, s.zo, s.x1, s.zo );
	// across its ends (at the pole's, beside the elevator's core)
	railBack( W.x0, back( W.x0 ), W.x0, outer( W.x0 + 0.01 )[ 0 ] );
	railBack( W.x1, back( W.x1 ) + 2.95, W.x1, outer( W.x1 - 0.01 )[ 0 ] );

	// ---- the east stair: from the Alley's west end, the lower flight climbing toward the pole beside the
	// walkway, the bridge, the upper flight back to the walkway's east end; the west stair the same off its
	// west end into the left field corner, climbing toward the Alley
	out.east = stairTower( K, Pk, CL, F, { xf: xE, dir: 1, za0: bE + 3.0 + STAIR_W + 0.25, zb0: bE + 3.0, y0: STREET, y1: PY, tag: 'porch-stair-east' } );
	out.west = stairTower( K, Pk, CL, F, { xf: xW, dir: - 1, za0: bW + 3.0 + STAIR_W + 0.25, zb0: bW + 3.0, y0: STREET, y1: PY, tag: 'porch-stair-west' } );

	// ---- the elevator behind 141: a brick core past the walkway's west end, its doors onto the walkway and,
	// under them, onto the concourse
	{

		const w = 2.6, d = 2.8, xc = W.x1 + w / 2, zc = back( W.x1 ) + 1.5;
		const yT = PY + 3.4;
		K.use( 'red' ).box( Pk, xc, ( STREET + yT ) / 2, zc, w, yT - STREET, d );
		K.use( 'concrete' ).box( Pk, xc, yT + 0.1, zc, w + 0.2, 0.2, d + 0.2 );
		for ( const y of [ STREET, PY ] ) {

			// the doors (brushed steel), the frame, the green sign over them, facing the walkway (local -x)
			K.use( 'steel' ).box( Pk, xc - w / 2 - 0.02, y + 1.15, zc, 0.04, 2.3, 1.3 );
			K.use( 'black' ).box( Pk, xc - w / 2 - 0.01, y + 1.15, zc, 0.03, 2.42, 1.5 );
			K.use( 'green' ).box( Pk, xc - w / 2 - 0.04, y + 2.65, zc, 0.03, 0.3, 1.3 );
			K.use( 'lamp' ).box( Pk, xc - w / 2 - 0.05, y + 2.65, zc, 0.01, 0.12, 0.9 );
			out.stops.push( { name: y > STREET + 1 ? 'Scoreboard Porch' : 'main concourse', at: L( xc - w / 2 - 0.9, zc ), y, face: F.dir( - 1, 0 ) } );

		}
		const c0 = L( xc - w / 2, zc - d / 2 ), c1 = L( xc + w / 2, zc - d / 2 ), c2 = L( xc + w / 2, zc + d / 2 ), c3 = L( xc - w / 2, zc + d / 2 );
		for ( const [ a, b ] of [ [ c0, c1 ], [ c1, c2 ], [ c2, c3 ], [ c3, c0 ] ] ) CL.wall( a, b, STREET - 0.1, yT, 'porch-elevator', 0.2 );

	}

	// ---- the deck's two ends: a rail down each (the stepped end is drawn; the rows stood open to a 5-8 m
	// drop) and its front wall's collider is the tier's own
	{

		const t = back.tier, f = t.front, yTop = back.top + RAIL;
		for ( const [ p, q ] of [ [ f[ 0 ], back.pts[ 0 ] ], [ f[ f.length - 1 ], back.pts[ back.pts.length - 1 ] ] ] ) CL.wall( p, L( q[ 0 ], q[ 1 ] ), t.base, Math.max( yTop, t.y0 + HIGH ), 'porch-end' );

	}

	// ---- Harry's: the house's walls (the downstairs' opening and the upstairs' doors left open), the
	// rooms' floors and the patio's, the counters
	{

		const wallL = ( x0, z0, x1, z1, y0, y1, tag = 'harrys-wall' ) => CL.wall( L( x0, z0 ), L( x1, z1 ), y0, y1, tag, 0.3 );
		// outside: the back, the two ends, the front beside the bar's opening and above it
		wallL( XL, ZB, XR, ZB, STREET - 0.1, TOP );
		wallL( XL, FZ, XL, ZB, STREET - 0.1, TOP );
		wallL( XR, FZ, XR, ZB, STREET - 0.1, TOP );
		wallL( XL, FZ, DN.x0, FZ, STREET - 0.1, PY );
		wallL( DN.x1, FZ, XR, FZ, STREET - 0.1, PY );
		// downstairs: the bar room's back and sides, the counter (the bartenders' side behind it)
		wallL( DR.x0, DR.z1, DR.x1, DR.z1, STREET - 0.1, PY );
		wallL( DR.x0, FZ, DR.x0, DR.z1, STREET - 0.1, PY );
		wallL( DR.x1, FZ, DR.x1, DR.z1, STREET - 0.1, PY );
		CL.box( L( ( DN.x0 + DN.x1 ) / 2, FZ + 0.75 ), F.dir( 1, 0 ), ( DN.x1 - DN.x0 - 2 ) / 2, 0.32, STREET, STREET + 1.1, false, 'harrys-bar' );
		// upstairs: the room's floor and the patio's (a floor each), the room's back and sides, the glass
		// front with its two doors, the bar and the back bar
		CL.floor( L( UR.x0, FZ ), L( UR.x1, FZ ), L( UR.x1, UR.z1 ), L( UR.x0, UR.z1 ), PY, 'harrys-upstairs', 0.4 );
		CL.floor( L( XL, FZ - 4.6 ), L( XR, FZ - 4.6 ), L( XR, FZ ), L( XL, FZ ), PY, 'harrys-patio', 0.4 );
		wallL( UR.x0, UR.z1, UR.x1, UR.z1, PY, PY + 3.5 );
		wallL( UR.x0, FZ, UR.x0, UR.z1, PY, PY + 3.5 );
		wallL( UR.x1, FZ, UR.x1, UR.z1, PY, PY + 3.5 );
		const doors = H.doorsUp.slice().sort( ( a, b ) => a - b );
		let x0 = XL;
		for ( const dx of doors ) {

			CL.wall( L( x0, FZ + 0.1 ), L( dx - 0.7, FZ + 0.1 ), PY, PY + 3.5, 'harrys-glass', 0.12 );
			x0 = dx + 0.7;

		}
		CL.wall( L( x0, FZ + 0.1 ), L( XR, FZ + 0.1 ), PY, PY + 3.5, 'harrys-glass', 0.12 );
		CL.box( L( ( H.bar.x0 + H.bar.x1 ) / 2, H.bar.z ), F.dir( 1, 0 ), ( H.bar.x1 - H.bar.x0 ) / 2, 0.36, PY, PY + 1.1, false, 'harrys-bar' );
		// the patio's rail (Landmarks', over the walkway: no drop behind it, tables at it), its heaters and
		// the high-tops round both rooms
		CL.wall( L( XL, FZ - 4.55 ), L( XR, FZ - 4.55 ), PY, PY + 1.1, 'harrys-patio-rail', 0.1 );
		for ( const t of H.heaters ) CL.cylinder( ...L( t.x, t.z ), 0.32, PY, PY + 2.4, 'harrys-heater' );
		for ( const t of [ ...H.spots.patio, ...H.spots.tablesUp.filter( ( u ) => ! u.low ) ] ) CL.cylinder( ...L( t.x, t.z ), 0.4, PY, PY + 1.06, 'harrys-table' );

	}

	return out;

}
