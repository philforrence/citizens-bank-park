import { InstancedMesh, BufferGeometry, Float32BufferAttribute, Matrix4, Vector3, Quaternion, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';

// The signs held up behind home plate for the camera: poster board, hand-lettered in marker the night
// before (a ruler's pencil lines still under some letters), held over the head in both hands or at the
// chest. One instanced draw; each sign is a board of 28 x 22 inches with its words on one side (an atlas
// cell), placed every frame between its holder's hands (Poses.handsOf).
//
//   const signs = new Signs( parent )
//   signs.show( i, cell, handL, handR, up )   board i between two hand points ( field [ x, y, z ] ),
//                                             facing along `up`'s side (toward center field)
//   signs.hide( i ); signs.update()

// the boards' words: [ lines, ink, board ] (ink and board colours; a few boards are Phillies red)
export const SIGNS = [
	// the 27th
	[ [ 'RAIN?', "WE'RE FROM", 'PHILLY' ], '#0b1a55', '#f4f1ea' ],
	[ [ 'WE', 'BELIEVE' ], '#b3121c', '#f4f1ea' ],
	[ [ 'HI MOM', 'IN BOCA!' ], '#0b1a55', '#f7f0c0' ],
	[ [ 'PHILLIES', 'PHAITHFUL' ], '#ffffff', '#a50f1a' ],
	[ [ 'ONE', 'MORE', 'WIN' ], '#b3121c', '#f4f1ea' ],
	[ [ 'RED', 'OCTOBER' ], '#ffffff', '#a50f1a' ],
	// the 29th
	[ [ 'SUSPENDED...', 'NOT', 'DEFEATED' ], '#0b1a55', '#f4f1ea' ],
	[ [ 'FINISH', 'IT!' ], '#b3121c', '#f4f1ea' ],
	[ [ '28 YEARS', 'IS LONG', 'ENOUGH' ], '#0b1a55', '#f4f1ea' ],
	[ [ 'LIGHTS OUT', 'LIDGE' ], '#ffffff', '#a50f1a' ],
	[ [ 'HARRY,', 'CALL IT!' ], '#b3121c', '#f4f1ea' ],
	[ [ '3 MORE', 'OUTS' ], '#0b1a55', '#f4f1ea' ],
	[ [ '2 MORE', 'OUTS' ], '#0b1a55', '#f4f1ea' ],
	[ [ '1 MORE', 'OUT!!' ], '#b3121c', '#f4f1ea' ],
	// the last out
	[ [ 'WORLD', 'CHAMPS!' ], '#b3121c', '#f4f1ea' ],
	[ [ '1980', '2008' ], '#ffffff', '#a50f1a' ],
];
export const SIGN = Object.fromEntries( SIGNS.map( ( s, i ) => [ s[ 0 ].join( ' ' ), i ] ) );
const GRID = 4; // cells per side (each cell 256 x 256, the board drawn in its top 256 x 200)
const ASPECT = 200 / 256;
export const BOARD = { w: 0.71, h: 0.56 };

function drawAtlas() {

	return canvasTexture( 1024, 1024, ( ctx ) => {

		ctx.fillStyle = '#f0ede6';
		ctx.fillRect( 0, 0, 1024, 1024 );
		SIGNS.forEach( ( [ lines, ink, board ], i ) => {

			const x0 = ( i % GRID ) * 256, y0 = Math.floor( i / GRID ) * 256, W = 256, H = 200;
			ctx.save();
			ctx.fillStyle = board;
			ctx.fillRect( x0, y0, W, H );
			// the pencil guide lines on the white boards
			if ( board !== '#a50f1a' ) {

				ctx.strokeStyle = 'rgba( 90, 90, 90, 0.12 )';
				ctx.lineWidth = 1;
				for ( let k = 1; k < 5; k ++ ) {

					ctx.beginPath();
					ctx.moveTo( x0 + 12, y0 + k * H / 5 );
					ctx.lineTo( x0 + W - 12, y0 + k * H / 5 + 2 );
					ctx.stroke();

				}

			}

			// the words, in marker: each line as big as fits, a little crooked
			ctx.fillStyle = ink;
			ctx.strokeStyle = ink;
			ctx.lineJoin = 'round';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			const n = lines.length, lh = ( H - 24 ) / n;
			lines.forEach( ( line, k ) => {

				const size = Math.min( lh * 0.92, 300 / Math.max( 3, line.length ) * 1.05 );
				ctx.font = `900 ${ size.toFixed( 0 ) }px "Marker Felt", "Chalkboard SE", "Comic Sans MS", "Arial Black", sans-serif`;
				ctx.save();
				ctx.translate( x0 + W / 2 + ( ( ( i * 7 + k * 3 ) % 5 ) - 2 ) * 2, y0 + 12 + lh * ( k + 0.5 ) );
				ctx.rotate( ( ( ( i * 5 + k * 11 ) % 7 ) - 3 ) * 0.012 );
				ctx.lineWidth = size * 0.07;
				ctx.strokeText( line, 0, 0, W - 22 );
				ctx.fillText( line, 0, 0, W - 22 );
				ctx.restore();

			} );
			// a red underline or border on a couple
			if ( i % 5 === 1 ) {

				ctx.strokeStyle = '#b3121c';
				ctx.lineWidth = 6;
				ctx.strokeRect( x0 + 6, y0 + 6, W - 12, H - 12 );

			}

			ctx.restore();

		} );

	}, 'homeSigns' );

}

// the board: its printed face (uv in the cell), its back (uv.x < 0) and edges
function boardGeometry() {

	const { w, h } = BOARD, t = 0.004;
	const pos = [], nrm = [], uv = [];
	const quad = ( a, b, c, d, n, ua, ub, uc, ud ) => {

		for ( const [ p, u ] of [ [ a, ua ], [ b, ub ], [ c, uc ], [ a, ua ], [ c, uc ], [ d, ud ] ] ) {

			pos.push( ...p ); nrm.push( ...n ); uv.push( ...u );

		}

	};
	const X = w / 2, Y = h / 2;
	// the front faces -z (toward the camera out on the field when held up by someone facing it)
	// (seen from in front, looking along +z, the viewer's right is -x: the words run from +x to -x)
	quad( [ X, - Y, - t ], [ - X, - Y, - t ], [ - X, Y, - t ], [ X, Y, - t ], [ 0, 0, - 1 ], [ 0, ASPECT ], [ 1, ASPECT ], [ 1, 0 ], [ 0, 0 ] );
	quad( [ - X, - Y, t ], [ X, - Y, t ], [ X, Y, t ], [ - X, Y, t ], [ 0, 0, 1 ], [ - 1, 0 ], [ - 1, 0 ], [ - 1, 0 ], [ - 1, 0 ] );
	quad( [ - X, Y, - t ], [ X, Y, - t ], [ X, Y, t ], [ - X, Y, t ], [ 0, 1, 0 ], [ - 1, 0 ], [ - 1, 0 ], [ - 1, 0 ], [ - 1, 0 ] );
	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
	g.computeBoundingSphere();
	return g;

}

export class Signs {

	constructor( parent, max = 16 ) {

		this.max = max;
		this.atlas = drawAtlas();
		const mat = standard( { name: 'home-signs', roughness: 0.75, side: 'double', textures: { hsAtlas: this.atlas },
			varyings: { vCell: 'f32', vUV: 'vec2f' },
			vertex: 'o.vCell = v.color.r; o.vUV = v.uv;',
			surface: /* wgsl */`
	let uv = in.vs.vUV;
	let cell = floor( in.vs.vCell + 0.5 );
	if ( uv.x >= 0.0 ) {
		let cuv = ( vec2f( cell % ${ GRID }.0, floor( cell / ${ GRID }.0 ) ) + vec2f( uv.x, uv.y ) ) / ${ GRID }.0;
		s.albedo = textureSample( hsAtlas, smpAnisoClamp, cuv ).rgb;
	} else {
		// the back: the board's plain white, a strip of tape
		s.albedo = vec3f( 0.68, 0.67, 0.64 );
	}
	// wet and wavy on the 27th
	s.roughness = mix( 0.75, 0.35, frame.wet );
	s.emissive = s.albedo * smoothstep( 0.15, 0.7, frame.night ) * 0.12;
` } );
		mat.underwaterLighting = 'none';
		mat.setDefine( 'DRY', 1 );
		this.mesh = new InstancedMesh( boardGeometry(), mat, max );
		this.mesh.name = 'home-signs';
		this.mesh.frustumCulled = false;
		this.mesh.castShadow = false;
		this.mesh.userData.dynamic = true;
		const c = new Color();
		for ( let i = 0; i < max; i ++ ) this.mesh.setColorAt( i, c.setRGB( 0, 0, 0 ) );
		this.mesh.count = 0;
		parent.add( this.mesh );
		this.slots = new Array( max ).fill( null );
		this._m = new Matrix4(); this._q = new Quaternion(); this._v = new Vector3(); this._s = new Vector3( 1, 1, 1 );
		this._x = new Vector3(); this._y = new Vector3(); this._z = new Vector3(); this._c = new Color();

	}

	// board i held between the hands (field points), its face toward `face` ( [ x, z ] direction it faces)
	show( i, cell, hl, hr, face, tilt = 0 ) {

		this.slots[ i ] = { cell, hl, hr, face, tilt };

	}

	hide( i ) {

		this.slots[ i ] = null;

	}

	update() {

		let n = 0;
		const M = this._m, X = this._x, Y = this._y, Z = this._z;
		for ( const s of this.slots ) {

			if ( ! s ) continue;
			// across: hand to hand; up: the world's, leaned back a little; out of the face: -Z
			X.set( s.hr[ 0 ] - s.hl[ 0 ], 0, s.hr[ 2 ] - s.hl[ 2 ] );
			if ( X.lengthSq() < 1e-4 ) X.set( - s.face[ 1 ], 0, s.face[ 0 ] );
			X.normalize();
			// the face points along `face`: the board's -z toward it
			Z.set( - s.face[ 0 ], 0, - s.face[ 1 ] ).normalize();
			// keep X square to the face
			X.sub( this._v.copy( Z ).multiplyScalar( X.dot( Z ) ) ).normalize();
			// -z is the face: X must be the face's right, so flip if it isn't
			Y.crossVectors( Z, X );
			if ( Y.y < 0 ) X.negate(), Y.negate();
			// a tilt back (held up high, the top leans away)
			Y.applyAxisAngle( X, - s.tilt );
			Z.crossVectors( X, Y );
			M.makeBasis( X, Y, Z );
			// between the hands, the board's lower third at their height
			M.setPosition( ( s.hl[ 0 ] + s.hr[ 0 ] ) / 2, ( s.hl[ 1 ] + s.hr[ 1 ] ) / 2 + BOARD.h * 0.2, ( s.hl[ 2 ] + s.hr[ 2 ] ) / 2 );
			this.mesh.setMatrixAt( n, M );
			this.mesh.setColorAt( n, this._c.setRGB( s.cell, 0, 0 ) );
			n ++;

		}

		this.mesh.count = n;
		this.mesh.instanceMatrix.needsUpdate = true;
		if ( this.mesh.instanceColor ) this.mesh.instanceColor.needsUpdate = true;

	}

}
