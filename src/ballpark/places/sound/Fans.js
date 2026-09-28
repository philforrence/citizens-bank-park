import { Vector3 } from '../../../engine/index.js';

// The crowd as a living thing that follows the game. 45,940 in red, on the crowd bus (Space.js darkens it
// under the concourse's roof and outside):
//
//   the murmur:   GameSound's recorded walla (CC0), its level by the inning and the weather: the buzz
//                 before the first pitch, the 27th's crowd hunched under ponchos, the 29th's crowd
//                 keyed up from the start;
//   the roar:     a recorded stadium roar (CC0) looped under everything, up with the tension: two
//                 strikes with a Phillies pitcher, two outs, men on for the Phillies, the 9th;
//   the swells:   GameSound.cheer( level ) from the replay's cues (a hit, a run, a strikeout) and the
//                 plan's moments: cheers, groans, "ooh"s on a fly ball, "aww"s, boos for the Rays;
//   the claps:    made here from single hand claps (a few hundred clappers, each a little early or late,
//                 the far ones later still): the rhythmic clap with two strikes, applause, the
//                 "da-da, da-da-da" answer to the organ;
//   the chants:   "Let's go Phil-lies!" started in one section, the next sections joining a beat later,
//                 then the whole bowl, each heard from where it is (and when: the far side arrives late);
//   the hush:     the breath the park holds before a big pitch;
//   near you:     in the seats, the people round you: a whistle, a shout, hands clapping beside you.
//
// The voices (the boos, the chants, the shouts) are Piper TTS, stacked into crowds offline
// (tools/audio/build-fans.py; public/audio/ballpark/fans/, index.json lists them); until they're in, the
// claps and the recordings carry it.

const DIR = 'audio/ballpark/fans/';
const RATE = 1 / 10; // s between level updates
const SR = 24000; // the claps and whistles are made at this rate (their highs stop well under it)

export class Fans {

	constructor( { app, field, bowl, sound, space, synth } ) {

		this.app = app;
		this.field = field;
		this.bowl = bowl;
		this.sound = sound;
		this.space = space;
		const ctx = sound.ctx;
		this.bus = sound.buses.crowd;
		this.swell = 0;
		this.hushUntil = 0;
		this.hushDur = 1;
		this.lastCheer = - 10;
		this.tick = 0;
		this.index = {};
		// the loops: the roar, the rhythmic clap, the applause (their sounds made off the main thread)
		this.roar = this._loop( null, 0 );
		this.clap = this._loop( null, 0 );
		this.applause = this._loop( null, 0 );
		this.pattern = this.whistle = null;
		this.single = [];
		synth.make( 'claps', SR ).then( ( [ rhythm, applause, pattern, whistle, ...single ] ) => {

			for ( const [ n, b ] of [ [ this.clap, rhythm ], [ this.applause, applause ] ] ) {

				n.src.buffer = b;
				n.src.start( 0, Math.random() * b.duration );

			}

			Object.assign( this, { pattern, whistle, single } );

		} ).catch( () => {} );
		void ctx;
		this._v = new Vector3();
		this._load();

	}

	async _load() {

		try {

			const r = await fetch( DIR + 'index.json' );
			if ( ! r.ok ) return;
			this.index = await r.json();
			for ( const [ key, e ] of Object.entries( this.index ) ) this.sound.sample( 'fans-' + key, DIR + e.f );

		} catch ( e ) {

			console.warn( 'fans', e.message );

		}

	}

	// the recorded walla onto the crowd bus, and the roar's loop once the recordings are in
	takeMurmur() {

		const S = this.sound;
		if ( S.crowd?.sampled && ! this._took ) {

			S.crowd.gain.disconnect();
			S.crowd.gain.connect( this.bus );
			S.crowd.gain.connect( S.reverb );
			this._took = true;

		}

		const b = S.buffers[ 'cheer-big' ];
		if ( b && ! this.roar.src.buffer ) {

			this.roar.src.buffer = b;
			// the steady middle of the roar
			this.roar.src.loopStart = 1.0;
			this.roar.src.loopEnd = Math.min( b.duration - 1.2, 26.5 );
			this.roar.src.start( 0, 1 + Math.random() * 20 );

		}

	}

