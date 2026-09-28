import { Vector3 } from '../../../engine/index.js';
import { rng } from './dsp.js';

// The weather on the ear, by where you stand (Space.js):
//
//   October 27: 47 degrees and a cold rain that got harder all night (the app's rain amount).
//     In the open, GameSound's recorded rain (CC0); under a roof, the rain drumming on the steel deck over
//     you, and the curtain of it past the edge; the gutters and the roof's edge pouring; in the seats,
//     the rain spattering on the ponchos all round you; after the top of the 6th, the tarp: the crew
//     running it out across the infield, then the rain drumming on it.
//   October 29: dry and cold (42-44 F), the wind out of the west 10-20 mph: the recorded wind (CC0) in
//     gusts, stronger up high and in the open; behind center field, the flags cracking and the halyards
//     clanking on the poles (on the 27th too: its rain came on a NNW wind gusting 22-25 mph).
//   Your footsteps (Walker.js asks for them): concrete, wet on the 27th (a splash in it out in the
//     rain), dry and gritty on the 29th.
//   The last out, heard from outside: the car horns starting up round the lots; and, over the roar, the
//     neighborhoods' fireworks going up over South Philadelphia (the Daily News: 'fireworks exploded over
//     South Philadelphia' at 9:58; whose, it doesn't say: here they're far off, over the rowhouses)
//
// Everything's made from noise and a few resonances (Recipes.js, in the worker: 24 kHz, loops of a few
// seconds), each the first time it's wanted.

const SR = 24000;
const FLAGS = [ - 20, - 12, - 4, 4, 12, 20 ].map( ( x, i ) => [ x, 11.5 + [ 19, 22, 26, 22, 19, 17 ][ i ] * 0.55, - 149.5 ] );

export class Weather {

	constructor( { app, field, sound, space, synth } ) {

		this.app = app;
		this.field = field;
		this.sound = sound;
		this.space = space;
		this.synth = synth;
		const ctx = sound.ctx;
		this.bus = sound.buses.weather;
		this.tick = 0;
		this.gust = 0.5;
		this._g = rng( 404 );
		this._v = new Vector3();
		// the loops, silent until wanted
		this.loops = {};
		for ( const [ name, make, verb ] of [ [ 'roof', 'roofDrum', 0.15 ], [ 'poncho', 'ponchoPatter', 0.05 ], [ 'runoff', 'runoff', 0.2 ], [ 'wind', null, 0.1 ] ] ) {

			const src = ctx.createBufferSource(), g = ctx.createGain();
			src.loop = true;
			g.gain.value = 0;
			src.connect( g ).connect( this.bus );
			if ( verb ) {

				const s = ctx.createGain();
				s.gain.value = verb;
				g.connect( s ).connect( sound.reverb );

			}

			// made the first time it's wanted (the roof's drumming only ever on the 27th, under a roof)
			this.loops[ name ] = { src, g, v: 0, make };

		}

		// the steps now (you'll walk), the rest when they're first wanted
		this.steps = null;
		this._need( 'steps', ( b ) => {

			this.steps = { dry: b.slice( 0, 4 ), wet: b.slice( 4 ) };

		} );
		this.stepK = 0;
		this.tarpSpot = null;
		this.flagSpots = [];

	}

	// GameSound's recorded rain onto the weather bus (through a gain the space sets), and the wind loop
	takeRain() {

		const S = this.sound, ctx = S.ctx;
		if ( S.rain?.sampled && ! this._took ) {

			this.rainZone = ctx.createGain();
			S.rain.gain.disconnect();
			S.rain.gain.connect( this.rainZone ).connect( this.bus );
			this._took = true;

		}

		const w = this.loops.wind;
		if ( S.buffers.wind && ! w.src.buffer ) {

			w.src.buffer = S.buffers.wind;
			w.src.start( 0, Math.random() * 15 );

		}

	}

