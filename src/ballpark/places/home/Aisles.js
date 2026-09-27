import { TOP, COLOR, HAT, CHEST, PROP, restPose } from '../Cast.js';
import { Walkway, armIK, GESTURE } from '../Concourse3BKit.js';
import { SEATED, easeArms } from './Poses.js';
import { GEAR } from './Gear.js';
import { hash, fract, wrap } from './Fans.js';

// The aisles behind home plate, and who works them. The two aisles either side of the backstop's section
// ('A' on the first base side, 'B' on the third) climb from the Diamond Club's front row to the main
// concourse; the vendors come down them from the concourse, calling, stop where a hand goes up, and the
// beer goes along the row hand to hand, the money coming back the same way. The Diamond Club's rows have
// their own: an usher on each aisle and a server taking orders.
//
// Every walker runs a little script (a generator: each `yield` is a frame), so a sequence reads as it
// happens: walk down to row 16, turn to the row, pour, hand it over, wait for the money, pocket it,
// call, walk on. After a jump in the replay the scripts start again.
//
// Invented (CAST.md): Jimmy Donnelly (beer, badge 47, his 29th season: his first October was the 1980
// Series), Kyle Brandt (beer, his first season), Reggie Timmons (hot dogs; hot chocolate on the 27th),
// Tina Maldonado (cotton candy), Luis Ortega (peanuts, which he throws); Earl Whitaker and Carmen
// Ortiz (the club's ushers); Megan Sweeney (a club server). The beer stops after the 7th.

const TAU = Math.PI * 2;
// the aisles' sides: from aisle A the backstop's rows run on toward third (their seats' i from 0), from B
// toward first (from the row's end)
const SIDE = { A: 1, B: - 1 };

export class Aisles {

	constructor( place ) {

		this.place = place;
		this.seats = place.seats;
		this.fans = place.fans;
		this.cast = place.cast;
		this.gear = place.gear;
		this.walkers = [];
		this._t = null;
		this._vendors();
		this._ushers();

	}

	// a walker: someone the aisles move (a new cast figure)
	walker( name, look, o = {} ) {

		const p = this.cast.add( look.dry );
		if ( ! p ) return null;
		const w = new Walker( this, p, name, look, o );
		this.walkers.push( w );
		return w;

	}

	_vendors() {

		const L = ( o ) => ( {
			skin: 1, hair: 1, hairStyle: 0, facial: 0, glasses: false, female: false, age: 0, build: 1, top: TOP.hawker, color: COLOR.yellow,
			sleeves: COLOR.black, back: 0, chest: 0, pants: 2, shoes: 1, hat: HAT.capRed, poncho: 0, scarf: 0, gloves: false, seed: 0, ...o,
		} );
		const V = [
			// name, the look, its gear on each night, the aisle, which rows (low, high)
			[ 'Jimmy Donnelly', L( { skin: 0, hair: 6, facial: 1, build: 3, sleeves: COLOR.navy, hat: HAT.capRed, seed: 2001 } ), { 27: GEAR.beer, 29: GEAR.beer }, 'A', 0.95, 47 ],
			[ 'Kyle Brandt', L( { skin: 0, hair: 3, age: 3, build: 0, sleeves: COLOR.grey, hat: HAT.capBack, seed: 2002 } ), { 27: GEAR.beer, 29: GEAR.beer }, 'B', 1.1, 112 ],
			[ 'Reggie Timmons', L( { skin: 5, hair: 0, facial: 2, build: 2, sleeves: COLOR.black, hat: HAT.knitBlack, seed: 2003 } ), { 27: GEAR.cocoa, 29: GEAR.hotdogs }, 'A', 1.0, 0 ],
			[ 'Tina Maldonado', L( { female: true, skin: 2, hair: 0, hairStyle: 2, build: 1, sleeves: COLOR.red, hat: HAT.capRed, seed: 2004 } ), { 27: GEAR.cotton, 29: GEAR.cotton }, 'B', 0.9, 0 ],
			[ 'Luis Ortega', L( { skin: 3, hair: 0, age: 3, build: 0, sleeves: COLOR.grey, hat: HAT.capRed, seed: 2005 } ), { 27: GEAR.peanuts, 29: GEAR.peanuts }, 'B', 1.15, 0 ],
		];
		this.vendors = V.map( ( [ name, look, gear, aisle, speed ], k ) => {

			// on the 27th a poncho over the shirt, the hood up
			const w = this.walker( name, { wet: { ...look, poncho: k === 1 ? 4 : 1, hat: k === 3 ? HAT.hood : look.hat }, dry: { ...look, hat: k === 1 ? HAT.knitBlack : look.hat, gloves: k !== 3 } }, { aisle, speed, gear, kind: gear[ 29 ], k } );
			w.routine = vendor;
			return w;

		} );

	}

