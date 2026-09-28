// A small studio band in Web Audio, for the music the A/V booth played in 2008 (there was no live organ that
// year: the walk-ups, the between-innings rock, all recorded). Here every piece is an original stand-in: the
// style, tempo and colour of what the real song was, never its melody, riff or words (no copyrighted music).
// Drums, bass, a distorted guitar, keys, brass stabs, Latin percussion, each a few Web Audio nodes made at
// its note; a piece is a list of timed events scheduled a fraction of a second ahead (Music.js's update),
// out through the music bus (the PA's speakers).

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const m = ( s ) => typeof s === 'number' ? s : 12 * ( Number( s.slice( - 1 ) ) + 1 ) + NOTE[ s.slice( 0, - 1 ) ];
const hz = ( n ) => 440 * Math.pow( 2, ( m( n ) - 69 ) / 12 );
// a chord from a root and intervals
const ch = ( root, ...iv ) => iv.map( ( i ) => m( root ) + i );
const PWR = [ 0, 7, 12 ], MIN7 = [ 0, 3, 7, 10 ], MAJ = [ 0, 4, 7 ], MIN = [ 0, 3, 7 ], DOM9 = [ 0, 4, 10, 14 ], MIN9 = [ 0, 3, 10, 14 ];

export class Band {

	constructor( ctx, out ) {

		this.ctx = ctx;
		// the band's bus: a gentle glue compressor, then out
		this.in = ctx.createGain();
		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = - 18;
		comp.ratio.value = 3;
		comp.attack.value = 0.01;
		comp.release.value = 0.2;
		this.in.connect( comp ).connect( out );
		const sr = ctx.sampleRate;
		// white noise, a second of it, for the drums
		const n = sr;
		this.noise = ctx.createBuffer( 1, n, sr );
		const d = this.noise.getChannelData( 0 );
		let s = 12345;
		for ( let i = 0; i < n; i ++ ) {

			s = ( s * 16807 ) % 2147483647;
			d[ i ] = s / 2147483647 * 2 - 1;

		}

		// the guitar's amp: a soft clip, driven hard
		this.dist = new Float32Array( 1024 );
		for ( let i = 0; i < 1024; i ++ ) {

			const x = i / 511.5 - 1;
			this.dist[ i ] = Math.tanh( x * 6 ) * 0.9;

		}

		this.parts = [];

	}

	// ---------------------------------------------------------------- the instruments (each at time t)

	_env( t, a, peak, hold, rel, out = this.in ) {

		const g = this.ctx.createGain();
		g.gain.setValueAtTime( 0.0001, t );
		g.gain.linearRampToValueAtTime( peak, t + a );
		g.gain.setValueAtTime( peak, t + a + hold );
		g.gain.exponentialRampToValueAtTime( 0.0001, t + a + hold + rel );
		g.connect( out );
		return g;

	}

	_noise( t, dur, filters, env, out ) {

		const src = this.ctx.createBufferSource();
		src.buffer = this.noise;
		let node = src;
		for ( const [ type, f, q ] of filters ) {

			const b = this.ctx.createBiquadFilter();
			b.type = type;
			b.frequency.value = f;
			b.Q.value = q ?? 0.7;
			node.connect( b );
			node = b;

		}

		node.connect( env );
		src.start( t, Math.random() * 0.7 );
		src.stop( t + dur );

	}

	_osc( t, dur, type, f, env, detune = 0, glide = null ) {

		const o = this.ctx.createOscillator();
		o.type = type;
		o.frequency.setValueAtTime( f, t );
		if ( glide ) o.frequency.exponentialRampToValueAtTime( glide[ 0 ], t + glide[ 1 ] );
		o.detune.value = detune;
		o.connect( env );
		o.start( t );
		o.stop( t + dur );
		return o;

	}

