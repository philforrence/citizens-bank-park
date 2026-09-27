import { InstancedMesh, BufferGeometry, Float32BufferAttribute, InstancedBufferAttribute, Matrix4, Quaternion, Vector3 } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';

// The people of the rail: the photographers in the wells, the TV crews, the ball girls, the bat boys, the
// grounds crew, security, the police and the odd fan at the front. Low-poly posed figures in the style of
// FieldFigures (tubes between joints, an ellipsoid head, a cap's brim), with three things more:
//
//   - two poses per figure, blended per instance (morph 0..1, or -1..1 for a stride swung both ways):
//     a photographer lowering his lens to check the back of the camera, a ball girl reaching up with a
//     ball for a kid, the bat boy bending for the bat;
//   - gear built into the figure and carried by its joints (a 400 mm lens on a monopod, its rain cover,
//     the credential on its lanyard, a headset, a glove, a bat, a phone), so it moves with the hands;
//   - the head turns and nods on its own (look), to follow the play.
//
// One InstancedMesh per kind (the pose pair and the gear); a character that changes what it's doing
// (walking out, bending, walking back) has an instance in each kind it uses and shows one at a time.
//
//   const figs = new RailFigures( parent );
//   const f = figs.add( 'photoSit', { x, y, z, yaw, outfit: RAIL.photog, flags: FLAG.cover } );
//   figs.build();   ...   f.morph = 0.4; f.look = [ yaw, pitch ]; f.x = ...; figs.update();

export const RAIL = {
	photog: 0, // a news photographer: parka, trousers, a beanie or a cap (by his seed)
	fox: 1, // FOX's camera operator: black rain shell, black cap, headset
	sound: 2, // the parabolic mic's sound man: grey hooded jacket, big headphones
	ballGirl: 3, // Phillies ball girl: red jacket, white pants, red cap, ponytail
	batBoyPhi: 4, // Phillies bat boy: home pinstripes, red helmet
	batBoyRay: 5, // Rays bat boy: road greys, navy helmet
	crew: 6, // grounds crew: navy rain suit
	crewChief: 7, // the head groundskeeper: navy jacket, khakis, Phillies cap
	security: 8, // event staff: yellow jacket, black trousers, black cap
	police: 9, // Philadelphia police: navy jacket, navy trousers, the eight-point cap
	kid: 10, // a kid at the front: red hoodie, jeans, a cap
	fan: 11, // a grown-up fan at the front: by his seed
};

// per-instance flags (bits)
export const FLAG = {
	hood: 1, // hood up
	cap: 2, // a cap (else bare-headed or the outfit's own)
	ponytail: 4,
	cover: 8, // rain covers on the cameras
	beanie: 16,
	noGear: 32, // the gear folded away (the bat boy walking out empty-handed)
	glasses: 64,
	vest: 128, // a photographer's numbered World Series vest
	helmet: 256, // riot helmet (police), batting helmet
	onAir: 512, // a TV camera's tally light lit
};

// joints for the right side (+x); the left mirrors x unless the pose gives it its own ( 'L:' prefix).
// Gear points ( cam, lensTip, ... ) are named in the same tables.
const BASE = {
	hip: [ 0.1, 0.9, 0.0 ], knee: [ 0.11, 0.5, - 0.02 ], ankle: [ 0.12, 0.08, 0.0 ], toe: [ 0.13, 0.04, - 0.15 ],
	pelvis: [ 0, 0.88, 0.02 ], chest: [ 0, 1.38, 0.03 ], neck: [ 0, 1.45, 0.03 ], head: [ 0, 1.58, 0.02 ],
	shoulder: [ 0.2, 1.37, 0.03 ], elbow: [ 0.23, 1.1, 0.06 ], wrist: [ 0.22, 0.86, 0.02 ], hand: [ 0.21, 0.77, 0.01 ],
};

const sitLegs = ( H ) => ( {
	pelvis: [ 0, H + 0.12, 0.06 ], hip: [ 0.1, H + 0.1, 0.03 ], knee: [ 0.13, H + 0.08, - 0.4 ], ankle: [ 0.14, 0.08, - 0.44 ], toe: [ 0.15, 0.04, - 0.58 ],
	'L:knee': [ - 0.12, H + 0.07, - 0.41 ], 'L:ankle': [ - 0.13, 0.08, - 0.4 ], 'L:toe': [ - 0.14, 0.04, - 0.54 ],
} );

