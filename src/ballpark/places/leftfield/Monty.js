import { buildTier, tierSections } from '../../Stands.js';
import { FT, OUTFIELD, fencePoint } from '../../layout.js';
import { MONTY } from '../../Bowl.js';
import { fieldColliders, RAIL, HIGH } from './Access.js';
import { STREET } from './Frame.js';

// The seats over Monty's Angle (LeftField.js): the left field seats went on round the jog in the wall
// (387 to 381) and along the taller wall beyond it to the 409 corner (the World Series photos: fans above
// the State Farm panel right up to the 409 mark, a rail sloping up along the top of the angle; April 2008:
// seats behind the taller wall with a galvanized mesh rail following its slope).
//
// ---- FA2 (step 10, WA2-6): as the 2008 chart has them, three sections, 146 the wedge at the jog (its end
// on 145's), 147 and 148 along the taller wall out to 409, each climbing from behind the wall to the
// concourse at the Alley's west end and entered from there at its top (RateYourSeats: 146 rows 1-24, 147
// 4-21, 148 5-17, entered at 24, 20 and 15); at their top a standing-room rail with a counter, open at the
// aisles (Commons 2004-06-29: the rail behind 146-148, a stair down into them). Here 12 rows of the 140s'
// 0.8 m, as deep as the Alley lets them run (Bowl's MONTY; the pit closes on their back), each section's
// rows from its own wall to the Alley's level. Round 1 built them as four strips of 2-8 rows, one section
// each, that stopped 2 m short of the Alley over an open pit (you fell into it from the Alley, and three of
// the four had no way in). One tier now: the aisles between the sections are its own.
//
// Built as the park's own tiers (Stands.buildTier: treads, risers, seats and a fan in nearly every one,
// through the crowd's seat lists).
const TOP = STREET - 0.05;

