import { LEVELS } from '../../layout.js';
import { PROP, TOP, COLOR, HAT, CHEST } from '../Cast.js';
import { GESTURE, dress, sizeOf, rng, pick } from '../Concourse3BKit.js';
import { TURNSTILE_O, TABLE } from '../gate3b/Gate.js';

// In through the First Base Gate: fans off the Broad Street subway walking east along Pattison, over
// Pattison from the lots and Lincoln Financial Field, from the taxis and the lots at Darien Street; the
// line at each of the eight lanes shuffling up a slot at a time, the bag opened on the red table for the
// staffer's flashlight, the ticket held out to the taker's scanner, the tripod turning a third as they
// push through, a rally towel from the carton, and on into the concourse, where the same person walks on
// as one of its fans (People1B.admit). Thick at the first pitch on the 27th (the lines longer than eight
// lanes can scan), thinning through the rain to the odd straggler running; again when the gates open for
// the resumption on the 29th.
//
// The gate's staff: a ticket taker in a navy Phillies jacket at each lane's turnstile (the NLDS photo of
// the Third Base Gate), staff in red STAFF jackets at the bag tables, two handing out the towels, event
// security at the ends. (No wands or pat-downs in 2008: the bag and the ticket.)
//
// Everyone's in the concourse's cast. Positions in the field frame; the gate's own frame is P( s, o ): s
// along the gate line, o out from it (the turnstiles at o = -4.8, the plaza at o > 0).
const STREET = LEVELS.mainConcourse;
const SLOT0 = TURNSTILE_O + 0.8, SLOT = 0.78, SLOTS = 14, BAG_SLOT = 3;
const TAU = Math.PI * 2;
const lerp = ( a, b, t ) => a + ( b - a ) * t;
const lerpArm = ( a, b, t ) => a.map( ( x, k ) => lerp( x, b[ k ], t ) );
const hash = ( n ) => {

	const s = Math.sin( n * 12.9898 + 78.233 ) * 43758.5453;
	return s - Math.floor( s );

};

// Where they come from, a path to the plaza's edge [ x, z ] (field frame: Pattison Avenue runs along
// z ~ 117, Darien Street along x ~ 193) and how many come that way:
//   off the subway at Broad and Pattison (and the lots west), east along Pattison's sidewalk
//   over Pattison at the crosswalk from the lots between here and Lincoln Financial Field
//   from the taxis at Darien and Pattison (the guide's taxi stand, the NW corner), and the lots east
//   down Darien from the lots north, past the Pavilion
export const SOURCES = [
	{ w: 4, path: [ [ 8, 104 ], [ 36, 103 ], [ 58, 100 ], [ 70, 93 ] ] },
	{ w: 4, path: [ [ 96, 160 ], [ 96, 128 ], [ 95, 106 ], [ 92, 92 ] ] },
	{ w: 2, path: [ [ 186, 108 ], [ 160, 104 ], [ 130, 96 ], [ 110, 84 ] ] },
	{ w: 1, path: [ [ 188, 12 ], [ 172, 34 ], [ 150, 52 ], [ 128, 60 ] ] },
];

// how many come a second, by the replay's clock: the rush for the first pitch on the 27th thinning out
// (and fewer as it pours), none in the suspension; the gates opened again for the 29th's bottom of the 6th
export function arrivalRate( ns, t ) {

	if ( ns.suspended || ns.celebrate ) return 0;
	if ( ns.first ) return ( 0.05 + 1.55 * Math.exp( - Math.max( 0, t ) / 320 ) ) * ( 1 - 0.35 * ns.rain );
	return 0.04 + 1.3 * Math.exp( - Math.max( 0, t - 2167 ) / 260 );

}

export class Arrivals1B {

