// Builds a game script for the replay from MLB's live game feed (statsapi.mlb.com, GUMBO):
//   node tools/build-game.mjs <gamePk> <out.js> [cached-feed.json]
// e.g. node tools/build-game.mjs 243847 src/ballpark/data/game-2008-ws5.js
//
// The script keeps, for every plate appearance: the batter and pitcher, the fielders at each position,
// the runners on base, and every event in order (pitches with their PITCHf/x / Statcast trajectory,
// substitutions, steals, passed balls...), the batted ball (trajectory, hardness, fielder, spray chart
// coordinates), and each runner's movement with the fielders credited.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const [ , , pk = '243847', out = 'src/ballpark/data/game.js', cache ] = process.argv;
const feed = cache && existsSync( cache ) ? JSON.parse( readFileSync( cache, 'utf8' ) )
	: await ( await fetch( `https://statsapi.mlb.com/api/v1.1/game/${ pk }/feed/live` ) ).json();

const gd = feed.gameData, ld = feed.liveData;
const POS = { 1: 'P', 2: 'C', 3: '1B', 4: '2B', 5: '3B', 6: 'SS', 7: 'LF', 8: 'CF', 9: 'RF', 10: 'DH' };
const BASE = { '1B': 1, '2B': 2, '3B': 3, score: 4 };
const r3 = ( x ) => x == null ? null : Math.round( x * 1000 ) / 1000;

// ---- players
// the feed gives a few players a later season's number: what they wore that year (Baseball-Reference's
// uniform numbers, Baseball Almanac)
const NUMBER = { 243847: { 471107: '43' } }[ pk ] || {}; // Elliot Johnson wore 43 for the 2008 Rays (9 later)
const players = {};
for ( const side of [ 'away', 'home' ] ) {

	const t = ld.boxscore.teams[ side ];
	for ( const k in t.players ) {

		const b = t.players[ k ], p = gd.players[ k ] || {};
		players[ b.person.id ] = {
			name: b.person.fullName, last: p.lastName || b.person.fullName.split( ' ' ).pop(),
			num: NUMBER[ b.person.id ] || b.jerseyNumber || p.primaryNumber || '', side,
			bats: p.batSide?.code || 'R', throws: p.pitchHand?.code || 'R', pos: p.primaryPosition?.abbreviation || '',
		};

	}

}

// ---- lineups and the starting defense
const lineups = {}, defense = {};
for ( const side of [ 'away', 'home' ] ) {

	const t = ld.boxscore.teams[ side ];
	const starters = Object.values( t.players ).filter( ( p ) => p.battingOrder && Number( p.battingOrder ) % 100 === 0 ).sort( ( a, b ) => a.battingOrder - b.battingOrder );
	lineups[ side ] = starters.map( ( p ) => ( { id: p.person.id, pos: p.allPositions?.[ 0 ]?.abbreviation || p.position.abbreviation } ) );
	defense[ side ] = {};
	for ( const s of starters ) defense[ side ][ s.allPositions?.[ 0 ]?.abbreviation || s.position.abbreviation ] = s.person.id;
	defense[ side ].P = t.pitchers[ 0 ];

}

const snapshot = ( d ) => ( { ...d } );

// ---- plays
const bases = [ null, null, null ]; // runner ids on 1B, 2B, 3B
const plays = [];
let halfKey = null;
// the bases as each event of the play happens: pinch runners take their man's base, runners move
const applyEvent = ( p, k, e ) => {

	if ( e && e.isSubstitution && e.details.eventType === 'offensive_substitution' && e.replacedPlayer ) {

		for ( let b = 0; b < 3; b ++ ) if ( bases[ b ] === e.replacedPlayer.id ) bases[ b ] = e.player.id;

	}

	for ( const r of p.runners ) {

		if ( r.details.playIndex !== k ) continue;
		const m = r.movement, id = r.details.runner.id;
		for ( let b = 0; b < 3; b ++ ) if ( bases[ b ] === id ) bases[ b ] = null;
		if ( ! m.isOut && m.end && BASE[ m.end ] <= 3 ) bases[ BASE[ m.end ] - 1 ] = id;

	}

};

