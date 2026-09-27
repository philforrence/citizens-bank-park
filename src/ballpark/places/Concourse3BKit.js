import { offsetPolyline } from '../Bowl.js';
import { J, TOP, COLOR, HAT, BACK, CHEST } from './Cast.js';

// The kit for the third base concourse (Concourse3B.js): where things are along it, how an arm reaches a
// point, how a fan dresses on a cold October night in 2008.

// ---------------------------------------------------------------- the concourse's lines

// Along the concourse at distance d out from the field level's front line (the bowl's path): s is metres
// along the middle of the walkway (d = MID) from behind home plate (s = 0 at x = 0) toward third base.
// The normal turns smoothly round the corners, so a lane at any d is a smooth curve.
export const MID = 37;

export class Walkway {

	constructor( path ) {

		const P = offsetPolyline( path, MID, [ 0, - 40 ] );
		this.pts = P;
		this.cum = [ 0 ];
		for ( let i = 1; i < P.length; i ++ ) this.cum.push( this.cum[ i - 1 ] + Math.hypot( P[ i ][ 0 ] - P[ i - 1 ][ 0 ], P[ i ][ 1 ] - P[ i - 1 ][ 1 ] ) );
		// s = 0 where the line crosses x = 0 behind home plate
		this.s0 = 0;
		for ( let i = 0; i < P.length - 1; i ++ ) {

			const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
			if ( ax >= 0 && bx < 0 && az > 0 ) {

				this.s0 = this.cum[ i ] + ( this.cum[ i + 1 ] - this.cum[ i ] ) * ( ax / ( ax - bx ) );
				break;

			}

		}

		// each segment's direction and its normal toward the field
		this.seg = [];
		for ( let i = 0; i < P.length - 1; i ++ ) {

			const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
			const l = Math.hypot( bx - ax, bz - az ), ux = ( bx - ax ) / l, uz = ( bz - az ) / l;
			let nx = - uz, nz = ux;
			if ( nx * ( 0 - ax ) + nz * ( - 40 - az ) < 0 ) {

				nx = - nx; nz = - nz;

			}

			this.seg.push( { ux, uz, nx, nz } );

		}

	}

	// the point s along, d out: { x, z, ux, uz (along, toward third), nx, nz (toward the field) }
	at( s, d = MID ) {

		const S = s + this.s0, C = this.cum, n = this.seg.length;
		let i = 0;
		while ( i < n - 1 && C[ i + 1 ] < S ) i ++;
		const t = ( S - C[ i ] ) / ( C[ i + 1 ] - C[ i ] );
		const [ ax, az ] = this.pts[ i ], [ bx, bz ] = this.pts[ i + 1 ];
		const x = ax + ( bx - ax ) * t, z = az + ( bz - az ) * t;
		// the normal, blended over 6 m either side of a corner
		const R = 6;
		let { ux, uz, nx, nz } = this.seg[ i ];
		const blend = ( j, k ) => {

			const o = this.seg[ j ];
			ux = ux * ( 1 - k ) + o.ux * k; uz = uz * ( 1 - k ) + o.uz * k;
			nx = nx * ( 1 - k ) + o.nx * k; nz = nz * ( 1 - k ) + o.nz * k;

		};

		if ( i < n - 1 && C[ i + 1 ] - S < R ) blend( i + 1, 0.5 * ( 1 - ( C[ i + 1 ] - S ) / R ) );
		else if ( i > 0 && S - C[ i ] < R ) blend( i - 1, 0.5 * ( 1 - ( S - C[ i ] ) / R ) );
		const l = Math.hypot( nx, nz ), lu = Math.hypot( ux, uz );
		nx /= l; nz /= l; ux /= lu; uz /= lu;
		return { x: x - nx * ( d - MID ), z: z - nz * ( d - MID ), ux, uz, nx, nz };

	}

	// the ( s, d ) of a field point
	toSD( x, z ) {

		let best = Infinity, bs = 0, bd = 0;
		for ( let i = 0; i < this.pts.length - 1; i ++ ) {

			const [ ax, az ] = this.pts[ i ], [ bx, bz ] = this.pts[ i + 1 ];
			const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
			const t = Math.max( 0, Math.min( 1, ( ( x - ax ) * dx + ( z - az ) * dz ) / l2 ) );
			const px = ax + dx * t, pz = az + dz * t, dist = Math.hypot( x - px, z - pz );
			if ( dist < best ) {

				best = dist;
				bs = this.cum[ i ] + Math.sqrt( l2 ) * t - this.s0;
				const { nx, nz } = this.seg[ i ];
				bd = MID - ( ( x - px ) * nx + ( z - pz ) * nz );

			}

		}

		return [ bs, bd ];

	}