const PH = 0.55; // a photographer's stool (tall enough to put his lens between the well's rails)
export const POSES = {
	stand: {},
	// mid-stride, the left foot forward (a stride swung both ways: morph -1..1)
	stride: {
		knee: [ 0.11, 0.47, 0.12 ], ankle: [ 0.12, 0.16, 0.26 ], toe: [ 0.13, 0.08, 0.14 ],
		'L:knee': [ - 0.11, 0.52, - 0.2 ], 'L:ankle': [ - 0.12, 0.1, - 0.28 ], 'L:toe': [ - 0.13, 0.05, - 0.42 ],
		elbow: [ 0.23, 1.11, - 0.07 ], wrist: [ 0.22, 0.91, - 0.18 ], hand: [ 0.21, 0.83, - 0.23 ],
		'L:elbow': [ - 0.23, 1.11, 0.15 ], 'L:wrist': [ - 0.22, 0.9, 0.2 ], 'L:hand': [ - 0.21, 0.81, 0.23 ],
	},
	// on a low stool behind a 400 mm on its monopod, his eye to the viewfinder: the right hand on the
	// grip, the left under the lens
	photoSit: {
		...sitLegs( PH ),
		chest: [ 0, PH + 0.55, - 0.04 ], neck: [ 0, PH + 0.62, - 0.07 ], head: [ 0, PH + 0.74, - 0.09 ],
		shoulder: [ 0.2, PH + 0.53, - 0.04 ], elbow: [ 0.25, PH + 0.42, - 0.15 ], wrist: [ 0.11, PH + 0.62, - 0.24 ], hand: [ 0.085, PH + 0.67, - 0.27 ],
		'L:elbow': [ - 0.21, PH + 0.38, - 0.3 ], 'L:wrist': [ - 0.05, PH + 0.55, - 0.46 ], 'L:hand': [ 0.0, PH + 0.6, - 0.5 ],
		cam: [ 0.02, PH + 0.72, - 0.25 ], lensTip: [ 0.02, PH + 0.7, - 0.74 ], monoTop: [ 0.02, PH + 0.62, - 0.47 ], monoFoot: [ 0.02, 0.01, - 0.46 ],
	},
	// the same, sat back checking the back of the camera: the lens tipped down on the monopod
	photoSitChimp: {
		...sitLegs( PH ),
		chest: [ 0, PH + 0.56, 0.0 ], neck: [ 0, PH + 0.62, - 0.03 ], head: [ 0, PH + 0.72, - 0.1 ],
		shoulder: [ 0.2, PH + 0.54, 0.0 ], elbow: [ 0.24, PH + 0.34, - 0.1 ], wrist: [ 0.12, PH + 0.44, - 0.22 ], hand: [ 0.08, PH + 0.47, - 0.26 ],
		'L:elbow': [ - 0.22, PH + 0.33, - 0.14 ], 'L:wrist': [ - 0.07, PH + 0.4, - 0.33 ], 'L:hand': [ - 0.02, PH + 0.42, - 0.37 ],
		cam: [ 0.02, PH + 0.48, - 0.27 ], lensTip: [ 0.02, PH + 0.2, - 0.7 ], monoTop: [ 0.02, PH + 0.38, - 0.44 ], monoFoot: [ 0.02, 0.01, - 0.46 ],
	},
	// standing behind the lens on its monopod, eye to the viewfinder
	photoStand: {
		chest: [ 0, 1.37, 0.0 ], neck: [ 0, 1.45, - 0.01 ], head: [ 0, 1.57, - 0.03 ],
		shoulder: [ 0.2, 1.36, 0.0 ], elbow: [ 0.27, 1.24, - 0.05 ], wrist: [ 0.12, 1.47, - 0.15 ], hand: [ 0.085, 1.52, - 0.19 ],
		'L:elbow': [ - 0.22, 1.2, - 0.2 ], 'L:wrist': [ - 0.05, 1.37, - 0.38 ], 'L:hand': [ 0.0, 1.42, - 0.43 ],
		'L:knee': [ - 0.1, 0.5, - 0.06 ], 'L:ankle': [ - 0.15, 0.08, - 0.05 ], 'L:toe': [ - 0.2, 0.04, - 0.18 ],
		cam: [ 0.02, 1.55, - 0.17 ], lensTip: [ 0.02, 1.53, - 0.66 ], monoTop: [ 0.02, 1.45, - 0.4 ], monoFoot: [ 0.02, 0.01, - 0.42 ],
	},
	// between pitches: the lens down at his chest, his hands on it, looking out
	photoStandRest: {
		chest: [ 0, 1.38, 0.02 ], neck: [ 0, 1.45, 0.02 ], head: [ 0, 1.58, 0.01 ],
		shoulder: [ 0.2, 1.37, 0.02 ], elbow: [ 0.25, 1.12, - 0.02 ], wrist: [ 0.12, 1.2, - 0.16 ], hand: [ 0.08, 1.24, - 0.2 ],
		'L:elbow': [ - 0.23, 1.1, - 0.1 ], 'L:wrist': [ - 0.07, 1.16, - 0.33 ], 'L:hand': [ - 0.01, 1.18, - 0.38 ],
		'L:knee': [ - 0.1, 0.5, - 0.06 ], 'L:ankle': [ - 0.15, 0.08, - 0.05 ], 'L:toe': [ - 0.2, 0.04, - 0.18 ],
		cam: [ 0.03, 1.24, - 0.2 ], lensTip: [ 0.03, 1.12, - 0.68 ], monoTop: [ 0.03, 1.12, - 0.42 ], monoFoot: [ 0.02, 0.01, - 0.45 ],
	},
	// changing lenses at his chest: the zoom still on the body ...
	lensOn: {
		chest: [ 0, 1.37, 0.0 ], neck: [ 0, 1.44, - 0.02 ], head: [ 0, 1.55, - 0.06 ],
		shoulder: [ 0.2, 1.36, 0.0 ], elbow: [ 0.24, 1.1, - 0.04 ], wrist: [ 0.12, 1.16, - 0.2 ], hand: [ 0.08, 1.19, - 0.24 ],
		'L:elbow': [ - 0.22, 1.08, - 0.12 ], 'L:wrist': [ - 0.07, 1.12, - 0.34 ], 'L:hand': [ - 0.01, 1.14, - 0.38 ],
		cam: [ 0.02, 1.19, - 0.25 ], lens0: [ 0.02, 1.18, - 0.3 ], lens1: [ 0.02, 1.16, - 0.5 ],
	},
	// ... and off, in his left hand
	lensOff: {
		chest: [ 0, 1.37, 0.0 ], neck: [ 0, 1.44, - 0.02 ], head: [ 0, 1.55, - 0.06 ],
		shoulder: [ 0.2, 1.36, 0.0 ], elbow: [ 0.24, 1.1, - 0.04 ], wrist: [ 0.12, 1.16, - 0.2 ], hand: [ 0.08, 1.19, - 0.24 ],
		'L:elbow': [ - 0.26, 1.06, - 0.02 ], 'L:wrist': [ - 0.2, 1.04, - 0.24 ], 'L:hand': [ - 0.18, 1.05, - 0.3 ],
		cam: [ 0.02, 1.19, - 0.25 ], lens0: [ - 0.17, 1.07, - 0.27 ], lens1: [ - 0.2, 1.02, - 0.47 ],
	},
	// at a TV camera on its pedestal: eye to the viewfinder, the left hand on the zoom, the right on the
	// pan bar ...
	tvCam: {
		chest: [ 0, 1.36, - 0.03 ], neck: [ 0, 1.43, - 0.06 ], head: [ 0, 1.54, - 0.1 ],
		shoulder: [ 0.2, 1.35, - 0.03 ], elbow: [ 0.32, 1.1, - 0.08 ], wrist: [ 0.38, 1.05, - 0.28 ], hand: [ 0.38, 1.05, - 0.36 ],
		'L:elbow': [ - 0.27, 1.14, - 0.22 ], 'L:wrist': [ - 0.18, 1.24, - 0.45 ], 'L:hand': [ - 0.15, 1.26, - 0.53 ],
	},
	// ... and off the eyepiece, watching the field over it
	tvCamUp: {
		chest: [ 0, 1.38, 0.0 ], neck: [ 0, 1.45, - 0.01 ], head: [ 0, 1.58, - 0.02 ],
		shoulder: [ 0.2, 1.37, 0.0 ], elbow: [ 0.32, 1.11, - 0.06 ], wrist: [ 0.38, 1.05, - 0.28 ], hand: [ 0.38, 1.05, - 0.36 ],
		'L:elbow': [ - 0.27, 1.15, - 0.2 ], 'L:wrist': [ - 0.18, 1.24, - 0.45 ], 'L:hand': [ - 0.15, 1.26, - 0.53 ],
	},
	// on a case with the mixer on his knees, headphones on (the parabolic mic's man)
	soundSit: {
		...sitLegs( 0.42 ),
		chest: [ 0, 0.95, - 0.02 ], neck: [ 0, 1.02, - 0.05 ], head: [ 0, 1.13, - 0.08 ],
		shoulder: [ 0.2, 0.93, - 0.02 ], elbow: [ 0.24, 0.72, - 0.12 ], wrist: [ 0.12, 0.62, - 0.28 ], hand: [ 0.08, 0.61, - 0.33 ],
		mixer: [ 0, 0.58, - 0.3 ],
	},
	soundSitUp: {
		...sitLegs( 0.42 ),
		chest: [ 0, 0.98, 0.02 ], neck: [ 0, 1.05, 0.01 ], head: [ 0, 1.17, - 0.01 ],
		shoulder: [ 0.2, 0.96, 0.02 ], elbow: [ 0.24, 0.73, - 0.1 ], wrist: [ 0.12, 0.63, - 0.27 ], hand: [ 0.08, 0.62, - 0.32 ],
		mixer: [ 0, 0.58, - 0.3 ],
	},
	// on a stool down the line, hands on her knees, the glove on her left ...
	stool: {
		...sitLegs( 0.62 ),
		chest: [ 0, 1.18, 0.02 ], neck: [ 0, 1.25, 0.0 ], head: [ 0, 1.37, - 0.03 ],
		shoulder: [ 0.2, 1.16, 0.02 ], elbow: [ 0.24, 0.92, - 0.12 ], wrist: [ 0.18, 0.76, - 0.33 ], hand: [ 0.16, 0.72, - 0.39 ],
	},
	// ... and forward on it, the glove down, ready for a ground ball
	stoolReady: {
		...sitLegs( 0.62 ),
		chest: [ 0, 1.12, - 0.12 ], neck: [ 0, 1.18, - 0.18 ], head: [ 0, 1.29, - 0.24 ],
		shoulder: [ 0.2, 1.1, - 0.12 ], elbow: [ 0.23, 0.87, - 0.25 ], wrist: [ 0.17, 0.72, - 0.4 ], hand: [ 0.15, 0.68, - 0.45 ],
		'L:elbow': [ - 0.22, 0.86, - 0.3 ], 'L:wrist': [ - 0.16, 0.56, - 0.48 ], 'L:hand': [ - 0.14, 0.48, - 0.52 ],
	},
	// holding a ball at her side ...
	ball: {
		elbow: [ 0.23, 1.1, 0.0 ], wrist: [ 0.2, 0.95, - 0.16 ], hand: [ 0.18, 0.93, - 0.23 ],
	},
	// ... and up over the wall to a kid in the front row
	ballUp: {
		chest: [ 0, 1.39, 0.0 ], neck: [ 0, 1.46, - 0.01 ], head: [ 0, 1.59, 0.0 ],
		shoulder: [ 0.2, 1.39, 0.0 ], elbow: [ 0.22, 1.63, - 0.14 ], wrist: [ 0.17, 1.86, - 0.28 ], hand: [ 0.15, 1.93, - 0.33 ],
		'L:elbow': [ - 0.23, 1.1, 0.02 ], 'L:wrist': [ - 0.2, 0.9, - 0.06 ], 'L:hand': [ - 0.19, 0.82, - 0.08 ],
	},
	// a kid at the front of the stands, leaning on the wall ...
	kidLean: {
		chest: [ 0, 1.34, - 0.08 ], neck: [ 0, 1.41, - 0.12 ], head: [ 0, 1.53, - 0.15 ],
		shoulder: [ 0.2, 1.33, - 0.08 ], elbow: [ 0.24, 1.16, - 0.24 ], wrist: [ 0.13, 1.1, - 0.4 ], hand: [ 0.1, 1.1, - 0.46 ],
		'L:elbow': [ - 0.24, 1.16, - 0.24 ], 'L:wrist': [ - 0.13, 1.1, - 0.4 ], 'L:hand': [ - 0.1, 1.1, - 0.46 ],
	},
	// ... reaching down over it with his glove
	kidReach: {
		pelvis: [ 0, 0.86, 0.08 ], hip: [ 0.1, 0.88, 0.07 ],
		chest: [ 0, 1.26, - 0.24 ], neck: [ 0, 1.31, - 0.31 ], head: [ 0, 1.41, - 0.38 ],
		shoulder: [ 0.2, 1.26, - 0.24 ], elbow: [ 0.24, 1.14, - 0.32 ], wrist: [ 0.13, 1.1, - 0.42 ], hand: [ 0.1, 1.1, - 0.46 ],
		'L:elbow': [ - 0.2, 1.08, - 0.46 ], 'L:wrist': [ - 0.15, 0.94, - 0.64 ], 'L:hand': [ - 0.13, 0.88, - 0.7 ],
	},
	// bent down to the ground (the bat boy picking up the bat)
	bend: {
		pelvis: [ 0, 0.78, 0.14 ], hip: [ 0.1, 0.8, 0.14 ], knee: [ 0.12, 0.46, - 0.12 ], ankle: [ 0.12, 0.08, 0.0 ],
		'L:knee': [ - 0.12, 0.44, 0.02 ], 'L:ankle': [ - 0.12, 0.08, 0.14 ], 'L:toe': [ - 0.13, 0.04, 0.0 ],
		chest: [ 0, 1.1, - 0.3 ], neck: [ 0, 1.14, - 0.38 ], head: [ 0, 1.22, - 0.48 ],
		shoulder: [ 0.2, 1.1, - 0.3 ], elbow: [ 0.24, 0.76, - 0.42 ], wrist: [ 0.22, 0.4, - 0.5 ], hand: [ 0.21, 0.3, - 0.52 ],
		'L:elbow': [ - 0.24, 0.84, - 0.34 ], 'L:wrist': [ - 0.2, 0.62, - 0.3 ], 'L:hand': [ - 0.17, 0.56, - 0.26 ],
	},
	// looking down at a phone in both hands
	phone: {
		head: [ 0, 1.56, - 0.03 ],
		elbow: [ 0.21, 1.12, - 0.1 ], wrist: [ 0.1, 1.19, - 0.24 ], hand: [ 0.05, 1.21, - 0.28 ],
		'L:elbow': [ - 0.21, 1.12, - 0.1 ], 'L:wrist': [ - 0.1, 1.19, - 0.24 ], 'L:hand': [ - 0.05, 1.21, - 0.28 ],
		phone: [ 0, 1.24, - 0.3 ],
	},
	// showing it to the man beside him: out at arm's length to his right
	phoneShow: {
		head: [ 0, 1.57, 0.0 ],
		elbow: [ 0.3, 1.2, - 0.05 ], wrist: [ 0.38, 1.3, - 0.22 ], hand: [ 0.4, 1.34, - 0.27 ],
		'L:elbow': [ - 0.23, 1.1, 0.04 ], 'L:wrist': [ - 0.2, 0.9, 0.0 ], 'L:hand': [ - 0.19, 0.82, - 0.01 ],
		phone: [ 0.41, 1.38, - 0.3 ],
	},
	// leaning on a rake, the hands stacked on the end of the handle
	rake: {
		pelvis: [ 0, 0.87, 0.04 ],
		'L:knee': [ - 0.1, 0.5, - 0.07 ], 'L:ankle': [ - 0.16, 0.08, - 0.06 ], 'L:toe': [ - 0.21, 0.04, - 0.19 ],
		chest: [ 0, 1.36, - 0.03 ], neck: [ 0, 1.43, - 0.06 ], head: [ 0, 1.55, - 0.08 ],
		shoulder: [ 0.2, 1.35, - 0.03 ], elbow: [ 0.2, 1.13, - 0.18 ], wrist: [ 0.06, 1.18, - 0.33 ], hand: [ 0.03, 1.2, - 0.37 ],
		'L:elbow': [ - 0.2, 1.1, - 0.16 ], 'L:wrist': [ - 0.06, 1.12, - 0.33 ], 'L:hand': [ - 0.03, 1.13, - 0.37 ],
		rake0: [ 0.0, 1.24, - 0.38 ], rake1: [ 0.0, 0.03, - 0.62 ],
	},
	// hands behind the back (parade rest: the police line)
	behind: {
		elbow: [ 0.24, 1.1, 0.12 ], wrist: [ 0.12, 0.95, 0.17 ], hand: [ 0.05, 0.92, 0.17 ],
	},
	// arms folded
	fold: {
		elbow: [ 0.23, 1.15, - 0.02 ], wrist: [ - 0.08, 1.22, - 0.14 ], hand: [ - 0.15, 1.23, - 0.12 ],
		'L:elbow': [ - 0.23, 1.17, 0.0 ], 'L:wrist': [ 0.06, 1.25, - 0.13 ], 'L:hand': [ 0.14, 1.26, - 0.11 ],
	},
	// a TV camera's head: its tilt axis 1.42 m up (the head's pivot sits 0.11 below the head's centre)
	camHead: { head: [ 0, 1.53, - 0.01 ] },
	// on a stool facing the crowd, the hands clasped between the knees
	stoolSit: {
		...sitLegs( 0.62 ),
		chest: [ 0, 1.18, 0.04 ], neck: [ 0, 1.25, 0.02 ], head: [ 0, 1.37, 0.0 ],
		shoulder: [ 0.2, 1.16, 0.04 ], elbow: [ 0.23, 0.92, - 0.1 ], wrist: [ 0.08, 0.76, - 0.3 ], hand: [ 0.03, 0.73, - 0.35 ],
	},
};

