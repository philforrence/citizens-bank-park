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

// a firework far off over the rowhouses: the thump (the air it moves), its echo off the buildings, and the
// crackle after it
export function boom( sr, k ) {

	const n = Math.floor( 3.2 * sr ), r = rng( 91 + k ), x = new Float32Array( n );
	let ph = 0;
	for ( let i = 0; i < n; i ++ ) {

		const t = i / sr;
		ph += ( 38 + 50 * Math.exp( - t * 12 ) ) / sr;
		const thump = Math.sin( 2 * Math.PI * ph ) * Math.exp( - t * 5 ) * Math.min( 1, t / 0.006 );
		const echo = t > 0.35 ? Math.sin( 2 * Math.PI * 45 * ( t - 0.35 ) ) * 0.35 * Math.exp( - ( t - 0.35 ) * 4 ) : 0;
		const rumble = r() * 0.25 * Math.exp( - t * 2.2 );
		x[ i ] = thump + echo + rumble;

	}

	biquad( x, sr, 'lp', 420, 0.7 );
	// the crackle: a scatter of little pops a moment later
	const c = new Float32Array( n );
	for ( let j = 0; j < 70 + k * 20; j ++ ) {

		const at = Math.floor( ( 0.7 + 1.6 * ( r() * 0.5 + 0.5 ) ) * sr ), a = 0.2 + 0.4 * ( r() * 0.5 + 0.5 );
		for ( let i = 0; i < 120 && at + i < n; i ++ ) c[ at + i ] += r() * a * Math.exp( - i / 25 );

	}

	biquad( c, sr, 'bp', 2200, 0.8 );
	for ( let i = 0; i < n; i ++ ) x[ i ] += c[ i ] * ( k === 1 ? 0.6 : 0.25 );
	return fadeEnds( normalize( x, 0.85 ), sr, 0.001, 0.3 );

}

// a concourse full of people stamping their feet in time on the concrete, a couple of times a second,
// each a little off, the far ones later (the 29th, before the resumption: "stamping their feet")
export function stomps( sr ) {

	const period = 0.46, beats = 8, len = Math.floor( period * beats * sr ), x = new Float32Array( len ), r = rng( 121 );
	const L = Math.floor( 0.09 * sr );
	for ( let c = 0; c < 90; c ++ ) {

		const far = Math.pow( r() * 0.5 + 0.5, 2 ) * 0.1, a = 0.3 + 0.7 * ( r() * 0.5 + 0.5 ), f = 55 + 40 * ( r() * 0.5 + 0.5 );
		for ( let k = 0; k < beats; k ++ ) {

			const at = Math.floor( ( k * period + far + r() * 0.025 ) * sr );
			for ( let i = 0; i < L; i ++ ) {

				const t = i / sr;
				x[ ( at + i ) % len ] += ( Math.sin( 2 * Math.PI * f * t ) * 0.8 + r() * 0.35 * Math.exp( - t / 0.01 ) ) * a * Math.exp( - t / 0.03 );

			}

		}

	}

	biquad( x, sr, 'lp', 1500, 0.7 );
	return normalize( x, 0.7 );

}

// thousands of rally towels waving (a soft whoosh, each towel twice a second or so, all out of step), or,
// in the rain, ponchos rustling as people get up (a crackle of plastic) (loops)
export function towels( sr, plastic ) {

	const n = Math.floor( 4.25 * sr ), r = rng( plastic ? 223 : 221 ), x = new Float32Array( n );
	for ( let c = 0; c < 60; c ++ ) {

		const f = 1.6 + 1.2 * ( r() * 0.5 + 0.5 ), ph = r() * 6, a = 0.3 + 0.7 * ( r() * 0.5 + 0.5 );
		for ( let i = 0; i < n; i += 4 ) {

			const t = i / sr, s = Math.pow( Math.max( 0, Math.sin( 2 * Math.PI * f * t + ph ) ), 3 ) * a;
			for ( let j = 0; j < 4 && i + j < n; j ++ ) x[ i + j ] += r() * s;

		}

	}

	biquad( x, sr, 'bp', plastic ? 3500 : 900, plastic ? 1.2 : 0.5 );
	if ( plastic ) for ( let i = 0; i < n; i ++ ) if ( r() > 0.9993 ) x[ i ] += r() * 8;
	return normalize( loopable( x, sr, 0.25 ), 0.75 );

}

// ---------------------------------------------------------------- the grounds crew (the tarp, the 29th's work)

