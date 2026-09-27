// The soundscape's made sounds, as pure functions of a sample rate (and a few numbers) returning
// Float32Arrays: the rooms' impulse responses, the claps, the weather, the footsteps, the horns. They run
// in a worker (synth.worker.js via Synth.js), so the main thread never spends a frame on them; Node's test
// runs them directly. JOBS (at the end) are what the worker is asked for.
import { rng, biquad, normalize, loopable, fadeEnds, bowlImpulse, roomImpulse } from './dsp.js';

// ---------------------------------------------------------------- claps, made from scratch

// single hand claps: a sharp crack of noise with a hollow body (the cupped palms' resonance, each pair of
// hands its own), 60 ms
export function makeClaps( sr, n ) {

	const out = [];
	for ( let k = 0; k < n; k ++ ) {

		const r = rng( 900 + k * 7 ), len = Math.floor( 0.04 * sr ), x = new Float32Array( len );
		const decay = 0.006 + 0.008 * ( r() * 0.5 + 0.5 );
		for ( let i = 0; i < len; i ++ ) {

			const t = i / sr;
			x[ i ] = r() * Math.exp( - t / decay ) * Math.min( 1, t / 0.0006 );

		}

		biquad( x, sr, 'bp', 900 + 1400 * ( r() * 0.5 + 0.5 ), 1.6 + r() );
		biquad( x, sr, 'hp', 350, 0.7 );
		out.push( normalize( x, 0.9 ) );

	}

	return out;

}

// many hands clapping together at a tempo (claps per second): each clapper a little off, the far ones
// arriving later (the bowl smears it)
export function clapRhythm( sr, grains, rate ) {

	const period = 1 / rate, bars = 8, len = Math.floor( period * bars * sr ), x = new Float32Array( len );
	const r = rng( 77 );
	for ( let c = 0; c < 150; c ++ ) {

		const g = grains[ c % grains.length ], far = Math.pow( r() * 0.5 + 0.5, 2 ) * 0.16, amp = 0.2 + 0.8 * ( 1 - far * 5 ) * ( r() * 0.3 + 0.7 );
		for ( let k = 0; k < bars; k ++ ) {

			if ( r() < - 0.8 ) continue; // a clap missed
			const at = Math.floor( ( ( k * period + far + r() * 0.022 ) % ( period * bars ) ) * sr );
			for ( let i = 0; i < g.length; i ++ ) x[ ( at + i ) % len ] += g[ i ] * amp;

		}

	}

	return normalize( x, 0.7 );

}

// applause: everyone at their own pace
export function applauseLoop( sr, grains, seconds ) {

	const len = Math.floor( seconds * sr ), x = new Float32Array( len ), r = rng( 55 );
	for ( let c = 0; c < 170; c ++ ) {

		const g = grains[ c % grains.length ], per = 0.18 + 0.12 * ( r() * 0.5 + 0.5 ), amp = 0.3 + 0.7 * ( r() * 0.5 + 0.5 );
		let t = ( r() * 0.5 + 0.5 ) * per;
		while ( t < seconds ) {

			const at = Math.floor( t * sr );
			for ( let i = 0; i < g.length; i ++ ) x[ ( at + i ) % len ] += g[ i ] * amp;
			t += per * ( 0.92 + 0.16 * ( r() * 0.5 + 0.5 ) );

		}

	}

	return normalize( x, 0.7 );

}

// the answer to the organ: clap clap, clap clap clap (a section of a few hundred, 1.2 s)
export function clapPattern( sr, grains ) {

	const hits = [ 0, 0.2, 0.5, 0.7, 0.9 ];
	const len = Math.floor( 1.3 * sr ), x = new Float32Array( len ), r = rng( 31 );
	for ( let c = 0; c < 160; c ++ ) {

		const g = grains[ c % grains.length ], far = Math.pow( r() * 0.5 + 0.5, 2 ) * 0.09, amp = 0.3 + 0.7 * ( r() * 0.5 + 0.5 );
		for ( const h of hits ) {

			const at = Math.floor( ( h + far + r() * 0.02 + 0.03 ) * sr );
			for ( let i = 0; i < g.length && at + i < len; i ++ ) x[ at + i ] += g[ i ] * amp;

		}

	}

	return normalize( x, 0.75 );

}

