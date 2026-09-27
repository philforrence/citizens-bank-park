import { InstancedMesh, BufferGeometry, Float32BufferAttribute, InstancedBufferAttribute, InterleavedBuffer, InterleavedBufferAttribute, PlaneGeometry, Matrix4, Quaternion, Vector3, Color, Box3, Sphere } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';

// The Alley's people, up close: low-poly figures in the style of FieldFigures (tubes between joints, an
// ellipsoid head, a cap's brim), each built in two poses so it can move between them: a stride's two
// halves, a hand going up to heckle, arms thrown up at the last out, a cheesesteak handed over the counter.
// One instanced draw per pair of poses; who a person is (what they wear, whose jersey, the hat, a poncho
// on the 27th, a kid) is a per-person record the shaders read, and how far along the gesture they are is
// set on the CPU every frame (update()). They hold things (props): a homemade sign, a beer, a hoagie, an
// umbrella, a kid's glove, a camera, a Rays fan's cowbell: all of them in one more instanced draw.
//
//   const folk = new Folk( parent, { signs } );
//   const p = folk.add( 'lean', { x, y, z, yaw, look: { top: TOP.redHoodie, hat: HAT.cap, jersey: 'UTLEY' } } );
//   p.k = 0.7;  p.x += 1;  folk.hold( p, 'sign', { sign: 2 } );
//   folk.build();  folk.update();   (after moving people: every frame)

// ---------------------------------------------------------------- who they are

// the top (what shows): the codes the shader dresses by
export const TOP = {
	redHoodie: 0, // a Phillies red hooded sweatshirt, PHILLIES across the chest
	redJacket: 1, // a red nylon Phillies jacket, the script on the chest (glossy)
	homeJersey: 2, // a replica home white pinstripe jersey over a red hoodie (the number on the back)
	roadJersey: 3, // a replica road grey, the name and the number
	greyHoodie: 4, // a heather grey hoodie, PHILLIES in red
	leather: 5, // a black leather jacket
	parka: 6, // a navy parka
	eagles: 7, // an Eagles jacket, midnight green (it's Philadelphia)
	carhartt: 8, // a brown duck work jacket
	powderBlue: 9, // a 1980 powder blue throwback, SCHMIDT 20
	flyers: 10, // a Flyers jacket, orange and black
	rays: 11, // a Rays fan: navy and Columbia blue
	staff: 12, // concession staff: a red polo, a black apron
	security: 13, // event security: black jacket, the hi-vis vest
	usher: 14, // an usher: red jacket, khakis
	bull: 15, // Greg Luzinski: a red Phillies polo over a white turtleneck
	kidRed: 16, // a kid's red Phillies jacket
	cook: 17, // the pit crew at Bull's: a black t-shirt over long sleeves, a red apron
	wsShirt: 18, // a red long-sleeved World Series 2008 t-shirt
	camo: 19, // a hunting jacket (a South Philly dad)
};
export const HAT = { none: 0, cap: 1, beanie: 2, wsCap: 3, raysCap: 4, hood: 5, staffCap: 6, greyBeanie: 7, backwards: 8, bald: 9, cabbie: 10 };
export const PANTS = { jeans: 0, khaki: 1, black: 2, sweats: 3, dark: 4 };
const FLAG = { poncho: 1, kid: 2, glasses: 4, beard: 8, woman: 16, open: 32, mustache: 64 };
export { FLAG };

// the backs (and fronts) of the replica jerseys and the shirts: cells of one atlas
const BACKS = [
	// [ key, name ('' for the home whites: no names), number ]
	[ 'UTLEY', '', '26' ], [ 'HOWARD', '', '6' ], [ 'ROLLINS', '', '11' ], [ 'HAMELS', '', '35' ], [ 'VICTORINO', '', '8' ],
	[ 'LIDGE', '', '54' ], [ 'WERTH', '', '28' ], [ 'BURRELL', '', '5' ], [ 'MYERS', '', '39' ], [ 'RUIZ', '', '51' ],
	[ 'UTLEY-R', 'UTLEY', '26' ], [ 'HOWARD-R', 'HOWARD', '6' ], [ 'ROLLINS-R', 'ROLLINS', '11' ], [ 'HAMELS-R', 'HAMELS', '35' ],
	[ 'SCHMIDT', 'SCHMIDT', '20' ], [ 'CARLTON', 'CARLTON', '32' ], [ 'ASHBURN', '', '1' ], [ 'LONGORIA', 'LONGORIA', '3' ],
	[ 'CRAWFORD', 'CRAWFORD', '13' ], [ 'DAWKINS', 'DAWKINS', '20' ], [ 'MCNABB', 'McNABB', '5' ], [ 'BULL', 'LUZINSKI', '19' ],
];
const CELL = 128, COLS = 8, ROWS = 4;
// the fronts: fixed cells after the backs
const FRONT = { script: 24, scriptRed: 25, rays: 26, block: 27, ws: 28, eagles: 29, flyers: 30, bulls: 31 };

