import { LEVELS } from '../../layout.js';
import { rng } from './Mesher.js';
import { PROP } from './Folk.js';
import { dress, uniform } from './Dress.js';

// The way in: fans streaming across the plaza from the lots and the subway, queuing at the eight
// lanes of the Third Base Gate, a ticket taker in a navy Phillies jacket at each scanning the ticket held
// out to him, staff in red at the bag-check tables going through the bags with a flashlight, then
// through the turnstile and in. Thick at first pitch, thinning through the innings to the odd straggler
// running; again when the game picks up on the 29th.
//
// Everyone is a Folk figure driven here: walking a path (routed round the planters, the statue, the
// lamps and trees), standing in a queue (shuffling up a slot at a time, fidgeting, looking at the
// ticket, at the phone, up at the rain), at the front, then gone through the gate.

const STREET = LEVELS.mainConcourse;
const SLOT0 = 1.25, SLOT = 0.8, SLOTS = 10;
const hash = ( n ) => {

	const s = Math.sin( n * 12.9898 + 78.233 ) * 43758.5453;
	return s - Math.floor( s );

};

// where they come from: the lots across 11th Street and across Pattison, the subway and the lots east
// along Pattison, the lots north along 11th; each a path to the plaza's edge [ x, z ], and how many
// come that way
const SOURCES = [
	{ w: 3, path: [ [ - 172, 104 ], [ - 152, 103 ], [ - 134, 101 ] ] }, // across 11th from the lot west of it
	{ w: 3, path: [ [ - 141, 150 ], [ - 141, 131 ], [ - 139, 110 ], [ - 128, 99 ] ] }, // over Pattison at the corner, from the lots south
	{ w: 2, path: [ [ - 108, 150 ], [ - 110, 131 ], [ - 108, 100 ] ] }, // straight over Pattison mid-block
	{ w: 4, path: [ [ - 22, 105 ], [ - 40, 104 ], [ - 68, 102 ], [ - 78, 97 ] ] }, // along Pattison from Broad Street and the east lots
	{ w: 2, path: [ [ - 139, - 12 ], [ - 138, 6 ], [ - 131, 16 ] ] }, // down 11th from the north lots
];

export class Arrivals {

	// folk: the Folk; lanes: exterior.lanes of the Third Base Gate; obstacles: [ x, z, r ]
	constructor( { folk, lanes, obstacles, seed = 1 } ) {

		this.folk = folk;
		this.obstacles = obstacles;
		this.r = rng( seed );
		// each lane: its mouth (on the gate line), out (n), along (u), its taker, its queue
		this.lanes = lanes.map( ( l, i ) => {

			const n = [ l.face[ 0 ], l.face[ 1 ] ];
			const u = [ - n[ 1 ], n[ 0 ] ];
			const mouth = [ l.entry[ 0 ] - n[ 0 ] * 1.5, l.entry[ 2 ] - n[ 1 ] * 1.5 ];
			return { i, n, u, mouth, taker: [ l.at[ 0 ], l.at[ 2 ] ], queue: [], timer: 2 + i * 0.7, scanning: 0 };

		} );
		// order them along the gate
		const u0 = this.lanes[ 0 ]?.u || [ 1, 0 ];
		this.lanes.sort( ( a, b ) => ( a.mouth[ 0 ] * u0[ 0 ] + a.mouth[ 1 ] * u0[ 1 ] ) - ( b.mouth[ 0 ] * u0[ 0 ] + b.mouth[ 1 ] * u0[ 1 ] ) );
		this.lanes.forEach( ( l, i ) => l.i = i );
		this.pool = [];
		this.walkers = [];
		this.inside = [];
		this.carry = 0;
		this._staff();

	}

	// ---------------------------------------------------------------- the gate's staff

