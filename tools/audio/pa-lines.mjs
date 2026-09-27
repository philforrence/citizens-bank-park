// Dan Baker's lines for the replay: every PA key the soundscape's plan uses (places/sound/Plan.js), as
// phrases with a role each (the cadence build-pa.py draws on them), written to tools/audio/pa-lines.json.
//
//   node tools/audio/pa-lines.mjs
//
// The batters in Baker's own order, number, position, name ("Number 12, second baseman, Mickey
// Morandini": PhillyVoice, 2017), after "Now batting", or "Leading off for the Phillies" for the first man
// up ("Leading off for the Phillies, number 10, shortstop Larry Bowa!"); the Phillies' names drawn out,
// first and last ("Chaassseeee Utttleeeeeyyy"), the visitors' read "straight". The pinch hitters and runners
// and the pitching changes by analogy, and the night's announcements (the wording's evidence, or not, is
// in docs/notes/worlds/S.md).
import { writeFileSync } from 'node:fs';
import { Director } from '../../src/ballpark/game/Director.js';
import { GAME } from '../../src/ballpark/data/game-2008-ws5.js';
import { buildPlan, paKeys } from '../../src/ballpark/places/sound/Plan.js';

const P = GAME.players;
// the numbers they wore in 2008 where the game data (MLB's feed) has a later one: Madson 63 (46 from 2009),
// Hinske 32 with the Rays (Baseball-Reference's 2008 uniform numbers)
const NUM = { Madson: 63, Hinske: 32 };
const numOf = ( id ) => NUM[ P[ id ].last ] ?? P[ id ].num;
const d = new Director( { game: GAME, players: { add: () => ( {} ) }, ball: { set() {} } } );
const plan = buildPlan( d );

const WORD = [ 'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
	'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen' ];
const TENS = [ '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety' ];
const num = ( n ) => {

	n = Number( n );
	if ( n < 20 ) return WORD[ n ];
	return TENS[ Math.floor( n / 10 ) ] + ( n % 10 ? '-' + WORD[ n % 10 ] : '' );

};

const POS = { P: 'pitcher', C: 'catcher', '1B': 'first baseman', '2B': 'second baseman', '3B': 'third baseman', SS: 'shortstop', LF: 'left fielder', CF: 'center fielder', RF: 'right fielder' };
// where each played in Game 5 (the lineups; the pitchers who batted; the pinch hitters say so instead)
const posOf = {};
for ( const side of [ 'away', 'home' ] ) for ( const l of GAME.lineups[ side ] ) posOf[ l.id ] = l.pos;
for ( const id of Object.keys( P ) ) posOf[ id ] ||= P[ id ].pos;
// how names are said: Piper's phonemizer gets several wrong (Feliz as "FELL-iz", Pena as "PEE-nuh", Hinske
// without its last syllable...), so those are given as phonemes (IPA, Piper's [[ ]]; the en_US voices), checked
// by transcription (build-pa.py --asr)
const IPA = {
	Iwamura: 'ˌɑːkiːnˈɔːɹiː ˌiːwəmˈuːɹə', Feliz: 'pˈeɪdɹoʊ fəlˈiːz', Pena: 'kˈɑːɹloʊs pˈeɪnjə', Hinske: 'ˈɛɹɪk hˈɪnskiː',
	Zobrist: 'bˈɛn zˈoʊbɹɪst', Kazmir: 'skˈɑːt kæzmˈɪɹ', Baldelli: 'ɹˈɑːkoʊ bɑːldˈɛli', Burrell: 'pˈæt bɚɹˈɛl',
	Ruiz: 'kˈɑːɹloʊs ɹuːˈiːz', Navarro: 'diːˈoʊnɚ nəvˈɑːɹoʊ', Perez: 'fɚnˈændoʊ pəɹˈɛz', Howell: 'dʒˈeɪ pˈiː hˈaʊəl',
	Upton: 'bˈiː dʒˈeɪ ˈʌptən', Romero: 'dʒˈeɪ sˈiː ɹoʊmˈɛɹoʊ', Hamels: 'kˈoʊl hˈæməlz', Balfour: 'ɡɹˈænt bˈælfɔːɹ',
	Bruntlett: 'ˈɛɹɪk bɹˈʌntlɪt', Jenkins: 'dʒˈɛf dʒˈɛŋkɪnz', Howard: 'ɹˈaɪən hˈaʊwɚd', Madson: 'ɹˈaɪən mˈædsən',
};
// the name as the phrase's text; a Phillie's with a beat between his names (Baker's "Chaassseeee...
// Utttleeeeeyyy")
const say = ( id ) => {

	const beat = P[ id ].side === 'home';
	const ipa = IPA[ P[ id ].last ];
	if ( ipa ) return `[[ ${ beat ? ipa.replace( ' ', ', ' ) : ipa } ]]`;
	return beat ? P[ id ].name.replace( ' ', ', ' ) : P[ id ].name;

};

// how hard he sells a name: the Phillies' stars most, the Phillies all, the Rays not at all
const HYPE = { Utley: 3, Howard: 3, Rollins: 3, Burrell: 2.5, Victorino: 2.5, Hamels: 2.5, Lidge: 3, Werth: 2, Feliz: 2, Ruiz: 2, Jenkins: 2.2, Romero: 1.6, Madson: 2, Bruntlett: 1.4 };
const hype = ( id ) => P[ id ].side === 'home' ? ( HYPE[ P[ id ].last ] || 1.5 ) : 0;
const club = ( id ) => P[ id ].side === 'home' ? 'the Phillies' : 'the Tampa Bay Rays';

