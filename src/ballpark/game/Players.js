import { InstancedMesh, Matrix4, Vector3, Quaternion, PlaneGeometry, Color } from '../../engine/index.js';
import { StorageBuffer } from '../../engine/gpu/Texture.js';
import { standard } from '../../materials/Materials.js';
import { commonModule } from '../../engine/render/wgsl/common.js';
import { buildPlayerGeometry, solvePose, skinMatrices, neutralPose, NB, PART, UNIFORM, FACE, DIM, JOINTS as BODY_JOINTS } from './Rig.js';
import { look as lookFor } from './Looks.js';
import { canvasTexture, refreshCanvasTexture } from '../geo.js';

// Everyone on the field in one instanced draw: each instance is a slot, its 17 skinning matrices (and
// last frame's, for the motion vectors) in a storage buffer, the vertex hook skins every vertex by up to
// four of them. Each slot also carries four vec4s of what he looks like and wears (Looks.js): what he
// is (a Phillie in the home whites with red pinstripes, a Ray in the road greys, an umpire, the grounds
// crew, the Phanatic), what he has on right now (a batting helmet, the catcher's gear, a jacket, ...),
// his skin, hair and beard, his build, how he wears the uniform, how dirty it has got. The backs (the
// number, and for the Rays the name over it: the Phillies' home whites have no names) are drawn into a
// cell of a shared atlas; the chests carry the "Phillies" script and RAYS.
//
//   const p = players.add( { team: 'home', number: '54', gloveHand: 'L', look: look( 400058 ) } );
//   p.x, p.z (field frame), p.yaw (0 = facing -z, toward center field), p.pose (Rig.neutralPose())
//   p.role (ROLE bits), p.dirt (0..1, plus DIRT bits for where), p.seed
//   players.update() before rendering; players.remove( p ).

const MAX = 96;
const K = 4; // vec4s per slot
const Z16 = new Float32Array( 16 );
const CELL = 128, COLS = 8, ROWS = 16, ATLAS_W = CELL * COLS, ATLAS_H = CELL * ROWS;
// atlas cells: 0..MAX-1 the slots' backs, then the shared ones
const C = { chestHome: 127, chestAway: 126, capHome: 125, capAway: 124, patch: 123, mlb: 122, jacketHome: 121, jacketAway: 120 };

// what he's wearing (p.role)
export const ROLE = {
	helmet: 1, gear: 2, mask: 4, ccap: 8, jacket: 16, bgloves: 32, mittC: 64, mitt1B: 128, flapL: 256, flapR: 512,
	rake: 1024, hood: 2048, bag: 4096, nocap: 8192, elbowL: 16384, elbowR: 32768, pocket: 65536,
};
// what he is (the first of the slot's numbers)
export const KIND = { away: 0, home: 1, ump: 2, crew: 3, phanatic: 4 };
// where the dirt is (p.dirt's whole part; the fraction is how much): the knees, the seat and the backs
// of the legs (a slide), the front (a dive), a pitcher's drag knee
export const DIRT = { knees: 1, seat: 2, front: 4, dragR: 8, dragL: 16 };

export class Players {

	constructor( { parent } ) {

		this.slots = [];
		this.data = new Float32Array( MAX * NB * 16 * 2 ); // this frame, then the previous one
		this.info = new Float32Array( MAX * K * 4 );
		this.bones = new StorageBuffer( { label: 'playerBones', count: MAX * NB * 2, type: 'mat4x4f' } );
		this.infoBuffer = new StorageBuffer( { label: 'playerInfo', count: MAX * K, type: 'vec4f' } );
		const geo = buildPlayerGeometry();
		this.atlas = canvasTexture( ATLAS_W, ATLAS_H, ( ctx ) => {

			drawChest( ctx, C.chestHome, true );
			drawChest( ctx, C.chestAway, false );
			drawChest( ctx, C.jacketHome, true, true );
			drawChest( ctx, C.jacketAway, false, true );
			drawCapLogo( ctx, C.capHome, true );
			drawCapLogo( ctx, C.capAway, false );
			drawPatch( ctx, C.patch );
			drawMLB( ctx, C.mlb );

		}, 'jerseys' );
		this.atlasCtx = this.atlas.canvas.getContext( '2d' );
		this._atlasDirty = false;
		this.material = playerMaterial( this.bones, this.infoBuffer, this.atlas );
		this.mesh = new InstancedMesh( geo, this.material, MAX );
		this.mesh.name = 'players';
		this.mesh.frustumCulled = false;
		this.mesh.castShadow = true;
		this.mesh.receiveShadow = true;
		parent.add( this.mesh );
		// a soft contact shadow on the ground under each player (grounds them under any light)
		const blobGeo = new PlaneGeometry( 1, 1 );
		blobGeo.rotateX( - Math.PI / 2 );
		this.blobMat = standard( { name: 'player-contact', color: new Color( 0, 0, 0 ), transparent: true, depthWrite: false, lit: false,
			surface: 'let r = length( in.uv - 0.5 ) * 2.0; s.albedo = vec3f( 0.0 ); s.alpha = ( 1.0 - smoothstep( 0.2, 1.0, r ) ) * 0.55;' } );
		this.blobMat.underwaterLighting = 'none';
		this.blobs = new InstancedMesh( blobGeo, this.blobMat, MAX );
		this.blobs.name = 'player-contact-shadows';
		this.blobs.frustumCulled = false;
		this.blobs.layers.set( 2 );
		parent.add( this.blobs );
		this._root = new Matrix4();
		this._first = true;

	}

	add( { team = 'home', number = '', gloveHand = 'L', skin = 0, name = '', look = null, back = null } = {} ) {

		let i = this.slots.findIndex( ( s ) => ! s );
		if ( i < 0 ) i = this.slots.length;
		if ( i >= MAX ) throw new Error( 'too many players' );
		const kind = KIND[ team ] ?? KIND.home;
		const lk = look || lookFor( null, skin * 7.1 + i );
		const p = {
			slot: i, team, kind, number, gloveHand, name, look: lk,
			x: 0, z: 0, y: 0, yaw: 0, tilt: null, // tilt: an extra root rotation (lying in the dogpile)
			pose: neutralPose(), visible: true, fresh: true, role: 0, seed: 0, dirt: 0,
		};
		p.packed = packLook( lk );
		this.slots[ i ] = p;
		drawBack( this.atlasCtx, i, kind, String( number || '' ), name, back );
		this._atlasDirty = true;
		return p;

	}

	remove( p ) {

		if ( this.slots[ p.slot ] === p ) this.slots[ p.slot ] = null;

	}

	clear() {

		this.slots.length = 0;

	}

