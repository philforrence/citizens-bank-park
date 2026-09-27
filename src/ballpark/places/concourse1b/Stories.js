import { LEVELS } from '../../layout.js';
import { PROP, TOP, COLOR, HAT, BACK, CHEST } from '../Cast.js';
import { Walkway, GESTURE, railArms } from '../Concourse3BKit.js';
import { RAIL_D } from '../Concourse3BPeople.js';
import { PR } from './Arrivals.js';

// The first base concourse's people with names (Concourse1B.js), all invented, in the register
// (.claude/wave2/CAST.md); who they are shows in what they wear, carry and do, and what they do follows
// the night:
//
//   the ushers at the tops of the aisles (the red jacket with the royal-blue side panels, khakis, the red
//     cap), who take the ticket and point you down; event security at the gate's mouth, waving them in
//   Loretta Hayes, 57, from Southwest Philly, on the register at the South Philadelphia Market behind 116
//     since the park opened (and 22 years at the Vet): she calls everyone "baby", and talks the whole time
//   Gus Karamanlis, 70, from Upper Darby, retired from the Navy Yard, selling the World Series program at
//     the kiosk behind 115-116: one held up high, "Programs! Fifteen dollars!"
//   Rosemarie Iannucci, 45, from Pennsport, at the Phanatic Phood cart by the kids' zone
//   Leo Czarnecki, 66, from Bridesburg, a hot dog in one hand and his transistor radio at his ear by the
//     Hatfield Grill's condiments behind 120: after every play the line turns round to him for Harry's call
//   Marty Gold, 58, from Cherry Hill, the caricaturist (the 2008 guide has one on each side of the main
//     concourse), drawing Mai Nguyen, 6, on the stool while her mother Linh watches over his shoulder
//   Tuan Nguyen, 42, and Andy, 8, at the rail behind 110, their first World Series: Andy's glove on for a
//     foul ball that won't come this far up, lifted over the rail at the last out
//   Brandon Tully, 24, from Tampa (a grad student at Penn), in a Longoria jersey and a Rays cap, walking
//     the concourse with a beer: the Phillies fans look him over, and he takes it well
//   a beer man in the yellow shirt, carrying his tray down to the sections
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

// sitting on a stool of height h: the thighs out level, the shins down, the pelvis dropped onto it
export function seated( a, scale, h ) {

	a.hipL = a.hipR = 1.45;
	a.kneeL = a.kneeR = 1.4;
	a.drop = Math.max( 0, 0.93 - ( h + 0.07 ) / scale );
	a.walk = 0;

}

export class Stories1B {

	// people: the concourse's People1B; spots: { caricature }
	constructor( people, spots = {} ) {

		this.P = people;
		this.W = people.W;
		this.time = 0;
		this.actors = [];
		this.spots = spots;
		this._ushers();
		this._security();
		this._vendors();
		this._leo();
		this._caricature();
		this._nguyens();
		this._walkers();
		this._phunZone();
		this._photoOp();

	}

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

	// placed at a field point ( x, z )
	_put( a, x, z, yaw, dt = 1 ) {

		[ a.s, a.d ] = this.W.toSD( x, z );
		a.p.x = x; a.p.z = z; a.p.y = STREET;
		a.p.yaw = turn( a.p.yaw, yaw, Math.min( 1, dt * 5 ) );

	}

	_railSpot( s ) {

		const free = this.P.rail.filter( ( q ) => ! q.who ).sort( ( a, b ) => Math.abs( a.s - s ) - Math.abs( b.s - s ) );
		const q = free[ 0 ];
		if ( q ) q.who = { story: true };
		return q;

	}

	_dir( a, vs, vd ) {

		return this.P._worldDir( a.s, a.d, vs, vd );

	}

	// ---- the ushers: one at the top of each aisle, beside it on the concourse's side
	_ushers() {

		this.ushers = [];
		for ( const portal of this.P.portals.filter( ( q ) => q.kind === 'aisle' ) ) {

			if ( this.ushers.some( ( u ) => Math.abs( u.portal.s - portal.s ) < 4 ) ) continue;
			const i = this.ushers.length, old = this.P.r() < 0.6, female = i % 3 === 1;
			const a = this._add( { top: TOP.usher, color: COLOR.red, sleeves: COLOR.red, hat: HAT.capRed, pants: 2, shoes: 1, age: old ? 1 : 0, hair: old ? 7 : 1, glasses: old, female, hairStyle: female ? 2 : 0, build: 2, skin: [ 1, 5, 0, 2, 6, 1 ][ i % 6 ] },
				{ s: portal.s - 1.0, d: RAIL_D + 0.55 } );
			if ( ! a ) break;
			a.portal = portal;
			portal.usher = a;
			this.ushers.push( a );

		}

	}

