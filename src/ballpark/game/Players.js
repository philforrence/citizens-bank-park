import { InstancedMesh, InstancedBufferAttribute, BufferGeometry, Matrix4, Vector3, Quaternion, PlaneGeometry, Color } from '../../engine/index.js';
import { StorageBuffer } from '../../engine/gpu/Texture.js';
import { standard } from '../../materials/Materials.js';
import { commonModule } from '../../engine/render/wgsl/common.js';
import { buildPlayerGeometry, solvePose, skinMatrices, neutralPose, NB, BONES, PART, UNIFORM, FACE, DIM, JOINTS as BODY_JOINTS, PHAN, PHANATIC_PARTS } from './Rig.js';
import { look as lookFor, FACE_PACK } from './Looks.js';
import { HEAD, bakeFace, exprRecords } from './Faces.js'; // ---- FF3
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
const COSTUMES = 4; // the Phanatic's costume's draw: at most this many of him at once
const LOD_PX = 128; // ---- SP2: a player shorter than this on screen (px of the view's height) is drawn far
const MID_PX = 480; // ---- SP2: ... and shorter than this from the middle figure
const K = 5; // vec4s per slot (---- FY4: the fifth, the face's shape)
const Z16 = new Float32Array( 16 );
const CELL = 128, COLS = 8, ROWS = 16, ATLAS_W = CELL * COLS, ATLAS_H = CELL * ROWS;
// where the chest's cell goes on the jersey (m: its width, its height, its bottom in the bind pose): the
// script from armpit to armpit (FY2, CY-6: FOX's close-up of Burrell; Balfour's RAYS); drawChest() draws
// it squeezed by the cell's aspect so the letters come out true
const CHEST = [ 0.38, 0.22, 1.245 ];
const CHEST_ASPECT = CHEST[ 0 ] / CHEST[ 1 ];
// atlas cells: 0..MAX-1 the slots' backs, then the shared ones
const C = { chestHome: 127, chestAway: 126, capHome: 125, capAway: 124, patch: 123, mlb: 122, jacketHome: 121, jacketAway: 120, capChamp: 119, ray: 118 }; // (FR1: capChamp; FY3: ray)

// what he's wearing (p.role)
export const ROLE = {
	helmet: 1, gear: 2, mask: 4, ccap: 8, jacket: 16, bgloves: 32, mittC: 64, mitt1B: 128, flapL: 256, flapR: 512,
	rake: 1024, hood: 2048, bag: 4096, nocap: 8192, elbowL: 16384, elbowR: 32768, pocket: 65536,
};
// ---- A (Phanatic): the Phanatic's knee-length red vinyl rain slicker (the 27th: Getty 83477166, AP "even
// the Phillie Phanatic wore a rain slicker"); the ball girls' pinstriped shorts (they danced with him)
ROLE.slicker = 131072;
ROLE.shorts = 262144;
// ---- end A
// ---- R (rituals): what they had on minutes after the last out (Getty 83571364, 83571213; ronniebruce
// 2987488477): the grey WORLD SERIES CHAMPIONS t-shirt over the jersey, the red undershirt's sleeves out
// of it, and the black champions cap
ROLE.tee = 524288;
ROLE.champCap = 1048576;
// ---- end R
// ---- FY2: a navy cap with the home uniform (the ball girls who danced with the Phanatic in the rain on
// the 27th: Getty 83477166)
ROLE.navyCap = 2097152;
// ---- end FY2
// what he is (the first of the slot's numbers)
export const KIND = { away: 0, home: 1, ump: 2, crew: 3, phanatic: 4 };
// the light of the ring of banks round the bowl at night on the players, against the key's (playerMaterial)
const NIGHT_FILL = 0.2;
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
		// ---- FF3: each slot's face (Faces.js bakeFace, when he comes on: update() writes it), and the
		// expressions' records the near figure blends
		this.faces = new StorageBuffer( { label: 'playerFaces', count: MAX * HEAD.count, type: 'vec4u' } );
		this.exprs = new StorageBuffer( { label: 'playerExpressions', count: HEAD.count * 2, type: 'vec4u', data: exprRecords() } );
		this._faceDirty = new Set();
		this._faceCache = new Map();
		// ---- end FF3
		// the rig's triangles in two draws (FY2): everyone's, and the Phanatic's costume, drawn only for his
		// slots (the slot each of its instances is in aSlot), so the ninety-odd others don't carry it
		const [ geo, costumeGeo ] = splitByPart( buildPlayerGeometry(), PHANATIC_PARTS );
		this.atlas = canvasTexture( ATLAS_W, ATLAS_H, ( ctx ) => {

			drawChest( ctx, C.chestHome, true );
			drawChest( ctx, C.chestAway, false );
			drawChest( ctx, C.jacketHome, true, true );
			drawChest( ctx, C.jacketAway, false, true );
			drawCapLogo( ctx, C.capHome, true );
			drawCapLogo( ctx, C.capAway, false );
			drawChampCap( ctx, C.capChamp ); // ---- FR1
			drawPatch( ctx, C.patch );
			drawRay( ctx, C.ray ); // ---- FY3
			drawMLB( ctx, C.mlb );

		}, 'jerseys' );
		this.atlasCtx = this.atlas.canvas.getContext( '2d' );
		this._atlasDirty = false;
		// ---- SP1 (speed): everyone's draw takes its slots from aSlot too, the visible ones packed at the
		// front, so a hidden slot (a runner who scored, a reliever sat down) isn't drawn: a hidden slot's
		// 32,000 triangles were shaded (collapsed to a point) for every slot below the last visible one
		this.drawSlots = new InstancedBufferAttribute( new Float32Array( MAX ), 1 );
		geo.setAttribute( 'aSlot', this.drawSlots );
		this.material = playerMaterial( this.bones, this.infoBuffer, this.atlas, false, true, this.faces, this.exprs );
		// ---- end SP1
		this.mesh = new InstancedMesh( geo, this.material, MAX );
		this.mesh.name = 'players';
		this.mesh.frustumCulled = false;
		this.mesh.castShadow = true;
		this.mesh.receiveShadow = true;
		parent.add( this.mesh );
		this.costumeSlots = new InstancedBufferAttribute( new Float32Array( COSTUMES ), 1 );
		costumeGeo.setAttribute( 'aSlot', this.costumeSlots );
		this.costumeMaterial = playerMaterial( this.bones, this.infoBuffer, this.atlas, true, true, this.faces, this.exprs );
		this.costume = new InstancedMesh( costumeGeo, this.costumeMaterial, COSTUMES );
		this.costume.name = 'players-phanatic-costume';
		this.costume.frustumCulled = false;
		this.costume.castShadow = true;
		this.costume.receiveShadow = true;
		this.costume.count = 0;
		this.costume.visible = false;
		// (a child of the players' draw, so whatever takes the players out takes it too)
		this.mesh.add( this.costume );
		// ---- SP2 (speed): the far players' draw. A player under LOD_PX tall on screen is drawn from the far
		// figure (Rig.js buildPlayerGeometry( { lod: true } ): a quarter of the triangles, the same material
		// and slots), so the TV's wide views and the walk's far ones don't skin 32,000 triangles for a man
		// 20 px tall. lodSplit() (each frame, after update(): BallparkApp._playerBounds) sorts them
		const farGeo = buildPlayerGeometry( { lod: true } );
		this.farSlots = new InstancedBufferAttribute( new Float32Array( MAX ), 1 );
		farGeo.setAttribute( 'aSlot', this.farSlots );
		this.far = new InstancedMesh( farGeo, this.material, MAX );
		this.far.name = 'players-far';
		this.far.frustumCulled = false;
		this.far.castShadow = true;
		this.far.receiveShadow = true;
		this.far.count = 0;
		this.mesh.add( this.far );
		this.lodPx = LOD_PX;
		// the middle figure (buildPlayerGeometry( { lod: 'mid' } ): the body to two fifths, the pieces whole)
		// from LOD_PX to MID_PX: FOX's long lens from center field has most of its players there
		const midGeo = buildPlayerGeometry( { lod: 'mid' } );
		this.midSlots = new InstancedBufferAttribute( new Float32Array( MAX ), 1 );
		midGeo.setAttribute( 'aSlot', this.midSlots );
		this.mid = new InstancedMesh( midGeo, this.material, MAX );
		this.mid.name = 'players-mid';
		this.mid.frustumCulled = false;
		this.mid.castShadow = true;
		this.mid.receiveShadow = true;
		this.mid.count = 0;
		this.mesh.add( this.mid );
		this.midPx = MID_PX;
		// ---- end SP2
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
		this._faceDirty.add( i ); // ---- FF3
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
		// ---- FF3: the replay's clock and the champions' moment (Director.champsAt: from strike three), for
		// the faces' expressions
		const dir = this.director || globalThis.__app?.director;
		const et = dir ? dir.t : performance.now() / 1000;
		const champs = dir?.champsAt ? dir.champsAt( et ) : null;
		// ---- end FF3
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
			solvePose( this._root, p.pose, D, off, p.gloveHand, p.look.girth || 1, p.look.head || 1 ); // (---- FY4: the head's size)
			skinMatrices( D, off );
			// a player who just appeared has no motion from where his slot was before
			if ( p.fresh ) {

				D.copyWithin( half + off, off, off + NB * 16 );
				p.fresh = false;

			}

			const k = p.packed, o = i * K * 4;
			this.info.set( [ p.kind, expression( p, et, champs ), p.role || 0, p.seed || 0 ], o ); // (---- FF3: his expression)
			this.info.set( [ k.skin[ 0 ], k.skin[ 1 ], k.skin[ 2 ], p.dirt || 0 ], o + 4 );
			this.info.set( [ k.hair[ 0 ], k.hair[ 1 ], k.hair[ 2 ], k.face ], o + 8 );
			this.info.set( [ k.style, k.belly, k.jaw, k.ageStubble ], o + 12 );
			this.info.set( k.shape, o + 16 ); // ---- FY4

		}

		if ( this._first ) {

			D.copyWithin( half, 0, half );
			this._first = false;

		}

		this.bones.write( D );
		this.infoBuffer.write( this.info );
		// ---- FF3: the faces of the men who came on (each worked out once: the same man again is kept)
		if ( this._faceDirty.size ) {

			for ( const i of this._faceDirty ) {

				const p = this.slots[ i ];
				if ( ! p ) continue;
				const key = JSON.stringify( p.look.mh || {} );
				let rec = this._faceCache.get( key );
				if ( ! rec ) {

					rec = bakeFace( p.look.mh || {} );
					this._faceCache.set( key, rec );
					if ( this._faceCache.size > 40 ) this._faceCache.delete( this._faceCache.keys().next().value );

				}

				this.faces.write( rec, i * HEAD.count * 16 );

			}

			this._faceDirty.clear();

		}
		// ---- end FF3
		// draw only as many instances as there are slots in use
		let used = 0, drawn = 0;
		const ds = this.drawSlots.array;
		for ( let i = 0; i < MAX; i ++ ) if ( this.slots[ i ] && this.slots[ i ].visible ) {

			used = i + 1;
			// ---- SP1: the visible slots, packed (aSlot)
			if ( ds[ drawn ] !== i ) {

				ds[ drawn ] = i;
				this.drawSlots.needsUpdate = true;

			}

			drawn ++;

		}

		this.mesh.count = Math.max( 1, drawn );
		this._drawn = drawn; // ---- SP2: lodSplit() sorts these into near and far
		// the Phanatic's costume on his slots (him, and the little one)
		let nc = 0;
		for ( let i = 0; i < used && nc < COSTUMES; i ++ ) {

			const p = this.slots[ i ];
			if ( p && p.visible && p.kind === KIND.phanatic ) {

				if ( this.costumeSlots.array[ nc ] !== i ) {

					this.costumeSlots.array[ nc ] = i;
					this.costumeSlots.needsUpdate = true;

				}

				nc ++;

			}

		}

		this.costume.count = Math.max( 1, nc );
		this.costume.visible = nc > 0;
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

	// ---- SP2 (speed): the visible players into the near draw and the far one, by their height on screen
	// (px of a view `height` px high; the camera's vertical scale from its projection), with a margin
	// either side of LOD_PX so nobody flickers between them. The far figure's triangles are a few pixels
	// across at that size: it looks the same there (checked in shot pairs, TV high and center)
	lodSplit( camera, height ) {

		const n = this._drawn || 0, ds = this.drawSlots.array, fs = this.farSlots.array, ms = this.midSlots.array;
		const k = camera.projectionMatrix.elements[ 5 ] * height * 0.5, T = this.lodPx, TM = this.midPx;
		const me = this.mesh.matrixWorld.elements, c = camera.matrixWorld.elements;
		let near = 0, far = 0, mid = 0;
		for ( let j = 0; j < n; j ++ ) {

			const i = ds[ j ], p = this.slots[ i ];
			// his middle in the world (the players' parent frame: the field's)
			const x = p.x, y = ( p.y || 0 ) + 0.9, z = p.z;
			const wx = me[ 0 ] * x + me[ 4 ] * y + me[ 8 ] * z + me[ 12 ] - c[ 12 ];
			const wy = me[ 1 ] * x + me[ 5 ] * y + me[ 9 ] * z + me[ 13 ] - c[ 13 ];
			const wz = me[ 2 ] * x + me[ 6 ] * y + me[ 10 ] * z + me[ 14 ] - c[ 14 ];
			const px = 1.88 * ( p.look.height || 1 ) * k / Math.max( 0.1, Math.hypot( wx, wy, wz ) );
			p.lodFar = p.lodFar ? px < T * 1.08 : px < T * 0.92;
			p.lodMid = p.lodMid ? px < TM * 1.08 : px < TM * 0.92;
			if ( p.lodFar ) fs[ far ++ ] = i;
			else if ( p.lodMid ) ms[ mid ++ ] = i;
			else ds[ near ++ ] = i;

		}

		// (the near list is rewritten in place, behind the reads: near <= j)
		if ( n ) {

			this.drawSlots.needsUpdate = true;
			this.farSlots.needsUpdate = far > 0;
			this.midSlots.needsUpdate = mid > 0;
			this.mesh.count = near;

		}

		this.far.count = far;
		this.mid.count = mid;

	}
	// ---- end SP2

}

