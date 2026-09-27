import { Group, Vector3 } from '../../engine/index.js';
import { look as lookFor } from '../game/Looks.js';
import { ROLE } from '../game/Players.js';
import { neutralPose, DIM } from '../game/Rig.js';
import { ATV } from './phanatic/ATV.js';
import { Launcher } from './phanatic/Launcher.js';
import { Gator, GATOR } from './phanatic/Gator.js';
import { Props } from './phanatic/Props.js';
import { Squad } from './phanatic/Squad.js';
import { Tracks } from './phanatic/Tracks.js';
import { Ways, STREET } from './phanatic/Ways.js';
import { buildNight } from './phanatic/Night.js';
import { registerSounds } from './phanatic/Sounds.js';
import { Cast, TOP, COLOR, HAT, PROP, restPose } from './Cast.js';
import * as CastLib from './Cast.js';

// The Phillie Phanatic, all over the park, all night: the most Philadelphia thing in the building. He's
// one slot of the players' rig (game/Players.js, KIND.phanatic: the green fur, the belly, the size-20
// high-tops, the pinstriped jersey with PHANATIC and a star on the back), and his night is a plan laid
// out against the replay (phanatic/Night.js): the pregame lap on the red Honda four-wheeler, the Phillies'
// dugout roof between innings, the hex, the ball girls and the rain on the 27th, the hot dog launcher on
// the Gator, a little Phanatic, the concourses, the aisles, Ashburn Alley and Bull's, the seventh-inning
// stretch and the last out with the 2008 banner. Wherever the camera is, whenever it is, he's somewhere
// plausible (or out of sight in the tunnels, as he was, between).
//
//   phanatic/Moves.js     his motions in the rig (the waddle, the belly shake, the dances, the hex, ...)
//   phanatic/Ways.js      where he can go: the warning track, the roofs, the aisles, the concourse, the Alley
//   phanatic/Plan.js      a night as acts over the replay's time; at( t ) is pure
//   phanatic/Night.js     his night, act by act, tied to the replay's segments
//   phanatic/ATV.js       the four-wheeler; phanatic/Gator.js the hot dog launcher's Gator
//   phanatic/Launcher.js  the hot dogs in the air, the aim
//   phanatic/Props.js     the sou'wester, the chef's toque, the 2008 banner, the popcorn, the party blower
//   phanatic/Squad.js     the ball girls who danced with him in the rain
//   phanatic/Sounds.js    the organ's cues for him (and the recordings: public/audio/places/phanatic/)
//
// For the other places: this.now (and app.phanatic.now) is where he is and what he's doing this frame,
// { visible, x, y, z, yaw, zone, act, onField, excite } in the field frame; director.phanatic.at( t ) the
// same for any time; this.plan.aisles the aisles he goes down and when (B clears its vendors off them).
export default class Phanatic {

	constructor( { app, field, bowl } ) {

		this.app = app;
		this.field = field;
		this.group = new Group();
		this.group.name = 'phanatic';
		field.group.add( this.group );
		this.ways = new Ways( { field, bowl } );
		this.atv = new ATV( this.group );
		this.gator = new Gator( this.group );
		this.dogs = new Launcher( this.group );
		this.props = new Props( this.group );
		this.squad = new Squad( this.group );
		this.tracks = new Tracks( this.group, field );
		// the people who come with his bits (Cast.js): the Gator's two, the dad with the little Phanatic,
		// the kid and his dad at the parked four-wheeler
		this.cast = new Cast( { parent: this.group, max: 8 } );
		this.people = this._people();
		this.now = { visible: false, x: 0, y: 0, z: 0, yaw: 0, zone: 'backstage', act: 'none', onField: false, excite: 0 };
		if ( app ) app.phanatic = this;
		this._sounds = false;
		this.slot = null;
		this.plan = null;
		this._lastT = null;
		this._spots = {};

	}

