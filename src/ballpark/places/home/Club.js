import { Builder } from './Build.js';
import { hash } from './Fans.js';
import { CLUB, CLUB_ROWS } from './Seats.js';

// The Diamond Club's front: behind the backstop's padded wall the front row sits low, and between the
// pads' back and the row is a ledge at the height of the pads' top, where the front row puts down what
// it's holding: cups, a water bottle, a tray of nachos, the program, a flip phone, a camera, the gloves
// taken off to eat (heston's Game 3 photo, flickr 2986440011: red cups, bottles and food along it, the
// fans' forearms on the pads). What's on it is the night's: more hot chocolate on the 27th, the rain
// beaded on everything; the 29th's beer and a pair of gloves.
//
// Field frame; the three faces of the backstop (the front line of the sections behind home plate).

// the ledge: from the pads' back (0.37 m behind the wall's face) to over the front row's toes
export const LEDGE = { d0: 0.37, d1: 0.56, y: 1.46 };

export function buildClub( seats, b = new Builder() ) {

	// the ledge along each face: an apron down to the front row's tread, the slab on top
	for ( const L of CLUB ) {

		const S = seats.sec[ L ];
		const o = [ S.a[ 0 ], 0, S.a[ 1 ] ];
		const P = Builder.frame( o, [ S.ux, S.uz ], [ S.nx, S.nz ] );
		// the faces' ends meet on the corners' bisectors: extend each a little along the mitres
		const e0 = S.m0 * LEDGE.d1, e1 = S.len - S.m1 * LEDGE.d1;
		const len = e1 - e0, mid = ( e0 + e1 ) / 2;
		const y0 = seats.ys[ 0 ];
		b.use( 'ledge' ).box( P, mid, LEDGE.y - 0.02, ( LEDGE.d0 + LEDGE.d1 ) / 2, len, 0.04, LEDGE.d1 - LEDGE.d0 );
		b.use( 'ledge' ).box( P, mid, ( y0 + LEDGE.y - 0.04 ) / 2, LEDGE.d0 + 0.02, len, LEDGE.y - 0.04 - y0, 0.04 );
		// brackets under the slab every 1.5 m
		for ( let s = e0 + 0.4; s < e1 - 0.2; s += 1.5 ) b.use( 'ledge' ).box( P, s, LEDGE.y - 0.1, LEDGE.d0 + 0.1, 0.03, 0.12, 0.16 );

	}

	// the club's seats padded: a navy vinyl cushion on the pan and one on the back, piped ("1,258
	// extra-wide, padded seats", the 2008 guide), beaded with the rain on the 27th (the palette's wet)
	for ( const seat of seats.list ) {

		if ( seat.row >= CLUB_ROWS ) continue;
		const P = Builder.frame( [ seat.x, seat.y, seat.z ], [ seat.rx, seat.rz ], [ seat.nx, seat.nz ] );
		b.use( 'pad' ).box( P, 0, 0.465, - 0.08, 0.44, 0.05, 0.4 );
		b.use( 'pad' ).box( P, 0, 0.64, 0.155, 0.42, 0.3, 0.045 );
		b.use( 'padSeam' ).box( P, 0, 0.795, 0.16, 0.42, 0.012, 0.05 );

	}

	// what's on it, in front of each front-row seat the place has
	for ( const seat of seats.list ) {

		if ( seat.row !== 0 || ! seat.taken ) continue;
		const S = seats.sec[ seat.sec ];
		const d = LEDGE.d0 + 0.13;
		const o = [ seat.x - S.nx * ( 0.84 - d ), LEDGE.y, seat.z - S.nz * ( 0.84 - d ) ];
		const P = Builder.frame( o, [ S.ux, S.uz ], [ - S.nx, - S.nz ] );
		const h = hash( seat.x * 3.1 + seat.z * 1.7 );
		for ( const night of [ 27, 29 ] ) {

			b.night( night );
			const r = ( k ) => hash( h * 91 + k * 7.3 + night );
			const n = r( 1 ) < 0.25 ? 0 : r( 2 ) < 0.6 ? 1 : 2;
			for ( let j = 0; j < n; j ++ ) {

				const x = ( j === 0 ? - 0.1 : 0.12 ) + ( r( 3 + j ) - 0.5 ) * 0.08, z = ( r( 5 + j ) - 0.5 ) * 0.1;
				item( b, P, x, z, pickItem( r( 9 + j ), night ), r( 11 + j ) );

			}

		}

		b.night( 0 );

	}

	return b;

}