	// cast: the place's Cast; gate: buildGate1B's; people: the concourse's People1B (admit); obstacles:
	// [ x, z, r ] on the plaza
	constructor( { cast, gate, people, obstacles = [], seed = 7, max = 110 } ) {

		this.cast = cast;
		this.gate = gate;
		this.people = people;
		this.obstacles = obstacles;
		this.r = rng( seed );
		const { n, u } = gate;
		this.n = n;
		this.u = u;
		this.lanes = gate.lanes.map( ( l, i ) => ( { i, sc: l.sc, mouth: [ l.mouth[ 0 ], l.mouth[ 2 ] ], tripod: gate.tripods[ i ], queue: [], coming: 0, timer: 1 + i * 0.6, scan: 0, scanT: 0 } ) );
		this.pool = [];
		for ( let i = 0; i < max; i ++ ) {

			const p = cast.add( dress( this.r ) );
			if ( ! p ) break;
			p.visible = false;
			this.pool.push( p );

		}

		this.walkers = [];
		this.through = [];
		this.carry = 0;
		this.time = 0;
		this._staff();

	}

	// a point in the gate's frame: s along it, o out from it
	_P( s, o ) {

		const p = this.gate.P( s, o );
		return [ p[ 0 ], p[ 2 ] ];

	}

	_yaw( dx, dz ) {

		return Math.atan2( - dx, - dz );

	}

	// ---------------------------------------------------------------- the gate's staff

	_staffer( look, at, yaw, kind, extra = {} ) {

		const p = this.cast.add( { skin: 1, hair: 2, hairStyle: 0, facial: 0, glasses: false, female: false, age: 0, build: 1, back: 0, chest: 0, pants: 1, shoes: 1, poncho: 0, scarf: 0, gloves: false, sleeves: COLOR.navy, ...look, seed: Math.floor( this.r() * 65536 ) } );
		if ( ! p ) return null;
		p.x = at[ 0 ]; p.z = at[ 1 ]; p.y = STREET; p.yaw = yaw; p.scale = 0.95 + this.r() * 0.08;
		p.visible = true;
		const s = { p, kind, yaw0: yaw, t: this.r() * 10, order: this.r(), ...extra };
		this.staff.push( s );
		return s;

	}

	_staff() {

		const r = this.r;
		const out = this._yaw( this.n[ 0 ], this.n[ 1 ] ); // facing out, to the plaza
		this.staff = [];
		const skins = [ 0, 1, 2, 4, 5, 6, 1, 3, 7, 2 ];
		for ( const L of this.lanes ) {

			// the taker, beside the right-hand turnstile, in the navy jacket and cap, the scanner in hand;
			// the old hands (ushers at the Vet) and the college kids
			const old = r() < 0.4, female = r() < 0.4;
			L.taker = this._staffer( { top: TOP.jacket, color: COLOR.navy, chest: CHEST.staff, hat: r() < 0.6 ? HAT.capNavy : HAT.knitBlack, age: old ? 1 : r() < 0.3 ? 3 : 0, female, hairStyle: female ? 2 : 0, hair: old ? 7 : Math.floor( r() * 5 ), skin: skins[ L.i % skins.length ], glasses: old && r() < 0.6, gloves: r() < 0.3 },
				this._P( L.sc + 0.9, TURNSTILE_O + 0.35 ), out + 0.35, 'taker', { lane: L } );
			// the bag check, in a red STAFF jacket, at the table's inner end, facing out along it
			L.bags = this._staffer( { top: TOP.jacket, color: COLOR.red, sleeves: COLOR.red, chest: CHEST.staff, hat: HAT.capBlack, build: 2, skin: skins[ ( L.i + 5 ) % skins.length ], age: r() < 0.25 ? 3 : 0 },
				this._P( L.sc + TABLE.ds, TABLE.o1 - 0.45 ), out, 'bags', { lane: L } );

		}

		// the towels: two with the cartons past the turnstiles
		this.towels = ( this.gate.towelSpots || [] ).map( ( T ) => this._staffer( { top: TOP.jacket, color: COLOR.red, sleeves: COLOR.red, chest: CHEST.staff, hat: HAT.capRed, female: T.s > 0, hairStyle: T.s > 0 ? 2 : 0, age: 3, skin: T.s > 0 ? 5 : 1 },
			[ T.at[ 0 ], T.at[ 1 ] ], out, 'towels', { give: 0 } ) );
		// event security either end of the gate line, inside
		for ( const e of [ - 1, 1 ] ) this._staffer( { top: TOP.security, color: COLOR.black, sleeves: COLOR.black, chest: CHEST.security, hat: HAT.capBlack, build: 2, skin: e > 0 ? 6 : 2, pants: 3 },
			this._P( e * 15.4, - 2.2 ), out + e * 0.4, 'guard' );

	}

