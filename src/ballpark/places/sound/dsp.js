// Small DSP helpers for the soundscape's synthesized sounds: seeded noise, one-pole and biquad filters run
// over Float32Arrays, envelopes, and the rooms' impulse responses. Everything here is made once (when the
// audio starts, or when a sound is first needed), never per frame.

// a seeded random in [ -1, 1 ) (mulberry32): the same sound every time
export function rng( seed ) {

	let a = seed >>> 0;
	return () => {

		a = ( a + 0x6D2B79F5 ) >>> 0;
		let t = a;
		t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
		t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296 * 2 - 1;

	};

}

// white noise
export function noise( n, seed = 1 ) {

	const r = rng( seed ), x = new Float32Array( n );
	for ( let i = 0; i < n; i ++ ) x[ i ] = r();
	return x;

}

// pink-ish noise (Paul Kellet's economy filter)
export function pink( n, seed = 1 ) {

	const r = rng( seed ), x = new Float32Array( n );
	let b0 = 0, b1 = 0, b2 = 0;
	for ( let i = 0; i < n; i ++ ) {

		const w = r();
		b0 = 0.99765 * b0 + w * 0.099046;
		b1 = 0.963 * b1 + w * 0.2965164;
		b2 = 0.57 * b2 + w * 1.0526913;
		x[ i ] = ( b0 + b1 + b2 + w * 0.1848 ) * 0.2;

	}

	return x;

}

// RBJ biquads, in place: type 'lp' | 'hp' | 'bp' | 'peak' (gain dB) | 'lowshelf' | 'highshelf'
export function biquad( x, sr, type, f, q = 0.707, gainDb = 0 ) {

	const w = 2 * Math.PI * Math.min( f, sr * 0.45 ) / sr, c = Math.cos( w ), s = Math.sin( w ), al = s / ( 2 * q );
	const A = Math.pow( 10, gainDb / 40 );
	let b0, b1, b2, a0, a1, a2;
	if ( type === 'lp' ) [ b0, b1, b2, a0, a1, a2 ] = [ ( 1 - c ) / 2, 1 - c, ( 1 - c ) / 2, 1 + al, - 2 * c, 1 - al ];
	else if ( type === 'hp' ) [ b0, b1, b2, a0, a1, a2 ] = [ ( 1 + c ) / 2, - ( 1 + c ), ( 1 + c ) / 2, 1 + al, - 2 * c, 1 - al ];
	else if ( type === 'bp' ) [ b0, b1, b2, a0, a1, a2 ] = [ al, 0, - al, 1 + al, - 2 * c, 1 - al ];
	else if ( type === 'peak' ) [ b0, b1, b2, a0, a1, a2 ] = [ 1 + al * A, - 2 * c, 1 - al * A, 1 + al / A, - 2 * c, 1 - al / A ];
	else {

		const sq = 2 * Math.sqrt( A ) * al, sign = type === 'lowshelf' ? - 1 : 1;
		b0 = A * ( ( A + 1 ) + sign * ( A - 1 ) * c + sq );
		b1 = - 2 * sign * A * ( ( A - 1 ) + sign * ( A + 1 ) * c );
		b2 = A * ( ( A + 1 ) + sign * ( A - 1 ) * c - sq );
		a0 = ( A + 1 ) - sign * ( A - 1 ) * c + sq;
		a1 = 2 * sign * ( ( A - 1 ) - sign * ( A + 1 ) * c );
		a2 = ( A + 1 ) - sign * ( A - 1 ) * c - sq;

	}

	let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
	for ( let i = 0; i < x.length; i ++ ) {

		const v = ( b0 * x[ i ] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2 ) / a0;
		x2 = x1; x1 = x[ i ]; y2 = y1; y1 = v;
		x[ i ] = v;

	}

	return x;

}

// a one-pole low-pass whose cutoff moves (cut( i ) in Hz), in place: the highs dying first in a tail
export function sweepLP( x, sr, cut ) {

	let y = 0;
	for ( let i = 0; i < x.length; i ++ ) {

		const a = 1 - Math.exp( - 2 * Math.PI * cut( i ) / sr );
		y += a * ( x[ i ] - y );
		x[ i ] = y;

	}

	return x;

}

export function peakOf( x ) {

	let p = 0;
	for ( let i = 0; i < x.length; i ++ ) p = Math.max( p, Math.abs( x[ i ] ) );
	return p;

}

// scale to a peak
export function normalize( x, peak = 0.8 ) {

	const p = peakOf( x );
	if ( p > 0 ) for ( let i = 0; i < x.length; i ++ ) x[ i ] *= peak / p;
	return x;

}

// fade the ends (so a loop meets itself at zero, and a one-shot doesn't click)
export function fadeEnds( x, sr, a = 0.005, b = 0.02 ) {

	const na = Math.min( x.length >> 2, Math.floor( a * sr ) ), nb = Math.min( x.length >> 2, Math.floor( b * sr ) );
	for ( let i = 0; i < na; i ++ ) x[ i ] *= i / na;
	for ( let i = 0; i < nb; i ++ ) x[ x.length - 1 - i ] *= i / nb;
	return x;

}

