import { InstancedMesh, Matrix4, Vector3, Quaternion } from '../../engine/index.js';
import { StorageBuffer } from '../../engine/gpu/Texture.js';
import { standard } from '../../materials/Materials.js';
import { buildPlayerGeometry, solvePose, neutralPose, NB, PART, BONES } from './Rig.js';
import { canvasTexture } from '../geo.js';
import { generateMipmaps } from '../../engine/gpu/Mipmaps.js';

// All the players on the field in one instanced draw: each instance is a player slot, its 17 bone
// matrices (and last frame's, for the motion vectors) in a storage buffer, the vertex hook places every
// vertex by its bone. The uniform comes from the team and the part of the body (2008: the Phillies'
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
		if ( this._atlasDirty ) {

			const img = this.atlasCtx.getImageData( 0, 0, ATLAS, ATLAS );
			this.atlas.upload( new Uint8Array( img.data.buffer ) );
			generateMipmaps( this.atlas );
			this._atlasDirty = false;

		}

	}

}

function playerMaterial( bones, info, atlas ) {

	const P = PART;
	const mat = standard( {
		name: 'players', roughness: 0.75,
		storage: { plBones: bones, plInfo: info },
		textures: { plAtlas: atlas },
		attributes: { aBone: 'f32', aPart: 'f32' },
		varyings: { vPart: 'f32', vInfo: 'vec4f', vLocal: 'vec3f', vBone: 'f32', vSlot: 'f32' },
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
	o.vBone = v.aBone;
	o.vSlot = f32( slot );
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
	let cloth = select( vec3f( 0.3, 0.3, 0.31 ), vec3f( 0.86, 0.85, 0.82 ), home );
	let trim = select( vec3f( 0.012, 0.018, 0.06 ), vec3f( 0.42, 0.018, 0.025 ), home );
	var c = cloth;
	var rough = 0.8;
	if ( part == ${ P.jersey } || part == ${ P.pants } ) {
		if ( home ) {
			// red pinstripes 2.5 cm apart, thin; averaged where they're finer than a pixel
			let u = ( in.vs.vLocal.x + in.vs.vLocal.z ) * 28.3;
			let fw = fwidth( u );
			let stripe = 1.0 - smoothstep( 0.035 - fw, 0.035 + fw, abs( fract( u ) - 0.5 ) );
			let k = mix( stripe * 0.85, 0.06, clamp( fw * 1.5, 0.0, 1.0 ) );
			c = mix( cloth, vec3f( 0.6, 0.015, 0.03 ), k );
		}
	}
	// the back (number, name) and the chest (the club's name) from the atlas, projected front to back
	// onto the torso: its own frame has +x to the player's right, -z forward, y up from the waist
	let L = in.vs.vLocal;
	let bone = i32( in.vs.vBone + 0.5 );
	let back = L.z > 0.0;
	let slot = in.vs.vSlot;
	// which cell of the atlas this fragment reads, and where in it: the back (number, name), the chest
	// (the club's name), the cap's front (P / TB), the World Series patch on the right sleeve
	var cell = select( select( 63.0, 62.0, home ), slot, back );
	var lu = select( 0.5 - L.x / 0.42, 0.5 + L.x / 0.36, back );
	var lv = select( 1.0 - ( L.y - 0.17 ) / 0.21, 1.0 - ( L.y - 0.07 ) / 0.36, back );
	var useInk = part == ${ P.jersey } && bone == ${ BONES.torso } && abs( L.z ) > 0.02;
	if ( part == ${ P.cap } && bone == ${ BONES.head } && L.z < - 0.03 && L.y > 0.19 ) {
		cell = select( 61.0, 60.0, home ); lu = 0.5 - L.x / 0.15; lv = 1.0 - ( L.y - 0.18 ) / 0.12; useInk = true;
	}
	if ( part == ${ P.jersey } && bone == ${ BONES.upperArmR } && L.x > 0.015 ) {
		cell = 59.0; lu = 0.5 - L.z / 0.085; lv = 0.5 - ( L.y + 0.11 ) / 0.085; useInk = true;
	}
	let cxy = vec2f( cell % ${ COLS }.0, floor( cell / ${ COLS }.0 ) );
	let inCell = lu > 0.02 && lu < 0.98 && lv > 0.02 && lv < 0.98;
	let auv = ( cxy + clamp( vec2f( lu, lv ), vec2f( 0.02 ), vec2f( 0.98 ) ) ) / ${ COLS }.0;
	let ink = textureSample( plAtlas, smpAnisoClamp, auv );
	if ( part == ${ P.skin } ) { c = skinC; rough = 0.55; }
	if ( part == ${ P.socks } || part == ${ P.sleeve } ) { c = trim; }
	if ( part == ${ P.cap } ) { c = trim * 1.05; rough = 0.6; }
	if ( part == ${ P.belt } ) { c = select( trim, vec3f( 0.02 ), home ); }
	if ( part == ${ P.shoes } ) { c = vec3f( 0.018 ); rough = 0.45; }
	if ( part == ${ P.glove } ) { c = vec3f( 0.2, 0.09, 0.035 ); rough = 0.5; }
	if ( part == ${ P.bat } ) { c = vec3f( 0.5, 0.32, 0.16 ); rough = 0.35; }
	// the lettering and logos over the cloth
	if ( useInk && inCell ) { c = mix( c, ink.rgb, ink.a ); }
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

// the caps' fronts: a white serif P on the Phillies' red; TB in white outlined in Columbia blue on the
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

		ctx.font = 'italic 700 104px Georgia, "Times New Roman", serif';
		ctx.fillStyle = '#f4f2ec';
		ctx.fillText( 'P', 0, 6 );

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