	update() {

		const D = this.data, half = MAX * NB * 16;
		// last frame's matrices become the previous ones
		D.copyWithin( half, 0, half );
		const q = new Quaternion(), up = new Vector3( 0, 1, 0 ), sc = new Vector3();
		for ( let i = 0; i < MAX; i ++ ) {

			const p = this.slots[ i ];
			const off = i * NB * 16;
			if ( ! p || ! p.visible ) {

				for ( let b = 0; b < NB; b ++ ) D.set( Z16, off + b * 16 );
				continue;

			}

			q.setFromAxisAngle( up, p.yaw );
			if ( p.tilt ) q.multiply( p.tilt );
			const h = p.look.height || 1;
			this._root.compose( new Vector3( p.x, p.y, p.z ), q, sc.set( h, h, h ) );
			solvePose( this._root, p.pose, D, off, p.gloveHand, p.look.girth || 1 );
			skinMatrices( D, off );
			// a player who just appeared has no motion from where his slot was before
			if ( p.fresh ) {

				D.copyWithin( half + off, off, off + NB * 16 );
				p.fresh = false;

			}

			const k = p.packed, o = i * K * 4;
			this.info.set( [ p.kind, 0, p.role || 0, p.seed || 0 ], o );
			this.info.set( [ k.skin[ 0 ], k.skin[ 1 ], k.skin[ 2 ], p.dirt || 0 ], o + 4 );
			this.info.set( [ k.hair[ 0 ], k.hair[ 1 ], k.hair[ 2 ], k.face ], o + 8 );
			this.info.set( [ k.style, k.belly, k.jaw, k.ageStubble ], o + 12 );

		}

		if ( this._first ) {

			D.copyWithin( half, 0, half );
			this._first = false;

		}

		this.bones.write( D );
		this.infoBuffer.write( this.info );
		// draw only as many instances as there are slots in use
		let used = 0;
		for ( let i = 0; i < MAX; i ++ ) if ( this.slots[ i ] && this.slots[ i ].visible ) used = i + 1;
		this.mesh.count = Math.max( 1, used );
		// the contact shadows: under the pelvis, stretched along the stance, fading as he leaves the ground
		const bm = new Matrix4(), bq = new Quaternion(), bs = new Vector3(), bp = new Vector3();
		for ( let i = 0; i < used; i ++ ) {

			const p = this.slots[ i ];
			if ( ! p || ! p.visible || p.tilt || p.noBlob ) {

				this.blobs.setMatrixAt( i, bm.makeScale( 0, 0, 0 ) );
				continue;

			}

			const po = p.pose, lift = Math.max( 0, Math.min( po.footL[ 1 ], po.footR[ 1 ] ) - 0.08 );
			const k = Math.max( 0.2, 1 - lift * 2 );
			const h = p.look.height || 1, w = ( p.look.girth || 1 ) * h;
			const spread = Math.hypot( po.footL[ 0 ] - po.footR[ 0 ], po.footL[ 2 ] - po.footR[ 2 ] ) * h;
			bq.setFromAxisAngle( bs.set( 0, 1, 0 ), p.yaw + Math.atan2( po.footR[ 2 ] - po.footL[ 2 ], po.footR[ 0 ] - po.footL[ 0 ] ) * - 1 );
			bp.set( ( po.footL[ 0 ] + po.footR[ 0 ] ) / 2 * h, 0, ( po.footL[ 2 ] + po.footR[ 2 ] ) / 2 * h ).applyQuaternion( new Quaternion().setFromAxisAngle( bs.set( 0, 1, 0 ), p.yaw ) );
			bm.compose( new Vector3( p.x + bp.x, ( p.y || 0 ) + 0.012, p.z + bp.z ), bq, new Vector3( ( 0.6 * w + spread ) * k, 1, 0.55 * w * k ) );
			this.blobs.setMatrixAt( i, bm );

		}

		this.blobs.count = Math.max( 1, used );
		this.blobs.instanceMatrix.needsUpdate = true;
		if ( this._atlasDirty ) {

			refreshCanvasTexture( this.atlas );
			this._atlasDirty = false;

		}

	}

}

// a look (Looks.js) as the numbers the shader reads
function packLook( L ) {

	const beard = Math.max( 0, Math.min( 7, L.beard | 0 ) );
	const face = beard + ( L.eyeBlack ? 8 : 0 ) + ( L.glasses ? 16 : 0 );
	const palm = L.gloves ? L.gloves[ 0 ] : 0, strap = L.gloves ? L.gloves[ 1 ] : 0;
	const style = ( L.socks === 'high' ? 1 : 0 ) + ( L.sleeves === 'short' ? 2 : 0 ) + ( L.sleeves === 'elbow' ? 4 : 0 ) +
		( L.bands & 1 ? 8 : 0 ) + ( L.bands & 2 ? 16 : 0 ) + ( palm & 7 ) * 32 + ( strap & 7 ) * 256;
	const age = Math.max( 0, Math.min( 9, Math.round( ( L.age ?? 0.2 ) * 9 ) ) );
	return {
		skin: L.skin, hair: L.hair, face, style, belly: L.belly || 0, jaw: L.jaw || 0,
		ageStubble: age + Math.max( 0, Math.min( 0.99, L.stubble ?? 0.4 ) ),
	};

}

