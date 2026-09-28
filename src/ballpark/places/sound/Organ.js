// A ballpark organ in Web Audio: a tonewheel organ's drawbars as PeriodicWaves (each note one oscillator,
// its harmonics the drawbars' footages), a key click at the front of every note, the percussion's
// decaying third harmonic, and the Leslie (a slowly or quickly spinning horn: a wobble of pitch, level and
// side to side). Notes are scheduled a fraction of a second ahead by Music.js, so a whole tune is never
// made at once. It plays into the music bus: the park's PA speakers (PA.js).

// the drawbars' footages as harmonics of the 16' (sub-octave): 16', 5 1/3', 8', 4', 2 2/3', 2', 1 3/5', 1 1/3', 1'
const HARM = [ 1, 3, 2, 4, 6, 8, 10, 12, 16 ];
export const REG = {
	// the ballpark's bright, full registration (stings, "Charge!", the marches)
	full: [ 8, 6, 8, 8, 6, 6, 4, 4, 6 ],
	// a rounder one for the old tunes between innings
	tune: [ 8, 4, 8, 6, 4, 4, 0, 0, 2 ],
	// soft, for under the PA and the rain
	mellow: [ 6, 2, 8, 4, 0, 0, 0, 0, 0 ],
};

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function midi( s ) {

	if ( typeof s === 'number' ) return s;
	const m = s.match( /^([A-G](?:#|b)?)(-?\d)$/ );
	return 12 * ( Number( m[ 2 ] ) + 1 ) + NOTE[ m[ 1 ] ];

}

export class Organ {

	constructor( ctx, out ) {

		this.ctx = ctx;
		this.waves = {};
		for ( const [ k, bars ] of Object.entries( REG ) ) {

			const real = new Float32Array( 17 ), imag = new Float32Array( 17 );
			bars.forEach( ( lv, i ) => {

				if ( lv > 0 ) imag[ HARM[ i ] ] += Math.pow( 10, - ( 8 - lv ) * 3 / 20 );

			} );
			this.waves[ k ] = ctx.createPeriodicWave( real, imag );

		}

		// the key click: 5 ms of bright noise
		const n = Math.floor( ctx.sampleRate * 0.006 );
		this.click = ctx.createBuffer( 1, n, ctx.sampleRate );
		const d = this.click.getChannelData( 0 );
		let s = 7;
		for ( let i = 0; i < n; i ++ ) {

			s = ( s * 16807 ) % 2147483647;
			d[ i ] = ( s / 2147483647 * 2 - 1 ) * ( 1 - i / n ) * ( 1 - i / n );

		}

		// the Leslie: the horn's spin as a delay wobble (pitch), a level wobble and a pan wobble, on one LFO;
		// a dry share for the slower bass rotor
		this.in = ctx.createGain();
		const dly = ctx.createDelay( 0.02 );
		dly.delayTime.value = 0.005;
		this.lfo = ctx.createOscillator();
		this.lfo.frequency.value = 0.8;
		const dep = ctx.createGain(), amp = ctx.createGain(), ad = ctx.createGain(), pan = ctx.createStereoPanner(), pd = ctx.createGain(), dry = ctx.createGain();
		dep.gain.value = 0.00045;
		amp.gain.value = 0.85;
		ad.gain.value = 0.13;
		pd.gain.value = 0.35;
		dry.gain.value = 0.55;
		this.lfo.connect( dep ).connect( dly.delayTime );
		this.lfo.connect( ad ).connect( amp.gain );
		this.lfo.connect( pd ).connect( pan.pan );
		this.in.connect( dly ).connect( amp ).connect( pan ).connect( out );
		this.in.connect( dry ).connect( out );
		this.lfo.start();

	}

	// the Leslie spinning up (fast, the stings) or down (chorale); it takes a second either way
	spin( fast ) {

		this.lfo.frequency.setTargetAtTime( fast ? 6.6 : 0.8, this.ctx.currentTime, fast ? 0.4 : 0.9 );

	}

	// one key held from t for dur: m (midi), level 0..1, a registration
	note( m, t, dur, level = 1, reg = 'full', perc = true, out = this.in ) {

		const ctx = this.ctx, f = 440 * Math.pow( 2, ( m - 69 ) / 12 );
		const o = ctx.createOscillator();
		o.setPeriodicWave( this.waves[ reg ] || this.waves.full );
		o.frequency.value = f / 2;
		const g = ctx.createGain(), a = 0.085 * level;
		g.gain.setValueAtTime( 0, t );
		g.gain.linearRampToValueAtTime( a, t + 0.005 );
		g.gain.setValueAtTime( a, t + dur );
		g.gain.linearRampToValueAtTime( 0, t + dur + 0.035 );
		o.connect( g ).connect( out );
		o.start( t );
		o.stop( t + dur + 0.05 );
		const c = ctx.createBufferSource(), cg = ctx.createGain();
		c.buffer = this.click;
		c.playbackRate.value = 0.8 + ( m % 7 ) * 0.06;
		cg.gain.value = 0.05 * level;
		c.connect( cg ).connect( out );
		c.start( t );
		if ( perc ) {

			// the percussion: the third harmonic, struck and dying away
			const p = ctx.createOscillator(), pg = ctx.createGain();
			p.frequency.value = f * 3;
			pg.gain.setValueAtTime( 0.03 * level, t );
			pg.gain.exponentialRampToValueAtTime( 0.0005, t + 0.28 );
			p.connect( pg ).connect( out );
			p.start( t );
			p.stop( t + 0.3 );

		}

	}

}

// A tune as data -> note events [ t (beats), midi, dur (beats), level, perc ]:
//   melody: [ [ note | '-', beats ], ... ]  (oct: shift it by octaves)
//   chords: [ [ bass, [ chord notes ], beats ], ... ] played by `style`:
//     'oompah'  the bass on the strong beats, the chord on the others (march, ragtime, waltz by meter)
//     'hold'    the chord held under the bar, the bass on its first beat
//     'stab'    one short full chord at the start of each
export function score( tune ) {

	const { melody = [], chords = [], meter = 4, style = 'oompah', oct = 0, swing = 0 } = tune;
	const ev = [];
	let t = 0;
	const sw = ( b ) => swing && ( b % 1 ) > 0.4 && ( b % 1 ) < 0.6 ? b + swing : b;
	for ( const [ n, b ] of melody ) {

		if ( n !== '-' ) for ( const k of [].concat( n ) ) ev.push( [ sw( t ), midi( k ) + 12 * oct, b * 0.9, 1, true ] );
		t += b;

	}

	t = 0;
	for ( const [ bass, chord, b ] of chords ) {

		const cm = chord.map( midi );
		if ( style === 'hold' ) {

			ev.push( [ t, midi( bass ), Math.min( b, meter ) * 0.9, 0.7, false ] );
			for ( const c of cm ) ev.push( [ t, c, b * 0.95, 0.32, false ] );

		} else if ( style === 'stab' ) {

			ev.push( [ t, midi( bass ), 0.4, 0.8, false ] );
			for ( const c of cm ) ev.push( [ t, c, 0.35, 0.45, false ] );

		} else {

			for ( let k = 0; k < b; k ++ ) {

				const strong = meter === 3 ? k % 3 === 0 : k % 2 === 0;
				if ( strong ) ev.push( [ t + k, midi( bass ) + ( meter !== 3 && k % 4 === 2 ? 7 : 0 ), 0.7, 0.7, false ] );
				else for ( const c of cm ) ev.push( [ t + k, c, 0.4, 0.3, false ] );

			}

		}

		t += b;

	}

	ev.sort( ( a, b ) => a[ 0 ] - b[ 0 ] );
	return ev;

}
