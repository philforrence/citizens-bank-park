import { InstancedMesh, BufferGeometry, Float32BufferAttribute, Matrix4, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { BONES, NB } from '../../game/Rig.js';

// ---- FR1: the purple orchid leis (wave 3's R.md, "the celebration's small true things"). Victorino's
// family brought Hawaiian leis down to the field, and by the time the players were up on the stage
// Victorino wore two and Lidge, Rollins and the others had one each over the grey champions tee
// (puffygreenjacket 2993502271, ~10:18 pm; pompomflipflop 2985514327, 2985882973; Getty 83487707: two
// purple orchid leis on Victorino). The family themselves aren't drawn here (private people).
//
// Each lei is a ring of orchids laid round the base of the neck in the rig's bind pose, on the shoulders
// at the sides, over the upper back behind and hanging to the chest in front, carried by the man's torso
// bone: its instance matrix is his torso's skinning matrix out of the rig's bones (Players.data), set as
// the mesh is about to be drawn (after the rig has posed everyone this frame). One draw for all of them.

// who wears one, from when (seconds after the last out): Victorino two; Lidge, Rollins, Werth, Ruiz
const WEARERS = [ [ 425664, 178, 1 ], [ 425664, 178, 2 ], [ 400058, 181, 1 ], [ 276519, 183, 1 ], [ 150029, 186, 1 ], [ 434563, 190, 1 ] ];

function leiGeometry( second ) {

	const pos = [], nrm = [], uv = [], idx = [];
	const N = 56, M = 6, s = second ? 1.07 : 1, dy = second ? - 0.035 : 0;
	// the lei's line round the neck (bind pose: the man faces -z): sides on the trapezius, the back over
	// the top of the back, the front hanging to the chest
	const at = ( t ) => {

		const c = Math.cos( t ), sn = Math.sin( t ), front = Math.max( 0, c ), back = Math.max( 0, - c );
		// (out over the chest as it hangs: the tee stands off the body there)
		return [ 0.15 * sn * s * ( 1 - 0.35 * front ), 1.615 + dy - 0.27 * s * Math.pow( front, 1.4 ) - 0.07 * back, 0.01 - ( c > 0 ? 0.25 * s : 0.155 * s ) * c ];

	};
	for ( let i = 0; i <= N; i ++ ) {

		const t = i / N * Math.PI * 2, p = at( t ), q = at( t + 0.01 );
		let tx = q[ 0 ] - p[ 0 ], ty = q[ 1 ] - p[ 1 ], tz = q[ 2 ] - p[ 2 ];
		const tl = Math.hypot( tx, ty, tz );
		tx /= tl; ty /= tl; tz /= tl;
		// a frame round the line: out from the neck, and up
		let ox = p[ 0 ], oz = p[ 2 ] - 0.01;
		const ol = Math.hypot( ox, oz ) || 1;
		ox /= ol; oz /= ol;
		const bx = ty * oz - tz * 0, by = tz * ox - tx * oz, bz = tx * 0 - ty * ox;
		// the blooms: the thickness swells and narrows, flower by flower
		const r = 0.027 + 0.01 * Math.abs( Math.sin( i * Math.PI * 0.5 ) );
		for ( let k = 0; k <= M; k ++ ) {

			const a = k / M * Math.PI * 2, ca = Math.cos( a ), sa = Math.sin( a );
			const nx = ox * ca + bx * sa, ny = by * sa, nz = oz * ca + bz * sa;
			pos.push( p[ 0 ] + nx * r, p[ 1 ] + ny * r * 0.8, p[ 2 ] + nz * r );
			nrm.push( nx, ny, nz );
			uv.push( i / N * 28, k / M );

		}

	}

	for ( let i = 0; i < N; i ++ ) for ( let k = 0; k < M; k ++ ) {

		const a = i * ( M + 1 ) + k, b = a + M + 1;
		idx.push( a, b, a + 1, a + 1, b, b + 1 );

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
	g.setIndex( idx );
	return g;

}

export class Leis {

	constructor( group, app ) {

		this.app = app; // (its players, the rig, are made after the places)
		const mat = standard( {
			name: 'rituals-leis', color: new Color( 0.42, 0.1, 0.58 ), roughness: 0.7,
			// purple dendrobium orchids, their pale throats, the night's light on them
			surface: /* wgsl */`
	let f = fract( in.uv.x );
	let throat = smoothstep( 0.35, 0.0, abs( f - 0.5 ) ) * smoothstep( 0.2, 0.6, fract( in.uv.y * 2.0 + 0.25 ) );
	s.albedo = mix( mat.color, vec3f( 0.78, 0.7, 0.8 ), throat * 0.55 );
	s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.18;
`,
		} );
		mat.underwaterLighting = 'none';
		// two shapes: the one lei, and a second a little bigger and lower (Victorino's two)
		this.meshes = [ false, true ].map( ( second ) => {

			const m = new InstancedMesh( leiGeometry( second ), mat, WEARERS.length );
			m.name = 'rituals-leis';
			m.frustumCulled = false;
			m.castShadow = false;
			m.userData.dynamic = true;
			m.count = 0;
			m.visible = false;
			m.onBeforeRender = () => this._place();
			group.add( m );
			return m;

		} );
		this._m = new Matrix4();
		this._on = [];

	}

	// cel: seconds since the last out (null otherwise); director: who's where on the rig
	update( cel, director ) {

		this._on.length = 0;
		if ( cel != null && director?.slots ) for ( const [ id, t0, n ] of WEARERS ) {

			if ( cel < t0 ) continue;
			const s = director.slots.get( id );
			if ( s && s.visible !== false ) this._on.push( [ s, n ] );

		}

		for ( const m of this.meshes ) m.visible = this._on.length > 0;

	}

	// as it's drawn: each lei on its wearer's torso, as the rig posed him this frame
	_place() {

		const D = this.app?.players?.data;
		if ( ! D ) return;
		const c = [ 0, 0 ];
		for ( const [ s, n ] of this._on ) {

			const mesh = this.meshes[ n - 1 ];
			this._m.fromArray( D, s.slot * NB * 16 + BONES.torso * 16 );
			mesh.setMatrixAt( c[ n - 1 ] ++, this._m );

		}

		for ( let i = 0; i < 2; i ++ ) {

			this.meshes[ i ].count = c[ i ];
			if ( c[ i ] ) this.meshes[ i ].instanceMatrix.needsUpdate = true;

		}

	}

}
