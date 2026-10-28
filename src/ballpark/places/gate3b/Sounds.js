import { beep, ratchet, canopyRain, murmur } from '../concourse1b/Sounds.js';
import { pattisonZ } from './Street.js';

// FW2 (C2W-15, gauntlet r2): what the Third Base Gate's plaza sounds like. The walk starts here, and it
// was silent: the mounted police, the program sellers, FOX 29 live, the eight lanes scanning and the
// traffic on Pattison all drew and none made a sound (the First Base Gate had all of it). Through the
// park's sound (GameSound.sample / spot: heard from where it is, panned, quieter with distance):
//   made here: hooves on the asphalt as the horses shift and walk, a snort now and then; the live truck's
//     generator; tyres hissing on the wet road on the 27th (dry and quieter on the 29th)
//   the 1B gate's (concourse1b/Sounds.js): the scanner's beep and the turnstile's ratchet at each lane as a
//     ticket's scanned, the rain on the gate's canopy, the murmur of the lines; a program seller's call
//     (the 1B's Piper voice, tools/audio/concourse1b-calls.py) from the carts, security moving the lines
//     along in the rush
// One-shots only near the camera.
const DIR = 'audio/places/concourse1b/';
const NEAR = 45;

function rand( seed ) {

	let a = seed >>> 0;
	return () => {

		a = ( a + 0x6D2B79F5 ) >>> 0;
		let t = a;
		t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
		t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296 * 2 - 1;

	};

}

function lowpass( x, sr, f ) {

	const k = 1 - Math.exp( - 2 * Math.PI * f / sr ), y = new Float32Array( x.length );
	let v = 0;
	for ( let i = 0; i < x.length; i ++ ) {

		v += ( x[ i ] - v ) * k;
		y[ i ] = v;

	}

	return y;

}

function buffer( ctx, seconds, fill ) {

	const sr = ctx.sampleRate, n = Math.floor( seconds * sr );
	const b = ctx.createBuffer( 1, n, sr );
	const d = b.getChannelData( 0 );
	fill( d, sr, n );
	const f = Math.min( 256, n >> 3 );
	for ( let i = 0; i < f; i ++ ) {

		d[ i ] *= i / f;
		d[ n - 1 - i ] *= i / f;

	}

	let p = 0;
	for ( let i = 0; i < n; i ++ ) p = Math.max( p, Math.abs( d[ i ] ) );
	if ( p > 0 ) for ( let i = 0; i < n; i ++ ) d[ i ] *= 0.8 / p;
	return b;

}

// a horse walking on asphalt: four hollow knocks a stride (the shoe's ring over a thud), uneven
const hooves = ( ctx ) => buffer( ctx, 2.4, ( d, sr, n ) => {

	const r = rand( 61 );
	const at = [ 0.0, 0.27, 0.6, 0.86, 1.2, 1.47, 1.8, 2.06 ];
	for ( const t0 of at ) {

		const i0 = Math.floor( ( t0 + 0.02 * r() ) * sr ), a = 0.7 + 0.3 * Math.abs( r() ), f = 900 + 250 * r();
		for ( let j = 0; j < 0.12 * sr && i0 + j < n; j ++ ) {

			const t = j / sr;
			d[ i0 + j ] += a * ( Math.sin( 2 * Math.PI * f * t ) * Math.exp( - t * 60 ) * 0.6 + Math.sin( 2 * Math.PI * 180 * t ) * Math.exp( - t * 35 ) + r() * 0.5 * Math.exp( - t * 120 ) );

		}

	}

} );

// a snort: a burst of breath through the nose, falling
const snort = ( ctx ) => buffer( ctx, 0.7, ( d, sr, n ) => {

	const r = rand( 67 ), x = new Float32Array( n );
	for ( let i = 0; i < n; i ++ ) x[ i ] = r();
	const y = lowpass( x, sr, 900 );
	for ( let i = 0; i < n; i ++ ) {

		const t = i / sr;
		d[ i ] = y[ i ] * ( t < 0.05 ? t / 0.05 : Math.exp( - ( t - 0.05 ) * 5 ) ) * ( 1 + 0.6 * Math.sin( 2 * Math.PI * 28 * t ) );

	}

} );