	_staff() {

		const r = this.r, F = this.folk;
		this.staff = [];
		for ( const L of this.lanes ) {

			// the ticket taker: inside the gate line by the lane, facing out, the scanner in her hand
			const u = uniform( 'usher', r, [ 'scanner' ] );
			const f = F.add( { x: L.taker[ 0 ], z: L.taker[ 1 ], yaw: Math.atan2( - L.n[ 0 ], - L.n[ 1 ] ), look: u.look, props: u.props, scale: u.scale, seed: r() } );
			f.pose.flexR = 0.2; f.pose.elbowR = 1.0;
			L.takerFig = f;
			this.staff.push( { f, kind: 'taker', lane: L, t: r() * 10 } );

		}

		// security at the bag-check tables, one between each pair of lanes, a few steps out under the canopy
		this.tables = [];
		for ( let i = 0; i + 1 < this.lanes.length; i += 2 ) {

			const A = this.lanes[ i ], B = this.lanes[ i + 1 ];
			const c = [ ( A.mouth[ 0 ] + B.mouth[ 0 ] ) / 2 + A.n[ 0 ] * 3.3, ( A.mouth[ 1 ] + B.mouth[ 1 ] ) / 2 + A.n[ 1 ] * 3.3 ];
			this.tables.push( { c, n: A.n, u: A.u, lanes: [ A, B ] } );
			const u = uniform( 'security', r, [ 'flash' ] );
			// behind the table's far end, facing along it toward the queues
			const at = [ c[ 0 ] + A.n[ 0 ] * 1.3, c[ 1 ] + A.n[ 1 ] * 1.3 ];
			const f = F.add( { x: at[ 0 ], z: at[ 1 ], yaw: Math.atan2( A.n[ 0 ], A.n[ 1 ] ), look: u.look, props: u.props, scale: u.scale, seed: r() } );
			this.staff.push( { f, kind: 'bags', table: this.tables[ this.tables.length - 1 ], t: r() * 10, home: at } );
			A.guard = B.guard = this.staff[ this.staff.length - 1 ];

		}

		// (no wands: the park's security in 2008 was the bag check and the ticket; walk-through detectors
		// came in 2014)

	}

	// ---------------------------------------------------------------- people

	_fan( w ) {

		let a = this.pool.pop();
		if ( ! a ) {

			const f = this.folk.add( { visible: false } );
			if ( ! f ) return null;
			a = { f };

		}

		const r = this.r;
		const d = dress( r, w );
		Object.assign( a.f, { look: d.look, props: d.props, scale: d.scale, seed: r(), visible: true, walk: 0, sit: 0 } );
		a.kit = d.props;
		a.kid = d.kid;
		a.hasBag = ( d.props & ( ( 1 << PROP.bag ) | ( 1 << PROP.backpack ) ) ) !== 0;
		a.umbrella = ( d.props & ( 1 << PROP.umbrella ) ) !== 0;
		a.speed = ( d.kid ? 1.25 : 1.2 + r() * 0.35 ) * ( w.first && w.rain > 0.3 ? 1.12 : 1 );
		a.late = 0;
		a.checked = false; a.bagT = 0; a.arrived = false;
		a.fidget = r() * 20;
		a.habit = Math.floor( r() * 4 ); // what he does waiting: 0 looks about, 1 the phone, 2 the ticket, 3 talks
		a.mode = 'walk';
		a.lane = null;
		a.slot = - 1;
		a.path = null;
		return a;

	}

	_free( a ) {

		a.f.visible = false;
		a.mode = 'free';
		this.pool.push( a );

	}

