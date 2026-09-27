import { neutralPose, DIM } from './Rig.js';
import * as M from './Motions.js';

// The rituals' motions for the players' rig (Rig.js poses: the player's frame, y up, facing -z, +x his
// right; functions of time), in the style of Motions.js: the grounds crew pushing the tarp's roll and
// working the infield, the umpires waving it on, and the celebration's hugs, pile and trophy.

const clamp = ( x, a, b ) => Math.min( b, Math.max( a, x ) );
const ease = ( t ) => {

	const x = clamp( t, 0, 1 );
	return x * x * ( 3 - 2 * x );

};
const P = ( o ) => Object.assign( neutralPose(), o );

// walking along (phase in stride cycles: ~2.3 m a cycle), no glove
export function walk( phase ) {

	const p = M.run( phase, 0 );
	p.pelvisY -= 0.03;
	p.glove = false;
	return p;

}

// bent over the tarp's roll, both hands on top of it, walking it along (83458220: shoulder to shoulder,
// heads down, some with a knee to it). h: the roll's top above the ground; phase in stride cycles (0 still)
export function pushRoll( phase, h = 1.1, seed = 0 ) {

	const p = phase > 0 ? M.run( phase, 0 ) : M.stand( seed * 5 );
	const bend = clamp( 1.25 - h * 0.45, 0.35, 0.8 );
	p.pelvisY -= 0.08;
	p.pelvis = [ - 0.25 - 0.1 * bend, 0, 0 ];
	p.torso = [ - 0.45 - 0.35 * bend, ( seed - 0.5 ) * 0.2, 0 ];
	p.head = [ 0.55 + 0.2 * bend, ( seed - 0.5 ) * 0.4 ];
	const reach = h * 0.92;
	p.handL = [ - 0.2, reach, - 0.52 - 0.1 * bend ];
	p.handR = [ 0.22, reach + 0.02, - 0.5 - 0.1 * bend ];
	p.elbowL = p.elbowR = undefined;
	p.bat = null; p.twoHands = false; p.glove = false;
	return p;

}

// walking backwards a step at a time, pulling the sheet's edge by its strap (hands low in front)
export function tugEdge( t, seed = 0 ) {

	const k = 0.5 + 0.5 * Math.sin( t * 3.1 + seed * 6 );
	return P( {
		pelvisY: DIM.hip - 0.1 - 0.05 * k, pelvis: [ 0.12, 0, 0 ], torso: [ - 0.25 + 0.15 * k, 0, 0 ], head: [ 0.35, 0 ],
		footL: [ - 0.2, 0.08, - 0.25 ], footR: [ 0.2, 0.08, 0.2 ], footYawL: 0.15, footYawR: - 0.15,
		handL: [ - 0.1, 0.72 + 0.05 * k, - 0.42 + 0.08 * k ], handR: [ 0.1, 0.74 + 0.05 * k, - 0.42 + 0.08 * k ], glove: false,
	} );

}

// standing about in the rain: arms folded, now and then the hands in the jacket's pockets, a look round
export function waitAbout( t, seed = 0 ) {

	const c = Math.sin( t * 0.21 + seed * 9 );
	const p = c > 0.2 ? M.armsFolded( t ) : P( { ...M.stand( t ), handL: [ - 0.2, 0.9, - 0.08 ], handR: [ 0.2, 0.9, - 0.08 ], glove: false } );
	p.head = [ 0.05 + 0.1 * Math.sin( t * 0.4 + seed ), 0.5 * Math.sin( t * 0.13 + seed * 4 ) ];
	p.glove = false;
	return p;

}

// an umpire waving the grounds crew on: the right arm circling overhead, the left pointing at the tarp
export function waveOn( t ) {

	const a = t * 6;
	const p = P( { ...M.stand( t ), torso: [ 0.05, - 0.2, 0 ], head: [ - 0.1, - 0.5 ],
		handL: [ - 0.65, 1.45, - 0.25 ], handR: [ 0.3 + 0.25 * Math.cos( a ), 2.0 + 0.2 * Math.sin( a ), - 0.1 ], glove: false } );
	return p;

}

