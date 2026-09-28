import { PROP, TOP, COLOR, HAT, CHEST, BACK, restPose, seat } from '../Cast.js';
import { GESTURE, armIK, railArms, dress, sizeOf, rng, pick } from '../Concourse3BKit.js';
import { SEATED } from '../home/Poses.js';
import { cadence, due } from '../Tempo.js';
import { named } from './Named.js';
import { STREET } from './Frame.js';

// The people of Harry the K's (LeftField.js): the bartenders upstairs and down, the servers with their
// trays, the host at the stand, the diners at the tables and the regulars on the stools, and the fans
// standing at the patio's rail and along the back of the porch watching the game. Each has a place (a
// stool, a chair, a spot at a rail), a way of passing the innings (a beer on the knee and a sip now and
// then, the wings, the TVs, a word with the one beside), and the game to answer: up for a big pitch, arms
// up for a Phillies run, the hands on the head for a Rays one, the towels on the 29th, and at the last
// out everybody up, jumping, hugging whoever's next to them.
//
//   const people = new HarrysPeople( place, cast, harrys, frame )
//   people.update( dt, N, cam )     N: nightState(), the crowd's mood in N.mood; cam: the camera (field frame)
//
// Invented (CAST.md, wave 3, H): see the named ones in _named().

const TAU = Math.PI * 2;
const wrap = ( a ) => Math.atan2( Math.sin( a ), Math.cos( a ) );
const lerp = ( a, b, t ) => a + ( b - a ) * t;
const clamp = ( x, a, b ) => Math.max( a, Math.min( b, x ) );
const fract = ( x ) => x - Math.floor( x );
const hash = ( n ) => fract( Math.sin( n * 12.9898 + 78.233 ) * 43758.5453 );
const REST = [ 0.05, 0.06, 0, 0.12 ];
// the hands held out to a heater's glow
const WARMUP = [ armIK( - 1, [ - 0.12, 1.25, - 0.42 ] ), armIK( 1, [ 0.12, 1.25, - 0.42 ] ) ];
// a bartender: pulling a tap (the right hand out and down), setting a glass down, wiping the bar
const TAP = [ null, armIK( 1, [ 0.15, 1.2, - 0.42 ] ) ];
const SET = [ null, armIK( 1, [ 0.05, 1.12, - 0.55 ] ) ];
const WIPE = [ armIK( - 1, [ - 0.1, 1.08, - 0.5 ] ), null ];
// seated at a bar or a table: the forearms on it, a glass in the right hand on it
const ON_BAR = [ armIK( - 1, [ - 0.16, 1.02, - 0.42 ] ), armIK( 1, [ 0.14, 1.03, - 0.44 ] ) ];
const HUG = [ armIK( - 1, [ - 0.2, 1.42, - 0.25 ] ), armIK( 1, [ 0.42, 1.44, - 0.1 ] ) ];

export class HarrysPeople {

	constructor( place, cast, H, F ) {

		this.place = place;
		this.cast = cast;
		this.H = H;
		this.F = F;
		this.r = rng( 2008102729 );
		this.list = [];
		this.time = 0;
		this.frame = 0;
		this._populate();

	}

	// someone new at a spot: role, the spot (local x, z; field y), where they face (local yaw: 0 home),
	// the look (dress()'s, or given), and what they're like
	add( role, spot, face, o = {} ) {

		const r = this.r;
		const look = o.look || dress( r, { age: o.age, female: o.female } );
		const indoor = o.indoor ?? false, covered = o.covered ?? false;
		// the 27th: those out in the rain in ponchos (clear mostly), hoods up; inside, dry; under the porch
		// dry, a few still in the poncho they came down from the seats in
		const wet = { ...look, dry: indoor || covered };
		if ( ! indoor && ! o.look && r() < ( covered ? 0.18 : 0.55 ) ) wet.poncho = Number( pick( r, { 1: 60, 2: 25, 3: 10, 6: 5 } ) );
		if ( ! indoor && ! o.look && look.hat === HAT.none && r() < 0.4 ) wet.hat = look.top === TOP.hoodie ? HAT.hood : HAT.knitRed;
		const dry = { ...look, dry: indoor, gloves: look.gloves || ( ! indoor && r() < 0.35 ) };
		const p = this.cast.add( wet );
		if ( ! p ) return null;
		if ( o.path ) {

			// a round the server walks: its length, and where along it they start
			let L = 0;
			for ( let i = 0; i < o.path.length; i ++ ) L += Math.hypot( o.path[ ( i + 1 ) % o.path.length ].x - o.path[ i ].x, o.path[ ( i + 1 ) % o.path.length ].z - o.path[ i ].z );
			o.pathLen = L;

		}
		const [ fx, fz ] = this.F.field( spot.x, spot.z );
		p.x = fx; p.z = fz; p.y = spot.y;
		p.yaw = this.F.yaw( face );
		p.scale = o.scale ?? sizeOf( look, r );
		p.pose = restPose();
		const m = {
			role, p, spot, face, looks: { 27: wet, 29: dry }, night: 27, seed: r(), name: o.name || null,
			sit: o.sit ?? 0, // the seat's height (0: standing)
			up: 0, // 0 seated .. 1 up out of the seat
			arms: [ REST.slice(), REST.slice() ], head: [ 0, 0.1 ], drink: o.drink ?? ( r() < 0.75 ? PROP.beer : r() < 0.5 ? PROP.soda : PROP.cocoa ),
			food: o.food ?? ( r() < 0.35 ? PROP.sandwich : 0 ),
			tv: o.tv ?? null, rail: o.rail ?? false, heater: o.heater ?? null, acc: 0,
			tr: { stand: 0.15 + 0.7 * r(), cheer: 0.15 + 0.7 * r(), clap: 0.2 + 0.6 * r(), towel: 0.2 + 0.7 * r() },
			towel: r() < 0.6, camera: r() < 0.15, script: o.script || null, x: spot.x, z: spot.z, jump: r() < 0.6,
			path: o.path || null, pathLen: o.pathLen || 0, speed: o.speed || 1, u: r(),
		};
		p.pose.propR = m.drink;
		this.list.push( m );
		return m;

	}

