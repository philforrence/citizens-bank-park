import { REL } from '../../game/Motions.js';
import { armIK } from '../Concourse3BKit.js';
import { SEATED, handsOf } from './Poses.js';
import { GEAR } from './Gear.js';
import { PROP } from '../Cast.js';

// Foul balls behind home plate.
//
// Fouled straight back: the ball hits the net right in front of the club's rows, and the fans behind it
// flinch, the forearms up, leaning away, however many times they've seen it.
//
// A pop foul over the net, once a night (the replay's fouls straight back: one in the middle innings on
// the 27th, one in the 7th on the 29th): it goes up over the screen, everyone in its rows looks up and
// stands, hands up.
//   the 27th: it comes down on the Villanova four in row 25, off Pete Kostic's hands, under the seats;
//     Mo Rahman comes up with it and holds it up to the row's applause.
//   the 29th: Sean Gallagher catches it barehanded, holds it up, then leans down over the row between and
//     gives it to Matty Costello, 10, up on his seat in row 23 with his glove. Matty holds it up; his
//     father holds him. It stays in Matty's glove the rest of the night.
// The replay's own ball, bound for the net, is hidden while this one flies.

const PACE_SET = 3.0; // the Director's pitch set (PACE.set)
const G = 9.81;

export class Fouls {

	constructor( place ) {

		this.place = place;
		this.events = null;
		this.keeper = null; // who has a ball now: { fan, hand, from }

	}

	_find( d ) {

		const segs = d.segments, susp = segs.find( ( s ) => s.kind === 'switch' && s.snap.inning === 6 && s.snap.half === 'bottom' );
		const back = ( s ) => {

			const q = s.foulPath?.( 0.6 );
			return q && q[ 2 ] > 3;

		};
		const pick = ( ok ) => segs.find( ( s ) => s.kind === 'pitch' && s.foul && back( s ) && ok( s ) );
		const R = this.place.regulars || {};
		const V = R.villanova || [];
		const E = [];
		const a = pick( ( s ) => s.t0 < susp.t0 && s.snap.inning >= 3 && s.snap.inning <= 5 );
		if ( a && V[ 1 ] && V[ 2 ] ) E.push( { seg: a, night: 27, catcher: V[ 1 ], finder: V[ 2 ] } );
		const b = pick( ( s ) => s.t0 > susp.t0 && s.snap.inning >= 7 );
		if ( b && V[ 0 ] && R.matty ) E.push( { seg: b, night: 29, catcher: V[ 0 ], kid: R.matty, dad: R.paul, mom: R.theresa } );
		for ( const e of E ) {

			e.t0 = e.seg.t0 + PACE_SET + REL + e.seg.path.flight;
			e.from = e.seg.foulPath( 0 ) || [ 0, 1, 0.5 ];
			// where it comes down: over the catcher's head
			const c = e.catcher;
			e.to = [ c.seat.x - c.seat.nx * 0.2, c.seat.y + 2.1, c.seat.z - c.seat.nz * 0.2 ];
			const apex = 27;
			e.tUp = Math.sqrt( 2 * ( apex - e.from[ 1 ] ) / G );
			e.T = e.tUp + Math.sqrt( 2 * ( apex - e.to[ 1 ] ) / G );
			e.apex = apex;

		}

		return E;

	}

	// the ball's place at time u after the bat
	_ballAt( e, u ) {

		const k = Math.min( 1, u / e.T );
		const x = e.from[ 0 ] + ( e.to[ 0 ] - e.from[ 0 ] ) * k, z = e.from[ 2 ] + ( e.to[ 2 ] - e.from[ 2 ] ) * k;
		const y = u < e.tUp ? e.apex - 0.5 * G * ( e.tUp - u ) ** 2 : e.apex - 0.5 * G * ( u - e.tUp ) ** 2;
		return [ x, y, z ];

	}

	update( dt, N, d, camera ) {

		if ( ! this.events ) this.events = this._find( d );
		const P = this.place;
		// a ball on its way to the net: the rows behind it flinch
		if ( N.pitching && N.seg.foul && N.ball && N.ball[ 2 ] > 11.5 && ! this.events.some( ( e ) => e.seg === N.seg ) ) {

			for ( const f of P.fans.list ) {

				if ( f.seat.row > 6 || Math.abs( f.seat.x - N.ball[ 0 ] ) > 3.2 ) continue;
				if ( ! f.acts.some( ( a ) => a.key === 'flinch' ) ) f.act( 'flinch', 0.9 + 0.3 * f.seed, { key: 'flinch', lean: - 0.2, propR: 0, propL: 0, head: [ 0, - 0.1 ] } );

			}

		}

		// the pop fouls
		this.ball = null;
		for ( const e of this.events ) {

			const u = N.t - e.t0;
			if ( u < - 1 || u > e.T + 16 ) continue;
			this._play( e, u, N );

		}

		this.N = N;

	}

	// after the fans have moved: the ball where it is (in the air, or in a hand)
	draw( camera ) {

		const P = this.place, N = this.N;
		if ( ! N ) return;
		// who has a ball to keep: Matty's in his glove from the 29th's on, Mo's on the 27th
		const keep = this._keeper( N );
		if ( keep && ! keep.fan.away ) {

			const [ hl, hr ] = handsOf( keep.fan.p );
			const h = keep.hand === 'L' ? hl : hr;
			this.ball = [ h[ 0 ], h[ 1 ] + ( keep.hand === 'L' ? 0.02 : - 0.04 ), h[ 2 ] ];

		}

		if ( this.ball ) {

			// never under a few pixels on screen (as the replay's own ball)
			let k = 1;
			if ( camera ) {

				const w = P.field.toWorld( this.ball[ 0 ], this.ball[ 2 ] );
				const dist = Math.hypot( w.x - camera.position.x, P.field.y0 + this.ball[ 1 ] - camera.position.y, w.z - camera.position.z );
				k = Math.max( 1, 0.006 * dist * Math.tan( ( camera.fov || 60 ) * Math.PI / 360 ) / 0.045 * 1.2 );

			}

			P.gear.put( GEAR.ball, this.ball[ 0 ], this.ball[ 1 ], this.ball[ 2 ], 0, k );

		}

	}

