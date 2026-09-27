import { Vector3 } from '../../../engine/index.js';
import { fencePoint, LEVELS } from '../../layout.js';

// The public address: Dan Baker, the Phillies' PA announcer since 1972, at his mic in the press box.
// Voiced offline (tools/audio/build-pa.py: Piper TTS with a CC0 voice, his cadence drawn on it with a
// WORLD vocoder: the Phillies' names stretched out and lifted, the visitors' said plain), one clip per
// line in public/audio/ballpark/pa/ (index.json lists them), played here out of the park's speakers:
//
//   the clusters hung under the upper roof's front truss (Bowl.js's cabinets), all round the infield: you
//   hear the nearest first, then the ones along the roof, then the far side of the bowl a fifth of a second
//   later (the echo under every "Now batting..." at a ballpark), and the scoreboard's in left;
//   under a concourse's roof, the little ceiling speaker over your head as well, and the bowl's through the
//   open side; outside, all of it dark over the facade.
//
// The taps' delays, levels, tone and pan follow the listener (Space.js, four times a second). The music
// (Music.js) goes out through the same speakers.
//
//   pa.say( key )   -> true if he says it (the clip's in); pa.busy while he's talking
//   pa.input        the speakers' feed (the music's bus too)

const DIR = 'audio/ballpark/pa/';
const C = 343; // m/s
const LEVEL = 1.0;

export class PA {

	constructor( { app, field, bowl, sound, space } ) {

		this.app = app;
		this.field = field;
		this.sound = sound;
		this.space = space;
		this.index = {};
		this.busyUntil = 0;
		this.cur = null;
		this.onSay = null;
		this._clusters( bowl );
		this._build();
		this._load();

	}

	get busy() {

		return this.sound.ctx.currentTime < this.busyUntil;

	}

	// the speaker clusters, in the world: under the main roof's front edge, every ~12 m round it (the
	// cabinets hang every other bay of the truss); the scoreboard's in left field
	_clusters( bowl ) {

		const F = this.field, pts = [];
		const R = bowl?.roofBack;
		if ( R && R.line?.length > 1 ) {

			// in from the roof's back line toward home (the front edge is ~3/4 of the roof's depth in)
			let acc = 0;
			for ( let i = 0; i < R.line.length - 1; i ++ ) {

				const [ ax, az ] = R.line[ i ], [ bx, bz ] = R.line[ i + 1 ];
				const L = Math.hypot( bx - ax, bz - az );
				for ( let s = ( 12 - acc ) % 12; s < L; s += 12 ) {

					const x = ax + ( bx - ax ) * s / L, z = az + ( bz - az ) * s / L, r = Math.hypot( x, z ) || 1;
					pts.push( [ x - x / r * 9, R.y - 3.2, z - z / r * 9 ] );

				}

				acc = ( acc + L ) % 12;

			}

		}

		if ( pts.length < 4 ) {

			// (no roof built: an arc round the infield at the upper deck's front)
			for ( let a = - 130; a <= 130; a += 10 ) {

				const r = a * Math.PI / 180;
				pts.push( [ Math.sin( r ) * 88, LEVELS.roof - 4, Math.cos( r ) * 88 ] );

			}

		}

		const [ sx, sz ] = fencePoint( - 36, 452 );
		this.board = this._world( sx, LEVELS.mainConcourse + 26, sz );
		this.roof = pts.map( ( [ x, y, z ] ) => this._world( x, y, z ) );

	}

	_world( x, y, z ) {

		const w = this.field.toWorld( x, z );
		return new Vector3( w.x, this.field.y0 + y, w.z );

	}

	// the speakers' network: the feed into six taps (the ceiling speaker over you, the three nearest roof
	// clusters, the far side of the roof, the scoreboard), each a delay, a filter, a level and a pan
	_build() {

		const S = this.sound, ctx = S.ctx;
		this.input = ctx.createGain();
		this.out = ctx.createGain();
		this.out.connect( S.master );
		// the bowl answers the PA as it does everything (the space's rooms)
		this.send = ctx.createGain();
		this.send.gain.value = 0.55;
		this.out.connect( this.send ).connect( S.reverb );
		this.taps = [];
		for ( let k = 0; k < 6; k ++ ) {

			const delay = ctx.createDelay( 1.5 ), f = ctx.createBiquadFilter(), g = ctx.createGain(), pan = ctx.createStereoPanner();
			f.type = k === 0 ? 'bandpass' : 'lowpass';
			if ( k === 0 ) {

				// a 6-inch ceiling speaker: no lows, a honky middle
				f.frequency.value = 1700;
				f.Q.value = 0.45;

			} else f.frequency.value = 9000;
			g.gain.value = 0;
			this.input.connect( delay ).connect( f ).connect( g ).connect( pan ).connect( this.out );
			this.taps.push( { delay, f, g, pan } );

		}

		// the music comes out of the same speakers
		S.buses.pa = this.input;
		S.buses.music = this.musicIn = ctx.createGain();
		this.musicIn.connect( this.input );
		this._v = new Vector3();
		this._aim();

	}