	// ---------------------------------------------------------------- people

	_fan( ns ) {

		const p = this.pool.pop();
		if ( ! p ) return null;
		const r = this.r;
		const rr = rng( Math.floor( r() * 1e9 ) );
		const dry = dress( rr );
		// in off the street in the rain: more of them in ponchos than inside, the hoods up
		const wet = { ...dry, poncho: r() < 0.34 ? Number( pick( r, { 1: 50, 4: 14, 5: 8, 2: 9, 6: 12, 3: 7 } ) ) : 0 };
		if ( wet.hat === HAT.none && r() < 0.6 ) wet.hat = wet.top === 1 || wet.poncho ? HAT.hood : HAT.knitRed;
		p.looks = { wet, dry };
		this.cast.setLook( p, ns.first ? wet : dry );
		p.scale = sizeOf( dry, r );
		p.visible = true;
		p.fresh = true;
		p.pose.phase = r() * TAU;
		const a = {
			p, mode: 'walk', lane: null, slot: - 1, s: 0, path: null, lens: null, total: 0,
			speed: ( dry.age === 2 ? 1.3 : dry.age === 1 ? 1.0 : 1.2 + r() * 0.3 ) * ( ns.first && ns.rain > 0.4 ? 1.1 : 1 ),
			// a bag to open at the table (a purse, a backpack, a team store bag): about one in three
			bag: r() < 0.32, habit: Math.floor( r() * 4 ), order: r(), towel: false, checked: false, bagT: 0,
		};
		return a;

	}

	_free( a ) {

		a.p.visible = false;
		a.mode = 'free';
		this.pool.push( a.p );

	}

	_source() {

		const tot = SOURCES.reduce( ( s, x ) => s + x.w, 0 );
		let x = this.r() * tot;
		for ( const s of SOURCES ) if ( ( x -= s.w ) <= 0 ) return s;
		return SOURCES[ 0 ];

	}

	// the lane with the shortest line (counting those on their way to it), now and then another
	_pickLane() {

		let best = null, bs = Infinity;
		for ( const L of this.lanes ) {

			const s = L.queue.length + L.coming * 0.8 + this.r() * 2.5;
			if ( s < bs ) {

				bs = s;
				best = L;

			}

		}

		return best;

	}

	_slotPos( L, k ) {

		const o = SLOT0 + k * SLOT;
		const j = ( hash( L.i * 31 + k * 7 ) - 0.5 ) * ( o < 0 ? 0.06 : 0.24 );
		return [ L.mouth[ 0 ] + this.n[ 0 ] * o + this.u[ 0 ] * j, L.mouth[ 1 ] + this.n[ 1 ] * o + this.u[ 1 ] * j ];

	}