// a kind: the pose pair and the gear
export const KINDS = {
	photoSit: [ 'photoSit', 'photoSitChimp', [ 'lens400', 'credential', 'body2' ] ],
	photoStand: [ 'photoStand', 'photoStandRest', [ 'lens400', 'credential', 'body2' ] ],
	lensChange: [ 'lensOn', 'lensOff', [ 'lensShort', 'credential', 'body2' ] ],
	tvCam: [ 'tvCam', 'tvCamUp', [ 'headset' ] ],
	sound: [ 'soundSit', 'soundSitUp', [ 'headphones', 'mixer' ] ],
	ballGirl: [ 'stool', 'stoolReady', [ 'glove' ] ],
	ballGirlUp: [ 'ball', 'ballUp', [ 'glove', 'ball' ] ],
	ballGirlWalk: [ 'stand', 'stride', [ 'glove' ] ],
	kid: [ 'kidLean', 'kidReach', [ 'kidGlove' ] ],
	walk: [ 'stand', 'stride', [] ],
	batBoyWalk: [ 'stand', 'stride', [ 'bat' ] ],
	batBoyBend: [ 'stand', 'bend', [ 'bat' ] ],
	crewPhone: [ 'phone', 'phoneShow', [ 'phone', 'radio' ] ],
	crewRake: [ 'rake', 'rake', [ 'rakeTool' ] ],
	crewStand: [ 'stand', 'fold', [] ],
	security: [ 'stoolSit', 'stoolSit', [ 'radio' ] ],
	securityStand: [ 'fold', 'behind', [ 'radio' ] ],
	police: [ 'behind', 'fold', [ 'belt', 'radio' ] ],
	policeWalk: [ 'stand', 'stride', [ 'belt', 'radio' ] ],
	// no body: a TV camera's head on its pedestal, panning (yaw) and tilting (look) like a head does
	tvHead: [ 'camHead', 'camHead', [ 'tvCamera' ], { body: false } ],
	tvHeadBox: [ 'camHead', 'camHead', [ 'tvCameraBox' ], { body: false } ],
};

// parts, for the shader's colours
const PART = {
	torso: 0, pants: 1, skin: 2, head: 3, brim: 4, shoe: 5, sleeve: 6, hair: 7,
	dark: 8, lens: 9, leather: 10, white: 11, screen: 12, cover: 13, metal: 14, wood: 15, strap: 16, card: 17,
	tally: 18, camGrey: 19,
};

function jointsOf( pose ) {

	const P = POSES[ pose ];
	return ( name, s = 1 ) => {

		const own = s < 0 ? P[ 'L:' + name ] : null;
		if ( own ) return own;
		const j = P[ name ] || BASE[ name ];
		if ( ! j ) return null;
		return [ j[ 0 ] * ( j[ 0 ] ? s : 1 ), j[ 1 ], j[ 2 ] ];

	};

}

const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] ];
const add = ( a, b ) => [ a[ 0 ] + b[ 0 ], a[ 1 ] + b[ 1 ], a[ 2 ] + b[ 2 ] ];
const mul = ( a, k ) => [ a[ 0 ] * k, a[ 1 ] * k, a[ 2 ] * k ];
const cross = ( a, b ) => [ a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ], a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ], a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ] ];
const norm = ( a ) => mul( a, 1 / ( Math.hypot( ...a ) || 1 ) );
const lerp = ( a, b, t ) => add( a, mul( sub( b, a ), t ) );

