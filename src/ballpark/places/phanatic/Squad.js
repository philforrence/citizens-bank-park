import { InstancedMesh, PlaneGeometry, Matrix4, Vector3, Quaternion, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';
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

	// (FB3, C3B-18: whirled at about 5 rad/s, not 9 to 12: a soaked towel goes round slower, and at that
	// speed on TV it smeared into a stippled see-through disc under the temporal filter)
	const a = t * ( 4.6 + 1.4 * seed ), b = Math.sin( t * 4.2 + seed * 5 );
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
		// ---- FY2: their towels: white terry rally towels with the red print, held by a corner and whirled;
		// the cloth sags from the fist and flaps behind it as it goes round (the vertex stage: the further
		// from the held corner, the more it waves), soaked and heavy
		const geo = new PlaneGeometry( 0.34, 0.46, 6, 8 );
		geo.translate( 0.17, - 0.23, 0 );
		const print = canvasTexture( 128, 160, ( ctx, w, h ) => {

			ctx.fillStyle = '#efece4'; ctx.fillRect( 0, 0, w, h );
			ctx.fillStyle = '#c8202e'; ctx.fillRect( 0, 6, w, 5 ); ctx.fillRect( 0, h - 11, w, 5 );
			ctx.save(); ctx.translate( w / 2, h * 0.45 ); ctx.rotate( - 0.12 );
			ctx.font = 'italic 700 34px Georgia, "Times New Roman", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.fillText( 'Phillies', 0, 0, w - 10 );
			ctx.restore();
			ctx.font = '800 13px "Helvetica Neue", Arial, sans-serif'; ctx.textAlign = 'center';
			ctx.fillText( 'WORLD SERIES', w / 2, h * 0.72 );

		}, 'squad-towel' );
		const mat = standard( {
			name: 'squad-towels', roughness: 0.95, side: 'double', textures: { sqTowel: print },
			vertex: /* wgsl */`
	let d = length( ( v.uv - vec2f( 0.0, 1.0 ) ) * vec2f( 0.34, 0.46 ) );
	let ph = f32( v.instance ) * 1.7;
	let w = sin( frame.time * 6.0 - d * 12.0 + ph ) * 0.08 + sin( frame.time * 9.0 - d * 20.0 + v.uv.x * 4.0 + ph ) * 0.025;
	v.position = v.position + vec3f( - 0.1 * d * d, - 0.22 * d * d, w * smoothstep( 0.0, 0.25, d ) + 0.15 * d * d );
`,
			// (FB3, C3B-18: the terry a soft mottle, not a per-texel stipple that sparkled at a distance)
			surface: 'let t = textureSample( sqTowel, smpAnisoClamp, vec2f( in.uv.x, 1.0 - in.uv.y ) ).rgb; s.albedo = t * ( 0.93 + 0.07 * mx_noise_float2( in.uv * vec2f( 14.0, 18.0 ) ) ); s.roughness = 0.95;',
		} );
		mat.setDefine( 'DRY', 1 );
		this.towels = new InstancedMesh( geo, mat, GIRLS.length );
		this.towels.name = 'ball-girls-towels';
		this.towels.frustumCulled = false;
		this.towels.userData.dynamic = true;
		this.towels.count = 0;
		parent.add( this.towels );
		// their hair, long and loose and soaked (Getty 83477166, 83458093): from under the caps round the
		// sides and back of the head, down past the shoulders to the shoulder blades behind, each her own
		// colour; a sheet curved round the head (on the head's bone), longest down the back, in wet strands
		const pg = new PlaneGeometry( 1, 1, 12, 6 );
		{

			const pa = pg.getAttribute( 'position' );
			for ( let i = 0; i < pa.count; i ++ ) {

				const u = pa.getX( i ) + 0.5, v = 0.5 - pa.getY( i );
				const th = ( u - 0.5 ) * Math.PI * 1.22; // 0 down the middle of her back
				// longest down her back, to the shoulders at the sides, the ends in wet strands
				const len = ( 0.15 + 0.24 * Math.cos( th / 1.22 ) ** 2 ) * ( 1 - 0.12 * v * ( Math.sin( u * 61 ) * 0.5 + 0.5 ) );
				const r = 1 + 0.3 * v;
				pa.setXYZ( i, Math.sin( th ) * 0.086 * r, - v * len, Math.cos( th ) * 0.108 * r + 0.03 * v * v );

			}

			pg.computeVertexNormals();

		}

		const pm = standard( {
			name: 'squad-hair', color: new Color( 1, 1, 1 ), roughness: 0.38, side: 'double',
			surface: 's.albedo = s.albedo * ( 0.7 + 0.5 * fract( sin( floor( in.uv.x * 70.0 ) * 12.9898 ) * 43758.5 ) ); s.roughness = 0.38;',
		} );
		pm.setDefine( 'DRY', 1 );
		this.tails = new InstancedMesh( pg, pm, GIRLS.length );
		this.tails.name = 'ball-girls-hair';
		this.tails.frustumCulled = false;
		this.tails.userData.dynamic = true;
		this.tails.count = 0;
		GIRLS.forEach( ( [ , , hair ], i ) => this.tails.setColorAt( i, new Color( ...HAIR[ hair ].map( ( v ) => v * 0.9 ) ) ) );
		parent.add( this.tails );
		// where it hangs from: round the skull just under the cap's edge (the head bone's frame)
		const { bind } = bindMatrices();
		const hb = new Vector3().fromArray( bind, BONES.head * 16 + 12 );
		this.tailAt = new Vector3( 0, FACE.top[ 1 ] - hb.y - 0.085, ( FACE.skull.z0 + FACE.skull.z1 ) / 2 - hb.z + 0.006 );
		// ---- end FY2
		this._m = new Matrix4();
		this._r = new Matrix4();
		this._q = new Quaternion();
		this._p = new Vector3();
		this._s = new Vector3();
		this._k = new Matrix4();

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
			// (most in navy caps in the rain, a few in the red: Getty 83477166, 83458678, 84081831)
			p.role = ROLE.shorts | ( i % 3 === 1 ? 0 : ROLE.navyCap );
			p.dirt = 0;
			const lk = this.looks[ i ];
			const B = solve( { x: s.x, y: 0, z: s.z, yaw: s.yaw, pose: s.pose, height: lk.height, girth: lk.girth || 0.84 } );
			// her hair: round her head under the cap, swinging a little as she dances
			this._m.fromArray( B, BONES.head * 16 );
			this._r.makeTranslation( this.tailAt.x, this.tailAt.y, this.tailAt.z ).multiply( this._k.makeRotationZ( 0.06 * Math.sin( t * 7 + i ) ) );
			this.tails.setMatrixAt( nt ++, this._r.premultiply( this._m ) );
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


