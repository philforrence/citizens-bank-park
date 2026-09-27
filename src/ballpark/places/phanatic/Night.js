import { Plan } from './Plan.js';
import { Way, STREET } from './Ways.js';
import * as Mv from './Moves.js';
import { SEAT } from './ATV.js';
import { Launcher } from './Launcher.js';
import { GATOR } from './Gator.js';
import { MOUND } from '../../game/Plays.js';
import * as M from '../../game/Motions.js';
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
				plan.cue( t - stopDur + 0.5, 'cheer', { name: 'phan-crowd', at: [ p.x, p.y + 1.5, p.z ], vol: 0.35, ref: 6 } );

			}

		}

		// (a short way walked quicker than the time there was: wave out the rest)
		if ( t < t1 - 1e-3 ) {

			const p = way.at( way.L );
			plan.hold( t, t1, { x: p.x, y: p.y, z: p.z, yaw: p.yaw }, ( tau ) => Mv.wave( tau ), { zone: 'concourse', name: 'fans', excite: 1 } );

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
		for ( const [ i, [ dur, what, facing, opts = {} ] ] of program.entries() ) {

			// (the last bit runs on to the end of the show)
			const a = t, b = i === program.length - 1 ? t1 : Math.min( t1, t + dur );
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
		popcorn: ( tau ) => Mv.popcorn( tau ),
	};

	// a visit into a section: down the aisle after section k to row r, the bits there with the fans on the
	// seats beside the aisle, back up; returns when he's back on the ring. (Down the aisle behind home: B's
	// vendors are cleared off it while he's on it: plan.aisles)
	plan.aisles = [];
	const standsVisit = ( k, row, t0, bits, { popcorn = false } = {} ) => {

		const way = W.aisle( k, row );
		let t = plan.walk( t0, way, { speed: 1.0, zone: 'stands', name: 'down the aisle', excite: 1, props: popcorn ? { popcorn: true } : null } );
		const p = way.at( way.L );
		// the fans sit on the aisle's left or right: he turns to them (and with the popcorn, shuffles in
		// along the row a seat or two)
		for ( const [ dur, what, side ] of bits ) {

			const yaw = p.yaw + ( side < 0 ? Math.PI / 2 : - Math.PI / 2 );
			const into = what === 'popcorn' ? 0.9 : 0;
			const S = W.secs[ side < 0 ? k : k + 1 ];
			const dx = into * S.ux * ( side < 0 ? - 1 : 1 ), dz = into * S.uz * ( side < 0 ? - 1 : 1 );
			const t1 = t + dur;
			plan.add( t, t1, 'stands', what, ( tau ) => {

				const k2 = Math.sin( Math.PI * Math.min( 1, tau / dur ) );
				return { x: p.x + dx * k2, y: p.y, z: p.z + dz * k2, yaw: what === 'popcorn' ? yaw + Math.PI / 2 * ( side < 0 ? 1 : - 1 ) : yaw, pose: MOVES[ what ]( tau, {} ) };

			}, { excite: 1, props: popcorn ? { popcorn: true } : null } );
			if ( what === 'popcorn' ) plan.cue( t + 0.5, 'cheer', { name: 'phan-crowd', at: [ p.x, p.y + 1, p.z ], vol: 0.5, ref: 7 } );
			t = t1;

		}

		plan.cue( t - 4, 'cheer', { name: 'phan-crowd', at: [ p.x, p.y + 1, p.z ], vol: 0.5, ref: 8 } );
		const t2 = plan.walk( t, way.reversed(), { speed: 1.0, zone: 'stands', name: 'up the aisle', excite: 0.8 } );
		plan.aisles.push( { k, section: W.sectionOf( k ), t0, t1: t2, head: way.pts[ 0 ], row } );
		return t2;

	};

	// ---- the four-wheeler

	// a ride along a way from t0: speed (m/s) easing in and out; the rider's pose by the moment; the ATV's
	// pitch and roll off the track's little bumps; `wave` 0..1 of the time his right hand's off the bar
	const ride = ( t0, way, { speed = 7, accel = 3, name = 'atv', board = null, waveK = 0.4, excite = 1 } = {} ) => {

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
				x: p.x, y: 0, z: p.z, yaw: p.yaw, pose: Mv.ride( t0 + tau, { seat: SEAT, bump: bump * 1.5, lean: - turn * 0.5, waveR } ), atv, board,
			};

		}, { excite } );

	};

	// ---- the Gator and the hot dogs

	// A drive along a way from t0 at `speed` (easing in and out over `accel`): returns [ end, sAt ]
	const drive = ( way, speed, accel ) => {

		const L = way.L, ta = speed / accel, la = 0.5 * accel * ta * ta;
		const dur = L > 2 * la ? 2 * ta + ( L - 2 * la ) / speed : 2 * Math.sqrt( L / accel );
		const sAt = ( tau ) => {

			tau = Math.max( 0, Math.min( dur, tau ) );
			if ( L <= 2 * la ) return tau < dur / 2 ? 0.5 * accel * tau * tau : L - 0.5 * accel * ( dur - tau ) ** 2;
			if ( tau < ta ) return 0.5 * accel * tau * tau;
			if ( tau > dur - ta ) return L - 0.5 * accel * ( dur - tau ) ** 2;
			return la + speed * ( tau - ta );

		};

		return { dur, sAt };

	};

	// The hot dog run: the Gator in along `inWay`, stopped at its end with the stands on its left, the
	// volleys (each aimed so it comes down in the seats: targets, flight times, when into the stop), a
	// U-turn on the foul grass and back out the way it came. He rides standing in the bed at the barrel.
	const gatorRun = ( G ) => {

		const inD = drive( G.inWay, 4.5, 1.6 );
		const end = G.inWay.at( G.inWay.L );
		const heading = end.yaw;
		// the U-turn: an arc round to the right (the field side: there's no room toward the wall) and back
		// along the way in, a turn's width off it, swinging back in to the gate
		const right = [ Math.cos( heading ), - Math.sin( heading ) ];
		const f = [ - Math.sin( heading ), - Math.cos( heading ) ];
		const R = 3.8, cx = end.x + right[ 0 ] * R, cz = end.z + right[ 1 ] * R;
		const arc = [];
		for ( let i = 0; i <= 10; i ++ ) {

			const a = Math.PI * i / 10;
			arc.push( [ cx - right[ 0 ] * R * Math.cos( a ) + f[ 0 ] * R * Math.sin( a ), 0, cz - right[ 1 ] * R * Math.cos( a ) + f[ 1 ] * R * Math.sin( a ) ] );

		}

		const back = G.inWay.pts.slice().reverse().map( ( p ) => [ p[ 0 ] + right[ 0 ] * 2 * R, 0, p[ 2 ] + right[ 1 ] * 2 * R ] );
		back[ back.length - 1 ] = G.inWay.pts[ 0 ];
		back[ back.length - 2 ] = G.inWay.pts[ 1 ];
		const outWay = new Way( [ ...arc, ...back.slice( 1 ) ] );
		const outD = drive( outWay, 4.5, 1.6 );
		const tStop = G.t0 + inD.dur, tGo = tStop + G.hold, tEnd = tGo + outD.dur;
		// the barrel's pivot: at the front of the bed, 1.75 m up; the aims
		const pivotAt = ( x, z, yaw ) => [ x - Math.sin( yaw ) * GATOR.pivotZ * - 1, GATOR.pivotY, z - Math.cos( yaw ) * GATOR.pivotZ * - 1 ];
		const pv = pivotAt( end.x, end.z, heading );
		const aims = G.targets.map( ( to, i ) => ( { to, fl: G.flights[ i ], dt: G.fire[ i ], ...Launcher.aimAt( pv, to, G.flights[ i ] ) } ) );
		for ( const a of aims ) {

			const m = Launcher.muzzle( { x: pv[ 0 ], y: pv[ 1 ], z: pv[ 2 ], yaw: a.yaw, pitch: a.pitch } );
			plan.shots.push( { from: m.at, to: a.to, t0: tStop + a.dt, T: a.fl - 0.05 } );
			plan.cue( tStop + a.dt, 'thump', { at: m.at } );
			plan.cue( tStop + a.dt + a.fl - 0.4, 'cheer', { name: 'phan-crowd', at: a.to, vol: 0.65, ref: 10 } );

		}

		// the Gator and the barrel at time tau into the run
		const at = ( t ) => {

			let x, z, yaw, dist, speed = 0, steer = 0, aimYaw = 0, aimPitch = 0.12, since = - 1;
			if ( t < tStop ) {

				const tau = t - G.t0, s = inD.sAt( tau ), p = G.inWay.at( s );
				x = p.x; z = p.z; yaw = p.yaw; dist = s;
				speed = ( inD.sAt( tau + 0.05 ) - inD.sAt( tau - 0.05 ) ) / 0.1;
				steer = wrapA( G.inWay.at( s + 2 ).yaw - yaw ) * 0.8;

			} else if ( t < tGo ) {

				x = end.x; z = end.z; yaw = heading; dist = G.inWay.L;
				const tau = t - tStop;
				let i = aims.findIndex( ( a ) => tau < a.dt + 0.5 );
				if ( i < 0 ) i = aims.length;
				const a = aims[ Math.min( i, aims.length - 1 ) ], prev = aims[ Math.max( 0, i - 1 ) ];
				const k = i === 0 ? Mv.ease( Mv.clamp( tau / Math.max( 0.5, a.dt - 0.4 ), 0, 1 ) ) : i >= aims.length ? Mv.ease( Mv.clamp( ( tau - prev.dt - 0.6 ) / 1.2, 0, 1 ) ) : Mv.ease( Mv.clamp( ( tau - prev.dt - 0.8 ) / Math.max( 0.4, a.dt - prev.dt - 1.3 ), 0, 1 ) );
				const from = i === 0 ? { yaw: heading, pitch: 0.12 } : prev;
				const to = i >= aims.length ? { yaw: heading, pitch: 0.12 } : a;
				aimYaw = wrapA( from.yaw + wrapA( to.yaw - from.yaw ) * k - heading );
				aimPitch = from.pitch + ( to.pitch - from.pitch ) * k;
				since = i > 0 ? tau - prev.dt : - 1;
				if ( i < aims.length && tau >= a.dt ) since = tau - a.dt;

			} else {

				const tau = t - tGo, s = outD.sAt( tau ), p = outWay.at( s );
				x = p.x; z = p.z; yaw = p.yaw; dist = G.inWay.L + s;
				speed = ( outD.sAt( tau + 0.05 ) - outD.sAt( tau - 0.05 ) ) / 0.1;
				steer = wrapA( outWay.at( s + 2 ).yaw - yaw ) * 0.8;

			}

			return { x, z, yaw, dist, speed, steer, aimYaw, aimPitch, since };

		};

		G.at = at;
		G.tEnd = tEnd;
		// him, standing in the bed behind the barrel: at the barrel's breech, turned the way it points,
		// the recoil when it goes; waving to the stands as they roll
		plan.add( G.t0, tEnd, 'field', 'the hot dog launcher', ( tau ) => {

			const g = at( G.t0 + tau );
			const c = Math.cos( g.yaw ), s = Math.sin( g.yaw );
			// the pivot at the front of the bed; he stands behind the breech the way the barrel points
			const px = g.x + GATOR.pivotZ * s, pz = g.z + GATOR.pivotZ * c;
			const ay = g.yaw + g.aimYaw;
			const bx = px + 0.62 * Math.sin( ay ), bz = pz + 0.62 * Math.cos( ay );
			const pose = g.speed > 0.3 ? Mv.wave( tau ) : Mv.launch( tau, { aim: [ 0, Math.sin( g.aimPitch ), - Math.cos( g.aimPitch ) ], fire: g.since } );
			return { x: bx, y: GATOR.bedY, z: bz, yaw: ay, pose, gator: g, props: { toque: true }, board: 'HOT DOGS!' };

		}, { excite: 1 } );
		return tEnd;

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
		plan.cue( t1b + 3.5, 'organ', { name: 'phan-organ-riff', vol: 0.4 } );
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
	// the four-wheeler parked on the first base side's concourse between his rides (July 2008: parked on
	// the concourse between appearances, fans posing on it), off the walkers' line on its outer side
	{

		const s = ringAtSection( 111 );
		const p = W.ringWay.at( s );
		const out = [ p.x, p.z ], len = Math.hypot( out[ 0 ], out[ 1 ] + 40 );
		const n = [ out[ 0 ] / len, ( out[ 1 ] + 40 ) / len ];
		plan.atvPark = { spot: { x: p.x + n[ 0 ] * 3.2, z: p.z + n[ 1 ] * 3.2, yaw: p.yaw + Math.PI / 2 } };

	}

	nightTwo( { plan, W, T, sw, susp, cel, stroll, toRoof, fromRoof, roofHead, roofShow, ringAtSection, ringSOf, standsVisit, ride, gatorRun, GATE, throughGate, nearTrack, seat, aisleBySection, alley, alleyWay, director } );

	plan.finish();
	return plan;

}

