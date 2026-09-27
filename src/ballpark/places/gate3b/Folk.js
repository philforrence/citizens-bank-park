import { Sphere, Vector3 } from '../../../engine/index.js';
import { Cast, TOP as T, COLOR, HAT, CHEST, BACK, GEAR, PROP as CP, sign } from '../Cast.js';

// The Third Base plaza's people, drawn by the park's one figure system (places/Cast.js): the plaza's code
// (Arrivals, Cast, Vendors, the police, the celebration...) moves and poses them as it always has, with
// the angles, the look and the prop bits below, and this hands each one to Cast: the look turned into
// Cast's (the same clothes, and now a face, the cold in the cheeks, a build), the angles into Cast's
// pose, the prop bits into what's in each hand (an umbrella over the head, the scanner, the scalper's
// fan of tickets, the peanut bag, the NEED 2 TIX sign) and what's worn (a messenger bag, a backpack, a
// radio on the shoulder, a staff credential).
//
//   const folk = new Folk( parent );
//   const f = folk.add( { x, z, yaw, look, props, scale } );  f.pose (angles, pose() below), f.walk, f.phase,
//                                                             f.sit (0..1), f.ride, f.visible, f.mouth
//   folk.update()  (after moving and posing them)
//
// The angles (radians): arm flex raises the arm forward, abduct out to the side, elbow bends the forearm
// forward and up; lean forward, twist left; yaw (the head) left, pitch up. They're Cast's own, turned
// about the same axes (Cast's shoulder pitch, roll and elbow; its lean and twist; its head yaw and pitch,
// the pitch the other way).

const MAX = 600;

// the props: which bit shows them
export const PROP = {
	brim: 0, pom: 1, hood: 2, poncho: 3, bag: 4, backpack: 5, umbrella: 6, cup: 7, phone: 8, ticket: 9,
	program: 10, towel: 11, scanner: 12, sack: 13, flash: 14, sign: 15, tray: 16, mic: 17, glove: 18, hair: 19,
	shopbag: 20, fan: 21, radio: 22, badge: 23,
	// ---- P0: what Cast has that the plaza's people now carry
	camera: 24, cigarette: 25, tongs: 26, thermos: 27, transistor: 28,
};

// The look: 24 bits. top (5) | cell (5): the jersey's name and number, or the colour | pants (3) |
// head (3) | skin (2) | hair (2) | beard, glasses, kid, woman
export const TOP = {
	hoodieRed: 0, jerseyHome: 1, teeOverHoodie: 2, powderBlue: 3, jerseyRoad: 4, jacketBlack: 5, sweatGrey: 6,
	jacketNavy: 7, carhartt: 8, leather: 9, eagles: 10, windbreaker: 11, camo: 12, flyers: 13, raysJersey: 14,
	raysTee: 15, fleeceRed: 16, hoodieWhite: 17, parkaRed: 18, pufferBlack: 19,
	usher: 20, security: 21, police: 22, trooper: 23, vendor: 24, reporter: 25, crew: 26, bouncer: 27, storeStaff: 28,
	jerseyRed: 29, coatCamel: 30, raincoatYellow: 31,
};
export const HEAD = { bare: 0, capRed: 1, capNavy: 2, capWhite: 3, beanieRed: 4, beanieGrey: 5, hood: 6, uniform: 7 };
export const PANTS = { jeans: 0, darkJeans: 1, khaki: 2, black: 3, sweats: 4, navy: 5, uniformGrey: 6, camo: 7 };

// the names on the backs (Dress.js picks them by these)
export const CELL = {
	UTLEY: 0, HOWARD: 1, ROLLINS: 2, HAMELS: 3, BURRELL: 4, VICTORINO: 5, WERTH: 6, LIDGE: 7, MOYER: 8, RUIZ: 9,
	FELIZ: 10, MYERS: 11, SCHMIDT: 12, CARLTON: 13, ROSE: 14, DYKSTRA: 15, KRUK: 16, DAULTON: 17, LUZINSKI: 18,
	JENKINS: 19, LONGORIA: 20, UPTON: 21, COSTE: 22, ASHBURN: 23,
};
const CELL_BACK = Object.keys( CELL ).map( ( k ) => BACK[ k ] );

export function packLook( { top = 0, cell = 0, pants = 0, head = 0, skin = 0, hair = 0, beard = 0, glasses = 0, kid = 0, woman = 0 } = {} ) {

	return top | ( cell << 5 ) | ( pants << 10 ) | ( head << 13 ) | ( skin << 16 ) | ( hair << 18 ) | ( beard << 20 ) | ( glasses << 21 ) | ( kid << 22 ) | ( woman << 23 );

}