	// ---- security at the gate's mouth onto the concourse, waving them through
	_security() {

		this.guards = [];
		for ( const s of [ 63.5, 91.5 ] ) {

			const a = this._add( { top: TOP.security, color: COLOR.black, sleeves: COLOR.black, chest: CHEST.security, hat: HAT.capBlack, pants: 3, shoes: 1, build: 2, skin: s > 70 ? 6 : 3 }, { s, d: 45.4 } );
			if ( a ) this.guards.push( a );

		}

	}

	// ---- the vendors with names: restyled from the stands' and carts' staff
	_vendors() {

		const P = this.P;
		const restyle = ( a, look ) => {

			const L = { ...a.p.looks.dry, ...look };
			a.p.looks = { dry: L, wet: L };
			P.cast.setLook( a.p, L );

		};

		// Loretta on the Market's register behind 116
		const market = P.stands.find( ( S ) => S.brand === 'market' && Math.abs( S.s - 56 ) < 5 );
		if ( market?.staff[ 0 ] ) {

			this.loretta = market.staff[ 0 ];
			restyle( this.loretta, { female: true, skin: 5, hair: 6, hairStyle: 2, glasses: true, build: 3, age: 0, hat: HAT.visor } );

		}

		// Gus at the program kiosk: the navy knit cap from the Yard, the moustache, the reading glasses
		const kiosk = P.stands.find( ( S ) => S.brand === 'programs' );
		if ( kiosk?.staff[ 0 ] ) {

			this.gus = kiosk.staff[ 0 ];
			restyle( this.gus, { female: false, age: 1, hair: 7, facial: 1, glasses: true, build: 3, skin: 1, hat: HAT.knitBlack, scarf: 2, gloves: true } );

		}

		// Rosemarie at the Phanatic Phood cart
		const phood = P.stands.find( ( S ) => S.brand === 'phood' );
		if ( phood?.staff[ 0 ] ) {

			this.rosemarie = phood.staff[ 0 ];
			restyle( this.rosemarie, { female: true, age: 0, hair: 1, hairStyle: 2, skin: 1, build: 1, hat: HAT.capRed, top: TOP.staff, color: COLOR.green, sleeves: COLOR.green } );

		}

	}

	// ---- Leo by the Hatfield Grill's condiments behind 120, the radio at his ear
	_leo() {

		const S = this.P.stands.find( ( x ) => x.brand === 'hatfield' );
		if ( ! S ) return;
		this.leo = this._add( { age: 1, hair: 7, glasses: true, build: 3, skin: 0, top: TOP.satin, color: COLOR.red, sleeves: COLOR.red, hat: HAT.cap1980, pants: 2, shoes: 3, scarf: 1 },
			{ s: S.s, d: 42 } );
		if ( ! this.leo ) return;
		this.leo.S = S;
		// beside the line, on the side away from the condiments' station, a metre out
		const side = ( S.sec % 2 ) ? - 1 : 1;
		const [ s, d ] = S.at( side * 2.4, 1.9 );
		this.leo.at = [ s, d ];

	}

	// ---- the caricaturist's corner: Marty on his stool, Mai on hers, Linh watching
	_caricature() {

		const C = this.spots.caricature;
		if ( ! C ) return;
		const pt = ( x, z ) => [ C.x + C.u[ 0 ] * x + C.n[ 0 ] * z, C.z + C.u[ 1 ] * x + C.n[ 1 ] * z ];
		const fwd = Walkway.yaw( C.n[ 0 ], C.n[ 1 ] ), back = Walkway.yaw( - C.n[ 0 ], - C.n[ 1 ] );
		this.marty = this._add( { age: 0, hair: 6, facial: 3, glasses: true, build: 3, skin: 0, top: TOP.fleece, color: COLOR.navy, sleeves: COLOR.navy, hat: HAT.capBack, pants: 0, shoes: 2 } );
		this.mai = this._add( { female: true, age: 2, hair: 0, hairStyle: 2, skin: 7, top: TOP.hoodie, color: COLOR.pink, sleeves: COLOR.pink, hat: HAT.knitRed, pants: 1, shoes: 0 }, { scale: 0.62 } );
		this.linh = this._add( { female: true, age: 0, hair: 0, hairStyle: 1, skin: 7, top: TOP.puffer, color: COLOR.black, sleeves: COLOR.black, hat: HAT.none, scarf: 1, pants: 1, shoes: 1, build: 0 }, { scale: 0.95 } );
		if ( this.marty ) this.marty.at = { xz: pt( 0.05, - 0.8 ), yaw: fwd };
		if ( this.mai ) this.mai.at = { xz: pt( 0.0, 1.35 ), yaw: back };
		if ( this.linh ) this.linh.at = { xz: pt( - 0.55, - 0.35 ), yaw: fwd + 0.5 };

	}

