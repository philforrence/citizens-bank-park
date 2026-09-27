// The first base concourse's own things (Concourse1B.js), built with the two kits: K, the props' kit
// (W2's palette and atlas: the cans, the carts, the program covers) and Pr, this side's prints (its atlas:
// the banners, the signs, the market's header). Each in a frame on the floor, P( x, y, z ): right x, up y,
// forward z (Kit.frame).

// The World Series program kiosk behind 115-116, as Getty's photo of 25 Oct 2008 (Game 3) shows it: a
// curved counter with a black top, the base royal blue with a white stripe and a red one, a red steel arch
// over it carrying the PROGRAMS signs; the covers stood up on the counter (the black 2008 program, Utley
// and Longoria, $15). The buyers' side is +z.
export function programKiosk( Pr, K, P ) {

	const R = 1.05, H = 1.02;
	const arc = [ 0, Math.PI ];
	// the base in bands: blue, white, red, blue; the black top (the counter's front is the half toward +z)
	for ( const [ y0, y1, c ] of [ [ 0.0, 0.08, 'black' ], [ 0.08, 0.52, 'royal' ], [ 0.52, 0.6, 'white' ], [ 0.6, 0.68, 'royal' ], [ 0.68, 0.78, 'red' ], [ 0.78, H - 0.05, 'royal' ] ] ) Pr.use( c ).cyl( P, 0, 0, y0, y1, R, R, 16, { top: false, arc } );
	Pr.use( 'black' ).cyl( P, 0, 0, H - 0.05, H, R + 0.06, R + 0.06, 16, { top: true, arc } );
	// the back: a straight counter across, the seller's side, the cash box and the stock underneath
	Pr.use( 'royal' ).box( P, 0, ( H - 0.05 ) / 2, - 0.05, 2 * R, H - 0.05, 0.1 );
	Pr.use( 'black' ).box( P, 0, H - 0.025, - 0.05, 2 * R + 0.12, 0.05, 0.14 );
	Pr.use( 'cardboard' ).box( P, - 0.55, 0.3, - 0.4, 0.5, 0.6, 0.4 );
	Pr.use( 'cardboard' ).box( P, 0.1, 0.25, - 0.45, 0.45, 0.5, 0.35 );
	Pr.use( 'grey' ).box( P, 0.45, H + 0.05, - 0.1, 0.24, 0.1, 0.18 );
	// the red arch: two square posts at the back corners, the beam across, the sign each way
	for ( const x of [ - R, R ] ) Pr.use( 'red' ).box( P, x, 1.45, - 0.08, 0.1, 2.9, 0.1 );
	Pr.use( 'red' ).box( P, 0, 2.95, - 0.08, 2 * R + 0.1, 0.12, 0.12 );
	Pr.use( 'red' ).box( P, 0, 2.3, - 0.08, 2 * R, 0.06, 0.08 );
	Pr.use( 'white' ).box( P, 0, 2.62, - 0.08, 1.9, 0.46, 0.05, 'programs', 'programs' );
	// the covers stood up in a row on the counter, a stack of them flat
	for ( let i = 0; i < 5; i ++ ) {

		const a = 0.35 + i * ( Math.PI - 0.7 ) / 4, rr = R - 0.14;
		K.box( P, Math.cos( a ) * rr, H + 0.15, Math.sin( a ) * rr - 0.02, 0.21, 0.29, 0.015, 'program' );

	}

	for ( let i = 0; i < 2; i ++ ) K.use( 'navy' ).box( P, - 0.3 + i * 0.55, H + 0.05, - 0.2, 0.22, 0.1, 0.29 );

}

