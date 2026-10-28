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
	// ---- FX2 (FX1's note): standing clear above the gate's canopy, as the photos have it (the Game 5
	// arrival, Oct 27; the postgame of the 29th: its foot just over the canopy's top, the green letters on the
	// canopy across it, the board's lower left corner behind it). It hung from the house's top down, and the
	// house's back is ~35 m inside the gate's canopy, so from the plaza outside the canopy's top hid all but
	// its top metre (FX1 brought the canopy down 0.7 m: still). Raised 3.8 m, its foot 10 m over the street
	// (from 24 m out the canopy's top hides only its lowest metre or so, as the photos have the letters across
	// its foot), a little larger (13 m: about three fifths of the board's width, as the photos have it), in
	// front of the board's lower left corner and clear of the cap; stood out from the wall in front of the
	// board's back
	const pw = 13.0, ph = 9.75, px = - 13.9, py = STREET + 10.0 + ph / 2;
	K.use( 'royal' ).box( Pk, px, py, ZB + 0.9, pw + 0.7, ph + 0.6, 0.6 );
	K.panel( Pk, px, py, ZB + 1.21, pw, ph, 'phanatic', true, true );
	// ---- end FX2
	void H.TOP;
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
	// ---- FC4 (C4R-7): the square inside the gate, between the ramp and Harry the K's tower, was bare and
	// black after dark: its lantern posts (the 2009 photo inside the gate, mostlyphilliespics 3972152381:
	// globe lamps on black posts across the paving), down the ramp's side and by the gate, lit
	// (LeftField.js puts their light in the app's local lights once it has them). Field frame
	const lanterns = [];
	for ( const [ fx, fz ] of [ [ - 116.9, - 79 ], [ - 116.9, - 92 ], [ - 109, - 103 ] ] ) {

		const [ x, z ] = place.F.local( fx, fz );
		K.use( 'iron' ).cyl( Pk, x, z, STREET, STREET + 4.2, 0.07, 0.06, 8, { top: false } );
		K.use( 'iron' ).cyl( Pk, x, z, STREET, STREET + 0.5, 0.16, 0.12, 8, { top: true } );
		K.use( 'lamp' ).cyl( Pk, x, z, STREET + 4.2, STREET + 4.6, 0.32, 0.24, 12, { top: true, bottom: true } );
		lanterns.push( [ fx, STREET + 4.4, fz ] );

	}
	// ---- end FC4
	// ---- FX2 (C4R-7, FC4's "not done"): the square's terrace, as the 2009 photo inside the gate has it
	// (mostlyphilliespics 3972152381, unchanged since 2004): round tables under red and white umbrellas on
	// the paving, people standing at them with a beer; a beer cart with its queue between black posts and
	// a belt, the line along it. Field frame, in the open between the ramp's lanterns and Harry the K's
	// tower, clear of the walkers' rounds' turns
	const tables = [];
	for ( const [ fx, fz, rot ] of [ [ - 112.4, - 83.6, 0.3 ], [ - 108.6, - 87.4, 1.1 ], [ - 112.8, - 90.2, 0.7 ], [ - 109.2, - 80.6, 0.1 ] ] ) {

		const [ x, z ] = place.F.local( fx, fz );
		// the table: a white round top on a black pedestal and its foot
		K.use( 'iron' ).cyl( Pk, x, z, STREET, STREET + 0.05, 0.32, 0.3, 10, { top: true } );
		K.use( 'iron' ).cyl( Pk, x, z, STREET + 0.05, STREET + 1.02, 0.04, 0.04, 6, { top: false } );
		K.use( 'whiteStool' ).cyl( Pk, x, z, STREET + 1.02, STREET + 1.06, 0.46, 0.46, 14, { top: true, bottom: true } );
		// the umbrella through it: eight panels, red and white, a finial
		K.use( 'iron' ).cyl( Pk, x, z, STREET + 1.06, STREET + 2.55, 0.022, 0.022, 6, { top: false } );
		for ( let k = 0; k < 8; k ++ ) {

			const a0 = rot + k / 8 * Math.PI * 2, a1 = rot + ( k + 1 ) / 8 * Math.PI * 2;
			K.use( k % 2 ? 'white' : 'red' ).quad( Pk( x, STREET + 2.62, z ), Pk( x + Math.cos( a0 ) * 1.35, STREET + 2.16, z + Math.sin( a0 ) * 1.35 ), Pk( x + Math.cos( a1 ) * 1.35, STREET + 2.16, z + Math.sin( a1 ) * 1.35 ), Pk( x, STREET + 2.62, z ), [ 0, 1, 0 ] );
			K.use( k % 2 ? 'white' : 'red' ).quad( Pk( x, STREET + 2.6, z ), Pk( x + Math.cos( a1 ) * 1.35, STREET + 2.14, z + Math.sin( a1 ) * 1.35 ), Pk( x + Math.cos( a0 ) * 1.35, STREET + 2.14, z + Math.sin( a0 ) * 1.35 ), Pk( x, STREET + 2.6, z ), [ 0, - 1, 0 ] );

		}

		K.use( 'iron' ).cyl( Pk, x, z, STREET + 2.62, STREET + 2.72, 0.04, 0.01, 6, { top: false } );
		tables.push( { x, z, y: STREET } );

	}

	// the beer cart by the gate, its line held between two rows of posts and belts
	const [ bx, bz ] = place.F.local( - 107.2, - 97.6 );
	const n0 = carts.length;
	cart( bx, bz, - 0.6, 'cartDraft', 'umbrella' );
	const B = carts[ n0 ];
	for ( const side of [ - 0.75, 0.75 ] ) {

		let prev = null;
		for ( let k = 0; k < 4; k ++ ) {

			const d = 1.3 + k * 1.45;
			const x = bx + B.front[ 0 ] * d - B.front[ 1 ] * side, z = bz + B.front[ 1 ] * d + B.front[ 0 ] * side;
			K.use( 'iron' ).cyl( Pk, x, z, STREET, STREET + 0.03, 0.17, 0.16, 10, { top: true } );
			K.use( 'chrome' ).cyl( Pk, x, z, STREET + 0.03, STREET + 0.98, 0.028, 0.028, 6, { top: true } );
			if ( prev ) for ( const e of [ 1, - 1 ] ) {

				const a = Pk( prev[ 0 ], STREET + 0.86, prev[ 1 ] ), b = Pk( x, STREET + 0.86, z ), c = Pk( x, STREET + 0.93, z ), d = Pk( prev[ 0 ], STREET + 0.93, prev[ 1 ] );
				const n = Pk.dir( - B.front[ 1 ] * side * e, 0, B.front[ 0 ] * side * e );
				if ( e > 0 ) K.use( 'navy' ).quad( a, b, c, d, n ); else K.use( 'navy' ).quad( b, a, d, c, n );

			}
			prev = [ x, z ];

		}

	}
	// ---- end FX2
	return { carts, lanterns, tables };

}
