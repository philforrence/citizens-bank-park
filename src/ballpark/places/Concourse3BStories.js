import { LEVELS } from '../layout.js';
import { PROP, TOP, COLOR, HAT, BACK, CHEST } from './Cast.js';
import { Walkway, GESTURE, railArms, armIK } from './Concourse3BKit.js';
import { RAIL_D } from './Concourse3BPeople.js';

// The third base concourse's people with names (Concourse3B.js): who they are shows in what they wear,
// carry and do; what they do follows the night. All invented, all plausible:
//
//   the ushers at the tops of the aisles (red jackets with the royal-blue side panels, khakis, red caps, as
//     in the 2004-2008 photos): Irv at 129, who ushered at the Vet, checks your ticket and points you down
//   event security at the Third Base Gate's mouth, waving people through
//   the Kowalskis from Port Richmond at the rail behind 131, their first World Series: Mike lifts Tyler
//     (9, his glove on, waiting on a foul ball) when the Phillies have runners on, and at the last out holds
//     him up over his head; Denise with a hot chocolate, Katie (6) holding her hand with her cotton candy
//   Eddie Pagano from Mayfair, 67, standing room behind 125 (the photos from both nights show standing
//     room there), a season ticket at the Vet from 1971: the 1980 maroon cap, keeping score in his book
//     every play; at the last out he puts the book down and wipes his eyes
//   Jen and Dave from Manayunk at the rail behind 128, sharing the one clear poncho on the 27th, his arm
//     round her; on the 29th, rally towels
//   Stan at the hot chocolate cart, his thirtieth season selling at the ballpark (he started at the Vet in
//     1979); on the 27th they sold 15,000 cups of it, and his line never stops
//   Travis from Clearwater in a Crawford jersey and a Rays cap, a brave man, who gets looked at
//   the beer men in their yellow shirts and number badges, carrying their trays down to the sections
const STREET = LEVELS.mainConcourse;
const TAU = Math.PI * 2;
const lerp = ( a, b, t ) => a + ( b - a ) * t;
const lerpArm = ( a, b, t ) => a.map( ( x, k ) => lerp( x, b[ k ], t ) );
const clamp = ( x, a, b ) => Math.max( a, Math.min( b, x ) );
const turn = ( a, b, k ) => {

	const d = ( ( b - a + Math.PI ) % TAU + TAU ) % TAU - Math.PI;
	return a + d * k;

};

const BASE_LOOK = { skin: 1, hair: 2, hairStyle: 0, facial: 0, glasses: false, female: false, age: 0, build: 1, top: TOP.jacket, color: COLOR.red, sleeves: COLOR.red, back: 0, chest: 0, pants: 0, shoes: 0, hat: HAT.none, poncho: 0, scarf: 0, gloves: false };

export class Stories {

	constructor( people ) {

		this.P = people;
		this.W = people.W;
		this.time = 0;
		this.actors = [];
		this._ushers();
		this._security();
		this._kowalskis();
		this._eddie();
		this._couple();
		this._stan();
		this._walkersWithNames();

	}

	// a named one, standing somewhere ( s, d ), facing yaw
	_add( look, { s, d, scale = 1, wet = null } = {} ) {

		const p = this.P.person( { poncho: 0 }, { ...BASE_LOOK, ...look, seed: Math.floor( this.P.r() * 65536 ) } );
		if ( ! p ) return null;
		if ( wet ) p.looks.wet = { ...p.looks.dry, ...wet };
		p.scale = scale;
		p.visible = true;
		const a = { kind: 'story', p, s, d, order: this.P.r() };
		this.P.actors.push( a );
		this.actors.push( a );
		return a;

	}

	_place( a, s, d, yaw, dt = 1 ) {

		a.s = s; a.d = d;
		const w = this.W.at( s, d );
		a.p.x = w.x; a.p.z = w.z; a.p.y = STREET;
		a.p.yaw = turn( a.p.yaw, yaw, Math.min( 1, dt * 5 ) );

	}