	update( dt, d, camera ) {

		this.tick -= dt;
		if ( this.tick > 0 ) return;
		this.tick = 0.25;
		const S = this.sound, now = S.ctx.currentTime, sp = this.space, w = sp.w;
		const plan = this.app.soundscape?.plan;
		const night2 = d.t >= ( plan?.night2 ?? Infinity );
		const rain = night2 ? 0 : ( this.app.rain?.amount ?? 0 );
		this.wet = ! night2;
		const set = ( n, v, tc = 0.6 ) => {

			if ( Math.abs( n.v - v ) < 0.005 ) return;
			if ( v > 0.005 && n.make && ! n.asked ) {

				n.asked = true;
				this.synth.make( n.make, SR ).then( ( [ b ] ) => {

					n.src.buffer = b;
					n.src.start( 0, Math.random() * b.duration );

				} ).catch( () => {} );

			}

			n.v = v;
			n.g.gain.setTargetAtTime( v, now, tc );

		};

		const roofed = w.roof + w.enclosed;
		// the open rain: all of it outside and in the bowl, the curtain past the edge under a roof
		if ( this.rainZone ) this.rainZone.gain.setTargetAtTime( w.bowl + w.outside + 0.55 * w.roof + 0.12 * w.enclosed, now, 0.4 );
		// the deck over you, and the water coming off its edge
		set( this.loops.roof, 0.55 * rain * ( w.roof + 0.7 * w.enclosed ) * ( sp.ceiling < 20 ? 1 : 0.4 ) );
		set( this.loops.runoff, 0.3 * rain * w.roof );
		// the ponchos round you in the seats
		const inSeats = sp.zone === 'bowl' && sp.at.y > 1.5 && Math.hypot( sp.at.x, sp.at.z ) > 32;
		set( this.loops.poncho, 0.28 * rain * ( inSeats ? 1 : 0.15 ) * w.bowl );
		// the wind: the 29th's gusts (the 27th's rain came on a wind too), stronger up high and in the open
		this.gust += ( this._g() * 0.5 + 0.5 - this.gust ) * 0.18;
		const exposed = w.bowl * ( 0.7 + 0.6 * w.high ) + w.outside * 0.9 + w.roof * 0.35 + w.enclosed * 0.08;
		// (both nights were windy: the 27th's NNW wind gusting 22-25 mph with the rain, "slashing winds"; the
		// 29th's W wind 10-20 mph, colder: PHL's ASOS record and the Inquirer)
		set( this.loops.wind, ( night2 ? 0.34 : 0.3 ) * exposed * ( 0.45 + 0.9 * this.gust * this.gust ), 0.9 );
		this._tarp( d, rain, plan );
		this._flags( night2, exposed );

	}

	// ---------------------------------------------------------------- the tarp

	// the crew running it out (the plan's 'tarp' moment), and while it's down the rain on it
	tarp() {

		const at = this._world( 0, 1, - 20 );
		this.sound.spot( 'wx-tarp-pull', at, { vol: 1.1, ref: 14, max: 400 } );

	}

	_tarp( d, rain, plan ) {

		const S = this.sound;
		const su = plan?.susp;
		// made as the suspension comes near
		if ( su && Math.abs( d.t - su.t0 ) < 120 ) this._need( 'tarp', ( [ pull, rain ] ) => {

			S.buffers[ 'wx-tarp-pull' ] = pull;
			S.buffers[ 'wx-tarp-rain' ] = rain;

		} );

		const on = su && d.t > su.t0 + 6 && d.t < plan.night2;
		if ( on && ! this.tarpSpot && S.buffers[ 'wx-tarp-rain' ] ) this.tarpSpot = S.spot( 'wx-tarp-rain', this._world( 0, 0.5, - 27 ), { loop: true, vol: 0.9 * Math.max( 0.5, rain ), ref: 18, max: 400 } );
		if ( ! on && this.tarpSpot ) {

			this.tarpSpot.stop();
			this.tarpSpot = null;

		}

	}

	// ---------------------------------------------------------------- the flags behind center field