	_loop( buffer, gain ) {

		const ctx = this.sound.ctx, src = ctx.createBufferSource(), g = ctx.createGain();
		src.loop = true;
		g.gain.value = gain;
		src.connect( g ).connect( this.bus );
		g.connect( this.sound.reverb );
		if ( buffer ) {

			src.buffer = buffer;
			src.start( 0, Math.random() * buffer.duration );

		}

		return { src, g, v: gain };

	}

	// ---------------------------------------------------------------- the levels, following the game

	// how the park sounds at the replay's time: { murmur, roar, clap, applause } (a function of the
	// time, like Crowd.mood, so a jump lands right)
	levels( d ) {

		const seg = d.segmentAt( d.t ), s = seg.snap || {}, lt = d.t - seg.t0;
		const night2 = d.t >= ( this.app.soundscape?.plan?.night2 ?? Infinity );
		const inn = s.inning || 1, late = inn >= 9, outs2 = ( s.outs || 0 ) >= 2, two = ( s.strikes || 0 ) >= 2;
		// the murmur: the 27th damped by the rain as it went on, the 29th up and keyed from the start
		let murmur = night2 ? 1.0 + 0.05 * ( inn - 6 ) : 0.95 - 0.04 * Math.min( 5, inn - 1 );
		let roar = 0.04, clap = 0, applause = 0;
		const kind = seg.kind;
		if ( kind === 'intro' ) murmur = 1.1, roar = 0.25;
		if ( kind === 'pitch' || kind === 'walkup' ) {

			if ( s.half === 'top' ) {

				// a Phillies pitcher: up with two strikes, more with two outs, everything in the 9th
				if ( two ) roar = 0.3 + ( outs2 ? 0.25 : 0 ) + ( late ? 0.35 : 0 ) + ( inn >= 7 ? 0.08 : 0 ), clap = 0.35 + ( late ? 0.3 : 0 );
				else if ( late ) roar = 0.32, clap = 0.25;
				else if ( outs2 && inn >= 7 ) roar = 0.12;

			} else {

				const on = ( s.bases || [] ).filter( Boolean ).length;
				roar = 0.05 + 0.1 * on + ( on && inn >= 6 ? 0.08 : 0 );
				clap = on ? 0.15 + 0.08 * on : 0;
				if ( two ) roar += 0.05;

			}

		}

		if ( kind === 'switch' ) {

			murmur *= 1.08;
			// the Phillies taking the field in the 9th: the whole place up
			if ( s.inning === 9 && s.half === 'top' ) roar = 0.4 * Math.min( 1, lt / 6 ), clap = 0.3;

		}

		if ( kind === 'change' ) murmur *= 1.05, roar = s.inning >= 9 ? 0.45 : 0.08;
		if ( kind === 'celebrate' ) {

			// minutes of it: the roar, the whole bowl clapping, slowly settling to a happy din
			roar = 1.35 - 0.45 * Math.min( 1, lt / 70 );
			applause = 0.8;
			murmur = 1.3;

		}

		// the seated fans' own clapping (Crowd.js, what you see) sets a floor under the sound's
		const M = this.bowl?.crowd?._mood;
		if ( M ) clap = Math.max( clap, M.clap * 0.55 );
		return { murmur, roar, clap, applause };

	}

	update( dt, d, camera ) {

		this.tick -= dt;
		this.swell *= Math.exp( - dt / 2.8 );
		if ( this.tick > 0 ) return;
		this.tick = RATE;
		const S = this.sound, ctx = S.ctx, now = ctx.currentTime;
		const L = this.levels( d );
		// the hush: everything down but the few who can't help it
		// the hush: everything down but the few who can't help it; while they sing, the talk drops too
		const hush = ( now < this.hushUntil ? 0.35 : 1 ) * ( now < ( this.singing || 0 ) ? 0.55 : 1 );
		const set = ( n, v, tc = 0.35 ) => {

			if ( Math.abs( n.v - v ) < 0.01 ) return;
			n.v = v;
			n.g.gain.setTargetAtTime( v, now, tc );

		};

		if ( S.crowd?.sampled && this._took ) {

			const m = { g: S.crowd.gain, v: this._mv ?? - 1 };
			set( m, 0.5 * L.murmur * hush, hush < 1 ? 0.12 : 0.5 );
			this._mv = m.v;

		}

		set( this.roar, 2.0 * Math.min( 1.6, L.roar + this.swell ) * hush, hush < 1 ? 0.1 : 0.45 );
		set( this.clap, 0.9 * L.clap * ( hush < 1 ? 0.2 : 1 ) );
		set( this.applause, 0.8 * L.applause );
		this._near( dt, d, camera, L );

	}