for ( const p of ld.plays.allPlays ) {

	const half = p.about.halfInning; // 'top' | 'bottom'
	// a new half-inning: nobody on
	if ( halfKey !== p.about.inning + half ) {

		bases.fill( null );
		halfKey = p.about.inning + half;

	}

	const def = half === 'top' ? 'home' : 'away';
	const play = {
		i: p.atBatIndex, inning: p.about.inning, half,
		batter: p.matchup.batter.id, bats: p.matchup.batSide.code, pitcher: p.matchup.pitcher.id, throws: p.matchup.pitchHand.code,
		defense: snapshot( defense[ def ] ), bases: bases.slice(),
		events: [],
		result: { event: p.result.event, type: p.result.eventType, desc: p.result.description, rbi: p.result.rbi, away: p.result.awayScore, home: p.result.homeScore, out: !! p.result.isOut },
		hit: null, runners: [],
	};

	for ( const [ k, e ] of p.playEvents.entries() ) {

		if ( e.isPitch ) {

			const pd = e.pitchData || {}, c = pd.coordinates || {};
			play.events.push( {
				t: 'pitch', k, call: e.details.call?.code || e.details.code, desc: e.details.description, type: e.details.type?.code || '', typeName: e.details.type?.description || '',
				speed: pd.startSpeed ?? null, count: [ e.count.balls, e.count.strikes, e.count.outs ],
				pfx: c.x0 != null ? [ c.x0, c.y0, c.z0, c.vX0, c.vY0, c.vZ0, c.aX, c.aY, c.aZ ].map( r3 ) : null,
				px: r3( c.pX ), pz: r3( c.pZ ), sz: [ r3( pd.strikeZoneTop ), r3( pd.strikeZoneBottom ) ],
				inPlay: !! e.details.isInPlay,
			} );
			if ( e.hitData ) {

				const h = e.hitData;
				play.hit = { traj: h.trajectory, hard: h.hardness, loc: h.location, x: h.coordinates?.coordX ?? null, y: h.coordinates?.coordY ?? null, speed: h.launchSpeed ?? null, angle: h.launchAngle ?? null, dist: h.totalDistance ?? null };

			}

		} else {

			const d = e.details;
			const ev = { t: 'action', k, kind: d.eventType, desc: d.description, sub: !! e.isSubstitution };
			if ( e.isSubstitution ) {

				ev.player = e.player?.id;
				ev.replaced = e.replacedPlayer?.id ?? null;
				ev.pos = e.position?.abbreviation ?? null;
				ev.bo = e.battingOrder ? Math.floor( Number( e.battingOrder ) / 100 ) : null;
				// keep the fielders up to date (pitching changes, defensive substitutions and switches)
				const team = players[ ev.player ]?.side;
				const fielding = team === def;
				if ( d.eventType === 'pitching_substitution' ) {

					defense[ team ].P = ev.player;

				} else if ( d.eventType === 'defensive_substitution' || d.eventType === 'defensive_switch' ) {

					for ( const pos in defense[ team ] ) if ( defense[ team ][ pos ] === ev.player ) delete defense[ team ][ pos ];
					if ( ev.pos && POS[ e.position.code ] ) defense[ team ][ ev.pos ] = ev.player;

				}

				if ( fielding ) ev.defense = snapshot( defense[ team ] );

			}

			play.events.push( ev );

		}

	}

	// runners: which event moved them, where from and to, and who fielded
	for ( const r of p.runners ) {

		const m = r.movement, d = r.details;
		play.runners.push( {
			id: d.runner.id, k: d.playIndex, event: d.eventType,
			from: m.originBase ? BASE[ m.originBase ] : 0, start: m.start ? BASE[ m.start ] : 0,
			to: m.end ? BASE[ m.end ] : ( m.isOut ? null : 0 ), out: !! m.isOut, outBase: m.outBase ? BASE[ m.outBase ] ?? 0 : null, outNumber: m.outNumber ?? null,
			scores: !! d.isScoringEvent,
			credits: ( r.credits || [] ).map( ( c ) => [ c.position.abbreviation, c.credit, c.player.id ] ),
		} );

	}

	// the bases after the play, event by event
	for ( const [ k, e ] of p.playEvents.entries() ) applyEvent( p, k, e );

	plays.push( play );

}

const teams = {};
for ( const side of [ 'away', 'home' ] ) {

	const t = gd.teams[ side ];
	teams[ side ] = { name: t.name, club: t.clubName || t.teamName, abbr: t.abbreviation, id: t.id };

}

const game = {
	pk: Number( pk ), title: `${ gd.game.season } World Series, Game 5`,
	date: gd.datetime.originalDate, resumed: gd.datetime.resumeDate || null,
	venue: gd.venue.name, weather: gd.weather || null,
	teams, players, lineups,
	linescore: ld.linescore.innings.map( ( i ) => [ i.away.runs ?? null, i.home.runs ?? null ] ),
	final: { away: ld.linescore.teams.away, home: ld.linescore.teams.home },
	plays,
};

const js = `// Generated by tools/build-game.mjs from MLB's game feed (statsapi.mlb.com), game ${ pk }.
// Facts of the game (plays, pitches, players' names); the data belongs to MLB Advanced Media.
export const GAME = ${ JSON.stringify( game ) };
`;
writeFileSync( out, js );
console.log( `${ plays.length } plays, ${ plays.reduce( ( a, p ) => a + p.events.filter( ( e ) => e.t === 'pitch' ).length, 0 ) } pitches -> ${ out } (${ ( js.length / 1024 ).toFixed( 0 ) } KB)` );
