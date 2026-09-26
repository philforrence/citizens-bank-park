import { InstancedMesh, Matrix4, Vector3, Quaternion, PlaneGeometry, Color } from '../../engine/index.js';
import { StorageBuffer } from '../../engine/gpu/Texture.js';
import { standard } from '../../materials/Materials.js';
import { buildPlayerGeometry, solvePose, skinMatrices, neutralPose, NB, PART, UNIFORM, FACE, DIM, JOINTS as BODY_JOINTS } from './Rig.js';
import { canvasTexture } from '../geo.js';
import { generateMipmaps } from '../../engine/gpu/Mipmaps.js';

// All the players on the field in one instanced draw: each instance is a player slot, its 17 skinning
// matrices (and last frame's, for the motion vectors) in a storage buffer, the vertex hook skins every
// vertex by up to four of them. The uniform comes from the team and the part of the body (2008: the Phillies'
// home whites with red pinstripes, the Rays' road greys). Each slot's back (the number, and for the Rays
// the name over it: the Phillies' home whites have no names) is drawn into a cell of a shared atlas;
// the chests carry the "Phillies" script and RAYS.
//
//   const p = players.add( { team: 'home', number: '54', gloveHand: 'L', skin: 2 } );
//   p.x, p.z (field frame), p.yaw (0 = facing -z, toward center field), p.pose (Rig.neutralPose())
//   players.update() before rendering; players.remove( p ).

const MAX = 56;
const Z16 = new Float32Array( 16 );
const ATLAS = 1024, CELL = 128, COLS = ATLAS / CELL; // cells 0..55 the slots' backs, 62 / 63 the chests

export class Players {