function pickItem( x, night ) {

	const T = night === 27
		? [ [ 'cocoa', 5 ], [ 'beer', 3 ], [ 'soda', 2 ], [ 'water', 1.5 ], [ 'nachos', 1 ], [ 'program', 1 ], [ 'phone', 0.7 ], [ 'peanuts', 0.8 ], [ 'towel', 1.2 ] ]
		: [ [ 'beer', 5 ], [ 'cocoa', 3 ], [ 'soda', 2 ], [ 'water', 1 ], [ 'nachos', 1 ], [ 'program', 1 ], [ 'phone', 0.8 ], [ 'gloves', 1.2 ], [ 'camera', 0.7 ], [ 'peanuts', 1 ], [ 'hotdog', 0.8 ] ];
	let sum = 0;
	for ( const [ , w ] of T ) sum += w;
	let v = x * sum;
	for ( const [ k, w ] of T ) {

		v -= w;
		if ( v <= 0 ) return k;

	}

	return 'beer';

}

// one thing on a surface at ( x, z ) in frame P (its top at y 0)
export function item( b, P, x, z, kind, r = 0.5 ) {

	switch ( kind ) {

		case 'beer':
			// a clear 20 oz cup of lager, its head gone flat
			b.use( 'beer' ).cyl( P, x, z, 0, 0.14, 0.034, 0.045, 10, false );
			b.use( 'foam' ).cyl( P, x, z, 0.14, 0.15, 0.045, 0.045, 10 );
			break;
		case 'soda':
			b.use( 'cupRed' ).cyl( P, x, z, 0, 0.16, 0.036, 0.047, 10 );
			b.use( 'white' ).cyl( P, x, z, 0.16, 0.168, 0.048, 0.046, 10 );
			b.use( 'white' ).cyl( P, x + 0.012, z, 0.168, 0.24, 0.0035, 0.0035, 4, false );
			break;
		case 'cocoa':
			b.use( 'cupWhite' ).cyl( P, x, z, 0, 0.11, 0.03, 0.04, 10, false );
			b.use( 'sleeve' ).cyl( P, x, z, 0.03, 0.075, 0.034, 0.037, 10, false );
			b.use( 'lid' ).cyl( P, x, z, 0.11, 0.125, 0.041, 0.036, 10 );
			break;
		case 'water':
			b.use( 'water' ).cyl( P, x, z, 0, 0.17, 0.033, 0.033, 8, false );
			b.use( 'water' ).cyl( P, x, z, 0.17, 0.2, 0.033, 0.013, 8, false );
			b.use( 'capBlue' ).cyl( P, x, z, 0.2, 0.215, 0.014, 0.014, 6 );
			break;
		case 'nachos':
			b.use( 'tray' ).box( P, x, 0.02, z, 0.16, 0.04, 0.12 );
			b.use( 'chips' ).box( P, x + 0.02, 0.045, z, 0.1, 0.02, 0.09 );
			b.use( 'cheese' ).cyl( P, x - 0.05, z, 0.02, 0.05, 0.028, 0.028, 8 );
			break;
		case 'program':
			b.use( 'navy' ).box( P, x, 0.006, z, 0.21, 0.012, 0.28 );
			break;
		case 'phone':
			b.use( 'black' ).box( P, x, 0.01, z, 0.05, 0.02, 0.095 );
			break;
		case 'camera':
			b.use( 'steel' ).box( P, x, 0.03, z, 0.1, 0.06, 0.025 );
			break;
		case 'gloves':
			b.use( r < 0.5 ? 'black' : 'red' ).box( P, x, 0.012, z, 0.09, 0.024, 0.18 );
			b.use( r < 0.5 ? 'black' : 'red' ).box( P, x + 0.04, 0.03, z + 0.02, 0.09, 0.02, 0.17 );
			break;
		case 'peanuts':
			b.use( 'kraft' ).box( P, x, 0.09, z, 0.12, 0.18, 0.05 );
			break;
		case 'hotdog':
			b.use( 'foil' ).box( P, x, 0.02, z, 0.08, 0.04, 0.18 );
			break;
		case 'towel':
			// a rally towel left folded, soaked
			b.use( 'towelWet' ).box( P, x, 0.01, z, 0.18, 0.02, 0.22 );
			break;

	}

}