	_populate() {

		const S = this.H.spots, r = this.r;
		// the nearest TV to a spot (the bar's regulars watch them)
		const tvs = this.H.tvs;
		const tvFor = ( x, z, y ) => {

			let best = null, bd = 1e9;
			for ( const t of tvs ) {

				if ( Math.abs( t.y - y ) > 4 ) continue;
				const d = ( t.x - x ) ** 2 + ( t.z - z ) ** 2;
				if ( d < bd ) {

					bd = d;
					best = t;

				}

			}

			return best && ( () => {

				const [ fx, fz ] = this.F.field( best.x, best.z );
				return [ fx, best.y, fz ];

			} )();

		};
		// -- the staff: black polos, the kitchen in whites
		const staff = ( o = {} ) => Object.assign( dress( r, { age: 0 } ), { top: TOP.polo, color: COLOR.black, sleeves: COLOR.black, chest: CHEST.none, back: 0, hat: HAT.none, poncho: 0, scarf: 0, gloves: false, pants: 3, shoes: 1 }, o );
		for ( const b of S.bartendUp ) this.add( 'bartender', b, Math.PI - Math.PI, { look: staff(), indoor: true } );
		for ( const b of S.bartendDn ) this.add( 'bartender', b, 0, { look: staff(), indoor: true } );
		// (the bartenders face the bar's front: upstairs that's -z, toward the room; downstairs -z too)
		// -- upstairs: the stools at the bar (seven in ten taken), the high-tops, the four-tops
		for ( const s of S.barUp ) if ( r() < 0.7 ) this.add( 'sit', s, Math.PI, { sit: s.seat, indoor: true, tv: tvFor( s.x, s.z + 2, s.y + 2.5 ) } );
		for ( const t of S.tablesUp ) {

			if ( t.n === 2 ) {

				for ( const dx of [ - 0.55, 0.55 ] ) if ( r() < 0.65 ) this.add( 'sit', { x: t.x + dx, z: t.z, y: t.y }, 0, { sit: 0.76, indoor: true } );

			} else if ( r() < 0.8 ) {

				const n = 2 + Math.floor( r() * 3 );
				// (each faces the table: a chair on its home-plate side faces away from home)
				[ [ 0, 0.62, 0 ], [ 0, - 0.62, Math.PI ], [ - 0.62, 0, - Math.PI / 2 ], [ 0.62, 0, Math.PI / 2 ] ].slice( 0, n ).forEach( ( [ dx, dz, a ] ) => {

					this.add( 'sit', { x: t.x + dx, z: t.z + dz, y: t.y }, a, { sit: 0.45, indoor: true, food: r() < 0.6 ? PROP.sandwich : 0 } );

				} );

			}

		}

		// -- the patio: along the rail, and at its high-tops; the walkway behind the porch
		for ( const s of S.patioRail ) if ( r() < 0.62 ) this.add( 'stand', s, 0, { rail: true, heater: this._heater( s ) } );
		// (the rail's high-tops: two white stools behind each, facing the field)
		for ( const t of S.patio ) for ( const dx of [ - 0.35, 0.35 ] ) if ( r() < 0.7 ) this.add( 'sit', { x: t.x + dx, z: t.z + 0.55, y: t.y }, 0, { sit: 0.74, heater: this._heater( t ) } );
		for ( const s of S.porchBack ) if ( r() < 0.5 ) this.add( 'stand', s, 0, { rail: true } );
		// -- downstairs: at the bar's front, the tables, the counter over the 140s
		for ( const s of S.barDn ) if ( r() < 0.45 ) this.add( 'stand', s, Math.PI, { covered: true, tv: tvFor( s.x, s.z, s.y + 2 ) } );
		for ( const t of S.tablesDn ) {

			if ( r() > 0.58 ) continue;
			const n = 2 + Math.floor( r() * 2.4 );
			// the chairs facing the field first (they came to see the game)
			[ [ 0, 0.62, 0 ], [ - 0.62, 0, - Math.PI / 2 ], [ 0.62, 0, Math.PI / 2 ], [ 0, - 0.62, Math.PI ] ].slice( 0, n ).forEach( ( [ dx, dz, a ] ) => {

				this.add( 'sit', { x: t.x + dx, z: t.z + dz, y: t.y }, a, { sit: 0.45, covered: true, food: r() < 0.7 ? PROP.sandwich : 0 } );

			} );

		}

		for ( const s of S.counterDn ) if ( r() < 0.6 ) this.add( 'sit', s, 0, { sit: s.seat, covered: true } );
		// the host at the stand; the servers, trays at the shoulder, round the tables and back to the bar
		const H = this.H;
		this.host = this.add( 'host', S.host, - Math.PI / 2, { look: staff( { female: true, hairStyle: 1, facial: 0 } ) } );
		const loop = ( pts ) => pts.map( ( [ x, z ] ) => ( { x, z } ) );
		const bz = H.FZ - 1.2;
		this.servers = [
			this.add( 'server', { x: - 8, z: bz, y: H.DN.y0 }, 0, { look: staff( { female: true, hairStyle: 2, facial: 0 } ), path: loop( [ [ - 8, bz ], [ - 11, bz - 3 ], [ - 11, bz - 7.6 ], [ - 6, bz - 7.6 ], [ - 3.5, bz - 3.4 ], [ - 6, bz - 1 ] ] ), speed: 1.1 } ),
			this.add( 'server', { x: 4, z: bz, y: H.DN.y0 }, 0, { look: staff(), path: loop( [ [ 4, bz ], [ 1.5, bz - 5.6 ], [ 6.5, bz - 10.2 ], [ 9.5, bz - 5.6 ], [ 7, bz - 1 ] ] ), speed: 1.2 } ),
			this.add( 'server', { x: H.doorsUp[ 1 ], z: H.FZ - 1.6, y: H.PY }, 0, { look: staff( { female: true, hairStyle: 1, facial: 0 } ), path: loop( [ [ H.doorsUp[ 1 ], H.FZ + 0.8 ], [ H.doorsUp[ 1 ], H.FZ - 1.4 ], [ 2, H.FZ - 1.4 ], [ - 8, H.FZ - 1.4 ], [ H.doorsUp[ 0 ], H.FZ - 1.4 ], [ H.doorsUp[ 0 ], H.FZ + 0.8 ], [ 2, H.FZ + 2.5 ] ] ), speed: 1.0 } ),
		];
		this._named();

	}

