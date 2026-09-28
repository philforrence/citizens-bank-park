// The soundscape's night: a timeline of what the park's PA says, what the music plays and what the crowd
// does, laid out once from the replay's segments (the Director's), like the radio's script and the
// Phanatic's plan. Pure: the same game gives the same night, and Node can build it (tools/audio/pa-lines.mjs
// reads the PA's keys from it to voice them).
//
//   const plan = buildPlan( director );
//   plan.events: [ { t, kind, ... } ] sorted by t:
//     pa        { key }                   Dan Baker at the mic (PA.js voices the key)
//     walkup    { id, until }              a Phillies batter's walk-up music (an original stand-in)
//     music     { tune, until, vol }       the organ between innings, during a pitching change
//     sting     { tune }                   a short organ cue between pitches
//     fans      { what, level }            the crowd: cheer, groan, ooh, boo, aww, rise, applause
//     chant     { what, from, cycles }     a chant starting in a section (from: its angle round the bowl)
//     hush      { dur }                    the breath the park holds before a big pitch
//     ump       { key }                    the plate umpire's call (heard only close to home plate)
//     crew      { what, from, to, dur }    the grounds crew and the tarp: 'roll' (the roll moving from to),
//                                          'edges' (walking the edges), 'work' (the 29th's rakes, hoses, drag,
//                                          tamper); crewcall { key } a shout from them
//     gba       { dur }                    God Bless America (the 29th): the park silent under the organ
//     night2, celebrate                    the 29th beginning, the last out
//   plan.tarp: [ t0, t1 ] the tarp down on the infield (the rain drums on it)
//   plan.nights: the replay time the 29th begins (the resumption)

import { REL } from '../../game/Motions.js';

const WALKUP = 6, CHANGE = 18, SWITCH = 24, SET = 3.0, SPLIT = 0.55;

// the stars get the loudest hellos (and the Rays' the loudest boos)
const STAR = { home: [ 'Utley', 'Howard', 'Rollins', 'Hamels', 'Burrell', 'Victorino', 'Lidge' ], away: [ 'Upton', 'Crawford', 'Pena', 'Longoria' ] };

