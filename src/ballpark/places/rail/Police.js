import { CylinderGeometry } from '../../../engine/index.js';
import { FOUL_TERRITORY } from '../../layout.js';
import { offsetPolyline } from '../../Bowl.js';
import { alongPolyline, segLen } from '../../geo.js';
import { RAIL, FLAG } from './RailFigures.js';
import { put, rnd } from './Props.js';

// Security on the warning track, and the police at the end.
//
// All game, event staff sit on stools on the track at the dugouts' far ends and down the lines, in their
// royal-blue jackets and caps and khakis with the radio on the shoulder (on the 27th in blue hooded
// ponchos: qparker71 2841666973, puffygreenjacket 2983578054), facing the stands: their job is the fans, not the game
// (though Tom, at the Phillies' end, has watched every pitch of it over his shoulder).
//
// In the top of the 9th on the 29th, Philadelphia police come out from the corners and file along the
// warning track, spacing themselves out in front of the stands and turning to face them; by the last out
// they line the field from the right field corner round behind home to the left. (The rail brings its
// own line: People.js's is stood down.)

export class Police {

	constructor( { group, figs, M, bowl, people, field } ) {

		this.figs = figs;
		// ---- all game, a Philadelphia officer on the track at each dugout's end, where the roof meets the
		// photographers' well, facing the field (heston 2986442231 / 2986442413, Game 3;
		// puffygreenjacket 2983578054, the 27th)
		this.cops = [];
		for ( const d of field?.dugouts || [] ) {

			const { a, ux, uz, nx, nz } = d;
			const s = d.roof[ 1 ] + 0.3, t = - 1.25;
			const x = a[ 0 ] + ux * s + nx * t, z = a[ 1 ] + uz * s + nz * t;
			const yaw = Math.atan2( nx, nz ) + ( d.side === 'first' ? 0.5 : - 0.5 );
			const f = figs.add( 'police', { x, z, yaw, outfit: RAIL.police, seed: d.side === 'first' ? 0.77 : 0.28, flags: FLAG.cap, stout: 0.6, scale: 1.02 } );
			this.cops.push( f );

		}

		// ---- late on the 29th, a line of officers up on the visitors' dugout roof, facing the crowd
		// (puffygreenjacket 2994329550, 'Security on the Dugout', 9:32 pm)
		this.roof = [];
		for ( const d of field?.dugouts || [] ) {

			if ( d.side !== 'third' ) continue;
			const { a, ux, uz, nx, nz } = d;
			const s0 = d.roof[ 0 ] + 0.6, s1 = d.roof[ 1 ] - 0.6, n = 9;
			for ( let k = 0; k < n; k ++ ) {

				const s = s0 + ( s1 - s0 ) * ( k + 0.5 ) / n, t = 2.2 + ( rnd( k * 7.7 ) - 0.5 ) * 0.4;
				this.roof.push( figs.add( 'police', { x: a[ 0 ] + ux * s + nx * t, y: 1.75, z: a[ 1 ] + uz * s + nz * t, yaw: Math.atan2( - nx, - nz ) + ( rnd( k * 3.9 ) - 0.5 ) * 0.4, outfit: RAIL.police, seed: rnd( k * 6.1 + 3 ), flags: FLAG.cap, stout: rnd( k * 1.7 ) * 0.9, scale: 0.96 + rnd( k * 2.9 ) * 0.1, shown: false } ) );

			}

		}

		// ---- event staff on their stools
		this.staff = [];
		const F = FOUL_TERRITORY;
		const spot = ( a, b, s, t ) => {

			const len = segLen( a, b ), u = [ ( b[ 0 ] - a[ 0 ] ) / len, ( b[ 1 ] - a[ 1 ] ) / len ];
			let n = [ - u[ 1 ], u[ 0 ] ];
			if ( n[ 0 ] * ( 0 - a[ 0 ] ) + n[ 1 ] * ( - 38.9 - a[ 1 ] ) < 0 ) n = [ - n[ 0 ], - n[ 1 ] ];
			return { x: a[ 0 ] + u[ 0 ] * s + n[ 0 ] * t, z: a[ 1 ] + u[ 1 ] * s + n[ 1 ] * t, crowd: Math.atan2( n[ 0 ], n[ 1 ] ) };

		};

		[ [ F[ 4 ], F[ 3 ], 0.6, 0.9 ], [ F[ 9 ], F[ 10 ], 0.6, 0.9 ], [ F[ 3 ], F[ 2 ], 3.0, 0.9 ], [ F[ 10 ], F[ 11 ], 19.5, 2.5 ] ].forEach( ( [ a, b, s, t ], i ) => {

			// (down the third base line he sits out in front of the tarp's tube)
			const p = spot( a, b, s, t );
			// turned half toward the crowd, half along the line
			const yaw = p.crowd + ( i % 2 ? - 0.5 : 0.5 );
			put( group, new CylinderGeometry( 0.16, 0.16, 0.04, 12 ), M.black, [ p.x, 0.6, p.z ], 0 );
			for ( let k = 0; k < 3; k ++ ) {

				const ang = k * Math.PI * 2 / 3;
				put( group, new CylinderGeometry( 0.012, 0.012, 0.6, 5 ), M.metal, [ p.x + Math.cos( ang ) * 0.1, 0.3, p.z + Math.sin( ang ) * 0.1 ], 0, { rx: Math.sin( ang ) * 0.1, rz: - Math.cos( ang ) * 0.1 } );

			}

			const seed = rnd( i * 4.1 + 2 );
			const sit = figs.add( 'security', { x: p.x, z: p.z, yaw, outfit: RAIL.security, seed, flags: FLAG.cap, stout: rnd( i * 7 ) * 0.9 } );
			const stand = figs.add( 'securityStand', { x: p.x + Math.sin( yaw ) * - 0.3, z: p.z + Math.cos( yaw ) * - 0.3, yaw: p.crowd, outfit: RAIL.security, seed, flags: FLAG.cap, stout: rnd( i * 7 ) * 0.9, shown: false } );
			this.staff.push( { sit, stand, crowd: p.crowd, i } );

		} );

		// ---- the police line: round the infield stands' front, 1.8 m out from the wall, every 4.5 m
		if ( people?.policeLine ) {

			for ( const p of people.policeLine ) p.visible = false;
			people.policeLine = [];

		}

		const path = bowl?.path;
		this.line = [];
		if ( ! path ) return;
		const L0 = offsetPolyline( path.slice( 1, 11 ), - 1.8, [ 0, - 40 ] );
		let L = 0;
		for ( let i = 0; i < L0.length - 1; i ++ ) L += segLen( L0[ i ], L0[ i + 1 ] );
		this.path = L0;
		this.L = L;
		const n = Math.floor( L / 4.5 );
		for ( let k = 0; k <= n; k ++ ) {

			const s = ( k + 0.5 ) * L / ( n + 1 );
			const { p, dir } = alongPolyline( L0, s );
			// the crowd side: away from the field
			let cx = - dir[ 1 ], cz = dir[ 0 ];
			if ( cx * ( 0 - p[ 0 ] ) + cz * ( - 38.9 - p[ 1 ] ) > 0 ) { cx = - cx; cz = - cz; }
			const seed = rnd( k * 3.3 + 0.7 );
			const flags = rnd( k * 5.9 ) < 0.2 ? FLAG.helmet : FLAG.cap;
			const scale = 0.95 + rnd( k * 2.2 ) * 0.12, stout = rnd( k * 8.8 ) * 0.9;
			// down the third base line past the visitors' dugout, the bike patrol in their yellow jackets,
			// astride their bikes (the Commons photo of the last out)
			const bike = p[ 0 ] < - 33 && p[ 1 ] < - 10;
			const walk = figs.add( bike ? 'bikeRide' : 'policeWalk', { x: p[ 0 ], z: p[ 1 ], outfit: bike ? RAIL.bikeCop : RAIL.police, seed, flags: bike ? FLAG.helmet : flags, scale, stout, shown: false } );
			// ( a bike stands along the wall, its rider looking over his shoulder at the stands )
			const along = Math.atan2( - dir[ 0 ], - dir[ 1 ] ) + ( rnd( k * 1.3 ) < 0.5 ? 0 : Math.PI );
			const stand = figs.add( bike ? 'bikeStand' : 'police', { x: p[ 0 ], z: p[ 1 ], yaw: bike ? along : Math.atan2( - cx, - cz ), outfit: bike ? RAIL.bikeCop : RAIL.police, seed, flags: bike ? FLAG.helmet : flags, scale, stout, shown: false } );
			// from the nearer corner: the right field one for the first base half, the left for the rest
			const fromStart = s < L / 2;
			this.line.push( { walk, stand, s, fromStart, phase: rnd( k ) * 6, bike, crowdYaw: Math.atan2( - cx, - cz ) } );

		}

		// the order they come out: from each corner the ones going farthest first
		for ( const side of [ true, false ] ) {

			const list = this.line.filter( ( o ) => o.fromStart === side ).sort( ( a, b ) => side ? b.s - a.s : a.s - b.s );
			list.forEach( ( o, i ) => { o.delay = i * 1.3; } );

		}

		this.t0 = null;

	}