	// Invented (CAST.md): the Gator's driver, Rob Iacono, and Dwayne Mitchell beside him, both on the
	// club's promotions staff; Chris Dunleavy, 29, from Fishtown, holding up his son Aidan, 2, in the
	// little Phanatic costume with ROLLINS 11 on the back; at the parked four-wheeler on the concourse,
	// Frank Bianchi from Delran and his daughter Sophia, 6, on the seat for the picture
	_people() {

		const C = this.cast;
		const add = ( o ) => {

			const p = C.add( { skin: 1, hair: 1, hairStyle: 0, facial: 0, age: 0, build: 1, top: TOP.jacket, color: COLOR.red, sleeves: COLOR.red, back: 0, chest: 0, pants: 0, shoes: 0, hat: 0, poncho: 0, scarf: 0, seed: 1, ...o } );
			p.visible = false;
			return p;

		};

		return {
			driver: add( { skin: 1, hair: 2, facial: 4, build: 2, top: TOP.staff, color: COLOR.navy, sleeves: COLOR.navy, pants: 2, hat: HAT.capRed, seed: 311 } ),
			rider: add( { skin: 5, hair: 0, top: TOP.staff, color: COLOR.powder, sleeves: COLOR.powder, pants: 1, hat: HAT.capNavy, seed: 312 } ),
			dad: add( { skin: 0, hair: 1, facial: 4, build: 1, top: TOP.homeJersey, color: COLOR.white, sleeves: COLOR.grey, pants: 1, shoes: 1, seed: 313 } ),
			frank: add( { skin: 2, hair: 3, hairStyle: 3, facial: 1, age: 1, build: 3, top: TOP.jacket, color: COLOR.red, sleeves: COLOR.red, chest: 1, pants: 0, hat: HAT.capRed, scarf: 1, seed: 314 } ),
			sophia: add( { skin: 0, hair: 4, hairStyle: 2, female: true, age: 2, build: 0, top: TOP.hoodie, color: COLOR.pink, sleeves: COLOR.pink, pants: 1, hat: HAT.knitRed, seed: 315 } ),
			// his handler (in 2008 a woman on the club's staff dressed him and went everywhere with him in the
			// stands: Main Line Today, July 2008; a real person, so not named here): a step or two behind him
			// in a red Phillies staff jacket, a radio on her hip
			handler: add( { skin: 1, hair: 2, hairStyle: 2, female: true, age: 0, build: 1, top: TOP.staff, color: COLOR.red, sleeves: COLOR.red, pants: 3, shoes: 1, seed: 316 } ),
		};

	}

	// the handler: where he was a couple of seconds ago (so she follows his path), or at his shoulder
	// when he stops; walking when she's moving
	_handler( st, t ) {

		const h = this.people.handler;
		// while he's up on the Phillies' roof she waits at the foot of the steps behind it, watching him
		if ( st.visible && st.zone === 'roof1B' ) {

			const w = this._foot ||= this.ways.roofStairs( '1B' ).pts.slice( - 3 )[ 0 ];
			h.visible = true;
			h.x = w[ 0 ]; h.y = w[ 1 ]; h.z = w[ 2 ];
			h.yaw = Math.atan2( - ( st.x - w[ 0 ] ), - ( st.z - w[ 2 ] ) );
			Object.assign( h.pose, { walk: 0, propL: 0, propR: 0, headYaw: 0, armL: [ 0.05, 0.08, 0, 0.15 ], armR: [ 0.05, 0.08, 0, 0.15 ] } );
			return;

		}

		const among = st.visible && ( st.zone === 'concourse' || st.zone === 'stands' || st.zone === 'alley' );
		h.visible = among;
		if ( ! among ) return;
		const back = this.plan.at( t - 2.2 ), back2 = this.plan.at( t - 2.4 );
		let x = back.x, y = back.y, z = back.z;
		const f = [ - Math.sin( st.yaw ), - Math.cos( st.yaw ) ];
		if ( ! back.visible || back.zone !== st.zone || Math.hypot( x - st.x, z - st.z ) < 1.4 ) {

			// at his shoulder: behind him and to his right
			x = st.x - f[ 0 ] * 1.3 - f[ 1 ] * 0.8; z = st.z - f[ 1 ] * 1.3 + f[ 0 ] * 0.8; y = st.y;

		}

		const v = Math.hypot( back.x - back2.x, back.z - back2.z ) / 0.2;
		const moving = back.visible && v > 0.2 && Math.hypot( x - back.x, z - back.z ) < 0.01;
		h.x = x; h.y = y; h.z = z;
		h.yaw = moving ? Math.atan2( - ( back.x - back2.x ), - ( back.z - back2.z ) ) : Math.atan2( - ( st.x - x ), - ( st.z - z ) );
		const a = h.pose;
		a.walk = moving ? 1 : 0;
		a.phase = t * 5.4;
		a.propL = 0; a.propR = moving ? 0 : PROP.phone * ( Math.sin( t * 0.2 ) > 0.6 ? 1 : 0 );
		a.headYaw = moving ? 0 : 0.4 * Math.sin( t * 0.5 );
		a.armL = [ 0.05, 0.08, 0, 0.15 ];
		a.armR = moving ? [ 0.05, 0.08, 0, 0.15 ] : [ 0.5, 0.1, 0.3, 1.6 ];
		a.blink = ( t * 0.37 ) % 1 < 0.05 ? 1 : 0;

	}