// ---- FF3 (step 10): his face this frame, the weights of the near figure's three expressions (MakeHuman's
// units, Faces.js) packed into the slot's first vec4 (a byte each: the mouth open, the smile, the lids shut):
//  - a blink every 2.5-6 s on his own clock, and the lids' own rest a little down (nobody stares into the
//    banks under a bill)
//  - a gum or seed chewer's jaw working (2008's dugouts: sunflower seeds, Big League Chew)
//  - from strike three (Director.champsAt) the Phillies shout and grin, in bursts, through the pile, and
//    laugh and smile on through the celebration; Lidge on his knees, arms up, the mouth wide, his eyes
//    screwed up (Getty 83485858, 83485929); the Rays' faces set; the crew smiling
function expression( p, t, ch ) {

	if ( p.kind === KIND.phanatic ) return 0;
	const fr = ( x ) => x - Math.floor( x );
	const s = fr( ( p.seed || 0 ) * 97.31 + p.slot * 0.6180339 );
	const per = 2.5 + 3.5 * fr( s * 37.1 ), bt = fr( t / per + s ) * per;
	let blink = Math.max( bt < 0.16 ? Math.sin( bt / 0.16 * Math.PI ) : 0, 0.1 + 0.14 * fr( s * 3.1 ) );
	let open = 0, smile = 0;
	if ( fr( s * 7.3 ) < 0.4 && p.kind !== KIND.ump ) open = 0.04 + 0.06 * Math.max( 0, Math.sin( t * ( 7 + 3 * fr( s * 5.1 ) ) + s * 40 ) );
	if ( ch ) {

		const lt = ch.lt;
		if ( p.kind === KIND.home ) {

			const burst = Math.max( 0, Math.sin( lt * ( 1.6 + fr( s * 2.3 ) ) + s * 30 ) );
			smile = 0.5 + 0.35 * fr( s * 1.9 );
			open = lt < 40 ? 0.25 + 0.65 * burst : 0.12 * burst + 0.55 * Math.max( 0, Math.sin( lt * 0.31 + s * 20 ) ) ** 8;
			if ( p.look.id === 400058 && lt < 4.5 ) { open = 1; smile = 0.15; blink = Math.max( blink, 0.6 ); }

		} else if ( p.kind === KIND.away ) { open = Math.min( open, 0.05 ); }
		else if ( p.kind === KIND.crew ) { smile = 0.45; }

	}

	const q = ( x ) => Math.round( Math.max( 0, Math.min( 1, x ) ) * 255 );
	return q( open ) + q( smile ) * 256 + q( blink ) * 65536;

}
// ---- end FF3

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
		shape: packFace( L.face ), // ---- FY4
	};

}

// ---- FY4: the face's sixteen numbers (Looks.js' FACE_PACK, -1 to 1) six bits each, four to a float (whole
// numbers under 2^24, exact in an f32)
function packFace( face ) {

	const b = ( k ) => Math.round( ( Math.max( - 1, Math.min( 1, ( face && face[ k ] ) || 0 ) ) + 1 ) * 31 ); // (0 to 62: 31 is the base face exactly)
	const out = [ 0, 0, 0, 0 ];
	FACE_PACK.forEach( ( k, i ) => out[ i >> 2 ] += b( k ) * 64 ** ( i & 3 ) );
	return out;

}
// ---- end FY4

// the rig's geometry split by its triangles' parts: [ the rest, those in `parts` ], sharing the vertices
function splitByPart( g, parts ) {

	const pt = g.getAttribute( 'aPart' ).array, idx = g.index.array;
	const keep = [], put = [];
	for ( let i = 0; i < idx.length; i += 3 ) ( parts.includes( Math.round( pt[ idx[ i ] ] ) ) ? put : keep ).push( idx[ i ], idx[ i + 1 ], idx[ i + 2 ] );
	return [ keep, put ].map( ( list ) => {

		const h = new BufferGeometry();
		for ( const [ k, a ] of Object.entries( g.attributes ) ) h.setAttribute( k, a );
		h.setIndex( list );
		h.computeBoundingSphere();
		return h;

	} );

}