	// ---- Tuan and Andy at the rail behind 110
	_nguyens() {

		const q1 = this._railSpot( 106 ), q2 = this._railSpot( 106.8 );
		if ( ! q1 || ! q2 ) return;
		this.tuan = this._add( { age: 0, hair: 0, skin: 7, glasses: true, build: 1, top: TOP.jacket, color: COLOR.red, sleeves: COLOR.red, hat: HAT.capRed, pants: 1, shoes: 0 },
			{ wet: { poncho: 1 } } );
		this.andy = this._add( { age: 2, hair: 0, skin: 7, top: TOP.nameTee, color: COLOR.red, sleeves: COLOR.grey, back: BACK.HOWARD, hat: HAT.capRed, pants: 0, shoes: 0 },
			{ scale: 0.72, wet: { poncho: 1 } } );
		if ( ! this.tuan || ! this.andy ) return;
		this.tuan.spot = q1;
		this.andy.spot = q2;
		this.tuanRail = railArms( 1.0, 0.25 );

	}

	// ---- the Phanatic Phun Zone: three little ones on its decks and down the slide (eight and under, the
	// guide says), a father on the phone and a mother watching outside it
	_phunZone() {

		const Z = this.spots.phun;
		if ( ! Z?.Q ) return;
		this.phunQ = Z.Q;
		const kid = ( i, look ) => this._add( { age: 2, skin: [ 1, 5, 0 ][ i ], hair: [ 3, 0, 4 ][ i ], hairStyle: i === 2 ? 2 : 0, female: i === 2, top: TOP.hoodie, color: [ COLOR.red, COLOR.navy, COLOR.pink ][ i ], sleeves: [ COLOR.red, COLOR.navy, COLOR.pink ][ i ], chest: i === 1 ? 0 : CHEST.block, hat: i === 0 ? HAT.capRed : HAT.none, pants: 1, shoes: 0, ...look }, { scale: [ 0.6, 0.55, 0.52 ][ i ] } );
		this.phunKids = [ kid( 0, {} ), kid( 1, {} ), kid( 2, {} ) ].filter( Boolean );
		this.phunDad = this._add( { age: 0, skin: 1, hair: 3, facial: 4, build: 2, top: TOP.fleece, color: COLOR.grey, sleeves: COLOR.grey, hat: HAT.capRed, pants: 0, shoes: 0 } );
		this.phunMom = this._add( { female: true, age: 0, skin: 1, hair: 4, hairStyle: 2, build: 0, top: TOP.puffer, color: COLOR.red, sleeves: COLOR.red, hat: HAT.knitRed, pants: 1, shoes: 2 } );

	}