	// the corner's portables and the plaza (Plaza.js): a vendor at each cart and a short line at its front,
	// and people crossing the corner: in from the Left Field Gate, round to the Alley, down to the concourse
	plaza( carts ) {

		const r = this.r;
		const staff = () => Object.assign( dress( r, { age: 0 } ), { top: TOP.staff, color: COLOR.red, sleeves: COLOR.black, chest: CHEST.staff, back: 0, hat: r() < 0.6 ? HAT.capBlack : HAT.visor, poncho: 0, scarf: 0, pants: 3, shoes: 1 } );
		for ( const c of carts ) {

			this.add( 'vendor', c.vendor, c.face, { look: staff(), covered: true } );
			const n = 2 + Math.floor( r() * 4 );
			for ( let k = 0; k < n; k ++ ) {

				const d = 1.0 + k * 0.75, side = Math.sin( k * 2.3 ) * 0.2;
				const x = c.x + c.front[ 0 ] * d - c.front[ 1 ] * side, z = c.z + c.front[ 1 ] * d + c.front[ 0 ] * side;
				const m = this.add( 'stand', { x, z, y: c.vendor.y }, c.face + Math.PI, { covered: c.z < 0 } );
				if ( m ) {

					m.line = k;
					m.drink = 0;
					m.food = 0;

				}

			}

		}

		// the walkers' rounds (local x, z): gate to the Alley's end, the concourse's corner to the plaza
		const loops = [
			[ [ 4.5, 30 ], [ 2, 16 ], [ - 14, 10 ], [ - 21, 3 ], [ - 25, - 6 ], [ - 30, - 9 ], [ - 22, 2 ], [ - 8, 12 ], [ 3, 22 ] ],
			[ [ 25, - 19 ], [ 21, - 9 ], [ 17, 3 ], [ 12, 12 ], [ 6, 24 ], [ 14, 14 ], [ 20, 0 ], [ 24, - 12 ] ],
			[ [ 27, - 20 ], [ 16, - 17.5 ], [ 12, - 16.8 ], [ 18, - 18 ] ],
		];
		for ( let k = 0; k < 14; k ++ ) {

			const L = loops[ k % loops.length ].map( ( [ x, z ] ) => ( { x, z } ) );
			const m = this.add( 'walker', { x: L[ 0 ].x, z: L[ 0 ].z, y: STREET }, 0, { path: L, speed: 1.1 + 0.3 * r(), covered: false } );
			if ( m ) {

				m.u = r();
				m.carry = r() < 0.4 ? PROP.beer : r() < 0.3 ? PROP.tray : 0;

			}

		}

	}

