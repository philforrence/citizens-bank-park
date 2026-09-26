import { Mesh, SphereGeometry, BufferGeometry, Float32BufferAttribute, Color, Vector3 } from '../engine/index.js';
import { standard } from '../materials/Materials.js';

// The night air over a lit ballpark in the city: no black starry sky but a warm glow, brightest at the
// horizon and toward Center City, lit from below when the cloud is low (October 27); and round every
// light bank a halo in the damp air, bigger and brighter in the rain. Both are additive layers in the
// transparent pass: a dome that follows the camera (the glow) and camera-facing sprites (the halos).
// amount / haloAmount are set each frame (BallparkApp._weather).

export class SkyGlow {

	constructor( scene, banks ) {

		// the dome, 4 km out, drawn from inside
		this.domeMat = standard( {
			name: 'sky-glow', color: new Color( 1.0, 0.8, 0.62 ), transparent: true, depthWrite: false, blending: 'additive', side: 'back', lit: false,
			uniforms: { amount: [ 'f32', 0 ], toward: [ 'vec3f', new Vector3( 0, 0, - 1 ) ] },
			varyings: { vDir: 'vec3f' },
			vertex: /* wgsl */`
	let d = normalize( v.position );
	v.useWorld = true;
	v.worldPos = frame.cameraPos + d * 4000.0;
	v.worldNormal = - d;
	v.prevWorldPos = v.worldPos;
	o.vDir = d;
`,
			surface: /* wgsl */`
	let dir = normalize( in.vs.vDir );
	let h = clamp( dir.y, 0.0, 1.0 );
	let flat = normalize( vec3f( dir.x, 0.0, dir.z ) + vec3f( 1e-4, 0.0, 0.0 ) );
	let t = clamp( dot( flat, mat.toward ), 0.0, 1.0 );
	let k = ( 0.4 + 1.6 * pow( 1.0 - h, 3.0 ) ) * ( 1.0 + 1.2 * t * t * pow( 1.0 - h, 2.0 ) ) * smoothstep( -0.08, 0.03, dir.y );
	s.albedo = mat.color * k * mat.amount;
	s.alpha = 1.0;
`,
		} );
		this.domeMat.underwaterLighting = 'none';
		const dome = new Mesh( new SphereGeometry( 1, 32, 16 ), this.domeMat );
		dome.name = 'sky-glow';
		dome.frustumCulled = false;
		dome.layers.set( 2 );
		scene.add( dome );
		this.dome = dome;

		// the halos: one quad per bank, turned to the camera in the vertex shader
		const pos = [], corner = [], centre = [], index = [];
		banks.forEach( ( p, i ) => {

			for ( const [ cx, cy ] of [ [ - 1, - 1 ], [ 1, - 1 ], [ 1, 1 ], [ - 1, 1 ] ] ) {

				pos.push( p.x, p.y, p.z );
				corner.push( cx, cy );
				centre.push( p.x, p.y, p.z );

			}

			const b = i * 4;
			index.push( b, b + 1, b + 2, b, b + 2, b + 3 );

		} );
		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		g.setAttribute( 'aCorner', new Float32BufferAttribute( corner, 2 ) );
		g.setAttribute( 'aCentre', new Float32BufferAttribute( centre, 3 ) );
		g.setIndex( index );
		this.haloMat = standard( {
			name: 'light-halos', color: new Color( 1.0, 0.93, 0.8 ), transparent: true, depthWrite: false, blending: 'additive', side: 'double', lit: false,
			uniforms: { amount: [ 'f32', 0 ], size: [ 'f32', 30 ] },
			attributes: { aCorner: 'vec2f', aCentre: 'vec3f' },
			varyings: { vC: 'vec2f' },
			vertex: /* wgsl */`
	let c = v.aCentre;
	let toCam = normalize( frame.cameraPos - c );
	let side = normalize( cross( vec3f( 0.0, 1.0, 0.0 ), toCam ) );
	let up = cross( toCam, side );
	let wp = c + ( side * v.aCorner.x + up * v.aCorner.y ) * mat.size + toCam * 2.0;
	v.useWorld = true;
	v.worldPos = wp;
	v.worldNormal = toCam;
	v.prevWorldPos = wp;
	o.vC = v.aCorner;
`,
			surface: /* wgsl */`
	let r = length( in.vs.vC );
	let k = ( exp( - r * r * 7.0 ) * 0.8 + exp( - r * r * 2.5 ) * 0.25 ) * ( 1.0 - smoothstep( 0.55, 1.0, r ) );
	s.albedo = mat.color * k * mat.amount;
	s.alpha = 1.0;
`,
		} );
		this.haloMat.underwaterLighting = 'none';
		const halos = new Mesh( g, this.haloMat );
		halos.name = 'light-halos';
		halos.frustumCulled = false;
		halos.layers.set( 2 );
		scene.add( halos );
		this.halos = halos;

	}

	set( { glow, halo, haloSize, toward } ) {

		this.domeMat.uniforms.amount.value = glow;
		this.dome.visible = glow > 1e-4;
		this.haloMat.uniforms.amount.value = halo;
		this.haloMat.uniforms.size.value = haloSize;
		this.halos.visible = halo > 1e-4;
		if ( toward ) this.domeMat.uniforms.toward.value.copy( toward );

	}

}