	_ushers() {

		// the club's ushers (the 2004-2008 photos: a red jacket with royal-blue side panels, khakis, a red cap)
		const U = ( o ) => ( {
			skin: 1, hair: 7, hairStyle: 0, facial: 0, glasses: true, female: false, age: 1, build: 2, top: TOP.usher, color: COLOR.red, sleeves: COLOR.red,
			back: 0, chest: 0, pants: 2, shoes: 1, hat: HAT.capRed, poncho: 0, scarf: 0, gloves: false, seed: 0, ...o,
		} );
		const earl = U( { skin: 5, hair: 7, facial: 1, seed: 2101 } );
		const carmen = U( { female: true, skin: 2, hair: 1, hairStyle: 2, glasses: false, build: 1, age: 0, seed: 2102 } );
		this.ushers = [ [ 'Earl Whitaker', earl, 'A' ], [ 'Carmen Ortiz', carmen, 'B' ] ].map( ( [ name, look, aisle ] ) => {

			const w = this.walker( name, { wet: { ...look, poncho: 1 }, dry: { ...look, gloves: true } }, { aisle, speed: 0.8 } );
			w.routine = usher;
			return w;

		} );

	}

	// the fans of the place in row r near aisle `key`, from the aisle in: [ fan, ... ] (stops at a seat the
	// place hasn't got)
	chain( key, r ) {

		const row = this.seats.bySec[ 9 ][ r ] || [];
		const seq = SIDE[ key ] > 0 ? row : row.slice().reverse();
		const out = [];
		for ( const s of seq ) {

			const f = this.fans.bySeat.get( s );
			if ( ! f ) break;
			out.push( f );

		}

		return out;

	}

	update( dt, N ) {

		// a jump in the replay: everyone's script starts over, run on a simulated minute and a half (so a
		// shot never opens on empty aisles), the fans' half-done hand-offs dropped
		if ( this._t === null || Math.abs( N.t - this._t - dt ) > 5 ) {

			for ( const w of this.walkers ) w.restart( N );
			for ( let i = 0; i < 360; i ++ ) for ( const w of this.walkers ) w.tick( 0.25, N );
			for ( const f of this.fans.list ) f.acts.length = 0;
			this.gear.items.length = 0;

		}

		this._t = N.t;
		for ( const w of this.walkers ) w.tick( dt, N );

	}

}

// ---------------------------------------------------------------- someone on the move

class Walker {

	constructor( aisles, p, name, look, o ) {

		this.A = aisles;
		this.p = p;
		this.name = name;
		this.looks = { 27: look.wet, 29: look.dry };
		this.o = o;
		this.aisle = o.aisle;
		this.speed = o.speed ?? 1;
		this.seed = hash( ( o.k ?? 0 ) * 17.3 + name.length );
		p.pose = restPose();
		this.d = 30;
		this.yaw = 0;
		this.arms = [ [ 0.05, 0.06, 0, 0.12 ], [ 0.05, 0.06, 0, 0.12 ] ];
		this.g = null; // the arms' gesture now ([ l, r ])
		this.props = [ 0, 0 ];
		this.mouth = 0;
		this.look = null; // a field point to look at
		this.face = null; // a yaw to turn to (standing)
		this.walking = 0;
		this.shown = false;
		this.gearType = 0;
		this.night = 0;

	}