// the tarp's roll going over the wet grass: the ribbed core's low rumble (its ribs thumping a few times a
// second), the heavy vinyl dragging and hissing on the water under it (a loop)
export function tarpRoll( sr ) {

	const n = Math.floor( 4.2 * sr ), r = rng( 131 ), x = new Float32Array( n );
	let lp = 0, ph = 0;
	for ( let i = 0; i < n; i ++ ) {

		const t = i / sr;
		lp += ( r() - lp ) * 0.02;
		ph += 3.3 / sr;
		const ribs = Math.pow( 0.5 + 0.5 * Math.sin( 2 * Math.PI * ph ), 8 );
		x[ i ] = lp * ( 2.2 + 3 * ribs ) + r() * 0.25 * ( 0.6 + 0.4 * Math.sin( t * 7.1 ) );

	}

	const hiss = Float32Array.from( x );
	biquad( x, sr, 'lp', 260, 0.8 );
	biquad( hiss, sr, 'bp', 2400, 0.5 );
	for ( let i = 0; i < n; i ++ ) x[ i ] = x[ i ] * 1.6 + hiss[ i ] * 0.5;
	return normalize( loopable( x, sr, 0.3 ), 0.8 );

}

// the edge of the tarp slapping down on the water, or cracking in the wind
export function vinylSlap( sr, k ) {

	const n = Math.floor( 0.5 * sr ), r = rng( 141 + k ), x = new Float32Array( n );
	for ( let i = 0; i < n; i ++ ) {

		const t = i / sr;
		x[ i ] = r() * Math.exp( - t / ( 0.02 + 0.02 * k ) ) + r() * 0.15 * Math.exp( - t / 0.15 );

	}

	biquad( x, sr, 'lp', 3000 - 700 * k, 0.7 );
	biquad( x, sr, 'peak', 300, 1, 6 );
	return fadeEnds( normalize( x, 0.85 ), sr, 0.001, 0.08 );

}

// a rake's tines scraping wet clay, stroke after stroke (a loop)
export function rake( sr ) {

	const n = Math.floor( 3.3 * sr ), r = rng( 151 ), x = new Float32Array( n );
	for ( let i = 0; i < n; i ++ ) {

		const t = i / sr, ph = ( t * 0.9 ) % 1;
		const stroke = ph < 0.55 ? Math.sin( Math.PI * ph / 0.55 ) : 0;
		x[ i ] = r() * stroke * ( 0.7 + 0.3 * Math.sin( t * 90 ) );

	}

	biquad( x, sr, 'bp', 1800, 0.9 );
	return normalize( loopable( x, sr, 0.2 ), 0.75 );

}

// a hose on the clay: the spray's hiss and the patter where it lands (a loop)
export function hose( sr ) {

	const n = Math.floor( 3.2 * sr ), r = rng( 161 ), x = new Float32Array( n );
	for ( let i = 0; i < n; i ++ ) x[ i ] = r() * ( 0.85 + 0.15 * Math.sin( i / sr * 5 ) );
	biquad( x, sr, 'hp', 1500, 0.7 );
	biquad( x, sr, 'lp', 7000, 0.7 );
	return normalize( loopable( x, sr, 0.2 ), 0.7 );

}

// a steel drag mat pulled over the clay: a gritty, scraping rasp (a loop)
export function dragMat( sr ) {

	const n = Math.floor( 3.4 * sr ), r = rng( 171 ), x = new Float32Array( n );
	let e = 0;
	for ( let i = 0; i < n; i ++ ) {

		e += ( Math.abs( r() ) - e ) * 0.002;
		x[ i ] = r() * ( 0.4 + 1.5 * e ) + ( r() > 0.995 ? r() * 2 : 0 );

	}

	biquad( x, sr, 'bp', 900, 0.6 );
	return normalize( loopable( x, sr, 0.2 ), 0.75 );

}

// the tamper's flat steel foot on the mound's clay: a dull thud
export function tamper( sr ) {

	const n = Math.floor( 0.35 * sr ), r = rng( 181 ), x = new Float32Array( n );
	for ( let i = 0; i < n; i ++ ) {

		const t = i / sr;
		x[ i ] = Math.sin( 2 * Math.PI * ( 90 - 40 * t ) * t ) * Math.exp( - t / 0.05 ) + r() * 0.3 * Math.exp( - t / 0.012 );

	}

	biquad( x, sr, 'lp', 900, 0.7 );
	return fadeEnds( normalize( x, 0.85 ), sr, 0.0005, 0.05 );

}

// ---------------------------------------------------------------- the last out's machines (R's rituals, via sfx())

// a big V-twin police motorcycle idling: the lopsided potato-potato and its exhaust (a loop)
export function harley( sr ) {

	const n = Math.floor( 2.4 * sr ), r = rng( 191 ), x = new Float32Array( n );
	// fires: two close together, a gap (the 45-degree twin), about 14 cycles a second at idle
	const cyc = 1 / 7.5;
	for ( let t = 0; t < 2.4; t += cyc ) for ( const off of [ 0, 0.032 ] ) {

		const at = Math.floor( ( t + off + 0.004 * r() ) * sr );
		for ( let i = 0; i < sr * 0.06 && at + i < n; i ++ ) {

			const tt = i / sr;
			x[ at + i ] += ( Math.sin( 2 * Math.PI * 55 * tt ) * 0.9 + r() * 0.4 ) * Math.exp( - tt / 0.018 );

		}

	}

	biquad( x, sr, 'lp', 700, 0.9 );
	return normalize( loopable( x, sr, 0.15 ), 0.8 );

}

