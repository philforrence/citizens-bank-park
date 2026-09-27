// The fireworks' sound (synthesized): each shell's boom from where it bursts, late by the time the sound
// takes to come in from out there (340 m/s), then its crackle falling; the gerbs' hiss off the scoreboard.
// Only while the replay plays forward (not while scrubbing).

const hash = ( n ) => {

	const s = Math.sin( n * 12.9898 ) * 43758.5453;
	return s - Math.floor( s );

};

// a shell's report: a low thump with a sharp front, the air ringing, then the stars crackling as they fall
function boom( ctx ) {

	const sr = ctx.sampleRate, n = Math.floor( sr * 2.8 ), b = ctx.createBuffer( 1, n, sr ), d = b.getChannelData( 0 );
	let lp = 0, lp2 = 0;
	for ( let i = 0; i < n; i ++ ) {

		const t = i / sr;
		const noise = Math.random() * 2 - 1;
		lp += ( noise - lp ) * 0.06;
		lp2 += ( lp - lp2 ) * 0.2;
		const body = lp2 * 6 * Math.exp( - t * 5 ) + Math.sin( 2 * Math.PI * 48 * t ) * Math.exp( - t * 7 ) * 0.7;
		const crack = t < 0.012 ? noise * ( 1 - t / 0.012 ) : 0;
		// the crackle: short clicks, thick at first, thinning
		const cr = t > 0.5 && Math.random() < 0.012 * Math.exp( - ( t - 0.5 ) * 1.6 ) ? ( Math.random() * 2 - 1 ) * 0.5 : 0;
		d[ i ] = Math.max( - 1, Math.min( 1, body * 0.8 + crack * 0.9 + cr ) );

	}

	return b;

}

// a gerb: a rushing hiss
function hiss( ctx ) {

	const sr = ctx.sampleRate, n = Math.floor( sr * 3 ), b = ctx.createBuffer( 1, n, sr ), d = b.getChannelData( 0 );
	let hp = 0, prev = 0;
	for ( let i = 0; i < n; i ++ ) {

		const x = Math.random() * 2 - 1;
		hp = 0.92 * ( hp + x - prev );
		prev = x;
		const fade = Math.min( 1, i / ( sr * 0.2 ), ( n - i ) / ( sr * 0.2 ) );
		d[ i ] = hp * 0.35 * fade * ( 0.8 + 0.2 * Math.sin( i / sr * 23 ) );

	}

	return b;

}

export class FireworksSound {

	constructor( { sound, field, plan } ) {

		this.sound = sound;
		this.field = field;
		this.plan = plan;
		this.last = null;
		this.queue = [];
		if ( ! sound?.sample ) return;
		sound.sample( 'rituals-boom', boom );
		sound.sample( 'rituals-hiss', hiss );

	}

	world( p ) {

		const w = this.field.toWorld( p[ 0 ], p[ 2 ] );
		w.y = this.field.y0 + p[ 1 ];
		return w;

	}

	// cel: seconds since the last out (null otherwise); playing: forward play (not a jump); cam: the camera
	update( cel, playing, cam ) {

		const S = this.sound;
		if ( ! S?.spot || cel == null || ! playing ) {

			this.last = cel;
			this.queue.length = 0;
			return;

		}

		const a = this.last ?? cel;
		this.last = cel;
		if ( cel < a || cel - a > 1 ) return;
		this.plan.forEach( ( sh, i ) => {

			if ( sh.t0 <= a || sh.t0 > cel ) return;
			const at = this.world( sh.at );
			if ( sh.kind === 0 ) {

				// heard late: the distance over the speed of sound
				const d = cam ? cam.distanceTo( at ) : 150;
				this.queue.push( { t: cel + d / 340, at, vol: 0.9 + hash( i ) * 0.4, rate: 0.85 + hash( i * 3 ) * 0.3 } );

			} else if ( sh.kind === 1 ) S.spot( 'rituals-hiss', at, { vol: 0.5, ref: 30, max: 400, rolloff: 0.9 } );

		} );
		for ( let k = this.queue.length - 1; k >= 0; k -- ) {

			const q = this.queue[ k ];
			if ( q.t > cel ) continue;
			S.spot( 'rituals-boom', q.at, { vol: q.vol, rate: q.rate, ref: 60, max: 800, rolloff: 0.8 } );
			this.queue.splice( k, 1 );

		}

	}

}
