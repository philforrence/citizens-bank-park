import { TOP, COLOR, HAT, CHEST, PROP, restPose } from '../Cast.js';
import { dress, sizeOf, railArms, rng, GESTURE } from '../Concourse3BKit.js';
import { cadence, due } from '../Tempo.js';
import { LEVELS } from '../../layout.js';

// FW3 (C2W-7, gauntlet r2): the Terrace concourse's people on a sold-out World Series night (the scouting:
// "one person in it now"). A troupe of the Cast (Cast.js), moved on the place's Tempo and each by cadence():
//   at the rail over the 300s, watching: two deep behind home plate, a few to a section down the lines,
//     leaning on the glass's top rail, now and then turning to talk, cheering a Phillies run;
//   walking the concourse both ways between the rail and the stands, some carrying a beer or a cocoa;
//   behind the counters, two to a stand, one at a window; in line in front, as many as the inning brings;
//   an usher in the red jacket at the foot of each stair up to the 400s;
//   at the back rail between the stands, looking out over the lots and the city, in the wind.
// Field frame, all at the Terrace's floor. Invented and unnamed: no CAST.md entry.

const Y = LEVELS.terraceConcourse;
const TAU = Math.PI * 2;
const yawOf = ( fx, fz ) => Math.atan2( - fx, - fz );
const wrap = ( a ) => Math.atan2( Math.sin( a ), Math.cos( a ) );

// a point s metres along a polyline, its direction
function along( P, cum, s ) {

	let i = 0;
	while ( i < P.length - 2 && cum[ i + 1 ] < s ) i ++;
	const l = cum[ i + 1 ] - cum[ i ] || 1, t = ( s - cum[ i ] ) / l;
	const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
	return [ ax + ( bx - ax ) * t, az + ( bz - az ) * t, ( bx - ax ) / l, ( bz - az ) / l ];

}

export class TerracePeople {