export function buildMonty( place, K, Pk ) {

	const bowl = place.bowl;
	if ( ! bowl?.ctx ) return null;
	// the wall's corners: 387 (the end of the left field wall), 381 (the jog in), 409
	const idx = ( d, h ) => OUTFIELD.findIndex( ( [ , dd, hh ] ) => dd === d && Math.abs( hh - h ) < 0.01 );
	const i387 = idx( 387, 12.67 ), i381 = idx( 381, 12.67 ), i409 = idx( 409, 19 );
	if ( i387 < 0 || i381 < 0 || i409 < 0 ) return null;
	const at = ( i ) => fencePoint( OUTFIELD[ i ][ 0 ], OUTFIELD[ i ][ 1 ] );
	const A = at( i387 ), B = at( i381 ), C = at( i409 );
	const lerp = ( p, q, t ) => [ p[ 0 ] + ( q[ 0 ] - p[ 0 ] ) * t, p[ 1 ] + ( q[ 1 ] - p[ 1 ] ) * t ];
	const CL = fieldColliders( bowl );
	// each section's first row a little over (146) or under (147, 148: the wall's top their parapet) its
	// wall's top, the rows rising to the Alley's level
	const firstY = ( S ) => S.k === 1 ? 12.67 * FT + 0.4 : Math.hypot( S.a[ 0 ] - B[ 0 ], S.a[ 1 ] - B[ 1 ] ) < 0.1 ? 4.6 : 4.9;
	const N = MONTY.rows;
	const tier = {
		name: 'monty-seats',
		// (a lead in from the 140s' side, no rows on it: 146's rows open out to 145's end, the 140s' last
		// section's end line from 387 at 45 degrees, where its rows meet them)
		front: [ [ A[ 0 ], A[ 1 ] + 0.3 ], A, B, C ],
		outward: [ 0, 0 ], start: MONTY.start, frontY: 12.67 * FT, y0: 12.67 * FT + 0.4, rows: N, depth: MONTY.depth,
		rise: ( TOP - 12.67 * FT - 0.4 ) / ( N - 1 ), section: 12, aisle: 1.1,
		skipRows: ( k ) => k === 0 ? N + 1 : 0,
		rowY: ( S, r ) => {

			const y0 = firstY( S );
			return y0 + ( TOP - y0 ) * r / ( N - 1 );

		},
	};
	const groups = [ buildTier( tier, bowl.ctx ) ];
	for ( const g of groups ) place.group.add( g );
	const secs = tierSections( tier ).filter( ( S ) => S.k > 0 );
	// each row's tread under its whole width: Stands' boxes cover only the part of a mitred row as long as
	// its shorter edge, and at 381 the rows turn 45 degrees, so the aisle between 146 and 147 (on the corner's
	// bisector) was a crack 0.66 m wide all the way down, and 146's end by 145 a sliver a row (the walker fell
	// through to the pit). A box over each row's trapezoid (as Bowl._walkable's floors): where it reaches
	// past the bisector under the next section's rows they're the higher floor
	for ( const S of secs ) for ( let r = 0; r < N; r ++ ) {

		const d0 = MONTY.start + r * MONTY.depth, d1 = d0 + MONTY.depth, y = tier.rowY( S, r );
		const e = ( d ) => [ Math.min( S.len, S.m0 * d ), Math.max( Math.min( S.len, S.m0 * d ), S.len - S.m1 * d ) ];
		const pt = ( s, d ) => [ S.a[ 0 ] + S.ux * s + S.nx * d, S.a[ 1 ] + S.uz * s + S.nz * d ];
		const [ f0, f1 ] = e( d0 ), [ b0, b1 ] = e( d1 );
		CL.floor( pt( f0, d0 ), pt( f1, d0 ), pt( b1, d1 ), pt( b0, d1 ), y, 'monty-seats', Math.min( 3, y - 3.0 ) );

	}
	const dBack = MONTY.back;
	const backAt = ( S, end ) => {

		const s = end ? S.len - S.m1 * dBack : S.m0 * dBack;
		return [ S.a[ 0 ] + S.ux * s + S.nx * dBack, S.a[ 1 ] + S.uz * s + S.nz * dBack ];

	};

	// the rail on the wall's top: galvanized posts, a top rail and pickets, stepping up with the wall; a
	// collider 1.1 over the front row's tread (or the wall's top where that's higher) so you don't step off
	// the front onto the warning track
	const railAlong = ( p, q, h0, h1, rowY ) => {

		const len = Math.hypot( q[ 0 ] - p[ 0 ], q[ 1 ] - p[ 1 ] ), ux = ( q[ 0 ] - p[ 0 ] ) / len, uz = ( q[ 1 ] - p[ 1 ] ) / len;
		// 0.25 m behind the wall's face, away from home
		let nx = - uz, nz = ux;
		if ( nx * p[ 0 ] + nz * p[ 1 ] < 0 ) {

			nx = - nx; nz = - nz;

		}

		const o = 0.25;
		const pt = ( s, y ) => [ p[ 0 ] + ux * s + nx * o, y, p[ 1 ] + uz * s + nz * o ];
		const hAt = ( s ) => ( h0 + ( h1 - h0 ) * s / len ) * FT;
		for ( let s = 0; s <= len + 1e-3; s += 1.8 ) K.use( 'galv' ).bar( pt( s, hAt( s ) ), pt( s, hAt( s ) + 1.07 ), 0.05 );
		for ( let s = 0; s < len; s += 0.12 ) K.use( 'galv' ).bar( pt( s, hAt( s ) + 0.08 ), pt( s, hAt( s ) + 1.0 ), 0.012 );
		K.use( 'galv' ).bar( pt( 0, hAt( 0 ) + 1.07 ), pt( len, hAt( len ) + 1.07 ), 0.05 );
		K.use( 'galv' ).bar( pt( 0, hAt( 0 ) + 0.08 ), pt( len, hAt( len ) + 0.08 ), 0.035 );
		// the wall's cap out to the first riser (concrete, the rail's posts on it)
		const cap = ( s, oo ) => [ p[ 0 ] + ux * s + nx * oo, hAt( s ) + 0.01, p[ 1 ] + uz * s + nz * oo ];
		K.use( 'concrete' ).quad( cap( 0, 0 ), cap( len, 0 ), cap( len, MONTY.start + 0.02 ), cap( 0, MONTY.start + 0.02 ), [ 0, 1, 0 ] );
		// ---- FA2: its collider, in lengths following the wall up
		for ( let k = 0; k < 4; k ++ ) {

			const s0 = len * k / 4, s1 = len * ( k + 1 ) / 4;
			const top = Math.max( hAt( s1 ) + 1.07, rowY + 1.1 );
			CL.wall( [ p[ 0 ] + ux * s0 + nx * o, p[ 1 ] + uz * s0 + nz * o ], [ p[ 0 ] + ux * s1 + nx * o, p[ 1 ] + uz * s1 + nz * o ], hAt( s0 ) - 0.3, top, 'monty-front-rail' );

		}

	};
	railAlong( A, B, 12.67, 12.67, 12.67 * FT + 0.4 );
	railAlong( B, lerp( B, C, 0.5 ), 12.67, ( 12.67 + 19 ) / 2, 4.6 );
	railAlong( lerp( B, C, 0.5 ), C, ( 12.67 + 19 ) / 2, 19, 4.9 );

	// ---- FA2: the rail between 145 and 146 (their rows meet at an angle, at their own heights: a pipe rail
	// on the seam, the 140s' last aisle and 146's own each side of it), and 148's end over the batter's eye
	{

		const S1 = secs[ 0 ], Sn = secs[ secs.length - 1 ];
		const seam = ( d ) => [ S1.a[ 0 ] + S1.ux * S1.m0 * d + S1.nx * d, S1.a[ 1 ] + S1.uz * S1.m0 * d + S1.nz * d ];
		const endC = ( d ) => [ Sn.a[ 0 ] + Sn.ux * ( Sn.len - Sn.m1 * d ) + Sn.nx * d, Sn.a[ 1 ] + Sn.uz * ( Sn.len - Sn.m1 * d ) + Sn.nz * d ];
		// (and on from 148's end along the Alley's edge to the batter's eye's corner, where the pit's outline
		// turns: Bowl._pitOutline)
		const c1 = endC( dBack ), iC = bowl.pit.findIndex( ( p ) => Math.hypot( p[ 0 ] - c1[ 0 ], p[ 1 ] - c1[ 1 ] ) < 0.1 );
		const eye = iC >= 0 ? bowl.pit[ iC + 1 ] : null;
		if ( eye ) {

			CL.wall( c1, eye, STREET - 0.4, STREET + 1.1, 'monty-end-rail' );
			K.use( 'galv' ).bar( [ c1[ 0 ], STREET + RAIL, c1[ 1 ] ], [ eye[ 0 ], STREET + RAIL, eye[ 1 ] ], 0.05 );
			K.use( 'galv' ).bar( [ c1[ 0 ], STREET + 0.5, c1[ 1 ] ], [ eye[ 0 ], STREET + 0.5, eye[ 1 ] ], 0.035 );
			for ( let i = 0; i <= 3; i ++ ) {

				const x = c1[ 0 ] + ( eye[ 0 ] - c1[ 0 ] ) * i / 3, z = c1[ 1 ] + ( eye[ 1 ] - c1[ 1 ] ) * i / 3;
				K.use( 'galv' ).bar( [ x, STREET, z ], [ x, STREET + RAIL, z ], 0.05 );

			}

		}
		for ( const [ line, y0 ] of [ [ seam, tier.rowY( S1, 0 ) ], [ endC, tier.rowY( Sn, 0 ) ] ] ) {

			const p = line( 0 ), q = line( dBack );
			CL.wall( p, q, 3.0, STREET + HIGH, 'monty-end-rail' );
			K.use( 'galv' ).bar( [ p[ 0 ], y0 + RAIL, p[ 1 ] ], [ q[ 0 ], TOP + RAIL, q[ 1 ] ], 0.05 );
			K.use( 'galv' ).bar( [ p[ 0 ], y0 + 0.5, p[ 1 ] ], [ q[ 0 ], TOP + 0.5, q[ 1 ] ], 0.035 );
			const n = Math.max( 2, Math.round( dBack / 1.6 ) );
			for ( let i = 0; i <= n; i ++ ) {

				const f = i / n, x = p[ 0 ] + ( q[ 0 ] - p[ 0 ] ) * f, z = p[ 1 ] + ( q[ 1 ] - p[ 1 ] ) * f, y = y0 + ( TOP - y0 ) * f;
				K.use( 'galv' ).bar( [ x, y, z ], [ x, y + RAIL, z ], 0.05 );

			}

		}

	}

	// ---- FA2: the standing-room rail at their top, along the Alley's edge: galvanized posts, a pipe and a
	// steel counter on it to set a beer on (BaseballParks 2004: "metal counter-tops at the rear of seating
	// sections"), open at each aisle (the aisles' heads: between the sections) - you go down into the rows there
	{

		const pts = [ backAt( secs[ 0 ], false ) ];
		for ( const S of secs ) pts.push( backAt( S, true ) );
		const aisles = pts.slice( 1, - 1 );
		const y = STREET;
		const gapAt = ( p ) => aisles.some( ( a ) => Math.hypot( a[ 0 ] - p[ 0 ], a[ 1 ] - p[ 1 ] ) < 0.7 );
		for ( let i = 0; i < pts.length - 1; i ++ ) {

			const p = pts[ i ], q = pts[ i + 1 ], l = Math.hypot( q[ 0 ] - p[ 0 ], q[ 1 ] - p[ 1 ] );
			const u = [ ( q[ 0 ] - p[ 0 ] ) / l, ( q[ 1 ] - p[ 1 ] ) / l ];
			// (each stretch shortened at an aisle's end by half its width)
			const s0 = gapAt( p ) ? 0.6 : 0, s1 = gapAt( q ) ? l - 0.6 : l;
			if ( s1 - s0 < 0.2 ) continue;
			const a = [ p[ 0 ] + u[ 0 ] * s0, p[ 1 ] + u[ 1 ] * s0 ], b = [ p[ 0 ] + u[ 0 ] * s1, p[ 1 ] + u[ 1 ] * s1 ];
			CL.wall( a, b, y - 0.4, y + 1.1, 'monty-sro-rail' );
			K.use( 'galv' ).bar( [ a[ 0 ], y + 1.07, a[ 1 ] ], [ b[ 0 ], y + 1.07, b[ 1 ] ], 0.05 );
			K.use( 'galv' ).bar( [ a[ 0 ], y + 0.5, a[ 1 ] ], [ b[ 0 ], y + 0.5, b[ 1 ] ], 0.035 );
			const n = Math.max( 1, Math.round( ( s1 - s0 ) / 1.8 ) );
			for ( let k = 0; k <= n; k ++ ) {

				const x = a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * k / n, z = a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * k / n;
				K.use( 'galv' ).bar( [ x, y, z ], [ x, y + 1.1, z ], 0.05 );

			}
			// the counter: a steel shelf on the rail, its lip toward the Alley
			const nx = - u[ 1 ], nz = u[ 0 ], o = 0.14;
			K.use( 'steel' ).quad( [ a[ 0 ] - nx * o, y + 1.1, a[ 1 ] - nz * o ], [ b[ 0 ] - nx * o, y + 1.1, b[ 1 ] - nz * o ], [ b[ 0 ] + nx * o, y + 1.1, b[ 1 ] + nz * o ], [ a[ 0 ] + nx * o, y + 1.1, a[ 1 ] + nz * o ], [ 0, 1, 0 ] );
			K.use( 'steel' ).quad( [ a[ 0 ] - nx * o, y + 1.04, a[ 1 ] - nz * o ], [ b[ 0 ] - nx * o, y + 1.04, b[ 1 ] - nz * o ], [ b[ 0 ] - nx * o, y + 1.1, b[ 1 ] - nz * o ], [ a[ 0 ] - nx * o, y + 1.1, a[ 1 ] - nz * o ], [ - nx, 0, - nz ] );
			K.use( 'steel' ).quad( [ a[ 0 ] + nx * o, y + 1.04, a[ 1 ] + nz * o ], [ b[ 0 ] + nx * o, y + 1.04, b[ 1 ] + nz * o ], [ b[ 0 ] + nx * o, y + 1.1, b[ 1 ] + nz * o ], [ a[ 0 ] + nx * o, y + 1.1, a[ 1 ] + nz * o ], [ nx, 0, nz ] );

		}

	}

	// ---- FA2 (WA2-3): the left field wall's top, 140-145: the planted trough behind the cap and the guard
	// rail at its seat side are drawn (Details2008), the 140s' first row 2 m behind the wall's face with
	// nothing under the gap: off the front row you fell into it and stayed at the field's level. Now the
	// trough and the cap are a floor (the soil a hand under the cap), a concrete sill closes the 28 cm
	// between the trough's curb and the first riser at the row's height, and the guard rail is solid
	{

		const lf = bowl.tiers[ 1 ], P = lf.front, y0 = 10.5 * FT, yRow = lf.y0;
		for ( let i = 0; i < P.length - 1; i ++ ) {

			const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			if ( len < 0.05 ) continue;
			const ux = ( bx - ax ) / len, uz = ( bz - az ) / len;
			let nx = - uz, nz = ux;
			if ( nx * ax + nz * az < 0 ) { nx = - nx; nz = - nz; }
			const T = ( s, o ) => [ ax + ux * s + nx * o, az + uz * s + nz * o ];
			CL.floor( T( 0, 0 ), T( len, 0 ), T( len, 1.72 ), T( 0, 1.72 ), y0 - 0.2, 'lf-trough', 0.4 );
			CL.floor( T( 0, 1.72 ), T( len, 1.72 ), T( len, lf.start ), T( 0, lf.start ), yRow, 'lf-front-sill', yRow - y0 + 0.2 );
			CL.wall( T( 0, 1.75 ), T( len, 1.75 ), y0 - 0.2, yRow + 1.1, 'lf-guard-rail', 0.08 );
			const Y = ( p, y ) => [ p[ 0 ], y, p[ 1 ] ];
			K.use( 'concrete' ).quad( Y( T( 0, 1.72 ), yRow ), Y( T( len, 1.72 ), yRow ), Y( T( len, lf.start ), yRow ), Y( T( 0, lf.start ), yRow ), [ 0, 1, 0 ] );
			K.use( 'concrete' ).quad( Y( T( 0, 1.72 ), y0 ), Y( T( len, 1.72 ), y0 ), Y( T( len, 1.72 ), yRow ), Y( T( 0, 1.72 ), yRow ), [ - nx, 0, - nz ] );

		}

	}

	void Pk;
	return { tiers: [ tier ], groups, secs };

}
