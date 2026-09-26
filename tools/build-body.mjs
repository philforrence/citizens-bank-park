// The ballplayer's body: the MakeHuman base mesh (makehumancommunity.org; the mesh, its targets, the
// default skeleton and its weights were all released CC0 in 2020) shaped into a young, athletic man,
// scaled to 6'2", the fingers closed into a grip, and skinned to the players' 17-bone rig
// (src/ballpark/game/Rig.js). Written to src/ballpark/game/data/body.js.
//
//   node tools/build-body.mjs
//
// The MakeHuman files are fetched from GitHub into tools/body/.cache the first time.
//
// What's baked in:
//  - the shape: the macro targets (male, young, a mix of ethnicities, muscular, tall, ideal proportions)
//  - the grip: the finger bones curled (skinned once with MakeHuman's own weights) round a bat handle
//  - the rig: every MakeHuman bone mapped onto one of ours (the spine to the torso, the fingers to the
//    hand, the neck shared by the torso and the head, ...); each vertex keeps its 4 strongest weights
//  - the uniform's layout, for the shader: how far along the arm (from the shoulder joint) and along the
//    leg (from the hip joint) each vertex is, so the sleeve hem, the pants' cuff and the socks are cut
//    cleanly whatever the mesh's edges; and the cloth's thickness (the jersey and pants stand off the
//    skin, looser at the hems)
//  - the bare feet are left out (the cleats are built on the foot bone in Rig.js); the eyes are kept
//  - the joints of the bind pose (the rig's dimensions come from them) and face landmarks for the shader
//
// Frames: MakeHuman faces +z with +x his left; ours faces -z with +x his right (a half turn about y).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CACHE = new URL( './body/.cache/', import.meta.url ).pathname;
const OUT = new URL( '../src/ballpark/game/data/body.js', import.meta.url ).pathname;
const SRC = 'https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data/';
const HEIGHT = 1.88; // 6'2"

// the shape: macro targets and their weights
const TARGETS = [
	[ 'targets/macrodetails/caucasian-male-young.target', 0.5 ],
	[ 'targets/macrodetails/african-male-young.target', 0.3 ],
	[ 'targets/macrodetails/asian-male-young.target', 0.2 ],
	[ 'targets/macrodetails/universal-male-young-maxmuscle-averageweight.target', 0.6 ],
	[ 'targets/macrodetails/universal-male-young-maxmuscle-maxweight.target', 0.12 ],
	[ 'targets/macrodetails/height/male-young-maxmuscle-averageweight-maxheight.target', 0.3 ],
	[ 'targets/macrodetails/proportions/male-young-maxmuscle-averageweight-idealproportions.target', 0.5 ],
];

async function get( path ) {

	const file = join( CACHE, path.replace( /\//g, '_' ) );
	if ( ! existsSync( file ) ) {

		mkdirSync( CACHE, { recursive: true } );
		const r = await fetch( SRC + path );
		if ( ! r.ok ) throw new Error( `${ path }: ${ r.status }` );
		writeFileSync( file, Buffer.from( await r.arrayBuffer() ) );

	}

	return readFileSync( file, 'utf8' );

}

// ---------------------------------------------------------------- small vector helpers

const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] ];
const add = ( a, b ) => [ a[ 0 ] + b[ 0 ], a[ 1 ] + b[ 1 ], a[ 2 ] + b[ 2 ] ];
const mul = ( a, k ) => [ a[ 0 ] * k, a[ 1 ] * k, a[ 2 ] * k ];
const dot = ( a, b ) => a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] + a[ 2 ] * b[ 2 ];
const cross = ( a, b ) => [ a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ], a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ], a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ] ];
const len = ( a ) => Math.hypot( a[ 0 ], a[ 1 ], a[ 2 ] );
const norm = ( a ) => mul( a, 1 / ( len( a ) || 1 ) );
const clamp = ( x, a, b ) => Math.min( b, Math.max( a, x ) );
const smooth = ( a, b, x ) => {

	const t = clamp( ( x - a ) / ( b - a ), 0, 1 );
	return t * t * ( 3 - 2 * t );

};