// holding the hose's nozzle low in front with both hands, playing it slowly side to side over the clay
// (Getty 83824985, the 29th)
export function hose( t, seed = 0 ) {

	const s = Math.sin( t * 0.9 + seed * 5 );
	return P( { ...M.stand( t ), torso: [ - 0.12, 0.25 * s, 0 ], head: [ 0.4, 0.3 * s ],
		handL: [ - 0.06 + 0.15 * s, 0.95, - 0.38 ], handR: [ 0.1 + 0.15 * s, 0.88, - 0.28 ], glove: false } );

}

// pushing the chalk liner along a line (a little wheeled box: hands low in front on its handle)
export function pushLiner( phase ) {

	const p = walk( phase );
	p.torso = [ - 0.3, 0, 0 ];
	p.head = [ 0.55, 0 ];
	p.handL = [ - 0.16, 0.82, - 0.42 ];
	p.handR = [ 0.16, 0.82, - 0.42 ];
	p.elbowL = p.elbowR = undefined;
	return p;

}

// tamping the clay on the mound or at the plate: the tamper's handle in both hands, lifted and dropped
export function tamp( t ) {

	const k = Math.abs( Math.sin( t * 3.2 ) );
	return P( {
		pelvisY: DIM.hip - 0.06, pelvis: [ - 0.15, 0, 0 ], torso: [ - 0.3, 0, 0 ], head: [ 0.6, 0 ],
		footL: [ - 0.22, 0.08, 0.05 ], footR: [ 0.22, 0.08, 0.05 ], footYawL: 0.2, footYawR: - 0.2,
		handL: [ - 0.05, 0.85 + 0.25 * k, - 0.35 ], handR: [ 0.05, 1.1 + 0.25 * k, - 0.35 ],
		bat: { dir: [ 0, - 1, - 0.08 ] }, glove: false,
	} );

}

// leaning on a rake, its teeth on the ground in front
export function leanRake( t ) {

	const b = Math.sin( t * 0.8 ) * 0.01;
	return P( {
		pelvisY: DIM.hip - 0.02 + b, torso: [ - 0.05, 0, 0 ], head: [ 0.15, 0 ],
		footL: [ - 0.15, 0.08, 0.05 ], footR: [ 0.15, 0.08, 0.1 ],
		handL: [ 0.02, 1.22, - 0.38 ], handR: [ 0.06, 1.3, - 0.36 ], bat: { dir: [ 0, - 0.92, - 0.4 ] }, glove: false,
	} );

}

// jogging with a rake over the shoulder
export function carryRake( phase ) {

	const p = M.run( phase, 0 );
	p.handR = [ 0.15, 1.45, 0.05 ];
	p.bat = { dir: [ 0.1, 0.35, 0.93 ] };
	p.glove = false;
	return p;

}

// ---------------------------------------------------------------- the celebration

// two men hugging, chest to chest, rocking (side: which way the head goes)
export function hug( t, side = 1, lift = 0 ) {

	const r = Math.sin( t * 3.5 ) * 0.08;
	return P( {
		pelvisY: DIM.hip - 0.03, pelvis: [ 0, r, 0 ], torso: [ - 0.12, r * 1.5, 0.05 * side ], head: [ 0.1, 0.5 * side ],
		footL: [ - 0.17, 0.08, 0.1 ], footR: [ 0.17, 0.08, 0.15 ],
		handL: [ 0.14 - 0.05 * side, 1.35 + lift, - 0.3 ], handR: [ - 0.12 - 0.05 * side, 1.25 + lift, - 0.33 ], glove: false,
	} );

}