	// who's holding a ball now
	_keeper( N ) {

		const E = this.events || [];
		const e29 = E.find( ( e ) => e.night === 29 ), e27 = E.find( ( e ) => e.night === 27 );
		if ( e29 && N.t > e29.t0 + e29.T + 5.5 ) return { fan: e29.kid, hand: N.t > e29.t0 + e29.T + 14 ? 'L' : 'R' };
		if ( e29 && N.t > e29.t0 + e29.T ) return { fan: e29.catcher, hand: 'R' };
		if ( e27 && N.first && N.t > e27.t0 + e27.T + 3 && N.t < e27.t0 + e27.T + 16 ) return { fan: e27.finder, hand: 'R' };
		return null;

	}

	_play( e, u, N ) {

		const P = this.place;
		// the replay's own ball (on its way to the net) isn't this one
		if ( u > - 0.1 && u < e.T + 0.2 && P.app?.ball?.mesh ) P.app.ball.mesh.visible = false;
		if ( u >= 0 && u < e.T ) this.ball = this._ballAt( e, u );
		const land = e.to;
		// everyone near where it's coming down: eyes on it, up, hands up
		for ( const f of P.fans.list ) {

			const dx = f.seat.x - land[ 0 ], dz = f.seat.z - land[ 2 ];
			const r = Math.hypot( dx, dz );
			if ( r > 5 || u < 0 ) continue;
			const ball = u < e.T ? this._ballAt( e, u ) : null;
			if ( u < e.T ) {

				const reach = u > e.T - 1.4 && r < 2.2;
				f.act( reach ? 'reachUpBoth' : undefined, 0.3, { key: 'foul', up: u > e.tUp - 0.5 ? 1 : 0, look: ball, mouth: reach ? 0.6 : 0.2 } );

			} else if ( u < e.T + 6 && f !== e.catcher && f !== e.finder && f !== e.kid ) {

				// the row round it: cheering whoever came up with it
				f.act( r < 3 ? 'clap' : 'cheer', 0.3, { key: 'foul', up: 1, look: [ land[ 0 ], land[ 1 ] - 0.3, land[ 2 ] ] } );

			}

		}

		const up = ( f, g, o = {} ) => f.act( g, 0.3, { key: 'foul', up: 1, ...o } );
		if ( e.night === 27 ) {

			// off Pete's hands and down under the seats; Mo and Rick dive for it; Mo comes up with it
			if ( u >= e.T && u < e.T + 0.5 ) up( e.catcher, 'reachUpBoth', { mouth: 0.8 } );
			if ( u >= e.T + 0.5 && u < e.T + 3 ) {

				up( e.catcher, 'head', { mouth: 0.9, head: [ 0, 0.5 ] } );
				for ( const f of [ e.finder, P.regulars.villanova[ 3 ] ] ) if ( f ) up( f, [ armIK( - 1, [ - 0.12, 0.4, - 0.5 ], { lean: 0.9 } ), armIK( 1, [ 0.12, 0.35, - 0.5 ], { lean: 0.9 } ) ], { lean: 0.9, head: [ 0, 0.7 ], up: 0.6 } );
				// the ball rolling under the seat
				const t = ( u - e.T - 0.5 ) / 2.5;
				this.ball = [ land[ 0 ] + t * 0.4, e.finder.seat.y + 0.05, land[ 2 ] - 0.3 ];

			}

			if ( u >= e.T + 3 && u < e.T + 12 ) up( e.finder, 'fist', { mouth: 0.9, propR: 0, head: [ 0, - 0.3 ] } );

		} else {

			// Sean: the catch, the ball held up, then down to the kid
			const S = e.catcher, K = e.kid;
			if ( u >= e.T && u < e.T + 2.5 ) up( S, 'fist', { mouth: 0.9, propR: 0, head: [ 0, - 0.2 ] } );
			if ( u >= e.T + 2.5 && u < e.T + 5.5 ) {

				// leaning down over the row between to the kid, the ball held out
				up( S, [ null, armIK( 1, [ 0.05, 1.0, - 0.75 ], { lean: 0.6 } ) ], { lean: 0.6, head: [ 0, 0.6 ], mouth: 0.4 } );
				K.act( [ null, [ 2.6, 0.2, 0.0, 0.3 ] ], 0.3, { key: 'foul', up: 1, onSeat: true, y: 0.43, turn: Math.PI, head: [ 0, - 0.4 ], mouth: 0.6 } );

			}

			if ( u >= e.T + 5.5 && u < e.T + 16 ) {

				// Matty with the ball held up high; his father's arm round him; his mother's camera
				K.act( 'fist', 0.3, { key: 'foul', up: 1, onSeat: true, y: 0.43, turn: u < e.T + 7 ? Math.PI * ( 1 - ( u - e.T - 5.5 ) / 1.5 ) : 0, mouth: 0.9, propR: 0 } );
				if ( e.dad ) e.dad.act( SEATED.hugR, 0.3, { key: 'foul', up: 1, head: [ 0.6, - 0.2 ], mouth: 0.5 } );
				if ( e.mom ) e.mom.act( 'photo', 0.3, { key: 'foul', up: 1, propR: PROP.camera, head: [ 0.5, 0.1 ] } );
				up( S, 'clap', { mouth: 0.5 } );

			}

		}

	}

}
