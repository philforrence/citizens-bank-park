import { PROP } from '../Cast.js';
import { SEATED } from './Poses.js';
import { hash } from './Fans.js';

// The little moments the whole backdrop shares, over what each fan does on his own:
//   - on TV: somebody's phone goes off (a friend at home: "you're on TV!"), and there he is in the
//     rows behind the plate, the phone at his ear, waving at center field; a pitch or two later someone
//     else. (In 2008 the flip phone, the call home, the wave at the center field camera: every broadcast.)
//   - the Phanatic (A's place, app.phanatic.now) coming by: heads turn to him, the kids up on their
//     seats, the cameras and phones out.
//   - the 9th on the 29th: cameras up for the last three outs, a few flashes already.

export class Moments {

	constructor( place ) {

		this.place = place;

	}

	update( N ) {

		const P = this.place, fans = P.fans.list;
		// ---- on TV: while the center field camera's on the plate (the pitches), one or two at a time
		if ( N.pitching && ! N.celebrate ) {

			const slot = Math.floor( N.t / 23 );
			for ( let k = 0; k < 2; k ++ ) {

				const h = hash( slot * 7.7 + k * 3.1 );
				if ( h > 0.55 ) continue;
				// someone in the rows the camera sees (the front eight, the plate's width either side)
				const cand = fans.filter( ( f ) => f.seat.row < 9 && Math.abs( f.seat.x ) < 9 && ! f.name && ! f.driven && ! f.away );
				if ( ! cand.length ) break;
				const f = cand[ Math.floor( hash( h * 91 + slot ) * cand.length ) ];
				const u = N.t - slot * 23 - 3 * k;
				if ( u < 0 || u > 11 ) continue;
				// the phone to the ear, then the free hand waving; up on his feet for a second or two
				const g = u < 2.5 ? SEATED.phone : [ SEATED.wave[ 1 ] && mirror( SEATED.wave[ 1 ], N.t ), SEATED.phone[ 1 ] ];
				f.act( g, 0.3, { key: 'tv', propR: PROP.phone, propL: 0, head: [ 0, - 0.05 ], mouth: 0.3 + 0.3 * Math.max( 0, Math.sin( N.t * 7 ) ), up: u > 4 && u < 7 && hash( slot ) < 0.4 ? 1 : undefined } );

			}

		}

		// ---- the Phanatic near: heads to him, the kids up, cameras out
		const ph = P.app?.phanatic?.now || P.app?.places?.find?.( ( q ) => q.name === 'phanatic' )?.now;
		if ( ph && ph.visible ) {

			const d = Math.hypot( ph.x, ph.z - 28 );
			if ( d < 32 ) {

				const at = [ ph.x, ( ph.y || 0 ) + 1.4, ph.z ];
				for ( const f of fans ) {

					if ( f.driven || f.away ) continue;
					const r = Math.hypot( f.p.x - ph.x, f.p.z - ph.z );
					if ( r > 16 ) continue;
					const excite = ( ph.excite ?? 0.6 ) * ( 1 - r / 16 );
					const kid = f.p.scale < 0.8;
					if ( kid ) f.act( 'waveBoth', 0.3, { key: 'phanatic', look: at, up: 1, onSeat: true, y: 0.43, mouth: 0.7 } );
					else if ( f.kit.camera && excite > 0.3 ) f.act( 'photo', 0.3, { key: 'phanatic', look: at, propR: PROP.camera, propL: 0 } );
					else f.act( undefined, 0.3, { key: 'phanatic', look: at, mouth: excite > 0.4 ? 0.5 : 0 } );

				}

			}

		}

		// ---- the 9th on the 29th: the cameras up, pictures of the last outs
		if ( ! N.first && N.inning >= 9 && N.half === 'top' && N.pitching ) N.flash = Math.max( N.flash, 0.25 + 0.15 * ( N.snap.outs || 0 ) );

	}

}

// the left arm waving (the right holds the phone)
function mirror( a, t ) {

	return [ a[ 0 ], a[ 1 ] + 0.3 * Math.sin( t * 9 ), a[ 2 ], a[ 3 ] ];

}
