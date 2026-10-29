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

// ---- FF3 (step 10): every man's own face from MakeHuman's own targets, as the fans' are (FF1:
// tools/build-fanhead.mjs). The head's vertices (above the collar, and the eyeballs) carry MakeHuman's
// identity targets as blend shapes: the face's modifiers (the nose, the mouth and lips, the chin and jaw,
// the cheeks, the eyes and lids, the brows, the forehead, the ears, the head's proportions and the neck,
// each its decrease and its increase) and the seven head shapes, as a MakeHuman user sets them, and the
// macro targets' share of the face (how African, Asian or European a face is against the body's own
// mix; age; weight). Each is sparse (only the vertices it moves), int8 against its own scale. Players.js
// works a man's face out from his look once, when he comes on (FaceBake: his weights on these shapes,
// his own size and place taken out, the normals worked out again), so the middle and far figures take
// the same face for one read a vertex. And MakeHuman's expression units (FF2's: the mouth open with the
// brows up, the smile with the cheeks up into the lids, the blink), for Lidge's shout at strike three,
// the pile, the celebration and every man's blink. And the mouth's inside (the base mesh's lips curl in
// to a closed bag behind them, which the open jaw shows): its vertices flagged 2, for the paint
const ffHead = await ( async () => {

	// the head: above the collar (not the arms' tops), and the eyeballs
	const hk = [];
	for ( let k = 0; k < n; k ++ ) if ( eyeIds.has( order[ k ] ) || ( field[ k ][ 0 ] < 0 && field[ k ][ 1 ] < 0 && pos[ k ][ 1 ] > U.collar - 0.025 ) ) hk.push( k );
	const HV = hk.length, hOf = new Int32Array( n ).fill( - 1 );
	hk.forEach( ( k, h ) => { hOf[ k ] = h; } );
	// the targets fade out down the neck to nothing at the collar, where the jersey takes over
	const mask = hk.map( ( k ) => eyeIds.has( order[ k ] ) ? 1 : smooth( U.collar - 0.022, U.collar + 0.03, pos[ k ][ 1 ] ) );
	const parseT = async ( path ) => {

		const D = new Float64Array( HV * 3 );
		for ( const line of ( await get( path ) ).split( '\n' ) ) {

			if ( ! line || line[ 0 ] === '#' ) continue;
			const p = line.trim().split( /\s+/ );
			if ( p.length < 4 ) continue;
			const k = used.get( + p[ 0 ] );
			if ( k === undefined || hOf[ k ] < 0 ) continue;
			const h = hOf[ k ];
			D[ h * 3 ] = - p[ 1 ] * SC; D[ h * 3 + 1 ] = + p[ 2 ] * SC; D[ h * 3 + 2 ] = - p[ 3 ] * SC;

		}

		return D;

	};
	const lin = ( terms ) => {

		const D = new Float64Array( HV * 3 );
		for ( const [ T, w ] of terms ) for ( let i = 0; i < D.length; i ++ ) D[ i ] += w * T[ i ];
		return D;

	};
	const shapes = []; // [ name, D ]
	// the macros against the body's own mix (TARGETS: caucasian 0.5, african 0.3, asian 0.2; young; muscular)
	const ETH = { african: 0.3, asian: 0.2, caucasian: 0.5 };
	const young = {}, old = {};
	for ( const e of Object.keys( ETH ) ) {

		young[ e ] = await parseT( `targets/macrodetails/${ e }-male-young.target` );
		old[ e ] = await parseT( `targets/macrodetails/${ e }-male-old.target` );

	}
	// (a man's African and Asian shares af and as, the rest European: his face is the body's plus
	// ( af - 0.3 ) of the African face's difference from the European and ( as - 0.2 ) of the Asian's)
	shapes.push( [ 'eth-african', lin( [ [ young.african, 1 ], [ young.caucasian, - 1 ] ] ) ] );
	shapes.push( [ 'eth-asian', lin( [ [ young.asian, 1 ], [ young.caucasian, - 1 ] ] ) ] );
	// (and a woman's face, for the ball girls: the female corners against the male, by the same mix)
	const fem = {};
	for ( const e of Object.keys( ETH ) ) fem[ e ] = await parseT( `targets/macrodetails/${ e }-female-young.target` );
	shapes.push( [ 'female', lin( Object.entries( ETH ).flatMap( ( [ e, w ] ) => [ [ fem[ e ], w ], [ young[ e ], - w ] ] ) ) ] );
	shapes.push( [ 'old', lin( Object.entries( ETH ).flatMap( ( [ e, w ] ) => [ [ old[ e ], w ], [ young[ e ], - w ] ] ) ) ] );
	const wAvg = await parseT( 'targets/macrodetails/universal-male-young-averagemuscle-averageweight.target' );
	shapes.push( [ 'heavy', lin( [ [ await parseT( 'targets/macrodetails/universal-male-young-averagemuscle-maxweight.target' ), 1 ], [ wAvg, - 1 ] ] ) ] );
	shapes.push( [ 'light', lin( [ [ await parseT( 'targets/macrodetails/universal-male-young-averagemuscle-minweight.target' ), 1 ], [ wAvg, - 1 ] ] ) ] );
	// the face's modifiers (FF1's list, but the head's scales, the back of the skull and the forehead's
	// nubian bulge, which are under the cap and the helmet, built on the base's skull; the head's own size
	// is the look's `head`, Rig.js' solvePose; and the head's age, which the old macro has): each its two
	// ends, an l- / r- pair together
	const MODS = [
		[ 'head-fat', 'head/head-fat-decr', 'head/head-fat-incr' ],
		[ 'forehead-vert', 'forehead/forehead-scale-vert-decr', 'forehead/forehead-scale-vert-incr' ],
		[ 'forehead-temple', 'forehead/forehead-temple-decr', 'forehead/forehead-temple-incr' ], [ 'forehead-slope', 'forehead/forehead-trans-backward', 'forehead/forehead-trans-forward' ],
		[ 'brow-ridge', 'eyebrows/eyebrows-trans-backward', 'eyebrows/eyebrows-trans-forward' ], [ 'brow-angle', 'eyebrows/eyebrows-angle-down', 'eyebrows/eyebrows-angle-up' ],
		[ 'brow-height', 'eyebrows/eyebrows-trans-down', 'eyebrows/eyebrows-trans-up' ],
		[ 'eye-spacing', 'eyes/*-eye-trans-in', 'eyes/*-eye-trans-out' ], [ 'eye-size', 'eyes/*-eye-scale-decr', 'eyes/*-eye-scale-incr' ],
		[ 'eye-height', 'eyes/*-eye-trans-down', 'eyes/*-eye-trans-up' ], [ 'eye-bag', 'eyes/*-eye-bag-decr', 'eyes/*-eye-bag-incr' ],
		[ 'eye-deep', 'eyes/*-eye-push1-out', 'eyes/*-eye-push1-in' ], [ 'eye-fold', 'eyes/*-eye-eyefold-up', 'eyes/*-eye-eyefold-down' ],
		[ 'eye-epicanthus', 'eyes/*-eye-epicanthus-out', 'eyes/*-eye-epicanthus-in' ],
		[ 'nose-width', 'nose/nose-scale-horiz-decr', 'nose/nose-scale-horiz-incr' ], [ 'nose-length', 'nose/nose-scale-vert-decr', 'nose/nose-scale-vert-incr' ],
		[ 'nose-depth', 'nose/nose-scale-depth-decr', 'nose/nose-scale-depth-incr' ], [ 'nose-hump', 'nose/nose-hump-decr', 'nose/nose-hump-incr' ],
		[ 'nose-point', 'nose/nose-point-width-decr', 'nose/nose-point-width-incr' ], [ 'nose-nostrils', 'nose/nose-nostrils-width-decr', 'nose/nose-nostrils-width-incr' ],
		[ 'nose-height', 'nose/nose-trans-down', 'nose/nose-trans-up' ], [ 'nose-out', 'nose/nose-trans-backward', 'nose/nose-trans-forward' ],
		[ 'nose-curve', 'nose/nose-curve-concave', 'nose/nose-curve-convex' ], [ 'nose-volume', 'nose/nose-volume-decr', 'nose/nose-volume-incr' ],
		[ 'nose-flare', 'nose/nose-flaring-decr', 'nose/nose-flaring-incr' ], [ 'nose-tip', 'nose/nose-point-down', 'nose/nose-point-up' ],
		[ 'nose-greek', 'nose/nose-greek-decr', 'nose/nose-greek-incr' ],
		[ 'mouth-width', 'mouth/mouth-scale-horiz-decr', 'mouth/mouth-scale-horiz-incr' ], [ 'mouth-height', 'mouth/mouth-trans-down', 'mouth/mouth-trans-up' ],
		[ 'mouth-out', 'mouth/mouth-trans-backward', 'mouth/mouth-trans-forward' ], [ 'lip-lower', 'mouth/mouth-lowerlip-volume-decr', 'mouth/mouth-lowerlip-volume-incr' ],
		[ 'lip-upper', 'mouth/mouth-upperlip-volume-decr', 'mouth/mouth-upperlip-volume-incr' ], [ 'mouth-angles', 'mouth/mouth-angles-down', 'mouth/mouth-angles-up' ],
		[ 'mouth-philtrum', 'mouth/mouth-philtrum-volume-decr', 'mouth/mouth-philtrum-volume-incr' ],
		[ 'ear-size', 'ears/*-ear-scale-decr', 'ears/*-ear-scale-incr' ], [ 'ear-out', 'ears/*-ear-flap-decr', 'ears/*-ear-flap-incr' ],
		[ 'ear-lobe', 'ears/*-ear-lobe-decr', 'ears/*-ear-lobe-incr' ], [ 'ear-height', 'ears/*-ear-trans-down', 'ears/*-ear-trans-up' ],
		[ 'chin-out', 'chin/chin-prominent-decr', 'chin/chin-prominent-incr' ], [ 'chin-width', 'chin/chin-width-decr', 'chin/chin-width-incr' ],
		[ 'chin-height', 'chin/chin-height-decr', 'chin/chin-height-incr' ], [ 'jaw', 'chin/chin-bones-decr', 'chin/chin-bones-incr' ],
		[ 'jaw-drop', 'chin/chin-jaw-drop-decr', 'chin/chin-jaw-drop-incr' ], [ 'chin-cleft', 'chin/chin-cleft-decr', 'chin/chin-cleft-incr' ],
		[ 'prognathism', 'chin/chin-prognathism-decr', 'chin/chin-prognathism-incr' ],
		[ 'cheekbones', 'cheek/*-cheek-bones-decr', 'cheek/*-cheek-bones-incr' ], [ 'cheeks', 'cheek/*-cheek-volume-decr', 'cheek/*-cheek-volume-incr' ],
		[ 'cheek-inner', 'cheek/*-cheek-inner-decr', 'cheek/*-cheek-inner-incr' ], [ 'cheek-height', 'cheek/*-cheek-trans-down', 'cheek/*-cheek-trans-up' ],
		[ 'neck-width', 'neck/neck-scale-horiz-decr', 'neck/neck-scale-horiz-incr' ], [ 'neck-depth', 'neck/neck-scale-depth-decr', 'neck/neck-scale-depth-incr' ],
		[ 'neck-double', 'neck/neck-double-decr', 'neck/neck-double-incr' ],
	];
	const tgt = async ( path ) => {

		if ( ! path.includes( '*' ) ) return parseT( `targets/${ path }.target` );
		return lin( [ [ await parseT( `targets/${ path.replace( '*', 'l' ) }.target` ), 1 ], [ await parseT( `targets/${ path.replace( '*', 'r' ) }.target` ), 1 ] ] );

	};
	for ( const [ name, lo, hi ] of MODS ) {

		shapes.push( [ name + '-', await tgt( lo ) ] );
		shapes.push( [ name + '+', await tgt( hi ) ] );

	}
	for ( const s of [ 'oval', 'round', 'square', 'rectangular', 'triangular', 'invertedtriangular', 'diamond' ] ) shapes.push( [ 'shape-' + s, await tgt( `head/head-${ s }` ) ] );

	// the macros' own size and place taken out (they move the whole head with the body's proportions, by
	// up to 12 cm, and grow it): the shift and the scale that best put the skull and the face back on the
	// base's, as FF1 did for each fan. (The cap and the helmet are built on the base's skull; the head's own
	// size is the look's `head`, Rig.js' solvePose.) The face's modifiers move what they move
	const fitH = hk.map( ( k ) => pos[ k ][ 1 ] > face.jaw[ 1 ] + 0.01 && Math.abs( pos[ k ][ 0 ] ) < 0.062 && ! eyeIds.has( order[ k ] ) ? 1 : 0 );
	for ( const s of shapes ) {

		if ( ! /^(eth-|old|heavy|light|female)/.test( s[ 0 ] ) ) continue;
		const D = s[ 1 ];
		let c = [ 0, 0, 0 ], b = [ 0, 0, 0 ], nw = 0;
		hk.forEach( ( k, h ) => { if ( fitH[ h ] ) { b = add( b, pos[ k ] ); c = add( c, [ D[ h * 3 ], D[ h * 3 + 1 ], D[ h * 3 + 2 ] ] ); nw ++; } } );
		b = mul( b, 1 / nw ); c = mul( c, 1 / nw );
		let sxy = 0, sxx = 0;
		hk.forEach( ( k, h ) => {

			if ( ! fitH[ h ] ) return;
			const x = sub( add( pos[ k ], sub( [ D[ h * 3 ], D[ h * 3 + 1 ], D[ h * 3 + 2 ] ], c ) ), b ), y = sub( pos[ k ], b );
			sxy += dot( x, y ); sxx += dot( x, x );

		} );
		const sc = sxy / sxx;
		hk.forEach( ( k, h ) => {

			const q = add( mul( sub( add( pos[ k ], sub( [ D[ h * 3 ], D[ h * 3 + 1 ], D[ h * 3 + 2 ] ], c ) ), b ), sc ), b );
			for ( let j = 0; j < 3; j ++ ) D[ h * 3 + j ] = q[ j ] - pos[ k ][ j ];

		} );

	}

	// a pair whose two ends are one move either way (the head's scales, the ears' height, ...) is kept once,
	// its decrease the increase backwards (named 'x+-')
	for ( let i = 0; i < shapes.length - 1; i ++ ) {

		const [ a, A ] = shapes[ i ], [ bn, Bd ] = shapes[ i + 1 ];
		if ( ! a.endsWith( '-' ) || bn !== a.slice( 0, - 1 ) + '+' ) continue;
		let e = 0, m = 0;
		for ( let j = 0; j < A.length; j ++ ) { e = Math.max( e, Math.abs( A[ j ] + Bd[ j ] ) ); m = Math.max( m, Math.abs( Bd[ j ] ) ); }
		if ( e < 0.02 * m ) { shapes[ i ] = [ a.slice( 0, - 1 ) + '+-', Bd ]; shapes.splice( i + 1, 1 ); }

	}

	// int8 against each shape's own largest move, masked down the neck; sparse (the head vertex's number
	// with it) where a shape moves under half the head, dense where it moves most of it; moves under a
	// tenth of a millimetre left out
	const sIdx = [], sVal = [], table = [];
	for ( const [ name, D ] of shapes ) {

		let mx = 0;
		for ( let h = 0; h < HV; h ++ ) for ( let c = 0; c < 3; c ++ ) mx = Math.max( mx, Math.abs( D[ h * 3 + c ] * mask[ h ] ) );
		const sc = mx / 127 || 1;
		const q = ( h ) => [ 0, 1, 2 ].map( ( c ) => Math.round( D[ h * 3 + c ] * mask[ h ] / sc ) );
		const moved = [];
		for ( let h = 0; h < HV; h ++ ) {

			const m = Math.hypot( D[ h * 3 ], D[ h * 3 + 1 ], D[ h * 3 + 2 ] ) * mask[ h ];
			const v = q( h );
			if ( m >= 1e-4 && Math.abs( v[ 0 ] ) + Math.abs( v[ 1 ] ) + Math.abs( v[ 2 ] ) > 0 ) moved.push( h );

		}

		const dense = moved.length > HV / 2;
		const vStart = sVal.length / 3, iStart = dense ? - 1 : sIdx.length;
		for ( const h of dense ? hk.map( ( k, i ) => i ) : moved ) {

			if ( ! dense ) sIdx.push( h );
			sVal.push( ...q( h ) );

		}

		table.push( [ name, vStart, dense ? HV : moved.length, + sc.toExponential( 4 ), iStart ] );

	}

	// the expressions (FF2's units), mixed over MakeHuman's three faces by the body's own shares, at full
	// strength; their normals' change from the whole body's
	const EXPR = [
		[ 'open', [ [ 'mouth-open', 1 ], [ 'eyebrows-left-up', 0.55 ], [ 'eyebrows-right-up', 0.55 ] ] ],
		[ 'smile', [ [ 'mouth-corner-puller', 1 ], [ 'mouth-upward-retraction', 0.35 ], [ 'eye-left-slit', 0.7 ], [ 'eye-right-slit', 0.7 ] ] ],
		[ 'blink', [ [ 'eye-left-closure', 1 ], [ 'eye-right-closure', 1 ] ] ],
	];
	const ex = [];
	for ( const [ , units ] of EXPR ) {

		const terms = [];
		for ( const [ e, we ] of Object.entries( ETH ) ) for ( const [ u, w ] of units ) terms.push( [ await parseT( `targets/expression/units/${ e }/${ u }.target` ), we * w ] );
		ex.push( lin( terms ) );

	}
	const N0 = normals( pos );
	const exN = ex.map( ( D ) => {

		const p2 = pos.map( ( p, k ) => hOf[ k ] < 0 ? p : add( p, [ D[ hOf[ k ] * 3 ], D[ hOf[ k ] * 3 + 1 ], D[ hOf[ k ] * 3 + 2 ] ] ) );
		const N2 = normals( p2 );
		return hk.map( ( k ) => sub( N2[ k ], N0[ k ] ) );

	} );
	const f16 = ( x ) => {

		const f = new Float32Array( 1 ), u = new Uint32Array( f.buffer );
		f[ 0 ] = x;
		const b = u[ 0 ], s = ( b >>> 16 ) & 0x8000;
		let e = ( ( b >>> 23 ) & 0xff ) - 127 + 15, m = b & 0x7fffff;
		if ( e <= 0 ) return s;
		if ( e >= 31 ) return s | 0x7c00;
		m += 0x1000;
		if ( m & 0x800000 ) { m = 0; e ++; }
		return s | ( e << 10 ) | ( m >>> 13 );

	};
	const pack2 = ( a, b ) => ( f16( a ) | ( f16( b ) << 16 ) ) >>> 0;
	const eIdx = [], eRec = [];
	for ( let h = 0; h < HV; h ++ ) {

		const [ o, s, b ] = ex.map( ( D ) => [ D[ h * 3 ], D[ h * 3 + 1 ], D[ h * 3 + 2 ] ] );
		const [ no, ns, nb ] = exN.map( ( N ) => N[ h ] );
		if ( Math.max( ...o.map( Math.abs ), ...s.map( Math.abs ), ...b.map( Math.abs ) ) < 3e-5 && Math.max( ...no.map( Math.abs ), ...ns.map( Math.abs ), ...nb.map( Math.abs ) ) < 0.004 ) continue;
		eIdx.push( h );
		// [ open x y | open z, smile x | smile y z | blink y z ], then their normals' the same (FF2's records)
		eRec.push( pack2( o[ 0 ], o[ 1 ] ), pack2( o[ 2 ], s[ 0 ] ), pack2( s[ 1 ], s[ 2 ] ), pack2( b[ 1 ], b[ 2 ] ),
			pack2( no[ 0 ], no[ 1 ] ), pack2( no[ 2 ], ns[ 0 ] ), pack2( ns[ 1 ], ns[ 2 ] ), pack2( nb[ 1 ], nb[ 2 ] ) );

	}

	// the mouth's inside: in MakeHuman's frame (+z forward), the vertices in the mouth's region behind the
	// face's front (against the frontmost within 4 mm across and up and down), and the lips' inner faces
	// turned up or down where they meet (FF2's test on the fans' head)
	const oy = ( boneHead( 'oris01' )[ 1 ] + boneHead( 'oris05' )[ 1 ] ) / 2;
	const mouthIn = new Set();
	{

		const cand = [];
		for ( let k = 0; k < n; k ++ ) {

			if ( eyeIds.has( order[ k ] ) ) continue;
			const p = V[ order[ k ] ];
			if ( Math.abs( p[ 0 ] ) > 0.3 || Math.abs( p[ 1 ] - oy ) > 0.24 || p[ 2 ] < 0.6 ) continue;
			cand.push( k );

		}

		for ( const k of cand ) {

			const p = V[ order[ k ] ];
			if ( Math.abs( p[ 0 ] ) > 0.26 || Math.abs( p[ 1 ] - oy ) > 0.2 || p[ 2 ] < 0.8 ) continue;
			let zf = - 1e9;
			for ( const j of cand ) {

				const q = V[ order[ j ] ];
				if ( Math.abs( q[ 0 ] - p[ 0 ] ) < 0.04 && Math.abs( q[ 1 ] - p[ 1 ] ) < 0.04 ) zf = Math.max( zf, q[ 2 ] );

			}

			// (our normals face -z forward: N.z > -0.2 is MakeHuman's N.z < 0.2)
			if ( p[ 2 ] < zf - 0.03 || ( N[ k ][ 2 ] > - 0.2 && Math.abs( p[ 0 ] ) < 0.2 && Math.abs( p[ 1 ] - oy ) < 0.1 ) ) mouthIn.add( k );

		}

	}

	// for taking out a face's own size and place (Players.js): the skull and the face, not the neck nor the
	// ears; and the mouth's mark
	const hflag = new Uint8Array( HV );
	hk.forEach( ( k, h ) => {

		const p = pos[ k ];
		if ( p[ 1 ] > face.jaw[ 1 ] + 0.01 && Math.abs( p[ 0 ] ) < 0.062 && ! eyeIds.has( order[ k ] ) ) hflag[ h ] |= 1;

	} );
	console.log( 'FF3 head:', HV, 'vertices;', shapes.length, 'shapes,', sVal.length / 3, 'entries (', sIdx.length, 'sparse );', eIdx.length, 'expression vertices; the mouth\'s inside', mouthIn.size );
	return { HV, hk, sIdx, sVal, table, eIdx, eRec, mouthIn, hflag };

} )();
// ---- end FF3