// a police motor's siren "whoop": a quick rising sweep and back
export function sirenChirp( sr ) {

	const n = Math.floor( 0.9 * sr ), x = new Float32Array( n );
	let ph = 0;
	for ( let i = 0; i < n; i ++ ) {

		const t = i / sr, u = t / 0.9;
		const f = 650 + 900 * Math.sin( Math.PI * Math.min( 1, u * 1.3 ) );
		ph += f / sr;
		const sq = Math.sin( 2 * Math.PI * ph ) + 0.4 * Math.sin( 6 * Math.PI * ph ) + 0.2 * Math.sin( 10 * Math.PI * ph );
		x[ i ] = sq * Math.min( 1, t / 0.02 ) * Math.min( 1, ( 0.9 - t ) / 0.1 );

	}

	biquad( x, sr, 'bp', 1200, 0.7 );
	return fadeEnds( normalize( x, 0.8 ), sr, 0.002, 0.05 );

}

// photographers round the pile: motor drives firing, several cameras at once (a burst of a second or so)
export function shutters( sr ) {

	const n = Math.floor( 1.6 * sr ), r = rng( 201 ), x = new Float32Array( n );
	for ( let cam = 0; cam < 5; cam ++ ) {

		const rate = 5 + 3 * ( r() * 0.5 + 0.5 ), start = 0.2 * ( r() * 0.5 + 0.5 ), f = 2500 + 1500 * ( r() * 0.5 + 0.5 );
		for ( let t = start; t < 1.4; t += 1 / rate ) {

			const at = Math.floor( t * sr );
			// the shutter's two clicks and the mirror's clack, the motor's whirr between
			for ( const [ dt, a ] of [ [ 0, 1 ], [ 0.012, 0.6 ], [ 0.04, 0.4 ] ] ) {

				const k = at + Math.floor( dt * sr );
				for ( let i = 0; i < sr * 0.006 && k + i < n; i ++ ) x[ k + i ] += r() * a * Math.exp( - i / sr / 0.0015 ) * Math.sin( 2 * Math.PI * f * i / sr + 1 );

			}

			for ( let i = Math.floor( sr * 0.05 ); i < sr * 0.11 && at + i < n; i ++ ) x[ at + i ] += Math.sin( 2 * Math.PI * 1100 * i / sr ) * 0.05;

		}

	}

	biquad( x, sr, 'hp', 800, 0.7 );
	return fadeEnds( normalize( x, 0.8 ), sr, 0.001, 0.05 );

}

// the pile landing: bodies on grass, a heavy thud
export function pileThump( sr ) {

	const n = Math.floor( 0.6 * sr ), r = rng( 211 ), x = new Float32Array( n );
	for ( let i = 0; i < n; i ++ ) {

		const t = i / sr;
		x[ i ] = Math.sin( 2 * Math.PI * ( 70 - 30 * t ) * t ) * Math.exp( - t / 0.09 ) + r() * 0.5 * Math.exp( - t / 0.03 );

	}

	biquad( x, sr, 'lp', 1200, 0.7 );
	return fadeEnds( normalize( x, 0.85 ), sr, 0.001, 0.1 );

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
	tarp: ( sr ) => [ mono( tarpDrum( sr ) ) ],
	flags: ( sr ) => [ mono( flutter( sr ) ), mono( halyard( sr ) ) ],
	steps: ( sr ) => [ false, true ].flatMap( ( wet ) => [ 0, 1, 2, 3 ].map( ( k ) => mono( step( sr, k, wet ) ) ) ),
	horns: ( sr ) => [ 0, 1, 2 ].map( ( k ) => mono( carHorn( sr, k ) ) ),
	booms: ( sr ) => [ 0, 1, 2 ].map( ( k ) => mono( boom( sr, k ) ) ),
	stomps: ( sr ) => [ mono( stomps( sr ) ) ],
	towels: ( sr ) => [ mono( towels( sr, false ) ), mono( towels( sr, true ) ) ],
	crew: ( sr ) => [ mono( tarpRoll( sr ) ), mono( vinylSlap( sr, 0 ) ), mono( vinylSlap( sr, 1 ) ), mono( rake( sr ) ), mono( hose( sr ) ), mono( dragMat( sr ) ), mono( tamper( sr ) ) ],
	sfx: ( sr ) => [ mono( harley( sr ) ), mono( sirenChirp( sr ) ), mono( shutters( sr ) ), mono( pileThump( sr ) ) ],
};