	// a rail spot near s, taken for good
	_railSpot( s ) {

		const free = this.P.rail.filter( ( q ) => ! q.who ).sort( ( a, b ) => Math.abs( a.s - s ) - Math.abs( b.s - s ) );
		const q = free[ 0 ];
		if ( q ) q.who = { story: true };
		return q;

	}

	// ---- the ushers: one at the top of each aisle, beside it on the concourse side
	_ushers() {

		this.ushers = [];
		const names = [ 'Irv', 'Marge', 'Sal', 'Dot', 'Frank', 'Lou' ];
		for ( const portal of this.P.portals.filter( ( q ) => q.kind === 'aisle' ) ) {

			const old = this.P.r() < 0.6;
			const a = this._add( { top: TOP.usher, color: COLOR.red, sleeves: COLOR.red, hat: HAT.capRed, pants: 2, shoes: 1, age: old ? 1 : 0, hair: old ? 7 : 1, glasses: old, female: this.ushers.length % 3 === 1, hairStyle: this.ushers.length % 3 === 1 ? 2 : 0, build: 2 },
				{ s: portal.s + 1.0, d: RAIL_D + 0.55 } );
			if ( ! a ) break;
			a.name = names[ this.ushers.length % names.length ];
			a.portal = portal;
			portal.usher = a;
			this.ushers.push( a );

		}

	}

	// ---- security at the gate's mouth
	_security() {

		this.guards = [];
		for ( const s of [ 71.2, 75.3 ] ) {

			const a = this._add( { top: TOP.security, color: COLOR.black, sleeves: COLOR.black, chest: CHEST.security, hat: HAT.capBlack, pants: 3, shoes: 1, build: 2, skin: s > 72 ? 5 : 2 },
				{ s, d: 45.6 } );
			if ( a ) this.guards.push( a );

		}

	}

	// ---- the Kowalskis at the rail behind 131
	_kowalskis() {

		const q = [ this._railSpot( 61.2 ), this._railSpot( 61.95 ), this._railSpot( 62.7 ), this._railSpot( 63.45 ) ];
		if ( q.some( ( x ) => ! x ) ) return;
		this.fam = {
			mike: this._add( { top: TOP.satin, color: COLOR.red, hat: HAT.knitRed, build: 3, facial: 4, skin: 0, hair: 1, pants: 0, shoes: 2 }, { s: q[ 1 ].s, d: q[ 1 ].d, scale: 1.02 } ),
			tyler: this._add( { top: TOP.jacket, color: COLOR.red, hat: HAT.capRed, age: 2, skin: 0, hair: 4, pants: 1, shoes: 0 }, { s: q[ 2 ].s, d: q[ 2 ].d, scale: 0.7 } ),
			denise: this._add( { top: TOP.puffer, color: COLOR.black, female: true, hairStyle: 1, hair: 3, hat: HAT.knitPlain, scarf: 1, gloves: true, pants: 1, shoes: 2 }, { s: q[ 0 ].s, d: q[ 0 ].d, scale: 0.94 } ),
			katie: this._add( { top: TOP.jacket, color: COLOR.pink, female: true, age: 2, hairStyle: 2, hair: 4, hat: HAT.knitRed, pants: 0, shoes: 0 }, { s: q[ 0 ].s + 0.35, d: q[ 0 ].d + 0.5, scale: 0.56 } ),
			spots: q,
		};
		const F = this.fam;
		if ( ! F.katie ) return;
		// on the 27th: the kids in the ponchos Denise bought at the gate, hoods up
		F.tyler.p.looks.wet = { ...F.tyler.p.looks.dry, poncho: 1 };
		F.katie.p.looks.wet = { ...F.katie.p.looks.dry, poncho: 4, hat: HAT.hood };
		F.mikeRail = railArms( F.mike.p.scale, 0.28 );
		F.holdKatie = armIK( - 1, [ - 0.42, 0.78, 0.2 ] );

	}

