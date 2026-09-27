import { BoxGeometry, CylinderGeometry, SphereGeometry } from '../../../engine/index.js';
import { RAIL, FLAG } from './RailFigures.js';
import { tubePath } from './Tarp.js';
import { put, rnd } from './Props.js';

// The grounds crew, waiting by the tarp in the rain on the 27th. From the 3rd inning, as it came down
// harder, they're out along the tube in their red hooded rain jackets and khakis or navy rain pants (the
// 27th's photos: puffygreenjacket 2983582162, 2983578054; Getty 83884311), most hoods up, arms folded,
// rakes to lean on, the drying agent (white bags printed in blue) stacked on a cart, ready to pull it. Sal, the assistant head groundskeeper (22 years
// with the club, since the Vet), has the radar up on his BlackBerry: the band coming up from Delaware
// is the whole night. Every so often he holds it out to show the man beside him. At the suspension
// they're off to pull the tarp (that's the rituals' part); on the 29th, cold and dry, two of them wait
// by the tube with their rakes.

export class Crew {

	constructor( { group, figs, M } ) {

		this.figs = figs;
		const P = tubePath();
		const L = P[ P.length - 1 ].s;
		const at = ( s, t ) => {

			// a point at s along the tube, t metres toward the field from its axis
			let i = P.findIndex( ( q ) => q.s >= s );
			if ( i < 1 ) i = 1;
			const a = P[ i - 1 ].p, b = P[ i ].p;
			const tx = b[ 0 ] - a[ 0 ], tz = b[ 1 ] - a[ 1 ], tl = Math.hypot( tx, tz ) || 1;
			let nx = - tz / tl, nz = tx / tl;
			if ( nx * ( 0 - a[ 0 ] ) + nz * ( - 38.9 - a[ 1 ] ) < 0 ) { nx = - nx; nz = - nz; }
			return { x: a[ 0 ] + nx * t, z: a[ 1 ] + nz * t, face: Math.atan2( - nx, - nz ) };

		};

		// the crew along the tube's field side, facing the field (the sky over it, the game)
		this.wet = [];
		const spots = [ [ 1.5, 'crewPhone', RAIL.crewChief, 0.2 ], [ 2.6, 'crewStand', RAIL.crew, - 0.3 ], [ 4.4, 'crewRake', RAIL.crew, 0.1 ], [ 6.0, 'crewStand', RAIL.crew, 0.4 ],
			[ 7.7, 'crewStand', RAIL.crew, - 0.2 ], [ 9.5, 'crewRake', RAIL.crew, 0.3 ], [ 11.2, 'crewStand', RAIL.crew, 0.0 ], [ 13.3, 'crewStand', RAIL.crew, - 0.4 ] ];
		spots.forEach( ( [ s, kind, outfit, turn ], i ) => {

			const q = at( s, 1.45 + rnd( i * 3 ) * 0.4 );
			const f = figs.add( kind, { x: q.x, z: q.z, yaw: q.face + turn, outfit, seed: rnd( i * 7.3 + 1 ), flags: FLAG.hood, stout: rnd( i * 2.2 ) * 0.9, scale: 0.95 + rnd( i * 5.1 ) * 0.1, shown: false } );
			this.wet.push( { f, i, turn, face: q.face, chief: kind === 'crewPhone', rake: kind === 'crewRake', hood: rnd( i * 9.7 ) < 0.65 } );

		} );
		// the pair on the 29th, by the tube's near end with their rakes
		this.dry = [ 0.6, 2.0 ].map( ( s, i ) => {

			const q = at( s, 1.5 );
			return figs.add( 'crewRake', { x: q.x, z: q.z, yaw: q.face + ( i ? - 0.3 : 0.25 ), outfit: RAIL.crew, seed: rnd( i * 11 + 4 ), flags: FLAG.cap, stout: 0.3, shown: false } );

		} );

		// the cart of drying agent (white bags printed in blue), a spare rake
		const c = at( 16.2, 1.5 ), d = at( 16.2, 2.5 );
		const yaw = Math.atan2( d.x - c.x, d.z - c.z );
		put( group, new BoxGeometry( 1.1, 0.35, 0.75 ), M.green, [ c.x, 0.45, c.z ], yaw, { shadow: true } );
		for ( const [ dx, dz ] of [ [ - 0.45, - 0.3 ], [ 0.45, - 0.3 ], [ - 0.45, 0.3 ], [ 0.45, 0.3 ] ] ) {

			put( group, new CylinderGeometry( 0.13, 0.13, 0.08, 12 ), M.black, [ c.x + Math.cos( yaw ) * dx + Math.sin( yaw ) * dz, 0.13, c.z - Math.sin( yaw ) * dx + Math.cos( yaw ) * dz ], yaw, { rz: Math.PI / 2 } );

		}

		for ( let k = 0; k < 6; k ++ ) {

			const bx = ( k % 3 - 1 ) * 0.33, bz = ( Math.floor( k / 3 ) - 0.5 ) * 0.34, by = 0.72 + ( k === 4 ? 0.12 : 0 );
			const p = [ c.x + Math.cos( yaw ) * bx + Math.sin( yaw ) * bz, by, c.z - Math.sin( yaw ) * bx + Math.cos( yaw ) * bz ];
			put( group, bagGeometry(), M.white, p, yaw + ( k * 0.37 ) % 0.4 );
			put( group, new BoxGeometry( 0.31, 0.03, 0.2 ), M.blueTarp, [ p[ 0 ], by + 0.035, p[ 2 ] ], yaw + ( k * 0.37 ) % 0.4 );

		}

		const r = at( 17.6, 1.2 );
		put( group, new CylinderGeometry( 0.015, 0.015, 1.6, 5 ), M.wood, [ r.x, 0.03, r.z ], r.face, { rz: Math.PI / 2 } );
		this.at = at;

	}

