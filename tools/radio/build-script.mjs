// The radio broadcast's script: a play-by-play man and a colour man calling Game 5 on the replay's own
// timeline (the Director's segments), written to tools/radio/script.json for build-audio.py.
//
//   node tools/radio/build-script.mjs
//
// Every line: { t (s on the replay's clock), voice: 'pbp' | 'color', text, prio (3 must, 2 should, 1 if
// there's room), wait (how long it may slip to find a gap) }. Deterministic: the same game makes the
// same call.
import { writeFileSync } from 'node:fs';
import { Director } from '../../src/ballpark/game/Director.js';
import { GAME } from '../../src/ballpark/data/game-2008-ws5.js';

const G = GAME, P = G.players;
const d = new Director( { game: G, players: { add: () => ( {} ) }, ball: { set() {} } } );

let seed = 7;
const rnd = () => ( seed = ( seed * 16807 ) % 2147483647 ) / 2147483647;
const pick = ( a ) => a[ Math.floor( rnd() * a.length ) ];
const WORD = [ 'no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten' ];
const ORD = [ '', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth' ];
const POS = { P: 'the pitcher', C: 'the catcher', '1B': 'first', '2B': 'second', '3B': 'third', SS: 'short', LF: 'left', CF: 'center', RF: 'right' };
const POSN = { P: 'pitcher', C: 'catcher', '1B': 'first baseman', '2B': 'second baseman', '3B': 'third baseman', SS: 'shortstop', LF: 'left fielder', CF: 'center fielder', RF: 'right fielder', DH: 'designated hitter', PH: 'pinch hitter', PR: 'pinch runner' };
const FIELD = { 7: 'left', 8: 'center', 9: 'right', 78: 'left center', 89: 'right center', 1: 'the mound', 2: 'the plate', 3: 'first', 4: 'second', 5: 'third', 6: 'short' };
const last = ( id ) => P[ id ]?.last || 'the runner';
const name = ( id ) => P[ id ]?.name || '';
const club = ( side ) => G.teams[ side ].club;
const lines = [];
const say = ( t, voice, text, prio = 2, wait = 2 ) => lines.push( { t: Math.round( t * 100 ) / 100, voice, text, prio, wait } );

function scoreLine( s ) {

	const a = s.away, h = s.home;
	if ( a === 0 && h === 0 ) return pick( [ 'No score.', 'Still no score.', 'Scoreless.' ] );
	if ( a === h ) return pick( [ `We're tied at ${ WORD[ a ] || a }.`, `It's ${ WORD[ a ] || a } all.`, `Tie ballgame, ${ a } to ${ h }.` ] );
	const [ lead, trail, hi, lo ] = h > a ? [ 'Phillies', 'Rays', h, a ] : [ 'Rays', 'Phillies', a, h ];
	return pick( [ `The ${ lead } lead it, ${ hi } to ${ lo }.`, `${ lead } ${ hi }, ${ trail } ${ lo }.`, `It's ${ hi } to ${ lo }, ${ lead }.` ] );

}

const countWords = ( b, s ) => b === 3 && s === 2 ? 'Full count.' : `${ WORD[ b ] === 'no' ? 'Oh' : cap( WORD[ b ] ) } and ${ WORD[ s ] === 'no' ? 'oh' : WORD[ s ] }.`;
const cap = ( w ) => w[ 0 ].toUpperCase() + w.slice( 1 );
const outsWords = ( o ) => [ 'Nobody out.', 'One away.', 'Two down.', '' ][ o ] || '';

// ---------------------------------------------------------------- the calls

function pitchCall( seg ) {

	const e = seg.ev, s = seg.snap, pit = last( s.defense.P );
	const [ b0, s0 ] = [ s.balls, s.strikes ];
	const [ b1, s1 ] = e.count;
	const cw = ( n ) => n === 0 ? 'oh' : WORD[ n ];
	const which = b0 === 0 && s0 === 0 ? 'first' : b0 === 3 && s0 === 2 ? 'payoff' : `${ cw( b0 ) }-${ cw( s0 ) }`;
	const lead = pick( [ `${ pit } deals.`, `Here's the pitch.`, `The ${ which } pitch...`, `${ pit } sets... and the pitch.`, `Pitch on the way.`, `And the ${ which } pitch.` ] );
	const spd = e.speed && rnd() < 0.3 ? ` ${ Math.round( e.speed ) } on the gun.` : '';
	const c = e.call;
	let out = '';
	if ( /^(X|D|E)$/.test( c ) ) return { text: pick( [ `${ lead } Swung on...`, `${ lead }`, `${ lead } And he swings...` ] ), prio: 2 };
	if ( c === 'B' || c === '*B' || c === 'V' ) {

		if ( b1 >= 4 ) return { text: `${ lead } ${ pick( [ 'Ball four. He walks.', 'Outside, ball four, and he\'ll take first.', 'Low, ball four.' ] ) }`, prio: 3 };
		out = c === '*B' ? `In the dirt, ball ${ WORD[ b1 ] }.` : pick( [ `Ball ${ WORD[ b1 ] }, outside.`, `Misses low, ball ${ WORD[ b1 ] }.`, `High, ball ${ WORD[ b1 ] }.`, `Just off the plate.`, `Inside, ball.` ] );

	} else if ( c === 'C' ) {

		if ( s1 >= 3 ) return { text: `${ lead } ${ pick( [ 'Called strike three! He rung him up!', 'Strike three called! He froze him!', 'Caught looking, strike three.' ] ) }`, prio: 3 };
		out = pick( [ `Called strike ${ WORD[ s1 ] }.`, `On the corner, strike.`, `Taken for a strike.`, `Strike ${ WORD[ s1 ] }, called.` ] );

	} else if ( c === 'S' || c === 'W' || c === 'M' ) {

		if ( s1 >= 3 ) return { text: `${ lead } ${ pick( [ 'Swung on and missed! Struck him out!', 'Swing and a miss, strike three!', 'He chases, strike three!' ] ) }`, prio: 3 };
		out = pick( [ `Swung on and missed.`, `Swing and a miss, strike ${ WORD[ s1 ] }.`, `He chases, and misses.` ] );

	} else if ( c === 'F' || c === 'T' || c === 'L' ) {

		out = pick( [ `Fouled back.`, `Fouled off, out of play.`, `Foul ball.`, `Fouled away.` ] );

	} else if ( c === 'H' ) return { text: `${ lead } Oh, and he's hit by the pitch.`, prio: 3 };
	else out = e.desc || '';
	const count = ( b1 < 4 && s1 < 3 && rnd() < 0.65 ) ? ' ' + countWords( b1, Math.min( 2, s1 ) ) : '';
	return { text: `${ lead } ${ out }${ spd }${ count }`, prio: 2 };

}

function resultCall( seg ) {

	const p = G.plays[ seg.pi ], r = p.result, h = p.hit || {}, s = seg.snap;
	const who = last( p.batter );
	const fieldOf = ( loc ) => FIELD[ loc ] || 'the outfield';
	const bat = p.runners.find( ( x ) => x.id === p.batter ) || { credits: [] };
	const fielders = bat.credits.map( ( [ pos ] ) => pos );
	const byPos = ( pos ) => last( ( s.defense || {} )[ pos ] );
	const traj = h.traj || '';
	const where = fieldOf( h.loc );
	let text = '';
	switch ( r.type ) {

		case 'home_run':
			text = `Swung on and belted! Deep to ${ where }... it is... outta here! Home run, ${ who }!`; break;
		case 'double':
			text = traj === 'ground_ball' ? `Ground ball down the line... fair! Into the corner, ${ who } into second with a double!` : `Drives one to ${ where }... that's in the gap! ${ who } cruises into second, a double!`; break;
		case 'triple':
			text = `Into the gap in ${ where }, it rolls to the wall, ${ who } is going for three... he's in, a triple!`; break;
		case 'single':
			text = traj === 'ground_ball' ? pick( [ `Ground ball... through the hole into ${ where }, base hit.`, `Bouncer up the middle... base hit, ${ who }.` ] )
				: traj === 'line_drive' ? pick( [ `Lined into ${ where }, base hit!`, `Line drive, base hit to ${ where }.` ] )
					: pick( [ `Looping fly to ${ where }... it drops in! Base hit.`, `Blooper, falls in in ${ where }.` ] ); break;
		case 'walk': case 'intent_walk': text = ''; break;
		case 'hit_by_pitch': text = `${ who } takes his base.`; break;
		case 'strikeout': text = ''; break;
		case 'grounded_into_double_play':
			text = `Ground ball to ${ POS[ fielders[ 0 ] ] || 'the infield' }... they'll turn two! ${ pick( [ 'Double play!', 'Around the horn, double play!' ] ) }`; break;
		case 'force_out':
			text = `Ground ball to ${ POS[ fielders[ 0 ] ] || 'the infield' }, they get the force.`; break;
		case 'sac_bunt':
			text = `He squares, lays it down... sacrifice bunt, the runner moves up.`; break;
		case 'field_error':
			text = `Ground ball... and it's booted! An error, and ${ who } is on.`; break;
		case 'field_out': {

			const f = fielders[ fielders.length - 1 ] || fielders[ 0 ];
			const catcher = f ? byPos( f ) : '';
			if ( traj === 'fly_ball' ) text = pick( [ `Fly ball to ${ where }... ${ catcher } under it... and makes the catch.`, `Lifted to ${ where }, ${ catcher } settles under it, and that's an out.` ] );
			else if ( traj === 'popup' ) text = pick( [ `Popped up... ${ catcher } calls for it, and squeezes it.`, `High pop-up, ${ catcher } has it.` ] );
			else if ( traj === 'line_drive' ) text = pick( [ `Lined... right at ${ catcher }!`, `Line drive, caught by ${ catcher }.` ] );
			else {

				const [ a, b ] = fielders;
				text = a && b && a !== b ? `Ground ball to ${ POS[ a ] }, ${ byPos( a ) } over to ${ b === '1B' ? 'first' : byPos( b ) }... in time.` : `Ground ball, ${ a ? byPos( a ) : 'the infielder' } gathers it... and gets him.`;

			}

			break;

		}

		default: text = r.desc;

	}

	// runs, the score and the outs
	const scored = p.runners.filter( ( x ) => x.scores );
	let tail = '';
	if ( scored.length ) {

		const names = scored.map( ( x ) => last( x.id ) );
		tail += ' ' + ( names.length === 1 ? `${ names[ 0 ] } scores!` : `${ names.slice( 0, - 1 ).join( ', ' ) } and ${ names[ names.length - 1 ] } come in to score!` );
		tail += ' ' + scoreLine( { away: r.away, home: r.home } );

	}

	// (the result's snapshot already counts this play's outs)
	const outsAfter = Math.min( 3, s.outs );
	if ( outsAfter >= 3 ) tail += ' ' + pick( [ 'And that will retire the side.', 'That\'s three outs.', 'And the inning is over.' ] );
	else if ( r.out || /out/.test( r.type ) ) tail += ' ' + outsWords( outsAfter );
	return { text: ( text + tail ).trim(), scored: scored.length, lead: r.home > r.away ? 'home' : r.away > r.home ? 'away' : 'tie' };

}

// ---------------------------------------------------------------- walk the timeline

const today = {};
let firstNight = true, suspended = false;
for ( const seg of d.segments ) {

	const s = seg.snap, t0 = seg.t0;
	if ( seg.kind === 'intro' ) {

		say( t0 + 1, 'pbp', `Good evening everybody, and welcome to Citizens Bank Park in South Philadelphia for Game Five of the 2008 World Series. The Tampa Bay Rays and the Philadelphia Phillies.`, 3, 1 );
		say( t0 + 11, 'color', `The Phillies lead this Series three games to one. One more win, and they are champions of baseball for the first time since nineteen eighty. Cole Hamels on the mound tonight.`, 3, 4 );

	} else if ( seg.kind === 'switch' ) {

		const { inning, half } = s;
		if ( inning === 6 && half === 'bottom' && ! suspended ) {

			suspended = true;
			firstNight = false;
			say( t0 + 0.5, 'pbp', `And the umpires are waving the grounds crew on. The field is under water. The tarp is coming out, and this game is suspended, tied at two.`, 3, 1 );
			say( t0 + 9.5, 'color', `The first suspended game in World Series history. Nobody's going anywhere, we'll pick it up right here, bottom of the sixth.`, 3, 3 );
			say( t0 + 17, 'pbp', `Well, two days later, it's Wednesday night, cold and windy but dry, and we're back at Citizens Bank Park for the bottom of the sixth.`, 3, 6 );
			continue;

		}

		say( t0 + 1.5, 'pbp', `${ half === 'top' ? 'Top' : 'Bottom' } of the ${ ORD[ inning ] || inning + 'th' }. ${ scoreLine( s.score ) }`, 3, 2 );
		// the colour man between innings: the weather on the first night, the game, the moment
		const k = inning * 2 + ( half === 'bottom' ? 1 : 0 );
		const talk = [];
		if ( firstNight && inning === 2 ) talk.push( `A raw night here, forty-seven degrees, the wind blowing in, and the rain has already started. Scott Kazmir and Cole Hamels, both of them battling it.` );
		if ( firstNight && inning >= 3 ) talk.push( pick( [ `This rain is really coming down now. The infield is getting sloppy.`, `You can see the puddles forming around home plate. Tough conditions for both pitchers.`, `The grounds crew has been out twice already with the drying agent. It's a mess out there.` ] ) );
		if ( inning >= 8 && G.plays.some( ( p ) => p.inning === inning ) ) talk.push( pick( [ `Forty-five thousand people on their feet in this ballpark. They can taste it.`, `Six outs away... well, you know what's at stake here.`, `Every pitch now, you can feel it.` ] ) );
		if ( inning === 9 && half === 'top' ) talk.push( `Brad Lidge, perfect in save chances this year, comes on for the ninth.` );
		if ( talk.length && ( k % 2 === 0 || inning >= 7 || inning === 2 ) ) say( t0 + 7, 'color', pick( talk ), 1, 8 );

	} else if ( seg.kind === 'walkup' ) {

		const b = s.batter, pl = P[ b ];
		if ( ! pl ) continue;
		const pos = POSN[ pl.pos ] || '';
		const tonight = today[ b ] || [];
		const hist = tonight.length ? ( tonight.filter( ( x ) => x ).length ? ` He's ${ tonight.filter( ( x ) => x ).length } for ${ tonight.length } tonight.` : ` Oh for ${ tonight.length } tonight.` ) : '';
		const outs = s.outs ? ' ' + outsWords( s.outs ) : '';
		say( t0 + 0.6, 'pbp', `Now batting, the ${ pos }, ${ pl.name }.${ hist }${ outs }`.replace( 'the , ', '' ), 3, 2 );

	} else if ( seg.kind === 'pitch' ) {

		const c = pitchCall( seg );
		say( t0 + 3.2, 'pbp', c.text, c.prio, 0.8 );

	} else if ( seg.kind === 'result' ) {

		const p = G.plays[ seg.pi ];
		const res = resultCall( seg );
		// the last out is called by the celebration
		if ( res.text && seg.pi < G.plays.length - 1 ) say( t0 + 0.2, 'pbp', res.text, 3, 3 );
		( today[ p.batter ] = today[ p.batter ] || [] );
		if ( ! /walk|hit_by_pitch|sac_bunt/.test( p.result.type ) ) today[ p.batter ].push( /single|double|triple|home_run/.test( p.result.type ) );
		if ( res.scored ) {

			const lines2 = res.lead === 'home' ? [ `And listen to this crowd. The Phillies have the lead!`, `That's the kind of hit you dream about in October.`, `Big, big hit.` ] : res.lead === 'tie' ? [ `And just like that, we're tied again.`, `The Rays will not go away.` ] : [ `The Rays answer.`, `That quiets the crowd.` ];
			say( t0 + 6, 'color', pick( lines2 ), 1, 5 );

		}

	} else if ( seg.kind === 'change' ) {

		const np = P[ s.pitcher ];
		if ( np ) say( t0 + 2, 'pbp', `There's a pitching change. ${ np.name } coming in from the bullpen.`, 3, 3 );

	} else if ( seg.kind === 'steal' ) {

		for ( const [ t, c ] of seg.cues || [] ) if ( c.say ) say( t0 + t, 'pbp', c.say, 2, 2 );

	} else if ( seg.kind === 'celebrate' ) {

		say( t0 + 0.2, 'pbp', `Swing and a miss! Struck him out! The Philadelphia Phillies are champions of baseball!`, 3, 0 );
		say( t0 + 9, 'color', `Lidge is down on his knees, and here comes Ruiz! Here comes Howard! They're all piling on at the mound!`, 3, 3 );
		say( t0 + 20, 'pbp', `For the first time in twenty-eight years, the World Series trophy is coming home to Philadelphia.`, 3, 4 );
		say( t0 + 34, 'color', `Brad Lidge, forty-eight for forty-eight. Unbelievable. What a season, what a night in this city.`, 2, 6 );

	}

}

lines.sort( ( a, b ) => a.t - b.t );
const out = new URL( './script.json', import.meta.url ).pathname;
writeFileSync( out, JSON.stringify( { duration: d.duration, lines }, null, 0 ) );
console.log( 'lines', lines.length, 'pbp', lines.filter( ( l ) => l.voice === 'pbp' ).length, 'color', lines.filter( ( l ) => l.voice === 'color' ).length, '->', out );
