import { Group, Mesh, BufferGeometry, Float32BufferAttribute, Vector3, Sphere, Color } from '../../engine/index.js';
import { standard } from '../../materials/Materials.js';
import { commonModule } from '../../engine/render/wgsl/common.js';
import { LiveTV } from './Concourse3BTV.js';
import { nightState } from './Concourse3BPeople.js';
import { Frame, STREET } from './leftfield/Frame.js';
import { buildHarrys } from './leftfield/Harrys.js';
import { HarrysPeople } from './leftfield/People.js';
import { buildMonty } from './leftfield/Monty.js';
import { buildRamp } from './leftfield/Ramp.js';
import { Cast } from './Cast.js';
import { Tempo } from './Tempo.js';
import { HarrysSounds } from './leftfield/Sounds.js';
import { buildMurals } from './leftfield/Murals.js';
import { buildPlaza } from './leftfield/Plaza.js';

// The left field corner on the World Series nights, October 27 and 29, 2008 (H, wave 3): Harry the K's
// Broadcast Bar & Grille under the scoreboard, upstairs on the Scoreboard Porch's level and downstairs at
// the back of the 140s, with its people; the rest of the corner as the scouting found it missing (the
// seats over Monty's Angle, the Left Field ramp, the plaza at the end of the main concourse inside the Left
// Field Gate). Parts in places/leftfield/:
//
//   Frame.js    the scoreboard's frame, which Harry's is built in (Landmarks.harrys)
//   Kit.js      the corner's things in one draw (a palette and an atlas), Atlas.js its printed and lit things
//   Harrys.js   the house opened: the two bars, the patio and the walkway, the dining room, the signs
//
// Field frame (in the field's group), as every place; the street and the main concourse at 7 m.
export default class LeftField {

	constructor( { app, field, bowl, people, colliders } ) {

		this.app = app;
		this.field = field;
		this.bowl = bowl;
		this.colliders = colliders;
		this.group = new Group();
		this.group.name = 'leftfield';
		const H = app?.landmarks?.harrys;
		this.H = H;
		if ( H ) {

			this.F = new Frame( H.g );
			// Landmarks' closed brick box and its strip of glass give way to the house opened up
			H.house.removeFromParent();
			H.glass.removeFromParent();
			this.harrys = buildHarrys( this, this.F, H );
			this.kit = this.harrys.kit;
			// what keeps the rain off (RainCover.js, by way of the app): the walkway, the house
			this.rainRoof = [ ...this.harrys.rainRoof, this.harrys.hg ];
			this._glass();
			this._tvs();
			// the three murals on the brick over the lower bar
			const { DN, FZ } = this.harrys;
			buildMurals( this, this.F, { x0: DN.x0, x1: DN.x1, y0: DN.y1 + 1.55, h: 2.9, z: FZ - 0.06 } );

		}

		// the seats over Monty's Angle, the Left Field ramp
		if ( this.kit ) {

			this.monty = buildMonty( this, this.kit, this.kit.frame( this.F ) );
			this.ramp = buildRamp( this, this.kit );
			this.plaza = buildPlaza( this, this.harrys, this.kit, this.kit.frame( this.F ) );

		}
		// everything the Kit built, in one draw
		if ( this.kit ) this.group.add( this.kit.mesh( 'leftfield-things' ) );
		// the people (Cast.js's pool): a troupe of them, skipped whole when the view's elsewhere, moved at the
		// full rate only while some are seen (Tempo.js)
		this.cast = new Cast( { parent: this.group, max: 300 } );
		if ( this.harrys ) {

			const [ cx, cz ] = this.F.field( - 2, - 8 );
			this.cast.bounds = new Sphere( new Vector3( cx, 12, cz ), 32 );
			this.people = new HarrysPeople( this, this.cast, this.harrys, this.F );
			if ( this.plaza ) this.people.plaza( this.plaza.carts );
			// the troupe's bounds take in the plaza and the corner
			this.cast.bounds = new Sphere( new Vector3( ...( ( [ x, z ] ) => [ x, 12, z ] )( this.F.field( 0, 2 ) ) ), 44 );

		}

		this._tempo = new Tempo( [ this.cast ] );
		// what it sounds like (set up once the park's sound exists)
		this.sounds = new HarrysSounds( this );
		void people;

	}

