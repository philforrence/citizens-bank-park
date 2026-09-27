import { InstancedMesh, PlaneGeometry, CylinderGeometry, Matrix4, Vector3, Quaternion, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { look as lookFor } from '../../game/Looks.js';
import { ROLE } from '../../game/Players.js';
import { BONES, FACE, bindMatrices } from '../../game/Rig.js';
import * as M from '../../game/Motions.js';
import * as Mv from './Moves.js';

// The Phillies' ball girls who came out and danced with the Phanatic in the rain on the 27th, after the
// bottom of the 5th (Getty 83477166, Chuck Solomon for SI; pompomflipflop's 2980921474 at 10:18 pm, three
// minutes before Hamels warmed up for the 6th): about eleven of them on the grass just past the infield
// dirt, in the white pinstriped jerseys over red undersleeves, pinstriped shorts, caps and white sneakers,
// soaked, waving white rally towels round him. Eight here, on the first base side in front of the
// Phillies' dugout, each in a slot of the players' rig for the half minute they're out (the slots are
// given back after). The two on the lines (the rail's Jess and Caitlin) stay on their chairs.
//
// Invented (see CAST.md): their first names across their backs over 08.

const GIRLS = [
	[ 'BRIANNA', 'fair', 'sandy' ], [ 'KRISTEN', 'light', 'brown' ], [ 'DANA', 'olive', 'dark' ], [ 'LAUREN', 'fair', 'light' ],
	[ 'TARA', 'tan', 'black' ], [ 'RENEE', 'ruddy', 'red' ], [ 'ALYSSA', 'latin', 'black' ], [ 'COLLEEN', 'fair', 'sandy' ],
];
const SKIN = { fair: [ 0.62, 0.41, 0.3 ], light: [ 0.58, 0.37, 0.26 ], ruddy: [ 0.6, 0.35, 0.24 ], olive: [ 0.5, 0.32, 0.2 ], tan: [ 0.37, 0.215, 0.13 ], latin: [ 0.26, 0.14, 0.08 ] };
const HAIR = { black: [ 0.012, 0.01, 0.008 ], dark: [ 0.03, 0.019, 0.012 ], brown: [ 0.075, 0.045, 0.025 ], light: [ 0.16, 0.1, 0.055 ], sandy: [ 0.26, 0.17, 0.09 ], red: [ 0.2, 0.08, 0.035 ] };

// a ball girl's towel dance: the towel whirled over her head in the right hand, the left hand on her hip
// or clapping, a bounce in the knees, the hips going
function towelWave( t, seed ) {

	const a = t * ( 9 + 3 * seed ), b = Math.sin( t * 4.2 + seed * 5 );
	const p = M.stand( t );
	p.pelvisY -= 0.05 + 0.03 * Math.abs( Math.sin( t * 4.2 ) );
	p.pelvis = [ 0, 0.2 * b, 0.1 * b ];
	p.torso = [ 0.05, - 0.15 * b, - 0.06 * b ];
	p.handR = [ 0.28 + 0.12 * Math.cos( a ), 1.95 + 0.08 * Math.sin( a ), - 0.08 + 0.12 * Math.sin( a ) ];
	p.handL = seed > 0.5 ? [ - 0.22, 1.02, 0.02 ] : [ - 0.05 - 0.05 * Math.abs( Math.sin( t * 7 ) ), 1.3, - 0.3 ];
	p.head = [ - 0.1, 0.25 * Math.sin( t * 0.8 + seed * 3 ) ];
	p.glove = false;
	return p;

}

export class Squad {

	constructor( parent ) {

		this.slots = [];
		this.looks = GIRLS.map( ( [ name, skin, hair ], i ) => ( {
			...lookFor( i % 2 ? 'ballgirl2' : 'ballgirl' ), skin: SKIN[ skin ], hair: HAIR[ hair ],
			height: ( 5 * 12 + 3 + ( i * 5 ) % 6 ) / 74, socks: 'high', jaw: - 0.6, age: 0.1, name,
		} ) );
		// their towels: white terry, whirled by the corner (instanced, one each)
		const geo = new PlaneGeometry( 0.34, 0.46, 2, 3 );
		geo.translate( 0.17, - 0.23, 0 );
		const mat = standard( { name: 'squad-towels', color: new Color( 0.8, 0.79, 0.76 ), roughness: 0.95, side: 'double' } );
		mat.setDefine( 'DRY', 1 );
		this.towels = new InstancedMesh( geo, mat, GIRLS.length );
		this.towels.name = 'ball-girls-towels';
		this.towels.frustumCulled = false;
		this.towels.userData.dynamic = true;
		this.towels.count = 0;
		parent.add( this.towels );
		// their ponytails out the back of the caps, each her own colour, swinging as they dance
		const pg = new CylinderGeometry( 0.035, 0.012, 0.3, 8, 3 );
		pg.translate( 0, - 0.15, 0 );
		const pm = standard( { name: 'squad-ponytails', color: new Color( 1, 1, 1 ), roughness: 0.7 } );
		pm.setDefine( 'DRY', 1 );
		this.tails = new InstancedMesh( pg, pm, GIRLS.length );
		this.tails.name = 'ball-girls-ponytails';
		this.tails.frustumCulled = false;
		this.tails.userData.dynamic = true;
		this.tails.count = 0;
		GIRLS.forEach( ( [ , , hair ], i ) => this.tails.setColorAt( i, new Color( ...HAIR[ hair ].map( ( v ) => v * 1.4 ) ) ) );
		parent.add( this.tails );
		// where a ponytail comes out: the back of the head under the cap (the head bone's frame)
		const { bind } = bindMatrices();
		const hb = new Vector3().fromArray( bind, BONES.head * 16 + 12 );
		this.tailAt = new Vector3( 0, FACE.top[ 1 ] - hb.y - 0.09, FACE.skull.z1 - hb.z - 0.005 );
		this._m = new Matrix4();
		this._r = new Matrix4();
		this._q = new Quaternion();
		this._p = new Vector3();
		this._s = new Vector3();

	}

	// the scene: { t0, t1, center [ x, z ], from [ x, z ] (where they come out), facing (yaw) }
	setScene( scene ) {

		this.scene = scene;

	}

	// where each is at time t (pure): null when they're not out
	at( i, t ) {

		const S = this.scene;
		if ( ! S || t < S.t0 || t > S.t1 ) return null;
		const n = GIRLS.length, tau = t - S.t0, left = S.t1 - t;
		// their spots: a loose arc round him, facing the stands behind the dugout
		const a = ( i - ( n - 1 ) / 2 ) * 0.36;
		const r = 2.6 + 0.6 * ( i % 2 );
		const f = [ - Math.sin( S.facing ), - Math.cos( S.facing ) ];
		const rt = [ - f[ 1 ], f[ 0 ] ];
		const spot = [ S.center[ 0 ] + rt[ 0 ] * Math.sin( a ) * r - f[ 0 ] * ( 1 - Math.cos( a ) ) * r - f[ 0 ] * 0.4, S.center[ 1 ] + rt[ 1 ] * Math.sin( a ) * r - f[ 1 ] * ( 1 - Math.cos( a ) ) * r - f[ 1 ] * 0.4 ];
		const from = [ S.from[ 0 ] + ( i - n / 2 ) * 0.5, S.from[ 1 ] + ( i % 3 ) * 0.4 ];
		const d = Math.hypot( spot[ 0 ] - from[ 0 ], spot[ 1 ] - from[ 1 ] ), v = 3.2;
		const go = d / v, lag = i * 0.25;
		const seed = ( i * 0.37 ) % 1;
		// out at a jog, dancing, back at a jog
		if ( tau < lag + go ) {

			const k = Math.max( 0, ( tau - lag ) / go );
			if ( tau < lag ) return { x: from[ 0 ], z: from[ 1 ], yaw: Math.atan2( - ( spot[ 0 ] - from[ 0 ] ), - ( spot[ 1 ] - from[ 1 ] ) ), pose: M.stand( tau ), towel: true };
			return { x: from[ 0 ] + ( spot[ 0 ] - from[ 0 ] ) * k, z: from[ 1 ] + ( spot[ 1 ] - from[ 1 ] ) * k, yaw: Math.atan2( - ( spot[ 0 ] - from[ 0 ] ), - ( spot[ 1 ] - from[ 1 ] ) ), pose: M.run( tau * 1.6, 0.25 ), towel: true };

		}

		if ( left < go + 0.5 + ( n - i ) * 0.15 ) {

			const k = Math.min( 1, Math.max( 0, ( go + 0.5 + ( n - i ) * 0.15 - left ) / go ) );
			return { x: spot[ 0 ] + ( from[ 0 ] - spot[ 0 ] ) * k, z: spot[ 1 ] + ( from[ 1 ] - spot[ 1 ] ) * k, yaw: Math.atan2( - ( from[ 0 ] - spot[ 0 ] ), - ( from[ 1 ] - spot[ 1 ] ) ), pose: M.run( tau * 1.6, 0.25 ), towel: true };

		}

		// facing the crowd, turned a little toward him, dancing: the towel, then a move of his, and back
		const toHim = Math.atan2( - ( S.center[ 0 ] - spot[ 0 ] ), - ( S.center[ 1 ] - spot[ 1 ] ) );
		const phase = Math.floor( ( tau + seed * 4 ) / 5 ) % 3;
		const pose = phase === 1 ? Mv.dance( tau, seed * 9 ) : towelWave( tau, seed );
		const yaw = S.facing + 0.35 * Math.sin( ( toHim - S.facing ) ) + 0.25 * Math.sin( tau * 0.7 + i );
		return { x: spot[ 0 ], z: spot[ 1 ], yaw, pose, towel: phase !== 1 };

	}

	update( players, t, solve ) {

		const active = this.scene && t >= this.scene.t0 && t <= this.scene.t1;
		if ( ! active ) {

			if ( this.slots.length ) {

				for ( const p of this.slots ) players.remove( p );
				this.slots = [];

			}

			this.towels.count = this.tails.count = 0;
			this.towels.visible = this.tails.visible = false;
			return;

		}

		if ( ! this.slots.length ) this.slots = this.looks.map( ( lk, i ) => {

			const p = players.add( { team: 'home', number: '08', gloveHand: 'L', name: lk.name, look: lk, back: 'name' } );
			p.seed = 0.1 + i * 0.1;
			return p;

		} );

		let n = 0, nt = 0;
		const Y = new Vector3( 0, 1, 0 ), X = new Vector3( 1, 0, 0 );
		this.slots.forEach( ( p, i ) => {

			const s = this.at( i, t );
			p.visible = !! s;
			if ( ! s ) return;
			p.x = s.x; p.z = s.z; p.y = 0; p.yaw = s.yaw; p.pose = s.pose;
			p.role = ROLE.shorts;
			p.dirt = 0;
			const lk = this.looks[ i ];
			const B = solve( { x: s.x, y: 0, z: s.z, yaw: s.yaw, pose: s.pose, height: lk.height, girth: lk.girth || 0.84 } );
			// the ponytail: out the back of the cap, hanging, swung by the dancing
			this._m.fromArray( B, BONES.head * 16 );
			this._p.copy( this.tailAt ).applyMatrix4( this._m );
			this._q.setFromAxisAngle( Y, s.yaw ).multiply( new Quaternion().setFromAxisAngle( X, 0.35 + 0.25 * Math.sin( t * 7 + i ) ) );
			this.tails.setMatrixAt( nt ++, this._r.compose( this._p, this._q, this._s.set( 1, 1, 1 ) ) );
			// the towel: held by a corner, hanging from her fist and whirled round (a world-space swing: it
			// hangs, whatever the wrist does)
			if ( s.towel ) {

				this._m.fromArray( B, BONES.handR * 16 );
				this._p.setFromMatrixPosition( this._m );
				const up = s.pose.handR[ 1 ] > 1.6;
				const whirl = up ? t * ( 9 + i ) : Math.sin( t * 3 + i ) * 0.6;
				this._q.setFromAxisAngle( Y, whirl + s.yaw ).multiply( new Quaternion().setFromAxisAngle( X, up ? 1.1 : 0.2 ) );
				this.towels.setMatrixAt( n ++, this._r.compose( this._p, this._q, this._s.set( 1, 1, 1 ) ) );

			}

		} );
		this.towels.count = n;
		this.tails.count = nt;
		this.towels.visible = n > 0;
		this.tails.visible = nt > 0;
		if ( n ) this.towels.instanceMatrix.needsUpdate = true;
		if ( nt ) this.tails.instanceMatrix.needsUpdate = true;

	}

}