// One pose of a kind, as arrays. Built twice (the two poses) by the same steps, so the vertices match
// one for one and the morph is their difference.
function buildPose( pose, gear, point, { body = true } = {} ) {

	const J = jointsOf( pose );
	// a gear point: the pose's own, else the kind's other pose's (so it stays put), else a joint
	const G = ( name, s = 1 ) => J( name, s ) || point( name, s );
	const pos = [], nrm = [], part = [], head = [], index = [];
	let headMode = 0;
	const vert = ( p, n, pt ) => {

		pos.push( ...p ); nrm.push( ...n ); part.push( pt ); head.push( headMode );
		return pos.length / 3 - 1;

	};

	// a tapered tube from a to b: rings of n, radii [ across, depth ] at each end
	const tube = ( a, b, rA, rB, pt, n = 6, capA = false, capB = false ) => {

		const ax = norm( sub( b, a ) );
		let across = cross( ax, [ 0, 0, 1 ] );
		if ( Math.hypot( ...across ) < 0.3 ) across = cross( ax, [ 0, 1, 0 ] );
		across = norm( across );
		const depth = norm( cross( across, ax ) );
		const base = pos.length / 3;
		for ( const [ c, r ] of [ [ a, rA ], [ b, rB ] ] ) for ( let k = 0; k < n; k ++ ) {

			const ang = ( k / n ) * Math.PI * 2 + Math.PI / n;
			const d = add( mul( across, Math.cos( ang ) ), mul( depth, Math.sin( ang ) ) );
			vert( add( c, add( mul( across, Math.cos( ang ) * r[ 0 ] ), mul( depth, Math.sin( ang ) * r[ 1 ] ) ) ), d, pt );

		}

		for ( let k = 0; k < n; k ++ ) {

			const i0 = base + k, i1 = base + ( k + 1 ) % n, j0 = base + n + k, j1 = base + n + ( k + 1 ) % n;
			index.push( i0, i1, j0, i1, j1, j0 );

		}

		if ( capA ) {

			const c = vert( a, mul( ax, - 1 ), pt );
			for ( let k = 0; k < n; k ++ ) index.push( c, base + ( k + 1 ) % n, base + k );

		}

		if ( capB ) {

			const c = vert( b, ax, pt );
			for ( let k = 0; k < n; k ++ ) index.push( c, base + n + k, base + n + ( k + 1 ) % n );

		}

	};

	// a box centred on c, its axes: along (unit, length l), up-ish (unit, h), across (w)
	const box = ( c, along, up, l, h, w, pt ) => {

		const a = norm( along ), side = norm( cross( a, up ) ), u = norm( cross( side, a ) );
		const P = ( i, j, k ) => add( c, add( mul( a, i * l / 2 ), add( mul( u, j * h / 2 ), mul( side, k * w / 2 ) ) ) );
		const faces = [
			[ [ 1, - 1, - 1 ], [ 1, 1, - 1 ], [ 1, 1, 1 ], [ 1, - 1, 1 ], a ],
			[ [ - 1, - 1, 1 ], [ - 1, 1, 1 ], [ - 1, 1, - 1 ], [ - 1, - 1, - 1 ], mul( a, - 1 ) ],
			[ [ - 1, 1, - 1 ], [ - 1, 1, 1 ], [ 1, 1, 1 ], [ 1, 1, - 1 ], u ],
			[ [ - 1, - 1, 1 ], [ - 1, - 1, - 1 ], [ 1, - 1, - 1 ], [ 1, - 1, 1 ], mul( u, - 1 ) ],
			[ [ - 1, - 1, 1 ], [ 1, - 1, 1 ], [ 1, 1, 1 ], [ - 1, 1, 1 ], side ],
			[ [ 1, - 1, - 1 ], [ - 1, - 1, - 1 ], [ - 1, 1, - 1 ], [ 1, 1, - 1 ], mul( side, - 1 ) ],
		];
		for ( const [ p0, p1, p2, p3, n ] of faces ) {

			const q = [ p0, p1, p2, p3 ].map( ( p ) => vert( P( ...p ), n, pt ) );
			// wind toward n
			const e = cross( sub( pos.slice( q[ 1 ] * 3, q[ 1 ] * 3 + 3 ), pos.slice( q[ 0 ] * 3, q[ 0 ] * 3 + 3 ) ), sub( pos.slice( q[ 2 ] * 3, q[ 2 ] * 3 + 3 ), pos.slice( q[ 0 ] * 3, q[ 0 ] * 3 + 3 ) ) );
			if ( e[ 0 ] * n[ 0 ] + e[ 1 ] * n[ 1 ] + e[ 2 ] * n[ 2 ] >= 0 ) index.push( q[ 0 ], q[ 1 ], q[ 2 ], q[ 0 ], q[ 2 ], q[ 3 ] );
			else index.push( q[ 0 ], q[ 2 ], q[ 1 ], q[ 0 ], q[ 3 ], q[ 2 ] );

		}

	};

	// an ellipsoid (a glove, a ball, a head's parts)
	const blob = ( c, r, pt, W = 7, H = 4 ) => {

		const first = pos.length / 3;
		for ( let j = 0; j <= H; j ++ ) for ( let i = 0; i < W; i ++ ) {

			const th = j / H * Math.PI, ph = i / W * Math.PI * 2;
			const d = [ Math.sin( th ) * Math.cos( ph ), Math.cos( th ), Math.sin( th ) * Math.sin( ph ) ];
			vert( add( c, [ d[ 0 ] * r[ 0 ], d[ 1 ] * r[ 1 ], d[ 2 ] * r[ 2 ] ] ), d, pt );

		}

		for ( let j = 0; j < H; j ++ ) for ( let i = 0; i < W; i ++ ) {

			const a = first + j * W + i, b = first + j * W + ( i + 1 ) % W, cc = a + W, d = b + W;
			if ( j > 0 ) index.push( a, b, cc );
			if ( j < H - 1 ) index.push( b, d, cc );

		}

	};

	// ---- the body
	const hc = J( 'head' );
	if ( ! body ) {

		headMode = 1;
		for ( const g of gear ) if ( GEAR[ g ]?.head ) GEAR[ g ].build( { J: G, hc, tube, box, blob } );
		headMode = 0;
		for ( const g of gear ) if ( GEAR[ g ] && ! GEAR[ g ].head ) GEAR[ g ].build( { J: G, hc, tube, box, blob } );
		return { pos, nrm, part, head, index, hc };

	}

	const pelvis = J( 'pelvis' ), chest = J( 'chest' ), neck = J( 'neck' );
	tube( add( pelvis, [ 0, - 0.06, 0 ] ), chest, [ 0.17, 0.12 ], [ 0.2, 0.125 ], PART.torso, 8, true );
	tube( chest, neck, [ 0.2, 0.125 ], [ 0.065, 0.06 ], PART.torso, 8 );
	tube( J( 'shoulder', - 1 ), J( 'shoulder', 1 ), [ 0.07, 0.07 ], [ 0.07, 0.07 ], PART.sleeve, 6, true, true );
	for ( const s of [ - 1, 1 ] ) {

		tube( J( 'shoulder', s ), J( 'elbow', s ), [ 0.064, 0.064 ], [ 0.054, 0.054 ], PART.sleeve );
		tube( J( 'elbow', s ), J( 'wrist', s ), [ 0.054, 0.054 ], [ 0.045, 0.045 ], PART.sleeve, 6, false, true );
		// the hand: a mitten, flattened across the palm
		tube( J( 'wrist', s ), J( 'hand', s ), [ 0.034, 0.021 ], [ 0.03, 0.017 ], PART.skin, 5, false, true );
		tube( J( 'hip', s ), J( 'knee', s ), [ 0.09, 0.09 ], [ 0.064, 0.064 ], PART.pants, 6, true );
		tube( J( 'knee', s ), J( 'ankle', s ), [ 0.062, 0.062 ], [ 0.05, 0.05 ], PART.pants );
		tube( add( J( 'ankle', s ), [ 0, - 0.03, 0.04 ] ), J( 'toe', s ), [ 0.052, 0.046 ], [ 0.044, 0.03 ], PART.shoe, 5, true, true );

	}

	// ---- the head (turns on its own: its vertices are flagged), a nose, a cap's brim, a ponytail
	headMode = 1;
	tube( neck, add( neck, [ 0, 0.08, 0 ] ), [ 0.056, 0.052 ], [ 0.05, 0.048 ], PART.skin, 6 );
	blob( hc, [ 0.083, 0.105, 0.1 ], PART.head, 10, 7 );
	tube( add( hc, [ 0, 0.005, - 0.09 ] ), add( hc, [ 0, - 0.02, - 0.118 ] ), [ 0.014, 0.012 ], [ 0.01, 0.008 ], PART.skin, 4, false, true );
	const brim = [ [ - 0.08, 0.055, - 0.05 ], [ 0.08, 0.055, - 0.05 ], [ 0.072, 0.038, - 0.168 ], [ - 0.072, 0.038, - 0.168 ] ].map( ( o ) => vert( add( hc, o ), [ 0, 1, 0 ], PART.brim ) );
	index.push( brim[ 0 ], brim[ 2 ], brim[ 1 ], brim[ 0 ], brim[ 3 ], brim[ 2 ] );
	// (under the brim too, so it has a dark underside from below)
	const under = [ [ - 0.08, 0.053, - 0.05 ], [ 0.08, 0.053, - 0.05 ], [ 0.072, 0.036, - 0.168 ], [ - 0.072, 0.036, - 0.168 ] ].map( ( o ) => vert( add( hc, o ), [ 0, - 1, 0 ], PART.brim ) );
	index.push( under[ 0 ], under[ 1 ], under[ 2 ], under[ 0 ], under[ 2 ], under[ 3 ] );
	tube( add( hc, [ 0, 0.02, 0.085 ] ), add( hc, [ 0, - 0.15, 0.13 ] ), [ 0.03, 0.025 ], [ 0.018, 0.015 ], PART.hair, 5, false, true );
	for ( const g of gear ) if ( GEAR[ g ]?.head ) GEAR[ g ].build( { J: G, hc, tube, box, blob } );
	headMode = 0;

	// ---- the gear
	for ( const g of gear ) if ( GEAR[ g ] && ! GEAR[ g ].head ) GEAR[ g ].build( { J: G, hc, tube, box, blob } );

	return { pos, nrm, part, head, index, hc };

}