	async _load() {

		try {

			const r = await fetch( DIR + 'index.json' );
			if ( ! r.ok ) return;
			this.index = await r.json();
			for ( const [ key, e ] of Object.entries( this.index ) ) this.sound.sample( 'pa-' + key, DIR + e.f );

		} catch ( e ) {

			console.warn( 'PA', e.message );

		}

	}

	// what he's got to say
	has( key ) {

		return !! this.sound.buffers[ 'pa-' + key ];

	}

	say( key, { vol = 1 } = {} ) {

		const S = this.sound, ctx = S.ctx, b = S.buffers[ 'pa-' + key ];
		if ( ! b ) return false;
		const src = ctx.createBufferSource();
		src.buffer = b;
		const g = ctx.createGain();
		g.gain.value = LEVEL * vol;
		src.connect( g ).connect( this.input );
		src.start();
		this.cur = src;
		this.busyUntil = ctx.currentTime + b.duration;
		this.onSay?.( b.duration, key );
		return true;

	}

	stop() {

		try {

			this.cur?.stop();

		} catch {}

		this.cur = null;
		this.busyUntil = 0;

	}

	update( dt, director, camera ) {

		if ( this.space.version !== this._ver ) {

			this._ver = this.space.version;
			this._aim( camera );

		}

	}

	// the taps from where you are: the nearest clusters first, the rest later and darker
	_aim( camera ) {

		const S = this.sound, t = S.ctx.currentTime, sp = this.space, w = sp.w;
		const cam = camera?.position || this._v.set( 0, 10, 60 );
		const e = camera?.matrixWorld?.elements;
		const right = e ? [ e[ 0 ], e[ 2 ] ] : [ 1, 0 ];
		const dist = ( p ) => Math.hypot( p.x - cam.x, p.y - cam.y, p.z - cam.z );
		// the roof's clusters by distance: the nearest, its neighbours either side, and the farthest
		const ds = this.roof.map( ( p, i ) => [ dist( p ), i ] ).sort( ( a, b ) => a[ 0 ] - b[ 0 ] );
		const n0 = ds[ 0 ][ 1 ];
		const along = ( k ) => this.roof[ Math.max( 0, Math.min( this.roof.length - 1, n0 + k ) ) ];
		const far = this.roof[ ds[ ds.length - 1 ][ 1 ] ];
		const srcs = [ null, this.roof[ n0 ], along( - 4 ), along( 4 ), far, this.board ];
		const roofed = w.roof + w.enclosed;
		const dMin = Math.min( ...srcs.slice( 1 ).map( dist ) );
		const set = ( param, v, tc = 0.3 ) => param.setTargetAtTime( v, t, tc );
		srcs.forEach( ( p, k ) => {

			const tap = this.taps[ k ];
			if ( k === 0 ) {

				// the ceiling speaker: a few metres over you, only under a roof
				set( tap.delay.delayTime, 0.004 );
				set( tap.g.gain, 0.7 * Math.min( 1, roofed * 1.4 ) );
				set( tap.pan.pan, 0 );
				return;

			}

			const d = dist( p );
			const dx = p.x - cam.x, dz = p.z - cam.z, L = Math.hypot( dx, dz ) || 1;
			// the ones after the first carry the delay of the extra way they come (the echo); the ceiling
			// speaker, if there is one, leads them all
			set( tap.delay.delayTime, Math.min( 1.4, ( d - dMin ) / C + ( roofed > 0.3 ? 0.02 : 0 ) ) );
			let gain = Math.pow( Math.max( 12, dMin ) / Math.max( 12, d ), 1.1 ) * ( k === 4 ? 0.55 : k === 5 ? 0.5 : 1 );
			// under a roof or outside, the bowl's speakers come in through the open side or over the facade
			gain *= w.bowl + 0.6 * w.roof + 0.25 * w.enclosed + ( 0.28 - 0.18 * w.depth ) * w.outside;
			set( tap.g.gain, gain * ( k === 1 ? 1 : 0.8 ) );
			const air = 16000 * Math.exp( - d / 140 );
			const shut = 1100 * w.enclosed + ( 900 - 400 * w.depth ) * w.outside;
			set( tap.f.frequency, Math.max( 600, w.enclosed + w.outside > 0.5 ? Math.min( air, shut ) : air ) );
			set( tap.pan.pan, Math.max( - 0.8, Math.min( 0.8, ( dx * right[ 0 ] + dz * right[ 1 ] ) / L ) ) );

		} );

	}

}