	kick( t, v = 1 ) {

		this._osc( t, 0.45, 'sine', 140, this._env( t, 0.002, 0.9 * v, 0.02, 0.35 ), 0, [ 42, 0.12 ] );
		this._noise( t, 0.02, [ [ 'highpass', 2500 ] ], this._env( t, 0.001, 0.25 * v, 0.002, 0.012 ) );

	}

	snare( t, v = 1 ) {

		this._noise( t, 0.25, [ [ 'bandpass', 1900, 0.6 ], [ 'highpass', 700 ] ], this._env( t, 0.001, 0.55 * v, 0.01, 0.17 ) );
		this._osc( t, 0.12, 'triangle', 190, this._env( t, 0.001, 0.35 * v, 0.005, 0.08 ), 0, [ 150, 0.08 ] );

	}

	rim( t, v = 1 ) {

		this._osc( t, 0.06, 'square', 1700, this._env( t, 0.001, 0.12 * v, 0.002, 0.03 ) );
		this._noise( t, 0.04, [ [ 'bandpass', 3000, 2 ] ], this._env( t, 0.001, 0.3 * v, 0.002, 0.025 ) );

	}

	clap( t, v = 1 ) {

		for ( const k of [ 0, 0.011, 0.023 ] ) this._noise( t + k, 0.2, [ [ 'bandpass', 1300, 1.2 ] ], this._env( t + k, 0.001, 0.4 * v, 0.003, k === 0.023 ? 0.14 : 0.01 ) );

	}

	hat( t, v = 1, open = false ) {

		this._noise( t, open ? 0.35 : 0.06, [ [ 'highpass', 7500 ], [ 'peaking', 10000, 1 ] ], this._env( t, 0.001, 0.22 * v, 0.004, open ? 0.25 : 0.035 ) );

	}

	crash( t, v = 1 ) {

		this._noise( t, 1.6, [ [ 'highpass', 4000 ] ], this._env( t, 0.002, 0.28 * v, 0.02, 1.4 ) );

	}

	tom( t, f, v = 1 ) {

		this._osc( t, 0.4, 'sine', f * 1.5, this._env( t, 0.002, 0.7 * v, 0.02, 0.3 ), 0, [ f, 0.1 ] );

	}

	// Latin percussion: a conga's slap or open tone, the claves, a cowbell, a guira's scrape
	conga( t, f = 210, v = 1 ) {

		this._osc( t, 0.3, 'sine', f * 1.3, this._env( t, 0.001, 0.45 * v, 0.01, 0.2 ), 0, [ f, 0.04 ] );

	}

	clave( t, v = 1 ) {

		this._osc( t, 0.08, 'sine', 2500, this._env( t, 0.001, 0.25 * v, 0.003, 0.05 ) );

	}

	cowbell( t, v = 1 ) {

		const e = this._env( t, 0.001, 0.12 * v, 0.01, 0.2 );
		const f = this.ctx.createBiquadFilter();
		f.type = 'bandpass';
		f.frequency.value = 800;
		f.connect( e );
		this._osc( t, 0.3, 'square', 562, f );
		this._osc( t, 0.3, 'square', 845, f );

	}

	guira( t, v = 1 ) {

		this._noise( t, 0.12, [ [ 'bandpass', 5500, 1.5 ] ], this._env( t, 0.02, 0.12 * v, 0.02, 0.05 ) );

	}

	// bass: a plucked electric (saw through a closing filter), or an 808 (a long sine with a drop)
	bass( t, n, dur, v = 1, kind = 'electric' ) {

		if ( kind === '808' ) {

			this._osc( t, dur + 0.3, 'sine', hz( n ) * 1.06, this._env( t, 0.005, 0.8 * v, dur * 0.6, dur * 0.8 + 0.2 ), 0, [ hz( n ), 0.06 ] );
			return;

		}

		const e = this._env( t, 0.004, 0.45 * v, dur * 0.7, 0.12 );
		const f = this.ctx.createBiquadFilter();
		f.type = 'lowpass';
		f.Q.value = 3;
		f.frequency.setValueAtTime( kind === 'synth' ? 2400 : 1100, t );
		f.frequency.exponentialRampToValueAtTime( kind === 'synth' ? 500 : 280, t + 0.15 );
		f.connect( e );
		this._osc( t, dur + 0.2, 'sawtooth', hz( n ), f );
		this._osc( t, dur + 0.2, 'square', hz( n ) / 2, f, 5 );

	}