function drawAtlas( ctx, w, h ) {

	ctx.clearRect( 0, 0, w, h );
	const cell = ( i ) => [ ( i % COLS ) * CELL, Math.floor( i / COLS ) * CELL ];
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	BACKS.forEach( ( [ key, name, num ], i ) => {

		const [ x, y ] = cell( i );
		const rays = key === 'LONGORIA' || key === 'CRAWFORD';
		const eagles = key === 'DAWKINS' || key === 'MCNABB';
		const road = !! name;
		// home whites: red numbers with a blue drop; road greys and the throwbacks: the name arched over
		const fill = rays ? '#0d2a5c' : eagles ? '#e8e8e8' : key === 'SCHMIDT' || key === 'CARLTON' ? '#7a1630' : '#d0202e';
		const edge = rays ? '#8fbce6' : eagles ? '#1c1c1c' : '#1c3f94';
		if ( name ) {

			ctx.font = `800 ${ name.length > 7 ? 15 : 18 }px "Helvetica Neue", Arial, sans-serif`;
			ctx.fillStyle = fill;
			ctx.fillText( name, x + CELL / 2, y + 20, CELL - 12 );

		}

		ctx.font = `900 ${ road ? 62 : 72 }px "Helvetica Neue", Arial, sans-serif`;
		ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.strokeStyle = edge;
		ctx.strokeText( num, x + CELL / 2, y + ( road ? 72 : 64 ), CELL - 16 );
		ctx.fillStyle = fill;
		ctx.fillText( num, x + CELL / 2, y + ( road ? 72 : 64 ), CELL - 16 );

	} );
	const put = ( i, draw ) => {

		const [ x, y ] = cell( i );
		ctx.save();
		ctx.translate( x, y );
		draw();
		ctx.restore();

	};

	const script = ( color, edge ) => {

		ctx.font = 'italic 800 40px Georgia, "Times New Roman", serif';
		if ( edge ) {

			ctx.lineWidth = 6; ctx.strokeStyle = edge; ctx.strokeText( 'Phillies', CELL / 2, CELL / 2, CELL - 8 );

		}

		ctx.fillStyle = color;
		ctx.fillText( 'Phillies', CELL / 2, CELL / 2, CELL - 8 );
		// the two stars dotting the i's
		ctx.fillStyle = '#1c3f94';
		for ( const sx of [ 0.62, 0.74 ] ) {

			ctx.beginPath(); ctx.arc( CELL * sx, CELL / 2 - 16, 3.2, 0, Math.PI * 2 ); ctx.fill();

		}

	};

	put( FRONT.script, () => script( '#f4f1ea', null ) );
	put( FRONT.scriptRed, () => script( '#d0202e', '#1c3f94' ) );
	put( FRONT.rays, () => {

		ctx.font = '900 40px "Helvetica Neue", Arial, sans-serif';
		ctx.fillStyle = '#8fbce6'; ctx.fillText( 'RAYS', CELL / 2, CELL / 2 + 2 );
		ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.arc( CELL * 0.86, CELL * 0.34, 7, 0, Math.PI * 2 ); ctx.fill();

	} );
	put( FRONT.block, () => {

		ctx.font = '900 26px "Helvetica Neue", Arial, sans-serif';
		ctx.fillStyle = '#f4f1ea'; ctx.fillText( 'PHILLIES', CELL / 2, CELL / 2, CELL - 10 );

	} );
	put( FRONT.ws, () => {

		// the 2008 World Series logo, as the shirts had it: WORLD SERIES over 2008, the trophy's flags
		ctx.fillStyle = '#f4f1ea';
		ctx.font = '900 19px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'WORLD SERIES', CELL / 2, CELL * 0.36, CELL - 10 );
		ctx.font = '900 38px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( '2008', CELL / 2, CELL * 0.64 );
		ctx.fillStyle = '#f2c230'; ctx.fillRect( CELL * 0.2, CELL * 0.8, CELL * 0.6, 4 );

	} );
	put( FRONT.eagles, () => {

		// a silver wing
		ctx.fillStyle = '#c9ccd0';
		ctx.beginPath(); ctx.moveTo( 20, 76 ); ctx.quadraticCurveTo( 60, 30, 112, 40 ); ctx.lineTo( 84, 58 ); ctx.lineTo( 104, 62 ); ctx.lineTo( 70, 76 ); ctx.lineTo( 88, 82 ); ctx.closePath(); ctx.fill();

	} );
	put( FRONT.flyers, () => {

		// the winged P, in the jacket's black
		ctx.fillStyle = '#111';
		ctx.beginPath(); ctx.arc( CELL * 0.55, CELL * 0.48, 26, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#e0561a'; ctx.beginPath(); ctx.arc( CELL * 0.58, CELL * 0.46, 11, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#111'; ctx.fillRect( CELL * 0.2, CELL * 0.38, 40, 8 ); ctx.fillRect( CELL * 0.24, CELL * 0.5, 34, 8 );

	} );
	put( FRONT.bulls, () => {

		ctx.font = 'italic 800 30px Georgia, serif';
		ctx.fillStyle = '#f2c14e'; ctx.fillText( "Bull's", CELL / 2, CELL * 0.42 );
		ctx.font = '800 22px Georgia, serif'; ctx.fillText( 'BBQ', CELL / 2, CELL * 0.68 );

	} );

}

// ---------------------------------------------------------------- poses

// the joints for the right side (+x); the left mirrors x unless the pose gives it its own ('L:' prefix).
// Origin on the ground between the feet, facing -z
const BASE = {
	hip: [ 0.1, 0.9, 0.0 ], knee: [ 0.11, 0.5, - 0.02 ], ankle: [ 0.12, 0.08, 0.0 ], toe: [ 0.13, 0.04, - 0.15 ],
	pelvis: [ 0, 0.88, 0.02 ], chest: [ 0, 1.38, 0.03 ], neck: [ 0, 1.45, 0.03 ], head: [ 0, 1.58, 0.02 ],
	shoulder: [ 0.2, 1.37, 0.03 ], elbow: [ 0.23, 1.1, 0.06 ], wrist: [ 0.22, 0.86, 0.02 ], hand: [ 0.21, 0.77, 0.01 ],
};
const HEAD_REST = BASE.head;

const seated = ( H, upper ) => ( {
	pelvis: [ 0, H + 0.12, 0.06 ], hip: [ 0.1, H + 0.1, 0.03 ], knee: [ 0.13, H + 0.08, - 0.4 ], ankle: [ 0.14, 0.08, - 0.44 ], toe: [ 0.15, 0.04, - 0.58 ],
	'L:knee': [ - 0.12, H + 0.07, - 0.41 ], 'L:ankle': [ - 0.13, 0.08, - 0.4 ], 'L:toe': [ - 0.14, 0.04, - 0.54 ],
	...upper( H ),
} );
const both = ( o ) => {

	// the same joints on the left, mirrored
	const out = { ...o };
	for ( const [ k, v ] of Object.entries( o ) ) if ( ! k.startsWith( 'L:' ) && [ 'shoulder', 'elbow', 'wrist', 'hand' ].includes( k ) ) out[ 'L:' + k ] = [ - v[ 0 ], v[ 1 ], v[ 2 ] ];
	return out;

};

export const POSES = {
	stand: {},
	// talking with his hands: the right forearm up, the palm open
	talk: { elbow: [ 0.25, 1.12, - 0.04 ], wrist: [ 0.22, 1.26, - 0.27 ], hand: [ 0.19, 1.3, - 0.35 ] },
	// hands in his jacket's pockets, the weight on one leg
	pockets: {
		elbow: [ 0.25, 1.1, 0.02 ], wrist: [ 0.17, 0.95, - 0.1 ], hand: [ 0.14, 0.92, - 0.13 ],
		'L:elbow': [ - 0.25, 1.1, 0.02 ], 'L:wrist': [ - 0.17, 0.95, - 0.1 ], 'L:hand': [ - 0.14, 0.92, - 0.13 ],
		'L:knee': [ - 0.1, 0.5, - 0.06 ], 'L:ankle': [ - 0.15, 0.08, - 0.05 ], 'L:toe': [ - 0.2, 0.04, - 0.18 ],
	},
	// a stride's two halves: the right foot forward (the left arm), then the left
	walkA: {
		knee: [ 0.11, 0.52, - 0.2 ], ankle: [ 0.12, 0.1, - 0.28 ], toe: [ 0.13, 0.05, - 0.43 ],
		'L:knee': [ - 0.11, 0.47, 0.12 ], 'L:ankle': [ - 0.12, 0.16, 0.26 ], 'L:toe': [ - 0.13, 0.06, 0.13 ],
		elbow: [ 0.23, 1.11, 0.1 ], wrist: [ 0.22, 0.9, 0.16 ], hand: [ 0.21, 0.82, 0.19 ],
		'L:elbow': [ - 0.23, 1.11, - 0.08 ], 'L:wrist': [ - 0.22, 0.89, - 0.16 ], 'L:hand': [ - 0.21, 0.8, - 0.2 ],
	},
	walkB: {
		'L:knee': [ - 0.11, 0.52, - 0.2 ], 'L:ankle': [ - 0.12, 0.1, - 0.28 ], 'L:toe': [ - 0.13, 0.05, - 0.43 ],
		knee: [ 0.11, 0.47, 0.12 ], ankle: [ 0.12, 0.16, 0.26 ], toe: [ 0.13, 0.06, 0.13 ],
		'L:elbow': [ - 0.23, 1.11, 0.1 ], 'L:wrist': [ - 0.22, 0.9, 0.16 ], 'L:hand': [ - 0.21, 0.82, 0.19 ],
		elbow: [ 0.23, 1.11, - 0.08 ], wrist: [ 0.22, 0.89, - 0.16 ], hand: [ 0.21, 0.8, - 0.2 ],
	},
	// forearms folded on a rail 1.07 m up (the Alley's over the pens), bent over it, looking down
	lean: {
		pelvis: [ 0, 0.86, 0.1 ], hip: [ 0.1, 0.88, 0.1 ], knee: [ 0.11, 0.49, 0.02 ], ankle: [ 0.12, 0.08, 0.06 ], toe: [ 0.13, 0.04, - 0.09 ],
		chest: [ 0, 1.27, - 0.16 ], neck: [ 0, 1.33, - 0.21 ], head: [ 0, 1.42, - 0.28 ],
		shoulder: [ 0.2, 1.26, - 0.16 ], elbow: [ 0.24, 1.12, - 0.36 ], wrist: [ - 0.02, 1.13, - 0.42 ], hand: [ - 0.1, 1.13, - 0.41 ],
		'L:shoulder': [ - 0.2, 1.26, - 0.16 ], 'L:elbow': [ - 0.24, 1.13, - 0.35 ], 'L:wrist': [ 0.03, 1.15, - 0.4 ], 'L:hand': [ 0.11, 1.15, - 0.39 ],
	},
	// the same, the right arm out over the rail, pointing down into the pen (the heckle)
	leanPoint: {
		pelvis: [ 0, 0.86, 0.1 ], hip: [ 0.1, 0.88, 0.1 ], knee: [ 0.11, 0.49, 0.02 ], ankle: [ 0.12, 0.08, 0.06 ], toe: [ 0.13, 0.04, - 0.09 ],
		chest: [ 0, 1.29, - 0.14 ], neck: [ 0, 1.36, - 0.19 ], head: [ 0, 1.46, - 0.25 ],
		shoulder: [ 0.2, 1.3, - 0.14 ], elbow: [ 0.28, 1.25, - 0.42 ], wrist: [ 0.32, 1.16, - 0.68 ], hand: [ 0.33, 1.12, - 0.77 ],
		'L:shoulder': [ - 0.2, 1.28, - 0.14 ], 'L:elbow': [ - 0.24, 1.13, - 0.35 ], 'L:wrist': [ 0.03, 1.15, - 0.4 ], 'L:hand': [ 0.11, 1.15, - 0.39 ],
	},
	// both hands on the rail, arms straight, looking out
	rail: both( {
		chest: [ 0, 1.37, - 0.05 ], neck: [ 0, 1.44, - 0.07 ], head: [ 0, 1.56, - 0.1 ],
		shoulder: [ 0.2, 1.36, - 0.05 ], elbow: [ 0.25, 1.2, - 0.2 ], wrist: [ 0.26, 1.08, - 0.33 ], hand: [ 0.26, 1.06, - 0.4 ],
	} ),
	// both arms thrown up
	cheer: both( {
		chest: [ 0, 1.39, 0.04 ], neck: [ 0, 1.46, 0.05 ], head: [ 0, 1.59, 0.05 ],
		shoulder: [ 0.2, 1.39, 0.04 ], elbow: [ 0.31, 1.64, 0.02 ], wrist: [ 0.33, 1.9, - 0.02 ], hand: [ 0.32, 2.0, - 0.03 ],
	} ),
	// clapping, the hands together in front of the chest
	clap: both( { elbow: [ 0.27, 1.14, - 0.12 ], wrist: [ 0.09, 1.28, - 0.3 ], hand: [ 0.03, 1.31, - 0.33 ] } ),
	// a sign held up in both hands at head height, then pumped up over it
	sign: both( { elbow: [ 0.31, 1.33, - 0.14 ], wrist: [ 0.29, 1.56, - 0.26 ], hand: [ 0.27, 1.63, - 0.28 ] } ),
	signHigh: both( { elbow: [ 0.31, 1.62, - 0.1 ], wrist: [ 0.29, 1.88, - 0.2 ], hand: [ 0.27, 1.95, - 0.22 ] } ),
	// on a bench 0.45 m up, the hands in the lap; eating (the right hand to the mouth)
	sit: seated( 0.45, ( H ) => ( {
		chest: [ 0, H + 0.6, 0.1 ], neck: [ 0, H + 0.67, 0.1 ], head: [ 0, H + 0.79, 0.08 ],
		shoulder: [ 0.2, H + 0.58, 0.1 ], elbow: [ 0.24, H + 0.34, 0.0 ], wrist: [ 0.17, H + 0.3, - 0.22 ], hand: [ 0.14, H + 0.3, - 0.3 ],
		'L:elbow': [ - 0.24, H + 0.34, 0.0 ], 'L:wrist': [ - 0.17, H + 0.3, - 0.22 ], 'L:hand': [ - 0.14, H + 0.3, - 0.3 ],
	} ) ),
	sitEat: seated( 0.45, ( H ) => ( {
		chest: [ 0, H + 0.59, 0.06 ], neck: [ 0, H + 0.66, 0.04 ], head: [ 0, H + 0.77, 0.01 ],
		shoulder: [ 0.2, H + 0.57, 0.06 ], elbow: [ 0.25, H + 0.36, - 0.14 ], wrist: [ 0.1, H + 0.62, - 0.2 ], hand: [ 0.05, H + 0.7, - 0.15 ],
		'L:elbow': [ - 0.24, H + 0.34, 0.0 ], 'L:wrist': [ - 0.17, H + 0.3, - 0.22 ], 'L:hand': [ - 0.14, H + 0.3, - 0.3 ],
	} ) ),
	// both hands out over a counter: taking a tray, handing it over
	reach: both( { chest: [ 0, 1.37, - 0.02 ], neck: [ 0, 1.44, - 0.04 ], head: [ 0, 1.56, - 0.06 ], elbow: [ 0.2, 1.17, - 0.18 ], wrist: [ 0.15, 1.16, - 0.42 ], hand: [ 0.12, 1.16, - 0.5 ] } ),
	// carrying food in both hands at the waist; a drink to the mouth
	carry: both( { elbow: [ 0.24, 1.08, - 0.02 ], wrist: [ 0.15, 1.04, - 0.28 ], hand: [ 0.11, 1.04, - 0.34 ] } ),
	drink: { elbow: [ 0.24, 1.14, - 0.1 ], wrist: [ 0.1, 1.36, - 0.15 ], hand: [ 0.06, 1.44, - 0.12 ], 'L:elbow': [ - 0.24, 1.08, - 0.02 ], 'L:wrist': [ - 0.15, 1.04, - 0.28 ], 'L:hand': [ - 0.11, 1.04, - 0.34 ] },
	// a camera (or a flip phone) up to the face in both hands; a phone to the ear
	photo: both( { elbow: [ 0.26, 1.3, - 0.16 ], wrist: [ 0.1, 1.47, - 0.24 ], hand: [ 0.05, 1.52, - 0.25 ] } ),
	phone: { elbow: [ 0.28, 1.3, - 0.02 ], wrist: [ 0.15, 1.5, - 0.03 ], hand: [ 0.1, 1.56, - 0.01 ] },
	// a dad with his kid up on his shoulders, holding the kid's shins; then his free arm up
	shoulders: both( { elbow: [ 0.3, 1.46, 0.0 ], wrist: [ 0.22, 1.6, - 0.03 ], hand: [ 0.17, 1.64, - 0.03 ] } ),
	shouldersUp: { elbow: [ 0.3, 1.46, 0.0 ], wrist: [ 0.22, 1.6, - 0.03 ], hand: [ 0.17, 1.64, - 0.03 ], 'L:elbow': [ - 0.31, 1.64, 0.02 ], 'L:wrist': [ - 0.33, 1.9, - 0.02 ], 'L:hand': [ - 0.32, 2.0, - 0.03 ] },
	// the kid up there: astride the neck (his origin 1.45 m under the seat), legs down over the chest
	ride: {
		pelvis: [ 0, 0.95, 0.06 ], hip: [ 0.1, 0.93, 0.04 ], knee: [ 0.17, 0.86, - 0.16 ], ankle: [ 0.16, 0.52, - 0.14 ], toe: [ 0.16, 0.47, - 0.26 ],
		chest: [ 0, 1.38, 0.05 ], neck: [ 0, 1.45, 0.05 ], head: [ 0, 1.58, 0.04 ],
		shoulder: [ 0.2, 1.37, 0.05 ], elbow: [ 0.25, 1.12, - 0.02 ], wrist: [ 0.12, 1.02, - 0.12 ], hand: [ 0.05, 1.0, - 0.12 ],
	},
	rideUp: {
		pelvis: [ 0, 0.95, 0.06 ], hip: [ 0.1, 0.93, 0.04 ], knee: [ 0.17, 0.86, - 0.16 ], ankle: [ 0.16, 0.52, - 0.14 ], toe: [ 0.16, 0.47, - 0.26 ],
		chest: [ 0, 1.39, 0.06 ], neck: [ 0, 1.46, 0.07 ], head: [ 0, 1.59, 0.07 ],
		...both( { shoulder: [ 0.2, 1.38, 0.06 ], elbow: [ 0.31, 1.64, 0.03 ], wrist: [ 0.33, 1.9, - 0.01 ], hand: [ 0.32, 2.0, - 0.02 ] } ),
	},
	// at the pit: tongs in the right hand over the grate, then turning the meat
	grill: {
		chest: [ 0, 1.36, - 0.06 ], neck: [ 0, 1.42, - 0.1 ], head: [ 0, 1.53, - 0.15 ],
		elbow: [ 0.23, 1.06, - 0.18 ], wrist: [ 0.18, 1.01, - 0.42 ], hand: [ 0.17, 0.99, - 0.5 ],
		'L:elbow': [ - 0.24, 1.08, - 0.08 ], 'L:wrist': [ - 0.2, 1.0, - 0.28 ], 'L:hand': [ - 0.18, 0.98, - 0.34 ],
	},
	grillFlip: {
		chest: [ 0, 1.36, - 0.06 ], neck: [ 0, 1.42, - 0.1 ], head: [ 0, 1.53, - 0.15 ],
		elbow: [ 0.24, 1.08, - 0.16 ], wrist: [ 0.21, 1.13, - 0.4 ], hand: [ 0.21, 1.2, - 0.46 ],
		'L:elbow': [ - 0.24, 1.08, - 0.08 ], 'L:wrist': [ - 0.2, 1.0, - 0.28 ], 'L:hand': [ - 0.18, 0.98, - 0.34 ],
	},
	// both hands on the pinball's flipper buttons, leaning in; then a shove
	pinball: both( {
		pelvis: [ 0, 0.88, 0.05 ], chest: [ 0, 1.34, - 0.1 ], neck: [ 0, 1.4, - 0.15 ], head: [ 0, 1.5, - 0.2 ],
		shoulder: [ 0.2, 1.33, - 0.1 ], elbow: [ 0.3, 1.08, - 0.22 ], wrist: [ 0.3, 0.98, - 0.42 ], hand: [ 0.29, 0.97, - 0.5 ],
	} ),
	pinballShove: both( {
		pelvis: [ 0, 0.88, 0.04 ], chest: [ 0, 1.33, - 0.14 ], neck: [ 0, 1.39, - 0.19 ], head: [ 0, 1.48, - 0.25 ],
		shoulder: [ 0.2, 1.32, - 0.14 ], elbow: [ 0.3, 1.07, - 0.3 ], wrist: [ 0.3, 0.98, - 0.48 ], hand: [ 0.29, 0.97, - 0.55 ],
	} ),
	// signing at a table (seated): the pen on the photo, then looking up with it held out
	autograph: seated( 0.46, ( H ) => ( {
		chest: [ 0, H + 0.58, 0.0 ], neck: [ 0, H + 0.64, - 0.04 ], head: [ 0, H + 0.74, - 0.09 ],
		shoulder: [ 0.21, H + 0.56, 0.0 ], elbow: [ 0.27, H + 0.34, - 0.26 ], wrist: [ 0.12, H + 0.3, - 0.46 ], hand: [ 0.07, H + 0.3, - 0.53 ],
		'L:shoulder': [ - 0.21, H + 0.56, 0.0 ], 'L:elbow': [ - 0.28, H + 0.33, - 0.22 ], 'L:wrist': [ - 0.16, H + 0.3, - 0.44 ], 'L:hand': [ - 0.1, H + 0.3, - 0.5 ],
	} ) ),
	autographUp: seated( 0.46, ( H ) => ( {
		chest: [ 0, H + 0.6, 0.04 ], neck: [ 0, H + 0.67, 0.03 ], head: [ 0, H + 0.79, 0.01 ],
		shoulder: [ 0.21, H + 0.58, 0.04 ], elbow: [ 0.27, H + 0.4, - 0.2 ], wrist: [ 0.2, H + 0.46, - 0.45 ], hand: [ 0.17, H + 0.48, - 0.52 ],
		'L:shoulder': [ - 0.21, H + 0.58, 0.04 ], 'L:elbow': [ - 0.28, H + 0.33, - 0.2 ], 'L:wrist': [ - 0.16, H + 0.3, - 0.44 ], 'L:hand': [ - 0.1, H + 0.3, - 0.5 ],
	} ) ),
	// pointing down into the pen for his kid; crouched beside him
	point: { chest: [ 0, 1.37, - 0.03 ], neck: [ 0, 1.44, - 0.05 ], head: [ 0, 1.55, - 0.09 ], elbow: [ 0.27, 1.28, - 0.22 ], wrist: [ 0.31, 1.22, - 0.48 ], hand: [ 0.32, 1.2, - 0.57 ] },
	crouch: {
		pelvis: [ 0, 0.52, 0.18 ], hip: [ 0.12, 0.52, 0.16 ], knee: [ 0.2, 0.52, - 0.25 ], ankle: [ 0.18, 0.08, - 0.02 ], toe: [ 0.19, 0.04, - 0.16 ],
		'L:knee': [ - 0.16, 0.34, 0.1 ], 'L:ankle': [ - 0.15, 0.08, 0.38 ], 'L:toe': [ - 0.15, 0.02, 0.24 ],
		chest: [ 0, 0.97, 0.05 ], neck: [ 0, 1.04, 0.02 ], head: [ 0, 1.15, - 0.02 ],
		shoulder: [ 0.2, 0.96, 0.05 ], elbow: [ 0.27, 0.9, - 0.2 ], wrist: [ 0.29, 0.93, - 0.45 ], hand: [ 0.29, 0.94, - 0.53 ],
		'L:elbow': [ - 0.22, 0.72, - 0.06 ], 'L:wrist': [ - 0.2, 0.55, - 0.2 ], 'L:hand': [ - 0.19, 0.52, - 0.26 ],
	},
	// arms folded (a guard, a coach), and holding an umbrella up in the right hand
	folded: {
		elbow: [ 0.23, 1.12, - 0.05 ], wrist: [ - 0.06, 1.18, - 0.16 ], hand: [ - 0.14, 1.19, - 0.14 ],
		'L:elbow': [ - 0.23, 1.13, - 0.05 ], 'L:wrist': [ 0.06, 1.2, - 0.16 ], 'L:hand': [ 0.14, 1.21, - 0.14 ],
	},
	umbrella: { elbow: [ 0.24, 1.12, - 0.12 ], wrist: [ 0.12, 1.28, - 0.26 ], hand: [ 0.08, 1.32, - 0.26 ] },
};

// the pairs drawn (one instanced draw each): [ from, to ]
export const PAIRS = {
	idle: [ 'stand', 'talk' ], pockets: [ 'pockets', 'talk' ], walk: [ 'walkA', 'walkB' ], lean: [ 'lean', 'leanPoint' ],
	rail: [ 'rail', 'cheer' ], cheer: [ 'clap', 'cheer' ], sign: [ 'sign', 'signHigh' ], sit: [ 'sit', 'sitEat' ],
	serve: [ 'stand', 'reach' ], carry: [ 'carry', 'drink' ], photo: [ 'photo', 'phone' ], shoulders: [ 'shoulders', 'shouldersUp' ],
	ride: [ 'ride', 'rideUp' ], grill: [ 'grill', 'grillFlip' ], pinball: [ 'pinball', 'pinballShove' ],
	autograph: [ 'autograph', 'autographUp' ], point: [ 'stand', 'point' ], crouch: [ 'crouch', 'crouch' ], umbrella: [ 'umbrella', 'folded' ],
};

// ---------------------------------------------------------------- geometry

const PART = { top: 0, pants: 1, skin: 2, head: 3, brim: 4, shoe: 5, hem: 6, pom: 7, hair: 8 };

function jointsOf( pose ) {

	const P = POSES[ pose ];
	return ( name, s ) => {

		const own = s < 0 ? P[ 'L:' + name ] : null;
		if ( own ) return own;
		const j = P[ name ] || BASE[ name ];
		return [ j[ 0 ] * ( j[ 0 ] ? s : 1 ), j[ 1 ], j[ 2 ] ];

	};

}

const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] ];
const add = ( a, b ) => [ a[ 0 ] + b[ 0 ], a[ 1 ] + b[ 1 ], a[ 2 ] + b[ 2 ] ];
const mul = ( a, k ) => [ a[ 0 ] * k, a[ 1 ] * k, a[ 2 ] * k ];
const cross = ( a, b ) => [ a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ], a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ], a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ] ];
const norm = ( a ) => mul( a, 1 / ( Math.hypot( ...a ) || 1 ) );

