import { Quaternion, Euler } from '../../engine/index.js';
import * as M from './Motions.js';
import { POSITIONS, BASES, MOUND, DUGOUT, BULLPEN, ON_DECK, boxFor, sprayToField, pitchPath, fallbackPfx, battedBall, throwPath, basePath, dist, lerp2, yawTo } from './Plays.js';
import { look as lookFor } from './Looks.js';
import { OUTFIELD, FT } from '../layout.js';
import { ROLE, DIRT } from './Players.js';
// ---- R (rituals)
import { showSuspension } from './Suspension.js';
import { showCelebration } from './Celebration.js';
import { showWarmups, showDrying } from './Breaks.js';
// ---- end R

// The replay. The whole game is laid out in advance as a timeline of segments (teams taking the field,
// walk-ups, pitches, balls in play, pitching changes, the celebration), each with the state of the game at
// its start and, for the busy ones, a plan (where the ball goes, who runs where, when). Showing a moment
// is a pure function of the time, so the replay can be scrubbed, paused or run at any speed.
//
//   const d = new Director( { game, players, ball } );
//   d.update( dt )              advances (when playing) and poses everyone for this frame
//   d.seek( t ), d.duration, d.playing, d.speed
//   d.onCue = ( cue ) => {}     things to say or sound as playback passes them (not while scrubbing)
//   d.now                       { snap (the game state), seg, pitch, count, desc }