	// ---- a picture with the Phanatic: when he's parked his four-wheeler on this concourse (A's place; in
	// the 3rd on the 27th, behind 111), a line forms beside it: a father and his son (the glove on), two
	// girls from Temple with a phone, an older couple. Each in turn beside him, the picture taken, off
	_photoOp() {

		const L = ( o ) => ( { ...o } );
		this.photo = { groups: [
			[ this._add( L( { age: 0, skin: 2, hair: 1, facial: 2, build: 2, top: TOP.hoodie, color: COLOR.red, sleeves: COLOR.red, chest: CHEST.block, hat: HAT.capRed, pants: 0, shoes: 0 } ) ),
				this._add( L( { age: 2, skin: 2, hair: 1, top: TOP.nameTee, color: COLOR.red, sleeves: COLOR.grey, back: BACK.VICTORINO, hat: HAT.capRed, pants: 1, shoes: 0 } ), { scale: 0.68 } ) ],
			[ this._add( L( { female: true, age: 3, skin: 0, hair: 4, hairStyle: 1, top: TOP.homeJersey, color: COLOR.white, sleeves: COLOR.red, back: BACK.HAMELS, chest: CHEST.script, hat: HAT.knitRed, pants: 1, shoes: 0 } ), { scale: 0.93 } ),
				this._add( L( { female: true, age: 3, skin: 5, hair: 0, hairStyle: 2, top: TOP.puffer, color: COLOR.red, sleeves: COLOR.red, hat: HAT.none, pants: 1, shoes: 1 } ), { scale: 0.92 } ) ],
			[ this._add( L( { age: 1, skin: 0, hair: 7, glasses: true, build: 3, top: TOP.jacket, color: COLOR.red, sleeves: COLOR.red, hat: HAT.cap1980, pants: 2, shoes: 3 } ) ),
				this._add( L( { female: true, age: 1, skin: 0, hair: 6, hairStyle: 0, glasses: true, top: TOP.fleece, color: COLOR.red, sleeves: COLOR.red, hat: HAT.knitRed, pants: 5, shoes: 1, scarf: 1 } ) ) ],
		].filter( ( g ) => g[ 0 ] && g[ 1 ] ), t: 0, on: false };
		for ( const g of this.photo.groups ) for ( const a of g ) a.p.visible = false;

	}

	_updatePhotoOp( dt ) {

		const O = this.photo, ph = this.spots.app?.phanatic?.now;
		if ( ! O?.groups.length ) return;
		// parked here: visible, off the field, on this concourse by the spot
		const here = ph?.visible && ! ph.onField && Math.hypot( ph.x - 74.4, ph.z - 0.4 ) < 2.5;
		if ( here && ! O.on ) {

			O.on = true;
			O.t = 0;

		}

		if ( ! here && O.on ) {

			O.on = false;
			for ( const g of O.groups ) for ( const a of g ) a.p.visible = false;

		}

		if ( ! O.on ) return;
		O.t += dt;
		const t = this.time, per = 13;
		const face = ( a, ds, dd ) => Walkway.yaw( ...this._dir( a, ds, dd ) );
		O.groups.forEach( ( [ a, b ], i ) => {

			const T = O.t - i * per;
			const vis = T < per + 5;
			a.p.visible = b.p.visible = vis;
			if ( ! vis ) return;
			const PA = a.p.pose, PB = b.p.pose;
			for ( const P of [ PA, PB ] ) {

				P.walk = 0; P.lean = 0; P.twist = 0; P.drop = 0; P.hipL = P.hipR = P.kneeL = P.kneeR = 0;
				P.propL = 0; P.propR = 0; P.mouth = 0;
				P.armL = GESTURE.pockets[ 0 ].slice(); P.armR = [ 0.05, 0.08, 0, 0.2 ];
				P.blink = ( t * 0.35 + i ) % 1 < 0.04 ? 1 : 0;

			}

			if ( T < 0 ) {

				// waiting their turn in the line up the walkway, talking, the camera out ready
				const q = - T / per;
				const s = 97.4 + q * 1.6, d = 38.6;
				this._place( a, s, d, face( a, - 1, - 0.3 ), dt );
				this._place( b, s + 0.6, d + 0.5, face( b, - 1, - 0.4 ), dt );
				PB.armR = GESTURE.carry[ 1 ].slice(); PB.propR = i === 1 ? PROP.phone : PROP.camera;
				PA.mouth = Math.max( 0, 0.3 * Math.sin( t * 7 + i ) ) * ( Math.sin( t * 0.5 + i ) > 0 ? 1 : 0 );
				return;

			}

			if ( T < per ) {

				// one beside him, the arm round him (the kid: both arms up); the other a step back with the camera
				this._place( a, 95.2, 38.1, face( a, 0.2, 2.5 ), dt );
				this._place( b, 95.6, 40.9, face( b, 0, - 1 ), dt );
				PA.armL = [ 1.3, 1.0, - 0.4, 0.6 ];
				PA.armR = a.p.look?.age === 2 ? [ 2.6, 0.3, 0, 0.4 ] : [ 0.05, 0.08, 0, 0.2 ];
				PA.mouth = 0.5;
				PB.armR = GESTURE.photo[ 1 ].slice(); PB.armL = GESTURE.photo[ 0 ].slice();
				PB.propR = i === 1 ? PROP.phone : PROP.camera;
				PB.mouth = T % 4 < 1.2 ? 0.35 : 0;
				return;

			}

			// off together toward home, looking at the picture on the camera's screen
			const k = ( T - per ) / 5;
			this._place( a, 95.2 - k * 5, 38.6 + k, face( a, - 1, 0 ), dt );
			this._place( b, 95.6 - k * 5 + 0.5, 39.4 + k, face( b, - 1, 0 ), dt );
			for ( const P of [ PA, PB ] ) {

				P.walk = 1;
				P.phase = ( P.phase + dt * 6 ) % ( Math.PI * 2 );

			}

			PB.armR = GESTURE.text[ 1 ].slice(); PB.propR = i === 1 ? PROP.phone : PROP.camera; PB.headPitch = 0.4;
			PA.headYaw = - 0.6;

		} );

	}