// The gear, from the pose's joints and named points
const GEAR = {
	// a 400 mm f/2.8 on the camera, its hood, the foot down to the monopod; a rain cover over the lot
	// (shown on the wet night); a strap
	lens400: { build( { J, tube, box } ) {

		const cam = J( 'cam' ), tip = J( 'lensTip' ), dir = norm( sub( tip, cam ) );
		const front = add( cam, mul( dir, 0.06 ) ), mid = lerp( front, tip, 0.24 ), hoodAt = lerp( front, tip, 0.74 );
		box( cam, dir, [ 0, 1, 0 ], 0.09, 0.12, 0.15, PART.dark );
		box( add( cam, [ 0.055, 0.035, 0.0 ] ), dir, [ 0, 1, 0 ], 0.06, 0.05, 0.05, PART.dark );
		tube( front, mid, [ 0.045, 0.045 ], [ 0.058, 0.058 ], PART.lens, 8, true );
		tube( mid, hoodAt, [ 0.064, 0.064 ], [ 0.07, 0.07 ], PART.lens, 8 );
		tube( hoodAt, tip, [ 0.085, 0.085 ], [ 0.088, 0.088 ], PART.dark, 8, false, true );
		tube( lerp( front, tip, 0.35 ), J( 'monoTop' ), [ 0.018, 0.018 ], [ 0.018, 0.018 ], PART.dark, 4 );
		tube( J( 'monoTop' ), J( 'monoFoot' ), [ 0.014, 0.014 ], [ 0.011, 0.011 ], PART.metal, 5, true, true );
		// the rain cover: a loose sleeve from behind the body to the hood
		tube( add( cam, mul( dir, - 0.08 ) ), hoodAt, [ 0.105, 0.1 ], [ 0.09, 0.09 ], PART.cover, 8, true );

	} },
	// a 70-200 on the body (lens0 -> lens1: it comes off in the lens change)
	lensShort: { build( { J, tube, box } ) {

		const cam = J( 'cam' ), l0 = J( 'lens0' ), l1 = J( 'lens1' ), dir = norm( sub( l1, l0 ) );
		box( cam, sub( J( 'lens0' ), cam ), [ 0, 1, 0 ], 0.09, 0.12, 0.15, PART.dark );
		tube( l0, lerp( l0, l1, 0.8 ), [ 0.04, 0.04 ], [ 0.043, 0.043 ], PART.lens, 8, true );
		tube( lerp( l0, l1, 0.8 ), add( l1, mul( dir, 0.02 ) ), [ 0.05, 0.05 ], [ 0.055, 0.055 ], PART.dark, 8, false, true );

	} },
	// a second body slung at his right hip, its strap over the left shoulder
	body2: { build( { J, tube, box } ) {

		const hip = add( J( 'hip', 1 ), [ 0.09, 0.05, - 0.02 ] );
		box( hip, [ 0, - 1, 0.2 ], [ 0, 0, - 1 ], 0.14, 0.1, 0.09, PART.dark );
		tube( add( hip, [ 0, - 0.1, - 0.02 ] ), add( hip, [ 0, - 0.2, - 0.04 ] ), [ 0.04, 0.04 ], [ 0.042, 0.042 ], PART.dark, 6, false, true );
		tube( add( J( 'shoulder', - 1 ), [ 0, 0.05, 0 ] ), hip, [ 0.012, 0.018 ], [ 0.012, 0.018 ], PART.strap, 4 );

	} },
	// the credential on its lanyard over the chest (the World Series press pass)
	credential: { build( { J, tube, box } ) {

		const n = J( 'neck' ), c = J( 'chest' );
		const card = add( lerp( c, J( 'pelvis' ), 0.22 ), [ 0, 0, - 0.14 ] );
		for ( const s of [ - 1, 1 ] ) tube( add( n, [ 0.05 * s, 0.0, - 0.03 ] ), add( card, [ 0.02 * s, 0.05, 0.0 ] ), [ 0.006, 0.006 ], [ 0.006, 0.006 ], PART.strap, 3 );
		box( card, [ 1, 0, 0 ], [ 0, 1, 0.1 ], 0.075, 0.105, 0.006, PART.card );

	} },
	// headsets: the cups, the band over the top, the mic's boom
	headset: { head: true, build( { hc, tube, box } ) {

		for ( const s of [ - 1, 1 ] ) box( add( hc, [ 0.088 * s, 0.0, 0.0 ] ), [ 1, 0, 0 ], [ 0, 1, 0 ], 0.03, 0.07, 0.065, PART.dark );
		tube( add( hc, [ - 0.09, 0.03, 0 ] ), add( hc, [ 0, 0.112, 0 ] ), [ 0.01, 0.014 ], [ 0.01, 0.014 ], PART.dark, 4 );
		tube( add( hc, [ 0, 0.112, 0 ] ), add( hc, [ 0.09, 0.03, 0 ] ), [ 0.01, 0.014 ], [ 0.01, 0.014 ], PART.dark, 4 );
		tube( add( hc, [ - 0.09, - 0.02, - 0.02 ] ), add( hc, [ - 0.04, - 0.07, - 0.1 ] ), [ 0.005, 0.005 ], [ 0.008, 0.008 ], PART.dark, 3, false, true );

	} },
	headphones: { head: true, build( { hc, tube, blob } ) {

		for ( const s of [ - 1, 1 ] ) blob( add( hc, [ 0.092 * s, - 0.005, 0.005 ] ), [ 0.03, 0.05, 0.05 ], PART.dark, 6, 3 );
		tube( add( hc, [ - 0.1, 0.04, 0.01 ] ), add( hc, [ 0, 0.118, 0.01 ] ), [ 0.012, 0.018 ], [ 0.012, 0.018 ], PART.dark, 4 );
		tube( add( hc, [ 0, 0.118, 0.01 ] ), add( hc, [ 0.1, 0.04, 0.01 ] ), [ 0.012, 0.018 ], [ 0.012, 0.018 ], PART.dark, 4 );

	} },
	// the field mixer on his knees, its screen lit
	mixer: { build( { J, box } ) {

		const m = J( 'mixer' );
		box( m, [ 1, 0, 0 ], [ 0, 1, 0.3 ], 0.26, 0.08, 0.2, PART.dark );
		box( add( m, [ 0, 0.042, 0.02 ] ), [ 1, 0, 0 ], [ 0, 1, 0.3 ], 0.08, 0.004, 0.05, PART.screen );

	} },
	// a fielder's glove on the left hand
	glove: { build( { J, blob, tube } ) {

		const h = J( 'hand', - 1 ), w = J( 'wrist', - 1 ), d = norm( sub( h, w ) );
		blob( add( h, mul( d, 0.05 ) ), [ 0.07, 0.1, 0.05 ], PART.leather, 7, 4 );
		tube( w, add( w, mul( d, 0.04 ) ), [ 0.05, 0.035 ], [ 0.055, 0.04 ], PART.leather, 5 );

	} },
	kidGlove: { build( { J, blob } ) {

		const h = J( 'hand', - 1 ), w = J( 'wrist', - 1 ), d = norm( sub( h, w ) );
		blob( add( h, mul( d, 0.04 ) ), [ 0.06, 0.085, 0.045 ], PART.leather, 7, 4 );

	} },
	// a baseball in the right hand
	ball: { build( { J, blob } ) {

		blob( add( J( 'hand', 1 ), [ - 0.01, 0.03, - 0.02 ] ), [ 0.037, 0.037, 0.037 ], PART.white, 6, 4 );

	} },
	// a bat by the handle in the right hand, the barrel down and forward
	bat: { build( { J, tube } ) {

		const h = J( 'hand', 1 ), w = J( 'wrist', 1 ), fw = norm( sub( h, w ) );
		// along the forearm's line, bent down toward the ground
		const d = norm( add( fw, [ 0, - 0.6, - 0.5 ] ) );
		const knob = add( h, mul( d, - 0.04 ) );
		tube( knob, add( knob, mul( d, 0.3 ) ), [ 0.013, 0.013 ], [ 0.016, 0.016 ], PART.wood, 5, true );
		tube( add( knob, mul( d, 0.3 ) ), add( knob, mul( d, 0.86 ) ), [ 0.016, 0.016 ], [ 0.032, 0.032 ], PART.wood, 6, false, true );

	} },
	// a phone in the hands, its screen lit toward him
	phone: { build( { J, box } ) {

		const p = J( 'phone' );
		box( p, [ 1, 0, 0 ], [ 0, 0.4, 1 ], 0.055, 0.012, 0.105, PART.dark );
		box( add( p, [ 0, 0.006, 0.003 ] ), [ 1, 0, 0 ], [ 0, 0.4, 1 ], 0.045, 0.004, 0.08, PART.screen );

	} },
	// a two-way radio clipped at the left chest, its coiled lead up to the ear
	radio: { build( { J, box, tube } ) {

		const c = add( J( 'chest' ), [ - 0.11, - 0.05, - 0.11 ] );
		box( c, [ 0, 1, 0 ], [ 0, 0, - 1 ], 0.1, 0.03, 0.05, PART.dark );
		tube( add( c, [ 0, 0.05, 0 ] ), add( c, [ - 0.01, 0.09, 0 ] ), [ 0.005, 0.005 ], [ 0.005, 0.005 ], PART.dark, 3 );

	} },
	// a duty belt: the belt, the holster, the cuff case
	belt: { build( { J, tube, box } ) {

		const p = J( 'pelvis' );
		tube( add( p, [ 0, 0.02, 0 ] ), add( p, [ 0, 0.08, 0 ] ), [ 0.185, 0.13 ], [ 0.185, 0.13 ], PART.dark, 8 );
		box( add( J( 'hip', 1 ), [ 0.1, - 0.02, 0.02 ] ), [ 0, - 1, 0 ], [ 0, 0, - 1 ], 0.2, 0.06, 0.06, PART.dark );
		box( add( J( 'hip', - 1 ), [ - 0.08, 0.04, - 0.05 ] ), [ 0, - 1, 0 ], [ 0, 0, - 1 ], 0.08, 0.05, 0.05, PART.dark );

	} },
	// a TV camera's head on its fluid head (the pivot 1.42 m up): the body, a long ENG zoom and its hood,
	// the viewfinder at the back toward the operator's eye, the pan bars back to his hands, the tally
	// light, a black rain cover over the lot on the wet night
	tvCamera: { head: true, build( { hc, tube, box } ) {

		const o = add( hc, [ 0, - 0.11, 0.01 ] );
		const at = ( x, y, z ) => add( o, [ x, y, z ] );
		const fw = [ 0, 0, - 1 ], up = [ 0, 1, 0 ];
		box( at( 0, - 0.05, 0.03 ), fw, up, 0.2, 0.09, 0.19, PART.dark );
		box( at( 0, 0.12, 0.08 ), fw, up, 0.46, 0.25, 0.19, PART.camGrey );
		box( at( 0, 0.12, 0.08 ), fw, up, 0.3, 0.26, 0.2, PART.dark );
		tube( at( 0, 0.12, - 0.15 ), at( 0, 0.12, - 0.58 ), [ 0.07, 0.07 ], [ 0.08, 0.08 ], PART.dark, 10, true );
		tube( at( 0, 0.12, - 0.58 ), at( 0, 0.12, - 0.71 ), [ 0.1, 0.095 ], [ 0.11, 0.105 ], PART.dark, 10, false, true );
		// the zoom's grey barrel band, the lens's side grip
		tube( at( 0, 0.12, - 0.3 ), at( 0, 0.12, - 0.4 ), [ 0.083, 0.083 ], [ 0.083, 0.083 ], PART.camGrey, 10 );
		box( at( 0.1, 0.1, - 0.24 ), fw, up, 0.14, 0.12, 0.05, PART.dark );
		box( at( 0.0, 0.32, 0.2 ), fw, up, 0.18, 0.15, 0.2, PART.dark );
		box( at( 0.0, 0.32, 0.31 ), fw, up, 0.04, 0.13, 0.17, PART.screen );
		tube( at( 0.1, 0.0, 0.18 ), at( 0.38, - 0.37, 0.38 ), [ 0.016, 0.016 ], [ 0.016, 0.016 ], PART.metal, 5, false, true );
		tube( at( - 0.1, 0.0, 0.18 ), at( - 0.16, - 0.13, 0.26 ), [ 0.016, 0.016 ], [ 0.016, 0.016 ], PART.metal, 5, false, true );
		box( at( 0.0, 0.265, - 0.13 ), fw, up, 0.04, 0.03, 0.05, PART.tally );
		tube( at( 0, 0.13, 0.36 ), at( 0, 0.12, - 0.6 ), [ 0.2, 0.2 ], [ 0.12, 0.12 ], PART.cover, 10, true );

	} },
	// the bigger rig at the dugouts' far ends: a box lens (the long Canon, off-white) on the body
	tvCameraBox: { head: true, build( { hc, tube, box } ) {

		const o = add( hc, [ 0, - 0.11, 0.01 ] );
		const at = ( x, y, z ) => add( o, [ x, y, z ] );
		const fw = [ 0, 0, - 1 ], up = [ 0, 1, 0 ];
		box( at( 0, - 0.05, 0.03 ), fw, up, 0.24, 0.09, 0.22, PART.dark );
		box( at( 0, 0.12, 0.14 ), fw, up, 0.38, 0.26, 0.2, PART.dark );
		box( at( 0, 0.14, - 0.3 ), fw, up, 0.56, 0.27, 0.25, PART.camGrey );
		tube( at( 0, 0.14, - 0.58 ), at( 0, 0.14, - 0.7 ), [ 0.12, 0.12 ], [ 0.125, 0.125 ], PART.dark, 10, false, true );
		box( at( 0.0, 0.34, 0.24 ), fw, up, 0.2, 0.17, 0.24, PART.dark );
		box( at( 0.0, 0.34, 0.36 ), fw, up, 0.04, 0.15, 0.2, PART.screen );
		tube( at( 0.12, 0.0, 0.22 ), at( 0.38, - 0.37, 0.38 ), [ 0.016, 0.016 ], [ 0.016, 0.016 ], PART.metal, 5, false, true );
		tube( at( - 0.12, 0.0, 0.22 ), at( - 0.16, - 0.13, 0.28 ), [ 0.016, 0.016 ], [ 0.016, 0.016 ], PART.metal, 5, false, true );
		box( at( 0.0, 0.29, - 0.02 ), fw, up, 0.04, 0.03, 0.05, PART.tally );
		tube( at( 0, 0.15, 0.36 ), at( 0, 0.14, - 0.55 ), [ 0.22, 0.2 ], [ 0.19, 0.18 ], PART.cover, 10, true );

	} },
	// a rake: the handle down from his hands, the head across at the ground
	rakeTool: { build( { J, tube, box } ) {

		const a = J( 'rake0' ), b = J( 'rake1' );
		tube( a, b, [ 0.016, 0.016 ], [ 0.016, 0.016 ], PART.wood, 5, true, true );
		box( b, [ 1, 0, 0 ], [ 0, 1, 0 ], 0.62, 0.05, 0.04, PART.metal );

	} },
};