	// the glass of the upstairs bar's front: a faint tint, the sky and the lights in it at a glance
	_glass() {

		const { UP, FZ } = this.harrys, F = this.F;
		const P = ( x, y ) => {

			const [ fx, fz ] = F.field( x, FZ + 0.1 );
			return [ fx, y, fz ];

		};
		const [ nx, nz ] = F.dir( 0, - 1 );
		const pos = [ ...P( UP.x1, UP.y0 ), ...P( UP.x0, UP.y0 ), ...P( UP.x0, UP.y1 ), ...P( UP.x1, UP.y0 ), ...P( UP.x0, UP.y1 ), ...P( UP.x1, UP.y1 ) ];
		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( Array( 6 ).fill( [ nx, 0, nz ] ).flat(), 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( [ 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1 ], 2 ) );
		g.computeBoundingBox();
		g.computeBoundingSphere();
		const mat = standard( {
			name: 'harrys-glass-front', color: new Color( 0.02, 0.025, 0.03 ), roughness: 0.04, metalness: 0.2, transparent: true, depthWrite: false, modules: [ commonModule ],
			surface: /* wgsl */`
	let N = normalize( in.N );
	let V = normalize( frame.cameraPos - in.P );
	let fres = pow( 1.0 - clamp( abs( dot( N, V ) ), 0.0, 1.0 ), 4.0 );
	s.albedo = mat.color;
	s.alpha = 0.12 + 0.55 * fres;
	// the fingerprints and the smears at hand height
	s.roughness = 0.04 + 0.1 * smoothstep( 0.6, 0.9, mx_noise_float2( in.P.xz * 3.0 + in.P.y * 2.0 ) ) * step( in.uv.y, 0.55 );
`,
		} );
		mat.underwaterLighting = 'none';
		mat.setDefine( 'DRY', 1 );
		const m = new Mesh( g, mat );
		m.name = 'harrys-glass-front';
		m.receiveShadow = false;
		this.group.add( m );

	}