	// ---- Eddie, standing room behind 125, keeping score
	_eddie() {

		const q = this._railSpot( 19.5 );
		if ( ! q ) return;
		this.eddie = this._add( { top: TOP.work, color: COLOR.charcoal, hat: HAT.cap1980, age: 1, hair: 7, glasses: true, facial: 1, build: 3, scarf: 2, pants: 2, shoes: 3 }, { s: q.s, d: q.d, scale: 0.97 } );
		if ( this.eddie ) {

			this.eddie.spot = q;
			this.eddie.rail = railArms( 0.97, 0.2 );
			// the book on the shelf, the pencil
			this.eddie.book = armIK( - 1, [ - 0.12, 1.12, - 0.36 ], { lean: 0.2 } );
			this.eddie.write = armIK( 1, [ - 0.02, 1.14, - 0.36 ], { lean: 0.2 } );

		}

	}

	// ---- Jen and Dave, huddled at the rail behind 128
	_couple() {

		const q = [ this._railSpot( 41.3 ), this._railSpot( 42.05 ) ];
		if ( q.some( ( x ) => ! x ) ) return;
		const jen = this._add( { top: TOP.homeJersey, color: COLOR.white, sleeves: COLOR.grey, back: BACK.VICTORINO, chest: CHEST.script, female: true, hairStyle: 1, hair: 2, hat: HAT.capRed, pants: 1, shoes: 0 },
			{ s: q[ 0 ].s, d: q[ 0 ].d, scale: 0.93, wet: { hat: HAT.knitRed } } );
		const dave = this._add( { top: TOP.hoodie, color: COLOR.grey, chest: CHEST.block, hat: HAT.capRed, facial: 2, build: 1, pants: 0, shoes: 0 },
			{ s: q[ 1 ].s, d: q[ 1 ].d, scale: 1.0, wet: { poncho: 7, hat: HAT.hood } } );
		if ( ! dave ) return;
		// on the 27th under the one poncho, pressed together; on the 29th an arm's length apart
		// (facing the field, further along the concourse is to the left: she is on his left)
		this.couple = { jen, dave, sJ: q[ 1 ].s, sD: q[ 0 ].s + 0.2, sDwet: q[ 1 ].s - 0.36 };
		// his left arm round her shoulders; her right on his back
		this.couple.around = armIK( - 1, [ - 0.72, 1.33, 0.02 ] );
		this.couple.back = armIK( 1, [ 0.5, 1.12, 0.12 ] );
		this.couple.jenRail = railArms( 0.93, 0.22 );

	}

	// ---- Stan, his thirtieth season, at the hot chocolate cart; the line longer on the 27th
	_stan() {

		const S = this.P.stands.find( ( x ) => x.brand === 'cocoa' );
		const a = S?.staff[ 0 ];
		if ( ! a ) return;
		const look = { ...a.p.looks.dry, age: 1, hair: 7, glasses: true, facial: 1, build: 3, hat: HAT.knitBlack, gloves: true, scarf: 2 };
		a.p.looks = { dry: look, wet: look };
		this.P.cast.setLook( a.p, look );
		a.name = 'Stan';
		this.stan = { a, S };

	}

	// ---- the walkers with names: Travis the Rays fan, the beer men
	_walkersWithNames() {

		this.travis = this.P.addFan( { top: TOP.rays, color: COLOR.raysNavy, sleeves: COLOR.raysNavy, back: BACK.CRAWFORD, chest: CHEST.rays, hat: HAT.capRays, age: 0, skin: 2, hair: 0, facial: 2, pants: 1, shoes: 0 }, { carry: 'beer', hands: 'free' } );
		this.hawkers = [];
		for ( let i = 0; i < 2; i ++ ) {

			const f = this.P.addFan( { top: TOP.hawker, color: COLOR.yellow, sleeves: i ? COLOR.yellow : COLOR.black, hat: i ? HAT.capRed : HAT.knitBlack, age: i ? 3 : 0, build: i ? 0 : 2, pants: 2, shoes: 0, skin: i ? 1 : 4 }, { carry: 'tray', hands: 'free', hawker: true } );
			if ( f ) this.hawkers.push( f );

		}

	}