const PACE = { intro: 14, switch: 24, walkup: 6, set: 3.0, after: 2.4, result: 3.0, change: 18, celebrate: 80 };
// ---- R (rituals): the break after the top of the 6th is the suspension, long enough to tell: its first
// 55% (SPLIT) the 27th (the tarp pulled over the infield, the rain delay, the suspension, the park
// emptying into the rain), the rest the 29th (the tarp off, the crew's work, the park filling, the Rays
// out for the bottom of the 6th). The celebration runs on through the trophy and the laps. (A's
// Phanatic and Phanavision already split the suspension at 0.55.)
PACE.suspend = 160;
PACE.celebrate = 300;
export const SPLIT = 0.55;
// ---- end R
const RUN = 7.8, JOG = 4.2, WALK = 1.6;
const SWINGS = new Set( [ 'S', 'F', 'T', 'W', 'L', 'M', 'O', 'Q', 'R', 'X', 'D', 'E' ] );
const FOULS = new Set( [ 'F', 'T', 'L', 'O', 'R' ] );
const POS_ORDER = [ 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF' ];
const hash = ( n ) => {

	const s = Math.sin( n * 12.9898 ) * 43758.5453;
	return s - Math.floor( s );

};
const ease01 = ( x ) => {

	const t = Math.min( 1, Math.max( 0, x ) );
	return t * t * ( 3 - 2 * t );

};

// The base a runner is put out at. The play data counts home plate as base 0, which read as a number is
// "no base" (so Bartlett, out at the plate on Utley's throw, used to stop at third and be called out
// there): as the runner's fourth base it's 4. null (no base: a strikeout, a fly out) stays null.
export const outBaseOf = ( r ) => r.outBase === 0 ? 4 : r.outBase;
// where a runner's move ends: his out base, else the base he reached (or the next one on, for an out
// with no base)
const runTo = ( r, from ) => r.out ? ( outBaseOf( r ) ?? from + 1 ) : ( r.to ?? from );

// the base coaches (first, third) and the managers, who aren't on the roster (Looks.js has their looks)
const COACHES = {
	home: [ { side: 'home', num: '', last: 'LOPES', look: 'lopes' }, { side: 'home', num: '', last: 'SMITH', look: 'smith' } ],
	away: [ { side: 'away', num: '', last: 'HENDRICK', look: 'hendrick' }, { side: 'away', num: '', last: 'FOLEY', look: 'foley' } ],
};
const MANAGERS = {
	home: { side: 'home', num: '', last: 'MANUEL', look: 'manuel' },
	away: { side: 'away', num: '', last: 'MADDON', look: 'maddon' },
};

// Slides: [ the root's distance short of the bag when he goes down, where the root stops ] (m). Head
// first the root is his trailing feet, so it stops a body's length short with his hands on the bag;
// feet first it's under his seat, with the lead foot on the bag.
const SLIDE = { head: [ 4.3, 1.95 ], feet: [ 3.2, 0.72 ] };

export class Director {

	constructor( { game, players, ball } ) {

		this.game = game;
		this.players = players;
		this.ball = ball;
		this.slots = new Map();
		this.segments = [];
		this.t = 0;
		this.speed = 1;
		this.playing = true;
		this.onCue = null;
		this.now = null;
		this.compile();

	}

	get duration() {

		const s = this.segments[ this.segments.length - 1 ];
		return s.t0 + s.dur;

	}

	seek( t ) {

		this.t = Math.max( 0, Math.min( this.duration, t ) );
		this._lastCueT = this.t;

	}

	// the start of the segment for play i (its walk-up)
	timeOfPlay( i ) {

		const s = this.segments.find( ( s ) => s.pi === i && ( s.kind === 'walkup' || s.kind === 'pitch' ) );
		return s ? s.t0 : 0;

	}

	// ---- R (rituals): which night it is, and the radio's clock

	// the suspension's segment (the break after the top of the 6th)
	get suspension() {

		return this._suspSeg ??= this.segments.find( ( s ) => s.kind === 'switch' && s.snap.inning === 6 && s.snap.half === 'bottom' );

	}

	// Which night it is at t: the 27th runs from the first pitch to SPLIT of the way into the suspension
	// (the tarp, the delay, the park emptying), the 29th from there (the tarp off, the park filling, the
	// resumption, the last out). susp: in the suspension's break; k: how far (0..1) into this night's
	// part of it; lt: seconds into the break. Use it for "which night is it?" everywhere.
	night( t = this.t ) {

		const S = this.suspension;
		const split = S.t0 + S.dur * SPLIT;
		const night = t < split ? 27 : 29;
		const susp = t >= S.t0 && t < S.t0 + S.dur;
		const k = ! susp ? 0 : night === 27 ? ( t - S.t0 ) / ( S.dur * SPLIT ) : ( t - split ) / ( S.dur * ( 1 - SPLIT ) );
		return { night, susp, delay: susp && night === 27, back: susp && night === 29, k, lt: susp ? t - S.t0 : 0, dur: S.dur, t0: S.t0, split, resume: S.t0 + S.dur };

	}

	// The radio call (public/audio/radio/game5.mp3) was voiced on the old clock, with a 24 s suspension:
	// its two lines there play at the start of the delay, it's silent through the rest (null), and it
	// picks up again for the last seconds before the resumption.
	radioTime( t = this.t ) {

		const S = this.suspension, OLD = 24, head = 20;
		if ( t < S.t0 + head ) return t;
		if ( t < S.t0 + S.dur - ( OLD - head ) ) return null;
		return t - ( S.dur - OLD );

	}

	// ---- end R

	// ---------------------------------------------------------------- building the timeline

	compile() {

		const g = this.game, P = g.players;
		const segs = this.segments;
		let t = 0;
		const st = { score: { away: 0, home: 0 }, line: [], outs: 0, balls: 0, strikes: 0, inning: 1, half: 'top', bases: [ null, null, null ], desc: '' };
		const snap = ( extra ) => ( {
			...st, score: { ...st.score }, line: st.line.map( ( l ) => l.slice() ), bases: st.bases.slice(), ...extra,
		} );
		const push = ( kind, dur, data = {} ) => {

			const s = { kind, t0: t, dur, ...data };
			segs.push( s );
			t += dur;
			return s;

		};

		// the next batter for each team after play i (for the on-deck circle)
		const nextBatter = ( i ) => {

			const half = g.plays[ i ].half;
			for ( let j = i + 1; j < g.plays.length; j ++ ) if ( g.plays[ j ].half === half && g.plays[ j ].batter !== g.plays[ i ].batter ) return g.plays[ j ].batter;
			return null;

		};

		let prevKey = null, prevDefense = null;
		for ( const [ pi, p ] of g.plays.entries() ) {

			const batting = p.half === 'top' ? 'away' : 'home', fielding = p.half === 'top' ? 'home' : 'away';
			const key = p.inning + p.half;
			let defense = { ...p.defense };
			if ( key !== prevKey ) {

				st.inning = p.inning; st.half = p.half; st.outs = 0;
				st.bases = [ null, null, null ];
				if ( ! st.line[ p.inning - 1 ] ) st.line[ p.inning - 1 ] = [ null, null ];
				st.line[ p.inning - 1 ][ p.half === 'top' ? 0 : 1 ] = 0;
				const inn = `${ p.half === 'top' ? 'Top' : 'Bottom' } of the ${ ordinal( p.inning ) }`;
				// ---- R: the suspension's break (the 27th's delay, then the 29th's return)
				const susp = p.inning === 6 && p.half === 'bottom';
				const breakDur = pi === 0 ? PACE.intro : susp ? PACE.suspend : PACE.switch;
				const breakCues = susp ? [
					[ 1, { say: 'The umpires are waving for the tarp. The grounds crew is on the field.' } ],
					[ PACE.suspend * SPLIT - 30, { say: 'This game is suspended, tied at two. It will be resumed in the bottom of the sixth.' } ],
					[ PACE.suspend * SPLIT + 3, { say: 'Wednesday night, October the twenty-ninth. Game five resumes.' } ],
					[ PACE.suspend - 8, { say: `${ inn }. ${ scoreLine( g, st.score ) }` } ],
				] : null;
				// ---- end R
				push( pi === 0 ? 'intro' : 'switch', breakDur, {
					pi, snap: snap( { batting, fielding, defense, oldDefense: prevDefense, batter: p.batter, bats: p.bats, onDeck: nextBatter( pi ), pitcher: p.pitcher } ),
					cues: breakCues || [ [ 1, { say: pi === 0 ? `${ g.title }. ${ g.teams.away.club } at ${ g.teams.home.club }, ${ g.venue }.` : `${ inn }. ${ scoreLine( g, st.score ) }` } ] ],
				} );
				prevKey = key;

			}

			st.bases = p.bases.slice();
			st.balls = 0; st.strikes = 0;
			const who = P[ p.batter ];
			const base = { pi, batting, fielding, batter: p.batter, bats: p.bats, pitcher: p.pitcher, throws: p.throws, onDeck: nextBatter( pi ) };
			push( 'walkup', PACE.walkup, {
				pi, snap: snap( { ...base, defense } ),
				cues: [ [ 0.8, { say: `Now batting, number ${ who.num }, ${ who.name }.`, pa: true } ] ],
			} );

			// time an in-play plan takes beyond the clock's (borrowed from the result after it)
			let borrow = 0;
			// which pitch each steal / passed ball belongs to
			const evs = p.events;
			const runnerActs = {};
			for ( const [ i, e ] of evs.entries() ) {

				if ( e.t !== 'action' || ! /stolen|caught|passed|wild|pickoff/.test( e.kind || '' ) ) continue;
				const moves = p.runners.filter( ( r ) => r.k === e.k );
				let target = null;
				if ( /passed|wild/.test( e.kind ) ) {

					for ( let j = i - 1; j >= 0 && target === null; j -- ) if ( evs[ j ].t === 'pitch' ) target = j;

				}

				if ( target === null ) for ( let j = i + 1; j < evs.length && target === null; j ++ ) if ( evs[ j ].t === 'pitch' && ! evs[ j ].inPlay ) target = j;
				if ( target === null ) for ( let j = i - 1; j >= 0 && target === null; j -- ) if ( evs[ j ].t === 'pitch' ) target = j;
				( runnerActs[ target ?? i ] ||= [] ).push( { e, moves } );

			}

			for ( const [ i, e ] of evs.entries() ) {

				if ( e.t === 'action' ) {

					if ( e.kind === 'pitching_substitution' && P[ e.player ]?.side === fielding ) {

						const old = defense.P;
						defense = { ...( e.defense || defense ), P: e.player };
						push( 'change', PACE.change, {
							pi, snap: snap( { ...base, defense, pitcher: e.player, oldPitcher: old } ),
							cues: [ [ 2, { say: e.desc } ] ],
						} );

					} else if ( e.defense ) {

						defense = { ...e.defense };

					}

					if ( e.kind === 'offensive_substitution' && e.replaced ) {

						for ( let b = 0; b < 3; b ++ ) if ( st.bases[ b ] === e.replaced ) st.bases[ b ] = e.player;

					}

					if ( runnerActs[ i ] ) {

						// a steal with no pitch to go with it: its own little segment
						const acts = runnerActs[ i ];
						push( 'steal', 6, { pi, snap: snap( { ...base, defense } ), acts, cues: acts.map( ( a ) => [ 2.5, { say: a.e.desc } ] ) } );
						for ( const a of acts ) applyMoves( st, a.moves );

					}

					continue;

				}

				// a pitch
				const pfx = e.pfx || fallbackPfx( e.speed || 88, e.px || 0, e.pz || 2.5 );
				const path = pitchPath( pfx );
				const swing = SWINGS.has( e.call );
				const acts = runnerActs[ i ] || [];
				const hasPlay = e.inPlay && p.hit;
				const dur = PACE.set + M.REL + ( hasPlay ? path.flight : path.toCatcher + PACE.after + ( acts.length ? 1.5 : 0 ) );
				const pitchSnap = snap( { ...base, defense } );
				const seg = push( 'pitch', dur, {
					pi, ev: e, snap: pitchSnap, path, swing, foul: FOULS.has( e.call ), acts,
					cues: this._pitchCues( p, e, path, hasPlay ),
				} );
				seg.foulPath = seg.foul ? foulBall( i + pi * 31 ) : null;
				for ( const a of acts ) applyMoves( st, a.moves );
				st.balls = e.count[ 0 ]; st.strikes = e.count[ 1 ];
				if ( hasPlay ) {

					// The replay's clock stays as it was voiced (the radio call is one track on it,
					// public/audio/radio/game5.mp3): the play keeps the length the old plan gave it, and
					// a play that needs longer now (the tag at the plate, the cut-off throw) borrows it
					// from the result after it, so nothing later moves
					const plan = this._planInPlay( p, e, defense, st );
					const clock = legacyInPlayDur( g, p, e, defense );
					borrow = Math.min( PACE.result - 0.6, Math.max( 0, plan.dur - clock ) );
					plan.dur = clock + borrow;
					push( 'inplay', plan.dur, { pi, ev: e, snap: snap( { ...base, defense } ), plan, cues: plan.cues } );

				}

			}

			// the play's outcome: runners' last moves (walks, and the ones the in-play plan animated)
			const last = evs.filter( ( e ) => e.t === 'pitch' ).pop();
			const finalMoves = p.runners.filter( ( r ) => last && r.k === last.k );
			const before = snap( { ...base, defense } );
			applyMoves( st, finalMoves );
			const outsNow = st.outs + finalMoves.filter( ( r ) => r.out ).length;
			const scored = ( p.result.away + p.result.home ) - ( st.score.away + st.score.home );
			const inn = st.line[ p.inning - 1 ];
			inn[ p.half === 'top' ? 0 : 1 ] += Math.max( 0, scored );
			st.score = { away: p.result.away, home: p.result.home };
			st.outs = Math.min( 3, outsNow );
			st.desc = p.result.desc;
			const isLast = pi === g.plays.length - 1;
			push( 'result', isLast ? 1.2 : PACE.result - borrow, {
				pi, before, moves: p.hit ? [] : finalMoves, snap: snap( { ...base, defense } ),
				cues: [ [ 0.2, { say: p.result.desc + ( scored > 0 ? ' ' + scoreLine( g, st.score ) + '.' : '' ), result: p.result, scored, batting } ] ],
			} );
			prevDefense = defense;

		}

		// the last out: the celebration
		const lastPlay = g.plays[ g.plays.length - 1 ];
		push( 'celebrate', PACE.celebrate, {
			pi: g.plays.length - 1,
			snap: snap( { batting: 'away', fielding: 'home', defense: { ...lastPlay.defense, P: lastPlay.pitcher }, batter: lastPlay.batter, bats: lastPlay.bats, pitcher: lastPlay.pitcher, throws: lastPlay.throws } ),
			plan: this._planCelebration( lastPlay ),
			cues: [ [ 0.3, { say: `Swing and a miss! The Philadelphia Phillies are World Series champions!`, champions: true } ] ],
		} );

		// the slides (for the dirt on the seat of their pants): the base stealers, and the runners who
		// took two bases or more on a hit
		this.slides = new Map();
		const slid = ( id, t ) => ( this.slides.get( id ) || this.slides.set( id, [] ).get( id ) ).push( t );
		for ( const sg of segs ) {

			for ( const a of sg.acts || [] ) for ( const mv of a.moves ) if ( /stolen|caught/.test( a.e.kind || '' ) ) slid( mv.id, sg.t0 + 2 );
			if ( sg.kind === 'inplay' ) for ( const r of sg.plan.runners ) if ( ( r.to - r.from >= 2 && r.to < 4 ) || r.out ) slid( r.id, sg.t0 + r.tArrive );

		}

	}

	// How dirty a player's uniform has got (Players.js: DIRT bits + the amount): it builds through the
	// night (the first night's rain-soaked clay faster), where it shows by what he plays (the catcher all
	// over, the infielders' knees and fronts, a pitcher's drag knee) and by his slides. The 29th starts
	// with clean uniforms.
	_dirt( id, seg ) {

		const s = seg.snap, info = this.game.players[ id ];
		if ( ! s || ! info ) return 0;
		const night2 = s.inning > 6 || ( s.inning === 6 && s.half === 'bottom' );
		const halves = night2 ? ( s.inning - 6 ) * 2 + ( s.half === 'bottom' ? 0 : - 1 ) : ( s.inning - 1 ) * 2 + ( s.half === 'bottom' ? 1 : 0 );
		const pos = Object.keys( s.defense || {} ).find( ( k ) => s.defense[ k ] === id ) || info.pos;
		let bits = 0, k = 0.5;
		if ( pos === 'C' ) { bits = DIRT.knees | DIRT.seat; k = 1.3; }
		else if ( pos === 'P' ) { bits = info.throws === 'L' ? DIRT.dragL : DIRT.dragR; k = 0.9; }
		else if ( pos === 'SS' || pos === '2B' || pos === '3B' ) { bits = DIRT.knees | DIRT.front; k = 0.9; }
		else if ( pos === '1B' ) { bits = DIRT.knees; k = 0.7; }
		else bits = DIRT.knees;
		let amount = ( 0.1 + Math.max( 0, halves ) * ( night2 ? 0.07 : 0.09 ) ) * k;
		const t0 = night2 ? ( this._night2 ??= this.segments.find( ( q ) => q.snap && q.snap.inning === 6 && q.snap.half === 'bottom' ).t0 ) : 0;
		for ( const t of this.slides.get( id ) || [] ) if ( t <= this.t && t >= t0 ) { bits |= DIRT.seat; amount += 0.3; }
		return bits + Math.min( 0.95, amount );

	}

	_pitchCues( p, e, path, hasPlay ) {

		const P = this.game.players;
		const pitcher = P[ p.pitcher ];
		const cues = [ [ PACE.set + 0.2, { say: this._pitchCall( e, pitcher ), pitch: true } ] ];
		cues.push( [ PACE.set + M.REL + path.flight, { contact: SWINGS.has( e.call ) && e.call !== 'S' && e.call !== 'W' && e.call !== 'M', inPlay: hasPlay, call: e.call } ] );
		if ( ! hasPlay ) cues.push( [ PACE.set + M.REL + path.toCatcher, { mitt: ! FOULS.has( e.call ) } ] );
		return cues;

	}

	_pitchCall( e, pitcher ) {

		const [ b, s ] = e.count;
		const kind = ( e.typeName || 'pitch' ).replace( 'Four-Seam ', '' ).replace( 'Two-Seam ', '' ).toLowerCase();
		const mph = e.speed ? `${ Math.round( e.speed ) }` : '';
		const call = {
			B: 'ball', '*B': 'in the dirt, ball', C: 'called strike', S: 'swing and a miss', F: 'fouled back', T: 'foul tip',
			X: 'hit into play', D: 'hit into play', E: 'hit into play', H: 'hit by the pitch',
		}[ e.call ] || e.desc.toLowerCase();
		const count = e.inPlay ? '' : ` ${ b } and ${ s }.`;
		return `${ pitcher.last } deals. ${ mph } ${ kind }, ${ call }.${ count }`;

	}

	// ---------------------------------------------------------------- balls in play

	// Who fields it, where the ball goes (batted, then thrown round the bases), where everyone runs.
	_planInPlay( p, e, defense, st ) {

		const g = this.game;
		const h = p.hit;
		const contact = [ ( p.bats === 'L' ? 0.25 : - 0.25 ), - 0.55 ];
		let to = h.x != null ? sprayToField( h.x, h.y ) : [ 0, - 60 ];
		const hr = /home_run/.test( p.result.type );
		const traj = h.traj || 'fly_ball';
		const posOf = ( id ) => Object.keys( defense ).find( ( k ) => defense[ k ] === id );
		const idAt = ( pos ) => defense[ pos ];
		const moves = p.runners.filter( ( r ) => r.k === e.k );
		// the fielder who gets to it: the first one credited, else the one at the hit's location
		const credits = moves.flatMap( ( r ) => r.credits );
		const locPos = POS_ORDER[ Number( h.loc ) - 1 ];
		let first = credits.find( ( c ) => /fielded|assist|putout|error/.test( c[ 1 ] ) );
		let fielderPos = first ? first[ 0 ] : locPos;
		if ( ! idAt( fielderPos ) ) fielderPos = locPos || 'CF';
		// an infield single on the ground was slow getting there (a chopper, a roller), or he'd have
		// been thrown out: Iwamura's chopper up the middle that Utley got to behind second
		const infieldHit = traj === 'ground_ball' && p.result.type === 'single' && [ 'P', 'C', '1B', '2B', 'SS', '3B' ].includes( fielderPos );
		const bb = battedBall( traj, infieldHit ? 'soft' : h.hard, contact, to, p.i );
		const plan = { ball: [], fielders: {}, runners: [], cues: [], hr, bb, contact };
		plan.ball.push( { t0: 0, dur: bb.time, at: bb.at } );
		let tBall = bb.time;
		const fielder = idAt( fielderPos );
		const home = POSITIONS[ fielderPos ];
		const run = ( id, from, pts ) => ( plan.fielders[ id ] ||= [] ).push( ...pts.map( ( q ) => ( { ...q, from } ) ) );

		const airOut = ! hr && moves.some( ( r ) => r.start === 0 && r.out && r.credits.some( ( c ) => c[ 1 ] === 'f_putout' && c[ 0 ] === fielderPos ) ) && traj !== 'ground_ball' && traj !== 'bunt_grounder';
		if ( hr ) {

			// everyone watches it go; the outfielder drifts back to the wall
			const pos = locPos || 'LF';
			if ( idAt( pos ) ) run( idAt( pos ), POSITIONS[ pos ], [ { t0: 0.3, t1: 3.2, to: lerp2( POSITIONS[ pos ], to, 0.6 ), act: 'run' }, { t0: 3.2, t1: 99, to: lerp2( POSITIONS[ pos ], to, 0.6 ), act: 'watch' } ] );
			// on into the seats
			const far = lerp2( contact, to, 1.12 );
			const end = battedBall( 'fly_ball', 'hard', to, far, 1 );
			plan.ball.push( { t0: bb.time, dur: 0.5, at: ( t ) => { const q = end.at( end.time * 0.2 + t * 0.4 ); return [ q[ 0 ], Math.max( 8, q[ 1 ] ), q[ 2 ] ]; } } );
			plan.cues.push( [ 0.1, { crack: 'hard', cheer: p.half === 'bottom' ? 2 : - 1 } ] );

		} else {

			// run to it: for a catch, arrive as it comes down; otherwise pick it up
			// (FB2, C2B-3: a ball off the wall is played off the wall, from in front of it: the spot can be
			// in the padding, and Upton stood behind the wall playing Jenkins's double)
			const spot = airOut ? to : insideFence( to, 1.3 );
			const d = dist( home, spot );
			const reach = d / RUN;
			const tArrive = airOut ? Math.max( bb.time - 0.2, Math.min( bb.time, reach ) ) : Math.max( bb.time, reach + 0.3 );
			run( fielder, home, [ { t0: 0.25, t1: Math.max( 0.3, tArrive ), to: spot, act: d > 3 ? 'run' : 'shuffle' } ] );
			// (off the wall it caroms back out to him)
			const tField = Math.max( bb.time + ( spot !== to ? 0.3 : 0 ), tArrive );
			const grab = airOut ? 'catch' : ( bb.ground ? 'grounder' : 'pickup' );
			run( fielder, spot, [ { t0: tField - 0.1, t1: tField + 0.5, to: spot, act: grab } ] );
			if ( ! airOut && tField > bb.time ) plan.ball.push( { t0: bb.time, dur: tField - bb.time, at: rolling( spot, bb.at( bb.time ), tField - bb.time ) } );
			tBall = tField + 0.5;
			plan.cues.push( [ 0.02, { crack: h.hard || 'medium' } ], [ tField, { glove: true } ] );

			// the throws: to each out's putout man at the out base, in order
			let holder = { id: fielder, at: spot, pos: fielderPos };
			const outs = moves.filter( ( r ) => r.out && outBaseOf( r ) != null ).sort( ( a, b ) => ( a.outNumber ?? 9 ) - ( b.outNumber ?? 9 ) );
			// a runner is forced when every base behind him is taken (the batter takes first)
			const forced = ( from ) => {

				for ( let b = 1; b < from; b ++ ) if ( ! st.bases[ b - 1 ] ) return false;
				return true;

			};
			const batterSafe = moves.some( ( r ) => r.id === p.batter && ! r.out );
			for ( const r of outs ) {

				const put = r.credits.find( ( c ) => c[ 1 ] === 'f_putout' );
				if ( ! put ) continue;
				const target = idAt( put[ 0 ] ) || put[ 2 ];
				if ( target === holder.id && airOut ) continue;
				const ob = outBaseOf( r );
				const baseAt = BASES[ ob % 4 ];
				if ( target === holder.id ) {

					// he takes it himself: run to the base
					run( target, holder.at, [ { t0: tBall, t1: tBall + dist( holder.at, baseAt ) / RUN, to: baseAt, act: 'run' } ] );
					tBall += dist( holder.at, baseAt ) / RUN;
					r.tOut = tBall;
					holder = { id: target, at: baseAt, pos: put[ 0 ] };
					continue;

				}

				// A tag play at the plate (Utley to Ruiz on Bartlett, the top of the 7th on the 29th): the
				// catcher takes the throw a stride out in front of the plate toward third, then dives back
				// across for the runner's slide. The ball beats him by a step.
				const tag = ob === 4 && ( r.start || 0 ) > 0 && ! forced( r.start || 0 );
				const catchAt = tag ? [ - 0.6, - 1.6 ] : ob % 4 === 1 ? [ baseAt[ 0 ] - 0.3, baseAt[ 1 ] - 0.3 ] : baseAt;
				// an infielder who can't get the batter at first looks at him there and pumps before he
				// turns and throws home (Utley's fake to first)
				if ( tag && batterSafe && [ '1B', '2B', 'SS', '3B' ].includes( holder.pos ) ) {

					run( holder.id, holder.at, [ { t0: tBall - 0.05, t1: tBall + 1.0, to: holder.at, act: 'fake', aim: BASES[ 1 ] } ] );
					tBall += 1.0;

				}

				// the receiver covers the base; the throw is caught chest high (at first, the stretch)
				const rPos = posOf( target ) || put[ 0 ];
				const rHome = POSITIONS[ rPos ] || baseAt;
				const th = throwPath( holder.at, catchAt, tag ? 24 : 30 );
				const tCatch = tBall + 0.3 + th.time;
				run( target, rHome, [ { t0: 0.4, t1: Math.min( tBall + 0.3, 0.4 + dist( rHome, catchAt ) / RUN ), to: catchAt, act: 'run' }, { t0: tBall + 0.3, t1: tCatch + ( tag ? 3 : 1.2 ), to: catchAt, act: 'receive', tCatch, thrower: holder.at, base: ob % 4, tag, runner: r.id } ] );
				run( holder.id, holder.at, [ { t0: tBall - 0.1, t1: tBall + 0.4, to: holder.at, act: 'throw', aim: catchAt } ] );
				plan.ball.push( { t0: tBall + 0.3, dur: th.time, at: th.at } );
				plan.cues.push( [ tCatch, { glove: true } ] );
				tBall = tCatch;
				r.tOut = tBall;
				r.tag = tag;
				holder = { id: target, at: catchAt, pos: rPos };

			}

			// A hit: the ball comes back in. With a runner going home the outfielder throws home through
			// the cut-off man, the first baseman (the third baseman from left field), set up between the
			// mound and the plate, who holds it with the run in (Pena on the mound on Feliz's single, Getty
			// 83486150); the catcher straddles the plate's front, off the runner's line; the pitcher backs
			// up the plate. Otherwise to the base ahead of the lead runner (second, or third if he's going
			// there), a middle infielder (or the third baseman) covering, the pitcher backing up third.
			if ( ! outs.length && ! airOut ) {

				const lead = Math.max( 1, ...moves.filter( ( r ) => ! r.out ).map( ( r ) => runTo( r, r.start || 0 ) ) );
				const pid = idAt( 'P' ), cid = idAt( 'C' );
				let cut, cPos;
				if ( lead >= 4 ) {

					cPos = to[ 0 ] < - 12 ? '3B' : '1B';
					cut = lerp2( [ 0, 0 ], to, Math.min( 0.6, 15 / Math.max( 1, dist( [ 0, 0 ], to ) ) ) );
					if ( cid && cid !== holder.id ) run( cid, POSITIONS.C, [ { t0: 0.6, t1: 1.6, to: [ 0.7, - 0.6 ], act: 'run' }, { t0: 1.6, t1: tEndGuess( tBall ), to: [ 0.7, - 0.6 ], act: 'receive', thrower: to, base: 0 } ] );
					if ( pid && pid !== holder.id ) run( pid, MOUND, [ { t0: 0.7, t1: 0.7 + dist( MOUND, [ - 2.5, 8.5 ] ) / JOG, to: [ - 2.5, 8.5 ], act: 'run' } ] );

				} else {

					const base = lead >= 3 ? 3 : 2;
					cut = BASES[ base ];
					cPos = base === 3 ? '3B' : to[ 0 ] > 0 ? '2B' : 'SS';
					if ( base === 3 && pid && pid !== holder.id ) run( pid, MOUND, [ { t0: 0.7, t1: 0.7 + dist( MOUND, [ - 25.5, - 13 ] ) / JOG, to: [ - 25.5, - 13 ], act: 'run' } ] );

				}

				const cover = idAt( cPos );
				if ( cover && cover !== holder.id ) {

					const cHome = POSITIONS[ cPos ];
					const th = throwPath( holder.at, cut, 26 );
					// (the cut-off man hustles out there; the others jog to the bag)
					const tc = 0.5 + dist( cHome, cut ) / ( lead >= 4 ? RUN * 0.75 : JOG );
					run( cover, cHome, [ { t0: 0.5, t1: tc, to: cut, act: 'run' }, { t0: Math.max( tc, tBall + 0.4 ), t1: tBall + 2.5, to: cut, act: 'receive', tCatch: tBall + 0.35 + th.time, thrower: holder.at, base: lead >= 4 ? - 1 : lead >= 3 ? 3 : 2 } ] );
					run( holder.id, holder.at, [ { t0: tBall, t1: tBall + 0.5, to: holder.at, act: 'throw', aim: cut } ] );
					plan.ball.push( { t0: tBall + 0.35, dur: th.time, at: th.at } );
					tBall += 0.35 + th.time;
					if ( lead >= 4 ) plan.cutT = tBall;

				}

			}

			plan.cues.push( [ Math.min( tField + 0.3, tBall ), { cheer: cheerFor( p ) } ] );

		}

		// the runners (and the batter): base to base; outs stop at the base and head off
		let tEnd = tBall;
		for ( const r of moves ) {

			const from = r.start || 0;
			const toBase = runTo( r, from );
			// with two out the runners go on contact
			const start = from === 0 ? 0.55 : st.outs >= 2 ? 0.05 : 0.2;
			const len = Math.max( 0, toBase - from ) * 27.43;
			// a runner starts from his lead, not the bag (_runners: a few steps off first and second, a
			// stride down the line from third)
			const lead = from === 0 || airOut ? 0 : Math.min( len, from === 3 ? 1.6 : 3.3 );
			let speed = RUN * ( r.id === p.batter ? 0.95 : 1 );
			let tArrive = start + ( len - lead ) / speed;
			// on a fly out the runners hold
			if ( airOut && r.id !== p.batter ) tArrive = start;
			// a tag play: he gets there a step after the ball (as fast as a man can go), and slides; a
			// forced out: just after the ball
			if ( r.out && r.tOut != null && len > 0 ) tArrive = r.tag ? Math.max( r.tOut + 0.3, start + ( len - lead ) / 8.9 ) : Math.max( r.tOut + 0.25, tArrive );
			if ( airOut && r.id === p.batter ) tArrive = Math.min( tArrive, bb.time );
			// a runner scoring as the throw comes in slides (Upton in the rain on Pena's single, Getty
			// 84081866); well ahead of it he comes in standing (Bruntlett, Getty 83486150)
			const close = ! r.out && toBase === 4 && from > 0 && plan.cutT != null && Math.abs( tArrive - plan.cutT ) < 1.6;
			const slide = r.tag ? ( toBase === 4 ? 'head' : 'feet' ) : close ? 'feet' : null;
			// the batter on a ground ball in the infield runs through first
			const through = from === 0 && toBase === 1 && bb.ground && [ 'P', 'C', '1B', '2B', 'SS', '3B' ].includes( fielderPos );
			plan.runners.push( { id: r.id, from, to: toBase, start, tArrive, out: r.out, scores: toBase >= 4, halt: airOut && r.id === p.batter ? 0.6 : 1, lead, len, slide, through, tCall: r.tag ? tArrive : r.tOut } );
			tEnd = Math.max( tEnd, tArrive + ( slide ? 2 : 0 ) );

		}

		plan.dur = Math.max( tEnd, tBall ) + 2.2 + ( hr ? 6 : 0 );
		void g; void st;
		return plan;

	}

	_planCelebration( p ) {

		const g = this.game, P = g.players;
		const onField = new Set( Object.values( p.defense ) );
		const bench = Object.keys( P ).map( Number ).filter( ( id ) => P[ id ].side === 'home' && ! onField.has( id ) && id !== p.pitcher );
		return { bench, pile: bench.length };

	}

	// ---------------------------------------------------------------- the scoreboard's view of the game

	// What the scoreboard shows now: line score with hits and errors, the count, the batter and his day,
	// who's due up, the batting team's lineup, and what the video board is showing.
	boardState() {

		const g = this.game, P = g.players;
		const seg = this.segmentAt( this.t );
		const s = seg.snap, pi = seg.pi ?? 0;
		const done = ( i ) => i < pi || ( i === pi && ( seg.kind === 'result' || seg.kind === 'celebrate' ) );
		const hits = { away: 0, home: 0 }, errors = { away: 0, home: 0 };
		const today = [];
		const lineup = { away: g.lineups.away.map( ( l ) => l.id ), home: g.lineups.home.map( ( l ) => l.id ) };
		const posOf = {};
		for ( const side of [ 'away', 'home' ] ) for ( const l of g.lineups[ side ] ) posOf[ l.id ] = l.pos;
		for ( const [ i, p ] of g.plays.entries() ) {

			if ( i > pi ) break;
			const bat = p.half === 'top' ? 'away' : 'home', fld = p.half === 'top' ? 'home' : 'away';
			for ( const e of p.events ) {

				if ( e.t !== 'action' || ! e.sub || ! e.player ) continue;
				const team = P[ e.player ]?.side;
				if ( ! team ) continue;
				let spot = e.bo ? e.bo - 1 : lineup[ team ].indexOf( e.replaced );
				if ( spot < 0 && e.kind === 'pitching_substitution' ) spot = lineup[ team ].findIndex( ( id ) => posOf[ id ] === 'P' );
				if ( spot >= 0 && spot < 9 ) lineup[ team ][ spot ] = e.player;
				if ( e.pos ) posOf[ e.player ] = e.pos;

			}

			if ( ! done( i ) ) continue;
			if ( /single|double|triple|home_run/.test( p.result.type ) ) hits[ bat ] ++;
			for ( const r of p.runners ) for ( const c of r.credits ) if ( /error/.test( c[ 1 ] ) ) errors[ fld ] ++;
			if ( p.batter === s.batter ) today.push( `${ ordinal( p.inning ).toUpperCase() }- ${ shortResult( p ) }` );

		}

		// the pitcher's pitches so far (balls / strikes, counting fouls and balls in play as strikes)
		let pb = 0, ps = 0, lastPitch = null;
		const now = this.t;
		for ( const sg of this.segments ) {

			if ( sg.t0 > now ) break;
			if ( sg.kind !== 'pitch' || sg.t0 + PACE.set + M.REL > now ) continue;
			// the last pitch thrown, for the pitch speed boards
			if ( sg.t0 + PACE.set + M.REL + sg.path.flight <= now ) lastPitch = { speed: sg.ev.speed, type: sg.ev.typeName, pk: sg.t0 };
			if ( sg.snap.defense.P !== s.pitcher ) continue;
			if ( /B|\*B|I|P|V|H/.test( sg.ev.call ) && ! /^[SCFTXDEWLMOQR]/.test( sg.ev.call ) ) pb ++; else ps ++;

		}

		const team = s.batting || 'away';
		const order = lineup[ team ];
		const at = Math.max( 0, order.indexOf( s.batter ) );
		const dueUp = [ 1, 2, 3 ].map( ( k ) => P[ order[ ( at + k ) % 9 ] ] ).filter( Boolean ).map( ( q ) => `${ q.num } ${ q.last.toUpperCase() }` );
		const b = P[ s.batter ];
		let video = { kind: 'batter' };
		if ( seg.kind === 'intro' ) video = { kind: 'title' };
		if ( seg.kind === 'switch' ) video = { kind: 'inning' };
		if ( seg.kind === 'celebrate' ) video = { kind: 'final' };
		if ( seg.kind === 'change' ) video = { kind: 'pitcher', name: P[ s.pitcher ]?.name, num: P[ s.pitcher ]?.num };
		return {
			teams: { away: g.teams.away, home: g.teams.home },
			line: s.line, score: s.score, hits, errors,
			inning: s.inning, half: s.half, count: this.now ? this.now.count : [ s.balls, s.strikes ], outs: seg.kind === 'celebrate' ? 3 : s.outs,
			batter: b ? { num: b.num, last: b.last.toUpperCase(), name: b.name.toUpperCase(), pos: posOf[ s.batter ] || b.pos } : null,
			today, dueUp, batting: team,
			lineup: order.map( ( id ) => ( { num: P[ id ]?.num || '', last: ( P[ id ]?.last || '' ).toUpperCase(), pos: posOf[ id ] || P[ id ]?.pos || '', up: id === s.batter } ) ),
			video, lastPitch,
			pitcher: P[ s.pitcher ] ? { num: P[ s.pitcher ].num, last: P[ s.pitcher ].last.toUpperCase(), balls: pb, strikes: ps } : null,
		};

	}

	// ---------------------------------------------------------------- showing a moment

	update( dt ) {

		if ( this.playing ) {

			const before = this.t;
			this.t = Math.min( this.duration, this.t + dt * this.speed );
			if ( this.t >= this.duration ) this.playing = false;
			this._cues( before, this.t );

		}

		this.pose( this.t );

	}

	_cues( a, b ) {

		if ( ! this.onCue || b <= a || b - a > 2 ) return;
		for ( const s of this.segments ) {

			if ( s.t0 + s.dur < a || s.t0 > b ) continue;
			for ( const [ lt, cue ] of s.cues || [] ) {

				const ct = s.t0 + lt;
				if ( ct > a && ct <= b ) this.onCue( cue, s );

			}

		}

	}

	segmentAt( t ) {

		const S = this.segments;
		let lo = 0, hi = S.length - 1;
		while ( lo < hi ) {

			const m = ( lo + hi + 1 ) >> 1;
			if ( S[ m ].t0 <= t ) lo = m; else hi = m - 1;

		}

		return S[ lo ];

	}

	pose( t ) {

		const seg = this.segmentAt( t );
		const lt = t - seg.t0;
		this.actors = new Map();
		this.ballAt = null;
		// where the cameras look for the ball: where it is, or (in a glove) where it was last
		this.ballFocus = null;
		this._stealCall = null;
		this._stealBall = false;
		this.now = { seg, snap: seg.snap, count: [ Math.min( 3, seg.snap.balls ), Math.min( 2, seg.snap.strikes ) ], outs: seg.snap.outs, desc: seg.snap.desc, pitch: null };
		this[ 'show_' + seg.kind ]( seg, lt );
		if ( this.ballFocus == null ) this.ballFocus = this.ballAt;
		this._umpires( seg, lt );
		this._coaches( seg, lt );
		this._sync();

	}

	// the World Series crew of six: the plate umpire in the slot behind the catcher, the three base
	// umpires, and one down each foul line in the outfield. Set for the pitch, standing between them; off
	// the field in the rain delay
	_umpires( seg, lt ) {

		const s = seg.snap || {};
		if ( seg.kind === 'switch' && s.inning === 6 && s.half === 'bottom' ) return;
		// ---- R (rituals): at the last out they walk off (game/Celebration.js)
		if ( seg.kind === 'celebrate' && ! this.oldCelebration ) return;
		// ---- end R
		const pitching = seg.kind === 'pitch' && lt - PACE.set > - 0.6;
		const runners = ( s.bases || [] ).some( Boolean );
		const r2 = Math.SQRT1_2;
		const crew = [
			// (in the slot between the catcher and the batter: on the third base side for a right-handed
			// hitter, the first base side for a lefty)
			[ - 1, [ s.bats === 'L' ? 0.32 : - 0.32, 2.0 ], pitching ? M.umpSet( lt ) : M.stand( lt + 1 ), ROLE.bag | ( seg.kind === 'inplay' ? 0 : ROLE.mask ) ],
			[ - 2, [ 19.4 + 2.2 * r2 + 1.2 * r2, - 19.4 - 2.2 * r2 + 1.2 * r2 ], pitching ? M.umpReady( lt ) : M.stand( lt + 2 ) ],
			// ---- FB2 (C2B-5): the second base umpire as 2008's four-man crews worked it, and out of FOX's
			// center field frame as he was in theirs (t11710s, bases empty: nobody but the battery, the batter
			// and the plate umpire; t13150s, a runner on second: only the runner's cap): with the bases empty
			// on the grass behind second, a little to the shortstop's side; a runner on first only, inside on
			// the first base side of the mound; with a man in scoring position, inside on the shortstop side
			[ - 3, ! runners ? [ - 4, - 47 ] : s.bases[ 1 ] || s.bases[ 2 ] ? [ - 9, - 30 ] : [ 7, - 29 ], pitching ? M.umpReady( lt ) : M.stand( lt + 3 ) ],
			// ---- end FB2
			[ - 4, [ - 19.4 - 2.2 * r2 - 1.2 * r2, - 19.4 - 2.2 * r2 + 1.2 * r2 ], pitching ? M.umpReady( lt ) : M.stand( lt + 4 ) ],
			[ - 5, [ - 70 * r2 - 1.2, - 70 * r2 + 1.2 ], M.stand( lt + 5 ) ],
			[ - 6, [ 70 * r2 + 1.2, - 70 * r2 + 1.2 ], M.stand( lt + 6 ) ],
		];
		// the calls: the plate umpire's called strike (strike three punched out, a swinging third strike
		// hammered), both arms up on a foul; the base umpires' outs at their bags; the line umpire's twirl on
		// a home run
		if ( seg.kind === 'pitch' ) {

			const e = seg.ev, tc = lt - PACE.set - M.REL - seg.path.toCatcher;
			const three = e.count[ 1 ] >= 3;
			if ( tc > 0 && ( e.call === 'C' || ( three && ( e.call === 'S' || e.call === 'W' || e.call === 'T' ) ) ) ) crew[ 0 ][ 2 ] = M.umpStrike( tc, three );
			const tf = lt - PACE.set - M.REL - seg.path.flight;
			if ( seg.foul && tf > 0.2 && ! three ) crew[ 0 ][ 2 ] = M.umpArmsUp( tf - 0.2 );

		}

		// a steal: the base umpire's call as the runner slides in (show_pitch / show_steal set it)
		const sc = this._stealCall;
		if ( sc && ( seg.kind === 'pitch' || seg.kind === 'steal' ) ) {

			const d = lt - ( seg.kind === 'pitch' ? PACE.set : 0.8 );
			const tr = d - sc.t;
			if ( tr > 0 && tr < 1.8 ) crew[ sc.base === 3 ? 3 : 2 ][ 2 ] = M.umpCall( tr, sc.out );

		} else if ( seg.kind === 'inplay' ) {

			// a runner coming home: the plate umpire takes off his mask and goes out to the third base line,
			// in foul ground, to see the play at the plate (as on Utley's throw), and watches from there
			const home = seg.plan.runners.find( ( r ) => r.to === 4 && r.from > 0 && r.tArrive > 1 );
			if ( home ) {

				const k = ease01( ( lt - 0.7 ) / Math.max( 0.8, Math.min( 2, home.tArrive - 1.2 ) ) );
				const spot = [ - 2.6, 0.2 ];
				const p = lerp2( crew[ 0 ][ 1 ], spot, k );
				crew[ 0 ][ 1 ] = p;
				crew[ 0 ][ 2 ] = k > 0 && k < 1 ? M.run( lt * 1.3, 0.2 ) : k >= 1 ? M.umpReady( lt ) : crew[ 0 ][ 2 ];
				crew[ 0 ][ 3 ] = ROLE.bag;
				crew[ 0 ][ 4 ] = k > 0 && k < 1 ? yawTo( crew[ 0 ][ 1 ], spot ) : yawTo( p, [ - 0.7, - 0.7 ] );

			}

			for ( const r of seg.plan.runners ) {

				const tr = lt - ( r.out && r.tCall != null ? r.tCall : r.tArrive );
				if ( ! r.out || tr < 0 || tr > 1.8 ) continue;
				const b = r.to % 4;
				const u = b === 1 ? 1 : b === 2 ? 2 : b === 3 ? 3 : 0;
				crew[ u ][ 2 ] = M.umpCall( tr, true );

			}

			if ( seg.plan.hr && lt > seg.plan.bb.time && lt < seg.plan.bb.time + 4 ) {

				const to = seg.plan.bb.at( seg.plan.bb.time );
				crew[ to[ 0 ] < 0 ? 4 : 5 ][ 2 ] = M.umpTwirl( lt - seg.plan.bb.time );

			}

		}

		for ( const [ id, at, pose, role, yaw ] of crew ) {

			pose.glove = false;
			const look = id === - 1 ? MOUND : [ 0, - 5 ];
			this.act( id, at[ 0 ], at[ 1 ], yaw ?? yawTo( at, look ), pose, { role: role || 0 } );

		}

	}

	// his height over the rig's 6'2" (poses are in his own, scaled, frame)
	_height( id ) {

		const s = this.slots.get( id );
		return s ? s.look.height || 1 : lookFor( id ).height || 1;

	}

	// put a player in this frame
	act( id, x, z, yaw, pose, extra = {} ) {

		if ( id == null ) return;
		this.actors.set( id, { x, z, yaw, pose, ...extra } );

	}

	_sync() {

		const P = this.game.players;
		const snap = this.now ? this.now.snap : null;
		const kind = this.now ? this.now.seg.kind : '';
		for ( const [ id, a ] of this.actors ) {

			let s = this.slots.get( id );
			if ( ! s ) {

				// a player by his id; the umpires (negative ids) and the other people on the field (string
				// ids, `who` given by the scene) bring their own looks
				const num = typeof id === 'number' ? id : String( id ).split( '' ).reduce( ( h, ch ) => ( h * 31 + ch.charCodeAt( 0 ) ) % 100003, 7 );
				const info = a.who || ( num < 0 ? { side: 'ump', num: '', throws: 'R', look: String( id ) } : P[ id ] ) || { side: 'home', num: '', throws: 'R' };
				s = this.players.add( { team: info.side, number: info.num, gloveHand: info.throws === 'L' ? 'R' : 'L', name: info.last, look: lookFor( info.look ?? id, hash( num ) ), back: info.back } );
				s.seed = hash( num * 1.3 + 7 );
				this.slots.set( id, s );

			}

			// what he wears: the batter and the runners their helmets (with the flaps his helmet has) and
			// batting gloves, the batter an elbow guard on his front arm if he wears one; the catcher his
			// gear, the skull cap and the mitt (the mask while he's down behind the plate); the first
			// baseman his mitt; fielders now and then with their batting gloves in the back pocket. In the
			// dogpile it's all off.
			let role = 0;
			if ( snap && kind !== 'celebrate' && typeof id === 'number' && id > 0 ) {

				const L = s.look;
				if ( id === snap.batter || ( snap.bases || [] ).includes( id ) || a.pose?.bat ) {

					role |= ROLE.helmet | ROLE.bgloves;
					role |= ( L.flaps & 1 ? ROLE.flapL : 0 ) | ( L.flaps & 2 ? ROLE.flapR : 0 );
					if ( id === snap.batter && L.elbow ) role |= snap.bats === 'L' ? ROLE.elbowR : ROLE.elbowL;

				} else if ( snap.defense ) {

					if ( id === snap.defense.C ) role |= ROLE.gear | ROLE.ccap | ROLE.mittC;
					else if ( id === snap.defense[ '1B' ] ) role |= ROLE.mitt1B;
					if ( id !== snap.defense.P && id !== snap.defense.C && s.seed > 0.45 ) role |= ROLE.pocket;

				}

			}

			if ( a.role != null ) role = a.role;
			if ( a.roleAdd ) role |= a.roleAdd;
			s.role = role;
			// the batter and the runners don't wear fielders' gloves: batting gloves only (Rig's neutral pose
			// and M.run() put a glove on everyone)
			if ( ( role & ROLE.helmet ) && a.pose ) a.pose.glove = false;
			s.visible = true;
			s.x = a.x; s.z = a.z; s.yaw = a.yaw; s.y = a.y || 0; s.tilt = a.tilt || null;
			s.pose = a.pose;
			if ( a.dirt != null ) s.dirt = a.dirt;
			else if ( typeof id === 'number' && id > 0 && this.now ) s.dirt = this._dirt( id, this.now.seg );

		}

		for ( const [ id, s ] of this.slots ) if ( ! this.actors.has( id ) ) s.visible = false;
		// ---- R (rituals): the rituals' people (ids 'r:...': the grounds crew, the coaches, the stage party)
		// give their slots back when they're off, so the rig's 96 go round
		for ( const [ id, s ] of this.slots ) {

			// (FB2, C2B-10: not while a replay is on: BallparkApp poses twice a frame, live and replayed)
			if ( this.holdSlots || this.actors.has( id ) || typeof id !== 'string' || ! id.startsWith( 'r:' ) ) continue;
			this.players.remove?.( s );
			this.slots.delete( id );

		}
		// ---- end R
		this.ball.set( this.ballAt );

	}

	// ---- the pieces of a scene

	_fielders( snap, lt, mode = 'stand', skip = new Set() ) {

		for ( const pos of POS_ORDER ) {

			const id = snap.defense[ pos ];
			if ( ! id || skip.has( id ) || pos === 'P' || pos === 'C' ) continue;
			const [ x, z ] = POSITIONS[ pos ];
			const pose = mode === 'ready' ? M.ready( lt + hash( id ) * 5 ) : M.stand( lt + hash( id ) * 5 );
			this.act( id, x, z, yawTo( [ x, z ], [ 0, - 5 ] ), pose );

		}

	}

	_catcher( snap, lt, glove = null ) {

		const id = snap.defense.C;
		if ( ! id ) return;
		this.act( id, POSITIONS.C[ 0 ], POSITIONS.C[ 1 ], 0, M.catcherCrouch( lt, glove ), { roleAdd: ROLE.mask } );

	}

	_pitcherStanding( snap, lt ) {

		const id = snap.defense.P;
		this.act( id, MOUND[ 0 ], MOUND[ 1 ], Math.PI, this._hand( id, M.stand( lt ) ), { y: 0.25 } );

	}

	_hand( id, pose ) {

		return this.game.players[ id ]?.throws === 'L' ? M.mirror( pose ) : pose;

	}

	// `off`: metres back out of the box, away from the plate (stepping out between pitches)
	_batter( snap, pose, off = 0 ) {

		const [ x, z ] = boxFor( snap.bats );
		const left = snap.bats === 'L';
		this.act( snap.batter, x + ( left ? off : - off ), z + off * 0.3, left ? Math.PI / 2 : - Math.PI / 2, left ? M.mirror( pose ) : pose );

	}

	_onDeck( snap, lt ) {

		if ( ! snap.onDeck ) return;
		const [ x, z ] = ON_DECK[ snap.batting ];
		// down on one knee with the bat, watching the pitcher; every so often up for a couple of easy
		// practice swings, then a stretch with the bat across his shoulders, and down again (his own
		// rhythm, from his id). In the circle, not in a batting stance.
		const u = ( lt + hash( snap.onDeck ) * 17 ) % 16;
		let pose;
		if ( u < 9 ) pose = M.onDeckKneel( lt );
		else if ( u < 9.6 ) pose = M.blend( M.onDeckKneel( lt ), M.batterStance( 0 ), ease01( ( u - 9 ) / 0.6 ) );
		else if ( u < 13 ) {

			// two slow swings, each from the stance
			const w = ( u - 9.6 ) % 1.7;
			pose = w < 1.0 ? M.swing( Math.min( 1.2, w * 1.15 ) ) : M.blend( M.swing( 1.2 ), M.batterStance( 0 ), ease01( ( w - 1.0 ) / 0.7 ) );

		} else if ( u < 15.4 ) pose = M.blend( M.batterStance( 0 ), M.batStretch( lt ), ease01( ( u - 13 ) / 0.5 ) );
		else pose = M.blend( M.batStretch( lt ), M.onDeckKneel( lt ), ease01( ( u - 15.4 ) / 0.6 ) );
		const left = this.game.players[ snap.onDeck ]?.bats === 'L';
		this.act( snap.onDeck, x, z, yawTo( [ x, z ], MOUND ), left ? M.mirror( pose ) : pose );

	}

	_runners( snap, lt, lead = 0 ) {

		const dirs = [ [ 2, 0 ], [ 3, 0 ], [ 0, 0 ] ];
		snap.bases.forEach( ( id, b ) => {

			if ( ! id ) return;
			const base = BASES[ b + 1 ], next = BASES[ dirs[ b ][ 0 ] ];
			const off = b === 2 ? [ - 1.2, 0.8 ] : [ 0, 0 ];
			const p = lerp2( base, next, lead * ( b === 2 ? 0.06 : 0.12 ) );
			this.act( id, p[ 0 ] + off[ 0 ], p[ 1 ] + off[ 1 ], yawTo( p, [ 0, 0 ] ), lead > 0.5 ? M.ready( lt ) : M.stand( lt ) );

		} );

	}

	// ---- segment kinds

	show_intro( seg, lt ) {

		// the home team takes the field from its dugout
		const s = seg.snap;
		this._runOut( s.defense, 'home', lt, 1 );
		this._onDeck( { ...s, onDeck: s.batter }, lt );

	}

	show_switch( seg, lt ) {

		// ---- R (rituals): the suspension's break is its own scene (the tarp, the delay, the 29th's return:
		// Suspension.js); nobody takes the field in the rain delay (H14)
		if ( seg === this.suspension ) return showSuspension( this, seg, lt );
		// ---- end R
		const s = seg.snap;
		// last half's fielders come in, this half's go out
		if ( s.oldDefense ) this._runIn( s.oldDefense, s.batting, lt );
		this._runOut( s.defense, s.fielding, lt, 4 );
		this._onDeck( { ...s, onDeck: s.batter }, lt );
		// ---- R (rituals): once they're out, the warm-up throws (game/Breaks.js); the drying agent on the
		// mound in the middle of the 5th on the 27th
		showWarmups( this, seg, lt, 4 );
		showDrying( this, seg, lt );
		// ---- end R

	}

	_runOut( defense, team, lt, delay ) {

		const from = DUGOUT[ team ];
		for ( const pos of POS_ORDER ) {

			const id = defense[ pos ];
			if ( ! id ) continue;
			const to = pos === 'P' ? MOUND : POSITIONS[ pos ];
			const d = dist( from, to ), start = delay + hash( id ) * 3;
			const k = Math.min( 1, Math.max( 0, ( lt - start ) * JOG / d ) );
			const p = lerp2( from, to, k );
			if ( lt < start ) continue;
			const moving = k < 1;
			const pose = moving ? M.run( ( lt - start ) * 1.3, 0.2 ) : ( pos === 'C' ? M.catcherCrouch( lt ) : M.stand( lt ) );
			this.act( id, p[ 0 ], p[ 1 ], moving ? yawTo( from, to ) : yawTo( to, pos === 'C' ? MOUND : [ 0, - 5 ] ), pos === 'P' && ! moving ? this._hand( id, pose ) : pose, { y: pos === 'P' && ! moving ? 0.25 : 0 } );

		}

	}

	_runIn( defense, team, lt ) {

		const to = DUGOUT[ team ];
		for ( const pos of POS_ORDER ) {

			const id = defense[ pos ];
			if ( ! id ) continue;
			const from = pos === 'P' ? MOUND : POSITIONS[ pos ];
			const d = dist( from, to );
			const k = Math.min( 1, lt * JOG / d );
			if ( k >= 1 ) continue;
			const p = lerp2( from, to, k );
			this.act( id, p[ 0 ], p[ 1 ], yawTo( from, to ), M.run( lt * 1.3, 0.2 ) );

		}

	}

	show_walkup( seg, lt ) {

		const s = seg.snap;
		this._fielders( s, lt );
		this._catcher( s, lt );
		this._pitcherStanding( s, lt );
		this._runners( s, lt );
		// from the on-deck circle to the box
		const from = ON_DECK[ s.batting ], to = boxFor( s.bats );
		const k = Math.min( 1, lt / ( seg.dur - 1.2 ) );
		const p = lerp2( from, to, k );
		if ( k < 1 ) {

			const pose = M.run( lt * 0.8, 0 );
			pose.bat = { dir: [ 0.2, 0.9, 0.3 ] };
			this.act( s.batter, p[ 0 ], p[ 1 ], yawTo( from, to ), pose );

		} else this._batter( s, M.batterStance( lt ) );

		this._onDeck( s, lt );
		// the end of the throw round the horn after a strikeout with the bases empty (show_result):
		// short to second, second to third, third to the pitcher
		const prev = this.game.plays[ seg.pi - 1 ];
		if ( prev && prev.result.type === 'strikeout' && prev.half === this.game.plays[ seg.pi ].half && ! ( s.bases || [] ).some( Boolean ) ) this._tosses( s, lt, [ [ 'SS', '2B', 0.1 ], [ '2B', '3B', 1.3 ], [ '3B', 'P', 2.7 ] ] );

	}

	show_pitch( seg, lt ) {

		const s = seg.snap, e = seg.ev;
		// the manager on his way back from a pitching change just before
		const prev = this.segmentAt( seg.t0 - 0.01 );
		if ( prev.kind === 'change' && prev !== seg ) this._managerBack( s, lt + 1.7, [ MOUND[ 0 ] + ( s.fielding === 'home' ? 0.9 : - 0.9 ), MOUND[ 1 ] + 0.6 ] );
		const d = lt - PACE.set;
		const pid = s.defense.P;
		const lefty = this.game.players[ pid ]?.throws === 'L';
		// the pitch's speed and type, once it's been thrown (FOX put it up after the pitch, not before)
		if ( d > M.REL + seg.path.flight ) this.now.pitch = e;
		// after ball four or strike three the count stays at 3 balls / 2 strikes (the boards never show a 3rd strike)
		this.now.count = d > M.REL + seg.path.flight ? [ Math.min( 3, e.count[ 0 ] ), Math.min( 2, e.count[ 1 ] ) ] : [ s.balls, s.strikes ];
		// the pitcher: set, then the delivery, the release at the pitch's own release point
		// (the root sits so his pivot foot is against the front of the rubber)
		const root = [ MOUND[ 0 ], MOUND[ 1 ] + 0.03 ];
		const rel = seg.path.at( 0 );
		// the release point in the pitcher's frame (he faces +z: his x is the field's -x, his -z the field's +z)
		let relLocal = [ root[ 0 ] - rel[ 0 ], rel[ 1 ] - 0.25, root[ 1 ] - rel[ 2 ] ];
		if ( lefty ) relLocal = [ - relLocal[ 0 ], relLocal[ 1 ], relLocal[ 2 ] ];
		// (his frame is scaled by his height)
		relLocal = relLocal.map( ( v ) => v / this._height( pid ) );
		let pp;
		// before it: on the rubber, leaning in for the sign (now and then shaking one off), the nod, then
		// he comes set
		const shakes = hash( seg.t0 ) < 0.22;
		if ( d < 0 ) {

			if ( lt < 0.9 ) pp = M.stand( lt );
			else if ( lt < 1.3 ) pp = M.blend( M.stand( lt ), M.lookIn( lt ), ease01( ( lt - 0.9 ) / 0.4 ) );
			else if ( lt < 2.2 ) pp = M.lookIn( lt, ( lt - 1.8 ) / 0.3, shakes ? ( lt - 1.3 ) / 0.45 : 0 );
			else pp = M.blend( M.lookIn( lt ), M.pitcherSet(), ease01( ( lt - 2.2 ) / 0.5 ) );

		}
		else pp = M.delivery( d, relLocal );
		this.act( pid, root[ 0 ], root[ 1 ], Math.PI, lefty ? M.mirror( pp ) : pp, { y: 0.25 } );

		// fielders get ready as he delivers
		this._fielders( s, lt, d > - 0.3 ? 'ready' : 'stand' );
		this._runners( s, lt, d > - 0.5 ? Math.min( 1, ( d + 0.5 ) * 2 ) : 0 );
		this._onDeck( s, lt );

		// the ball
		const tb = d - M.REL;
		const flight = seg.path.flight, toC = seg.path.toCatcher;
		// the catcher's glove goes to where the ball will cross his plane
		const catchAt = seg.path.at( toC );
		const ch = this._height( s.defense.C );
		const glove = [ ( catchAt[ 0 ] - POSITIONS.C[ 0 ] ) / ch, catchAt[ 1 ] / ch, ( catchAt[ 2 ] - POSITIONS.C[ 1 ] ) / ch ];
		const gk = Math.min( 1, Math.max( 0, ( tb + 0.35 ) / 0.3 ) );
		// the catcher puts down the sign while the pitcher leans in, then gives the target
		if ( d < 0 && lt > 1.15 && lt < 2.25 && s.defense.C ) {

			const k = Math.min( 1, ( lt - 1.15 ) / 0.2, ( 2.25 - lt ) / 0.2 );
			this.act( s.defense.C, POSITIONS.C[ 0 ], POSITIONS.C[ 1 ], 0, M.blend( M.catcherCrouch( lt ), M.catcherSigns( lt ), k ), { roleAdd: ROLE.mask } );

		} else this._catcher( s, lt, gk > 0 ? [ - 0.08 + ( glove[ 0 ] + 0.08 ) * gk, 0.72 + ( glove[ 1 ] - 0.72 ) * gk, - 0.48 + ( glove[ 2 ] + 0.48 ) * gk ] : null );
		if ( tb >= - 0.02 && tb < flight ) this.ballAt = seg.path.at( Math.max( 0, tb ) );
		else if ( tb >= flight && ! seg.foul && ! e.inPlay ) {

			if ( tb < toC ) this.ballAt = seg.path.at( tb );
			else if ( tb < toC + 1.3 ) this.ballAt = catchAt;
			else {

				// back to the pitcher; strike three he keeps (around the horn in the result, or it's the
				// third out, or the last out of the Series: Ruiz kept it and ran out to Lidge)
				const th = throwPath( POSITIONS.C, root, 14 );
				const tt = tb - toC - 1.3;
				const k3 = e.count[ 1 ] >= 3;
				this.ballAt = tt < th.time && ! k3 && ! seg.acts.some( ( a ) => /stolen|caught/.test( a.e.kind || '' ) ) ? th.at( tt ) : null;

			}

		} else if ( seg.foul && tb >= flight ) {

			const q = seg.foulPath( tb - flight );
			this.ballAt = q;

		}

		// the batter: back in from stepping out after the last pitch (the gloves' straps tugged, a tap of
		// the plate), the stance, the swing or the take; after a pitch that doesn't end it he steps out
		const stepIn = s.balls + s.strikes > 0 && lt < 1.7;
		const stance = stepIn ? ( lt < 1.0 ? M.adjustGloves( lt ) : lt < 1.35 ? M.blend( M.adjustGloves( lt ), M.tapPlate( lt - 1.0 ), ease01( ( lt - 1.0 ) / 0.35 ) ) : M.blend( M.tapPlate( lt - 1.0 ), M.batterStance( lt ), ease01( ( lt - 1.35 ) / 0.35 ) ) ) : M.batterStance( lt );
		const inOff = stepIn ? 0.55 * ( 1 - ease01( ( lt - 0.6 ) / 0.6 ) ) : 0;
		const [ eb, es ] = e.count;
		const goesOn = ! e.inPlay && eb < 4 && es < 3 && e.call !== 'H';
		const out = goesOn ? ease01( ( tb - toC - 0.9 ) / 0.8 ) : 0;
		let bp;
		if ( seg.swing ) {

			const start = M.REL + flight - M.CONTACT;
			bp = d >= start ? M.swing( d - start ) : stance;

		} else {

			bp = d >= M.REL ? M.take( d - M.REL ) : stance;

		}

		if ( out > 0 ) bp = M.blend( bp, M.adjustGloves( lt ), out );
		this._batter( s, bp, Math.max( inOff, out * 0.55 ) );

		// steals and passed balls on this pitch
		for ( const a of seg.acts ) for ( const mv of a.moves ) this._steal( s, a, mv, d, M.REL + toC, catchAt );

	}

	// A runner going on the pitch (d: seconds since the pitcher's first move). A steal or a caught
	// stealing: he breaks from his lead with the pitcher's first move, the catcher takes the pitch and
	// throws through to the bag (a 2 s pop time), the shortstop (or the second baseman, with a lefty up;
	// the third baseman at third) covers and puts the tag down, and the runner slides in feet first, a
	// step ahead of it or a step behind; the base umpire calls it. A wild pitch or a passed ball: he just
	// goes. (They used to run in upright and stop dead on the bag, with no throw.)
	_steal( s, a, mv, d, tCatch, catchAt ) {

		const from = mv.start || mv.from, to = runTo( mv, from );
		const len = Math.max( 0, to - from ) * 27.43, lead = Math.min( len, from === 3 ? 1.6 : 3.3 );
		const steal = /stolen|caught/.test( a.e.kind || '' ) && to <= 3;
		const base = BASES[ to % 4 ];
		const tRel = tCatch + 0.75, th = throwPath( POSITIONS.C, base, 31 ), tBall = tRel + th.time;
		const r = { id: mv.id, from, to, start: 0.05, len, lead, halt: 1, out: !! mv.out, scores: to >= 4, slide: steal ? 'feet' : null,
			tArrive: steal ? tBall + ( mv.out ? 0.3 : - 0.12 ) : 0.05 + ( len - lead ) / RUN + 0.3 };
		const at = this._runnerAt( r, d, s );
		if ( at ) this.act( mv.id, at.x, at.z, at.yaw, at.pose, at.extra );
		if ( ! steal ) return;
		this._stealCall = { base: to, t: r.tArrive, out: !! mv.out };
		// the catcher: up out of the crouch and throwing through
		const cid = s.defense.C;
		if ( cid && d > tCatch + 0.1 && d < tRel + 0.6 ) this.act( cid, POSITIONS.C[ 0 ], POSITIONS.C[ 1 ] - 0.2, yawTo( POSITIONS.C, base ), M.throwBall( Math.max( 0, d - tCatch - 0.1 ) * 0.62 + 0.05 ), { roleAdd: ROLE.mask } );
		// the ball: in the mitt, then on its way to the bag, then in the glove
		if ( d > tCatch + 0.05 ) this.ballAt = d < tRel ? null : d < tBall ? th.at( d - tRel ) : null;
		this._stealBall = d > tCatch + 0.05;
		// the man covering: over to the bag as the pitch goes, the throw taken low, the tag
		const cPos = to === 3 ? '3B' : s.bats === 'L' ? '2B' : 'SS';
		const id = s.defense[ cPos ];
		if ( ! id || d < M.REL ) return;
		const home = POSITIONS[ cPos ];
		const spot = lerp2( base, home, 0.9 / Math.max( 1, dist( base, home ) ) );
		const k = Math.min( 1, ( d - M.REL ) * RUN * 0.85 / dist( home, spot ) );
		const p = lerp2( home, spot, k );
		let pose = k < 1 ? M.run( d * 1.45, 1 ) : M.receive( d, 1.0 / this._height( id ) );
		// the tag: the glove swept down to the bag in front of the slide
		if ( k >= 1 && d > tBall - 0.05 ) pose = M.blend( pose, M.receive( d, 0.35 / this._height( id ) ), ease01( ( d - tBall + 0.05 ) / 0.2 ) );
		this.act( id, p[ 0 ], p[ 1 ], k < 1 ? yawTo( home, spot ) : yawTo( p, POSITIONS.C ), this._hand( id, pose ) );

	}

	show_steal( seg, lt ) {

		const s = seg.snap;
		this._fielders( s, lt, 'ready' );
		this._catcher( s, lt );
		this._pitcherStanding( s, lt );
		this._batter( s, M.batterStance( lt ) );
		// (as on a pitch: the catcher's catch a pitch's time after the break at 0.8 s)
		for ( const a of seg.acts ) for ( const mv of a.moves ) this._steal( s, a, mv, lt - 0.8, M.REL + 0.45, [ 0, 0.9, 1.1 ] );

	}

	show_inplay( seg, lt ) {

		const s = seg.snap, plan = seg.plan;
		const moving = new Set( Object.keys( plan.fielders ).map( Number ) );
		for ( const r of plan.runners ) moving.add( r.id );
		// the other fielders watch the ball
		const ball = this._ballIn( plan, lt );
		for ( const pos of POS_ORDER ) {

			const id = s.defense[ pos ];
			if ( ! id || moving.has( id ) ) continue;
			const home = pos === 'P' ? MOUND : POSITIONS[ pos ];
			const look = ball ? [ ball[ 0 ], ball[ 2 ] ] : [ 0, - 30 ];
			const pose = pos === 'C' && lt < 1 ? M.catcherCrouch( lt ) : M.ready( lt );
			this.act( id, home[ 0 ], home[ 1 ], yawTo( home, look ), pos === 'P' ? this._hand( id, pose ) : pose, { y: pos === 'P' ? 0.25 : 0 } );

		}

		// the fielders making the play
		for ( const [ idS, steps ] of Object.entries( plan.fielders ) ) {

			const id = Number( idS );
			let at = steps[ 0 ].from, yaw = 0, pose = M.ready( lt ), done = false;
			const extra = {};
			for ( const st of steps ) {

				if ( lt < st.t0 ) break;
				const k = Math.min( 1, ( lt - st.t0 ) / Math.max( 0.05, st.t1 - st.t0 ) );
				if ( st.act === 'run' || st.act === 'shuffle' ) {

					at = lerp2( st.from, st.to, k );
					yaw = yawTo( st.from, st.to );
					pose = k < 1 ? M.run( lt * 1.45, st.act === 'run' ? 1 : 0.3 ) : M.ready( lt );

				} else if ( st.act === 'catch' ) {

					at = st.to; pose = k < 1 ? M.catchHigh( lt ) : M.stand( lt ); yaw = yawTo( at, [ 0, 0 ] );

				} else if ( st.act === 'grounder' || st.act === 'pickup' ) {

					at = st.to; pose = k < 0.7 ? M.fieldGrounder( lt ) : M.ready( lt ); yaw = yawTo( at, [ 0, 0 ] );

				} else if ( st.act === 'throw' ) {

					at = st.to; yaw = yawTo( at, st.aim ); pose = M.throwBall( ( lt - st.t0 ) * 0.9 + 0.1 );

				} else if ( st.act === 'fake' ) {

					// a look and a pump toward first, then he turns for home
					at = st.to; yaw = yawTo( at, st.aim ); pose = M.pumpFake( lt - st.t0 );

				} else if ( st.act === 'receive' ) {

					// the throw caught chest high, facing it (the first baseman stretching for it off the bag
					// as it comes); on a tag play at the plate, the catch and then the dive for the runner
					at = st.to;
					const h = 1.3 / this._height( id );
					yaw = yawTo( at, st.thrower || [ 0, - 20 ] );
					const rr = st.tag ? plan.runners.find( ( q ) => q.id === st.runner ) : null;
					if ( rr && lt > rr.tArrive - 0.34 ) {

						const kd = ( lt - ( rr.tArrive - 0.34 ) ) / 0.34;
						// at his shoulders as his hands reach the plate
						const sh = lerp2( BASES[ 0 ], BASES[ 3 ], 0.45 / 27.43 );
						yaw = yawTo( at, sh );
						pose = M.diveTag( kd );
						extra.tilt = tiltX( M.diveTilt( kd ) );
						extra.y = 0.04 * Math.min( 1, kd );
						// he stays down on the runner a moment, then gets up
						if ( lt > rr.tArrive + 0.9 ) {

							const ku = ( lt - rr.tArrive - 0.9 ) / 0.8;
							pose = M.blend( M.diveTag( 1 ), M.stand( lt ), ease01( ku ) );
							extra.tilt = tiltX( M.diveTilt( 1 - Math.min( 1, ku ) ) );

						}

					} else if ( st.base === 1 ) {

						pose = M.blend( M.receive( lt, h ), M.stretch( lt, h ), ease01( ( lt - st.tCatch + 0.4 ) / 0.3 ) );

					} else pose = M.receive( lt, h );

				}

				done = true;

			}

			void done;
			const pos = Object.keys( s.defense ).find( ( k ) => s.defense[ k ] === id );
			// on the mound's slope (the pitcher, or anyone near the rubber)
			if ( extra.y == null ) extra.y = moundY( at );
			this.act( id, at[ 0 ], at[ 1 ], yaw, pos === 'P' || this.game.players[ id ]?.throws === 'L' ? this._hand( id, pose ) : pose, extra );

		}

		// runners: from their leads round the bases, the batter out of the box
		for ( const r of plan.runners ) {

			if ( lt < r.start && r.id === s.batter ) {

				// the batter finishes his swing
				this._batter( s, M.swing( M.CONTACT + lt ) );
				continue;

			}

			const a = this._runnerAt( r, lt, s );
			if ( a ) this.act( r.id, a.x, a.z, a.yaw, a.pose, a.extra );

		}

		// runners who didn't move
		s.bases.forEach( ( id ) => {

			if ( id && ! plan.runners.some( ( r ) => r.id === id ) ) {

				const b = s.bases.indexOf( id ) + 1;
				this.act( id, BASES[ b ][ 0 ], BASES[ b ][ 1 ], yawTo( BASES[ b ], [ 0, 0 ] ), M.stand( lt ) );

			}

		} );

		if ( ! plan.runners.some( ( r ) => r.id === s.batter ) ) this._batter( s, M.stand( lt ) );
		// between its flights the ball is in somebody's glove: not drawn, but the cameras keep looking
		// where it was
		this.ballAt = this._ballHeld ? null : ball;
		this.ballFocus = ball;

	}

	// A runner at lt (plan.runners): out of the box or off his lead he gets up to speed, swings out
	// before a base he's rounding and cuts its inside corner (the banana), and on a tag play slides; the
	// batter runs through first on an infield play. Then a runner who's out or has scored heads for his
	// dugout. Returns { x, z, yaw, pose, extra } or null once he's gone.
	_runnerAt( r, lt, s ) {

		const S = r.len - r.lead, T = Math.max( 0.1, r.tArrive - r.start );
		const u = Math.max( 0, lt - r.start );
		// the run: d( u ) = v ( u - tau ( 1 - e^-u/tau ) ), up to speed in about 3 tau
		const tau = r.from === 0 ? 0.45 : 0.3;
		const ramp = ( t ) => t - tau * ( 1 - Math.exp( - t / tau ) );
		const sl = r.slide && S > SLIDE[ r.slide ][ 0 ] + 1 ? SLIDE[ r.slide ] : null;
		// the batter on an infield play runs through the bag and pulls up in foul ground
		const through = r.from === 0 && r.to === 1 && r.through;
		let d, kSlide = - 1, over = 0;
		if ( sl ) {

			// a steady run to the slide, then down and sliding to a stop: the slide takes 2 ( D0 - D1 ) / v
			const [ D0, D1 ] = sl;
			// his speed going down is the run's at its end (a few rounds settle it)
			let v = S / Math.max( 0.1, T - tau ), tRun = T;
			for ( let i = 0; i < 3; i ++ ) {

				tRun = Math.max( 0.2, T - 2 * ( D0 - D1 ) / v );
				v = ( S - D0 ) / ramp( tRun ) * ( 1 - Math.exp( - tRun / tau ) );

			}

			const tSl = T - tRun;
			if ( u < tRun ) d = ( S - D0 ) * ramp( u ) / ramp( tRun );
			else {

				const w = Math.min( tSl, u - tRun );
				d = S - D0 + v * w - v * v / ( 4 * ( D0 - D1 ) ) * w * w;
				kSlide = w / 0.24;

			}

		} else {

			const v = S * r.halt / Math.max( 0.1, ramp( T ) );
			d = Math.min( S * r.halt, v * ramp( Math.min( u, T ) ) );
			// running through first: on past the bag, slowing to a stop 5 m on, in foul ground
			if ( through && u > T ) over = 5 * ( 1 - Math.exp( - ( u - T ) / 0.45 ) );

		}

		let [ x, z, yaw ] = alongBases( r.from, r.to, r.lead + d );
		if ( over > 0 ) {

			const dir = [ BASES[ 1 ][ 0 ] / 27.43, BASES[ 1 ][ 1 ] / 27.43 ];
			x += dir[ 0 ] * over; z += dir[ 1 ] * over;

		}

		const extra = {};
		let pose = M.run( lt * 1.45, 1 );
		if ( u <= 0 ) pose = M.ready( lt );
		if ( kSlide >= 0 ) {

			pose = r.slide === 'head' ? M.slideHead( kSlide ) : M.slideFeet( kSlide );
			if ( r.slide === 'head' ) extra.tilt = tiltX( M.slideTilt( kSlide ) );

		}

		if ( u < T ) return { x, z, yaw, pose, extra };
		// there: a slide stays down a moment, then he gets up
		const after = lt - r.tArrive;
		let down = 0;
		if ( sl ) {

			down = 1.6;
			const end = r.slide === 'head' ? M.slideHead( 1 ) : M.slideFeet( 1 );
			if ( after < 0.9 ) return { x, z, yaw, pose: end, extra };
			if ( after < down ) return { x, z, yaw, pose: M.upFrom( end, after - 0.9 ), extra: { tilt: r.slide === 'head' ? tiltX( M.slideTilt( 1 - ( after - 0.9 ) / 0.7 ) ) : null } };

		}

		if ( over > 0 ) {

			// pulled up past first: he turns and walks back to the bag (or, out, for the dugout)
			if ( after < 1.2 ) return { x, z, yaw, pose: after < 0.7 ? M.run( lt * 1.45, Math.max( 0, 1 - after * 1.4 ) ) : M.stand( lt ), extra };
			if ( ! r.out ) {

				const k = Math.min( 1, ( after - 1.2 ) * WALK / 5 );
				const p = lerp2( [ x, z ], BASES[ 1 ], k );
				return { x: p[ 0 ], z: p[ 1 ], yaw: k < 1 ? yawTo( [ x, z ], BASES[ 1 ] ) : yawTo( BASES[ 1 ], [ 0, 0 ] ), pose: k < 1 ? M.walk( lt * 1.6 ) : M.stand( lt ), extra };

			}

			down = 1.2;

		}

		if ( ! ( r.out || r.scores ) ) return { x, z, yaw: yawTo( [ x, z ], [ 0, 0 ] ), pose: M.stand( lt ), extra: {} };
		// off the field, to his dugout
		const off = Math.min( 1, ( after - down ) * 0.2 );
		if ( off >= 1 ) return null;
		const dug = DUGOUT[ s.batting ];
		const p = lerp2( [ x, z ], dug, Math.max( 0, off ) );
		return { x: p[ 0 ], z: p[ 1 ], yaw: yawTo( p, dug ), pose: off > 0 ? M.run( lt, 0 ) : M.stand( lt ), extra: {} };

	}

	// where the ball is in a play (its flights in plan.ball); between them, and after the last, it's in a
	// glove (_ballHeld), and this gives where it was last seen. A home run is gone.
	_ballIn( plan, lt ) {

		let last = null;
		this._ballHeld = false;
		for ( const b of plan.ball ) {

			if ( lt >= b.t0 && lt <= b.t0 + b.dur ) return b.at( lt - b.t0 );
			if ( lt > b.t0 + b.dur ) last = b.at( b.dur );

		}

		this._ballHeld = !! last;
		return plan.hr ? null : last;

	}

	show_result( seg, lt ) {

		const s = seg.snap;
		this._fielders( s, lt );
		this._catcher( s, lt );
		this._pitcherStanding( s, lt );
		// runners on their new bases
		this._runners( s, lt );
		// a walk / hit batsman: the runners jog to their bases
		for ( const r of seg.moves ) {

			if ( r.out ) continue;
			const from = r.start || 0, to = r.to ?? from;
			const k = Math.min( 1, lt * JOG / ( 27.43 * Math.max( 1, to - from ) ) );
			const p = basePath( from, to, k );
			this.act( r.id, p[ 0 ], p[ 1 ], yawTo( BASES[ from % 4 ], BASES[ to % 4 ] ), k < 1 ? M.run( lt * 1.2, 0.2 ) : M.stand( lt ) );

		}

		// the batter, if he's out, heads for the dugout
		const b = seg.before;
		if ( ! s.bases.includes( s.batter ) && ! seg.moves.some( ( r ) => r.id === s.batter && ! r.out ) ) {

			const from = boxFor( s.bats ), to = DUGOUT[ s.batting ];
			const k = Math.min( 1, lt * WALK / dist( from, to ) );
			const p = lerp2( from, to, k );
			this.act( s.batter, p[ 0 ], p[ 1 ], yawTo( from, to ), M.run( lt * 0.7, 0 ) );

		}

		this._onDeck( s, lt );
		void b;
		// after a strikeout: around the horn with the bases empty (catcher to third, to short, and on in
		// the next walk-up), or a flip back to the pitcher with men on; not after the third out
		const P = this.game.plays[ seg.pi ];
		if ( P?.result.type === 'strikeout' && s.outs < 3 && seg.pi < this.game.plays.length - 1 ) {

			if ( ! ( b.bases || [] ).some( Boolean ) ) this._tosses( s, lt, [ [ 'C', '3B', 0.25 ], [ '3B', 'SS', 1.75 ] ] );
			else this._tosses( s, lt, [ [ 'C', 'P', 1.2 ] ] );

		}

	}

	// A ball thrown round the infield (after a strikeout): [ [ from, to, t ], ... ] by position, each
	// thrown at t (lt); poses the man throwing and the man catching, and puts the ball in the air
	_tosses( s, lt, chain ) {

		const spot = ( pos ) => pos === 'P' ? MOUND : POSITIONS[ pos ];
		for ( const [ a, b, t0 ] of chain ) {

			const ida = s.defense[ a ], idb = s.defense[ b ];
			if ( ! ida || ! idb ) continue;
			const A = spot( a ), B = spot( b );
			const th = throwPath( A, B, a === 'C' ? 24 : 20 );
			const rel = t0 + 0.24, arr = rel + th.time;
			const yA = a === 'P' ? 0.25 : 0, yB = b === 'P' ? 0.25 : 0;
			if ( lt >= t0 - 0.1 && lt < t0 + 0.8 ) this.act( ida, A[ 0 ], A[ 1 ], yawTo( A, B ), this._hand( ida, M.throwBall( Math.max( 0, lt - t0 ) * 0.9 + 0.1 ) ), { y: yA } );
			if ( lt >= rel - 0.6 && lt < arr + 0.5 ) this.act( idb, B[ 0 ], B[ 1 ], yawTo( B, A ), this._hand( idb, M.receive( lt, 1.3 / this._height( idb ) ) ), { y: yB } );
			if ( lt >= rel && lt < arr ) this.ballAt = th.at( lt - rel );

		}

	}

	// A pitching change as it went in 2008: the manager walks out to the mound (Charlie Manuel; Joe
	// Maddon for the Rays) while the catcher and the infielders gather there; he takes the ball from the
	// pitcher, who walks off; the reliever comes in from the pen and the manager hands it to him and
	// walks back (on into the next pitch); the infielders go back to their places.
	show_change( seg, lt ) {

		const s = seg.snap;
		const dur = seg.dur;
		const dug = DUGOUT[ s.fielding ];
		// the manager: out at a brisk walk, to the first base side of the rubber
		const spot = [ MOUND[ 0 ] + ( s.fielding === 'home' ? 0.9 : - 0.9 ), MOUND[ 1 ] + 0.6 ];
		const tOut = dist( dug, spot ) / 3.4, tTake = Math.min( tOut + 0.8, dur - 6 );
		// the infield at the mound from 1 s, back out over the last 3, in a ring round it
		const ring = [ 'C', '1B', '2B', 'SS', '3B' ];
		const gather = ease01( ( lt - 1 ) / 3 ) * ( 1 - ease01( ( lt - ( dur - 3 ) ) / 2.5 ) );
		for ( const pos of POS_ORDER ) {

			const id = s.defense[ pos ];
			if ( ! id || pos === 'P' ) continue;
			const home = POSITIONS[ pos ];
			const i = ring.indexOf( pos );
			if ( i < 0 || gather <= 0 ) {

				if ( pos === 'C' ) this._catcher( s, lt );
				else this.act( id, home[ 0 ], home[ 1 ], yawTo( home, [ 0, - 5 ] ), M.stand( lt + hash( id ) * 5 ) );
				continue;

			}

			// round the rubber, each from his own side
			const a = Math.atan2( home[ 1 ] - MOUND[ 1 ], home[ 0 ] - MOUND[ 0 ] );
			const at = [ MOUND[ 0 ] + Math.cos( a ) * 2.2, MOUND[ 1 ] + Math.sin( a ) * 2.2 ];
			const p = lerp2( home, at, gather );
			const moving = gather > 0.02 && gather < 0.98;
			const going = lt < dur / 2;
			this.act( id, p[ 0 ], p[ 1 ], moving ? ( going ? yawTo( home, at ) : yawTo( at, home ) ) : yawTo( p, MOUND ), moving ? M.walk( lt * 1.7 ) : M.stand( lt + hash( id ) * 5 ), { y: moundY( p ) } );

		}

		this._batter( s, M.stand( lt ) );
		this._runners( s, lt );
		// the old pitcher waits for the manager on the mound, gives him the ball and walks off
		if ( s.oldPitcher ) {

			if ( lt < tTake ) this.act( s.oldPitcher, MOUND[ 0 ], MOUND[ 1 ] - 0.3, yawTo( MOUND, spot ), M.stand( lt ), { y: 0.25 } );
			else {

				const k = Math.min( 1, ( lt - tTake ) * 3.4 / dist( MOUND, dug ) );
				if ( k < 1 ) {

					const p = lerp2( MOUND, dug, k );
					this.act( s.oldPitcher, p[ 0 ], p[ 1 ], yawTo( MOUND, dug ), M.run( lt * 1.1, 0 ), { y: moundY( p ) } );

				}

			}

		}

		// the new one jogs in from the bullpen
		const from = BULLPEN[ s.fielding ];
		const k = Math.min( 1, lt / ( dur - 3 ) );
		const p = lerp2( from, MOUND, k );
		this.act( s.pitcher, p[ 0 ], p[ 1 ], k < 1 ? yawTo( from, MOUND ) : yawTo( MOUND, spot ), k < 1 ? M.run( lt * 1.2, 0.3 ) : this._hand( s.pitcher, M.stand( lt ) ), { y: moundY( p ) } );
		this._onDeck( s, lt );
		// the manager
		const tGive = dur - 2.6;
		if ( lt >= tGive + 0.9 ) return this._managerBack( s, lt - tGive - 0.9, spot );
		let mp, my, mpose;
		if ( lt < tOut ) {

			mp = lerp2( dug, spot, lt / tOut );
			my = yawTo( dug, spot );
			mpose = M.run( lt * 1.1, 0 );

		} else {

			// facing the old pitcher, then the new one, the ball held out to him
			mp = spot;
			my = yawTo( spot, lt < tTake + 1 ? MOUND : p );
			mpose = M.handOut( lt, ( lt - tGive + 0.4 ) / 0.4 );

		}

		this.act( `r:mgr:${ s.fielding }`, mp[ 0 ], mp[ 1 ], my, mpose, { who: MANAGERS[ s.fielding ], role: ROLE.jacket, y: moundY( mp ) } );

	}

	// the manager walking back to his dugout from the mound, t seconds after he started (from a pitching
	// change, on into the first pitch after it)
	_managerBack( s, t, spot ) {

		const dug = DUGOUT[ s.fielding ];
		const k = t * 2.4 / dist( spot, dug );
		if ( k >= 1 || t < 0 ) return;
		const p = lerp2( spot, dug, k );
		this.act( `r:mgr:${ s.fielding }`, p[ 0 ], p[ 1 ], yawTo( spot, dug ), M.walk( t * 1.8 ), { who: MANAGERS[ s.fielding ], role: ROLE.jacket, y: moundY( p ) } );

	}

	// The batting team's base coaches in their boxes, helmets on (2008 was the first season they had to
	// wear them) and jackets in the cold: Davey Lopes at first and Steve Smith at third for the Phillies,
	// George Hendrick and Tom Foley for the Rays (Looks.js). Before each pitch the third base coach goes
	// through his signs while the batter looks down at him, and both go hands on knees as the pitcher
	// comes set; on a ball in play the third base coach waves a runner round (the windmill) or throws up
	// both arms to stop him at third, and the first base coach claps a hitter in; between innings they
	// come out from the dugout. Slots are 'r:' ids, given back between halves.
	_coaches( seg, lt ) {

		const s = seg.snap;
		if ( ! s || ! s.batting || seg.kind === 'intro' || seg.kind === 'celebrate' ) return;
		if ( seg.kind === 'switch' && ( seg === this.suspension || lt < 5 ) ) return;
		const r2 = Math.SQRT1_2;
		for ( const side of [ 1, - 1 ] ) {

			// in the box (20 x 10 ft, 15 to 25 ft off the line), at its front near the bag
			const box = [ side * ( 26.6 + 4.9 ) * r2, ( - 26.6 + 4.9 ) * r2 ];
			let at = box, yaw = yawTo( box, [ 0, 0 ] ), pose = M.stand( lt + side );
			if ( seg.kind === 'switch' ) {

				const from = DUGOUT[ s.batting ], k = Math.min( 1, ( lt - 5 ) * JOG / dist( from, box ) );
				if ( k < 1 ) {

					at = lerp2( from, box, k );
					yaw = yawTo( from, box );
					pose = M.run( lt * 1.3, 0.1 );

				}

			} else if ( seg.kind === 'pitch' ) {

				const d = lt - PACE.set;
				if ( side < 0 && lt > 0.3 && lt < 2.1 ) pose = M.coachSigns( lt );
				else if ( d > - 0.7 && d < M.REL + 1.4 ) pose = M.umpReady( lt + side );
				if ( d > - 0.7 && d < M.REL + 1.4 ) yaw = yawTo( box, MOUND );

			} else if ( seg.kind === 'inplay' ) {

				for ( const r of seg.plan.runners ) {

					if ( r.out && r.to <= 3 ) continue;
					const T = Math.max( 0.1, r.tArrive - r.start ), S = Math.max( 0.1, r.len - r.lead );
					// when he's at first, and at third
					const at1 = r.start + T * Math.min( 1, Math.max( 0, 27.43 - r.lead ) / S );
					const at3 = r.start + T * Math.min( 1, Math.max( 0, ( 3 - r.from ) * 27.43 - r.lead ) / S );
					if ( side < 0 && r.from < 3 && r.to >= 4 && lt > at3 - 1.6 && lt < at3 + 0.6 ) {

						pose = M.windmill( lt );
						yaw = yawTo( box, BASES[ 2 ] );

					} else if ( side < 0 && r.from < 3 && r.to === 3 && lt > at3 - 1.4 && lt < at3 + 1.2 ) {

						pose = M.holdUp( lt );
						yaw = yawTo( box, BASES[ 2 ] );

					} else if ( side > 0 && r.from === 0 && ! r.out && lt > at1 - 0.8 && lt < at1 + 2.2 && s.batting === 'home' ) pose = M.clap( lt );

				}

			}

			pose.glove = false;
			const c = COACHES[ s.batting ][ side > 0 ? 0 : 1 ];
			this.act( `r:coach:${ s.batting }:${ side > 0 ? 1 : 3 }`, at[ 0 ], at[ 1 ], yaw, pose, { who: c, role: ROLE.helmet | ROLE.jacket } );

		}

	}

	// Brad Lidge drops to his knees, Carlos Ruiz runs out and throws his arms round him, Ryan Howard
	// piles on, then everyone.
	show_celebrate( seg, lt ) {

		// ---- R (rituals): the celebration rebuilt (game/Celebration.js): the pile built up properly, the
		// dugout, the coaches and the pen emptying onto the field, the hugs, the men going to the stands
		if ( ! this.oldCelebration ) return showCelebration( this, seg, lt );
		// ---- end R
		const s = seg.snap, P = this.game.players;
		const def = s.defense;
		const center = [ MOUND[ 0 ], MOUND[ 1 ] + 0.5 ];
		// Lidge
		this.act( def.P, center[ 0 ], center[ 1 ], Math.PI, lt < 0.4 ? M.jump( lt ) : M.kneel( lt - 0.4 ), { y: 0.2 } );
		// Ruiz: from behind the plate to Lidge, then the embrace
		const tR = 2.4;
		const rFrom = POSITIONS.C, rTo = [ center[ 0 ], center[ 1 ] + 0.55 ];
		if ( lt < tR ) {

			const p = lerp2( rFrom, rTo, lt / tR );
			this.act( def.C, p[ 0 ], p[ 1 ], yawTo( rFrom, rTo ), M.run( lt * 1.5, 1 ) );

		} else this.act( def.C, rTo[ 0 ], rTo[ 1 ], Math.PI, M.embrace( lt - tR, 1 ), { y: 0.2 } );

		// everyone else piles on: infielders first, outfielders, then the bench and the bullpen
		const pile = [];
		for ( const pos of [ '1B', '3B', '2B', 'SS', 'LF', 'CF', 'RF' ] ) if ( def[ pos ] ) pile.push( [ def[ pos ], POSITIONS[ pos ] ] );
		for ( const id of seg.plan.bench ) pile.push( [ id, P[ id ].pos === 'P' ? BULLPEN.home : DUGOUT.home ] );
		pile.forEach( ( [ id, from ], i ) => {

			const a = i * 2.39996, ring = i < 4 ? 0.9 : i < 12 ? 1.7 : 2.6;
			const spot = [ center[ 0 ] + Math.cos( a ) * ring, center[ 1 ] + Math.sin( a ) * ring ];
			const tArr = 1.0 + dist( from, spot ) / ( i < 7 ? RUN : RUN * 0.9 ) + ( i >= 7 ? 1.5 + hash( id ) * 2 : 0 );
			if ( lt < tArr ) {

				const k = Math.max( 0, ( lt - ( tArr - dist( from, spot ) / RUN ) ) / ( dist( from, spot ) / RUN ) );
				if ( k <= 0 && i >= 7 ) return;
				const p = lerp2( from, spot, Math.min( 1, k ) );
				this.act( id, p[ 0 ], p[ 1 ], yawTo( from, spot ), M.run( lt * 1.5, 1 ) );
				return;

			}

			// in the pile: the first ones dive on top, the rest jump round it
			if ( i < 6 ) {

				const lie = new Quaternion().setFromEuler( new Euler( - 1.3 + hash( id ) * 0.4, 0, hash( id + 1 ) * 0.8 - 0.4 ) );
				const h = 0.55 + ( i % 3 ) * 0.35;
				this.act( id, spot[ 0 ] * 0.7 + center[ 0 ] * 0.3, spot[ 1 ] * 0.7 + center[ 1 ] * 0.3, yawTo( spot, center ), M.sprawl( id ), { y: h, tilt: lie } );

			} else {

				this.act( id, spot[ 0 ], spot[ 1 ], yawTo( spot, center ), M.jump( lt + hash( id ) * 3 ) );

			}

		} );

		// the Rays leave the field
		const out = [ [ s.batter, boxFor( s.bats ) ] ];
		s.bases.forEach( ( id, b ) => id && out.push( [ id, BASES[ b + 1 ] ] ) );
		for ( const [ id, from ] of out ) {

			const to = DUGOUT.away;
			const k = Math.min( 1, lt * WALK / dist( from, to ) );
			if ( k >= 1 ) continue;
			const p = lerp2( from, to, k );
			this.act( id, p[ 0 ], p[ 1 ], yawTo( from, to ), M.run( lt * 0.7, 0 ) );

		}

	}

}

// ---------------------------------------------------------------- helpers

// ---- FB2 (C2B-3): p ([ x, z ]) brought in to `margin` metres inside the outfield fence (OUTFIELD's
// distances by angle from the center line, interpolated)
function insideFence( p, margin ) {

	const th = Math.atan2( p[ 0 ], - p[ 1 ] ) * 180 / Math.PI;
	let R = null;
	for ( let i = 0; i < OUTFIELD.length - 1; i ++ ) {

		const [ a0, d0 ] = OUTFIELD[ i ], [ a1, d1 ] = OUTFIELD[ i + 1 ];
		if ( a1 === a0 || th < a0 || th > a1 ) continue;
		R = ( d0 + ( d1 - d0 ) * ( th - a0 ) / ( a1 - a0 ) ) * FT;
		break;

	}

	const L = Math.hypot( p[ 0 ], p[ 1 ] );
	if ( R == null || L <= R - margin ) return p;
	return [ p[ 0 ] * ( R - margin ) / L, p[ 1 ] * ( R - margin ) / L ];

}
// ---- end FB2

// a root tilt about the player's own x axis (a slide, a dive), or none
function tiltX( a ) {

	return a ? new Quaternion().setFromEuler( new Euler( a, 0, 0 ) ) : null;

}

// A point d metres round the bases from base `from` toward base `to` (0 home .. 4 home again), and the
// runner's heading there: [ x, z, yaw ]. On the way into a base he'll go on from he swings out into
// foul ground (or the outfield grass) up to 1.6 m, and cuts back in to touch the bag's inside corner,
// so his heading turns through the curve rather than snapping 90° at the bag.
export function alongBases( from, to, d ) {

	const n = to - from, L = 27.43;
	if ( n <= 0 ) {

		const b = BASES[ from % 4 ];
		return [ b[ 0 ], b[ 1 ], yawTo( b, BASES[ ( from + 1 ) % 4 ] ) ];

	}

	const pt = ( x ) => {

		x = Math.max( 0, Math.min( n * L, x ) );
		const i = Math.min( n - 1, Math.floor( x / L ) );
		const a = BASES[ ( from + i ) % 4 ], b = BASES[ ( from + i + 1 ) % 4 ];
		const f = x / L - i;
		let px = a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * f, pz = a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * f;
		if ( i < n - 1 && f > 0.5 ) {

			// out from the middle of the diamond
			const ox = ( a[ 0 ] + b[ 0 ] ) / 2, oz = ( a[ 1 ] + b[ 1 ] ) / 2 + 19.4, ol = Math.hypot( ox, oz ) || 1;
			const out = 1.6 * Math.sin( Math.PI * ( f - 0.5 ) / 0.5 ) ** 1.5;
			px += ox / ol * out; pz += oz / ol * out;

		}

		return [ px, pz ];

	};

	const p = pt( d ), a = pt( d - 0.4 ), b = pt( d + 0.4 );
	return [ p[ 0 ], p[ 1 ], yawTo( a, b ) ];

}

function applyMoves( st, moves ) {

	for ( const r of moves ) {

		for ( let b = 0; b < 3; b ++ ) if ( st.bases[ b ] === r.id ) st.bases[ b ] = null;
		if ( ! r.out && r.to && r.to <= 3 ) st.bases[ r.to - 1 ] = r.id;

	}

}

function rolling( to, from3, dur ) {

	return ( t ) => {

		const k = Math.min( 1, t / dur );
		return [ from3[ 0 ] + ( to[ 0 ] - from3[ 0 ] ) * k, 0.04, from3[ 2 ] + ( to[ 1 ] - from3[ 2 ] ) * k ];

	};

}

// a foul ball: back over the catcher into the net, or off to the side into the stands
function foulBall( seed ) {

	const r = hash( seed ), side = hash( seed + 7 ) < 0.5 ? - 1 : 1;
	const back = r < 0.45;
	const to = back ? [ side * 4 * hash( seed + 3 ), 16 ] : [ side * ( 25 + 20 * hash( seed + 5 ) ), 5 - 25 * hash( seed + 9 ) ];
	const bb = battedBall( back ? 'line_drive' : 'fly_ball', 'medium', [ 0, - 0.4 ], to, seed );
	return ( t ) => t < bb.time ? bb.at( t ) : null;

}

// How long a ball in play lasted on the replay's clock before the gauntlet's fixes (step 8's
// _planInPlay, its arithmetic only): the radio call was voiced to that clock, so the timeline keeps it.
// (It read outBase 0, home, as no base, as the old plan did.)
function legacyInPlayDur( g, p, e, defense ) {

	const h = p.hit;
	const contact = [ ( p.bats === 'L' ? 0.25 : - 0.25 ), - 0.55 ];
	const to = h.x != null ? sprayToField( h.x, h.y ) : [ 0, - 60 ];
	const hr = /home_run/.test( p.result.type );
	const traj = h.traj || 'fly_ball';
	const bb = battedBall( traj, h.hard, contact, to, p.i );
	const posOf = ( id ) => Object.keys( defense ).find( ( k ) => defense[ k ] === id );
	const idAt = ( pos ) => defense[ pos ];
	let tBall = bb.time;
	const moves = p.runners.filter( ( r ) => r.k === e.k );
	const credits = moves.flatMap( ( r ) => r.credits );
	const locPos = POS_ORDER[ Number( h.loc ) - 1 ];
	const first = credits.find( ( c ) => /fielded|assist|putout|error/.test( c[ 1 ] ) );
	let fielderPos = first ? first[ 0 ] : locPos;
	if ( ! idAt( fielderPos ) ) fielderPos = locPos || 'CF';
	const fielder = idAt( fielderPos );
	const home = POSITIONS[ fielderPos ];
	const airOut = ! hr && moves.some( ( r ) => r.start === 0 && r.out && r.credits.some( ( c ) => c[ 1 ] === 'f_putout' && c[ 0 ] === fielderPos ) ) && traj !== 'ground_ball' && traj !== 'bunt_grounder';
	const tOut = new Map();
	if ( ! hr ) {

		const reach = dist( home, to ) / RUN;
		const tArrive = airOut ? Math.max( bb.time - 0.2, Math.min( bb.time, reach ) ) : Math.max( bb.time, reach + 0.3 );
		tBall = Math.max( bb.time, tArrive ) + 0.5;
		let holder = { id: fielder, at: to };
		const outs = moves.filter( ( r ) => r.out && r.outBase ).sort( ( a, b ) => ( a.outNumber ?? 9 ) - ( b.outNumber ?? 9 ) );
		for ( const r of outs ) {

			const put = r.credits.find( ( c ) => c[ 1 ] === 'f_putout' );
			if ( ! put ) continue;
			const target = idAt( put[ 0 ] ) || put[ 2 ];
			if ( target === holder.id && airOut ) continue;
			const baseAt = BASES[ r.outBase % 4 ];
			if ( target === holder.id ) tBall += dist( holder.at, baseAt ) / RUN;
			else tBall += 0.3 + throwPath( holder.at, baseAt ).time;
			tOut.set( r, tBall );
			holder = { id: target, at: baseAt };

		}

		if ( ! outs.length && ! airOut ) {

			const cover = idAt( to[ 0 ] > 0 ? '2B' : 'SS' );
			if ( cover && cover !== holder.id ) tBall += 0.35 + throwPath( holder.at, BASES[ 2 ], 26 ).time;

		}

	}

	let tEnd = tBall;
	for ( const r of moves ) {

		const from = r.start || 0;
		const toBase = r.out ? ( r.outBase || from + 1 ) : ( r.to ?? from );
		const start = from === 0 ? 0.55 : 0.2;
		const len = Math.max( 0, toBase - from ) * 27.43;
		let tArrive = start + len / ( RUN * ( r.id === p.batter ? 0.95 : 1 ) );
		if ( airOut && r.id !== p.batter ) tArrive = start;
		if ( r.out && tOut.has( r ) && len > 0 ) tArrive = Math.max( tOut.get( r ) + 0.25, tArrive );
		if ( airOut && r.id === p.batter ) tArrive = Math.min( tArrive, bb.time );
		tEnd = Math.max( tEnd, tArrive );

	}

	void g; void posOf;
	return Math.max( tEnd, tBall ) + 2.2 + ( hr ? 6 : 0 );

}

// the mound's height under a man standing at p (10 in at the rubber, down to the grass 9 ft out)
function moundY( p ) {

	const d = dist( p, MOUND );
	return d < 2.7 ? 0.25 * ( 1 - d / 2.7 ) : 0;

}

// how long a play's fielders hold their last spots (a receive that lasts the play)
function tEndGuess( tBall ) {

	return tBall + 6;

}

function cheerFor( p ) {

	// the crowd: loud for the Phillies' hits and outs they get, quiet otherwise
	const phiBat = p.half === 'bottom';
	const good = /single|double|triple|home_run|walk|hit_by_pitch|sac/.test( p.result.type ) || p.result.rbi > 0;
	return phiBat ? ( good ? 2 : - 1 ) : ( good ? - 1 : 1 );

}

function shortResult( p ) {

	const loc = { 1: 'P', 2: 'C', 3: '1B', 4: '2B', 5: '3B', 6: 'SS', 7: 'LF', 8: 'CF', 9: 'RF' }[ p.hit?.loc ] || '';
	const t = p.result.type;
	const where = loc ? ' TO ' + loc : '';
	if ( t === 'strikeout' ) return /looking|called/i.test( p.result.desc ) ? 'CALLED OUT ON STRIKES' : 'STRUCK OUT';
	if ( t === 'walk' ) return 'WALKED';
	if ( t === 'hit_by_pitch' ) return 'HIT BY PITCH';
	if ( t === 'home_run' ) return 'HOMERED';
	if ( /single|double|triple/.test( t ) ) return t.toUpperCase() + ( t === 'single' ? 'D' : 'D' ) + where;
	if ( /sac/.test( t ) ) return 'SACRIFICED';
	if ( /double_play/.test( t ) ) return 'GROUNDED INTO DP';
	if ( /force/.test( t ) ) return 'FORCE OUT';
	if ( /error/.test( t ) ) return 'REACHED ON ERROR';
	const traj = p.hit?.traj;
	return ( traj === 'fly_ball' ? 'FLIED OUT' : traj === 'popup' ? 'POPPED OUT' : traj === 'line_drive' ? 'LINED OUT' : 'GROUNDED OUT' ) + where;

}

export function ordinal( n ) {

	return n + ( [ 'th', 'st', 'nd', 'rd' ][ ( n % 100 - 20 ) % 10 ] || [ 'th', 'st', 'nd', 'rd' ][ n % 100 ] || 'th' );

}

export function scoreLine( g, sc ) {

	const a = g.teams.away.club, h = g.teams.home.club;
	if ( sc.away === sc.home ) return `Tied, ${ sc.away } to ${ sc.home }`;
	return sc.home > sc.away ? `${ h } ${ sc.home }, ${ a } ${ sc.away }` : `${ a } ${ sc.away }, ${ h } ${ sc.home }`;

}