	// ---- the walkers with jobs or stories: Brandon the Rays fan, a beer man
	_walkers() {

		this.brandon = this.P.addFan( { top: TOP.rays, color: COLOR.white, sleeves: COLOR.raysNavy, back: BACK.LONGORIA, chest: CHEST.rays, hat: HAT.capRays, age: 0, skin: 1, hair: 3, facial: 4, glasses: true, pants: 1, shoes: 0, build: 0 }, { carry: 'beer', hands: 'free' } );
		this.hawker = this.P.addFan( { top: TOP.hawker, color: COLOR.yellow, sleeves: COLOR.black, hat: HAT.capRed, age: 3, build: 0, pants: 2, shoes: 0, skin: 5 }, { carry: 'tray', hands: 'free', hawker: true } );

	}

	update( dt, ns ) {

		this.time += dt;
		const t = this.time, R = this.P.react;
		this._updateUshers( dt );
		for ( const g of this.guards ) {

			const wave = Math.max( 0, Math.sin( t * 0.35 + g.order * 9 ) - 0.3 ) / 0.7;
			const a = g.p.pose;
			a.armL = [ 0.25, 0.1, 0.45, 1.2 ];
			a.armR = lerpArm( [ 0.25, 0.1, 0.45, 1.25 ], [ 1.2, 0.8, - 0.4, 0.6 + 0.4 * Math.sin( t * 5 ) ], wave );
			a.headYaw = Math.sin( t * 0.3 + g.order * 5 ) * 0.5;
			a.blink = ( t * 0.3 + g.order ) % 1 < 0.04 ? 1 : 0;
			this._place( g, g.s, g.d, Walkway.yaw( ...this._dir( g, 0, 1 ) ), dt );

		}

		// Loretta: never stops talking ("what can I get you, baby?"); Gus calling it out
		if ( this.loretta ) {

			const a = this.loretta.p.pose;
			a.mouth = Math.max( a.mouth, Math.max( 0, 0.35 * Math.sin( t * 7.5 ) * Math.sin( t * 0.9 + 1 ) ) );
			if ( this.loretta.state === 'idle' ) a.headYaw = Math.sin( t * 0.5 ) * 0.7;

		}

		if ( this.gus && this.gus.state === 'idle' ) this.gus.p.pose.mouth = Math.max( 0, Math.sin( t * 0.8 ) ) * Math.max( 0, 0.55 * Math.sin( t * 8 ) );
		this._updateLeo( dt, ns );
		this._updateCaricature( dt, ns );
		this._updateNguyens( dt, ns, R );
		this._updatePhun( dt, ns );
		this._updatePhotoOp( dt );
		// Brandon gets looked over as he goes by; his head down at a Phillies run; at the last out he claps
		// for them
		const b = this.brandon;
		if ( b && b.p.visible ) {

			for ( const o of this.P.fans ) {

				if ( o === b || ! o.p.visible || o.mode !== 'walk' ) continue;
				const ds = b.s - o.s, dd = b.d - o.d, e = Math.hypot( ds, dd );
				if ( e > 3.4 || e < 0.5 ) continue;
				const [ dx, dz ] = this.P._worldDir( o.s, o.d, ds, dd );
				let y = Math.atan2( - dx, - dz ) - o.p.yaw;
				y = ( ( y + Math.PI ) % TAU + TAU ) % TAU - Math.PI;
				if ( Math.abs( y ) < 1.3 ) o.p.pose.headYaw = y;

			}

			if ( R && R.kind === 'cheer' ) {

				b.p.pose.headPitch = 0.45;
				b.p.pose.armL = GESTURE.pockets[ 0 ].slice(); b.p.pose.propL = PROP.pocket;

			}

			if ( ns.celebrate ) {

				const open = Math.max( 0, Math.sin( t * 6 ) );
				b.p.pose.armL = lerpArm( GESTURE.clap[ 0 ], GESTURE.clapOpen[ 0 ], open );
				b.p.pose.armR = lerpArm( GESTURE.clap[ 1 ], GESTURE.clapOpen[ 1 ], open );
				b.p.pose.propR = 0;

			}

		}

	}