	_init( director, players ) {

		this.director = director;
		this.players = players;
		this.plan = buildNight( { director, ways: this.ways, field: this.field, app: this.app } );
		this.slot = players.add( { team: 'phanatic', number: '', gloveHand: 'L', name: '', look: lookFor( 'phanatic' ) } );
		this.slot.seed = 0.5;
		this.slot.visible = false;
		this.belly = this.slot.packed.belly;
		this.squad.setScene( this.plan.squad );
		this._layTracks( director );
		// the pure lookup for anyone who wants him at any time (Phanavision, the other places)
		director.phanatic = {
			at: ( t ) => this.plan.at( t ),
			board: ( t ) => this.plan.at( t ).board,
		};

	}

	// the wheels' tracks: every ride of the four-wheeler and the Gator's run, sampled from the plan (the
	// 27th's raked out with the tarp at the suspension; the 29th's there to the end)
	_layTracks( director ) {

		const susp = director.segments.find( ( s ) => s.kind === 'switch' && s.snap.inning === 6 && s.snap.half === 'bottom' );
		const tSusp = susp ? susp.t0 + 8 : 1e9;
		const runs = [];
		for ( const a of this.plan.acts ) {

			if ( a.zone !== 'field' || a.t1 > 1e8 || ! a.fn( ( a.t1 - a.t0 ) / 2, a )?.atv ) continue;
			const samples = [];
			for ( let t = a.t0; t <= a.t1; t += 0.08 ) {

				const v = a.fn( t - a.t0, a )?.atv;
				if ( v ) samples.push( { t, x: v.x, z: v.z, yaw: v.yaw } );

			}

			runs.push( { samples, track: 0.81, wheelbase: 1.18, axleBack: 0.52, width: 0.2, end: a.t0 < tSusp - 8 ? tSusp : 1e9 } );

		}

		const G = this.plan.gatorRun;
		if ( G ) {

			const samples = [];
			for ( let t = G.t0; t <= G.tEnd; t += 0.08 ) {

				const g = G.at( t );
				samples.push( { t, x: g.x, z: g.z, yaw: g.yaw } );

			}

			runs.push( { samples, track: 1.18, wheelbase: 1.8, axleBack: 0.88, width: 0.24, end: 1e9 } );

		}

		this.tracks.build( runs );

	}