	constructor( { parent } ) {

		this.slots = [];
		this.data = new Float32Array( MAX * NB * 16 * 2 ); // this frame, then the previous one
		this.info = new Float32Array( MAX * 4 );
		this.bones = new StorageBuffer( { label: 'playerBones', count: MAX * NB * 2, type: 'mat4x4f' } );
		this.infoBuffer = new StorageBuffer( { label: 'playerInfo', count: MAX, type: 'vec4f' } );
		const geo = buildPlayerGeometry();
		this.atlas = canvasTexture( ATLAS, ATLAS, ( ctx ) => {

			drawChest( ctx, 62, true );
			drawChest( ctx, 63, false );
			drawCapLogo( ctx, 60, true );
			drawCapLogo( ctx, 61, false );
			drawPatch( ctx, 59 );

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

	add( { team = 'home', number = '', gloveHand = 'L', skin = 0, name = '' } = {} ) {

		let i = this.slots.findIndex( ( s ) => ! s );
		if ( i < 0 ) i = this.slots.length;
		if ( i >= MAX ) throw new Error( 'too many players' );
		const p = {
			slot: i, team, number, gloveHand, skin, name,
			x: 0, z: 0, y: 0, yaw: 0, tilt: null, // tilt: an extra root rotation (lying in the dogpile)
			pose: neutralPose(), visible: true, fresh: true,
		};
		this.slots[ i ] = p;
		drawBack( this.atlasCtx, i, team === 'home', String( number || '' ), name );
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
		const q = new Quaternion(), up = new Vector3( 0, 1, 0 );
		for ( let i = 0; i < MAX; i ++ ) {

			const p = this.slots[ i ];
			const off = i * NB * 16;
			if ( ! p || ! p.visible ) {

				for ( let b = 0; b < NB; b ++ ) D.set( Z16, off + b * 16 );
				continue;

			}

			q.setFromAxisAngle( up, p.yaw );
			if ( p.tilt ) q.multiply( p.tilt );
			this._root.compose( new Vector3( p.x, p.y, p.z ), q, new Vector3( 1, 1, 1 ) );
			solvePose( this._root, p.pose, D, off, p.gloveHand );
			skinMatrices( D, off );
			// a player who just appeared has no motion from where his slot was before
			if ( p.fresh ) {

				D.copyWithin( half + off, off, off + NB * 16 );
				p.fresh = false;

			}

			this.info.set( [ p.team === 'home' ? 1 : p.team === 'ump' ? 2 : 0, p.skin, p.role || 0, p.seed || 0 ], i * 4 );

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
			if ( ! p || ! p.visible || p.tilt ) {

				this.blobs.setMatrixAt( i, bm.makeScale( 0, 0, 0 ) );
				continue;

			}

			const po = p.pose, lift = Math.max( 0, Math.min( po.footL[ 1 ], po.footR[ 1 ] ) - 0.08 );
			const k = Math.max( 0.2, 1 - lift * 2 );
			const spread = Math.hypot( po.footL[ 0 ] - po.footR[ 0 ], po.footL[ 2 ] - po.footR[ 2 ] );
			bq.setFromAxisAngle( bs.set( 0, 1, 0 ), p.yaw + Math.atan2( po.footR[ 2 ] - po.footL[ 2 ], po.footR[ 0 ] - po.footL[ 0 ] ) * - 1 );
			bp.set( ( po.footL[ 0 ] + po.footR[ 0 ] ) / 2, 0, ( po.footL[ 2 ] + po.footR[ 2 ] ) / 2 ).applyQuaternion( new Quaternion().setFromAxisAngle( bs.set( 0, 1, 0 ), p.yaw ) );
			bm.compose( new Vector3( p.x + bp.x, ( p.y || 0 ) + 0.012, p.z + bp.z ), bq, new Vector3( ( 0.6 + spread ) * k, 1, 0.55 * k ) );
			this.blobs.setMatrixAt( i, bm );

		}

		this.blobs.count = Math.max( 1, used );
		this.blobs.instanceMatrix.needsUpdate = true;
		if ( this._atlasDirty ) {

			const img = this.atlasCtx.getImageData( 0, 0, ATLAS, ATLAS );
			this.atlas.upload( new Uint8Array( img.data.buffer ) );
			generateMipmaps( this.atlas );
			this._atlasDirty = false;

		}

	}

}

function playerMaterial( bones, info, atlas ) {

	const P = PART, U = UNIFORM, F = FACE, J = BODY_JOINTS;
	const f = ( x ) => x.toFixed( 4 );
	const v3 = ( a ) => `vec3f( ${ f( a[ 0 ] ) }, ${ f( a[ 1 ] ) }, ${ f( a[ 2 ] ) } )`;
	const mat = standard( {
		name: 'players', roughness: 0.75,
		storage: { plBones: bones, plInfo: info },
		textures: { plAtlas: atlas },
		attributes: { aBones: 'vec4f', aWeights: 'vec4f', aPart: 'f32', aField: 'vec2f' },
		varyings: { vPart: 'f32', vInfo: 'vec4f', vLocal: 'vec3f', vNrm: 'vec3f', vField: 'vec2f', vSlot: 'f32' },
		vertex: /* wgsl */`
	let slot = v.instance;
	// what he's wearing (info.z): 1 the batting helmet (else the cap), 2 the catcher's gear and mask;
	// the pieces he isn't wearing collapse to nothing
	let role = u32( plInfo[ slot ].z + 0.5 );
	let pt = i32( v.aPart + 0.5 );
	var keep = true;
	if ( pt == ${ P.helmet } && ( role & 1u ) == 0u ) { keep = false; }
	if ( pt == ${ P.cap } && ( role & 1u ) != 0u ) { keep = false; }
	if ( ( pt == ${ P.gear } || pt == ${ P.mask } ) && ( role & 2u ) == 0u ) { keep = false; }
	let lp = select( vec4f( 0.0, 0.0, 0.0, 1.0 ), vec4f( v.position, 1.0 ), keep );
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
	o.vInfo = plInfo[ slot ];
	o.vLocal = v.position;
	o.vNrm = v.normal;
	o.vField = v.aField;
	o.vSlot = f32( slot );
`,
		surface: /* wgsl */`
	var part = i32( in.vs.vPart + 0.5 );
	let home = in.vs.vInfo.x > 0.5 && in.vs.vInfo.x < 1.5;
	let ump = in.vs.vInfo.x > 1.5;
	let skinI = i32( in.vs.vInfo.y + 0.5 );
	let role = u32( in.vs.vInfo.z + 0.5 );
	let seed = in.vs.vInfo.w;
	var skinC = vec3f( 0.54, 0.32, 0.21 );
	if ( skinI == 1 ) { skinC = vec3f( 0.36, 0.19, 0.105 ); }
	if ( skinI == 2 ) { skinC = vec3f( 0.16, 0.08, 0.042 ); }
	if ( skinI == 3 ) { skinC = vec3f( 0.62, 0.4, 0.29 ); }
	let hairC = mix( vec3f( 0.018, 0.013, 0.009 ), vec3f( 0.09, 0.055, 0.03 ), fract( seed * 7.0 ) * step( 0.5, f32( skinI == 0 || skinI == 3 ) ) );
	// home: white, red pinstripes, red trim and caps; away: road grey, navy
	// the umpires: a black jacket (their jersey and sleeves), grey slacks, a black cap
	let cloth = select( select( vec3f( 0.28, 0.28, 0.29 ), vec3f( 0.83, 0.82, 0.79 ), home ), vec3f( 0.014, 0.015, 0.02 ), ump );
	let trim = select( select( vec3f( 0.012, 0.018, 0.06 ), vec3f( 0.42, 0.018, 0.025 ), home ), vec3f( 0.012, 0.012, 0.014 ), ump );
	let L = in.vs.vLocal;
	let Nb = normalize( in.vs.vNrm );
	let arm = in.vs.vField.x;
	let leg = in.vs.vField.y;

	// the body's own pieces: which part of the uniform (or skin) this is, from where it is
	var skinArea = 0; // 1 the head and neck, 2 a hand
	var around = 0.0; // distance round the limb or the trunk, for the pinstripes
	if ( part == ${ P.body } ) {
		if ( arm > -0.5 ) {
			if ( arm < ${ f( U.sleeve ) } ) { part = ${ P.jersey }; }
			else if ( arm < ${ f( U.wrist ) } ) { part = ${ P.sleeve }; }
			else { part = ${ P.skin }; skinArea = 2; }
			// round the upper arm
			let side = sign( L.x );
			let sh = vec3f( side * ${ f( J.shoulderR[ 0 ] ) }, ${ f( J.shoulderR[ 1 ] ) }, ${ f( J.shoulderR[ 2 ] ) } );
			let el = vec3f( side * ${ f( J.elbowR[ 0 ] ) }, ${ f( J.elbowR[ 1 ] ) }, ${ f( J.elbowR[ 2 ] ) } );
			let ax = normalize( el - sh );
			let e1 = normalize( cross( ax, vec3f( 0.0, 0.0, 1.0 ) ) );
			let d = L - sh;
			around = atan2( dot( d, cross( ax, e1 ) ), dot( d, e1 ) ) * 0.055;
		} else if ( leg > -0.5 ) {
			part = select( ${ P.socks }, ${ P.pants }, leg < ${ f( U.cuff ) } );
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
			else if ( ( L.y > cy - 0.011 && r < 0.11 ) || vee ) { part = ${ P.sleeve }; }
			else if ( L.y > ${ f( U.belt[ 1 ] ) } ) { part = ${ P.jersey }; }
			else if ( L.y > ${ f( U.belt[ 0 ] ) } ) { part = ${ P.belt }; }
			else { part = ${ P.pants }; }
			around = atan2( L.x, - L.z ) * 0.17;
		}
	}

	var c = cloth;
	var rough = 0.82;
	if ( ump && part == ${ P.pants } ) { c = vec3f( 0.22, 0.22, 0.23 ); }
	if ( part == ${ P.jersey } || part == ${ P.pants } ) {
		if ( home ) {
			// red pinstripes 2.5 cm apart, 1.5 mm wide; box-filtered, fading to their average when they're
			// finer than a pixel
			let u = around / 0.025;
			let fw = max( fwidth( u ), 1e-4 );
			let d = abs( fract( u ) - 0.5 );
			let cover = clamp( ( 0.03 - d ) / fw + 0.5, 0.0, 1.0 );
			let k = mix( cover, 0.06, smoothstep( 0.25, 0.8, fw ) );
			c = mix( cloth, vec3f( 0.43, 0.02, 0.04 ), k * 0.8 );
		}
	}

	// the lettering and logos from the atlas: the back (number, name) and the chest (the club's name)
	// on the trunk's back and front, the cap's (or helmet's) front, the World Series patch on the right
	// sleeve
	let slot = in.vs.vSlot;
	var cell = -1.0;
	var lu = 0.0;
	var lv = 0.0;
	if ( part == ${ P.jersey } && arm < -0.5 ) {
		if ( Nb.z > 0.05 ) { cell = slot; lu = 0.5 + L.x / 0.34; lv = 1.0 - ( L.y - 1.17 ) / 0.34; }
		if ( Nb.z < -0.05 ) { cell = select( 63.0, 62.0, home ); lu = 0.5 - L.x / 0.3; lv = 1.0 - ( L.y - 1.27 ) / 0.18; }
	}
	if ( part == ${ P.jersey } && arm > -0.5 && L.x > 0.0 && Nb.x > 0.3 ) {
		cell = 59.0; lu = 0.5 - ( L.z - ${ f( J.shoulderR[ 2 ] ) } ) / 0.085; lv = ( arm - 0.05 ) / 0.085;
	}
	if ( ( part == ${ P.cap } || part == ${ P.helmet } ) && Nb.z < -0.35 ) {
		cell = select( 61.0, 60.0, home ); lu = 0.5 - L.x / 0.09; lv = 0.5 - ( L.y - ${ f( F.top[ 1 ] - 0.062 ) } ) / 0.09;
	}
	if ( ump ) { cell = -1.0; }
	let cxy = vec2f( cell % ${ COLS }.0, floor( cell / ${ COLS }.0 ) );
	let inCell = cell >= 0.0 && lu > 0.02 && lu < 0.98 && lv > 0.02 && lv < 0.98;
	let auv = ( cxy + clamp( vec2f( lu, lv ), vec2f( 0.02 ), vec2f( 0.98 ) ) ) / ${ COLS }.0;
	let ink = textureSample( plAtlas, smpAnisoClamp, auv );

	if ( part == ${ P.skin } ) {
		c = skinC; rough = 0.6;
		// light carried under the skin: a warm wrap past the terminator, less of a grey sheen
		s.translucency = skinC * vec3f( 0.16, 0.07, 0.04 );
		s.specularIntensity = 0.55;
		// and the light bounced up off the field into the shade of the cap
		s.emissive = skinC * frame.sunColor * vec3f( 0.035, 0.03, 0.026 );
		// batting gloves on the batter and the runners
		if ( skinArea == 2 && ( role & 1u ) != 0u ) {
			let g = fract( seed * 13.0 );
			c = select( select( vec3f( 0.02 ), trim, g < 0.66 ), vec3f( 0.8, 0.79, 0.76 ), g < 0.33 );
			rough = 0.6;
			s.translucency = vec3f( 0.0 );
			s.specularIntensity = 1.0;
		}
		if ( skinArea == 1 ) {
			let ax = abs( L.x );
			let eye = vec3f( ${ f( F.eyeR[ 0 ] ) }, ${ f( F.eyeR[ 1 ] ) }, ${ f( F.eyeR[ 2 ] ) } );
			let face = L.z < eye.z + 0.035;
			// the hair: the back and the sides of the head above the neck, behind the temples (the cap
			// covers the top); the ears stay skin
			let ear = ax > 0.066 && L.y < eye.y + 0.012 && L.y > eye.y - 0.058 && L.z > eye.z + 0.06 && L.z < eye.z + 0.13;
			let hairline = ( L.y > eye.y + 0.028 && L.z > eye.z + 0.045 ) || ( L.y > eye.y - 0.05 && L.z > eye.z + 0.105 ) || L.y > eye.y + 0.06;
			if ( hairline && ! ear ) {
				let edge = smoothstep( eye.y - 0.06, eye.y - 0.04, L.y );
				c = mix( skinC * 0.6, hairC, 0.5 + 0.5 * edge ); rough = 0.7;
			}
			if ( face ) {
				// the brows
				let by = eye.y + 0.021 + 0.004 * ( 1.0 - smoothstep( 0.012, 0.05, ax ) ) - 0.004 * smoothstep( 0.03, 0.055, ax );
				if ( abs( L.y - by ) < 0.0045 && ax > 0.009 && ax < 0.055 ) { c = mix( c, hairC, 0.8 ); }
				// the lips
				let m = vec3f( 0.0, ${ f( F.mouth[ 1 ] ) }, ${ f( F.mouth[ 2 ] ) } );
				let lq = length( vec2f( L.x / 0.025, ( L.y - m.y ) / 0.008 ) );
				if ( lq < 1.0 && L.z < m.z + 0.02 ) { c = mix( c, skinC * vec3f( 0.8, 0.52, 0.5 ), smoothstep( 1.0, 0.6, lq ) ); rough = 0.4; }
				// stubble, or now and then a beard (by the player): the jaw, the chin and the upper lip
				let beard = fract( seed * 3.7 );
				let jaw = L.y < m.y + 0.02 && L.y > ${ f( F.jaw[ 1 ] ) } - 0.012 && lq > 0.95;
				if ( jaw ) {
					let k = smoothstep( ${ f( F.jaw[ 1 ] ) } - 0.012, ${ f( F.jaw[ 1 ] ) } + 0.004, L.y );
					if ( beard > 0.85 ) { c = mix( c, hairC, 0.85 * k ); }
					else { c = mix( c, c * vec3f( 0.7, 0.68, 0.7 ), beard * 0.45 * k ); }
				}
				// the eye sockets a shade darker
				let es = length( vec2f( ax - abs( eye.x ), ( L.y - eye.y ) * 1.4 ) );
				c = c * mix( 0.78, 1.0, smoothstep( 0.012, 0.024, es ) );
			}
		}
	}
	if ( part == ${ P.eye } ) {
		// the eyeball: white, a dark iris and pupil looking ahead
		let side = sign( L.x );
		let ec = vec3f( side * ${ f( F.eyeR[ 0 ] ) }, ${ f( F.eyeR[ 1 ] ) }, ${ f( F.eyeR[ 2 ] ) } );
		let d = normalize( L - ec );
		c = vec3f( 0.62, 0.6, 0.56 ); rough = 0.08;
		if ( d.z < -0.93 ) { c = vec3f( 0.06, 0.035, 0.02 ); }
		if ( d.z < -0.985 ) { c = vec3f( 0.005 ); }
	}
	if ( part == ${ P.helmet } ) { c = trim * 1.05; rough = 0.12; }
	if ( part == ${ P.gear } ) { c = mix( vec3f( 0.02 ), trim, 0.6 ); rough = 0.4; }
	if ( part == ${ P.mask } ) {
		// the cage: dark bars over the face, see-through between
		let bx = step( 0.8, fract( ( L.x + 0.1 ) / 0.028 ) ) + step( 0.78, fract( ( L.y - 0.05 ) / 0.035 ) );
		c = select( skinC * 0.35, vec3f( 0.02 ), bx > 0.5 ); rough = 0.35;
	}
	if ( part == ${ P.sleeve } ) { c = trim; rough = 0.7; }
	if ( part == ${ P.socks } && ump ) { c = vec3f( 0.22, 0.22, 0.23 ); }
	if ( part == ${ P.socks } && ! ump ) {
		c = trim;
		// the stirrups: the white sanitary sock shows through the cut-outs at the sides of the ankle
		let lo = ${ f( DIM.thigh + DIM.shin ) } - leg;
		if ( lo < 0.13 && lo > 0.02 && abs( Nb.x ) > 0.55 ) { c = vec3f( 0.8, 0.79, 0.76 ); }
	}
	if ( part == ${ P.cap } ) { c = trim * 1.05; rough = 0.65; }
	if ( part == ${ P.belt } ) { c = select( trim, vec3f( 0.02 ), home ); rough = 0.4; }
	if ( part == ${ P.shoes } ) {
		c = vec3f( 0.016 ); rough = 0.3;
		let fy = L.y;
		// the sole, and a stripe along the outside: red for the Phillies, white for the Rays
		if ( fy < 0.014 ) { c = vec3f( 0.03 ); rough = 0.6; }
		else if ( abs( Nb.x ) > 0.6 && abs( fy - 0.035 ) < 0.008 ) { c = select( vec3f( 0.8 ), vec3f( 0.5, 0.02, 0.03 ), home ); }
	}
	if ( part == ${ P.glove } ) {
		// the leather: tan, brown or black by the player; the lacing darker
		let g = fract( seed * 5.3 );
		c = select( select( vec3f( 0.015 ), vec3f( 0.12, 0.05, 0.02 ), g < 0.7 ), vec3f( 0.3, 0.14, 0.05 ), g < 0.4 ); rough = 0.45;
		if ( fract( ( L.y + L.x * 0.3 ) * 90.0 ) < 0.12 && abs( in.vs.vField.x + 2.0 ) < 0.5 ) { c = c * 0.35; }
	}
	if ( part == ${ P.bat } ) { c = vec3f( 0.5, 0.32, 0.16 ); rough = 0.35; }
	if ( part == ${ P.hair } ) { c = hairC; }
	// the lettering and logos over the cloth
	if ( inCell ) { c = mix( c, ink.rgb, ink.a ); }
	s.albedo = c;
	s.roughness = rough;
`,
	} );
	mat.underwaterLighting = 'none';
	return mat;

}

// ---------------------------------------------------------------- the lettering

function cellXY( i ) {

	return [ ( i % COLS ) * CELL, Math.floor( i / COLS ) * CELL ];

}

// a slot's back: the Phillies' red numbers trimmed in blue; the Rays' navy name and numbers trimmed in
// light blue
function drawBack( ctx, i, home, number, name ) {

	const [ x, y ] = cellXY( i );
	ctx.clearRect( x, y, CELL, CELL );
	const fill = home ? '#d01c2c' : '#0b2a5b', edge = home ? '#0b2a5b' : '#8fbce6';
	ctx.save();
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.lineJoin = 'round';
	if ( ! home && name ) {

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

// the chest: "Phillies" in red script with blue stars over the i's, or RAYS in navy
function drawChest( ctx, i, home ) {

	const [ x, y ] = cellXY( i );
	ctx.save();
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
		ctx.fillStyle = '#d01c2c';
		ctx.fillText( 'Phillies', 0, 6, CELL - 8 );
		for ( const sx of [ 4, 22 ] ) {

			ctx.fillStyle = '#0b2a5b';
			ctx.beginPath();
			for ( let k = 0; k < 10; k ++ ) {

				const a = - Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 2.2 : 5.2;
				ctx.lineTo( sx + Math.cos( a ) * r, - 22 + Math.sin( a ) * r );

			}

			ctx.fill();

		}

	} else {

		ctx.font = '900 44px "Helvetica Neue", Arial, sans-serif';
		ctx.lineWidth = 6;
		ctx.strokeStyle = '#8fbce6';
		ctx.strokeText( 'RAYS', 0, 4, CELL - 10 );
		ctx.fillStyle = '#0b2a5b';
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
