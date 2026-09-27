import { LEVELS } from '../layout.js';
import { PROP, TOP, COLOR, HAT, CHEST } from './Cast.js';
import { Walkway, MID, GESTURE, railArms, dress, sizeOf, rng, pick } from './Concourse3BKit.js';

// The people of the third base concourse (Concourse3B.js): who walks it, where from and where to, the
// lines at the stands and the people serving them, and how they carry themselves on a cold night.
// Everything is in the concourse's own coordinates (Walkway): s metres along it from behind home plate
// toward third, d metres out from the field level's front line (the drink rail at the top of the seats
// is at d = 30, the stands' counters at 44.8).
//
// A fan is one person all night: up from the seats, along to a stand, into the line, up to a register
// to order and pay, the food handed over, then off with it back to the seats (or on to the restrooms,
// or out along the concourse). The lines grow while the Rays bat and between innings, when the home
// fans go for food; in the rain delay everyone's under the roof.
const STREET = LEVELS.mainConcourse;
export const RAIL_D = 30.1, FRONT_D = 44.76;
const TAU = Math.PI * 2;
const clamp = ( x, a, b ) => Math.max( a, Math.min( b, x ) );
const lerp = ( a, b, t ) => a + ( b - a ) * t;
const lerpArm = ( a, b, t ) => a.map( ( x, k ) => lerp( x, b[ k ], t ) );
// the short way round from angle a to b
const turn = ( a, b, k ) => {

	const d = ( ( b - a + Math.PI ) % TAU + TAU ) % TAU - Math.PI;
	return ( a + d * k ) % TAU;

};

// What the night is doing, from the replay: how busy the concourse is (the lines and the walkers follow
// it), which night it is, the rain, the last out.
export function nightState( d ) {

	if ( ! d ) return { busy: 0.8, first: true, rain: 0.5, suspended: false, celebrate: false, top: true, between: false, t: 0, inning: 5, half: 'top', snap: {} };
	const seg = d.segmentAt( d.t );
	const s = seg.snap || {};
	const suspended = seg.kind === 'switch' && s.inning === 6 && s.half === 'bottom';
	// the 27th: from the first pitch to the suspension (the rain delay is the 27th's last half hour)
	const first = s.inning < 6 || ( s.inning === 6 && s.half === 'top' ) || ( suspended && d.t - seg.t0 < seg.dur - 4 );
	const k = first ? Math.min( 1, ( ( s.inning - 1 ) * 2 + ( s.half === 'top' ? 0 : 1 ) ) / 10 ) : 0;
	const between = seg.kind === 'switch' || seg.kind === 'intro' || seg.kind === 'change';
	const celebrate = seg.kind === 'celebrate';
	// the Phillies fans go for food and the restrooms while the Rays bat and between innings; in the rain
	// delay everyone's under the roof; at the last out they're all at the rail
	let busy = s.half === 'top' ? 0.85 : 0.5;
	if ( between ) busy = 1.1;
	if ( suspended ) busy = 1.45;
	if ( celebrate ) busy = 0.35;
	// the 9th on the 29th: nobody leaves their seat
	if ( s.inning === 9 && ! celebrate ) busy *= 0.6;
	// a play's result: who scored, the outs made, what it was (the rail cheers, groans, claps)
	let result = null;
	if ( seg.kind === 'result' && seg.before ) {

		const r = seg.cues?.[ 0 ]?.[ 1 ]?.result;
		result = {
			home: s.score.home - seg.before.score.home, away: s.score.away - seg.before.score.away,
			outs: s.outs - seg.before.outs, type: r?.type || '', event: r?.event || '', t: d.t - seg.t0, key: seg.t0,
		};

	}

	return { busy, first, rain: first ? 0.3 + 0.7 * k : 0, suspended, celebrate, top: s.half === 'top', between, seg, snap: s, t: d.t, inning: s.inning, half: s.half, result, ball: d.ballAt, celebrateT: celebrate ? d.t - seg.t0 : 0 };

}

// what each stand hands over (the prop), and how likely: the cold night's hot chocolate at the Creamery
// and the Market (both have it on the board), the beer at Brewerytown
const MENU = {
	cobblestone: { sandwich: 5, tray: 4, soda: 1 },
	hatfield: { hotdog: 4, sandwich: 3, tray: 3 },
	schmitter: { sandwich: 6, tray: 3 },
	market: { hotdog: 4, cocoa: 3, peanuts: 2, soda: 2, tray: 1 },
	creamery: { cocoa: 7, soda: 1, waterIce: 1 },
	brewerytown: { beer: 5, beers: 4, sandwich: 1 },
	pizza: { sandwich: 3, tray: 3, soda: 2 },
	waterIce: { waterIce: 1 },
	cottonCandy: { cottonCandy: 3, soda: 1 },
	cocoa: { cocoa: 1 },
	nachos: { tray: 1 },
	programs: { program: 1 },
	beer: { beer: 3, beers: 1 },
};
const CARRY_PROP = {
	beer: PROP.beer, beers: PROP.beers, cocoa: PROP.cocoa, soda: PROP.soda, sandwich: PROP.sandwich, hotdog: PROP.hotdog, tray: PROP.tray,
	program: PROP.program, bag: PROP.bag, peanuts: PROP.peanuts, cottonCandy: PROP.cottonCandy, waterIce: PROP.waterIce, phone: PROP.phone,
};

// ---------------------------------------------------------------- the people

export class ConcoursePeople {

	constructor( { cast, walkway, concourse, bowl, sEnd, obstacles, carts = [], seed = 1 } ) {

		this.cast = cast;
		this.W = walkway;
		this.sEnd = sEnd;
		this.obstacles = obstacles; // [ s, d, r ]
		this.r = rng( seed );
		this.time = 0;
		this.actors = [];
		this._portals( concourse, bowl );
		this._stands( concourse );
		this._carts( carts );
		this._railSpots( concourse );
		this._restrooms( concourse );
		this._fans( 190 );

	}

	// ---- where people come from and go to
	_portals( concourse, bowl ) {

		const W = this.W, P = [];
		const inStretch = ( s ) => s > - 1 && s < this.sEnd + 1;
		// the aisles down into the seats
		for ( const A of concourse?.aisles || [] ) {

			const [ s, d ] = W.toSD( A.x, A.z );
			if ( inStretch( s ) && Math.abs( d - RAIL_D ) < 1.5 ) P.push( { kind: 'aisle', s, d: RAIL_D + 0.2, w: 6, num: A.num } );

		}

		// the Third Base Gate: in from the plaza through the turnstiles, across the ring to the concourse
		P.push( { kind: 'gate', s: 73.2, d: 45.5, w: 4, out: [ 78.5, 58 ] } );
		// the restrooms, the elevators, the team store
		for ( const D of concourse?.doors || [] ) {

			const [ s, d ] = W.toSD( D.x, D.z );
			if ( inStretch( s ) ) P.push( { kind: 'door', s, d: d - 0.2, w: D.kind === 'family' ? 0.7 : 2, door: D.kind } );

		}

		for ( const bank of bowl?.elevators || [] ) {

			const [ s, d ] = W.toSD( bank.stops[ 0 ].x, bank.stops[ 0 ].z );
			if ( inStretch( s ) ) P.push( { kind: 'door', s, d: d + 0.8, w: 0.6 } );

		}

		for ( const st of concourse?.standSpots || [] ) {

			const [ s, d ] = W.toSD( st.mid[ 0 ], st.mid[ 1 ] );
			if ( inStretch( s ) && st.kind === 'shop' ) P.push( { kind: 'door', s, d: d - 0.4, w: 1 } );

		}

		// the concourse on past either end
		P.push( { kind: 'end', s: - 9, d: MID, w: 5 } );
		P.push( { kind: 'end', s: this.sEnd + 9, d: MID, w: 5 } );
		this.portals = P;

	}

	_pickPortal( not = null, kinds = null, near = null ) {

		const list = this.portals.filter( ( p ) => p !== not && ( ! kinds || kinds.includes( p.kind ) ) );
		// nearer ones likelier (a walk of 40 m is likelier than one of 120)
		const w = ( p ) => p.w * ( near === null ? 1 : Math.exp( - Math.abs( p.s - near ) / 45 ) );
		let sum = 0;
		for ( const p of list ) sum += w( p );
		let x = this.r() * sum;
		for ( const p of list ) {

			x -= w( p );
			if ( x <= 0 ) return p;

		}

		return list[ 0 ];

	}