// a two-finger whistle: a pure high tone sliding up into it, a little warble, the breath under it
export function whistle( sr ) {

	const dur = 0.9, len = Math.floor( dur * sr ), x = new Float32Array( len ), r = rng( 5 );
	let ph = 0;
	for ( let i = 0; i < len; i ++ ) {

		const t = i / sr;
		const f = 2600 + 700 * Math.min( 1, t / 0.12 ) - 250 * Math.max( 0, ( t - 0.6 ) / 0.3 ) + 30 * Math.sin( 2 * Math.PI * 7 * t );
		ph += f / sr;
		const env = Math.min( 1, t / 0.04 ) * Math.min( 1, ( dur - t ) / 0.12 );
		x[ i ] = ( Math.sin( 2 * Math.PI * ph ) * 0.8 + r() * 0.08 ) * env;

	}

	return x;

}

// ---------------------------------------------------------------- made from noise

// many small impacts through a resonance: `rate` drops a second, each `len` s of noise shaped by `decay`
export function drops( sr, seconds, rate, seed, { len = 0.004, decay = 0.0015, amp = [ 0.3, 1 ] } = {} ) {

	const n = Math.floor( seconds * sr ), x = new Float32Array( n ), r = rng( seed );
	const count = Math.floor( rate * seconds ), L = Math.floor( len * sr );
	for ( let k = 0; k < count; k ++ ) {

		const at = Math.floor( ( r() * 0.5 + 0.5 ) * n ), a = amp[ 0 ] + ( amp[ 1 ] - amp[ 0 ] ) * Math.pow( r() * 0.5 + 0.5, 3 );
		for ( let i = 0; i < L; i ++ ) x[ ( at + i ) % n ] += r() * a * Math.exp( - i / sr / decay );

	}

	return x;

}

// rain on a steel roof deck: a dense drumming, the deck's hollow ring under it
export function roofDrum( sr ) {

	const x = drops( sr, 6.25, 2600, 11, { len: 0.007, decay: 0.0022 } );
	const ring = Float32Array.from( x );
	biquad( ring, sr, 'bp', 240, 3 );
	const mid = Float32Array.from( x );
	biquad( mid, sr, 'bp', 700, 1.5 );
	biquad( x, sr, 'lp', 2800, 0.7 );
	for ( let i = 0; i < x.length; i ++ ) x[ i ] = x[ i ] * 0.6 + ring[ i ] * 2.2 + mid[ i ] * 0.9;
	return normalize( loopable( x, sr, 0.25 ), 0.8 );

}

// drops on the plastic ponchos round you: crisp little ticks, a few fat ones
export function ponchoPatter( sr ) {

	const x = drops( sr, 4.25, 700, 21, { len: 0.003, decay: 0.0006 } );
	biquad( x, sr, 'bp', 4200, 0.9 );
	const fat = drops( sr, 4.25, 60, 22, { len: 0.02, decay: 0.004, amp: [ 0.5, 1 ] } );
	biquad( fat, sr, 'bp', 1300, 2.5 );
	for ( let i = 0; i < x.length; i ++ ) x[ i ] += fat[ i ] * 0.6;
	return normalize( loopable( x, sr, 0.25 ), 0.8 );

}

// water pouring off a roof's edge and down a gutter: a rushing, gurgling splash
export function runoff( sr ) {

	const n = Math.floor( 4.3 * sr ), r = rng( 31 ), x = new Float32Array( n );
	let e = 0;
	for ( let i = 0; i < n; i ++ ) {

		e += ( r() - e ) * 0.0008;
		x[ i ] = r() * ( 0.6 + 2.5 * Math.abs( e ) );

	}

	biquad( x, sr, 'bp', 1800, 0.6 );
	// bubbles: short rising blips
	for ( let k = 0; k < 90; k ++ ) {

		const at = Math.floor( ( r() * 0.5 + 0.5 ) * ( n - sr * 0.05 ) ), f0 = 500 + 700 * ( r() * 0.5 + 0.5 );
		let ph = 0;
		for ( let i = 0; i < sr * 0.04; i ++ ) {

			const t = i / sr;
			ph += ( f0 * ( 1 + t * 12 ) ) / sr;
			x[ at + i ] += Math.sin( 2 * Math.PI * ph ) * Math.exp( - t / 0.01 ) * 0.25;

		}

	}

	return normalize( loopable( x, sr, 0.3 ), 0.8 );

}