	// the yaw that faces along ( dx, dz ) (the cast faces -z at yaw 0)
	static yaw( dx, dz ) {

		return Math.atan2( - dx, - dz );

	}

}

// ---------------------------------------------------------------- reaching: a two-bone arm to a point

// the rotations as the cast's shader has them (Cast.js, c3Rx / c3Ry / c3Rz)
const rx = ( a, v ) => {

	const c = Math.cos( a ), s = Math.sin( a );
	return [ v[ 0 ], c * v[ 1 ] - s * v[ 2 ], s * v[ 1 ] + c * v[ 2 ] ];

};
const ry = ( a, v ) => {

	const c = Math.cos( a ), s = Math.sin( a );
	return [ c * v[ 0 ] + s * v[ 2 ], v[ 1 ], - s * v[ 0 ] + c * v[ 2 ] ];

};
const rz = ( a, v ) => {

	const c = Math.cos( a ), s = Math.sin( a );
	return [ c * v[ 0 ] - s * v[ 1 ], s * v[ 0 ] + c * v[ 1 ], v[ 2 ] ];

};
const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] ];
const add = ( a, b ) => [ a[ 0 ] + b[ 0 ], a[ 1 ] + b[ 1 ], a[ 2 ] + b[ 2 ] ];
const sided = ( j, s ) => [ j[ 0 ] * s, j[ 1 ], j[ 2 ] ];

// the hand (and the elbow) of an arm posed [ pitch, roll, yaw, elbow ], side s (-1 left, +1 right), the
// trunk turned { lean, twist, roll }
export function armFK( s, a, trunk = null ) {

	const sh = sided( J.shoulder, s ), el = sided( J.elbow, s ), ha = sided( J.hand, s );
	const Ra = ( v ) => ry( s * a[ 2 ], rz( s * a[ 1 ], rx( a[ 0 ], v ) ) );
	let h = add( rx( a[ 3 ], sub( ha, el ) ), sub( el, sh ) );
	h = add( Ra( h ), sh );
	let e = add( Ra( sub( el, sh ) ), sh );
	if ( trunk ) {

		const sp = J.spine;
		const Rs = ( v ) => add( ry( trunk.twist || 0, rz( trunk.roll || 0, rx( - ( trunk.lean || 0 ), sub( v, sp ) ) ) ), sp );
		h = Rs( h );
		e = Rs( e );

	}

	return { hand: h, elbow: e };

}

// The arm pose that puts the hand at `target` (figure space, standing, facing -z), the elbow kept down
// and out: a few hundred steps of gradient descent from a natural start. Returns [ pitch, roll, yaw,
// elbow ].
export function armIK( s, target, trunk = null, start = [ 0.4, 0.1, 0.2, 1.0 ] ) {

	const lo = [ - 0.9, - 0.15, - 0.7, 0.02 ], hi = [ 3.1, 1.7, 1.3, 2.55 ];
	const pref = [ 0.3, 0.12, 0.1, 0.8 ];
	const cost = ( a ) => {

		const { hand, elbow } = armFK( s, a, trunk );
		const d = sub( hand, target );
		let c = d[ 0 ] * d[ 0 ] + d[ 1 ] * d[ 1 ] + d[ 2 ] * d[ 2 ];
		// the elbow down, not up by the ear; out from the body, not through it
		c += 0.02 * Math.max( 0, elbow[ 1 ] - ( J.shoulder[ 1 ] - 0.05 ) ) ** 2;
		c += 0.05 * Math.max( 0, 0.14 - elbow[ 0 ] * s ) ** 2;
		for ( let k = 0; k < 4; k ++ ) c += 0.0004 * ( a[ k ] - pref[ k ] ) ** 2;
		return c;

	};

	let a = start.slice(), c = cost( a ), step = 0.4;
	for ( let it = 0; it < 400 && step > 1e-4; it ++ ) {

		const g = [ 0, 0, 0, 0 ];
		for ( let k = 0; k < 4; k ++ ) {

			const b = a.slice();
			b[ k ] += 1e-3;
			g[ k ] = ( cost( b ) - c ) / 1e-3;

		}

		const gl = Math.hypot( ...g ) || 1;
		const b = a.map( ( v, k ) => Math.max( lo[ k ], Math.min( hi[ k ], v - step * g[ k ] / gl ) ) );
		const cb = cost( b );
		if ( cb < c ) {

			a = b; c = cb; step *= 1.2;

		} else step *= 0.5;

	}

	return a;

}