	update( dt, director, camera ) {

		const players = this.app?.players;
		if ( ! director || ! players ) return;
		if ( ! this.plan ) this._init( director, players );
		const t = director.t;
		const st = this.plan.at( t );
		const p = this.slot;
		p.visible = st.visible && !! st.pose;
		if ( p.visible ) {

			p.x = st.x; p.y = st.y; p.z = st.z; p.yaw = st.yaw;
			p.pose = st.pose;
			p.role = st.role === 'slicker' ? ROLE.slicker : 0;
			// the belly bounces with what he's doing
			p.packed.belly = this.belly + ( st.pose.jiggle || 0 );

		}

		this.props.update( st );
		this.tracks.update( t );
		this._vehicles( st, t );
		this.dogs.dogs( this.plan.shots || [], t );
		this.squad.update( players, t, ( o ) => this.props.solve( o ) );
		this._mini( t );
		this._handler( st, t );
		this._castUpdate( camera );
		// what the others can read
		const n = this.now;
		n.visible = p.visible; n.x = st.x; n.y = st.y; n.z = st.z; n.yaw = st.yaw;
		n.zone = st.visible ? st.zone : 'backstage';
		n.act = st.act;
		n.onField = st.visible && ( st.zone === 'field' || st.zone === 'roof3B' || st.zone === 'roof1B' );
		n.excite = st.visible ? st.excite : 0;
		// everyone's heads turning to him wherever he goes (the shared people system's lookAt: P0's Cast.js;
		// before that merge it isn't there and this does nothing)
		CastLib.lookAt?.( 'phanatic', n.visible && n.zone !== 'backstage' ? { x: n.x, y: n.y + 1.2, z: n.z, r: 14, k: 0.4 + 0.6 * n.excite } : null );
		this._sound( st, t, director );
		this._lastT = t;

	}

	// ---------------------------------------------------------------- the four-wheeler and the Gator

	_vehicles( st, t ) {

		const plan = this.plan, P = this.people;
		// the four-wheeler: under him when he rides, else parked on the first base concourse (after the
		// pregame lap, and again after the 29th's) where the fans pose on it
		const park = plan.atvPark.spot;
		const parked = t > 30 && ! ( st.atv ) && ! ( t > this._rideWindow()[ 0 ] && t < this._rideWindow()[ 1 ] );
		if ( st.atv ) this.atv.set( { ...st.atv, visible: true } );
		else if ( parked ) this.atv.set( { x: park.x, y: STREET, z: park.z, yaw: park.yaw, visible: true } );
		else this.atv.set( { visible: false } );
		// Frank's picture of Sophia on it, now and then when he isn't on it himself
		const sit = parked && st.act !== 'on the four-wheeler for pictures' && ( t % 240 ) < 70;
		this._seat( P.sophia, sit, park.x, STREET, park.z, park.yaw, { scale: 0.62, lift: 0.86 } );
		if ( sit ) {

			const c = Math.cos( park.yaw ), s = Math.sin( park.yaw );
			const fx = park.x + 2.3 * c, fz = park.z - 2.3 * s;
			const f = P.frank;
			f.visible = true;
			f.x = fx; f.y = STREET; f.z = fz; f.yaw = Math.atan2( - ( park.x - fx ), - ( park.z - fz ) );
			const a = f.pose;
			a.walk = 0; a.propR = PROP.camera; a.propL = 0;
			a.armR = [ 1.15, 0.25, 0.45, 2.3 ]; a.armL = [ 1.1, 0.2, 0.55, 2.35 ];
			a.headPitch = 0.05; a.mouth = 0.3 + 0.3 * Math.sin( t * 3 );
			a.blink = ( t * 0.4 ) % 1 < 0.05 ? 1 : 0;

		} else P.frank.visible = false;

		// the Gator: on its run, the two up front
		const G = plan.gatorRun;
		const on = G && t >= G.t0 && t <= G.tEnd;
		if ( on ) {

			const g = G.at( t );
			const recoil = g.since >= 0 && g.since < 0.5 ? Math.exp( - g.since * 8 ) * 0.1 : 0;
			this.gator.set( { x: g.x, z: g.z, yaw: g.yaw, dist: g.dist, steer: g.steer, aimYaw: g.aimYaw, aimPitch: g.aimPitch, recoil, visible: true } );
			this._gatorG = g;
			const c = Math.cos( g.yaw ), s = Math.sin( g.yaw );
			for ( const [ who, [ lx, , lz ], drive ] of [ [ P.driver, [ - 0.3, 0, 0.02 ], true ], [ P.rider, [ 0.3, 0, 0.02 ], false ] ] ) {

				this._seat( who, true, g.x + lx * c + lz * s, 0, g.z - lx * s + lz * c, g.yaw, { lift: GATOR.seatY + 0.12 } );
				const a = who.pose;
				if ( drive ) {

					a.armL = [ 1.05, 0.05, 0.1, 0.9 ]; a.armR = [ 1.0, 0.05, 0.2, 0.9 ];
					a.headYaw = 0.25 * Math.sin( t * 0.5 );

				} else {

					a.armL = [ 0.3, 0.1, 0, 0.8 ]; a.armR = [ 0.5, 0.9, 0, 1.2 ];
					a.headYaw = 0.9 * Math.sin( t * 0.3 ) + 0.5;

				}

			}

		} else {

			this.gator.set( { visible: false } );
			P.driver.visible = P.rider.visible = false;

		}

	}