	constructor( place, cast, T, C ) {

		this.place = place;
		this.cast = cast;
		this.r = rng( 3303 );
		this.list = [];
		this.time = 0;
		this.frame = 0;
		const r = this.r, D = place.bowl.D;
		// the walking line, down the middle of the concourse (between the stairs and the stands' lines)
		const W = T.line( D.t400 + 5.6 );
		const cum = [ 0 ];
		for ( let i = 1; i < W.length; i ++ ) cum.push( cum[ i - 1 ] + Math.hypot( W[ i ][ 0 ] - W[ i - 1 ][ 0 ], W[ i ][ 1 ] - W[ i - 1 ][ 1 ] ) );
		this.walk = { P: W, cum, L: cum[ cum.length - 1 ] };
		const fan = ( o = {} ) => {

			const L = dress( r, o );
			return { L, k: sizeOf( L, r ) };

		};
		const add = ( kind, L, k, extra ) => {

			const p = this.cast.add( L );
			if ( ! p ) return null;
			p.scale = k;
			p.y = extra?.y ?? Y;
			const a = { p, kind, k, seed: r(), ...extra };
			this.list.push( a );
			return a;

		};

		// ---- at the rail over the 300s: the rail line's stretches between the aisle heads
		const R = T.line( T.dRail + 0.12 + 0.45 );
		const rcum = [ 0 ];
		for ( let i = 1; i < R.length; i ++ ) rcum.push( rcum[ i - 1 ] + Math.hypot( R[ i ][ 0 ] - R[ i - 1 ][ 0 ], R[ i ][ 1 ] - R[ i - 1 ][ 1 ] ) );
		const RL = rcum[ rcum.length - 1 ];
		let placed = 0;
		for ( let s = 2; s < RL - 2 && placed < 60; ) {

			const [ x, z, ux, uz ] = along( R, rcum, s );
			const nearHead = T.heads.some( ( h ) => Math.hypot( h.x - x, h.z - z ) < 1.3 );
			const home = Math.abs( Math.atan2( x, z ) ) < 0.5;
			if ( ! nearHead ) {

				// toward the field from here
				let nx = - uz, nz = ux;
				if ( nx * ( - x ) + nz * ( - 40 - z ) < 0 ) {

					nx = - nx; nz = - nz;

				}

				const { L, k } = fan();
				const a = add( 'rail', L, k, { x: x - nx * 0.02, z: z - nz * 0.02, yaw: yawOf( nx, nz ) + ( r() - 0.5 ) * 0.25, arms: railArms( k, 0.22 + 0.1 * r() ) } );
				if ( a ) placed ++;
				// a second rank behind him behind home plate (auds, the 27th: two deep)
				if ( home && r() < 0.6 ) {

					const f2 = fan();
					add( 'stand', f2.L, f2.k, { x: x + nx * 0.75 + ux * 0.3, z: z + nz * 0.75 + uz * 0.3, yaw: yawOf( nx, nz ) + ( r() - 0.5 ) * 0.4, gesture: r() < 0.3 ? 'warm' : r() < 0.5 ? 'fold' : 'pockets', prop: r() < 0.3 ? PROP.cocoa : 0 } );

				}

			}

			s += home ? 1.0 + r() * 1.2 : 2.4 + r() * 5.5;

		}

		// ---- walking the concourse, both ways
		for ( let i = 0; i < 48; i ++ ) {

			const { L, k } = fan();
			const carry = r() < 0.35 ? [ PROP.beer, PROP.cocoa, PROP.beers, PROP.soda, PROP.hotdog ][ Math.floor( r() * 5 ) ] : 0;
			add( 'walk', L, k, { s: r() * this.walk.L, dir: r() < 0.5 ? - 1 : 1, speed: 1.05 + 0.45 * r(), lane: ( r() - 0.5 ) * 4.2, carry, phase: r() * TAU } );

		}

		// ---- the stands: behind the counters, and in line (the Terrace's, and the Pavilion's and the Arcade's
		// walkways', at their own floors)
		for ( const st of [ ...C.spots, ...( C.gallery || [] ) ] ) {

			const y = st.y ?? Y;

			const yaw = yawOf( st.n[ 0 ], st.n[ 1 ] );
			const staffLook = () => ( { ...fan().L, top: TOP.staff, color: COLOR.red, sleeves: r() < 0.5 ? COLOR.black : COLOR.red, chest: CHEST.staff, hat: r() < 0.7 ? HAT.capBlack : HAT.visor, back: 0, poncho: 0, scarf: 0, gloves: false, pants: 3, shoes: 1 } );
			for ( const off of st.staff || [ 0 ] ) {

				const x = st.mid[ 0 ] + st.u[ 0 ] * off - st.n[ 0 ] * ( st.inset ?? 0.6 ), z = st.mid[ 1 ] + st.u[ 1 ] * off - st.n[ 1 ] * ( st.inset ?? 0.6 );
				add( 'staff', staffLook(), 0.96 + 0.06 * r(), { x, z, yaw, at: st, y } );

			}

			if ( st.kind !== 'food' ) continue;
			// a line out from the counter, the inning decides how long
			for ( let q = 0; q < 4; q ++ ) {

				const off = 0.9 + q * 0.8, side = ( r() - 0.5 ) * 0.3;
				const { L, k } = fan();
				if ( st.tier && q > 1 ) continue; // (the walkways are 4 m deep)
				add( 'line', L, k, { x: st.mid[ 0 ] + st.n[ 0 ] * off + st.u[ 0 ] * side, z: st.mid[ 1 ] + st.n[ 1 ] * off + st.u[ 1 ] * side, yaw: yaw + Math.PI + ( r() - 0.5 ) * 0.35, q, at: st, y } );

			}

		}

		// ---- an usher at the foot of each stair
		for ( const S of T.stairs ) {

			const female = r() < 0.4, old = r() < 0.6;
			const L = { ...fan().L, top: TOP.usher, color: COLOR.red, sleeves: COLOR.red, hat: HAT.capRed, pants: 2, shoes: 1, age: old ? 1 : 0, hair: old ? 7 : 1, female, hairStyle: female ? 2 : 0, back: 0, chest: 0, poncho: 0, scarf: 0 };
			// beside it, facing the walk
			add( 'usher', L, 0.97 + 0.05 * r(), { x: S.foot[ 0 ] + S.n[ 0 ] * 1.4, z: S.foot[ 1 ] + S.n[ 1 ] * 1.4, yaw: yawOf( S.n[ 0 ], S.n[ 1 ] ) + Math.PI + ( r() - 0.5 ) * 0.5 } );

		}

		// ---- at the back rail in the open bays, looking out
		for ( const U of C.open ) {

			if ( r() > 0.35 ) continue;
			const n = 1 + ( r() < 0.4 ? 1 : 0 );
			for ( let j = 0; j < n; j ++ ) {

				const o = ( r() - 0.5 ) * 6, d = 4.75 - 0.45;
				const { L, k } = fan();
				add( 'back', L, k, { x: U.mid[ 0 ] + U.a[ 0 ] * o - U.n[ 0 ] * d, z: U.mid[ 1 ] + U.a[ 1 ] * o - U.n[ 1 ] * d, yaw: yawOf( - U.n[ 0 ], - U.n[ 1 ] ) + ( r() - 0.5 ) * 0.4, arms: railArms( k, 0.2 ) } );

			}

		}

		for ( const a of this.list ) {

			a.p.pose = restPose();
			a.p.pose.phase = a.phase || 0;
			if ( a.x !== undefined ) {

				a.p.x = a.x; a.p.z = a.z; a.p.yaw = a.yaw;

			}

		}

		this.shown = true;

	}