	update( dt, ns ) {

		this.time += dt;
		const t = this.time;
		const R = this.P.react;
		// the Phillies at bat with men on (or the last out): the moments to lift a kid up for
		const bigMoment = ns.celebrate || ( ns.half === 'bottom' && ( ns.snap.bases || [] ).some( Boolean ) && ( ns.seg?.kind === 'pitch' || ns.seg?.kind === 'inplay' ) ) || ( R && R.kind === 'cheer' );
		this._updateUshers( dt, ns );
		for ( const g of this.guards ) {

			// waving them through; hands clasped in front between
			const wave = Math.max( 0, Math.sin( t * 0.35 + g.order * 9 ) - 0.3 ) / 0.7;
			const a = g.p.pose;
			a.armL = [ 0.25, 0.1, 0.45, 1.2 ];
			a.armR = lerpArm( [ 0.25, 0.1, 0.45, 1.25 ], [ 1.2, 0.8, - 0.4, 0.6 + 0.4 * Math.sin( t * 5 ) ], wave );
			a.headYaw = Math.sin( t * 0.3 + g.order * 5 ) * 0.5;
			a.blink = ( t * 0.3 + g.order ) % 1 < 0.04 ? 1 : 0;
			this._place( g, g.s, g.d, Walkway.yaw( ...this._dir( g, 0, 1 ) ), dt );

		}

		this._updateFamily( dt, ns, bigMoment );
		this._updateEddie( dt, ns );
		this._updateCouple( dt, ns );
		// Stan's line: busier on the 27th
		if ( this.stan ) this.stan.S.base = ns.first ? 1.3 : 0.6;
		// Travis gets looked at: the fans walking by him turn their heads
		const k = this.travis;
		if ( k && k.p.visible ) for ( const o of this.P.fans ) {

			if ( o === k || ! o.p.visible || o.mode !== 'walk' ) continue;
			const ds = k.s - o.s, dd = k.d - o.d, e = Math.hypot( ds, dd );
			if ( e > 3.2 || e < 0.5 ) continue;
			const [ dx, dz ] = this.P._worldDir( o.s, o.d, ds, dd );
			let y = Math.atan2( - dx, - dz ) - o.p.yaw;
			y = ( ( y + Math.PI ) % TAU + TAU ) % TAU - Math.PI;
			if ( Math.abs( y ) < 1.3 ) o.p.pose.headYaw = y;

		}

		// Travis keeps his head down at a Phillies run
		if ( k && R && ( R.kind === 'cheer' || R.kind === 'champions' ) ) {

			k.p.pose.headPitch = 0.45;
			k.p.pose.armR = GESTURE.pockets[ 1 ].slice();

		}

	}

	// a direction in ( s, d ) as a world one
	_dir( a, vs, vd ) {

		return this.P._worldDir( a.s, a.d, vs, vd );

	}

	_updateUshers( dt, ns ) {

		const t = this.time;
		for ( const u of this.ushers ) {

			const a = u.p.pose;
			a.walk = 0; a.lean = 0; a.propL = 0; a.propR = 0; a.mouth = 0;
			// hands clasped behind, watching the concourse; the head going
			a.armL = [ - 0.35, 0.12, 0.35, 0.9 ]; a.armR = [ - 0.35, 0.12, 0.35, 0.9 ];
			a.headYaw = Math.sin( t * 0.22 + u.order * 7 ) * 0.7;
			a.headPitch = 0;
			let yaw = Walkway.yaw( ...this._dir( u, 0, 1 ) ); // facing the concourse
			const f = u.checkFan;
			if ( f && f.hold > 0 ) {

				// the ticket: reached for, looked at, then the way down pointed out
				u.checkT = ( u.checkT || 0 ) + dt;
				const [ dx, dz ] = this._dir( u, f.s - u.s, f.d - u.d );
				yaw = Walkway.yaw( dx, dz );
				if ( u.checkT < 1.1 ) {

					a.armR = GESTURE.reach[ 1 ].slice();
					a.headPitch = 0.3;
					a.mouth = Math.max( 0, 0.25 * Math.sin( t * 7 ) );

				} else {

					a.armR = GESTURE.point[ 1 ].slice();
					a.armR[ 2 ] -= 0.6;
					a.mouth = Math.max( 0, 0.3 * Math.sin( t * 6 ) );
					yaw += 0.7;

				}

			} else u.checkT = 0;

			a.blink = ( t * 0.3 + u.order * 3 ) % 1 < 0.04 ? 1 : 0;
			this._place( u, u.s, u.d, yaw, dt );

		}

	}