	// the guitar: a power chord through the amp (mute: palm-muted, short and chunky)
	gtr( t, notes, dur, v = 1, mute = false ) {

		const ctx = this.ctx;
		const e = this._env( t, 0.003, 0.2 * v, mute ? 0.02 : dur * 0.8, mute ? 0.08 : 0.3 );
		const cab = ctx.createBiquadFilter();
		cab.type = 'lowpass';
		cab.frequency.value = mute ? 1800 : 3600;
		const mid = ctx.createBiquadFilter();
		mid.type = 'peaking';
		mid.frequency.value = 1100;
		mid.gain.value = 5;
		const amp = ctx.createWaveShaper();
		amp.curve = this.dist;
		const pre = ctx.createGain();
		pre.gain.value = 0.35;
		pre.connect( amp ).connect( mid ).connect( cab ).connect( e );
		for ( const n of notes ) for ( const dt of [ - 7, 6 ] ) this._osc( t, dur + 0.4, 'sawtooth', hz( n ), pre, dt );

	}

	// keys: an electric piano (a bell over a sine), a piano's montuno (short), an organ chord, brass stabs, a pad
	keys( t, notes, dur, v = 1, kind = 'rhodes' ) {

		const ctx = this.ctx;
		if ( kind === 'brass' ) {

			const e = this._env( t, 0.03, 0.12 * v, dur * 0.7, 0.15 );
			const f = ctx.createBiquadFilter();
			f.type = 'lowpass';
			f.frequency.setValueAtTime( 600, t );
			f.frequency.linearRampToValueAtTime( 3200, t + 0.06 );
			f.frequency.exponentialRampToValueAtTime( 1400, t + dur );
			f.connect( e );
			for ( const n of notes ) for ( const dt of [ - 8, 8 ] ) this._osc( t, dur + 0.3, 'sawtooth', hz( n ), f, dt );
			return;

		}

		if ( kind === 'pad' ) {

			const e = this._env( t, Math.min( 0.6, dur * 0.4 ), 0.06 * v, dur * 0.5, 0.6 );
			const f = ctx.createBiquadFilter();
			f.type = 'lowpass';
			f.frequency.value = 2200;
			f.connect( e );
			for ( const n of notes ) for ( const dt of [ - 12, 0, 12 ] ) this._osc( t, dur + 0.8, 'sawtooth', hz( n ), f, dt );
			return;

		}

		const short = kind === 'montuno' || kind === 'skank';
		const e = this._env( t, 0.003, ( kind === 'skank' ? 0.1 : 0.14 ) * v, short ? 0.03 : dur * 0.3, short ? 0.1 : dur * 0.7 + 0.2 );
		let out = e;
		if ( kind === 'skank' ) {

			const f = ctx.createBiquadFilter();
			f.type = 'bandpass';
			f.frequency.value = 1400;
			f.Q.value = 0.8;
			f.connect( e );
			out = f;

		}

		for ( const n of notes ) {

			this._osc( t, dur + 0.5, kind === 'skank' ? 'square' : 'sine', hz( n ), out );
			if ( kind !== 'skank' ) this._osc( t, 0.4, 'sine', hz( n ) * ( kind === 'montuno' ? 2 : 3.01 ), this._env( t, 0.002, 0.04 * v, 0.01, 0.25, out ) );

		}

	}

	// ---------------------------------------------------------------- playing a piece