// the gestures, solved once for a standard figure: [ left arm, right arm ] (null: at rest)
export const GESTURE = {};
{

	const both = ( l, r, trunk ) => [ l && armIK( - 1, l, trunk ), r && armIK( 1, r, trunk ) ];
	// a drink carried at the chest; brought up to drink
	GESTURE.carry = [ null, armIK( 1, [ 0.16, 1.07, - 0.2 ] ) ];
	GESTURE.carryL = [ armIK( - 1, [ - 0.16, 1.07, - 0.2 ] ), null ];
	GESTURE.sip = [ null, armIK( 1, [ 0.07, 1.5, - 0.13 ] ) ];
	// both hands round a hot cup at the chest (the cup's in the right)
	GESTURE.warm = both( [ - 0.03, 1.17, - 0.2 ], [ 0.05, 1.12, - 0.2 ] );
	// blowing into cupped hands
	GESTURE.blow = both( [ - 0.035, 1.49, - 0.15 ], [ 0.035, 1.47, - 0.15 ] );
	// arms folded against the cold
	GESTURE.fold = both( [ 0.1, 1.17, - 0.14 ], [ - 0.1, 1.21, - 0.13 ] );
	// the tray held in front at the waist
	GESTURE.tray = both( [ - 0.17, 1.0, - 0.24 ], [ 0.17, 1.0, - 0.24 ] );
	// a flip phone to the ear
	GESTURE.phone = [ null, armIK( 1, [ 0.1, 1.56, - 0.01 ] ) ];
	GESTURE.text = [ null, armIK( 1, [ 0.08, 1.2, - 0.28 ] ) ];
	// reaching out over a counter: paying, taking the food
	GESTURE.reach = [ null, armIK( 1, [ 0.12, 1.12, - 0.52 ] ) ];
	GESTURE.reachL = [ armIK( - 1, [ - 0.1, 1.12, - 0.5 ] ), null ];
	// a program held up to sell it, a program read
	GESTURE.holdUp = [ null, armIK( 1, [ 0.2, 1.98, - 0.18 ] ) ];
	GESTURE.read = both( [ - 0.1, 1.22, - 0.3 ], [ 0.1, 1.22, - 0.3 ] );
	// hands on the head (a Rays run), clapping, pointing the way
	GESTURE.head = both( [ - 0.09, 1.72, - 0.02 ], [ 0.09, 1.72, - 0.02 ] );
	GESTURE.clap = both( [ - 0.02, 1.3, - 0.3 ], [ 0.02, 1.3, - 0.3 ] );
	GESTURE.clapOpen = both( [ - 0.15, 1.3, - 0.28 ], [ 0.15, 1.3, - 0.28 ] );
	GESTURE.point = [ null, armIK( 1, [ 0.35, 1.45, - 0.55 ] ) ];
	// holding a kid's hand (the kid on the right, low)
	GESTURE.holdHand = [ null, armIK( 1, [ 0.34, 0.9, - 0.05 ] ) ];
	// the arms raised, the fists up: cheering
	GESTURE.cheer = [ [ 2.75, 0.35, 0.0, 0.35 ], [ 2.75, 0.35, 0.0, 0.35 ] ];
	GESTURE.fist = [ null, [ 2.6, 0.25, 0.1, 0.9 ] ];
	// hands in the jacket's pockets
	GESTURE.pockets = [ [ - 0.12, 0.14, - 0.05, 0.55 ], [ - 0.12, 0.14, - 0.05, 0.55 ] ];
	// lifting a kid under the arms
	GESTURE.lift = both( [ - 0.14, 1.3, - 0.3 ], [ 0.14, 1.3, - 0.3 ] );
	GESTURE.liftHigh = both( [ - 0.13, 1.68, - 0.28 ], [ 0.13, 1.68, - 0.28 ] );

}