	_updateFamily( dt, ns, bigMoment ) {

		const F = this.fam;
		if ( ! F?.katie ) return;
		const t = this.time, q = F.spots;
		const face = q[ 1 ].face;
		this.lift = lerp( this.lift || 0, bigMoment ? ( ns.celebrate ? 1 : 0.6 ) : 0, Math.min( 1, dt * 2.5 ) );
		const L = this.lift;
		// Mike: on the rail on his forearms; lifting Tyler under the arms, over his head at the last out
		const m = F.mike.p.pose;
		m.walk = 0; m.propL = 0; m.propR = 0;
		m.lean = lerp( 0.28, 0.05, clamp( L * 2, 0, 1 ) );
		const up = lerpArm( GESTURE.lift[ 0 ], GESTURE.liftHigh[ 0 ], clamp( ( L - 0.6 ) / 0.4, 0, 1 ) ), upR = lerpArm( GESTURE.lift[ 1 ], GESTURE.liftHigh[ 1 ], clamp( ( L - 0.6 ) / 0.4, 0, 1 ) );
		m.armL = lerpArm( F.mikeRail[ 0 ], up, clamp( L * 2, 0, 1 ) );
		m.armR = lerpArm( F.mikeRail[ 1 ], upR, clamp( L * 2, 0, 1 ) );
		m.headPitch = lerp( 0.15, - 0.2, L );
		m.mouth = ns.celebrate ? 0.8 : 0;
		m.kneeL = 0.1; m.kneeR = 0;
		m.blink = ( t * 0.3 ) % 1 < 0.04 ? 1 : 0;
		this._place( F.mike, q[ 1 ].s, q[ 1 ].d, face, dt );
		// Tyler: at the rail with his glove up, or held up in front of his dad
		const ty = F.tyler.p.pose;
		ty.walk = 0; ty.propL = PROP.glove; ty.propR = 0;
		ty.lean = 0.05;
		const cheer = ns.celebrate || ( this.P.react && this.P.react.kind === 'cheer' );
		ty.armL = cheer ? [ 2.7, 0.3, 0, 0.4 ] : [ 2.2, 0.2, 0.2, 0.9 ];
		ty.armR = cheer ? [ 2.7, 0.3, 0, 0.4 ] : [ 2.2, 0.2, 0.2, 0.9 ];
		ty.mouth = cheer ? 0.9 : 0;
		ty.hipL = ty.hipR = L * 0.5; ty.kneeL = ty.kneeR = L * 0.9;
		ty.headPitch = - 0.1;
		const lifted = clamp( L * 2, 0, 1 );
		const ts = lerp( q[ 2 ].s, q[ 1 ].s, lifted ), td = lerp( q[ 2 ].d, q[ 1 ].d - 0.3, lifted );
		this._place( F.tyler, ts, td, face, dt );
		F.tyler.p.y = STREET + lifted * ( 0.62 + 0.45 * clamp( ( L - 0.6 ) / 0.4, 0, 1 ) );
		// Denise: warming her hands round the hot chocolate, Katie's hand in her left
		const dn = F.denise.p.pose;
		dn.walk = 0; dn.lean = 0.02; dn.propR = PROP.cocoa; dn.propL = 0;
		dn.armR = GESTURE.warm[ 1 ].slice();
		dn.armL = F.holdKatie.slice();
		dn.headYaw = Math.sin( t * 0.2 ) * 0.3 - ( L > 0.3 ? 0.6 : 0 );
		dn.mouth = ns.celebrate ? 0.8 : 0;
		if ( ns.celebrate ) {

			dn.armL = [ 2.7, 0.3, 0, 0.4 ];
			dn.armR = GESTURE.cheer[ 1 ].slice();

		}

		this._place( F.denise, q[ 0 ].s, q[ 0 ].d, face, dt );
		// Katie: the cotton candy, her other hand up in her mom's; she jumps at the last out
		const k = F.katie.p.pose;
		k.walk = 0; k.propL = PROP.cottonCandy; k.propR = 0;
		k.armL = GESTURE.carryL[ 0 ].slice();
		k.armR = [ 1.1, 0.5, - 0.35, 0.3 ];
		k.headPitch = - 0.3;
		k.drop = ns.celebrate ? - Math.max( 0, Math.sin( t * 8 ) ) * 0.08 : 0;
		// on her mother's left (further along), a step behind, between her and her dad
		this._place( F.katie, q[ 0 ].s + 0.35, q[ 0 ].d + 0.5, face + 0.3, dt );

	}