	// a path from a source (at fraction t along it, 0 = its start) to the back of a lane's queue
	_send( a, lane, t0 = 0 ) {

		const r = this.r;
		const src = this._source();
		const tail = this._slotPos( lane, lane.queue.length + 2 );
		const pts = [ ...src.path.map( ( p ) => [ p[ 0 ], p[ 1 ] ] ) ];
		const route = this._route( pts[ pts.length - 1 ], tail, 0 );
		pts.push( ...route.slice( 1 ) );
		// spread across the width of the way (people don't walk in single file)
		const off = ( r() - 0.5 ) * 2.4;
		const path = pts.map( ( p, i ) => {

			if ( i === pts.length - 1 ) return p;
			const q = pts[ Math.min( pts.length - 1, i + 1 ) ], o = pts[ Math.max( 0, i - 1 ) ];
			const dx = q[ 0 ] - o[ 0 ], dz = q[ 1 ] - o[ 1 ], l = Math.hypot( dx, dz ) || 1;
			return [ p[ 0 ] - dz / l * off, p[ 1 ] + dx / l * off ];

		} );
		a.path = path;
		a.lens = [];
		let L = 0;
		for ( let i = 0; i < path.length - 1; i ++ ) {

			const l = Math.hypot( path[ i + 1 ][ 0 ] - path[ i ][ 0 ], path[ i + 1 ][ 1 ] - path[ i ][ 1 ] );
			a.lens.push( l );
			L += l;

		}

		a.total = L;
		a.s = t0 * L;
		a.lane = lane;
		a.mode = 'walk';
		lane.coming = ( lane.coming || 0 ) + 1;

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

			const s = L.queue.length + ( L.coming || 0 ) * 0.8 + this.r() * 2.5;
			if ( s < bs ) {

				bs = s; best = L;

			}

		}