// 3x4 affine matrices as { r: 3x3 row-major, t: [3] }
const ident = () => ( { r: [ 1, 0, 0, 0, 1, 0, 0, 0, 1 ], t: [ 0, 0, 0 ] } );
const apply = ( m, v ) => [
	m.r[ 0 ] * v[ 0 ] + m.r[ 1 ] * v[ 1 ] + m.r[ 2 ] * v[ 2 ] + m.t[ 0 ],
	m.r[ 3 ] * v[ 0 ] + m.r[ 4 ] * v[ 1 ] + m.r[ 5 ] * v[ 2 ] + m.t[ 1 ],
	m.r[ 6 ] * v[ 0 ] + m.r[ 7 ] * v[ 1 ] + m.r[ 8 ] * v[ 2 ] + m.t[ 2 ],
];
const compose = ( a, b ) => {

	const r = [];
	for ( let i = 0; i < 3; i ++ ) for ( let j = 0; j < 3; j ++ ) r.push( a.r[ i * 3 ] * b.r[ j ] + a.r[ i * 3 + 1 ] * b.r[ 3 + j ] + a.r[ i * 3 + 2 ] * b.r[ 6 + j ] );
	return { r, t: apply( a, b.t ) };

};
// a rotation by `ang` about the axis `ax` through the point `p`
const rotAbout = ( p, ax, ang ) => {

	const [ x, y, z ] = norm( ax ), c = Math.cos( ang ), s = Math.sin( ang ), C = 1 - c;
	const r = [ c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C ];
	const m = { r, t: [ 0, 0, 0 ] };
	m.t = sub( p, apply( m, p ) );
	return m;

};

// ---------------------------------------------------------------- MakeHuman data

const obj = await get( '3dobjs/base.obj' );
const skel = JSON.parse( await get( 'rigs/default.mhskel' ) );
const mhw = JSON.parse( await get( 'rigs/default_weights.mhw' ) ).weights;
const targets = [];
for ( const [ path, w ] of TARGETS ) targets.push( [ await get( path ), w ] );

const V = [], groups = {};
let group = null;
for ( const line of obj.split( '\n' ) ) {

	if ( line.startsWith( 'v ' ) ) V.push( line.split( /\s+/ ).slice( 1, 4 ).map( Number ) );
	else if ( line.startsWith( 'g ' ) ) group = line.split( /\s+/ )[ 1 ];
	else if ( line.startsWith( 'f ' ) ) ( groups[ group ] ||= [] ).push( line.trim().split( /\s+/ ).slice( 1 ).map( ( s ) => parseInt( s ) - 1 ) );

}

for ( const [ text, w ] of targets ) for ( const line of text.split( '\n' ) ) {

	if ( ! line || line[ 0 ] === '#' ) continue;
	const p = line.trim().split( /\s+/ );
	if ( p.length < 4 ) continue;
	const v = V[ + p[ 0 ] ];
	v[ 0 ] += w * p[ 1 ]; v[ 1 ] += w * p[ 2 ]; v[ 2 ] += w * p[ 3 ];

}

const joint = ( name ) => {

	const ids = skel.joints[ name ];
	return mul( ids.reduce( ( a, i ) => add( a, V[ i ] ), [ 0, 0, 0 ] ), 1 / ids.length );

};
const boneHead = ( b ) => joint( skel.bones[ b ].head ), boneTail = ( b ) => joint( skel.bones[ b ].tail );

// per-vertex MakeHuman weights
const vw = V.map( () => [] );
for ( const [ b, list ] of Object.entries( mhw ) ) for ( const [ i, w ] of list ) vw[ i ].push( [ b, w ] );

// ---------------------------------------------------------------- the grip: curl the fingers

