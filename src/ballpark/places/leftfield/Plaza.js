import { STREET } from './Frame.js';

// The left field end of the main concourse and the plaza inside the Left Field Gate (LeftField.js), bare
// till now (the scouting counted about 18 people there):
//
//   on the wall behind the scoreboard, facing the gate: the day's starting lineup as nine big baseball
//     cards in their light boxes (BaseballParks.com, 2004; Phillies.com's 'Not your typical ballpark',
//     2008: 'Starting Lineup'), Game 5's order; and the immense picture of the Phanatic beside them (the same
//     2004 review; the Game 5 arrival photo, Oct 27, 2008)
//   the portables the Phillies' October 2008 concessions guide puts here: draft beer in the left field
//     scoreboard area, funnel cake and nachos behind 141, a Hatfield Grill cart behind 145
//
// Built in the board's frame (Frame.js); returns the carts (where the vendors stand and their lines form).
export function buildPlaza( place, H, K, Pk ) {

	const ZB = H.ZB;
	// ---- the lineup: nine cards in light boxes along the house's back, the Phanatic at the left end
	const x0 = - 8.2, dx = 2.35, yc = STREET + 3.6;
	for ( let i = 0; i < 9; i ++ ) {

		const x = x0 + i * dx;
		K.use( 'black' ).box( Pk, x, yc, ZB + 0.12, 2.25, 4.25, 0.22 );
		K.panel( Pk, x, yc, ZB + 0.24, 2.0, 4.0, 'card' + i, true, true );

	}

	// ---- FW5 (C3W-8, gauntlet r3): the Phanatic's picture up on the house's back at the board's foot, on its
	// own royal blue box, over the gate's canopy and seen from the street and the lots, as every 2008 photo
	// of the gate has it (Commons 2008-03-29; the Game 5 arrival, Oct 27 2008: Carlton's statue in front of
	// it); it was 7 m wide at the height of the canopy, behind the fence, so from outside it didn't show
	const pw = 12.4, ph = 9.3, px = - 13.6, py = H.TOP + 0.9 - ph / 2 - 0.25;
	K.use( 'royal' ).box( Pk, px, py, ZB + 0.3, pw + 0.7, ph + 0.6, 0.6 );
	K.panel( Pk, px, py, ZB + 0.61, pw, ph, 'phanatic', true, true );
	// ---- end FW5
	// a lamp post in the plaza (the lantern globes of the 2008 photos)
	for ( const [ x, z ] of [ [ - 4, ZB + 7 ], [ 9, ZB + 9 ] ] ) {

		K.use( 'iron' ).cyl( Pk, x, z, STREET, STREET + 4.2, 0.07, 0.06, 8, { top: false } );
		K.use( 'lamp' ).cyl( Pk, x, z, STREET + 4.2, STREET + 4.55, 0.3, 0.22, 12, { top: true, bottom: true } );

	}

	// ---- the portables: a stainless cart, its lit sign to the concourse, a striped umbrella or a canopy
	const carts = [];
	const cart = ( x, z, face, sign, kind ) => {

		// face: the local yaw the cart's front looks along (0: toward home, -z)
		const c = Math.cos( face ), s = Math.sin( face );
		// the cart's own frame: its front ( -sin, -cos ) of face
		const fx = - Math.sin( face ), fz = - Math.cos( face );
		const P = ( a, y, b ) => Pk( x + a * c + b * s, y, z - a * s + b * c );
		P.dir = ( a, y, b ) => Pk.dir( a * c + b * s, y, - a * s + b * c );
		K.use( 'steel' ).box( P, 0, STREET + 0.5, 0, 1.9, 0.9, 1.0 );
		K.use( 'steel' ).box( P, 0, STREET + 0.97, - 0.08, 2.0, 0.05, 1.2 );
		K.use( 'rubber' ).cyl( P, - 0.7, 0.4, STREET + 0.02, STREET + 0.2, 0.18, 0.18, 10 );
		K.use( 'rubber' ).cyl( P, 0.7, 0.4, STREET + 0.02, STREET + 0.2, 0.18, 0.18, 10 );
		// the sign on the front, lit, and again on the canopy's valance
		K.panel( P, 0, STREET + 0.55, - 0.52, 1.7, 0.64, sign, false, true );
		if ( kind === 'umbrella' ) {

			K.use( 'iron' ).cyl( P, 0, 0.3, STREET + 1.0, STREET + 2.5, 0.025, 0.025, 6, { top: false } );
			for ( let k = 0; k < 8; k ++ ) {

				const a0 = k / 8 * Math.PI * 2, a1 = ( k + 1 ) / 8 * Math.PI * 2;
				K.use( k % 2 ? 'white' : 'red' ).quad( P( 0, STREET + 2.75, 0.3 ), P( Math.cos( a0 ) * 1.3, STREET + 2.3, 0.3 + Math.sin( a0 ) * 1.3 ), P( Math.cos( a1 ) * 1.3, STREET + 2.3, 0.3 + Math.sin( a1 ) * 1.3 ), P( 0, STREET + 2.75, 0.3 ), [ 0, 1, 0 ] );

			}

		} else {

			for ( const a of [ - 0.95, 0.95 ] ) K.use( 'steel' ).box( P, a, STREET + 1.6, 0.35, 0.05, 1.3, 0.05 );
			K.use( 'red' ).box( P, 0, STREET + 2.3, 0.0, 2.1, 0.08, 1.5 );
			K.panel( P, 0, STREET + 2.13, - 0.76, 2.0, 0.36, sign, false, true );

		}

		// the line forms at its front, the vendor behind it
		const [ vx, vz ] = [ x + ( - fx ) * 0.85, z + ( - fz ) * 0.85 ];
		carts.push( { x, z, face, front: [ fx, fz ], vendor: { x: vx, z: vz, y: STREET }, sign } );

	};
	cart( 19.2, - 13.6, 0.5, 'cartFunnel', 'canopy' );
	cart( 22.4, - 12.4, 0.5, 'cartNachos', 'umbrella' );
	cart( - 23.2, - 5.8, - 0.35, 'cartHatfield', 'umbrella' );
	cart( - 1.5, ZB + 10.5, Math.PI, 'cartDraft', 'canopy' );
	return { carts };

}
