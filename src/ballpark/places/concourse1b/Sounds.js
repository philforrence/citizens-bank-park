// What the first base concourse and its gate sound like (Concourse1B.js), through the park's sound
// (GameSound.sample / spot: heard from where it is, panned, quieter with distance):
//
//   the voices (Piper TTS, tools/audio/concourse1b-calls.py): Gus calling the programs, the beer man,
//     Loretta at her register ("what can I get you, baby?"), the hot chocolate at the water ice cart, the
//     Phanatic Phood cart, Dee at the turnstile ("enjoy the game, hon"; "welcome back" on the 29th), the
//     bag check, security keeping it moving, an usher pointing the way, Leo and his radio, a fan ribbing
//     the Rays fan, the caricaturist to his sitter
//   made here: the flat-tops sizzling, a register's drawer, the scanner's beep and the turnstile's ratchet,
//     the rain drumming on the gate's steel canopy (the 27th), the murmur of the lines at the gate
//
// One-shots only near the camera (they'd be inaudible further off, and each is a few audio nodes).
const DIR = 'audio/places/concourse1b/';
const CALLS = [ 'gus-1', 'gus-2', 'beer-1', 'beer-2', 'loretta-1', 'loretta-2', 'cocoa-1', 'phood-1', 'dee-1', 'dee-2', 'dee-3', 'bags-1', 'bags-2', 'bernie-1', 'guard-1', 'usher-1', 'leo-1', 'fan-tampa', 'marty-1' ];
const NEAR = 42;

// ---------------------------------------------------------------- made here

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

// a two-pole band-pass (RBJ) run over a signal
function bandpass( x, sr, f, q ) {

	const w = 2 * Math.PI * f / sr, al = Math.sin( w ) / ( 2 * q ), c = Math.cos( w );
	const b0 = al, b2 = - al, a0 = 1 + al, a1 = - 2 * c, a2 = 1 - al;
	const y = new Float32Array( x.length );
	let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
	for ( let i = 0; i < x.length; i ++ ) {

		const v = ( b0 * x[ i ] + b2 * x2 - a1 * y1 - a2 * y2 ) / a0;
		x2 = x1; x1 = x[ i ]; y2 = y1; y1 = v;
		y[ i ] = v;

	}

	return y;

}