// Each finger bone turns about its head, about the axis across the finger (so the finger folds toward
// the palm); the thumb folds in less. The palm's normal comes from the wrist and the knuckles, turned to
// the side the relaxed fingers already bend toward.
const CURL = { 1: [ 0.35, 0.45, 0.4 ], 2: [ 1.05, 1.35, 0.7 ], 3: [ 1.1, 1.4, 0.75 ], 4: [ 1.15, 1.45, 0.75 ], 5: [ 1.2, 1.45, 0.75 ] };
for ( const side of [ 'L', 'R' ] ) {

	const wrist = boneHead( `wrist.${ side }` );
	const kIndex = boneHead( `finger2-1.${ side }` ), kPinky = boneHead( `finger5-1.${ side }` );
	let palm = norm( cross( sub( kIndex, wrist ), sub( kPinky, kIndex ) ) );
	// the relaxed middle finger's tip lies off its knuckle's line toward the palm
	const k3 = boneHead( `finger3-1.${ side }` ), tip3 = boneTail( `finger3-3.${ side }` );
	const d3 = norm( sub( boneTail( `finger3-1.${ side }` ), k3 ) );
	const off = sub( sub( tip3, k3 ), mul( d3, dot( sub( tip3, k3 ), d3 ) ) );
	if ( dot( off, palm ) < 0 ) palm = mul( palm, - 1 );
	const T = {};
	for ( let f = 1; f <= 5; f ++ ) {

		let parent = ident();
		for ( let s = 1; s <= 3; s ++ ) {

			const b = `finger${ f }-${ s }.${ side }`;
			const h = boneHead( b ), d = norm( sub( boneTail( b ), h ) );
			// fold toward the palm: turning d about ( d x palm ) takes it toward the palm
			let axis = norm( cross( d, palm ) );
			let ang = CURL[ f ][ s - 1 ];
			if ( f === 1 ) {

				// the thumb folds across the palm, toward the index finger's knuckle
				const toward = norm( sub( kIndex, h ) );
				axis = norm( cross( d, add( mul( palm, 0.6 ), toward ) ) );

			}

			// the rotation happens in the parent's moved frame: about the moved head and the moved axis
			const hm = apply( parent, h );
			const am = sub( apply( parent, add( h, axis ) ), hm );
			const m = compose( rotAbout( hm, am, ang ), parent );
			T[ b ] = m;
			parent = m;

		}

	}

	for ( let i = 0; i < V.length; i ++ ) {

		let ws = 0, acc = [ 0, 0, 0 ];
		for ( const [ b, w ] of vw[ i ] ) {

			const m = T[ b ];
			acc = add( acc, mul( m ? apply( m, V[ i ] ) : V[ i ], w ) );
			ws += w;

		}

		if ( vw[ i ].some( ( [ b ] ) => T[ b ] ) && ws > 0 ) V[ i ]._curled = mul( acc, 1 / ws );

	}

}

for ( const v of V ) if ( v._curled ) {

	v[ 0 ] = v._curled[ 0 ]; v[ 1 ] = v._curled[ 1 ]; v[ 2 ] = v._curled[ 2 ];
	delete v._curled;

}

// ---------------------------------------------------------------- into our frame and size

const bodyIds = new Set( groups.body.flat() );
let minY = Infinity, maxY = - Infinity;
for ( const i of bodyIds ) {

	minY = Math.min( minY, V[ i ][ 1 ] );
	maxY = Math.max( maxY, V[ i ][ 1 ] );

}

const SC = HEIGHT / ( maxY - minY );
// the hips forward of the origin in MakeHuman: centre them over it
const hipZ = ( boneHead( 'upperleg02.L' )[ 2 ] + boneHead( 'upperleg02.R' )[ 2 ] ) / 2;
const ours = ( v ) => [ - v[ 0 ] * SC, ( v[ 1 ] - minY ) * SC, - ( v[ 2 ] - hipZ ) * SC ];
const P = V.map( ours );
const J = ( b, end = 'head' ) => ours( end === 'head' ? boneHead( b ) : boneTail( b ) );