// ---------------------------------------------------------------- write

// quantized: positions to 0.1 mm (int16 over +-3.2 m), normals int8, bone indices and weights u8, the
// arm / leg coordinates to 0.1 mm (int16), a flag per vertex (1 = eye; FF3: 2 = the mouth's inside)
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
	bFlag[ k ] = eyeIds.has( order[ k ] ) ? 1 : ffHead.mouthIn.has( k ) ? 2 : 0; // (---- FF3: 2)

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
	// ---- FF3: the head's blend shapes (see the tool): the head's vertices (the body's), a flag each (1: the
	// skull and the face); the shapes, x y z as int8 times the shape's scale, sparse (with the head
	// vertex's number) or dense (every head vertex): [ name, first value, values, scale, first index or -1
	// for a dense one ]; the
	// expressions (${ [ 'open', 'smile', 'blink' ].join( ', ' ) }) at the vertices they move, 8 u32 each (halves)
	head: {
		count: ${ ffHead.HV },
		vertices: '${ b64( new Uint16Array( ffHead.hk ) ) }',
		flag: '${ b64( ffHead.hflag ) }',
		shapes: ${ JSON.stringify( ffHead.table ) },
		index: '${ b64( new Uint16Array( ffHead.sIdx ) ) }',
		value: '${ b64( new Int8Array( ffHead.sVal ) ) }',
		expressions: [ 'open', 'smile', 'blink' ],
		exprIndex: '${ b64( new Uint16Array( ffHead.eIdx ) ) }',
		exprRec: '${ b64( new Uint32Array( ffHead.eRec ) ) }',
	},
	// ---- end FF3
};
`;
writeFileSync( OUT, js );
console.log( 'wrote', OUT, ( js.length / 1024 ).toFixed( 0 ), 'KB;', n, 'vertices,', tris.length, 'triangles' );
console.log( 'DIM', DIM );
console.log( 'uniform', U );
console.log( 'face', face );
