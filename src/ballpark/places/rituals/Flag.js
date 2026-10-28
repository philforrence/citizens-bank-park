import { Mesh, Group, BufferGeometry, Float32BufferAttribute, CylinderGeometry, BoxGeometry, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';

// The big red flag Brett Myers carried round the track on the lap (Getty 83570906: red edged in navy, 2008
// in big white numerals; ronniebruce 2987488477: on a long pole held up high, the cloth streaming back),
// and the pitching rubber Jamie Moyer dug out of the mound to keep (Getty
// 83571213: a slab of white rubber caked with clay, held in both hands; johnpaulendicott 3001401832: the
// hole it left).

export class Flag {

	constructor( group ) {

		this.root = new Group();
		this.root.name = 'lap-flag';
		const tex = typeof OffscreenCanvas === 'undefined' ? null : canvasTexture( 512, 320, drawFlag, 'lapFlag' );
		this.cloth = standard( { name: 'lap-flag-cloth', color: new Color( 0.42, 0.02, 0.03 ), roughness: 0.8, side: 'double', textures: tex ? { lfTex: tex } : {},
			uniforms: { wave: [ 'f32', 0 ], wavePrev: [ 'f32', 0 ] },
			vertex: /* wgsl */`
	// streaming back from the pole, rippling more toward the fly
	// (FB3, C3B-16: in the air it's cloth, not a board: waves running down it from the pole and the fly
	// sagging, its lower corner most, Getty 83570906)
	let u = v.uv.x;
	let sag = vec3f( - 0.1 * u * u, - ( 0.22 + 0.2 * v.uv.y ) * u * u, 0.0 );
	let w = sin( u * 7.0 - mat.wave * 7.0 ) * 0.16 * u + sin( u * 15.0 - mat.wave * 12.0 + v.uv.y * 3.0 ) * 0.045 * u;
	let p = v.position + sag + vec3f( 0.0, 0.04 * sin( u * 7.0 - mat.wave * 7.0 + 1.3 ) * u, w );
	// (and where it was a frame ago, for the motion vectors: the ripple and the walk, or the temporal
	// filter leaves a speckled half-image of it)
	let w0 = sin( u * 7.0 - mat.wavePrev * 7.0 ) * 0.16 * u + sin( u * 15.0 - mat.wavePrev * 12.0 + v.uv.y * 3.0 ) * 0.045 * u;
	let p0 = v.position + sag + vec3f( 0.0, 0.04 * sin( u * 7.0 - mat.wavePrev * 7.0 + 1.3 ) * u, w0 );
	v.useWorld = true;
	v.worldPos = ( v.model * vec4f( p, 1.0 ) ).xyz;
	v.worldNormal = normalize( ( v.model * vec4f( v.normal, 0.0 ) ).xyz );
	v.prevWorldPos = ( v.prevModel * vec4f( p0, 1.0 ) ).xyz;
`,
			// (FB3, C3B-16: printed through, as a flag is: from its back the 2008 reads the right way round,
			// not "8002")
			surface: ( tex ? 's.albedo = textureSample( lfTex, smpAnisoClamp, vec2f( select( 1.0 - in.uv.x, in.uv.x, in.front ), in.uv.y ) ).rgb;' : '' ) + 's.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.3;' } );
		this.cloth.underwaterLighting = 'none';
		this.cloth.setDefine( 'WET_FABRIC', 1 );
		// the cloth off the pole's top, subdivided so it ripples (---- FR1: the big one, about 2.6 x 1.6 m: in
		// Getty 83570906 it takes two men, Myers on the pole and a teammate on its far corner; it was 1.8 x
		// 1.15 and read as a pennant on TV)
		const pos = [], uv = [], nrm = [], idx = [], NX = 20, NY = 7, FW = 2.6, FH = 1.6;
		for ( let j = 0; j <= NY; j ++ ) for ( let i = 0; i <= NX; i ++ ) {

			pos.push( i / NX * FW, 3.25 - j / NY * FH, 0 );
			uv.push( i / NX, j / NY );
			nrm.push( 0, 0, 1 );

		}

		for ( let j = 0; j < NY; j ++ ) for ( let i = 0; i < NX; i ++ ) {

			const a = j * ( NX + 1 ) + i;
			idx.push( a, a + NX + 1, a + 1, a + 1, a + NX + 1, a + NX + 2 );

		}

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
		g.setIndex( idx );
		const cloth = new Mesh( g, this.cloth );
		cloth.frustumCulled = false;
		this.root.add( cloth );
		const pole = new Mesh( new CylinderGeometry( 0.019, 0.023, 3.35, 8 ), standard( { name: 'lap-flag-pole', color: new Color( 0.45, 0.32, 0.17 ), roughness: 0.5 } ) );
		pole.position.y = 1.675;
		this.root.add( pole );
		this.root.visible = false;
		this.root.userData.dynamic = true;
		group.add( this.root );
		// the rubber in Moyer's hands, and the hole on the mound
		const white = standard( { name: 'rubber-slab', color: new Color( 0.7, 0.68, 0.62 ), roughness: 0.85,
			surface: 's.albedo = mix( mat.color, vec3f( 0.3, 0.14, 0.07 ), smoothstep( 0.35, 0.75, mx_noise_float3( in.P * 9.0 ) * 0.5 + 0.5 ) );' } );
		this.rubber = new Mesh( new BoxGeometry( 0.61, 0.1, 0.152 ), white );
		this.rubber.visible = false;
		this.rubber.userData.dynamic = true;
		group.add( this.rubber );
		const clay = standard( { name: 'rubber-hole', color: new Color( 0.13, 0.055, 0.03 ), roughness: 0.95,
			surface: 's.albedo = mat.color * ( 0.7 + 0.4 * mx_noise_float2( in.P.xz * 18.0 ) );' } );
		this.hole = new Mesh( new BoxGeometry( 0.72, 0.03, 0.28 ), clay );
		this.hole.visible = false;
		this.hole.userData.dynamic = true;
		group.add( this.hole );

	}

	// flag: { x, y, z, yaw } of the hands on the pole (null: put away); rubber: { x, y, z, yaw } in his
	// hands, or 'hole' (dug out, set down) or null; holeAt: where the rubber was
	update( flag, rubber, holeAt, time ) {

		this.root.visible = !! flag;
		if ( flag ) {

			this.root.position.set( flag.x, flag.y - 1.2, flag.z );
			// (FB3, C3B-16: the fly behind him as he walks: it was turned to stream out ahead of the pole)
			this.root.rotation.y = flag.yaw - Math.PI / 2;
			this.cloth.uniforms.wavePrev.value = this.cloth.uniforms.wave.value;
			this.cloth.uniforms.wave.value = time;

		}

		this.hole.visible = !! rubber;
		if ( rubber ) this.hole.position.set( holeAt[ 0 ], holeAt[ 1 ] + 0.005, holeAt[ 2 ] );
		this.rubber.visible = !! rubber && rubber !== 'hole';
		if ( rubber && rubber !== 'hole' ) {

			this.rubber.position.set( rubber.x, rubber.y, rubber.z );
			this.rubber.rotation.y = rubber.yaw;

		}

	}

}

// ---- FR1: the flag as it was (Getty 83570906): Phillies red edged in navy all round, 2008 in big white
// block numerals down its length, the little World Series mark low by the fly (it read "Phillies" in
// script, with a white and blue band down the hoist)
function drawFlag( ctx, w, h ) {

	ctx.fillStyle = '#a3121c';
	ctx.fillRect( 0, 0, w, h );
	ctx.strokeStyle = '#1b2f6e';
	ctx.lineWidth = 12;
	ctx.strokeRect( 6, 6, w - 12, h - 12 );
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = '900 190px "Arial Black", "Helvetica Neue", Arial, sans-serif';
	ctx.lineJoin = 'round';
	ctx.lineWidth = 6;
	ctx.strokeStyle = '#1b2f6e';
	ctx.strokeText( '2008', w * 0.5, h * 0.47, w * 0.82 );
	ctx.fillStyle = '#f6f4ee';
	ctx.fillText( '2008', w * 0.5, h * 0.47, w * 0.82 );
	// the World Series mark, small, low toward the fly
	const cx = w * 0.8, cy = h * 0.82;
	ctx.fillStyle = '#f6f4ee';
	ctx.beginPath();
	ctx.arc( cx, cy, 24, 0, Math.PI * 2 );
	ctx.fill();
	ctx.fillStyle = '#1b2f6e';
	ctx.beginPath();
	ctx.arc( cx, cy, 17, 0, Math.PI * 2 );
	ctx.fill();
	ctx.fillStyle = '#c8102e';
	ctx.fillRect( cx - 30, cy + 6, 60, 10 );

}
// ---- end FR1