// rain on the tarp: the big vinyl sheet taut on the infield, drummed low
export function tarpDrum( sr ) {

	const x = drops( sr, 5.3, 2000, 41, { len: 0.009, decay: 0.003 } );
	const low = Float32Array.from( x );
	biquad( low, sr, 'bp', 140, 2.2 );
	biquad( x, sr, 'lp', 1800, 0.7 );
	for ( let i = 0; i < x.length; i ++ ) x[ i ] = x[ i ] * 0.7 + low[ i ] * 2.5;
	return normalize( loopable( x, sr, 0.3 ), 0.8 );

}

// the crew running the tarp out from the roll: the sheet unrolling, dragging and slapping over the wet
// infield, ~8 s
export function tarpRun( sr ) {

	const n = Math.floor( 8 * sr ), r = rng( 51 ), x = new Float32Array( n );
	let e = 0;
	for ( let i = 0; i < n; i ++ ) {

		const t = i / sr;
		e += ( r() - e ) * 0.004;
		const drag = Math.min( 1, t / 0.6 ) * Math.min( 1, ( 8 - t ) / 1.5 );
		// the flutter as the sheet catches the air
		const flut = 0.6 + 0.4 * Math.sin( 2 * Math.PI * ( 9 + 3 * Math.sin( t * 1.3 ) ) * t );
		x[ i ] = r() * drag * ( 0.4 + Math.abs( e ) * 3 ) * flut;

	}

	biquad( x, sr, 'lp', 2500, 0.7 );
	biquad( x, sr, 'hp', 120, 0.7 );
	// the slaps: the sheet's edge coming down on the water
	for ( let k = 0; k < 14; k ++ ) {

		const at = Math.floor( ( 0.5 + k * 0.5 + 0.2 * r() ) * sr );
		for ( let i = 0; i < sr * 0.08 && at + i < n; i ++ ) x[ at + i ] += r() * Math.exp( - i / sr / 0.015 ) * 1.4;

	}

	return fadeEnds( normalize( x, 0.85 ), sr, 0.05, 0.4 );

}

// a flag in a gusty wind: the cloth snapping and rippling
export function flutter( sr ) {

	const n = Math.floor( 3.2 * sr ), r = rng( 61 ), x = new Float32Array( n );
	let ph = 0;
	for ( let i = 0; i < n; i ++ ) {

		const t = i / sr;
		ph += ( 11 + 4 * Math.sin( t * 2.1 ) ) / sr;
		const snap = Math.pow( 0.5 + 0.5 * Math.sin( 2 * Math.PI * ph ), 6 );
		x[ i ] = r() * ( 0.15 + snap );

	}

	biquad( x, sr, 'bp', 900, 0.5 );
	return normalize( loopable( x, sr, 0.2 ), 0.8 );

}

// a halyard's snap on a hollow aluminium pole: a clack and a thin, inharmonic ring
export function halyard( sr ) {

	const n = Math.floor( 1.2 * sr ), r = rng( 71 ), x = new Float32Array( n );
	const f0 = 1180, modes = [ [ 1, 1 ], [ 2.76, 0.6 ], [ 5.4, 0.35 ], [ 8.93, 0.2 ] ];
	for ( let i = 0; i < n; i ++ ) {

		const t = i / sr;
		let v = 0;
		for ( const [ m, a ] of modes ) v += Math.sin( 2 * Math.PI * f0 * m * t ) * a * Math.exp( - t * ( 3 + m * 1.4 ) );
		x[ i ] = v * 0.5 + ( t < 0.006 ? r() * ( 1 - t / 0.006 ) : 0 );

	}

	return fadeEnds( normalize( x, 0.8 ), sr, 0.0005, 0.1 );

}

