import { Mesh, SphereGeometry, CylinderGeometry, BoxGeometry } from '../../../engine/index.js';
import { FOUL_TERRITORY } from '../../layout.js';
import { RAIL, FLAG } from './RailFigures.js';
import { put, rnd } from './Props.js';

// The ball girls: one on a folding chair against the wall down each line, past the photographers' well,
// in the pinstriped jersey, red track pants and the World Series cap, a fielder's glove on her hand.
// She comes forward on her chair when a foul is hooking her way and follows it
// with her eyes. Once a night on each side, between innings, she gets up and walks along the wall to a
// kid who's been hanging on the rail all game with his glove on, and tosses him a ball.
//
//   Jess, first base side, a Temple junior in her first World Series;
//   Caitlin, third base side, her fourth season, who taught Jess how to take a hop off the wall;
//   Tyler, 9, from Cherry Hill, on the first base side with his dad's tickets; on the third base side
//   Maria, 11, in her brother's old glove. On the 29th two other kids, same idea.

const WALK = 1.35; // m/s along the wall

export class BallGirls {

	constructor( { group, figs, M } ) {

		this.figs = figs;
		this.girls = [];
		// [ the dugout's far end, the wall's next point down the line ], her name's seed
		for ( const [ i0, i1, seed, side ] of [ [ 4, 3, 0.62, 1 ], [ 9, 10, 0.41, - 1 ] ] ) {

			const a = FOUL_TERRITORY[ i0 ], b = FOUL_TERRITORY[ i1 ];
			const len = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
			const u = [ ( b[ 0 ] - a[ 0 ] ) / len, ( b[ 1 ] - a[ 1 ] ) / len ];
			let n = [ - u[ 1 ], u[ 0 ] ];
			if ( n[ 0 ] * ( 0 - a[ 0 ] ) + n[ 1 ] * ( - 38.9 - a[ 1 ] ) < 0 ) n = [ - n[ 0 ], - n[ 1 ] ]; // n toward the field
			const at = ( s, t ) => [ a[ 0 ] + u[ 0 ] * s + n[ 0 ] * t, a[ 1 ] + u[ 1 ] * s + n[ 1 ] * t ];
			const faceField = Math.atan2( - n[ 0 ], - n[ 1 ] );
			// her chair, a little out from the wall, turned in toward the infield
			const stoolAt = at( 4.6, 0.55 );
			const sit = Math.atan2( - ( 0 - stoolAt[ 0 ] ), - ( - 20 - stoolAt[ 1 ] ) );
			// her black folding chair (the line, 2008: heston's and qparker71's photos)
			const cs = Math.cos( sit ), sn = Math.sin( sit );
			const at3 = ( lx, ly, lz ) => [ stoolAt[ 0 ] + lx * cs + lz * sn, ly, stoolAt[ 1 ] - lx * sn + lz * cs ];
			put( group, new BoxGeometry( 0.42, 0.03, 0.4 ), M.black, at3( 0, 0.45, 0.02 ), sit, { shadow: true } );
			put( group, new BoxGeometry( 0.42, 0.26, 0.025 ), M.black, at3( 0, 0.8, 0.24 ), sit, { rx: - 0.12 } );
			for ( const lx of [ - 0.19, 0.19 ] ) {

				put( group, new BoxGeometry( 0.02, 0.95, 0.02 ), M.black, at3( lx, 0.47, 0.13 ), sit, { rx: - 0.2 } );
				put( group, new BoxGeometry( 0.02, 0.48, 0.02 ), M.black, at3( lx, 0.23, - 0.08 ), sit, { rx: 0.35 } );

			}

			// a towel over the chair's back, her water bottle under the seat
			put( group, new BoxGeometry( 0.3, 0.2, 0.012 ), M.white, at3( 0.05, 0.84, 0.27 ), sit, { rx: - 0.12 } );
			put( group, new CylinderGeometry( 0.035, 0.035, 0.22, 10 ), M.clear, [ stoolAt[ 0 ] - u[ 0 ] * 0.3, 0.11, stoolAt[ 1 ] - u[ 1 ] * 0.3 ], 0 );
			// where she stands to toss it up, and the kid at the aisle end behind the wall there
			const tossAt = at( 0.45, 0.55 );
			const kidAt = at( 0.35, - 0.7 );
			const girl = {
				sit: figs.add( 'ballGirl', { x: stoolAt[ 0 ], z: stoolAt[ 1 ], yaw: sit, outfit: RAIL.ballGirl, seed, flags: FLAG.cap | FLAG.ponytail, scale: 0.94 } ),
				walk: figs.add( 'ballGirlWalk', { x: stoolAt[ 0 ], z: stoolAt[ 1 ], yaw: sit, outfit: RAIL.ballGirl, seed, flags: FLAG.cap | FLAG.ponytail, scale: 0.94, shown: false } ),
				up: figs.add( 'ballGirlUp', { x: tossAt[ 0 ], z: tossAt[ 1 ], yaw: faceField + Math.PI, outfit: RAIL.ballGirl, seed, flags: FLAG.cap | FLAG.ponytail, scale: 0.94, shown: false } ),
				kid: figs.add( 'kid', { x: kidAt[ 0 ], y: 1.2, z: kidAt[ 1 ], yaw: faceField, outfit: RAIL.kid, seed: rnd( seed * 7 ), flags: FLAG.cap | FLAG.noBall, scale: 0.8 } ),
				stoolAt, tossAt, kidAt, sitYaw: sit, faceField, side, phase: 0,
			};
			// the ball in the air
			girl.ball = new Mesh( new SphereGeometry( 0.037, 8, 6 ), M.white );
			girl.ball.userData.dynamic = true;
			girl.ball.visible = false;
			group.add( girl.ball );
			this.girls.push( girl );

		}

		this.tosses = null;

	}

