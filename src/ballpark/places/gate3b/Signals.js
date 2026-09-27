// The traffic signals' clock, shared by the lenses (a WGSL function of frame.time) and the traffic (the
// same function here): 11th and Pattison, and the mid-block crossing in front of the Schmidt statue.
//
//   controller 0: Pattison at 11th       green 34, yellow 4, all-red 2, then 11th's turn
//   controller 1: 11th at Pattison       (red while Pattison goes) green 18, yellow 3, all-red 2
//   controller 2: Pattison mid-block     green 44, yellow 4, all-red 2, walk 12, flashing hand 6
// Pedestrians cross Pattison at 11th while 11th has the green, and 11th while Pattison has it.

export const CYCLE = { a: 34, ay: 4, ar: 2, b: 18, by: 3, br: 2, m: 44, my: 4, mr: 2, mw: 12, mf: 6 };
const C = CYCLE;
const T1 = C.a + C.ay + C.ar + C.b + C.by + C.br; // the intersection's whole cycle
const T2 = C.m + C.my + C.mr + C.mw + C.mf; // the mid-block's

// the state of a controller at time t: 'g', 'y', 'r'; and for the walk signals 'walk', 'flash', 'dont'
export function signal( ctrl, t ) {

	if ( ctrl === 2 ) {

		const k = t % T2;
		if ( k < C.m ) return 'g';
		if ( k < C.m + C.my ) return 'y';
		return 'r';

	}

	const k = ( t + 7 ) % T1;
	const aGreen = k < C.a, aYellow = k >= C.a && k < C.a + C.ay;
	const b0 = C.a + C.ay + C.ar;
	const bGreen = k >= b0 && k < b0 + C.b, bYellow = k >= b0 + C.b && k < b0 + C.b + C.by;
	if ( ctrl === 0 ) return aGreen ? 'g' : aYellow ? 'y' : 'r';
	return bGreen ? 'g' : bYellow ? 'y' : 'r';

}

// the walk signal for crossing: 'pattison' at 11th, '11th' at Pattison, 'mid' mid-block
export function walk( which, t ) {

	if ( which === 'mid' ) {

		const k = t % T2, w0 = C.m + C.my + C.mr;
		return k >= w0 && k < w0 + C.mw ? 'walk' : k >= w0 + C.mw ? 'flash' : 'dont';

	}

	// crossing Pattison goes with 11th's green (and the reverse)
	const s = signal( which === 'pattison' ? 1 : 0, t );
	const k = ( t + 7 ) % T1;
	const b0 = C.a + C.ay + C.ar;
	if ( s === 'g' ) {

		const left = which === 'pattison' ? b0 + C.b - k : C.a - k;
		return left > 7 ? 'walk' : 'flash';

	}

	return 'dont';

}

// the same in WGSL: lens( controller, colour ) -> 0/1 lit. colour 0 red, 1 yellow, 2 green, 3 the hand,
// 4 the walking man
export const SIGNAL_WGSL = /* wgsl */`
fn w1Signal( ctrl: f32, t: f32 ) -> f32 {
	// 0 green, 1 yellow, 2 red
	if ( ctrl > 1.5 ) {
		let k = t % ${ T2.toFixed( 1 ) };
		return select( select( 2.0, 1.0, k < ${ ( C.m + C.my ).toFixed( 1 ) } ), 0.0, k < ${ C.m.toFixed( 1 ) } );
	}
	let k = ( t + 7.0 ) % ${ T1.toFixed( 1 ) };
	if ( ctrl < 0.5 ) { return select( select( 2.0, 1.0, k < ${ ( C.a + C.ay ).toFixed( 1 ) } ), 0.0, k < ${ C.a.toFixed( 1 ) } ); }
	let b0 = ${ ( C.a + C.ay + C.ar ).toFixed( 1 ) };
	return select( select( 2.0, 1.0, k >= b0 + ${ C.b.toFixed( 1 ) } && k < b0 + ${ ( C.b + C.by ).toFixed( 1 ) } ), 0.0, k >= b0 && k < b0 + ${ C.b.toFixed( 1 ) } );
}
// the walk heads: 0 don't walk (the steady hand), 1 walk, 2 flashing hand; which: 0 across Pattison at
// 11th, 1 across 11th, 2 mid-block
fn w1Walk( which: f32, t: f32 ) -> f32 {
	if ( which > 1.5 ) {
		let k = t % ${ T2.toFixed( 1 ) };
		let w0 = ${ ( C.m + C.my + C.mr ).toFixed( 1 ) };
		return select( select( 0.0, 2.0, k >= w0 + ${ C.mw.toFixed( 1 ) } ), 1.0, k >= w0 && k < w0 + ${ C.mw.toFixed( 1 ) } );
	}
	let k = ( t + 7.0 ) % ${ T1.toFixed( 1 ) };
	let b0 = ${ ( C.a + C.ay + C.ar ).toFixed( 1 ) };
	if ( which < 0.5 ) {
		if ( k >= b0 && k < b0 + ${ C.b.toFixed( 1 ) } ) { return select( 2.0, 1.0, b0 + ${ C.b.toFixed( 1 ) } - k > 7.0 ); }
		return 0.0;
	}
	if ( k < ${ C.a.toFixed( 1 ) } ) { return select( 2.0, 1.0, ${ C.a.toFixed( 1 ) } - k > 7.0 ); }
	return 0.0;
}
`;