export function buildPlan( director ) {

	const d = director, g = d.game, P = g.players, S = d.segments;
	const ev = [];
	const add = ( t, kind, data = {} ) => ev.push( { t: Math.round( t * 100 ) / 100, kind, ...data } );
	let seed = 5;
	const rnd = () => ( seed = ( seed * 16807 ) % 2147483647 ) / 2147483647;
	const pick = ( a ) => a[ Math.floor( rnd() * a.length ) ];
	// the suspension: the break after the top of the 6th (the tarp comes on; the 29th begins in it, 55% of
	// the way through: R's split, director.night())
	const susp = S.find( ( s ) => s.kind === 'switch' && s.snap.inning === 6 && s.snap.half === 'bottom' );
	const night2 = susp ? susp.t0 + susp.dur * SPLIT : Infinity;
	const plays = g.plays;
	let tarp = null;
	const subsOf = ( pi ) => ( plays[ pi ]?.events || [] ).filter( ( e ) => e.t === 'action' && /offensive_substitution/.test( e.kind || '' ) );
	// the organ's between-innings tunes, rotated (Music.js has them), the rain's on the 27th
	// the first man up for each side is "Leading off for the Phillies..." (Baker's own formula)
	const led = new Set();
	// (the organ's are Tunes.js, the recorded rock Band.js)
	const tunes = { dry: [ 'saints', 'rock', 'entertainer', 'funk', 'susanna', 'yankee', 'camptown', 'rock', 'cucaracha', 'funk' ], wet: [ 'rainrain', 'funk', 'saints', 'rock' ] };
	let tuneI = 0, wetI = 0;

	for ( let i = 0; i < S.length; i ++ ) {

		const s = S[ i ], n = S[ i + 1 ], sn = s.snap || {};
		const t0 = s.t0;
		const onFirst = t0 < night2;

		if ( s.kind === 'intro' ) {

			add( t0 + 0.8, 'pa', { key: 'welcome-27' } );
			add( t0 + s.dur + 7, 'ump', { key: 'ump-playball' } );
			add( t0 + 0.5, 'fans', { what: 'cheer', level: 2 } );

		}

		if ( s.kind === 'walkup' ) {

			const p = plays[ s.pi ], id = sn.batter, who = P[ id ], home = sn.batting === 'home';
			const subs = subsOf( s.pi );
			const ph = subs.find( ( e ) => e.player === id && /Pinch-hitter/.test( e.desc ) );
			const prs = subs.filter( ( e ) => /Pinch-runner/.test( e.desc ) );
			// a pinch runner goes in straight after the play before (the break before this batter)
			for ( const pr of prs ) add( t0 - 2.2, 'pa', { key: `run-${ pr.player }-${ pr.replaced }` } );
			// a pitching change before he bats: he's announced after it
			const at = n && n.kind === 'change' ? n.t0 + n.dur - 5.2 : t0 + ( prs.length ? 2.2 : 0.8 );
			const lead = ! led.has( sn.batting ) && ! ph;
			led.add( sn.batting );
			add( at, 'pa', { key: ph ? `bat-${ id }-ph-${ ph.replaced }` : lead ? `lead-${ id }` : `bat-${ id }` } );
			// the Phillies' batters walk up to their music (ducked under Baker's call); the Rays' to boos
			// (the music comes up as he leaves the on-deck circle, a couple of seconds before Baker names him)
			if ( home ) add( at - 1.8, 'walkup', { id, until: ( n && n.kind === 'change' ? n.t0 + n.dur : t0 + WALKUP ) + 2.5 } );
			const star = STAR[ home ? 'home' : 'away' ].includes( who?.last );
			if ( home ) add( at + 3.2, 'fans', { what: 'cheer', level: star ? 1.6 : 1 } );
			// the Rays: heard out, mostly; Longoria heckled ("Eva", the Inquirer's blog), Upton booed
			else if ( who?.last === 'Longoria' || who?.last === 'Upton' ) add( at + 3.0, 'fans', { what: 'boo', level: who.last === 'Longoria' ? 0.8 : 0.5 } );
			void star;
			void p;

		}

		if ( s.kind === 'change' ) {

			const id = sn.pitcher, home = P[ id ]?.side === 'home';
			add( t0 + 7, 'pa', { key: `pitch-${ id }` } );
			add( t0 + 0.3, 'ump', { key: 'ump-time' } );
			// the Phillies' relievers come in to their music (Lidge's the loudest), the Rays' to the organ
			add( t0 + 0.8, home ? 'walkup' : 'music', home ? { id, until: t0 + CHANGE - 0.5 } : { tune: pick( [ 'bullpen', 'rock', 'camptown' ] ), until: t0 + CHANGE - 1, vol: 0.8 } );
			if ( home ) add( t0 + 9.5, 'fans', { what: 'cheer', level: P[ id ]?.last === 'Lidge' ? 2.2 : 1.2 } );
			// the Rays' manager's slow walk out gets the old organ send-off... and the one they're taking out
			// gets a sarcastic hand
			if ( ! home ) add( t0 + 2.5, 'fans', { what: 'applause', level: 0.6 } );

		}

		if ( s.kind === 'switch' ) {

			if ( s === susp ) {

				// the 27th: the tarp out, the rain delay, then play suspended ("a collective groan", the
				// Inquirer, Oct 28); the 29th: the park filling, the welcome back just before the first pitch.
				// Scaled to however long the break is (R makes it 140 s: the 27th's 77, the 29th's 63)
				const L27 = night2 - t0, L29 = s.dur - L27;
				// R's rituals' times for the tarp (ASK-R.md: 77 s of the 27th, 63 of the 29th), squeezed if the
				// break is shorter
				const a = ( x ) => t0 + x * Math.min( 1, L27 / 77 ), b = ( x ) => night2 + x * Math.min( 1, L29 / 63 );
				// the 27th: the roll swung out off the wall on the third base side, pushed across the
				// infield, the bare core rolled off; the edges walked square in the wind
				const roll = ( t, from, to, t1, v ) => add( t, 'crew', { what: 'roll', from, to, dur: t1 - t, v } );
				roll( a( 7 ), [ - 32, - 8 ], [ - 24, - 26 ], a( 20 ), 0.8 );
				roll( a( 20 ), [ - 24, - 26 ], [ 24, - 26 ], a( 44 ), 1 );
				roll( a( 46 ), [ 24, - 26 ], [ 32, - 31 ], a( 53 ), 0.45 );
				add( a( 44 ), 'crew', { what: 'edges', dur: a( 58 ) - a( 44 ) } );
				for ( const [ x, key ] of [ [ 7.5, 'crew-go' ], [ 12, 'crew-pull' ], [ 24, 'crew-walk' ], [ 33, 'crew-corner' ], [ 41, 'crew-hold' ] ] ) add( a( x ), 'crewcall', { key } );
				if ( L27 > 40 ) add( t0 + 9, 'pa', { key: 'rain-delay' } );
				const said = t0 + Math.max( 3.5, L27 * 0.55 );
				add( said, 'pa', { key: 'suspended' } );
				add( said + 2.5, 'fans', { what: 'groan', level: 1.4 } );
				add( said + 3.5, 'fans', { what: 'boo', level: 0.5 } );
				add( night2, 'night2' );
				// the 29th: the core back, the tarp wound up from the first base side and swung back to the
				// wall, then the crew's work on the clay
				roll( b( 1.5 ), [ 32, - 31 ], [ 24, - 26 ], b( 6 ), 0.45 );
				roll( b( 6 ), [ 24, - 26 ], [ - 24, - 26 ], b( 27 ), 1 );
				roll( b( 27 ), [ - 24, - 26 ], [ - 32, - 8 ], b( 35 ), 0.8 );
				add( b( 35 ), 'crew', { what: 'work', dur: b( 55 ) - b( 35 ) } );
				for ( const [ x, key ] of [ [ 7, 'crew-pull' ], [ 19, 'crew-walk' ], [ 30, 'crew-go' ] ] ) add( b( x ), 'crewcall', { key } );
				tarp = [ a( 44 ), b( 6 ) ];
				// the welcome back, and (with the long break) God Bless America before the first pitch: Navy
				// Petty Officer Dorcus Whigham (the Inquirer), the park on its feet and silent, then the roar
				if ( L29 > 40 ) {

					add( b( 18 ), 'pa', { key: 'welcome-29' } );
					add( b( 27.5 ), 'fans', { what: 'cheer', level: 2.2 } );
					add( b( 37 ), 'pa', { key: 'gba' } );
					add( b( 40 ), 'gba', { dur: b( 58 ) - b( 40 ) } );
					add( b( 58.2 ), 'fans', { what: 'cheer', level: 2.8 } );
					add( b( 60 ), 'chant', { what: 'letsgo', from: pick( [ - 60, 40, 120 ] ), cycles: 3 } );

				} else {

					const back = night2 + Math.max( 1.5, L29 - 22 );
					add( back, 'pa', { key: 'welcome-29' } );
					add( back + 9.5, 'fans', { what: 'cheer', level: 2.5 } );
					add( back + 12, 'chant', { what: 'letsgo', from: pick( [ - 60, 40, 120 ] ), cycles: 3 } );

				}

				add( t0 + s.dur + 7, 'ump', { key: 'ump-playball' } );
				continue;

			}

			const wet = onFirst && sn.inning >= 3;
			const tune = wet ? tunes.wet[ wetI ++ % tunes.wet.length ] : tunes.dry[ tuneI ++ % tunes.dry.length ];
			// the seventh-inning stretch is the Phanatic's organ (A's cue) and everyone's singing
			const stretch = sn.inning === 7 && sn.half === 'bottom';
			if ( ! stretch ) add( t0 + 2.0, 'music', { tune, until: t0 + SWITCH - 3.5, vol: 0.9 } );
			// the home half: the Phillies come in to bat; the top: they take the field, and the park stands
			if ( sn.half === 'top' ) add( t0 + 1.2, 'fans', { what: 'cheer', level: sn.inning >= 8 ? 1.8 : 1 } );
			// the PA's between-innings business
			const biz = { '3bottom': 'rain-reminder', '8top': 'attendance', '2bottom': 'foul-balls', '4top': 'no-throw' }[ sn.inning + sn.half ];
			if ( biz ) add( t0 + 12, 'pa', { key: biz } );

		}

		if ( s.kind === 'pitch' ) {

			const e = s.ev, home = sn.batting === 'home', [ b, k ] = e.count;
			const tRel = t0 + SET + REL, tMitt = tRel + ( s.path?.toCatcher ?? 0.45 );
			const late = sn.inning >= 9, outs2 = sn.outs >= 2;
			// the two-strike count with a Phillies pitcher: up on their feet, a roar building (Fans.js does the
			// build from the count); here the moments on top of it
			if ( ! e.inPlay ) {

				const strike = /^(C|S|W|M|T|L)$/.test( e.call ) || ( e.call === 'F' && sn.strikes < 2 );
				if ( ! home ) {

					if ( strike && k === 2 && sn.strikes < 2 ) add( tMitt + 0.1, 'fans', { what: 'rise', level: outs2 ? 1.5 : 1 } );
					else if ( ! strike && e.call !== 'F' && sn.strikes === 2 ) add( tMitt + 0.2, 'fans', { what: 'aww', level: 0.6 } );
					else if ( e.call === 'F' && sn.strikes === 2 ) add( tMitt + 0.1, 'fans', { what: 'ooh', level: 0.7 } );
					if ( b === 4 || /B/.test( e.call ) && sn.balls === 3 ) add( tMitt + 0.3, 'fans', { what: 'groan', level: 0.6 } );

				} else {

					if ( /B/.test( e.call ) && sn.balls === 3 ) add( tMitt + 0.3, 'fans', { what: 'cheer', level: 1 } );
					else if ( /B/.test( e.call ) && sn.balls >= 1 ) add( tMitt + 0.3, 'fans', { what: 'applause', level: 0.35 } );
					// called out on strikes: at the umpire
					if ( e.call === 'C' && sn.strikes === 2 ) add( tMitt + 0.3, 'fans', { what: 'boo', level: 0.8 } );

				}

			}

			// the plate umpire: the called strikes barked ("Stee-rike!"), the third one sold; a foul ball now and then
			if ( e.call === 'C' ) add( tMitt + 0.22, 'ump', { key: k >= 3 ? 'ump-three' : rnd() < 0.5 ? 'ump-strike-1' : 'ump-strike-2' } );
			else if ( s.foul && rnd() < 0.35 ) add( tRel + ( s.path?.flight ?? 0.42 ) + 0.6, 'ump', { key: 'ump-foul' } );
			// a foul into the stands: ooh as it goes up
			if ( s.foul && s.foulPath ) add( tRel + ( s.path?.flight ?? 0.42 ) + 0.35, 'fans', { what: 'ooh', level: 0.5 } );
			// the hush before a big pitch: two strikes, two outs, the 9th
			if ( ! home && late && sn.strikes === 2 && outs2 ) add( tRel - 1.6, 'hush', { dur: 1.5 } );
			else if ( ! home && late && sn.strikes === 2 ) add( tRel - 1.2, 'hush', { dur: 1.0 } );
			// between pitches: the organ's stings, now and then, when it matters
			const next = n && n.kind === 'pitch';
			if ( next && ! e.inPlay ) {

				const on = ( sn.bases || [] ).filter( Boolean ).length;
				if ( home && on >= 2 && rnd() < 0.5 ) add( s.t0 + s.dur - 2.2, 'sting', { tune: 'charge' } );
				else if ( ! home && k === 2 && rnd() < 0.45 ) add( s.t0 + s.dur - 2.4, 'sting', { tune: pick( [ 'clap', 'climb' ] ) } );
				else if ( rnd() < 0.08 ) add( s.t0 + s.dur - 2.2, 'sting', { tune: pick( [ 'letsgo', 'clap' ] ) } );

			}

		}

		if ( s.kind === 'inplay' ) {

			const p = plays[ s.pi ], home = sn.batting === 'home';
			const air = /fly|line|popup/.test( p.hit?.traj || '' ) || /home_run/.test( p.result.type );
			// a fly ball off a Phillies bat: the rising "ohhh" while it's up; a Rays home run: the park goes
			// quiet but for the Rays' dugout
			if ( home && air ) add( t0 + 0.4, 'fans', { what: 'rise', level: p.hit?.hard === 'hard' ? 1.4 : 0.8 } );
			if ( ! home && /home_run/.test( p.result.type ) ) add( t0 + 1.2, 'hush', { dur: 5 } ), add( t0 + 1.6, 'fans', { what: 'rays', level: 1 } );

		}

		if ( s.kind === 'result' ) {

			const p = plays[ s.pi ], home = sn.batting === 'home', type = p.result.type;
			// a Rays run: the few Rays fans there were, cheering in their corner
			if ( ! home && s.before?.score && s.snap.score.away > s.before.score.away && ! /home_run/.test( type ) ) add( t0 + 0.6, 'fans', { what: 'rays', level: 0.8 } );
			// a Feliz hit: the booth's Christmas joke
			if ( home && P[ sn.batter ]?.last === 'Feliz' && /single|double|triple|home_run/.test( type ) ) add( t0 + 1.2, 'sting', { tune: 'jingle' } );
			// walks and hit batsmen aren't in play (the app's cue only cheers runs and strikeouts)
			if ( /walk|hit_by_pitch/.test( type ) ) add( t0 + 0.3, 'fans', home ? { what: 'cheer', level: 1.2 } : { what: 'groan', level: 0.8 } );
			// an inning over with a Phillies pitcher: the hand as they come off
			if ( ! home && s.snap.outs >= 3 && i < S.length - 2 ) add( t0 + 1.0, 'fans', { what: 'applause', level: 1 } );
			// the chant: the Phillies batting with men on, or the 9th
			const on = ( s.snap.bases || [] ).filter( Boolean ).length;
			if ( home && on >= 2 && s.snap.outs < 3 && rnd() < 0.6 ) add( t0 + 1.8, 'chant', { what: 'letsgo', from: pick( [ - 70, - 20, 30, 80, 140 ] ), cycles: 2 } );

		}

		if ( s.kind === 'celebrate' ) {

			// the pile: nothing but the roar for the first half minute; then the organ's fanfare, Baker, and
			// (R's ~300 s) the park singing through the rest of it
			add( t0 + 0.3, 'celebrate' );
			add( t0 + Math.min( 30, s.dur * 0.35 ), 'music', { tune: 'champions', until: t0 + Math.min( 30, s.dur * 0.35 ) + 16, vol: 1 } );
			add( t0 + Math.min( 50, s.dur * 0.6 ), 'pa', { key: 'champions' } );
			// (they played "We Are the Champions" and 45,000 sang it: the booth's own anthem here, and the organ's
			// "Saints" after it)
			if ( s.dur > 120 ) add( t0 + 70, 'music', { tune: 'anthem', until: t0 + 130, vol: 0.9 } );
			if ( s.dur > 180 ) add( t0 + 140, 'music', { tune: 'saints', until: t0 + 170, vol: 0.9 } );

		}

	}

	// the 9th, the Phillies three outs away: the whole park chanting
	const ninth = S.find( ( s ) => s.kind === 'switch' && s.snap.inning === 9 && s.snap.half === 'top' );
	if ( ninth ) add( ninth.t0 + 14, 'chant', { what: 'letsgo', from: 0, cycles: 4 } );
	// in the rain on the 27th, they kept it going
	const fifth = S.find( ( s ) => s.kind === 'switch' && s.snap.inning === 5 && s.snap.half === 'top' );
	if ( fifth ) add( fifth.t0 + 18, 'chant', { what: 'letsgo', from: 100, cycles: 3 } );

	ev.sort( ( a, b ) => a.t - b.t );
	return { events: ev, night2, susp, tarp };

}

// the PA keys the plan uses (for the voicing tool)
export function paKeys( plan ) {

	return [ ...new Set( plan.events.filter( ( e ) => e.kind === 'pa' ).map( ( e ) => e.key ) ) ];

}
