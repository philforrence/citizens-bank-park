// What the organ plays. Only public-domain melodies (traditional, or published before 1930) and the
// organist's own riffs: no copyrighted song, no recording. Each: bpm, meter, melody and chords (Organ.js
// score()), a registration, and whether the Leslie spins fast.
//
// Between innings, the old ballpark standbys: "When the Saints Go Marching In" (traditional), "The
// Entertainer" (Scott Joplin, 1902), "Oh! Susanna" (Stephen Foster, 1848), "Camptown Races" (Foster,
// 1850), "La Cucaracha" (traditional), "Yankee Doodle" (traditional), and on the 27th, in the rain, the
// children's "Rain, Rain, Go Away" (traditional). Between pitches, the stings: the "Charge!" bugle call
// (traditional), the organist's "Let's go Phil-lies" and clap-along riffs, the chromatic climb on two
// strikes. For a pitching change, a swing blues of his own; at the end, a fanfare of his own.

const C = [ 'E3', 'G3', 'C4' ], F = [ 'F3', 'A3', 'C4' ], G7 = [ 'F3', 'G3', 'B3' ], C7 = [ 'E3', 'Bb3', 'C4' ], D7 = [ 'F#3', 'A3', 'C4' ];
const Bb = [ 'F3', 'Bb3', 'D4' ], F7 = [ 'Eb3', 'A3', 'C4' ], Bb7 = [ 'D3', 'Ab3', 'Bb3' ], C9 = [ 'E3', 'Bb3', 'D4' ];