	jump() {

		this.swell = 0;
		this.hushUntil = 0;

	}

	// ---------------------------------------------------------------- moments

	// GameSound.cheer( level ): the replay's hits, runs and strikeouts. level > 0 the Phillies' good
	// (2 big, 3 a run), < 0 the Rays'
	cheer( level ) {

		const S = this.sound, now = S.ctx.currentTime;
		const again = now - this.lastCheer < 1.6;
		this.lastCheer = now;
		if ( level > 0 ) {

			this.swell = Math.max( this.swell, 0.25 * level + ( level >= 3 ? 0.35 : 0 ) );
			if ( ! again ) {

				if ( level >= 2 ) S.play( 'cheer-burst', { vol: 0.45 + 0.12 * level, bus: 'crowd' } );
				else S.play( 'cheer-small', { vol: 0.55, bus: 'crowd' } );

			}

			this._clapBurst( 0.4 + 0.2 * level );

		} else if ( ! again ) {

			S.play( 'groan', { vol: 0.5, bus: 'crowd', rate: 0.95 + 0.1 * Math.random() } );
			if ( level <= - 1 ) this.react( 'boo', 0.35 );

		}

		return true;

	}

	// the plan's crowd moments
	react( what, level = 1 ) {

		const S = this.sound;
		const v = Math.min( 1.5, level );
		switch ( what ) {

			case 'cheer':
				this.swell = Math.max( this.swell, 0.2 * v );
				S.play( v > 1.4 ? 'cheer-burst' : 'cheer-small', { vol: 0.35 + 0.2 * v, bus: 'crowd' } );
				this._clapBurst( 0.3 * v );
				break;
			case 'rise':
				// a fly ball up, two strikes: the rising "ohhh"
				this.swell = Math.max( this.swell, 0.18 * v );
				S.play( 'ooh', { vol: 0.3 * v, rate: 0.9, bus: 'crowd' } );
				break;
			case 'ooh':
				S.play( 'ooh', { vol: 0.3 * v, rate: 0.95 + 0.1 * Math.random(), bus: 'crowd' } );
				break;
			case 'aww':
				if ( ! this._voice( 'aww', 0.5 * v ) ) S.play( 'groan', { vol: 0.25 * v, rate: 1.1, bus: 'crowd' } );
				break;
			case 'groan':
				S.play( 'groan', { vol: 0.4 * v, bus: 'crowd' } );
				break;
			case 'boo':
				this._voice( 'boo', 0.55 * v );
				break;
			case 'applause':
				this._clapBurst( 0.5 * v );
				break;
			default: break;

		}

	}

	// a crowd voice clip (fans/), one of its takes
	_voice( key, vol, rate = 1 ) {

		const takes = Object.keys( this.index ).filter( ( k ) => k === key || k.startsWith( key + '-' ) );
		if ( ! takes.length ) return false;
		const k = takes[ Math.floor( Math.random() * takes.length ) ];
		return !! this.sound.play( 'fans-' + k, { vol, rate: rate * ( 0.97 + 0.06 * Math.random() ), bus: 'crowd' } );

	}

	// a burst of applause: the applause loop up for a few seconds
	_clapBurst( v ) {

		const ctx = this.sound.ctx, t = ctx.currentTime, g = this.applause.g.gain;
		const base = this.applause.v;
		g.cancelScheduledValues( t );
		g.setTargetAtTime( base + 0.9 * v, t + 0.15, 0.15 );
		g.setTargetAtTime( base, t + 1.5 + 2 * v, 0.9 );

	}

	hush( dur ) {

		const now = this.sound.ctx.currentTime;
		this.hushUntil = now + dur;
		this.swell = 0;
		this.tick = 0;

	}

	// the 29th: welcome back
	welcome() {

		this.swell = 0.6;

	}