	// a cart's vendor: taking the order (a word, a nod), turned round to the warmer, handing it over, the change
	_vendor( m, N, dt ) {

		const p = m.p, a = p.pose, t = this.time + m.seed * 30, k = 1 - Math.exp( - dt * 5 );
		const w = fract( t / 8 );
		const back = w > 0.35 && w < 0.6;
		const g = back ? null : w > 0.6 && w < 0.8 ? SET : w > 0.8 ? GESTURE.reach : GESTURE.fold;
		const A = m.arms;
		for ( let q = 0; q < 2; q ++ ) {

			const T = ( g && g[ q ] ) || REST, C = A[ q ];
			for ( let j = 0; j < 4; j ++ ) C[ j ] += ( T[ j ] - C[ j ] ) * k;

		}

		a.armL = A[ 0 ]; a.armR = A[ 1 ];
		a.propR = w > 0.6 && w < 0.8 ? PROP.tray : w > 0.8 ? PROP.money : 0;
		a.propL = 0;
		p.yaw = this.F.yaw( m.face + ( back ? Math.PI : 0 ) );
		a.mouth = w < 0.3 ? Math.max( 0, 0.35 * Math.sin( t * 7 ) ) : 0;
		a.headPitch = 0.05;
		a.blink = fract( t * 0.33 ) < 0.035 ? 1 : 0;

	}

	// crossing the corner: a round at walking pace, the arms swinging (a beer or a tray in hand for some)
	_walker( m, N, dt ) {

		const p = m.p, a = p.pose, P = m.path, k = 1 - Math.exp( - dt * 6 );
		const L = m.pathLen, u = fract( ( this.time * m.speed ) / L + m.u );
		let s = u * L, i = 0, acc = 0, seg = 0;
		for ( ; i < P.length; i ++ ) {

			const A = P[ i ], B = P[ ( i + 1 ) % P.length ];
			seg = Math.hypot( B.x - A.x, B.z - A.z );
			if ( acc + seg >= s ) break;
			acc += seg;

		}

		const A = P[ i % P.length ], B = P[ ( i + 1 ) % P.length ];
		const f = seg ? ( s - acc ) / seg : 0;
		const [ fx, fz ] = this.F.field( lerp( A.x, B.x, f ), lerp( A.z, B.z, f ) );
		p.x = fx; p.z = fz;
		const want = this.F.yaw( Math.atan2( - ( B.x - A.x ), - ( B.z - A.z ) ) );
		p.yaw += wrap( want - p.yaw ) * Math.min( 1, dt * 6 );
		a.walk += ( 1 - a.walk ) * k;
		a.phase = ( a.phase + dt * m.speed / 1.15 * TAU ) % TAU;
		const sw = Math.sin( a.phase ) * 0.3 * a.walk;
		const C = m.carry;
		const g = C === PROP.tray ? GESTURE.tray : C ? GESTURE.carry : null;
		const A2 = m.arms;
		for ( let q = 0; q < 2; q ++ ) {

			const T = ( g && g[ q ] ) || [ q ? - sw : sw, 0.07, 0, 0.18 ], Cc = A2[ q ];
			for ( let j = 0; j < 4; j ++ ) Cc[ j ] += ( T[ j ] - Cc[ j ] ) * Math.min( 1, k * 2 );

		}

		a.armL = A2[ 0 ]; a.armR = A2[ 1 ];
		a.propR = C; a.propL = 0;
		a.lean = 0.03; a.drop = 0; a.hipL = a.hipR = a.kneeL = a.kneeR = 0;
		a.headYaw = 0.3 * Math.sin( this.time * 0.4 + m.seed * 20 );
		a.blink = fract( this.time * 0.33 + m.seed * 7 ) < 0.035 ? 1 : 0;

	}