export function propBits( list ) {

	let b = 0;
	for ( const p of list ) b |= 1 << PROP[ p ];
	return b;

}

// a pose: every angle, and a bob of the whole body (m)
export function pose( o = {} ) {

	return {
		flexL: 0, abductL: 0.06, elbowL: 0.12, flexR: 0, abductR: 0.06, elbowR: 0.12,
		lean: 0, twist: 0, yaw: 0, pitch: 0,
		hipL: 0, kneeL: 0, hipR: 0, kneeR: 0, bob: 0, spread: 0, ...o,
	};

}

// the cardboard the man by the crosswalk holds up (he's been standing there since five)
const NEED_TIX = sign( ( ctx, w, h ) => {

	ctx.fillStyle = '#9a7b52';
	ctx.fillRect( 0, 0, w, h );
	ctx.fillStyle = 'rgba( 60, 40, 20, 0.25 )';
	for ( let i = 0; i < 6; i ++ ) ctx.fillRect( 0, 30 + i * 40, w, 2 );
	ctx.fillStyle = '#141414';
	ctx.textAlign = 'center';
	ctx.font = '900 64px "Marker Felt", "Comic Sans MS", sans-serif';
	ctx.fillText( 'NEED 2', w / 2, h * 0.43 );
	ctx.fillText( 'TIX', w / 2, h * 0.75 );
	ctx.font = '700 24px "Marker Felt", "Comic Sans MS", sans-serif';
	ctx.fillText( 'CASH $$$', w / 2, h * 0.93 );

}, 'gate-need-2-tix' );

// ---------------------------------------------------------------- the look, as Cast's

// (the small things by the figure's seed: the same person looks the same every night)
const h = ( seed, k ) => {

	const s = Math.sin( seed * 12.9898 * k + 78.233 * k ) * 43758.5453;
	return s - Math.floor( s );

};