	restart( N ) {

		this.gen = this.routine( this, N );
		this.N = N;

	}

	// where on the aisle ( d metres back ), a little off its middle toward a side
	place( d, off = 0 ) {

		const S = this.A.seats;
		const [ x, y, z ] = S.aisle( this.aisle, d );
		// the aisle's direction there (up it), and across
		const [ x2, , z2 ] = S.aisle( this.aisle, d + 0.5 );
		const ux = ( x2 - x ) / 0.5, uz = ( z2 - z ) / 0.5, l = Math.hypot( ux, uz ) || 1;
		this.up = [ ux / l, uz / l ];
		this.p.x = x + ( - uz / l ) * off;
		this.p.z = z + ( ux / l ) * off;
		this.p.y = y;

	}

	tick( dt, N ) {

		this.N = N;
		this.dt = dt;
		const night = N.first ? 27 : 29;
		if ( night !== this.night ) {

			this.night = night;
			this.A.cast.setLook( this.p, this.looks[ night ] );

		}

		if ( ! this.gen ) this.restart( N );
		this.gen.next();
		const p = this.p, a = p.pose;
		p.visible = this.shown;
		if ( ! this.shown ) return;
		// the stride
		const v = this.walking * this.speed;
		a.walk += ( Math.min( 1, v / 0.8 ) - a.walk ) * Math.min( 1, dt * 5 );
		a.phase = ( a.phase + dt * v / ( 1.0 * p.scale ) * TAU ) % TAU;
		// the arms: the gesture, or swinging free
		const sw = Math.sin( a.phase ) * 0.35 * a.walk;
		const target = this.g || [ [ sw, 0.07, 0, 0.18 ], [ - sw, 0.07, 0, 0.18 ] ];
		easeArms( this.arms, target, Math.min( 1, dt * 8 ) );
		a.armL = this.arms[ 0 ];
		a.armR = this.arms[ 1 ];
		a.propL = this.props[ 0 ];
		a.propR = this.props[ 1 ];
		// turning to where he's going, or to what he's facing
		if ( this.face !== null ) this.yaw = wrap( this.yaw + wrap( this.face - this.yaw ) * Math.min( 1, dt * 5 ) );
		p.yaw = this.yaw;
		// the head: at what he's looking at, else ahead
		let hy = 0, hp = 0.15;
		if ( this.look ) {

			const dx = this.look[ 0 ] - p.x, dz = this.look[ 2 ] - p.z;
			hy = Math.max( - 1.1, Math.min( 1.1, wrap( Walkway.yaw( dx, dz ) - p.yaw ) ) );
			hp = - Math.atan2( this.look[ 1 ] - p.y - 1.55, Math.hypot( dx, dz ) );

		}

		a.headYaw += ( hy - a.headYaw ) * Math.min( 1, dt * 4 );
		a.headPitch += ( Math.max( - 0.5, Math.min( 0.7, hp ) ) - a.headPitch ) * Math.min( 1, dt * 4 );
		a.mouth = this.mouth;
		a.blink = fract( N.t * 0.33 + this.seed * 7 ) < 0.035 ? 1 : 0;
		a.lean = ( this.lean || 0 ) + 0.03 * a.walk;
		a.drop = 0; a.hipL = a.hipR = a.kneeL = a.kneeR = 0;
		// the gear: at his feet's origin, turned with him
		if ( this.gearType ) this.A.gear.put( this.gearType, p.x, p.y + ( this.gearLift || 0 ), p.z, p.yaw, p.scale );

	}

}

// ---------------------------------------------------------------- the scripts

function* wait( w, s ) {

	let t = 0;
	while ( t < s ) {

		yield;
		t += w.dt;

	}

}