	// the 29th's ride (no parking then)
	_rideWindow() {

		if ( ! this._rw ) {

			const a = this.plan.acts.find( ( x ) => x.name === 'the 29th: out on the four-wheeler' );
			const b = this.plan.acts.find( ( x ) => x.name === 'out through the gate' );
			this._rw = a && b ? [ a.t0 - 20, b.t1 + 20 ] : [ 0, 0 ];

		}

		return this._rw;

	}

	// a Cast figure sat on something `lift` m up (a seat), facing yaw: the thighs out level, the shins down
	_seat( who, on, x, y, z, yaw, { scale = 1, lift = 0.6 } = {} ) {

		who.visible = on;
		if ( ! on ) return;
		who.x = x; who.y = y + lift - 0.9 * scale; who.z = z; who.yaw = yaw; who.scale = scale;
		const a = who.pose;
		a.walk = 0; a.hipL = a.hipR = 1.45; a.kneeL = a.kneeR = 1.4; a.spread = 0.1;
		a.lean = - 0.05; a.propL = a.propR = 0;
		a.armL = [ 0.35, 0.15, 0, 0.9 ]; a.armR = [ 0.35, 0.15, 0, 0.9 ];

	}

	// ---------------------------------------------------------------- the little Phanatic

	// his dad holds him up at his chest, the little one's legs round his arm, waving a paw; the kid's a slot
	// of the rig (the costume's KIND.phanatic, a third of the size, ROLLINS 11 across his back)
	_mini( t ) {

		const M = this.plan.mini, P = this.people;
		const on = M && t >= M.t0 && t <= M.t1;
		if ( ! on ) {

			if ( this.kid ) {

				this.players.remove( this.kid );
				this.kid = null;

			}

			P.dad.visible = false;
			return;

		}

		if ( ! this.kid ) {

			this.kid = this.players.add( { team: 'phanatic', number: '11', gloveHand: 'L', name: 'ROLLINS', back: 'name', look: { ...lookFor( 'phanatic' ), height: 0.42, girth: 1.1, belly: 1.1 } } );
			this.kid.seed = 0.8;

		}

		const [ x, z ] = M.at, yaw = M.face;
		const d = P.dad;
		d.visible = true;
		d.x = x; d.y = 0; d.z = z; d.yaw = yaw; d.scale = 1.02;
		const a = d.pose;
		Object.assign( a, restPose() );
		a.armL = [ 1.1, 0.15, 0.6, 1.9 ]; a.armR = [ 1.2, 0.1, 0.5, 1.5 ];
		a.headPitch = 0.1; a.headYaw = 0.3 * Math.sin( t * 0.7 ); a.mouth = 0.4 + 0.4 * Math.sin( t * 2.1 );
		a.blink = ( t * 0.33 ) % 1 < 0.05 ? 1 : 0;
		// the kid: on the dad's forearms in front of his chest, facing the same way, a paw up and waving
		const f = [ - Math.sin( yaw ), - Math.cos( yaw ) ];
		const k = this.kid;
		k.visible = true;
		k.x = x + f[ 0 ] * 0.32; k.z = z + f[ 1 ] * 0.32; k.y = 0.8 + 0.02 * Math.sin( t * 5 ); k.yaw = yaw + 0.3 * Math.sin( t * 0.9 );
		const w = Math.sin( t * 6 );
		k.pose = Object.assign( neutralPose(), {
			pelvisY: DIM.hip * 0.62, pelvis: [ 0.25, 0, 0 ], torso: [ 0.1, 0, 0 ], head: [ - 0.1, 0.3 * Math.sin( t * 0.8 ) ],
			footL: [ - 0.2, 0.35, - 0.45 ], footR: [ 0.2, 0.35, - 0.45 ], kneeL: [ 0, 0.3, - 0.9 ], kneeR: [ 0, 0.3, - 0.9 ],
			handL: [ - 0.35, 1.15, - 0.25 ], handR: [ 0.35 + 0.1 * w, 1.75, - 0.2 ], glove: false,
		} );
		k.role = 0;

	}

