import { Mesh, Group, CylinderGeometry, SphereGeometry, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { Cast, TOP, COLOR, HAT, restPose } from '../Cast.js';
import { armIK } from '../Concourse3BKit.js';
import { G29 } from '../../game/Suspension.js';

// God Bless America before the resumption on the 29th (MLB.com, Oct 29 2008: "there will be no
// national anthem. Instead, the crowd will be asked to join in for the singing of 'God Bless America'
// before the first pitch ... performed by Petty Officer First Class Dorcus Whigham, who was scheduled to
// sing it on Monday"; Mark Newman: "a dazzling rendition ... Many in the crowd sang along", 8:26 pm).
// She walks out from the first base side to a microphone on its stand on the grass behind the plate and
// sings it facing the flag in center, in the Navy's dress blues; the park on its feet (Crowd.focus over
// the whole bowl), the crew and everyone on the field still, caps off (Suspension.js). And the seventh-
// inning stretch (Take Me Out to the Ball Game, the recorded organ: A's and S's): the whole park up.
//
// Her look beyond the uniform isn't in any photograph found (none of the song was): kept plain.

const AT = [ 0.6, 9.6 ], FROM = [ 14.5, 7.2 ];
const lerp2 = ( a, b, k ) => [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * k, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * k ];

export class Song {

	constructor( { group, bowl } ) {

		this.crowd = bowl?.crowd || null;
		this.cast = new Cast( { parent: group, max: 1 } );
		const p = this.cast.add( { skin: 3, hair: 0, hairStyle: 2, facial: 0, glasses: false, female: true, age: 0, build: 0, top: TOP.coat, color: COLOR.navy, sleeves: COLOR.navy, pants: 5, shoes: 1, hat: HAT.none, poncho: 0, scarf: 0, gloves: false, seed: 1929 } );
		if ( p ) { p.visible = false; p.pose = restPose(); }
		this.p = p;
		this.arms = [ armIK( - 1, [ - 0.08, 1.35, - 0.3 ] ), armIK( 1, [ 0.05, 1.42, - 0.3 ] ) ];
		// the microphone on its stand
		const m = standard( { name: 'mic-stand', color: new Color( 0.02 ), roughness: 0.3, metalness: 0.8 } );
		m.underwaterLighting = 'none';
		this.stand = new Group();
		const pole = new Mesh( new CylinderGeometry( 0.012, 0.012, 1.45, 8 ), m );
		pole.position.y = 0.72;
		this.stand.add( pole );
		const base = new Mesh( new CylinderGeometry( 0.16, 0.18, 0.03, 16 ), m );
		base.position.y = 0.015;
		this.stand.add( base );
		const mic = new Mesh( new SphereGeometry( 0.028, 10, 8 ), m );
		mic.position.set( 0, 1.48, - 0.03 );
		this.stand.add( mic );
		this.stand.position.set( AT[ 0 ], 0, AT[ 1 ] - 0.45 );
		this.stand.visible = false;
		this.stand.userData.dynamic = true;
		group.add( this.stand );
		this._was = false;

	}

	// N: director.night(); stretch: seconds into the seventh-inning stretch (null otherwise)
	update( N, stretch ) {

		const l2 = N?.back ? N.lt - ( N.split - N.t0 ) : null;
		const [ g0, g1 ] = G29.gba;
		const on = l2 != null && l2 > g0 - 7 && l2 < g1 + 8;
		// the park on its feet for the song and for the stretch
		const up = ( l2 != null && l2 > g0 - 0.5 && l2 < g1 + 1.5 ) || stretch != null;
		if ( this.crowd?.focus ) this.crowd.focus( 'rituals-up', up ? { x: 0, z: - 40, r: 400, stand: 1, arms: stretch != null ? 0.25 : 0.05 } : null );
		this.stand.visible = on;
		if ( ! on && ! this._was ) return;
		this._was = on;
		const p = this.p;
		if ( ! p ) return;
		if ( ! on ) {

			p.visible = false;
			this.cast.update();
			return;

		}

		// out to the microphone, sing, back
		const P = p.pose;
		Object.assign( P, restPose() );
		let at = AT, yaw = 0;
		if ( l2 < g0 - 1 ) {

			const k = Math.min( 1, ( l2 - ( g0 - 7 ) ) / 6 );
			at = lerp2( FROM, AT, k );
			yaw = Math.atan2( - ( AT[ 0 ] - FROM[ 0 ] ), - ( AT[ 1 ] - FROM[ 1 ] ) );
			P.walk = k < 1 ? 0.7 : 0;
			P.phase = k * 14.4 * 4.5;

		} else if ( l2 > g1 + 0.5 ) {

			const k = Math.min( 1, ( l2 - g1 - 0.5 ) / 6 );
			at = lerp2( AT, FROM, k );
			yaw = Math.atan2( - ( FROM[ 0 ] - AT[ 0 ] ), - ( FROM[ 1 ] - AT[ 1 ] ) );
			P.walk = k < 1 ? 0.7 : 0;
			P.phase = k * 14.4 * 4.5;

		} else {

			// at the microphone, her hands at her sides, then together at the last line
			P.mouth = l2 > g0 && l2 < g1 ? 0.3 + 0.35 * Math.abs( Math.sin( l2 * 3.1 ) ) : 0;
			P.headPitch = - 0.12;
			if ( l2 > g1 - 3 ) { P.armL = this.arms[ 0 ]; P.armR = this.arms[ 1 ]; }

		}

		p.x = at[ 0 ]; p.z = at[ 1 ]; p.y = 0; p.yaw = yaw;
		if ( ! p.visible ) p.fresh = true;
		p.visible = true;
		this.cast.update();

	}

}