// make a loop seamless: crossfade its last `xf` seconds into its start (equal power) and drop them
export function loopable( x, sr, xf = 0.25 ) {

	const n = Math.floor( xf * sr ), L = x.length - n, y = new Float32Array( L );
	for ( let i = 0; i < L; i ++ ) y[ i ] = x[ i ];
	for ( let i = 0; i < n; i ++ ) {

		const t = ( i + 0.5 ) / n;
		y[ i ] = x[ i ] * Math.sin( t * Math.PI / 2 ) + x[ L + i ] * Math.cos( t * Math.PI / 2 );

	}

	return y;

}

// an AudioBuffer from channels of Float32Arrays
export function toBuffer( ctx, chans, sr = ctx.sampleRate ) {

	const b = ctx.createBuffer( chans.length, chans[ 0 ].length, sr );
	chans.forEach( ( c, i ) => b.getChannelData( i ).set( c ) );
	return b;

}

// ---------------------------------------------------------------- the rooms

// The open bowl: a stadium's answer to a sound. Almost nothing close by (the seats and the rail), then
// the far stands sending it back as a handful of smeared slaps a fifth to half a second later (the
// echo you hear under every PA call and every crack of the bat), and a long, dark tail: 45,000 people
// and their clothes eat the highs, the lows ring on round the concrete. Stereo, the two sides different.
export function bowlImpulse( sr, seed = 11 ) {

	const len = Math.floor( 3.4 * sr ), out = [];
	for ( let c = 0; c < 2; c ++ ) {

		const r = rng( seed + c * 101 ), x = new Float32Array( len );
		// the tail in three bands, each dying at its own rate (T60: lows 3.1 s, mids 2.2 s, highs 0.9 s),
		// building over the first 150 ms (the stands are far)
		const bands = [ [ 'lp', 500, 3.1, 1.0 ], [ 'bp', 1400, 2.2, 0.75 ], [ 'hp', 3200, 0.9, 0.35 ] ];
		for ( const [ type, f, t60, lvl ] of bands ) {

			const n = noise( len, seed * 7 + c * 13 + f );
			biquad( n, sr, type, f, type === 'bp' ? 0.6 : 0.707 );
			const k = 6.91 / ( t60 * sr );
			for ( let i = 0; i < len; i ++ ) {

				const t = i / sr, build = Math.min( 1, Math.max( 0, ( t - 0.02 ) / 0.13 ) );
				x[ i ] += n[ i ] * lvl * Math.exp( - k * i ) * build * build * 0.5;

			}

		}

		// a few close reflections (the seats, the rail, the concrete under you)
		for ( let k = 0; k < 10; k ++ ) {

			const at = Math.floor( ( 0.004 + 0.05 * ( r() * 0.5 + 0.5 ) ) * sr );
			x[ at ] += r() * 0.35;

		}

		// the far stands' slaps: short noise bursts, dark, round the bowl
		const slaps = [ 0.19, 0.27, 0.34, 0.42, 0.51, 0.63 ];
		slaps.forEach( ( t0, j ) => {

			const at = Math.floor( ( t0 + 0.02 * r() ) * sr ), w = Math.floor( ( 0.025 + 0.02 * ( r() * 0.5 + 0.5 ) ) * sr );
			const burst = noise( w, seed + j * 31 + c );
			biquad( burst, sr, 'lp', 2400 - j * 250, 0.7 );
			const a = ( 0.9 - j * 0.1 ) * ( 0.75 + 0.25 * r() );
			for ( let i = 0; i < w && at + i < len; i ++ ) x[ at + i ] += burst[ i ] * a * Math.sin( Math.PI * i / w );

		} );
		out.push( x );

	}

	return out;

}

// A roofed space: the concourse under the deck, a tunnel to the seats. Dense early reflections off the
// concrete ceiling and floor a few metres apart, a short, boomy tail.
export function roomImpulse( sr, seed = 23 ) {

	const len = Math.floor( 1.4 * sr ), out = [];
	for ( let c = 0; c < 2; c ++ ) {

		const r = rng( seed + c * 17 ), x = new Float32Array( len );
		const bands = [ [ 'lp', 400, 1.3, 1.0 ], [ 'bp', 1200, 0.9, 0.8 ], [ 'hp', 3000, 0.45, 0.4 ] ];
		for ( const [ type, f, t60, lvl ] of bands ) {

			const n = noise( len, seed * 5 + c * 11 + f );
			biquad( n, sr, type, f, type === 'bp' ? 0.6 : 0.707 );
			const k = 6.91 / ( t60 * sr );
			for ( let i = 0; i < len; i ++ ) {

				const t = i / sr, build = Math.min( 1, t / 0.012 );
				x[ i ] += n[ i ] * lvl * Math.exp( - k * i ) * build * 0.45;

			}

		}

		// the floor-to-ceiling flutter: reflections every ~17 ms, fading
		for ( let k = 1; k < 14; k ++ ) {

			const at = Math.floor( ( k * 0.0165 + 0.002 * r() ) * sr );
			if ( at < len ) x[ at ] += ( 0.55 * Math.pow( 0.78, k ) ) * ( r() < 0 ? - 1 : 1 );

		}

		out.push( x );

	}

	return out;

}