// costume: the material of the Phanatic's costume draw; slotted: its instances' slots from aSlot (SP1:
// everyone's draw too)
function playerMaterial( bones, info, atlas, costume = false, slotted = costume, faces = null, exprs = null ) { // (---- FF3: faces, exprs)

	const P = PART, U = UNIFORM, F = FACE, J = BODY_JOINTS;
	const f = ( x ) => x.toFixed( 4 );
	const v3 = ( a ) => `vec3f( ${ f( a[ 0 ] ) }, ${ f( a[ 1 ] ) }, ${ f( a[ 2 ] ) } )`;
	const R = ROLE;
	const mat = standard( {
		name: costume ? 'players-costume' : 'players', roughness: 0.75, modules: [ commonModule ],
		storage: { plBones: bones, plInfo: info, plFace: faces, plExpr: exprs }, // (---- FF3: plFace, plExpr)
		textures: { plAtlas: atlas },
		attributes: { aBones: 'vec4f', aWeights: 'vec4f', aPart: 'f32', aField: 'vec3f', ...( slotted ? { aSlot: 'f32' } : {} ) }, // (---- FF3: aField.z the head vertex)
		varyings: { vPart: 'f32', vInfo: 'vec4f', vLocal: 'vec3f', vNrm: 'vec3f', vField: 'vec2f', vSlot: 'f32', vFN: 'vec3f' },
		vertex: /* wgsl */`
	let slot = ${ slotted ? 'u32( v.aSlot + 0.5 )' : 'v.instance' };
	let i0 = plInfo[ slot * ${ K }u ];
	let i2 = plInfo[ slot * ${ K }u + 2u ];
	let i3 = plInfo[ slot * ${ K }u + 3u ];
	let kind = i32( i0.x + 0.5 );
	let role = u32( i0.z + 0.5 );
	let style = u32( i3.x + 0.5 );
	let phan = kind == ${ KIND.phanatic };
	// what he's wearing: the pieces he isn't collapse to nothing
	// (---- FF3: the mouth's inside is the body's own skin to everything here; the surface paints it)
	let pt = select( i32( v.aPart + 0.5 ), ${ P.body }, i32( v.aPart + 0.5 ) == ${ P.mouth } );
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
	if ( ( ${ PHANATIC_PARTS.map( ( k ) => `pt == ${ k }` ).join( ' || ' ) } ) && ! phan ) { keep = false; }
	if ( phan && ( pt == ${ P.eye } || pt == ${ P.helmet } ) ) { keep = false; }
	// in the rain his cap is under the sou'wester (phanatic/Props.js)
	if ( pt == ${ P.phCap } && ( role & ${ R.slicker }u ) != 0u ) { keep = false; }
	if ( pt == ${ P.glasses } && ( u32( i2.w + 0.5 ) & 16u ) == 0u ) { keep = false; }
	var lp3 = v.position;
	let arm = v.aField.x;
	let leg = v.aField.y;
	if ( pt == ${ P.body } ) {
		// the build the bones can't give: a belly between the belt and the chest, pushed out in front and
		// a little at the sides (the Phanatic's is his costume's: Rig.js' phanatic())
		let belly = i3.y;
		if ( belly > 0.0 && arm < -0.5 && leg < -0.5 && ! phan ) {
			let prof = smoothstep( 0.86, 1.1, lp3.y ) * ( 1.0 - smoothstep( 1.16, 1.42, lp3.y ) );
			let front = smoothstep( 0.03, -0.09, lp3.z );
			let side = 1.0 - smoothstep( 0.08, 0.2, abs( lp3.x ) );
			lp3 += vec3f( lp3.x * 0.3 * prof * belly, 0.0, - 0.07 * prof * belly * front * side );
		}
		// (FY2, CY-6: the lean ones' stomachs flat; the base mesh carries a little belly of its own)
		if ( belly < 0.01 && arm < -0.5 && leg < -0.5 && ! phan ) {
			lp3.z += 0.012 * smoothstep( 0.96, 1.1, lp3.y ) * ( 1.0 - smoothstep( 1.18, 1.3, lp3.y ) ) * smoothstep( -0.07, -0.13, lp3.z );
		}
		// ---- FY2 (the Phanatic): the performer inside the costume. His trunk kept inside its body; his arms
		// in thick shag under the jersey's loose short sleeves, the hands big furry mitts; the padded red
		// leggings below the skirt
		if ( phan ) {
			if ( arm > -0.5 ) {
				if ( arm > ${ f( U.wrist - 0.01 ) } ) {
					let wr = select( ${ v3( J.wristL ) }, ${ v3( J.wristR ) }, lp3.x > 0.0 );
					lp3 = wr + ( lp3 - wr ) * 1.5;
				} else {
					lp3 += v.normal * select( 0.034, 0.044, arm < 0.25 );
				}
			} else if ( leg < -0.5 ) {
				lp3 = vec3f( lp3.x * 0.9, lp3.y, lp3.z * 0.9 );
			} else if ( leg > 0.44 && leg < 0.8 ) {
				lp3 += v.normal * 0.02;
			}
		}
		// ---- end FY2
		// a jacket's sleeves stand off the arm (its body hangs from the shoulders: the hull below); long pants
		// hang loose over the shoe tops
		// ---- FR1: the jacket's body no longer pushed out along the normals here (+1.3 cm round a round
		// trunk, on top of a big man's girth: Manuel's red jacket was a balloon, FB2's final3/E05)
		if ( ( role & ${ R.jacket }u ) != 0u && arm > -0.5 && arm < ${ f( U.wrist ) } ) {
			lp3 += v.normal * 0.007 * smoothstep( 0.02, 0.09, arm );
		}
		// ---- end FR1
		if ( ( style & 1u ) == 0u && leg > 0.5 ) { lp3 += v.normal * 0.016 * smoothstep( 0.55, 0.84, leg ); }
		// ---- FB2 (C2B-2): the 2008 cut hangs from the shoulders. (FY2's drape pushed the cloth out along
		// the body's normals, which rounded a round trunk into a barrel and the seat and thighs into a
		// pear: C2B's TV close-ups.) The jersey falls straight from the chest at the armpits to the belt,
		// an elliptical hull the chest's size that the waist is filled out to (the belly of a big man
		// stays his own, outside it), narrowing a little to the belt, a little bloused at the back over it;
		// the shoulders squared under the yoke, so the jersey hangs off something; the hips a little in;
		// the pants straight from the hip to the knee, the outer thigh's bulge taken in and the
		// hollow above the knee filled (Getty 83485455: Jenkins's broad back, the jersey loose from the
		// shoulders and the pants straight; 83486198: Hinske's back; 83485884: the pants falling straight)
		// ---- FR1: the dugout jacket through the same hull, a size up (it's over the jersey) and falling
		// straight past the belt to its knit hem at the hip, gathered there (Getty 83570999: Manuel's, roomy
		// and square from the shoulders; 83483743)
		let jk = select( 0.0, 1.0, ( role & ${ R.jacket }u ) != 0u );
		// ---- end FR1
		if ( ! phan ) {
			let back = smoothstep( -0.02, 0.1, lp3.z );
			let ax = abs( lp3.x );
			let sx = sign( lp3.x );
			// the yoke: the shoulder line squared out to the deltoid (the trapezius' slope bridged)
			let yoke = smoothstep( 0.08, 0.16, ax ) * smoothstep( 1.45, 1.54, lp3.y ) * ( 1.0 - smoothstep( 1.62, 1.66, lp3.y ) ) * select( 1.0, 0.0, arm > -0.5 );
			if ( arm < -0.5 && leg < -0.5 && lp3.y < ${ f( U.collar ) } ) {
				if ( lp3.y > ${ f( U.belt[ 1 ] ) } || ( jk > 0.5 && lp3.y > ${ f( U.belt[ 0 ] - 0.075 ) } ) ) {
					let below = smoothstep( 1.45, 1.33, lp3.y );
					let toBelt = smoothstep( 1.33, ${ f( U.belt[ 1 ] ) }, lp3.y );
					let zc = -0.01;
					let hem = 1.0 - 0.03 * jk * smoothstep( ${ f( U.belt[ 0 ] - 0.03 ) }, ${ f( U.belt[ 0 ] - 0.075 ) }, lp3.y );
					let hx = ( 0.21 + 0.014 * jk - 0.03 * toBelt * ( 1.0 - 0.5 * jk ) ) * hem;
					let hz = ( select( 0.14, 0.136, lp3.z > zc ) + 0.012 * jk - 0.01 * toBelt * ( 1.0 - 0.5 * jk ) ) * hem;
					let r = length( vec2f( lp3.x / hx, ( lp3.z - zc ) / hz ) );
					if ( r < 1.0 && r > 0.05 ) {
						let s = mix( 1.0, 1.0 / r, below );
						lp3 = vec3f( lp3.x * s, lp3.y, zc + ( lp3.z - zc ) * s );
					}
					// (FR1: a jacket's sides hang straight down from the chest, so a big man's belly fills its
					// front, not its sides: it was a ball, wider at the belly than at the shoulders)
					if ( jk > 0.5 ) {
						lp3.x = clamp( lp3.x, - hx, hx );
						lp3.z = clamp( lp3.z, zc - hz * 1.22, zc + hz * 1.06 );
					}
					lp3 += v.normal * ( 0.006 + 0.007 * jk + 0.012 * back * smoothstep( ${ f( U.belt[ 1 ] + 0.1 ) }, ${ f( U.belt[ 1 ] + 0.02 ) }, lp3.y ) * ( 1.0 - jk ) );
				} else if ( lp3.y < ${ f( U.belt[ 0 ] ) } ) {
					// the seat: the pants' cloth over it, not a bubble; the hips a little in
					lp3 = vec3f( lp3.x * ( 1.0 - 0.05 * smoothstep( 0.11, 0.18, ax ) ), lp3.y, lp3.z );
					lp3 += v.normal * 0.006;
				} else {
					lp3 += v.normal * 0.008;
				}
			}
			lp3 += vec3f( sx * 0.006, 0.012, 0.0 ) * yoke;
			// the sleeves stand off the arm, hanging from the shoulder's point; the cap of the shoulder
			// pressed a little flat under the cloth (the arm lowered from the mesh's A pose pops it up into a
			// ball, like a shoulder pad)
			if ( arm > -0.5 && arm < ${ f( U.sleeve ) } ) { lp3 += v.normal * ( 0.012 * smoothstep( 0.04, 0.1, arm ) * ( 1.0 - jk ) - 0.01 * ( 1.0 - smoothstep( 0.0, 0.09, arm ) ) * smoothstep( 0.2, 0.75, v.normal.y ) ); }
			// the pants: from the hip to the knee about a straight cone round the thigh's bone
			if ( leg > -0.5 && leg < 0.62 ) {
				let hp = vec3f( sx * ${ f( J.hipR[ 0 ] ) }, ${ f( J.hipR[ 1 ] ) }, ${ f( J.hipR[ 2 ] ) } );
				let kn = vec3f( sx * ${ f( J.kneeR[ 0 ] ) }, ${ f( J.kneeR[ 1 ] ) }, ${ f( J.kneeR[ 2 ] ) } );
				let ta = normalize( kn - hp );
				let d = lp3 - hp;
				let along = dot( d, ta );
				let tk = clamp( along / ${ f( Math.hypot( J.kneeR[ 0 ] - J.hipR[ 0 ], J.kneeR[ 1 ] - J.hipR[ 1 ], J.kneeR[ 2 ] - J.hipR[ 2 ] ) ) }, 0.0, 1.0 );
				let rv = d - ta * along;
				let r = length( rv );
				// (from the top of the thigh to just above the knee; the knee and the calf as they were)
				let w = 1.0 - smoothstep( 0.82, 1.05, tk );
				if ( r > 1e-4 && w > 0.0 ) {
					let rh = mix( 0.108, 0.088, tk );
					// (the outer side taken in more: the hip's bulge, the jodhpurs)
					let outer = smoothstep( 0.0, 0.6, dot( rv / r, vec3f( sx, 0.0, 0.0 ) ) );
					let rt = select( rh + ( r - rh ) * ( 0.55 - 0.25 * outer ), rh, r < rh );
					lp3 += rv / r * ( rt - r ) * w;
				}
				lp3 += v.normal * 0.008 * ( 1.0 - smoothstep( 0.5, 0.62, leg ) );
			}
		}
		// under a cap the crown of the scalp stays under it (from above, in the high cameras' close-ups of
		// the pitcher, it came through the top of the cap as a brown patch)
		if ( arm < -0.5 && leg < -0.5 && lp3.y > ${ f( F.eyeR[ 1 ] + 0.05 ) } && ! helmet && ! phan && ( role & ${ R.ccap | R.nocap | R.hood }u ) == 0u ) {
			let cc = vec3f( 0.0, ${ f( F.top[ 1 ] - 0.1 ) }, ${ f( ( F.skull.z0 + F.skull.z1 ) / 2 ) } );
			lp3 = cc + ( lp3 - cc ) * ( 1.0 - 0.08 * smoothstep( ${ f( F.eyeR[ 1 ] + 0.05 ) }, ${ f( F.eyeR[ 1 ] + 0.085 ) }, lp3.y ) );
		}
		// ---- end FB2
		// ---- FB3 (C3B-11): seen from above, in the high cameras' pitcher close-ups, FB2's cut read as
		// shoulder pads, belled sleeves, a pillow at the belt and a modelled crotch (gauntlet r3 C3B, S101,
		// S106; FOX t11530s, Balfour from above: the shoulders slope, the sleeves fall, the jersey goes
		// straight into the belt; 2008's pants baggy, the seat deep). The shoulder line slopes down again
		// from 7 cm in from its point (the squaring kept by the neck); the sleeve's top drawn in to the arm
		// and its underside let down toward the hem; the hull eased into the belt over its last 6 cm rather
		// than standing out over it; the tops of the inner thighs drawn in and down, a sag of cloth for a
		// crotch, not a V. (The jacket keeps its own: FR1's.)
		if ( ! phan && jk < 0.5 ) {
			let ax = abs( lp3.x );
			let sx = sign( lp3.x );
			if ( arm < -0.5 && leg < -0.5 ) {
				let slope = smoothstep( 0.12, 0.2, ax ) * smoothstep( 1.43, 1.5, lp3.y ) * ( 1.0 - smoothstep( 1.62, 1.68, lp3.y ) );
				lp3 += vec3f( - sx * 0.01, - 0.028, 0.0 ) * slope;
				let b1 = ${ f( U.belt[ 1 ] ) };
				if ( lp3.y > b1 - 0.005 && lp3.y < b1 + 0.06 ) {
					let e = 1.0 - 0.6 * ( 1.0 - smoothstep( b1, b1 + 0.06, lp3.y ) );
					if ( ax > 0.15 ) { lp3.x = sx * ( 0.15 + ( ax - 0.15 ) * e ); }
					if ( lp3.z < -0.12 ) { lp3.z = -0.12 + ( lp3.z + 0.12 ) * e; }
					if ( lp3.z > 0.11 ) { lp3.z = 0.11 + ( lp3.z - 0.11 ) * mix( 0.7, 1.0, e ); }
				}
			}
			if ( arm > -0.5 && arm < ${ f( U.sleeve + 0.01 ) } ) {
				let up = smoothstep( 0.15, 0.8, v.normal.y ) * smoothstep( 0.04, 0.1, arm );
				let dn = smoothstep( -0.15, -0.75, v.normal.y ) * smoothstep( 0.06, ${ f( U.sleeve ) }, arm );
				lp3 += v.normal * ( -0.013 * up ) + vec3f( 0.0, -0.016 * dn, 0.0 );
				// the cap of the shoulder taken in round the arm's bone (the A pose's deltoid, lowered, is a ball)
				let sh = vec3f( sx * ${ f( J.shoulderR[ 0 ] ) }, ${ f( J.shoulderR[ 1 ] ) }, ${ f( J.shoulderR[ 2 ] ) } );
				let ab = normalize( vec3f( sx * ${ f( J.elbowR[ 0 ] - J.shoulderR[ 0 ] ) }, ${ f( J.elbowR[ 1 ] - J.shoulderR[ 1 ] ) }, ${ f( J.elbowR[ 2 ] - J.shoulderR[ 2 ] ) } ) );
				let dv = lp3 - sh;
				// (FY3: 0.14 -> 0.2: from the high cameras the cap of the shoulder still read as a pad)
				lp3 -= ( dv - ab * dot( dv, ab ) ) * 0.2 * ( 1.0 - smoothstep( 0.05, 0.15, arm ) );
			}
			if ( leg > -0.5 && leg < 0.16 ) {
				let w = smoothstep( -0.2, -0.7, v.normal.x * sx ) * ( 1.0 - smoothstep( 0.02, 0.16, leg ) );
				lp3 = vec3f( lp3.x * ( 1.0 - 0.42 * w ), lp3.y - 0.05 * w, lp3.z );
			}
		}
		// ---- end FB3
		// ---- FY3: 2008's long pants hang loose from the knee to the shoe tops (Getty 83485159, Balfour;
		// 83485858, Lidge), not tights over the calf with the kneecap showing: below the thigh's cone (FB2)
		// a second, round the shin's bone, 8.8 cm at the knee to 7.6 at the hem, filled out where the leg is
		// under it and the excess taken in, the hem a little fuller where it breaks over the shoe
		// the fly: the cloth bridges the groin's creases, a little behind the thighs' fronts (the base
		// mesh's groin is a V 3 cm deep: it read through the pants as a modelled crotch). Not lower down,
		// where pulling the inner thighs forward hung a pouch between the legs
		if ( ! phan && arm < -0.5 && lp3.y > 0.86 && lp3.y < 1.0 && lp3.z < -0.01 ) {
			let k = 0.85 * ( 1.0 - smoothstep( 0.06, 0.095, abs( lp3.x ) ) ) * smoothstep( 0.86, 0.9, lp3.y ) * ( 1.0 - smoothstep( 0.965, 1.0, lp3.y ) ) * smoothstep( -0.01, -0.035, lp3.z );
			lp3.z = min( lp3.z, mix( lp3.z, -0.077 - 0.6 * lp3.x * lp3.x, k ) );
		}
		// the seat: the cloth across the cleft and down off the cheeks, not painted on them (from behind,
		// the pitchers' close-ups from center field)
		if ( ! phan && arm < -0.5 && lp3.y > 0.86 && lp3.y < 1.02 && lp3.z > 0.01 ) {
			let k = ( 1.0 - smoothstep( 0.06, 0.1, abs( lp3.x ) ) ) * smoothstep( 0.86, 0.9, lp3.y ) * ( 1.0 - smoothstep( 0.97, 1.02, lp3.y ) ) * smoothstep( 0.01, 0.04, lp3.z );
			lp3.z = max( lp3.z, mix( lp3.z, 0.104 - 0.9 * lp3.x * lp3.x, k ) );
		}
		if ( ! phan && ( style & 1u ) == 0u && ( role & ${ R.shorts }u ) == 0u && leg > 0.3 ) {
			let sx = sign( lp3.x );
			let kn = vec3f( sx * ${ f( J.kneeR[ 0 ] ) }, ${ f( J.kneeR[ 1 ] ) }, ${ f( J.kneeR[ 2 ] ) } );
			let an = vec3f( sx * ${ f( J.ankleR[ 0 ] ) }, ${ f( J.ankleR[ 1 ] ) }, ${ f( J.ankleR[ 2 ] ) } );
			let ta = normalize( an - kn );
			let d = lp3 - kn;
			let along = dot( d, ta );
			let tk = clamp( along / ${ f( Math.hypot( J.ankleR[ 0 ] - J.kneeR[ 0 ], J.ankleR[ 1 ] - J.kneeR[ 1 ], J.ankleR[ 2 ] - J.kneeR[ 2 ] ) ) }, 0.0, 1.0 );
			let rv = d - ta * along;
			let r = length( rv );
			let w = smoothstep( 0.3, 0.4, leg );
			if ( r > 1e-4 ) {
				let rc = mix( 0.088, 0.076, tk ) + 0.008 * smoothstep( 0.8, 0.95, tk );
				let rt = select( rc + ( r - rc ) * 0.45, mix( r, rc, 0.85 ), r < rc );
				lp3 += rv / r * ( rt - r ) * w;
			}
			// the hem level, a clean ring breaking over the shoe's top (the mesh's end ring is ragged where
			// the bare foot was cut away)
			lp3.y = mix( lp3.y, ${ f( J.ankleR[ 1 ] + 0.004 ) }, smoothstep( 0.8, 0.85, leg ) );
		}
		// ---- end FY3
		// ---- A (Phanatic): the rain slicker's sleeves stand off the fur (its body: the costume's, below)
		if ( phan && ( role & ${ R.slicker }u ) != 0u ) {
			if ( arm > -0.5 && arm < ${ f( U.wrist - 0.03 ) } ) { lp3 += v.normal * 0.028; }
		}
		// ---- end A
		// the face: the jaw broader or narrower, a full beard's thickness
		let eye = ${ v3( F.eyeR ) };
		if ( arm < -0.5 && leg < -0.5 && lp3.y > ${ f( J.neck[ 1 ] ) } ) {
			let jawK = smoothstep( eye.y, ${ f( F.jaw[ 1 ] ) }, lp3.y ) * smoothstep( ${ f( J.neck[ 1 ] - 0.01 ) }, ${ f( F.jaw[ 1 ] ) }, lp3.y );
			lp3.x = lp3.x * ( 1.0 + i3.z * 0.09 * jawK );
			// ---- FY3: a brow ridge, 3 mm over each eye, so the sockets sit under something and the bill's
			// shadow has an edge to fall from (the base mesh's brow is smooth)
			let brk = ( 1.0 - smoothstep( 0.005, 0.014, abs( lp3.y - ${ f( F.eyeR[ 1 ] + 0.019 ) } ) ) ) * smoothstep( 0.006, 0.014, abs( lp3.x ) ) * ( 1.0 - smoothstep( 0.048, 0.06, abs( lp3.x ) ) ) * smoothstep( eye.z + 0.03, eye.z, lp3.z );
			lp3.z -= 0.003 * brk;
			// ---- end FY3
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
	// ---- FY2 (the Phanatic): the costume's shag stands out in clumps, longer and looser down the skirt
	// (the jersey smooth over the top of it, hanging in soft folds); the belly swings with the shake
	// (Moves.js' jiggle, packed with his look's belly); in the rain the slicker tents out over it all
	if ( keep && ( pt == ${ P.phBody } || pt == ${ P.phNeck } || pt == ${ P.phHead } ) ) {
		let shirt = pt == ${ P.phBody } && lp3.y > ${ f( PHAN.hem - 0.016 ) };
		let n = mx_noise_float3( lp3 * vec3f( 15.0, 5.5, 15.0 ) + f32( slot ) * 3.1 ) * 0.5 + 0.5;
		let fine = mx_noise_float3( lp3 * vec3f( 40.0, 12.0, 40.0 ) ) * 0.5 + 0.5;
		let low = smoothstep( 0.9, ${ f( PHAN.skirt ) }, lp3.y );
		let pile = select( 1.0, 0.55, pt == ${ P.phHead } );
		if ( ! shirt ) { lp3 += v.normal * ( ( 0.006 + 0.022 * n + 0.008 * fine ) * ( 1.0 + 0.6 * low ) * pile ); }
		if ( pt == ${ P.phBody } ) {
			let jig = i3.y - 1.0;
			lp3 += vec3f( jig * 0.07, 0.0, - abs( jig ) * 0.03 ) * smoothstep( 1.05, 0.7, lp3.y );
			let around = atan2( lp3.x, - lp3.z );
			if ( shirt ) { lp3 += v.normal * 0.007 * sin( around * 9.0 + lp3.y * 5.0 ) * smoothstep( 1.4, ${ f( PHAN.hem ) }, lp3.y ); }
			// the slicker: hanging off his shoulders in loose folds to above the shag's hem
			let open = abs( around ) < 0.12 + 0.4 * smoothstep( 1.25, 0.75, lp3.y ) && lp3.y < 1.3;
			if ( ( role & ${ R.slicker }u ) != 0u && lp3.y > ${ f( PHAN.skirt + 0.05 ) } && ! open ) {
				let drape = smoothstep( 1.45, 0.7, lp3.y );
				lp3 += v.normal * ( 0.018 + drape * ( 0.012 + 0.03 * ( 0.5 + 0.5 * sin( around * 7.0 + 1.3 * sin( around * 3.0 ) ) ) ) );
			}
		}
	}
	// ---- end FY2
	// ---- FY4: the head sits 7-10 mm lower on a thicker neck (FY3: the neck read long from the front), the
	// pieces on the head (the cap, the helmet and its flaps, the mask, the glasses, the eyes) with it; the
	// neck's thickness is his (Looks.js' neck). (---- FF3: FY4's other fifteen numbers shaped the one face a
	// few millimetres at a time; the face is now MakeHuman's own targets, below, and they're retired here.)
	// The face's paint (the brows, lids, lips and beards: the surface stage's vLocal) stays on its vertices:
	// vLocal is the unshaped position
	var fd = vec3f( 0.0 );
	if ( keep && ! phan && lp3.y > ${ f( U.collar - 0.012 ) } && arm < -0.5 && leg < -0.5 ) {
		let qa = vec4u( plInfo[ slot * ${ K }u + 4u ] + 0.5 );
		let neckN = f32( ( qa.w >> 12u ) & 63u ) / 31.0 - 1.0;
		let x = lp3.x; let y = lp3.y; let z = lp3.z;
		let drop = 0.007 + 0.003 * neckN;
		let onHead = u32( v.aBones.x + 0.5 ) == ${ BONES.head }u && v.aWeights.x > 0.99;
		if ( pt == ${ P.body } ) {
			// the neck: thicker (a ballplayer's), more for the big men; not the chin's underside or the
			// trapezius' slope
			let nr = length( vec2f( x, z + 0.008 ) );
			let thK = smoothstep( 1.578, 1.6, y ) * ( 1.0 - smoothstep( 1.645, 1.675, y ) ) * ( 1.0 - smoothstep( 0.072, 0.092, nr ) ) * smoothstep( - 0.095, - 0.07, z );
			fd += vec3f( x, 0.0, z + 0.008 ) * ( 0.06 + 0.07 * neckN ) * thK;
			// the head lower on it: all of it above the jaw, the neck taking it up
			let dropK = smoothstep( 1.592, 1.648, y ) * ( 1.0 - smoothstep( 0.075, 0.1, nr ) * ( 1.0 - smoothstep( 1.64, 1.66, y ) ) );
			fd.y -= drop * dropK;
		} else if ( pt == ${ P.eye } || onHead ) {
			fd.y -= drop;
		}
		lp3 += fd;
	}
	// ---- end FY4
	// ---- FF3 (step 10): his own face, MakeHuman's (Faces.js, Looks.js' mh: the face's modifiers, the head's
	// shapes, his mix, age and weight), worked out on the CPU when he came on and read here, one record a
	// head vertex: the move and the normal's change. The near figure adds his expression (the mouth open,
	// the smile, the blink: MakeHuman's units; the slot's packed weights), read only while he has one on
	var nb = v.normal;
	if ( keep && ! phan && v.aField.z > -0.5 ) {
		let hq = u32( v.aField.z + 0.5 );
		let hv = hq & 65535u;
		let r = plFace[ slot * ${ HEAD.count }u + hv ];
		let a = unpack2x16float( r.x );
		let b = unpack2x16float( r.y );
		let c = unpack2x16float( r.z );
		var dp = vec3f( a, b.x );
		var dn = vec3f( b.y, c );
		let eq = u32( i0.y + 0.5 );
		if ( hq < 65536u && eq != 0u ) {
			let ex = vec3f( f32( eq & 255u ), f32( ( eq >> 8u ) & 255u ), f32( eq >> 16u ) ) / 255.0;
			let e0 = plExpr[ hv * 2u ];
			let e1 = plExpr[ hv * 2u + 1u ];
			let oa = unpack2x16float( e0.x );
			let oc = unpack2x16float( e0.y );
			let oe = unpack2x16float( e0.z );
			let og = unpack2x16float( e0.w );
			dp += vec3f( oa, oc.x ) * ex.x + vec3f( oc.y, oe ) * ex.y + vec3f( 0.0, og ) * ex.z;
			let na = unpack2x16float( e1.x );
			let nc = unpack2x16float( e1.y );
			let ne = unpack2x16float( e1.z );
			let ng = unpack2x16float( e1.w );
			dn += vec3f( na, nc.x ) * ex.x + vec3f( nc.y, ne ) * ex.y + vec3f( 0.0, ng ) * ex.z;
		}
		lp3 += dp;
		fd += dp;
		nb = normalize( nb + dn );
	}
	// ---- end FF3
	let lp = select( vec4f( 0.0, 0.0, 0.0, 1.0 ), vec4f( lp3, 1.0 ), keep );
	// skinned: up to four bones, each taking the bind pose to this frame's (and last frame's) pose (the
	// pieces he isn't wearing skip it: they all collapse to one point)
	var wp = vec3f( 0.0 );
	var wn = vec3f( 0.0, 1.0, 0.0 );
	var pp = vec3f( 0.0 );
	if ( keep ) {
		wn = vec3f( 0.0 );
		for ( var k = 0; k < 4; k ++ ) {
			let w = v.aWeights[ k ];
			if ( w > 0.0 ) {
				let b = u32( v.aBones[ k ] + 0.5 );
				let M = plBones[ slot * ${ NB }u + b ];
				let Mp = plBones[ ( ${ MAX }u + slot ) * ${ NB }u + b ];
				wp += ( M * lp ).xyz * w;
				wn += ( M * vec4f( nb, 0.0 ) ).xyz * w; // (---- FF3: his own face's normal)
				pp += ( Mp * lp ).xyz * w;
			}
		}
	}
	v.useWorld = true;
	v.worldPos = ( v.model * vec4f( wp, 1.0 ) ).xyz;
	v.worldNormal = normalize( ( v.model * vec4f( wn, 0.0 ) ).xyz + vec3f( 0.0, 1e-6, 0.0 ) );
	v.prevWorldPos = ( v.prevModel * vec4f( pp, 1.0 ) ).xyz;
	// (---- FF3: the mouth's inside goes on as the body's skin, marked by the leg's coordinate at -2: the part
	// can't be interpolated across the lips' rim, the mark can, a soft edge where the lips curl in)
	let mouthV = i32( v.aPart + 0.5 ) == ${ P.mouth };
	o.vPart = select( v.aPart, ${ P.body }.0, mouthV );
	o.vInfo = i0;
	o.vLocal = lp3 - fd; // ---- FY4: the face's paint on its vertices
	o.vNrm = nb; // ---- FF3
	o.vField = vec2f( v.aField.x, select( v.aField.y, -2.0, mouthV ) ); // (---- FF3)
	o.vSlot = f32( slot );
	// the normal in the field's frame (the bones are in it), for the light banks round the bowl
	o.vFN = wn;
`,
		surface: /* wgsl */`
	var part = i32( in.vs.vPart + 0.5 );
	// ---- FF3: how far this is the mouth's inside (the vertex stage's mark), painted after the face
	let mouthIn = clamp( -1.0 - in.vs.vField.y, 0.0, 1.0 );
	let part0 = part;
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
	// home: white, red pinstripes, red trim and caps, a red belt; away: road grey and navy; the
	// umpires: a black jacket, grey slacks, a black cap; the grounds crew: red jackets and khakis; the
	// Phanatic: a white jersey over green fur
	// (FY2, CY-4: the road greys of 2008 are a light, cool heather, about sRGB 185, 188, 196 in FOX's
	// close-up of Balfour; the home whites a warm off-white)
	var cloth = vec3f( 0.47, 0.48, 0.53 );
	var trim = vec3f( 0.012, 0.018, 0.06 );
	var pantsC = cloth;
	var beltC = trim;
	var capC = trim;
	// (FY2, CY-21: the Phillies' belts were red, a shade darker than the sleeves: Getty 83485455, 83912834)
	if ( home || phan ) { cloth = vec3f( 0.83, 0.82, 0.79 ); trim = vec3f( 0.42, 0.018, 0.025 ); pantsC = cloth; beltC = trim * 0.72; capC = trim; }
	if ( ump ) { cloth = vec3f( 0.014, 0.015, 0.02 ); trim = cloth; pantsC = vec3f( 0.2, 0.2, 0.21 ); beltC = vec3f( 0.01 ); capC = vec3f( 0.012 ); }
	if ( crew ) { cloth = vec3f( 0.3, 0.016, 0.02 ); trim = cloth; pantsC = vec3f( 0.25, 0.2, 0.13 ); beltC = vec3f( 0.03, 0.02, 0.01 ); capC = cloth; }
	// ---- R (rituals): the champions' gear
	let tee = ( role & ${ R.tee }u ) != 0u;
	if ( ( role & ${ R.champCap }u ) != 0u ) { capC = vec3f( 0.014 ); }
	// ---- end R
	if ( ( role & ${ R.navyCap }u ) != 0u ) { capC = vec3f( 0.014, 0.024, 0.075 ); }
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
			// (FY3: long pants to the shoe tops; the band of sock under a ragged hem is gone)
			let cuffAt = select( 0.9, ${ f( U.cuff ) }, highSocks || phan );
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
			let vee = L.z < nk.z - 0.03 && L.y > cy - 0.05 && abs( L.x ) < 0.022 * clamp( ( L.y - cy + 0.05 ) / 0.045, 0.0, 1.0 );
			// ---- FY3: the underside of a jutting chin is skin (the ring round the neck took it for the jersey and
			// the undershirt's collar: a white and red crescent under every jaw in the close-ups); the
			// undershirt's collar rides up the neck, a crew neck's 1.2 cm for most, a mock turtleneck's 4 cm for
			// some (Balfour's navy mock: Getty 83485159)
			let chinU = L.z < nk.z - 0.075 && L.y > cy + 0.02;
			// (the umpires' jackets close round the neck in a collar: Getty 83485455)
			let mock = select( select( 0.012, 0.038, fract( seed * 17.3 ) < 0.3 && ! crew && ! jacket && ! phan ), 0.03, ump );
			if ( L.y > nk.y + 0.03 || chinU || ( L.y > cy + mock && r < 0.1 ) ) { part = ${ P.skin }; skinArea = 1; }
			// ---- end FY3
			else if ( ( L.y > cy - 0.011 && r < 0.11 ) || vee ) { part = select( ${ P.sleeve }, ${ P.jersey }, jacket ); }
			else if ( L.y > ${ f( U.belt[ 1 ] ) } ) { part = ${ P.jersey }; }
			else if ( L.y > ${ f( U.belt[ 0 ] ) } ) { part = ${ P.belt }; }
			else { part = ${ P.pants }; }
			// a jacket's collar rides up the neck a little further
			if ( jacket && part == ${ P.skin } && L.y < nk.y + 0.005 && L.z > nk.z - 0.06 ) { part = ${ P.jersey }; cuffKnit = true; }
			// ---- FR1: a jacket comes down past the belt to its knit hem at the hip (it stopped at the belt)
			if ( jacket && L.y > ${ f( U.belt[ 0 ] - 0.075 ) } && ( part == ${ P.belt } || part == ${ P.pants } ) ) { part = ${ P.jersey }; cuffKnit = L.y < ${ f( U.belt[ 0 ] - 0.047 ) }; }
			// ---- end FR1
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
	// ---- FY2 (CY-6): both 2008 jerseys button down the front: the placket's edge from the collar's V to
	// the belt, the buttons down it, and on the Rays' greys navy piping down it and round the sleeves'
	// ends (FOX's close-up of Balfour); the cloth's folds (a shade in the hollows of its drape)
	if ( part == ${ P.jersey } && ! jacket && ! tee && ! phan && ! ump && ! crew ) {
		if ( arm < -0.5 && L.z < -0.04 && L.y < 1.53 && L.y > ${ f( U.belt[ 1 ] ) } ) {
			if ( abs( L.x - 0.013 ) < 0.0022 ) { c = c * 0.7; }
			if ( ! home && abs( abs( L.x ) - 0.017 ) < 0.0028 ) { c = trim; }
			let by = fract( ( L.y - ${ f( U.belt[ 1 ] ) } - 0.04 ) / 0.072 );
			if ( length( vec2f( L.x, ( by - 0.5 ) * 0.072 ) ) < 0.0048 ) { c = select( vec3f( 0.55, 0.56, 0.6 ), vec3f( 0.86, 0.85, 0.82 ), home ); rough = 0.3; }
		}
		if ( ! home && arm > ${ f( U.sleeve - 0.014 ) } ) { c = trim; }
	}
	// ---- FY3: the Rays' road pants piped in navy down the outer seam (Getty 83485159, Balfour)
	if ( part == ${ P.pants } && kind == ${ KIND.away } && ! jacket && leg > -0.5 ) {
		let sa = atan2( Nb.z, Nb.x * sign( L.x ) );
		let fsa = max( fwidth( sa ), 1e-4 );
		c = mix( c, trim, clamp( ( 0.05 - abs( sa ) ) / fsa + 0.5, 0.0, 1.0 ) );
	}
	// ---- end FY3
	if ( ( part == ${ P.jersey } || part == ${ P.pants } ) && ! jacket && ! phan ) {
		let fold = mx_noise_float3( vec3f( L.x * 26.0, L.y * 5.0, L.z * 26.0 ) + seed * 3.0 );
		var zone = select( 0.25 + 0.75 * smoothstep( 1.4, 1.12, L.y ), 0.75, part == ${ P.pants } );
		if ( arm > -0.5 ) { zone = 0.5; }
		c = c * ( 1.0 - 0.14 * zone * smoothstep( 0.15, 0.75, fold ) );
	}
	// ---- end FY2
	// ---- FB2 (C2B-15): the umpires' October jacket: black with a powder-blue stripe on each side from the
	// collar over the shoulder down to the armpit, front and back, along the raglan seam (FOX t13820s,
	// umpire 8 from behind; Getty 83485455 and 84081866, the plate umpire from in front)
	if ( ump && part == ${ P.jersey } && arm < -0.5 && L.y > 1.3 ) {
		let q = vec2f( abs( L.x ), L.y ) - vec2f( 0.072, 1.61 );
		let e = vec2f( 0.205, 1.36 ) - vec2f( 0.072, 1.61 );
		let tt = clamp( dot( q, e ) / dot( e, e ), 0.0, 1.0 );
		let dl = length( q - e * tt );
		let fwq = max( fwidth( dl ), 1e-4 );
		c = mix( c, vec3f( 0.26, 0.45, 0.7 ), clamp( ( 0.018 - dl ) / fwq + 0.5, 0.0, 1.0 ) );
	}
	// ---- end FB2
	// ---- R (rituals): the grey champions tee: heather cotton, its short sleeves over the red undershirt's,
	// the print on the chest (the P in its red roundel over WORLD SERIES CHAMPIONS 2008); nothing on the back
	if ( tee && part == ${ P.jersey } && ! jacket ) {
		c = vec3f( 0.23, 0.23, 0.24 ) * ( 0.9 + 0.2 * fract( sin( dot( floor( L.xy * 400.0 ), vec2f( 12.9, 78.2 ) ) ) * 43758.5 ) );
		rough = 0.95;
		if ( arm < -0.5 && Nb.z < -0.05 ) {
			let q = vec2f( L.x, L.y - 1.3 );
			let r = length( q );
			if ( r < 0.072 ) {
				c = vec3f( 0.42, 0.02, 0.035 );
				let pq = q / 0.06;
				// (FR1: the P the right way round as you face him: his own +x is your left; it read as a 9)
				let stem = abs( pq.x - 0.2 ) < 0.14 && abs( pq.y ) < 0.7;
				let bowl = abs( length( ( pq - vec2f( - 0.05, 0.3 ) ) * vec2f( 1.0, 1.3 ) ) - 0.32 ) < 0.12 && pq.x < 0.2;
				if ( stem || bowl || r > 0.064 ) { c = vec3f( 0.8, 0.79, 0.76 ); }
			}
			if ( abs( L.x ) < 0.11 && abs( L.y - 1.195 ) < 0.02 ) { c = vec3f( 0.02, 0.04, 0.16 ); }
			if ( abs( L.x ) < 0.13 && abs( L.y - 1.15 ) < 0.018 ) { c = vec3f( 0.45, 0.03, 0.04 ); }
		}
	}
	// ---- end R
	if ( part == ${ P.jersey } && jacket ) {
		// the jacket: nylon with a sheen, a knit collar and cuffs, the zip down the front
		c = jacketC; rough = 0.45;
		// ---- FR1: the 2008 dugout jacket's piping (Getty 83483743, Manuel at the cage: the royal-blue band
		// in the knit collar, the blue panel down the underside of the sleeve; 83570999: on down his side
		// from the armpit to the hem): the Phillies' royal blue on the red, the Rays' Columbia blue on navy
		let pipe = select( vec3f( 0.27, 0.5, 0.79 ), vec3f( 0.03, 0.06, 0.4 ), home );
		if ( arm > -0.5 && arm < ${ f( U.wrist - 0.04 ) } ) {
			let sd = sign( L.x );
			let ax = normalize( vec3f( sd * ${ f( J.wristR[ 0 ] - J.shoulderR[ 0 ] ) }, ${ f( J.wristR[ 1 ] - J.shoulderR[ 1 ] ) }, ${ f( J.wristR[ 2 ] - J.shoulderR[ 2 ] ) } ) );
			let under = normalize( vec3f( 0.0, -1.0, 0.0 ) + ax * ax.y );
			let u = dot( Nb, under );
			let fu = max( fwidth( u ), 1e-4 );
			c = mix( c, pipe, clamp( ( u - 0.8 ) / fu + 0.5, 0.0, 1.0 ) * smoothstep( 0.05, 0.1, arm ) );
		}
		if ( arm < -0.5 && L.y < 1.37 && ! cuffKnit ) {
			let sang = abs( abs( atan2( L.x, - L.z ) ) - 1.5708 );
			let fs = max( fwidth( sang ), 1e-4 );
			c = mix( c, pipe, clamp( ( 0.12 - sang ) / fs + 0.5, 0.0, 1.0 ) );
		}
		if ( cuffKnit ) { c = jacketC * 0.7; rough = 0.9; }
		if ( cuffKnit && arm < -0.5 && L.y > 1.4 ) { c = mix( pipe, jacketC * 0.7, smoothstep( ${ f( J.neck[ 1 ] - 0.012 ) }, ${ f( J.neck[ 1 ] + 0.002 ) }, L.y ) ); }
		if ( arm < -0.5 && abs( L.x ) < 0.005 && L.z < 0.0 && L.y > ${ f( U.belt[ 0 ] - 0.047 ) } ) { c = vec3f( 0.25, 0.25, 0.26 ); rough = 0.3; }
		// ---- end FR1
	}
	// the Phanatic: fur everywhere but his jersey (riding up over the belly) and his socks
	if ( phan && part == ${ P.jersey } && ( L.y < 1.24 && arm < -0.5 ) ) { part = ${ P.hair }; }
	if ( phan && ( part == ${ P.pants } || part == ${ P.belt } || part == ${ P.sleeve } || part == ${ P.skin } ) ) { part = ${ P.hair }; }
	// ---- FY2 (the Phanatic): the costume's body is his jersey down to its hem (the home pinstripes, the
	// red trim round the collar) and the shag below it; the jersey's loose sleeves reach to above his
	// elbows, then it's fur to the mitts
	// (in the rain, the slicker instead of the jersey: below)
	let phShirt = part == ${ P.phBody } && L.y > ${ f( PHAN.hem - 0.016 ) } && ( role & ${ R.slicker }u ) == 0u;
	if ( phan && arm > -0.5 ) { part = select( ${ P.hair }, ${ P.jersey }, arm < 0.25 ); }
	if ( part == ${ P.phBody } ) { part = select( ${ P.hair }, ${ P.jersey }, phShirt ); }
	if ( phan && part == ${ P.jersey } ) {
		let ar = select( atan2( L.x, - L.z ) * 0.33, around, arm > -0.5 );
		let u = ar / 0.025;
		let fw = max( fwidth( u ), 1e-4 );
		let d = abs( fract( u ) - 0.5 );
		let cover = clamp( ( 0.03 - d ) / fw + 0.5, 0.0, 1.0 );
		c = mix( cloth, vec3f( 0.43, 0.02, 0.04 ), mix( cover, 0.06, smoothstep( 0.25, 0.8, fw ) ) * 0.8 );
		if ( ( phShirt && L.y > 1.545 ) || ( arm > 0.226 && arm < 0.25 ) ) { c = trim; }
		rough = 0.8;
		clothy = true;
	}
	// ---- end FY2

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
			lu = 0.5 - L.x / ${ f( CHEST[ 0 ] ) }; lv = 1.0 - ( L.y - ${ f( CHEST[ 2 ] ) } ) / ${ f( CHEST[ 1 ] ) };
		}
	}
	if ( part == ${ P.jersey } && arm > -0.5 && L.x > 0.0 && Nb.x > 0.3 && ! jacket ) {
		cell = ${ C.patch }.0; lu = 0.5 - ( L.z - ${ f( J.shoulderR[ 2 ] ) } ) / 0.085; lv = ( arm - 0.05 ) / 0.085;
	}
	// ---- FY3: the Rays' manta on the left sleeve (Getty 83485159, Balfour)
	if ( part == ${ P.jersey } && arm > -0.5 && L.x < 0.0 && Nb.x < -0.3 && ! jacket && kind == ${ KIND.away } ) {
		cell = ${ C.ray }.0; lu = 0.5 + ( L.z - ${ f( J.shoulderR[ 2 ] ) } ) / 0.1; lv = ( arm - 0.045 ) / 0.1;
	}
	// ---- end FY3
	let billPart = abs( in.vs.vField.x + 3.0 ) < 0.5;
	if ( ( part == ${ P.cap } || part == ${ P.helmet } ) && Nb.z < -0.35 && ! billPart ) {
		cell = select( ${ C.capAway }.0, ${ C.capHome }.0, home || crew ); lu = 0.5 - L.x / 0.09; lv = 0.5 - ( L.y - ${ f( F.top[ 1 ] - 0.062 ) } ) / 0.09;
		// ---- FR1: the black champions cap's round emblem, not the plain P
		if ( ( role & ${ R.champCap }u ) != 0u && part == ${ P.cap } ) { cell = ${ C.capChamp }.0; }
		// ---- end FR1
	}
	if ( ( part == ${ P.cap } || part == ${ P.helmet } ) && Nb.z > 0.5 && Nb.y < 0.75 ) {
		// the batterman at the back
		cell = ${ C.mlb }.0; lu = 0.5 + L.x / 0.036; lv = 0.5 - ( L.y - ${ f( F.top[ 1 ] - 0.07 ) } ) / 0.04;
	}
	// ---- FY3 (CY-18): the 2008 World Series logo on the cap's left side, as both clubs wore it in the
	// Series (Getty 83485858, Lidge at the last out; 83485159, Balfour)
	if ( part == ${ P.cap } && ! billPart && ( role & ${ R.champCap | R.navyCap }u ) == 0u && Nb.x < -0.5 && abs( Nb.y ) < 0.6 ) {
		cell = ${ C.patch }.0; lu = 0.5 + ( L.z + 0.044 ) / 0.044; lv = 0.5 - ( L.y - ${ f( F.top[ 1 ] - 0.052 ) } ) / 0.044;
	}
	// ---- end FY3
	if ( ( ump || crew ) && part != ${ P.cap } ) { cell = -1.0; }
	// ---- FB4 (C4B-4): the grounds crew's red hoodies carry the club's script on the chest, as the players'
	// pullovers do (Getty 84081825: the 27th's crew in red hoodies, the white Phillies script, blue piping)
	if ( crew && part == ${ P.jersey } && arm < -0.5 && Nb.z < -0.05 ) { cell = ${ C.jacketHome }.0; }
	// ---- end FB4
	// ---- R (rituals): the champions tee has its own print (above), not the jersey's
	if ( tee && part == ${ P.jersey } && ! jacket ) { cell = -1.0; }
	// ---- end R
	if ( ump && part == ${ P.cap } ) { cell = -1.0; }
	// ---- FY2 (the Phanatic): on the costume's jersey, the script across his chest above the belly, and
	// PHANATIC over the star (or the little one's name and number) across his back
	if ( phShirt ) {
		cell = -1.0;
		if ( Nb.z < -0.25 && L.y > 1.12 && L.y < 1.46 ) { cell = ${ C.chestHome }.0; lu = 0.5 - L.x / 0.54; lv = 1.0 - ( L.y - 1.13 ) / 0.32; }
		if ( Nb.z > 0.25 && L.y > 0.98 ) { cell = in.vs.vSlot; lu = 0.5 + L.x / 0.5; lv = 1.0 - ( L.y - 0.99 ) / 0.5; }
	}
	// ---- end FY2
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
			// ---- FY3 (CY-18, C3B-10): the face as the close-ups show it (Getty 83483794, Feliz under his
			// bill; 83484235, Upton; 83485858, Lidge's goatee; FOX's walk-ups). Everything here is soft-edged,
			// in the face's own frame: FY2's boxes cut the beards out as flat brown rectangles with ruler-straight
			// sides, the stubble's top edge and the face's back edge (isFace) drew a line across and down the
			// cheeks, the goatee's box ran on down the throat (the throat is at the chin's height) and the jaw's
			// underside was a hard black band. Now: the beard's density is a soft mask per style, its edges
			// broken by a noise and its colour grained hair by hair, thinning into the stubble's shadow; the
			// throat kept out (the chin juts past it); the brows thick and arched, tapering to the tail; the
			// lids' lash line and crease; the lips, the ears and the nose a little redder; short hair at the
			// temples and the sideburns under the cap (they were bald); the bill's shadow from the brow down
			let ax = abs( L.x );
			let eye = ${ v3( F.eyeR ) };
			let m = vec3f( 0.0, ${ f( F.mouth[ 1 ] ) }, ${ f( F.mouth[ 2 ] ) } );
			let jawY = ${ f( F.jaw[ 1 ] ) };
			// how far this is the face (soft, so there's no seam down the cheek), and the face and the temples
			let fw = smoothstep( eye.z + 0.075, eye.z + 0.025, L.z );
			let fw2 = smoothstep( eye.z + 0.13, eye.z + 0.06, L.z );
			// grains: a hair's (a millimetre), and a coarser one that breaks the edges of the beard and the hair
			// (faded to their mean once a hair is under a pixel, so the far faces don't sparkle)
			let px = length( fwidth( L ) );
			let g1 = mix( 0.5, mx_noise_float3( L * vec3f( 950.0, 380.0, 950.0 ) + seed * 5.0 ) * 0.5 + 0.5, 1.0 - smoothstep( 0.0006, 0.0018, px ) );
			let g2 = mx_noise_float3( L * 190.0 + seed * 3.0 ) * ( 1.0 - smoothstep( 0.003, 0.008, px ) );
			let earK = smoothstep( 0.062, 0.068, ax ) * smoothstep( eye.y - 0.062, eye.y - 0.054, L.y ) * ( 1.0 - smoothstep( eye.y + 0.008, eye.y + 0.016, L.y ) ) * smoothstep( eye.z + 0.055, eye.z + 0.065, L.z ) * ( 1.0 - smoothstep( eye.z + 0.125, eye.z + 0.135, L.z ) );
			// the skin's colour: the cheeks, the nose's tip and the ears a little redder, the brow a shade paler
			let nose = ( 1.0 - smoothstep( 0.008, 0.018, ax ) ) * smoothstep( m.y + 0.012, m.y + 0.026, L.y ) * ( 1.0 - smoothstep( eye.y - 0.03, eye.y - 0.012, L.y ) );
			let cheek = ( 1.0 - smoothstep( 0.0, 0.02, abs( ax - 0.044 ) ) ) * ( 1.0 - smoothstep( 0.0, 0.026, abs( L.y - ( m.y + 0.032 ) ) ) );
			c = mix( c, c * vec3f( 1.08, 0.86, 0.84 ), clamp( cheek * 0.45 + nose * 0.35 + earK * 0.4, 0.0, 1.0 ) );
			c = c * mix( 1.0, 1.05, smoothstep( eye.y + 0.02, eye.y + 0.05, L.y ) * fw );
			// a little oil on the brow and down the nose (Upton's face, Getty 83484235)
			rough = mix( rough, 0.42, clamp( nose + smoothstep( eye.y + 0.025, eye.y + 0.045, L.y ) * ( 1.0 - smoothstep( 0.03, 0.06, ax ) ) * fw, 0.0, 1.0 ) * ( 1.0 - soak ) );
			// FY2's mottling: pores, colour, a day's sun and wind
			c = c * ( 0.94 + 0.08 * ( mx_noise_float3( L * 140.0 + seed ) * 0.5 + 0.5 ) ) * mix( vec3f( 1.0 ), vec3f( 1.04, 0.97, 0.96 ), smoothstep( 0.3, 0.8, mx_noise_float3( L * 30.0 ) ) );
			// the hair: the back and the sides of the head under the cap, the sideburns in front of the ears
			// (cropped short: the scalp shows through the grain), greying at the temples with age
			let hairBack = max( max( smoothstep( eye.y + 0.022, eye.y + 0.032, L.y ) * smoothstep( eye.z + 0.038, eye.z + 0.052, L.z ),
				smoothstep( eye.y - 0.068, eye.y - 0.054, L.y ) * smoothstep( eye.z + 0.098, eye.z + 0.112, L.z ) ), smoothstep( eye.y + 0.055, eye.y + 0.065, L.y ) * smoothstep( eye.z + 0.035, eye.z + 0.06, L.z ) );
			let burn = 0.8 * smoothstep( 0.05, 0.062, ax ) * smoothstep( eye.z + 0.028, eye.z + 0.052, L.z ) * smoothstep( eye.y - 0.04, eye.y - 0.012, L.y );
			let hairK = clamp( max( hairBack, burn ) * ( 1.0 - earK ) * ( 0.95 + 0.25 * g2 ), 0.0, 1.0 );
			if ( hairK > 0.0 ) {
				let temple = smoothstep( 0.05, 0.075, ax ) * smoothstep( eye.z + 0.13, eye.z + 0.06, L.z ) * age;
				let hc = mix( hairC, vec3f( 0.42, 0.41, 0.4 ), temple * 0.7 ) * ( 0.7 + 0.6 * g1 );
				c = mix( c, mix( skinC * 0.45, hc, 0.72 + 0.28 * g1 ), hairK );
				rough = mix( rough, 0.75, hairK );
			}
			// the eyes: the sockets in shade under the brow, the lash line along the upper lid and the lid's
			// crease above it, a little shadow under the lower lid
			let es = length( vec2f( ax - abs( eye.x ), ( L.y - eye.y ) * 1.4 ) );
			let up = smoothstep( eye.y - 0.004, eye.y + 0.002, L.y );
			c = c * mix( 1.0, mix( 0.72, 1.0, smoothstep( 0.012, 0.03, es ) ), fw );
			c = c * ( 1.0 - fw * ( 0.6 * up * ( 1.0 - smoothstep( 0.019, 0.0235, es ) ) + 0.25 * up * smoothstep( 0.024, 0.027, es ) * ( 1.0 - smoothstep( 0.028, 0.032, es ) ) + 0.15 * ( 1.0 - up ) * ( 1.0 - smoothstep( 0.019, 0.024, es ) ) ) );
			// the brows: thick over the eye, arched, thinning to the tail, hair by hair
			let by = eye.y + 0.021 + 0.004 * ( 1.0 - smoothstep( 0.012, 0.05, ax ) ) - 0.005 * smoothstep( 0.03, 0.058, ax );
			let th = mix( 0.0062, 0.0026, smoothstep( 0.02, 0.056, ax ) );
			let brow = ( 1.0 - smoothstep( th * 0.45, th, abs( L.y - by + 0.0015 * g2 ) ) ) * smoothstep( 0.007, 0.013, ax ) * ( 1.0 - smoothstep( 0.052, 0.06, ax ) ) * fw;
			c = mix( c, hairC * ( 0.65 + 0.5 * g1 ), brow * ( 0.6 + 0.35 * g1 ) );
			// the lips: their colour, the line between them, the shadow under the nose and under the lower lip
			let lq = length( vec2f( L.x / 0.025, ( L.y - m.y ) / 0.0085 ) );
			let lip = ( 1.0 - smoothstep( 0.7, 1.05, lq ) ) * fw;
			c = mix( c, c * vec3f( 0.86, 0.6, 0.58 ), lip * 0.8 );
			rough = mix( rough, 0.4, lip );
			c = c * ( 1.0 - 0.35 * fw * smoothstep( 0.0026, 0.0008, abs( L.y - m.y + 0.001 ) ) * ( 1.0 - smoothstep( 0.018, 0.026, ax ) ) );
			c = c * ( 1.0 - 0.2 * fw * ( 1.0 - smoothstep( 0.012, 0.022, ax ) ) * smoothstep( m.y + 0.009, m.y + 0.013, L.y ) * ( 1.0 - smoothstep( m.y + 0.02, m.y + 0.026, L.y ) ) );
			c = c * ( 1.0 - 0.14 * fw * ( 1.0 - smoothstep( 0.018, 0.026, ax ) ) * smoothstep( m.y - 0.018, m.y - 0.014, L.y ) * ( 1.0 - smoothstep( m.y - 0.01, m.y - 0.006, L.y ) ) );
			// the beard: how dense the hair is at this point, by style. The masks: the moustache over the
			// upper lip, the goatee on the chin (down to its underside, in front of the throat), the corners
			// joining them round the mouth, a full short beard up the cheeks to the sideburns and under the
			// jaw, a chin strap along the jaw's edge; the lips stay clear
			let beardK = face & 7u;
			let lipsOut = smoothstep( 0.92, 1.2, lq );
			let front = smoothstep( -0.058, -0.082, L.z );
			let jl = jawY - 0.008 + 0.034 * smoothstep( 0.02, 0.07, ax ); // the jaw's edge, rising to the ear
			let mx2 = ( ax / 0.028 ) * ( ax / 0.028 );
			let mous = smoothstep( m.y + 0.003 + 0.004 * mx2, m.y + 0.008 + 0.004 * mx2, L.y ) * ( 1.0 - smoothstep( m.y + 0.016 - 0.007 * mx2, m.y + 0.022 - 0.007 * mx2, L.y ) ) * ( 1.0 - smoothstep( 0.02, 0.031, ax ) ) * lipsOut * fw;
			let chinM = ( 1.0 - smoothstep( 0.012, 0.032, ax ) * 0.85 ) * ( 1.0 - smoothstep( 0.024, 0.034, ax ) ) * ( 1.0 - smoothstep( m.y - 0.016, m.y - 0.009, L.y ) ) * smoothstep( jawY - 0.018, jawY - 0.006, L.y ) * front * lipsOut;
			let corner = 0.62 * smoothstep( 0.017, 0.022, ax ) * ( 1.0 - smoothstep( 0.027, 0.033, ax ) ) * smoothstep( m.y - 0.028, m.y - 0.018, L.y ) * ( 1.0 - smoothstep( m.y + 0.006, m.y + 0.012, L.y ) ) * lipsOut * fw;
			let yTop = mix( m.y + 0.016, eye.y - 0.034, smoothstep( 0.022, 0.064, ax ) ) + 0.004 * g2;
			let cheekTop = 1.0 - smoothstep( yTop - 0.012, yTop + 0.004, L.y );
			// (under the jaw only where the chin juts forward, not down the throat)
			let fullM = cheekTop * ( 1.0 - smoothstep( eye.z + 0.07, eye.z + 0.085, L.z ) ) * smoothstep( jl - 0.024, jl - 0.01, L.y ) * max( smoothstep( jl - 0.008, jl + 0.004, L.y ), smoothstep( -0.05, -0.075, L.z ) ) * lipsOut * ( 1.0 - nose );
			let strap = ( 1.0 - smoothstep( 0.009, 0.017, abs( L.y - jl - 0.004 ) ) ) * ( 1.0 - smoothstep( eye.z + 0.07, eye.z + 0.085, L.z ) ) * max( front, smoothstep( 0.015, 0.03, ax ) );
			var bd = 0.0;
			if ( beardK == 3u ) { bd = chinM; }
			if ( beardK == 4u ) { bd = max( max( chinM, mous ), corner ); }
			if ( beardK == 5u ) { bd = max( fullM, mous ); }
			if ( beardK == 6u ) { bd = mous; }
			if ( beardK == 7u ) { bd = max( max( strap, mous ), chinM ); }
			// the stubble: the beard's whole ground in shade, and the dots of the hairs where it's heavy
			let stubZone = max( fullM, max( mous, chinM ) ) * fw;
			let stub = stubble * select( 0.45, 0.85, beardK == 2u );
			c = mix( c, c * mix( vec3f( 0.74, 0.72, 0.75 ), min( hairC / max( skinC, vec3f( 0.01 ) ), vec3f( 1.0 ) ), 0.15 ), stub * stubZone );
			c = mix( c, hairC, stub * stubZone * 0.5 * smoothstep( 0.55, 0.8, g1 ) );
			// the beard itself: its edge broken, the hairs grained, the skin under it showing at its thin edge
			let bk = smoothstep( 0.3, 0.75, bd + 0.22 * g2 );
			if ( bk > 0.0 ) {
				c = mix( c, hairC * 0.9 * ( 0.55 + 0.75 * g1 ), bk * ( 0.78 + 0.2 * g1 ) );
				rough = mix( rough, 0.82, bk );
			}
			// eye black: a greasy smudge on each cheekbone (FY2: a smudge, not a bar)
			let ebk = length( vec2f( ( ax - 0.032 ) / 0.017, ( L.y - eye.y + 0.022 ) / 0.0085 ) );
			if ( ( face & 8u ) != 0u && ebk < 1.0 ) { c = mix( c, vec3f( 0.012 ), smoothstep( 1.0, 0.55, ebk ) * fw ); rough = 0.35; }
			// age: the lines round the eyes and down from the nose
			if ( age > 0.5 ) {
				let crow = smoothstep( 0.05, 0.054, ax ) * ( 1.0 - smoothstep( 0.061, 0.065, ax ) ) * ( 1.0 - smoothstep( 0.008, 0.013, abs( L.y - eye.y ) ) ) * smoothstep( 0.2, 0.0, abs( fract( L.y * 260.0 ) - 0.2 ) );
				c = c * ( 1.0 - 0.15 * crow * fw );
			}
			// under the cap's bill (or the helmet's) its shadow from the brow down over the eyes, the strongest
			// thing on a ballplayer's face under the banks (FY2; FOX's close-up of Burrell, Getty 83485455),
			// soft round the temples
			if ( ( role & ${ R.nocap }u ) == 0u ) { c = c * mix( 1.0, 0.62, smoothstep( eye.y - 0.075, eye.y + 0.025, L.y ) * fw2 ); }
			// the jaw's underside in shade
			c = c * ( 1.0 - 0.24 * smoothstep( -0.2, -0.65, Nb.y ) * ( 1.0 - smoothstep( jawY, jawY + 0.025, L.y ) ) );
			// hair doesn't carry the skin's light under it (the wrap lit the goatees orange)
			let skinK = 1.0 - 0.9 * clamp( max( bk, hairK ), 0.0, 1.0 );
			s.translucency = s.translucency * skinK;
			s.emissive = s.emissive * skinK;
			// ---- end FY3
			// ---- FF3: the mouth's inside, which the open jaw shows (Lidge's shout, Getty 83485858): the lips'
			// inner faces wet and red where they curl in, then dark; the upper teeth a band under the upper lip,
			// the lower ones over the lower lip, the tongue's back dark red below (the bag the base mesh's lips
			// curl into stands for it all; it's hidden while the mouth is shut)
			if ( mouthIn > 0.0 ) {
				let dz = L.z - ${ f( F.mouth[ 2 ] ) };
				let dy = L.y - m.y;
				let deep = smoothstep( 0.002, 0.012, dz );
				var mc = mix( skinC * vec3f( 0.62, 0.3, 0.28 ), vec3f( 0.018, 0.005, 0.005 ), deep );
				let upT = smoothstep( 0.0005, 0.002, dy ) * ( 1.0 - smoothstep( 0.0055, 0.0075, dy ) );
				let loT = smoothstep( -0.0005, -0.002, dy ) * ( 1.0 - smoothstep( -0.0045, -0.006, dy ) ) * 0.7;
				let teeth = max( upT, loT ) * smoothstep( 0.0015, 0.004, dz ) * ( 1.0 - smoothstep( 0.009, 0.013, dz ) ) * ( 1.0 - smoothstep( 0.016, 0.022, ax ) );
				mc = mix( mc, vec3f( 0.5, 0.47, 0.4 ) * ( 0.75 + 0.25 * smoothstep( 0.015, 0.0, ax ) ), teeth );
				mc = mix( mc, vec3f( 0.09, 0.02, 0.02 ), smoothstep( -0.004, -0.009, dy ) * deep * ( 1.0 - teeth ) );
				// (only as far as the mouth is open, and well inside the mark: shut, the lips' line took the
				// mark's soft edge, a pale rim between dark outlines on every closed mouth)
				let openW = f32( u32( in.vs.vInfo.y + 0.5 ) & 255u ) / 255.0;
				let mk = smoothstep( 0.55, 0.95, mouthIn ) * smoothstep( 0.02, 0.15, openW );
				c = mix( c, mc, mk );
				rough = mix( rough, mix( 0.3, 0.45, teeth ), mk );
				s.translucency = s.translucency * ( 1.0 - mk );
				s.emissive = s.emissive * ( 1.0 - mk );
			}
			// ---- end FF3
		}
	}
	if ( band ) { c = select( select( vec3f( 0.8, 0.79, 0.76 ), trim, ( style & 32u ) != 0u ), trim, home ); rough = 0.95; clothy = true; }
	if ( part == ${ P.eye } ) {
		// the eyeball: white, a dark iris and pupil looking ahead
		let side = sign( L.x );
		let ec = vec3f( side * ${ f( F.eyeR[ 0 ] ) }, ${ f( F.eyeR[ 1 ] ) }, ${ f( F.eyeR[ 2 ] ) } );
		let d = normalize( L - ec );
		c = vec3f( 0.62, 0.6, 0.56 ); rough = 0.08;
		// (FY3: blue or grey-green eyes for some of the fair-skinned men, by seed; brown for the rest)
		let iris = select( vec3f( 0.06, 0.035, 0.02 ), select( vec3f( 0.07, 0.1, 0.14 ), vec3f( 0.08, 0.09, 0.06 ), fract( seed * 53.1 ) < 0.15 ), skinC.r > 0.45 && fract( seed * 31.7 ) < 0.45 );
		if ( d.z < -0.93 ) { c = iris * ( 0.8 + 0.4 * smoothstep( -0.93, -0.975, d.z ) ); }
		if ( d.z < -0.985 ) { c = vec3f( 0.005 ); }
	}
	if ( part == ${ P.helmet } || part == ${ P.flapL } || part == ${ P.flapR } || part == ${ P.ccap } ) {
		// the batting helmet: a glossy shell, scuffed; now and then a smear of pine tar on the crown
		c = capC * 1.05; rough = 0.12;
		// ---- FY3: the ear's hole in the flap (Rig.js: the flap is the shell carried down over the ear)
		if ( part == ${ P.flapL } || part == ${ P.flapR } ) {
			let eh = length( vec2f( ( L.y - ${ f( F.eyeR[ 1 ] - 0.024 ) } ) / 1.25, L.z - ${ f( F.eyeR[ 2 ] + 0.093 ) } ) );
			c = mix( c, vec3f( 0.004 ), 1.0 - smoothstep( 0.0105, 0.0135, eh ) );
		}
		// ---- end FY3
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
	if ( part == ${ P.hood } ) { c = cloth * 1.1; rough = select( 0.25, 0.8, crew ); } // (---- FB4, C4B-4: the crew's a soft cotton hood, not a helmet's gloss)
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
	// ---- FY3: the crown's six panels, their seams running up to the button (from the high cameras the
	// crown was one smooth shell)
	if ( part == ${ P.cap } && abs( in.vs.vField.x + 3.0 ) > 0.5 && L.y > ${ f( F.top[ 1 ] - 0.08 ) } ) {
		let az = atan2( L.x, -( L.z + 0.04 ) ) / 1.0472;
		let sd = abs( fract( az + 0.5 ) - 0.5 );
		let fsd = max( fwidth( az ), 1e-4 );
		c = c * ( 1.0 - 0.35 * clamp( ( 0.025 - sd ) / fsd + 0.5, 0.0, 1.0 ) * smoothstep( ${ f( F.top[ 1 ] - 0.08 ) }, ${ f( F.top[ 1 ] - 0.06 ) }, L.y ) );
	}
	// ---- end FY3
	// (FY2, CY-18) under the bill, the undervisor's dark grey-green
	if ( part == ${ P.cap } && billPart && Nb.y < -0.3 ) { c = vec3f( 0.03, 0.045, 0.035 ); rough = 0.85; }
	if ( part == ${ P.belt } ) { c = beltC; rough = 0.4; }
	if ( part == ${ P.shoes } ) {
		// ---- FY3: 2008's cleats (Getty 83485858, Lidge's red Nikes with the white swoosh; 83485159,
		// Balfour's black Reeboks with the white stripe), not slippers with a painted band: the upper black,
		// or the Phillies' red for some of them; a stripe sweeping up from the toe box to the heel on both
		// sides, thickest mid-foot (red on a Phillie's black, white on a Ray's and on the red ones); the laces
		// down the instep; a pale midsole line over the black sole plate. The crew in work boots, the
		// Phanatic in big white sneakers (below)
		let fy = L.y;
		let fx = L.x - sign( L.x ) * ${ f( J.ankleR[ 0 ] ) };
		let fz = L.z - ${ f( J.ankleR[ 2 ] ) };
		let redShoe = home && fract( seed * 23.7 ) < 0.45;
		let upper = select( vec3f( 0.016 ), vec3f( 0.34, 0.014, 0.02 ), redShoe );
		let accent = select( select( vec3f( 0.8 ), vec3f( 0.5, 0.02, 0.03 ), home ), vec3f( 0.82, 0.81, 0.79 ), redShoe );
		c = upper; rough = 0.32;
		let yc = 0.024 + 0.03 * smoothstep( -0.15, 0.06, fz );
		let st = 0.0035 + 0.0065 * smoothstep( -0.17, -0.02, fz ) * ( 1.0 - smoothstep( 0.03, 0.075, fz ) );
		let fst = max( fwidth( fy ), 1e-4 );
		c = mix( c, accent, smoothstep( 0.35, 0.6, abs( Nb.x ) ) * clamp( ( st - abs( fy - yc ) ) / fst + 0.5, 0.0, 1.0 ) * smoothstep( -0.19, -0.16, fz ) * select( 1.0, 0.0, ump ) );
		let lace = ( 1.0 - smoothstep( 0.011, 0.015, abs( fx ) ) ) * smoothstep( 0.45, 0.65, Nb.y ) * smoothstep( -0.14, -0.12, fz ) * ( 1.0 - smoothstep( 0.0, 0.02, fz ) );
		c = mix( c, mix( upper * 1.8 + vec3f( 0.025 ), upper * 0.3, step( 0.62, fract( fz * 75.0 ) ) ), lace );
		c = mix( c, vec3f( 0.7, 0.69, 0.66 ), ( 1.0 - smoothstep( 0.0025, 0.0045, abs( fy - 0.016 ) ) ) * select( 0.6, 1.0, redShoe ) );
		if ( fy < 0.012 ) { c = vec3f( 0.025 ); rough = 0.6; }
		// ---- end FY3
		if ( crew ) { c = vec3f( 0.08, 0.05, 0.03 ); rough = 0.7; }
		if ( phan ) { c = select( vec3f( 0.82, 0.8, 0.76 ), vec3f( 0.42, 0.02, 0.03 ), abs( fy - 0.05 ) < 0.012 ); rough = 0.6; }
		// mud: the clay caked on the soles and the toes, darker and wetter in the rain
		let mud = smoothstep( 0.06, 0.0, fy ) * ( 0.55 + 0.45 * mx_noise_float3( L * 60.0 ) ) + smoothstep( -0.12, -0.2, L.z - ${ f( J.ankleR[ 2 ] ) } ) * 0.3;
		let mudK = clamp( mud * ( 0.5 + 0.8 * soak ), 0.0, 1.0 ) * select( 1.0, 0.3, phan );
		c = mix( c, mix( vec3f( 0.33, 0.17, 0.08 ), vec3f( 0.14, 0.07, 0.035 ), soak ), mudK );
	}
	if ( part == ${ P.glove } || part == ${ P.mittC } || part == ${ P.mitt1B } ) {
		// the leather: mostly black or a dark brown in 2008 (Ruiz's black mitt: Getty 84081866), now and then
		// a tan one; the lacing darker
		let g = fract( seed * 5.3 );
		c = select( select( vec3f( 0.015, 0.013, 0.012 ), vec3f( 0.075, 0.03, 0.012 ), g < 0.55 ), vec3f( 0.26, 0.12, 0.045 ), g < 0.18 ); rough = 0.45;
		// (FB2, C2B-19: the catchers' mitts: Ruiz's black, Navarro's a dark brown; never the tan pancake)
		if ( part == ${ P.mittC } ) { c = select( vec3f( 0.06, 0.026, 0.011 ), vec3f( 0.016, 0.014, 0.013 ), home ); }
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
	// ---- FY2 (the Phanatic): the costume as the October photos show it (pelfas' close-up of October 25;
	// Getty 83891040, 84082561). The shag: long strands hanging down him in clumps, a vivid yellow-leaning
	// kelly green, dark down at the roots between the clumps and light at the tips, with a sheen off the
	// outer strands so he holds his shape in the dim of the concourse; darker round his mouth. The snout's
	// lime velour, short and smooth; the open mouth dark, his tongue in it. The big white eyes with round
	// black pupils (looking in and down: he's a little cross-eyed) under heavy hot pink lids; the shock of
	// blue hair, a few tufts pink; the red cap on backwards.
	if ( phan && ( part == ${ P.hair } || part == ${ P.phNeck } || part == ${ P.phHead } || part == ${ P.phRing } ) ) {
		let clump = mx_noise_float3( L * vec3f( 24.0, 8.0, 24.0 ) + seed * 5.0 ) * 0.5 + 0.5;
		let strand = mx_noise_float3( L * vec3f( 190.0, 21.0, 190.0 ) ) * 0.5 + 0.5;
		let k = clamp( clump * 0.75 + strand * 0.65 - 0.2, 0.0, 1.0 );
		c = mix( vec3f( 0.02, 0.085, 0.007 ), vec3f( 0.2, 0.52, 0.035 ), k );
		if ( part == ${ P.phRing } ) { c = c * 0.72; }
		rough = 0.9;
		s.sheenColor = vec3f( 0.16, 0.36, 0.05 ) * ( 0.35 + 0.65 * k );
		s.sheenRoughness = 0.45;
		clothy = true;
	}
	if ( part == ${ P.snout } ) {
		let sd = ${ v3( [ 0, - Math.sin( PHAN.snout.tilt ), - Math.cos( PHAN.snout.tilt ) ] ) };
		let sq = L - ${ v3( PHAN.snout.base ) };
		let along = dot( sq, sd );
		c = vec3f( 0.3, 0.45, 0.045 ) * ( 0.92 + 0.14 * ( mx_noise_float3( L * 110.0 ) * 0.5 + 0.5 ) );
		rough = 0.75;
		s.sheenColor = vec3f( 0.3, 0.42, 0.08 ) * 0.7;
		s.sheenRoughness = 0.3;
		if ( along > ${ f( PHAN.snout.len - 0.03 ) } && length( sq - sd * along ) < 0.07 ) { c = vec3f( 0.045, 0.006, 0.008 ); rough = 0.6; s.sheenColor = vec3f( 0.0 ); }
		clothy = true;
	}
	if ( part == ${ P.phMouth } ) { c = vec3f( 0.42, 0.04, 0.07 ); rough = 0.45; }
	if ( part == ${ P.phEye } ) {
		let ec = vec3f( sign( L.x ) * ${ f( PHAN.eye[ 0 ] ) }, ${ f( PHAN.eye[ 1 ] ) }, ${ f( PHAN.eye[ 2 ] ) } );
		let d = normalize( ( L - ec ) / ${ v3( PHAN.eyeR ) } );
		c = vec3f( 0.8, 0.79, 0.75 ); rough = 0.22;
		if ( dot( d, normalize( vec3f( - sign( L.x ) * 0.2, -0.16, -1.0 ) ) ) > 0.935 ) { c = vec3f( 0.006 ); rough = 0.1; }
	}
	if ( part == ${ P.phLid } ) { c = vec3f( 0.56, 0.04, 0.22 ); rough = 0.8; s.sheenColor = vec3f( 0.3, 0.06, 0.15 ); s.sheenRoughness = 0.4; }
	if ( part == ${ P.phHair } ) {
		let strand = mx_noise_float3( L * vec3f( 160.0, 160.0, 160.0 ) ) * 0.5 + 0.5;
		c = select( vec3f( 0.025, 0.08, 0.5 ), vec3f( 0.55, 0.05, 0.28 ), hash31( floor( L * 30.0 ) ) > 0.86 ) * ( 0.55 + 0.7 * strand );
		rough = 0.85; s.sheenColor = c * 0.6; s.sheenRoughness = 0.4; clothy = true;
	}
	if ( part == ${ P.phCap } ) { c = trim * 1.05; rough = 0.7; clothy = true; }
	// ---- end FY2
	if ( pocketGloves ) { c = pal[ palm ]; rough = 0.55; }
	// the lettering and logos over the cloth
	if ( inCell ) { c = mix( c, ink.rgb, ink.a ); }
	// ---- A (Phanatic): how he really looked in 2008 (the October photos): the fur to just under the
	// knee, padded red leggings, a white sock bunched at the ankle, and the size-20 high-tops: green uppers
	// with orange laces and stripes, a red "P" roundel at the ankle, big cream rubber toes and soles.
	// In the rain on the 27th, the knee-length red vinyl slicker over it all. The ball girls who danced
	// with him in their pinstriped shorts: bare legs to white ankle socks and white sneakers.
	if ( phan && leg > 0.46 && part != ${ P.shoes } ) {
		if ( leg < 0.8 ) { c = vec3f( 0.36, 0.015, 0.022 ) * ( 0.85 + 0.15 * fract( L.y * 70.0 ) ); rough = 0.85; }
		else { c = vec3f( 0.78, 0.77, 0.74 ) * ( 0.8 + 0.2 * hash31( floor( L * 300.0 ) ) ); rough = 0.95; }
		clothy = true;
	}
	if ( phan && part == ${ P.shoes } ) {
		let ank = select( ${ v3( J.ankleL ) }, ${ v3( J.ankleR ) }, L.x > 0.0 );
		let fz = L.z - ank.z;
		c = vec3f( 0.035, 0.2, 0.04 ); rough = 0.6;
		if ( L.y < 0.035 || fz < - 0.17 ) { c = vec3f( 0.7, 0.62, 0.46 ); rough = 0.7; }
		else if ( Nb.y > 0.45 && abs( L.x - ank.x ) < 0.04 && fz < - 0.02 && fract( fz * 45.0 ) < 0.35 ) { c = vec3f( 0.8, 0.3, 0.02 ); }
		else if ( abs( Nb.x ) > 0.6 && abs( L.y - 0.06 ) < 0.012 ) { c = vec3f( 0.8, 0.3, 0.02 ); }
		else if ( abs( Nb.x ) > 0.7 && length( vec2f( fz - 0.01, L.y - 0.12 ) ) < 0.035 ) { c = select( vec3f( 0.42, 0.02, 0.03 ), vec3f( 0.8 ), length( vec2f( fz - 0.01, L.y - 0.12 ) ) < 0.018 ); }
	}
	if ( phan && ( role & ${ R.slicker }u ) != 0u ) {
		// ---- FY2: over the costume's body down to just above the shag's hem (it shows below), not the neck;
		// buttoned at the collar and hanging open below the chest, the fur showing between its fronts
		// (Getty 84081831, 83458678)
		let opening = abs( atan2( L.x, - L.z ) ) < 0.12 + 0.4 * smoothstep( 1.25, 0.75, L.y );
		let coat = ( part == ${ P.jersey } || part == ${ P.hair } || part == ${ P.skin } ) && ( ( arm > -0.5 && arm < ${ f( U.wrist - 0.03 ) } ) || ( part0 == ${ P.phBody } && L.y > ${ f( PHAN.skirt + 0.05 ) } && ! ( opening && L.y < 1.3 ) ) );
		if ( coat ) {
			// wet rubberised nylon (the rain beads on it), the wide collar a shade darker
			c = vec3f( 0.44, 0.02, 0.025 ); rough = 0.42; clothy = false; s.sheenColor = vec3f( 0.0 );
			if ( part0 == ${ P.phBody } && L.y > 1.45 ) { c = c * 0.8; }
			if ( hash31( floor( L * 500.0 ) ) > 0.93 ) { rough = 0.08; }
		}
	}
	if ( ( role & ${ R.shorts }u ) != 0u && leg > 0.2 && part != ${ P.shoes } ) {
		if ( leg < 0.8 ) { c = skinC; rough = mix( 0.55, 0.3, soak ); s.translucency = skinC * vec3f( 0.16, 0.07, 0.04 ); clothy = false; }
		else { c = vec3f( 0.8, 0.79, 0.76 ); rough = 0.9; clothy = true; }
	}
	if ( ( role & ${ R.shorts }u ) != 0u && part == ${ P.shoes } ) { c = select( vec3f( 0.8, 0.79, 0.77 ), vec3f( 0.5, 0.49, 0.47 ), L.y < 0.014 ); rough = 0.6; }
	// ---- end A

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
	// (---- FB4, C4B-4: the crew's hoodies soak through like cotton, darker with a dull sheen; they shone
	// like slickers, a glossy red dome for a head: C4B's T27-u11.3-crew)
	if ( crew && ( part == ${ P.jersey } || part == ${ P.hood } ) ) { rough = mix( rough, 0.5, soak ); c = c * mix( 1.0, 0.72, soak ); }
	// ---- FY3 (C3B-11, CY-6's "real fold normals"): the cloth's folds in the light, not only in its colour.
	// FOX's close-ups (Balfour from above, t11530s; Burrell, t12990s) and Getty's (83485159, 83485858)
	// show the jersey creased from the armpits down and across the back, soft rings down the sleeves,
	// long folds down the pants breaking over the shoe tops and behind the knee; the cloth was smooth rubber.
	// A height field of folds (a few millimetres) tilts the shading normal through the screen's
	// derivatives; faded out once a pixel covers more than a few millimetres of him (the far views)
	if ( clothy && ! phan && ( part == ${ P.jersey } || part == ${ P.pants } || part == ${ P.sleeve } ) ) {
		let pxs = length( fwidth( L ) );
		let fk = 1.0 - smoothstep( 0.0025, 0.0075, pxs );
		if ( fk > 0.0 ) {
			var fh = 0.0;
			if ( part == ${ P.pants } ) {
				fh = mx_noise_float3( vec3f( L.x * 34.0, L.y * 4.5, L.z * 34.0 ) + seed * 2.0 ) * 0.0042
					+ mx_noise_float3( vec3f( L.x * 80.0, L.y * 14.0, L.z * 80.0 ) ) * 0.0012;
				fh += sin( L.y * 130.0 + 7.0 * mx_noise_float3( L * vec3f( 30.0, 12.0, 30.0 ) + seed ) ) * 0.0016 * smoothstep( 0.72, 0.86, leg );
				// the knee's bend, from this frame's bones: creases behind the knee and over the front of the
				// thigh as he crouches (the pitcher's set, a fielder's ready, the catcher), none standing
				if ( leg > 0.2 && leg < 0.6 ) {
					let sx = sign( L.x );
					let kb = select( 9u, 12u, L.x > 0.0 );
					let Mt = plBones[ slotU * ${ NB }u + kb ];
					let Ms = plBones[ slotU * ${ NB }u + kb + 1u ];
					let dt = normalize( ( Mt * vec4f( sx * 0.052, -0.383, -0.007, 0.0 ) ).xyz );
					let ds = normalize( ( Ms * vec4f( sx * 0.051, -0.481, 0.019, 0.0 ) ).xyz );
					let bend = clamp( 1.0 - dot( dt, ds ), 0.0, 1.0 );
					// (a few irregular folds, mostly behind the knee: a regular ripple read as corrugated cloth)
					let behind = mix( 0.35, 1.0, smoothstep( -0.2, 0.4, Nb.z ) );
					fh += sin( leg * 150.0 + 9.0 * mx_noise_float3( L * vec3f( 25.0, 12.0, 25.0 ) + seed ) ) * 0.0022 * min( 0.1 + bend * 1.6, 1.0 ) * behind * ( 1.0 - smoothstep( 0.02, 0.09, abs( leg - 0.39 ) ) );
				}
			} else {
				// (one field over the trunk and the sleeves: two fields made a seam of dashes where they met)
				let dx = abs( L.x );
				fh = mx_noise_float3( vec3f( ( dx * 0.8 + L.y * 0.6 ) * 22.0, ( L.y - dx * 0.5 ) * 7.0, L.z * 22.0 ) + seed * 2.0 ) * 0.0045
					+ mx_noise_float3( L * vec3f( 60.0, 25.0, 60.0 ) ) * 0.0012
					+ sin( L.y * 110.0 + 7.0 * mx_noise_float3( L * vec3f( 18.0, 9.0, 18.0 ) + seed ) ) * 0.0012 * ( 1.0 - smoothstep( 1.12, 1.25, L.y ) ) * select( 1.0, 0.0, arm > -0.5 );
				// the trunk bent over the pelvis (the set, the crouch): the cloth creases across the belly
				if ( arm < -0.5 && L.z < 0.0 && L.y < 1.35 ) {
					let up = normalize( ( plBones[ slotU * ${ NB }u + 1u ] * vec4f( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
					let upP = normalize( ( plBones[ slotU * ${ NB }u ] * vec4f( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
					let bendT = clamp( 1.0 - dot( up, upP ), 0.0, 1.0 );
					fh += sin( L.y * 120.0 + 8.0 * mx_noise_float3( L * vec3f( 20.0, 10.0, 20.0 ) + seed ) ) * 0.0022 * min( bendT * 6.0, 1.0 ) * smoothstep( -0.02, -0.08, L.z );
				}
			}
			fh *= fk * select( 1.0, 0.6, jacket );
			let dpx = dpdx( in.P );
			let dpy = dpdy( in.P );
			let N0 = s.normal;
			let r1 = cross( dpy, N0 );
			let r2 = cross( N0, dpx );
			let det = dot( dpx, r1 );
			let gr = sign( det ) * ( dpdx( fh ) * r1 + dpdy( fh ) * r2 );
			// (the tilt held under about 20 degrees: on a sliver of a triangle, or at a grazing angle, the
			// screen's derivatives are near degenerate and the tilt blew up into rows of bright dashes)
			let tl = gr / max( abs( det ), 1e-12 );
			let tn = length( tl );
			s.normal = normalize( N0 - tl * min( 1.0, 0.36 / max( tn, 1e-6 ) ) );
		}
	}
	// ---- end FY3
	// ---- FY2 (CY-4): the rest of the ring of light banks at night. After dark the key light (and its
	// shadows) is the banks on the roof behind home, so a player's back, which the center field camera
	// sees on every pitch, had nothing on it but the far towers. Citizens Bank Park's banks ring the bowl:
	// down both lines and over the outfield, all of them high, so they light every side of a man on the
	// field (Getty 83486198, 83485455: the whites bright from every side). A few fixed banks in the field's
	// frame (x toward first, -z toward center), unshadowed, as light on the cloth and skin
	let FN = normalize( in.vs.vFN + vec3f( 0.0, 1e-5, 0.0 ) );
	var ring = max( dot( FN, vec3f( -0.53, 0.45, -0.72 ) ), 0.0 ) + max( dot( FN, vec3f( 0.53, 0.45, -0.72 ) ), 0.0 );
	ring += 0.75 * ( max( dot( FN, vec3f( -0.83, 0.5, 0.25 ) ), 0.0 ) + max( dot( FN, vec3f( 0.83, 0.5, 0.25 ) ), 0.0 ) );
	ring += 0.35 * max( FN.y, 0.0 );
	let banks = smoothstep( 0.15, 0.7, frame.night ) * ${ f( NIGHT_FILL ) };
	s.emissive += c * frame.sunColor * ring * banks * select( 1.0, 0.4, part == ${ P.eye } || part == ${ P.phEye } );
	// ---- end FY2
	s.albedo = c;
	s.roughness = rough;
`,
	} );
	mat.underwaterLighting = 'none';
	// the players get their own rain (the cloth soaks, it doesn't turn glossy)
	mat.setDefine( 'DRY', 1 );
	// the sheen of cloth and fur (the Phanatic's shag; the lobe lights only what sets its colour)
	mat.setDefine( 'SHEEN', 1 );
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
	// ---- A (Phanatic): a little Phanatic (the kid in the costume on the 29th) wears a player's name and number
	if ( kind === KIND.phanatic && back !== 'name' ) {

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
	ctx.beginPath();
	ctx.rect( x, y, CELL, CELL );
	ctx.clip();
	// (FY2, CY-6) the cell is laid across the chest CHEST_ASPECT times wider than it's tall: squeezed here
	// by as much (the slant after the squeeze, so it comes out a true slant), the lettering filling about
	// nine tenths of the chest from armpit to armpit
	ctx.translate( x + CELL / 2, y + CELL / 2 );
	ctx.scale( 1 / CHEST_ASPECT, 1 );
	const W = CELL * CHEST_ASPECT * 0.9;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.lineJoin = 'round';
	const star = ( sx, sy, r0, r1 ) => {

		ctx.beginPath();
		for ( let k = 0; k < 10; k ++ ) {

			const a = - Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? r0 : r1;
			ctx.lineTo( sx + Math.cos( a ) * r, sy + Math.sin( a ) * r );

		}

		ctx.fill();

	};
	if ( home ) {

		// "Phillies" in red script rising to the right, its tall swash P, the blue stars dotting the i's
		ctx.rotate( - 0.1 );
		const big = 'italic 700 104px Georgia, "Times New Roman", serif', small = 'italic 700 64px Georgia, "Times New Roman", serif';
		ctx.font = big;
		const wP = ctx.measureText( 'P' ).width * 0.82;
		ctx.font = small;
		const wRest = ctx.measureText( 'hillies' ).width;
		// a script's letters are narrower than Georgia's
		const k = Math.min( 1, W / ( ( wP + wRest ) * 0.8 ) );
		ctx.scale( k * 0.8, k );
		const x0 = - ( wP + wRest ) / 2, base = 22;
		// ---- FR1: on the dugout jacket the white script is edged in royal blue (Getty 83570999)
		if ( jacket ) {

			ctx.strokeStyle = '#1f3d9a';
			ctx.lineWidth = 9;
			ctx.font = big;
			ctx.strokeText( 'P', x0, base + 4 );
			ctx.font = small;
			ctx.strokeText( 'hillies', x0 + wP, base );

		}
		// ---- end FR1
		ctx.fillStyle = jacket ? '#f4f2ec' : '#d01c2c';
		ctx.font = big;
		ctx.fillText( 'P', x0, base + 4 );
		ctx.font = small;
		ctx.fillText( 'hillies', x0 + wP, base );
		ctx.fillStyle = jacket ? '#1f3d9a' : '#0b2a5b'; // (FR1: the jacket's stars blue, as the jersey's)
		for ( const pre of [ 'h', 'hill' ] ) {

			const sx = x0 + wP + ctx.measureText( pre ).width + ctx.measureText( 'i' ).width * 0.55;
			star( sx, base - 50, 3.6, 8.5 );

		}

	} else {

		// ---- FY3: RAYS as the 2008 road jersey had it (Getty 83485159, Balfour; FOX t11530s): navy serif
		// capitals edged in white and Columbia blue, the gold sunburst at the R's shoulder, and the R's leg
		// carried on as a tail sweeping under AYS to the S (it was a heavy sans with no tail)
		ctx.font = '700 86px Georgia, "Times New Roman", serif';
		const full = ctx.measureText( 'RAYS' ).width, w = Math.min( W * 0.94, full ), sq = w / full;
		const x0 = - w / 2, base = 16, wR = ctx.measureText( 'R' ).width * sq;
		const tail = () => {

			ctx.beginPath();
			ctx.moveTo( x0 + wR * 0.6, base - 6 );
			ctx.bezierCurveTo( x0 + wR * 0.95, base + 24, x0 + w * 0.62, base + 26, x0 + w * 1.03, base + 4 );
			ctx.bezierCurveTo( x0 + w * 0.64, base + 15, x0 + wR * 1.15, base + 13, x0 + wR * 0.86, base - 6 );
			ctx.closePath();

		};
		for ( const [ col, lw ] of [ [ '#8fbce6', 14 ], [ '#f4f2ec', 6 ] ] ) {

			ctx.strokeStyle = col;
			ctx.lineWidth = lw;
			ctx.strokeText( 'RAYS', x0, base, w );
			tail();
			ctx.stroke();

		}

		ctx.fillStyle = jacket ? '#f4f2ec' : '#0b2a5b';
		ctx.fillText( 'RAYS', x0, base, w );
		tail();
		ctx.fill();
		ctx.fillStyle = '#f5d130';
		ctx.beginPath();
		for ( let k = 0; k < 16; k ++ ) {

			const a = k * Math.PI / 8 + 0.2, r = k % 2 ? 4.5 : 13;
			ctx.lineTo( x0 + wR * 0.42 + Math.cos( a ) * r, base - 50 + Math.sin( a ) * r );

		}

		ctx.fill();
		// ---- end FY3

	}

	ctx.restore();

}

// the caps' fronts: the white script P on the Phillies' red; TB in white outlined in Columbia blue on the
// Rays' navy
// ---- FR1: the black 2008 champions cap's front (Getty 83570999, 83571356, 83486314; FOX's interview
// frames): a round emblem, the Phillies' P in red on a navy disc in a white ring, a red ribbon across
// its foot with 2008, CHAMPIONS arched over it; at a cap's size it reads as the round red, white and
// blue mark it was, where the plain P read as the everyday cap
function drawChampCap( ctx, i ) {

	const [ x, y ] = cellXY( i );
	ctx.save();
	ctx.clearRect( x, y, CELL, CELL );
	ctx.translate( x + CELL / 2, y + CELL / 2 + 4 );
	ctx.fillStyle = '#e9e7e2';
	ctx.beginPath();
	ctx.arc( 0, 0, 40, 0, Math.PI * 2 );
	ctx.fill();
	ctx.fillStyle = '#13285e';
	ctx.beginPath();
	ctx.arc( 0, 0, 31, 0, Math.PI * 2 );
	ctx.fill();
	// the P
	ctx.fillStyle = '#c8102e';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = 'italic 700 46px Georgia, "Times New Roman", serif';
	ctx.fillText( 'P', 1, - 3 );
	// the ribbon and the year
	ctx.fillStyle = '#c8102e';
	ctx.beginPath();
	ctx.moveTo( - 46, 16 );
	ctx.lineTo( 46, 16 );
	ctx.lineTo( 40, 34 );
	ctx.lineTo( - 40, 34 );
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = '#f4f2ec';
	ctx.font = '900 17px "Helvetica Neue", Arial, sans-serif';
	ctx.fillText( '2008', 0, 26 );
	// CHAMPIONS round the top of the ring
	ctx.font = '900 11px "Helvetica Neue", Arial, sans-serif';
	ctx.fillStyle = '#13285e';
	const word = 'CHAMPIONS';
	for ( let k = 0; k < word.length; k ++ ) {

		const a = - Math.PI / 2 + ( k - ( word.length - 1 ) / 2 ) * 0.2;
		ctx.save();
		ctx.translate( Math.cos( a ) * 35.5, Math.sin( a ) * 35.5 );
		ctx.rotate( a + Math.PI / 2 );
		ctx.fillText( word[ k ], 0, 0 );
		ctx.restore();

	}

	ctx.restore();

}
// ---- end FR1

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

// ---- FY3: the Rays' 2008 sleeve logo: a manta ray from above, navy edged in Columbia blue, its wings
// swept, its tail trailing (Getty 83485159, Balfour's left sleeve)
function drawRay( ctx, i ) {

	const [ x, y ] = cellXY( i );
	ctx.save();
	ctx.clearRect( x, y, CELL, CELL );
	ctx.translate( x + CELL / 2, y + CELL / 2 );
	ctx.rotate( - 0.25 );
	const ray = () => {

		ctx.beginPath();
		ctx.moveTo( - 50, 4 );
		ctx.quadraticCurveTo( - 18, - 6, - 8, - 24 );
		ctx.quadraticCurveTo( 0, - 30, 8, - 24 );
		ctx.quadraticCurveTo( 18, - 6, 50, 4 );
		ctx.quadraticCurveTo( 20, 8, 6, 20 );
		ctx.lineTo( 3, 52 );
		ctx.lineTo( - 3, 52 );
		ctx.lineTo( - 6, 20 );
		ctx.quadraticCurveTo( - 20, 8, - 50, 4 );
		ctx.closePath();

	};
	ctx.lineJoin = 'round';
	ctx.strokeStyle = '#8fbce6';
	ctx.lineWidth = 7;
	ray();
	ctx.stroke();
	ctx.fillStyle = '#0b2a5b';
	ray();
	ctx.fill();
	ctx.restore();

}
// ---- end FY3

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