	// a piece (SONGS) from now for `seconds`, faded at the end; returns false if there's none by that name
	play( name, seconds, vol = 1 ) {

		const song = SONGS[ name ];
		if ( ! song ) return false;
		const ctx = this.ctx, t0 = ctx.currentTime + 0.06;
		const beat = 60 / song.bpm;
		const ev = [];
		// the piece written out bar by bar, as long as it's wanted
		const bars = Math.ceil( seconds / ( beat * 4 ) ) + 1;
		song.write( ( b, inst, ...args ) => ev.push( [ b, inst, args ] ), bars );
		ev.sort( ( a, b ) => a[ 0 ] - b[ 0 ] );
		const g = ctx.createGain();
		g.gain.value = vol * ( song.level ?? 1 );
		g.gain.setValueAtTime( vol * ( song.level ?? 1 ), t0 + seconds - 1.8 );
		g.gain.linearRampToValueAtTime( 0.0001, t0 + seconds );
		g.connect( this.in );
		this.parts.push( { ev, beat, t0, i: 0, end: t0 + seconds, g } );
		return true;

	}

	stop() {

		const t = this.ctx.currentTime;
		for ( const p of this.parts ) {

			p.g.gain.cancelScheduledValues( t );
			p.g.gain.setTargetAtTime( 0, t, 0.1 );
			p.end = Math.min( p.end, t + 0.4 );

		}

	}

	update( now ) {

		for ( let k = this.parts.length - 1; k >= 0; k -- ) {

			const p = this.parts[ k ];
			const save = this.in;
			// the instruments play into this piece's gain
			this.in = p.g;
			while ( p.i < p.ev.length ) {

				const [ b, inst, args ] = p.ev[ p.i ];
				const t = p.t0 + b * p.beat;
				if ( t > now + 0.3 ) break;
				p.i ++;
				if ( t < now - 0.05 || t >= p.end ) continue;
				const a = args.map( ( x ) => x === '%b' ? p.beat : x );
				this[ inst ]( t, ...a.map( ( x ) => typeof x === 'number' && inst !== 'kick' && x < 0 ? - x * p.beat : x ) );

			}

			this.in = save;
			if ( ( p.i >= p.ev.length || now > p.end ) && now > p.end + 0.5 ) {

				p.g.disconnect();
				this.parts.splice( k, 1 );

			}

		}

	}

}

// ---------------------------------------------------------------- the pieces
//
// write( e, bars ): e( beat, instrument, ...args ) for as many bars as wanted (4/4). Durations for the
// pitched ones are in seconds unless given negative, in beats (-2: two beats).

const drums = ( e, bar, { kick = [ 0, 2 ], snare = [ 1, 3 ], hats = 8, open = [], clap = [], v = 1 } = {} ) => {

	const b0 = bar * 4;
	for ( const k of kick ) e( b0 + k, 'kick', v );
	for ( const s of snare ) e( b0 + s, 'snare', v );
	for ( const c of clap ) e( b0 + c, 'clap', v );
	for ( let h = 0; h < hats; h ++ ) e( b0 + h * 4 / hats, 'hat', v * ( h % 2 ? 0.6 : 0.9 ), open.includes( h ) );

};