// our joints in the bind pose (MakeHuman's .L is his left, our -x)
const joints = {
	hipL: J( 'upperleg02.L' ), hipR: J( 'upperleg02.R' ),
	kneeL: J( 'lowerleg01.L' ), kneeR: J( 'lowerleg01.R' ),
	ankleL: J( 'foot.L' ), ankleR: J( 'foot.R' ),
	shoulderL: J( 'upperarm01.L' ), shoulderR: J( 'upperarm01.R' ),
	elbowL: J( 'lowerarm01.L' ), elbowR: J( 'lowerarm01.R' ),
	wristL: J( 'wrist.L' ), wristR: J( 'wrist.R' ),
	neck: J( 'neck01' ), head: J( 'head' ), headTop: J( 'head', 'tail' ),
	eyeL: J( 'eye.L' ), eyeR: J( 'eye.R' ),
};
const avg = ( a, b ) => mul( add( a, b ), 0.5 );
const hipMid = avg( joints.hipL, joints.hipR ), shMid = avg( joints.shoulderL, joints.shoulderR );
// the rig: the pelvis 4 cm above the hip joints, the waist (where the torso turns) at the lower spine,
// the head's pivot at the top of the neck
const pelvisY = hipMid[ 1 ] + 0.04;
const waistY = ours( boneHead( 'spine04' ) )[ 1 ];
const headY = ( ours( boneHead( 'neck02' ) )[ 1 ] + ours( boneHead( 'neck03' ) )[ 1 ] ) / 2;
const r3 = ( x ) => Math.round( x * 1000 ) / 1000;
const DIM = {
	hip: r3( pelvisY ),
	hipWidth: r3( ( joints.hipR[ 0 ] - joints.hipL[ 0 ] ) / 2 ),
	waist: r3( waistY - pelvisY ),
	torso: r3( headY - waistY + 0.005 ),
	shoulder: r3( ( joints.shoulderR[ 0 ] - joints.shoulderL[ 0 ] ) / 2 ),
	shoulderY: r3( shMid[ 1 ] - waistY ),
	upperArm: r3( ( len( sub( joints.elbowL, joints.shoulderL ) ) + len( sub( joints.elbowR, joints.shoulderR ) ) ) / 2 ),
	forearm: r3( ( len( sub( joints.wristL, joints.elbowL ) ) + len( sub( joints.wristR, joints.elbowR ) ) ) / 2 ),
	hand: 0.08,
	thigh: r3( ( len( sub( joints.kneeL, joints.hipL ) ) + len( sub( joints.kneeR, joints.hipR ) ) ) / 2 ),
	shin: r3( ( len( sub( joints.ankleL, joints.kneeL ) ) + len( sub( joints.ankleR, joints.kneeR ) ) ) / 2 ),
	footLen: 0.26,
	bat: 0.86,
};

// ---------------------------------------------------------------- the weights onto our bones