	_flags( night2, exposed ) {

		const S = this.sound, a = this.space.at;
		// the flapping, only near (the Alley, the batter's eye): a loop per pole, strongest in the gusts
		let near = Math.hypot( a.x, a.z + 149.5 ) < 70;
		if ( near ) this._need( 'flags', ( [ flap, clink ] ) => {

			S.buffers[ 'wx-flap' ] = flap;
			S.buffers[ 'wx-clink' ] = clink;

		} );
		near = near && !! S.buffers[ 'wx-flap' ];
		if ( near && ! this.flagSpots.length ) this.flagSpots = FLAGS.map( ( [ x, y, z ] ) => S.spot( 'wx-flap', this._world( x, y + 8, z ), { loop: true, vol: 0, ref: 5, max: 90, rate: 0.9 + Math.random() * 0.2 } ) );
		if ( ! near && this.flagSpots.length ) {

			for ( const h of this.flagSpots ) h.stop();
			this.flagSpots = [];

		}

		// "the wind gusts starch the outfield flags" (Bill Lyon, on the 27th)
		const k = ( night2 ? 0.9 : 1 ) * ( 0.3 + this.gust );
		for ( const h of this.flagSpots ) h.set( { vol: 0.5 * k } );
		// a halyard's snap against its pole, now and then, more in a gust
		if ( near && Math.random() < 0.25 * k ) {

			const [ x, y, z ] = FLAGS[ Math.floor( Math.random() * FLAGS.length ) ];
			S.spot( 'wx-clink', this._world( x, y * ( 0.4 + Math.random() * 0.4 ), z ), { vol: 0.35 + 0.3 * Math.random(), ref: 4, max: 80, rate: 0.9 + Math.random() * 0.25 } );

		}

		void exposed;

	}

	// ---------------------------------------------------------------- your steps

	footstep() {

		const S = this.sound, ctx = S.ctx, w = this.space.w;
		const open = w.bowl + w.outside;
		// wet underfoot on the 27th (splashing out in the rain, damp under cover), dry on the 29th
		if ( ! this.steps ) return;
		const list = this.wet && open > 0.4 ? this.steps.wet : this.steps.dry;
		const src = ctx.createBufferSource(), g = ctx.createGain();
		src.buffer = list[ this.stepK ++ % list.length ];
		src.playbackRate.value = 0.94 + Math.random() * 0.12;
		g.gain.value = 0.22 * ( 0.8 + Math.random() * 0.4 );
		src.connect( g ).connect( S.master );
		g.connect( S.reverb );
		src.start();

	}

	// ---------------------------------------------------------------- the end, from outside

	celebrate() {

		const S = this.sound;
		this._need( 'horns', ( b ) => b.forEach( ( h, k ) => {

			S.buffers[ 'wx-horn-' + k ] = h;

		} ) );
		this._need( 'booms', ( b ) => b.forEach( ( h, k ) => {

			S.buffers[ 'wx-boom-' + k ] = h;

		} ) );
		// over the rowhouses to the north and west, a firework every few seconds for the first couple of minutes
		for ( let k = 0; k < 18; k ++ ) {

			setTimeout( () => {

				if ( ! S.buffers[ 'wx-boom-0' ] ) return;
				const ang = Math.PI * ( 0.55 + 0.7 * Math.random() ), r = 700 + Math.random() * 900;
				const at = this._world( Math.cos( ang ) * r, 60 + Math.random() * 80, - Math.abs( Math.sin( ang ) ) * r );
				S.spot( 'wx-boom-' + ( k % 3 ), at, { vol: 1.6, ref: 250, max: 3000, rolloff: 1, rate: 0.9 + Math.random() * 0.2 } );

			}, ( 2 + k * 6 + Math.random() * 5 ) * 1000 );

		}

		// round the lots and down Pattison and Broad: horns starting up over the next minute and a half
		for ( let k = 0; k < 26; k ++ ) {

			setTimeout( () => {

				if ( this.space.w.outside < 0.5 ) return;
				const ang = Math.random() * Math.PI * 2, r = 150 + Math.random() * 200;
				const at = this._world( Math.cos( ang ) * r, 1, Math.sin( ang ) * r - 30 );
				S.spot( 'wx-horn-' + ( k % 3 ), at, { vol: 0.8 + Math.random() * 0.6, ref: 20, max: 600, rate: 0.93 + Math.random() * 0.14 } );

			}, ( 4 + k * 3.5 + Math.random() * 3 ) * 1000 );

		}

	}

	// a recipe, asked for once
	_need( job, then ) {

		( this._asked ||= new Set() );
		if ( this._asked.has( job ) ) return;
		this._asked.add( job );
		this.synth.make( job, SR ).then( then ).catch( () => {} );

	}

	_world( x, y, z ) {

		const F = this.field, w = F.toWorld( x, z );
		return this._v.set( w.x, F.y0 + y, w.z ).clone();

	}

}
