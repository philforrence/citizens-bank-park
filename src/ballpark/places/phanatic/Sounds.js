// The Phanatic's sounds. Made in code (GameSound.sample( name, ( ctx ) => buffer ) builds them when the
// audio starts): the organ's cues for him from the booth (the seventh-inning stretch's "Take Me Out to
// the Ball Game", Norworth and Von Tilzer, 1908: public domain; a bouncy riff of the organist's own for his
// dance on the dugout roof; the spooky chord under his hex; the run up the keys for the belly shake) and
// the whump under the launcher's blast. Recorded (public/audio/places/phanatic/, CC0, see its
// CREDITS.md): the four-wheeler's engine, the air blast, the fans close by, a ballpark organ's riff.
//
// The organ is a tonewheel organ's sound: each note a sum of drawbar harmonics (a wavetable, so building
// half a minute of it is quick), a little vibrato, the Leslie's tremolo, a key click at the front.

const SR = 22050;

// ---------------------------------------------------------------- the organ

// one cycle of the drawbars 16' 8' 5 1/3' 4' 2 2/3' 2' 1 3/5' (sub, fundamental, then the harmonics)
const TABLE = ( () => {

	const N = 2048, t = new Float32Array( N + 1 );
	const bars = [ [ 0.5, 0.45 ], [ 1, 1 ], [ 1.5, 0.35 ], [ 2, 0.6 ], [ 3, 0.35 ], [ 4, 0.28 ], [ 5, 0.1 ], [ 6, 0.08 ], [ 8, 0.06 ] ];
	for ( let i = 0; i <= N; i ++ ) {

		let v = 0;
		for ( const [ h, a ] of bars ) v += a * Math.sin( 2 * Math.PI * h * i / N );
		t[ i ] = v / 2.2;

	}

	return t;

} )();
// the sub-octave harmonic (0.5) makes the table's period two of the note's: read it at half speed
const midi = ( m ) => 440 * Math.pow( 2, ( m - 69 ) / 12 );
const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
// 'G4' -> midi
export const note = ( s ) => {

	const m = s.match( /^([A-G]#?)(\d)$/ );
	return 12 * ( Number( m[ 2 ] ) + 1 ) + NOTE[ m[ 1 ] ];

};

// add a held organ note to out: midi m, from t0 for dur seconds, at level a
function organNote( out, m, t0, dur, a = 0.2, click = 1 ) {

	const f = midi( m ) / 2; // the table holds two of the note's periods
	const i0 = Math.floor( t0 * SR ), n = Math.floor( ( dur + 0.06 ) * SR );
	let ph = ( m * 0.137 ) % 1;
	for ( let i = 0; i < n && i0 + i < out.length; i ++ ) {

		const t = i / SR;
		const vib = 1 + 0.0028 * Math.sin( 2 * Math.PI * 6.6 * t );
		ph += f * vib / SR;
		ph -= Math.floor( ph );
		const x = ph * 2048, k = Math.floor( x ), w = TABLE[ k ] + ( TABLE[ k + 1 ] - TABLE[ k ] ) * ( x - k );
		// the envelope: a fast attack, held, a short release; the key click in the first milliseconds
		const env = Math.min( 1, t / 0.008 ) * ( t > dur ? Math.max( 0, 1 - ( t - dur ) / 0.05 ) : 1 );
		const ck = t < 0.006 ? click * 0.25 * ( Math.random() * 2 - 1 ) * ( 1 - t / 0.006 ) : 0;
		out[ i0 + i ] += ( w * env + ck ) * a;

	}

}

// the Leslie: a slow swirl of amplitude over the whole thing
function leslie( out, rate = 5.8, depth = 0.12 ) {

	for ( let i = 0; i < out.length; i ++ ) out[ i ] *= 1 - depth * ( 0.5 + 0.5 * Math.sin( 2 * Math.PI * rate * i / SR ) );

}

function buffer( ctx, data, peak = 0.8 ) {

	let m = 0;
	for ( let i = 0; i < data.length; i ++ ) m = Math.max( m, Math.abs( data[ i ] ) );
	const g = m > 0 ? peak / m : 1;
	const b = ctx.createBuffer( 1, data.length, SR );
	const d = b.getChannelData( 0 );
	for ( let i = 0; i < data.length; i ++ ) d[ i ] = data[ i ] * g;
	return b;

}

// A tune: melody [ [ note, beats ], ... ] ('-' a rest) over chords [ [ bass, [ chord notes ], beats ], ... ]
// played oom-pah-pah (the bass on the downbeat, the chord on the others) in 3/4, or on every beat in 4/4
function tune( { melody, chords = [], bpm, meter = 3, tail = 0.8, level = 0.22 } ) {

	const beat = 60 / bpm;
	const total = melody.reduce( ( s, [ , b ] ) => s + b, 0 ) * beat + tail;
	const out = new Float32Array( Math.ceil( total * SR ) );
	let t = 0;
	for ( const [ n, b ] of melody ) {

		if ( n !== '-' ) organNote( out, note( n ) + 12, t, b * beat * 0.92, level );
		t += b * beat;

	}

	t = 0;
	for ( const [ bass, chord, b ] of chords ) {

		for ( let k = 0; k < b; k ++ ) {

			const tt = t + k * beat;
			if ( k % meter === 0 ) organNote( out, note( bass ), tt, beat * 0.8, level * 0.55, 0.5 );
			else for ( const c of chord ) organNote( out, note( c ), tt, beat * 0.45, level * 0.22, 0.3 );

		}

		t += b * beat;

	}

	leslie( out );
	return out;

}

// "Take Me Out to the Ball Game", the chorus, in G (the melody an octave up on the organ): 32 bars of 3/4
const TAKE_ME_OUT = {
	melody: [
		// Take me out to the ball game,
		[ 'G3', 2 ], [ 'G4', 1 ], [ 'E4', 1 ], [ 'D4', 1 ], [ 'B3', 1 ], [ 'D4', 3 ], [ 'A3', 3 ],
		// take me out with the crowd;
		[ 'G3', 2 ], [ 'G4', 1 ], [ 'E4', 1 ], [ 'D4', 1 ], [ 'B3', 1 ], [ 'D4', 6 ],
		// buy me some peanuts and Cracker Jack,
		[ 'E4', 1 ], [ 'D#4', 1 ], [ 'E4', 1 ], [ 'B3', 1 ], [ 'C4', 1 ], [ 'D4', 1 ], [ 'E4', 2 ], [ 'C4', 1 ], [ 'A3', 3 ],
		// I don't care if I never get back. Let me
		[ 'E4', 2 ], [ 'E4', 1 ], [ 'E4', 1 ], [ 'F#4', 1 ], [ 'G4', 1 ], [ 'A4', 1 ], [ 'F#4', 1 ], [ 'E4', 1 ], [ 'D4', 1 ], [ 'B3', 1 ], [ 'A3', 1 ],
		// root, root, root for the home team,
		[ 'G3', 2 ], [ 'G4', 1 ], [ 'E4', 1 ], [ 'D4', 1 ], [ 'B3', 1 ], [ 'D4', 3 ], [ 'A3', 3 ],
		// if they don't win it's a shame. For it's
		[ 'A3', 2 ], [ 'G3', 1 ], [ 'A3', 1 ], [ 'B3', 1 ], [ 'C4', 1 ], [ 'D4', 2 ], [ 'E4', 4 ],
		// one, two, three strikes you're
		[ 'E4', 2 ], [ 'F#4', 1 ], [ 'G4', 3 ], [ 'G4', 3 ], [ 'G4', 1 ], [ 'F#4', 1 ], [ 'E4', 1 ],
		// out at the old ball game.
		[ 'D4', 2 ], [ 'C#4', 1 ], [ 'D4', 1 ], [ 'E4', 2 ], [ 'F#4', 3 ], [ 'G4', 3 ],
	],
	chords: [
		[ 'G2', [ 'B3', 'D4', 'G4' ], 6 ], [ 'D2', [ 'C4', 'F#4', 'A4' ], 6 ],
		[ 'G2', [ 'B3', 'D4', 'G4' ], 6 ], [ 'D2', [ 'C4', 'F#4', 'A4' ], 6 ],
		[ 'E2', [ 'D4', 'G#4', 'B4' ], 6 ], [ 'A2', [ 'C4', 'E4', 'A4' ], 6 ],
		[ 'A2', [ 'C#4', 'G4', 'A4' ], 6 ], [ 'D2', [ 'C4', 'F#4', 'A4' ], 6 ],
		[ 'G2', [ 'B3', 'D4', 'G4' ], 6 ], [ 'D2', [ 'C4', 'F#4', 'A4' ], 6 ],
		[ 'D2', [ 'C4', 'F#4', 'A4' ], 6 ], [ 'E2', [ 'D4', 'G#4', 'B4' ], 6 ],
		[ 'A2', [ 'C4', 'E4', 'A4' ], 3 ], [ 'G2', [ 'B3', 'D4', 'G4' ], 6 ], [ 'E2', [ 'D4', 'G#4', 'B4' ], 3 ],
		[ 'A2', [ 'C#4', 'G4', 'A4' ], 6 ], [ 'D2', [ 'C4', 'F#4', 'A4' ], 3 ], [ 'G2', [ 'B3', 'D4', 'G4' ], 3 ],
	],
	bpm: 180,
};
export const STRETCH_SECONDS = 96 * 60 / 180;

// his dance riff: an original bouncy eight bars in 4/4 (the organist's own, round a I-vi-ii-V in C)
const DANCE = {
	melody: [
		[ 'G4', 0.5 ], [ 'G4', 0.5 ], [ 'A4', 0.5 ], [ 'G4', 0.5 ], [ 'E4', 1 ], [ 'C4', 1 ],
		[ 'A4', 0.5 ], [ 'A4', 0.5 ], [ 'C5', 0.5 ], [ 'A4', 0.5 ], [ 'G4', 1 ], [ '-', 1 ],
		[ 'F4', 0.5 ], [ 'F4', 0.5 ], [ 'A4', 0.5 ], [ 'F4', 0.5 ], [ 'D4', 1 ], [ 'F4', 1 ],
		[ 'G4', 0.5 ], [ 'B4', 0.5 ], [ 'D5', 0.5 ], [ 'B4', 0.5 ], [ 'G4', 1 ], [ '-', 1 ],
		[ 'G4', 0.5 ], [ 'G4', 0.5 ], [ 'A4', 0.5 ], [ 'G4', 0.5 ], [ 'E4', 1 ], [ 'C5', 1 ],
		[ 'A4', 0.5 ], [ 'C5', 0.5 ], [ 'E5', 0.5 ], [ 'C5', 0.5 ], [ 'A4', 1 ], [ 'G4', 1 ],
		[ 'F4', 0.5 ], [ 'A4', 0.5 ], [ 'D5', 0.5 ], [ 'C5', 0.5 ], [ 'B4', 0.5 ], [ 'A4', 0.5 ], [ 'G4', 0.5 ], [ 'F4', 0.5 ],
		[ 'E4', 0.5 ], [ 'G4', 0.5 ], [ 'C5', 1 ], [ 'C5', 0.5 ], [ '-', 1.5 ],
	],
	chords: [
		[ 'C3', [ 'E4', 'G4', 'C5' ], 4 ], [ 'A2', [ 'E4', 'A4', 'C5' ], 4 ], [ 'D3', [ 'F4', 'A4', 'D5' ], 4 ], [ 'G2', [ 'F4', 'B4', 'D5' ], 4 ],
		[ 'C3', [ 'E4', 'G4', 'C5' ], 4 ], [ 'A2', [ 'E4', 'A4', 'C5' ], 4 ], [ 'D3', [ 'F4', 'A4', 'D5' ], 2 ], [ 'G2', [ 'F4', 'B4', 'D5' ], 2 ], [ 'C3', [ 'E4', 'G4', 'C5' ], 4 ],
	],
	bpm: 132, meter: 2,
};

// ---------------------------------------------------------------- the buffers

export function registerSounds( sound ) {

	if ( ! sound?.sample ) return;
	sound.sample( 'phan-organ-stretch', ( ctx ) => buffer( ctx, tune( TAKE_ME_OUT ), 0.7 ) );
	sound.sample( 'phan-organ-dance', ( ctx ) => buffer( ctx, tune( DANCE ), 0.7 ) );
	// the hex: a diminished seventh swelling up under him, trembling, and a low stab to seal it
	sound.sample( 'phan-organ-hex', ( ctx ) => {

		const out = new Float32Array( Math.ceil( 3.2 * SR ) );
		for ( const n of [ 'B2', 'D3', 'F3', 'G#3', 'B3' ] ) organNote( out, note( n ), 0.0, 2.2, 0.16 );
		for ( const n of [ 'C#3', 'E3', 'G3', 'A#3' ] ) organNote( out, note( n ), 2.35, 0.7, 0.2 );
		// the swell pedal: in slowly
		for ( let i = 0; i < out.length; i ++ ) out[ i ] *= Math.min( 1, 0.25 + i / SR / 1.2 );
		leslie( out, 7.2, 0.3 );
		return buffer( ctx, out, 0.7 );

	} );
	// the run up the keys (the belly shake, the slide): a chromatic glissando and a whoop at the top
	sound.sample( 'phan-organ-run', ( ctx ) => {

		const out = new Float32Array( Math.ceil( 1.6 * SR ) );
		for ( let k = 0; k < 18; k ++ ) organNote( out, note( 'G3' ) + k, k * 0.045, 0.06, 0.2, 0.2 );
		organNote( out, note( 'D5' ), 18 * 0.045, 0.5, 0.2 );
		organNote( out, note( 'G5' ), 18 * 0.045, 0.5, 0.15 );
		leslie( out );
		return buffer( ctx, out, 0.7 );

	} );
	// the whump under the recorded air blast
	sound.sample( 'phan-thump', ( ctx ) => buffer( ctx, thump(), 0.9 ) );
	// the recordings (CC0, public/audio/places/phanatic/CREDITS.md): a four-wheeler idling (played faster
	// as he opens it up), a compressed-air blast, a small crowd close by cheering and clapping, and a real
	// ballpark organ's riff (Wrigley's) for when he first comes out
	sound.sample( 'phan-atv', 'audio/places/phanatic/atv-idle.mp3' );
	sound.sample( 'phan-launch', 'audio/places/phanatic/launch.mp3' );
	sound.sample( 'phan-crowd', 'audio/places/phanatic/crowd-near-cheer.mp3' );
	sound.sample( 'phan-organ-riff', 'audio/places/phanatic/organ-wrigley-riff.mp3' );

}

// ---------------------------------------------------------------- the machines

// The launcher firing: the valve's clack, the whump of the air (a low sweep), the hiss after it
function thump() {

	const n = Math.ceil( 0.9 * SR ), out = new Float32Array( n );
	let lp = 0, hp = 0, prev = 0, seed = 3;
	const rnd = () => ( ( seed = ( seed * 1664525 + 1013904223 ) >>> 0 ) / 4294967296 );
	let ph = 0;
	for ( let i = 0; i < n; i ++ ) {

		const t = i / SR;
		const f = 45 + 110 * Math.exp( - t * 18 );
		ph += f / SR;
		const whump = Math.sin( 2 * Math.PI * ph ) * Math.exp( - t * 9 ) * Math.min( 1, t / 0.004 );
		const noise = rnd() * 2 - 1;
		lp += ( noise - lp ) * 0.5;
		hp = lp - prev; prev = lp;
		const hiss = hp * 0.6 * Math.exp( - t * 5 ) * Math.min( 1, t / 0.02 );
		const clack = t < 0.012 ? ( rnd() * 2 - 1 ) * ( 1 - t / 0.012 ) * 0.7 : 0;
		out[ i ] = whump + hiss + clack;

	}

	return out;

}