	// someone in the cast, dressed for the night; both looks (the 27th's may have a poncho)
	person( o = {}, look = null ) {

		const r = this.r;
		const seed = Math.floor( r() * 1e9 );
		const rr = rng( seed );
		const dry = look || dress( rr, o );
		const wet = { ...dry, poncho: o.poncho ?? ( look ? 0 : r() < 0.26 ? Number( pick( r, { 1: 48, 4: 16, 5: 9, 2: 8, 6: 12, 3: 7 } ) ) : 0 ) };
		if ( wet.poncho && wet.hat === HAT.none && r() < 0.5 ) wet.hat = HAT.hood; // the poncho's hood up
		const p = this.cast.add( wet );
		if ( ! p ) return null;
		p.looks = { wet, dry };
		p.scale = o.scale ?? sizeOf( dry, r );
		p.visible = false;
		return p;

	}

	// ---- the stands in this stretch: two registers each, the staff behind them, one line between the
	// stanchions
	_stands( concourse ) {

		const W = this.W;
		this.stands = [];
		for ( const st of concourse?.standSpots || [] ) {

			if ( st.kind !== 'food' ) continue;
			const [ s0 ] = W.toSD( st.mid[ 0 ], st.mid[ 1 ] );
			if ( s0 < 0 || s0 > this.sEnd ) continue;
			const { mid, n, u } = st;
			// the stand's frame: x to the right facing it, z out toward the field; as ( s, d )
			const at = ( x, z ) => W.toSD( mid[ 0 ] + u[ 0 ] * x + n[ 0 ] * z, mid[ 1 ] + u[ 1 ] * x + n[ 1 ] * z );
			const face = Walkway.yaw( - n[ 0 ], - n[ 1 ] ); // looking at the counter
			const S = { brand: st.brand, sec: st.sec, s: s0, at, face, staffFace: face + Math.PI, mid, n, u, line: [], counter: [ null, null ], staff: [], base: 0.6 + this.r() * 0.8, coming: 0 };
			// the staff: red polo shirts and black aprons, a cap; one of them has been here since the Vet
			for ( const x of [ - 1.6, 1.6 ] ) {

				const look = dress( rng( Math.floor( this.r() * 1e9 ) ), { age: this.r() < 0.2 ? 3 : 0 } );
				Object.assign( look, { top: TOP.staff, color: COLOR.red, sleeves: this.r() < 0.5 ? COLOR.black : COLOR.red, chest: CHEST.staff, hat: this.r() < 0.7 ? HAT.capBlack : HAT.visor, back: 0, poncho: 0, scarf: 0, gloves: false, pants: 3, shoes: 1 } );
				const p = this.person( { poncho: 0 }, look );
				if ( ! p ) break;
				const [ s, d ] = at( x, - 0.62 );
				const a = { kind: 'staff', p, s, d, x, stand: S, state: 'idle', t: this.r() * 3, order: this.r(), item: 0 };
				p.visible = true;
				S.staff.push( a );
				this.actors.push( a );

			}

			// the line's places: out from the counter between the stanchions, then on into the concourse,
			// bending round a column in the way
			S.slots = [];
			let x = 0;
			for ( let k = 0, z = 1.25; k < 12; k ++, z += 0.72 ) {

				const blocked = ( xx ) => this.obstacles.some( ( [ os, od, orad ] ) => {

					const [ ss, dd ] = at( xx, z );
					return Math.hypot( ss - os, dd - od ) < orad + 0.55;

				} );
				if ( blocked( x ) ) x = [ 0.9, - 0.9, 1.5, - 1.5 ].find( ( dx ) => ! blocked( x + dx ) ) + x || x;
				S.slots.push( [ x, z ] );

			}

			this.stands.push( S );

		}

	}

	// ---- the carts: one vendor behind each, a short line in front; the program sellers at their tables
	_carts( carts ) {

		const W = this.W;
		for ( const c of carts ) {

			const { n, u } = c, mid = [ c.x, c.z ];
			const at = ( x, z ) => W.toSD( mid[ 0 ] + u[ 0 ] * x + n[ 0 ] * z, mid[ 1 ] + u[ 1 ] * x + n[ 1 ] * z );
			const face = Walkway.yaw( - n[ 0 ], - n[ 1 ] );
			const S = { brand: c.kind, cart: true, s: c.s, at, face, staffFace: face + Math.PI, mid, n, u, line: [], counter: [ null ], staff: [], base: c.kind === 'programs' ? 0.25 : 0.35 + this.r() * 0.3, coming: 0, registers: [ 0 ] };
			// the vendor: the carts' red and black, a knit cap on a cold night; the program sellers in
			// their red aprons, a stack of programs, one held up
			const look = dress( rng( Math.floor( this.r() * 1e9 ) ), { age: this.r() < 0.3 ? 1 : 0 } );
			Object.assign( look, { top: c.kind === 'programs' ? TOP.seller : TOP.staff, color: COLOR.red, sleeves: COLOR.black, chest: CHEST.staff, hat: this.r() < 0.6 ? HAT.knitBlack : HAT.capBlack, back: 0, poncho: 0, gloves: this.r() < 0.5, pants: 3, shoes: 1 } );
			const p = this.person( { poncho: 0 }, look );
			if ( ! p ) break;
			const [ s, d ] = at( 0, - 0.85 );
			const a = { kind: 'staff', p, s, d, x: 0, z: - 0.85, stand: S, state: 'idle', t: this.r() * 3, order: this.r(), item: 0, seller: c.kind === 'programs' };
			p.visible = true;
			S.staff.push( a );
			this.actors.push( a );
			S.slots = [];
			for ( let k = 0; k < 6; k ++ ) S.slots.push( [ Math.sin( k * 1.7 ) * 0.2, 1.05 + 0.72 * k ] );
			this.stands.push( S );

		}

	}

	// ---- the drink rail at the top of the seats: a place to lean every 0.75 m (Concourse.railSpots),
	// facing the field
	_railSpots( concourse ) {

		const W = this.W;
		this.rail = [];
		for ( const R of concourse?.railSpots || [] ) {

			const [ s, d ] = W.toSD( R.x, R.z );
			if ( s < 0.5 || s > this.sEnd - 0.5 ) continue;
			this.rail.push( { s, d: d + 0.05, x: R.x, z: R.z, face: Walkway.yaw( - R.nx, - R.nz ), who: null, num: R.num } );

		}

	}

	// ---- the restrooms: the women's line out the door and along the wall; the men in and out
	_restrooms( concourse ) {

		const W = this.W;
		this.loos = [];
		for ( const D of concourse?.doors || [] ) {

			const [ s0 ] = W.toSD( D.x, D.z );
			if ( s0 < 0 || s0 > this.sEnd ) continue;
			// the door's frame: a along the wall (to the right facing it), n out toward the field
			const a = D.a, n = D.n;
			const at = ( x, z ) => W.toSD( D.x + a[ 0 ] * x + n[ 0 ] * ( z - 0.3 ), D.z + a[ 1 ] * x + n[ 1 ] * ( z - 0.3 ) );
			// the line runs along the wall away from the other door, then bends out into the concourse
			const away = D.kind === 'women' ? 1 : - 1;
			// two along the wall, then out into the concourse, round a bin or a column in the way
			const slots = [];
			let x = away * ( 0.95 + 0.62 * 2 );
			for ( let k = 0; k < 16; k ++ ) {

				if ( k < 3 ) {

					slots.push( [ away * ( 0.95 + 0.62 * k ), 0.42 ] );
					continue;

				}

				const z = 0.42 + 0.62 * ( k - 2 );
				const blocked = ( xx ) => this.obstacles.some( ( [ os, od, orad ] ) => {

					const [ ss, dd ] = at( xx, z );
					return Math.hypot( ss - os, dd - od ) < orad + 0.5;

				} );
				if ( blocked( x ) ) x += [ - 0.8 * away, 0.8 * away, - 1.4 * away ].find( ( dx ) => ! blocked( x + dx ) ) ?? 0;
				slots.push( [ x, z ] );

			}
			this.loos.push( { kind: D.kind, s: s0, at, face: Walkway.yaw( - n[ 0 ], - n[ 1 ] ), line: [], coming: 0, slots, next: 0, base: D.kind === 'women' ? 1 : D.kind === 'family' ? 0.15 : 0.1 } );

		}

	}