	update( S, dt ) {

		// out along the tube from the 3rd inning on the 27th, when it came down harder; gone to pull the
		// tarp at the suspension
		const standby = S.first && S.rain > 0.55;
		for ( const w of this.wet ) {

			const f = w.f;
			f.shown = standby;
			f.wet = S.rain;
			// most with the hood up; Sal's down, his red cap on (the head groundskeeper's way)
			f.flags = w.chief || ! w.hood ? FLAG.cap : FLAG.hood;
			if ( w.chief ) {

				// the radar: down at it, then out at arm's length for the man beside him, and back
				const c = ( S.t + 7 ) % 34;
				f.morph = c < 26 ? 0 : c < 27 ? c - 26 : c < 32 ? 1 : 1 - ( c - 32 ) / 2;
				f.look[ 1 ] = f.morph < 0.5 ? 0.55 : 0.1;
				f.look[ 0 ] = f.morph * 0.6;

			} else {

				// arms folded, now and then hands behind the back; a glance up at the sky, at the chief
				f.morph = 0.5 + 0.5 * Math.sin( S.t * 0.05 + w.i * 2.1 );
				f.look[ 0 ] = 0.4 * Math.sin( S.t * 0.13 + w.i );
				f.look[ 1 ] = - 0.25 * Math.max( 0, Math.sin( S.t * 0.07 + w.i * 1.7 ) );

			}

		}

		// the man beside Sal leans in to look at the phone
		const chief = this.wet[ 0 ], next = this.wet[ 1 ];
		if ( chief && next && chief.f.morph > 0.5 ) next.f.look[ 0 ] = 0.7;
		for ( const f of this.dry ) {

			f.shown = ! S.first && ! S.susp;
			f.wet = 0;
			f.look[ 0 ] = 0.3 * Math.sin( S.t * 0.1 + f.seed * 9 );

		}

	}

}

// a bag of drying agent, slumped
let _bag = null;
function bagGeometry() {

	if ( _bag ) return _bag;
	const g = new SphereGeometry( 0.2, 8, 5 );
	g.scale( 0.8, 0.28, 0.55 );
	_bag = g;
	return g;

}
