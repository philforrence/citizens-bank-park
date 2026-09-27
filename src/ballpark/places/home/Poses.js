import { armIK, armFK, GESTURE } from '../Concourse3BKit.js';
import { J } from '../Cast.js';

// How a Cast figure sits in a stadium seat, gets up out of it, and what its arms do while it's there.
//
// The cast (Cast.js) is built standing, facing -z, origin between the feet. Sitting: the thighs forward
// (the hips pitched a right angle), the shins down (the knees bent back), the whole figure dropped so the
// hip joints are just over the seat pan (43 cm up) and the feet on the tread. The figure's origin is put
// over the hip joints (the seat's middle, a little in front of its back), so the feet land 43 cm ahead.
// Standing up at a seat: the legs straighten, the drop goes, and the origin moves forward to where the
// feet are, in front of the seat.
//
// The arms are the cast's shoulder and elbow angles, solved once by Kit's IK in the figure's own frame
// (standing, undropped; the upper body is the same sitting). The gestures here are the seated ones
// (Kit's GESTURE has the rest): hands in the lap, on the knees, a cup held on the knee, a sign up, a
// flip phone held up to the camera, passing something along the row.

export const SIT = { hip: 1.52, knee: 1.47, drop: 0.405, lean: - 0.07, back: 0.02, front: - 0.22 };

// the seated gestures: [ left arm, right arm ] (null: at rest, Kit's rest)
export const SEATED = {};
{

	const t = { lean: SIT.lean };
	const both = ( l, r ) => [ l && armIK( - 1, l, t ), r && armIK( 1, r, t ) ];
	// hands in the lap, on the thighs; on the knees (leaning in)
	SEATED.lap = both( [ - 0.11, 1.04, - 0.25 ], [ 0.11, 1.04, - 0.25 ] );
	SEATED.knees = both( [ - 0.12, 1.02, - 0.4 ], [ 0.12, 1.02, - 0.4 ] );
	// one hand in the lap, the other holding a cup on the knee
	SEATED.cup = both( [ - 0.11, 1.04, - 0.26 ], [ 0.14, 1.06, - 0.36 ] );
	SEATED.cupL = both( [ - 0.14, 1.06, - 0.36 ], [ 0.11, 1.04, - 0.26 ] );
	// a hot chocolate held in both hands at the chest (the cup in the right)
	SEATED.warm = GESTURE.warm;
	// a scorebook on the lap, the pencil over it
	SEATED.score = both( [ - 0.07, 1.1, - 0.3 ], [ 0.04, 1.12, - 0.31 ] );
	// texting on a flip phone in the lap
	SEATED.text = both( [ - 0.11, 1.04, - 0.25 ], [ 0.05, 1.18, - 0.3 ] );
	// a program read in both hands
	SEATED.read = both( [ - 0.12, 1.16, - 0.3 ], [ 0.12, 1.16, - 0.3 ] );
	// eating: a hot dog (or peanuts) to the mouth
	SEATED.eat = both( [ - 0.11, 1.04, - 0.25 ], [ 0.05, 1.5, - 0.14 ] );
	// shelling a peanut: both hands at the chest
	SEATED.shell = both( [ - 0.03, 1.2, - 0.26 ], [ 0.04, 1.21, - 0.26 ] );
	// elbows on the knees, leaning in (the tense moments)
	SEATED.lean = both( [ - 0.08, 1.2, - 0.32 ], [ 0.08, 1.2, - 0.32 ] );
	// a sign held up over the head in both hands (standing, or sitting up)
	SEATED.sign = both( [ - 0.27, 1.95, - 0.22 ], [ 0.27, 1.95, - 0.22 ] );
	SEATED.signLow = both( [ - 0.27, 1.5, - 0.3 ], [ 0.27, 1.5, - 0.3 ] );
	// the phone held up and out to the TV camera, the other hand waving
	SEATED.phoneUp = [ [ 2.55, 0.5, 0.15, 1.1 ], armIK( 1, [ 0.12, 1.45, - 0.42 ], t ) ];
	// waving at the camera (the right arm up, the forearm swung by the caller)
	SEATED.wave = [ null, [ 2.4, 0.55, 0.25, 1.15 ] ];
	// both arms up and waving at center field
	SEATED.waveBoth = [ [ 2.5, 0.55, 0.2, 0.9 ], [ 2.5, 0.55, 0.2, 0.9 ] ];
	// passing something to the neighbour: to the left, to the right (held out at the chest)
	SEATED.passL = [ armIK( - 1, [ - 0.38, 1.18, - 0.3 ], t ), null ];
	SEATED.passR = [ null, armIK( 1, [ 0.38, 1.18, - 0.3 ], t ) ];
	// taking it: the same, the palm up a little lower
	SEATED.takeL = [ armIK( - 1, [ - 0.34, 1.12, - 0.32 ], t ), null ];
	SEATED.takeR = [ null, armIK( 1, [ 0.34, 1.12, - 0.32 ], t ) ];
	// a hand up for the vendor (two fingers: two beers)
	SEATED.hail = [ null, [ 2.3, 0.35, 0.1, 0.6 ] ];
	// flinching from a foul ball into the net: the forearms up in front of the face
	SEATED.flinch = both( [ - 0.1, 1.62, - 0.26 ], [ 0.1, 1.64, - 0.24 ] );
	// reaching up for a ball
	SEATED.reachUp = [ null, [ 2.9, 0.2, 0.0, 0.15 ] ];
	SEATED.reachUpBoth = [ [ 2.85, 0.25, 0.0, 0.2 ], [ 2.9, 0.2, 0.0, 0.15 ] ];
	// a hug (the arms round the neighbour on the right)
	SEATED.hugR = both( [ 0.18, 1.4, - 0.2 ], [ 0.45, 1.42, - 0.08 ] );
	SEATED.hugL = both( [ - 0.45, 1.42, - 0.08 ], [ - 0.18, 1.4, - 0.2 ] );
	// hands over the face (the last pitch)
	SEATED.pray = both( [ - 0.02, 1.52, - 0.14 ], [ 0.02, 1.52, - 0.14 ] );
	// the ticket held out to the usher, the other at rest
	SEATED.ticket = [ null, armIK( 1, [ 0.16, 1.2, - 0.42 ], t ) ];
	// pocketing the change: the right hand to the jacket's pocket
	SEATED.pocket = [ null, [ - 0.12, 0.14, - 0.05, 0.55 ] ];

	for ( const k of [ 'fold', 'sip', 'phone', 'clap', 'clapOpen', 'cheer', 'fist', 'photo', 'photoHigh', 'head', 'point', 'pockets', 'blow', 'holdUp' ] ) SEATED[ k ] = GESTURE[ k ];

}