	// a way from A to B round the obstacles (each one met pushes a detour point out to its side)
	_route( A, B, depth = 0 ) {

		if ( depth > 4 ) return [ A, B ];
		const dx = B[ 0 ] - A[ 0 ], dz = B[ 1 ] - A[ 1 ], l2 = dx * dx + dz * dz || 1;
		let hit = null, ht = 2;
		for ( const [ x, z, r ] of this.obstacles ) {

			const t = Math.max( 0, Math.min( 1, ( ( x - A[ 0 ] ) * dx + ( z - A[ 1 ] ) * dz ) / l2 ) );
			const qx = A[ 0 ] + dx * t, qz = A[ 1 ] + dz * t;
			if ( Math.hypot( qx - x, qz - z ) < r + 0.7 && t > 0.001 && t < 0.999 && t < ht ) {

				hit = [ x, z, r, qx, qz ];
				ht = t;

			}

		}

		if ( ! hit ) return [ A, B ];
		const [ x, z, r, qx, qz ] = hit;
		let ox = qx - x, oz = qz - z, ol = Math.hypot( ox, oz );
		if ( ol < 1e-3 ) {

			ox = - dz; oz = dx; ol = Math.hypot( ox, oz );

		}

		const D = [ x + ox / ol * ( r + 1.4 ), z + oz / ol * ( r + 1.4 ) ];
		return [ ...this._route( A, D, depth + 1 ), ...this._route( D, B, depth + 1 ).slice( 1 ) ];

	}

	// from a source (at fraction t0 along the way) to the back of a lane's line
	_send( a, L, t0 = 0 ) {

		const r = this.r;
		const src = this._source();
		const k = L.queue.length + L.coming + 1;
		const tail = this._slotPos( L, Math.min( k, SLOTS - 1 ) );
		const approach = this._P( L.sc, Math.max( SLOT0 + k * SLOT, 2.6 ) + 2.4 );
		const pts = src.path.map( ( q ) => [ q[ 0 ], q[ 1 ] ] );
		pts.push( ...this._route( pts[ pts.length - 1 ], approach ).slice( 1 ), tail );
		// spread across the width of the way (people don't walk in single file)
		const off = ( r() - 0.5 ) * 2.6;
		a.path = pts.map( ( q, i ) => {

			if ( i === pts.length - 1 ) return q;
			const nq = pts[ Math.min( pts.length - 1, i + 1 ) ], pq = pts[ Math.max( 0, i - 1 ) ];
			const dx = nq[ 0 ] - pq[ 0 ], dz = nq[ 1 ] - pq[ 1 ], l = Math.hypot( dx, dz ) || 1;
			return [ q[ 0 ] - dz / l * off, q[ 1 ] + dx / l * off ];

		} );
		a.lens = [];
		a.total = 0;
		for ( let i = 0; i < a.path.length - 1; i ++ ) {

			const l = Math.hypot( a.path[ i + 1 ][ 0 ] - a.path[ i ][ 0 ], a.path[ i + 1 ][ 1 ] - a.path[ i ][ 1 ] );
			a.lens.push( l );
			a.total += l;

		}

		a.s = t0 * a.total;
		a.lane = L;
		a.mode = 'walk';
		L.coming ++;

	}

	// ---------------------------------------------------------------- time

	// everyone where they'd be at this moment (after a jump in the replay)
	reset( ns, t ) {

		for ( const a of [ ...this.walkers, ...this.through, ...this.lanes.flatMap( ( L ) => L.queue ) ] ) this._free( a );
		this.walkers = [];
		this.through = [];
		const rate = arrivalRate( ns, t );
		for ( const L of this.lanes ) {

			L.queue = [];
			L.coming = 0;
			L.scan = 0;
			L.timer = this.r() * 2;
			const n = Math.max( 0, Math.min( SLOTS - 2, Math.round( rate * 7 + ( this.r() - 0.6 ) * 2.5 ) ) );
			for ( let k = 0; k < n; k ++ ) {

				const a = this._fan( ns );
				if ( ! a ) break;
				a.mode = 'queue';
				a.lane = L;
				a.slot = k;
				const q = this._slotPos( L, k );
				a.p.x = q[ 0 ]; a.p.z = q[ 1 ]; a.p.y = STREET;
				a.p.yaw = this._yaw( - this.n[ 0 ], - this.n[ 1 ] );
				a.arrived = true;
				L.queue.push( a );

			}

		}

		// those on their way: as many as the rate keeps in flight (the walk from the plaza's edge ~35 s)
		const n = Math.round( rate * 32 * ( 0.8 + this.r() * 0.4 ) );
		for ( let i = 0; i < n; i ++ ) {

			const a = this._fan( ns );
			if ( ! a ) break;
			this._send( a, this._pickLane(), this.r() * 0.95 );
			this.walkers.push( a );
			this._walk( a, 0, ns );

		}

	}

