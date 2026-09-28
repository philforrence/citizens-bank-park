import { Mesh, Group, BufferGeometry, Float32BufferAttribute, CylinderGeometry, BoxGeometry, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';

// The big red flag Brett Myers carried round the track on the lap (Getty 83570906; ronniebruce
// 2987488477: the Phillies' red flag with its white and blue band along the pole, on a long pole held up
// high, the cloth streaming back), and the pitching rubber Jamie Moyer dug out of the mound to keep (Getty
// 83571213: a slab of white rubber caked with clay, held in both hands; johnpaulendicott 3001401832: the
// hole it left).

export class Flag {

	constructor( group ) {

		this.root = new Group();
		this.root.name = 'lap-flag';
		const tex = typeof OffscreenCanvas === 'undefined' ? null : canvasTexture( 512, 320, drawFlag, 'lapFlag' );
		this.cloth = standard( { name: 'lap-flag-cloth', color: new Color( 0.42, 0.02, 0.03 ), roughness: 0.8, side: 'double', textures: tex ? { lfTex: tex } : {},
			uniforms: { wave: [ 'f32', 0 ] },
			vertex: /* wgsl */`
	// streaming back from the pole, rippling more toward the fly
	let u = v.uv.x;
	let w = sin( u * 9.0 - mat.wave * 8.0 ) * 0.09 * u + sin( u * 17.0 - mat.wave * 13.0 + v.uv.y * 3.0 ) * 0.03 * u;
	let p = v.position + vec3f( 0.0, - 0.12 * u * u, w );
	v.useWorld = true;
	v.worldPos = ( v.model * vec4f( p, 1.0 ) ).xyz;
	v.worldNormal = normalize( ( v.model * vec4f( v.normal, 0.0 ) ).xyz );
	v.prevWorldPos = v.worldPos;
`,
			surface: ( tex ? 's.albedo = textureSample( lfTex, smpAnisoClamp, in.uv ).rgb;' : '' ) + 's.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.3;' } );
		this.cloth.underwaterLighting = 'none';
		this.cloth.setDefine( 'WET_FABRIC', 1 );
		// the cloth: 1.8 x 1.15 m off the pole's top, subdivided so it ripples
		const pos = [], uv = [], nrm = [], idx = [], NX = 16, NY = 6, FW = 1.8, FH = 1.15;
		for ( let j = 0; j <= NY; j ++ ) for ( let i = 0; i <= NX; i ++ ) {

			pos.push( i / NX * FW, 2.9 - j / NY * FH, 0 );
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
		const pole = new Mesh( new CylinderGeometry( 0.018, 0.022, 3.0, 8 ), standard( { name: 'lap-flag-pole', color: new Color( 0.25, 0.16, 0.08 ), roughness: 0.5 } ) );
		pole.position.y = 1.5;
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
			this.root.rotation.y = flag.yaw + Math.PI / 2;
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

// the flag: Phillies red, a white and blue band down the hoist, the script in white
function drawFlag( ctx, w, h ) {

	ctx.fillStyle = '#9b0a14';
	ctx.fillRect( 0, 0, w, h );
	ctx.fillStyle = '#ffffff';
	ctx.fillRect( 0, 0, 44, h );
	ctx.fillStyle = '#1b3a8c';
	ctx.fillRect( 44, 0, 20, h );
	ctx.fillStyle = '#ffffff';
	ctx.font = 'italic 700 118px Georgia, "Times New Roman", serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText( 'Phillies', w * 0.56, h * 0.52 );

}
