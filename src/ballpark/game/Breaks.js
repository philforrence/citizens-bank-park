import * as M from './Motions.js';
import { POSITIONS, MOUND, DUGOUT, dist, yawTo } from './Plays.js';

// Between the half innings, once the fielders are out at their positions (Director.show_switch runs them
// out): the ritual of the warm-up throws.
//   - the first baseman rolls ground balls across to the third baseman, the shortstop and the second
//     baseman in turn, and each fields it and throws it back to him;
//   - the pitcher's warm-up tosses to the catcher, the catcher throwing each one back (the one ball: the
//     replay's own);
//   - the outfielders throw a ball back and forth, left to center, center to right;
//   - on the last one the catcher comes up and throws down to second ("coming down!"), the shortstop
//     covering, and it goes round the horn: to third, across to first, to the pitcher.
// A pure function of the time into the break, like everything else.

const JOG = 4.2;
const hash = ( n ) => {

	const s = Math.sin( n * 12.9898 ) * 43758.5453;
	return s - Math.floor( s );

};

// when a fielder gets to his position (as Director._runOut: out of the dugout with the delay, at a jog)
function arrival( id, pos, team, delay ) {

	const from = DUGOUT[ team ];
	const to = pos === 'P' ? MOUND : POSITIONS[ pos ];
	return delay + hash( id ) * 3 + dist( from, to ) / JOG;

}

// a throw from a to b over the time T (a flat arc), at t in 0..1
function arc( a, b, h, k ) {

	return [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * k, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * k + Math.sin( Math.PI * k ) * h, a[ 2 ] + ( b[ 2 ] - a[ 2 ] ) * k ];

}