	// ---- the fans: a pool of people who come and go all night
	_fans( n ) {

		const r = this.r;
		this.fans = [];
		for ( let i = 0; i < n; i ++ ) {

			const p = this.person();
			if ( ! p ) break;
			const L = p.looks.dry;
			const f = {
				p, kind: 'fan', mode: 'off', wait: r() * 6,
				speed: ( L.age === 1 ? 0.95 : L.age === 2 ? 1.35 : 1.25 ) + ( r() - 0.5 ) * 0.35,
				order: r(), s: 0, d: MID, vs: 0, vd: 0, side: 0, lane: MID,
				carry: 'none', hands: pick( r, { free: 5, pockets: 4, phone: 1 } ),
				swing: 0.26 + 0.12 * r(),
			};
			this.fans.push( f );
			this.actors.push( f );

		}

	}

	// a fan with a look and a job of their own (Kevin, the beer men): they walk from portal to portal
	// with what they carry, never to a line or the rail
	addFan( look, extra = {} ) {

		const p = this.person( { poncho: 0 }, { ...look, seed: Math.floor( this.r() * 65536 ) } );
		if ( ! p ) return null;
		p.scale = 1.0;
		const f = {
			p, kind: 'fan', mode: 'off', wait: this.r() * 4, speed: 1.3, order: this.r(), s: 0, d: MID, vs: 0, vd: 0, side: 0, lane: MID,
			carry: 'none', hands: 'free', swing: 0.3, fixed: true, ...extra,
		};
		this.fans.push( f );
		this.actors.push( f );
		return f;

	}

	// a fan sets out: from somewhere to somewhere (a stand's line most often, the seats, the restrooms)
	_start( f, ns, forNeed = false ) {

		const r = this.r;
		const from = this._pickPortal();
		f.forNeed = forNeed;
		f.from = from;
		f.s = from.s + ( r() - 0.5 ) * ( from.kind === 'end' ? 2 : 0.6 );
		f.d = from.kind === 'end' ? lerp( 32, 43, r() ) : from.d;
		// up the aisle's steps from a few rows down; in from the turnstiles; out of a door
		if ( from.kind === 'aisle' ) f.d = RAIL_D - 2.6;
		if ( from.kind === 'gate' ) {

			f.s = from.out[ 0 ] + ( r() - 0.5 ) * 3;
			f.d = from.out[ 1 ];

		}

		if ( from.kind === 'door' ) f.d = from.d + 1.2;
		// to a stand whose line is short of what the night wants (from the aisles and doors near it), or
		// on to somewhere
		let stand = null;
		f.checked = false;
		if ( f.fixed ) {

			// the ones with a job: from the concourse's ends to the aisles and back
			f.stand = null; f.spot = null; f.loo = null;
			f.to = from.kind === 'aisle' ? this._pickPortal( from, [ 'end', 'aisle' ] ) : this._pickPortal( from, [ 'aisle' ] );
			f.mode = 'walk';
			f.phase = 'in';
			this._lane( f, f.to.s );
			f.p.visible = true;
			f.p.fresh = true;
			f.p.pose.phase = r() * TAU;
			return;

		}

		const short = this.stands.filter( ( S ) => S.line.length + S.coming < Math.round( S.base * ( 0.35 + ns.busy ) * 3.5 ) );
		if ( short.length && r() < ( forNeed ? 0.6 : 0.75 ) ) {

			stand = short[ Math.floor( r() * short.length ) ];
			const near = this.portals.filter( ( q ) => Math.abs( q.s - stand.s ) < 30 && q.kind !== 'end' );
			if ( near.length && from.kind !== 'gate' ) {

				const q = near[ Math.floor( r() * near.length ) ];
				f.from = q;
				f.s = q.s + ( r() - 0.5 ) * 0.6;
				f.d = q.kind === 'aisle' ? RAIL_D - 2.6 : q.kind === 'door' ? q.d + 1.2 : q.d;

			}

			stand.coming ++;

		}

		// what they've already got in hand (the ones coming from a stand elsewhere, the team store)
		// what they've already got in hand; on the 27th Aramark sold 15,000 cups of hot chocolate
		f.carry = stand ? 'none' : pick( r, { none: 6, beer: 3, cocoa: ns.first ? 4 : 2, soda: 1, sandwich: 1, program: 1, bag: 0.4 } );
		if ( f.p.looks.dry.age === 2 && r() < 0.3 ) f.carry = 'cottonCandy';
		f.stand = stand;
		f.spot = null;
		f.loo = null;
		f.to = stand ? null : from.kind === 'aisle' ? this._pickPortal( from, [ 'door', 'end', 'aisle' ], f.s ) : this._pickPortal( from, [ 'aisle', 'aisle', 'door', 'end' ], f.s );
		// the women's line, if it's short of what the night wants (the women, mostly)
		if ( ! stand ) {

			const L = f.p.looks.dry;
			const loo = this.loos.find( ( R ) => R.line.length + R.coming < Math.round( R.base * ( 0.2 + ns.busy ) * 4 ) && ( R.kind === 'women' ? L.female && L.age !== 2 : ! L.female ) );
			if ( loo && r() < 0.7 ) {

				f.loo = loo;
				loo.coming ++;
				f.to = null;

			}

		}

		// the rail, to stand and watch (the standing-room tickets, and the ones who'd rather)
		if ( ! f.stand && ! f.loo && this.rail.length ) {

			const taken = this.rail.filter( ( q ) => q.who ).length;
			const wantRail = this.rail.length * ( ns.celebrate ? 0.9 : ns.suspended ? 0.25 : ns.inning >= 9 && ! ns.first ? 0.8 : 0.5 );
			if ( taken < wantRail && ( r() < 0.6 || forNeed ) ) {

				const free = this.rail.filter( ( q ) => ! q.who && Math.abs( q.s - f.s ) < 40 );
				if ( free.length ) {

					f.spot = free[ Math.floor( r() * free.length ) ];
					f.spot.who = f;
					f.to = null;

				}

			}

		}

		f.mode = 'walk';
		f.phase = 'in';
		const goalS = stand ? stand.s : f.loo ? f.loo.s : f.spot ? f.spot.s : f.to.s;
		this._lane( f, goalS );
		f.p.visible = true;
		f.p.fresh = true;
		f.p.yaw = Walkway.yaw( ...this._worldDir( f.s, f.d, Math.sign( goalS - f.s ) || 1, 0 ) );
		f.p.pose.phase = r() * TAU;

	}

	// keep right: toward third (+s) on the field side of the walkway, back toward home on the other
	_lane( f, goalS ) {

		const dir = Math.sign( goalS - f.s ) || 1;
		const r = this.r();
		// clear of the columns' line down the middle (d = 40.9)
		f.lane = dir > 0 ? lerp( 31.8, 36.5, r ) : r < 0.8 ? lerp( 37.2, 39.3, r / 0.8 ) : lerp( 42.4, 43.1, ( r - 0.8 ) / 0.2 );

	}

	// off from where they are (a stand, the rail) to a portal, with what they've got
	_leave( f, kinds = [ 'aisle', 'aisle', 'aisle', 'door', 'end' ] ) {

		f.mode = 'walk';
		f.phase = 'in';
		f.stand = null;
		f.loo = null;
		if ( f.spot ) f.spot.who = null;
		f.spot = null;
		f.to = this._pickPortal( null, kinds, f.s );
		this._lane( f, f.to.s );

	}

	// a direction in the concourse ( ds, dd ) as a field direction [ dx, dz ]
	_worldDir( s, d, vs, vd ) {

		const a = this.W.at( s, d );
		return [ a.ux * vs - a.nx * vd, a.uz * vs - a.nz * vd ];

	}