	// the last out
	celebrate() {

		const S = this.sound;
		this.swell = 1.2;
		this.hushUntil = 0;
		S.play( 'cheer-big', { vol: 1.2, bus: 'crowd' } );
		S.play( 'cheer-burst', { vol: 1.0, delay: 0.15, bus: 'crowd' } );
		S.play( 'cheer-burst', { vol: 0.8, delay: 9, rate: 0.97, bus: 'crowd' } );
		this._clapBurst( 1 );

	}

	// ---------------------------------------------------------------- the chants

	// "Let's go Phil-lies!": from a section (its angle round the bowl from behind home, degrees; + toward
	// first), the neighbours joining on the next time round, the whole bowl on the third
	chant( what, from = 0, cycles = 3 ) {

		const S = this.sound, ctx = S.ctx, b = S.buffers[ 'fans-' + what ];
		const cyc = this.index[ what ]?.cycle || 2.4;
		const t0 = ctx.currentTime + 0.1;
		const secs = [ 0, - 1, 1, - 2, 2, - 3, 3 ];
		const F = this.field, a = this.space.at;
		for ( const k of secs ) {

			const ang = ( from + k * 38 ) * Math.PI / 180;
			const x = Math.sin( ang ) * 72, z = Math.cos( ang ) * 72 - 8, y = 14;
			const d = Math.hypot( x - a.x, z - a.z, y - a.y );
			const join = Math.abs( k ) === 0 ? 0 : Math.abs( k ) <= 1 ? 1 : 2;
			const n = cycles - join;
			if ( n <= 0 ) continue;
			const start = t0 + join * cyc + d / 343;
			const w = F.toWorld( x, z );
			const pos = this._v.set( w.x, F.y0 + y, w.z );
			const vol = ( k === 0 ? 1 : 0.8 ) / ( 1 + Math.abs( k ) * 0.15 );
			if ( b ) this._section( b, pos, start, n * cyc, vol );
			// the claps after each "Let's go Phil-lies" (and all there is, before the voices are in)
			if ( ! b && this.pattern ) for ( let c = 0; c < n; c ++ ) this._section( this.pattern, pos, start + c * cyc + 1.2, 1.2, vol * 0.8 );

		}

	}

	// one section's part: a clip (looped for dur) from a place in the bowl, panned, through the crowd bus
	_section( buffer, pos, start, dur, vol ) {

		const ctx = this.sound.ctx;
		const src = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createPanner();
		src.buffer = buffer;
		src.loop = dur > buffer.duration + 0.05;
		src.playbackRate.value = 1 + ( Math.random() - 0.5 ) * 0.01;
		p.panningModel = 'equalpower';
		p.distanceModel = 'inverse';
		p.refDistance = 40;
		p.rolloffFactor = 0.6;
		p.positionX.value = pos.x;
		p.positionY.value = pos.y;
		p.positionZ.value = pos.z;
		g.gain.setValueAtTime( 0, start );
		g.gain.linearRampToValueAtTime( vol * 0.9, start + 0.4 );
		g.gain.setValueAtTime( vol * 0.9, start + dur - 0.3 );
		g.gain.linearRampToValueAtTime( 0, start + dur + 0.2 );
		src.connect( g ).connect( p ).connect( this.bus );
		p.connect( this.sound.reverb );
		src.start( start );
		src.stop( start + dur + 0.3 );

	}

	// ---------------------------------------------------------------- near you