	// the patio heater nearest a spot, if it's close enough to feel
	_heater( s ) {

		let best = null, bd = 9;
		for ( const h of this.H.heaters ) {

			const d = ( h.x - s.x ) ** 2 + ( h.z - s.z ) ** 2;
			if ( d < bd ) {

				bd = d;
				best = h;

			}

		}

		return best;

	}

	// the people with names (CAST.md, H): Named.js
	_named() {

		named( this );

	}

	update( dt, N, cam ) {

		this.time += dt;
		const fr = ++ this.frame;
		const M = N.mood || { stand: 0, cheer: 0, clap: 0, jump: 0, towel: 0 };
		const night = N.first ? 27 : 29;
		for ( const m of this.list ) {

			m.acc += dt;
			const p = m.p;
			if ( ! this.catchUp ) {

				const n = cadence( p, cam ? ( p.x - cam[ 0 ] ) ** 2 + ( p.z - cam[ 1 ] ) ** 2 : 0 );
				if ( ! due( p, n, fr ) ) continue;

			}

			const mdt = m.acc;
			m.acc = 0;
			if ( m.night !== night ) {

				m.night = night;
				this.cast.setLook( p, m.looks[ night ] );

			}

			if ( m.script && m.script( m, N, mdt, this ) ) continue;
			if ( m.role === 'bartender' ) this._bartender( m, N, mdt );
			else if ( m.role === 'server' ) this._server( m, N, mdt );
			else if ( m.role === 'host' ) this._host( m, N, mdt );
			else if ( m.role === 'vendor' ) this._vendor( m, N, mdt );
			else if ( m.role === 'walker' ) this._walker( m, N, mdt );
			else this._fan( m, N, M, mdt );
			if ( m.after ) m.after( m, N, mdt, this );

		}

	}

