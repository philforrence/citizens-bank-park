import { Plan } from './Plan.js';
import { Way, STREET } from './Ways.js';
import * as Mv from './Moves.js';
import { SEAT } from './ATV.js';
import { Launcher } from './Launcher.js';
import { MOUND } from '../../game/Plays.js';
import { STRETCH_SECONDS } from './Sounds.js';

// The Phanatic's night, act by act, laid against the replay's timeline (Director.segments). The replay's
// half-inning breaks are its 24 s `switch` segments: the big bits happen in those (on the visitors'
// dugout roof, the warning track, the field in foul territory), and through the innings he's off the
// field working the crowd: the main concourse, down an aisle into a section, Ashburn Alley, and out of
// sight in the tunnels between (where he parks the four-wheeler and dries off).
//
// The 27th (the rain getting harder all night): the pregame lap on the four-wheeler; the hex on Scott
// Kazmir and the dance on the Rays' roof; a section behind home plate; Bull's in the Alley; dancing with
// the ball girls in the rain (Getty 83477166); the hot dog launcher; the rail over the Rays' pen while
// Grant Balfour warms; getting the soaked crowd up on the Phillies' roof; gone when the tarp comes out.
// The 29th (cold, dry, the wind blowing): the four-wheeler again before the resumption; the Rays' roof;
// the seventh-inning stretch; the launcher; the hex on David Price from the Alley; the Phillies' roof in
// the 9th with the towel; the last out.

const G = 9.81;
const hash = ( n ) => {

	const s = Math.sin( n * 12.9898 ) * 43758.5453;
	return s - Math.floor( s );

};
const TAU = Math.PI * 2;
const yawTo = ( a, b ) => Math.atan2( - ( b[ 0 ] - a[ 0 ] ), - ( b[ 1 ] - a[ 1 ] ) );
const wrapA = ( a ) => {

	while ( a > Math.PI ) a -= TAU;
	while ( a < - Math.PI ) a += TAU;
	return a;

};