// the rest arm (Cast.restPose's)
export const REST = [ 0.05, 0.06, 0, 0.12 ];

// ease the arms toward a gesture: cur [ l, r ] (arrays of 4, changed in place), target [ l | null, r | null ]
export function easeArms( cur, target, k ) {

	for ( let s = 0; s < 2; s ++ ) {

		const T = target[ s ] || REST, C = cur[ s ];
		for ( let j = 0; j < 4; j ++ ) C[ j ] += ( T[ j ] - C[ j ] ) * k;

	}

}

// write the legs, the drop and the lean for `up` (0 seated .. 1 standing); scale: the figure's size, so
// a kid's hips are over the same seat (and his feet hang)
export function sitPose( pose, up, scale = 1, lean = 0 ) {

	const s = 1 - up;
	// a kid's shorter legs: less drop to put his hips on the pan (the feet swing clear)
	const drop = Math.max( 0, J.hip[ 1 ] - ( J.hip[ 1 ] - SIT.drop ) / Math.max( 0.5, scale ) );
	pose.hipL = pose.hipR = SIT.hip * s;
	// the knees bend a little more half way up (pushing up out of the seat)
	pose.kneeL = pose.kneeR = SIT.knee * s + 0.35 * Math.sin( up * Math.PI );
	pose.drop = drop * s;
	pose.lean = SIT.lean * s + 0.32 * Math.sin( up * Math.PI ) + lean;

}

// where the figure's origin goes for `up`, from the seat (field frame): over the hips seated, over the
// feet in front of the seat standing
export function seatSpot( seat, up ) {

	const o = SIT.back + ( SIT.front - SIT.back ) * up;
	// the seat faces -n: the seat's local +z (its back) is +n
	return [ seat.x + seat.nx * o, seat.z + seat.nz * o ];

}

// the hands of a posed figure, in the field frame (for what they hold that the cast doesn't draw: a
// sign, a vendor's bin): p a cast person (its x, y, z, yaw, scale, pose)
export function handsOf( p ) {

	const a = p.pose;
	const trunk = { lean: a.lean, twist: a.twist, roll: a.roll };
	const L = armFK( - 1, a.armL, trunk ).hand, R = armFK( 1, a.armR, trunk ).hand;
	const c = Math.cos( p.yaw ), s = Math.sin( p.yaw ), k = p.scale;
	const T = ( h ) => [ p.x + ( h[ 0 ] * c + h[ 2 ] * s ) * k, p.y + ( h[ 1 ] - a.drop ) * k, p.z + ( - h[ 0 ] * s + h[ 2 ] * c ) * k ];
	return [ T( L ), T( R ) ];

}