	_castUpdate( camera ) {

		const cam = camera ? this.field.toField?.( camera.position.x, camera.position.z ) : null;
		const c = cam ? [ cam.x ?? cam[ 0 ], 0, cam.z ?? cam[ 1 ] ] : null;
		this.cast.update( c );

	}

	// ---------------------------------------------------------------- sound

	_sound( st, t, director ) {

		const S = this.app?.sound;
		if ( ! S?.spot ) return;
		if ( ! this._sounds ) {

			registerSounds( S );
			this._sounds = true;

		}

		const F = this.field;
		const world = ( x, y, z ) => {

			const w = F.toWorld( x, z );
			return new Vector3( w.x, F.y0 + y, w.z );

		};

		// the engines follow the four-wheeler and the Gator: louder and higher as they open up
		const a = st.atv;
		this._engine( 'atv', a ? world( a.x, 0.5, a.z ) : null, a ? Math.min( 1, ( a.speed || 0 ) / 8 ) : 0, S, { vol: 0.55, base: 0.8, gain: 0.9 } );
		const g = this.gator.group.visible ? this._gatorG : null;
		this._engine( 'gator', g ? world( g.x, 0.5, g.z ) : null, g ? Math.min( 1, ( g.speed || 0 ) / 5 ) : 0, S, { vol: 0.35, base: 0.6, gain: 0.5 } );
		// the moments passed as the replay plays (not while scrubbing)
		const t0 = this._lastT;
		if ( t0 == null || ! director.playing || t <= t0 || t - t0 > 1 ) return;
		for ( const e of this.plan.events ) {

			if ( e.t <= t0 ) continue;
			if ( e.t > t ) break;
			this._play( e, S, world );

		}

	}

	_engine( key, at, k, S, { vol, base, gain } ) {

		if ( at ) {

			if ( ! this._spots[ key ] ) this._spots[ key ] = S.spot( 'phan-atv', at, { loop: true, vol, ref: 6, max: 160 } );
			this._spots[ key ].move( at ).set( { vol: vol * ( 0.6 + 0.4 * k ), rate: base + gain * k } );

		} else if ( this._spots[ key ] ) {

			this._spots[ key ].stop();
			this._spots[ key ] = null;

		}

	}

	_play( e, S, world ) {

		const at = e.at ? world( e.at[ 0 ], e.at[ 1 ], e.at[ 2 ] ) : null;
		switch ( e.kind ) {

			case 'organ': S.play( e.name, { vol: e.vol ?? 0.4 } ); break;
			case 'charge': S.organ?.( 'charge' ); break;
			case 'thump':
				if ( at ) {

					S.spot( 'phan-launch', at, { vol: 1.0, ref: 6, max: 180 } );
					S.spot( 'phan-thump', at, { vol: 0.7, ref: 6, max: 180 } );

				}

				break;
			case 'cheer':
				if ( at ) S.spot( e.name || 'phan-crowd', at, { vol: e.vol ?? 0.6, ref: e.ref ?? 10, max: 200, rate: 0.95 + 0.1 * Math.random() } );
				break;
			default: break;

		}

	}

}
