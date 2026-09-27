import { Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, LatheGeometry, PlaneGeometry, Vector2, Vector3, Quaternion, Matrix4 } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';
import { solvePose, bindMatrices, BONES, FACE } from '../../game/Rig.js';
import { Kit } from './Kit.js';

// What he wears on his head and carries in his hands, riding on his own bones: the rig is posed on the
// GPU, so the bones a prop needs (the head, the hands) are solved here again on the CPU from the same pose
// (Rig.solvePose, a few microseconds).
//
//   the sou'wester: the red vinyl rain hat he wore with the slicker on the 27th (Getty 83477166: pulled
//     down over the top of his head, the blue brows peeking out under the brim)
//   the chef's toque: the tall white hat he wore in the Gator's bed for the hot dogs (flickr 2842323072)
//   the 2008 banner: the big red flag, a white 2008 on it, a blue border and the World Series patch, on a
//     wooden pole with a gold tip, that he ran round the field after the last out (Getty 83570904)
//   a popcorn box: the red and white striped box he spilled along a row on October 25 (Getty 83434489)

const PAL = [ 'vinyl', 'white', 'pole', 'gold', 'popcorn', 'box' ];
const PA = Object.fromEntries( PAL.map( ( k, i ) => [ k, i ] ) );

function material() {

	return standard( {
		name: 'phanatic-props', roughness: 0.5, side: 'double',
		surface: /* wgsl */`
	let k = i32( in.uv.x * ${ PAL.length }.0 );
	var c = vec3f( 0.5 ); var r = 0.5; var mt = 0.0;
	switch k {
		case ${ PA.vinyl }: { c = vec3f( 0.46, 0.02, 0.025 ); r = 0.14; }
		case ${ PA.white }: { c = vec3f( 0.8, 0.79, 0.77 ); r = 0.8; }
		case ${ PA.pole }: { c = vec3f( 0.42, 0.28, 0.14 ); r = 0.5; }
		case ${ PA.gold }: { c = vec3f( 0.7, 0.5, 0.15 ); r = 0.25; mt = 1.0; }
		case ${ PA.popcorn }: { c = vec3f( 0.85, 0.72, 0.42 ) * ( 0.8 + 0.2 * fract( sin( dot( floor( in.P * 60.0 ), vec3f( 1.3, 7.1, 3.7 ) ) ) * 437.5 ) ); r = 0.8; }
		case ${ PA.box }: { c = select( vec3f( 0.8, 0.79, 0.77 ), vec3f( 0.5, 0.03, 0.03 ), fract( in.uv.y * 6.0 ) < 0.5 ); r = 0.6; }
		default: { c = vec3f( 0.5 ); }
	}
	s.albedo = c; s.roughness = r; s.metalness = mt;
` } );

}

