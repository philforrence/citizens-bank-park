// Where the replay is, for the Alley: which night (the rain on the 27th until the suspension after the top
// of the 6th, the cold and the wind on the 29th), what's happening on the field, and the time on the clock
// over center field.
//
// The clock: FOX's first pitch on Monday, October 27, was at 8:38 pm, and the game was stopped after the
// top of the 6th at 10:40 pm and suspended; it resumed on Wednesday, October 29, at 8:37 pm with the
// bottom of the 6th, and Brad Lidge struck out Eric Hinske at 9:58 pm. The replay runs faster than the
// game did: its clock runs between those moments in step with the replay (so the minute hand creeps).

const T27 = [ 20 + 38 / 60, 22 + 40 / 60 ], T29 = [ 20 + 37 / 60, 21 + 58 / 60 ];

export function when( director ) {

	const d = director;
	const seg = d.segmentAt( d.t );
	const snap = seg.snap || {};
	const { inning = 1, half = 'top' } = snap;
	const firstNight = inning < 6 || ( inning === 6 && half === 'top' );
	// the suspension: the break after the top of the 6th (the tarp goes on, the park empties)
	// ---- R (rituals): the break's first part is the 27th's delay (Director.night()); the rest the 29th
	const suspended = seg.kind === 'switch' && inning === 6 && half === 'bottom' && ( d.night ? d.night( d.t ).night === 27 : true );
	// ---- end R
	const lt = d.t - seg.t0;
	// how hard it's raining (as BallparkApp._weather has it: harder and harder to the suspension)
	const k = firstNight ? Math.min( 1, ( ( inning - 1 ) * 2 + ( half === 'top' ? 0 : 1 ) ) / 10 ) : 0;
	const rain = firstNight || suspended ? 0.3 + 0.7 * ( suspended ? 1 : k ) : 0;
	// the replay's span of each night: from its start to the suspension, from the resumption to the end
	const segs = d.segments;
	const iSusp = segs.findIndex( ( s ) => s.kind === 'switch' && s.snap.inning === 6 && s.snap.half === 'bottom' );
	const tSusp = iSusp >= 0 ? segs[ iSusp ].t0 : d.duration * 0.6;
	const tResume = iSusp >= 0 ? segs[ iSusp ].t0 + segs[ iSusp ].dur : tSusp;
	// ---- R: where the 27th's part of the break ends (the 29th's evening before 8:37 after it)
	const tSplit = d.night ? d.night( d.t ).split : tResume;
	// ---- end R
	const cel = segs.find( ( s ) => s.kind === 'celebrate' );
	const tEnd = cel ? cel.t0 : d.duration;
	let clock;
	if ( d.t < tSusp ) clock = T27[ 0 ] + ( T27[ 1 ] - T27[ 0 ] ) * d.t / tSusp;
	// ---- R: the delay, 10:40 to 11:50 pm (the tarp at 10:40, called at 11:10, the last few gone ~11:50)
	else if ( d.t < tSplit ) clock = T27[ 1 ] + ( 70 / 60 ) * ( d.t - tSusp ) / Math.max( 1, tSplit - tSusp );
	// ---- end R
	// ---- R: the 29th's evening before the resumption: the gates open, the clock coming up to 8:37
	else if ( d.t < tResume ) clock = T29[ 0 ] - ( tResume - d.t ) / 60 * 0.75;
	// ---- end R
	else if ( d.t < tEnd ) clock = T29[ 0 ] + ( T29[ 1 ] - T29[ 0 ] ) * ( d.t - tResume ) / Math.max( 1, tEnd - tResume );
	else clock = T29[ 1 ] + ( d.t - tEnd ) / 3600;
	return {
		seg, snap, lt, inning, half, firstNight, suspended, rain, clock,
		night: firstNight || suspended ? 27 : 29,
		celebrate: seg.kind === 'celebrate',
		// who's pitching and who's up in the pens
		fielding: snap.fielding || ( half === 'top' ? 'home' : 'away' ),
	};

}