	update( dt, ns, t ) {

		this.time += dt;
		// new arrivals
		this.carry += arrivalRate( ns, t ) * dt;
		while ( this.carry >= 1 ) {

			this.carry -= 1;
			const a = this._fan( ns );
			if ( ! a ) break;
			this._send( a, this._pickLane() );
			this.walkers.push( a );

		}

		for ( const a of this.walkers ) this._walk( a, dt, ns );
		this.walkers = this.walkers.filter( ( a ) => a.mode === 'walk' );
		for ( const L of this.lanes ) this._lane( L, dt, ns );
		for ( const a of this.through ) this._goIn( a, dt, ns );
		this.through = this.through.filter( ( a ) => a.mode === 'through' || a.mode === 'in' );
		for ( const s of this.staff ) this._staffPose( s, dt, ns );
		this.gate.poseTripods?.();
		// the looks follow the night: ponchos on the 27th
		if ( this._first !== ns.first ) {

			this._first = ns.first;
			for ( const a of [ ...this.walkers, ...this.through, ...this.lanes.flatMap( ( L ) => L.queue ) ] ) if ( a.p.looks ) this.cast.setLook( a.p, ns.first ? a.p.looks.wet : a.p.looks.dry );

		}

	}

	_turnTo( p, yaw, dt, rate = 6 ) {

		let d = yaw - p.yaw;
		d = Math.atan2( Math.sin( d ), Math.cos( d ) );
		p.yaw += dt > 0 ? d * Math.min( 1, rate * dt ) : d;

	}

	_walk( a, dt, ns ) {

		const p = a.p;
		a.s += a.speed * dt;
		let s = a.s, i = 0;
		while ( i < a.lens.length && s > a.lens[ i ] ) {

			s -= a.lens[ i ];
			i ++;

		}

		if ( i >= a.lens.length ) {

			// arrived: into the line
			const L = a.lane;
			L.coming = Math.max( 0, L.coming - 1 );
			a.mode = 'queue';
			a.slot = L.queue.length;
			a.arrived = false;
			L.queue.push( a );
			return;

		}

		const A = a.path[ i ], B = a.path[ i + 1 ], k = s / a.lens[ i ];
		const dx = B[ 0 ] - A[ 0 ], dz = B[ 1 ] - A[ 1 ];
		p.x = A[ 0 ] + dx * k;
		p.z = A[ 1 ] + dz * k;
		p.y = STREET;
		this._turnTo( p, this._yaw( dx, dz ), dt );
		this._stride( a, a.speed, dt, ns );

	}

	// the walk: the stride, the arms swinging or in the pockets, the head down against the rain
	_stride( a, v, dt, ns ) {

		const P = a.p.pose;
		P.walk = lerp( P.walk, Math.min( 1, v / 0.9 ), Math.min( 1, dt * 5 ) );
		P.phase = ( P.phase + dt * v / ( 1.15 * a.p.scale ) * TAU ) % TAU;
		const sw = Math.sin( P.phase ) * 0.3 * P.walk;
		P.armL = [ sw, 0.07, 0, 0.2 ]; P.armR = [ - sw, 0.07, 0, 0.2 ];
		P.propL = 0; P.propR = 0; P.mouth = 0;
		P.lean = 0.05 * P.walk; P.twist = 0; P.roll = 0; P.drop = 0;
		P.hipL = P.hipR = P.kneeL = P.kneeR = 0;
		if ( a.order < ( ns.first ? 0.5 : 0.4 ) ) {

			P.armL = GESTURE.pockets[ 0 ].slice(); P.propL = PROP.pocket;
			if ( a.order < 0.3 ) {

				P.armR = GESTURE.pockets[ 1 ].slice(); P.propR = PROP.pocket;

			}

		}

		if ( a.towel ) {

			P.armR = [ - sw * 0.6, 0.1, 0, 0.5 ];
			P.propR = PROP.towel;

		}

		// the head down into the rain on the 27th; a look up at the gate's sign
		P.headPitch = ns.first ? 0.18 * ns.rain : 0.0;
		P.headYaw = Math.sin( this.time * 0.3 + a.order * 20 ) * 0.25;
		P.blink = ( this.time * 0.37 + a.order * 3 ) % 1 < 0.04 ? 1 : 0;

	}