	_updateUshers( dt ) {

		const t = this.time;
		for ( const u of this.ushers ) {

			const a = u.p.pose;
			a.walk = 0; a.lean = 0; a.propL = 0; a.propR = 0; a.mouth = 0;
			a.armL = [ - 0.35, 0.12, 0.35, 0.9 ]; a.armR = [ - 0.35, 0.12, 0.35, 0.9 ];
			a.headYaw = Math.sin( t * 0.22 + u.order * 7 ) * 0.7;
			a.headPitch = 0;
			let yaw = Walkway.yaw( ...this._dir( u, 0, 1 ) );
			const f = u.checkFan;
			if ( f && f.hold > 0 ) {

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

	_updateLeo( dt, ns ) {

		const L = this.leo;
		if ( ! L ) return;
		const a = L.p.pose, t = this.time;
		a.walk = 0; a.lean = 0.02; a.twist = 0; a.drop = 0;
		a.armL = GESTURE.phone[ 1 ].slice(); a.propL = PR.radio;
		a.armR = GESTURE.carry[ 1 ].slice(); a.propR = PROP.hotdog;
		a.kneeL = 0.1; a.kneeR = 0;
		const S = L.S;
		// facing the line; after a play, turned to it telling them ("Harry says it's in the gap!")
		const [ s, d ] = L.at;
		const [ ls, ld ] = S.at( 0, 3.5 );
		const [ dx, dz ] = this.P._worldDir( s, d, ls - s, ld - d );
		const telling = ns.result && ns.result.t < 5 && ! ns.celebrate;
		a.mouth = telling ? Math.max( 0, 0.45 * Math.sin( t * 8 ) ) : 0;
		a.headYaw = telling ? 0 : Math.sin( t * 0.2 ) * 0.4 - 0.3;
		a.headPitch = telling ? - 0.05 : 0.1;
		if ( telling && ( ns.result.home > 0 || ns.celebrate ) ) {

			a.armR = [ 2.6, 0.3, 0, 0.5 ]; a.propR = PROP.hotdog;

		}

		a.blink = ( t * 0.3 ) % 1 < 0.04 ? 1 : 0;
		this._place( L, s, d, Walkway.yaw( dx, dz ), dt );
		// and the line turns round to him
		if ( telling ) for ( const f of S.line ) {

			const [ fx, fz ] = this.P._worldDir( f.s, f.d, s - f.s, d - f.d );
			let y = Math.atan2( - fx, - fz ) - f.p.yaw;
			y = ( ( y + Math.PI ) % TAU + TAU ) % TAU - Math.PI;
			f.p.pose.headYaw = clamp( y, - 1.4, 1.4 );
			f.p.pose.headPitch = 0;

		}

	}

	_updateCaricature( dt, ns ) {

		const t = this.time;
		const M = this.marty, Mi = this.mai, Li = this.linh;
		if ( M ) {

			const a = M.p.pose;
			seated( a, M.p.scale, 0.62 );
			a.lean = 0.12;
			// a look at her, a few strokes on the pad, another look
			const look = Math.sin( t * 0.9 ) > 0.2;
			a.headPitch = look ? - 0.05 : 0.2;
			a.headYaw = look ? 0.15 : 0;
			a.armR = [ 1.25 + 0.06 * Math.sin( t * 11 ), 0.25, 0.25 + 0.08 * Math.sin( t * 7 ), 0.95 ];
			a.propR = PROP.pencil;
			a.armL = [ 0.6, 0.2, 0.3, 1.3 ]; a.propL = 0;
			a.mouth = Math.sin( t * 0.3 ) > 0.7 ? Math.max( 0, 0.3 * Math.sin( t * 7 ) ) : 0;
			a.blink = ( t * 0.3 ) % 1 < 0.04 ? 1 : 0;
			this._put( M, ...M.at.xz, M.at.yaw, dt );
			M.p.y = STREET;

		}

		if ( Mi ) {

			// trying to sit still; a giggle now and then; her hands in her lap
			const a = Mi.p.pose;
			seated( a, Mi.p.scale, 0.5 );
			a.lean = 0.04;
			a.armL = [ 0.45, 0.12, 0.2, 1.1 ]; a.armR = [ 0.45, 0.12, 0.2, 1.1 ];
			a.propL = 0; a.propR = 0;
			const giggle = Math.max( 0, Math.sin( t * 0.4 + 2 ) - 0.85 ) / 0.15;
			a.mouth = giggle * 0.5;
			a.headYaw = giggle * 0.3;
			a.headPitch = - 0.05;
			a.kneeL = a.kneeR = 1.4 + 0.25 * Math.sin( t * 3 ) * giggle;
			a.blink = ( t * 0.4 ) % 1 < 0.05 ? 1 : 0;
			this._put( Mi, ...Mi.at.xz, Mi.at.yaw, dt );

		}

		if ( Li ) {

			// over his shoulder with her phone out for a picture of the picture
			const a = Li.p.pose;
			a.walk = 0; a.lean = 0.05;
			const snap = Math.sin( t * 0.25 ) > 0.75;
			a.armR = snap ? GESTURE.photo[ 1 ].slice() : GESTURE.fold[ 1 ].slice();
			a.armL = snap ? GESTURE.photo[ 0 ].slice() : GESTURE.fold[ 0 ].slice();
			a.propR = snap ? PROP.phone : 0; a.propL = 0;
			a.headPitch = 0.2;
			a.headYaw = Math.sin( t * 0.15 ) * 0.3;
			a.kneeL = 0.12; a.kneeR = 0;
			a.blink = ( t * 0.33 ) % 1 < 0.04 ? 1 : 0;
			this._put( Li, ...Li.at.xz, Li.at.yaw, dt );

		}

	}

	_updatePhun( dt, ns ) {

		const Q = this.phunQ;
		if ( ! Q ) return;
		const t = this.time;
		const put = ( a, x, y, z, yaw, walk = 0 ) => {

			const p = Q( x, y, z );
			a.p.x = p[ 0 ]; a.p.y = p[ 1 ]; a.p.z = p[ 2 ];
			a.p.yaw = yaw;
			const P = a.p.pose;
			P.walk = walk; P.phase = ( P.phase + dt * walk * 7 ) % ( Math.PI * 2 );
			P.lean = 0; P.twist = 0; P.drop = 0; P.hipL = P.hipR = P.kneeL = P.kneeR = 0; P.propL = P.propR = 0; P.mouth = 0;
			P.armL = [ Math.sin( P.phase ) * 0.3 * walk, 0.1, 0, 0.3 ]; P.armR = [ - Math.sin( P.phase ) * 0.3 * walk, 0.1, 0, 0.3 ];
			P.blink = ( t * 0.4 + x ) % 1 < 0.05 ? 1 : 0;
			return P;

		};

		// the frame's yaw: its +z (the arch's side) as a direction
		const f = Q.dir( 0, 0, 1 ), r = Q.dir( 1, 0, 0 );
		const yawOf = ( d ) => Math.atan2( - d[ 0 ], - d[ 2 ] );
		const [ a, b, c ] = this.phunKids;
		// the first back and forth along the lower deck
		if ( a ) {

			const u = ( t * 0.12 ) % 2, x = u < 1 ? - 3 + 6 * u : 3 - 6 * ( u - 1 );
			const P = put( a, x, 1.4, - 0.6, yawOf( u < 1 ? r : r.map( ( v ) => - v ) ), 0.8 );
			P.mouth = Math.max( 0, 0.4 * Math.sin( t * 5 ) );

		}

		// the second at the top, waving down through the net to his mother
		if ( b ) {

			const P = put( b, 0.6, 2.9, 1.9, yawOf( f ), 0 );
			const wave = Math.sin( t * 0.5 ) > 0.3;
			P.armR = wave ? [ 2.6, 0.4, 0, 0.3 + 0.4 * Math.sin( t * 9 ) ] : [ 1.2, 0.3, 0.2, 1.0 ];
			P.mouth = wave ? 0.6 : 0;

		}

		// the third down the slide, over and over
		if ( c ) {

			const u = ( t * 0.18 ) % 1;
			if ( u < 0.35 ) {

				const k = u / 0.35;
				const P = put( c, 3.9 + k * 2.2, 2.9 * ( 1 - k ) + 0.05, 0, yawOf( r ), 0 );
				seated( P, c.p.scale, 0.25 );
				P.drop = 0.35;
				P.armL = [ 1.5, 0.6, 0, 0.3 ]; P.armR = [ 1.5, 0.6, 0, 0.3 ];
				P.mouth = 0.7;

			} else {

				// off the end and round, then back up inside (out of sight)
				const k = ( u - 0.35 ) / 0.65;
				put( c, 6.2 - k * 2.4, 0, 0.5 + Math.sin( k * 3 ) * 0.8, yawOf( r.map( ( v ) => - v ) ), 1 );
				if ( k > 0.85 ) c.p.y = - 50;

			}

		}

		// the father outside it, on the phone; the mother waving up
		if ( this.phunDad ) {

			const P = put( this.phunDad, - 1.2, 0, 4.6, yawOf( f.map( ( v ) => - v ) ), 0 );
			P.armR = GESTURE.phone[ 1 ].slice(); P.propR = PROP.phone;
			P.armL = GESTURE.pockets[ 0 ].slice(); P.propL = PROP.pocket;
			P.mouth = Math.max( 0, 0.3 * Math.sin( t * 6 ) * Math.sin( t * 0.9 ) );
			P.headYaw = Math.sin( t * 0.2 ) * 0.5;

		}

		if ( this.phunMom ) {

			const P = put( this.phunMom, 1.3, 0, 4.3, yawOf( f.map( ( v ) => - v ) ) + 0.2, 0 );
			const wave = Math.sin( t * 0.5 ) > 0.3;
			P.armR = wave ? [ 2.4, 0.4, 0, 0.3 + 0.3 * Math.sin( t * 8 ) ] : GESTURE.fold[ 1 ].slice();
			P.armL = wave ? GESTURE.pockets[ 0 ].slice() : GESTURE.fold[ 0 ].slice();
			P.propL = wave ? PROP.pocket : 0;
			P.headPitch = - 0.25;

		}

	}

	_updateNguyens( dt, ns, R ) {

		const T = this.tuan, A = this.andy;
		if ( ! T || ! A ) return;
		const t = this.time;
		const big = ns.celebrate || ( R && R.kind === 'cheer' );
		this.lift = lerp( this.lift || 0, ns.celebrate ? 1 : 0, Math.min( 1, dt * 2 ) );
		const L = this.lift;
		const a = T.p.pose;
		a.walk = 0; a.propL = 0; a.propR = 0; a.twist = 0; a.drop = 0;
		a.lean = lerp( 0.25, 0.05, L );
		a.armL = lerpArm( this.tuanRail[ 0 ], GESTURE.liftHigh[ 0 ], L );
		a.armR = lerpArm( this.tuanRail[ 1 ], GESTURE.liftHigh[ 1 ], L );
		a.headPitch = lerp( 0.15, - 0.2, L );
		a.mouth = big ? 0.7 : 0;
		a.blink = ( t * 0.3 ) % 1 < 0.04 ? 1 : 0;
		this._place( T, T.spot.s, T.spot.d, T.spot.face ?? T.p.yaw, dt );
		// Andy: the glove up and open, just in case; jumping at a run; up over the rail at the last out
		const k = A.p.pose;
		k.walk = 0; k.propL = PROP.glove; k.propR = 0;
		k.lean = 0.05;
		k.armL = big ? [ 2.7, 0.3, 0, 0.4 ] : [ 2.1, 0.2, 0.2, 1.0 ];
		k.armR = big ? [ 2.7, 0.3, 0, 0.4 ] : [ 0.6, 0.15, 0.3, 1.0 ];
		k.mouth = big ? 0.9 : 0;
		k.headPitch = - 0.1;
		k.drop = big && ! ns.celebrate ? - Math.max( 0, Math.sin( t * 8 ) ) * 0.1 : 0;
		const s = lerp( A.spot.s, T.spot.s, L ), d = lerp( A.spot.d, T.spot.d - 0.35, L );
		this._place( A, s, d, A.spot.face ?? A.p.yaw, dt );
		A.p.y = STREET + L * 1.0;
		k.hipL = k.hipR = L * 0.5; k.kneeL = k.kneeR = L * 0.9;

	}

}