	update( S, dt, director ) {

		// the staff: on their stools all game; standing at the 9th's last out
		const end = S.inning === 9 && S.half === 'top' && ! S.first && ( S.snap.outs >= 2 || S.celebrate ) || S.celebrate;
		for ( const w of this.staff ) {

			w.sit.shown = ! end;
			w.stand.shown = end;
			// Tom watches the game over his shoulder; the others scan the stands
			w.sit.look[ 0 ] = w.i === 0 ? 0.9 * Math.max( 0, Math.sin( S.t * 0.05 ) ) : 0.5 * Math.sin( S.t * 0.2 + w.i * 2 );
			w.stand.morph = 0.5 + 0.5 * Math.sin( S.t * 0.3 + w.i );
			w.sit.wet = w.stand.wet = S.first ? S.rain * 0.8 : 0;
			w.sit.flags = w.stand.flags = S.first ? FLAG.hood : FLAG.cap;

		}

		// the officers at the dugouts' ends: parade rest, now and then the arms folded; an eye on the plate
		this.cops.forEach( ( f, i ) => {

			f.morph = Math.max( 0, Math.sin( S.t * 0.013 + i * 2 ) );
			f.look[ 0 ] = ( i ? 0.6 : - 0.6 ) * Math.max( 0, Math.sin( S.t * 0.09 + i ) );
			f.wet = S.first ? S.rain * 0.8 : 0;

		} );
		// up on the visitors' dugout roof from the 8th on the 29th
		const late = ! S.first && ( S.inning >= 8 || S.celebrate );
		this.roof.forEach( ( f, i ) => {

			f.shown = late;
			f.morph = i % 3 === 1 ? 1 : 0;
			f.look[ 0 ] = 0.4 * Math.sin( S.t * 0.11 + i * 1.3 );

		} );
		if ( ! this.line.length ) return;
		// the police: out a little into the top of the 9th, in place well before the last out
		if ( this.t0 == null ) {

			const seg = director.segments.find( ( s ) => s.snap && s.snap.inning === 9 && s.snap.half === 'top' && s.kind === 'switch' );
			this.t0 = seg ? seg.t0 + 40 : ( director.segments.find( ( s ) => s.kind === 'celebrate' )?.t0 ?? 1e9 ) - 120;

		}

		const tau = S.t - this.t0;
		for ( const o of this.line ) {

			o.walk.shown = false;
			o.stand.shown = false;
			if ( tau < o.delay ) continue;
			// walking in single file along the track from their corner (the bikes riding in), then turned
			// to face the stands
			const go = ( tau - o.delay ) * ( o.bike ? 3.6 : 1.7 );
			const dist = o.fromStart ? o.s : this.L - o.s;
			if ( go < dist ) {

				const s = o.fromStart ? go : this.L - go;
				const { p, dir } = alongPolyline( this.path, s );
				o.walk.shown = true;
				o.walk.x = p[ 0 ]; o.walk.z = p[ 1 ];
				const d = o.fromStart ? dir : [ - dir[ 0 ], - dir[ 1 ] ];
				o.walk.yaw = Math.atan2( - d[ 0 ], - d[ 1 ] );
				o.phase += dt * ( o.bike ? 7 : 1.7 * 5.2 );
				o.walk.morph = Math.sin( o.phase ) * ( o.bike ? 1 : 0.85 );
				o.walk.y = o.bike ? 0 : Math.abs( Math.cos( o.phase ) ) * 0.025;

			} else {

				o.stand.shown = true;
				// parade rest; a few fold their arms as it goes on
				o.stand.morph = o.bike ? 0 : Math.min( 1, Math.max( 0, ( go - dist ) / 60 ) ) * ( o.s % 3 < 1 ? 1 : 0 );
				o.stand.look[ 0 ] = o.bike ? Math.max( - 1.2, Math.min( 1.2, wrap( o.crowdYaw - o.stand.yaw ) ) ) : 0.35 * Math.sin( S.t * 0.15 + o.s );

			}

		}

	}

}

const wrap = ( a ) => {

	while ( a > Math.PI ) a -= 2 * Math.PI;
	while ( a < - Math.PI ) a += 2 * Math.PI;
	return a;

};