	// a lane: the line shuffles up, the bag's gone through on the table, the ticket's scanned, through
	_lane( L, dt, ns ) {

		const r = this.r;
		// everyone moves up to their slot
		L.queue.forEach( ( a, k ) => {

			a.slot = k;
			const q = this._slotPos( L, k );
			const p = a.p, dx = q[ 0 ] - p.x, dz = q[ 1 ] - p.z, e = Math.hypot( dx, dz );
			const v = e > 0.06 ? Math.min( 0.9, e * 1.8 ) : 0;
			if ( v ) {

				p.x += dx / e * v * dt;
				p.z += dz / e * v * dt;

			} else a.arrived = true;

			this._turnTo( p, this._yaw( - this.n[ 0 ], - this.n[ 1 ] ), dt, 4 );
			this._waitPose( a, v, dt, ns, k, L );

		} );
		// the front one at the turnstile: the ticket held out and scanned (now and then fumbled for)
		const front = L.queue[ 0 ];
		L.timer -= dt;
		if ( front && front.arrived && ! L.scan && L.timer <= 0 && ( ! front.bag || front.checked ) ) {

			L.scan = 2.6 + r() * 1.8 + ( r() < 0.12 ? 2.5 : 0 );
			L.scanT = 0;

		}

		if ( L.scan ) {

			L.scanT += dt;
			if ( L.scanT >= L.scan ) {

				// the beep, and through the tripod
				L.scan = 0;
				L.timer = 0.3 + r() * 0.6;
				const a = L.queue.shift();
				a.mode = 'through';
				a.goT = 0;
				L.turn = 1;
				this.through.push( a );
				this.onScan?.( L, a );

			}

		}

		// the tripod: a third of a turn as each one pushes through
		if ( L.turn > 0 && L.tripod ) {

			const k = Math.min( dt * 1.6, L.turn );
			L.turn -= k;
			L.tripod.phase += k * TAU / 3;

		}

		// the bag on the table (the one at the table's slot, or whoever's nearest it with one still to show)
		const B = L.queue.find( ( a, k ) => a.bag && ! a.checked && k <= BAG_SLOT && a.arrived );
		L.bagFan = B || null;
		if ( B ) {

			B.bagT += dt;
			if ( B.bagT > 3.2 + B.order * 2 ) {

				B.checked = true;
				L.bagFan = null;

			}

		}

	}