export function buildNight( { director, ways: W, field } ) {

	const plan = new Plan();
	plan.shots = [];
	const segs = director.segments;
	const sw = ( inning, half ) => segs.find( ( s ) => s.kind === 'switch' && s.snap.inning === inning && s.snap.half === half );
	const cel = segs.find( ( s ) => s.kind === 'celebrate' );
	const susp = sw( 6, 'bottom' );
	const T = ( inning, half ) => sw( inning, half )?.t0 ?? 0;

	// ---------------------------------------------------------------- the pieces

	// a spot on the ring by a section number's aisle head
	const ringAtSection = ( num ) => {

		let best = 0, bd = Infinity;
		for ( let k = 0; k < W.secs.length - 1; k ++ ) {

			const d = Math.abs( W.sectionOf( k ) - num );
			if ( d < bd ) {

				bd = d; best = k;

			}

		}

		const [ x, , z ] = W.aisleAt( best, W.backEdge + 3.6 );
		return W.ringS( x, z );

	};
	const ringSOf = ( p ) => W.ringS( p[ 0 ], p[ 2 ] );

	// strolling the ring from s0 to s1 between t0 and t1: walking, and stopping on the way for the people
	// who stop him (a high five, a wave, a picture) to fill the time there is
	const stroll = ( t0, t1, s0, s1, seed = 0 ) => {

		const way = W.ringFrom( s0, s1 );
		const avail = Math.max( 0.5, t1 - t0 );
		// the time to walk it at an easy 1.2 m/s (hurrying if there isn't the time), the rest in stops
		const walkT = Math.min( avail, way.L / 1.2 );
		const spare = avail - walkT;
		const stops = Math.max( 0, Math.min( 6, Math.floor( spare / 6 ) ) );
		const stopDur = stops ? spare / stops : 0;
		const leg = walkT / ( stops + 1 );
		const bits = [ ( tau ) => Mv.highFive( tau, 1.35 ), ( tau ) => Mv.wave( tau ), ( tau ) => Mv.photoPose( tau ), ( tau ) => Mv.highFive( tau, 1.0 ), ( tau ) => Mv.bellyShake( tau ), ( tau ) => Mv.wave( tau, true ) ];
		let t = t0;
		for ( let i = 0; i <= stops; i ++ ) {

			const part = W.ringFrom( s0 + ( s1 - s0 ) * i / ( stops + 1 ), s0 + ( s1 - s0 ) * ( i + 1 ) / ( stops + 1 ) );
			t = plan.walk( t, part, { speed: Math.max( 0.3, part.L / leg ), zone: 'concourse', name: 'concourse', excite: 0.8 } );
			if ( i < stops ) {

				const p = part.at( part.L );
				// turned to the fans at the rail or the stand's line, the field side or the other
				const face = p.yaw + ( hash( seed + i ) < 0.5 ? Math.PI / 2 : - Math.PI / 2 );
				const bit = bits[ Math.floor( hash( seed * 3 + i * 7 ) * bits.length ) ];
				t = plan.hold( t, t + stopDur, { x: p.x, y: p.y, z: p.z, yaw: face }, bit, { zone: 'concourse', name: 'fans', excite: 1 } );
				plan.cue( t - stopDur + 0.5, 'cheer', { name: 'cheer-small', at: [ p.x, p.y + 1.5, p.z ], vol: 0.35, ref: 6 } );

			}

		}

		return t1;

	};

	// down the stairs behind a dugout onto its roof, arriving at tArrive; returns when he set off
	const toRoof = ( side, tArrive ) => {

		const way = W.roofStairs( side );
		return plan.walkTo( tArrive, way, { speed: 1.15, zone: 'stands', name: 'to the roof', excite: 0.9 } );

	};
	// and back up to the ring from the roof, from tLeave; returns when he's up
	const fromRoof = ( side, tLeave ) => plan.walk( tLeave, W.roofStairs( side ).reversed(), { speed: 1.15, zone: 'stands', name: 'up the steps', excite: 0.8 } );
	const roofHead = ( side ) => {

		const w = W.roofStairs( side );
		return w.pts[ 0 ];

	};

	// a show on a roof from t0 to t1: a program of [ seconds, what, facing ] where facing is 'field',
	// 'crowd', 'mound' or [ x, z ] to face; he drifts along the roof as he dances
	const roofShow = ( side, t0, t1, program, extra = {} ) => {

		const d = W.dugouts[ side ];
		const sm = d.len / 2;
		const zone = side === '3B' ? 'roof3B' : 'roof1B';
		let t = t0;
		for ( const [ dur, what, facing, opts = {} ] of program ) {

			const a = t, b = Math.min( t1, t + dur );
			if ( b <= a ) break;
			const drift = opts.drift ?? 0;
			plan.add( a, b, zone, what, ( tau ) => {

				// drifting along the roof as he dances (eased in and out: no jump between bits)
				const ramp = Math.max( 0, Math.min( 1, tau / 1.5, ( b - a - tau ) / 1.5 ) );
				const s = sm + drift * Math.sin( ( a + tau ) * 0.45 ) * ramp;
				const [ x, y, z ] = W.roofAt( side, s, 1.15 );
				let yaw;
				if ( facing === 'field' ) yaw = W.roofFacing( side, true );
				else if ( facing === 'crowd' ) yaw = W.roofFacing( side, false ) + 0.35 * Math.sin( ( a + tau ) * 0.3 );
				else if ( facing === 'mound' ) yaw = yawTo( [ x, z ], MOUND );
				else yaw = yawTo( [ x, z ], facing );
				// he turns round now and then to the field when dancing for the crowd
				if ( opts.turn ) yaw += Math.PI * ( Math.floor( ( a + tau ) / 4.2 ) % 2 );
				return { x, y, z, yaw, pose: MOVES[ what ]( tau, opts ), towel: !! opts.towel, board: opts.board ?? null };

			}, { excite: 1, ...extra } );
			t = b;

		}

		return t1;

	};

	const MOVES = {
		wave: ( tau ) => Mv.wave( tau ),
		wave2: ( tau ) => Mv.wave( tau, true ),
		hex: ( tau ) => Mv.hex( tau ),
		dance: ( tau, o ) => Mv.dance( tau, o.seed || 0 ),
		shake: ( tau ) => Mv.bellyShake( tau ),
		bump: ( tau ) => Mv.bellyBump( tau ),
		tease: ( tau ) => Mv.tease( tau ),
		mimic: ( tau ) => Mv.mimicPitch( tau ),
		punch: ( tau ) => Mv.punchOut( tau ),
		point: ( tau, o ) => Mv.point( tau, o.at ),
		pump: ( tau ) => Mv.pumpUp( tau ),
		towel: ( tau ) => Mv.towelTwirl( tau ),
		stretch: ( tau ) => Mv.stretchSway( tau, 180 ),
		idle: ( tau ) => Mv.idle( tau ),
		joy: ( tau ) => Mv.joy( tau ),
		smooch: ( tau ) => Mv.smooch( tau ),
		ruffle: ( tau ) => Mv.ruffle( tau ),
		photo: ( tau ) => Mv.photoPose( tau ),
		high5: ( tau ) => Mv.highFive( tau, 1.2 ),
	};

	// a visit into a section: down the aisle after section k to row r, the bits there with the fans on the
	// seats beside the aisle, back up; returns when he's back on the ring
	const standsVisit = ( k, row, t0, bits ) => {

		const way = W.aisle( k, row );
		let t = plan.walk( t0, way, { speed: 1.0, zone: 'stands', name: 'down the aisle', excite: 1 } );
		const p = way.at( way.L );
		// the fans sit on the aisle's left or right: he turns to them
		for ( const [ dur, what, side ] of bits ) {

			const yaw = p.yaw + ( side < 0 ? Math.PI / 2 : - Math.PI / 2 );
			t = plan.hold( t, t + dur, { x: p.x, y: p.y, z: p.z, yaw }, ( tau ) => MOVES[ what ]( tau, {} ), { zone: 'stands', name: what, excite: 1 } );

		}

		plan.cue( t - 4, 'cheer', { name: 'cheer-small', at: [ p.x, p.y + 1, p.z ], vol: 0.5, ref: 8 } );
		return plan.walk( t, way.reversed(), { speed: 1.0, zone: 'stands', name: 'up the aisle', excite: 0.8 } );

	};

	// ---- the four-wheeler

	// a ride along a way from t0: speed (m/s) easing in and out; the rider's pose by the moment; the ATV's
	// pitch and roll off the track's little bumps; `wave` 0..1 of the time his right hand's off the bar
	const ride = ( t0, way, { speed = 7, accel = 3, name = 'atv', board = null, waveK = 0.4, launcher = true, excite = 1 } = {} ) => {

		// the time to cover L with a trapezoid of speed
		const L = way.L, ta = speed / accel, la = 0.5 * accel * ta * ta;
		const dur = L > 2 * la ? 2 * ta + ( L - 2 * la ) / speed : 2 * Math.sqrt( L / accel );
		const sAt = ( tau ) => {

			if ( L <= 2 * la ) {

				const h = dur / 2;
				return tau < h ? 0.5 * accel * tau * tau : L - 0.5 * accel * ( dur - tau ) ** 2;

			}

			if ( tau < ta ) return 0.5 * accel * tau * tau;
			if ( tau > dur - ta ) return L - 0.5 * accel * ( dur - tau ) ** 2;
			return la + speed * ( tau - ta );

		};

		return plan.add( t0, t0 + dur, 'field', name, ( tau ) => {

			const s = sAt( tau ), p = way.at( s );
			const v = ( sAt( tau + 0.05 ) - sAt( Math.max( 0, tau - 0.05 ) ) ) / 0.1;
			const ahead = way.at( s + 2.5 );
			const turn = wrapA( ahead.yaw - p.yaw );
			const bump = 0.012 * Math.sin( s * 3.1 ) + 0.008 * Math.sin( s * 7.3 + 1 );
			const wv = waveK > 0 && Math.sin( ( t0 + tau ) * 0.5 ) > 1 - 2 * waveK ? 1 : 0;
			const waveR = Math.min( 1, wv * Math.min( 1, v / 2 ) );
			const atv = { x: p.x, z: p.z, yaw: p.yaw, dist: s, steer: Math.max( - 0.5, Math.min( 0.5, turn * 1.2 ) ), pitch: bump * 0.6, roll: - turn * 0.08, speed: v };
			return {
				x: p.x, y: 0, z: p.z, yaw: p.yaw, pose: Mv.ride( t0 + tau, { seat: SEAT, bump: bump * 1.5, lean: - turn * 0.5, waveR } ), atv,
				launcher: launcher ? rackLauncher( atv, 0.15 ) : null, board,
			};

		}, { excite } );

	};

	// the launcher on its yoke on the rack, riding along (pitched up a little, pointing back over the seat
	// as it travels)
	const rackLauncher = ( atv, pitch = 0.15, yawOff = Math.PI ) => {

		const c = Math.cos( atv.yaw ), s = Math.sin( atv.yaw );
		const lz = 0.72; // the rack's middle, behind the seat
		return { x: atv.x + lz * s, y: 1.12, z: atv.z + lz * c, yaw: atv.yaw + yawOff, pitch, yoke: true };

	};

	// parked, the engine running: he stands on the footrests at the launcher on the rack and fires volleys
	// at the stands. shots: [ [ time into it, target [ x, y, z ], flight s ] ]
	const launch = ( t0, t1, at, heading, shots, { name = 'launcher', board = 'HOT DOGS!' } = {} ) => {

		const atv = { x: at[ 0 ], z: at[ 1 ], yaw: heading, dist: 0, steer: 0, pitch: 0, roll: 0, speed: 0, rev: 0 };
		const pivot = rackLauncher( atv, 0 );
		const aims = shots.map( ( [ dt, to, fl ] ) => ( { dt, to, fl, ...Launcher.aimAt( [ pivot.x, pivot.y, pivot.z ], to, fl ) } ) );
		for ( const a of aims ) {

			const m = Launcher.muzzle( { x: pivot.x, y: pivot.y, z: pivot.z, yaw: a.yaw, pitch: a.pitch } );
			plan.shots.push( { from: m.at, to: a.to, t0: t0 + a.dt, T: a.fl - 0.05 } );
			plan.cue( t0 + a.dt, 'thump', { at: m.at } );
			plan.cue( t0 + a.dt + a.fl - 0.3, 'cheer', { name: 'cheer-burst', at: a.to, vol: 0.55, ref: 12 } );

		}

		plan.add( t0, t1, 'field', name, ( tau ) => {

			// which shot he's on: swing the barrel round to it before it goes
			let i = aims.findIndex( ( a ) => tau < a.dt + 0.4 );
			if ( i < 0 ) i = aims.length - 1;
			const a = aims[ i ], prev = aims[ Math.max( 0, i - 1 ) ];
			const k = Mv.ease( Mv.clamp( ( tau - ( prev.dt + 0.5 ) ) / Math.max( 0.3, a.dt - prev.dt - 0.9 ), 0, 1 ) );
			const yaw = i === 0 ? a.yaw : prev.yaw + wrapA( a.yaw - prev.yaw ) * k;
			const pitch = i === 0 ? a.pitch * Mv.ease( Mv.clamp( tau / 1.2, 0, 1 ) ) : prev.pitch + ( a.pitch - prev.pitch ) * k;
			const since = tau - a.dt;
			const recoil = since >= 0 && since < 0.5 ? Math.exp( - since * 8 ) * 0.12 : 0;
			const L = { ...pivot, yaw, pitch: pitch + recoil };
			// he stands up on the rack's footrests behind it, turned the way the barrel points, arms on it
			const fy = wrapA( yaw - heading );
			const pose = Mv.launch( tau, { aim: [ 0, Math.sin( pitch ), - Math.cos( pitch ) ], fire: since } );
			pose.pelvisY += 0.36;
			for ( const f of [ 'footL', 'footR' ] ) pose[ f ] = [ pose[ f ][ 0 ], pose[ f ][ 1 ] + 0.34, pose[ f ][ 2 ] ];
			const px = at[ 0 ] + 0.35 * Math.sin( heading ), pz = at[ 1 ] + 0.35 * Math.cos( heading );
			return { x: px, y: 0.02, z: pz, yaw: heading + fy, pose, atv: { ...atv, rev: since >= 0 && since < 0.4 ? 0.2 : 0 }, launcher: L, board };

		}, { excite: 1 } );
		return t1;

	};

	// ---- geometry for the night

	const track = W.track;
	const nearTrack = ( x, z ) => {

		let best = track[ 0 ], bd = Infinity;
		for ( const p of track ) {

			const d = Math.hypot( p[ 0 ] - x, p[ 1 ] - z );
			if ( d < bd ) {

				bd = d; best = p;

			}

		}

		return best;

	};
	// the gates he drives through: in the left field and right field corners, in the wall by the foul poles
	const GATE = { LF: nearTrack( - 68, - 72 ), RF: nearTrack( 68, - 72 ) };
	// a way off the track out through a gate: straight at the wall and through it
	const throughGate = ( g, side ) => {

		const out = side === 'LF' ? [ g[ 0 ] - 5, g[ 1 ] - 5 ] : [ g[ 0 ] + 5, g[ 1 ] - 5 ];
		return [ [ g[ 0 ], 0, g[ 1 ] ], [ out[ 0 ], 0, out[ 1 ] ] ];

	};
	// seats to aim the hot dogs at: a point in the field level seats (or up in the 200s) by section and row
	const seat = ( k, row, off = 0 ) => {

		const [ x, y, z ] = W.aisleAt( k, ( W.tier.start || 0 ) + row * W.tier.depth + 0.4 );
		const S = W.secs[ k ];
		return [ x - S.ux * ( 2.5 + off ), y + 1.0, z - S.uz * ( 2.5 + off ) ];

	};

	// the aisles by their sections
	const aisleBySection = ( num ) => {

		let best = 0, bd = Infinity;
		for ( let k = 0; k < W.secs.length - 1; k ++ ) {

			const d = Math.abs( W.sectionOf( k ) - num );
			if ( d < bd && ( W.secs[ k ].seats || W.secs[ k + 1 ].seats ) ) {

				bd = d; best = k;

			}

		}

		return best;

	};

	// Ashburn Alley: the rail over the Rays' pen (on the Alley's deck, over their bench), Bull's
	const P = field?.penFrame;
	const alley = P ? ( () => {

		const O = P.TB - P.overhang;
		const railAt = ( s ) => {

			const [ x, z ] = P.at( s, O + 0.55 );
			return { x, y: STREET, z, yaw: Math.atan2( P.nx, P.nz ) };

		};
		return {
			rail: railAt( ( P.west + P.S1 ) / 2 + 2 ), railW: railAt( P.west + 1.5 ),
			bulls: { x: - 67.9 + 0.75, y: STREET, z: - 138.4 - 0.9, yaw: Math.PI },
			bullsFront: { x: - 67.9 + 0.2, y: STREET, z: - 138.4 + 1.6, yaw: 0 },
			door: { x: - 40, y: STREET, z: - 136 },
		};

	} )() : null;
	// the Alley's promenade from Bull's east along the deck to the pens' rail
	const alleyWay = ( from, to ) => new Way( [ [ from.x, STREET, from.z ], [ ( from.x + to.x ) / 2, STREET, Math.min( from.z, to.z ) - 3 ], [ to.x, STREET, to.z ] ] );

	// ================================================================ the 27th

	// ---- the pregame lap, finishing: round from center field to the right field corner as the Phillies
	// take the field, waving to the Pavilion, out through the gate
	{

		const from = nearTrack( - 15, - 122 );
		const way = W.trackWay( from, GATE.RF ).concat( throughGate( GATE.RF, 'RF' ) );
		ride( - 2, way, { speed: 7.5, name: 'the pregame lap', waveK: 0.6, launcher: false, board: null } );
		plan.cue( 0.5, 'cheer', { name: 'cheer-burst', at: [ 40, 8, - 110 ], vol: 0.5, ref: 20 } );

	}

	// ---- through the tunnel (the four-wheeler parked), up onto the concourse on the first base side, and
	// down the steps behind the Phillies' dugout (in front of 115-118) for the break after the top of the 1st
	const t1b = T( 1, 'bottom' );
	{

		const tDown = toRoof( '1B', t1b - 0.5 );
		const head = roofHead( '1B' );
		const sHead = ringSOf( head ), sDoor = ringAtSection( 108 );
		stroll( tDown - 34, tDown, sDoor, sHead, 1 );
		// on the Phillies' roof: the crowd behind the dugout, then the dance, the belly going
		roofShow( '1B', t1b - 0.5, t1b + 22, [
			[ 3.5, 'wave', 'crowd' ], [ 2.5, 'pump', 'crowd' ],
			[ 12, 'dance', 'crowd', { drift: 2.5, turn: true, seed: 1, board: 'DANCE!' } ], [ 3, 'shake', 'field', { board: 'DANCE!' } ], [ 1.5, 'wave2', 'crowd' ],
		] );
		plan.cue( t1b + 6, 'organ', { name: 'phan-organ-dance', vol: 0.35 } );
		plan.cue( t1b + 18.2, 'organ', { name: 'phan-organ-run', vol: 0.3 } );
		plan.cue( t1b + 1, 'cheer', { name: 'cheer-small', at: W.roofAt( '1B', 13 ), vol: 0.7, ref: 12 } );
		const tUp = fromRoof( '1B', t1b + 22 );

		// ---- the bottom of the 1st: round the concourse behind home plate, and into a section there (the
		// fans behind the plate turn round in their seats: he's coming down)
		const kHome = aisleBySection( 124 );
		const [ hx, , hz ] = W.aisleAt( kHome, W.backEdge + 3.6 );
		const sHome = W.ringS( hx, hz );
		const tIn = stroll( tUp, tUp + 70, sHead, sHome, 2 );
		const tOut = standsVisit( kHome, 8, tIn, [ [ 3.2, 'smooch', 1 ], [ 3.2, 'smooch', 1 ], [ 4.5, 'ruffle', - 1 ], [ 5, 'photo', - 1 ], [ 3, 'high5', 1 ] ] );
		// on round to the third base side, and through a door there
		stroll( tOut, T( 2, 'top' ) - 5, sHome, ringAtSection( 133 ), 3 );

	}

	// ---- the top of the 2nd: out to Ashburn Alley; a picture with the Bull at his table, and the kids at the
	// rail over the pens
	if ( alley ) {

		const t0 = T( 2, 'top' ) + 30;
		let t = plan.walk( t0, new Way( [ [ alley.door.x, STREET, alley.door.z ], [ alley.bullsFront.x + 1.5, STREET, alley.bullsFront.z + 2.5 ], [ alley.bullsFront.x, STREET, alley.bullsFront.z ] ] ), { zone: 'alley', name: 'the Alley', excite: 1 } );
		t = plan.hold( t, t + 3.5, alley.bullsFront, ( tau ) => Mv.wave( tau ), { zone: 'alley', name: 'at Bull\'s', excite: 1 } );
		t = plan.walk( t, new Way( [ [ alley.bullsFront.x, STREET, alley.bullsFront.z ], [ alley.bulls.x + 0.8, STREET, alley.bulls.z + 0.6 ], [ alley.bulls.x, STREET, alley.bulls.z ] ] ), { zone: 'alley', name: 'round the table' } );
		t = plan.hold( t, t + 6, alley.bulls, ( tau ) => Mv.photoPose( tau ), { zone: 'alley', name: 'a picture with the Bull', excite: 1 } );
		t = plan.hold( t, t + 3.2, alley.bulls, ( tau ) => Mv.bellyBump( tau ), { zone: 'alley', name: 'the belly bump with the Bull', excite: 1 } );
		plan.cue( t - 2.5, 'cheer', { name: 'cheer-small', at: [ alley.bulls.x, STREET + 1.5, alley.bulls.z ], vol: 0.5 } );
		t = plan.walk( t, alleyWay( alley.bulls, alley.railW ), { zone: 'alley', name: 'along the Alley', excite: 0.9 } );
		t = plan.hold( t, t + 8, alley.railW, ( tau ) => Mv.highFive( tau, 1.3 ), { zone: 'alley', name: 'the kids at the rail', excite: 1 } );
		t = plan.hold( t, t + 5, alley.railW, ( tau ) => Mv.wave( tau, true ), { zone: 'alley', name: 'waving to the pens', excite: 1 } );
		plan.walk( t, new Way( [ [ alley.railW.x, STREET, alley.railW.z ], [ alley.railW.x + 4, STREET, alley.railW.z - 6 ] ] ), { zone: 'alley', name: 'off through the gate', excite: 0.6 } );

	}

	// ---- the rest of the plan, the same way, for the rest of the night: the ball girls in the rain, the
	// launcher, the pens, the suspension, the 29th (see nightTwo below)
	nightTwo( { plan, W, T, sw, susp, cel, stroll, toRoof, fromRoof, roofHead, roofShow, ringAtSection, ringSOf, standsVisit, ride, launch, GATE, throughGate, nearTrack, seat, aisleBySection, alley, alleyWay } );

	plan.finish();
	return plan;

}

// ================================================================ the rest of the night

function nightTwo( ctx ) {

	const { plan, W, T, susp, cel, stroll, toRoof, fromRoof, roofHead, roofShow, ringAtSection, ringSOf, standsVisit, ride, launch, GATE, throughGate, nearTrack, seat, aisleBySection, alley, alleyWay } = ctx;
	void susp; void cel; void stroll; void toRoof; void fromRoof; void roofHead; void roofShow; void ringAtSection; void ringSOf; void standsVisit; void ride; void launch; void GATE; void throughGate; void nearTrack; void seat; void aisleBySection; void alley; void alleyWay; void T; void W; void plan;

}

void G; void hash;