	// when each toss happens: the first base side after the 2nd and the 7th, the third base side after
	// the 3rd and the 8th (a switch: the half inning's change)
	_plan( d ) {

		this.tosses = [];
		this.tSusp = d.segments.find( ( s ) => s.kind === 'switch' && s.snap.inning === 6 && s.snap.half === 'bottom' ).t0;
		for ( const s of d.segments ) {

			if ( s.kind !== 'switch' || ! s.snap || s.snap.half !== 'top' ) continue;
			const inn = s.snap.inning - 1; // the inning just ended
			if ( inn === 2 || inn === 7 ) this.tosses.push( { girl: 0, t0: s.t0 + 2 } );
			if ( inn === 3 || inn === 8 ) this.tosses.push( { girl: 1, t0: s.t0 + 2 } );

		}

	}

	update( S, dt, director ) {

		if ( ! this.tosses ) this._plan( director );
		const t = S.t;
		this.girls.forEach( ( g, i ) => {

			const { sit, walk, up, kid } = g;
			sit.shown = true; walk.shown = false; up.shown = false;
			g.ball.visible = false;
			// on her chair: forward on it, glove down, when a foul is hooking her way, her eyes on the ball
			const ball = S.ball;
			const mine = ball && S.seg.foul && Math.sign( ball[ 0 ] ) === g.side && Math.abs( ball[ 0 ] ) > 6;
			sit.morph += ( ( mine ? 1 : 0 ) - sit.morph ) * ( 1 - Math.exp( - dt * 6 ) );
			const lookAt = mine ? ball : [ 0, 1, - 0.2 ];
			const want = Math.atan2( - ( lookAt[ 0 ] - g.stoolAt[ 0 ] ), - ( lookAt[ 2 ] - g.stoolAt[ 1 ] ) ) - sit.yaw;
			sit.look[ 0 ] += ( Math.max( - 1.1, Math.min( 1.1, wrap( want ) ) ) - sit.look[ 0 ] ) * ( 1 - Math.exp( - dt * 5 ) );
			// the kid's night: waiting with his glove, then (once he has it) the ball in it for the rest of it
			const night = this.tosses.filter( ( q ) => q.girl === i && ( q.t0 < this.tSusp ) === S.first );
			const T = night.find( ( q ) => t >= q.t0 && t < q.t0 + 20 );
			const had = night.some( ( q ) => t >= q.t0 + 7 );
			kid.seed = S.first ? rnd( g.side * 3 + 1 ) : rnd( g.side * 5 + 2 );
			kid.flags = FLAG.cap | ( had ? 0 : FLAG.noBall );
			kid.morph += ( 0 - kid.morph ) * ( 1 - Math.exp( - dt * 3 ) );
			kid.look[ 0 ] = 0.3 * Math.sin( t * 0.3 + i );
			// the jersey and the cap in the rain too (on the 27th they danced with the Phanatic in it)
			const wetFlags = FLAG.cap | FLAG.ponytail;
			sit.flags = wetFlags;
			walk.flags = wetFlags;
			up.flags = wetFlags;
			const wet = S.first ? S.rain * 0.8 : 0;
			sit.wet = walk.wet = up.wet = wet;
			kid.wet = S.first ? S.rain * 0.5 : 0;
			if ( ! T ) return;
			// the toss: up off the stool, along the wall, the ball up to him, back
			const tau = t - T.t0;
			const dist = Math.hypot( g.tossAt[ 0 ] - g.stoolAt[ 0 ], g.tossAt[ 1 ] - g.stoolAt[ 1 ] );
			const T1 = dist / WALK;
			const out = Math.atan2( - ( g.tossAt[ 0 ] - g.stoolAt[ 0 ] ), - ( g.tossAt[ 1 ] - g.stoolAt[ 1 ] ) );
			const walkTo = ( k, from, to, yaw ) => {

				sit.shown = false; walk.shown = true;
				walk.x = from[ 0 ] + ( to[ 0 ] - from[ 0 ] ) * k;
				walk.z = from[ 1 ] + ( to[ 1 ] - from[ 1 ] ) * k;
				walk.yaw = yaw;
				g.phase += dt * WALK * 5.5;
				walk.morph = Math.sin( g.phase ) * 0.9;
				walk.y = Math.abs( Math.cos( g.phase ) ) * 0.025;

			};

			if ( tau < 0.6 ) return;
			if ( tau < 0.6 + T1 ) walkTo( ( tau - 0.6 ) / T1, g.stoolAt, g.tossAt, out );
			else if ( tau < 0.6 + T1 + 4.2 ) {

				// at the wall: the kid's glove up, her underhand toss, his catch
				const k = tau - 0.6 - T1;
				sit.shown = false; up.shown = true;
				up.x = g.tossAt[ 0 ]; up.z = g.tossAt[ 1 ]; up.yaw = g.faceField + Math.PI;
				up.morph = k < 1.0 ? 0 : k < 1.5 ? ( k - 1.0 ) / 0.5 : k < 3.2 ? 1 : Math.max( 0, 1 - ( k - 3.2 ) / 0.8 );
				up.flags = wetFlags | ( k > 1.4 ? FLAG.noBall : 0 );
				up.look[ 1 ] = - 0.5;
				kid.morph = k < 0.6 ? k / 0.6 : k < 3.4 ? 1 : Math.max( 0, 1 - ( k - 3.4 ) / 0.8 );
				kid.flags = FLAG.cap | ( k > 2.1 ? 0 : FLAG.noBall );
				// the ball's arc from her hand to his glove
				if ( k > 1.4 && k < 2.1 ) {

					const q = ( k - 1.4 ) / 0.7;
					const from = [ g.tossAt[ 0 ], 1.75, g.tossAt[ 1 ] ], to = [ g.kidAt[ 0 ], 2.75, g.kidAt[ 1 ] ];
					g.ball.visible = true;
					g.ball.position.set( from[ 0 ] + ( to[ 0 ] - from[ 0 ] ) * q, from[ 1 ] + ( to[ 1 ] - from[ 1 ] ) * q + 4 * 0.5 * q * ( 1 - q ), from[ 2 ] + ( to[ 2 ] - from[ 2 ] ) * q );

				}

			} else if ( tau < 0.6 + T1 + 4.2 + T1 ) walkTo( ( tau - 0.6 - T1 - 4.2 ) / T1, g.tossAt, g.stoolAt, out + Math.PI );

		} );

	}

}

const wrap = ( a ) => {

	while ( a > Math.PI ) a -= 2 * Math.PI;
	while ( a < - Math.PI ) a += 2 * Math.PI;
	return a;

};