// a step on concrete: the heel's knock, the sole's scuff; wet, a splash on top
export function step( sr, k, wet ) {

	const n = Math.floor( 0.28 * sr ), r = rng( 81 + k * 3 + ( wet ? 50 : 0 ) ), x = new Float32Array( n );
	for ( let i = 0; i < n; i ++ ) {

		const t = i / sr;
		const heel = t < 0.03 ? r() * Math.exp( - t / 0.006 ) : 0;
		const toe = t > 0.07 && t < 0.13 ? r() * 0.45 * Math.exp( - ( t - 0.07 ) / 0.012 ) : 0;
		const scuff = r() * 0.08 * Math.exp( - t / 0.06 );
		x[ i ] = heel + toe + scuff;

	}

	biquad( x, sr, 'lp', 3200 + 500 * k, 0.8 );
	biquad( x, sr, 'peak', 180, 1.2, 6 );
	if ( wet ) {

		const s = new Float32Array( n );
		for ( let i = 0; i < n; i ++ ) {

			const t = i / sr;
			s[ i ] = r() * Math.exp( - t / 0.05 ) * Math.min( 1, t / 0.004 ) * ( 0.6 + 0.4 * Math.sin( t * 300 ) );

		}

		biquad( s, sr, 'bp', 3500, 0.8 );
		for ( let i = 0; i < n; i ++ ) x[ i ] += s[ i ] * 0.8;

	}

	return fadeEnds( normalize( x, 0.8 ), sr, 0.001, 0.05 );

}

// a car horn across the lots: two reedy tones a third apart, a honk or two
export function carHorn( sr, k ) {

	const pat = [ [ [ 0, 0.5 ] ], [ [ 0, 0.18 ], [ 0.28, 0.18 ], [ 0.56, 0.7 ] ], [ [ 0, 0.25 ], [ 0.4, 0.25 ] ] ][ k ];
	const f = [ 355, 420, 390 ][ k ], n = Math.floor( 1.5 * sr ), x = new Float32Array( n );
	for ( const [ t0, d ] of pat ) {

		for ( let i = Math.floor( t0 * sr ); i < Math.min( n, ( t0 + d ) * sr ); i ++ ) {

			const t = i / sr - t0;
			const env = Math.min( 1, t / 0.015 ) * Math.min( 1, ( d - t ) / 0.02 );
			// a buzzy tone: the fundamental and its odd harmonics
			let v = 0;
			for ( const [ ff, a ] of [ [ f, 1 ], [ f * 1.26, 0.8 ] ] ) for ( let h = 1; h <= 7; h += 2 ) v += Math.sin( 2 * Math.PI * ff * h * t ) * a / h;
			x[ i ] += v * env;

		}

	}

	biquad( x, sr, 'lp', 2200, 0.7 );
	return fadeEnds( normalize( x, 0.7 ), sr, 0.002, 0.05 );

}

// ---------------------------------------------------------------- the jobs (Synth.make( name, sr ))

// each returns a list of buffers, each a list of channels
const mono = ( x ) => [ x ];
export const JOBS = {
	bowlIR: ( sr ) => [ bowlImpulse( sr ) ],
	roomIR: ( sr ) => [ roomImpulse( sr ) ],
	// the claps' loops and one-shots from the same pairs of hands: the rhythm, the applause, the
	// "da-da, da-da-da", a whistle, eight single claps
	claps: ( sr ) => {

		const g = makeClaps( sr, 24 );
		return [ mono( clapRhythm( sr, g, 2.1 ) ), mono( applauseLoop( sr, g, 4 ) ), mono( clapPattern( sr, g ) ), mono( whistle( sr ) ), ...g.slice( 0, 8 ).map( mono ) ];

	},
	roofDrum: ( sr ) => [ mono( roofDrum( sr ) ) ],
	ponchoPatter: ( sr ) => [ mono( ponchoPatter( sr ) ) ],
	runoff: ( sr ) => [ mono( runoff( sr ) ) ],
	tarp: ( sr ) => [ mono( tarpRun( sr ) ), mono( tarpDrum( sr ) ) ],
	flags: ( sr ) => [ mono( flutter( sr ) ), mono( halyard( sr ) ) ],
	steps: ( sr ) => [ false, true ].flatMap( ( wet ) => [ 0, 1, 2, 3 ].map( ( k ) => mono( step( sr, k, wet ) ) ) ),
	horns: ( sr ) => [ 0, 1, 2 ].map( ( k ) => mono( carHorn( sr, k ) ) ),
};