// ================================================================ the rest of the night

function nightTwo( ctx ) {

	const { plan, W, T, susp, cel, stroll, toRoof, fromRoof, roofHead, roofShow, ringAtSection, ringSOf, standsVisit, ride, gatorRun, nearTrack, seat, aisleBySection, alley, alleyWay, director } = ctx;
	const segs = director.segments;
	const change = ( id ) => segs.find( ( s ) => s.kind === 'change' && s.snap.pitcher === id );
	const head1B = roofHead( '1B' ), sHead1B = ringSOf( head1B ), sHead3B = ringSOf( roofHead( '3B' ) );
	// out of sight between two stretches of the night (the tunnels, his room under the stands)
	const back = ( t0, t1 ) => plan.hide( t0, t1 );

	// ---------------------------------------------------------------- the 27th, the 2nd to the 5th

	// ---- the bottom of the 2nd: the concourse behind third (the fans on it: W2's place), down into a
	// section there with a box of popcorn, spilling it along the row as he squeezes through (he did it on
	// October 25: Getty 83434489), up and away
	{

		const t0 = T( 2, 'bottom' ) + 35;
		const k = aisleBySection( 130 );
		const [ ax, , az ] = W.aisleAt( k, W.backEdge + 3.6 );
		const sA = W.ringS( ax, az );
		stroll( t0, t0 + 55, ringAtSection( 136 ), sA, 11 );
		const up = standsVisit( k, 12, t0 + 55, [ [ 3.5, 'popcorn', 1 ], [ 3.5, 'popcorn', 1 ], [ 4, 'ruffle', - 1 ], [ 3, 'high5', - 1 ] ], { popcorn: true } );
		stroll( up, up + 30, sA, ringAtSection( 126 ), 12 );

	}

	// ---- the top of the 3rd: sat on his four-wheeler where it's parked on the concourse (July 2008: fans
	// pose on it between his appearances), the kids climbing on for pictures
	const park = plan.atvPark;
	{

		const t0 = T( 3, 'top' ) + 30, t1 = T( 3, 'bottom' ) - 40;
		const P = park.spot;
		// his right side toward the walkers' line: he comes up that side, swings a leg over, sits
		const side = [ Math.cos( P.yaw ), - Math.sin( P.yaw ) ];
		const by = [ P.x + side[ 0 ] * 0.6, P.z + side[ 1 ] * 0.6 ];
		let t = plan.walk( t0, new Way( [ [ P.x + side[ 0 ] * 6, STREET, P.z + side[ 1 ] * 6 ], [ by[ 0 ], STREET, by[ 1 ] ] ] ), { zone: 'concourse', name: 'to the four-wheeler', excite: 1 } );
		const tOn = t, tOff = t1 - 20;
		t = plan.add( tOn, tOff, 'concourse', 'on the four-wheeler for pictures', ( tau ) => {

			const on = Mv.ease( Mv.clamp( Math.min( tau, tOff - tOn - tau ) / 1.2, 0, 1 ) );
			const wv = Mv.ease( Mv.clamp( ( Math.sin( tau * 0.4 ) - 0.1 ) * 3, 0, 1 ) );
			const pose = M.blend( Mv.idle( tau ), Mv.ride( tau, { waveR: wv } ), on );
			return { x: by[ 0 ] + ( P.x - by[ 0 ] ) * on, y: STREET, z: by[ 1 ] + ( P.z - by[ 1 ] ) * on, yaw: P.yaw, pose };

		}, { excite: 1 } );
		plan.walk( t, new Way( [ [ by[ 0 ], STREET, by[ 1 ] ], [ P.x + side[ 0 ] * 8, STREET, P.z + side[ 1 ] * 8 ] ] ), { zone: 'concourse', name: 'off', excite: 0.8 } );

	}

	// ---- the bottom of the 3rd: the third base concourse, all the way round from the corner toward home
	stroll( T( 3, 'bottom' ) + 30, T( 4, 'top' ) + 20, ringAtSection( 137 ), ringAtSection( 127 ), 17 );

	// ---- the 4th: the concourse behind home, the Diamond Club's aisle (B's), the first base side
	let t4 = 0;
	{

		const t0 = T( 4, 'top' ) + 60;
		stroll( t0, t0 + 80, ringAtSection( 112 ), ringAtSection( 120 ), 21 );
		const k = aisleBySection( 119 );
		const [ ax, , az ] = W.aisleAt( k, W.backEdge + 3.6 );
		const up = standsVisit( k, 10, t0 + 80, [ [ 3.2, 'smooch', - 1 ], [ 4, 'photo', 1 ], [ 3, 'high5', 1 ] ] );
		t4 = stroll( up, up + 40, W.ringS( ax, az ), ringAtSection( 110 ), 22 );

	}

	// ---- the bottom of the 4th: the long half inning (the Rays' run in the 4th behind them): round to
	// the third base concourse, and a section there; then back to the first base side for the 5th
	{

		const t0 = t4 + 45, t5b = T( 5, 'bottom' );
		stroll( t0, t0 + 70, ringAtSection( 136 ), ringAtSection( 131 ), 31 );
		const k = aisleBySection( 132 );
		const up = standsVisit( k, 14, t0 + 70, [ [ 4.5, 'ruffle', 1 ], [ 3.2, 'smooch', - 1 ], [ 4, 'photo', 1 ], [ 3, 'high5', - 1 ] ] );
		stroll( up, up + 45, ringAtSection( 132 ), ringAtSection( 127 ), 33 );
		// the middle of the 5th: the dance on the Phillies' roof (in 2008, Flo Rida's "Low" in the 5th)
		const tDown = toRoof( '1B', t5b - 0.5 );
		stroll( tDown - 45, tDown, ringAtSection( 110 ), sHead1B, 32 );
		roofShow( '1B', t5b - 0.5, t5b + 22, [
			[ 2.5, 'wave', 'crowd' ], [ 13, 'dance', 'crowd', { drift: 3, turn: true, seed: 5, board: 'DANCE!' } ],
			[ 4, 'shake', 'crowd', { board: 'DANCE!' } ], [ 2.5, 'wave2', 'field' ],
		] );
		plan.cue( t5b + 2.5, 'organ', { name: 'phan-organ-dance', vol: 0.35 } );
		plan.cue( t5b + 15.5, 'organ', { name: 'phan-organ-run', vol: 0.3 } );
		plan.cue( t5b + 1, 'cheer', { name: 'phan-crowd', at: W.roofAt( '1B', 13 ), vol: 0.7, ref: 12 } );
		fromRoof( '1B', t5b + 22 );

	}

	// ---- the bottom of the 5th: out to the Alley and the rail over the Rays' pen, where Grant Balfour is
	// getting loose (the change came with two out in the 5th): the hex on him from above, and the Alley
	// loving it
	const balfour = change( 346797 );
	if ( alley && balfour ) {

		const t0 = T( 5, 'bottom' ) + 70, tEnd = balfour.t0 - 2;
		let t = plan.walk( t0, alleyWay( { x: alley.railW.x - 14, z: alley.railW.z - 4 }, alley.railW ), { zone: 'alley', name: 'along the Alley', excite: 0.9 } );
		t = plan.hold( t, t + 5, alley.railW, ( tau ) => Mv.tease( tau ), { zone: 'alley', name: 'teasing Balfour', excite: 1 } );
		t = plan.hold( t, t + 5, alley.railW, ( tau ) => Mv.hex( tau ), { zone: 'alley', name: 'the hex on Balfour', excite: 1 } );
		plan.cue( t - 4.6, 'organ', { name: 'phan-organ-hex', vol: 0.3 } );
		plan.cue( t - 1, 'cheer', { name: 'phan-crowd', at: [ alley.railW.x, STREET + 1.5, alley.railW.z ], vol: 0.6 } );
		t = plan.hold( t, Math.max( t + 4, tEnd - 20 ), alley.railW, ( tau ) => Mv.highFive( tau, 1.3 ), { zone: 'alley', name: 'the kids at the rail', excite: 1 } );
		t = plan.hold( t, tEnd, alley.railW, ( tau ) => Mv.mimicPitch( tau % 3.2 ), { zone: 'alley', name: 'mimicking Balfour', excite: 1 } );
		plan.walk( t, new Way( [ [ alley.railW.x, STREET, alley.railW.z ], [ alley.railW.x + 4, STREET, alley.railW.z - 6 ] ] ), { zone: 'alley', name: 'off through the gate', excite: 0.6 } );

	}

	// ---- after the bottom of the 5th, 10:18 pm, the rain coming down hard: out onto the grass in front
	// of the Phillies' dugout in a red vinyl slicker and sou'wester, and the ball girls come out with their
	// towels and dance with him (Getty 83477166; pompomflipflop 2980921474); the grounds crew rake the
	// infield behind them. He dances, bumps bellies, and gets the soaked crowd going.
	const t6t = T( 6, 'top' );
	{

		const center = [ 21.5, - 4.5 ], from = [ 24.5, 3.8 ];
		const facing = Math.atan2( - ( 30 - center[ 0 ] ), - ( 16 - center[ 1 ] ) ); // toward the stands behind the dugout
		plan.squad = { t0: t6t - 1, t1: t6t + 24, center, from, facing };
		const rain = { hat: true };
		const way = new Way( [ [ from[ 0 ], 0, from[ 1 ] ], [ center[ 0 ], 0, center[ 1 ] ] ] );
		let t = plan.walk( t6t - 1, way, { speed: 2.4, gait: ( ph, tau ) => Mv.scamper( ph, tau ), zone: 'field', name: 'out in the rain', excite: 1, props: rain, role: 'slicker' } );
		const spot = { x: center[ 0 ], y: 0, z: center[ 1 ], yaw: facing };
		const bits = [ [ 4, ( tau ) => Mv.wave( tau, true ) ], [ 7, ( tau ) => Mv.dance( tau, 3 ) ], [ 3.2, ( tau ) => Mv.bellyBump( tau ) ], [ 5, ( tau ) => Mv.bellyShake( tau ) ] ];
		for ( const [ dur, fn ] of bits ) t = plan.hold( t, t + dur, spot, fn, { zone: 'field', name: 'dancing in the rain', excite: 1, props: rain, role: 'slicker', board: 'RAIN DANCE!' } );
		plan.walk( t, way.reversed(), { speed: 2.4, gait: ( ph, tau ) => Mv.scamper( ph, tau ), zone: 'field', name: 'in out of the rain', excite: 0.8, props: rain, role: 'slicker' } );
		plan.cue( t6t + 1, 'cheer', { name: 'cheer-burst', at: [ center[ 0 ], 3, center[ 1 ] + 12 ], vol: 0.6, ref: 20 } );
		plan.cue( t6t + 3, 'organ', { name: 'phan-organ-dance', vol: 0.35 } );

	}

	// ---- the suspension (the break after the top of the 6th on the 27th, and on the 29th before the bottom
	// of the 6th): the tarp comes out and he's gone with everyone else; then the 29th, right before
	// "gametime" (flickr 2990889488, 8:37 pm): out on the four-wheeler across the left field grass, parked
	// on it as the Rays walk out, and at them (flickr 3006436555, "Phanatic Taunting the Rays"), and off
	{

		const L = susp.dur, tz = susp.t0 + L * 0.55;
		const into = nearTrack( - 66, - 74 );
		const parkAt = [ - 38, - 62 ];
		const way = new Way( [ [ into[ 0 ] - 4, 0, into[ 1 ] - 4 ], [ into[ 0 ], 0, into[ 1 ] ], [ - 55, 0, - 72 ], [ - 45, 0, - 64 ], [ parkAt[ 0 ], 0, parkAt[ 1 ] ] ] );
		const tIn = ride( tz, way, { speed: 6.5, name: 'the 29th: out on the four-wheeler', waveK: 0.5, board: 'WELCOME BACK' } );
		const stop = { x: parkAt[ 0 ], y: 0, z: parkAt[ 1 ] };
		const atvAt = way.at( way.L );
		const parked = { x: parkAt[ 0 ], z: parkAt[ 1 ], yaw: atvAt.yaw, dist: way.L, steer: 0, pitch: 0, roll: 0, speed: 0 };
		// standing up on the footrests at them, then sat back down
		const t2 = plan.add( tIn, tIn + 3, 'field', 'at the Rays', ( tau ) => ( { x: stop.x, y: 0, z: stop.z, yaw: atvAt.yaw, pose: Mv.rideStand( tau ), atv: parked, board: 'WELCOME BACK' } ), { excite: 1 } );
		const out = new Way( [ [ parkAt[ 0 ], 0, parkAt[ 1 ] ], [ - 50, 0, - 75 ], [ into[ 0 ], 0, into[ 1 ] ], [ into[ 0 ] - 5, 0, into[ 1 ] - 5 ] ] );
		ride( t2, out, { speed: 6, name: 'out through the gate', waveK: 0.8 } );
		plan.atvField = [ tz - 1, t2 + out.L / 4 + 4 ];

	}

	// ---------------------------------------------------------------- the 29th

	// ---- the bottom of the 6th (the resumption): the first base concourse, the fans in their hats and
	// scarves, the cold
	{

		const t0 = susp.t0 + susp.dur + 40, t1 = T( 7, 'top' ) - 60;
		stroll( t0, t1, ringAtSection( 106 ), ringAtSection( 113 ), 41 );

	}

	// ---- after the bottom of the 6th: the hot dog launcher, on the green John Deere Gator: two of the
	// staff up front (the driver in a red cap), him in the bed in a chef's toque at the big hot-dog-shaped
	// barrel, down the first base line's foul grass, and three volleys into the stands. In 2008 the hot
	// dogs were heavily wrapped in white paper and duct tape (the Inquirer, September 25, 2008).
	const t7t = T( 7, 'top' );
	{

		const g0 = nearTrack( 66, - 72 );
		const inWay = new Way( [ [ g0[ 0 ] + 4, 0, g0[ 1 ] - 4 ], [ g0[ 0 ], 0, g0[ 1 ] ], [ 60, 0, - 58 ], [ 53, 0, - 49 ], [ 48.5, 0, - 41 ] ] );
		const G = plan.gatorRun = { t0: t7t - 2, inWay, hold: 13 };
		// the targets: seats up the first base side's field level, three volleys, the last one high to the
		// back rows by the concourse
		const kA = aisleBySection( 110 ), kB = aisleBySection( 112 ), kC = aisleBySection( 108 );
		G.targets = [ seat( kA, 16, 1 ), seat( kB, 24, - 2 ), seat( kC, 33, 0.5 ) ];
		G.flights = [ 2.2, 2.5, 2.9 ];
		G.fire = [ 3, 7, 11 ];
		gatorRun( G );

	}

	// ---- the 7th on the 29th: back through the tunnel, the concourse, down the steps; the seventh-inning
	// stretch on the Phillies' roof, "Take Me Out to the Ball Game" on the organ, him swaying the section
	// with it; then his dance (in 2008, Sammy Hagar's "There's Only One Way to Rock" in the 7th); and he
	// stays up for the bottom of the 7th to put the hex on the Rays' pitcher, J.P. Howell, from the roof
	// (Wikipedia; Ballpark E-Guides: "where he often dances later in the game"; flickr 2988583768 at 9:14)
	const t7b = T( 7, 'bottom' );
	{

		const stretchAt = t7b - 2.5;
		const tDown = toRoof( '1B', stretchAt - 1 );
		stroll( tDown - 60, tDown, ringAtSection( 108 ), sHead1B, 51 );
		const bradford = change( 136268 );
		const tHex = t7b + 25.5, tOff = bradford ? bradford.t0 - 6 : t7b + 60;
		roofShow( '1B', stretchAt - 1, tOff, [
			[ 1, 'wave2', 'crowd' ], [ STRETCH_SECONDS + 1, 'stretch', 'crowd', { board: 'STRETCH!' } ], [ 1.5, 'point', 'mound', { at: [ 0, 1.6, - 1 ] } ],
			[ 5, 'hex', 'mound', { board: 'THE HEX!' } ], [ 3, 'tease', 'mound' ], [ 30, 'idle', 'field', { drift: 1.5 } ], [ 5, 'hex', 'mound', { board: 'THE HEX!' } ], [ 60, 'pump', 'crowd' ],
		] );
		void tHex;
		plan.cue( stretchAt, 'organ', { name: 'phan-organ-stretch', vol: 0.42 } );
		plan.cue( stretchAt + STRETCH_SECONDS + 3.5, 'organ', { name: 'phan-organ-hex', vol: 0.3 } );
		plan.cue( stretchAt + STRETCH_SECONDS + 2, 'cheer', { name: 'phan-crowd', at: W.roofAt( '1B', 13 ), vol: 0.7, ref: 12 } );
		const up = fromRoof( '1B', tOff );
		stroll( up, up + 40, sHead1B, ringAtSection( 108 ), 52 );

	}

	// ---- after the bottom of the 7th: the kid in the little Phanatic costume (a pinstriped ROLLINS 11
	// jersey, the red cap) held up by his dad in foul territory by the painted World Series logo, snout to
	// snout with him, the Phanatic with a party blower in his snout (Getty 83838048; puffygreenjacket
	// 2993483573 at 9:23)
	const t8t = T( 8, 'top' );
	{

		const logo = [ 12.0, - 3.8 ];
		const kidAt = [ logo[ 0 ] + 1.4, logo[ 1 ] + 2.8 ];
		const me = [ kidAt[ 0 ] - 1.25, kidAt[ 1 ] - 0.35 ];
		const face = Math.atan2( - ( kidAt[ 0 ] - me[ 0 ] ), - ( kidAt[ 1 ] - me[ 1 ] ) );
		plan.mini = { t0: t8t - 6, t1: t8t + 24, at: kidAt, face: face + Math.PI, me };
		const from = [ 16.5, 8.5 ];
		const inWay = new Way( [ [ from[ 0 ], 0, from[ 1 ] ], [ me[ 0 ], 0, me[ 1 ] ] ] );
		let t = plan.walk( t8t - 4, inWay, { speed: 1.6, zone: 'field', name: 'to the little one', excite: 1 } );
		const spot = { x: me[ 0 ], y: 0, z: me[ 1 ], yaw: face };
		const bits = [ [ 3, ( tau ) => Mv.wave( tau ) ], [ 5, ( tau ) => Mv.smooch( tau ) ], [ 4, ( tau ) => Mv.tease( tau ) ], [ 3, ( tau ) => Mv.bellyShake( tau ) ], [ 4, ( tau ) => Mv.highFive( tau, 1.1 ) ] ];
		for ( const [ dur, fn ] of bits ) t = plan.hold( t, t + dur, spot, fn, { zone: 'field', name: 'the little Phanatic', excite: 1, props: { blower: true }, board: 'PHANATICS!' } );
		plan.walk( t, inWay.reversed(), { speed: 1.6, zone: 'field', name: 'off', excite: 0.7 } );
		plan.cue( t8t + 2, 'cheer', { name: 'phan-crowd', at: [ me[ 0 ], 3, me[ 1 ] + 10 ], vol: 0.6, ref: 16 } );

	}

	// ---- the 8th: out to the Alley again; after the bottom of the 8th starts, David Price getting loose in
	// the Rays' pen under the rail: the hex on him (he came in with two on and got the last out)
	const price = change( 456034 );
	if ( alley && price ) {

		const t0 = price.t0 - 95, tEnd = price.t0 - 3;
		let t = plan.walk( t0, alleyWay( { x: alley.railW.x - 14, z: alley.railW.z - 4 }, alley.railW ), { zone: 'alley', name: 'along the Alley', excite: 0.9 } );
		t = plan.hold( t, t + 4, alley.railW, ( tau ) => Mv.point( tau, [ 0, 0.5, - 1 ] ), { zone: 'alley', name: 'there\'s Price', excite: 1 } );
		t = plan.hold( t, t + 5, alley.railW, ( tau ) => Mv.hex( tau ), { zone: 'alley', name: 'the hex on Price', excite: 1 } );
		plan.cue( t - 4.6, 'organ', { name: 'phan-organ-hex', vol: 0.3 } );
		plan.cue( t - 1, 'cheer', { name: 'phan-crowd', at: [ alley.railW.x, STREET + 1.5, alley.railW.z ], vol: 0.6 } );
		t = plan.hold( t, t + 6, alley.railW, ( tau ) => Mv.tease( tau ), { zone: 'alley', name: 'teasing Price', excite: 1 } );
		t = plan.hold( t, tEnd, alley.railW, ( tau ) => Mv.highFive( tau, 1.3 ), { zone: 'alley', name: 'the kids at the rail', excite: 1 } );
		plan.walk( t, new Way( [ [ alley.railW.x, STREET, alley.railW.z ], [ alley.railW.x + 4, STREET, alley.railW.z - 6 ] ] ), { zone: 'alley', name: 'off through the gate', excite: 0.6 } );

	}

	// ---- the 9th: the Phillies' roof after the bottom of the 8th, getting them up (fieldofphotography
	// 2988065046, "gets the crowd started"); then down in the aisle behind the dugout through the top of
	// the 9th, Lidge on, the crowd standing, ready to go
	const t9t = T( 9, 'top' );
	{

		const tDown = toRoof( '1B', t9t - 0.5 );
		stroll( tDown - 105, tDown, ringAtSection( 105 ), sHead1B, 61 );
		roofShow( '1B', t9t - 0.5, t9t + 23, [
			[ 2, 'wave2', 'crowd' ], [ 9, 'pump', 'crowd', { board: 'MAKE SOME NOISE!' } ], [ 7, 'dance', 'crowd', { drift: 2, seed: 9 } ], [ 5, 'pump', 'crowd' ],
		] );
		plan.cue( t9t + 2.5, 'charge' );
		plan.cue( t9t + 12, 'charge' );
		// off the roof to the foot of the steps (the first row behind it), there through the 9th
		const d = W.dugouts[ '1B' ];
		const foot = W.roofStairs( '1B' );
		const standAt = foot.pts[ foot.pts.length - 3 ];
		const yawCrowd = W.roofFacing( '1B', true );
		const tSteps = plan.walk( t9t + 23, new Way( [ foot.pts[ foot.pts.length - 1 ], foot.pts[ foot.pts.length - 2 ], standAt ] ), { speed: 1.2, zone: 'stands', name: 'to the steps' } );
		void d;
		plan.hold( tSteps, cel.t0, { x: standAt[ 0 ], y: standAt[ 1 ], z: standAt[ 2 ], yaw: yawCrowd }, ( tau ) => ( Math.floor( tau / 9 ) % 3 === 2 ? Mv.pumpUp( tau ) : Mv.idle( tau ) ), { zone: 'stands', name: 'waiting behind the dugout', excite: 0.7 } );

	}

	// ---- the last out, 9:58: over the roof, down onto the field and across the infield grass for the pile
	// on the mound (Getty 83486412, 83486112), round it jumping; off toward left-center; two minutes on
	// he runs back in from left-center with the big red 2008 banner on its pole, round the infield and down
	// the lines (pompomflipflop 2986877513 at 9:59; Getty 83570904)
	{

		const c0 = cel.t0;
		const foot = W.roofStairs( '1B' );
		const standAt = foot.pts[ foot.pts.length - 3 ];
		const edge = W.roofAt( '1B', W.dugouts[ '1B' ].len / 2 + 1, 0.2 );
		const onto = new Way( [ standAt, foot.pts[ foot.pts.length - 2 ], [ edge[ 0 ], edge[ 1 ], edge[ 2 ] ] ] );
		let t = plan.walk( c0, onto, { speed: 3.2, gait: ( ph, tau ) => Mv.scamper( ph, tau ), zone: 'roof1B', name: 'over the roof', excite: 1 } );
		// the jump down onto the track
		const land = [ edge[ 0 ] - W.dugouts[ '1B' ].nx * 1.6, edge[ 2 ] - W.dugouts[ '1B' ].nz * 1.6 ];
		const jy = W.roofFacing( '1B', true );
		t = plan.add( t, t + 0.7, 'field', 'the jump', ( tau ) => {

			const k = tau / 0.7;
			const y = edge[ 1 ] * ( 1 - k ) + 0.9 * Math.sin( Math.PI * k ) * 0.5 - 0 * k;
			return { x: edge[ 0 ] + ( land[ 0 ] - edge[ 0 ] ) * k, y: Math.max( 0, y ), z: edge[ 2 ] + ( land[ 1 ] - edge[ 2 ] ) * k, yaw: jy, pose: Mv.joy( 0.2 + k * 0.4 ) };

		}, { excite: 1 } );
		const pile = [ 0, - 17.9 ];
		const near = [ pile[ 0 ] + 4.5, pile[ 1 ] + 2.5 ];
		const across = new Way( [ [ land[ 0 ], 0, land[ 1 ] ], [ 15, 0, - 12 ], [ near[ 0 ], 0, near[ 1 ] ] ] );
		t = plan.walk( t, across, { speed: 4.2, gait: ( ph, tau ) => Mv.scamper( ph, tau ), zone: 'field', name: 'across the grass for the pile', excite: 1, board: 'WORLD CHAMPIONS' } );
		const joyAt = { x: near[ 0 ], y: 0, z: near[ 1 ], yaw: Math.atan2( - ( pile[ 0 ] - near[ 0 ] ), - ( pile[ 1 ] - near[ 1 ] ) ) };
		const bits = [ [ 6, ( tau ) => Mv.joy( tau ) ], [ 4, ( tau ) => Mv.pumpUp( tau ) ], [ 4, ( tau ) => Mv.bellyShake( tau ) ], [ 5, ( tau ) => Mv.joy( tau + 1 ) ], [ 4, ( tau ) => Mv.wave( tau, true ) ] ];
		for ( const [ dur, fn ] of bits ) t = plan.hold( t, t + dur, joyAt, fn, { zone: 'field', name: 'at the pile', excite: 1 } );
		// off to left-center at a run, out through the gate at the end of the left field wall
		const lc = nearTrack( - 30, - 112 );
		const off = new Way( [ [ near[ 0 ], 0, near[ 1 ] ], [ - 8, 0, - 50 ], [ lc[ 0 ], 0, lc[ 1 ] ], [ lc[ 0 ] - 3, 0, lc[ 1 ] - 3 ] ] );
		t = plan.walk( t, off, { speed: 4.5, gait: ( ph, tau ) => Mv.scamper( ph, tau ), zone: 'field', name: 'off to left-center', excite: 0.8 } );
		// back in with the banner, round the infield grass and down the lines
		const tBack = Math.max( t + 6, c0 + 50 );
		const lap = new Way( [ [ lc[ 0 ] - 3, 0, lc[ 1 ] - 3 ], [ lc[ 0 ], 0, lc[ 1 ] ], [ - 22, 0, - 60 ], [ - 30, 0, - 30 ], [ - 26, 0, - 8 ], [ - 10, 0, 4 ], [ 10, 0, 4 ], [ 26, 0, - 8 ], [ 34, 0, - 26 ], [ 40, 0, - 40 ] ] );
		plan.walk( tBack, lap, { speed: 3.8, gait: ( ph, tau ) => Mv.bannerRun( ph, tau ), zone: 'field', name: 'the 2008 banner', excite: 1, props: { banner: true }, board: 'WORLD CHAMPIONS' } );

	}

}

void G; void hash;