		return best;

	}

	_slotPos( L, k ) {

		const j = ( hash( L.i * 31 + k * 7 ) - 0.5 ) * 0.22;
		const o = SLOT0 + k * SLOT;
		return [ L.mouth[ 0 ] + L.n[ 0 ] * o + L.u[ 0 ] * j, L.mouth[ 1 ] + L.n[ 1 ] * o + L.u[ 1 ] * j ];

	}

	// a way from A to B round the obstacles (each one met pushes a detour point out to its side)
	_route( A, B, depth ) {

		if ( depth > 4 ) return [ A, B ];
		const dx = B[ 0 ] - A[ 0 ], dz = B[ 1 ] - A[ 1 ], l2 = dx * dx + dz * dz || 1;
		let hit = null, ht = 2;
		for ( const [ x, z, r ] of this.obstacles ) {

			const t = Math.max( 0, Math.min( 1, ( ( x - A[ 0 ] ) * dx + ( z - A[ 1 ] ) * dz ) / l2 ) );
			const qx = A[ 0 ] + dx * t, qz = A[ 1 ] + dz * t;
			if ( Math.hypot( qx - x, qz - z ) < r + 0.7 && t > 0.001 && t < 0.999 && t < ht ) {

				hit = [ x, z, r, qx, qz ]; ht = t;

			}

		}

		if ( ! hit ) return [ A, B ];
		const [ x, z, r, qx, qz ] = hit;
		let ox = qx - x, oz = qz - z, ol = Math.hypot( ox, oz );
		if ( ol < 1e-3 ) {

			ox = - dz; oz = dx; ol = Math.hypot( ox, oz );

		}

		const D = [ x + ox / ol * ( r + 1.4 ), z + oz / ol * ( r + 1.4 ) ];
		const a = this._route( A, D, depth + 1 ), b = this._route( D, B, depth + 1 );
		return [ ...a, ...b.slice( 1 ) ];

	}

	// ---------------------------------------------------------------- time

	// everyone where they'd be at this moment (after a jump in the replay)
	reset( w ) {

		for ( const a of [ ...this.walkers, ...this.inside, ...this.lanes.flatMap( ( L ) => L.queue ) ] ) this._free( a );
		this.walkers = [];
		this.inside = [];
		for ( const L of this.lanes ) {

			L.queue = [];
			L.coming = 0;
			L.scanning = 0;
			L.timer = this.r() * 2;

			if ( L.guard ) L.guard.busy = null;

		}

		// the lines: long at first pitch, a few at the end of the first innings, then mostly none
		for ( const L of this.lanes ) {

			const n = Math.max( 0, Math.min( SLOTS, Math.round( w.rate * 8 + ( this.r() - 0.6 ) * 2.5 ) ) );
			for ( let k = 0; k < n; k ++ ) {

				const a = this._fan( w );
				if ( ! a ) break;
				a.mode = 'queue';
				a.lane = L;
				a.slot = k;
				const p = this._slotPos( L, k );
				a.f.x = p[ 0 ]; a.f.z = p[ 1 ]; a.f.y = STREET;
				a.f.yaw = Math.atan2( L.n[ 0 ], L.n[ 1 ] );
				L.queue.push( a );

			}

		}

		// those on their way: as many as the rate keeps in flight (a walk here takes ~50 s)
		const n = Math.round( w.rate * 40 * ( 0.8 + this.r() * 0.4 ) );
		for ( let i = 0; i < n; i ++ ) {

			const a = this._fan( w );
			if ( ! a ) break;
			this._send( a, this._pickLane(), this.r() * 0.95 );
			this.walkers.push( a );
			this._walk( a, 0 );

		}

	}

	update( dt, w ) {

		// new arrivals
		this.carry += w.rate * dt;
		while ( this.carry >= 1 ) {

			this.carry -= 1;
			const a = this._fan( w );
			if ( ! a ) break;
			this._send( a, this._pickLane() );
			this.walkers.push( a );

		}

		for ( const a of this.walkers ) this._walk( a, dt );
		this.walkers = this.walkers.filter( ( a ) => a.mode === 'walk' );
		for ( const L of this.lanes ) this._lane( L, dt, w );
		for ( const a of this.inside ) this._goIn( a, dt );
		this.inside = this.inside.filter( ( a ) => a.mode === 'in' );
		for ( const s of this.staff ) this._staffPose( s, dt );

	}

	_face( f, dx, dz, dt, rate = 6 ) {

		const want = Math.atan2( - dx, - dz );
		let d = want - f.yaw;
		d = Math.atan2( Math.sin( d ), Math.cos( d ) );
		f.yaw += dt > 0 ? d * Math.min( 1, rate * dt ) : d;

	}

	_walk( a, dt ) {

		const f = a.f;
		// the lines grow while they walk: keep the goal the back of the line
		a.s += a.speed * dt;
		let s = a.s, i = 0;
		while ( i < a.lens.length && s > a.lens[ i ] ) {

			s -= a.lens[ i ];
			i ++;

		}

		if ( i >= a.lens.length ) {

			// arrived: into the line
			const L = a.lane;
			L.coming = Math.max( 0, ( L.coming || 0 ) - 1 );
			a.mode = 'queue';
			a.slot = L.queue.length;
			L.queue.push( a );
			return;

		}

		const A = a.path[ i ], B = a.path[ i + 1 ], t = s / a.lens[ i ];
		const dx = B[ 0 ] - A[ 0 ], dz = B[ 1 ] - A[ 1 ];
		f.x = A[ 0 ] + dx * t;
		f.z = A[ 1 ] + dz * t;
		f.y = STREET;
		this._face( f, dx, dz, dt );
		f.walk = 1;
		f.phase += dt * a.speed * 4.6;
		this._carry( a, true );

	}

	// how he holds himself: the umbrella up (closed under the canopy), a poncho's arms in, hands in
	// the pockets in the cold
	_carry( a, walking, underCanopy = false ) {

		const f = a.f, p = f.pose;
		let props = a.kit;
		if ( a.umbrella && underCanopy ) props &= ~ ( 1 << PROP.umbrella );
		f.props = props;
		p.flexL = 0; p.abductL = 0.08; p.elbowL = 0.15; p.flexR = 0; p.abductR = 0.08; p.elbowR = 0.15;
		p.lean = walking ? 0.06 : 0.02; p.twist = 0; p.pitch = walking ? - 0.05 : 0;
		if ( a.umbrella && ! underCanopy ) {

			p.flexR = 0.5; p.abductR = 0.14; p.elbowR = 1.3;

		}

		if ( a.kid && ( props & ( 1 << PROP.glove ) ) ) {

			p.flexL = 0.3; p.elbowL = 1.3;

		}

	}

	// a lane: the line shuffles up, the front one hands over the ticket, it's scanned, he goes in
	_lane( L, dt, w ) {

		const r = this.r;
		const front = L.queue[ 0 ];
		const atFront = front && front.slot === 0 && front.arrived;
		L.timer -= dt;
		if ( atFront && ! L.scanning && L.timer <= 0 ) {

			L.scanning = 3.0 + r() * 2.5 + ( r() < 0.12 ? 3 : 0 ); // now and then fumbling for it
			L.scanT = 0;

		}

		if ( L.scanning ) {

			L.scanT += dt;
			if ( L.scanT >= L.scanning ) {

				// through the turnstile and in
				L.scanning = 0;
				L.timer = 0.8 + r() * 1.5;
				const a = L.queue.shift();
				a.mode = 'in';
				a.inT = 0;
				this.inside.push( a );
				L.queue.forEach( ( b, k ) => {

					b.slot = k;
					b.arrived = false;

				} );

			}

		}

		// the bag check at the table beside slot 3
		L.queue.forEach( ( a, k ) => {

			const f = a.f, goal = this._slotPos( L, k );
			const dx = goal[ 0 ] - f.x, dz = goal[ 1 ] - f.z, d = Math.hypot( dx, dz );
			const under = k * SLOT + SLOT0 < 4.8;
			if ( d > 0.04 ) {

				// shuffle up (hold back if the one ahead hasn't moved yet)
				const step = Math.min( d, 1.1 * dt );
				f.x += dx / d * step; f.z += dz / d * step;
				f.walk = Math.min( 1, d * 3 );
				f.phase += dt * 4.2;
				this._face( f, dx, dz, dt, 5 );
				a.arrived = false;
				this._carry( a, true, under );
				return;

			}

			a.arrived = true;
			f.walk = Math.max( 0, f.walk - dt * 4 );
			this._face( f, - L.n[ 0 ], - L.n[ 1 ], dt, 3 );
			this._carry( a, false, under );
			a.fidget += dt;
			const p = f.pose;
			// waiting: a look round, at the phone, at the ticket, a word to the one behind
			const cyc = ( a.fidget * 0.35 + a.habit ) % 6;
			if ( k === 0 ) {

				// the ticket held out to the taker; the arm drops once it's scanned
				f.props |= 1 << PROP.ticket;
				const s = L.scanning ? Math.min( 1, L.scanT * 3 ) : 0.4;
				p.flexR = 0.85 * s; p.abductR = 0.05; p.elbowR = 0.45 + ( 1 - s ) * 0.6;
				p.yaw = 0.25 * s; p.pitch = - 0.15;
				p.lean = 0.05;

			} else if ( k === 3 && a.hasBag && L.guard && a.checked !== true ) {

				// the bag open on the table: he turns to it, the guard leans in with the flashlight
				a.bagT = ( a.bagT || 0 ) + dt;
				const T = L.guard.table;
				this._face( f, T.c[ 0 ] - f.x, T.c[ 1 ] - f.z, dt, 4 );
				p.flexL = 0.7; p.elbowL = 0.9; p.flexR = 0.6; p.elbowR = 0.9; p.lean = 0.25; p.pitch = - 0.4;
				L.guard.busy = a;
				if ( a.bagT > 4.5 ) {

					a.checked = true;
					L.guard.busy = null;

				}

			} else if ( a.habit === 1 && cyc < 3 ) {

				// on the phone (a flip phone at the ear), or reading a text
				f.props |= 1 << PROP.phone;
				if ( cyc < 1.8 ) {

					p.flexR = 1.45; p.abductR = 0.55; p.elbowR = 2.55; p.yaw = 0.2;

				} else {

					p.flexR = 0.55; p.abductR = 0.1; p.elbowR = 1.7; p.pitch = - 0.45;

				}

			} else if ( a.habit === 2 && cyc < 2 ) {

				f.props |= 1 << PROP.ticket;
				p.flexR = 0.55; p.elbowR = 1.2; p.pitch = - 0.4;

			} else if ( a.habit === 3 ) {

				// talking to the one behind: half turned, a hand going
				p.yaw = 0.9 * Math.sin( a.fidget * 0.3 );
				if ( ! a.umbrella ) {

					p.flexR = 0.3 + 0.25 * Math.max( 0, Math.sin( a.fidget * 2.3 ) ); p.elbowR = 1.1;

				}

			} else {

				// looking round: at the gate, up at the rain, back at the plaza
				p.yaw = 0.6 * Math.sin( a.fidget * 0.21 + f.seed * 10 ) * Math.sin( a.fidget * 0.13 );
				p.pitch = w.first ? 0.15 * Math.max( 0, Math.sin( a.fidget * 0.17 ) ) : 0;
				if ( ! w.first && ! a.umbrella ) {

					// hands in the pockets against the cold
					p.flexL = - 0.35; p.abductL = 0.12; p.elbowL = 0.9; p.flexR = - 0.35; p.abductR = 0.12; p.elbowR = 0.9;

				}

			}

		} );

	}

	// through the turnstile, a few steps in, gone
	_goIn( a, dt ) {

		const L = a.lane, f = a.f;
		a.inT += dt;
		const o = SLOT0 - a.inT * 1.3;
		const p = [ L.mouth[ 0 ] + L.n[ 0 ] * o, L.mouth[ 1 ] + L.n[ 1 ] * o ];
		f.x = p[ 0 ]; f.z = p[ 1 ];
		this._face( f, - L.n[ 0 ], - L.n[ 1 ], dt );
		f.walk = 1;
		f.phase += dt * 5.5;
		this._carry( a, true, true );
		// the ticket (the stub) still in hand for the first steps
		if ( a.inT < 1.2 ) f.props |= 1 << PROP.ticket;
		if ( o < - 9 ) this._free( a );

	}

	_staffPose( s, dt ) {

		const f = s.f, p = f.pose;
		s.t += dt;
		if ( s.kind === 'taker' ) {

			const L = s.lane;
			if ( L.scanning ) {

				// takes it, scans it under the post's reader, hands it back
				const k = Math.min( 1, L.scanT * 2.5 ) * ( 1 - Math.max( 0, ( L.scanT - L.scanning + 0.6 ) / 0.6 ) );
				p.flexR = 0.2 + 0.4 * k; p.abductR = 0.05; p.elbowR = 1.0 - 0.2 * k;
				p.flexL = 0.6 * k; p.elbowL = 0.6; p.lean = 0.15 * k; p.yaw = - 0.3 * k; p.pitch = - 0.3;

			} else {

				p.flexR = 0.2; p.elbowR = 1.0; p.flexL = 0; p.elbowL = 0.2; p.lean = 0;
				p.yaw = 0.5 * Math.sin( s.t * 0.23 ) * Math.sin( s.t * 0.11 + 1 ); p.pitch = 0;

			}

		} else if ( s.kind === 'bags' ) {

			const busy = s.table.lanes.some( ( L ) => L.guard.busy );
			p.lean = busy ? 0.35 : 0.05; p.pitch = busy ? - 0.5 : 0;
			p.flexL = busy ? 0.55 : 0.3; p.elbowL = busy ? 1.0 : 1.2; p.abductL = 0.1;
			p.flexR = busy ? 0.7 + 0.15 * Math.sin( s.t * 3 ) : 0; p.elbowR = busy ? 0.7 : 0.2;
			p.yaw = busy ? 0 : 0.4 * Math.sin( s.t * 0.2 );

		}

	}

}