// a portable generator: the engine's low thrum and its harmonics, a little uneven
const generator = ( ctx ) => buffer( ctx, 3, ( d, sr, n ) => {

	const r = rand( 71 );
	const noise = new Float32Array( n );
	for ( let i = 0; i < n; i ++ ) noise[ i ] = r();
	const rough = lowpass( noise, sr, 300 );
	for ( let i = 0; i < n; i ++ ) {

		const t = i / sr, w = 2 * Math.PI * 60 * t * ( 1 + 0.004 * Math.sin( 2 * Math.PI * 0.7 * t ) );
		d[ i ] = Math.sin( w ) * 0.5 + Math.sin( w * 2 ) * 0.35 + Math.sin( w * 3 ) * 0.2 + Math.sin( w * 0.5 ) * 0.25 + rough[ i ] * 0.6;

	}

} );

// the traffic going by on Pattison: the swell of each car's tyres and engine, the hiss of them on the wet
const road = ( ctx ) => buffer( ctx, 8, ( d, sr, n ) => {

	const r = rand( 79 ), noise = new Float32Array( n );
	for ( let i = 0; i < n; i ++ ) noise[ i ] = r();
	const hiss = lowpass( noise, sr, 2500 ), rumble = lowpass( noise, sr, 140 );
	const cars = [ 0.6, 2.1, 3.0, 4.6, 6.2, 7.1 ];
	for ( let i = 0; i < n; i ++ ) {

		const t = i / sr;
		let env = 0.15;
		for ( const c of cars ) env += Math.exp( - ( ( ( t - c ) / 0.55 ) ** 2 ) );
		d[ i ] = hiss[ i ] * env * 0.8 + rumble[ i ] * env * 1.4;

	}

} );

export class Sounds3B {

	constructor( place ) {

		this.place = place;
		this.ready = false;
		this.timers = {};
		this.later = [];
		this.time = 0;

	}

	_init( sound ) {

		this.sound = sound;
		for ( const k of [ 'gus-1', 'gus-2', 'guard-1' ] ) sound.sample( 'g3b-' + k, DIR + k + '.mp3' );
		sound.sample( 'g3b-beep', beep );
		sound.sample( 'g3b-ratchet', ratchet );
		sound.sample( 'g3b-canopy-rain', canopyRain );
		sound.sample( 'g3b-murmur', murmur );
		sound.sample( 'g3b-hooves', hooves );
		sound.sample( 'g3b-snort', snort );
		sound.sample( 'g3b-generator', generator );
		sound.sample( 'g3b-road', road );
		const pl = this.place, g = pl.gate?.edge;
		// the gate's canopy in the rain and the lines at it
		if ( g ) {

			const P = ( s, o ) => [ g.a[ 0 ] + g.ux * ( g.t + s ) + g.nx * o, g.a[ 1 ] + g.uz * ( g.t + s ) + g.nz * o ];
			const c = P( 0, 2.5 ), m = P( 0, 4 );
			this.rain = sound.spot( 'g3b-canopy-rain', this._world( c[ 0 ], 6.2, c[ 1 ] ), { loop: true, vol: 0, ref: 10, max: 70 } );
			this.murmur = sound.spot( 'g3b-murmur', this._world( m[ 0 ], 1.6, m[ 1 ] ), { loop: true, vol: 0, ref: 8, max: 60 } );

		}

		// FOX 29's live truck at the curb, its generator running (gate3b/TV.js puts it there)
		this.gen = sound.spot( 'g3b-generator', this._world( - 76, 1.0, pattisonZ( - 76 ) - 9 + 1.3 ), { loop: true, vol: 0.22, ref: 3, max: 40 } );
		// Pattison's traffic, along the curb in front of the plaza
		this.road = sound.spot( 'g3b-road', this._world( - 100, 0.5, pattisonZ( - 100 ) ), { loop: true, vol: 0, ref: 12, max: 120 } );
		this.ready = true;

	}

