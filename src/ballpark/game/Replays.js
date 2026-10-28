// FOX's replays of the big plays (FB2, gauntlet round 2, C2B-10). After a play at the plate, a run
// scoring, an extra-base hit, a home run, a tag out or a double play, the broadcast shows it again
// before the next pitch, from another camera and slower: Utley fielding it behind second, Ruiz's tag
// from the first base side, Bartlett down at the plate (U_R8E614TB8 t13240s, t13250s, t13270s).
//
// The replay doesn't touch the replay's clock: director.t (and the radio call synced to it, the crowd,
// the scoreboard) runs on live. For the picture only, the players and the ball are posed at the replayed
// moment of the in-play segment (Director.pose is a pure function of the time), between the live pose
// and the draw (BallparkApp).
//
//   replayPlan( director ) -> [ { seg, w0, w1, tau0, rate, kind } ]: seg the in-play segment; on air from
//                            w0 to w1 (the replay's time), showing seg at seg.t0 + tau0 + ( t - w0 ) * rate
//   replayAt( list, t ) -> { r, tau } or null

export const REPLAY_RATE = 0.7;

export function replayPlan( d ) {

	const S = d.segments, list = [];
	for ( let i = 0; i < S.length - 1; i ++ ) {

		const seg = S[ i ];
		if ( seg.kind !== 'inplay' || ! seg.plan ) continue;
		const plan = seg.plan, s = seg.snap;
		const res = S[ i + 1 ];
		if ( res.kind !== 'result' ) continue;
		// what makes it a replay, and where in the play it starts
		const plate = plan.runners.find( ( r ) => r.to === 4 && r.from > 0 && r.slide );
		const tagOut = plan.runners.find( ( r ) => r.out && r.tag );
		const scores = plan.runners.some( ( r ) => r.to === 4 && ! r.out );
		const outs = plan.runners.filter( ( r ) => r.out ).length;
		const batter = plan.runners.find( ( r ) => r.id === s.batter );
		const xb = batter && ! batter.out && batter.to >= 2;
		let kind = null, tau0 = 0;
		if ( plate ) { kind = 'plate'; tau0 = Math.max( 0, plate.tArrive - 3.2 ); }
		else if ( tagOut ) { kind = 'tag'; tau0 = Math.max( 0, ( tagOut.tCall ?? tagOut.tArrive ) - 2.8 ); }
		else if ( plan.hr ) kind = 'hr';
		else if ( xb ) kind = 'xb';
		else if ( outs >= 2 ) kind = 'dp';
		else if ( scores ) kind = 'run';
		if ( ! kind ) continue;
		// on air from just after the result's start to the next pitch (the walk-up between); after the
		// third out, into the first seconds of the change of sides (as FOX did Utley's play); not into a
		// pitching change, where the picture has other business
		let end = res.t0 + res.dur;
		const next = S[ i + 2 ];
		if ( next?.kind === 'walkup' ) end = next.t0 + next.dur;
		else if ( next?.kind === 'switch' && ! ( next.snap.inning === 6 && next.snap.half === 'bottom' ) ) end = next.t0 + 11;
		const w0 = res.t0 + 0.5, w1 = end - 0.4;
		// the play from tau0 to its end, at the replay's rate, as much of it as fits
		const want = ( seg.dur - 1.5 - tau0 ) / REPLAY_RATE;
		const w = Math.min( want, w1 - w0 );
		if ( w < 3 ) continue;
		list.push( { seg, w0, w1: w0 + w, tau0, rate: REPLAY_RATE, kind, plate, tagOut } );

	}

	return list;

}

export function replayAt( list, t ) {

	for ( const r of list ) {

		if ( t < r.w0 ) return null;
		if ( t < r.w1 ) return { r, tau: r.tau0 + ( t - r.w0 ) * r.rate };

	}

	return null;

}
