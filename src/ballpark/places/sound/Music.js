import { Organ, score } from './Organ.js';
import { TUNES } from './Tunes.js';
import { Band, SONGS, WALKUP } from './Band.js';

// The music between pitches and innings, out of the park's PA speakers (the music bus into PA.js), as the
// A/V booth ran it in 2008 (recorded: there was no live organist that year): organ clips and tunes
// (Organ.js, Tunes.js), the Phillies' walk-up and entrance music and the between-innings rock as original
// stand-ins (Band.js), ducked under Dan Baker while he talks. Notes are scheduled a quarter of
// a second ahead each frame (a sequencer's look-ahead), so nothing is built all at once.
//
//   music.play( tune, seconds, vol )  a tune, faded out by `seconds`
//   music.sting( tune )               a short cue between pitches
//   music.walkup( playerId, seconds ) his walk-up
//   music.organ( 'charge' | 'run' )   GameSound's organ calls (the replay's big hits)

const AHEAD = 0.3;

export class Music {

	constructor( { app, sound, pa, space } ) {

		this.app = app;
		this.sound = sound;
		this.pa = pa;
		this.space = space;
		const ctx = sound.ctx;
		this.bus = ctx.createGain();
		this.bus.gain.value = 1;
		this.bus.connect( sound.buses.music );
		// the organ's clips a little up, the band's well down (measured: the band sat 20 dB over the organ)
		const organTrim = ctx.createGain(), bandTrim = ctx.createGain();
		organTrim.gain.value = 1.4;
		bandTrim.gain.value = 0.3;
		organTrim.connect( this.bus );
		bandTrim.connect( this.bus );
		this.organ_ = new Organ( ctx, organTrim );
		this.band = new Band( ctx, bandTrim );
		this.parts = [];
		this.onYell = null;
		// Baker talks over it: down while he does
		pa.onSay = ( dur, key, delay ) => this.duck( dur, delay );

	}

	// a tune from now, for up to `seconds`, then faded
	play( name, seconds = 20, vol = 1 ) {

		if ( SONGS[ name ] ) {

			this.band.stop();
			return this.band.play( name, seconds, vol );

		}

		const tune = TUNES[ name ];
		if ( ! tune ) return false;
		const ctx = this.sound.ctx, t0 = ctx.currentTime + 0.05;
		const beat = 60 / tune.bpm, ev = score( tune );
		const g = ctx.createGain();
		g.gain.value = vol;
		g.connect( this.organ_.in );
		const len = ( ev.length ? ev[ ev.length - 1 ][ 0 ] + ev[ ev.length - 1 ][ 2 ] : 0 ) * beat;
		const end = t0 + Math.min( seconds, len + 0.5 );
		if ( seconds < len ) {

			g.gain.setValueAtTime( vol, end - 1.6 );
			g.gain.linearRampToValueAtTime( 0.0001, end );

		}

		this.organ_.spin( !! tune.fast );
		const part = { ev, beat, t0, i: 0, end, g, reg: tune.reg || 'full', name };
		this.parts.push( part );
		// the park's answer to a sting: "Charge!", the chant back, the claps
		if ( tune.yell && this.onYell ) setTimeout( () => this.onYell?.( tune.yell ), ( tune.yellAt * beat + 0.05 ) * 1000 );
		return true;

	}

	sting( name ) {

		if ( this.parts.some( ( p ) => ! TUNES[ p.name ]?.sting && p.end > this.sound.ctx.currentTime ) ) return false;
		return this.play( name, 6, 0.95 );

	}

	// a Phillie's walk-up (or a reliever's entrance): his stand-in, by name
	walkup( id, seconds ) {

		const who = this.app.director?.game?.players?.[ id ]?.last;
		const song = WALKUP[ who ];
		if ( ! song ) return false;
		this.stop();
		return this.band.play( song, seconds, 0.9 );

	}

	// GameSound.organ( tune ): "Charge!" after a big hit, the run at the end
	organ( tune ) {

		if ( tune === 'charge' ) return this.play( 'charge', 6, 1 );
		if ( tune === 'run' ) return this.play( 'climb', 4, 1 );
		return false;

	}

	// under the PA: the organ and the walk-ups down while he talks, back up after
	duck( dur, delay = 0 ) {

		const t = this.sound.ctx.currentTime + delay, g = this.bus.gain;
		g.cancelScheduledValues( t );
		g.setTargetAtTime( 0.3, t, 0.08 );
		g.setTargetAtTime( 1, t + dur + 0.2, 0.35 );

	}

	// cut it all (a jump in the replay), or just the organ
	stop( organOnly = false ) {

		const t = this.sound.ctx.currentTime;
		for ( const p of this.parts ) {

			p.g.gain.cancelScheduledValues( t );
			p.g.gain.setTargetAtTime( 0, t, 0.08 );
			p.end = Math.min( p.end, t + 0.3 );

		}

		if ( ! organOnly ) this.band.stop();

	}

	update() {

		const ctx = this.sound.ctx, now = ctx.currentTime;
		for ( let k = this.parts.length - 1; k >= 0; k -- ) {

			const p = this.parts[ k ];
			while ( p.i < p.ev.length ) {

				const [ b, m, d, lvl, perc ] = p.ev[ p.i ];
				const t = p.t0 + b * p.beat;
				if ( t > now + AHEAD ) break;
				p.i ++;
				if ( t < now - 0.05 || t >= p.end ) continue;
				// a live organist: a hair early or late
				this.organ_.note( m, t + ( ( m * 7 + p.i * 13 ) % 11 - 5 ) * 0.0016, Math.min( d * p.beat, p.end - t ), lvl, p.reg, perc, p.g );

			}

			if ( p.i >= p.ev.length && now > p.end + 0.5 ) {

				p.g.disconnect();
				this.parts.splice( k, 1 );

			}

		}

		this.band.update( now );

	}

}
