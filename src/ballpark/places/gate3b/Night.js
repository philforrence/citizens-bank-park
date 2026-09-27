// The replay's clock, read for the plaza: which night it is, how hard it's raining, how many people are
// still arriving, whether it's over. (The same reading of the timeline as BallparkApp._weather.)
//
// The 27th: first pitch at 8:37 in light rain, harder and harder until they stopped after the top of the
// 6th. The 29th: the game picked up at the bottom of the 6th at 8:37 again, cold and windy and dry;
// the last out at 9:58 and the celebration.

export function night( director ) {

	if ( ! director ) return { t: 0, first: true, k: 0.5, rain: 0.6, rate: 0.4, celebrate: false, since: 600, seg: null };
	const t = director.t;
	const seg = director.segmentAt( t );
	const s = seg?.snap || {};
	const inning = s.inning ?? 1, half = s.half ?? 'top';
	const first = inning < 6 || ( inning === 6 && half === 'top' );
	const k = first ? Math.min( 1, ( ( inning - 1 ) * 2 + ( half === 'top' ? 0 : 1 ) ) / 10 ) : 0;
	const rain = first ? 0.3 + 0.7 * k : 0;
	// when the second night starts (the suspension's break)
	director._w1Night2 ??= director.segments.find( ( q ) => q.kind === 'switch' && q.snap?.inning === 6 && q.snap?.half === 'bottom' )?.t0 ?? 2143;
	const t2 = director._w1Night2;
	const celebrate = seg?.kind === 'celebrate';
	// seconds since the night's first pitch
	const since = first ? t : t - t2;
	// the arrivals: a rush at first pitch (lines at every lane, people running from the lots), thinning
	// through the first innings to the odd straggler; again when the game picks up on the 29th
	// (eight lanes scan ~1.6 a second between them: past that the lines grow)
	const rate = celebrate ? 0 : first ? 0.05 + 2.0 * Math.exp( - since / 200 ) : 0.04 + 1.6 * Math.exp( - since / 160 );
	return { t, first, k, rain, rate, celebrate, since, seg, inning, half, t2 };

}