	// a fan at a spot: seated (m.sit > 0) or standing, idling between pitches, answering the game
	_fan( m, N, M, dt ) {

		const p = m.p, a = p.pose, t = this.time + m.seed * 50, sd = m.seed;
		const k = 1 - Math.exp( - dt * 7 );
		// up or down: the crowd's mood against their own threshold; everyone up at the last out
		let upT = M.stand > m.tr.stand ? 1 : 0;
		if ( N.celebrate ) upT = 1;
		if ( ! m.sit ) upT = 1;
		m.up += clamp( upT - m.up, - dt * 1.2, dt * 1.6 );
		const up = m.up * m.up * ( 3 - 2 * m.up );
		// the idle: a new one every 8-20 s (a function of the time, so a jump in the replay agrees)
		const per = 8 + 12 * sd, slot = Math.floor( ( t + sd * 100 ) / per ), h = hash( slot * 1.37 + sd * 57 );
		let g = null, L = 0, R = 0, mouth = 0, talk = false;
		const seated = up < 0.5;
		if ( m.rail && ! seated ) {

			// leaning on the rail, the forearms on it, a beer in hand now and then (the arms solved once)
			g = m.railG ||= railArms( p.scale, 0.2 + 0.15 * sd );
			R = h < 0.5 ? m.drink : 0;

		} else if ( h < 0.35 ) {

			g = seated ? SEATED.cup : GESTURE.carry;
			R = m.drink;

		} else if ( h < 0.5 && m.food ) {

			g = seated ? SEATED.eat : GESTURE.carry;
			R = m.food;
			if ( fract( t / 5 + sd ) > 0.4 ) g = seated ? SEATED.cup : GESTURE.carry;

		} else if ( h < 0.62 ) {

			g = seated ? SEATED.lap : GESTURE.pockets;
			talk = true;

		} else if ( h < 0.72 ) {

			g = seated ? SEATED.text : GESTURE.text;
			R = PROP.phone;

		} else if ( h < 0.84 ) {

			g = seated ? ON_BAR : GESTURE.fold;

		} else {

			g = seated ? SEATED.cup : GESTURE.pockets;
			R = seated ? m.drink : 0;

		}

		// a sip now and then
		if ( R && R === m.drink && fract( t / ( 10 + 7 * sd ) + sd ) < 0.1 ) g = seated ? SEATED.sip : GESTURE.sip;
		// in a line: the money out at the front, the phone, the arms folded, a look at the menu board
		if ( m.line !== undefined ) {

			const w = fract( t / 8 );
			g = m.line === 0 && w > 0.6 ? GESTURE.reach : h < 0.4 ? GESTURE.fold : h < 0.6 ? GESTURE.text : GESTURE.pockets;
			R = m.line === 0 && w > 0.6 ? PROP.money : h >= 0.4 && h < 0.6 ? PROP.phone : 0;
			L = 0;

		}
		// the cold: at the patio heaters the hands held out to it; on the 29th hands in the pockets more
		if ( m.heater && ! N.celebrate && fract( t / 23 + sd * 3 ) < ( N.first ? 0.3 : 0.5 ) ) {

			g = WARMUP;
			R = 0; L = 0;

		}

		// ---- the game: clapping, the towels (the 29th), arms up for a run, the hands on the head
		if ( M.clap > 0.25 + m.tr.clap * 0.6 ) {

			g = fract( t * 3.3 + sd ) < 0.5 ? GESTURE.clap : GESTURE.clapOpen;
			L = 0; R = 0;

		}

		let towel = false;
		if ( m.towel && ! N.first && M.towel > m.tr.towel ) {

			towel = true;
			R = PROP.towel; L = 0;

		}

		if ( M.cheer > m.tr.cheer || ( N.celebrate && N.celebrateT > 0.4 + 2 * m.tr.cheer ) ) {

			g = towel ? null : GESTURE.cheer;
			if ( ! towel ) {

				L = 0; R = 0;

			}

			mouth = 0.8;

		}

		const R0 = N.result;
		if ( R0 && R0.away > 0 && R0.t < 5 && ! N.celebrate ) {

			g = GESTURE.head;
			L = 0; R = 0;

		}

		// the camera up for the last out
		if ( m.camera && N.celebrate && N.celebrateT > 1 && N.celebrateT < 40 ) {

			g = GESTURE.photoHigh;
			R = PROP.camera; L = 0; towel = false;

		}

		// a hug for whoever's next to them, a while after the last out
		if ( N.celebrate && N.celebrateT > 4 + 6 * sd && N.celebrateT < 10 + 6 * sd && sd < 0.45 ) {

			g = HUG;
			L = 0; R = 0;

		}

		if ( towel && ! ( g && g !== GESTURE.cheer ) ) {

			// the towel twirled over the head
			const w = t * ( 8 + 5 * hash( sd * 37 ) ) + sd * 20;
			g = [ null, [ 2.55 + 0.2 * Math.sin( w ), 0.45 + 0.25 * Math.cos( w ), 0.1, 0.35 + 0.2 * Math.sin( w + 1 ) ] ];

		}

		// the arms eased to it; a pump when they're up
		const A = m.arms;
		for ( let s = 0; s < 2; s ++ ) {

			const T = ( g && g[ s ] ) || REST, C = A[ s ];
			const pump = g === GESTURE.cheer ? Math.sin( t * 6 + sd * 30 + s ) * 0.12 : 0;
			for ( let j = 0; j < 4; j ++ ) C[ j ] += ( T[ j ] + ( j === 0 ? pump : 0 ) - C[ j ] ) * k;

		}

		a.armL = A[ 0 ];
		a.armR = A[ 1 ];
		a.propL = L;
		a.propR = R;
		// ---- the head: the ball in play, else the plate; the regulars at the bar the TV; a word with the next one
		let tx = 0, ty = 1.2, tz = 0;
		if ( N.ball ) {

			tx = N.ball[ 0 ]; ty = N.ball[ 1 ]; tz = N.ball[ 2 ];

		}

		if ( m.tv && ( ! N.ball || sd < 0.7 ) ) {

			tx = m.tv[ 0 ]; ty = m.tv[ 1 ]; tz = m.tv[ 2 ];

		}

		// the Phanatic in front of them (A's: taunting in left before the 29th's resumption, his laps): every
		// head on him, the phones and cameras up, both arms waving at him
		const ph = N.phan;
		if ( ph && ! N.celebrate && ( ph.x - p.x ) ** 2 + ( ph.z - p.z ) ** 2 < 70 * 70 ) {

			tx = ph.x; ty = ( ph.y ?? 0 ) + 1.2; tz = ph.z;
			if ( sd < 0.2 ) {

				A[ 1 ].splice( 0, 4, ...GESTURE.photo[ 1 ] );
				A[ 0 ].splice( 0, 4, ...GESTURE.photo[ 0 ] );
				a.propR = PROP.camera; a.propL = 0;

			} else if ( sd < 0.55 ) {

				const w = Math.sin( t * 8 + sd * 20 ) * 0.3;
				A[ 0 ][ 0 ] = 2.4; A[ 0 ][ 1 ] = 0.5 + w; A[ 0 ][ 2 ] = 0.2; A[ 0 ][ 3 ] = 0.6;
				A[ 1 ][ 0 ] = 2.4; A[ 1 ][ 1 ] = 0.5 - w; A[ 1 ][ 2 ] = 0.2; A[ 1 ][ 3 ] = 0.6;
				a.propL = 0; a.propR = 0;
				mouth = Math.max( mouth, 0.6 );

			}

		}

		const dx = tx - p.x, dz = tz - p.z;
		let hy = wrap( Math.atan2( - dx, - dz ) - p.yaw );
		let hp = - Math.atan2( ty - ( p.y + 1.1 + 0.45 * up + ( m.sit ? m.sit - 0.45 : 0 ) ), Math.sqrt( dx * dx + dz * dz ) );
		if ( talk && fract( t / 7 + sd * 3 ) < 0.6 ) {

			hy = sd < 0.5 ? - 0.8 : 0.8;
			hp = 0.1;
			mouth = Math.max( mouth, Math.max( 0, 0.35 * Math.sin( t * 7 + sd * 9 ) ) * ( fract( t / 2.3 + sd ) < 0.6 ? 1 : 0 ) );

		}

		if ( g === HUG ) hy = 0.7;
		const tw = clamp( hy * 0.35, - 0.4, 0.4 );
		hy = clamp( hy - tw, - 1.2, 1.2 );
		m.head[ 0 ] += ( hy - m.head[ 0 ] ) * k * 0.7;
		m.head[ 1 ] += ( clamp( hp, - 0.5, 0.6 ) - m.head[ 1 ] ) * k * 0.7;
		a.headYaw = m.head[ 0 ];
		a.headPitch = m.head[ 1 ];
		a.twist = tw;
		a.mouth = mouth > 0.5 ? mouth * ( 0.75 + 0.25 * Math.sin( t * 5 + sd * 7 ) ) : mouth;
		a.blink = fract( t * 0.31 + sd * 7 ) < 0.035 ? 1 : 0;
		a.breath = 0.5 + 0.5 * Math.sin( t * 1.3 + sd * 9 );
		// ---- the legs: seated (the seat's height), up, or up and jumping at the last out
		if ( m.sit ) {

			const s0 = 1 - up;
			a.hipL = a.hipR = 1.5 * s0;
			a.kneeL = a.kneeR = 1.5 * s0 + 0.3 * Math.sin( up * Math.PI );
			a.drop = ( 0.84 - m.sit ) * s0;
			a.lean = 0.05 * s0 + 0.25 * Math.sin( up * Math.PI );

		} else {

			a.hipL = a.hipR = 0;
			a.kneeL = sd < 0.5 ? 0.12 : 0; a.kneeR = sd < 0.5 ? 0 : 0.12;
			a.drop = 0;
			a.lean = m.rail ? 0.2 + 0.15 * sd : 0.02;

		}

		a.walk = 0;
		let y = m.spot.y;
		if ( N.celebrate && m.jump && up > 0.9 ) y += Math.max( 0, Math.sin( t * 7.5 + sd * 20 ) ) * 0.14;
		p.y = y;
		// out of a chair, a step back from it
		if ( m.sit ) {

			const bx = m.x + Math.sin( m.face ) * 0.25 * up, bz = m.z + Math.cos( m.face ) * 0.25 * up;
			const [ fx, fz ] = this.F.field( bx, bz );
			p.x = fx; p.z = fz;

		}

	}