// walk along the aisle to depth d (facing the way he goes)
function* walkTo( w, d, onStep = null ) {

	while ( Math.abs( w.d - d ) > 0.05 ) {

		const dir = Math.sign( d - w.d );
		// slower down the steps than up them, and slower still with a full bin
		const v = w.speed * ( dir < 0 ? 0.55 : 0.5 );
		w.d += dir * Math.min( Math.abs( d - w.d ), v * w.dt );
		w.walking = 1;
		w.place( w.d );
		w.face = Walkway.yaw( w.up[ 0 ] * dir, w.up[ 1 ] * dir );
		onStep?.();
		yield;

	}

	w.walking = 0;

}

// the depth of row r's middle along an aisle
const rowD = ( w, r ) => w.A.seats.rowD( r );

// the row's direction from the aisle into the section (the way the chain goes)
function intoRow( w ) {

	const S = w.A.seats.secs[ 9 ];
	const s = SIDE[ w.aisle ];
	return Walkway.yaw( S.ux * s, S.uz * s );

}

function* vendor( w, N0 ) {

	const A = w.A;
	// the rows he works (behind the club: the club's own staff serve its rows)
	const ROWS = [ 28, 25, 22, 19, 16, 13, 10, 7 ];
	const top = rowD( w, 35 ) + 0.6;
	// a stagger so they don't all come down at once
	w.shown = false;
	yield* wait( w, 6 + 40 * w.seed );
	for ( ;; ) {

		const N = w.N;
		const night = N.first ? 27 : 29;
		const kind = w.o.gear[ night ];
		// the beer's done after the 7th; in the 9th on the 29th nobody's selling, and the rain delay's quiet
		const beerOver = kind === GEAR.beer && ! N.first && ( N.inning > 7 || ( N.inning === 7 && N.half === 'bottom' && N.kind === 'switch' ) );
		if ( beerOver || N.celebrate || ( ! N.first && N.inning >= 9 ) ) {

			w.shown = false;
			yield* wait( w, 5 );
			continue;

		}

		// in from the concourse at the top of the aisle
		w.gearType = kind;
		w.shown = true;
		w.d = top;
		w.place( w.d );
		w.g = holdGear( kind );
		w.props = [ 0, 0 ];
		let called = 0;
		for ( const r of ROWS ) {

			yield* walkTo( w, rowD( w, r ), () => {

				// the call, every few rows
				called -= w.dt;
				if ( called <= 0 ) {

					called = 6 + 5 * hash( w.d * 3.3 + w.seed );
					A.place.sound?.call( w, kind );
					w.mouth = 0.8;

				}

				if ( called < 5 ) w.mouth = 0;

			} );
			// a hand up in this row? (the chain of the place's fans from the aisle in)
			const chain = A.chain( w.aisle, r );
			const buyer = pickBuyer( chain, kind, w.N );
			if ( buyer >= 0 ) yield* serve( w, chain, buyer, kind );

		}

		// back up and out to restock
		w.g = holdGear( kind );
		yield* walkTo( w, top );
		w.shown = false;
		yield* wait( w, 25 + 50 * hash( w.N.t * 0.01 + w.seed ) );

	}

}

// how he carries what he's selling: both hands on the bin's rim; the tree upright in the left
function holdGear( kind ) {

	if ( kind === GEAR.cotton ) return [ armIK( - 1, [ - 0.24, 1.05, - 0.14 ] ), null ];
	if ( kind === GEAR.peanuts ) return [ null, armIK( 1, [ 0.25, 1.08, - 0.02 ] ) ];
	return [ armIK( - 1, [ - 0.2, 1.05, - 0.3 ] ), armIK( 1, [ 0.2, 1.05, - 0.3 ] ) ];

}

