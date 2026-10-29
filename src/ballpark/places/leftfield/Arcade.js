import { offsetPolyline } from '../../Bowl.js';
import { fieldColliders, RAIL, HIGH } from './Access.js';
import { STREET } from './Frame.js';

// ---- FA2 (step 10, WA2-7): up to the Arcade (233-237) by the Left Field escalator. The 2008 guide: "Left
// Field (behind Section 140) - Takes guests to the Arcade seating area and the West Hall of Fame Club
// Entrance"; FW3 built the escalator from the plaza past the Schmitter to the ramp's landing at the
// Arcade's level, for the eye only, and the Arcade's walkway ended in the air 8 m to its side. Here:
//   the escalator's steps, flats and balustrades as colliders, and it carries you up (ride());
//   the Arcade's walkway carried on along its line past the stands as a steel bridge (a concrete deck on a
//     maroon girder, galvanized rails, maroon posts to the street) to the escalator's top, where a short
//     cross bridge joins its landing (the side rail of FW3's landing open there: Escalator.js);
//   the Arcade walkway's back (the stands' wall, no collider: you walked through Brewerytown and fell 9 m,
//     WA1-5), its ends and the Arcade's rows' end over the plaza as solid rails.
// The ramp's own colliders are Ramp.js's. Field frame throughout.
export function buildArcadeAccess( place, K, site ) {

	const bowl = place.bowl;
	const arc = bowl?.upper?.find( ( t ) => t.name === 'arcade' );
	if ( ! bowl?.ctx || ! arc || ! site ) return null;
	const CL = fieldColliders( bowl );
	const I = ( x, y, z ) => [ x, y, z ];
	I.dir = I;
	const yTop = arc.y0 + ( arc.rows - 1 ) * arc.rise, yC = yTop + 0.25, dRows = arc.rows * arc.depth;
	const C0 = offsetPolyline( arc.front, dRows, [ 0, - 40 ] ), C1 = offsetPolyline( arc.front, dRows + 4, [ 0, - 40 ] );
	const n = arc.front.length;
	// the walkway's back (the stands' wall) and its 3B end: solid; the rows' two ends: rails
	for ( let i = 0; i < n - 1; i ++ ) CL.wall( C1[ i ], C1[ i + 1 ], yC - 0.4, yC + 4.3, 'arcade-back' );
	CL.wall( C0[ 0 ], C1[ 0 ], yC - 0.4, yC + HIGH, 'arcade-end' );
	for ( const j of [ 0, n - 1 ] ) CL.wall( arc.front[ j ], C0[ j ], arc.base, yTop + HIGH, 'arcade-end' );

	// ---- the bridge: the walkway's line on from its LF end (O, along e, out along v) as far as the
	// escalator's top landing (Q), then across to it
	const O = C0[ n - 1 ], E = arc.front[ n - 1 ], D = arc.front[ n - 2 ];
	const el = Math.hypot( E[ 0 ] - D[ 0 ], E[ 1 ] - D[ 1 ] ), e = [ ( E[ 0 ] - D[ 0 ] ) / el, ( E[ 1 ] - D[ 1 ] ) / el ];
	const v = [ ( C1[ n - 1 ][ 0 ] - O[ 0 ] ) / 4, ( C1[ n - 1 ][ 1 ] - O[ 1 ] ) / 4 ];
	const at = ( t, s ) => [ O[ 0 ] + e[ 0 ] * t + v[ 0 ] * s, O[ 1 ] + e[ 1 ] * t + v[ 1 ] * s ];
	const { u, w, L, FLAT, y1 } = site;
	// FW3's landing: from the comb on, toward the ramp's landing (Escalator.js's a, bu, bw)
	const a = [ site.top[ 0 ] + u[ 0 ] * ( FLAT + 1.0 ), site.top[ 1 ] + u[ 1 ] * ( FLAT + 1.0 ) ];
	const bl = Math.hypot( site.land[ 0 ] - a[ 0 ], site.land[ 1 ] - a[ 1 ] ), bu = [ ( site.land[ 0 ] - a[ 0 ] ) / bl, ( site.land[ 1 ] - a[ 1 ] ) / bl ];
	const bw = [ - bu[ 1 ], bu[ 0 ] ], side = bw[ 0 ] * w[ 0 ] + bw[ 1 ] * w[ 1 ] > 0 ? 1 : - 1;
	// where the cross bridge meets the landing's side: 0.5 m along it, its edge (BW 1.6)
	const Q = [ a[ 0 ] + bu[ 0 ] * 0.5 + bw[ 0 ] * 1.6 * side, a[ 1 ] + bu[ 1 ] * 0.5 + bw[ 1 ] * 1.6 * side ];
	const tQ = ( Q[ 0 ] - O[ 0 ] ) * e[ 0 ] + ( Q[ 1 ] - O[ 1 ] ) * e[ 1 ], sQ = ( Q[ 0 ] - O[ 0 ] ) * v[ 0 ] + ( Q[ 1 ] - O[ 1 ] ) * v[ 1 ];
	const LA = tQ + 1.5, near = sQ < 0 ? 0 : 4;
	const yAt = ( t ) => yC + ( y1 - yC ) * Math.min( 1, Math.max( 0, t / LA ) );
	const out = { O, e, v, LA, tQ, sQ, Q };
	// leg A: the walkway on, a stepped floor (the 0.27 m it falls over its length) and its deck drawn
	const N = Math.max( 2, Math.ceil( LA / 1.5 ) );
	for ( let k = 0; k < N; k ++ ) {

		const t0 = LA * k / N, t1 = LA * ( k + 1 ) / N, y = yAt( ( t0 + t1 ) / 2 );
		CL.floor( at( t0, 0 ), at( t1, 0 ), at( t1, 4 ), at( t0, 4 ), y, 'arcade-bridge', 0.4 );
		const P = ( t, s, h ) => { const p = at( t, s ); return [ p[ 0 ], yAt( t ) + h, p[ 1 ] ]; };
		K.use( 'concrete' ).quad( P( t0, 0, 0 ), P( t1, 0, 0 ), P( t1, 4, 0 ), P( t0, 4, 0 ), [ 0, 1, 0 ] );
		K.use( 'maroon' ).quad( P( t0, 0, - 0.7 ), P( t0, 4, - 0.7 ), P( t1, 4, - 0.7 ), P( t1, 0, - 0.7 ), [ 0, - 1, 0 ] );
		for ( const s of [ 0, 4 ] ) K.use( 'maroon' ).quad( P( t0, s, - 0.7 ), P( t1, s, - 0.7 ), P( t1, s, 0 ), P( t0, s, 0 ), [ v[ 0 ] * ( s ? 1 : - 1 ), 0, v[ 1 ] * ( s ? 1 : - 1 ) ] );

	}
	{

		const P = ( t, s, h ) => { const p = at( t, s ); return [ p[ 0 ], yAt( t ) + h, p[ 1 ] ]; };
		K.use( 'maroon' ).quad( P( LA, 0, - 0.7 ), P( LA, 4, - 0.7 ), P( LA, 4, 0 ), P( LA, 0, 0 ), [ e[ 0 ], 0, e[ 1 ] ] );
		// its posts to the plaza, every 6 m under each edge
		for ( let t = 3; t < LA; t += 6 ) for ( const s of [ 0.3, 3.7 ] ) {

			const p = at( t, s );
			K.use( 'maroon' ).box( I, p[ 0 ], ( STREET + yAt( t ) - 0.7 ) / 2, p[ 1 ], 0.36, yAt( t ) - 0.7 - STREET, 0.36 );

		}

	}
	// leg B: across from leg A's near edge to the landing's side
	const B0 = at( tQ, near ), bx = Q[ 0 ] - B0[ 0 ], bz = Q[ 1 ] - B0[ 1 ], bL = Math.hypot( bx, bz );
	const g = [ bx / bL, bz / bL ], h = [ - g[ 1 ], g[ 0 ] ];
	const bAt = ( r, c ) => [ B0[ 0 ] + g[ 0 ] * r + h[ 0 ] * c, B0[ 1 ] + g[ 1 ] * r + h[ 1 ] * c ];
	CL.floor( bAt( - 0.6, - 1.4 ), bAt( - 0.6, 1.4 ), bAt( bL + 0.6, 1.4 ), bAt( bL + 0.6, - 1.4 ), y1, 'arcade-bridge', 0.4 );
	{

		const P = ( r, c, dy ) => { const p = bAt( r, c ); return [ p[ 0 ], y1 + dy, p[ 1 ] ]; };
		K.use( 'concrete' ).quad( P( - 0.1, - 1.4, 0.005 ), P( - 0.1, 1.4, 0.005 ), P( bL, 1.4, 0.005 ), P( bL, - 1.4, 0.005 ), [ 0, 1, 0 ] );
		K.use( 'maroon' ).quad( P( - 0.1, - 1.4, - 0.7 ), P( bL, - 1.4, - 0.7 ), P( bL, 1.4, - 0.7 ), P( - 0.1, 1.4, - 0.7 ), [ 0, - 1, 0 ] );
		for ( const c of [ - 1.4, 1.4 ] ) K.use( 'maroon' ).quad( P( - 0.1, c, - 0.7 ), P( bL, c, - 0.7 ), P( bL, c, 0 ), P( - 0.1, c, 0 ), [ h[ 0 ] * Math.sign( c ), 0, h[ 1 ] * Math.sign( c ) ] );

	}
	// the rails: leg A's two sides (the near one open where leg B leaves), its end; leg B's two sides
	const rail = ( p, q, ya, yb ) => {

		CL.wall( p, q, Math.min( ya, yb ) - 0.4, Math.max( ya, yb ) + HIGH, 'arcade-bridge-rail' );
		K.use( 'galv' ).bar( [ p[ 0 ], ya + RAIL, p[ 1 ] ], [ q[ 0 ], yb + RAIL, q[ 1 ] ], 0.05 );
		K.use( 'galv' ).bar( [ p[ 0 ], ya + 0.5, p[ 1 ] ], [ q[ 0 ], yb + 0.5, q[ 1 ] ], 0.03 );
		const l = Math.hypot( q[ 0 ] - p[ 0 ], q[ 1 ] - p[ 1 ] ), m = Math.max( 1, Math.round( l / 0.13 ) );
		for ( let i = 0; i <= m; i ++ ) {

			const f = i / m, x = p[ 0 ] + ( q[ 0 ] - p[ 0 ] ) * f, z = p[ 1 ] + ( q[ 1 ] - p[ 1 ] ) * f, y = ya + ( yb - ya ) * f;
			K.use( 'galv' ).bar( [ x, y, z ], [ x, y + ( i % 12 === 0 ? RAIL : RAIL - 0.04 ), z ], i % 12 === 0 ? 0.05 : 0.014 );

		}

	};
	const far = 4 - near;
	rail( at( 0, far ), at( LA, far ), yC, y1 );
	rail( at( 0, near ), at( tQ - 1.4, near ), yC, yAt( tQ - 1.4 ) );
	rail( at( tQ + 1.4, near ), at( LA, near ), yAt( tQ + 1.4 ), y1 );
	rail( at( LA, 0 ), at( LA, 4 ), y1, y1 );
	rail( bAt( 0, - 1.4 ), bAt( bL - 0.05, - 1.4 ), y1, y1 );
	rail( bAt( 0, 1.4 ), bAt( bL - 0.05, 1.4 ), y1, y1 );
	// and the far side of the Arcade's walkway at its LF end (where it ran on into the air), up to the bridge
	out.legB = { B0, g, bL };

	// ---- the escalator: the band's treads (0.35 m, 0.2 m risers, as its steps stand), the flats, the
	// balustrades either side up to its handrail, solid from the plaza (you don't walk under it); its
	// landing and FW3's bridge on to the ramp's landing
	{

		const { foot, y0, HW } = site, rise = y1 - y0;
		const P = ( s, t ) => [ foot[ 0 ] + u[ 0 ] * s + w[ 0 ] * t, foot[ 1 ] + u[ 1 ] * s + w[ 1 ] * t ];
		const yS = ( s ) => y0 + Math.max( 0, Math.min( rise, s / L * rise ) ) + 0.05;
		CL.floor( P( - FLAT, - HW ), P( - FLAT, HW ), P( 0, HW ), P( 0, - HW ), y0 + 0.05, 'escalator', 0.3 );
		const nS = Math.ceil( L / 0.35 );
		for ( let k = 0; k < nS; k ++ ) {

			const s0 = L * k / nS, s1 = L * ( k + 1 ) / nS;
			CL.floor( P( s0, - HW ), P( s0, HW ), P( s1, HW ), P( s1, - HW ), yS( s1 ), 'escalator', yS( s1 ) - y0 + 0.02 );

		}
		CL.floor( P( L, - HW ), P( L, HW ), P( L + FLAT + 1.2, HW ), P( L + FLAT + 1.2, - HW ), y1 + 0.05, 'escalator', y1 - y0 );
		// the balustrades (their tops 1.0 over the steps: a rail, not a step), in lengths that follow the rise
		for ( const t of [ - HW - 0.05, HW + 0.05 ] ) {

			for ( let k = - 1; k <= nS / 4; k ++ ) {

				const s0 = Math.max( - FLAT, k * 4 * L / nS ), s1 = Math.min( L + FLAT, ( k + 1 ) * 4 * L / nS + ( k === Math.floor( nS / 4 ) ? FLAT : 0 ) );
				if ( s1 <= s0 ) continue;
				CL.wall( P( s0, t ), P( s1, t ), y0 - 0.1, yS( s1 ) + HIGH, 'escalator-side', 0.1 );

			}

		}
		// FW3's landing and bridge to the ramp: its deck, its two sides (the Arcade's side open by the cross
		// bridge), its end at the ramp's landing open
		const B = ( s, c ) => [ a[ 0 ] + bu[ 0 ] * s + bw[ 0 ] * c, a[ 1 ] + bu[ 1 ] * s + bw[ 1 ] * c ];
		CL.floor( B( - 1.2, - 1.6 ), B( - 1.2, 1.6 ), B( bl, 1.6 ), B( bl, - 1.6 ), y1, 'escalator-landing', 0.5 );
		CL.wall( B( - 1.2, - 1.6 * side ), B( bl, - 1.6 * side ), y1 - 0.4, y1 + HIGH, 'escalator-landing-rail' );
		CL.wall( B( 2.2, 1.6 * side ), B( bl, 1.6 * side ), y1 - 0.4, y1 + HIGH, 'escalator-landing-rail' );
		// (and its back, past the comb, either side of the band)
		CL.wall( B( - 1.2, - 1.6 ), B( - 1.2, - HW - 0.1 ), y1 - 0.4, y1 + HIGH, 'escalator-landing-rail' );
		CL.wall( B( - 1.2, HW + 0.1 ), B( - 1.2, 1.6 ), y1 - 0.4, y1 + HIGH, 'escalator-landing-rail' );

	}
	return out;

}

// The escalator carries whoever stands on its band up the slope at its 0.5 m/s (the walker: LeftField.update)
export function ride( site, field, walker, dt ) {

	if ( ! site || ! walker ) return;
	const p = walker.position, [ x, z ] = field.toField( p.x, p.z ), y = p.y - field.y0;
	const dx = x - site.foot[ 0 ], dz = z - site.foot[ 1 ];
	const s = dx * site.u[ 0 ] + dz * site.u[ 1 ], t = dx * site.w[ 0 ] + dz * site.w[ 1 ];
	if ( s < - 0.3 || s > site.L + 0.6 || Math.abs( t ) > site.HW ) return;
	const yb = site.y0 + Math.max( 0, Math.min( site.y1 - site.y0, s / site.L * ( site.y1 - site.y0 ) ) );
	if ( Math.abs( y - yb ) > 0.6 ) return;
	// along the run at the steps' speed (horizontally: 0.5 cos 30), the treads lift you
	const k = 0.5 * Math.cos( Math.PI / 6 ) * dt;
	const q = field.toWorld( x + site.u[ 0 ] * k, z + site.u[ 1 ] * k );
	p.x = q.x; p.z = q.z;

}