	// shown or not (the place hides its insides when the camera's not up there)
	show( on ) {

		if ( on === this.shown ) return;
		this.shown = on;
		for ( const a of this.list ) a.p.visible = on && ! a.off;

	}

	// dt (on the place's Tempo), the night (nightState), the camera's field position [ x, z ]
	update( dt, N, cf ) {

		this.time += dt;
		this.frame ++;
		const t = this.time, busy = N?.busy ?? 0.8, rain = N?.first ? N.rain : 0, cheer = N?.result?.home > 0 && N.result.t < 6;
		const W = this.walk;
		for ( const a of this.list ) {

			const p = a.p, A = p.pose;
			const d2 = cf ? ( p.x - cf[ 0 ] ) ** 2 + ( p.z - cf[ 1 ] ) ** 2 : 0;
			const n = cadence( p, d2 );
			// the walkers, every frame they're due, with the time since
			if ( a.kind === 'walk' ) {

				if ( ! due( p, n, this.frame ) && ! this.catchUp ) {

					a.acc = ( a.acc || 0 ) + dt;
					continue;

				}

				const sdt = dt + ( a.acc || 0 );
				a.acc = 0;
				a.s += a.dir * a.speed * sdt;
				if ( a.s < 1 || a.s > W.L - 1 ) {

					a.dir = - a.dir;
					a.s = Math.max( 1, Math.min( W.L - 1, a.s ) );

				}

				const [ x, z, ux, uz ] = along( W.P, W.cum, a.s );
				// the lane across, toward the field +
				let nx = - uz, nz = ux;
				if ( nx * ( - x ) + nz * ( - 40 - z ) < 0 ) {

					nx = - nx; nz = - nz;

				}

				p.x = x + nx * a.lane;
				p.z = z + nz * a.lane;
				const want = yawOf( ux * a.dir, uz * a.dir );
				p.yaw += wrap( want - p.yaw ) * Math.min( 1, sdt * 6 );
				A.walk = 1;
				A.phase = ( A.phase + sdt * a.speed / 1.15 * TAU ) % TAU;
				const sw = Math.sin( A.phase ) * 0.3;
				const g = a.carry ? GESTURE.carry : null;
				A.armL = [ - sw, 0.07, 0, 0.18 ];
				A.armR = g?.[ 1 ] ? g[ 1 ] : [ sw, 0.07, 0, 0.18 ];
				A.propR = a.carry;
				A.headYaw = Math.sin( t * 0.4 + a.seed * 20 ) * 0.25;
				// a quarter of them toward the field side, glancing at the game
				if ( a.lane > 1 ) A.headYaw = - 0.5 * a.dir;
				continue;

			}

			if ( ! due( p, Math.max( n, 3 ), this.frame ) && ! this.catchUp ) continue;
			A.walk = 0;
			A.breath = ( t * 0.25 + a.seed ) % 1;
			A.blink = ( t * 0.31 + a.seed * 7 ) % 1 < 0.04 ? 1 : 0;
			if ( a.kind === 'rail' || a.kind === 'back' ) {

				A.lean = 0.2;
				A.armL = a.arms[ 0 ].slice();
				A.armR = a.arms[ 1 ].slice();
				A.headPitch = a.kind === 'rail' ? 0.25 : 0.05;
				A.headYaw = Math.sin( t * 0.17 + a.seed * 31 ) * ( a.kind === 'back' ? 0.6 : 0.35 );
				// turning to the one beside him now and then
				if ( a.kind === 'rail' && ( t * 0.05 + a.seed ) % 1 < 0.08 ) A.headYaw = a.seed < 0.5 ? 0.9 : - 0.9;
				if ( cheer && a.kind === 'rail' ) {

					A.armL = GESTURE.cheer[ 0 ].slice(); A.armR = GESTURE.cheer[ 1 ].slice(); A.lean = 0; A.headPitch = 0;

				}

				if ( N?.celebrate ) {

					A.armL = GESTURE.cheer[ 0 ].slice(); A.armR = GESTURE.cheer[ 1 ].slice(); A.lean = 0;

				}

			} else if ( a.kind === 'stand' ) {

				const g = GESTURE[ a.gesture ] || [ null, null ];
				A.armL = g[ 0 ] ? g[ 0 ].slice() : [ 0.05, 0.06, 0, 0.12 ];
				A.armR = g[ 1 ] ? g[ 1 ].slice() : [ 0.05, 0.06, 0, 0.12 ];
				A.propR = a.prop || 0;
				A.headPitch = 0.12;
				A.headYaw = Math.sin( t * 0.13 + a.seed * 17 ) * 0.4;
				if ( cheer || N?.celebrate ) {

					A.armL = GESTURE.cheer[ 0 ].slice(); A.armR = GESTURE.cheer[ 1 ].slice();

				}

			} else if ( a.kind === 'staff' ) {

				// serving: reaching over the counter, at the register, turning to the back counter
				const ph = ( t * 0.2 + a.seed * 5 ) % 1;
				const g = ph < 0.35 ? GESTURE.reach : ph < 0.6 ? GESTURE.text : null;
				A.armL = [ 0.05, 0.06, 0, 0.12 ];
				A.armR = g?.[ 1 ] ? g[ 1 ].slice() : [ 0.05, 0.06, 0, 0.12 ];
				A.headPitch = 0.15;
				A.headYaw = ph > 0.8 ? 1.2 : 0;
				A.propR = ph < 0.35 && a.at?.kind === 'food' ? PROP.beer : 0;

			} else if ( a.kind === 'line' ) {

				// the line as long as the inning makes it (the Rays batting, between innings: longer)
				const want = Math.min( 4, Math.round( busy * 2.6 + ( a.at.mid[ 0 ] * 0.13 % 1 ) ) );
				a.off = a.q >= want;
				p.visible = this.shown && ! a.off;
				const g = a.q === 0 ? GESTURE.reach : rain > 0.4 ? GESTURE.fold : GESTURE.pockets;
				A.armL = g[ 0 ] ? g[ 0 ].slice() : [ 0.05, 0.06, 0, 0.12 ];
				A.armR = g[ 1 ] ? g[ 1 ].slice() : [ 0.05, 0.06, 0, 0.12 ];
				A.propR = a.q === 0 ? PROP.money : 0;
				A.headYaw = a.q > 0 ? Math.sin( t * 0.21 + a.seed * 13 ) * 0.5 : 0;
				A.headPitch = 0.1;

			} else if ( a.kind === 'usher' ) {

				A.armL = GESTURE.pockets[ 0 ].slice();
				A.armR = ( t * 0.07 + a.seed ) % 1 < 0.1 ? GESTURE.point[ 1 ].slice() : GESTURE.pockets[ 1 ].slice();
				A.headYaw = Math.sin( t * 0.23 + a.seed * 9 ) * 0.7;

			}

		}

		this.catchUp = false;

	}

}
