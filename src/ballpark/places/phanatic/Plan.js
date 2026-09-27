import * as Mv from './Moves.js';

// A night as a list of acts, each a stretch of the replay's time with where he is and what he's doing as
// a function of the time into it. at( t ) is pure: the same t always gives the same moment, so scrubbing,
// any camera and any frame order agree. Between acts nothing is left to chance: the plan is built so
// that every moment belongs to one act (walking between places is an act too; so is being out of sight,
// backstage, in the tunnels under the stands).
//
//   const plan = new Plan();
//   plan.walk( t0, way, { speed } ); plan.hold( t0, t1, spot, ( tau ) => pose ); plan.hide( t0, t1 );
//   plan.at( t ) -> { visible, x, y, z, yaw, pose, zone, act, ... }

const STRIDE = 1.35; // m per cycle of his waddle (two short steps in the big sneakers)

export class Plan {

	constructor() {

		this.acts = [];
		this.events = [];

	}

	// an act from t0 to t1: fn( tau, act ) returns the state (x, y, z, yaw, pose, ...)
	add( t0, t1, zone, name, fn, extra = {} ) {

		if ( t1 <= t0 ) return t0;
		this.acts.push( { t0, t1, zone, name, fn, ...extra } );
		return t1;

	}

	// out of sight
	hide( t0, t1, name = 'backstage' ) {

		return this.add( t0, t1, 'backstage', name, () => ( { visible: false } ) );

	}

	// standing (or doing something) at a spot: spot { x, y, z, yaw }, pose( tau ) -> a pose
	hold( t0, t1, spot, pose, { zone = 'field', name = 'hold', ...extra } = {} ) {

		return this.add( t0, t1, zone, name, ( tau ) => ( { x: spot.x, y: spot.y ?? 0, z: spot.z, yaw: spot.yaw ?? 0, pose: pose( tau ) } ), extra );

	}

	// walking a way from t0 at a speed (m/s): returns when he gets there. gait( phase, tau ) -> a pose
	walk( t0, way, { speed = 1.25, gait = Mv.waddle, zone = 'concourse', name = 'walk', stride = STRIDE, ...extra } = {} ) {

		const dur = way.L / speed;
		return this.add( t0, t0 + dur, zone, name, ( tau ) => {

			const s = tau * speed, p = way.at( s );
			return { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pose: gait( s / stride, tau ) };

		}, extra );

	}

	// walking a way so as to arrive at t1 (at `speed`, starting when that takes); returns the start
	walkTo( t1, way, opts = {} ) {

		const dur = way.L / ( opts.speed ?? 1.25 );
		this.walk( t1 - dur, way, opts );
		return t1 - dur;

	}

	// a sound or a cue at a moment (the place plays them as playback passes them)
	cue( t, kind, data = {} ) {

		this.events.push( { t, kind, ...data } );

	}

	finish() {

		this.acts.sort( ( a, b ) => a.t0 - b.t0 );
		this.events.sort( ( a, b ) => a.t - b.t );
		// any gap left between acts: out of sight (never a frozen figure)
		const filled = [];
		let t = 0;
		for ( const a of this.acts ) {

			if ( a.t0 > t + 1e-6 ) filled.push( { t0: t, t1: a.t0, zone: 'backstage', name: 'gap', fn: () => ( { visible: false } ) } );
			filled.push( a );
			t = Math.max( t, a.t1 );

		}

		filled.push( { t0: t, t1: 1e9, zone: 'backstage', name: 'gone', fn: () => ( { visible: false } ) } );
		this.acts = filled;

	}

	actAt( t ) {

		const A = this.acts;
		let lo = 0, hi = A.length - 1;
		while ( lo < hi ) {

			const m = ( lo + hi + 1 ) >> 1;
			if ( A[ m ].t0 <= t ) lo = m; else hi = m - 1;

		}

		// overlapping acts: the later one that has begun wins (a scene laid over a walk)
		return A[ lo ];

	}

	at( t ) {

		const a = this.actAt( t );
		const s = a.fn( t - a.t0, a ) || {};
		return {
			visible: s.visible ?? true, x: s.x ?? 0, y: s.y ?? 0, z: s.z ?? 0, yaw: s.yaw ?? 0, pose: s.pose || null,
			zone: s.zone || a.zone, act: s.act || a.name, excite: s.excite ?? a.excite ?? 0.5,
			atv: s.atv || null, gator: s.gator || null, towel: s.towel ?? a.towel ?? false, board: s.board ?? a.board ?? null,
			props: s.props ?? a.props ?? null, role: s.role ?? a.role ?? null, tau: t - a.t0, a,
		};

	}

}