	update( dt, ns ) {

		this.time += dt;
		// how many are out walking (the night's busyness), and whether a line or the rail wants people:
		// the ones in a line or at the rail don't count against the walkers
		const want = this.fans.length * clamp( ns.busy / 1.45, 0.12, 1 ) * 0.5;
		let walking = 0;
		for ( const f of this.fans ) if ( f.mode === 'walk' ) walking ++;
		const needs = this.stands.some( ( S ) => S.line.length + S.coming < Math.round( S.base * ( 0.35 + ns.busy ) * 3.5 ) )
			|| this.loos.some( ( R ) => R.line.length + R.coming < Math.round( R.base * ( 0.2 + ns.busy ) * 4 ) )
			|| this.rail.filter( ( q ) => q.who ).length < this.rail.length * ( ns.celebrate ? 0.9 : ns.suspended ? 0.25 : ns.inning >= 9 && ! ns.first ? 0.8 : 0.5 );
		// the lines and the rail fill a few people a second, whatever the walkers are doing
		this._needT = ( this._needT || 0 ) + dt * 3;
		for ( const f of this.fans ) {

			if ( f.mode === 'off' ) {

				f.wait -= dt;
				if ( f.wait > 0 ) continue;
				if ( walking < want ) {

					this._start( f, ns );
					walking ++;

				} else if ( needs && this._needT >= 1 && ! f.fixed && walking < want * 2 + 10 ) {

					this._needT -= 1;
					this._start( f, ns, true );
					walking ++;

				}

			}

		}

		this._needT = Math.min( this._needT, 3 );

		// who's where, in 2 m bins along the concourse (for stepping round each other)
		this._bins = new Map();
		for ( const o of this.actors ) {

			if ( ! o.p?.visible || o.kind === 'staff' ) continue;
			const b = Math.floor( o.s / 2 );
			if ( ! this._bins.has( b ) ) this._bins.set( b, [] );
			this._bins.get( b ).push( o );

		}

		for ( const S of this.stands ) this._serve( S, dt, ns );
		for ( const R of this.loos ) this._loo( R, dt, ns );
		this._reactions( dt, ns );
		for ( const f of this.fans ) {

			if ( f.mode === 'walk' ) this._walk( f, dt, ns );
			else if ( f.mode === 'queue' || f.mode === 'counter' ) this._inLine( f, dt, ns );
			else if ( f.mode === 'rail' ) this._atRail( f, dt, ns );
			else if ( f.mode === 'loo' ) this._inLoo( f, dt, ns );

		}

		// the last out: everyone on the concourse makes for the rail
		if ( ns.celebrate && ! this._rushed ) {

			this._rushed = true;
			for ( const f of this.fans ) {

				if ( f.mode !== 'walk' || f.spot ) continue;
				const free = this.rail.filter( ( q ) => ! q.who ).sort( ( a, b ) => Math.abs( a.s - f.s ) - Math.abs( b.s - f.s ) );
				if ( ! free.length ) break;
				if ( f.stand ) f.stand.coming = Math.max( 0, f.stand.coming - 1 );
				if ( f.loo ) f.loo.coming = Math.max( 0, f.loo.coming - 1 );
				f.stand = null; f.loo = null; f.to = null;
				f.spot = free[ 0 ];
				f.spot.who = f;
				f.phase = 'in';

			}

		}

		if ( ! ns.celebrate ) this._rushed = false;

		for ( const S of this.stands ) for ( const a of S.staff ) this._staffPose( a, dt, ns );
		// the looks follow the night: ponchos on the 27th
		if ( this._first !== ns.first ) {

			this._first = ns.first;
			for ( const a of this.actors ) if ( a.p?.looks ) this.cast.setLook( a.p, ns.first ? a.p.looks.wet : a.p.looks.dry );

		}

	}

	// ---- walking
	_walk( f, dt, ns ) {

		const p = f.p;
		if ( f.hold > 0 ) {

			// stopped for the usher: the ticket held out to him, then off down the steps
			f.hold -= dt;
			const u = f.to.usher;
			const [ dx, dz ] = this._worldDir( f.s, f.d, u.s - f.s, u.d - f.d );
			this._move( f, 0, 0, dt, Walkway.yaw( dx, dz ) );
			const a = p.pose;
			a.walk = lerp( a.walk, 0, Math.min( 1, dt * 6 ) );
			this._hands( f, a, ns );
			a.armL = GESTURE.reachL[ 0 ].slice();
			a.propL = PROP.ticket;
			a.headPitch = 0.1;
			return;

		}

		let gs, gd, arrive = 0.35;
		if ( f.stand ) {

			// to the back of the line
			const k = f.stand.line.length;
			const q = f.stand.slots[ Math.min( k, f.stand.slots.length - 1 ) ];
			[ gs, gd ] = f.stand.at( q[ 0 ], q[ 1 ] );
			arrive = 0.6;

		} else if ( f.loo ) {

			const q = f.loo.slots[ Math.min( f.loo.line.length, f.loo.slots.length - 1 ) ];
			[ gs, gd ] = f.loo.at( q[ 0 ], q[ 1 ] );
			arrive = 0.6;

		} else if ( f.spot ) {

			gs = f.spot.s; gd = f.spot.d;
			arrive = 0.3;

		} else {

			const to = f.to;
			gs = to.s; gd = to.d;
			// through the door, down the steps, out the gate
			if ( f.phase === 'exit' ) {

				if ( to.kind === 'aisle' ) gd = RAIL_D - 3.2;
				else if ( to.kind === 'gate' ) {

					gs = to.out[ 0 ]; gd = to.out[ 1 ];

				} else if ( to.kind === 'door' ) gd = to.d + 1.6;

			}

		}

		const ds = gs - f.s, dd = gd - f.d;
		const dist = Math.hypot( ds, dd );
		if ( dist < arrive || ( f.to?.kind === 'end' && Math.abs( ds ) < 1 ) ) {

			if ( f.stand ) {

				f.mode = 'queue';
				f.stand.line.push( f );
				f.stand.coming = Math.max( 0, f.stand.coming - 1 );
				return;

			}

			if ( f.loo ) {

				f.mode = 'loo';
				f.loo.line.push( f );
				f.loo.coming = Math.max( 0, f.loo.coming - 1 );
				return;

			}

			if ( f.spot ) {

				f.mode = 'rail';
				f.railT = 0;
				f.stay = 40 + this.r() * 160;
				f.railPose = this._railPoseFor( f );
				return;

			}

			if ( f.phase === 'in' && f.to.kind !== 'end' ) {

				f.phase = 'exit';
				// the usher at the top of the aisle wants to see the ticket (the beer men he knows)
				if ( f.to.usher && ! f.checked && ! f.hawker && this.r() < 0.8 ) {

					f.hold = 2.3;
					f.checked = true;
					f.to.usher.checkFan = f;

				}

			}
			else {

				f.mode = 'off';
				p.visible = false;
				f.wait = 1 + this.r() * 5;
				return;

			}

		}

		// along the lane while it's a way off, then over to it; to a line at the stands' side, along the
		// middle of the walkway (clear of the other lines and the bins) and in square to it at the end
		const toWall = f.stand || f.loo;
		const far = toWall ? Math.abs( ds ) > 1.6 : Math.abs( ds ) > Math.abs( gd - f.d ) * 1.2 + 2;
		const td = f.phase === 'exit' ? gd : far ? ( toWall ? Math.min( 37.6, gd ) : f.lane ) + f.side : gd;
		let vs = Math.sign( ds ) * Math.min( 1, Math.abs( ds ) / 1.5 );
		let vd = clamp( ( td - f.d ) * 0.9, - 1, 1 );
		if ( f.phase === 'exit' ) {

			vs = clamp( ds, - 1, 1 );
			vd = clamp( dd, - 1, 1 );

		}

		[ vs, vd ] = this._avoid( f, vs, vd, dt );
		const vl = Math.hypot( vs, vd ) || 1;
		// the crowd slows everyone down when it's busy
		const speed = f.speed * ( ns.busy > 1.2 ? 0.8 : 1 ) * Math.min( 1, dist / 0.6 + 0.3 );
		this._move( f, vs / vl * speed, vd / vl * speed, dt );
		// stuck in a knot of people or against a column: try another way round, then give it up
		f.stuck = Math.hypot( f.vs, f.vd ) < 0.2 ? ( f.stuck || 0 ) + dt : Math.max( 0, ( f.stuck || 0 ) - dt );
		if ( f.stuck > 3 && ! f.tried ) {

			f.side = ( this.r() < 0.5 ? - 1 : 1 ) * 1.3;
			f.tried = true;

		}
		if ( f.stuck > 9 ) {

			f.stuck = 0;
			f.tried = false;
			if ( f.stand ) f.stand.coming = Math.max( 0, f.stand.coming - 1 );
			if ( f.loo ) f.loo.coming = Math.max( 0, f.loo.coming - 1 );
			this._leave( f );

		}

		this._walkPose( f, Math.hypot( f.vs, f.vd ), dt, ns );

	}

