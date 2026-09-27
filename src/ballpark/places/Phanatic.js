import { Group, Mesh, PlaneGeometry, Vector3, Color } from '../../engine/index.js';
import { standard } from '../../materials/Materials.js';
import { look as lookFor } from '../game/Looks.js';
import { ATV } from './phanatic/ATV.js';
import { Launcher } from './phanatic/Launcher.js';
import { Ways } from './phanatic/Ways.js';
import { buildNight } from './phanatic/Night.js';
import { registerSounds } from './phanatic/Sounds.js';

// The Phillie Phanatic, all over the park, all night: the most Philadelphia thing in the building. He's
// one slot of the players' rig (game/Players.js, KIND.phanatic: the green fur, the belly, the big
// sneakers, the jersey with PHANATIC and a star on the back), and his night is a plan laid out against
// the replay (phanatic/Night.js): the pregame lap on his four-wheeler, the visitors' dugout roof between
// innings (the dance, the hex on the Rays' pitcher), the hot dog launcher, the ball girls in the rain on
// the 27th, the concourses, a section's aisle, Ashburn Alley and Bull's, the seventh-inning stretch on the
// 29th and the last out. Wherever the camera is, whenever it is, he's somewhere plausible.
//
//   phanatic/Moves.js     his motions in the rig (the waddle, the belly shake, the dances, the hex, ...)
//   phanatic/Ways.js      where he can go: the warning track, the roofs, the aisles, the concourse, the Alley
//   phanatic/Plan.js      a night as acts over the replay's time; at( t ) is pure
//   phanatic/Night.js     his night, act by act, tied to the replay's segments
//   phanatic/ATV.js       his four-wheeler
//   phanatic/Launcher.js  the hot dog launcher and the hot dogs in the air
//   phanatic/Sounds.js    the engine, the thump, the organ's cues for him
//
// For the other places: this.now (and app.phanatic.now) is where he is and what he's doing this frame,
// { visible, x, y, z, yaw, zone, act, onField, excite } in the field frame; director.phanatic.at( t ) the
// same for any time.
export default class Phanatic {

	constructor( { app, field, bowl } ) {

		this.app = app;
		this.field = field;
		this.group = new Group();
		this.group.name = 'phanatic';
		field.group.add( this.group );
		this.ways = new Ways( { field, bowl } );
		this.atv = new ATV( this.group );
		this.launcher = new Launcher( this.group );
		this.towel = this._towel();
		this.now = { visible: false, x: 0, y: 0, z: 0, yaw: 0, zone: 'backstage', act: 'none', onField: false, excite: 0 };
		if ( app ) app.phanatic = this;
		this._sounds = false;
		this.slot = null;
		this.plan = null;
		this._lastT = null;
		this._spots = {};

	}

	// the Game 5 rally towel he waves: a white towel held by a corner, hanging and swinging from his hand
	_towel() {

		const geo = new PlaneGeometry( 0.38, 0.5, 2, 3 );
		geo.translate( 0.19, - 0.25, 0 );
		const mat = standard( { name: 'phanatic-towel', color: new Color( 0.8, 0.79, 0.76 ), roughness: 0.9, side: 'double' } );
		mat.setDefine( 'DRY', 1 );
		const m = new Mesh( geo, mat );
		m.name = 'phanatic-towel';
		m.userData.dynamic = true;
		m.visible = false;
		this.group.add( m );
		return m;

	}

	_init( director, players ) {

		this.director = director;
		this.players = players;
		this.plan = buildNight( { director, ways: this.ways, field: this.field, app: this.app } );
		const lk = lookFor( 'phanatic' );
		this.slot = players.add( { team: 'phanatic', number: '', gloveHand: 'L', name: '', look: lk } );
		this.slot.seed = 0.5;
		this.slot.visible = false;
		this.belly = this.slot.packed.belly;
		// the pure lookup for anyone who wants him at any time (Phanavision, the other places)
		director.phanatic = {
			at: ( t ) => this.plan.at( t ),
			board: ( t ) => this.plan.at( t ).board,
		};

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
			p.role = 0;
			// the belly bounces with what he's doing
			p.packed.belly = this.belly + ( st.pose.jiggle || 0 );

		}

		// the four-wheeler, the launcher, the hot dogs in the air, the towel
		this.atv.set( st.atv ? { ...st.atv, visible: true } : { visible: false } );
		this.launcher.set( st.launcher ? st.launcher : { visible: false } );
		this.launcher.dogs( this.plan.shots || [], t );
		this._placeTowel( st );
		// what the others can read
		const n = this.now;
		n.visible = p.visible; n.x = st.x; n.y = st.y; n.z = st.z; n.yaw = st.yaw;
		n.zone = st.visible ? st.zone : 'backstage';
		n.act = st.act;
		n.onField = st.visible && ( st.zone === 'field' || st.zone === 'roof3B' || st.zone === 'roof1B' );
		n.excite = st.visible ? st.excite : 0;
		this._sound( st, t, director );
		this._lastT = t;

	}

	// the towel hangs from his right hand (its target in the pose, through where he stands)
	_placeTowel( st ) {

		const m = this.towel;
		m.visible = !! ( st.visible && st.towel && st.pose );
		if ( ! m.visible ) return;
		const h = st.pose.handR, s = 1.02, c = Math.cos( st.yaw ), sn = Math.sin( st.yaw );
		const lx = h[ 0 ] * s, lz = h[ 2 ] * s;
		m.position.set( st.x + lx * c + lz * sn, st.y + h[ 1 ] * s, st.z - lx * sn + lz * c );
		const tt = this.director.t;
		m.rotation.set( 0.6 * Math.sin( tt * 10 ), st.yaw + tt * 10, 0.4 * Math.cos( tt * 10 ), 'YXZ' );

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

		// the engine follows the four-wheeler: louder and higher as he opens it up
		const a = st.atv;
		if ( a ) {

			const at = world( a.x, 0.5, a.z );
			if ( ! this._spots.atv ) this._spots.atv = S.spot( 'phan-atv', at, { loop: true, vol: 0.5, ref: 7, max: 180 } );
			const k = Math.min( 1, ( a.speed || 0 ) / 8 );
			this._spots.atv.move( at ).set( { vol: 0.35 + 0.45 * k, rate: 0.55 + 0.75 * k + ( a.rev || 0 ) } );

		} else if ( this._spots.atv ) {

			this._spots.atv.stop();
			this._spots.atv = null;

		}

		// the moments passed as the replay plays (not while scrubbing)
		const t0 = this._lastT;
		if ( t0 == null || ! director.playing || t <= t0 || t - t0 > 1 ) return;
		for ( const e of this.plan.events ) {

			if ( e.t <= t0 ) continue;
			if ( e.t > t ) break;
			this._play( e, S, world );

		}

	}

	_play( e, S, world ) {

		const at = e.at ? world( e.at[ 0 ], e.at[ 1 ], e.at[ 2 ] ) : null;
		switch ( e.kind ) {

			case 'organ': S.play( e.name, { vol: e.vol ?? 0.4 } ); break;
			case 'charge': S.organ?.( 'charge' ); break;
			case 'thump': if ( at ) S.spot( 'phan-thump', at, { vol: 0.9, ref: 5, max: 160 } ); break;
			case 'cheer':
				if ( at ) S.spot( e.name || 'cheer-small', at, { vol: e.vol ?? 0.6, ref: e.ref ?? 10, max: 200, rate: 0.95 + 0.1 * Math.random() } );
				break;
			default: break;

		}

	}

}

void Vector3;