function line( key ) {

	let m;
	if ( ( m = key.match( /^bat-(\d+)-ph-(\d+)$/ ) ) ) {

		const [ , id, rep ] = m;
		return [
			{ t: `Now batting for ${ P[ rep ].name.replace( /\./g, '. ' ).trim() },`, role: 'lead', side: P[ id ].side },
			{ t: `number ${ num( numOf( id ) ) },`, role: 'num', side: P[ id ].side },
			{ t: say( id ), role: 'name', hype: hype( id ), side: P[ id ].side, check: P[ id ].last },
		];

	}

	if ( ( m = key.match( /^(bat|lead)-(\d+)$/ ) ) ) {

		const id = m[ 2 ];
		return [
			{ t: m[ 1 ] === 'lead' ? `Leading off for ${ club( id ) },` : 'Now batting,', role: 'lead', side: P[ id ].side },
			{ t: `number ${ num( numOf( id ) ) },`, role: 'num', side: P[ id ].side },
			{ t: `${ POS[ posOf[ id ] ] },`, role: 'mid', side: P[ id ].side },
			{ t: say( id ), role: 'name', hype: hype( id ), side: P[ id ].side, check: P[ id ].last },
		];

	}

	if ( ( m = key.match( /^run-(\d+)-(\d+)$/ ) ) ) {

		const [ , id, rep ] = m;
		return [
			{ t: `Now running for ${ P[ rep ].name.replace( /\./g, '. ' ).trim() },`, role: 'lead', side: P[ id ].side },
			{ t: `number ${ num( numOf( id ) ) },`, role: 'num', side: P[ id ].side },
			{ t: say( id ), role: 'name', hype: hype( id ) * 0.7, side: P[ id ].side, check: P[ id ].last },
		];

	}

	if ( ( m = key.match( /^pitch-(\d+)$/ ) ) ) {

		const id = m[ 1 ];
		return [
			{ t: `Now pitching for ${ club( id ) },`, role: 'lead', side: P[ id ].side },
			{ t: `number ${ num( numOf( id ) ) },`, role: 'num', side: P[ id ].side },
			{ t: say( id ), role: 'name', hype: hype( id ), side: P[ id ].side, check: P[ id ].last },
		];

	}

	return ANNOUNCE[ key ] || null;

}

// the night's announcements (see S.md for what's evidence and what's invented)
const ANNOUNCE = {
	'welcome-27': [
		{ t: 'Good evening, ladies and gentlemen,', role: 'lead' },
		{ t: 'and welcome to Citizens Bank Park,', role: 'mid' },
		{ t: 'and Game Five of the two thousand eight World Series!', role: 'big', hype: 2 },
	],
	'foul-balls': [
		{ t: 'Ladies and gentlemen,', role: 'lead' },
		{ t: 'please be alert for bats and balls leaving the playing field.', role: 'end' },
	],
	'rain-reminder': [
		{ t: 'Ladies and gentlemen,', role: 'lead' },
		{ t: 'please use caution on the stairs and in the aisles.', role: 'mid' },
		{ t: 'They are wet.', role: 'end' },
	],
	'no-throw': [
		{ t: 'Fans are reminded,', role: 'lead' },
		{ t: 'please do not throw anything onto the playing field.', role: 'end' },
	],
	'rain-delay': [
		{ t: 'Ladies and gentlemen,', role: 'lead' },
		{ t: 'we are in a rain delay.', role: 'end' },
		{ t: 'Please stand by for further announcements.', role: 'end' },
	],
	suspended: [
		{ t: 'Ladies and gentlemen,', role: 'lead' },
		{ t: "tonight's game has been suspended.", role: 'end' },
		{ t: 'Game Five will resume from this point,', role: 'mid' },
		{ t: 'with the Phillies coming to bat in the bottom of the sixth inning.', role: 'end' },
		{ t: 'Please drive home safely.', role: 'end' },
	],
	'welcome-29': [
		{ t: 'Ladies and gentlemen,', role: 'lead' },
		{ t: 'welcome back to Citizens Bank Park!', role: 'big', hype: 1.6 },
		{ t: 'Game Five of the World Series resumes,', role: 'mid' },
		{ t: 'the Phillies coming to bat in the bottom of the sixth,', role: 'mid' },
		{ t: 'the score tied, two to two!', role: 'big', hype: 2.2 },
	],
	attendance: [
		{ t: "Tonight's paid attendance,", role: 'lead' },
		{ t: 'forty-five thousand, nine hundred and forty.', role: 'end' },
		{ t: 'Thank you!', role: 'big', hype: 1.2 },
	],
	champions: [
		{ t: 'Ladies and gentlemen,', role: 'lead' },
		{ t: 'your two thousand eight World Champions,', role: 'mid' },
		{ t: 'the Philadelphia Phillies!', role: 'name', hype: 3, side: 'home' },
	],
};

const out = {};
const missing = [];
for ( const key of paKeys( plan ) ) {

	const l = line( key );
	if ( l ) out[ key ] = l;
	else missing.push( key );

}

writeFileSync( new URL( './pa-lines.json', import.meta.url ), JSON.stringify( out, null, '\t' ) );
console.log( Object.keys( out ).length, 'lines', missing.length ? 'missing: ' + missing.join( ' ' ) : '' );
for ( const [ k, l ] of Object.entries( out ) ) console.log( k.padEnd( 22 ), l.map( ( p ) => p.t ).join( ' | ' ) );