const OUR = [ 'pelvis', 'torso', 'head', 'upperArmL', 'forearmL', 'handL', 'upperArmR', 'forearmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'bat', 'glove' ];
const B = Object.fromEntries( OUR.map( ( n, i ) => [ n, i ] ) );
// a MakeHuman bone -> [ [ our bone, share ], ... ]; bones not listed follow their parent
const MAP = {
	root: [ [ 'pelvis', 1 ] ], 'pelvis.L': [ [ 'pelvis', 1 ] ], 'pelvis.R': [ [ 'pelvis', 1 ] ], spine05: [ [ 'pelvis', 1 ] ],
	spine04: [ [ 'torso', 0.6 ], [ 'pelvis', 0.4 ] ], spine03: [ [ 'torso', 1 ] ],
	neck01: [ [ 'torso', 0.7 ], [ 'head', 0.3 ] ], neck02: [ [ 'head', 0.6 ], [ 'torso', 0.4 ] ], neck03: [ [ 'head', 1 ] ],
	'shoulder01.L': [ [ 'upperArmL', 0.55 ], [ 'torso', 0.45 ] ], 'shoulder01.R': [ [ 'upperArmR', 0.55 ], [ 'torso', 0.45 ] ],
	'upperarm01.L': [ [ 'upperArmL', 1 ] ], 'upperarm01.R': [ [ 'upperArmR', 1 ] ],
	'lowerarm01.L': [ [ 'forearmL', 1 ] ], 'lowerarm01.R': [ [ 'forearmR', 1 ] ],
	'lowerarm02.L': [ [ 'forearmL', 0.75 ], [ 'handL', 0.25 ] ], 'lowerarm02.R': [ [ 'forearmR', 0.75 ], [ 'handR', 0.25 ] ],
	'wrist.L': [ [ 'handL', 1 ] ], 'wrist.R': [ [ 'handR', 1 ] ],
	'upperleg01.L': [ [ 'thighL', 0.7 ], [ 'pelvis', 0.3 ] ], 'upperleg01.R': [ [ 'thighR', 0.7 ], [ 'pelvis', 0.3 ] ],
	'upperleg02.L': [ [ 'thighL', 1 ] ], 'upperleg02.R': [ [ 'thighR', 1 ] ],
	'lowerleg01.L': [ [ 'shinL', 1 ] ], 'lowerleg01.R': [ [ 'shinR', 1 ] ],
	'foot.L': [ [ 'footL', 1 ] ], 'foot.R': [ [ 'footR', 1 ] ],
};
const mapOf = ( b ) => {

	for ( let x = b; x; x = skel.bones[ x ].parent ) if ( MAP[ x ] ) return MAP[ x ];
	return [ [ 'pelvis', 1 ] ];

};

const keepGroups = [ 'body', 'helper-l-eye', 'helper-r-eye' ];
const footOf = ( i ) => vw[ i ].reduce( ( a, [ b, w ] ) => a + ( /^(foot|toe)/.test( b ) ? w : 0 ), 0 );
// the bare feet (below the ankle's top) go: the cleats cover them
const faces = [];
for ( const g of keepGroups ) for ( const f of groups[ g ] ) {

	if ( g === 'body' && f.every( ( i ) => footOf( i ) > 0.35 || P[ i ][ 1 ] < 0.07 ) ) continue;
	faces.push( [ g, f ] );

}

const used = new Map(); // old index -> new
const order = [];
for ( const [ , f ] of faces ) for ( const i of f ) if ( ! used.has( i ) ) {

	used.set( i, order.length );
	order.push( i );

}

const eyeIds = new Set( [ ...groups[ 'helper-l-eye' ], ...groups[ 'helper-r-eye' ] ].flat() );
const n = order.length;
const pos = order.map( ( i ) => P[ i ].slice() );
const bw = order.map( ( i ) => {

	const acc = {};
	for ( const [ b, w ] of vw[ i ] ) for ( const [ o, k ] of mapOf( b ) ) acc[ o ] = ( acc[ o ] || 0 ) + w * k;
	let top = Object.entries( acc ).sort( ( a, b ) => b[ 1 ] - a[ 1 ] ).slice( 0, 4 );
	const s = top.reduce( ( a, x ) => a + x[ 1 ], 0 ) || 1;
	top = top.map( ( [ o, w ] ) => [ B[ o ], w / s ] );
	while ( top.length < 4 ) top.push( [ 0, 0 ] );
	return top;

} );

// ---------------------------------------------------------------- normals (bind pose, smooth)

const tris = [];
for ( const [ , f ] of faces ) {

	const a = used.get( f[ 0 ] ), b = used.get( f[ 1 ] ), c = used.get( f[ 2 ] ), d = used.get( f[ 3 ] );
	tris.push( [ a, b, c ], [ a, c, d ] );

}

function normals( p ) {

	const N = p.map( () => [ 0, 0, 0 ] );
	for ( const [ a, b, c ] of tris ) {

		const fn = cross( sub( p[ b ], p[ a ] ), sub( p[ c ], p[ a ] ) );
		for ( const k of [ a, b, c ] ) N[ k ] = add( N[ k ], fn );

	}

	return N.map( norm );

}

// MakeHuman winds its faces for its own facing: after the half turn the winding holds (a rotation), so
// the normals point out; check on the chest
let N = normals( pos );
{

	const chest = pos.reduce( ( best, p, i ) => ( p[ 1 ] > 1.3 && p[ 1 ] < 1.4 && Math.abs( p[ 0 ] ) < 0.02 && p[ 2 ] < ( pos[ best ]?.[ 2 ] ?? 9 ) ) ? i : best, 0 );
	if ( N[ chest ][ 2 ] > 0 ) {

		for ( const t of tris ) t.reverse();
		N = normals( pos );

	}

}

// ---------------------------------------------------------------- the uniform's layout

// along the arm from the shoulder joint, and along the leg from the hip joint (m); -1 elsewhere
const armLen = DIM.upperArm + DIM.forearm, legLen = DIM.thigh + DIM.shin;
const along = ( p, a, b, c ) => {

	// distance along the polyline a-b-c of p's nearest point
	const seg = ( s, e ) => {

		const d = sub( e, s ), L = len( d );
		const t = clamp( dot( sub( p, s ), d ) / ( L * L ), 0, 1 );
		return [ len( sub( p, add( s, mul( d, t ) ) ) ), t * L ];

	};

	const [ d1, t1 ] = seg( a, b ), [ d2, t2 ] = seg( b, c );
	return d1 <= d2 ? t1 : len( sub( b, a ) ) + t2;

};

const armW = ( w, s ) => w.reduce( ( a, [ b, k ] ) => a + ( [ B[ 'upperArm' + s ], B[ 'forearm' + s ], B[ 'hand' + s ] ].includes( b ) ? k : 0 ), 0 );
const legW = ( w, s ) => w.reduce( ( a, [ b, k ] ) => a + ( [ B[ 'thigh' + s ], B[ 'shin' + s ], B[ 'foot' + s ] ].includes( b ) ? k : 0 ), 0 );
const field = [];
for ( let k = 0; k < n; k ++ ) {

	const p = pos[ k ], w = bw[ k ];
	let arm = - 1, leg = - 1;
	for ( const s of [ 'L', 'R' ] ) {

		// the deltoid is half the torso's: count it as arm where the arm's share leads
		if ( armW( w, s ) > 0.45 ) arm = along( p, joints[ 'shoulder' + s ], joints[ 'elbow' + s ], joints[ 'wrist' + s ] );
		if ( legW( w, s ) > 0.5 ) leg = along( p, joints[ 'hip' + s ], joints[ 'knee' + s ], joints[ 'ankle' + s ] );

	}

	field.push( [ arm, leg ] );

}

// the uniform's layout (shared with the shader, Players.js): the jersey's sleeve ends a little above
// the elbow; the undershirt's sleeve at the wrist; the pants end below the knee (high socks); the belt
const U = {
	sleeve: r3( DIM.upperArm * 0.62 ),
	wrist: r3( DIM.upperArm + DIM.forearm - 0.01 ),
	cuff: r3( DIM.thigh + DIM.shin * 0.3 ),
	belt: [ 1.035, 1.075 ],
	collar: r3( joints.neck[ 1 ] - 0.035 ),
};

// the cloth stands off the skin: the jersey and the pants loose (looser toward their hems), the
// undershirt and the socks close
const offs = [];
for ( let k = 0; k < n; k ++ ) {

	const [ arm, leg ] = field[ k ], p = pos[ k ];
	const eye = eyeIds.has( order[ k ] );
	let o = 0;
	if ( ! eye ) {

		if ( arm >= 0 ) {

			const inSleeve = 1 - smooth( U.sleeve - 0.006, U.sleeve + 0.006, arm );
			const inShirt = 1 - smooth( U.wrist - 0.02, U.wrist, arm );
			o = inSleeve * ( 0.012 + 0.014 * smooth( 0.02, U.sleeve, arm ) ) + ( 1 - inSleeve ) * 0.004 * inShirt;

		} else if ( leg >= 0 ) {

			const inPants = 1 - smooth( U.cuff - 0.012, U.cuff + 0.004, leg );
			// the pants blouse out over the calf; the socks close on the shin
			o = inPants * ( 0.016 + 0.012 * smooth( DIM.thigh, U.cuff, leg ) ) + ( 1 - inPants ) * 0.004;

		} else if ( p[ 1 ] < joints.neck[ 1 ] - 0.03 ) {

			// the torso: the jersey, bloused over the belt; the belt closer; the seat of the pants
			const belt = smooth( U.belt[ 0 ] - 0.02, U.belt[ 0 ], p[ 1 ] ) * ( 1 - smooth( U.belt[ 1 ], U.belt[ 1 ] + 0.02, p[ 1 ] ) );
			const blouse = smooth( U.belt[ 1 ], U.belt[ 1 ] + 0.04, p[ 1 ] ) * ( 1 - smooth( U.belt[ 1 ] + 0.06, U.belt[ 1 ] + 0.2, p[ 1 ] ) );
			o = ( 0.016 + 0.012 * blouse ) * ( 1 - belt * 0.6 ) * ( 1 - smooth( joints.neck[ 1 ] - 0.1, joints.neck[ 1 ] - 0.03, p[ 1 ] ) );

		}

	}

	offs.push( o );

}

for ( let k = 0; k < n; k ++ ) pos[ k ] = add( pos[ k ], mul( N[ k ], offs[ k ] ) );

// the jersey and the pants drape: smoothed (Taubin, so they keep their volume) until the muscles under
// them no longer show; the skin, the undershirt and the socks keep their shape
const clothK = ( k ) => {

	const [ arm, leg ] = field[ k ], y = pos[ k ][ 1 ];
	if ( eyeIds.has( order[ k ] ) ) return 0;
	if ( arm >= 0 ) return 1 - smooth( U.sleeve - 0.03, U.sleeve, arm );
	if ( leg >= 0 ) return 1 - smooth( U.cuff - 0.03, U.cuff, leg );
	return 1 - smooth( joints.neck[ 1 ] - 0.09, joints.neck[ 1 ] - 0.05, y );

};

{

	const nb = pos.map( () => new Set() );
	for ( const [ a, b, c ] of tris ) {

		nb[ a ].add( b ).add( c ); nb[ b ].add( a ).add( c ); nb[ c ].add( a ).add( b );

	}

	const K = pos.map( ( p, k ) => clothK( k ) );
	const step = ( lam ) => {

		const next = pos.map( ( p, k ) => {

			if ( ! K[ k ] || ! nb[ k ].size ) return p;
			let c = [ 0, 0, 0 ];
			for ( const j of nb[ k ] ) c = add( c, pos[ j ] );
			c = mul( c, 1 / nb[ k ].size );
			return add( p, mul( sub( c, p ), lam * K[ k ] ) );

		} );
		for ( let k = 0; k < n; k ++ ) pos[ k ] = next[ k ];

	};

	for ( let i = 0; i < 12; i ++ ) {

		step( 0.5 );
		step( - 0.53 );

	}

}

N = normals( pos );

// ---------------------------------------------------------------- face landmarks (for the shader)

const mean = ( ids ) => mul( ids.reduce( ( a, i ) => add( a, P[ i ] ), [ 0, 0, 0 ] ), 1 / ids.length );
const eyeC = ( g ) => mean( [ ...new Set( groups[ g ].flat() ) ] );
const face = {
	eyeL: eyeC( 'helper-l-eye' ), eyeR: eyeC( 'helper-r-eye' ),
	mouth: ours( avg( boneHead( 'oris01' ), boneHead( 'oris05' ) ) ),
	jaw: ours( boneTail( 'jaw' ) ),
	top: joints.headTop,
};
let eyeRad = 0;
for ( const i of new Set( groups[ 'helper-l-eye' ].flat() ) ) eyeRad = Math.max( eyeRad, len( sub( P[ i ], face.eyeL ) ) );
face.eyeRad = eyeRad;
// the skull, for the cap and the helmet: the head's vertices above the eyes
{

	let x0 = Infinity, x1 = - Infinity, z0 = Infinity, z1 = - Infinity;
	for ( let k = 0; k < n; k ++ ) {

		const p = P[ order[ k ] ];
		if ( eyeIds.has( order[ k ] ) || p[ 1 ] < face.eyeL[ 1 ] + 0.01 || field[ k ][ 0 ] >= 0 ) continue;
		x0 = Math.min( x0, p[ 0 ] ); x1 = Math.max( x1, p[ 0 ] );
		z0 = Math.min( z0, p[ 2 ] ); z1 = Math.max( z1, p[ 2 ] );

	}

	face.skull = { x: r3( ( x1 - x0 ) / 2 ), z0: r3( z0 ), z1: r3( z1 ) };

}

for ( const k of [ 'eyeL', 'eyeR', 'mouth', 'jaw', 'top' ] ) face[ k ] = face[ k ].map( r3 );
face.eyeRad = r3( face.eyeRad );

// ---------------------------------------------------------------- write

// quantized: positions to 0.1 mm (int16 over +-3.2 m), normals int8, bone indices and weights u8, the
// arm / leg coordinates to 0.1 mm (int16), a flag per vertex (1 = eye)
const Q = 10000;
const bPos = new Int16Array( n * 3 ), bNrm = new Int8Array( n * 3 ), bIdx = new Uint8Array( n * 4 ), bW = new Uint8Array( n * 4 ), bField = new Int16Array( n * 2 ), bFlag = new Uint8Array( n );
for ( let k = 0; k < n; k ++ ) {

	for ( let c = 0; c < 3; c ++ ) {

		bPos[ k * 3 + c ] = Math.round( pos[ k ][ c ] * Q );
		bNrm[ k * 3 + c ] = Math.round( N[ k ][ c ] * 127 );

	}

	// weights to 1/255, the largest taking up the rounding
	const ws = bw[ k ].map( ( [ , w ] ) => Math.round( w * 255 ) );
	ws[ 0 ] += 255 - ws.reduce( ( a, x ) => a + x, 0 );
	for ( let c = 0; c < 4; c ++ ) {

		bIdx[ k * 4 + c ] = bw[ k ][ c ][ 0 ];
		bW[ k * 4 + c ] = ws[ c ];

	}

	bField[ k * 2 ] = Math.round( field[ k ][ 0 ] * Q / 1 );
	bField[ k * 2 + 1 ] = Math.round( field[ k ][ 1 ] * Q / 1 );
	bFlag[ k ] = eyeIds.has( order[ k ] ) ? 1 : 0;

}

const bIndex = new Uint16Array( tris.flat() );
const b64 = ( a ) => Buffer.from( a.buffer, a.byteOffset, a.byteLength ).toString( 'base64' );
const round = ( o ) => JSON.parse( JSON.stringify( o, ( k, v ) => typeof v === 'number' ? r3( v ) : v ) );
const js = `// Generated by tools/build-body.mjs from the MakeHuman base mesh, targets, skeleton and weights (CC0,
// makehumancommunity.org). Don't edit: re-run the tool.
export const BODY = {
	count: ${ n }, triangles: ${ tris.length },
	dim: ${ JSON.stringify( DIM ) },
	joints: ${ JSON.stringify( round( joints ) ) },
	uniform: ${ JSON.stringify( U ) },
	face: ${ JSON.stringify( round( face ) ) },
	scale: ${ Q },
	position: '${ b64( bPos ) }',
	normal: '${ b64( bNrm ) }',
	bones: '${ b64( bIdx ) }',
	weights: '${ b64( bW ) }',
	field: '${ b64( bField ) }',
	flag: '${ b64( bFlag ) }',
	index: '${ b64( bIndex ) }',
};
`;
writeFileSync( OUT, js );
console.log( 'wrote', OUT, ( js.length / 1024 ).toFixed( 0 ), 'KB;', n, 'vertices,', tris.length, 'triangles' );
console.log( 'DIM', DIM );
console.log( 'uniform', U );
console.log( 'face', face );
