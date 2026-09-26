import { InstancedMesh, Matrix4, Vector3, Quaternion } from '../../engine/index.js';
import { StorageBuffer } from '../../engine/gpu/Texture.js';
import { standard } from '../../materials/Materials.js';
import { buildPlayerGeometry, solvePose, neutralPose, NB, PART } from './Rig.js';

// All the players on the field in one instanced draw: each instance is a player slot, its 17 bone
// matrices (and last frame's, for the motion vectors) in a storage buffer, the vertex hook places every
// vertex by its bone. The uniform comes from the team and the part of the body (2008: the Phillies'
// home whites with red pinstripes, the Rays' road greys).
//
//   const p = players.add( { team: 'home', number: '54', gloveHand: 'L', skin: 2 } );
//   p.x, p.z (field frame), p.yaw (0 = facing -z, toward center field), p.pose (Rig.neutralPose())
//   players.update() before rendering; players.remove( p ).

const MAX = 56;
const Z16 = new Float32Array( 16 );

export class Players {

	constructor( { parent } ) {

		this.slots = [];
		this.data = new Float32Array( MAX * NB * 16 * 2 ); // this frame, then the previous one
		this.info = new Float32Array( MAX * 4 );
		this.bones = new StorageBuffer( { label: 'playerBones', count: MAX * NB * 2, type: 'mat4x4f' } );
		this.infoBuffer = new StorageBuffer( { label: 'playerInfo', count: MAX, type: 'vec4f' } );
		const geo = buildPlayerGeometry();
		this.material = playerMaterial( this.bones, this.infoBuffer );
		this.mesh = new InstancedMesh( geo, this.material, MAX );
		this.mesh.name = 'players';
		this.mesh.frustumCulled = false;
		this.mesh.castShadow = true;
		this.mesh.receiveShadow = true;
		parent.add( this.mesh );
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
			// a player who just appeared has no motion from where his slot was before
			if ( p.fresh ) {

				D.copyWithin( half + off, off, off + NB * 16 );
				p.fresh = false;

			}

			this.info.set( [ p.team === 'home' ? 1 : 0, p.skin, 0, 0 ], i * 4 );

		}

		if ( this._first ) {

			D.copyWithin( half, 0, half );
			this._first = false;

		}

		this.bones.write( D );
		this.infoBuffer.write( this.info );

	}

}

function playerMaterial( bones, info ) {

	const P = PART;
	const mat = standard( {
		name: 'players', roughness: 0.75,
		storage: { plBones: bones, plInfo: info },
		attributes: { aBone: 'f32', aPart: 'f32' },
		varyings: { vPart: 'f32', vInfo: 'vec4f', vLocal: 'vec3f' },
		vertex: /* wgsl */`
	let slot = v.instance;
	let b = u32( v.aBone + 0.5 );
	let M = plBones[ slot * ${ NB }u + b ];
	let Mp = plBones[ ( ${ MAX }u + slot ) * ${ NB }u + b ];
	let lp = vec4f( v.position, 1.0 );
	let lm = v.model * M;
	v.useWorld = true;
	v.worldPos = ( lm * lp ).xyz;
	v.worldNormal = normalize( ( lm * vec4f( v.normal, 0.0 ) ).xyz );
	v.prevWorldPos = ( v.prevModel * Mp * lp ).xyz;
	o.vPart = v.aPart;
	o.vInfo = plInfo[ slot ];
	o.vLocal = v.position;
`,
		surface: /* wgsl */`
	let part = i32( in.vs.vPart + 0.5 );
	let home = in.vs.vInfo.x > 0.5;
	let skinI = i32( in.vs.vInfo.y + 0.5 );
	var skinC = vec3f( 0.55, 0.37, 0.27 );
	if ( skinI == 1 ) { skinC = vec3f( 0.36, 0.21, 0.13 ); }
	if ( skinI == 2 ) { skinC = vec3f( 0.2, 0.11, 0.06 ); }
	if ( skinI == 3 ) { skinC = vec3f( 0.62, 0.45, 0.35 ); }
	// home: white, red pinstripes, red trim and caps; away: road grey, navy
	let cloth = select( vec3f( 0.3, 0.3, 0.31 ), vec3f( 0.8, 0.79, 0.77 ), home );
	let trim = select( vec3f( 0.012, 0.018, 0.06 ), vec3f( 0.42, 0.018, 0.025 ), home );
	var c = cloth;
	var rough = 0.8;
	if ( part == ${ P.jersey } || part == ${ P.pants } ) {
		if ( home ) {
			// pinstripes 4 cm apart, averaged where they're finer than a pixel
			let u = in.vs.vLocal.x * 25.0 + in.vs.vLocal.z * 25.0;
			let fw = fwidth( u );
			let stripe = 1.0 - smoothstep( 0.06 - fw, 0.06 + fw, abs( fract( u ) - 0.5 ) * 2.0 - 0.9 + 0.06 );
			let k = mix( stripe * 0.35, 0.06, clamp( fw * 1.5, 0.0, 1.0 ) );
			c = mix( cloth, vec3f( 0.5, 0.03, 0.05 ), k );
		}
	}
	if ( part == ${ P.skin } ) { c = skinC; rough = 0.55; }
	if ( part == ${ P.socks } || part == ${ P.sleeve } ) { c = trim; }
	if ( part == ${ P.cap } ) { c = trim * 1.05; rough = 0.6; }
	if ( part == ${ P.belt } ) { c = select( trim, vec3f( 0.02 ), home ); }
	if ( part == ${ P.shoes } ) { c = vec3f( 0.018 ); rough = 0.45; }
	if ( part == ${ P.glove } ) { c = vec3f( 0.2, 0.09, 0.035 ); rough = 0.5; }
	if ( part == ${ P.bat } ) { c = vec3f( 0.5, 0.32, 0.16 ); rough = 0.35; }
	s.albedo = c;
	s.roughness = rough;
`,
	} );
	mat.underwaterLighting = 'none';
	return mat;

}