	// round the columns and the bins, round each other (the one on course steps to his right)
	// the obstacles within a few metres along the concourse (they don't move: binned once, 4 m bins)
	_near( s ) {

		if ( ! this._obs ) {

			this._obs = new Map();
			for ( const o of this.obstacles ) for ( let b = Math.floor( ( o[ 0 ] - 3.5 ) / 4 ); b <= Math.floor( ( o[ 0 ] + 3.5 ) / 4 ); b ++ ) {

				if ( ! this._obs.has( b ) ) this._obs.set( b, [] );
				this._obs.get( b ).push( o );

			}

		}

		return this._obs.get( Math.floor( s / 4 ) ) || [];

	}

	_avoid( f, vs, vd, dt ) {

		// a column (a bin, a cart) ahead on the way: steer for the edge of it, on the side it's already
		// off to (straight at it: by temperament, the same side every time)
		const vl = Math.hypot( vs, vd ) || 1;
		let us = vs / vl, ud = vd / vl;
		for ( const [ os, od, orad ] of this._near( f.s ) ) {

			const cs = os - f.s, cd = od - f.d, dist = Math.hypot( cs, cd ), R = orad + 0.42;
			if ( dist > 3.2 || dist < 1e-3 ) continue;
			const ahead = cs * us + cd * ud;
			if ( ahead < 0 ) continue;
			const across = us * cd - ud * cs; // + : the obstacle's to the left of the way
			if ( Math.abs( across ) > R ) continue;
			const side = Math.abs( across ) < 0.05 ? ( f.order < 0.5 ? 1 : - 1 ) : Math.sign( across );
			// turn away from it by the angle to its edge
			const a = - side * ( Math.asin( Math.min( 1, R / Math.max( dist, R ) ) ) - Math.asin( clamp( Math.abs( across ) / dist, 0, 1 ) ) * 0.8 );
			const c = Math.cos( a ), sn = Math.sin( a );
			[ us, ud ] = [ us * c - ud * sn, us * sn + ud * c ];

		}

		vs = us * vl; vd = ud * vl;
		// the others: someone on course steps to his right; nobody walks through anybody
		f.side *= Math.exp( - dt * 0.8 );
		const b = Math.floor( f.s / 2 );
		for ( let k = b - 1; k <= b + 1; k ++ ) for ( const o of this._bins.get( k ) || [] ) {

			if ( o === f ) continue;
			const es = f.s - o.s, ed = f.d - o.d;
			if ( Math.abs( es ) > 2.2 || Math.abs( ed ) > 1.2 ) continue;
			if ( es * Math.sign( vs ) < 0 && Math.abs( ed ) < 0.7 ) f.side += ( Math.sign( vs ) > 0 ? - 1 : 1 ) * dt * 1.4;
			const e = Math.hypot( es, ed );
			if ( e < 0.6 ) {

				// two on the same spot part the same way every time (not a coin toss each frame)
				const [ ps, pd ] = e > 0.05 ? [ es / e, ed / e ] : [ f.order > o.order ? 1 : - 1, 0 ];
				vs += ps * ( 0.6 - e ) * 2;
				vd += pd * ( 0.6 - e ) * 2;

			}

		}

		f.side = clamp( f.side, - 1.4, 1.4 );
		return [ vs, vd ];

	}

	// never inside a column: pushed out to its edge
	_solid( f ) {

		for ( const [ os, od, orad ] of this._near( f.s ) ) {

			const es = f.s - os, ed = f.d - od, e = Math.hypot( es, ed ), R = orad + 0.3;
			if ( e < R ) {

				const [ us, ud ] = e > 1e-3 ? [ es / e, ed / e ] : [ 0, - 1 ];
				f.s = os + us * R;
				f.d = od + ud * R;

			}

		}

	}

	_move( f, vs, vd, dt, faceYaw = null ) {

		const p = f.p;
		f.vs = lerp( f.vs, vs, Math.min( 1, dt * 4 ) );
		f.vd = lerp( f.vd, vd, Math.min( 1, dt * 4 ) );
		f.s += f.vs * dt;
		f.d += f.vd * dt;
		this._solid( f );
		const a = this.W.at( f.s, f.d );
		p.x = a.x; p.z = a.z;
		// on the aisle's steps, below the concourse
		p.y = STREET - Math.max( 0, RAIL_D - f.d ) * 0.28;
		const [ dx, dz ] = this._worldDir( f.s, f.d, f.vs, f.vd );
		if ( faceYaw !== null ) p.yaw = turn( p.yaw, faceYaw, Math.min( 1, dt * 4 ) );
		else if ( Math.hypot( dx, dz ) > 0.1 ) p.yaw = turn( p.yaw, Walkway.yaw( dx, dz ), Math.min( 1, dt * 6 ) );

	}

	// the stride, the arms swinging (or carrying), the head
	_walkPose( f, v, dt, ns ) {

		const a = f.p.pose, t = this.time;
		const stride = 1.15 * f.p.scale;
		a.walk = lerp( a.walk, Math.min( 1, v / 0.9 ), Math.min( 1, dt * 5 ) );
		a.phase = ( a.phase + dt * v / stride * TAU ) % TAU;
		this._hands( f, a, ns, Math.sin( a.phase ) * f.swing * a.walk );
		// the head: ahead, glancing to the field now and then (it's on the right going toward third)
		const glance = Math.max( 0, Math.sin( t * 0.4 + f.order * 17 ) - 0.8 ) / 0.2;
		a.headYaw = lerp( a.headYaw, glance * 0.8 * ( f.vs >= 0 ? - 1 : 1 ), Math.min( 1, dt * 3 ) );
		a.headPitch = - 0.05 + 0.08 * glance;
		a.blink = ( t * 0.37 + f.order * 3 ) % 1 < 0.04 ? 1 : 0;
		a.lean = 0.03 * a.walk; a.twist = 0; a.roll = 0; a.drop = 0;
		a.hipL = a.hipR = a.kneeL = a.kneeR = 0;

	}

	// the arms: what's carried, or swinging free (sw), or in the pockets against the cold
	_hands( f, a, ns, sw = 0 ) {

		const t = this.time;
		a.armL = [ sw, 0.07, 0, 0.18 + 0.12 * Math.max( 0, sw ) ];
		a.armR = [ - sw, 0.07, 0, 0.18 + 0.12 * Math.max( 0, - sw ) ];
		a.propL = 0; a.propR = 0; a.mouth = 0;
		const c = f.carry;
		if ( c === 'tray' ) {

			a.armL = GESTURE.tray[ 0 ].slice(); a.armR = GESTURE.tray[ 1 ].slice();
			a.propR = PROP.tray;
			return;

		}

		if ( c !== 'none' ) {

			// a drink or the food in the right hand, carried at the chest; a sip now and then
			const sip = c === 'beer' || c === 'cocoa' || c === 'soda' || c === 'beers' ? Math.max( 0, Math.sin( t * 0.35 + f.order * 40 ) - 0.93 ) / 0.07 : 0;
			a.armR = lerpArm( GESTURE.carry[ 1 ], GESTURE.sip[ 1 ], c === 'beers' ? 0 : sip );
			a.armR[ 0 ] += 0.03 * Math.sin( a.phase * 2 ) * a.walk;
			a.propR = CARRY_PROP[ c ] || 0;
			if ( c === 'bag' || c === 'program' ) a.armR = [ - sw * 0.5, 0.12, 0, c === 'program' ? 0.9 : 0.12 ];

		}

		if ( f.hands === 'pockets' || ( c !== 'none' && f.order < ( ns.first ? 0.45 : 0.3 ) ) ) {

			a.armL = GESTURE.pockets[ 0 ].slice();
			a.propL = PROP.pocket;
			if ( c === 'none' ) {

				a.armR = GESTURE.pockets[ 1 ].slice();
				a.propR = PROP.pocket;

			}

		} else if ( f.hands === 'phone' && c === 'none' ) {

			a.armR = GESTURE.phone[ 1 ].slice();
			a.propR = PROP.phone;
			a.mouth = Math.max( 0, 0.3 * Math.sin( t * 7 + f.order * 20 ) * Math.sin( t * 1.3 + f.order * 5 ) );

		}

	}