	// a server's round: the tray at the shoulder going out, a stop at a table (the tray down, the plates
	// set), back to the bar with it empty
	_server( m, N, dt ) {

		const p = m.p, a = p.pose, sd = m.seed, P = m.path, k = 1 - Math.exp( - dt * 6 );
		const t = this.time + sd * 40;
		// half a minute a round, with two stops of a few seconds
		const cyc = m.pathLen / m.speed + 8;
		const u = fract( t / cyc );
		let s = u * cyc * m.speed, stop = false;
		const stops = [ 0.4, 0.75 ];
		for ( const st of stops ) {

			const s0 = st * m.pathLen;
			if ( s > s0 && s < s0 + 4 * m.speed ) {

				s = s0;
				stop = true;
				break;

			}

			if ( s >= s0 + 4 * m.speed ) s -= 4 * m.speed;

		}

		s = Math.max( 0, Math.min( m.pathLen - 1e-3, s ) );
		let i = 0, acc = 0, seg = 0;
		for ( ; i < P.length; i ++ ) {

			const A = P[ i ], B = P[ ( i + 1 ) % P.length ];
			seg = Math.hypot( B.x - A.x, B.z - A.z );
			if ( acc + seg >= s ) break;
			acc += seg;

		}

		const A = P[ i % P.length ], B = P[ ( i + 1 ) % P.length ];
		const f = seg ? ( s - acc ) / seg : 0;
		const x = lerp( A.x, B.x, f ), z = lerp( A.z, B.z, f );
		const [ fx, fz ] = this.F.field( x, z );
		p.x = fx; p.z = fz;
		const dx = B.x - A.x, dz = B.z - A.z;
		if ( ! stop && ( dx || dz ) ) p.yaw = this.F.yaw( Math.atan2( - dx, - dz ) );
		const v = stop ? 0 : m.speed;
		a.walk += ( Math.min( 1, v / 0.9 ) - a.walk ) * k;
		a.phase = ( a.phase + dt * v / 1.1 * TAU ) % TAU;
		// out full, back empty; at the table the tray lowered
		const full = u < 0.5;
		const g = stop ? SET : GESTURE.tray;
		const A2 = m.arms;
		for ( let q = 0; q < 2; q ++ ) {

			const T = ( g && g[ q ] ) || REST, C = A2[ q ];
			for ( let j = 0; j < 4; j ++ ) C[ j ] += ( T[ j ] - C[ j ] ) * k;

		}

		a.armL = A2[ 0 ]; a.armR = A2[ 1 ];
		a.propR = stop ? PROP.sandwich : full ? PROP.tray : 0;
		a.propL = 0;
		a.headYaw = stop ? 0.3 * Math.sin( t ) : 0;
		a.headPitch = stop ? 0.35 : 0.05;
		a.mouth = stop ? Math.max( 0, 0.3 * Math.sin( t * 7 ) ) : 0;
		a.blink = fract( t * 0.33 + sd * 7 ) < 0.035 ? 1 : 0;
		a.lean = 0.03;

	}

