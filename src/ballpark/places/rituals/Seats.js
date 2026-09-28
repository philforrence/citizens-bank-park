// The stands through the suspension: on the 27th the seats empty as the rain delay goes on (the ones
// out in the rain first, under the concourses to wait it out) and then, once it's called off, into the
// rain for the exits, a few diehards left; on the 29th the park fills again for the resumption, back to
// the sellout by the bottom of the 6th. Done through Crowd.vacate (the seated fans' own test: one of
// ours, whose threshold moves), refreshed a step at a time (it rewrites every fan's flag), never more
// than every ~1.5 s while it plays, and at once after a jump.
//
// Which seats go first: mostly chance, a little by height (the upper deck, out in the wind and the
// rain, empties first and fills last).

const STEP = 0.07;

export class Seats {

	constructor( { bowl, field } ) {

		this.crowd = bowl?.crowd || null;
		this.level = 0;
		this.applied = 0;
		this.since = 99;
		if ( ! this.crowd?.vacate ) return;
		const y0 = field.y0;
		this.crowd.vacate( ( p ) => {

			if ( this.level <= 0 ) return false;
			const y = p.y - y0;
			const s = Math.sin( p.x * 12.9898 + p.z * 78.233 + y * 37.719 ) * 43758.5453;
			const h = s - Math.floor( s );
			const rank = 0.72 * h + 0.28 * Math.min( 1, Math.max( 0, 1 - y / 32 ) );
			return rank < this.level;

		} );

	}

	// how empty the stands are (0 full .. 1), from the night: N = director.night(), ann: when the
	// suspension is announced (s into the break)
	static emptiness( N, ann ) {

		const sm = ( a, b, x ) => {

			const t = Math.min( 1, Math.max( 0, ( x - a ) / ( b - a ) ) );
			return t * t * ( 3 - 2 * t );

		};

		if ( ! N?.susp ) return 0;
		if ( N.delay ) return 0.05 + 0.2 * sm( 3, 45, N.lt ) + 0.6 * sm( ann, ann + 24, N.lt );
		// the 29th: the tarp comes off in the empty park; the gates open (5:30) and it fills, full by the song
		const l2 = N.lt - ( N.split - N.t0 );
		return 0.9 * ( 1 - sm( 10, 28, l2 ) );

	}

	update( N, ann, dt, jumped ) {

		if ( ! this.crowd?._writeIds ) return;
		this.since += dt;
		const want = Math.round( Seats.emptiness( N, ann ) / STEP ) * STEP;
		if ( Math.abs( want - this.applied ) < 1e-6 ) return;
		if ( ! jumped && this.since < 1.5 ) return;
		this.level = want;
		this.applied = want;
		this.since = 0;
		if ( this.crowd._ids ) this.crowd._writeIds();

	}

}
