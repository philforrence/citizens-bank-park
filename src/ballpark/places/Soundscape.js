import { Group } from '../../engine/index.js';
import { buildPlan } from './sound/Plan.js';
import { Space } from './sound/Space.js';
import { PA } from './sound/PA.js';
import { Fans } from './sound/Fans.js';
import { Music } from './sound/Music.js';
import { Weather } from './sound/Weather.js';
import { Synth } from './sound/Synth.js';

// The park's whole soundscape on the nights of October 27 and 29, 2008 (wave 3's S): what you'd hear
// standing in Citizens Bank Park, wherever you stand, on the replay's clock. A place that draws nothing
// (its part name for ?only= is 'sound'); it builds on GameSound (app.sound), whose recorded crowd, bat,
// mitt, rain and wind it keeps, and plays through:
//
//   sound/Space.js    where you are: the open bowl, under the concourse's roof, a tunnel, outside on
//                     the plaza; the park's reverb as rooms, the buses' tone, the air
//   sound/PA.js       Dan Baker at the mic: every batter, every pitching change, the rain, the
//                     suspension, the welcome back, the champions; out of the roof's speaker clusters
//                     with the bowl's echo
//   sound/Music.js    the organ between pitches and innings (public-domain tunes and original riffs),
//                     "Charge!", the Phillies' walk-ups as original stand-ins
//   sound/Fans.js     the crowd as a living thing: the murmur by inning, the two-strike roar, the
//                     groans, the boos, the chants starting in a section and spreading, the claps, the
//                     hush before a big pitch, the fans round you
//   sound/Weather.js  the rain on the roofs, the ponchos, the seats and the tarp (the 27th); the wind,
//                     the flags' halyards (the 29th); your footsteps, wet or dry
//   sound/Plan.js     the night laid out from the replay's segments
//
// It starts with the audio (the first click: GameSound.resume) and is silent with the HUD's sound
// switch (GameSound's master). Per frame it only walks the timeline (a pointer) and nudges a few levels;
// the space is worked out four times a second. The others' moments can hook in:
//   app.soundscape.pa.say( key )        a PA clip (PA.js lists the keys)
//   app.soundscape.at( t, fn )          fn( soundscape ) when the replay passes t (not while scrubbing)
export default class Soundscape {

	constructor( { app, field, bowl } ) {

		this.app = app;
		this.field = field;
		this.bowl = bowl;
		this.group = new Group();
		this.group.name = 'sound';
		this.ready = false;
		this.moments = [];
		this.lastT = null;
		app.soundscape = this;

	}

	// fn( this ) when the replay passes t (playing, not jumping)
	at( t, fn ) {

		this.moments.push( { t, fn } );
		this.moments.sort( ( a, b ) => a.t - b.t );

	}

	_init( S, director ) {

		const app = this.app, field = this.field;
		this.director = director;
		this.plan = buildPlan( director );
		this.synth = new Synth( S.ctx );
		this.space = new Space( { app, field, sound: S } );
		this.space.init( this.synth );
		this.pa = new PA( { app, field, bowl: this.bowl, sound: S, space: this.space } );
		this.music = new Music( { app, sound: S, pa: this.pa, space: this.space } );
		this.fans = new Fans( { app, field, bowl: this.bowl, sound: S, space: this.space, synth: this.synth } );
		this.weather = new Weather( { app, field, sound: S, space: this.space, synth: this.synth } );
		// the master: a gentle limiter at the very end, so the last out doesn't clip
		const ctx = S.ctx, lim = ctx.createDynamicsCompressor();
		lim.threshold.value = - 10;
		lim.knee.value = 8;
		lim.ratio.value = 6;
		lim.attack.value = 0.004;
		lim.release.value = 0.25;
		S.master.disconnect();
		S.master.connect( lim ).connect( ctx.destination );
		// GameSound's reactions and organ come here
		S.hooks = {
			cheer: ( level ) => this.fans.cheer( level ),
			organ: ( tune, delay ) => this.music.organ( tune, delay ),
			celebrate: () => true,
		};
		// the recorded crowd and rain onto the buses (now, or when they've loaded)
		const take = () => {

			this.fans.takeMurmur();
			this.weather.takeRain();

		};

		S.onLoaded = take;
		if ( S.crowd?.sampled ) take();
		// your footsteps (Walker calls audio.footstep)
		if ( app.walker ) app.walker.audio = { footstep: ( k ) => this.weather.footstep( k ) };
		this.i = this._index( director.t );
		this.mi = 0;
		this.ready = true;

	}