function buffer( ctx, seconds, fill ) {

	const sr = ctx.sampleRate, n = Math.floor( seconds * sr );
	const b = ctx.createBuffer( 1, n, sr );
	const d = b.getChannelData( 0 );
	fill( d, sr, n );
	// fade the ends a hair (and loops meet at zero)
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

// a flat-top sizzling: fat spitting in a hiss, the crackles
export const sizzle = ( ctx ) => buffer( ctx, 4, ( d, sr, n ) => {

	const r = rand( 11 ), noise = new Float32Array( n );
	for ( let i = 0; i < n; i ++ ) noise[ i ] = r();
	const hiss = bandpass( noise, sr, 5200, 0.7 );
	for ( let i = 0; i < n; i ++ ) d[ i ] = hiss[ i ] * ( 0.55 + 0.25 * Math.sin( i / sr * 2.3 ) + 0.2 * Math.sin( i / sr * 5.1 + 1 ) );
	const pops = new Float32Array( n );
	for ( let k = 0; k < 90; k ++ ) {

		const at = Math.floor( ( r() * 0.5 + 0.5 ) * ( n - 400 ) ), a = 0.8 + 0.8 * Math.abs( r() );
		for ( let j = 0; j < 300; j ++ ) pops[ at + j ] += r() * a * Math.exp( - j / 40 );

	}

	const crack = bandpass( pops, sr, 3000, 1.2 );
	for ( let i = 0; i < n; i ++ ) d[ i ] += crack[ i ] * 1.5;

} );

// a register: the keys, the drawer thrown open, the bell
export const register = ( ctx ) => buffer( ctx, 0.9, ( d, sr, n ) => {

	const r = rand( 23 );
	for ( let k = 0; k < 3; k ++ ) {

		const at = Math.floor( ( 0.03 + k * 0.09 ) * sr );
		for ( let j = 0; j < 600; j ++ ) d[ at + j ] += r() * 0.35 * Math.exp( - j / 90 );

	}

	const at = Math.floor( 0.34 * sr );
	for ( let j = 0; at + j < n; j ++ ) {

		const t = j / sr;
		d[ at + j ] += ( Math.sin( 2 * Math.PI * 2240 * t ) * 0.5 + Math.sin( 2 * Math.PI * 3390 * t ) * 0.3 ) * Math.exp( - t * 7 );
		if ( j < 2400 ) d[ at + j ] += r() * 0.6 * Math.exp( - j / 500 );

	}

} );

// the handheld scanner's beep
export const beep = ( ctx ) => buffer( ctx, 0.22, ( d, sr, n ) => {

	for ( let i = 0; i < n; i ++ ) {

		const t = i / sr;
		d[ i ] = Math.sign( Math.sin( 2 * Math.PI * 2750 * t ) ) * 0.4 * ( t < 0.15 ? 1 : Math.exp( - ( t - 0.15 ) * 60 ) );

	}

} );

// the tripod turnstile: the ratchet's clicks as it's pushed round, the arm's knock at the stop
export const ratchet = ( ctx ) => buffer( ctx, 0.8, ( d, sr, n ) => {

	const r = rand( 37 ), x = new Float32Array( n );
	for ( let k = 0; k < 6; k ++ ) {

		const at = Math.floor( ( 0.02 + k * 0.07 ) * sr );
		for ( let j = 0; j < 500; j ++ ) x[ at + j ] += r() * Math.exp( - j / 60 );

	}

	const click = bandpass( x, sr, 2600, 2 );
	for ( let i = 0; i < n; i ++ ) d[ i ] = click[ i ];
	const at = Math.floor( 0.5 * sr );
	for ( let j = 0; at + j < n; j ++ ) {

		const t = j / sr;
		d[ at + j ] += Math.sin( 2 * Math.PI * 420 * t ) * 0.7 * Math.exp( - t * 30 ) + Math.sin( 2 * Math.PI * 1310 * t ) * 0.3 * Math.exp( - t * 45 );

	}

} );

// rain on a steel canopy: the drops' ticks, dense, and the drum of it under them
export const canopyRain = ( ctx ) => buffer( ctx, 5, ( d, sr, n ) => {

	const r = rand( 41 ), x = new Float32Array( n );
	for ( let k = 0; k < 9000; k ++ ) {

		const at = Math.floor( ( r() * 0.5 + 0.5 ) * ( n - 200 ) ), a = 0.2 + 0.8 * Math.abs( r() ) ** 3;
		for ( let j = 0; j < 120; j ++ ) x[ at + j ] += r() * a * Math.exp( - j / 18 );

	}

	const ticks = bandpass( x, sr, 3400, 0.9 );
	const noise = new Float32Array( n );
	for ( let i = 0; i < n; i ++ ) noise[ i ] = r();
	const drum = bandpass( noise, sr, 380, 0.6 );
	for ( let i = 0; i < n; i ++ ) d[ i ] = ticks[ i ] + drum[ i ] * 0.5;

} );

// the murmur of a line: voices' formants in noise, the syllables' rhythm
export const murmur = ( ctx ) => buffer( ctx, 6, ( d, sr, n ) => {

	const r = rand( 53 ), noise = new Float32Array( n );
	for ( let i = 0; i < n; i ++ ) noise[ i ] = r();
	const f1 = bandpass( noise, sr, 520, 3 ), f2 = bandpass( noise, sr, 1250, 3 ), f3 = bandpass( noise, sr, 2400, 4 );
	for ( let i = 0; i < n; i ++ ) {

		const t = i / sr;
		const syl = 0.5 + 0.25 * Math.sin( 2 * Math.PI * 3.7 * t ) * Math.sin( 2 * Math.PI * 0.43 * t + 1 ) + 0.25 * Math.sin( 2 * Math.PI * 4.9 * t + 2 ) * Math.sin( 2 * Math.PI * 0.31 * t );
		d[ i ] = ( f1[ i ] + f2[ i ] * 0.7 + f3[ i ] * 0.35 ) * syl;

	}

} );

// ---------------------------------------------------------------- the place's sound

export class Sounds1B {

	constructor( place ) {

		this.place = place;
		this.ready = false;
		this.timers = {};
		this.later = [];
		this.time = 0;

	}

	// the park's sound exists once the app's made it (after the places): set up then
	_init( sound ) {

		this.sound = sound;
		for ( const k of CALLS ) sound.sample( 'c1b-' + k, DIR + k + '.mp3' );
		sound.sample( 'c1b-sizzle', sizzle );
		sound.sample( 'c1b-register', register );
		sound.sample( 'c1b-beep', beep );
		sound.sample( 'c1b-ratchet', ratchet );
		sound.sample( 'c1b-canopy-rain', canopyRain );
		sound.sample( 'c1b-murmur', murmur );
		// the lines at the TVs going up at a Phillies run, groaning at the Rays' (the park's own recordings)
		sound.sample( 'c1b-cheer', 'audio/ballpark/cheer-small.mp3' );
		sound.sample( 'c1b-groan', 'audio/ballpark/groan.mp3' );
		const pl = this.place;
		// the flat-tops: Hatfield behind 120, Cobblestone behind 108, the Hatfield cart
		this.loops = [];
		for ( const U of ( pl.concourse?.units || [] ) ) {

			if ( ! [ 'hatfield', 'cobblestone' ].includes( U.what ) ) continue;
			const [ s ] = pl.W.toSD( U.mid[ 0 ], U.mid[ 1 ] );
			if ( s < 2 || s > 149 ) continue;
			this.loops.push( sound.spot( 'c1b-sizzle', this._world( U.mid[ 0 ] - U.n[ 0 ] * 1.0, 1.2, U.mid[ 1 ] - U.n[ 1 ] * 1.0 ), { loop: true, vol: 0.35, ref: 3, max: 30 } ) );

		}

		const hc = pl.carts?.find( ( c ) => c.kind === 'hatfieldCart' );
		if ( hc ) this.loops.push( sound.spot( 'c1b-sizzle', this._world( hc.x, 1.1, hc.z ), { loop: true, vol: 0.18, ref: 2, max: 20 } ) );
		// the rain on the gate's canopy, and the lines' murmur, at the gate
		const g = pl.gate;
		if ( g ) {

			const c = g.P( 0, 2.5 ), m = g.P( 0, 1.5 );
			this.rain = sound.spot( 'c1b-canopy-rain', this._world( c[ 0 ], 6.2, c[ 2 ] ), { loop: true, vol: 0, ref: 10, max: 70 } );
			this.murmur = sound.spot( 'c1b-murmur', this._world( m[ 0 ], 1.6, m[ 2 ] ), { loop: true, vol: 0, ref: 8, max: 60 } );

		}

		// the gate's events
		if ( pl.arrivals ) {

			pl.arrivals.onScan = ( L, a ) => this._scanned( L, a );
			// Bernie's thermos at the bag table: Terrell's "it's gotta go", Bernie's "it's coffee!"
			pl.arrivals.onEvent = ( k, p ) => this.play( k === 'thermos' ? 'c1b-bags-2' : 'c1b-bernie-1', p.x, 1.6, p.z, 0.65, 3 );

		}
		this.ready = true;

	}

	_world( x, y, z ) {

		const F = this.place.field, w = F.toWorld( x, z );
		return { x: w.x, y: F.y0 + 7.01 + y, z: w.z };

	}

	_near( x, z ) {

		const c = this.cam;
		return c && Math.hypot( x - c[ 0 ], z - c[ 1 ] ) < NEAR;

	}

	// a one-shot at a field point, if it's near enough to hear
	play( name, x, y, z, vol = 0.6, ref = 4 ) {

		if ( ! this._near( x, z ) ) return;
		this.sound.spot( name, this._world( x, y, z ), { vol, ref, max: NEAR + 10 } );

	}

	// every so long (seconds, give or take a third), if it's due
	_every( key, secs ) {

		const t = this.timers[ key ] ?? ( this.timers[ key ] = this.time + secs * Math.random() );
		if ( this.time < t ) return false;
		this.timers[ key ] = this.time + secs * ( 0.7 + 0.6 * Math.random() );
		return true;

	}

	// a ticket scanned: the beep, the turnstile's ratchet as they push through; Dee at hers
	_scanned( L, a ) {

		const p = L.taker?.p;
		if ( ! p ) return;
		this.play( 'c1b-beep', p.x, 1.2, p.z, 0.35, 3 );
		this.later.push( [ this.time + 0.6, () => this.play( 'c1b-ratchet', L.tripod?.at[ 0 ] ?? p.x, 0.9, L.tripod?.at[ 2 ] ?? p.z, 0.45, 3 ) ] );
		if ( L.taker.name === 'Dee' && Math.random() < 0.35 && this._every( 'dee1', 10 ) ) this.later.push( [ this.time + 0.9, () => this.play( this.place.night?.first ? 'c1b-dee-1' : ( Math.random() < 0.5 ? 'c1b-dee-3' : 'c1b-dee-1' ), p.x, 1.6, p.z, 0.55, 3 ) ] );

	}

	update( dt, ns, camF ) {

		const sound = this.place.app?.sound;
		if ( ! sound ) return;
		if ( ! this.ready ) this._init( sound );
		this.time += dt;
		this.cam = camF;
		const pl = this.place, P = pl.people, S = pl.stories, A = pl.arrivals;
		this.later = this.later.filter( ( [ t, f ] ) => {

			if ( this.time < t ) return true;
			f();
			return false;

		} );
		// the rain on the canopy (the 27th, harder as it went), the lines' murmur with the rush
		this.rain?.set( { vol: ns.first ? 0.15 + 0.5 * ns.rain : 0 } );
		const queued = A ? A.lanes.reduce( ( n, L ) => n + L.queue.length, 0 ) : 0;
		this.murmur?.set( { vol: Math.min( 0.5, queued * 0.012 ) } );
		// the vendors' calls
		const at = ( a ) => a?.p?.visible ? [ a.p.x, a.p.z ] : null;
		const gus = at( S?.gus );
		if ( gus && S.gus.state === 'idle' && this._every( 'gus', 18 ) ) this.play( Math.random() < 0.6 ? 'c1b-gus-1' : 'c1b-gus-2', gus[ 0 ], 1.6, gus[ 1 ], 0.7 );
		const hk = at( S?.hawker );
		if ( hk && this._every( 'beer', 22 ) ) this.play( Math.random() < 0.5 ? 'c1b-beer-1' : 'c1b-beer-2', hk[ 0 ], 1.7, hk[ 1 ], 0.75 );
		for ( const St of P.stands ) {

			const staff = St.staff[ 0 ];
			if ( ! staff ) continue;
			// the register's drawer as they ring it up
			for ( const a of St.staff ) {

				if ( a.state !== a._st ) {

					if ( a.state === 'register' ) this.play( 'c1b-register', a.p.x, 1.1, a.p.z, 0.3, 3 );
					a._st = a.state;

				}

			}

			if ( St.brand === 'waterIce' && St.staff[ 0 ].state === 'idle' && this._every( 'cocoa', 34 ) ) this.play( 'c1b-cocoa-1', staff.p.x, 1.6, staff.p.z, 0.65 );
			if ( St.brand === 'phood' && this._every( 'phood', 55 ) ) this.play( 'c1b-phood-1', staff.p.x, 1.6, staff.p.z, 0.55 );

		}

		// Loretta: to each at her register as they walk up, and as she hands it over
		const lo = S?.loretta;
		if ( lo ) {

			if ( lo.state !== lo._was ) {

				if ( lo.state === 'listen' && Math.random() < 0.7 ) this.play( 'c1b-loretta-1', lo.p.x, 1.6, lo.p.z, 0.55, 3 );
				if ( lo.state === 'give' && Math.random() < 0.5 ) this.play( 'c1b-loretta-2', lo.p.x, 1.6, lo.p.z, 0.55, 3 );
				lo._was = lo.state;

			}

		}

		// the ushers pointing the way, a third of the time
		for ( const u of S?.ushers || [] ) {

			const on = u.checkT > 0 && u.checkT < 0.2;
			if ( on && ! u._said && Math.random() < 0.2 && this.time - ( u._saidT || - 99 ) > 45 ) {

				this.play( 'c1b-usher-1', u.p.x, 1.6, u.p.z, 0.5, 3 );
				u._saidT = this.time;

			}

			u._said = u.checkT > 0;

		}

		// Leo after a play; the Rays fan ribbed; the caricaturist; security at the gate in the rush
		if ( S?.leo && ns.result && ns.result.key !== this._leoKey && ns.result.t > 1.5 ) {

			this._leoKey = ns.result.key;
			if ( Math.random() < 0.5 ) this.play( 'c1b-leo-1', S.leo.p.x, 1.6, S.leo.p.z, 0.6, 3 );

		}

		const b = S?.brandon;
		if ( b?.p.visible && this._every( 'tampa', 50 ) ) {

			const near = P.fans.find( ( o ) => o !== b && o.p.visible && o.mode === 'walk' && Math.hypot( o.p.x - b.p.x, o.p.z - b.p.z ) < 3 );
			if ( near ) this.play( 'c1b-fan-tampa', near.p.x, 1.6, near.p.z, 0.6, 3 );

		}

		if ( S?.marty && this._every( 'marty', 45 ) ) this.play( 'c1b-marty-1', S.marty.p.x, 1.3, S.marty.p.z, 0.45, 2.5 );
		if ( A && queued > 20 ) {

			const g = S?.guards?.[ 0 ];
			if ( g && this._every( 'guard', 35 ) ) this.play( 'c1b-guard-1', g.p.x, 1.6, g.p.z, 0.6 );
			if ( this._every( 'dee2', 40 ) ) {

				const d = A.lanes[ 3 ]?.taker?.p;
				if ( d ) this.play( 'c1b-dee-2', d.x, 1.6, d.z, 0.55, 3 );

			}

		}

		// a play's result: the concourse's lines and the rail near the camera react out loud, from the
		// nearest stand's TV
		const R = P.react;
		if ( R && R.t < 0.5 && R !== this._reacted && ( R.kind === 'cheer' || R.kind === 'groan' || R.kind === 'champions' ) ) {

			this._reacted = R;
			let best = null, bd = Infinity;
			for ( const St of P.stands ) {

				const w = pl.W.at( St.s, 43 ), d = Math.hypot( w.x - ( camF?.[ 0 ] ?? 1e9 ), w.z - ( camF?.[ 1 ] ?? 1e9 ) );
				if ( d < bd ) {

					bd = d;
					best = w;

				}

			}

			if ( best && bd < 30 ) this.play( R.kind === 'groan' ? 'c1b-groan' : 'c1b-cheer', best.x, 1.7, best.z, R.kind === 'groan' ? 0.35 : 0.45, 8 );

		}

		// the bag check, now and then
		for ( const L of A?.lanes || [] ) {

			const B = L.bagFan;
			if ( B && B !== L._bagSaid ) {

				L._bagSaid = B;
				if ( Math.random() < 0.25 ) this.play( 'c1b-bags-1', L.bags.p.x, 1.6, L.bags.p.z, 0.5, 3 );

			}

		}

	}

}