export const SONGS = {

	// Utley (his was a slow, heavy, orchestral rock epic): a half-time march in D, a descending Phrygian
	// line on the guitar, the brass answering on the downbeats
	utley: {
		bpm: 84, level: 1,
		write( e, bars ) {

			const line = [ [ 'D3', 'Eb3' ], [ 'D3', 'C3' ], [ 'Bb2', 'C3' ], [ 'A2', 'Bb2' ] ];
			for ( let bar = 0; bar < bars; bar ++ ) {

				const b0 = bar * 4;
				drums( e, bar, { kick: [ 0, 1.5 ], snare: [ 2 ], hats: 4 } );
				if ( bar % 2 === 0 ) e( b0, 'crash', 0.7 );
				const [ a, b ] = line[ bar % 4 ];
				e( b0, 'gtr', [ m( a ), m( a ) + 7 ], - 1.3, 1 );
				e( b0 + 1.5, 'gtr', [ m( b ), m( b ) + 7 ], - 0.4, 0.9 );
				e( b0 + 2, 'gtr', [ m( a ), m( a ) + 7 ], - 1.8, 1 );
				e( b0, 'bass', m( a ) - 12, - 1.4, 1 );
				e( b0 + 2, 'bass', m( a ) - 12, - 1.8, 1 );
				e( b0, 'keys', ch( 'D4', 0, 3, 7 ), - 0.5, 1, 'brass' );
				e( b0 + 3, 'keys', ch( b, 0, 3, 7 ).map( ( x ) => x + 12 ), - 0.8, 0.8, 'brass' );

			}

		},
	},

	// Rollins (smooth R&B / hip-hop): a laid-back beat, an electric piano, a round bass
	rollins: {
		bpm: 94,
		write( e, bars ) {

			const prog = [ ch( 'A3', ...MIN9 ), ch( 'D3', ...MIN9 ), ch( 'G3', ...DOM9 ), ch( 'C3', 0, 4, 11, 14 ) ];
			for ( let bar = 0; bar < bars; bar ++ ) {

				const b0 = bar * 4;
				drums( e, bar, { kick: [ 0, 1.75, 2.5 ], snare: [], clap: [ 1, 3 ], hats: 16 } );
				const c = prog[ bar % 4 ];
				e( b0, 'keys', c, - 1.5, 1, 'rhodes' );
				e( b0 + 2.5, 'keys', c, - 1.2, 0.8, 'rhodes' );
				e( b0, 'bass', c[ 0 ] - 12, - 1.5, 1, '808' );
				e( b0 + 2.5, 'bass', c[ 0 ] - 12, - 1, 0.8, '808' );

			}

		},
	},

	// Burrell (80s synth rock): a pulsing eighth-note synth bass, a big gated snare, synth stabs
	burrell: {
		bpm: 128,
		write( e, bars ) {

			const roots = [ 'E2', 'E2', 'C2', 'D2' ];
			for ( let bar = 0; bar < bars; bar ++ ) {

				const b0 = bar * 4;
				drums( e, bar, { kick: [ 0, 2 ], snare: [ 1, 3 ], hats: 8 } );
				for ( let k = 0; k < 8; k ++ ) e( b0 + k / 2, 'bass', m( roots[ bar % 4 ] ) + ( k % 4 === 3 ? 12 : 0 ), - 0.4, 0.9, 'synth' );
				e( b0 + 1.5, 'keys', ch( roots[ bar % 4 ], 12, 19, 24 ), - 0.3, 1, 'brass' );
				e( b0 + 3.5, 'keys', ch( roots[ bar % 4 ], 12, 19, 24 ), - 0.3, 0.8, 'brass' );

			}

		},
	},

	// Werth (hard rock): a palm-muted E riff with a bluesy turn, open chords, crashes
	werth: {
		bpm: 132,
		write( e, bars ) {

			for ( let bar = 0; bar < bars; bar ++ ) {

				const b0 = bar * 4;
				drums( e, bar, { kick: [ 0, 1.5, 2 ], snare: [ 1, 3 ], hats: 8, open: [ 7 ] } );
				if ( bar % 4 === 0 ) e( b0, 'crash', 0.8 );
				for ( let k = 0; k < 6; k ++ ) e( b0 + k / 2, 'gtr', [ m( 'E2' ), m( 'B2' ) ], - 0.4, 0.9, true );
				const turn = bar % 2 ? [ 'G2', 'A2' ] : [ 'D3', 'E3' ];
				e( b0 + 3, 'gtr', [ m( turn[ 0 ] ), m( turn[ 0 ] ) + 7 ], - 0.45, 1 );
				e( b0 + 3.5, 'gtr', [ m( turn[ 1 ] ), m( turn[ 1 ] ) + 7 ], - 0.45, 1 );
				e( b0, 'bass', m( 'E2' ), - 2.5, 1 );
				e( b0 + 3, 'bass', m( turn[ 0 ] ), - 0.45, 1 );
				e( b0 + 3.5, 'bass', m( turn[ 1 ] ), - 0.45, 1 );

			}

		},
	},

	// Victorino (roots reggae): the one drop, the skank on the offbeats, a melodic bass
	victorino: {
		bpm: 76,
		write( e, bars ) {

			const prog = [ ch( 'A3', ...MAJ ), ch( 'D3', ...MAJ ), ch( 'A3', ...MAJ ), ch( 'E3', ...MAJ ) ];
			const bassline = [ [ 'A2', 'C#3', 'E3', 'C#3' ], [ 'D2', 'F#2', 'A2', 'F#2' ], [ 'A2', 'C#3', 'E3', 'A2' ], [ 'E2', 'G#2', 'B2', 'E2' ] ];
			for ( let bar = 0; bar < bars; bar ++ ) {

				const b0 = bar * 4;
				e( b0 + 2, 'kick', 1 );
				e( b0 + 2, 'rim', 1 );
				for ( let h = 0; h < 8; h ++ ) e( b0 + h / 2, 'hat', h % 2 ? 0.5 : 0.7, h === 7 );
				for ( const k of [ 0.5, 1.5, 2.5, 3.5 ] ) e( b0 + k, 'keys', prog[ bar % 4 ].map( ( x ) => x + 12 ), - 0.25, 1, 'skank' );
				bassline[ bar % 4 ].forEach( ( n, k ) => e( b0 + [ 0, 1.5, 2, 3 ][ k ], 'bass', m( n ), - 0.8, 1 ) );

			}

		},
	},

	// Howard (hard hip-hop): a slow boom-bap, an 808 sliding under it, a dark minor figure on the keys
	howard: {
		bpm: 86,
		write( e, bars ) {

			const fig = [ 'C4', 'Eb4', 'G4', 'Ab4', 'G4', 'Eb4', 'D4', 'Eb4' ];
			for ( let bar = 0; bar < bars; bar ++ ) {

				const b0 = bar * 4;
				drums( e, bar, { kick: [ 0, 0.75, 2.25 ], snare: [ 1, 3 ], hats: 8 } );
				fig.forEach( ( n, k ) => e( b0 + k / 2, 'keys', [ m( n ) ], - 0.4, 0.8, 'montuno' ) );
				e( b0, 'bass', m( bar % 2 ? 'Ab1' : 'C2' ), - 1.8, 1, '808' );
				e( b0 + 2.25, 'bass', m( bar % 2 ? 'G1' : 'C2' ), - 1.5, 1, '808' );

			}

		},
	},

	// Hamels (fast hard rock, a picked guitar riff building): tom rolls in, then everything
	hamels: {
		bpm: 136,
		write( e, bars ) {

			const run = [ 'E3', 'G3', 'A3', 'B3', 'D4', 'B3', 'A3', 'G3' ];
			for ( let bar = 0; bar < bars; bar ++ ) {

				const b0 = bar * 4;
				for ( let k = 0; k < 16; k ++ ) e( b0 + k / 4, 'gtr', [ m( run[ ( k + bar * 3 ) % 8 ] ) ], - 0.22, 0.6, true );
				if ( bar === 0 ) for ( let k = 0; k < 8; k ++ ) e( b0 + k / 2, 'tom', 110 + k * 12, 0.6 + k * 0.05 );
				else {

					drums( e, bar, { kick: [ 0, 1, 2, 3 ], snare: [ 1, 3 ], hats: 8 } );
					if ( bar === 1 ) e( b0, 'crash', 1 );
					e( b0, 'gtr', [ m( 'E2' ), m( 'B2' ), m( 'E3' ) ], - 1.8, 0.8 );
					e( b0 + 2, 'gtr', [ m( 'D2' ), m( 'A2' ), m( 'D3' ) ], - 1.8, 0.8 );
					e( b0, 'bass', m( 'E2' ), - 1.8, 1 );
					e( b0 + 2, 'bass', m( 'D2' ), - 1.8, 1 );

				}

			}

		},
	},

	// Feliz and Ruiz (Latin): a salsa groove, the clave, congas, a piano montuno, the bass's tumbao
	latin: {
		bpm: 104,
		write( e, bars ) {

			const prog = [ ch( 'A3', ...MIN ), ch( 'D4', ...MIN ), ch( 'E3', 0, 4, 7, 10 ), ch( 'A3', ...MIN ) ];
			for ( let bar = 0; bar < bars; bar ++ ) {

				const b0 = bar * 4;
				// son clave, 3-2
				for ( const k of bar % 2 ? [ 1, 2 ] : [ 0, 1.5, 3 ] ) e( b0 + k, 'clave', 1 );
				for ( const [ k, f ] of [ [ 0.5, 330 ], [ 1.5, 210 ], [ 2, 210 ], [ 3.5, 330 ] ] ) e( b0 + k, 'conga', f, 0.9 );
				e( b0 + 1, 'cowbell', 0.8 );
				e( b0 + 3, 'cowbell', 0.8 );
				const c = prog[ bar % 4 ];
				for ( let k = 0; k < 8; k ++ ) if ( k !== 2 && k !== 6 ) e( b0 + k / 2, 'keys', k % 2 ? c.slice( 1 ) : [ c[ 0 ], c[ 0 ] + 12 ], - 0.3, 0.7, 'montuno' );
				e( b0 + 1.5, 'bass', c[ 0 ] - 12, - 1.5, 1 );
				e( b0 + 3, 'bass', c[ 0 ] - 5, - 1, 1 );
				e( b0, 'kick', 0.6 );

			}

		},
	},

	// the relievers' entrance: Lidge's (heavy, pounding: his was nu-metal) and a lighter rock one for the rest
	lidge: {
		bpm: 100,
		write( e, bars ) {

			for ( let bar = 0; bar < bars; bar ++ ) {

				const b0 = bar * 4;
				if ( bar < 2 ) {

					// the build: the riff alone, then the drums crash in
					for ( const k of [ 0, 0.75, 1.5, 2, 2.75, 3.5 ] ) e( b0 + k, 'gtr', [ m( 'D2' ), m( 'A2' ), m( 'D3' ) ], - 0.35, 1, true );
					if ( bar === 1 ) for ( let k = 0; k < 8; k ++ ) e( b0 + k / 2, 'snare', 0.4 + k * 0.08 );
					continue;

				}

				if ( bar % 4 === 2 ) e( b0, 'crash', 1 );
				drums( e, bar, { kick: [ 0, 0.75, 1.5, 2, 2.75, 3.5 ], snare: [ 1, 3 ], hats: 4, v: 1.1 } );
				for ( const k of [ 0, 0.75, 1.5, 2, 2.75, 3.5 ] ) e( b0 + k, 'gtr', [ m( 'D2' ), m( 'A2' ), m( 'D3' ) ], - 0.35, 1, true );
				const hit = bar % 2 ? 'F2' : 'C2';
				e( b0 + 3, 'gtr', [ m( hit ), m( hit ) + 7, m( hit ) + 12 ], - 0.9, 1 );
				e( b0, 'bass', m( 'D1' ), - 2.8, 1 );
				e( b0 + 3, 'bass', m( hit ) - 12, - 0.9, 1 );

			}

		},
	},

	rock: {
		bpm: 120,
		write( e, bars ) {

			const prog = [ 'G2', 'D2', 'C2', 'D2' ];
			for ( let bar = 0; bar < bars; bar ++ ) {

				const b0 = bar * 4;
				drums( e, bar, { kick: [ 0, 2, 2.5 ], snare: [ 1, 3 ], hats: 8 } );
				if ( bar % 4 === 0 ) e( b0, 'crash', 0.7 );
				const r = prog[ bar % 4 ];
				e( b0, 'gtr', [ m( r ), m( r ) + 7, m( r ) + 12 ], - 1.8, 0.9 );
				e( b0 + 2, 'gtr', [ m( r ), m( r ) + 7, m( r ) + 12 ], - 1.8, 0.9 );
				for ( let k = 0; k < 8; k ++ ) e( b0 + k / 2, 'bass', m( r ), - 0.4, 0.9 );

			}

		},
	},

	// between innings: a party-funk groove (the park's end-of-night kind), the whole place clapping on 2 and 4
	funk: {
		bpm: 116,
		write( e, bars ) {

			const prog = [ ch( 'E3', 0, 4, 7, 10 ), ch( 'A3', 0, 4, 7, 10 ) ];
			const bl = [ 'E2', 'E2', 'G2', 'A2', 'E2', 'D3', 'B2', 'G2' ];
			for ( let bar = 0; bar < bars; bar ++ ) {

				const b0 = bar * 4;
				drums( e, bar, { kick: [ 0, 1.75, 2.5 ], snare: [ 1, 3 ], clap: [ 1, 3 ], hats: 16 } );
				bl.forEach( ( n, k ) => e( b0 + k / 2, 'bass', m( n ) + ( bar % 4 === 3 && k > 5 ? 5 : 0 ), - 0.35, 0.9 ) );
				for ( const k of [ 0.5, 1.25, 2.5, 3.25 ] ) e( b0 + k, 'keys', prog[ Math.floor( bar / 2 ) % 2 ].map( ( x ) => x + 12 ), - 0.2, 0.8, 'skank' );
				if ( bar % 4 === 3 ) e( b0 + 3, 'keys', ch( 'B4', 0, 4, 7 ), - 0.9, 0.9, 'brass' );

			}

		},
	},

	// the end: an arena anthem of the booth's own, big and slow, for the crowd to sing "oh"s to
	anthem: {
		bpm: 72,
		write( e, bars ) {

			const prog = [ [ 'C3', MAJ ], [ 'A2', MIN ], [ 'F2', MAJ ], [ 'G2', MAJ ] ];
			for ( let bar = 0; bar < bars; bar ++ ) {

				const b0 = bar * 4;
				const [ r, q ] = prog[ bar % 4 ];
				drums( e, bar, { kick: [ 0, 2.5 ], snare: [ 1, 3 ], hats: 4 } );
				if ( bar % 4 === 0 ) e( b0, 'crash', 0.8 );
				e( b0, 'keys', ch( r, ...q ).map( ( x ) => x + 12 ), - 3.8, 1, 'pad' );
				e( b0, 'gtr', [ m( r ), m( r ) + 7, m( r ) + 12 ], - 3.8, 0.7 );
				e( b0, 'bass', m( r ), - 1.8, 1 );
				e( b0 + 2, 'bass', m( r ), - 1.8, 1 );
				e( b0 + 2, 'keys', ch( r, ...q ).map( ( x ) => x + 24 ), - 1.8, 0.7, 'brass' );

			}

		},
	},

};

// who walks up to what (Plan.js asks by player's last name; relievers come in to theirs)
export const WALKUP = {
	Utley: 'utley', Rollins: 'rollins', Burrell: 'burrell', Werth: 'werth', Victorino: 'victorino', Howard: 'howard', Hamels: 'hamels',
	Feliz: 'latin', Ruiz: 'latin', Romero: 'latin', Jenkins: 'rock', Madson: 'rock', Lidge: 'lidge',
};