function playerMaterial( bones, info, atlas ) {

	const P = PART, U = UNIFORM, F = FACE, J = BODY_JOINTS;
	const f = ( x ) => x.toFixed( 4 );
	const v3 = ( a ) => `vec3f( ${ f( a[ 0 ] ) }, ${ f( a[ 1 ] ) }, ${ f( a[ 2 ] ) } )`;
	const R = ROLE;
	const mat = standard( {
		name: 'players', roughness: 0.75, modules: [ commonModule ],
		storage: { plBones: bones, plInfo: info },
		textures: { plAtlas: atlas },
		attributes: { aBones: 'vec4f', aWeights: 'vec4f', aPart: 'f32', aField: 'vec2f' },
		varyings: { vPart: 'f32', vInfo: 'vec4f', vLocal: 'vec3f', vNrm: 'vec3f', vField: 'vec2f', vSlot: 'f32' },
		vertex: /* wgsl */`
	let slot = v.instance;
	let i0 = plInfo[ slot * ${ K }u ];
	let i2 = plInfo[ slot * ${ K }u + 2u ];
	let i3 = plInfo[ slot * ${ K }u + 3u ];
	let kind = i32( i0.x + 0.5 );
	let role = u32( i0.z + 0.5 );
	let style = u32( i3.x + 0.5 );
	let phan = kind == ${ KIND.phanatic };
	// what he's wearing: the pieces he isn't collapse to nothing
	let pt = i32( v.aPart + 0.5 );
	let helmet = ( role & ${ R.helmet }u ) != 0u;
	var keep = true;
	if ( pt == ${ P.helmet } && ! helmet ) { keep = false; }
	if ( pt == ${ P.cap } && ( helmet || phan || ( role & ${ R.ccap | R.nocap | R.hood }u ) != 0u ) ) { keep = false; }
	if ( pt == ${ P.flapL } && ( ! helmet || ( role & ${ R.flapL }u ) == 0u ) ) { keep = false; }
	if ( pt == ${ P.flapR } && ( ! helmet || ( role & ${ R.flapR }u ) == 0u ) ) { keep = false; }
	if ( pt == ${ P.ccap } && ( role & ${ R.ccap }u ) == 0u ) { keep = false; }
	if ( pt == ${ P.gear } && ( role & ${ R.gear }u ) == 0u ) { keep = false; }
	if ( ( pt == ${ P.mask } || pt == ${ P.maskPad } ) && ( role & ${ R.mask }u ) == 0u ) { keep = false; }
	if ( pt == ${ P.hood } && ( role & ${ R.hood }u ) == 0u ) { keep = false; }
	if ( pt == ${ P.bag } && ( role & ${ R.bag }u ) == 0u ) { keep = false; }
	if ( pt == ${ P.rake } && ( role & ${ R.rake }u ) == 0u ) { keep = false; }
	if ( pt == ${ P.bat } && ( role & ${ R.rake }u ) != 0u ) { keep = false; }
	if ( pt == ${ P.mittC } && ( role & ${ R.mittC }u ) == 0u ) { keep = false; }
	if ( pt == ${ P.mitt1B } && ( role & ${ R.mitt1B }u ) == 0u ) { keep = false; }
	if ( pt == ${ P.glove } && ( role & ${ R.mittC | R.mitt1B }u ) != 0u ) { keep = false; }
	if ( ( pt == ${ P.phHead } || pt == ${ P.snout } || pt == ${ P.phEye } ) && ! phan ) { keep = false; }
	if ( phan && ( pt == ${ P.eye } || pt == ${ P.helmet } ) ) { keep = false; }
	if ( pt == ${ P.glasses } && ( u32( i2.w + 0.5 ) & 16u ) == 0u ) { keep = false; }
	var lp3 = v.position;
	let arm = v.aField.x;
	let leg = v.aField.y;
	if ( pt == ${ P.body } ) {
		// the build the bones can't give: a belly between the belt and the chest, pushed out in front and
		// a little at the sides (the Phanatic's all round)
		let belly = i3.y;
		if ( belly > 0.0 && arm < -0.5 && leg < -0.5 ) {
			let prof = smoothstep( 0.86, 1.1, lp3.y ) * ( 1.0 - smoothstep( 1.16, 1.42, lp3.y ) );
			let front = smoothstep( 0.03, -0.09, lp3.z );
			let side = 1.0 - smoothstep( 0.08, 0.2, abs( lp3.x ) );
			lp3 += vec3f( lp3.x * 0.3 * prof * belly, 0.0, - 0.07 * prof * belly * mix( front * side, 0.6 + 0.4 * front, select( 0.0, 1.0, phan ) ) );
		}
		// a jacket stands off the body; long pants hang loose over the shoe tops
		if ( ( role & ${ R.jacket }u ) != 0u && ( ( arm > -0.5 && arm < ${ f( U.wrist ) } ) || ( arm < -0.5 && leg < -0.5 && lp3.y > ${ f( U.belt[ 0 ] - 0.08 ) } && lp3.y < ${ f( U.collar ) } ) ) ) {
			lp3 += v.normal * 0.013;
		}
		if ( ( style & 1u ) == 0u && leg > 0.5 ) { lp3 += v.normal * 0.016 * smoothstep( 0.55, 0.84, leg ); }
		// the face: the jaw broader or narrower, a full beard's thickness
		let eye = ${ v3( F.eyeR ) };
		if ( arm < -0.5 && leg < -0.5 && lp3.y > ${ f( J.neck[ 1 ] ) } ) {
			let jawK = smoothstep( eye.y, ${ f( F.jaw[ 1 ] ) }, lp3.y ) * smoothstep( ${ f( J.neck[ 1 ] - 0.01 ) }, ${ f( F.jaw[ 1 ] ) }, lp3.y );
			lp3.x = lp3.x * ( 1.0 + i3.z * 0.09 * jawK );
			let beard = u32( i2.w + 0.5 ) & 7u;
			let front = lp3.z < eye.z + 0.075;
			let bz = lp3.y < ${ f( F.mouth[ 1 ] ) } + 0.012 && lp3.y > ${ f( F.jaw[ 1 ] - 0.035 ) } && front;
			if ( bz && beard == 5u ) { lp3 += v.normal * 0.007; }
			if ( bz && ( beard == 3u || beard == 4u ) && abs( lp3.x ) < 0.03 && lp3.y < ${ f( F.mouth[ 1 ] ) } - 0.008 ) { lp3 += v.normal * 0.004; }
		}
	}
	// the Phanatic's big sneakers
	if ( phan && pt == ${ P.shoes } ) {
		let ank = select( ${ v3( J.ankleL ) }, ${ v3( J.ankleR ) }, lp3.x > 0.0 );
		lp3 = ank + ( lp3 - ank ) * vec3f( 1.55, 1.0, 1.5 );
	}
	let lp = select( vec4f( 0.0, 0.0, 0.0, 1.0 ), vec4f( lp3, 1.0 ), keep );
	// skinned: up to four bones, each taking the bind pose to this frame's (and last frame's) pose
	var wp = vec3f( 0.0 );
	var wn = vec3f( 0.0 );
	var pp = vec3f( 0.0 );
	for ( var k = 0; k < 4; k ++ ) {
		let w = v.aWeights[ k ];
		if ( w > 0.0 ) {
			let b = u32( v.aBones[ k ] + 0.5 );
			let M = plBones[ slot * ${ NB }u + b ];
			let Mp = plBones[ ( ${ MAX }u + slot ) * ${ NB }u + b ];
			wp += ( M * lp ).xyz * w;
			wn += ( M * vec4f( v.normal, 0.0 ) ).xyz * w;
			pp += ( Mp * lp ).xyz * w;
		}
	}
	v.useWorld = true;
	v.worldPos = ( v.model * vec4f( wp, 1.0 ) ).xyz;
	v.worldNormal = normalize( ( v.model * vec4f( wn, 0.0 ) ).xyz + vec3f( 0.0, 1e-6, 0.0 ) );
	v.prevWorldPos = ( v.prevModel * vec4f( pp, 1.0 ) ).xyz;
	o.vPart = v.aPart;
	o.vInfo = i0;
	o.vLocal = lp3;
	o.vNrm = v.normal;
	o.vField = v.aField;
	o.vSlot = f32( slot );
`,
		surface: /* wgsl */`
	var part = i32( in.vs.vPart + 0.5 );
	let slotU = u32( in.vs.vSlot + 0.5 );
	let i1 = plInfo[ slotU * ${ K }u + 1u ];
	let i2 = plInfo[ slotU * ${ K }u + 2u ];
	let i3 = plInfo[ slotU * ${ K }u + 3u ];
	let kind = i32( in.vs.vInfo.x + 0.5 );
	let home = kind == ${ KIND.home };
	let ump = kind == ${ KIND.ump };
	let crew = kind == ${ KIND.crew };
	let phan = kind == ${ KIND.phanatic };
	let role = u32( in.vs.vInfo.z + 0.5 );
	let seed = in.vs.vInfo.w;
	let skinC = i1.rgb;
	let dirtBits = u32( floor( i1.w ) );
	let dirt = fract( i1.w );
	let hairBase = i2.rgb;
	let face = u32( i2.w + 0.5 );
	let style = u32( i3.x + 0.5 );
	let highSocks = ( style & 1u ) != 0u;
	let age = floor( i3.w ) / 9.0;
	let stubble = fract( i3.w );
	let jacket = ( role & ${ R.jacket }u ) != 0u;
	let L = in.vs.vLocal;
	let Nb = normalize( in.vs.vNrm );
	let arm = in.vs.vField.x;
	let leg = in.vs.vField.y;
	// the rain: the cloth soaks through (darker, heavier), the skin and the helmets shine
	let soak = smoothstep( 0.3, 0.85, frame.wet ) * ( 0.55 + 0.45 * smoothstep( -0.2, 0.8, in.N.y ) );

	// what he wears: the jersey's cloth, the trim (undershirt, socks, cap), the pants, the belt
	// home: white, red pinstripes, red trim and caps, a black belt; away: road grey and navy; the
	// umpires: a black jacket, grey slacks, a black cap; the grounds crew: red jackets and khakis; the
	// Phanatic: a white jersey over green fur
	var cloth = vec3f( 0.28, 0.28, 0.29 );
	var trim = vec3f( 0.012, 0.018, 0.06 );
	var pantsC = cloth;
	var beltC = trim;
	var capC = trim;
	if ( home || phan ) { cloth = vec3f( 0.83, 0.82, 0.79 ); trim = vec3f( 0.42, 0.018, 0.025 ); pantsC = cloth; beltC = vec3f( 0.02 ); capC = trim; }
	if ( ump ) { cloth = vec3f( 0.014, 0.015, 0.02 ); trim = cloth; pantsC = vec3f( 0.2, 0.2, 0.21 ); beltC = vec3f( 0.01 ); capC = vec3f( 0.012 ); }
	if ( crew ) { cloth = vec3f( 0.3, 0.016, 0.02 ); trim = cloth; pantsC = vec3f( 0.25, 0.2, 0.13 ); beltC = vec3f( 0.03, 0.02, 0.01 ); capC = cloth; }
	// the team's dugout jacket: the Phillies' red, the Rays' navy
	let jacketC = select( vec3f( 0.012, 0.02, 0.065 ), vec3f( 0.36, 0.016, 0.024 ), home );
	var hairC = mix( hairBase, vec3f( 0.3, 0.29, 0.28 ), smoothstep( 0.5, 1.0, age ) * 0.5 );
	let fur = skinC;

	// the body's own pieces: which part of the uniform (or skin) this is, from where it is
	var skinArea = 0; // 1 the head and neck, 2 a hand, 3 a bare forearm
	var around = 0.0; // distance round the limb or the trunk, for the pinstripes
	var band = false;
	var cuffKnit = false;
	if ( part == ${ P.body } ) {
		if ( arm > -0.5 ) {
			// the sleeves: the jersey's to the upper arm, then the undershirt's (long, to the elbow, or a
			// short one peeking out); a jacket's to the wrist; wristbands
			let sideBand = select( ( style & 8u ) != 0u, ( style & 16u ) != 0u, L.x > 0.0 );
			var sleeveEnd = ${ f( U.wrist ) };
			if ( ( style & 4u ) != 0u ) { sleeveEnd = 0.32; }
			if ( ( style & 2u ) != 0u ) { sleeveEnd = ${ f( U.sleeve + 0.045 ) }; }
			if ( jacket ) {
				if ( arm < ${ f( U.wrist - 0.012 ) } ) { part = ${ P.jersey }; cuffKnit = arm > ${ f( U.wrist - 0.05 ) }; }
				else { part = ${ P.skin }; skinArea = 2; }
			} else if ( arm < ${ f( U.sleeve ) } ) { part = ${ P.jersey }; }
			else if ( arm < sleeveEnd ) { part = ${ P.sleeve }; }
			else if ( arm < ${ f( U.wrist ) } ) { part = ${ P.skin }; skinArea = 3; }
			else { part = ${ P.skin }; skinArea = 2; }
			if ( sideBand && ! jacket && arm > ${ f( U.wrist - 0.07 ) } && arm < ${ f( U.wrist - 0.004 ) } ) { band = true; }
			// the batter's elbow guard on his front arm: a hard shell over the point of the elbow
			let guard = select( ( role & ${ R.elbowL }u ) != 0u, ( role & ${ R.elbowR }u ) != 0u, L.x > 0.0 );
			if ( guard && arm > 0.235 && arm < 0.345 && Nb.z > -0.35 ) { part = ${ P.gear }; }
			// round the upper arm
			let side = sign( L.x );
			let sh = vec3f( side * ${ f( J.shoulderR[ 0 ] ) }, ${ f( J.shoulderR[ 1 ] ) }, ${ f( J.shoulderR[ 2 ] ) } );
			let el = vec3f( side * ${ f( J.elbowR[ 0 ] ) }, ${ f( J.elbowR[ 1 ] ) }, ${ f( J.elbowR[ 2 ] ) } );
			let ax = normalize( el - sh );
			let e1 = normalize( cross( ax, vec3f( 0.0, 0.0, 1.0 ) ) );
			let d = L - sh;
			around = atan2( dot( d, cross( ax, e1 ) ), dot( d, e1 ) ) * 0.055;
		} else if ( leg > -0.5 ) {
			// high socks: the pants end below the knee; long pants to the shoe tops
			let cuffAt = select( 0.845, ${ f( U.cuff ) }, highSocks || phan );
			part = select( ${ P.socks }, ${ P.pants }, leg < cuffAt );
			let side = sign( L.x );
			let hp = vec3f( side * ${ f( J.hipR[ 0 ] ) }, ${ f( J.hipR[ 1 ] ) }, ${ f( J.hipR[ 2 ] ) } );
			let kn = vec3f( side * ${ f( J.kneeR[ 0 ] ) }, ${ f( J.kneeR[ 1 ] ) }, ${ f( J.kneeR[ 2 ] ) } );
			let ax = normalize( kn - hp );
			let e1 = normalize( cross( ax, vec3f( 0.0, 0.0, 1.0 ) ) );
			let d = L - hp;
			around = atan2( dot( d, cross( ax, e1 ) ), dot( d, e1 ) ) * 0.085;
		} else {
			// the neck: the jersey's collar round its base (lower in front, higher behind), the undershirt's
			// crew collar just inside it and in the V of the placket at the front
			let nk = ${ v3( J.neck ) };
			let r = length( vec2f( L.x, L.z - nk.z ) );
			let cy = nk.y - 0.03 + 0.3 * clamp( L.z - nk.z, -0.08, 0.07 );
			let vee = L.z < nk.z - 0.03 && L.y > cy - 0.07 && abs( L.x ) < 0.03 * clamp( ( L.y - cy + 0.07 ) / 0.06, 0.0, 1.0 );
			if ( L.y > nk.y + 0.03 || ( L.y > cy && r < 0.1 ) ) { part = ${ P.skin }; skinArea = 1; }
			else if ( ( L.y > cy - 0.011 && r < 0.11 ) || vee ) { part = select( ${ P.sleeve }, ${ P.jersey }, jacket ); }
			else if ( L.y > ${ f( U.belt[ 1 ] ) } ) { part = ${ P.jersey }; }
			else if ( L.y > ${ f( U.belt[ 0 ] ) } ) { part = ${ P.belt }; }
			else { part = ${ P.pants }; }
			// a jacket's collar rides up the neck a little further
			if ( jacket && part == ${ P.skin } && L.y < nk.y + 0.005 && L.z > nk.z - 0.06 ) { part = ${ P.jersey }; cuffKnit = true; }
			around = atan2( L.x, - L.z ) * 0.17;
		}
	}

	var c = cloth;
	var rough = 0.82;
	var clothy = false;
	if ( part == ${ P.jersey } || part == ${ P.pants } || part == ${ P.sleeve } || part == ${ P.socks } || part == ${ P.belt } ) { clothy = true; }
	if ( part == ${ P.pants } ) { c = pantsC; }
	// a fielder's batting gloves stuffed in his back pocket, the fingers hanging out
	let pocketGloves = ( role & ${ R.pocket }u ) != 0u && part == ${ P.pants } && leg < -0.5 && L.x > 0.035 && L.x < 0.11 && Nb.z > 0.25 && L.y < ${ f( U.belt[ 0 ] - 0.02 ) } && L.y > ${ f( U.belt[ 0 ] - 0.1 - 0.03 ) } - 0.03 * fract( L.x * 40.0 );
	if ( ( part == ${ P.jersey } || part == ${ P.pants } ) && home && ! ( jacket && part == ${ P.jersey } ) ) {
		// red pinstripes 2.5 cm apart, 1.5 mm wide; box-filtered, fading to their average when they're
		// finer than a pixel
		let u = around / 0.025;
		let fw = max( fwidth( u ), 1e-4 );
		let d = abs( fract( u ) - 0.5 );
		let cover = clamp( ( 0.03 - d ) / fw + 0.5, 0.0, 1.0 );
		let k = mix( cover, 0.06, smoothstep( 0.25, 0.8, fw ) );
		c = mix( cloth, vec3f( 0.43, 0.02, 0.04 ), k * 0.8 );
	}
	if ( part == ${ P.jersey } && jacket ) {
		// the jacket: nylon with a sheen, a knit collar and cuffs, the zip down the front
		c = jacketC; rough = 0.45;
		if ( cuffKnit ) { c = jacketC * 0.7; rough = 0.9; }
		if ( arm < -0.5 && abs( L.x ) < 0.005 && L.z < 0.0 && L.y > ${ f( U.belt[ 1 ] ) } ) { c = vec3f( 0.25, 0.25, 0.26 ); rough = 0.3; }
	}
	// the Phanatic: fur everywhere but his jersey (riding up over the belly) and his socks
	if ( phan && part == ${ P.jersey } && ( L.y < 1.24 && arm < -0.5 ) ) { part = ${ P.hair }; }
	if ( phan && ( part == ${ P.pants } || part == ${ P.belt } || part == ${ P.sleeve } || part == ${ P.skin } ) ) { part = ${ P.hair }; }

	// the lettering and logos from the atlas: the back (number, name) and the chest (the club's name)
	// on the trunk's back and front, the cap's (or helmet's) front and the MLB logo at the back, the World
	// Series patch on the right sleeve; a jacket shows the club on its chest and nothing on its back
	var cell = -1.0;
	var lu = 0.0;
	var lv = 0.0;
	if ( part == ${ P.jersey } && arm < -0.5 ) {
		if ( Nb.z > 0.05 && ! jacket ) { cell = in.vs.vSlot; lu = 0.5 + L.x / 0.34; lv = 1.0 - ( L.y - 1.17 ) / 0.34; }
		if ( Nb.z < -0.05 ) {
			cell = select( select( ${ C.chestAway }.0, ${ C.chestHome }.0, home || phan ), select( ${ C.jacketAway }.0, ${ C.jacketHome }.0, home ), jacket );
			lu = 0.5 - L.x / 0.3; lv = 1.0 - ( L.y - 1.27 ) / 0.18;
		}
	}
	if ( part == ${ P.jersey } && arm > -0.5 && L.x > 0.0 && Nb.x > 0.3 && ! jacket ) {
		cell = ${ C.patch }.0; lu = 0.5 - ( L.z - ${ f( J.shoulderR[ 2 ] ) } ) / 0.085; lv = ( arm - 0.05 ) / 0.085;
	}
	if ( ( part == ${ P.cap } || part == ${ P.helmet } ) && Nb.z < -0.35 ) {
		cell = select( ${ C.capAway }.0, ${ C.capHome }.0, home || crew ); lu = 0.5 - L.x / 0.09; lv = 0.5 - ( L.y - ${ f( F.top[ 1 ] - 0.062 ) } ) / 0.09;
	}
	if ( ( part == ${ P.cap } || part == ${ P.helmet } ) && Nb.z > 0.5 && Nb.y < 0.75 ) {
		// the batterman at the back
		cell = ${ C.mlb }.0; lu = 0.5 + L.x / 0.036; lv = 0.5 - ( L.y - ${ f( F.top[ 1 ] - 0.07 ) } ) / 0.04;
	}
	if ( ( ump || crew ) && part != ${ P.cap } ) { cell = -1.0; }
	if ( ump && part == ${ P.cap } ) { cell = -1.0; }
	let cxy = vec2f( cell % ${ COLS }.0, floor( cell / ${ COLS }.0 ) );
	let inCell = cell >= 0.0 && lu > 0.02 && lu < 0.98 && lv > 0.02 && lv < 0.98;
	let auv = ( cxy + clamp( vec2f( lu, lv ), vec2f( 0.02 ), vec2f( 0.98 ) ) ) / vec2f( ${ COLS }.0, ${ ROWS }.0 );
	let ink = textureSample( plAtlas, smpAnisoClamp, auv );

	// a batting glove colour
	let palm = ( style >> 5u ) & 7u;
	let strap = ( style >> 8u ) & 7u;
	var pal = array<vec3f, 8>( vec3f( 0.018 ), vec3f( 0.8, 0.79, 0.76 ), vec3f( 0.42, 0.02, 0.03 ), vec3f( 0.012, 0.02, 0.07 ),
		vec3f( 0.22, 0.42, 0.68 ), vec3f( 0.3, 0.3, 0.31 ), vec3f( 0.55, 0.38, 0.05 ), vec3f( 0.02, 0.06, 0.3 ) );

	if ( part == ${ P.skin } ) {
		c = skinC; rough = mix( 0.6, 0.32, soak );
		// light carried under the skin: a warm wrap past the terminator, less of a grey sheen
		s.translucency = skinC * vec3f( 0.16, 0.07, 0.04 );
		s.specularIntensity = 0.55;
		// and the light bounced up off the field into the shade of the cap
		s.emissive = skinC * frame.sunColor * vec3f( 0.035, 0.03, 0.026 );
		// batting gloves on the batter and the runners: the palm's colour, the strap and its tab at the wrist
		if ( skinArea == 2 && ( role & ${ R.bgloves }u ) != 0u ) {
			c = pal[ palm ];
			if ( arm < ${ f( U.wrist + 0.03 ) } ) { c = pal[ strap ]; }
			if ( Nb.z > 0.4 && abs( fract( L.y * 45.0 ) - 0.5 ) < 0.08 ) { c = mix( c, pal[ strap ], 0.6 ); }
			rough = 0.55;
			s.translucency = vec3f( 0.0 );
			s.specularIntensity = 1.0;
		}
		// the umpires' and the crew's hands stay bare; the Phanatic's are fur (above)
		if ( skinArea == 1 ) {
			let ax = abs( L.x );
			let eye = ${ v3( F.eyeR ) };
			let isFace = L.z < eye.z + 0.035;
			// the hair: the back and the sides of the head above the neck, behind the temples (the cap
			// covers the top), greying at the temples with age; the ears stay skin
			let ear = ax > 0.066 && L.y < eye.y + 0.012 && L.y > eye.y - 0.058 && L.z > eye.z + 0.06 && L.z < eye.z + 0.13;
			let hairline = ( L.y > eye.y + 0.028 && L.z > eye.z + 0.045 ) || ( L.y > eye.y - 0.05 && L.z > eye.z + 0.105 ) || L.y > eye.y + 0.06;
			if ( hairline && ! ear ) {
				let edge = smoothstep( eye.y - 0.06, eye.y - 0.04, L.y );
				let temple = smoothstep( 0.05, 0.075, ax ) * smoothstep( eye.z + 0.13, eye.z + 0.06, L.z ) * age;
				c = mix( skinC * 0.6, mix( hairC, vec3f( 0.42, 0.41, 0.4 ), temple * 0.7 ), 0.5 + 0.5 * edge ); rough = 0.7;
			}
			if ( isFace ) {
				// the brows
				let by = eye.y + 0.021 + 0.004 * ( 1.0 - smoothstep( 0.012, 0.05, ax ) ) - 0.004 * smoothstep( 0.03, 0.055, ax );
				if ( abs( L.y - by ) < 0.0045 && ax > 0.009 && ax < 0.055 ) { c = mix( c, hairC, 0.8 ); }
				// the lips
				let m = vec3f( 0.0, ${ f( F.mouth[ 1 ] ) }, ${ f( F.mouth[ 2 ] ) } );
				let lq = length( vec2f( L.x / 0.025, ( L.y - m.y ) / 0.008 ) );
				if ( lq < 1.0 && L.z < m.z + 0.02 ) { c = mix( c, skinC * vec3f( 0.8, 0.52, 0.5 ), smoothstep( 1.0, 0.6, lq ) ); rough = 0.4; }
				// the stubble's shadow over the jaw, the chin and the upper lip, then the beard he wears:
				// a goatee on the chin, with a moustache joining it round the mouth, a short full beard up
				// the cheeks to the sideburns, a moustache alone, a chin strap along the jawline
				let beardK = face & 7u;
				let jawY = ${ f( F.jaw[ 1 ] ) };
				let jawZone = L.y < m.y + 0.02 && L.y > jawY - 0.012 && lq > 0.95;
				let beardC = hairC * 0.9;
				let grain = 0.75 + 0.5 * hash31( floor( L * 900.0 ) );
				var bk = 0.0;
				if ( jawZone ) {
					let k = smoothstep( jawY - 0.012, jawY + 0.004, L.y );
					c = mix( c, c * vec3f( 0.7, 0.68, 0.7 ), stubble * 0.5 * k );
				}
				let lipUp = L.y > m.y + 0.005 && L.y < m.y + 0.02 && ax < 0.028 && lq > 0.9;
				let chin = ax < 0.028 && L.y < m.y - 0.009 && L.y > jawY - 0.03;
				let corners = ax > 0.018 && ax < 0.032 && L.y < m.y + 0.012 && L.y > m.y - 0.03;
				if ( beardK == 3u && chin ) { bk = 1.0; }
				if ( beardK == 4u && ( chin || lipUp || corners ) ) { bk = 1.0; }
				if ( beardK == 5u && ( ( L.y < eye.y - 0.045 && L.y > jawY - 0.035 && lq > 0.95 && ! ( ax < 0.02 && L.y > m.y + 0.022 ) ) || lipUp ) ) { bk = 1.0; }
				if ( beardK == 6u && lipUp ) { bk = 1.0; }
				if ( beardK == 7u && ( ( L.y < jawY + 0.012 && L.y > jawY - 0.03 ) || lipUp || chin ) ) { bk = 1.0; }
				if ( beardK == 2u && jawZone ) { c = mix( c, beardC, 0.35 ); }
				if ( bk > 0.0 ) { c = mix( c, beardC * grain, 0.88 ); rough = 0.8; }
				// the eye sockets a shade darker; the shadow under the nose and the lower lip, the jaw's
				// underside; a little colour in the cheeks
				let es = length( vec2f( ax - abs( eye.x ), ( L.y - eye.y ) * 1.4 ) );
				c = c * mix( 0.78, 1.0, smoothstep( 0.012, 0.024, es ) );
				if ( ax < 0.022 && L.y > m.y + 0.011 && L.y < m.y + 0.024 ) { c = c * mix( 0.8, 1.0, smoothstep( 0.012, 0.022, ax ) ); }
				if ( ax < 0.024 && L.y < m.y - 0.008 && L.y > m.y - 0.016 ) { c = c * 0.86; }
				let cheek = smoothstep( 0.02, 0.0, abs( ax - 0.045 ) ) * smoothstep( 0.03, 0.0, abs( L.y - ( m.y + 0.03 ) ) );
				c = mix( c, c * vec3f( 1.08, 0.86, 0.84 ), cheek * 0.4 );
				// eye black: a greasy smudge on each cheekbone
				if ( ( face & 8u ) != 0u && ax > 0.014 && ax < 0.05 && L.y < eye.y - 0.012 && L.y > eye.y - 0.03 ) { c = vec3f( 0.01 ); rough = 0.35; }
				// age: the lines round the eyes and down from the nose
				if ( age > 0.5 ) {
					let crow = ax > 0.05 && ax < 0.065 && abs( L.y - eye.y ) < 0.012 && fract( L.y * 260.0 ) < 0.35;
					if ( crow ) { c = c * 0.85; }
				}
			}
			if ( L.y < ${ f( F.jaw[ 1 ] ) } + 0.006 && Nb.y < -0.25 ) { c = c * 0.72; }
		}
	}
	if ( band ) { c = select( select( vec3f( 0.8, 0.79, 0.76 ), trim, ( style & 32u ) != 0u ), trim, home ); rough = 0.95; clothy = true; }
	if ( part == ${ P.eye } ) {
		// the eyeball: white, a dark iris and pupil looking ahead
		let side = sign( L.x );
		let ec = vec3f( side * ${ f( F.eyeR[ 0 ] ) }, ${ f( F.eyeR[ 1 ] ) }, ${ f( F.eyeR[ 2 ] ) } );
		let d = normalize( L - ec );
		c = vec3f( 0.62, 0.6, 0.56 ); rough = 0.08;
		if ( d.z < -0.93 ) { c = vec3f( 0.06, 0.035, 0.02 ); }
		if ( d.z < -0.985 ) { c = vec3f( 0.005 ); }
	}
	if ( part == ${ P.helmet } || part == ${ P.flapL } || part == ${ P.flapR } || part == ${ P.ccap } ) {
		// the batting helmet: a glossy shell, scuffed; now and then a smear of pine tar on the crown
		c = capC * 1.05; rough = 0.12;
		let n = mx_noise_float3( L * vec3f( 30.0, 90.0, 30.0 ) + seed * 7.0 );
		if ( n > 0.62 ) { c = mix( c, c * 0.7 + vec3f( 0.03 ), 0.3 ); rough = 0.3; }
		if ( fract( seed * 11.0 ) > 0.6 && L.y > ${ f( F.top[ 1 ] - 0.03 ) } && Nb.z > -0.2 && mx_noise_float3( L * 40.0 + seed * 9.0 ) > 0.25 ) { c = vec3f( 0.08, 0.035, 0.012 ); rough = 0.3; }
		// rain beads
		if ( soak > 0.1 && hash31( floor( L * 600.0 ) ) > 0.9 ) { rough = 0.03; c = c * 0.8; }
		clothy = false;
	}
	if ( part == ${ P.gear } ) {
		// the catcher's gear: the team colour's plastic shells over black padding
		c = mix( vec3f( 0.015 ), capC, 0.85 ); rough = 0.3;
		if ( abs( Nb.y ) > 0.7 || fract( L.y * 16.0 ) < 0.08 ) { c = vec3f( 0.015 ); rough = 0.7; }
	}
	if ( part == ${ P.mask } ) { c = vec3f( 0.02 ); rough = 0.3; }
	if ( part == ${ P.maskPad } ) { c = select( vec3f( 0.07, 0.035, 0.018 ), vec3f( 0.012 ), ump ); rough = 0.6; }
	if ( part == ${ P.bag } ) { c = vec3f( 0.012 ); rough = 0.6; }
	if ( part == ${ P.hood } ) { c = cloth * 1.1; rough = 0.25; }
	if ( part == ${ P.glasses } ) { c = vec3f( 0.01 ); rough = 0.2; }
	if ( part == ${ P.rake } ) { c = select( vec3f( 0.5, 0.5, 0.52 ), vec3f( 0.04 ), L.y > 1.3 ); rough = 0.4; }
	if ( part == ${ P.sleeve } ) { c = trim; rough = 0.7; }
	if ( part == ${ P.socks } && ump ) { c = vec3f( 0.012 ); }
	if ( part == ${ P.socks } && crew ) { c = pantsC; }
	if ( part == ${ P.socks } && ! ump && ! crew ) {
		c = trim;
		// the stirrups: the white sanitary sock shows through the cut-outs at the sides of the ankle
		let lo = ${ f( DIM.thigh + DIM.shin ) } - leg;
		if ( lo < 0.13 && lo > 0.02 && abs( Nb.x ) > 0.55 ) { c = vec3f( 0.8, 0.79, 0.76 ); }
	}
	if ( part == ${ P.cap } ) { c = capC * 1.05; rough = 0.65; clothy = true; }
	if ( part == ${ P.belt } ) { c = beltC; rough = 0.4; }
	if ( part == ${ P.shoes } ) {
		c = vec3f( 0.016 ); rough = 0.3;
		let fy = L.y;
		// the sole, and a stripe along the outside: red for the Phillies, white for the Rays; the crew
		// in work boots, the Phanatic in big white sneakers
		if ( fy < 0.014 ) { c = vec3f( 0.03 ); rough = 0.6; }
		else if ( abs( Nb.x ) > 0.6 && abs( fy - 0.035 ) < 0.008 ) { c = select( vec3f( 0.8 ), vec3f( 0.5, 0.02, 0.03 ), home ); }
		if ( crew ) { c = vec3f( 0.08, 0.05, 0.03 ); rough = 0.7; }
		if ( phan ) { c = select( vec3f( 0.82, 0.8, 0.76 ), vec3f( 0.42, 0.02, 0.03 ), abs( fy - 0.05 ) < 0.012 ); rough = 0.6; }
		// mud: the clay caked on the soles and the toes, darker and wetter in the rain
		let mud = smoothstep( 0.06, 0.0, fy ) * ( 0.55 + 0.45 * mx_noise_float3( L * 60.0 ) ) + smoothstep( -0.12, -0.2, L.z - ${ f( J.ankleR[ 2 ] ) } ) * 0.3;
		let mudK = clamp( mud * ( 0.5 + 0.8 * soak ), 0.0, 1.0 ) * select( 1.0, 0.3, phan );
		c = mix( c, mix( vec3f( 0.33, 0.17, 0.08 ), vec3f( 0.14, 0.07, 0.035 ), soak ), mudK );
	}
	if ( part == ${ P.glove } || part == ${ P.mittC } || part == ${ P.mitt1B } ) {
		// the leather: tan, brown or black by the player; the lacing darker
		let g = fract( seed * 5.3 );
		c = select( select( vec3f( 0.015 ), vec3f( 0.12, 0.05, 0.02 ), g < 0.7 ), vec3f( 0.3, 0.14, 0.05 ), g < 0.4 ); rough = 0.45;
		if ( fract( ( L.y + L.x * 0.3 ) * 90.0 ) < 0.12 && abs( in.vs.vField.x + 2.0 ) < 0.5 ) { c = c * 0.35; }
		if ( soak > 0.1 ) { c = c * 0.75; rough = 0.3; }
	}
	if ( part == ${ P.bat } ) {
		// the bat: natural ash, a black one, a two-tone, a dark cherry; pine tar up the handle
		let b = fract( seed * 7.7 );
		c = vec3f( 0.5, 0.32, 0.16 );
		if ( b < 0.3 ) { c = vec3f( 0.025, 0.02, 0.018 ); }
		else if ( b < 0.5 ) { c = select( vec3f( 0.5, 0.32, 0.16 ), vec3f( 0.025 ), L.y > 0.5 ); }
		else if ( b < 0.65 ) { c = vec3f( 0.2, 0.06, 0.03 ); }
		rough = 0.35;
		if ( L.y > 0.12 && L.y < 0.45 ) { c = mix( c, vec3f( 0.09, 0.04, 0.012 ), 0.7 * smoothstep( 0.3, 0.7, mx_noise_float3( L * 35.0 + seed ) + 0.3 ) ); rough = 0.5; }
	}
	if ( part == ${ P.hair } ) { c = hairC; }
	if ( phan && part == ${ P.hair } ) {
		// shaggy green fur: long strands, clumped
		let strand = hash31( floor( vec3f( L.x * 160.0, L.y * 45.0, L.z * 160.0 ) ) );
		c = fur * ( 0.65 + 0.6 * strand ) * ( 0.85 + 0.3 * mx_noise_float3( L * 20.0 ) ); rough = 0.95;
		clothy = true;
	}
	if ( part == ${ P.phHead } || part == ${ P.snout } ) {
		let strand = hash31( floor( L * vec3f( 150.0, 60.0, 150.0 ) ) );
		c = fur * ( 0.65 + 0.6 * strand ); rough = 0.95;
		// his red cap riding on the back of his head, the blue brows over the eyes, the dark mouth at the
		// end of the snout
		if ( part == ${ P.phHead } && Nb.y > 0.62 && Nb.z > -0.25 ) { c = vec3f( 0.42, 0.02, 0.03 ); rough = 0.6; }
		if ( part == ${ P.phHead } && Nb.y > 0.3 && Nb.y < 0.52 && abs( Nb.x ) > 0.12 && abs( Nb.x ) < 0.62 && Nb.z < -0.55 ) { c = vec3f( 0.02, 0.1, 0.5 ); }
		if ( part == ${ P.snout } && dot( Nb, vec3f( 0.0, -0.342, -0.94 ) ) > 0.9 ) { c = vec3f( 0.08, 0.005, 0.01 ); rough = 0.4; }
		clothy = true;
	}
	if ( part == ${ P.phEye } ) {
		// white eyeballs, black pupils, the upper lids blue
		c = vec3f( 0.8, 0.79, 0.76 ); rough = 0.2;
		if ( Nb.y > 0.25 ) { c = vec3f( 0.02, 0.1, 0.5 ); rough = 0.6; }
		else if ( Nb.z < -0.9 && abs( Nb.x - sign( L.x ) * 0.1 ) < 0.25 && Nb.y > -0.2 ) { c = vec3f( 0.005 ); }
	}
	if ( pocketGloves ) { c = pal[ palm ]; rough = 0.55; }
	// the lettering and logos over the cloth
	if ( inCell ) { c = mix( c, ink.rgb, ink.a ); }

	// the dirt: the infield's clay ground into the cloth where he's gone down on it, a little dust on
	// every pant leg's bottom; darker mud once it's wet (the pattern lives on the body, so it moves with
	// him)
	if ( clothy && ! phan && ! ump ) {
		let n = mx_noise_float3( L * 9.0 + seed * 13.0 ) * 0.5 + 0.5;
		let fine = mx_noise_float3( L * 45.0 ) * 0.5 + 0.5;
		var dk = 0.0;
		let frontK = smoothstep( 0.1, -0.3, Nb.z );
		let backK = smoothstep( -0.1, 0.3, Nb.z );
		if ( leg > -0.5 ) {
			// the pant legs' bottoms and the socks, the knees
			dk += smoothstep( 0.55, 0.85, leg ) * 0.35;
			if ( ( dirtBits & ${ DIRT.knees }u ) != 0u ) { dk += ( 1.0 - smoothstep( 0.05, 0.12, abs( leg - 0.4 ) ) ) * frontK * 1.2; }
			if ( ( dirtBits & ${ DIRT.seat }u ) != 0u ) { dk += ( 1.0 - smoothstep( 0.2, 0.45, leg ) ) * backK * 0.9 + smoothstep( 0.1, -0.5, Nb.x * sign( L.x ) ) * 0.4; }
			if ( ( dirtBits & ${ DIRT.dragR }u ) != 0u && L.x > 0.0 ) { dk += ( 1.0 - smoothstep( 0.04, 0.14, abs( leg - 0.42 ) ) ) * 1.4; }
			if ( ( dirtBits & ${ DIRT.dragL }u ) != 0u && L.x < 0.0 ) { dk += ( 1.0 - smoothstep( 0.04, 0.14, abs( leg - 0.42 ) ) ) * 1.4; }
		} else if ( arm < -0.5 ) {
			if ( ( dirtBits & ${ DIRT.seat }u ) != 0u && L.y < 1.05 ) { dk += backK * 0.8; }
			if ( ( dirtBits & ${ DIRT.front }u ) != 0u && L.y < 1.4 ) { dk += frontK * smoothstep( 1.45, 1.1, L.y ) * 1.1; }
		} else if ( ( dirtBits & ${ DIRT.front }u ) != 0u ) {
			dk += smoothstep( 0.2, 0.5, arm ) * 0.6;
		}
		let amt = clamp( dk * dirt * ( 0.35 + 0.9 * n ) * ( 0.6 + 0.5 * fine ), 0.0, 0.85 );
		let clay = mix( vec3f( 0.36, 0.2, 0.1 ), vec3f( 0.16, 0.08, 0.04 ), soak );
		c = mix( c, clay * ( 0.8 + 0.3 * fine ), amt );
		rough = mix( rough, 0.95, amt );
		// the grass stains, a green-brown smear on the knees of the ones who dove
		if ( ( dirtBits & ${ DIRT.front }u ) != 0u && leg > 0.3 && leg < 0.5 ) { c = mix( c, vec3f( 0.1, 0.13, 0.03 ), 0.25 * dirt * n ); }
	}
	// soaked through: wet cloth darkens and hangs heavy; a wet white jersey goes a little translucent over
	// the red undershirt at the shoulders and arms
	if ( clothy && ! crew ) {
		c = c * mix( 1.0, 0.62, soak * smoothstep( 0.02, 0.3, max( max( c.r, c.g ), c.b ) ) + soak * 0.12 );
		if ( home && part == ${ P.jersey } && ! jacket ) { c = mix( c, c * vec3f( 1.0, 0.8, 0.8 ), soak * 0.35 * smoothstep( 0.9, 1.4, in.vs.vLocal.y ) ); }
		rough = mix( rough, 0.6, soak * 0.5 );
	}
	if ( crew && ( part == ${ P.jersey } || part == ${ P.hood } ) ) { rough = mix( rough, 0.12, soak ); }
	s.albedo = c;
	s.roughness = rough;
`,
	} );
	mat.underwaterLighting = 'none';
	// the players get their own rain (the cloth soaks, it doesn't turn glossy)
	mat.setDefine( 'DRY', 1 );
	return mat;

}