	// waiting in line: the phone, the ticket, a look about, a word with the one behind; the weight from
	// foot to foot; the front one's ticket held out, the one at the table with the bag open on it
	_waitPose( a, v, dt, ns, k, L ) {

		const P = a.p.pose, t = this.time;
		P.walk = lerp( P.walk, Math.min( 1, v / 0.6 ), Math.min( 1, dt * 5 ) );
		P.phase = ( P.phase + dt * v / 1.1 * TAU ) % TAU;
		P.lean = 0; P.twist = 0; P.drop = 0; P.mouth = 0;
		P.armL = [ 0.05, 0.07, 0, 0.18 ]; P.armR = [ 0.05, 0.07, 0, 0.18 ];
		P.propL = 0; P.propR = 0;
		const idle = ( t * 0.08 + a.order ) % 1;
		P.hipL = 0; P.hipR = 0; P.kneeL = idle < 0.5 ? 0.12 : 0; P.kneeR = idle < 0.5 ? 0 : 0.12;
		P.roll = idle < 0.5 ? 0.02 : - 0.02;
		P.headPitch = 0.05; P.headYaw = 0;
		if ( a.habit === 1 ) {

			P.armR = GESTURE.phone[ 1 ].slice(); P.propR = PROP.phone;
			P.mouth = Math.max( 0, 0.3 * Math.sin( t * 7 + a.order * 20 ) * Math.sin( t * 1.3 + a.order * 5 ) );

		} else if ( a.habit === 2 || k < 3 ) {

			// the ticket out ready, read again to be sure of the section
			P.armR = GESTURE.text[ 1 ].slice(); P.propR = PROP.ticket;
			P.headPitch = 0.35;

		} else if ( a.habit === 3 ) {

			P.headYaw = 1.0 * Math.sin( t * 0.25 + a.order * 7 );
			P.mouth = Math.max( 0, 0.3 * Math.sin( t * 7 + a.order * 9 ) ) * ( Math.sin( t * 0.4 + a.order * 3 ) > 0 ? 1 : 0 );
			P.armL = GESTURE.pockets[ 0 ].slice(); P.propL = PROP.pocket;

		} else {

			P.armL = GESTURE.pockets[ 0 ].slice(); P.propL = PROP.pocket;
			P.armR = GESTURE.pockets[ 1 ].slice(); P.propR = PROP.pocket;
			P.headYaw = Math.sin( t * 0.2 + a.order * 30 ) * 0.5;
			// the 27th: a look up at the rain off the canopy's edge
			if ( ns.first && Math.sin( t * 0.3 + a.order * 11 ) > 0.9 ) P.headPitch = - 0.35;

		}

		if ( k === 0 && L.scan ) {

			// the ticket to the scanner
			P.armR = GESTURE.reach[ 1 ].slice(); P.propR = PROP.ticket;
			P.headPitch = 0.25;
			P.headYaw = 0.3;

		}

		if ( L.bagFan === a ) {

			// the bag on the table, held open; watching the flashlight go through it
			P.armL = GESTURE.reachL[ 0 ].slice(); P.propL = PROP.bag;
			P.armR = GESTURE.reach[ 1 ].slice(); P.propR = 0;
			P.headPitch = 0.4;
			P.headYaw = - 0.6;

		}

		P.blink = ( t * 0.33 + a.order * 3 ) % 1 < 0.04 ? 1 : 0;

	}

	// through the turnstile, past the towels, and on into the concourse (handed over to its fans)
	_goIn( a, dt, ns ) {

		const p = a.p, L = a.lane;
		a.goT += dt;
		// straight in along the lane, then bearing toward the concourse's middle
		const o = TURNSTILE_O + 0.8 - a.goT * 1.15;
		const drift = Math.max( 0, - o - 6 ) * 0.25 * ( L.sc > 0 ? - 1 : 1 );
		const q = this._P( L.sc + drift, o );
		const dx = q[ 0 ] - p.x, dz = q[ 1 ] - p.z;
		p.x = q[ 0 ]; p.z = q[ 1 ]; p.y = STREET;
		if ( Math.hypot( dx, dz ) > 1e-4 ) this._turnTo( p, this._yaw( dx, dz ), dt );
		this._stride( a, 1.15, dt, ns );
		// a towel from the carton as they pass (on the 29th most take one; a few on the 27th)
		for ( const T of this.towels ) {

			if ( ! T || a.towel ) continue;
			if ( Math.hypot( T.p.x - p.x, T.p.z - p.z ) < 2.6 && this.r() < ( ns.first ? 0.02 : 0.2 ) ) {

				a.towel = true;
				T.give = 1.2;
				T.to = a;

			}

		}

		// in: onto the concourse, one of its fans from here
		if ( o < - 8.6 ) {

			const spare = this.people?.admit( p, p.x, p.z, ns );
			if ( spare ) {

				spare.visible = false;
				this.pool.push( spare );
				a.mode = 'done';
				if ( a.towel ) p.pose.propR = PROP.towel;

			} else if ( o < - 11 ) this._free( a );

		}

	}