	// the TVs: the broadcast as the concourse's screens show it (W2's LiveTV, the third base side's if it's
	// built, else our own)
	_tvs() {

		const place = this.app?.places?.find( ( p ) => p.name === 'concourse3b' || p.name === 'concourse1b' );
		this.tv = place?.tv || null;
		if ( ! this.tv ) {

			this.tv = new LiveTV();
			this.ownTV = true;

		}

		let mat = null;
		place?.group.traverse( ( o ) => {

			if ( o.isMesh && o.material?.name === 'concourse3b-tv' ) mat = o.material;

		} );
		mat ||= place?.tvMat || null;
		if ( ! mat ) {

			mat = standard( { name: 'concourse3b-tv', roughness: 0.15, side: 'double', textures: { c3bTV: this.tv.texture },
				surface: 'let t = textureSample( c3bTV, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.06; s.emissive = t * 1.1;' } );
			mat.underwaterLighting = 'none';
			mat.setDefine( 'DRY', 1 );

		}

		const F = this.F, K = this.harrys.kit, Pk = K.frame( F );
		const pos = [], nrm = [], uv = [];
		for ( const t of this.harrys.tvs ) {

			// the screen's frame: right r, up u, facing n (local)
			let r = [ 1, 0 ], n = [ 0, - 1 ];
			if ( t.face === 'x+' ) { r = [ 0, 1 ]; n = [ 1, 0 ]; }
			if ( t.face === 'x-' ) { r = [ 0, - 1 ]; n = [ - 1, 0 ]; }
			// (facing home the frame's +x is on the viewer's left: the screen's right is -x)
			if ( t.face === - 1 ) r = [ - 1, 0 ];
			const tilt = t.tilt || 0;
			const up = [ n[ 0 ] * Math.sin( tilt ), Math.cos( tilt ), n[ 1 ] * Math.sin( tilt ) ];
			const at = ( a, b, o = 0 ) => {

				const lx = t.x + r[ 0 ] * a + up[ 0 ] * b + n[ 0 ] * o, lz = t.z + r[ 1 ] * a + up[ 2 ] * b + n[ 1 ] * o;
				const [ fx, fz ] = F.field( lx, lz );
				return [ fx, t.y + up[ 1 ] * b, fz ];

			};
			const [ fnx, fnz ] = F.dir( n[ 0 ], n[ 1 ] );
			// the bezel behind, and the screen a hair in front of it
			const hw = t.w / 2 + 0.04, hh = t.h / 2 + 0.04;
			K.use( 'black' ).quad( at( - hw, - hh, - 0.01 ), at( hw, - hh, - 0.01 ), at( hw, hh, - 0.01 ), at( - hw, hh, - 0.01 ), [ fnx, 0, fnz ] );
			K.use( 'black' ).quad( at( hw, - hh, - 0.08 ), at( - hw, - hh, - 0.08 ), at( - hw, hh, - 0.08 ), at( hw, hh, - 0.08 ), [ - fnx, 0, - fnz ] );
			if ( t.crt ) {

				// a tube set: its deep grey cabinet tapering back to the wall bracket
				const d = 0.5, cw = t.w / 2 + 0.09, ch = t.h / 2 + 0.1;
				const c = ( a, b, o ) => at( a, b, - o );
				const [ rx, rz ] = F.dir( r[ 0 ], r[ 1 ] );
				K.use( 'crt' ).quad( c( - cw, - ch, 0.005 ), c( cw, - ch, 0.005 ), c( cw, ch, 0.005 ), c( - cw, ch, 0.005 ), [ fnx, 0, fnz ] );
				K.use( 'crt' ).quad( c( - cw, ch, 0.005 ), c( cw, ch, 0.005 ), c( cw * 0.6, ch * 0.7, d ), c( - cw * 0.6, ch * 0.7, d ), [ 0, 1, 0 ] );
				K.use( 'crt' ).quad( c( cw, - ch, 0.005 ), c( - cw, - ch, 0.005 ), c( - cw * 0.6, - ch * 0.7, d ), c( cw * 0.6, - ch * 0.7, d ), [ 0, - 1, 0 ] );
				K.use( 'crt' ).quad( c( cw, ch, 0.005 ), c( cw, - ch, 0.005 ), c( cw * 0.6, - ch * 0.7, d ), c( cw * 0.6, ch * 0.7, d ), [ rx, 0, rz ] );
				K.use( 'crt' ).quad( c( - cw, - ch, 0.005 ), c( - cw, ch, 0.005 ), c( - cw * 0.6, ch * 0.7, d ), c( - cw * 0.6, - ch * 0.7, d ), [ - rx, 0, - rz ] );
				K.use( 'iron' ).bar( c( 0, - ch * 0.7, d * 0.7 ), c( 0, - ch * 0.7, d + 0.5 ), 0.06 );

			}
			for ( const [ a, b, c ] of [ [ [ - 1, - 1 ], [ 1, - 1 ], [ 1, 1 ] ], [ [ - 1, - 1 ], [ 1, 1 ], [ - 1, 1 ] ] ] ) for ( const [ x, y ] of [ a, b, c ] ) {

				pos.push( ...at( x * t.w / 2, y * t.h / 2, 0.005 ) );
				nrm.push( fnx, 0, fnz );
				uv.push( ( x + 1 ) / 2, ( 1 - y ) / 2 );

			}

			void Pk;

		}

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
		g.computeBoundingBox();
		g.computeBoundingSphere();
		const mesh = new Mesh( g, mat );
		mesh.name = 'harrys-tvs';
		this.group.add( mesh );

	}

	update( dt, director, camera ) {

		if ( ! director ) return;
		const N = nightState( director );
		if ( this.ownTV ) this.tv.update( dt, director, N );
		// ---- the people, on the tempo (every frame while any are seen)
		const cam = camera || this.app?.camera;
		const cf = cam ? this.field.toField( cam.position.x, cam.position.z ) : null;
		const sdt = this._tempo.step( dt, cam );
		N.mood = this.bowl?.crowd?._mood;
		if ( sdt && this.people ) {

			this.people.catchUp = this._tempo.cut;
			this.people.update( Math.min( sdt, 0.25 ), N, cf );

		}

		this.cast.update();
		// the sounds every frame (you hear the bar behind you)
		this.sounds?.update( dt, N, cf );

	}

}