// ---------------------------------------------------------------- the lettering

function cellXY( i ) {

	return [ ( i % COLS ) * CELL, Math.floor( i / COLS ) * CELL ];

}

// a slot's back: the Phillies' red numbers trimmed in blue; the Rays' navy name and numbers trimmed in
// light blue; the Phanatic's star; the umpires' and the crew's jackets blank
function drawBack( ctx, i, kind, number, name, back ) {

	const [ x, y ] = cellXY( i );
	ctx.clearRect( x, y, CELL, CELL );
	if ( kind === KIND.ump || kind === KIND.crew ) return;
	const home = kind !== KIND.away;
	const fill = home ? '#d01c2c' : '#0b2a5b', edge = home ? '#0b2a5b' : '#8fbce6';
	ctx.save();
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.lineJoin = 'round';
	if ( kind === KIND.phanatic ) {

		// PHANATIC over a star
		ctx.font = '800 16px "Helvetica Neue", Helvetica, Arial, sans-serif';
		ctx.fillStyle = fill;
		ctx.fillText( 'PHANATIC', x + CELL / 2, y + 16, CELL - 12 );
		ctx.beginPath();
		for ( let k = 0; k < 10; k ++ ) {

			const a = - Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 17 : 40;
			ctx.lineTo( x + CELL / 2 + Math.cos( a ) * r, y + 74 + Math.sin( a ) * r );

		}

		ctx.closePath();
		ctx.lineWidth = 6;
		ctx.strokeStyle = edge;
		ctx.stroke();
		ctx.fill();
		ctx.restore();
		return;

	}

	if ( ( ! home || back === 'name' ) && name ) {

		ctx.font = '800 17px "Helvetica Neue", Helvetica, Arial, sans-serif';
		ctx.fillStyle = fill;
		ctx.fillText( name.toUpperCase().split( '' ).join( String.fromCharCode( 8202 ) ), x + CELL / 2, y + 16, CELL - 12 );

	}

	if ( number ) {

		ctx.font = `900 ${ number.length > 1 ? 74 : 80 }px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
		ctx.lineWidth = 7;
		ctx.strokeStyle = edge;
		ctx.strokeText( number, x + CELL / 2, y + 74, CELL - 14 );
		ctx.fillStyle = fill;
		ctx.fillText( number, x + CELL / 2, y + 74, CELL - 14 );

	}

	ctx.restore();

}

// the chest: "Phillies" in red script with blue stars over the i's, or RAYS in navy with its gold burst;
// on the dugout jackets the same in white
function drawChest( ctx, i, home, jacket = false ) {

	const [ x, y ] = cellXY( i );
	ctx.save();
	ctx.clearRect( x, y, CELL, CELL );
	ctx.translate( x + CELL / 2, y + CELL / 2 );
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.lineJoin = 'round';
	if ( home ) {

		ctx.rotate( - 0.12 );
		ctx.font = 'italic 700 40px Georgia, "Times New Roman", serif';
		ctx.lineWidth = 5;
		ctx.strokeStyle = '#0b2a5b';
		ctx.strokeText( 'Phillies', 0, 6, CELL - 8 );
		ctx.fillStyle = jacket ? '#f4f2ec' : '#d01c2c';
		ctx.fillText( 'Phillies', 0, 6, CELL - 8 );
		for ( const sx of [ 4, 22 ] ) {

			ctx.fillStyle = jacket ? '#f4f2ec' : '#0b2a5b';
			ctx.beginPath();
			for ( let k = 0; k < 10; k ++ ) {

				const a = - Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 2.2 : 5.2;
				ctx.lineTo( sx + Math.cos( a ) * r, - 22 + Math.sin( a ) * r );

			}

			ctx.fill();

		}

	} else {

		// the burst off the R's shoulder
		ctx.fillStyle = '#f5d130';
		ctx.beginPath();
		for ( let k = 0; k < 16; k ++ ) {

			const a = k * Math.PI / 8, r = k % 2 ? 4 : 10;
			ctx.lineTo( - 36 + Math.cos( a ) * r, - 22 + Math.sin( a ) * r );

		}

		ctx.fill();
		ctx.font = '900 44px "Helvetica Neue", Arial, sans-serif';
		ctx.lineWidth = 6;
		ctx.strokeStyle = '#8fbce6';
		ctx.strokeText( 'RAYS', 0, 4, CELL - 10 );
		ctx.fillStyle = jacket ? '#f4f2ec' : '#0b2a5b';
		ctx.fillText( 'RAYS', 0, 4, CELL - 10 );

	}

	ctx.restore();

}

// the caps' fronts: the white script P on the Phillies' red; TB in white outlined in Columbia blue on the
// Rays' navy
function drawCapLogo( ctx, i, home ) {

	const [ x, y ] = cellXY( i );
	ctx.save();
	ctx.clearRect( x, y, CELL, CELL );
	ctx.translate( x + CELL / 2, y + CELL / 2 );
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.lineJoin = 'round';
	if ( home ) {

		// the script P: a slanted stem with a curl at its foot, the bowl, the swash across the top
		ctx.strokeStyle = '#f4f2ec';
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.lineWidth = 13;
		ctx.beginPath();
		ctx.moveTo( 6, - 40 );
		ctx.bezierCurveTo( 2, - 12, - 6, 14, - 14, 34 );
		ctx.quadraticCurveTo( - 20, 46, - 32, 38 );
		ctx.stroke();
		ctx.lineWidth = 11;
		ctx.beginPath();
		ctx.moveTo( 4, - 36 );
		ctx.bezierCurveTo( 30, - 52, 52, - 30, 34, - 10 );
		ctx.bezierCurveTo( 24, 0, 6, 2, - 4, - 4 );
		ctx.stroke();
		ctx.lineWidth = 8;
		ctx.beginPath();
		ctx.moveTo( - 30, - 22 );
		ctx.bezierCurveTo( - 26, - 40, - 8, - 44, 6, - 40 );
		ctx.stroke();

	} else {

		ctx.font = '900 70px Georgia, serif';
		ctx.lineWidth = 7;
		ctx.strokeStyle = '#8fbce6';
		ctx.strokeText( 'TB', 0, 6 );
		ctx.fillStyle = '#f4f2ec';
		ctx.fillText( 'TB', 0, 6 );

	}

	ctx.restore();

}

// the 2008 World Series patch worn on the right sleeve: a navy disc, WORLD SERIES and 2008
function drawPatch( ctx, i ) {

	const [ x, y ] = cellXY( i );
	ctx.save();
	ctx.clearRect( x, y, CELL, CELL );
	ctx.translate( x + CELL / 2, y + CELL / 2 );
	ctx.fillStyle = '#f4f2ec';
	ctx.beginPath(); ctx.arc( 0, 0, 60, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#10275f';
	ctx.beginPath(); ctx.arc( 0, 0, 54, 0, Math.PI * 2 ); ctx.fill();
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = '#f4f2ec';
	ctx.font = '700 20px Georgia, serif';
	ctx.fillText( 'WORLD', 0, - 14 );
	ctx.fillText( 'SERIES', 0, 8 );
	ctx.fillStyle = '#e3b23c';
	ctx.font = '800 18px Georgia, serif';
	ctx.fillText( '2008', 0, 30 );
	ctx.fillStyle = '#c8102e';
	ctx.fillRect( - 16, - 44, 32, 14 );
	ctx.restore();

}

// the MLB batterman, embroidered on the back of every cap and on the back of the helmets: a white
// batter in silhouette between the red and the blue
function drawMLB( ctx, i ) {

	const [ x, y ] = cellXY( i );
	ctx.save();
	ctx.clearRect( x, y, CELL, CELL );
	ctx.translate( x + CELL / 2, y + CELL / 2 );
	const w = 110, h = 60, r = 12;
	ctx.beginPath();
	ctx.roundRect( - w / 2, - h / 2, w, h, r );
	ctx.fillStyle = '#f4f2ec';
	ctx.fill();
	ctx.save();
	ctx.clip();
	ctx.fillStyle = '#0b2a6b';
	ctx.fillRect( - w / 2 + 4, - h / 2 + 4, w * 0.62, h - 8 );
	ctx.fillStyle = '#c8102e';
	ctx.fillRect( - w / 2 + 8 + w * 0.62, - h / 2 + 4, w * 0.38 - 12, h - 8 );
	ctx.restore();
	// the batter
	ctx.fillStyle = '#f4f2ec';
	ctx.beginPath(); ctx.arc( 12, - 12, 6, 0, Math.PI * 2 ); ctx.fill();
	ctx.beginPath();
	ctx.moveTo( 8, - 5 ); ctx.lineTo( 18, - 3 ); ctx.lineTo( 20, 12 ); ctx.lineTo( 26, 26 ); ctx.lineTo( 18, 26 ); ctx.lineTo( 12, 14 ); ctx.lineTo( 4, 26 ); ctx.lineTo( - 4, 26 ); ctx.lineTo( 6, 8 );
	ctx.fill();
	ctx.lineWidth = 3;
	ctx.strokeStyle = '#f4f2ec';
	ctx.beginPath(); ctx.moveTo( 10, - 2 ); ctx.lineTo( - 14, - 20 ); ctx.stroke();
	ctx.restore();

}