export function kindGeometry( key ) {

	const [ A, B, gear, opts = {} ] = KINDS[ key ];
	const JA = jointsOf( A ), JB = jointsOf( B );
	const a = buildPose( A, gear, ( n, s ) => JB( n, s ), opts );
	const b = buildPose( B, gear, ( n, s ) => JA( n, s ), opts );
	if ( a.pos.length !== b.pos.length ) throw new Error( `RailFigures: ${ key } poses don't match` );
	const n = a.pos.length / 3;
	// packed to stay within the vertex buffers a pipeline may have (8, with the instances' matrices):
	// aMorph ( the move to the second pose, the part ), aMorphN ( the normal's, the head flag ), aHead
	// ( the head's centre: its pivot; the head is rigid, so it moves by its own vertices' morph )
	const morph = new Float32Array( n * 4 ), morphN = new Float32Array( n * 4 ), headA = new Float32Array( n * 3 );
	for ( let i = 0; i < n; i ++ ) {

		for ( let k = 0; k < 3; k ++ ) {

			morph[ i * 4 + k ] = b.pos[ i * 3 + k ] - a.pos[ i * 3 + k ];
			morphN[ i * 4 + k ] = b.nrm[ i * 3 + k ] - a.nrm[ i * 3 + k ];

		}

		morph[ i * 4 + 3 ] = a.part[ i ];
		morphN[ i * 4 + 3 ] = a.head[ i ];
		headA.set( a.hc, i * 3 );

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( a.pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( a.nrm, 3 ) );
	g.setAttribute( 'aMorph', new Float32BufferAttribute( morph, 4 ) );
	g.setAttribute( 'aMorphN', new Float32BufferAttribute( morphN, 4 ) );
	g.setAttribute( 'aHead', new Float32BufferAttribute( headA, 3 ) );
	g.setIndex( a.index );
	g.computeBoundingSphere();
	g.boundingSphere.radius += 1;
	return g;

}

function railMaterial() {

	const m = standard( {
		name: 'rail-figures', roughness: 0.75, side: 'double',
		attributes: { aMorph: 'vec4f', aMorphN: 'vec4f', aHead: 'vec3f', aWho: 'vec4f', aLook: 'vec4f' },
		varyings: { vPart: 'f32', vWho: 'vec4f', vLook: 'vec4f', vLocal: 'vec3f', vHead: 'vec3f' },
		vertex: /* wgsl */`
	// who: x the outfit, y a seed, z wet (0..1), w the morph toward the second pose
	// look: x the head's turn, y its nod (radians), z the flags, w how stout (0..1)
	let who = v.aWho;
	let look = v.aLook;
	let m = who.w;
	let flags = u32( look.z + 0.5 );
	var p = v.position + v.aMorph.xyz * m;
	var n = normalize( v.normal + v.aMorphN.xyz * m + vec3f( 1e-5 ) );
	// the build: a padded jacket stands off the body; a stout man thicker in the middle
	let pt = i32( v.aMorph.w + 0.5 );
	if ( pt == 0 || pt == 1 || pt == 6 ) { p += v.normal * ( 0.012 + 0.03 * look.w * select( 0.4, 1.0, pt == 0 ) ); }
	// folded-away pieces: the rain cover when it's dry, the gear when he's empty-handed, the ponytail
	var gone = false;
	if ( pt == 13 && ( flags & 8u ) == 0u ) { gone = true; }
	if ( pt >= 8 && pt != 13 && ( flags & 32u ) != 0u ) { gone = true; }
	if ( pt == 7 && ( flags & 4u ) == 0u ) { gone = true; }
	// the head turns (about the neck) and nods on its own
	o.vHead = v.position - v.aHead;
	if ( v.aMorphN.w > 0.5 ) {
		let hc = v.aHead + v.aMorph.xyz * m;
		let piv = hc - vec3f( 0.0, 0.11, -0.01 );
		let cy = cos( look.x ); let sy = sin( look.x ); let cp = cos( look.y ); let sp = sin( look.y );
		var r = p - piv;
		r = vec3f( r.x, r.y * cp + r.z * sp, - r.y * sp + r.z * cp );
		r = vec3f( r.x * cy + r.z * sy, r.y, - r.x * sy + r.z * cy );
		p = piv + r;
		var nn = vec3f( n.x, n.y * cp + n.z * sp, - n.y * sp + n.z * cp );
		n = vec3f( nn.x * cy + nn.z * sy, nn.y, - nn.x * sy + nn.z * cy );
	}
	// breathing, a little weight shifting
	let seed = who.y;
	p.x += sin( frame.time * ( 0.45 + 0.3 * seed ) + seed * 40.0 ) * 0.008 * max( p.y - 0.5, 0.0 );
	if ( gone ) { p = vec3f( 0.0, 0.9, 0.0 ); }
	o.vPart = v.aMorph.w;
	o.vWho = who;
	o.vLook = look;
	o.vLocal = p;
	v.position = p;
	v.normal = n;
`,
		surface: /* wgsl */`
	let part = i32( in.vs.vPart + 0.01 );
	let who = in.vs.vWho;
	let o = i32( who.x + 0.5 );
	let seed = who.y;
	let wet = who.z;
	let flags = u32( in.vs.vLook.z + 0.5 );
	let L = in.vs.vLocal;
	let hd = in.vs.vHead;
	let h = fract( sin( vec4f( seed * 12.9898, seed * 78.233, seed * 39.346, seed * 11.135 ) ) * 43758.5453 );
	let red = vec3f( 0.42, 0.018, 0.028 );
	let navy = vec3f( 0.012, 0.02, 0.06 );
	let white = vec3f( 0.72, 0.71, 0.68 );
	var torso = vec3f( 0.02 );
	var sleeve = vec3f( -1.0 );
	var pants = vec3f( 0.03, 0.03, 0.035 );
	var capC = vec3f( 0.02 );
	var shoe = vec3f( 0.02 );
	var rough = 0.8;
	var capped = ( flags & 2u ) != 0u;
	let hood = ( flags & 1u ) != 0u;
	let beanie = ( flags & 16u ) != 0u;
	var helmet = ( flags & 256u ) != 0u;
	var pin = false;
	var hiVis = false;
	var e = vec3f( 0.0 );
	// ---- who they are
	if ( o == 0 ) {
		// a photographer: a dark parka (black, navy, charcoal, olive, a tan field coat), khakis, black
		// trousers or jeans, a beanie or a ball cap
		torso = vec3f( 0.018, 0.018, 0.02 );
		if ( h.x > 0.45 ) { torso = vec3f( 0.015, 0.022, 0.05 ); }
		if ( h.x > 0.65 ) { torso = vec3f( 0.06, 0.06, 0.065 ); }
		if ( h.x > 0.8 ) { torso = vec3f( 0.06, 0.065, 0.035 ); }
		if ( h.x > 0.92 ) { torso = vec3f( 0.22, 0.17, 0.1 ); }
		pants = select( select( vec3f( 0.28, 0.23, 0.15 ), vec3f( 0.025 ), h.y > 0.5 ), vec3f( 0.04, 0.06, 0.11 ), h.y > 0.8 );
		capC = select( vec3f( 0.02 ), vec3f( 0.03, 0.04, 0.09 ), h.z > 0.5 );
		shoe = select( vec3f( 0.02 ), vec3f( 0.12, 0.08, 0.05 ), h.w > 0.6 );
		rough = 0.55;
	}
	if ( o == 1 ) { torso = vec3f( 0.012 ); pants = vec3f( 0.02, 0.022, 0.03 ); capC = vec3f( 0.01 ); rough = 0.45; }
	if ( o == 2 ) { torso = vec3f( 0.16, 0.16, 0.17 ); pants = vec3f( 0.02, 0.025, 0.05 ); rough = 0.5; }
	if ( o == 3 ) { torso = red; pants = white; capC = red; rough = 0.55; }
	if ( o == 4 ) { torso = white; sleeve = red; pants = white; pin = true; helmet = true; capC = red; }
	if ( o == 5 ) { torso = vec3f( 0.28, 0.28, 0.29 ); sleeve = navy; pants = vec3f( 0.28, 0.28, 0.29 ); helmet = true; capC = navy; }
	if ( o == 6 ) { torso = vec3f( 0.02, 0.03, 0.08 ); pants = vec3f( 0.02, 0.028, 0.07 ); capC = vec3f( 0.02, 0.03, 0.08 ); rough = 0.4; shoe = vec3f( 0.05, 0.04, 0.03 ); }
	if ( o == 7 ) { torso = vec3f( 0.015, 0.022, 0.06 ); pants = vec3f( 0.3, 0.25, 0.17 ); capC = red; rough = 0.5; shoe = vec3f( 0.08, 0.05, 0.03 ); }
	if ( o == 8 ) { torso = vec3f( 0.62, 0.55, 0.02 ); pants = vec3f( 0.02 ); capC = vec3f( 0.015 ); hiVis = true; rough = 0.5; }
	if ( o == 9 ) { torso = vec3f( 0.01, 0.013, 0.035 ); pants = vec3f( 0.012, 0.015, 0.04 ); capC = vec3f( 0.01, 0.012, 0.03 ); rough = 0.5; }
	if ( o == 10 ) { torso = red; pants = vec3f( 0.05, 0.08, 0.16 ); capC = red; rough = 0.85; }
	if ( o == 11 ) {
		torso = select( select( red, vec3f( 0.015 ), h.x > 0.55 ), vec3f( 0.5, 0.49, 0.46 ), h.x > 0.85 );
		pants = select( vec3f( 0.04, 0.06, 0.12 ), vec3f( 0.28, 0.22, 0.15 ), h.y > 0.7 );
		capC = red;
	}
	if ( sleeve.x < 0.0 ) { sleeve = torso; }
	// skin and hair
	let si = h.w;
	var skin = vec3f( 0.55, 0.34, 0.23 );
	if ( si > 0.55 ) { skin = vec3f( 0.44, 0.26, 0.16 ); }
	if ( si > 0.75 ) { skin = vec3f( 0.25, 0.13, 0.07 ); }
	if ( si > 0.88 ) { skin = vec3f( 0.12, 0.065, 0.04 ); }
	var hair = select( select( vec3f( 0.02, 0.015, 0.01 ), vec3f( 0.12, 0.07, 0.03 ), h.z > 0.55 ), vec3f( 0.3, 0.28, 0.26 ), h.z > 0.85 );
	if ( o == 3 ) { hair = select( vec3f( 0.16, 0.09, 0.04 ), vec3f( 0.35, 0.24, 0.1 ), h.z > 0.5 ); }
	var c = torso;
	if ( part == 0 ) {
		// the Phillies' script across a ball girl's jacket; a hi-vis jacket's silver bands; FOX on a
		// camera operator's back; a jacket's zip down the front
		if ( o == 3 && L.y > 1.18 && L.y < 1.28 && L.z < -0.04 ) { c = mix( c, white, 0.8 ); }
		if ( hiVis && ( abs( L.y - 1.05 ) < 0.022 || abs( L.y - 1.2 ) < 0.022 ) ) { c = vec3f( 0.55 ); rough = 0.3; }
		if ( hiVis ) { e = c * 0.06; }
		if ( o == 1 && L.z > 0.05 && abs( L.y - 1.28 ) < 0.045 && abs( L.x ) < 0.08 ) { c = vec3f( 0.7 ); }
		if ( ( o == 0 || o == 6 || o == 7 || o == 9 ) && L.z < -0.06 && abs( L.x ) < 0.006 ) { c = c * 0.5 + vec3f( 0.03 ); }
		// a photographer's numbered vest over his coat
		if ( ( flags & 128u ) != 0u ) { c = mix( vec3f( 0.04, 0.09, 0.25 ), vec3f( 0.3, 0.02, 0.03 ), step( 0.5, h.y ) ); rough = 0.6; }
		// police: the badge, the shoulder patch
		if ( o == 9 && L.z < -0.08 && abs( L.x + 0.09 ) < 0.02 && abs( L.y - 1.3 ) < 0.025 ) { c = vec3f( 0.6, 0.5, 0.2 ); rough = 0.2; }
		if ( o == 4 || o == 5 ) { if ( L.z < -0.05 && abs( L.x ) < 0.008 ) { c = c * 0.7; } }
	}
	if ( part == 6 ) { c = sleeve; }
	if ( part == 1 ) {
		c = pants;
		rough = 0.85;
		if ( pin ) { c = c * ( 1.0 - 0.45 * step( 0.82, fract( ( L.x + L.z ) * 55.0 ) ) ); }
		// the bat boys' socks, high
		if ( o == 4 && L.y < 0.36 ) { c = red; }
		if ( o == 5 && L.y < 0.36 ) { c = navy; }
		// the crew's knees muddy
		if ( o == 6 && L.y < 0.55 ) { c = mix( c, vec3f( 0.18, 0.08, 0.04 ), 0.4 ); }
		// police: the stripe down the trouser leg
		if ( o == 9 && abs( abs( L.x ) - 0.19 ) < 0.012 ) { c = vec3f( 0.03, 0.04, 0.1 ); }
	}
	if ( part == 2 ) { c = skin; rough = 0.6; }
	if ( part == 3 ) {
		c = skin; rough = 0.6;
		// the face: brows, eyes, a mouth; his hair round the back and top
		if ( hd.z < -0.07 && abs( abs( hd.x ) - 0.032 ) < 0.014 && abs( hd.y - 0.012 ) < 0.008 ) { c = skin * 0.35; }
		if ( hd.z < -0.07 && abs( abs( hd.x ) - 0.032 ) < 0.02 && abs( hd.y - 0.03 ) < 0.006 ) { c = mix( c, hair, 0.8 ); }
		if ( hd.z < -0.08 && abs( hd.x ) < 0.022 && abs( hd.y + 0.05 ) < 0.006 ) { c = skin * vec3f( 0.7, 0.5, 0.5 ); }
		let bald = h.z > 0.93 && o != 3;
		if ( hd.y > 0.02 - 0.07 * smoothstep( -0.02, 0.07, hd.z ) && ! bald ) { c = hair; rough = 0.7; }
		// a beard on some of the men of the press and the crew
		if ( ( o == 0 || o == 6 || o == 2 ) && h.y > 0.72 && hd.y < -0.03 && hd.z < 0.02 && ! ( hd.z < -0.08 && abs( hd.x ) < 0.022 && abs( hd.y + 0.05 ) < 0.006 ) ) { c = mix( c, hair, 0.85 ); }
		if ( capped && hd.y > 0.03 ) { c = capC; rough = 0.8; }
		if ( beanie && hd.y > 0.0 ) { c = select( vec3f( 0.02 ), select( red, navy, h.x > 0.5 ), h.y > 0.3 ); rough = 0.95; }
		if ( helmet && hd.y > -0.02 ) { c = capC; rough = 0.2; }
		// a police cap's black peak band
		if ( o == 9 && ! helmet && hd.y > 0.02 && hd.y < 0.045 ) { c = vec3f( 0.01 ); rough = 0.3; }
		// the riot helmet: a big black shell, its visor up
		if ( o == 9 && helmet && hd.y > -0.04 ) { c = vec3f( 0.01 ); rough = 0.25; }
		if ( hood ) {
			c = torso; rough = 0.5;
			if ( dot( normalize( hd ), vec3f( 0.0, 0.05, -1.0 ) ) > 0.6 ) { c = skin; rough = 0.6; }
		}
		// glasses
		if ( ( flags & 64u ) != 0u && hd.z < -0.07 && abs( abs( hd.x ) - 0.032 ) < 0.022 && abs( hd.y - 0.012 ) < 0.016 ) { c = vec3f( 0.02 ); rough = 0.15; }
	}
	if ( part == 4 ) {
		c = capC;
		if ( ! capped && ! helmet ) { c = select( hair, torso, hood ); }
		if ( beanie ) { c = select( vec3f( 0.02 ), select( red, navy, h.x > 0.5 ), h.y > 0.3 ); }
		if ( o == 9 ) { c = vec3f( 0.01 ); rough = 0.2; }
	}
	if ( part == 5 ) { c = shoe; rough = 0.4; }
	if ( part == 7 ) { c = hair; rough = 0.7; }
	// the gear
	if ( part == 8 ) { c = vec3f( 0.012, 0.012, 0.014 ); rough = 0.4; }
	if ( part == 9 ) {
		// Canon's long glass is white, Nikon's black
		c = select( vec3f( 0.015 ), vec3f( 0.72, 0.72, 0.69 ), h.y < 0.62 );
		rough = 0.35;
	}
	if ( part == 10 ) { c = select( vec3f( 0.2, 0.08, 0.03 ), vec3f( 0.02 ), h.x > 0.7 ); rough = 0.55; }
	if ( part == 11 ) { c = vec3f( 0.8, 0.79, 0.74 ); rough = 0.6; }
	if ( part == 12 ) { c = vec3f( 0.05 ); e = vec3f( 0.55, 0.7, 0.85 ) * 0.9; rough = 0.1; }
	if ( part == 13 ) {
		// a rain cover: black nylon, or clear plastic (a grey sheen)
		c = select( vec3f( 0.02 ), vec3f( 0.25, 0.26, 0.27 ), h.x > 0.6 );
		rough = 0.25;
	}
	if ( part == 14 ) { c = vec3f( 0.25 ); rough = 0.3; }
	// a TV camera's tally light: red while its picture is on the air
	if ( part == 18 ) { c = vec3f( 0.05, 0.0, 0.0 ); rough = 0.2; if ( ( flags & 512u ) != 0u ) { e = vec3f( 6.0, 0.25, 0.1 ); } }
	if ( part == 19 ) { c = vec3f( 0.42, 0.42, 0.4 ); rough = 0.4; }
	if ( part == 15 ) { c = select( vec3f( 0.5, 0.35, 0.2 ), vec3f( 0.02 ), h.y > 0.6 ); rough = 0.35; }
	if ( part == 16 ) { c = select( vec3f( 0.015 ), red, o == 0 ); rough = 0.7; }
	if ( part == 17 ) {
		// the credential: white, a coloured band at the top (the World Series pass), the photo box
		c = vec3f( 0.8, 0.8, 0.77 );
		rough = 0.3;
	}
	// soaked: the cloth darker and glossy
	let cloth = select( 0.0, 1.0, part <= 1 || part == 6 || ( part == 3 && hood ) );
	c = c * ( 1.0 - 0.35 * wet * cloth );
	rough = mix( rough, min( rough, 0.25 ), wet * select( 0.6, 1.0, part != 2 ) );
	s.albedo = c;
	s.roughness = rough;
	s.emissive = c * smoothstep( 0.15, 0.7, frame.night ) * 0.14 + e;
`,
	} );
	m.underwaterLighting = 'none';
	m.setDefine( 'DRY', 1 ); // the figures have their own wet
	return m;

}

const _m = new Matrix4(), _q = new Quaternion(), _v = new Vector3(), _s = new Vector3(), _up = new Vector3( 0, 1, 0 );

export class RailFigures {

	constructor( parent ) {

		this.parent = parent;
		this.list = [];
		this.meshes = new Map();
		this.material = railMaterial();

	}

	// a figure of a kind (KINDS) at x, y (his feet), z, facing yaw (0 faces -z)
	add( kind, { x = 0, y = 0, z = 0, yaw = 0, outfit = 0, flags = 0, scale = 1, stout = 0, wet = 0, seed = null, shown = true, morph = 0, look = [ 0, 0 ] } = {} ) {

		if ( ! KINDS[ kind ] ) throw new Error( 'RailFigures: no kind ' + kind );
		const f = { kind, x, y, z, yaw, outfit, flags, scale, stout, wet, seed: seed ?? ( ( this.list.length * 0.6180339 + 0.137 ) % 1 ), shown, morph, look: look.slice() };
		this.list.push( f );
		return f;

	}

	build() {

		const byKind = new Map();
		for ( const f of this.list ) {

			if ( ! byKind.has( f.kind ) ) byKind.set( f.kind, [] );
			byKind.get( f.kind ).push( f );

		}

		for ( const [ kind, list ] of byKind ) {

			const g = kindGeometry( kind );
			const who = new Float32Array( list.length * 4 ), look = new Float32Array( list.length * 4 );
			g.setAttribute( 'aWho', new InstancedBufferAttribute( who, 4 ) );
			g.setAttribute( 'aLook', new InstancedBufferAttribute( look, 4 ) );
			const mesh = new InstancedMesh( g, this.material, list.length );
			mesh.name = 'rail-figures-' + kind;
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			mesh.frustumCulled = false;
			this.parent.add( mesh );
			list.forEach( ( f, i ) => {

				f.mesh = mesh;
				f.index = i;

			} );
			this.meshes.set( kind, { mesh, list, who, look } );

		}

		this.update();

	}

	// write every figure: where it is, what it's doing
	update() {

		for ( const { mesh, list, who, look } of this.meshes.values() ) {

			list.forEach( ( f, i ) => {

				_q.setFromAxisAngle( _up, f.yaw );
				_m.compose( _v.set( f.x, f.y, f.z ), _q, _s.setScalar( f.shown ? f.scale : 0 ) );
				mesh.setMatrixAt( i, _m );
				who[ i * 4 ] = f.outfit; who[ i * 4 + 1 ] = f.seed; who[ i * 4 + 2 ] = f.wet; who[ i * 4 + 3 ] = f.morph;
				look[ i * 4 ] = f.look[ 0 ]; look[ i * 4 + 1 ] = f.look[ 1 ]; look[ i * 4 + 2 ] = f.flags; look[ i * 4 + 3 ] = f.stout;

			} );
			mesh.instanceMatrix.needsUpdate = true;
			mesh.geometry.getAttribute( 'aWho' ).needsUpdate = true;
			mesh.geometry.getAttribute( 'aLook' ).needsUpdate = true;

		}

	}

}