	_updateEddie( dt, ns ) {

		const e = this.eddie;
		if ( ! e ) return;
		const a = e.p.pose, t = this.time;
		a.walk = 0; a.lean = 0.2; a.propL = PROP.scorebook; a.propR = PROP.pencil;
		a.armL = e.book.slice();
		// writing the play down after each one; watching between
		const writing = ns.result && ns.result.t < 3 && ! ns.celebrate;
		a.armR = writing ? e.write.map( ( v, k ) => v + ( k === 3 ? 0.06 * Math.sin( t * 14 ) : 0 ) ) : e.rail[ 1 ].slice();
		a.headPitch = writing ? 0.55 : 0.12;
		a.headYaw = writing ? 0.15 : 0;
		a.blink = ( t * 0.25 ) % 1 < 0.04 ? 1 : 0;
		a.mouth = 0;
		if ( ns.celebrate ) {

			// the book down on the shelf; both arms up; then a hand to his eyes
			a.propL = 0; a.propR = 0;
			const T = ns.celebrateT;
			a.lean = 0;
			if ( T < 8 ) {

				a.armL = [ 2.6, 0.3, 0, 0.5 ]; a.armR = [ 2.6, 0.3, 0, 0.5 ];
				a.mouth = 0.8;

			} else {

				a.armL = GESTURE.pockets[ 0 ].slice();
				a.armR = GESTURE.sip[ 1 ].slice();
				a.headPitch = 0.35;

			}

		}

		this._place( e, e.spot.s, e.spot.d, e.spot.face, dt );

	}

	_updateCouple( dt, ns ) {

		const C = this.couple;
		if ( ! C ) return;
		const t = this.time;
		const face = this.P.rail.find( ( q ) => Math.abs( q.s - C.jen.s ) < 0.1 )?.face ?? 0;
		const j = C.jen.p.pose, d = C.dave.p.pose;
		// huddled: his arm round her, she leans into him, her arm on the rail (on the 29th, towels)
		d.walk = 0; j.walk = 0;
		d.armL = C.around.slice(); d.propL = 0;
		d.armR = ns.first ? GESTURE.pockets[ 1 ].slice() : [ 1.2, 0.4, 0.1, 0.8 ];
		d.propR = ns.first ? PROP.pocket : PROP.towel;
		d.lean = 0.08; d.roll = 0.06;
		j.armL = C.jenRail[ 0 ].slice(); j.armR = C.back.slice();
		j.propL = 0; j.propR = ns.first ? 0 : PROP.towel;
		j.lean = 0.18; j.roll = - 0.12;
		j.headYaw = Math.sin( t * 0.17 ) > 0.6 ? - 0.9 : 0.1;
		d.headYaw = Math.sin( t * 0.17 ) > 0.6 ? 0.8 : 0;
		j.mouth = Math.sin( t * 0.17 ) > 0.6 ? Math.max( 0, 0.3 * Math.sin( t * 7 ) ) : 0;
		if ( this.P.react && ( this.P.react.kind === 'cheer' || this.P.react.kind === 'champions' ) ) {

			// the towels round their heads
			d.armR = [ 2.7, 0.3, 0, 0.3 + 0.3 * Math.sin( t * 9 ) ];
			j.armR = [ 2.7, 0.3, 0, 0.3 + 0.3 * Math.sin( t * 9 + 1 ) ];
			j.mouth = 0.8; d.mouth = 0.8;

		}

		this._place( C.jen, C.sJ, C.jen.d, face, dt );
		this._place( C.dave, ns.first ? C.sDwet : C.sD, C.dave.d, face, dt );

	}

}
