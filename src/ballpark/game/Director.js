import { Quaternion, Euler } from '../../engine/index.js';
import * as M from './Motions.js';
import { POSITIONS, BASES, MOUND, DUGOUT, BULLPEN, ON_DECK, boxFor, sprayToField, pitchPath, fallbackPfx, battedBall, throwPath, basePath, dist, lerp2, yawTo } from './Plays.js';

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
const RUN = 7.8, JOG = 4.2, WALK = 1.6;
const SWINGS = new Set( [ 'S', 'F', 'T', 'W', 'L', 'M', 'O', 'Q', 'R', 'X', 'D', 'E' ] );
const FOULS = new Set( [ 'F', 'T', 'L', 'O', 'R' ] );
const POS_ORDER = [ 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF' ];
const hash = ( n ) => {

	const s = Math.sin( n * 12.9898 ) * 43758.5453;
	return s - Math.floor( s );

};

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
				push( pi === 0 ? 'intro' : 'switch', pi === 0 ? PACE.intro : PACE.switch, {
					pi, snap: snap( { batting, fielding, defense, oldDefense: prevDefense, batter: p.batter, bats: p.bats, onDeck: nextBatter( pi ), pitcher: p.pitcher } ),
					cues: [ [ 1, { say: pi === 0 ? `${ g.title }. ${ g.teams.away.club } at ${ g.teams.home.club }, ${ g.venue }.` : `${ inn }. ${ scoreLine( g, st.score ) }` } ] ],
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

					const plan = this._planInPlay( p, e, defense, st );
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
			push( 'result', isLast ? 1.2 : PACE.result, {
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
		const bb = battedBall( traj, h.hard, contact, to, p.i );
		const plan = { ball: [], fielders: {}, runners: [], cues: [], hr, bb, contact };
		const posOf = ( id ) => Object.keys( defense ).find( ( k ) => defense[ k ] === id );
		const idAt = ( pos ) => defense[ pos ];
		plan.ball.push( { t0: 0, dur: bb.time, at: bb.at } );
		let tBall = bb.time;
		const moves = p.runners.filter( ( r ) => r.k === e.k );
		// the fielder who gets to it: the first one credited, else the one at the hit's location
		const credits = moves.flatMap( ( r ) => r.credits );
		const locPos = POS_ORDER[ Number( h.loc ) - 1 ];
		let first = credits.find( ( c ) => /fielded|assist|putout|error/.test( c[ 1 ] ) );
		let fielderPos = first ? first[ 0 ] : locPos;
		if ( ! idAt( fielderPos ) ) fielderPos = locPos || 'CF';
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
			const d = dist( home, to );
			const reach = d / RUN;
			const tArrive = airOut ? Math.max( bb.time - 0.2, Math.min( bb.time, reach ) ) : Math.max( bb.time, reach + 0.3 );
			run( fielder, home, [ { t0: 0.25, t1: Math.max( 0.3, tArrive ), to, act: d > 3 ? 'run' : 'shuffle' } ] );
			const tField = Math.max( bb.time, tArrive );
			const grab = airOut ? 'catch' : ( bb.ground ? 'grounder' : 'pickup' );
			run( fielder, to, [ { t0: tField - 0.1, t1: tField + 0.5, to, act: grab } ] );
			if ( ! airOut && tField > bb.time ) plan.ball.push( { t0: bb.time, dur: tField - bb.time, at: rolling( to, bb.at( bb.time ), tField - bb.time ) } );
			tBall = tField + 0.5;
			plan.cues.push( [ 0.02, { crack: h.hard || 'medium' } ], [ tField, { glove: true } ] );

			// the throws: to each out's putout man at the out base, in order
			let holder = { id: fielder, at: to, pos: fielderPos };
			const outs = moves.filter( ( r ) => r.out && r.outBase ).sort( ( a, b ) => ( a.outNumber ?? 9 ) - ( b.outNumber ?? 9 ) );
			for ( const r of outs ) {

				const put = r.credits.find( ( c ) => c[ 1 ] === 'f_putout' );
				if ( ! put ) continue;
				const target = idAt( put[ 0 ] ) || put[ 2 ];
				if ( target === holder.id && airOut ) continue;
				const baseAt = BASES[ r.outBase % 4 ];
				if ( target === holder.id ) {

					// he takes it himself: run to the base
					run( target, holder.at, [ { t0: tBall, t1: tBall + dist( holder.at, baseAt ) / RUN, to: baseAt, act: 'run' } ] );
					tBall += dist( holder.at, baseAt ) / RUN;
					r.tOut = tBall;
					holder = { id: target, at: baseAt, pos: put[ 0 ] };
					continue;

				}

				// the receiver covers the base
				const rPos = posOf( target ) || put[ 0 ];
				const rHome = POSITIONS[ rPos ] || baseAt;
				run( target, rHome, [ { t0: 0.4, t1: Math.min( tBall + 0.3, 0.4 + dist( rHome, baseAt ) / RUN ), to: baseAt, act: 'run' }, { t0: tBall + 0.3, t1: tBall + 0.3 + 1.5, to: baseAt, act: 'receive' } ] );
				const th = throwPath( holder.at, baseAt );
				run( holder.id, holder.at, [ { t0: tBall - 0.1, t1: tBall + 0.4, to: holder.at, act: 'throw', aim: baseAt } ] );
				plan.ball.push( { t0: tBall + 0.3, dur: th.time, at: th.at } );
				plan.cues.push( [ tBall + 0.3 + th.time, { glove: true } ] );
				tBall += 0.3 + th.time;
				r.tOut = tBall;
				holder = { id: target, at: baseAt, pos: rPos };

			}

			// a hit: the ball comes back in to second base
			if ( ! outs.length && ! airOut ) {

				const cut = BASES[ 2 ];
				const cover = idAt( to[ 0 ] > 0 ? '2B' : 'SS' );
				if ( cover && cover !== holder.id ) {

					const cHome = POSITIONS[ to[ 0 ] > 0 ? '2B' : 'SS' ];
					run( cover, cHome, [ { t0: 0.5, t1: 0.5 + dist( cHome, cut ) / JOG, to: cut, act: 'run' }, { t0: tBall + 0.4, t1: tBall + 2, to: cut, act: 'receive' } ] );
					const th = throwPath( holder.at, cut, 26 );
					run( holder.id, holder.at, [ { t0: tBall, t1: tBall + 0.5, to: holder.at, act: 'throw', aim: cut } ] );
					plan.ball.push( { t0: tBall + 0.35, dur: th.time, at: th.at } );
					tBall += 0.35 + th.time;

				}

			}

			plan.cues.push( [ Math.min( tField + 0.3, tBall ), { cheer: cheerFor( p ) } ] );

		}

		// the runners (and the batter): base to base; outs stop at the base and head off
		let tEnd = tBall;
		for ( const r of moves ) {

			const from = r.start || 0;
			const toBase = r.out ? ( r.outBase || from + 1 ) : ( r.to ?? from );
			const start = from === 0 ? 0.55 : 0.2;
			const len = Math.max( 0, toBase - from ) * 27.43;
			let speed = RUN * ( r.id === p.batter ? 0.95 : 1 );
			let tArrive = start + len / speed;
			// on a fly out the runners hold
			if ( airOut && r.id !== p.batter ) tArrive = start;
			// forced out: he gets there just after the ball
			if ( r.out && r.tOut != null && len > 0 ) tArrive = Math.max( r.tOut + 0.25, tArrive );
			if ( airOut && r.id === p.batter ) tArrive = Math.min( tArrive, bb.time );
			plan.runners.push( { id: r.id, from, to: toBase, start, tArrive, out: r.out, scores: toBase >= 4, halt: airOut && r.id === p.batter ? 0.6 : 1 } );
			tEnd = Math.max( tEnd, tArrive );

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
		this.now = { seg, snap: seg.snap, count: [ seg.snap.balls, seg.snap.strikes ], outs: seg.snap.outs, desc: seg.snap.desc, pitch: null };
		this[ 'show_' + seg.kind ]( seg, lt );
		this._sync();

	}

	// put a player in this frame
	act( id, x, z, yaw, pose, extra = {} ) {

		if ( id == null ) return;
		this.actors.set( id, { x, z, yaw, pose, ...extra } );

	}

	_sync() {

		const P = this.game.players;
		for ( const [ id, a ] of this.actors ) {

			let s = this.slots.get( id );
			if ( ! s ) {

				const info = P[ id ] || { side: 'home', num: '', throws: 'R' };
				s = this.players.add( { team: info.side, number: info.num, gloveHand: info.throws === 'L' ? 'R' : 'L', skin: Math.floor( hash( id ) * 4 ), name: info.last } );
				this.slots.set( id, s );

			}

			s.visible = true;
			s.x = a.x; s.z = a.z; s.yaw = a.yaw; s.y = a.y || 0; s.tilt = a.tilt || null;
			s.pose = a.pose;

		}

		for ( const [ id, s ] of this.slots ) if ( ! this.actors.has( id ) ) s.visible = false;
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
		this.act( id, POSITIONS.C[ 0 ], POSITIONS.C[ 1 ], 0, M.catcherCrouch( lt, glove ) );

	}

	_pitcherStanding( snap, lt ) {

		const id = snap.defense.P;
		this.act( id, MOUND[ 0 ], MOUND[ 1 ], Math.PI, this._hand( id, M.stand( lt ) ), { y: 0.25 } );

	}

	_hand( id, pose ) {

		return this.game.players[ id ]?.throws === 'L' ? M.mirror( pose ) : pose;

	}

	_batter( snap, pose ) {

		const [ x, z ] = boxFor( snap.bats );
		const left = snap.bats === 'L';
		this.act( snap.batter, x, z, left ? Math.PI / 2 : - Math.PI / 2, left ? M.mirror( pose ) : pose );

	}

	_onDeck( snap, lt ) {

		if ( ! snap.onDeck ) return;
		const [ x, z ] = ON_DECK[ snap.batting ];
		const pose = M.batterStance( lt * 0.7 );
		pose.pelvisY = 0.93;
		this.act( snap.onDeck, x, z, yawTo( [ x, z ], MOUND ), pose );

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

		const s = seg.snap;
		// last half's fielders come in, this half's go out
		if ( s.oldDefense ) this._runIn( s.oldDefense, s.batting, lt );
		this._runOut( s.defense, s.fielding, lt, 4 );
		this._onDeck( { ...s, onDeck: s.batter }, lt );

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

	}

	show_pitch( seg, lt ) {

		const s = seg.snap, e = seg.ev;
		const d = lt - PACE.set;
		const pid = s.defense.P;
		const lefty = this.game.players[ pid ]?.throws === 'L';
		this.now.pitch = e;
		// after ball four or strike three the count stays at 3 balls / 2 strikes (the boards never show a 3rd strike)
		this.now.count = d > M.REL + seg.path.flight ? [ Math.min( 3, e.count[ 0 ] ), Math.min( 2, e.count[ 1 ] ) ] : [ s.balls, s.strikes ];
		// the pitcher: set, then the delivery, the release at the pitch's own release point
		const root = [ MOUND[ 0 ], MOUND[ 1 ] + 0.35 ];
		const rel = seg.path.at( 0 );
		// the release point in the pitcher's frame (he faces +z: his x is the field's -x, his -z the field's +z)
		let relLocal = [ root[ 0 ] - rel[ 0 ], rel[ 1 ] - 0.25, root[ 1 ] - rel[ 2 ] ];
		if ( lefty ) relLocal = [ - relLocal[ 0 ], relLocal[ 1 ], relLocal[ 2 ] ];
		let pp;
		if ( d < 0 ) pp = lt < 1.2 ? M.stand( lt ) : M.blend( M.stand( lt ), M.pitcherSet(), Math.min( 1, ( lt - 1.2 ) / 0.6 ) );
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
		const glove = [ catchAt[ 0 ] - POSITIONS.C[ 0 ], catchAt[ 1 ], catchAt[ 2 ] - POSITIONS.C[ 1 ] ];
		const gk = Math.min( 1, Math.max( 0, ( tb + 0.35 ) / 0.3 ) );
		this._catcher( s, lt, gk > 0 ? [ - 0.08 + ( glove[ 0 ] + 0.08 ) * gk, 0.72 + ( glove[ 1 ] - 0.72 ) * gk, - 0.48 + ( glove[ 2 ] + 0.48 ) * gk ] : null );
		if ( tb >= - 0.02 && tb < flight ) this.ballAt = seg.path.at( Math.max( 0, tb ) );
		else if ( tb >= flight && ! seg.foul && ! e.inPlay ) {

			if ( tb < toC ) this.ballAt = seg.path.at( tb );
			else if ( tb < toC + 1.3 ) this.ballAt = catchAt;
			else {

				// back to the pitcher
				const th = throwPath( POSITIONS.C, root, 14 );
				const tt = tb - toC - 1.3;
				this.ballAt = tt < th.time ? th.at( tt ) : null;

			}

		} else if ( seg.foul && tb >= flight ) {

			const q = seg.foulPath( tb - flight );
			this.ballAt = q;

		}

		// the batter
		if ( seg.swing ) {

			const start = M.REL + flight - M.CONTACT;
			this._batter( s, d >= start ? M.swing( d - start ) : M.batterStance( lt ) );

		} else {

			this._batter( s, d >= M.REL ? M.take( d - M.REL ) : M.batterStance( lt ) );

		}

		// steals and passed balls on this pitch
		for ( const a of seg.acts ) for ( const mv of a.moves ) {

			const from = mv.start || mv.from, to = mv.out ? ( mv.outBase || from + 1 ) : ( mv.to ?? from );
			const k = Math.min( 1, Math.max( 0, ( d - 0.1 ) * RUN / ( 27.43 * Math.max( 1, to - from ) ) ) );
			const p = basePath( from, to, k );
			this.act( mv.id, p[ 0 ], p[ 1 ], yawTo( BASES[ from % 4 ], BASES[ to % 4 ] ), k < 1 ? M.run( d * 1.4, 1 ) : M.stand( lt ) );

		}

	}

	show_steal( seg, lt ) {

		const s = seg.snap;
		this._fielders( s, lt, 'ready' );
		this._catcher( s, lt );
		this._pitcherStanding( s, lt );
		this._batter( s, M.batterStance( lt ) );
		for ( const a of seg.acts ) for ( const mv of a.moves ) {

			const from = mv.start || mv.from, to = mv.out ? ( mv.outBase || from + 1 ) : ( mv.to ?? from );
			const k = Math.min( 1, Math.max( 0, ( lt - 0.8 ) * RUN / 27.43 ) );
			const p = basePath( from, to, k );
			this.act( mv.id, p[ 0 ], p[ 1 ], yawTo( BASES[ from % 4 ], BASES[ to % 4 ] ), k < 1 ? M.run( lt * 1.4, 1 ) : M.stand( lt ) );

		}

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

				} else if ( st.act === 'receive' ) {

					at = st.to; yaw = yawTo( at, [ 0, - 20 ] ); pose = M.catchHigh( lt ); pose.pelvisY = 0.9;

				}

				done = true;

			}

			void done;
			const pos = Object.keys( s.defense ).find( ( k ) => s.defense[ k ] === id );
			this.act( id, at[ 0 ], at[ 1 ], yaw, pos === 'P' || this.game.players[ id ]?.throws === 'L' ? this._hand( id, pose ) : pose );

		}

		// runners
		for ( const r of plan.runners ) {

			let p, yaw, pose;
			if ( lt < r.start ) {

				// the batter finishes his swing
				if ( r.id === s.batter ) {

					this._batter( s, M.swing( M.CONTACT + lt ) );
					continue;

				}

				p = BASES[ r.from % 4 ]; yaw = yawTo( p, BASES[ ( r.from + 1 ) % 4 ] ); pose = M.ready( lt );

			} else {

				const k = Math.min( 1, ( lt - r.start ) / Math.max( 0.1, r.tArrive - r.start ) );
				p = basePath( r.from, r.to, k * r.halt );
				const leg = Math.min( r.to - 1, Math.floor( k * ( r.to - r.from ) ) + r.from );
				yaw = yawTo( BASES[ leg % 4 ], BASES[ ( leg + 1 ) % 4 ] );
				pose = k < 1 ? M.run( lt * 1.45, 1 ) : M.stand( lt );
				if ( k >= 1 && ( r.out || r.scores ) ) {

					// off the field
					const off = Math.min( 1, ( lt - r.tArrive ) * 0.2 );
					const dug = DUGOUT[ s.batting ];
					p = lerp2( p, dug, off );
					yaw = yawTo( p, dug );
					pose = off < 1 ? M.run( lt, 0 ) : M.stand( lt );
					if ( off >= 1 ) continue;

				}

			}

			this.act( r.id, p[ 0 ], p[ 1 ], yaw, pose );

		}

		// runners who didn't move
		s.bases.forEach( ( id ) => {

			if ( id && ! plan.runners.some( ( r ) => r.id === id ) ) {

				const b = s.bases.indexOf( id ) + 1;
				this.act( id, BASES[ b ][ 0 ], BASES[ b ][ 1 ], yawTo( BASES[ b ], [ 0, 0 ] ), M.stand( lt ) );

			}

		} );

		if ( ! plan.runners.some( ( r ) => r.id === s.batter ) ) this._batter( s, M.stand( lt ) );
		this.ballAt = ball;

	}

	_ballIn( plan, lt ) {

		let last = null;
		for ( const b of plan.ball ) {

			if ( lt >= b.t0 && lt <= b.t0 + b.dur ) return b.at( lt - b.t0 );
			if ( lt > b.t0 + b.dur ) last = b.at( b.dur );

		}

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

	}

	show_change( seg, lt ) {

		const s = seg.snap;
		this._fielders( s, lt );
		this._catcher( s, lt );
		this._batter( s, M.stand( lt ) );
		this._runners( s, lt );
		// the old pitcher walks off, the new one jogs in from the bullpen
		if ( s.oldPitcher ) {

			const to = DUGOUT[ s.fielding ];
			const k = Math.min( 1, lt * WALK * 1.5 / dist( MOUND, to ) );
			if ( k < 1 ) {

				const p = lerp2( MOUND, to, k );
				this.act( s.oldPitcher, p[ 0 ], p[ 1 ], yawTo( MOUND, to ), M.run( lt * 0.8, 0 ) );

			}

		}

		const from = BULLPEN[ s.fielding ];
		const d = dist( from, MOUND );
		const k = Math.min( 1, lt * ( d / ( seg.dur - 3 ) ) / d );
		const p = lerp2( from, MOUND, k );
		this.act( s.pitcher, p[ 0 ], p[ 1 ], k < 1 ? yawTo( from, MOUND ) : Math.PI, k < 1 ? M.run( lt * 1.2, 0.3 ) : this._hand( s.pitcher, M.stand( lt ) ), { y: k >= 1 ? 0.25 : 0 } );
		this._onDeck( s, lt );

	}

	// Brad Lidge drops to his knees, Carlos Ruiz runs out and throws his arms round him, Ryan Howard
	// piles on, then everyone.
	show_celebrate( seg, lt ) {

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