// the 24-bit look and the worn prop bits (hood, poncho, long hair, bags, radio, badge) as Cast's look
function castLook( look, props, seed ) {

	const top = look & 31, cell = ( look >> 5 ) & 31, pants = ( look >> 10 ) & 7, head = ( look >> 13 ) & 7;
	const skin = ( look >> 16 ) & 3, hair = ( look >> 18 ) & 3, beard = ( look >> 20 ) & 1, glasses = ( look >> 21 ) & 1, kid = ( look >> 22 ) & 1, woman = ( look >> 23 ) & 1;
	const has = ( p ) => ( props >> PROP[ p ] ) & 1;
	const r = ( k ) => h( seed, k );
	const old = ! kid && r( 3 ) < 0.1;
	const L = {
		skin: [ [ 0, 1, 2 ][ Math.floor( r( 1 ) * 3 ) ], 3, r( 1 ) < 0.5 ? 4 : 5, 6 ][ skin ],
		hair: old ? ( r( 2 ) < 0.5 ? 6 : 7 ) : [ r( 2 ) < 0.5 ? 0 : 1, r( 2 ) < 0.5 ? 2 : 3, 4, 6 ][ hair ],
		hairStyle: has( 'hair' ) ? ( r( 4 ) < 0.65 ? 1 : 2 ) : ! woman && r( 5 ) < 0.12 ? 3 : 0,
		facial: beard ? [ 3, 2, 1 ][ Math.floor( r( 6 ) * 3 ) ] : ! woman && ! kid && r( 7 ) < 0.18 ? 4 : 0,
		glasses: !! glasses, female: !! woman, age: kid ? 2 : old ? 1 : r( 8 ) < 0.08 ? 3 : 0,
		build: kid ? 0 : Math.floor( r( 9 ) * ( woman ? 2.2 : 4 ) ) & 3,
		pants, shoes: r( 10 ) < 0.35 ? 0 : [ 1, 2, 3, 4 ][ Math.floor( r( 11 ) * 4 ) ],
		scarf: r( 12 ) < 0.3 ? ( r( 13 ) < 0.5 ? 1 : 3 ) : 0, gloves: r( 14 ) < 0.18,
		top: T.jacket, color: COLOR.red, sleeves: COLOR.grey, back: 0, chest: 0, hat: HAT.none, poncho: 0, gear: 0,
		seed: Math.floor( seed * 65536 ) & 65535,
	};
	const back = CELL_BACK[ cell ] || 0;
	switch ( top ) {

		case TOP.hoodieRed: Object.assign( L, { top: T.hoodie, color: COLOR.red, chest: CHEST.block } ); break;
		case TOP.jerseyHome: Object.assign( L, { top: T.homeJersey, color: COLOR.white, back, chest: CHEST.script, sleeves: [ COLOR.red, COLOR.grey, COLOR.white ][ Math.floor( r( 15 ) * 3 ) ] } ); break;
		case TOP.teeOverHoodie: Object.assign( L, { top: T.nameTee, color: COLOR.red, back, sleeves: COLOR.grey } ); break;
		case TOP.powderBlue: Object.assign( L, { top: T.powder, color: COLOR.powder, back, sleeves: COLOR.powder } ); break;
		case TOP.jerseyRoad: Object.assign( L, { top: T.roadJersey, color: COLOR.lightGrey, back, chest: CHEST.block, sleeves: COLOR.navy } ); break;
		case TOP.jacketBlack: Object.assign( L, { top: T.jacket, color: COLOR.black } ); break;
		case TOP.sweatGrey: Object.assign( L, { top: T.hoodie, color: COLOR.grey, chest: r( 16 ) < 0.5 ? CHEST.block : 0 } ); break;
		case TOP.jacketNavy: Object.assign( L, { top: T.jacket, color: COLOR.navy } ); break;
		case TOP.carhartt: Object.assign( L, { top: T.work, color: COLOR.tan } ); break;
		case TOP.leather: Object.assign( L, { top: T.leather, color: r( 17 ) < 0.7 ? COLOR.black : COLOR.brown } ); break;
		case TOP.eagles: Object.assign( L, { top: T.eagles, color: COLOR.green, chest: CHEST.eagles } ); break;
		case TOP.windbreaker: Object.assign( L, { top: T.jacket, color: COLOR.red, chest: CHEST.script } ); break;
		case TOP.camo: Object.assign( L, { top: T.camo, color: COLOR.olive } ); break;
		case TOP.flyers: Object.assign( L, { top: T.flyers, color: COLOR.orange, chest: CHEST.flyers } ); break;
		case TOP.raysJersey: Object.assign( L, { top: T.rays, color: COLOR.raysNavy, back, chest: CHEST.rays, sleeves: COLOR.raysNavy } ); break;
		case TOP.raysTee: Object.assign( L, { top: T.rays, color: COLOR.powder, chest: CHEST.rays, sleeves: COLOR.navy } ); break;
		case TOP.fleeceRed: Object.assign( L, { top: T.fleece, color: COLOR.red } ); break;
		case TOP.hoodieWhite: Object.assign( L, { top: T.hoodie, color: COLOR.white, chest: CHEST.block } ); break;
		case TOP.parkaRed: Object.assign( L, { top: T.puffer, color: COLOR.red } ); break;
		case TOP.pufferBlack: Object.assign( L, { top: T.puffer, color: COLOR.black } ); break;
		// the ticket takers in navy Phillies jackets (the NLDS photo), the bag check in red STAFF jackets
		case TOP.usher: Object.assign( L, { top: T.jacket, color: COLOR.navy, chest: CHEST.script } ); break;
		case TOP.security: Object.assign( L, { top: T.jacket, color: COLOR.red, back: BACK.STAFF, chest: CHEST.staff } ); break;
		// the city's police: black leather, the shield; a State Trooper's grey
		case TOP.police: Object.assign( L, { top: T.leather, color: COLOR.black, badge: true } ); break;
		case TOP.trooper: Object.assign( L, { top: T.trooper, color: COLOR.trooperGrey, sleeves: COLOR.trooperGrey } ); break;
		case TOP.vendor: Object.assign( L, { top: T.vendor, color: COLOR.navy } ); break;
		case TOP.reporter: Object.assign( L, { top: T.coat, color: COLOR.charcoal, scarf: 0 } ); break;
		case TOP.crew: Object.assign( L, { top: T.jacket, color: COLOR.black, back: BACK.FOX29 } ); break;
		case TOP.bouncer: Object.assign( L, { top: T.jacket, color: COLOR.black, back: BACK.SECURITY, chest: CHEST.security } ); break;
		case TOP.storeStaff: Object.assign( L, { top: T.polo, color: COLOR.red, sleeves: COLOR.red, chest: CHEST.staff } ); break;
		case TOP.jerseyRed: Object.assign( L, { top: T.nameTee, color: COLOR.red, back, sleeves: COLOR.red } ); break;
		case TOP.coatCamel: Object.assign( L, { top: T.coat, color: COLOR.camel } ); break;
		case TOP.raincoatYellow: Object.assign( L, { top: T.raincoat, color: COLOR.policeYellow, sleeves: COLOR.policeYellow, back: BACK.POLICE } ); break;

	}

	L.hat = [ HAT.none, HAT.capRed, HAT.capNavy, HAT.capWhite, HAT.knitRed, HAT.knitGrey, HAT.hood, HAT.police ][ head ];
	if ( head === HEAD.uniform && top === TOP.trooper ) L.hat = HAT.campaign;
	if ( head === HEAD.beanieRed && ! has( 'pom' ) ) L.hat = r( 18 ) < 0.5 ? HAT.knitPlain : HAT.knitRed;
	if ( has( 'hood' ) ) L.hat = HAT.hood;
	// a poncho: clear, MLB red, yellow, or a black trash bag
	if ( has( 'poncho' ) ) L.poncho = [ 1, 2, 4, 6 ][ Math.floor( r( 19 ) * 4 ) ];
	if ( has( 'bag' ) ) L.gear |= GEAR.messenger;
	if ( has( 'backpack' ) ) L.gear |= GEAR.backpack;
	if ( has( 'radio' ) ) L.gear |= GEAR.radio;
	if ( has( 'badge' ) ) L.gear |= GEAR.credential;
	// the uniformed: no scarves, gloves on the police
	if ( top >= TOP.usher && top <= TOP.storeStaff ) L.scarf = 0;
	if ( top === TOP.police || top === TOP.raincoatYellow || top === TOP.trooper ) L.gloves = top !== TOP.trooper;
	return L;

}