// The caricaturist's corner: his easel with the pad (a face coming together on it), a stool for him and
// one for whoever's sitting, a board of samples on its own easel facing the walkway (Utley and Howard
// big-headed, a kid, a couple: "CARICATURES $15"). The sitter's stool at +z, the samples facing -x.
export function caricatureCorner( Pr, P ) {

	const easel = ( x, z, yaw, board, bw, bh, y0 ) => {

		const c = Math.cos( yaw ), s = Math.sin( yaw );
		const Q = ( xx, y, zz ) => P( x + xx * c + zz * s, y, z - xx * s + zz * c );
		Q.dir = ( xx, y, zz ) => P.dir( xx * c + zz * s, y, - xx * s + zz * c );
		// three legs: two in front splayed, one behind
		for ( const lx of [ - 0.32, 0.32 ] ) Pr.use( 'wood' ).quad( Q( lx - 0.02, 0, 0.12 ), Q( lx + 0.02, 0, 0.12 ), Q( lx * 0.3 + 0.02, y0 + bh + 0.1, 0 ), Q( lx * 0.3 - 0.02, y0 + bh + 0.1, 0 ), Q.dir( 0, 0, 1 ) );
		Pr.use( 'wood' ).quad( Q( - 0.02, 0, - 0.5 ), Q( 0.02, 0, - 0.5 ), Q( 0.02, y0 + bh, - 0.02 ), Q( - 0.02, y0 + bh, - 0.02 ), Q.dir( 0, 0.2, - 1 ) );
		Pr.use( 'wood' ).box( Q, 0, y0 - 0.03, 0.06, bw + 0.06, 0.04, 0.06 );
		Pr.panel( Q, 0, y0 + bh / 2, 0.035, bw, bh, board );
		Pr.use( 'white' ).box( Q, 0, y0 + bh / 2, 0.02, bw + 0.02, bh + 0.02, 0.02 );

	};

	easel( 0, 0, 0, 'sketch', 0.5, 0.62, 0.95 );
	easel( - 1.45, - 0.35, 0.55, 'caricatures', 0.8, 0.6, 1.05 );
	// his stool behind the easel, the sitter's in front of it; a tackle box of markers on the floor
	for ( const [ x, z, h ] of [ [ 0.05, - 0.75, 0.62 ], [ 0.0, 1.35, 0.5 ] ] ) {

		Pr.use( 'black' ).cyl( P, x, z, h - 0.04, h, 0.2, 0.2, 10 );
		for ( const a of [ 0.4, 2.5, 4.6 ] ) Pr.use( 'steel' ).quad( P( x + Math.cos( a ) * 0.22 - 0.01, 0, z + Math.sin( a ) * 0.22 ), P( x + Math.cos( a ) * 0.22 + 0.01, 0, z + Math.sin( a ) * 0.22 ), P( x + Math.cos( a ) * 0.1 + 0.01, h - 0.04, z + Math.sin( a ) * 0.1 ), P( x + Math.cos( a ) * 0.1 - 0.01, h - 0.04, z + Math.sin( a ) * 0.1 ), P.dir( Math.cos( a ), 0.2, Math.sin( a ) ) );

	}

	Pr.use( 'grey' ).box( P, 0.55, 0.1, - 0.55, 0.4, 0.2, 0.22 );
	Pr.use( 'yellow' ).box( P, 0.55, 0.205, - 0.55, 0.36, 0.01, 0.18 );

}

// A cart's sign over it and on its face (for the kinds W2's carts don't have: the Hatfield cart, the
// Phanatic Phood cart, the draft and bottle beer): both faces of the sign over the top, the one on the
// customers' side low on the front
export function cartSigns( Pr, P, cell, z = 0.035 ) {

	const L = 1.7, D = 0.8, H = 0.95;
	Pr.panel( P, 0, H + 1.35, z, L + 0.1, 0.34, cell );
	const B = ( x, y, zz ) => P( - x, y, - zz );
	B.dir = ( x, y, zz ) => P.dir( - x, y, - zz );
	Pr.panel( B, 0, H + 1.35, z, L + 0.1, 0.34, cell );
	Pr.panel( P, 0, 0.55, D / 2 + z - 0.02, L * 0.9, 0.28, cell );

}

// what's on the Hatfield cart's top (a steam table of dogs and sausages under a sneeze guard, the rolls,
// the peppers and onions) and the Phanatic Phood cart's (a warmer, the juice boxes, a green Phanatic cup)
export function cartTop( Pr, K, P, kind ) {

	const H = 0.95;
	if ( kind === 'hatfieldCart' ) {

		K.use( 'steel' ).box( P, - 0.3, H + 0.1, - 0.05, 0.9, 0.2, 0.55 );
		for ( let i = 0; i < 7; i ++ ) K.use( i % 2 ? 'cocoa' : 'redPlastic' ).cyl( P, - 0.66 + i * 0.12, 0.0, H + 0.2, H + 0.23, 0.02, 0.02, 6 );
		K.use( 'glass' ).quad( P( - 0.75, H + 0.35, 0.22 ), P( 0.15, H + 0.35, 0.22 ), P( 0.15, H + 0.6, 0.05 ), P( - 0.75, H + 0.6, 0.05 ), P.dir( 0, 0.6, 1 ) );
		K.use( 'paper' ).box( P, 0.5, H + 0.1, 0.0, 0.35, 0.2, 0.3 );
		K.use( 'onion' ).cyl( P, 0.5, - 0.3, H, H + 0.12, 0.09, 0.09, 8 );
		K.use( 'relish' ).cyl( P, 0.72, - 0.3, H, H + 0.12, 0.07, 0.07, 8 );

	} else if ( kind === 'phood' ) {

		K.use( 'glass' ).box( P, - 0.35, H + 0.22, - 0.05, 0.6, 0.44, 0.45 );
		K.use( 'popcorn' ).box( P, - 0.35, H + 0.08, - 0.05, 0.56, 0.12, 0.41 );
		for ( let i = 0; i < 8; i ++ ) K.use( i % 2 ? 'yellow' : 'green' ).box( P, 0.25 + ( i % 4 ) * 0.1, H + 0.06, - 0.1 + Math.floor( i / 4 ) * 0.12, 0.06, 0.12, 0.04 );
		K.use( 'green' ).cyl( P, 0.7, 0.2, H, H + 0.16, 0.045, 0.055, 8 );

	}

}
