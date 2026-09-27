import { Group } from '../../../engine/index.js';
import { buildOpenGate } from '../gate3b/Gate.js';
import { LIFT } from '../gate3b/Street.js';
import { GATES } from '../../Exterior.js';

// The First Base Gate open for the game. It's the same gate as the Third Base Gate (Exterior.js builds
// both: the maroon frame between its stair towers, the white grid leaves on maroon posts), so it opens the
// same way, as the NLDS photo of 2 Oct 2008 shows the other one: the leaves folded out into fins with
// their baseballs, a red 2008 Postseason bin in front of each fin, a red bag-check table in each lane, the
// turnstile cabinets four metres in with the tripods turning, the "Welcome to World Series Game 5"
// placards on the fins, the rally-towel cartons past the turnstiles. W1's builder (gate3b/Gate.js) does
// all of that for any open gate; the Third Base plaza stands a curb higher than this one (gate3b's LIFT),
// so here it's built that much lower, and without the raised floor it carries through that gate.
export function buildGate1B( { group, exterior, colliders, field } ) {

	const gate = GATES.find( ( g ) => /FIRST/.test( g.name ) );
	if ( ! gate || ! exterior ) return null;
	const sub = new Group();
	sub.name = 'concourse1b-gate';
	sub.position.y = - LIFT;
	group.add( sub );
	const G = buildOpenGate( { group: sub, exterior, gate, colliders, field } );
	if ( ! G ) return null;
	for ( const m of sub.children.filter( ( c ) => c.name === 'w1-gate-apron' ) ) sub.remove( m );
	// its points at this plaza's level
	const P = ( s, o, y = 0 ) => {

		const p = G.P( s, o, y );
		p[ 1 ] -= LIFT;
		return p;

	};

	return { ...G, P, gate, group: sub };

}