	update( dt, director, camera ) {

		const S = this.app.sound;
		if ( ! S?.ctx || ! director ) return;
		if ( ! this.ready ) this._init( S, director );
		this.space.update( dt, camera );
		const t = director.t, last = this.lastT ?? t;
		this.lastT = t;
		const jump = t < last || t - last > 1.5 + dt * director.speed;
		// the PA and the music only at the replay's own pace (at 2x and up they'd tumble over each other)
		this.live = director.playing && director.speed <= 1.25;
		if ( jump ) this._jump( t );
		else if ( director.playing && t > last ) this._fire( last, t );
		this.fans.update( dt, director, camera );
		this.weather.update( dt, director, camera );
		this.music.update( dt, director );
		this.pa.update( dt, director, camera );

	}

	// the events passed since the last frame
	_fire( a, b ) {

		const E = this.plan.events;
		while ( this.i < E.length && E[ this.i ].t <= b ) {

			const e = E[ this.i ++ ];
			if ( e.t > a ) this._event( e );

		}

		const M = this.moments;
		while ( this.mi < M.length && M[ this.mi ].t <= b ) {

			const m = M[ this.mi ++ ];
			if ( m.t > a ) try {

				m.fn( this );

			} catch ( err ) {

				console.warn( 'soundscape moment', err );

			}

		}

	}

	_jump( t ) {

		this.i = this._index( t );
		this.mi = this.moments.findIndex( ( m ) => m.t > t );
		if ( this.mi < 0 ) this.mi = this.moments.length;
		this.pa.stop();
		this.music.stop();
		this.fans.jump();

	}

	_index( t ) {

		const E = this.plan.events;
		let lo = 0, hi = E.length;
		while ( lo < hi ) {

			const m = ( lo + hi ) >> 1;
			if ( E[ m ].t <= t ) lo = m + 1; else hi = m;

		}

		return lo;

	}

	_event( e ) {

		switch ( e.kind ) {

			case 'pa': if ( this.live ) this.pa.say( e.key ); break;
			case 'walkup': if ( this.live ) this.music.walkup( e.id, e.until - e.t ); break;
			case 'music': if ( this.live && ! this._phanatic( e.t, e.until ) ) this.music.play( e.tune, e.until - e.t, e.vol ); break;
			case 'sting': if ( this.live && ! this._phanatic( e.t - 1, e.t + 4 ) && ! this.pa.busy ) this.music.sting( e.tune ); break;
			case 'fans': this.fans.react( e.what, e.level ); break;
			case 'chant': this.fans.chant( e.what, e.from, e.cycles ); break;
			case 'hush': this.fans.hush( e.dur ); break;
			case 'tarp': this.weather.tarp(); break;
			case 'night2': this.fans.welcome(); break;
			case 'celebrate': this.fans.celebrate(); this.weather.celebrate(); break;
			default: break;

		}

	}

	// is the Phanatic's organ on between t0 and t1 (A's plan: its 'organ' and 'charge' cues)? Then the
	// booth leaves it to him
	_phanatic( t0, t1 ) {

		const plan = this.app.places?.find( ( p ) => p.name === 'phanatic' )?.plan;
		if ( ! plan?.events ) return false;
		return plan.events.some( ( e ) => ( e.kind === 'organ' || e.kind === 'charge' ) && e.t > t0 - 6 && e.t < t1 );

	}

}