export function showWarmups( d, seg, lt, delay = 4 ) {

	const s = seg.snap, def = s.defense, team = s.fielding, P = d.game.players;
	if ( ! def ) return;
	const at = ( pos ) => pos === 'P' ? MOUND : POSITIONS[ pos ];
	const arr = ( pos ) => def[ pos ] ? arrival( def[ pos ], pos, team, delay ) : 1e9;
	const hand = ( id, pose ) => P[ id ]?.throws === 'L' ? M.mirror( pose ) : pose;
	const end = seg.dur - 2.2; // the throw down to second
	const act = ( pos, pose, face, extra = {} ) => {

		const id = def[ pos ];
		if ( ! id ) return;
		const p = at( pos );
		d.act( id, p[ 0 ], p[ 1 ], yawTo( p, face ), hand( id, pose ), { y: pos === 'P' ? 0.25 : 0, ...extra } );

	};

	// ---- the infield: grounders from first, round the horn, every 2.6 s once he and the man are there
	const t1B = arr( '1B' );
	const order = [ '3B', 'SS', '2B' ];
	if ( lt > t1B + 0.8 && lt < end - 0.5 ) {

		const n = Math.floor( ( lt - t1B - 0.8 ) / 2.6 ), u = ( lt - t1B - 0.8 ) - n * 2.6;
		const tgt = order[ n % 3 ];
		if ( arr( tgt ) < lt - u ) {

			// the roll (0 .. 0.35), across (.. 1.2), fielded, the throw back (1.3 .. 1.6), caught (.. 2.3)
			act( '1B', u < 0.5 ? M.fieldGrounder( u ) : u > 1.5 && u < 2.3 ? M.catchHigh( u ) : M.ready( lt ), at( tgt ) );
			act( tgt, u > 0.9 && u < 1.3 ? M.fieldGrounder( u ) : u >= 1.3 && u < 1.9 ? M.throwBall( ( u - 1.3 ) * 0.9 + 0.1 ) : M.ready( lt ), at( '1B' ) );

		}

	}

	// ---- the pitcher's warm-ups: a toss every 3.4 s once he's on the mound and the catcher's down
	const tP = Math.max( arr( 'P' ), arr( 'C' ) ) + 1.2;
	if ( lt > tP && lt < end ) {

		const n = Math.floor( ( lt - tP ) / 3.4 ), u = ( lt - tP ) - n * 3.4;
		const rel = 0.2 + M.REL;
		const pose = u < 1.5 ? M.delivery( u * 0.9 + 0.2 ) : M.stand( lt );
		const id = def.P;
		if ( id ) d.act( id, MOUND[ 0 ], MOUND[ 1 ] + 0.03, Math.PI, hand( id, pose ), { y: 0.25 } );
		act( 'C', u > 2.1 && u < 2.7 ? M.throwBall( ( u - 2.1 ) * 0.9 + 0.1 ) : M.catcherCrouch( lt, null ), MOUND );
		// the ball: out of his hand, into the mitt, and back
		const tRel = rel / 0.9 - 0.2 / 0.9;
		const hand3 = [ MOUND[ 0 ] + 0.3, 1.95, MOUND[ 1 ] + 1.1 ], mitt = [ POSITIONS.C[ 0 ], 0.7, POSITIONS.C[ 1 ] - 0.35 ];
		if ( u > tRel && u < tRel + 0.55 ) d.ballAt = arc( hand3, mitt, 0.25, ( u - tRel ) / 0.55 );
		else if ( u >= tRel + 0.55 && u < 2.3 ) d.ballAt = mitt;
		else if ( u >= 2.3 && u < 3.2 ) d.ballAt = arc( [ mitt[ 0 ], 1.4, mitt[ 2 ] ], [ hand3[ 0 ], 1.5, hand3[ 2 ] - 0.8 ], 2.2, ( u - 2.3 ) / 0.9 );

	}

	// ---- the throw down: the catcher up and to second, the shortstop covering; round the horn
	if ( lt >= end && def.C && arr( 'C' ) < end ) {

		const u = lt - end;
		act( 'C', u < 0.6 ? M.throwBall( u * 0.9 + 0.1 ) : M.stand( lt ), POSITIONS[ '2B' ] );
		const bag2 = [ 0, - 38.8 ];
		if ( def.SS && arr( 'SS' ) < end ) d.act( def.SS, bag2[ 0 ] - 0.8, bag2[ 1 ] + 0.6, yawTo( bag2, [ 0, 0 ] ), hand( def.SS, u > 0.6 && u < 1.3 ? M.catchHigh( u ) : u >= 1.3 && u < 1.9 ? M.throwBall( ( u - 1.3 ) * 0.9 + 0.1 ) : M.ready( lt ) ) );
		if ( u > 0.1 && u < 0.75 ) d.ballAt = arc( [ POSITIONS.C[ 0 ], 1.6, POSITIONS.C[ 1 ] - 0.5 ], [ bag2[ 0 ] - 0.8, 1.2, bag2[ 1 ] + 0.6 ], 1.2, ( u - 0.1 ) / 0.65 );
		else if ( u >= 1.4 && u < 2.0 ) d.ballAt = arc( [ bag2[ 0 ] - 0.8, 1.5, bag2[ 1 ] + 0.6 ], [ POSITIONS[ '3B' ][ 0 ], 1.3, POSITIONS[ '3B' ][ 1 ] ], 1.0, ( u - 1.4 ) / 0.6 );

	}

	// ---- the outfield: catch, left to center, center to right
	const pairs = [ [ 'LF', 'CF' ], [ 'CF', 'RF' ] ];
	pairs.forEach( ( [ a, b ], k ) => {

		const t0 = Math.max( arr( a ), arr( b ) ) + 0.5 + k * 1.3;
		if ( lt < t0 || lt > end + 1 ) return;
		const u = ( lt - t0 ) % 4.4;
		// one throws (0 .. 0.6), the other catches (1.4 .. 1.9) and throws back (2.2 .. 2.8), caught (3.6 ..)
		const A = u < 0.6 ? M.throwBall( u * 0.9 + 0.1 ) : u > 3.6 && u < 4.2 ? M.catchHigh( u ) : M.stand( lt );
		const B = u > 1.4 && u < 1.9 ? M.catchHigh( u ) : u > 2.2 && u < 2.8 ? M.throwBall( ( u - 2.2 ) * 0.9 + 0.1 ) : M.stand( lt );
		if ( k === 0 || ! ( u > 1.4 && u < 2.8 ) ) act( a, A, at( b ) );
		act( b, B, at( a ) );

	} );

}