	// the host at the stand: the menus under the arm, now and then pointing the way to a table
	_host( m, N, dt ) {

		const p = m.p, a = p.pose, t = this.time + m.seed * 30, k = 1 - Math.exp( - dt * 5 );
		const w = fract( t / 12 );
		const g = w < 0.2 ? GESTURE.point : w < 0.3 ? GESTURE.reachL : GESTURE.carryL;
		const A = m.arms;
		for ( let q = 0; q < 2; q ++ ) {

			const T = ( g && g[ q ] ) || REST, C = A[ q ];
			for ( let j = 0; j < 4; j ++ ) C[ j ] += ( T[ j ] - C[ j ] ) * k;

		}

		a.armL = A[ 0 ]; a.armR = A[ 1 ];
		a.propL = w < 0.2 ? 0 : PROP.program;
		a.propR = 0;
		a.headYaw += ( ( w < 0.2 ? 0.6 : Math.sin( t * 0.4 ) * 0.5 ) - a.headYaw ) * k;
		a.mouth = w < 0.25 ? Math.max( 0, 0.3 * Math.sin( t * 7 ) ) : 0;
		a.blink = fract( t * 0.33 ) < 0.035 ? 1 : 0;

	}

	// behind a bar: along it and back, pulling a tap, setting a glass down, wiping, ringing it up
	_bartender( m, N, dt ) {

		const p = m.p, a = p.pose, t = this.time + m.seed * 80, sd = m.seed;
		const k = 1 - Math.exp( - dt * 6 );
		// a few steps either way along the bar, a stop for each order
		const cyc = 14 + 6 * sd, u = fract( t / cyc );
		const off = Math.sin( u * TAU ) * 1.6;
		const x = m.spot.x + off, z = m.spot.z;
		const [ fx, fz ] = this.F.field( x, z );
		const v = Math.abs( Math.cos( u * TAU ) * 1.6 * TAU / cyc );
		p.x = fx; p.z = fz;
		const moving = v > 0.35;
		a.walk += ( ( moving ? Math.min( 1, v / 0.9 ) : 0 ) - a.walk ) * k;
		a.phase = ( a.phase + dt * v / 1.1 * TAU ) % TAU;
		// what the hands are doing: the order's cycle (pull, set down, wipe, the register behind)
		const w = fract( t / 6 );
		let g = null, R = 0, face = 0;
		if ( ! moving ) {

			if ( w < 0.35 ) {

				g = TAP; R = PROP.beer;

			} else if ( w < 0.55 ) {

				g = SET; R = PROP.beer;

			} else if ( w < 0.8 ) {

				g = WIPE; R = 0;

			} else {

				// turned to the back bar
				face = Math.PI;

			}

		}

		const A = m.arms;
		for ( let s = 0; s < 2; s ++ ) {

			const T = ( g && g[ s ] ) || REST, C = A[ s ];
			for ( let j = 0; j < 4; j ++ ) C[ j ] += ( T[ j ] - C[ j ] ) * k;

		}

		a.armL = A[ 0 ]; a.armR = A[ 1 ];
		a.propR = R; a.propL = 0;
		const target = this.F.yaw( moving ? ( Math.cos( u * TAU ) > 0 ? - Math.PI / 2 : Math.PI / 2 ) : face );
		p.yaw = target;
		a.headYaw += ( ( moving ? 0 : Math.sin( t * 0.7 ) * 0.4 ) - a.headYaw ) * k;
		a.headPitch = 0.15;
		a.mouth = ! moving && w > 0.55 && w < 0.8 ? Math.max( 0, 0.3 * Math.sin( t * 7 ) ) : 0;
		a.blink = fract( t * 0.33 + sd * 7 ) < 0.035 ? 1 : 0;
		a.lean = moving ? 0.03 : 0.12;

	}

}
