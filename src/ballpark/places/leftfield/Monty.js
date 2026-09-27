import { buildTier } from '../../Stands.js';
import { FT, OUTFIELD, fencePoint } from '../../layout.js';

// The seats over Monty's Angle (LeftField.js): the left field seats went on round the jog in the wall
// (387 to 381) and along the taller wall beyond it to the 409 corner, in rows behind the wall's top that
// thin as the wall climbs from 12'8" to 19' (the World Series photos: fans above the State Farm panel
// right up to the 409 mark, a rail sloping up along the top of the angle; April 2008: seats behind the
// taller wall with a galvanized mesh rail following its slope; the Phillies' guide: sections 140-148).
// Round 1 stopped the 140s at 387 and left a brick wedge there.
//
// Built as the park's own tiers (Stands.buildTier: treads, risers, seats and a fan in nearly every one,
// through the crowd), ending at the pit's edge 7 m behind the wall where the Alley's walkway begins.
const ROW = 0.8, START = 0.6, RISE = 0.3, TOP = 6.75;

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
	const tiers = [];
	const tier = ( name, a, b, lowFt, wallFt ) => {

		const y0 = wallFt * FT + 0.4;
		const rows = Math.max( 1, Math.min( 8, Math.floor( ( TOP - y0 ) / RISE ) + 1 ) );
		// the first riser from the wall's top (its lower end) up to the first tread
		tiers.push( { name, front: [ a, b ], outward: [ 0, 0 ], start: START, frontY: lowFt * FT, y0, rows, depth: ROW, rise: RISE, section: 12, aisle: 1.1 } );

	};
	// along the jog, then the rising wall in three steps (each at the wall's height at its far end)
	tier( 'monty-seats', A, B, 12.67, 12.67 );
	for ( let k = 0; k < 3; k ++ ) tier( 'monty-seats-' + ( k + 1 ), lerp( B, C, k / 3 ), lerp( B, C, ( k + 1 ) / 3 ), 12.67 + ( 19 - 12.67 ) * k / 3, 12.67 + ( 19 - 12.67 ) * ( k + 1 ) / 3 );
	const groups = tiers.map( ( t ) => buildTier( t, bowl.ctx ) );
	for ( const g of groups ) place.group.add( g );
	// the rail on the wall's top: galvanized posts, a top rail and pickets, stepping up with the wall
	const railAlong = ( p, q, h0, h1 ) => {

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
		K.use( 'concrete' ).quad( cap( 0, 0 ), cap( len, 0 ), cap( len, START + 0.02 ), cap( 0, START + 0.02 ), [ 0, 1, 0 ] );

	};
	railAlong( A, B, 12.67, 12.67 );
	railAlong( B, C, 12.67, 19 );
	void Pk;
	return { tiers, groups };

}