export const TUNES = {

	// "When the Saints Go Marching In"
	saints: {
		bpm: 168, meter: 4, oct: 1, reg: 'full', fast: false,
		melody: [
			[ '-', 1 ], [ 'C4', 1 ], [ 'E4', 1 ], [ 'F4', 1 ], [ 'G4', 4 ],
			[ '-', 1 ], [ 'C4', 1 ], [ 'E4', 1 ], [ 'F4', 1 ], [ 'G4', 4 ],
			[ '-', 1 ], [ 'C4', 1 ], [ 'E4', 1 ], [ 'F4', 1 ], [ 'G4', 2 ], [ 'E4', 2 ], [ 'C4', 2 ], [ 'E4', 2 ], [ 'D4', 4 ],
			[ '-', 1 ], [ 'E4', 1 ], [ 'E4', 1 ], [ 'D4', 1 ], [ 'C4', 3 ], [ 'C4', 1 ], [ 'E4', 2 ], [ 'G4', 2 ], [ 'G4', 1 ], [ 'F4', 3 ],
			[ '-', 2 ], [ 'E4', 1 ], [ 'F4', 1 ], [ 'G4', 2 ], [ 'E4', 2 ], [ 'C4', 2 ], [ 'D4', 2 ], [ 'C4', 4 ],
		],
		chords: [ [ 'C3', C, 4 ], [ 'C3', C, 4 ], [ 'C3', C, 4 ], [ 'C3', C, 4 ], [ 'C3', C, 4 ], [ 'C3', C, 4 ], [ 'C3', C, 4 ], [ 'G2', G7, 4 ],
			[ 'G2', G7, 4 ], [ 'C3', C, 4 ], [ 'C3', C7, 4 ], [ 'F2', F, 4 ], [ 'F2', F, 4 ], [ 'C3', C, 4 ], [ 'G2', G7, 4 ], [ 'C3', C, 4 ] ],
	},

	// "The Entertainer": its famous strain
	entertainer: {
		bpm: 92, meter: 2, oct: 1, reg: 'tune', fast: false,
		melody: [
			[ 'D4', 0.5 ], [ 'D#4', 0.5 ], [ 'E4', 0.5 ], [ 'C5', 1 ], [ 'E4', 0.5 ], [ 'C5', 1 ], [ 'E4', 0.5 ], [ 'C5', 2.5 ],
			[ 'C5', 0.5 ], [ 'D5', 0.5 ], [ 'D#5', 0.5 ], [ 'E5', 0.5 ], [ 'C5', 0.5 ], [ 'D5', 0.5 ], [ 'E5', 1 ], [ 'B4', 0.5 ], [ 'D5', 1 ], [ 'C5', 2.5 ],
			[ 'D4', 0.5 ], [ 'D#4', 0.5 ], [ 'E4', 0.5 ], [ 'C5', 1 ], [ 'E4', 0.5 ], [ 'C5', 1 ], [ 'E4', 0.5 ], [ 'C5', 2.5 ],
			[ 'A4', 0.5 ], [ 'G4', 0.5 ], [ 'F#4', 0.5 ], [ 'A4', 0.5 ], [ 'C5', 0.5 ], [ 'E5', 1 ], [ 'D5', 0.5 ], [ 'C5', 0.5 ], [ 'A4', 0.5 ], [ 'D5', 2.5 ],
		],
		chords: [ [ 'C3', C, 2 ], [ 'C3', C, 2 ], [ 'C3', C, 2 ], [ 'C3', C, 1 ], [ 'G2', G7, 2 ], [ 'G2', G7, 2 ], [ 'C3', C, 2 ], [ 'C3', C, 1 ],
			[ 'C3', C, 2 ], [ 'C3', C, 2 ], [ 'C3', C, 2 ], [ 'C3', C, 1 ], [ 'D3', D7, 2 ], [ 'D3', D7, 2 ], [ 'G2', G7, 2 ], [ 'G2', G7, 1 ] ],
	},

	// "Oh! Susanna"
	susanna: {
		bpm: 150, meter: 4, oct: 1, reg: 'tune', fast: false,
		melody: [
			[ 'C4', 0.5 ], [ 'D4', 0.5 ],
			[ 'E4', 1 ], [ 'G4', 1 ], [ 'G4', 1.5 ], [ 'A4', 0.5 ], [ 'G4', 1 ], [ 'E4', 1 ], [ 'C4', 1.5 ], [ 'D4', 0.5 ],
			[ 'E4', 1 ], [ 'E4', 1 ], [ 'D4', 1 ], [ 'C4', 1 ], [ 'D4', 3 ], [ 'C4', 0.5 ], [ 'D4', 0.5 ],
			[ 'E4', 1 ], [ 'G4', 1 ], [ 'G4', 1.5 ], [ 'A4', 0.5 ], [ 'G4', 1 ], [ 'E4', 1 ], [ 'C4', 1.5 ], [ 'D4', 0.5 ],
			[ 'E4', 1 ], [ 'E4', 1 ], [ 'D4', 1 ], [ 'D4', 1 ], [ 'C4', 4 ],
			[ 'F4', 2 ], [ 'F4', 2 ], [ 'A4', 1 ], [ 'A4', 2 ], [ 'A4', 1 ], [ 'G4', 1 ], [ 'G4', 1 ], [ 'E4', 1 ], [ 'C4', 1 ], [ 'D4', 3 ], [ 'C4', 0.5 ], [ 'D4', 0.5 ],
			[ 'E4', 1 ], [ 'G4', 1 ], [ 'G4', 1.5 ], [ 'A4', 0.5 ], [ 'G4', 1 ], [ 'E4', 1 ], [ 'C4', 1.5 ], [ 'D4', 0.5 ],
			[ 'E4', 1 ], [ 'E4', 1 ], [ 'D4', 1 ], [ 'D4', 1 ], [ 'C4', 4 ],
		],
		chords: [ [ 'C3', C, 1 ], [ 'C3', C, 4 ], [ 'C3', C, 4 ], [ 'C3', C, 4 ], [ 'G2', G7, 4 ], [ 'C3', C, 4 ], [ 'C3', C, 4 ], [ 'G2', G7, 4 ], [ 'C3', C, 4 ],
			[ 'F2', F, 4 ], [ 'F2', F, 4 ], [ 'C3', C, 4 ], [ 'G2', G7, 4 ], [ 'C3', C, 4 ], [ 'C3', C, 4 ], [ 'G2', G7, 4 ], [ 'C3', C, 4 ] ],
	},

	// "Camptown Races", twice round
	camptown: {
		bpm: 132, meter: 2, oct: 1, reg: 'full', fast: false,
		melody: [ 0, 1 ].flatMap( () => [
			[ 'G4', 0.5 ], [ 'G4', 0.5 ], [ 'E4', 0.5 ], [ 'G4', 0.5 ], [ 'A4', 0.5 ], [ 'G4', 0.5 ], [ 'E4', 1 ], [ 'E4', 0.5 ], [ 'D4', 1.5 ], [ 'E4', 0.5 ], [ 'D4', 1.5 ],
			[ 'G4', 0.5 ], [ 'G4', 0.5 ], [ 'E4', 0.5 ], [ 'G4', 0.5 ], [ 'A4', 0.5 ], [ 'G4', 0.5 ], [ 'E4', 1 ], [ 'D4', 1 ], [ 'E4', 0.5 ], [ 'D4', 0.5 ], [ 'C4', 2 ],
		] ),
		chords: [ 0, 1 ].flatMap( () => [ [ 'C3', C, 2 ], [ 'C3', C, 2 ], [ 'C3', C, 2 ], [ 'G2', G7, 2 ], [ 'C3', C, 2 ], [ 'C3', C, 2 ], [ 'G2', G7, 2 ], [ 'C3', C, 2 ] ] ),
	},

	// "La Cucaracha"
	cucaracha: {
		bpm: 176, meter: 4, oct: 1, reg: 'full', fast: true,
		melody: [
			[ 'C4', 0.5 ], [ 'C4', 0.5 ], [ 'C4', 0.5 ], [ 'F4', 1.5 ], [ 'A4', 1 ], [ 'C4', 0.5 ], [ 'C4', 0.5 ], [ 'C4', 0.5 ], [ 'F4', 1.5 ], [ 'A4', 1 ],
			[ 'F4', 0.5 ], [ 'F4', 0.5 ], [ 'E4', 0.5 ], [ 'E4', 0.5 ], [ 'D4', 0.5 ], [ 'D4', 0.5 ], [ 'C4', 1 ],
			[ 'C4', 0.5 ], [ 'C4', 0.5 ], [ 'C4', 0.5 ], [ 'E4', 1.5 ], [ 'G4', 1 ], [ 'C4', 0.5 ], [ 'C4', 0.5 ], [ 'C4', 0.5 ], [ 'E4', 1.5 ], [ 'G4', 1 ],
			[ 'C5', 0.5 ], [ 'D5', 0.5 ], [ 'C5', 0.5 ], [ 'Bb4', 0.5 ], [ 'A4', 0.5 ], [ 'G4', 0.5 ], [ 'F4', 1 ],
		],
		chords: [ [ 'F2', F, 4 ], [ 'F2', F, 4 ], [ 'C3', C7, 4 ], [ 'C3', C7, 4 ], [ 'C3', C7, 4 ], [ 'F2', F, 4 ] ],
	},

	// "Yankee Doodle"
	yankee: {
		bpm: 160, meter: 4, oct: 1, reg: 'full', fast: false,
		melody: [ 0, 1 ].flatMap( () => [
			[ 'C4', 1 ], [ 'C4', 1 ], [ 'D4', 1 ], [ 'E4', 1 ], [ 'C4', 1 ], [ 'E4', 1 ], [ 'D4', 1 ], [ 'G3', 1 ],
			[ 'C4', 1 ], [ 'C4', 1 ], [ 'D4', 1 ], [ 'E4', 1 ], [ 'C4', 2 ], [ 'B3', 2 ],
			[ 'C4', 1 ], [ 'C4', 1 ], [ 'D4', 1 ], [ 'E4', 1 ], [ 'F4', 1 ], [ 'E4', 1 ], [ 'D4', 1 ], [ 'C4', 1 ],
			[ 'B3', 1 ], [ 'G3', 1 ], [ 'A3', 1 ], [ 'B3', 1 ], [ 'C4', 2 ], [ 'C4', 2 ],
		] ),
		chords: [ 0, 1 ].flatMap( () => [ [ 'C3', C, 4 ], [ 'G2', G7, 4 ], [ 'C3', C, 4 ], [ 'G2', G7, 4 ], [ 'C3', C, 4 ], [ 'F2', F, 4 ], [ 'G2', G7, 4 ], [ 'C3', C, 4 ] ] ),
	},

	// "Rain, Rain, Go Away" (the 27th): the children's chant, then again up a fourth, with a wink
	rainrain: {
		bpm: 112, meter: 4, oct: 1, reg: 'tune', fast: false,
		melody: [
			[ 'G4', 1 ], [ 'E4', 1 ], [ 'A4', 0.5 ], [ 'G4', 0.5 ], [ 'E4', 1 ], [ 'G4', 0.5 ], [ 'G4', 0.5 ], [ 'E4', 1 ], [ 'A4', 0.5 ], [ 'G4', 0.5 ], [ 'E4', 1 ],
			[ 'G4', 1 ], [ 'E4', 1 ], [ 'A4', 0.5 ], [ 'G4', 0.5 ], [ 'E4', 1 ], [ 'G4', 0.5 ], [ 'G4', 0.5 ], [ 'E4', 1 ], [ 'A4', 0.5 ], [ 'G4', 0.5 ], [ 'E4', 1 ],
			[ 'C5', 1 ], [ 'A4', 1 ], [ 'D5', 0.5 ], [ 'C5', 0.5 ], [ 'A4', 1 ], [ 'C5', 0.5 ], [ 'C5', 0.5 ], [ 'A4', 1 ], [ 'D5', 0.5 ], [ 'C5', 0.5 ], [ 'A4', 1 ],
			[ 'G4', 1 ], [ 'E4', 1 ], [ 'A4', 0.5 ], [ 'G4', 0.5 ], [ 'E4', 1 ], [ 'D4', 0.5 ], [ 'E4', 0.5 ], [ 'D4', 0.5 ], [ 'B3', 0.5 ], [ 'C4', 2 ],
		],
		chords: [ [ 'C3', C, 4 ], [ 'C3', C, 4 ], [ 'C3', C, 4 ], [ 'G2', G7, 4 ], [ 'F2', F, 4 ], [ 'F2', F, 4 ], [ 'C3', C, 4 ], [ 'G2', G7, 2 ], [ 'C3', C, 2 ] ],
	},

	// a pitching change: the organist's own slow swing blues in F while the new man jogs in
	bullpen: {
		bpm: 120, meter: 4, oct: 0, reg: 'tune', fast: false, swing: 0.16,
		melody: [
			[ 'F4', 0.5 ], [ 'A4', 0.5 ], [ 'C5', 0.5 ], [ 'D5', 0.5 ], [ 'Eb5', 1 ], [ 'D5', 0.5 ], [ 'C5', 1.5 ],
			[ 'A4', 0.5 ], [ 'C5', 0.5 ], [ 'A4', 0.5 ], [ 'F4', 0.5 ], [ 'Ab4', 1 ], [ 'A4', 2 ],
			[ 'Bb4', 0.5 ], [ 'D5', 0.5 ], [ 'F5', 0.5 ], [ 'G5', 0.5 ], [ 'Ab5', 1 ], [ 'G5', 0.5 ], [ 'F5', 1.5 ],
			[ 'D5', 0.5 ], [ 'F5', 0.5 ], [ 'D5', 0.5 ], [ 'C5', 0.5 ], [ 'A4', 2 ], [ '-', 1 ],
			[ 'C5', 0.5 ], [ 'E5', 0.5 ], [ 'G5', 0.5 ], [ 'E5', 0.5 ], [ 'Bb4', 1 ], [ 'A4', 0.5 ], [ 'G4', 1.5 ],
			[ 'F4', 0.5 ], [ 'A4', 0.5 ], [ 'C5', 0.5 ], [ 'Eb5', 0.5 ], [ 'D5', 1 ], [ 'C5', 0.5 ], [ 'A4', 0.5 ], [ 'F4', 1 ],
		],
		chords: [ [ 'F2', F7, 4 ], [ 'F2', F7, 4 ], [ 'Bb2', Bb7, 4 ], [ 'F2', F7, 4 ], [ 'C3', C9, 4 ], [ 'F2', F7, 4 ] ],
		style: 'hold',
	},

	// the end: the organist's own fanfare, rising, the whole organ out
	champions: {
		bpm: 104, meter: 4, oct: 1, reg: 'full', fast: true,
		melody: [
			[ [ 'C4', 'E4', 'G4' ], 1.5 ], [ [ 'C4', 'E4', 'G4' ], 0.5 ], [ [ 'F4', 'A4', 'C5' ], 2 ], [ [ 'E4', 'G4', 'C5' ], 1.5 ], [ [ 'F4', 'A4', 'D5' ], 0.5 ], [ [ 'G4', 'B4', 'D5' ], 2 ],
			[ [ 'A4', 'C5', 'E5' ], 1.5 ], [ [ 'G4', 'C5', 'E5' ], 0.5 ], [ [ 'F4', 'A4', 'F5' ], 1 ], [ [ 'E4', 'C5', 'E5' ], 1 ], [ [ 'D4', 'B4', 'D5' ], 1 ], [ [ 'G4', 'B4', 'D5' ], 1 ],
			[ [ 'E4', 'G4', 'C5', 'E5' ], 1.5 ], [ [ 'E4', 'G4', 'C5', 'E5' ], 0.5 ], [ [ 'F4', 'A4', 'C5', 'F5' ], 2 ], [ [ 'G4', 'B4', 'D5', 'G5' ], 2 ], [ [ 'G4', 'C5', 'E5', 'G5' ], 4 ],
		],
		chords: [ [ 'C3', C, 4 ], [ 'G2', G7, 4 ], [ 'A2', [ 'E3', 'A3', 'C4' ], 2 ], [ 'F2', F, 2 ], [ 'G2', G7, 4 ], [ 'C3', C, 4 ], [ 'G2', G7, 2 ], [ 'C3', C, 4 ] ],
		style: 'stab',
	},

	// the seventh-inning stretch, if the Phanatic's organ isn't there to play it (his is the same melody and
	// tempo, phanatic/Sounds.js): "Take Me Out to the Ball Game" (Albert Von Tilzer, 1908), the chorus
	takemeout: {
		bpm: 180, meter: 3, oct: 1, reg: 'tune', fast: false,
		melody: [
			[ 'G3', 2 ], [ 'G4', 1 ], [ 'E4', 1 ], [ 'D4', 1 ], [ 'B3', 1 ], [ 'D4', 3 ], [ 'A3', 3 ],
			[ 'G3', 2 ], [ 'G4', 1 ], [ 'E4', 1 ], [ 'D4', 1 ], [ 'B3', 1 ], [ 'D4', 6 ],
			[ 'E4', 1 ], [ 'D#4', 1 ], [ 'E4', 1 ], [ 'B3', 1 ], [ 'C4', 1 ], [ 'D4', 1 ], [ 'E4', 2 ], [ 'C4', 1 ], [ 'A3', 3 ],
			[ 'E4', 2 ], [ 'E4', 1 ], [ 'E4', 1 ], [ 'F#4', 1 ], [ 'G4', 1 ], [ 'A4', 1 ], [ 'F#4', 1 ], [ 'E4', 1 ], [ 'D4', 1 ], [ 'B3', 1 ], [ 'A3', 1 ],
			[ 'G3', 2 ], [ 'G4', 1 ], [ 'E4', 1 ], [ 'D4', 1 ], [ 'B3', 1 ], [ 'D4', 3 ], [ 'A3', 3 ],
			[ 'A3', 2 ], [ 'G3', 1 ], [ 'A3', 1 ], [ 'B3', 1 ], [ 'C4', 1 ], [ 'D4', 2 ], [ 'E4', 4 ],
			[ 'E4', 2 ], [ 'F#4', 1 ], [ 'G4', 3 ], [ 'G4', 3 ], [ 'G4', 1 ], [ 'F#4', 1 ], [ 'E4', 1 ],
			[ 'D4', 2 ], [ 'C#4', 1 ], [ 'D4', 1 ], [ 'E4', 2 ], [ 'F#4', 3 ], [ 'G4', 3 ],
		],
		chords: [
			[ 'G2', [ 'B3', 'D4', 'G4' ], 6 ], [ 'D2', [ 'C4', 'F#4', 'A4' ], 6 ], [ 'G2', [ 'B3', 'D4', 'G4' ], 6 ], [ 'D2', [ 'C4', 'F#4', 'A4' ], 6 ],
			[ 'E2', [ 'D4', 'G#4', 'B4' ], 6 ], [ 'A2', [ 'C4', 'E4', 'A4' ], 6 ], [ 'A2', [ 'C#4', 'G4', 'A4' ], 6 ], [ 'D2', [ 'C4', 'F#4', 'A4' ], 6 ],
			[ 'G2', [ 'B3', 'D4', 'G4' ], 6 ], [ 'D2', [ 'C4', 'F#4', 'A4' ], 6 ], [ 'D2', [ 'C4', 'F#4', 'A4' ], 6 ], [ 'E2', [ 'D4', 'G#4', 'B4' ], 6 ],
			[ 'A2', [ 'C4', 'E4', 'A4' ], 3 ], [ 'G2', [ 'B3', 'D4', 'G4' ], 6 ], [ 'E2', [ 'D4', 'G#4', 'B4' ], 3 ], [ 'A2', [ 'C#4', 'G4', 'A4' ], 6 ], [ 'D2', [ 'C4', 'F#4', 'A4' ], 3 ], [ 'G2', [ 'B3', 'D4', 'G4' ], 3 ],
		],
	},

	// ---- stings between pitches

	// after a Feliz hit: the booth's joke in 2008 was "Feliz Navidad" (the Inquirer); here the organ's "Jingle
	// Bells" (James Lord Pierpont, 1857), the chorus
	jingle: {
		bpm: 176, meter: 4, oct: 1, reg: 'full', fast: true, sting: true,
		melody: [ [ 'E4', 1 ], [ 'E4', 1 ], [ 'E4', 2 ], [ 'E4', 1 ], [ 'E4', 1 ], [ 'E4', 2 ], [ 'E4', 1 ], [ 'G4', 1 ], [ 'C4', 1.5 ], [ 'D4', 0.5 ], [ 'E4', 4 ],
			[ 'F4', 1 ], [ 'F4', 1 ], [ 'F4', 1.5 ], [ 'F4', 0.5 ], [ 'F4', 1 ], [ 'E4', 1 ], [ 'E4', 1 ], [ 'E4', 0.5 ], [ 'E4', 0.5 ], [ 'G4', 1 ], [ 'G4', 1 ], [ 'F4', 1 ], [ 'D4', 1 ], [ 'C4', 4 ] ],
		chords: [ [ 'C3', C, 4 ], [ 'C3', C, 4 ], [ 'C3', C, 4 ], [ 'C3', C, 4 ], [ 'F2', F, 4 ], [ 'C3', C, 4 ], [ 'G2', G7, 4 ], [ 'C3', C, 4 ] ],
	},

	// "Charge!": the bugle call, the park yells it back (Fans.js)
	charge: {
		bpm: 132, meter: 4, oct: 1, reg: 'full', fast: true, sting: true,
		melody: [ [ 'G4', 1 / 3 ], [ 'C5', 1 / 3 ], [ 'E5', 1 / 3 ], [ [ 'G5', 'E5', 'C5' ], 1 ], [ 'E5', 0.5 ], [ [ 'G5', 'E5', 'C5' ], 2.5 ] ].map( ( [ n, b ] ) => [ n, b ] ),
		chords: [ [ 'C3', C, 1 ], [ 'C3', C, 1.5 ], [ 'C3', C, 2.5 ] ], style: 'stab', yell: 'charge', yellAt: 2.25,
	},

	// the organist's "Let's go Phil-lies": four notes, and the park answers
	letsgo: {
		bpm: 138, meter: 4, oct: 1, reg: 'full', fast: true, sting: true,
		melody: [ [ [ 'E5', 'C5' ], 0.5 ], [ [ 'E5', 'C5' ], 0.5 ], [ [ 'G5', 'D5' ], 0.5 ], [ [ 'E5', 'C5' ], 1 ], [ '-', 1.5 ] ],
		chords: [ [ 'C3', C, 4 ] ], style: 'stab', yell: 'letsgo', yellAt: 3.0,
	},

	// the clap-along: da-da, da-da-da; the park claps it back
	clap: {
		bpm: 132, meter: 4, oct: 1, reg: 'full', fast: true, sting: true,
		melody: [ [ [ 'G5', 'D5' ], 0.5 ], [ [ 'G5', 'D5' ], 0.5 ], [ '-', 0.5 ], [ [ 'G5', 'D5' ], 0.5 ], [ [ 'A5', 'E5' ], 0.5 ], [ [ 'B5', 'F#5' ], 0.5 ], [ '-', 1 ] ],
		chords: [ [ 'G2', [ 'D3', 'G3', 'B3' ], 4 ] ], style: 'stab', yell: 'clap', yellAt: 4.0,
	},

	// two strikes: chords climbing a half step at a time, and a stab at the top
	climb: {
		bpm: 150, meter: 4, oct: 0, reg: 'full', fast: true, sting: true,
		melody: [ 0, 1, 2, 3, 4, 5, 6, 7 ].map( ( k ) => [ [ 60 + k, 64 + k, 67 + k ], 0.5 ] ).concat( [ [ [ 67, 72, 76, 79 ], 1.5 ] ] ),
		chords: [], style: 'stab',
	},

};