// who in the row wants one (a fan who hasn't got one, the likelier in the cold for hot chocolate)
function pickBuyer( chain, kind, N ) {

	if ( ! chain.length ) return - 1;
	const want = { [ GEAR.beer ]: 0.3, [ GEAR.cocoa ]: 0.35, [ GEAR.hotdogs ]: 0.22, [ GEAR.peanuts ]: 0.2, [ GEAR.cotton ]: 0.12 }[ kind ] || 0;
	// the pick is a function of when he's there (scrubbing agrees)
	const r = hash( Math.floor( N.t / 20 ) * 3.7 + chain[ 0 ].seat.row * 1.3 + kind );
	if ( r > want ) return - 1;
	const k = Math.floor( hash( r * 91 ) * chain.length );
	const f = chain[ k ];
	// cotton candy for the kids
	if ( kind === GEAR.cotton ) return chain.findIndex( ( q ) => q.p.scale < 0.8 && ! ( q.bought && N.t < q.bought.until ) );
	if ( f.bought && N.t < f.bought.until ) return - 1;
	return k;

}

// the prop that goes along the row
const ITEM = { [ GEAR.beer ]: PROP.beer, [ GEAR.cocoa ]: PROP.cocoa, [ GEAR.hotdogs ]: PROP.hotdog, [ GEAR.peanuts ]: PROP.peanuts, [ GEAR.cotton ]: PROP.cottonCandy };

// Serve the k-th fan in from the aisle: the buyer's hand goes up, the vendor turns to the row and gets
// it ready, and it goes along from the aisle seat to him hand to hand; the money comes back
function* serve( w, chain, k, kind ) {

	const A = w.A, N0 = w.N;
	const buyer = chain[ k ];
	const item = ITEM[ kind ];
	// the hand up (two fingers: two)
	buyer.act( 'hail', 2.2, { key: 'hail', mouth: 0.5, head: [ SIDE[ w.aisle ] * 0.8, - 0.1 ] } );
	A.place.sound?.hail( buyer, kind );
	w.face = intoRow( w );
	w.look = [ buyer.p.x, buyer.p.y + 1.1, buyer.p.z ];
	yield* wait( w, 0.8 );
	// getting it ready: a bottle opened and poured, a dog out of the box, a bag off the pole
	w.g = [ holdGear( kind )[ 0 ], armIK( 1, [ 0.12, 1.2, - 0.32 ] ) ];
	w.props = [ 0, item === PROP.peanuts ? 0 : item ];
	yield* wait( w, kind === GEAR.beer ? 2.2 : 1.2 );
	// the peanuts: thrown to him (the bag's arc drawn by the place)
	const s = SIDE[ w.aisle ];
	// the fans' sides: receiving from the aisle's side, passing on away from it
	const take = s > 0 ? 'takeR' : 'takeL', pass = s > 0 ? 'passL' : 'passR';
	const back = s > 0 ? 'passR' : 'passL', takeBack = s > 0 ? 'takeL' : 'takeR';
	const inHand = ( side, prop ) => side === 'L' ? { propL: prop, propR: 0 } : { propR: prop, propL: 0 };
	const H = 0.9;
	let t0 = 0;
	if ( kind === GEAR.peanuts ) {

		// a bag into the right hand, a look, and the throw
		w.props = [ 0, 0 ];
		w.g = [ null, [ 2.2, 0.3, 0.2, 0.6 ] ];
		yield* wait( w, 0.5 );
		w.g = [ null, armIK( 1, [ 0.3, 1.5, - 0.5 ] ) ];
		A.place.throwBag?.( w, buyer );
		buyer.act( 'reachUp', 1.4, { key: 'catch', propR: 0 } );
		buyer.bought = { prop: PROP.peanuts, from: w.N.t + 1.2, until: w.N.t + 240 };
		yield* wait( w, 1.3 );
		t0 = 0;

	} else {

		// along the row: the vendor to the aisle seat, then each to the next
		w.lean = 0.28;
		w.g = [ holdGear( kind )[ 0 ], armIK( 1, [ 0.12, 1.15, - 0.62 ], { lean: 0.28 } ) ];
		for ( let j = 0; j <= k; j ++ ) {

			const f = chain[ j ];
			const tr = 0.5 + j * H; // when it lands in his hand
			f.act( take, 0.45, { from: tr - 0.45, key: 'pass' + j, ...inHand( s > 0 ? 'R' : 'L', 0 ), head: [ s * 0.7, 0.15 ] } );
			if ( j < k ) {

				f.act( s > 0 ? 'takeR' : 'takeL', 0.25, { from: tr, key: 'pass' + j + 'b', ...inHand( s > 0 ? 'R' : 'L', item ) } );
				f.act( pass, H - 0.25, { from: tr + 0.25, key: 'pass' + j + 'c', ...inHand( s > 0 ? 'L' : 'R', item ), head: [ - s * 0.7, 0.15 ] } );

			}

		}

		yield* wait( w, 0.5 );
		w.props = [ 0, 0 ];
		w.lean = 0;
		w.g = holdGear( kind );
		yield* wait( w, k * H + 0.2 );
		buyer.bought = { prop: item, from: w.N.t, until: w.N.t + 200 + 100 * buyer.seed };
		t0 = 0;

	}

	// the money back the same way: from the buyer's pocket along to the vendor
	yield* wait( w, 0.8 );
	for ( let j = k; j >= 0; j -- ) {

		const f = chain[ j ];
		const tg = 0.9 + ( k - j ) * H; // when it leaves his hand
		if ( j === k ) f.act( back, 0.8, { from: tg - 0.8 + 0.4, key: 'money' + j, ...inHand( s > 0 ? 'R' : 'L', PROP.money ), head: [ s * 0.7, 0.1 ] } );
		else {

			f.act( takeBack, 0.4, { from: tg - 0.4, key: 'money' + j, ...inHand( s > 0 ? 'L' : 'R', 0 ) } );
			f.act( back, H - 0.4, { from: tg, key: 'money' + j + 'b', ...inHand( s > 0 ? 'R' : 'L', PROP.money ), head: [ s * 0.7, 0.1 ] } );

		}

	}

	yield* wait( w, k * H + 1.0 );
	w.g = [ holdGear( kind )[ 0 ], armIK( 1, [ 0.12, 1.15, - 0.62 ], { lean: 0.25 } ) ];
	w.lean = 0.25;
	yield* wait( w, 0.5 );
	w.props = [ 0, PROP.money ];
	w.lean = 0;
	w.g = [ holdGear( kind )[ 0 ], SEATED.pocket[ 1 ] ];
	yield* wait( w, 0.8 );
	w.props = [ 0, 0 ];
	w.g = holdGear( kind );
	w.look = null;
	w.face = null;
	void t0; void N0;

}