	// ---- at the rail
	// how this one stands at the rail: leaning on the shelf on the forearms, a drink on it, the arms
	// folded against the cold, hands in the pockets, upright with a hand on the rail
	_railPoseFor( f ) {

		const r = this.r, k = f.p.scale;
		const kind = f.p.looks.dry.age === 2 ? 'kid' : pick( r, { lean: 5, drink: f.carry !== 'none' && f.carry !== 'tray' ? 4 : 0, fold: 2, pockets: 2, hand: 2 } );
		const lean = 0.18 + r() * 0.22;
		const arms = kind === 'kid' ? [ [ 2.3, 0.15, 0.1, 0.9 ], [ 2.3, 0.15, 0.1, 0.9 ] ] : kind === 'lean' || kind === 'drink' ? railArms( k, lean ) : kind === 'hand' ? railArms( k, 0.05 ) : null;
		return { kind, lean: kind === 'lean' || kind === 'drink' ? lean : 0.03, arms, weight: r() < 0.5 ? 'L' : 'R' };

	}

	_atRail( f, dt, ns ) {

		const p = f.p, a = p.pose, t = this.time, R = f.railPose, spot = f.spot;
		f.railT += dt;
		// back to the seats (or for another beer) after a while; not while it's the last out
		if ( f.railT > f.stay && ! ns.celebrate ) {

			this._leave( f, [ 'aisle', 'aisle', 'door', 'end' ] );
			return;

		}

		f.s = spot.s; f.d = spot.d;
		const w = this.W.at( spot.s, spot.d );
		p.x = w.x; p.z = w.z; p.y = STREET;
		p.yaw = turn( p.yaw, spot.face, Math.min( 1, dt * 4 ) );
		a.walk = lerp( a.walk, 0, Math.min( 1, dt * 5 ) );
		a.twist = 0; a.roll = 0; a.drop = 0; a.mouth = 0; a.propL = 0; a.propR = 0;
		a.lean = lerp( a.lean, R.lean, Math.min( 1, dt * 3 ) );
		a.hipL = 0; a.hipR = 0;
		a.kneeL = R.weight === 'L' ? 0 : 0.14; a.kneeR = R.weight === 'L' ? 0.14 : 0;
		if ( R.kind === 'lean' || R.kind === 'hand' || R.kind === 'kid' ) {

			a.armL = R.arms[ 0 ].slice(); a.armR = R.arms[ 1 ].slice();
			if ( R.kind === 'hand' ) {

				a.armL = GESTURE.pockets[ 0 ].slice();
				a.propL = PROP.pocket;

			}

		} else if ( R.kind === 'drink' ) {

			a.armL = R.arms[ 0 ].slice();
			a.armR = R.arms[ 1 ].slice();
			a.propR = CARRY_PROP[ f.carry ] || 0;
			// a sip now and then
			const sip = Math.max( 0, Math.sin( t * 0.3 + f.order * 40 ) - 0.9 ) / 0.1;
			if ( sip > 0 ) a.armR = lerpArm( a.armR, GESTURE.sip[ 1 ], sip );

		} else if ( R.kind === 'fold' ) {

			a.armL = GESTURE.fold[ 0 ].slice(); a.armR = GESTURE.fold[ 1 ].slice();

		} else {

			a.armL = GESTURE.pockets[ 0 ].slice(); a.armR = GESTURE.pockets[ 1 ].slice();
			a.propL = PROP.pocket; a.propR = PROP.pocket;

		}

		// the head: on the ball in play, else on home plate (and now and then a word with the next one)
		const target = ns.ball ? [ ns.ball[ 0 ], ns.ball[ 2 ] ] : [ 0, 0 ];
		const dx = target[ 0 ] - p.x, dz = target[ 1 ] - p.z;
		let yaw = Math.atan2( - dx, - dz ) - p.yaw;
		yaw = ( ( yaw + Math.PI ) % TAU + TAU ) % TAU - Math.PI;
		const chat = Math.max( 0, Math.sin( t * 0.15 + f.order * 23 ) - 0.75 ) / 0.25;
		a.headYaw = lerp( a.headYaw, clamp( yaw, - 1.1, 1.1 ) * ( 1 - chat ) + ( f.order < 0.5 ? 0.9 : - 0.9 ) * chat, Math.min( 1, dt * 4 ) );
		a.headPitch = lerp( a.headPitch, 0.18, Math.min( 1, dt * 2 ) );
		a.mouth = chat > 0.5 ? Math.max( 0, 0.3 * Math.sin( t * 7 + f.order * 9 ) ) : 0;
		a.blink = ( t * 0.35 + f.order * 3 ) % 1 < 0.04 ? 1 : 0;
		this._react( f, a, dt, ns );

	}

	// what just happened, for everyone who's watching: a Phillies run, a Rays run, an out, the last out
	_reactions( dt, ns ) {

		const R = ns.result;
		if ( R && R.key !== this._resultKey ) {

			this._resultKey = R.key;
			let kind = null;
			if ( R.home > 0 ) kind = 'cheer';
			else if ( R.away > 0 ) kind = 'groan';
			else if ( ns.half === 'top' && R.outs > 0 ) kind = /strikeout/.test( R.type ) ? 'fist' : 'clap';
			else if ( ns.half === 'bottom' && /single|double|triple|walk/.test( R.type ) ) kind = 'clap';
			this.react = kind ? { kind, t: 0 } : null;

		}

		if ( this.react ) {

			this.react.t += dt;
			if ( this.react.t > 5 ) this.react = null;

		}

		if ( ns.celebrate ) this.react = { kind: 'champions', t: ns.celebrateT };

	}

	_react( f, a, dt, ns ) {

		const R = this.react;
		if ( ! R ) return;
		// a beat late, and not all at once; the one on the phone misses it
		const t = R.t - f.order * 0.5;
		if ( t < 0 ) return;
		const k = clamp( t / 0.35, 0, 1 ) * clamp( ( ( R.kind === 'champions' ? 1e9 : 4.2 ) - t ) / 0.6, 0, 1 );
		if ( k <= 0 ) return;
		const T = this.time;
		if ( R.kind === 'cheer' || R.kind === 'champions' ) {

			// arms up, shouting, a little jump; at the last out hugging the one beside them, the towel waved
			const up = GESTURE.cheer;
			const pump = 0.25 * Math.sin( T * 9 + f.order * 6 );
			a.armL = lerpArm( a.armL, [ up[ 0 ][ 0 ] + pump, up[ 0 ][ 1 ], up[ 0 ][ 2 ], up[ 0 ][ 3 ] ], k );
			a.armR = lerpArm( a.armR, [ up[ 1 ][ 0 ] - pump, up[ 1 ][ 1 ], up[ 1 ][ 2 ], up[ 1 ][ 3 ] ], k );
			a.propL = a.propL === PROP.pocket ? 0 : a.propL;
			if ( a.propR === PROP.pocket ) a.propR = R.kind === 'champions' && f.order > 0.6 ? PROP.towel : 0;
			a.lean = lerp( a.lean, - 0.05, k );
			a.mouth = k * ( 0.7 + 0.3 * Math.sin( T * 5 + f.order ) );
			a.headPitch = lerp( a.headPitch, - 0.25, k );
			a.drop = - k * Math.max( 0, Math.sin( T * 7.5 + f.order * 11 ) ) * 0.07;

		} else if ( R.kind === 'groan' ) {

			a.armL = lerpArm( a.armL, GESTURE.head[ 0 ], k );
			a.armR = lerpArm( a.armR, GESTURE.head[ 1 ], k );
			a.propL = 0; a.propR = a.propR === PROP.pocket ? 0 : a.propR;
			a.headPitch = lerp( a.headPitch, 0.3, k );
			a.lean = lerp( a.lean, 0.08, k );

		} else if ( R.kind === 'clap' || R.kind === 'fist' ) {

			const open = Math.max( 0, Math.sin( T * 11 + f.order * 3 ) );
			a.armL = lerpArm( a.armL, lerpArm( GESTURE.clap[ 0 ], GESTURE.clapOpen[ 0 ], open ), k );
			a.armR = lerpArm( a.armR, lerpArm( GESTURE.clap[ 1 ], GESTURE.clapOpen[ 1 ], open ), k );
			if ( R.kind === 'fist' && f.order > 0.5 ) a.armR = lerpArm( a.armR, GESTURE.fist[ 1 ], k );
			if ( a.propL === PROP.pocket ) a.propL = 0;
			if ( a.propR === PROP.pocket ) a.propR = 0;
			a.mouth = k * 0.4;

		}

	}