// the arms on the drink rail, leaning on it: for a figure of scale k (the rail's top is 1.07 m)
export function railArms( k, lean = 0.3 ) {

	const y = 1.1 / k, trunk = { lean };
	return [ armIK( - 1, [ - 0.17, y, - 0.42 ], trunk ), armIK( 1, [ 0.17, y, - 0.42 ], trunk ) ];

}

// ---------------------------------------------------------------- dressing a fan

// a small seeded random generator (mulberry32)
export function rng( seed ) {

	let a = seed >>> 0;
	return () => {

		a = ( a + 0x6D2B79F5 ) >>> 0;
		let t = a;
		t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
		t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;

	};

}

export function pick( r, table ) {

	let sum = 0;
	for ( const k in table ) sum += table[ k ];
	let x = r() * sum;
	for ( const k in table ) {

		x -= table[ k ];
		if ( x <= 0 ) return k;

	}

	return Object.keys( table )[ 0 ];

}

// A Phillies fan at Game 5, cold and (on the 27th) wet: mostly red, layered, a knit hat or a cap, the
// home whites or a name-and-number tee over a hoodie or a thermal, UTLEY 26 most of all; the odd 1980
// powder blue, an Eagles jacket, a brave Rays fan. o: { age, female, kid, poncho (the 27th) }.
export function dress( r, o = {} ) {

	const female = o.female ?? r() < 0.36;
	const age = o.age ?? Number( pick( r, { 0: 70, 1: 13, 3: 9, 2: 8 } ) );
	const kid = age === 2;
	const skin = Number( pick( r, { 0: 22, 1: 26, 2: 17, 3: 10, 4: 8, 5: 7, 6: 5, 7: 5 } ) );
	const hair = age === 1 ? Number( pick( r, { 6: 5, 7: 4, 2: 1 } ) ) : Number( pick( r, { 0: 22, 1: 26, 2: 22, 3: 12, 4: female ? 12 : 5, 5: 4 } ) );
	const L = {
		skin, hair, female, age, glasses: r() < ( age === 1 ? 0.5 : 0.16 ),
		hairStyle: female ? ( r() < 0.6 ? 1 : 2 ) : ( age === 1 && r() < 0.4 ? 3 : 0 ),
		facial: female || kid ? 0 : Number( pick( r, { 0: 55, 1: 8, 2: 12, 3: 9, 4: 16 } ) ),
		build: kid ? 0 : Number( pick( r, female ? { 0: 45, 1: 45, 3: 10 } : { 0: 22, 1: 38, 2: 18, 3: 22 } ) ),
		pants: Number( pick( r, { 0: 44, 1: 22, 2: 10, 3: 12, 4: 7, 5: 5 } ) ),
		shoes: Number( pick( r, { 0: 38, 1: 22, 2: 18, 3: 12, 4: 10 } ) ),
		scarf: r() < 0.12 ? Number( pick( r, { 1: 5, 2: 3, 3: 2 } ) ) : 0,
		gloves: r() < 0.18,
		back: 0, chest: 0, sleeves: COLOR.grey, poncho: 0,
		seed: Math.floor( r() * 65536 ),
	};
	// what's on top
	const top = o.top ?? pick( r, {
		jacket: 20, hoodie: 15, homeJersey: 13, nameTee: 10, fleece: 6, puffer: 8, leather: kid ? 0 : 4, work: kid || female ? 1 : 5,
		powder: 2, satin: 4, champsTee: 5, eagles: 2, roadJersey: 2, rays: 0.8,
	} );
	L.top = TOP[ top ];
	const red = r() < 0.62;
	L.color = {
		jacket: red ? COLOR.red : Number( pick( r, { [ COLOR.black ]: 5, [ COLOR.navy ]: 3, [ COLOR.charcoal ]: 2, [ COLOR.maroon ]: 2 } ) ),
		hoodie: red ? COLOR.red : Number( pick( r, { [ COLOR.grey ]: 5, [ COLOR.black ]: 3, [ COLOR.navy ]: 2, [ COLOR.maroon ]: 1 } ) ),
		homeJersey: COLOR.white, nameTee: COLOR.red, powder: COLOR.powder, roadJersey: COLOR.lightGrey,
		fleece: Number( pick( r, { [ COLOR.red ]: 3, [ COLOR.navy ]: 3, [ COLOR.grey ]: 2, [ COLOR.black ]: 2 } ) ),
		puffer: Number( pick( r, { [ COLOR.black ]: 6, [ COLOR.navy ]: 2, [ COLOR.red ]: 2, [ COLOR.charcoal ]: 1 } ) ),
		leather: Number( pick( r, { [ COLOR.black ]: 4, [ COLOR.brown ]: 2 } ) ),
		work: Number( pick( r, { [ COLOR.tan ]: 4, [ COLOR.brown ]: 2, [ COLOR.olive ]: 1 } ) ),
		satin: COLOR.red, champsTee: Number( pick( r, { [ COLOR.grey ]: 3, [ COLOR.red ]: 2, [ COLOR.black ]: 1 } ) ),
		eagles: COLOR.green, rays: r() < 0.5 ? COLOR.raysNavy : COLOR.white,
	}[ top ];
	// under a jersey or a tee: a hoodie or a thermal
	L.sleeves = Number( pick( r, { [ COLOR.grey ]: 4, [ COLOR.black ]: 3, [ COLOR.red ]: 3, [ COLOR.white ]: 2, [ COLOR.navy ]: 2 } ) );
	if ( top === 'homeJersey' || top === 'nameTee' || top === 'roadJersey' ) {

		L.back = Number( pick( r, {
			[ BACK.UTLEY ]: 26, [ BACK.HOWARD ]: 17, [ BACK.ROLLINS ]: 16, [ BACK.HAMELS ]: 13, [ BACK.VICTORINO ]: 7, [ BACK.BURRELL ]: 7, [ BACK.WERTH ]: 4,
			[ BACK.LIDGE ]: 6, [ BACK.MYERS ]: 2, [ BACK.RUIZ ]: 3, [ BACK.MOYER ]: 3, [ BACK.FELIZ ]: 1, [ BACK.SCHMIDT ]: 4, [ BACK.CARLTON ]: 2,
			[ BACK.DYKSTRA ]: 1, [ BACK.DAULTON ]: 1, [ BACK.KRUK ]: 1, [ BACK.THOME ]: 1, [ BACK.ASHBURN ]: 1, [ BACK.MADSON ]: 1, [ BACK.BLANTON ]: 1, [ BACK.STAIRS ]: 1, [ BACK.DOBBS ]: 0.5,
		} ) );
		L.chest = top === 'homeJersey' ? CHEST.script : top === 'nameTee' ? CHEST.none : CHEST.block;

	}

	if ( top === 'powder' ) L.back = r() < 0.6 ? BACK.SCHMIDT : r() < 0.5 ? BACK.CARLTON : BACK.BOWA;
	if ( top === 'rays' ) L.back = r() < 0.6 ? BACK.CRAWFORD : BACK.LONGORIA;
	if ( top === 'rays' ) L.chest = CHEST.rays;
	if ( top === 'champsTee' ) L.chest = CHEST.champs;
	if ( top === 'hoodie' && L.color === COLOR.red && r() < 0.7 ) L.chest = CHEST.block;
	if ( top === 'hoodie' && L.color === COLOR.grey && r() < 0.6 ) L.chest = CHEST.block;
	if ( top === 'eagles' ) L.chest = CHEST.eagles;
	// on the head: a knit hat on a cold night, a cap, a hood up
	const hat = o.hat ?? pick( r, {
		capRed: 27, knitRed: 13, knitGrey: 5, knitBlack: 6, knitPlain: 4, capNavy: 4, cap1980: 3, capBack: kid ? 1 : 3,
		hood: top === 'hoodie' ? 14 : 3, none: female ? 26 : 16, capBlack: 2, earmuffs: female ? 2 : 0,
	} );
	L.hat = top === 'rays' ? HAT.capRays : HAT[ hat ];
	if ( L.hat === HAT.hood && top !== 'hoodie' && top !== 'puffer' && top !== 'fleece' ) L.hat = HAT.knitRed;
	// in a poncho on the 27th: clear plastic mostly, some red, a few white
	L.poncho = o.poncho ? Number( pick( r, { 1: 60, 2: 25, 3: 10, 4: 5 } ) ) : 0;
	return L;

}

// the height a figure is drawn at (the cast is built 1.75 m tall)
export function sizeOf( L, r ) {

	if ( L.age === 2 ) return 0.56 + 0.14 * r();
	if ( L.age === 3 ) return 0.92 + 0.06 * r();
	return ( L.female ? 0.92 : 0.98 ) + 0.08 * r() + ( L.build === 2 ? 0.03 : 0 );

}