// the club's ushers: on their aisle's step at the club's back row, facing the field; they turn to the
// rows when anyone comes down, and on the 27th wipe the seats dry with a towel for whoever's coming back
function* usher( w ) {

	const d = rowD( w, 5 ) + 0.1;
	w.shown = true;
	w.d = d;
	w.place( d, - 0.35 * SIDE[ w.aisle ] );
	for ( ;; ) {

		const N = w.N;
		// facing the field, hands behind the back (the pockets' pose reads as it)
		w.face = Walkway.yaw( - w.up[ 0 ], - w.up[ 1 ] );
		w.look = N.look;
		w.g = N.celebrate ? GESTURE.cheer : [ [ - 0.35, 0.1, 0.3, 0.9 ], [ - 0.35, 0.1, 0.3, 0.9 ] ];
		w.props = [ 0, 0 ];
		// on the 27th, every so often, down a couple of rows to wipe a seat with the towel
		if ( N.first && ! N.celebrate && fract( N.t / 170 + w.seed ) < 0.02 ) {

			const r = 2 + Math.floor( 3 * hash( N.t + w.seed ) );
			yield* walkTo( w, rowD( w, r ) );
			w.face = intoRow( w );
			w.lean = 0.55;
			w.props = [ 0, PROP.towel ];
			for ( let i = 0; i < 20; i ++ ) {

				w.g = [ null, armIK( 1, [ 0.25 + 0.12 * Math.sin( i * 1.3 ), 0.95, - 0.55 ], { lean: 0.55 } ) ];
				yield* wait( w, 0.18 );

			}

			w.lean = 0;
			w.props = [ 0, 0 ];
			yield* walkTo( w, d );

		}

		yield;

	}

}