	// ---- the restroom line: the front goes in when someone comes out; they come out and go
	_loo( R, dt, ns ) {

		R.next -= dt;
		if ( R.line.length && R.next <= 0 ) {

			// in the door: the front of the line, a half minute or so each (the men's goes quicker)
			const f = R.line.shift();
			f.mode = 'walk';
			f.loo = null;
			f.to = { kind: 'door', s: R.at( 0, 0 )[ 0 ], d: R.at( 0, 0 )[ 1 ], w: 0 };
			f.phase = 'exit';
			R.next = ( R.kind === 'women' ? 6 : 3 ) + this.r() * 5;

		}

		const want = Math.round( R.base * ( 0.2 + ns.busy ) * 4 );
		if ( R.line.length > want + 4 ) this._leave( R.line.pop() );

	}

	_inLoo( f, dt, ns ) {

		const R = f.loo, a = f.p.pose, t = this.time;
		if ( ! R ) return;
		const k = R.line.indexOf( f );
		const q = R.slots[ Math.min( k, R.slots.length - 1 ) ];
		const [ gs, gd ] = R.at( q[ 0 ], q[ 1 ] );
		const ds = gs - f.s, dd = gd - f.d, dist = Math.hypot( ds, dd );
		const v = dist > 0.08 ? Math.min( 0.8, dist * 1.5 ) : 0;
		// facing up the line (toward the door)
		const [ ns2, nd2 ] = k === 0 ? R.at( 0, 0 ) : R.at( ...R.slots[ k - 1 ] );
		const [ fx, fz ] = this._worldDir( f.s, f.d, ns2 - f.s, nd2 - f.d );
		this._move( f, v ? ds / dist * v : 0, v ? dd / dist * v : 0, dt, Walkway.yaw( fx, fz ) );
		a.walk = lerp( a.walk, Math.min( 1, Math.hypot( f.vs, f.vd ) / 0.6 ), Math.min( 1, dt * 5 ) );
		a.phase = ( a.phase + dt * Math.hypot( f.vs, f.vd ) / 1.1 * TAU ) % TAU;
		// waiting: arms folded, the phone, a word with the one behind, the weight from foot to foot
		this._hands( f, a, ns );
		if ( f.order < 0.35 ) {

			a.armL = GESTURE.fold[ 0 ].slice(); a.armR = GESTURE.fold[ 1 ].slice();
			a.propL = 0; a.propR = 0;

		} else if ( f.order < 0.5 ) {

			a.armR = GESTURE.text[ 1 ].slice(); a.propR = PROP.phone;
			a.headPitch = 0.45;

		}

		const idle = ( t * 0.09 + f.order ) % 1;
		a.kneeL = idle < 0.5 ? 0.12 : 0; a.kneeR = idle < 0.5 ? 0 : 0.12;
		a.roll = idle < 0.5 ? 0.02 : - 0.02;
		a.lean = 0; a.twist = 0; a.drop = 0;
		const chat = f.order > 0.7 ? Math.max( 0, Math.sin( t * 0.2 + f.order * 13 ) ) : 0;
		a.headYaw = lerp( a.headYaw, chat * 2.2 - 1.1 * chat * chat, Math.min( 1, dt * 2 ) );
		a.mouth = chat > 0.5 ? Math.max( 0, 0.3 * Math.sin( t * 7 + f.order * 9 ) ) : 0;
		a.blink = ( t * 0.35 + f.order * 3 ) % 1 < 0.04 ? 1 : 0;

	}

	// ---- the line and the counter
	_inLine( f, dt, ns ) {

		const S = f.stand, a = f.p.pose, t = this.time;
		let x = 0, z;
		if ( f.mode === 'queue' ) {

			const k = Math.min( S.line.indexOf( f ), S.slots.length - 1 );
			[ x, z ] = S.slots[ k ];
			x += Math.sin( f.order * 9 ) * 0.12;

		} else {

			x = S.cart ? 0 : f.slot ? 1.42 : - 1.42;
			z = S.cart ? 0.75 : 0.64;

		}

		const [ gs, gd ] = S.at( x, z );
		const ds = gs - f.s, dd = gd - f.d, dist = Math.hypot( ds, dd );
		const v = dist > 0.08 ? Math.min( 0.9, dist * 1.6 ) : 0;
		this._move( f, v ? ds / dist * v : 0, v ? dd / dist * v : 0, dt, dist < 0.5 ? S.face : null );
		a.walk = lerp( a.walk, Math.min( 1, Math.hypot( f.vs, f.vd ) / 0.6 ), Math.min( 1, dt * 5 ) );
		a.phase = ( a.phase + dt * Math.hypot( f.vs, f.vd ) / 1.1 * TAU ) % TAU;
		a.lean = 0; a.twist = 0; a.drop = 0;
		a.blink = ( t * 0.33 + f.order * 3 ) % 1 < 0.04 ? 1 : 0;
		if ( f.mode === 'queue' ) {

			// waiting: the weight on one leg, reading the menu board, the phone, the hands in the pockets
			this._hands( f, a, ns );
			const idle = ( t * 0.07 + f.order ) % 1;
			a.hipL = 0; a.kneeL = idle < 0.5 ? 0.12 : 0; a.hipR = 0; a.kneeR = idle < 0.5 ? 0 : 0.12;
			a.roll = idle < 0.5 ? 0.02 : - 0.02;
			a.headPitch = lerp( a.headPitch, f.order < 0.5 ? 0.25 : - 0.05, Math.min( 1, dt * 2 ) );
			a.headYaw = lerp( a.headYaw, Math.sin( t * 0.2 + f.order * 30 ) * 0.4, Math.min( 1, dt * 2 ) );
			this._react( f, a, dt, ns );
			return;

		}

		// at the counter: ordering (pointing at the board), paying, waiting, taking it
		a.hipL = a.hipR = a.kneeL = a.kneeR = 0; a.roll = 0;
		a.propL = 0; a.propR = 0; a.mouth = 0;
		a.armL = [ 0.05, 0.08, 0, 0.2 ]; a.armR = [ 0.05, 0.08, 0, 0.2 ];
		a.headYaw = lerp( a.headYaw, 0, Math.min( 1, dt * 3 ) );
		const st = f.svc;
		if ( st === 'order' ) {

			a.mouth = Math.max( 0, 0.45 * Math.sin( t * 8 + f.order * 9 ) );
			a.headPitch = lerp( a.headPitch, 0.35, Math.min( 1, dt * 3 ) );
			if ( ( t + f.order * 5 ) % 3 < 1.4 ) a.armR = lerpArm( [ 0.05, 0.08, 0, 0.2 ], GESTURE.point[ 1 ], 1 );

		} else if ( st === 'pay' ) {

			a.armR = GESTURE.reach[ 1 ].slice();
			a.propR = PROP.money;
			a.headPitch = lerp( a.headPitch, - 0.15, Math.min( 1, dt * 3 ) );

		} else if ( st === 'wait' ) {

			// hands on the counter, or in the pockets; looking into the kitchen, at the TV
			a.headPitch = lerp( a.headPitch, 0.05, Math.min( 1, dt * 2 ) );
			a.headYaw = Math.sin( t * 0.3 + f.order * 20 ) * 0.5;
			if ( f.order > 0.5 ) {

				a.armL = GESTURE.pockets[ 0 ].slice(); a.propL = PROP.pocket;
				a.armR = GESTURE.pockets[ 1 ].slice(); a.propR = PROP.pocket;

			} else {

				a.armL = [ 0.55, 0.1, 0.25, 0.95 ]; a.armR = [ 0.55, 0.1, 0.25, 0.95 ];

			}

		} else if ( st === 'take' ) {

			a.armR = GESTURE.reach[ 1 ].slice();
			a.propR = f.svcT > 1 ? CARRY_PROP[ f.buy ] || 0 : 0;
			if ( f.buy === 'tray' && f.svcT > 1 ) {

				a.armL = GESTURE.reachL[ 0 ].slice();

			}

		}

	}