// the worn bits (they change the look; the held ones change the hands)
const WORN = propBits( [ 'pom', 'hood', 'poncho', 'bag', 'backpack', 'hair', 'radio', 'badge' ] );

// ---------------------------------------------------------------- the crowd

export class Folk {

	constructor( parent, field ) {

		this.field = field;
		this.cast = new Cast( { parent, max: MAX } );
		// where they are: the plaza, the streets round it, the lots with the tailgaters
		this.cast.bounds = new Sphere( new Vector3( - 100, 7, 60 ), 130 );
		this.list = [];
		this.counts = { near: 0, far: 0 };

	}

	set bounds( s ) {

		this.cast.bounds = s;

	}

	add( o = {} ) {

		if ( this.list.length >= MAX ) return null;
		const p = this.cast.add( castLook( o.look || 0, o.props || 0, o.seed ?? 0.5 ) );
		if ( ! p ) return null;
		const f = {
			x: 0, y: LEVELS_STREET, z: 0, yaw: 0, scale: 1, look: 0, props: 0, seed: Math.random(),
			walk: 0, phase: Math.random() * 6.28, sit: 0, visible: true, mouth: 0, pose: pose(), ...o,
		};
		if ( o.pose ) f.pose = pose( o.pose );
		f._p = p;
		f._key = null;
		this.list.push( f );
		return f;

	}

	// (eye: unused now: the pool picks the figures by the camera it's drawn for)
	update( eye ) {

		void eye;
		const C = this.cast;
		this._frame = ( this._frame || 0 ) + 1;
		for ( const [ i, f ] of this.list.entries() ) {

			const p = f._p;
			p.visible = !! f.visible;
			if ( ! f.visible ) continue;
			// the ones the camera didn't see last frame (Cast's p.lod) posed every fourth frame: where
			// they are, every frame (the pool culls by it)
			if ( p.lod === - 1 && ( this._frame + i ) % 4 ) {

				p.x = f.x; p.y = f.y; p.z = f.z; p.yaw = f.yaw;
				continue;

			}

			// re-dressed (a new arrival from the pool, a poncho on)
			const key = f.look * 33554432 + ( f.props & WORN ) + f.seed;
			if ( key !== f._key ) {

				f._key = key;
				C.setLook( p, castLook( f.look, f.props, f.seed ) );

			}

			const q = f.pose, a = p.pose, wk = Math.min( 1, f.walk ), ph = f.phase;
			p.x = f.x; p.y = f.y; p.z = f.z; p.yaw = f.yaw; p.scale = f.scale;
			// the walk: the legs in Cast's stride (its phase half a turn on from the plaza's), the arms
			// swinging against them (less when the hand's busy), a lean into it
			a.walk = wk;
			a.phase = ph + Math.PI;
			const swL = 1 - smooth( 0.5, 1.2, q.elbowL ) * 0.85, swR = 1 - smooth( 0.5, 1.2, q.elbowR ) * 0.85;
			const sn = Math.sin( ph );
			a.armL[ 0 ] = q.flexL - wk * 0.32 * sn * swL; a.armL[ 1 ] = q.abductL; a.armL[ 2 ] = 0; a.armL[ 3 ] = q.elbowL + wk * 0.22 * swL;
			a.armR[ 0 ] = q.flexR + wk * 0.32 * sn * swR; a.armR[ 1 ] = q.abductR; a.armR[ 2 ] = 0; a.armR[ 3 ] = q.elbowR + wk * 0.22 * swR;
			a.lean = q.lean + wk * 0.05;
			a.twist = q.twist + wk * 0.06 * sn;
			a.roll = 0;
			a.headYaw = q.yaw;
			a.headPitch = - q.pitch;
			// sat down (0..1), or astride a horse: the thighs forward (and apart), the knees bent
			const sit = f.sit || 0, ride = f.ride ? 1 : 0;
			a.hipL = a.hipR = sit * 1.45 + ride * 0.95;
			a.kneeL = a.kneeR = sit * 1.5 + ride * 1.25;
			a.drop = sit * 0.46;
			a.spread = ride * 0.42;
			a.mouth = f.mouth || 0;
			// a blink every few seconds, a breath
			const t = ( this.t || 0 ) + f.seed * 37;
			a.blink = ( t * 0.27 ) % 1 < 0.035 ? 1 : 0;
			a.breath = 0.5 + 0.5 * Math.sin( t * 1.4 );
			this._hands( f, a );

		}

		this.t = ( this.t || 0 ) + 1 / 60;
		C.update();
		this.count = C.drawn;
		this.counts = { near: C.drawnNear, far: C.drawn - C.drawnNear };

	}