	// in the seats: the people round you, now and then, more when it matters; a whistle, a shout, a pair
	// of hands beside you
	_near( dt, d, camera, L ) {

		const sp = this.space, a = sp.at;
		const inSeats = sp.zone === 'bowl' && a.y > 1.5 && Math.hypot( a.x, a.z ) > 32;
		if ( ! inSeats || ! d.playing ) return;
		const excite = Math.min( 1, L.roar + this.swell * 0.5 + L.clap * 0.5 );
		// a shout or a whistle every ~20 s when it's quiet, every couple of seconds when it isn't
		if ( Math.random() > RATE * ( 0.05 + 0.5 * excite ) ) return;
		const ang = Math.random() * Math.PI * 2, r = 2 + Math.random() * 8;
		const F = this.field, w = F.toWorld( a.x + Math.cos( ang ) * r, a.z + Math.sin( ang ) * r );
		const pos = this._v.set( w.x, camera.position.y + ( Math.random() - 0.3 ) * 1.5, w.z );
		const S = this.sound, pick = Math.random();
		const home = ( d.segmentAt( d.t ).snap?.half ) === 'bottom';
		const shout = this._shoutFor( d, home );
		if ( shout && pick < 0.55 && S.buffers[ 'fans-' + shout ] ) S.spot( 'fans-' + shout, pos, { vol: 0.5 + 0.3 * Math.random(), ref: 3, rate: 0.96 + 0.08 * Math.random() } );
		else if ( pick < 0.8 && this.whistle ) this._oneShot( this.whistle, pos, 0.35 + 0.3 * excite, 0.9 + 0.25 * Math.random() );
		else if ( this.single.length ) for ( let k = 0; k < 5 + excite * 6; k ++ ) this._oneShot( this.single[ k % this.single.length ], pos, 0.5, 1, k * ( 0.19 + 0.03 * Math.random() ) );

	}

	// what someone near you yells now (the fans/ shouts): by the situation (the Phillies batting, the Rays,
	// two strikes, the end) and by who's up or on the mound ("Eva!" at Longoria, as they heckled him)
	_shoutFor( d, home ) {

		const keys = Object.keys( this.index ).filter( ( k ) => k.startsWith( 'shout-' ) );
		if ( ! keys.length ) return null;
		const seg = d.segmentAt( d.t ), s = seg.snap || {}, P = d.game?.players || {};
		const batter = P[ s.batter ]?.last, pitcher = P[ s.defense?.P ?? s.pitcher ]?.last;
		const tags = seg.kind === 'celebrate' ? [ 'win' ] : home ? [ 'bat' ] : [ 'away', ( s.strikes || 0 ) >= 2 ? 'two' : 'pitch' ];
		const fit = keys.filter( ( k ) => {

			const e = this.index[ k ];
			if ( ! ( e.when || 'any' ).split( ',' ).some( ( w ) => w === 'any' || tags.includes( w ) ) ) return false;
			return ! e.who || e.who === batter || e.who === pitcher;

		} );
		// the ones for this very man, mostly
		const named = fit.filter( ( k ) => this.index[ k ].who );
		const list = named.length && Math.random() < 0.7 ? named : fit;
		return list.length ? list[ Math.floor( Math.random() * list.length ) ] : null;

	}

	// the park's answer to the organ: "CHARGE!", the chant back, the claps back
	yell( what ) {

		const from = [ - 70, - 20, 30, 80, 130 ][ Math.floor( Math.random() * 5 ) ];
		if ( what === 'charge' ) this._voice( 'charge', 0.9 );
		else if ( what === 'letsgo' ) this.chant( 'letsgo', from, 1 );
		else if ( what === 'clap' && this.pattern ) {

			const S = this.sound, now = S.ctx.currentTime;
			for ( const k of [ - 1, 0, 1 ] ) {

				const ang = ( from + k * 50 ) * Math.PI / 180, F = this.field, w = F.toWorld( Math.sin( ang ) * 72, Math.cos( ang ) * 72 - 8 );
				this._section( this.pattern, this._v.set( w.x, F.y0 + 14, w.z ), now + 0.05 + Math.abs( k ) * 0.12, 1.25, 0.8 );

			}

		}

	}

	// everyone singing (the stretch): the whole bowl, not from a place
	sing( key, vol = 1 ) {

		this.singing = this.sound.ctx.currentTime + ( this.index[ key ]?.d || 30 );
		return this._voice( key, vol );

	}

	_oneShot( buffer, pos, vol, rate = 1, delay = 0 ) {

		const ctx = this.sound.ctx, src = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createPanner();
		src.buffer = buffer;
		src.playbackRate.value = rate;
		g.gain.value = vol;
		p.panningModel = 'equalpower';
		p.refDistance = 3;
		p.rolloffFactor = 1.2;
		p.positionX.value = pos.x;
		p.positionY.value = pos.y;
		p.positionZ.value = pos.z;
		src.connect( g ).connect( p ).connect( this.sound.master );
		p.connect( this.sound.reverb );
		src.start( ctx.currentTime + delay );

	}

}