	// the staff: the taker's scanner out to the ticket and the beep; the flashlight in the bag; the towels
	// handed out; security watching the line
	_staffPose( s, dt, ns ) {

		const p = s.p, P = p.pose, t = this.time;
		s.t += dt;
		P.walk = 0; P.lean = 0; P.twist = 0; P.drop = 0; P.mouth = 0;
		P.armL = [ 0.05, 0.08, 0, 0.2 ]; P.armR = [ 0.05, 0.08, 0, 0.2 ];
		P.propL = 0; P.propR = 0;
		P.headYaw = 0; P.headPitch = 0.05;
		let yaw = s.yaw0;
		if ( s.kind === 'taker' ) {

			const L = s.lane;
			// the scanner held at the chest, out to the ticket while scanning; a word to the fan
			P.armR = GESTURE.carry[ 1 ].slice(); P.propR = PROP.phone;
			if ( L.scan ) {

				const k = Math.min( 1, L.scanT / 0.6 ) * Math.min( 1, ( L.scan - L.scanT ) / 0.4 + 0.2 );
				P.armR = lerpArm( GESTURE.carry[ 1 ], GESTURE.reach[ 1 ], k );
				P.headPitch = 0.3;
				P.mouth = L.scanT > L.scan - 1 ? Math.max( 0, 0.3 * Math.sin( t * 7 ) ) : 0;
				yaw -= 0.5 * k;

			} else {

				// between: the other hand in the pocket, a look down the line
				P.armL = GESTURE.pockets[ 0 ].slice(); P.propL = PROP.pocket;
				P.headYaw = Math.sin( t * 0.3 + s.order * 9 ) * 0.5;

			}

		} else if ( s.kind === 'bags' ) {

			const B = s.lane.bagFan;
			if ( B ) {

				// bent over the bag, the flashlight in it, the other hand holding it open
				P.lean = 0.35;
				P.headPitch = 0.55;
				P.armR = GESTURE.reach[ 1 ].slice(); P.propR = PROP.phone;
				P.armL = GESTURE.reachL[ 0 ].slice();
				P.mouth = B.bagT > 3 ? Math.max( 0, 0.3 * Math.sin( t * 7 ) ) : 0;

			} else {

				P.armL = GESTURE.fold[ 0 ].slice(); P.armR = GESTURE.fold[ 1 ].slice();
				P.headYaw = Math.sin( t * 0.25 + s.order * 5 ) * 0.4;

			}

		} else if ( s.kind === 'towels' ) {

			// a towel held out to each one coming through (on the 29th the whole crowd waves them)
			s.give = Math.max( 0, s.give - dt );
			P.armR = s.give > 0 ? GESTURE.reach[ 1 ].slice() : [ 0.6, 0.1, 0.2, 1.2 ];
			P.propR = PROP.towel;
			P.armL = [ 0.4, 0.1, 0.3, 1.3 ]; P.propL = 0;
			if ( s.to && s.give > 0 ) yaw = this._yaw( s.to.p.x - p.x, s.to.p.z - p.z );
			P.mouth = s.give > 0 ? 0.3 : 0;
			P.headYaw = Math.sin( t * 0.4 + s.order * 7 ) * 0.4;

		} else {

			// security: hands clasped in front, watching the line
			P.armL = [ 0.25, 0.1, 0.45, 1.2 ]; P.armR = [ 0.25, 0.1, 0.45, 1.25 ];
			P.headYaw = Math.sin( t * 0.2 + s.order * 5 ) * 0.7;

		}

		this._turnTo( p, yaw, dt, 5 );
		P.blink = ( t * 0.3 + s.order * 3 ) % 1 < 0.04 ? 1 : 0;

	}

	// how many are where (for the test)
	count() {

		return { walking: this.walkers.length, queued: this.lanes.reduce( ( n, L ) => n + L.queue.length, 0 ), through: this.through.length, pool: this.pool.length };

	}

}