	// what's in each hand, from the prop bits: one thing a hand, the first that fits
	_hands( f, a ) {

		const b = f.props, has = ( k ) => ( b >> PROP[ k ] ) & 1, q = f.pose;
		let R = 0, Lh = 0, vR = 0, vL = 0;
		const right = ( id, v = 0 ) => {

			if ( R ) return false;
			R = id; vR = v;
			return true;

		};

		const left = ( id, v = 0 ) => {

			if ( Lh ) return false;
			Lh = id; vL = v;
			return true;

		};

		const beer = h( f.seed, 21 ) < 0.5;
		// the right: what the arm's posed for first (the umbrella's up, the reporter's mic, the reader)
		if ( has( 'umbrella' ) ) right( CP.umbrella, [ 0, 3, 1, 2, 4, 5, 0 ][ Math.floor( h( f.seed, 22 ) * 7 ) ] );
		if ( has( 'mic' ) ) right( CP.mic );
		if ( has( 'scanner' ) ) right( CP.scanner );
		if ( has( 'sign' ) ) right( CP.sign, NEED_TIX );
		if ( has( 'fan' ) ) right( CP.tickets );
		if ( has( 'sack' ) ) right( CP.peanuts );
		if ( has( 'camera' ) ) right( CP.camera );
		if ( has( 'cigarette' ) ) right( CP.cigarette );
		if ( has( 'tongs' ) ) right( CP.tongs );
		// held up high: in the raised hand (the program seller's, the shirt man's)
		const up = q.flexR > 1.5;
		if ( has( 'program' ) && up ) right( CP.program );
		if ( has( 'towel' ) && up && ! ( q.flexL > 1.5 ) ) right( CP.towel );
		if ( has( 'cup' ) ) right( beer ? CP.beer : CP.cocoa ) || left( beer ? CP.beer : CP.cocoa );
		if ( has( 'phone' ) ) right( CP.phone ) || left( CP.phone );
		if ( has( 'ticket' ) ) right( CP.ticket ) || left( CP.ticket );
		// the left: the flashlight, the glove, the store's bag, the towel, the program, the radio, a thermos
		if ( has( 'flash' ) ) left( CP.flashlight );
		if ( has( 'glove' ) ) left( CP.glove );
		if ( has( 'shopbag' ) ) left( CP.bag );
		if ( has( 'towel' ) ) left( CP.towel ) || right( CP.towel );
		if ( has( 'program' ) ) left( CP.program ) || right( CP.program );
		if ( has( 'transistor' ) ) left( CP.radio );
		if ( has( 'thermos' ) ) left( CP.thermos ) || right( CP.thermos );
		a.propR = R; a.varR = vR;
		a.propL = Lh; a.varL = vL;

	}

}

const smooth = ( e0, e1, x ) => {

	const t = Math.max( 0, Math.min( 1, ( x - e0 ) / ( e1 - e0 ) ) );
	return t * t * ( 3 - 2 * t );

};

const LEVELS_STREET = 7.0104;