	_world( x, y, z ) {

		const F = this.place.field, w = F.toWorld( x, z );
		return { x: w.x, y: F.y0 + 7.01 + y, z: w.z };

	}

	play( name, x, y, z, vol = 0.6, ref = 4 ) {

		const c = this.cam;
		if ( ! c || Math.hypot( x - c[ 0 ], z - c[ 1 ] ) > NEAR ) return;
		this.sound.spot( name, this._world( x, y, z ), { vol, ref, max: NEAR + 10 } );

	}

	_every( key, secs ) {

		const t = this.timers[ key ] ?? ( this.timers[ key ] = this.time + secs * Math.random() );
		if ( this.time < t ) return false;
		this.timers[ key ] = this.time + secs * ( 0.7 + 0.6 * Math.random() );
		return true;

	}

	// dt, the night (gate3b/Night.js), the camera in the field frame [ x, z ]
	update( dt, w, camF ) {

		const sound = this.place.app?.sound;
		if ( ! sound ) return;
		if ( ! this.ready ) this._init( sound );
		this.time += dt;
		this.cam = camF;
		const pl = this.place, A = pl.arrivals;
		this.later = this.later.filter( ( [ t, f ] ) => {

			if ( this.time < t ) return true;
			f();
			return false;

		} );
		// the rain on the canopy on the 27th, harder as it went; the lines' murmur with the rush
		this.rain?.set( { vol: w.first ? 0.15 + 0.5 * w.rain : 0 } );
		const queued = A ? A.lanes.reduce( ( n, L ) => n + L.queue.length, 0 ) : 0;
		this.murmur?.set( { vol: Math.min( 0.5, queued * 0.012 ) } );
		this.road?.set( { vol: w.celebrate ? 0.05 : w.first ? 0.25 + 0.3 * w.rain : 0.2 } );
		// a ticket scanned at a lane: the beep, then the turnstile as they push through
		for ( const L of A?.lanes || [] ) {

			if ( L.scanning && ! L._fw2 ) {

				const [ x, z ] = L.mouth;
				this.later.push( [ this.time + L.scanning * 0.6, () => this.play( 'g3b-beep', x, 1.2, z, 0.35, 3 ) ] );
				const tp = L.tripod?.at;
				this.later.push( [ this.time + L.scanning * 0.6 + 0.7, () => this.play( 'g3b-ratchet', tp ? tp[ 0 ] : x, 0.9, tp ? tp[ 2 ] : z, 0.45, 3 ) ] );

			}

			L._fw2 = !! L.scanning;

		}

		// the horses: hooves as they shift and walk, a snort now and then
		for ( const h of pl.horses?.list || [] ) {

			if ( this._every( 'hoof' + h.phase, h.walk > 0.1 ? 2.2 : 9 ) ) this.play( 'g3b-hooves', h.x, 0.1, h.z, h.walk > 0.1 ? 0.5 : 0.25, 4 );
			if ( this._every( 'snort' + h.phase, 26 ) ) this.play( 'g3b-snort', h.x - Math.sin( h.yaw ) * 1.6, 1.7, h.z - Math.cos( h.yaw ) * 1.6, 0.4, 3 );

		}

		// the program sellers at the carts, and security moving the lines along in the rush
		const carts = pl.vendors?.carts || [];
		if ( carts.length && ! w.celebrate && this._every( 'programs', 20 ) ) {

			const [ x, z ] = carts[ Math.floor( Math.random() * carts.length ) ];
			this.play( Math.random() < 0.6 ? 'g3b-gus-1' : 'g3b-gus-2', x, 1.6, z, 0.65 );

		}

		if ( queued > 20 && this._every( 'guard', 40 ) ) {

			const g = pl.gateGuards?.[ 0 ] || pl.app?.exterior?.gateGuards?.[ 0 ];
			if ( g ) this.play( 'g3b-guard-1', g.at[ 0 ], 1.6, g.at[ 2 ], 0.55 );

		}

	}

}