// the figure in one pose: positions, normals, parts, the index (the same topology for every pose)
// far: the version for a crowd seen from across the park (4-sided tubes, a coarser head)
function build( pose, far = false ) {

	const J = jointsOf( pose );
	const pos = [], nrm = [], part = [], index = [];
	const vert = ( p, n, pt ) => {

		pos.push( ...p ); nrm.push( ...n ); part.push( pt );
		return pos.length / 3 - 1;

	};

	const tube = ( a, b, rA, rB, pt, n = 6, capA = false, capB = false ) => {

		if ( far ) n = Math.min( n, 4 );

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

	const sphere = ( c, r, W, H, pt ) => {

		if ( far ) {

			W = Math.min( W, 6 ); H = Math.min( H, 4 );

		}


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

	const pelvis = J( 'pelvis', 1 ), chest = J( 'chest', 1 ), neck = J( 'neck', 1 );
	tube( add( pelvis, [ 0, - 0.06, 0 ] ), chest, [ 0.17, 0.12 ], [ 0.2, 0.125 ], PART.top, 10, true );
	tube( chest, neck, [ 0.2, 0.125 ], [ 0.065, 0.058 ], PART.top, 10 );
	// (the shoulders' yoke slimmer, and rounder bodies, so up close they read less like boxes)
	tube( J( 'shoulder', - 1 ), J( 'shoulder', 1 ), [ 0.058, 0.062 ], [ 0.058, 0.062 ], PART.top, 8, true, true );
	tube( neck, add( neck, [ 0, 0.07, 0 ] ), [ 0.056, 0.05 ], [ 0.05, 0.048 ], PART.skin, 6 );
	// a coat's (or a poncho's) skirt from the hips to the knees: collapsed in the shader for everyone else
	const knees = mul( add( J( 'knee', 1 ), J( 'knee', - 1 ) ), 0.5 );
	tube( add( pelvis, [ 0, 0.05, 0 ] ), add( knees, [ 0, 0.06, 0 ] ), [ 0.19, 0.135 ], [ 0.24, 0.17 ], PART.hem, 8 );
	for ( const s of [ - 1, 1 ] ) {

		tube( J( 'shoulder', s ), J( 'elbow', s ), [ 0.064, 0.064 ], [ 0.054, 0.054 ], PART.top );
		tube( J( 'elbow', s ), J( 'wrist', s ), [ 0.054, 0.054 ], [ 0.045, 0.045 ], PART.top );
		tube( J( 'wrist', s ), J( 'hand', s ), [ 0.037, 0.023 ], [ 0.033, 0.021 ], PART.skin, 5, false, true );
		tube( J( 'hip', s ), J( 'knee', s ), [ 0.09, 0.09 ], [ 0.064, 0.064 ], PART.pants, 6, true );
		tube( J( 'knee', s ), J( 'ankle', s ), [ 0.062, 0.062 ], [ 0.05, 0.05 ], PART.pants );
		tube( add( J( 'ankle', s ), [ 0, - 0.03, 0.04 ] ), J( 'toe', s ), [ 0.052, 0.046 ], [ 0.044, 0.03 ], PART.shoe, 5, true, true );

	}

	// the head, a cap's brim, a beanie's pom-pom (the shader shows what he has on)
	const hc = J( 'head', 1 );
	sphere( hc, [ 0.084, 0.106, 0.101 ], 10, 7, PART.head );
	const brim = [ [ - 0.078, 0.052, - 0.05 ], [ 0.078, 0.052, - 0.05 ], [ 0.07, 0.038, - 0.168 ], [ - 0.07, 0.038, - 0.168 ] ].map( ( o ) => vert( add( hc, o ), [ 0, 1, 0 ], PART.brim ) );
	index.push( brim[ 0 ], brim[ 2 ], brim[ 1 ], brim[ 0 ], brim[ 3 ], brim[ 2 ] );
	sphere( add( hc, [ 0, 0.112, 0.01 ] ), [ 0.033, 0.03, 0.033 ], 6, 4, PART.pom );
	// longer hair down the back of the neck (the women, the odd long-haired guy): a flap behind the head
	tube( add( hc, [ 0, 0.02, 0.05 ] ), add( hc, [ 0, - 0.17, 0.075 ] ), [ 0.08, 0.05 ], [ 0.07, 0.035 ], PART.hair, 6 );
	return { pos, nrm, part, index, head: hc };

}

// a pair's geometry, in one interleaved buffer (a pipeline takes at most 8 vertex buffers): pose A's
// positions and normals, the offsets to pose B and B's normals, where each vertex sits on the body at rest
// (for the shirts' lettering and the faces; the head's from its centre: it moves rigidly) and its part
const STRIDE = 16;
function pairGeometry( a, b, far = false ) {

	const A = build( a, far ), B = build( b, far ), R = build( 'stand', far );
	const n = A.pos.length / 3;
	const data = new Float32Array( n * STRIDE );
	for ( let i = 0; i < n; i ++ ) {

		const o = i * STRIDE, i3 = i * 3;
		const head = A.part[ i ] === PART.head || A.part[ i ] === PART.brim || A.part[ i ] === PART.pom || A.part[ i ] === PART.hair;
		const hr = head ? HEAD_REST : [ 0, 0, 0 ];
		data.set( [ A.pos[ i3 ], A.pos[ i3 + 1 ], A.pos[ i3 + 2 ], A.nrm[ i3 ], A.nrm[ i3 + 1 ], A.nrm[ i3 + 2 ] ], o );
		data.set( [ B.pos[ i3 ] - A.pos[ i3 ], B.pos[ i3 + 1 ] - A.pos[ i3 + 1 ], B.pos[ i3 + 2 ] - A.pos[ i3 + 2 ], B.nrm[ i3 ], B.nrm[ i3 + 1 ], B.nrm[ i3 + 2 ] ], o + 6 );
		data.set( [ R.pos[ i3 ] - hr[ 0 ], R.pos[ i3 + 1 ] - hr[ 1 ], R.pos[ i3 + 2 ] - hr[ 2 ], A.part[ i ] ], o + 12 );

	}

	const buf = new InterleavedBuffer( data, STRIDE );
	const g = new BufferGeometry();
	[ [ 'position', 3 ], [ 'normal', 3 ], [ 'aDelta', 3 ], [ 'aNormB', 3 ], [ 'aRest', 4 ] ].reduce( ( o, [ name, k ] ) => {

		g.setAttribute( name, new InterleavedBufferAttribute( buf, k, o ) );
		return o + k;

	}, 0 );
	g.setIndex( A.index );
	// every pose, arms up, a kid up on the shoulders
	g.boundingBox = new Box3( new Vector3( - 0.9, - 0.1, - 1.0 ), new Vector3( 0.9, 2.2, 0.8 ) );
	g.boundingSphere = new Sphere( new Vector3( 0, 1.0, 0 ), 1.5 );
	return g;

}

// ---------------------------------------------------------------- the props

// Every prop in one geometry, each kind its own stretch of vertices; an instance shows its kind and
// collapses the rest. Origin at the hand that holds it (the right, or between both for a sign).
export const PROP = { sign: 0, cup: 1, hoagie: 2, umbrella: 3, glove: 4, camera: 5, cowbell: 6, towel: 7, tray: 8, pennant: 9, photo: 10, tongs: 11, bag: 12, phone: 13 };
const PROP_COUNT = 14;

function propGeometry() {

	const pos = [], nrm = [], uv = [], kind = [], index = [];
	const quad = ( k, a, b, c, d, n, uvs = [ [ 0, 1 ], [ 1, 1 ], [ 1, 0 ], [ 0, 0 ] ] ) => {

		const base = pos.length / 3;
		for ( const [ i, p ] of [ a, b, c, d ].entries() ) {

			pos.push( ...p ); nrm.push( ...n ); uv.push( ...uvs[ i ] ); kind.push( k );

		}

		index.push( base, base + 1, base + 2, base, base + 2, base + 3 );

	};

	const box = ( k, c, s, u = 0.5 ) => {

		const [ x, y, z ] = c, [ hx, hy, hz ] = [ s[ 0 ] / 2, s[ 1 ] / 2, s[ 2 ] / 2 ];
		const P = ( i, j, l ) => [ x + i * hx, y + j * hy, z + l * hz ];
		const U = [ [ u, 0.5 ], [ u, 0.5 ], [ u, 0.5 ], [ u, 0.5 ] ];
		quad( k, P( - 1, - 1, 1 ), P( 1, - 1, 1 ), P( 1, 1, 1 ), P( - 1, 1, 1 ), [ 0, 0, 1 ], U );
		quad( k, P( 1, - 1, - 1 ), P( - 1, - 1, - 1 ), P( - 1, 1, - 1 ), P( 1, 1, - 1 ), [ 0, 0, - 1 ], U );
		quad( k, P( 1, - 1, 1 ), P( 1, - 1, - 1 ), P( 1, 1, - 1 ), P( 1, 1, 1 ), [ 1, 0, 0 ], U );
		quad( k, P( - 1, - 1, - 1 ), P( - 1, - 1, 1 ), P( - 1, 1, 1 ), P( - 1, 1, - 1 ), [ - 1, 0, 0 ], U );
		quad( k, P( - 1, 1, 1 ), P( 1, 1, 1 ), P( 1, 1, - 1 ), P( - 1, 1, - 1 ), [ 0, 1, 0 ], U );
		quad( k, P( - 1, - 1, - 1 ), P( 1, - 1, - 1 ), P( 1, - 1, 1 ), P( - 1, - 1, 1 ), [ 0, - 1, 0 ], U );

	};

	const cyl = ( k, c, r0, r1, h, n = 8, u = 0.5 ) => {

		const base = pos.length / 3;
		for ( const [ y, r ] of [ [ 0, r0 ], [ h, r1 ] ] ) for ( let i = 0; i < n; i ++ ) {

			const a = i / n * Math.PI * 2;
			pos.push( c[ 0 ] + Math.cos( a ) * r, c[ 1 ] + y, c[ 2 ] + Math.sin( a ) * r );
			nrm.push( Math.cos( a ), 0, Math.sin( a ) ); uv.push( u, y / h ); kind.push( k );

		}

		for ( let i = 0; i < n; i ++ ) {

			const a = base + i, b = base + ( i + 1 ) % n;
			index.push( a, b, a + n, b, b + n, a + n );

		}

	};

	// a homemade sign: a board 0.72 x 0.5 facing forward (-z) in front of the two hands, its back plain
	quad( PROP.sign, [ 0.36, - 0.1, - 0.04 ], [ - 0.36, - 0.1, - 0.04 ], [ - 0.36, 0.4, - 0.04 ], [ 0.36, 0.4, - 0.04 ], [ 0, 0, - 1 ] );
	quad( PROP.sign, [ - 0.36, - 0.1, - 0.035 ], [ 0.36, - 0.1, - 0.035 ], [ 0.36, 0.4, - 0.035 ], [ - 0.36, 0.4, - 0.035 ], [ 0, 0, 1 ], [ [ 2, 2 ], [ 2, 2 ], [ 2, 2 ], [ 2, 2 ] ] );
	// a beer in a clear plastic cup, a soda
	cyl( PROP.cup, [ 0, - 0.06, 0 ], 0.032, 0.045, 0.15, 8, 0.1 );
	// a cheesesteak in its paper, a hoagie
	box( PROP.hoagie, [ 0, 0.02, - 0.06 ], [ 0.08, 0.06, 0.26 ], 0.2 );
	// an umbrella: the shaft up from the hand, the canopy
	cyl( PROP.umbrella, [ 0, - 0.2, 0 ], 0.01, 0.01, 1.15, 5, 0.3 );
	{

		const base = pos.length / 3, n = 8, R = 0.52, top = 0.98, rim = 0.78;
		pos.push( 0, top, 0 ); nrm.push( 0, 1, 0 ); uv.push( 0.35, 0 ); kind.push( PROP.umbrella );
		for ( let i = 0; i < n; i ++ ) {

			const a = i / n * Math.PI * 2;
			pos.push( Math.cos( a ) * R, rim, Math.sin( a ) * R ); nrm.push( Math.cos( a ) * 0.5, 0.86, Math.sin( a ) * 0.5 ); uv.push( 0.35, 1 + i ); kind.push( PROP.umbrella );

		}

		for ( let i = 0; i < n; i ++ ) index.push( base, base + 1 + ( i + 1 ) % n, base + 1 + i );

	}

	// a kid's glove: a flat mitt
	box( PROP.glove, [ 0, 0.0, - 0.04 ], [ 0.05, 0.2, 0.16 ], 0.4 );
	// a digital camera, a flip phone
	box( PROP.camera, [ 0, 0.02, - 0.06 ], [ 0.11, 0.07, 0.04 ], 0.5 );
	// the Rays fans' cowbell: the bell and its handle
	cyl( PROP.cowbell, [ 0, - 0.02, - 0.03 ], 0.06, 0.035, 0.12, 6, 0.6 );
	cyl( PROP.cowbell, [ 0, 0.1, - 0.03 ], 0.01, 0.01, 0.12, 4, 0.6 );
	// a white rally towel, hanging from the hand
	quad( PROP.towel, [ - 0.02, 0.02, 0.0 ], [ 0.02, 0.02, - 0.35 ], [ 0.03, - 0.4, - 0.32 ], [ - 0.01, - 0.4, 0.02 ], [ 1, 0, 0 ], [ [ 0.7, 0 ], [ 0.7, 0 ], [ 0.7, 1 ], [ 0.7, 1 ] ] );
	// a cardboard tray: two hoagies and a basket of crab fries
	box( PROP.tray, [ - 0.14, 0.0, - 0.1 ], [ 0.36, 0.05, 0.26 ], 0.8 );
	box( PROP.tray, [ - 0.2, 0.05, - 0.1 ], [ 0.08, 0.06, 0.22 ], 0.2 );
	box( PROP.tray, [ - 0.06, 0.05, - 0.1 ], [ 0.12, 0.07, 0.12 ], 0.85 );
	// a Phillies pennant on its stick
	cyl( PROP.pennant, [ 0, - 0.05, 0 ], 0.006, 0.006, 0.5, 4, 0.3 );
	{

		const base = pos.length / 3;
		for ( const [ p, u ] of [ [ [ 0, 0.43, 0 ], 0.9 ], [ [ 0, 0.24, 0 ], 0.9 ], [ [ 0, 0.34, - 0.45 ], 0.95 ] ] ) {

			pos.push( ...p ); nrm.push( 1, 0, 0 ); uv.push( u, 0 ); kind.push( PROP.pennant );

		}

		index.push( base, base + 1, base + 2 );

	}

	// a glossy 8 x 10 of the Bull in '80 (held out to be signed)
	quad( PROP.photo, [ - 0.1, 0, - 0.02 ], [ 0.1, 0, - 0.02 ], [ 0.1, 0.0, - 0.27 ], [ - 0.1, 0, - 0.27 ], [ 0, 1, 0 ] );
	// the pitmaster's tongs
	box( PROP.tongs, [ 0, 0.0, - 0.18 ], [ 0.03, 0.02, 0.4 ], 0.45 );
	// a plastic souvenir bag
	box( PROP.bag, [ 0, - 0.2, 0 ], [ 0.22, 0.3, 0.08 ], 0.75 );
	box( PROP.phone, [ 0, 0.0, 0.0 ], [ 0.05, 0.1, 0.018 ], 0.5 );

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
	g.setAttribute( 'aKind', new Float32BufferAttribute( kind, 1 ) );
	g.setIndex( index );
	g.computeBoundingSphere();
	return g;

}

// ---------------------------------------------------------------- materials

function folkMaterial( atlas ) {

	const m = standard( {
		name: 'alley-folk', roughness: 0.8, side: 'double', textures: { bpFolk: atlas },
		attributes: { aDelta: 'vec3f', aNormB: 'vec3f', aRest: 'vec4f', aWho: 'vec4f', aAnim: 'vec4f', aMove: 'vec4f' },
		varyings: { vRest: 'vec4f', vWho: 'vec4f', vLocal: 'vec3f' },
		vertex: /* wgsl */`
	let who = v.aWho;
	let flags = u32( floor( who.z / 16.0 ) );
	let topC = u32( who.x ) % 32u;
	let hat = u32( floor( who.x / 32.0 ) );
	let part = u32( v.aRest.w + 0.5 );
	let k = v.aAnim.x;
	var p = v.position + v.aDelta * k;
	var n = normalize( mix( v.normal, v.aNormB, k ) + vec3f( 1e-4 ) );
	// the head moves rigidly: its centre now, from where this vertex sits on it
	let hc = p - v.aRest.xyz;
	let isHead = part == 3u || part == 4u || part == 7u || part == 8u;
	// kids: a bigger head for the body
	if ( isHead && ( flags & 2u ) != 0u ) { p = hc + v.aRest.xyz * 1.18; }
	// what isn't worn folds away: the coat's skirt (a poncho, a long parka), the brim (a cap), the pom-pom
	// (a knit hat), long hair
	let poncho = ( flags & 1u ) != 0u;
	let longCoat = poncho || topC == 6u;
	let capped = hat == 1u || hat == 3u || hat == 4u || hat == 6u || hat == 8u;
	var keep = true;
	if ( part == 6u && ! longCoat ) { keep = false; }
	if ( part == 4u && ! capped ) { keep = false; }
	if ( part == 7u && hat != 2u ) { keep = false; }
	if ( part == 8u && ( flags & 16u ) == 0u ) { keep = false; }
	// a cap on backwards: the brim round the back of the head
	if ( part == 4u && hat == 8u ) { p = hc + vec3f( - v.aRest.x, v.aRest.y, - v.aRest.z * 0.85 ); }
	// ponchos and parkas stand off the body; the poncho's skirt flares
	if ( poncho && ( part == 0u || part == 6u ) ) { p += n * select( 0.02, 0.035, part == 6u ); }
	// (folded to one point inside the body: no triangles left to see)
	if ( ! keep ) { p = vec3f( 0.0, 1.1, 0.02 ); }
	// breathing and shifting weight (standing people), a little
	let seed = who.y;
	let sw = sin( frame.time * ( 0.5 + 0.3 * seed ) + seed * 40.0 ) * v.aAnim.y;
	p.x += sw * 0.012 * max( p.y - 0.5, 0.0 );
	v.position = p;
	v.normal = n;
	// how he moved since the last frame, for the motion vectors (the TAA): his step, his gesture
	let pPrev = p + v.aDelta * ( v.aAnim.z - k );
	v.prevWorldOffset = ( v.model * vec4f( pPrev - p, 0.0 ) ).xyz - v.aMove.xyz;
	o.vRest = v.aRest;
	o.vWho = who;
	o.vLocal = p;
`,
		surface: /* wgsl */`
	let who = in.vs.vWho;
	let R = in.vs.vRest;
	let part = u32( R.w + 0.5 );
	let topC = u32( who.x ) % 32u;
	let hat = u32( floor( who.x / 32.0 ) );
	let seed = who.y;
	let pantsC = u32( who.z ) % 16u;
	let flags = u32( floor( who.z / 16.0 ) );
	let jersey = who.w;
	let h = fract( sin( vec4f( seed * 12.9898, seed * 78.233, seed * 39.346, seed * 11.135 ) ) * 43758.5453 );
	let red = vec3f( 0.42, 0.018, 0.028 );
	let navy = vec3f( 0.012, 0.02, 0.06 );
	let white = vec3f( 0.74, 0.73, 0.7 );
	// the lettering: on the chest (the front, seen from in front: +x on his right is the viewer's left)
	// or across the back, from the atlas
	let back = R.z > 0.04;
	let lu = select( 0.5 - R.x / 0.34, 0.5 + R.x / 0.34, back );
	let lv = select( ( 1.36 - R.y ) / 0.3, ( 1.42 - R.y ) / 0.42, back );
	var cell = select( -1.0, jersey - 1.0, back && jersey > 0.5 );
	// the fronts by the top: the script on jackets and jerseys, PHILLIES on the hoodies, the Rays
	var front = -1.0;
	if ( topC == 0u || topC == 4u ) { front = 27.0; }
	if ( topC == 1u || topC == 16u ) { front = 24.0; }
	if ( topC == 2u || topC == 3u || topC == 9u ) { front = 25.0; }
	if ( topC == 11u ) { front = 26.0; }
	if ( topC == 18u ) { front = 28.0; }
	if ( topC == 7u ) { front = 29.0; }
	if ( topC == 10u ) { front = 30.0; }
	if ( topC == 17u ) { front = 31.0; }
	if ( ! back && R.z < -0.04 ) { cell = front; }
	let inCell = part == 0u && cell >= 0.0 && lu > 0.0 && lu < 1.0 && lv > 0.0 && lv < 1.0;
	let cuv = ( vec2f( cell % ${ COLS }.0, floor( cell / ${ COLS }.0 ) ) + clamp( vec2f( lu, lv ), vec2f( 0.02 ), vec2f( 0.98 ) ) ) / vec2f( ${ COLS }.0, ${ ROWS }.0 );
	let letter = textureSample( bpFolk, smpAnisoClamp, select( vec2f( 0.999, 0.999 ), cuv, inCell ) );
	// the top
	var top = red;
	var sleeve = red;
	var rough = 0.85;
	var sheen = 0.0;
	var pin = false;
	switch topC {
		case 0u: { top = mix( red, red * 0.8, h.x ); sleeve = top; }
		case 1u: { top = red * 1.1; sleeve = top; rough = 0.35; sheen = 1.0; }
		case 2u: { top = white; sleeve = red; pin = true; }
		case 3u: { top = vec3f( 0.33, 0.33, 0.34 ); sleeve = mix( vec3f( 0.3 ), red, step( 0.5, h.z ) ); }
		case 4u: { top = vec3f( 0.3, 0.3, 0.31 ) * mix( 0.8, 1.1, h.x ); sleeve = top; }
		case 5u: { top = vec3f( 0.018, 0.016, 0.015 ); sleeve = top; rough = 0.3; }
		case 6u: { top = mix( navy, vec3f( 0.02, 0.03, 0.02 ), h.x ); sleeve = top; rough = 0.55; }
		case 7u: { top = vec3f( 0.0, 0.065, 0.075 ); sleeve = vec3f( 0.3, 0.31, 0.32 ); rough = 0.45; }
		case 8u: { top = vec3f( 0.3, 0.17, 0.07 ); sleeve = top; rough = 0.9; }
		case 9u: { top = vec3f( 0.3, 0.46, 0.66 ); sleeve = top; }
		case 10u: { top = vec3f( 0.75, 0.16, 0.02 ); sleeve = vec3f( 0.015 ); rough = 0.5; }
		case 11u: { top = vec3f( 0.01, 0.025, 0.08 ); sleeve = vec3f( 0.32, 0.55, 0.8 ); }
		case 12u: { top = vec3f( 0.38, 0.02, 0.03 ); sleeve = top; }
		case 13u: { top = vec3f( 0.015 ); sleeve = top; rough = 0.5; }
		case 14u: { top = vec3f( 0.4, 0.02, 0.03 ); sleeve = top; rough = 0.6; }
		case 15u: { top = vec3f( 0.4, 0.02, 0.03 ); sleeve = vec3f( 0.72, 0.71, 0.68 ); }
		case 16u: { top = red * 1.05; sleeve = top; rough = 0.4; }
		case 17u: { top = vec3f( 0.02 ); sleeve = vec3f( 0.25, 0.25, 0.26 ); }
		case 18u: { top = red; sleeve = red; }
		case 19u: { top = mix( vec3f( 0.12, 0.13, 0.06 ), vec3f( 0.22, 0.19, 0.1 ), step( 0.5, fract( sin( dot( floor( in.P.xz * 9.0 + in.P.y * 7.0 ), vec2f( 12.9, 78.2 ) ) ) * 43758.5 ) ) ); sleeve = top; }
		default: { }
	}
	// pants
	var pants = vec3f( 0.035, 0.05, 0.1 ) * mix( 0.8, 1.3, h.y );
	switch pantsC {
		case 1u: { pants = vec3f( 0.3, 0.24, 0.15 ); }
		case 2u: { pants = vec3f( 0.018 ); }
		case 3u: { pants = vec3f( 0.2, 0.2, 0.21 ); }
		case 4u: { pants = vec3f( 0.03, 0.03, 0.035 ); }
		default: { }
	}
	if ( topC == 14u || topC == 13u ) { pants = select( vec3f( 0.3, 0.24, 0.15 ), vec3f( 0.02 ), topC == 13u ); }
	// skin, hair
	let si = h.w;
	var skin = vec3f( 0.56, 0.35, 0.24 );
	if ( si > 0.55 ) { skin = vec3f( 0.45, 0.27, 0.17 ); }
	if ( si > 0.76 ) { skin = vec3f( 0.26, 0.14, 0.075 ); }
	if ( si > 0.88 ) { skin = vec3f( 0.13, 0.07, 0.04 ); }
	var hair = select( select( vec3f( 0.02, 0.015, 0.01 ), vec3f( 0.11, 0.065, 0.03 ), h.z > 0.55 ), vec3f( 0.3, 0.28, 0.26 ), h.z > 0.86 );
	if ( ( flags & 16u ) != 0u && h.x > 0.6 ) { hair = vec3f( 0.32, 0.2, 0.08 ); }
	// the hat's colour
	var capC = red;
	switch hat {
		case 2u: { capC = select( red, navy, h.y > 0.8 ); }
		case 3u: { capC = vec3f( 0.015 ); }
		case 4u: { capC = navy; }
		case 6u: { capC = vec3f( 0.015 ); }
		case 7u: { capC = vec3f( 0.25, 0.25, 0.26 ); }
		case 10u: { capC = vec3f( 0.12, 0.1, 0.08 ); }
		default: { }
	}
	var c = top;
	var e = vec3f( 0.0 );
	let L = R.xyz;
	if ( part == 0u ) {
		// the sleeves below the shoulder
		if ( abs( L.x ) > 0.21 ) { c = sleeve; }
		if ( pin && abs( L.x ) <= 0.21 ) { c = c * ( 1.0 - 0.45 * step( 0.84, fract( ( L.x ) * 60.0 ) ) ); }
		// a hoodie's kangaroo pocket and the drawstrings
		if ( ( topC == 0u || topC == 4u ) && L.z < -0.05 && L.y < 1.06 && L.y > 0.9 && abs( L.x ) < 0.12 ) { c = c * 0.8; }
		// the vests and the aprons
		if ( topC == 13u && L.y > 0.95 && L.y < 1.4 && abs( L.x ) < 0.21 ) {
			c = vec3f( 0.55, 0.62, 0.02 );
			if ( abs( L.y - 1.08 ) < 0.025 || abs( L.y - 1.2 ) < 0.025 ) { c = vec3f( 0.6 ); rough = 0.3; }
			e = c * 0.06;
		}
		if ( ( topC == 12u || topC == 17u ) && L.z < -0.02 && L.y < 1.28 && abs( L.x ) < 0.2 ) { c = select( vec3f( 0.02 ), vec3f( 0.36, 0.02, 0.03 ), topC == 17u ); }
		if ( topC == 15u && L.y > 1.38 ) { c = sleeve; }
		// the lettering over it
		c = mix( c, letter.rgb, letter.a * select( 0.0, 1.0, inCell ) );
	}
	if ( part == 6u ) { c = top; }
	if ( part == 1u ) { c = pants; rough = 0.9; }
	if ( part == 2u ) { c = skin; rough = 0.6; if ( topC == 13u || topC == 8u || h.x > 0.8 ) { c = select( c, vec3f( 0.02 ), R.y < 0.95 && L.y < 1.0 ); } }
	if ( part == 5u ) { c = select( vec3f( 0.02 ), vec3f( 0.6, 0.58, 0.55 ), h.z > 0.7 ); rough = 0.5; }
	if ( part == 3u || part == 4u || part == 7u || part == 8u ) {
		let hd = L;
		c = skin; rough = 0.6;
		// hair on the back and top, a bald crown
		let hairline = 0.03 - 0.07 * smoothstep( -0.02, 0.07, hd.z );
		if ( hd.y > hairline && hat != 9u ) { c = hair; rough = 0.7; }
		if ( hat == 9u && hd.y > 0.0 && hd.y < 0.035 && hd.z > -0.03 ) { c = hair; }
		// the face: brows, the eyes, the nose's shade, the mouth
		let face = hd.z < -0.05;
		if ( face && abs( abs( hd.x ) - 0.033 ) < 0.016 && abs( hd.y - 0.012 ) < 0.008 ) { c = vec3f( 0.03, 0.025, 0.02 ); }
		if ( face && abs( abs( hd.x ) - 0.035 ) < 0.022 && abs( hd.y - 0.034 ) < 0.006 ) { c = hair * 0.8; }
		if ( face && abs( hd.x ) < 0.022 && abs( hd.y + 0.052 ) < 0.006 ) { c = skin * 0.55; }
		if ( face && abs( hd.x ) < 0.012 && hd.y < 0.0 && hd.y > -0.03 ) { c = skin * 0.85; }
		// a beard, a moustache, glasses
		if ( ( flags & 8u ) != 0u && hd.y < -0.03 && hd.z < 0.02 ) { c = mix( c, hair, 0.8 ); }
		if ( ( flags & 64u ) != 0u && face && abs( hd.x ) < 0.035 && abs( hd.y + 0.036 ) < 0.01 ) { c = hair; }
		if ( ( flags & 4u ) != 0u && face && abs( hd.y - 0.012 ) < 0.018 && ( abs( abs( hd.x ) - 0.034 ) < 0.02 ) && ( abs( abs( hd.x ) - 0.034 ) > 0.013 || abs( hd.y - 0.012 ) > 0.012 ) ) { c = vec3f( 0.02 ); rough = 0.2; }
		// the hat over it
		let capped = hat == 1u || hat == 3u || hat == 4u || hat == 6u || hat == 8u || hat == 10u;
		if ( capped && hd.y > 0.03 ) { c = capC; rough = 0.7; }
		if ( ( hat == 2u || hat == 7u ) && hd.y > 0.0 ) { c = capC * ( 0.85 + 0.15 * step( 0.5, fract( hd.x * 90.0 ) ) ); rough = 0.95; }
		// the cap's P on the front
		if ( ( hat == 1u || hat == 3u ) && face && hd.y > 0.045 && hd.y < 0.085 && abs( hd.x ) < 0.017 ) { c = select( white, red, hat == 3u ); }
		if ( hat == 5u ) {
			c = select( top, skin, dot( normalize( hd ), vec3f( 0.0, 0.1, -1.0 ) ) > 0.62 );
			if ( dot( normalize( hd ), vec3f( 0.0, 0.1, -1.0 ) ) > 0.62 ) { c = skin; }
		}
		if ( part == 4u ) { c = capC; rough = 0.7; }
		if ( part == 7u ) { c = select( white, capC, h.x > 0.5 ); rough = 0.95; }
		if ( part == 8u ) { c = hair; rough = 0.75; }
	}
	// a clear poncho over it all (the 27th): glossy, a little milky, the clothes showing through
	if ( ( flags & 1u ) != 0u && ( part == 0u || part == 6u || ( part == 3u && hat == 5u && R.y > 0.0 && L.z > -0.05 ) ) ) {
		c = mix( c, select( vec3f( 0.55, 0.56, 0.57 ), vec3f( 0.4, 0.03, 0.04 ), h.y > 0.6 ), 0.45 );
		rough = 0.18;
	}
	// out in the rain: soaked shoulders
	let wetK = frame.wet * select( 0.0, 1.0, ( flags & 32u ) != 0u );
	c = c * ( 1.0 - 0.3 * wetK * select( 0.0, 1.0, part <= 1u || part == 6u ) );
	rough = mix( rough, 0.3, wetK );
	s.albedo = c;
	s.roughness = rough;
	if ( sheen > 0.5 ) { s.specularIntensity = 1.4; }
	// the Alley's lamps and the counters' glow on them after dark
	s.emissive = c * smoothstep( 0.15, 0.7, frame.night ) * 0.14 + e;
`,
	} );
	m.underwaterLighting = 'none';
	m.setDefine( 'DRY', 1 );
	return m;

}

function propMaterial( signs ) {

	const m = standard( {
		name: 'alley-folk-props', roughness: 0.6, side: 'double', textures: { bpSigns: signs },
		attributes: { aKind: 'f32', aProp: 'vec4f', aMove: 'vec4f' },
		varyings: { vKind: 'f32', vProp: 'vec4f', vUV: 'vec2f' },
		vertex: /* wgsl */`
	// prop: x its kind, y its variant (the sign's cell, the umbrella's colours), z how open (the umbrella),
	// w unused
	let pr = v.aProp;
	if ( abs( v.aKind - pr.x ) > 0.5 ) { v.position = vec3f( 0.0 ); }
	// the umbrella folds up
	if ( pr.x > 2.5 && pr.x < 3.5 && v.position.y > 0.7 ) {
		let f = clamp( pr.z, 0.0, 1.0 );
		v.position = vec3f( v.position.x * mix( 0.05, 1.0, f ), mix( 0.5, v.position.y, f ), v.position.z * mix( 0.05, 1.0, f ) );
	}
	// the towel waves
	if ( pr.x > 6.5 && pr.x < 7.5 ) { v.position.x += sin( frame.time * 7.0 + pr.y * 5.0 + v.position.z * 6.0 ) * 0.08 * max( - v.position.y, 0.0 ) * pr.z; }
	o.vKind = v.aKind;
	o.vProp = pr;
	o.vUV = v.uv;
	// carried along with the hand since the last frame (the motion vectors)
	v.prevWorldOffset = - v.aMove.xyz;
`,
		surface: /* wgsl */`
	let k = u32( in.vs.vProp.x + 0.5 );
	let variant = in.vs.vProp.y;
	let uv = in.vs.vUV;
	// the sign's face: its cell of the signs atlas (4 x 4); the back plain cardboard
	let cell = variant;
	let suv = ( vec2f( cell % 4.0, floor( cell / 4.0 ) ) + clamp( uv, vec2f( 0.01 ), vec2f( 0.99 ) ) ) / 4.0;
	let t = textureSample( bpSigns, smpAnisoClamp, select( vec2f( 0.99, 0.99 ), suv, uv.x <= 1.0 && uv.y <= 1.0 ) ).rgb;
	var c = vec3f( 0.5 );
	var rough = 0.6;
	var e = vec3f( 0.0 );
	switch k {
		case 0u: { c = select( vec3f( 0.55, 0.45, 0.3 ), t, uv.x <= 1.0 ); rough = 0.9; }
		case 1u: { c = select( vec3f( 0.75, 0.55, 0.12 ), vec3f( 0.6, 0.6, 0.62 ), variant > 0.5 ); rough = 0.15; if ( uv.y > 0.85 ) { c = vec3f( 0.8, 0.78, 0.7 ); } }
		case 2u: { c = select( vec3f( 0.7, 0.68, 0.6 ), vec3f( 0.62, 0.52, 0.3 ), variant > 0.5 ); rough = 0.8; }
		case 3u: {
			c = vec3f( 0.02 );
			if ( uv.x > 0.32 ) {
				// the canopy: a golf umbrella in red and white, a Phillies one in red, or plain black
				let seg = fract( uv.y * 0.5 ) < 0.5;
				c = select( select( vec3f( 0.02 ), vec3f( 0.38, 0.02, 0.03 ), variant > 0.5 ), select( vec3f( 0.7 ), vec3f( 0.38, 0.02, 0.03 ), seg ), variant > 1.5 );
				rough = 0.35;
			}
		}
		case 4u: { c = vec3f( 0.28, 0.12, 0.04 ); rough = 0.5; }
		case 5u: { c = select( vec3f( 0.05 ), vec3f( 0.45, 0.47, 0.5 ), variant > 0.5 ); rough = 0.3; e = vec3f( 0.3, 0.5, 0.9 ) * step( 0.5, variant ) * 0.3; }
		case 6u: { c = vec3f( 0.5, 0.45, 0.35 ); rough = 0.3; }
		case 7u: { c = vec3f( 0.78, 0.77, 0.74 ); rough = 0.95; }
		case 8u: { c = select( vec3f( 0.55, 0.42, 0.25 ), select( vec3f( 0.7, 0.66, 0.55 ), vec3f( 0.8, 0.55, 0.12 ), uv.x > 0.82 ), uv.x > 0.1 ); rough = 0.85; }
		case 9u: { c = select( vec3f( 0.3, 0.2, 0.1 ), vec3f( 0.42, 0.02, 0.03 ), uv.x > 0.8 ); rough = 0.7; }
		case 10u: { c = t; rough = 0.25; }
		case 11u: { c = vec3f( 0.5, 0.5, 0.52 ); rough = 0.3; }
		case 12u: { c = vec3f( 0.7, 0.7, 0.68 ); rough = 0.4; }
		default: { c = vec3f( 0.02 ); rough = 0.3; }
	}
	s.albedo = c;
	s.roughness = rough;
	s.metalness = select( 0.0, 0.8, k == 11u || k == 6u );
	s.emissive = e + c * smoothstep( 0.15, 0.7, frame.night ) * 0.14;
`,
	} );
	m.underwaterLighting = 'none';
	m.setDefine( 'DRY', 1 );
	return m;

}

// ---------------------------------------------------------------- the people

const _m = new Matrix4(), _q = new Quaternion(), _v = new Vector3(), _s = new Vector3(), _up = new Vector3( 0, 1, 0 ), _h = new Vector3();

export class Folk {

	// signs: [ draw( ctx, w, h ) ], up to 16 homemade signs (the sign prop's variants)
	constructor( parent, { signs = [] } = {} ) {

		this.parent = parent;
		this.list = [];
		this.props = [];
		this.meshes = new Map();
		this.atlas = canvasTexture( CELL * COLS, CELL * ROWS, drawAtlas, 'folkAtlas' );
		this.signAtlas = canvasTexture( 1024, 1024, ( ctx, w, h ) => {

			ctx.fillStyle = '#8c7350';
			ctx.fillRect( 0, 0, w, h );
			const cw = w / 4, ch = h / 4;
			signs.slice( 0, 15 ).forEach( ( draw, i ) => {

				ctx.save();
				ctx.translate( ( i % 4 ) * cw, Math.floor( i / 4 ) * ch );
				ctx.beginPath(); ctx.rect( 0, 0, cw, ch ); ctx.clip();
				draw( ctx, cw, ch );
				ctx.restore();

			} );
			// the last cell: a glossy 8 x 10, the Bull at bat in 1980's powder blue
			ctx.save();
			ctx.translate( 3 * cw, 3 * ch );
			ctx.fillStyle = '#5b6f86'; ctx.fillRect( 0, 0, cw, ch );
			ctx.fillStyle = '#8aa6c8'; ctx.fillRect( cw * 0.35, ch * 0.25, cw * 0.3, ch * 0.5 );
			ctx.fillStyle = '#6b1422'; ctx.beginPath(); ctx.arc( cw * 0.5, ch * 0.2, cw * 0.1, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = '#2a2a2a'; ctx.fillRect( cw * 0.58, ch * 0.05, cw * 0.04, ch * 0.35 );
			ctx.restore();

		}, 'folkSigns' );
		this.material = folkMaterial( this.atlas );
		this.propMat = propMaterial( this.signAtlas );
		this.jerseys = Object.fromEntries( BACKS.map( ( [ key ], i ) => [ key, i + 1 ] ) );

	}

	// a person: which pair of poses, where (field frame, y his feet), which way he faces (yaw 0 faces -z),
	// who he is ( look: { top, hat, pants, jersey, poncho, kid, glasses, beard, woman, open } ), how far
	// into the gesture ( k ), a scale (his height), and on which nights he's there ( 1 the 27th, 2 the 29th)
	add( pair, { x, y = 0, z, yaw = 0, look = {}, k = 0, scale = 1, sway = 1, nights = 3, seed = null } ) {

		const s = seed ?? ( ( this.list.length * 0.6180339 + 0.137 ) % 1 );
		const p = { pair, x, y, z, yaw, look, k, scale: look.kid ? scale * 0.7 : scale, sway, nights, seed: s, shown: true, visible: true };
		this.list.push( p );
		return p;

	}

	// a prop in his hand: 'right', 'left', or 'both' (between the hands); an offset turn (yaw about the
	// hand), a variant (the sign's cell, the umbrella's colours)
	hold( p, kind, { hand = 'right', variant = 0, open = 1, turn = 0, offset = [ 0, 0, 0 ] } = {} ) {

		const pr = { person: p, kind: PROP[ kind ], hand, variant, open, turn, offset, shown: true };
		this.props.push( pr );
		( p.props ||= [] ).push( pr );
		return pr;

	}

	_whoOf( p ) {

		const L = p.look;
		const flags = ( L.poncho ? 1 : 0 ) | ( L.kid ? 2 : 0 ) | ( L.glasses ? 4 : 0 ) | ( L.beard ? 8 : 0 ) | ( L.woman ? 16 : 0 ) | ( L.open ? 32 : 0 ) | ( L.mustache ? 64 : 0 );
		return [ ( L.top ?? 0 ) + 32 * ( L.hat ?? 0 ), p.seed, ( L.pants ?? 0 ) + 16 * flags, L.jersey ? ( this.jerseys[ L.jersey ] || 0 ) : 0 ];

	}

	build() {

		const byPair = new Map();
		for ( const p of this.list ) {

			if ( ! byPair.has( p.pair ) ) byPair.set( p.pair, [] );
			byPair.get( p.pair ).push( p );

		}

		for ( const [ pair, list ] of byPair ) {

			const [ a, b ] = PAIRS[ pair ];
			const g = pairGeometry( a, b );
			const who = new Float32Array( list.length * 4 ), anim = new Float32Array( list.length * 4 ), move = new Float32Array( list.length * 4 );
			list.forEach( ( p, i ) => {

				who.set( this._whoOf( p ), i * 4 );
				p.index = i;

			} );
			// the near and the far versions share the people (their matrices and records)
			const gFar = pairGeometry( a, b, true );
			const attrs = { aWho: new InstancedBufferAttribute( who, 4 ), aAnim: new InstancedBufferAttribute( anim, 4 ), aMove: new InstancedBufferAttribute( move, 4 ) };
			for ( const [ k, v ] of Object.entries( attrs ) ) {

				g.setAttribute( k, v );
				gFar.setAttribute( k, v );

			}

			const mesh = new InstancedMesh( g, this.material, list.length );
			const far = new InstancedMesh( gFar, this.material, list.length );
			far.instanceMatrix = mesh.instanceMatrix;
			for ( const [ m, name ] of [ [ mesh, 'alley-folk-' + pair ], [ far, 'alley-folk-far-' + pair ] ] ) {

				m.name = name;
				m.castShadow = false;
				m.receiveShadow = true;
				m.frustumCulled = false;
				m.userData.dynamic = true;
				this.parent.add( m );

			}

			far.visible = false;
			this.meshes.set( pair, { mesh, far, list, anim, move, poses: [ POSES[ a ], POSES[ b ] ] } );

		}

		// the props
		const pg = propGeometry();
		const n = Math.max( 1, this.props.length );
		const data = new Float32Array( n * 4 );
		pg.setAttribute( 'aProp', new InstancedBufferAttribute( data, 4 ) );
		this.propMove = new Float32Array( n * 4 );
		pg.setAttribute( 'aMove', new InstancedBufferAttribute( this.propMove, 4 ) );
		this.propMesh = new InstancedMesh( pg, this.propMat, n );
		this.propMesh.name = 'alley-folk-props';
		this.propMesh.castShadow = false;
		this.propMesh.receiveShadow = true;
		this.propMesh.frustumCulled = false;
		this.propMesh.userData.dynamic = true;
		this.propData = data;
		this.parent.add( this.propMesh );

		// soft contact shadows on the ground under the ones standing
		const blob = new PlaneGeometry( 1, 1 );
		blob.rotateX( - Math.PI / 2 );
		const bm = standard( { name: 'alley-folk-contact', color: new Color( 0, 0, 0 ), transparent: true, depthWrite: false, lit: false,
			surface: 'let r = length( in.uv - 0.5 ) * 2.0; s.albedo = vec3f( 0.0 ); s.alpha = ( 1.0 - smoothstep( 0.15, 1.0, r ) ) * 0.5;' } );
		bm.underwaterLighting = 'none';
		this.blobs = new InstancedMesh( blob, bm, Math.max( 1, this.list.length ) );
		this.blobs.name = 'alley-folk-contact';
		this.blobs.frustumCulled = false;
		this.blobs.castShadow = false;
		this.blobs.userData.dynamic = true;
		this.parent.add( this.blobs );
		this.update();
		// they stay in their place: one sphere round it for the frustum culling (the TV cameras on the
		// infield don't pay for them)
		if ( this.bounds ) for ( const m of [ ...[ ...this.meshes.values() ].flatMap( ( e ) => [ e.mesh, e.far ] ), this.propMesh, this.blobs ] ) {

			m.boundingSphere = this.bounds.clone();
			m.frustumCulled = true;

		}

	}

	// the level of detail for this camera: past ~45 m (the TV cameras, the stands across the park) the
	// coarser figures, and no props or contact shadows (a few pixels each by then)
	lod( camera ) {

		if ( ! this.bounds || ! camera ) return;
		const c = ( this._c ||= new Vector3() ).copy( camera.position );
		this.parent.updateWorldMatrix?.( true, false );
		const inv = ( this._inv ||= new Matrix4() ).copy( this.parent.matrixWorld ).invert();
		c.applyMatrix4( inv );
		// the distance to the nearest part of the place, and the lens (a long one sees them big)
		const d = Math.max( 0, c.distanceTo( this.bounds.center ) - this.bounds.radius * 0.6 ) * Math.tan( ( camera.fov || 60 ) * Math.PI / 360 ) / Math.tan( 30 * Math.PI / 180 );
		const near = d < 45;
		if ( near === this._near ) return;
		this._near = near;
		for ( const { mesh, far } of this.meshes.values() ) {

			mesh.visible = near;
			far.visible = ! near;

		}

		this.propMesh.visible = near;
		this.blobs.visible = near;

	}

	// the joint of his hand now (his own frame, before his scale), between the two poses by his k
	handAt( p, side ) {

		const [ A, B ] = this.meshes.get( p.pair ).poses;
		const a = handOf( A, side ), b = handOf( B, side );
		return [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * p.k, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * p.k, a[ 2 ] + ( b[ 2 ] - a[ 2 ] ) * p.k ];

	}

	update() {

		let blobs = 0;
		// the move since the last frame, turned from the field frame into the world's (motion vectors);
		// someone who has just appeared hasn't moved
		const cy = Math.cos( this.frameYaw || 0 ), sy = Math.sin( this.frameYaw || 0 );
		const moved = ( o, x, y, z, out, i ) => {

			const fresh = o.px === undefined;
			const dx = fresh ? 0 : x - o.px, dy = fresh ? 0 : y - o.py, dz = fresh ? 0 : z - o.pz;
			out[ i * 4 ] = dx * cy + dz * sy; out[ i * 4 + 1 ] = dy; out[ i * 4 + 2 ] = - dx * sy + dz * cy;
			o.px = x; o.py = y; o.pz = z;

		};

		for ( const { mesh, list, anim, move } of this.meshes.values() ) {

			list.forEach( ( p, i ) => {

				const on = p.shown && p.visible;
				_q.setFromAxisAngle( _up, p.yaw );
				_m.compose( _v.set( p.x, p.y, p.z ), _q, _s.setScalar( on ? p.scale : 0 ) );
				mesh.setMatrixAt( i, _m );
				if ( ! on ) p.px = undefined;
				else moved( p, p.x, p.y, p.z, move, i );
				anim[ i * 4 ] = p.k;
				anim[ i * 4 + 1 ] = p.sway;
				anim[ i * 4 + 2 ] = on && p.kPrev !== undefined ? p.kPrev : p.k;
				p.kPrev = on ? p.k : undefined;
				if ( on && ! p.noBlob && p.pair !== 'ride' ) {

					_m.compose( _v.set( p.x, p.y + 0.015, p.z ), _q, _s.set( 0.75 * p.scale, 1, 0.55 * p.scale ) );
					this.blobs.setMatrixAt( blobs ++, _m );

				}

			} );
			mesh.instanceMatrix.needsUpdate = true;
			mesh.geometry.getAttribute( 'aAnim' ).needsUpdate = true;
			mesh.geometry.getAttribute( 'aMove' ).needsUpdate = true;

		}

		this.blobs.count = Math.max( 1, blobs );
		if ( ! blobs ) this.blobs.setMatrixAt( 0, _m.makeScale( 0, 0, 0 ) );
		this.blobs.instanceMatrix.needsUpdate = true;
		// the props, in the hands
		this.props.forEach( ( pr, i ) => {

			const p = pr.person;
			const on = pr.shown && p.shown && p.visible;
			let hp;
			if ( pr.hand === 'both' ) {

				const r = this.handAt( p, 1 ), l = this.handAt( p, - 1 );
				hp = [ ( r[ 0 ] + l[ 0 ] ) / 2, ( r[ 1 ] + l[ 1 ] ) / 2, ( r[ 2 ] + l[ 2 ] ) / 2 ];

			} else hp = this.handAt( p, pr.hand === 'left' ? - 1 : 1 );
			_h.set( hp[ 0 ] + pr.offset[ 0 ], hp[ 1 ] + pr.offset[ 1 ], hp[ 2 ] + pr.offset[ 2 ] ).multiplyScalar( p.scale ).applyAxisAngle( _up, p.yaw );
			_q.setFromAxisAngle( _up, p.yaw + pr.turn );
			_m.compose( _v.set( p.x + _h.x, p.y + _h.y, p.z + _h.z ), _q, _s.setScalar( on ? p.scale / ( p.look.kid ? 0.8 : 1 ) : 0 ) );
			this.propMesh.setMatrixAt( i, _m );
			this.propData.set( [ pr.kind, pr.variant, pr.open, 0 ], i * 4 );
			if ( ! on ) pr.px = undefined;
			else moved( pr, _v.x, _v.y, _v.z, this.propMove, i );

		} );
		this.propMesh.instanceMatrix.needsUpdate = true;
		this.propMesh.geometry.getAttribute( 'aProp' ).needsUpdate = true;
		this.propMesh.geometry.getAttribute( 'aMove' ).needsUpdate = true;

	}

}

// a pose's hand on one side (the left mirrors the right unless the pose gives it its own)
function handOf( pose, side ) {

	const own = side < 0 ? pose[ 'L:hand' ] : null;
	if ( own ) return own;
	const j = pose.hand || BASE.hand;
	return [ j[ 0 ] * side, j[ 1 ], j[ 2 ] ];

}