// the banner's cloth: 2008 in white on red, the blue border, the Series' patch in the corner; it waves
// in the vertex shader (pinned at the pole, the free edge flapping most)
function bannerMaterial() {

	const tex = canvasTexture( 512, 352, ( ctx, w, h ) => {

		ctx.fillStyle = '#1f3a8a'; ctx.fillRect( 0, 0, w, h );
		ctx.fillStyle = '#b3121f'; ctx.fillRect( 16, 16, w - 32, h - 32 );
		ctx.fillStyle = '#f4f2ec'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.font = 'bold 200px "Arial Black", "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( '2008', w * 0.56, h * 0.52, w * 0.78 );
		// the World Series patch: a blue shield, a white ball, the red stitches
		ctx.fillStyle = '#12306e'; ctx.beginPath(); ctx.arc( 64, 64, 36, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#f4f2ec'; ctx.beginPath(); ctx.arc( 64, 64, 24, 0, Math.PI * 2 ); ctx.fill();
		ctx.strokeStyle = '#c8202a'; ctx.lineWidth = 3;
		ctx.beginPath(); ctx.arc( 38, 64, 20, - 0.8, 0.8 ); ctx.stroke();
		ctx.beginPath(); ctx.arc( 90, 64, 20, Math.PI - 0.8, Math.PI + 0.8 ); ctx.stroke();

	}, 'phanatic-2008-banner' );
	const m = standard( {
		name: 'phanatic-banner', roughness: 0.85, side: 'double', textures: { phBanner: tex },
		vertex: /* wgsl */`
	// the cloth: the free edge (uv.x 1) flaps, the pole's edge (0) stays
	let u = v.uv.x;
	let w = sin( frame.time * 7.0 - u * 5.0 ) * 0.16 * u + sin( frame.time * 11.0 - u * 9.0 + v.uv.y * 3.0 ) * 0.05 * u;
	v.position = v.position + vec3f( 0.0, - 0.12 * u * u, w );
`,
		surface: 'let t = textureSample( phBanner, smpAnisoClamp, vec2f( in.uv.x, 1.0 - in.uv.y ) ).rgb; s.albedo = t; s.roughness = 0.85;',
	} );
	m.setDefine( 'DRY', 1 );
	return m;

}

export class Props {

	constructor( parent ) {

		this.group = new Group();
		this.group.name = 'phanatic-props';
		this.group.userData.dynamic = true;
		parent.add( this.group );
		this.material = material();
		const lathe = ( prof, seg = 24 ) => new LatheGeometry( prof.map( ( [ a, b ] ) => new Vector2( a, b ) ), seg );
		// ---- the sou'wester: a crown over the top of his big head and a wide soft brim, longer behind
		{

			const k = new Kit( PAL.length );
			k.add( lathe( [ [ 0.0, 0.2 ], [ 0.12, 0.19 ], [ 0.22, 0.14 ], [ 0.27, 0.06 ], [ 0.285, 0.0 ] ] ), PA.vinyl );
			const brim = lathe( [ [ 0.27, 0.0 ], [ 0.33, - 0.03 ], [ 0.39, - 0.08 ] ], 28 );
			k.add( brim, PA.vinyl, [ 0, 0, 0.03 ], [ 0, 0, 0 ], [ 1, 1, 1.12 ] );
			this.hat = this._mesh( k, 'phanatic-souwester' );

		}

		// ---- the chef's toque: the band and the puffed crown
		{

			const k = new Kit( PAL.length );
			k.add( new CylinderGeometry( 0.2, 0.2, 0.09, 24 ), PA.white, [ 0, 0.04, 0 ] );
			k.add( lathe( [ [ 0.0, 0.08 ], [ 0.2, 0.08 ], [ 0.25, 0.18 ], [ 0.27, 0.3 ], [ 0.22, 0.38 ], [ 0.0, 0.4 ] ] ), PA.white );
			this.toque = this._mesh( k, 'phanatic-toque' );

		}

		// ---- the 2008 banner on its pole (the pole in the hand's frame along -y... set per frame)
		{

			const k = new Kit( PAL.length );
			k.add( new CylinderGeometry( 0.018, 0.02, 3.0, 8 ), PA.pole, [ 0, 1.2, 0 ] );
			k.add( new SphereGeometry( 0.045, 10, 8 ), PA.gold, [ 0, 2.73, 0 ] );
			k.add( new CylinderGeometry( 0.0, 0.03, 0.12, 8 ), PA.gold, [ 0, 2.82, 0 ] );
			this.pole = this._mesh( k, 'phanatic-banner-pole' );
			const cloth = new PlaneGeometry( 2.1, 1.45, 12, 6 );
			cloth.translate( 1.05, 0, 0 );
			this.banner = new Mesh( cloth, bannerMaterial() );
			this.banner.name = 'phanatic-2008-banner';
			this.banner.castShadow = true;
			this.banner.position.set( 0.02, 1.95, 0 );
			this.pole.add( this.banner );

		}

		// ---- the popcorn box, heaped
		{

			const k = new Kit( PAL.length );
			k.add( new BoxGeometry( 0.12, 0.16, 0.08 ), PA.box, [ 0, 0.08, 0 ], [ 0, 0, 0 ], [ 1, 1, 1 ] );
			k.add( new SphereGeometry( 0.07, 10, 6 ), PA.popcorn, [ 0, 0.16, 0 ], [ 0, 0, 0 ], [ 0.9, 0.6, 0.65 ] );
			this.popcorn = this._mesh( k, 'phanatic-popcorn' );

		}

		// ---- the party blower in his snout (October 29, Getty 83838048): a red and white striped paper tube
		// that shoots out and curls back (its length scaled per frame)
		{

			const k = new Kit( PAL.length );
			k.add( new CylinderGeometry( 0.013, 0.016, 1, 8, 1, true ), PA.box, [ 0, - 0.5, 0 ], [ 0, 0, 0 ], [ 1, 1, 1 ] );
			k.add( new SphereGeometry( 0.02, 8, 6 ), PA.box, [ 0, - 1.0, 0 ] );
			this.blower = this._mesh( k, 'phanatic-blower' );

		}

		// the rig's bind pose: the head's pivot, and where the Phanatic's big head sits on it
		const { bind } = bindMatrices();
		const hb = new Vector3().fromArray( bind, BONES.head * 16 + 12 );
		this.headTop = new Vector3( 0, FACE.top[ 1 ] - hb.y + 0.14, ( FACE.skull.z0 + FACE.skull.z1 ) / 2 - hb.z + 0.01 );
		// the snout's tip (Rig.js: the snout's ring), and the way it points
		const hy = FACE.top[ 1 ] - hb.y, hz = ( FACE.skull.z0 + FACE.skull.z1 ) / 2 - hb.z - 0.01;
		this.snoutTip = new Vector3( 0, hy - 0.16, hz - 0.5 );
		this._bones = new Float32Array( 17 * 16 );
		this._root = new Matrix4();
		this._m = new Matrix4();
		this._o = new Matrix4();
		this._q = new Quaternion();
		this._v = new Vector3();
		this._s = new Vector3();

	}

	_mesh( k, name ) {

		const m = new Mesh( k.geometry(), this.material );
		m.name = name;
		m.castShadow = true;
		m.visible = false;
		m.matrixAutoUpdate = false;
		this.group.add( m );
		return m;

	}

	// solve a figure's bones: { x, y, z, yaw, pose, height, girth }
	solve( { x, y, z, yaw, pose, height = 1.02, girth = 1.3 } ) {

		this._q.setFromAxisAngle( this._v.set( 0, 1, 0 ), yaw );
		this._root.compose( this._s.set( x, y, z ), this._q, new Vector3( height, height, height ) );
		solvePose( this._root, pose, this._bones, 0, 'L', girth );
		return this._bones;

	}

	bone( b, out = new Matrix4() ) {

		return out.fromArray( this._bones, b * 16 );

	}

	// put a prop on a bone with a local offset (a Matrix4 in the bone's frame)
	place( mesh, bone, offset ) {

		mesh.visible = true;
		mesh.matrix.copy( this.bone( bone, this._m ) ).multiply( offset );
		mesh.matrixWorldNeedsUpdate = true;

	}

	// this frame's props for him: st.props = { hat, toque, banner, popcorn } (booleans)
	update( st ) {

		const want = st.visible && st.pose ? ( st.props || {} ) : {};
		for ( const [ key, mesh ] of [ [ 'hat', this.hat ], [ 'toque', this.toque ], [ 'banner', this.pole ], [ 'popcorn', this.popcorn ], [ 'blower', this.blower ] ] ) mesh.visible = !! want[ key ];
		if ( ! want.hat && ! want.toque && ! want.banner && ! want.popcorn && ! want.blower ) return;
		this.solve( st );
		const o = this._o;
		if ( want.hat ) this.place( this.hat, BONES.head, o.makeTranslation( this.headTop.x, this.headTop.y - 0.05, this.headTop.z + 0.02 ) );
		if ( want.toque ) this.place( this.toque, BONES.head, o.makeTranslation( this.headTop.x, this.headTop.y - 0.02, this.headTop.z + 0.03 ) );
		// the pole up through his right fist, a metre of it below his hand, leaned back over his shoulder with
		// the cloth streaming out behind him (its plane turned to trail his heading)
		if ( want.banner ) {

			const hp = new Vector3().setFromMatrixPosition( this.bone( BONES.handR, this._m ) );
			const q = new Quaternion().setFromAxisAngle( new Vector3( 0, 1, 0 ), st.yaw - Math.PI / 2 + 0.25 ).multiply( new Quaternion().setFromAxisAngle( new Vector3( 0, 0, 1 ), - 0.3 ) );
			const off = new Vector3( 0, - 1.0, 0 ).applyQuaternion( q );
			this.pole.matrix.compose( hp.add( off ), q, new Vector3( 1, 1, 1 ) );
			this.pole.matrixWorldNeedsUpdate = true;
			this.pole.visible = true;

		}

		if ( want.popcorn ) this.place( this.popcorn, BONES.handL, o.makeTranslation( 0, - 0.1, - 0.04 ) );
		// the blower along the snout (down and forward: the snout's tilt), unrolling out and back in
		if ( want.blower ) {

			const t = st.tau || 0, out = 0.06 + 0.3 * Math.max( 0, Math.sin( t * 3.1 ) ) ** 0.6;
			o.makeTranslation( this.snoutTip.x, this.snoutTip.y, this.snoutTip.z ).multiply( new Matrix4().makeRotationX( Math.PI / 2 - 0.35 ) ).multiply( new Matrix4().makeScale( 1, out, 1 ) );
			this.place( this.blower, BONES.head, o );

		}

	}

}

void PlaneGeometry;