	// a stand's service: the front of the line goes to a free register; order, pay, wait while the staff
	// fetch it, the food handed over, the change, off they go
	_serve( S, dt, ns ) {

		const r = this.r;
		for ( let i = 0; i < S.counter.length; i ++ ) {

			if ( S.counter[ i ] || ! S.line.length ) continue;
			const f = S.line[ 0 ], [ fs, fd ] = S.at( ...S.slots[ 0 ] );
			if ( Math.hypot( fs - f.s, fd - f.d ) > 0.9 ) continue;
			S.line.shift();
			S.counter[ i ] = f;
			f.mode = 'counter';
			f.slot = i;
			f.svc = 'walkup';
			f.svcT = 0;
			f.buy = pick( r, MENU[ S.brand ] || { soda: 1 } );
			if ( S.staff[ i ] ) {

				S.staff[ i ].state = 'listen';
				S.staff[ i ].t = 0;

			}

		}

		for ( let i = 0; i < S.counter.length; i ++ ) {

			const f = S.counter[ i ], staff = S.staff[ i ];
			if ( ! f ) continue;
			f.svcT += dt;
			const T = f.svcT;
			const next = ( st, s2 ) => {

				f.svc = st; f.svcT = 0;
				if ( staff ) {

					staff.state = s2; staff.t = 0;

				}

			};

			if ( f.svc === 'walkup' && T > 1.4 ) next( 'order', 'listen' );
			else if ( f.svc === 'order' && T > 4 + f.order * 3 ) next( 'pay', 'register' );
			else if ( f.svc === 'pay' && T > 2.5 ) next( 'wait', 'fetch' );
			else if ( f.svc === 'wait' && T > ( S.cart ? 3 : S.brand === 'brewerytown' ? 7 : 11 ) + f.order * ( S.cart ? 2 : 6 ) ) {

				next( 'take', 'give' );
				if ( staff ) staff.item = CARRY_PROP[ f.buy ] || PROP.sandwich;

			} else if ( f.svc === 'take' && T > 2.2 ) {

				// the food's theirs: off back to the seats with it
				f.carry = f.buy;
				S.counter[ i ] = null;
				if ( staff ) {

					staff.state = 'idle'; staff.t = 0; staff.item = 0;

				}

				this._leave( f );

			}

		}

		// the line's length follows the night: people give up and leave when it's too long for the
		// inning they've got
		const want = Math.round( S.base * ns.busy * 4 );
		if ( S.line.length > want + 3 ) {

			const f = S.line.pop();
			this._leave( f );

		}

	}

	// the staff: listening, ringing it up, turned to the kitchen to fetch it, handing it over; idle,
	// leaning on the counter, watching the TV
	_staffPose( a, dt, ns ) {

		const p = a.p, pose = p.pose, t = this.time;
		a.t += dt;
		const at = a.stand.at( a.x, a.z ?? - 0.62 );
		const W = this.W.at( at[ 0 ], at[ 1 ] );
		let back = 0;
		let yaw = a.stand.staffFace;
		pose.propL = 0; pose.propR = 0; pose.mouth = 0;
		pose.armL = [ 0.05, 0.08, 0, 0.25 ]; pose.armR = [ 0.05, 0.08, 0, 0.25 ];
		pose.headPitch = 0; pose.headYaw = 0; pose.lean = 0; pose.twist = 0; pose.walk = 0;
		if ( a.state === 'idle' && a.seller ) {

			// "Programs! Get your World Series programs!": one held up high, turning to the passers-by
			pose.armR = GESTURE.holdUp[ 1 ].slice();
			pose.propR = PROP.program;
			pose.armL = [ 0.35, 0.1, 0.35, 1.3 ];
			pose.propL = PROP.programs;
			pose.headYaw = Math.sin( t * 0.4 + a.order * 10 ) * 0.7;
			pose.mouth = Math.max( 0, Math.sin( t * 1.1 + a.order ) ) * Math.max( 0, 0.5 * Math.sin( t * 9 ) );
			yaw += Math.sin( t * 0.4 + a.order * 10 ) * 0.4;

		} else if ( a.state === 'idle' && a.stand.cart ) {

			// arms folded against the cold, stamping, blowing into the hands now and then
			const blow = Math.max( 0, Math.sin( t * 0.3 + a.order * 7 ) - 0.7 ) / 0.3;
			pose.armL = lerpArm( GESTURE.fold[ 0 ], GESTURE.blow[ 0 ], blow );
			pose.armR = lerpArm( GESTURE.fold[ 1 ], GESTURE.blow[ 1 ], blow );
			pose.mouth = blow * 0.5;
			pose.headYaw = Math.sin( t * 0.2 + a.order * 10 ) * 0.5;

		} else if ( a.state === 'idle' ) {

			// both hands on the counter, a look up at the TV, a word with the other one
			pose.armL = [ 0.6, 0.12, 0.2, 0.9 ]; pose.armR = [ 0.6, 0.12, 0.2, 0.9 ];
			pose.lean = 0.12;
			pose.headYaw = Math.sin( t * 0.25 + a.order * 10 ) * 0.6;
			pose.headPitch = 0.1;

		} else if ( a.state === 'listen' ) {

			pose.headPitch = 0.05;
			pose.mouth = Math.max( 0, 0.2 * Math.sin( t * 6 + a.order * 7 ) ) * ( a.t < 1 ? 1 : 0 );
			pose.armL = [ 0.35, 0.1, 0.35, 1.3 ]; pose.armR = [ 0.3, 0.1, 0.3, 1.2 ];

		} else if ( a.state === 'register' ) {

			// ringing it up: the right hand on the register's keys, taking the money
			pose.headPitch = 0.35;
			pose.armR = GESTURE.reach[ 1 ].map( ( v, k ) => lerp( v, [ 0.7, 0.2, 0.1, 1.1 ][ k ], a.t < 1.2 ? 0 : 1 ) );
			pose.armR[ 3 ] += 0.1 * Math.sin( t * 12 ) * ( a.t > 1.2 ? 1 : 0 );
			pose.propR = a.t < 1.2 ? PROP.money : 0;

		} else if ( a.state === 'fetch' ) {

			// back to the warmer or the taps and back again
			const k = clamp( Math.min( a.t / 1.2, ( 7 - a.t ) / 1.2 ), 0, 1 );
			yaw += Math.PI * k;
			back = 0.7 * k;
			pose.walk = k > 0.05 && k < 0.95 ? 0.6 : 0;
			pose.phase = ( pose.phase + dt * 5 ) % TAU;
			pose.armR = [ 0.4, 0.1, 0.1, 1.1 ];

		} else if ( a.state === 'give' ) {

			pose.armR = GESTURE.reach[ 1 ].slice();
			pose.propR = a.t < 1.1 ? a.item : 0;
			if ( a.item === PROP.tray && a.t < 1.1 ) pose.armL = GESTURE.reachL[ 0 ].slice();
			pose.mouth = a.t > 1.1 ? Math.max( 0, 0.3 * Math.sin( t * 7 ) ) : 0;

		}

		// shifted back toward the kitchen when fetching
		const n = a.stand.n;
		p.x = W.x - n[ 0 ] * back; p.z = W.z - n[ 1 ] * back; p.y = STREET;
		p.yaw = turn( p.yaw, yaw, Math.min( 1, dt * 5 ) );
		pose.blink = ( t * 0.3 + a.order * 3 ) % 1 < 0.04 ? 1 : 0;
		a.s = at[ 0 ]; a.d = at[ 1 ];

	}

}