// one arm up, the fist pumping (pointing up at the crowd)
export function fist( t, seed = 0 ) {

	const k = Math.abs( Math.sin( t * 4 + seed * 7 ) );
	return P( { ...M.stand( t ), torso: [ 0.1, 0.2 * Math.sin( t + seed ), 0 ], head: [ - 0.4, 0.2 * Math.sin( t * 0.7 + seed ) ],
		handL: [ - 0.3, 0.95, 0.05 ], handR: [ 0.25, 1.8 + 0.3 * k, - 0.1 ], glove: false } );

}

// both arms up, waving to the stands (turning a little from side to side)
export function waveCrowd( t, seed = 0 ) {

	const a = Math.sin( t * 5 + seed * 3 );
	return P( { ...M.stand( t ), torso: [ 0.08, 0.25 * Math.sin( t * 0.6 + seed ), 0 ], head: [ - 0.25, 0.3 * Math.sin( t * 0.6 + seed ) ],
		handL: [ - 0.45 + 0.12 * a, 1.9, - 0.1 ], handR: [ 0.45 + 0.12 * a, 1.95, - 0.1 ], glove: false } );

}

// holding something up over his head in both hands (the trophy, the banner, a cap)
export function holdHigh( t, seed = 0 ) {

	const b = Math.sin( t * 2.2 + seed ) * 0.04;
	return P( { ...M.stand( t ), torso: [ 0.12, 0, 0 ], head: [ - 0.45, 0 ],
		handL: [ - 0.13, 2.05 + b, - 0.12 ], handR: [ 0.13, 2.05 + b, - 0.12 ], glove: false } );

}

// holding something at the chest in both hands (the trophy for the pictures)
export function holdChest( t ) {

	return P( { ...M.stand( t ), torso: [ 0.05, 0, 0 ], head: [ 0.1, 0 ],
		handL: [ - 0.1, 1.2, - 0.28 ], handR: [ 0.1, 1.15, - 0.3 ], glove: false } );

}

// clapping, easing in (k) from standing
export function applaud( t, seed = 0 ) {

	const c = M.clap( t + seed );
	c.glove = false;
	return c;

}

// standing at attention, the cap over the heart (the anthem, God Bless America)
export function capToHeart( t ) {

	return P( { ...M.stand( t ), head: [ - 0.05, 0 ], handL: [ - 0.25, 0.92, 0.05 ], handR: [ 0.06, 1.38, - 0.14 ], glove: false } );

}

// on the top step or the rail: leaning with his forearms on it
export function onRail( t ) {

	const p = M.leanRail( t );
	p.glove = false;
	return p;

}

// jogging (the lap round the track), slapping hands with the front row on his right
export function lapJog( phase, slap = 0 ) {

	const p = M.run( phase, 0.15 );
	if ( slap > 0 ) p.handR = [ 0.55, 1.25 + 0.2 * slap, - 0.25 ];
	p.glove = false;
	return p;

}

// the pile: lying across the others, at an angle (the caller tilts the root), arms round whoever's under
export function inPile( seed, t = 0 ) {

	const p = M.sprawl( seed );
	const w = Math.sin( t * 2.5 + seed * 5 ) * 0.1;
	p.handL = [ p.handL[ 0 ] + w, p.handL[ 1 ], p.handL[ 2 ] ];
	p.glove = false;
	return p;

}

// kneeling on the edge of the pile, reaching in
export function kneelIn( t, seed = 0 ) {

	const r = Math.sin( t * 3 + seed * 4 ) * 0.06;
	return P( {
		pelvisY: 0.55, pelvis: [ - 0.3, 0, 0 ], torso: [ - 0.6, r, 0 ], head: [ 0.5, 0 ],
		footL: [ - 0.15, 0.1, 0.45 ], footR: [ 0.2, 0.08, - 0.1 ], footYawL: 0, footYawR: 0,
		kneeL: [ 0, 0, - 0.9 ], kneeR: [ 0, 0, - 0.9 ],
		handL: [ - 0.2, 0.9 + r, - 0.6 ], handR: [ 0.25, 0.95 - r, - 0.6 ], glove: false,
	} );

}

export { ease, clamp };
