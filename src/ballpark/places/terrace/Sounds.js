import { sizzle, register, murmur } from '../concourse1b/Sounds.js';
import { LEVELS } from '../../layout.js';

// FW3 (C2W-7, gauntlet r2): what the Terrace concourse sounds like, 81 ft up and open on both sides: the
// wind (gusting through the steel, stronger at the open back over the lots, and the 27th's rain in it),
// the murmur of the people at the rail and walking, the grills hissing at the stands with a flat-top, the
// registers' drawers, a beer man's call now and then (the First Base Gate's Piper voices and synthesized
// sounds: concourse1b/Sounds.js, its CREDITS). Through the park's sound (GameSound.sample / spot); set up
// once it exists, and only heard up there (the place mutes it all when the camera isn't).
const DIR = 'audio/places/concourse1b/';
const NEAR = 40;
const LIFT = LEVELS.terraceConcourse;

function noise( seed ) {

	let a = seed >>> 0;
	return () => {

		a = ( a + 0x6D2B79F5 ) >>> 0;
		let t = a;
		t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
		t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296 * 2 - 1;

	};

}

// the wind: brown-ish noise through a slowly swept band (gusts), a low moan in the steel under it; 12 s
// so the loop doesn't show
export const wind = ( ctx ) => {

	const sr = ctx.sampleRate, n = Math.floor( 12 * sr );
	const b = ctx.createBuffer( 1, n, sr ), d = b.getChannelData( 0 );
	const r = noise( 909 );
	let lp = 0, lp2 = 0, bp = 0, peak = 0;
	for ( let i = 0; i < n; i ++ ) {

		const t = i / sr;
		// the gusts: a sum of slow swells, periodic over the 12 s
		const g = 0.55 + 0.25 * Math.sin( 2 * Math.PI * t / 12 ) + 0.15 * Math.sin( 2 * Math.PI * t * 3 / 12 + 1.3 ) + 0.1 * Math.sin( 2 * Math.PI * t * 7 / 12 + 0.4 );
		const f = 0.004 + 0.02 * g * g;
		lp += ( r() - lp ) * f;
		lp2 += ( lp - lp2 ) * 0.05;
		bp = lp - lp2;
		// the steel's moan: a faint tone that wanders with the gusts
		const moan = 0.08 * g * Math.sin( 2 * Math.PI * ( 180 + 40 * g ) * t + Math.sin( t * 0.7 ) * 3 );
		d[ i ] = bp * g * 6 + moan * 0.3;
		peak = Math.max( peak, Math.abs( d[ i ] ) );

	}

	const fade = Math.min( 2048, n >> 4 );
	for ( let i = 0; i < fade; i ++ ) {

		// crossfade the ends so it loops
		const k = i / fade;
		d[ i ] = d[ i ] * k + d[ n - fade + i ] * ( 1 - k );

	}

	for ( let i = 0; i < n; i ++ ) d[ i ] *= 0.8 / ( peak || 1 );
	return b;

};

export class TerraceSounds {

	constructor( place ) {

		this.place = place;
		this.ready = false;
		this.timers = {};
		this.time = 0;
		this.on = true;

	}

	_init( sound ) {

		this.sound = sound;
		for ( const k of [ 'beer-1', 'beer-2' ] ) sound.sample( 'ter-' + k, DIR + k + '.mp3' );
		sound.sample( 'ter-wind', wind );
		sound.sample( 'ter-sizzle', sizzle );
		sound.sample( 'ter-register', register );
		sound.sample( 'ter-murmur', murmur );
		const pl = this.place;
		// the wind and the murmur go where you are (moved each frame); the grills where they are
		this.wind = sound.spot( 'ter-wind', this._world( 0, 3, 60 ), { loop: true, vol: 0, ref: 6, max: 60, wet: false } );
		this.murmur = sound.spot( 'ter-murmur', this._world( 0, 1.6, 50 ), { loop: true, vol: 0, ref: 8, max: 50 } );
		this.grills = [];
		for ( const U of pl.stands?.units || [] ) {

			if ( ! [ 'fries', 'pub', 'kids' ].includes( U.what ) ) continue;
			const h = sound.spot( 'ter-sizzle', this._world( U.mid[ 0 ] - U.n[ 0 ] * 1.0, 1.2, U.mid[ 1 ] - U.n[ 1 ] * 1.0 ), { loop: true, vol: 0, ref: 3, max: 28 } );
			this.grills.push( h );

		}

		this.ready = true;

	}

	_world( x, y, z ) {

		const F = this.place.field, w = F.toWorld( x, z );
		return { x: w.x, y: F.y0 + LIFT + y, z: w.z };

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

	// dt, the night (nightState), the camera in the field frame [ x, z ], whether it's up here, and how far
	// toward the open back it is (0 at the rail over the 300s, 1 at the back rail)
	update( dt, N, camF, up, back = 0.5 ) {

		const sound = this.place.app?.sound;
		if ( ! sound ) return;
		if ( ! this.ready ) this._init( sound );
		this.time += dt;
		this.cam = camF;
		if ( ! up ) {

			if ( this.on ) {

				this.wind.set( { vol: 0 } );
				this.murmur.set( { vol: 0 } );
				for ( const g of this.grills ) g.set( { vol: 0 } );
				this.on = false;

			}

			return;

		}

		this.on = true;
		const [ x, z ] = camF;
		// the wind: the 27th's was a driving rain, the 29th cold and windy; harder at the open back
		const w = ( N?.first ? 0.32 + 0.25 * ( N.rain || 0 ) : 0.3 ) * ( 0.6 + 0.6 * back );
		this.wind.move( this._world( x, 2.5, z ) ).set( { vol: w } );
		this.murmur.move( this._world( x, 1.6, z ) ).set( { vol: 0.12 + 0.12 * Math.min( 1.2, N?.busy ?? 0.8 ) } );
		for ( const g of this.grills ) g.set( { vol: 0.3 } );
		// the registers at the stands near you, a beer man's call
		const staff = ( this.place.people?.list || [] ).filter( ( a ) => a.kind === 'staff' );
		if ( staff.length && this._every( 'register', 7 ) ) {

			const a = staff[ Math.floor( Math.random() * staff.length ) ];
			this.play( 'ter-register', a.p.x, 1.1, a.p.z, 0.3, 3 );

		}

		const bt = staff.filter( ( a ) => a.at?.brand === 'brewerytown' );
		if ( bt.length && this._every( 'beer', 30 ) ) {

			const a = bt[ Math.floor( Math.random() * bt.length ) ];
			this.play( Math.random() < 0.5 ? 'ter-beer-1' : 'ter-beer-2', a.p.x, 1.6, a.p.z, 0.6 );

		}

	}

}
