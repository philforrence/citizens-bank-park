import { Group, Mesh, BufferGeometry, Float32BufferAttribute, BoxGeometry, CylinderGeometry, Vector2, Vector3, Color, MathUtils } from '../engine/index.js';
import { triangulateShape } from '../engine/math/ShapeUtils.js';
import { ShaderModule } from '../engine/gpu/Shader.js';
import { Texture } from '../engine/gpu/Texture.js';
import { generateMipmaps } from '../engine/gpu/Mipmaps.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { standard } from '../materials/Materials.js';
import { beam, canvasTexture } from './geo.js';
import {
	FT, FIELD_BEARING, BASE, MOUND_CENTER, RUBBER_FRONT, MOUND_RADIUS, MOUND_HEIGHT,
	FOOTPRINT, OUTFIELD, FOUL_TERRITORY, FOUL_WALL_HEIGHT, DUGOUTS, BULLPENS, LEVELS, fencePoint, fieldBoundary,
} from './layout.js';

// The playing field: grass, the infield skin, the mound, the bases, the chalk, the warning track, the
// outfield fence, the foul poles, the low wall round foul territory and the dugouts. Built in the field
// frame (layout.js) inside `this.group`, which turns it onto the compass.
//
// The ground inside the stadium footprint is one surface: its shader decides per pixel between grass
// (mown in a checkerboard that turns light / dark with the view, like real mowing stripes), dirt, the
// warning track, chalk and the concrete apron outside the fence (the seating bowl goes there later).

const TRACK = 15 * FT; // warning track width
const PATH = 2 * FT; // half width of the dirt path along the baselines
const GRASS_INSET = 7 * FT; // infield grass edge inside the first-second / second-third baselines
const ARC = 95 * FT; // infield skin radius from the front of the rubber
const PLATE_CIRCLE = 13 * FT;
export const DUGOUT_DEPTH = 1.2; // dugout floor below the field
export const DUGOUT_WIDTH = 2.6; // front to back
export const DUGOUT_ROOF = 1.75; // top of the roof above the field (its navy front 0.45 m deep)
// along the wall from the dugout's home plate end: the low home camera well, then the dugout under its
// roof, then (the last `far` metres) the well for the low base-line cameras and the photographers
export const DUGOUT_ZONES = { home: 2.2, far: 6.0 };

const f = ( x ) => {

	const s = String( Math.round( x * 1e4 ) / 1e4 );
	return s.includes( '.' ) || s.includes( 'e' ) ? s : s + '.0';

};
const wgslArray = ( name, pts ) => `var<private> ${ name }: array<vec2f, ${ pts.length }> = array<vec2f, ${ pts.length }>(\n\t${ pts.map( ( [ x, z ] ) => `vec2f( ${ f( x ) }, ${ f( z ) } )` ).join( ',\n\t' ) }\n);`;

export class Field {

	constructor( { scene, colliders } ) {

		this.colliders = colliders;
		this.group = new Group();
		this.group.name = 'field';
		this.group.rotation.y = - MathUtils.degToRad( FIELD_BEARING );
		// the field is 23 ft below the street (world y = 0 is street level)
		this.y0 = - LEVELS.mainConcourse;
		this.group.position.y = this.y0;
		scene.add( this.group );
		this.group.updateMatrixWorld( true );
		this._cos = Math.cos( this.group.rotation.y );
		this._sin = Math.sin( this.group.rotation.y );

		this.boundary = fieldBoundary();
		this.dugouts = Object.entries( DUGOUTS ).map( ( [ side, [ a, b ] ] ) => this._dugoutFrame( side, a, b ) );

		this._buildSurface();
		this._buildMound();
		this._buildBases();
		this._buildFence();
		this._buildDistanceMarkers();
		this._buildFoulPoles();
		for ( const d of this.dugouts ) this._buildDugout( d );
		this._buildBullpens();

	}

	// ---------------------------------------------------------------- frames

	// field frame -> world (x, z)
	toWorld( x, z, out = new Vector3() ) {

		return out.set( x * this._cos + z * this._sin, 0, - x * this._sin + z * this._cos );

	}

	// world -> field frame [ x, z ]
	toField( x, z ) {

		return [ x * this._cos - z * this._sin, x * this._sin + z * this._cos ];

	}

	// ground height (world x, z): the mound, the dugout floors, else the field level; the bowl (Bowl.js)
	// wraps this with the street level round the pit
	heightAt( wx, wz ) {

		return this.y0 + this.fieldHeightAt( ...this.toField( wx, wz ) );

	}

	// the same in the field frame, above the field
	fieldHeightAt( x, z ) {

		for ( const d of this.dugouts ) if ( this._inDugout( d, x, z ) ) return - DUGOUT_DEPTH;
		let h = moundHeight( x, z );
		for ( const m of this.pens || [] ) h = Math.max( h, m.y + bumpHeight( x - m.x, z - m.z ) );
		return h;

	}

	// ---------------------------------------------------------------- surface

	_buildSurface() {

		// the footprint, with the dugout pits cut out
		const contour = FOOTPRINT.map( ( [ x, z ] ) => new Vector2( x, z ) );
		const holes = this.dugouts.map( ( d ) => d.pit.map( ( [ x, z ] ) => new Vector2( x, z ) ) );
		const tris = triangulateShape( contour, holes );
		const all = contour.concat( ...holes );
		const pos = [], nrm = [], uv = [];
		for ( const p of all ) {

			pos.push( p.x, 0, p.y );
			nrm.push( 0, 1, 0 );
			uv.push( p.x, p.y );

		}

		const index = [];
		for ( const [ a, b, c ] of tris ) index.push( a, c, b ); // counter-clockwise seen from above
		const geo = new BufferGeometry();
		geo.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		geo.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
		geo.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
		geo.setIndex( index );
		geo.computeBoundingBox();
		geo.computeBoundingSphere();

		this.surfaceMaterial = fieldMaterial( this.boundary, this.group.rotation.y );
		this.surfaceMaterial.setDefine( 'DRY', 1 ); // the field has its own wetness and puddles (the wet uniform)
		const mesh = new Mesh( geo, this.surfaceMaterial );
		mesh.name = 'field-surface';
		mesh.receiveShadow = true;
		this.group.add( mesh );

	}

	_buildMound() {

		// a polar grid over the mound circle, raised by moundHeight(); same surface shader (it's dirt)
		const RINGS = 14, SEG = 72;
		const pos = [], nrm = [], uv = [], index = [];
		const cz = - MOUND_CENTER;
		for ( let r = 0; r <= RINGS; r ++ ) {

			const rad = MOUND_RADIUS * r / RINGS;
			for ( let s = 0; s < SEG; s ++ ) {

				const a = s / SEG * Math.PI * 2;
				const x = Math.cos( a ) * rad, z = cz + Math.sin( a ) * rad;
				pos.push( x, moundHeight( x, z ) + 0.002, z );
				uv.push( x, z );
				nrm.push( 0, 1, 0 );
				if ( r === 0 ) break;

			}

		}

		const ring = ( r, s ) => r === 0 ? 0 : 1 + ( r - 1 ) * SEG + ( s % SEG );
		for ( let r = 0; r < RINGS; r ++ ) {

			for ( let s = 0; s < SEG; s ++ ) {

				if ( r === 0 ) index.push( 0, ring( 1, s + 1 ), ring( 1, s ) );
				else index.push( ring( r, s ), ring( r, s + 1 ), ring( r + 1, s + 1 ), ring( r, s ), ring( r + 1, s + 1 ), ring( r + 1, s ) );

			}

		}

		const geo = new BufferGeometry();
		geo.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		geo.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
		geo.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
		geo.setIndex( index );
		geo.computeVertexNormals();
		// computeVertexNormals follows the winding: make sure they point up
		const n = geo.getAttribute( 'normal' );
		if ( n.array[ 1 ] < 0 ) for ( let i = 0; i < n.array.length; i ++ ) n.array[ i ] = - n.array[ i ];
		geo.computeBoundingSphere();
		const mesh = new Mesh( geo, this.surfaceMaterial );
		mesh.name = 'mound';
		mesh.receiveShadow = true;
		mesh.castShadow = true;
		this.group.add( mesh );

	}

	_buildBases() {

		const white = standard( { name: 'bases', color: new Color( 0.82, 0.82, 0.8 ), roughness: 0.6 } );
		white.underwaterLighting = 'none';
		const add = ( geo, x, y, z, ry = 0 ) => {

			const m = new Mesh( geo, white );
			m.position.set( x, y, z );
			m.rotation.y = ry;
			m.castShadow = true;
			m.receiveShadow = true;
			this.group.add( m );
			return m;

		};

		// bases: 15 in square, 3 in high, turned 45 degrees with the diamond. First and third sit inside
		// fair territory with their outer corner on the 90 ft point; second is centred on its point.
		const S = 15 / 12 * FT, T = 3 / 12 * FT;
		const baseGeo = new BoxGeometry( S, T, S );
		const r2 = Math.SQRT1_2;
		const along = ( a, b ) => [ a * r2 - b * r2, - a * r2 - b * r2 ]; // (along 1B line, along 3B line) -> field
		const [ x1, z1 ] = along( BASE - S / 2, S / 2 );
		const [ x2, z2 ] = along( BASE, BASE );
		const [ x3, z3 ] = along( S / 2, BASE - S / 2 );
		for ( const [ x, z ] of [ [ x1, z1 ], [ x2, z2 ], [ x3, z3 ] ] ) add( baseGeo, x, T / 2, z, Math.PI / 4 );

		// home plate: a pentagon 17 in wide, the back tip at the origin
		const w = 17 / 12 * FT / 2, d = 17 / 12 * FT, s = 8.5 / 12 * FT;
		const outline = [ [ 0, 0 ], [ w, - ( d - s ) ], [ w, - d ], [ - w, - d ], [ - w, - ( d - s ) ] ];
		add( slab( outline, 0.02 ), 0, 0, 0 );

		// the pitcher's rubber: 24 x 6 in, its front edge 60 ft 6 in from home plate
		// the rubber sits nearly flush in the clay: a centimetre or two of white showing
		const rub = new BoxGeometry( 24 / 12 * FT, 0.05, 6 / 12 * FT );
		const rz = - RUBBER_FRONT - 3 / 12 * FT;
		add( rub, 0, moundHeight( 0, rz ) - 0.01, rz );
		// the rosin bag on the back of the mound
		const rosin = new Mesh( new BoxGeometry( 0.12, 0.05, 0.08 ), this._rosinMat || ( this._rosinMat = standard( { name: 'rosin-bag', color: new Color( 0.78, 0.76, 0.72 ), roughness: 0.95 } ) ) );
		this._rosinMat.underwaterLighting = 'none';
		rosin.position.set( 0.35, moundHeight( 0.35, rz - 0.6 ) + 0.02, rz - 0.6 );
		rosin.rotation.y = 0.4;
		this.group.add( rosin );

	}

	// ---------------------------------------------------------------- walls

	_buildFence() {

		// the 2008 pads: teal vinyl
		const pad = this._padMat = standard( { name: 'wall-padding', color: new Color( 0.027, 0.168, 0.133 ), roughness: 0.55, modules: [ commonModule ],
			surface: /* wgsl */`
	// vinyl pads 1.28 m wide, a dark seam between them
	let seam = 1.0 - ( 1.0 - smoothstep( 0.0, 0.02 + fwidth( in.uv.x ), abs( fract( in.uv.x / 1.28 + 0.5 ) - 0.5 ) * 1.28 ) ) * ( 1.0 - clamp( fwidth( in.uv.x ) * 8.0, 0.0, 1.0 ) ) * 0.5;
	s.albedo = mat.color * seam * ( 0.93 + 0.1 * mx_noise_float2( in.uv * vec2f( 0.7, 3.0 ) ) );
	s.sheenColor = vec3f( 0.06 );
	// under the lights, lit from every bank (a lift the spots alone miss)
	s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.35;
` } );
		// behind home plate the wall is red brick under a teal padded cap
		const brick = standard( { name: 'backstop-brick', color: new Color( 0.26, 0.07, 0.04 ), roughness: 0.85,
			surface: /* wgsl */`
	let v = in.uv.y; let u = in.uv.x;
	let row = floor( v / 0.075 );
	let bu = u / 0.2 + 0.5 * ( row % 2.0 );
	let fr = clamp( fwidth( v ) / 0.075 * 1.5 - 0.25, 0.0, 1.0 );
	let mortar = clamp( mix( step( 0.88, fract( v / 0.075 ) ), 0.12, fr ) + mix( step( 0.93, fract( bu ) ), 0.07, fr ), 0.0, 1.0 );
	let tone = mix( 0.82 + 0.3 * fract( sin( dot( vec2f( floor( bu ), row ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 ), 0.97, fr );
	s.albedo = mix( mat.color * tone, vec3f( 0.42, 0.4, 0.36 ), mortar * 0.8 );
	// the teal pad along the top
	if ( v > ${ ( 4.5 * 0.3048 - 0.3 ).toFixed( 3 ) } ) { s.albedo = vec3f( 0.02, 0.13, 0.12 ); s.roughness = 0.6; }
	s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.35;
` } );
		const tealCap = standard( { name: 'backstop-cap', color: new Color( 0.02, 0.13, 0.12 ), roughness: 0.6, surface: 's.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.35;' } );
		const trim = standard( { name: 'wall-trim', color: new Color( 0.75, 0.55, 0.02 ), roughness: 0.6 } );
		const cap = standard( { name: 'wall-cap', color: new Color( 0.2, 0.2, 0.19 ), roughness: 0.8 } );
		for ( const m of [ pad, trim, cap, brick, tealCap ] ) m.underwaterLighting = 'none';

		// outfield fence, pole to pole: padding and a cap (no yellow line along the top in 2008: only the
		// home run stripes at the 387 and 409 corners)
		const out = OUTFIELD.map( ( [ a, d, h ] ) => ( { p: fencePoint( a, d ), h: h * FT } ) );
		this._wall( out, { pad, trim: null, cap, thickness: 0.45, name: 'outfield-wall' } );
		for ( const ft of [ 387, 409 ] ) {

			const k = OUTFIELD.findIndex( ( [ , d ] ) => Math.round( d ) === ft );
			if ( k < 0 ) continue;
			const [ a, d, h ] = OUTFIELD[ k ];
			const [ sx, sz ] = fencePoint( a, d - 0.03 );
			const st = new Mesh( new BoxGeometry( 0.1, h * FT, 0.03 ), trim );
			st.position.set( sx, h * FT / 2, sz );
			st.rotation.y = Math.atan2( sx, sz );
			this.group.add( st );

		}

		// the low wall in front of the stands in foul territory, broken by the dugouts
		const poleL = fencePoint( OUTFIELD[ 0 ][ 0 ], OUTFIELD[ 0 ][ 1 ] );
		const poleR = fencePoint( OUTFIELD[ OUTFIELD.length - 1 ][ 0 ], OUTFIELD[ OUTFIELD.length - 1 ][ 1 ] );
		const foul = [ poleR, ...FOUL_TERRITORY, poleL ];
		const h = FOUL_WALL_HEIGHT * FT;
		// split the run at the dugout openings
		let run = [];
		const runs = [];
		for ( let i = 0; i < foul.length; i ++ ) {

			const p = foul[ i ];
			run.push( { p, h } );
			const q = foul[ i + 1 ];
			if ( ! q ) break;
			for ( const d of this.dugouts ) {

				// the dugout's front edge lies on this segment: end the run at its near end, restart at its far end
				const ta = segmentParam( p, q, d.a ), tb = segmentParam( p, q, d.b );
				if ( ta !== null && tb !== null ) {

					const [ n, m ] = ta < tb ? [ d.a, d.b ] : [ d.b, d.a ];
					run.push( { p: n, h } );
					runs.push( run );
					run = [ { p: m, h } ];

				}

			}

		}

		runs.push( run );
		// the run between the dugouts (behind home) in brick, the rest padded
		runs.forEach( ( r, i ) => {

			if ( r.length < 2 ) return;
			const home = i > 0 && i < runs.length - 1;
			this._wall( r, home ? { pad: brick, trim: null, cap: tealCap, thickness: 0.35, name: 'backstop-wall' } : { pad, trim: null, cap, thickness: 0.35, name: 'foul-wall' } );
			// the dark green pipe rail on top down the lines (behind home the net does the job)
			if ( ! home ) this._pipeRail( r.map( ( q ) => q.p ), h, 0.2 );

		} );

	}

	// A dark green pipe rail along the top of a wall: posts every 1.8 m, top and mid rails, pickets
	// (an alpha-tested panel) between
	_pipeRail( P, y0, back ) {

		const green = this._railGreen || ( this._railGreen = standard( { name: 'field-rail', color: new Color( 0.015, 0.06, 0.035 ), roughness: 0.45, metalness: 0.6 } ) );
		const pick = this._railPickets || ( this._railPickets = standard( { name: 'field-rail-pickets', color: new Color( 0.015, 0.06, 0.035 ), roughness: 0.45, metalness: 0.6, side: 'double', alphaTest: 0.5,
			surface: 'let f = fwidth( in.uv.x ) / 0.12; s.alpha = max( step( 0.42 - f, abs( fract( in.uv.x / 0.12 ) - 0.5 ) ), clamp( f * 0.5, 0.0, 0.5 ) );' } ) );
		for ( const m of [ green, pick ] ) m.underwaterLighting = 'none';
		const q = new Quads(), pq = new Quads();
		let u = 0;
		for ( let i = 0; i < P.length - 1; i ++ ) {

			const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			if ( len < 0.2 ) continue;
			let nx = - ( bz - az ) / len, nz = ( bx - ax ) / len;
			if ( nx * ( 0 - ( ax + bx ) / 2 ) + nz * ( - BASE * Math.SQRT2 - ( az + bz ) / 2 ) > 0 ) {

				nx = - nx; nz = - nz;

			}

			// n now points away from the field: the rail sits a little back on the cap
			const at = ( t, y ) => [ ax + ( bx - ax ) * t + nx * back, y, az + ( bz - az ) * t + nz * back ];
			beam( q, at( 0, y0 + 0.95 ), at( 1, y0 + 0.95 ), 0.05 );
			beam( q, at( 0, y0 + 0.45 ), at( 1, y0 + 0.45 ), 0.035 );
			const n = Math.max( 1, Math.round( len / 1.8 ) );
			for ( let k = 0; k <= n; k ++ ) beam( q, at( k / n, y0 ), at( k / n, y0 + 0.97 ), 0.05 );
			pq.tri( at( 0, y0 + 0.05 ), at( 1, y0 + 0.05 ), at( 1, y0 + 0.93 ), [ - nx, 0, - nz ], [ u, 0 ], [ u + len, 0 ], [ u + len, 1 ] );
			pq.tri( at( 0, y0 + 0.05 ), at( 1, y0 + 0.93 ), at( 0, y0 + 0.93 ), [ - nx, 0, - nz ], [ u, 0 ], [ u + len, 1 ], [ u, 1 ] );
			u += len;

		}

		for ( const [ g, m ] of [ [ q, green ], [ pq, pick ] ] ) {

			if ( ! g.count ) continue;
			const mesh = new Mesh( g.geometry(), m );
			mesh.name = 'field-rail';
			mesh.castShadow = true;
			this.group.add( mesh );

		}

	}

	// A wall along a polyline of { p: [ x, z ], h }: padded face toward the field, cap on top, plain back.
	// Adds a solid collider per segment.
	_wall( pts, { pad, trim, cap, thickness, name } ) {

		const face = new Quads(), band = new Quads(), top = new Quads();
		const BAND = 0.15;
		let u = 0;
		for ( let i = 0; i < pts.length - 1; i ++ ) {

			const A = pts[ i ], B = pts[ i + 1 ];
			const [ ax, az ] = A.p, [ bx, bz ] = B.p;
			const len = Math.hypot( bx - ax, bz - az );
			if ( len < 1e-3 ) {

				// a step in the height: close the taller wall's end, square to the next segment
				const C = pts[ i + 2 ] || pts[ i - 1 ];
				if ( ! C || Math.abs( A.h - B.h ) < 0.01 ) continue;
				const [ cx, cz ] = C.p;
				const l2 = Math.hypot( cx - ax, cz - az ) || 1;
				const tx = ( cx - ax ) / l2, tz = ( cz - az ) / l2;
				let nx = - tz, nz = tx;
				if ( nx * ( 0 - ax ) + nz * ( - BASE * Math.SQRT2 - az ) < 0 ) {

					nx = - nx; nz = - nz;

				}

				const lo = Math.min( A.h, B.h ), hi = Math.max( A.h, B.h );
				const ox = - nx * thickness, oz = - nz * thickness;
				const dir = C === pts[ i + 2 ] ? - 1 : 1; // the cap faces away from the lower wall
				face.add( [ ax, lo, az ], [ ax + ox, lo, az + oz ], [ ax + ox, hi, az + oz ], [ ax, hi, az ], [ tx * dir, 0, tz * dir ], u, u + thickness );
				continue;

			}

			// the normal toward the field: toward second base
			let nx = - ( bz - az ) / len, nz = ( bx - ax ) / len;
			const mx = ( ax + bx ) / 2, mz = ( az + bz ) / 2;
			if ( nx * ( 0 - mx ) + nz * ( - BASE * Math.SQRT2 - mz ) < 0 ) {

				nx = - nx; nz = - nz;

			}

			const ox = - nx * thickness, oz = - nz * thickness; // back face offset (away from the field)
			const ha = A.h, hb = B.h;
			const lo = trim ? BAND : 0;
			face.add( [ ax, 0, az ], [ bx, 0, bz ], [ bx, hb - lo, bz ], [ ax, ha - lo, az ], [ nx, 0, nz ], u, u + len );
			if ( trim ) band.add( [ ax, ha - BAND, az ], [ bx, hb - BAND, bz ], [ bx, hb, bz ], [ ax, ha, az ], [ nx, 0, nz ], u, u + len );
			top.add( [ ax, ha, az ], [ bx, hb, bz ], [ bx + ox, hb, bz + oz ], [ ax + ox, ha, az + oz ], [ 0, 1, 0 ], u, u + len );
			top.add( [ bx + ox, 0, bz + oz ], [ ax + ox, 0, az + oz ], [ ax + ox, ha, az + oz ], [ bx + ox, hb, bz + oz ], [ - nx, 0, - nz ], u, u + len );
			u += len;

			// collider: an oriented box along the segment (world frame)
			const wa = this.toWorld( ax + ox / 2, az + oz / 2 ), wb = this.toWorld( bx + ox / 2, bz + oz / 2 );
			const dx = wb.x - wa.x, dz = wb.z - wa.z;
			const hMax = Math.max( ha, hb );
			this.colliders.addBox(
				new Vector3( ( wa.x + wb.x ) / 2, this.y0 + hMax / 2, ( wa.z + wb.z ) / 2 ),
				new Vector3( len / 2, hMax / 2, Math.max( thickness, 0.3 ) / 2 ),
				- Math.atan2( dz, dx ),
				{ tag: name },
			);

		}

		for ( const [ q, mat ] of [ [ face, pad ], [ band, trim ], [ top, cap ] ] ) {

			if ( ! mat || ! q.count ) continue;
			const m = new Mesh( q.geometry(), mat );
			m.name = name;
			m.castShadow = true;
			m.receiveShadow = true;
			this.group.add( m );

		}

	}

	// The distances painted on the outfield fence (OUTFIELD rows marked 'mark'): white numbers from a
	// canvas atlas on quads just in front of the padding.
	_buildDistanceMarkers() {

		const rows = OUTFIELD.map( ( r, i ) => ( { a: r[ 0 ], d: r[ 1 ], h: r[ 2 ] * FT, mark: r[ 3 ] === 'mark', shift: r[ 4 ] || 0, i } ) ).filter( ( r ) => r.mark );
		if ( ! rows.length || typeof OffscreenCanvas === 'undefined' ) return;
		const CW = 512, CH = 192;
		const canvas = new OffscreenCanvas( CW, CH * rows.length );
		const ctx = canvas.getContext( '2d' );
		// cream athletic block numerals with a dark outline
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = '900 168px "Arial Narrow", "Helvetica Neue", Impact, Arial, sans-serif';
		ctx.lineJoin = 'round';
		rows.forEach( ( r, k ) => {

			const t = String( Math.round( r.d ) ), y = CH * ( k + 0.5 ) + 6;
			ctx.save();
			ctx.translate( CW / 2, y );
			ctx.scale( 0.82, 1 );
			ctx.lineWidth = 14;
			ctx.strokeStyle = '#0e2a24';
			ctx.strokeText( t, 0, 0 );
			ctx.fillStyle = '#ede0a6';
			ctx.fillText( t, 0, 0 );
			ctx.restore();

		} );
		const img = ctx.getImageData( 0, 0, CW, CH * rows.length );
		const tex = new Texture( { label: 'wallNumbers', width: CW, height: CH * rows.length, format: 'rgba8unorm-srgb', mips: true, usage: [ 'sample', 'copyDst' ], data: new Uint8Array( img.data.buffer ) } );
		tex.getGPU();
		generateMipmaps( tex );

		const mat = standard( {
			name: 'wall-numbers', color: new Color( 0.85, 0.85, 0.82 ), roughness: 0.7, alphaTest: 0.5,
			textures: { bpNumbers: tex },
			surface: 'let t = textureSample( bpNumbers, smpAnisoClamp, in.uv ); s.alpha = t.a; s.albedo = t.rgb * 0.9;',
		} );
		mat.underwaterLighting = 'none';

		const pos = [], nrm = [], uv = [];
		rows.forEach( ( r, k ) => {

			// the fence's direction here (from its neighbours) and the normal toward home plate
			// along the segment the number sits on (the chord through a corner when it's centred on one)
			const prev = OUTFIELD[ r.shift > 0 ? r.i : Math.max( 0, r.i - 1 ) ], next = OUTFIELD[ r.shift < 0 ? r.i : Math.min( OUTFIELD.length - 1, r.i + 1 ) ];
			const [ px, pz ] = fencePoint( prev[ 0 ], prev[ 1 ] ), [ qx, qz ] = fencePoint( next[ 0 ], next[ 1 ] );
			const len = Math.hypot( qx - px, qz - pz );
			const tx = ( qx - px ) / len, tz = ( qz - pz ) / len;
			let nx = - tz, nz = tx;
			const [ cx, cz ] = fencePoint( r.a, r.d );
			if ( nx * - cx + nz * - cz < 0 ) {

				nx = - nx; nz = - nz;

			}

			// moved along the fence off corners and poles (t runs from the left field pole toward right)
			const ox = cx + tx * r.shift + nx * 0.03, oz = cz + tz * r.shift + nz * 0.03;
			const H = Math.min( 0.95, r.h * 0.5 ), W = H * CW / CH;
			const y0 = ( r.h - 0.15 ) / 2 - H / 2 + 0.05, y1 = y0 + H;
			// left / right as seen from the field (facing -n)
			const lx = ox - nz * W / 2, lz = oz + nx * W / 2, rx = ox + nz * W / 2, rz = oz - nx * W / 2;
			const v0 = k / rows.length, v1 = ( k + 1 ) / rows.length;
			const quad = [ [ lx, y0, lz, 0, v1 ], [ rx, y0, rz, 1, v1 ], [ rx, y1, rz, 1, v0 ], [ lx, y0, lz, 0, v1 ], [ rx, y1, rz, 1, v0 ], [ lx, y1, lz, 0, v0 ] ];
			for ( const [ x, y, z, u, v ] of quad ) {

				pos.push( x, y, z );
				nrm.push( nx, 0, nz );
				uv.push( u, v );

			}

		} );

		const geo = new BufferGeometry();
		geo.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		geo.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
		geo.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
		geo.computeBoundingSphere();
		mat.side = 'double';
		const mesh = new Mesh( geo, mat );
		mesh.name = 'wall-numbers';
		mesh.receiveShadow = true;
		this.group.add( mesh );

	}

	_buildFoulPoles() {

		// round steel poles in a soft cream-yellow, the wing a wire screen, on a collar at the wall top
		const yellow = standard( { name: 'foul-pole', color: new Color( 0.76, 0.6, 0.1 ), roughness: 0.5, metalness: 0.3 } );
		const screenMat = standard( { name: 'foul-pole-screen', color: new Color( 0.76, 0.6, 0.1 ), roughness: 0.5, metalness: 0.3, side: 'double', alphaTest: 0.5,
			surface: /* wgsl */`
	// a wire mesh in a frame: 5 cm squares; far off it thins to a dither (it never reads as a plank)
	let p = in.uv * vec2f( 0.4, 8.0 );
	let g = abs( fract( p / 0.05 ) - 0.5 );
	let fw = fwidth( p.x ) / 0.05;
	let wire = step( 0.4 - fw, max( g.x, g.y ) );
	let frame = step( 0.8, abs( in.uv.x - 0.5 ) * 2.0 );
	let far = clamp( fw - 0.5, 0.0, 1.0 );
	let dither = step( fract( sin( dot( floor( in.P.xy * 40.0 ) + floor( in.P.zz * 40.0 ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 ), 0.2 );
	s.alpha = mix( max( wire, frame ), max( dither, frame * 0.5 ), far );
` } );
		for ( const m of [ yellow, screenMat ] ) m.underwaterLighting = 'none';
		const H = 85 * FT, r2 = Math.SQRT1_2;
		for ( const k of [ 0, OUTFIELD.length - 1 ] ) {

			const [ a, d ] = OUTFIELD[ k ];
			// the pole stands just behind the fence on the foul line
			const [ x, z ] = fencePoint( a, d + 1.5 );
			const pole = new Mesh( new CylinderGeometry( 0.23, 0.25, H, 32 ), yellow );
			pole.position.set( x, H / 2, z );
			pole.castShadow = true;
			this.group.add( pole );
			// a pad sleeve where it meets the wall top, a round cap
			const wallH = OUTFIELD[ k ][ 2 ] * FT;
			const sleeve = new Mesh( new CylinderGeometry( 0.3, 0.3, 0.8, 32 ), this._padMat || yellow );
			sleeve.position.set( x, wallH + 0.4, z );
			this.group.add( sleeve );
			const capTop = new Mesh( new CylinderGeometry( 0.05, 0.23, 0.35, 16 ), yellow );
			capTop.position.set( x, H + 0.17, z );
			this.group.add( capTop );
			// its distance painted up the field side in black: 329 in left, 330 in right
			const num = k === 0 ? '329' : '330';
			const tex = canvasTexture( 256, 1024, ( ctx, w, h ) => {

				ctx.clearRect( 0, 0, w, h );
				ctx.fillStyle = '#111111';
				ctx.font = '800 300px "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				num.split( '' ).forEach( ( c, i ) => ctx.fillText( c, w / 2, h * ( 0.18 + i * 0.32 ), w * 0.9 ) );

			}, 'poleNumber' + num );
			const nm = standard( { name: 'pole-number', roughness: 0.5, alphaTest: 0.5, textures: { pnTex: tex }, surface: 'let t = textureSample( pnTex, smpAnisoClamp, in.uv ); s.albedo = t.rgb; s.alpha = t.a;' } );
			nm.underwaterLighting = 'none';
			const sl = new Mesh( new CylinderGeometry( 0.252, 0.252, 2.9, 32, 1, true, 0, Math.PI * 0.55 ), nm );
			sl.position.set( x, wallH + 0.9 + 1.45, z );
			// the painted side toward home plate
			sl.rotation.y = Math.atan2( - x, - z ) - Math.PI * 0.275;
			this.group.add( sl );
			// the yellow stripe down the padding in front of it
			const [ sx, sz ] = fencePoint( a, d - 0.03 );
			const stripe = new Mesh( new BoxGeometry( 0.12, wallH, 0.04 ), yellow );
			stripe.position.set( sx, wallH / 2, sz );
			stripe.rotation.y = Math.atan2( sx, sz );
			this.group.add( stripe );
			const w = this.toWorld( x, z );
			this.colliders.addCylinder( w.x, w.z, 0.3, this.y0, this.y0 + H );
			// the narrow screen on its top third, in fair territory
			const fx = - Math.sign( a ) * r2, fz = - r2;
			const SH = 8;
			const sq = new Quads();
			sq.add( [ - 0.2, - SH / 2, 0 ], [ 0.2, - SH / 2, 0 ], [ 0.2, SH / 2, 0 ], [ - 0.2, SH / 2, 0 ], [ 0, 0, 1 ] );
			const sg = sq.geometry();
			const suv = sg.getAttribute( 'uv' ).array, spos = sg.getAttribute( 'position' ).array;
			for ( let i = 0; i < suv.length / 2; i ++ ) {

				suv[ i * 2 ] = spos[ i * 3 ] / 0.4 + 0.5;
				suv[ i * 2 + 1 ] = spos[ i * 3 + 1 ] / SH + 0.5;

			}

			const screen = new Mesh( sg, screenMat );
			screen.position.set( x + fx * 0.45, H - SH / 2 - 0.5, z + fz * 0.45 );
			screen.rotation.y = Math.atan2( - fz, fx );
			this.group.add( screen );

		}

	}

	// ---------------------------------------------------------------- bullpens

	// The two pens behind the center field fence between 401 and the 398 corner, stacked as they were in
	// 2008: the Phillies' at field level behind the fence, the visitors' raised behind it, its floor a slab
	// that reaches out over the back of the Phillies' pen (their bench is in the recess under it, under a
	// teal-grey soffit with its strip lights); the visitors' pen's back wall rises to Ashburn Alley, and the
	// fans on the Alley's rail look straight down into it. Each pen has two mounds throwing along the fence
	// away from the batter's eye toward two plates at the 398 end. The dark green chain-link over the fence and along the upper pen's
	// lip is drawn thin enough to see through from any distance (a coverage-dithered alpha, not a solid
	// sheet). The gear, the flowers and the people are the Alley's (places/AshburnAlley2008.js).
	_buildBullpens() {

		const grass = standard( { name: 'bullpen-grass', color: new Color( 0.045, 0.13, 0.028 ), roughness: 0.95, modules: [ commonModule ],
			surface: 's.albedo = mat.color * ( 0.88 + 0.16 * mx_noise_float2( in.P.xz * 0.35 ) ) * ( 0.93 + 0.1 * mx_noise_float2( in.P.xz * 19.0 ) );' } );
		const dirt = standard( { name: 'bullpen-dirt', color: new Color( 0.56, 0.27, 0.11 ), roughness: 0.92 } );
		// the pens' walls: the outfield pads' teal, painted concrete
		const wall = standard( { name: 'bullpen-wall', color: new Color( 0.02, 0.11, 0.085 ), roughness: 0.75, modules: [ commonModule ],
			surface: 's.albedo = mat.color * ( 0.9 + 0.14 * mx_noise_float3( in.P * 1.7 ) ); s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.25;' } );
		const white = standard( { name: 'bullpen-plates', color: new Color( 0.82, 0.82, 0.8 ), roughness: 0.6 } );
		// under the upper pen: the soffit, teal-grey, a fluorescent strip every 2.4 m (on by day too)
		const soffit = standard( { name: 'bullpen-soffit', color: new Color( 0.05, 0.085, 0.08 ), roughness: 0.8,
			surface: /* wgsl */`
	if ( in.N.y < -0.5 ) {
		let g = abs( fract( in.uv.x / 2.4 ) - 0.5 ) * 2.4;
		let strip = ( 1.0 - smoothstep( 0.55, 0.6, g ) ) * ( 1.0 - smoothstep( 0.05, 0.07, abs( fract( in.uv.y ) - 0.5 ) ) );
		s.emissive = vec3f( 0.95, 1.0, 0.95 ) * strip * mix( 1.2, 3.0, frame.night );
	}
	s.emissive = s.emissive + s.albedo * 0.4;
` } );
		const galv = standard( { name: 'bullpen-rail', color: new Color( 0.42, 0.43, 0.44 ), roughness: 0.35, metalness: 0.8 } );
		for ( const m of [ grass, dirt, wall, white, soffit, galv ] ) m.underwaterLighting = 'none';
		soffit.setDefine( 'DRY', 1 );

		const [ ax, az ] = fencePoint( 0, 401 ), [ bx, bz ] = fencePoint( 11, 398 );
		const L = Math.hypot( bx - ax, bz - az );
		const ux = ( bx - ax ) / L, uz = ( bz - az ) / L;
		// away from home plate
		let nx = - uz, nz = ux;
		if ( nx * ax + nz * az < 0 ) {

			nx = - nx; nz = - nz;

		}

		const yaw = - Math.atan2( uz, ux );
		const worldYaw = yaw + this.group.rotation.y;
		const { depth: D, upperRise: R, overhang: OV, upperDepth: D2 } = BULLPENS;
		const T0 = 0.5; // behind the fence
		const TU = T0 + D - OV, TB = TU + D2, SLAB = 0.3; // the upper pen's front, its back wall; its slab
		const at = ( s, t ) => [ ax + ux * s + nx * t, az + uz * s + nz * t ];
		const box = ( mat, s0, s1, t0, t1, y0, y1, name, collider = null ) => {

			const [ x, z ] = at( ( s0 + s1 ) / 2, ( t0 + t1 ) / 2 );
			const m = new Mesh( new BoxGeometry( s1 - s0, y1 - y0, t1 - t0 ), mat );
			m.position.set( x, ( y0 + y1 ) / 2, z );
			m.rotation.y = yaw;
			m.castShadow = true;
			m.receiveShadow = true;
			m.name = name;
			this.group.add( m );
			if ( collider ) {

				const w = this.toWorld( x, z );
				this.colliders.addBox( new Vector3( w.x, this.y0 + ( y0 + y1 ) / 2, w.z ), new Vector3( ( s1 - s0 ) / 2, ( y1 - y0 ) / 2, ( t1 - t0 ) / 2 ), worldYaw, { tag: name, ...collider } );

			}

			return m;

		};

		this.pens = [];
		const S0 = 0.3, S1 = L + 2; // from the batter's eye's corner to a little past the 398 corner
		// the frame the Alley builds the pens' life in: s along the fence from 401, t back from it
		this.penFrame = { at, ux, uz, nx, nz, yaw, S0, S1, T0, D, R, TU, TB, SLAB, L };
		// the Phillies' floor, field level; the visitors' raised floor on its slab, the recess under its front
		box( grass, S0, S1, T0, T0 + D, - 0.1, 0.004, 'bullpen-floor' );
		box( grass, S0, S1, TU, TB, R - 0.03, R, 'bullpen-upper', { walkable: true } );
		const sl = box( soffit, S0, S1, TU, T0 + D + 0.3, R - SLAB, R - 0.03, 'bullpen-soffit' );
		// the soffit's uv: metres along the pen (u) and across (v), for the strips
		{

			const g = sl.geometry, P = g.getAttribute( 'position' ).array, U = g.getAttribute( 'uv' ).array;
			for ( let i = 0; i < U.length / 2; i ++ ) {

				U[ i * 2 ] = P[ i * 3 ] + ( S1 - S0 ) / 2;
				U[ i * 2 + 1 ] = ( P[ i * 3 + 2 ] + ( T0 + D + 0.3 - TU ) / 2 ) / ( T0 + D + 0.3 - TU );

			}

		}

		box( wall, S0, S1, T0 + D, TB, 0, R - SLAB, 'bullpen-under', { solid: true } );
		// the slab's front: a teal fascia and a curb 0.45 m over the upper floor, on steel posts
		box( wall, S0, S1, TU - 0.08, TU + 0.25, R - SLAB - 0.06, R + 0.45, 'bullpen-lip', { solid: true } );
		for ( let s = S0 + 2.2; s < S1 - 1; s += ( S1 - S0 - 4.4 ) / 3 ) box( wall, s - 0.15, s + 0.15, TU + 0.1, TU + 0.4, 0, R - SLAB, 'bullpen-post', { solid: true } );
		// the ends, and the upper pen's back wall up to the Alley (the pit's edge is its back face)
		box( wall, S0 - 0.4, S0, T0, TB + 0.4, 0, R + 1.4, 'bullpen-end', { solid: true } );
		box( wall, S1, S1 + 0.4, T0, TB + 0.4, 0, R + 1.4, 'bullpen-end', { solid: true } );
		box( wall, S0 - 0.4, S1 + 0.4, TB, TB + 0.4, R - 0.1, LEVELS.mainConcourse - 0.01, 'bullpen-back', { solid: true } );

		// mounds, rubbers and plates: two lanes per pen, the mounds at the 401 end, throwing toward the 398 corner (as the 2005 photos from the
		// Pavilion show: the dirt of the mounds by the batter's eye)
		const SM = S0 + 2.3;
		const plate = slab( [ [ 0, 0 ], [ 0.216, - 0.216 ], [ 0.216, - 0.432 ], [ - 0.216, - 0.432 ], [ - 0.216, - 0.216 ] ], 0.02 );
		// (the lanes side by side: each mound narrowed across the pen, the two sharing one wide hump)
		for ( const [ y, lanes ] of [ [ 0, [ 2.1, 4.5 ] ], [ R, [ TU + 1.4, TU + 3.7 ] ] ] ) {

			for ( const t of lanes ) {

				const [ mx, mz ] = at( SM, t );
				this.pens.push( { x: mx, z: mz, y, t, s: SM, upper: y > 0 } );
				const mound = new Mesh( bumpGeometry(), dirt );
				mound.position.set( mx, y + 0.003, mz );
				mound.rotation.y = yaw;
				mound.scale.set( 1, 1, 0.55 );
				mound.receiveShadow = true;
				this.group.add( mound );
				const [ rx, rz ] = at( SM + 0.35, t );
				const rub = new Mesh( new BoxGeometry( 0.15, 0.04, 0.61 ), white );
				rub.position.set( rx, y + bumpHeight( rx - mx, rz - mz ) + 0.01, rz );
				rub.rotation.y = yaw;
				this.group.add( rub );
				const [ px, pz ] = at( SM + 0.35 + RUBBER_FRONT, t );
				const pl = new Mesh( plate, white );
				pl.position.set( px, y, pz );
				pl.rotation.y = yaw + Math.PI / 2; // the point toward the catcher (away from the mound)
				this.group.add( pl );
				const [ dx, dz ] = at( SM + 0.35 + RUBBER_FRONT + 1.2, t );
				const box2 = new Mesh( new BoxGeometry( 3.2, 0.01, 2.2 ), dirt );
				box2.position.set( dx - ux * 1.1, y + 0.002, dz - uz * 1.1 );
				box2.rotation.y = yaw;
				this.group.add( box2 );

			}

		}

		// the visitors' bench shelter against their back wall at the 398 end: a dark green roof on posts
		const shelterMat = standard( { name: 'pen-shelter', color: new Color( 0.012, 0.06, 0.035 ), roughness: 0.6 } );
		shelterMat.underwaterLighting = 'none';
		{

			const sA = S1 - 9.5, sB = S1 - 0.2, y = R;
			box( shelterMat, sA - 0.2, sB, TB - 2.3, TB, y + 2.5, y + 2.66, 'pen-shelter-roof' );
			for ( const sp of [ sA, ( sA + sB ) / 2, sB - 0.12 ] ) box( shelterMat, sp, sp + 0.1, TB - 2.3, TB - 2.2, y, y + 2.5, 'pen-shelter-post' );
			this.penFrame.shelter = [ sA, sB ];

		}

		// the chain-link: over the fence into the Phillies' pen (up to the padded rail), and along the
		// upper pen's lip on galvanized square posts with a top rail. Seen through at any distance: each
		// pixel is wire or not by how much of it the wire covers there, dithered (the TAA averages it)
		const chain = standard( { name: 'pen-chain-link', color: new Color( 0.012, 0.05, 0.03 ), roughness: 0.5, metalness: 0.5, side: 'double', alphaTest: 0.5,
			surface: /* wgsl */`
	let p = vec2f( in.uv.x + in.uv.y, in.uv.x - in.uv.y ) / 0.05;
	let g = abs( fract( p ) - 0.5 );
	let fw = max( fwidth( p.x ), fwidth( p.y ) );
	let wire = smoothstep( 0.42 - fw, 0.42 + fw, max( g.x, g.y ) );
	let cover = mix( wire, 0.3, clamp( fw * 1.2 - 0.2, 0.0, 1.0 ) );
	let n = fract( sin( dot( floor( in.pixel ), vec2f( 12.9898, 78.233 ) ) + f32( frame.frameIndex % 16u ) * 1.618 ) * 43758.5453 );
	s.alpha = select( 0.0, 1.0, cover > n );
` } );
		chain.underwaterLighting = 'none';
		const cq = new Quads(), rq = new Quads();
		const fenceTop = 6 * FT;
		const link = ( t, yB, yT, posts ) => {

			const A = at( S0, t ), B = at( S1, t );
			cq.tri( [ A[ 0 ], yB, A[ 1 ] ], [ B[ 0 ], yB, B[ 1 ] ], [ B[ 0 ], yT, B[ 1 ] ], [ - nx, 0, - nz ], [ 0, yB ], [ S1 - S0, yB ], [ S1 - S0, yT ] );
			cq.tri( [ A[ 0 ], yB, A[ 1 ] ], [ B[ 0 ], yT, B[ 1 ] ], [ A[ 0 ], yT, A[ 1 ] ], [ - nx, 0, - nz ], [ 0, yB ], [ S1 - S0, yT ], [ 0, yT ] );
			if ( ! posts ) return;
			for ( let s = S0; s <= S1 + 0.01; s += ( S1 - S0 ) / Math.round( ( S1 - S0 ) / 2.4 ) ) {

				const [ px, pz ] = at( s, t );
				beam( rq, [ px, yB, pz ], [ px, yT + 0.02, pz ], 0.06 );

			}

			beam( rq, [ A[ 0 ], yT, A[ 1 ] ], [ B[ 0 ], yT, B[ 1 ] ], 0.05 );
			beam( rq, [ A[ 0 ], yB + 0.08, A[ 1 ] ], [ B[ 0 ], yB + 0.08, B[ 1 ] ], 0.04 );

		};

		link( T0 - 0.2, fenceTop, fenceTop + 0.92, false );
		link( TU + 0.1, R + 0.45, R + 1.5, true );
		const cm = new Mesh( cq.geometry(), chain );
		cm.name = 'pen-chain-link';
		this.group.add( cm );
		const rm = new Mesh( rq.geometry(), galv );
		rm.name = 'pen-rails';
		rm.castShadow = true;
		this.group.add( rm );

	}

	// ---------------------------------------------------------------- dugouts

	// A dugout along the foul territory wall from a to b ([ x, z ]): its pit (the hole in the field
	// surface) is the strip between that line and DUGOUT_WIDTH behind it.
	_dugoutFrame( side, a, b ) {

		const [ ax, az ] = a, [ bx, bz ] = b;
		const len = Math.hypot( bx - ax, bz - az );
		const ux = ( bx - ax ) / len, uz = ( bz - az ) / len;
		// away from the field (the side away from second base)
		let nx = - uz, nz = ux;
		const mx = ( ax + bx ) / 2, mz = ( az + bz ) / 2;
		if ( nx * ( 0 - mx ) + nz * ( - BASE * Math.SQRT2 - mz ) > 0 ) {

			nx = - nx; nz = - nz;

		}

		const W = DUGOUT_WIDTH;
		const pit = [ [ ax, az ], [ bx, bz ], [ bx + nx * W, bz + nz * W ], [ ax + nx * W, az + nz * W ] ];
		// the stretch under the roof
		const roof = [ DUGOUT_ZONES.home, len - DUGOUT_ZONES.far ];
		return { side, a, b, len, ux, uz, nx, nz, pit, roof };

	}

	_inDugout( d, x, z ) {

		const dx = x - d.a[ 0 ], dz = z - d.a[ 1 ];
		const s = dx * d.ux + dz * d.uz, t = dx * d.nx + dz * d.nz;
		return s > 0 && s < d.len && t > 0 && t < DUGOUT_WIDTH;

	}

	// The dugout, along the wall from its home plate end: the low TV camera well where the backstop meets
	// it, the dugout itself under its roof, then the well for the low first / third base cameras and the
	// photographers at its far end (their gear and the people in them: FieldLevel.js). The dugout is two
	// steps down along its front to a concrete floor, a varnished bench along the back wall under navy
	// padding, fluorescent strips in the ceiling (it reads lit from the field at night, as it did on TV), the
	// padded green rail the players lean on with black netting under it.
	_buildDugout( d ) {

		const M = this._dugoutMaterials();
		const { a, len, ux, uz, nx, nz } = d;
		const yaw = - Math.atan2( uz, ux ); // local x along the dugout, local z away from the field
		const worldYaw = yaw + this.group.rotation.y;
		// a point along (s) and behind (t) the front edge, in the field frame
		const at = ( s, t ) => [ a[ 0 ] + ux * s + nx * t, a[ 1 ] + uz * s + nz * t ];
		const P = ( s, t, y ) => { const [ x, z ] = at( s, t ); return [ x, y, z ]; };
		// a box from s0..s1 along, t0..t1 back, y0..y1 up: a mesh, and optionally a collider
		const box = ( mat, s0, s1, t0, t1, y0, y1, name, collider = null ) => {

			const [ x, z ] = at( ( s0 + s1 ) / 2, ( t0 + t1 ) / 2 );
			const m = new Mesh( new BoxGeometry( s1 - s0, y1 - y0, t1 - t0 ), mat );
			m.position.set( x, ( y0 + y1 ) / 2, z );
			m.rotation.y = yaw;
			m.castShadow = true;
			m.receiveShadow = true;
			m.name = name;
			this.group.add( m );
			if ( collider ) {

				const w = this.toWorld( x, z );
				this.colliders.addBox( new Vector3( w.x, this.y0 + ( y0 + y1 ) / 2, w.z ), new Vector3( ( s1 - s0 ) / 2, ( y1 - y0 ) / 2, ( t1 - t0 ) / 2 ), worldYaw, { tag: name, ...collider } );

			}

			return m;

		};
		// a flat rectangle facing n ( up or down ), its uv in metres ( s, t )
		const flat = ( q, s0, s1, t0, t1, y, n ) => {

			q.tri( P( s0, t0, y ), P( s1, t0, y ), P( s1, t1, y ), n, [ s0, t0 ], [ s1, t0 ], [ s1, t1 ] );
			q.tri( P( s0, t0, y ), P( s1, t1, y ), P( s0, t1, y ), n, [ s0, t0 ], [ s1, t1 ], [ s0, t1 ] );

		};
		const mesh = ( q, mat, name, shadow = true ) => {

			if ( ! q.count ) return null;
			const m = new Mesh( q.geometry(), mat );
			m.name = name;
			m.castShadow = shadow;
			m.receiveShadow = true;
			this.group.add( m );
			return m;

		};

		const D = DUGOUT_DEPTH, W = DUGOUT_WIDTH, R = DUGOUT_ROOF, LIP = 0.3;
		const [ r0, r1 ] = d.roof;
		const wallH = FOUL_WALL_HEIGHT * FT;
		// the floor (its own shader: seed shells, cups and spit where the players sit and stand)
		const fq = new Quads();
		flat( fq, 0, len, LIP, W, - D, [ 0, 1, 0 ] );
		mesh( fq, M.floor, 'dugout-floor', false );
		// the back wall: full height under the roof, the field wall's height behind the wells
		box( M.concrete, r0, r1, W, W + 0.25, - D, R, 'dugout-back', { solid: true } );
		box( M.concrete, - 0.25, r0, W, W + 0.25, - D, wallH, 'dugout-back', { solid: true } );
		box( M.concrete, r1, len + 0.25, W, W + 0.25, - D, wallH, 'dugout-back', { solid: true } );
		box( M.concrete, - 0.25, 0, - 0.25, W + 0.25, - D, wallH, 'dugout-end', { solid: true } );
		box( M.concrete, len, len + 0.25, - 0.25, W + 0.25, - D, wallH, 'dugout-end', { solid: true } );
		// the partitions between the dugout and the wells, under the roof's ends
		box( M.concrete, r0 - 0.2, r0, LIP, W, - D, R - 0.25, 'dugout-partition', { solid: true } );
		box( M.concrete, r1, r1 + 0.2, LIP, W, - D, R - 0.25, 'dugout-partition', { solid: true } );
		// the front lip: the field's edge (you can drop down from it)
		box( M.concrete, 0, len, 0, LIP, - D, 0, 'dugout-lip', { walkable: true } );
		// two steps down along the front, a worn light nosing on each
		box( M.step, r0, r1, LIP, 0.72, - D, - 0.4, 'dugout-step', { walkable: true } );
		box( M.step, r0, r1, 0.72, 1.12, - D, - 0.8, 'dugout-step', { walkable: true } );
		// the wells' raised floors: the cameras look over the field from just above it
		box( M.concrete, 0, r0 - 0.2, LIP, W, - D, - 0.7, 'camera-well', { walkable: true } );
		box( M.concrete, r1 + 0.2, len, LIP, W, - D, - 0.7, 'camera-well', { walkable: true } );
		// the roof over the dugout, overhanging the front. You can stand on it but walk under it
		box( M.roof, r0 - 0.2, r1 + 0.2, - 0.45, W + 0.25, R - 0.25, R, 'dugout-roof', { walkable: true, solid: false } );
		const cq = new Quads();
		flat( cq, r0, r1, - 0.45, W, R - 0.252, [ 0, - 1, 0 ] );
		mesh( cq, M.ceiling, 'dugout-ceiling', false );
		// the bench: two varnished planks on steel legs, a hand's width off the back wall padding
		// (the helmet cubbies and the bat rack take its home plate end, the coolers its far end)
		const by = - D + 0.46;
		const [ b0, b1 ] = d.bench = [ r0 + 5.4, r1 - 2.4 ];
		box( M.wood, b0, b1, W - 0.54, W - 0.31, by - 0.045, by, 'dugout-bench', { walkable: true } );
		box( M.wood, b0, b1, W - 0.29, W - 0.08, by - 0.045, by, 'dugout-bench' );
		const lq = new Quads();
		for ( let s = b0 + 0.25; s < b1 - 0.1; s += 1.9 ) {

			beam( lq, P( s, W - 0.45, - D ), P( s, W - 0.45, by - 0.045 ), 0.045 );
			beam( lq, P( s, W - 0.15, - D ), P( s, W - 0.15, by - 0.045 ), 0.045 );
			beam( lq, P( s, W - 0.5, by - 0.07 ), P( s, W - 0.1, by - 0.07 ), 0.04 );

		}

		mesh( lq, M.steel, 'dugout-bench-legs' );
		// navy padding on the back wall above the bench (the ends of the wells too)
		box( M.pad, r0, r1, W - 0.06, W, by + 0.03, R - 0.3, 'dugout-back-pad' );
		// the rails: the dugout's over the upper step; the wells' on the lip, higher (the cameras over it)
		const q = new Quads(), pq = new Quads(), nq = new Quads();
		const rail = ( s0, s1, t, foot, top ) => {

			tube( pq, P( s0, t, top ), P( s1, t, top ), 0.055, 8 );
			beam( q, P( s0, t, top * 0.42 ), P( s1, t, top * 0.42 ), 0.045 );
			beam( q, P( s0, t, 0.05 ), P( s1, t, 0.05 ), 0.04 );
			const n = Math.max( 1, Math.round( ( s1 - s0 ) / 2.2 ) );
			for ( let k = 0; k <= n; k ++ ) {

				const sk = s0 + ( s1 - s0 ) * k / n;
				beam( q, P( sk, t, foot ), P( sk, t, top - 0.02 ), 0.05 );

			}

			// black netting from the field up to the top rail (uv in metres)
			nq.tri( P( s0, t + 0.03, 0 ), P( s1, t + 0.03, 0 ), P( s1, t + 0.03, top ), [ - nx, 0, - nz ], [ s0, 0 ], [ s1, 0 ], [ s1, top ] );
			nq.tri( P( s0, t + 0.03, 0 ), P( s1, t + 0.03, top ), P( s0, t + 0.03, top ), [ - nx, 0, - nz ], [ s0, 0 ], [ s1, top ], [ s0, top ] );

		};
		rail( r0 - 0.05, r1 + 0.05, 0.55, - 0.4, 0.95 );
		rail( 0.12, r0 - 0.3, 0.16, 0, 1.02 );
		rail( r1 + 0.3, len - 0.12, 0.16, 0, 1.02 );
		// the wells' side rails, over the partitions
		for ( const s of [ r0 - 0.25, r1 + 0.25 ] ) {

			tube( pq, P( s, 0.16, 1.02 ), P( s, W - 0.1, 1.02 ), 0.05, 8 );
			beam( q, P( s, W - 0.1, R - 0.25 ), P( s, W - 0.1, 1.02 ), 0.05 );

		}

		mesh( q, M.railSteel, 'dugout-rail' );
		mesh( pq, M.railPad, 'dugout-rail-pad' );
		const net = mesh( nq, M.netting, 'dugout-netting', false );
		if ( net ) net.layers.set( 2 ); // the late (transparent) pass
		// the rail pads: white sleeves round the top rail every 2.4 m, phillies.com in red on them
		const sq = new Quads();
		const sleeve = ( s, t, top ) => {

			const r = 0.06, L = 0.36;
			// front, top and back faces of a square sleeve, uv across the label
			const f = ( y0, y1, t0, t1, nrm ) => {

				sq.tri( P( s - L / 2, t0, y0 ), P( s + L / 2, t0, y0 ), P( s + L / 2, t1, y1 ), nrm, [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] );
				sq.tri( P( s - L / 2, t0, y0 ), P( s + L / 2, t1, y1 ), P( s - L / 2, t1, y1 ), nrm, [ 0, 1 ], [ 1, 0 ], [ 0, 0 ] );

			};
			f( top - r, top + r, t - r, t - r, [ - nx, 0, - nz ] );
			f( top + r, top + r, t - r, t + r, [ 0, 1, 0 ] );
			f( top + r, top - r, t + r, t + r, [ nx, 0, nz ] );

		};
		for ( let s = r0 + 1.2; s < r1 - 0.5; s += 2.4 ) sleeve( s, 0.55, 0.95 );
		const sm = mesh( sq, M.railLabel( ux, uz, nx, nz ), 'dugout-rail-labels' );
		if ( sm ) sm.castShadow = false;

	}

	// the dugouts' materials, shared by both. Under the roof it's dry (DRY: the rain's wetting skips
	// them), and lit: the fluorescent strips light the inside (an emissive lift, stronger after dark)
	_dugoutMaterials() {

		if ( this._dugMats ) return this._dugMats;
		const INSIDE = 's.emissive = s.emissive + s.albedo * mix( 0.12, 0.55, smoothstep( 0.2, 0.8, frame.night ) );';
		const concrete = standard( { name: 'dugout-concrete', color: new Color( 0.24, 0.24, 0.23 ), roughness: 0.85, modules: [ commonModule ],
			surface: 's.albedo = mat.color * ( 0.9 + 0.12 * mx_noise_float3( in.P * 3.0 ) ); s.emissive = s.albedo * mix( 0.05, 0.3, smoothstep( 0.2, 0.8, frame.night ) );' } );
		const step = standard( { name: 'dugout-steps', color: new Color( 0.2, 0.2, 0.2 ), roughness: 0.8, modules: [ commonModule ],
			surface: /* wgsl */`
	// painted grey, scuffed by spikes; a lighter worn nosing along each edge
	s.albedo = mat.color * ( 0.85 + 0.2 * mx_noise_float3( in.P * vec3f( 9.0, 2.0, 9.0 ) ) );
	${ INSIDE }
` } );
		const roof = standard( { name: 'dugout-roof', color: new Color( 0.018, 0.16, 0.1 ), roughness: 0.7 } );
		const ceiling = standard( { name: 'dugout-ceiling', color: new Color( 0.42, 0.42, 0.4 ), roughness: 0.8,
			surface: /* wgsl */`
	// painted concrete; two rows of fluorescent fixtures along the dugout, 1.2 m lamps every 2.4 m in a
	// white housing
	let su = in.uv.x; let tv = in.uv.y;
	let fu = abs( fract( su / 2.4 ) - 0.5 ) * 2.4;
	let ft = min( abs( tv - 0.55 ), abs( tv - 1.75 ) );
	let housing = step( fu, 0.66 ) * step( ft, 0.13 );
	let lamp = ( 1.0 - smoothstep( 0.56, 0.6, fu ) ) * ( 1.0 - smoothstep( 0.07, 0.09, ft ) );
	let nk = smoothstep( 0.2, 0.8, frame.night );
	s.albedo = mix( mat.color, vec3f( 0.8 ), housing );
	s.emissive = vec3f( 0.92, 0.97, 1.0 ) * lamp * mix( 2.2, 4.0, nk ) + s.albedo * mix( 0.1, 0.35, nk );
` } );
		const floor = standard( { name: 'dugout-floor', color: new Color( 0.17, 0.17, 0.165 ), roughness: 0.85, modules: [ commonModule ],
			surface: /* wgsl */`
	// sealed concrete; where the players sit and stand it's littered: sunflower seed shells (grey and
	// white striped, a centimetre and a half), crushed paper cups, sticky dark spit stains and gum
	let st = in.uv; // ( along, back ) in metres
	var c = mat.color * ( 0.88 + 0.15 * mx_noise_float2( st * 2.0 ) ) * ( 0.95 + 0.08 * mx_noise_float2( st * 23.0 ) );
	// densest in front of the bench and along the rail, thinning toward the ends
	let bench = 1.0 - smoothstep( 0.1, 0.55, abs( st.y - ${ ( DUGOUT_WIDTH - 0.75 ).toFixed( 2 ) } ) );
	let rail = 1.0 - smoothstep( 0.05, 0.35, abs( st.y - 1.3 ) );
	let dens = clamp( ( bench * 0.9 + rail * 0.7 ) * ( 0.55 + 0.6 * mx_noise_float2( st * 0.7 + 3.0 ) ), 0.0, 1.0 );
	let fw = length( fwidth( st ) );
	// stains
	c = c * ( 1.0 - 0.35 * smoothstep( 0.5, 0.75, mx_noise_float2( st * 3.1 + 9.0 ) ) * dens );
	// seed shells: one chance per 3 cm cell
	let cell = floor( st / 0.03 );
	let h = fract( sin( dot( cell, vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
	let h2 = fract( h * 91.7 );
	let o = fract( vec2f( h * 7.1, h * 13.3 ) ) * 0.02 + 0.005;
	let ang = h2 * 6.283;
	let dp = st - cell * 0.03 - o;
	let lp = vec2f( dp.x * cos( ang ) - dp.y * sin( ang ), dp.x * sin( ang ) + dp.y * cos( ang ) );
	let shell = 1.0 - smoothstep( 0.8, 1.0, length( lp / vec2f( 0.008, 0.0035 ) ) );
	let stripe = step( 0.5, fract( lp.y / 0.0025 ) );
	let near = 1.0 - smoothstep( 0.004, 0.02, fw );
	let seedK = shell * step( h, dens * 0.7 ) * near;
	c = mix( c, mix( vec3f( 0.05, 0.05, 0.05 ), vec3f( 0.55, 0.53, 0.5 ), stripe ), seedK );
	// far off the shells average into a speckled grey
	c = mix( c, c * 0.8 + vec3f( 0.06 ) * dens, ( 1.0 - near ) * dens * 0.5 );
	// crushed cups: one chance per 40 cm cell
	let cc = floor( st / 0.4 );
	let ch = fract( sin( dot( cc, vec2f( 39.3468, 11.135 ) ) ) * 43758.5453 );
	let cp = ( st - cc * 0.4 - vec2f( 0.2 ) - ( fract( vec2f( ch * 3.7, ch * 5.3 ) ) - 0.5 ) * 0.2 ) / vec2f( 0.045, 0.03 );
	let cup = ( 1.0 - smoothstep( 0.85, 1.0, length( cp ) ) ) * step( ch, dens * 0.35 );
	c = mix( c, vec3f( 0.8, 0.79, 0.74 ) * ( 0.85 + 0.2 * fract( ch * 17.0 ) ), cup );
	s.albedo = c;
	s.roughness = mix( 0.85, 0.5, dens * 0.3 );
	${ INSIDE }
` } );
		floor.setDefine( 'DRY', 1 );
		const pad = standard( { name: 'dugout-padding', color: new Color( 0.012, 0.02, 0.06 ), roughness: 0.65, modules: [ commonModule ],
			surface: /* wgsl */`
	// vinyl panels 1.2 m wide
	let pu = in.P.x + in.P.z;
	let seam = smoothstep( 0.0, 0.015, abs( fract( pu / 1.2 ) - 0.5 ) * 1.2 );
	s.albedo = mat.color * mix( 0.5, 1.0, seam ) * ( 0.9 + 0.15 * mx_noise_float3( in.P * 2.0 ) );
	s.sheenColor = vec3f( 0.05 );
	${ INSIDE }
` } );
		const wood = standard( { name: 'dugout-bench', color: new Color( 0.32, 0.15, 0.06 ), roughness: 0.4, modules: [ commonModule ],
			surface: /* wgsl */`
	// varnished oak worn pale where they sit, the grain along the plank
	let g = mx_noise_float3( in.P * vec3f( 2.0, 40.0, 2.0 ) + vec3f( 0.0, 0.0, 0.0 ) );
	s.albedo = mat.color * ( 0.85 + 0.25 * g ) * ( 0.9 + 0.2 * mx_noise_float3( in.P * 0.9 ) );
	${ INSIDE }
` } );
		wood.setDefine( 'DRY', 1 );
		const steel = standard( { name: 'dugout-steel', color: new Color( 0.1, 0.1, 0.1 ), roughness: 0.5, metalness: 0.6, surface: INSIDE } );
		const railSteel = standard( { name: 'dugout-rail', color: new Color( 0.02, 0.07, 0.04 ), roughness: 0.4, metalness: 0.6,
			surface: 's.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.35;' } );
		// the fat padded top rail: dark green vinyl
		const railPad = standard( { name: 'dugout-rail-pad', color: new Color( 0.02, 0.1, 0.06 ), roughness: 0.5,
			surface: 's.sheenColor = vec3f( 0.06 ); s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.35;' } );
		const netting = standard( { name: 'dugout-netting', color: new Color( 0.01, 0.01, 0.012 ), roughness: 0.7, side: 'double', transparent: true, depthWrite: false,
			surface: /* wgsl */`
	// 4 cm square mesh of thin black cord: up close the strands, farther off a dark veil (the strands'
	// share of each cell), never a moire
	let p = in.uv / 0.04;
	let m = abs( fract( p ) - 0.5 );
	let fw = max( fwidth( p.x ), fwidth( p.y ) );
	let strand = smoothstep( 0.44 - fw, 0.44 + fw, max( m.x, m.y ) );
	s.alpha = mix( 0.22, strand, clamp( 1.5 - fw * 6.0, 0.0, 1.0 ) ) * 0.85;
` } );
		const labels = new Map();
		// the rail pads' label: phillies.com, read from the field (the texture's u runs along +s; flip where
		// that runs right to left for a viewer on the field)
		const railLabel = ( ux, uz, nx, nz ) => {

			const flip = ( ux * - nz + uz * nx ) < 0;
			if ( labels.has( flip ) ) return labels.get( flip );
			const tex = canvasTexture( 256, 64, ( ctx, w, h ) => {

				ctx.fillStyle = '#f1efe9';
				ctx.fillRect( 0, 0, w, h );
				ctx.save();
				if ( flip ) {

					ctx.translate( w, 0 );
					ctx.scale( - 1, 1 );

				}

				ctx.fillStyle = '#c8102e';
				ctx.font = '800 34px "Helvetica Neue", Arial, sans-serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText( 'phillies.com', w / 2, h / 2 + 2, w - 16 );
				ctx.restore();

			}, 'railLabel' + ( flip ? 'F' : '' ) );
			const m = standard( { name: 'dugout-rail-label', roughness: 0.5, textures: { bpLabel: tex },
				surface: 's.albedo = textureSample( bpLabel, smpAnisoClamp, in.uv ).rgb * 0.85; s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.35;' } );
			m.underwaterLighting = 'none';
			labels.set( flip, m );
			return m;

		};

		const all = { concrete, step, roof, ceiling, floor, pad, wood, steel, railSteel, railPad, netting };
		for ( const m of Object.values( all ) ) m.underwaterLighting = 'none';
		for ( const m of [ step, ceiling, pad, steel ] ) m.setDefine( 'DRY', 1 );
		this._dugMats = { ...all, railLabel };
		return this._dugMats;

	}

}

// ---------------------------------------------------------------- helpers

// mound height at a field-frame point: 10 in at the rubber, easing down to the 18 ft circle
export function moundHeight( x, z ) {

	const r = Math.hypot( x, z + MOUND_CENTER ) / MOUND_RADIUS;
	if ( r >= 1 ) return 0;
	const t = MathUtils.clamp( ( r - 0.3 ) / 0.7, 0, 1 );
	return MOUND_HEIGHT * ( 1 - t * t * ( 3 - 2 * t ) );

}

// a bullpen mound: 10 in high, 9 ft radius, same profile as the game mound (centred on its peak)
export function bumpHeight( dx, dz ) {

	const r = Math.hypot( dx, dz ) / MOUND_RADIUS;
	if ( r >= 1 ) return 0;
	const t = MathUtils.clamp( ( r - 0.3 ) / 0.7, 0, 1 );
	return MOUND_HEIGHT * ( 1 - t * t * ( 3 - 2 * t ) );

}

let _bump = null;
function bumpGeometry() {

	if ( _bump ) return _bump;
	const RINGS = 8, SEG = 40;
	const pos = [], index = [];
	pos.push( 0, bumpHeight( 0, 0 ), 0 );
	for ( let r = 1; r <= RINGS; r ++ ) for ( let s = 0; s < SEG; s ++ ) {

		const a = s / SEG * Math.PI * 2, rad = MOUND_RADIUS * r / RINGS;
		const x = Math.cos( a ) * rad, z = Math.sin( a ) * rad;
		pos.push( x, bumpHeight( x, z ), z );

	}

	const ring = ( r, s ) => r === 0 ? 0 : 1 + ( r - 1 ) * SEG + ( s % SEG );
	for ( let r = 0; r < RINGS; r ++ ) for ( let s = 0; s < SEG; s ++ ) {

		if ( r === 0 ) index.push( 0, ring( 1, s + 1 ), ring( 1, s ) );
		else index.push( ring( r, s ), ring( r, s + 1 ), ring( r + 1, s + 1 ), ring( r, s ), ring( r + 1, s + 1 ), ring( r + 1, s ) );

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setIndex( index );
	g.computeVertexNormals();
	const n = g.getAttribute( 'normal' );
	if ( n.array[ 1 ] < 0 ) for ( let i = 0; i < n.array.length; i ++ ) n.array[ i ] = - n.array[ i ];
	g.computeBoundingSphere();
	_bump = g;
	return g;

}

// a round bar of radius r from a to b ([ x, y, z ]) with n flat sides (a padded rail, a pipe), added to
// a Quads
export function tube( q, a, b, r, n = 8 ) {

	const d = [ b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] ];
	const l = Math.hypot( ...d ) || 1;
	d[ 0 ] /= l; d[ 1 ] /= l; d[ 2 ] /= l;
	const ref = Math.abs( d[ 1 ] ) > 0.9 ? [ 1, 0, 0 ] : [ 0, 1, 0 ];
	let e1 = [ d[ 1 ] * ref[ 2 ] - d[ 2 ] * ref[ 1 ], d[ 2 ] * ref[ 0 ] - d[ 0 ] * ref[ 2 ], d[ 0 ] * ref[ 1 ] - d[ 1 ] * ref[ 0 ] ];
	const l1 = Math.hypot( ...e1 );
	e1 = e1.map( ( v ) => v / l1 );
	const e2 = [ e1[ 1 ] * d[ 2 ] - e1[ 2 ] * d[ 1 ], e1[ 2 ] * d[ 0 ] - e1[ 0 ] * d[ 2 ], e1[ 0 ] * d[ 1 ] - e1[ 1 ] * d[ 0 ] ];
	const at = ( p, ang ) => [ 0, 1, 2 ].map( ( k ) => p[ k ] + ( e1[ k ] * Math.cos( ang ) + e2[ k ] * Math.sin( ang ) ) * r );
	for ( let i = 0; i < n; i ++ ) {

		const a0 = i / n * Math.PI * 2, a1 = ( i + 1 ) / n * Math.PI * 2, am = ( a0 + a1 ) / 2;
		const nrm = [ 0, 1, 2 ].map( ( k ) => e1[ k ] * Math.cos( am ) + e2[ k ] * Math.sin( am ) );
		q.add( at( a, a0 ), at( b, a0 ), at( b, a1 ), at( a, a1 ), nrm, 0, l );

	}

}

// where the point c lies on segment p -> q (0..1), or null if it isn't on it
function segmentParam( p, q, c ) {

	const ex = q[ 0 ] - p[ 0 ], ez = q[ 1 ] - p[ 1 ];
	const L2 = ex * ex + ez * ez;
	const t = ( ( c[ 0 ] - p[ 0 ] ) * ex + ( c[ 1 ] - p[ 1 ] ) * ez ) / L2;
	const dx = p[ 0 ] + ex * t - c[ 0 ], dz = p[ 1 ] + ez * t - c[ 1 ];
	return t >= 0 && t <= 1 && dx * dx + dz * dz < 0.25 ? t : null;

}

// a flat slab of the given outline ([ x, z ], counter-clockwise from above) and thickness
function slab( outline, h ) {

	const q = new Quads();
	const n = outline.length;
	for ( let i = 1; i < n - 1; i ++ ) q.tri( [ outline[ 0 ][ 0 ], h, outline[ 0 ][ 1 ] ], [ outline[ i ][ 0 ], h, outline[ i ][ 1 ] ], [ outline[ i + 1 ][ 0 ], h, outline[ i + 1 ][ 1 ] ], [ 0, 1, 0 ] );
	for ( let i = 0; i < n; i ++ ) {

		const [ ax, az ] = outline[ i ], [ bx, bz ] = outline[ ( i + 1 ) % n ];
		const len = Math.hypot( bx - ax, bz - az );
		q.add( [ ax, 0, az ], [ bx, 0, bz ], [ bx, h, bz ], [ ax, h, az ], [ ( bz - az ) / len, 0, - ( bx - ax ) / len ], 0, len );

	}

	return q.geometry();

}

// Collects flat-shaded quads / triangles into one geometry. Winding is fixed up so every face is
// front-facing along the normal given.
class Quads {

	constructor() {

		this.pos = [];
		this.nrm = [];
		this.uv = [];
		this.count = 0;

	}

	add( a, b, c, d, n, u0 = 0, u1 = 1 ) {

		this.tri( a, b, c, n, [ u0, a[ 1 ] ], [ u1, b[ 1 ] ], [ u1, c[ 1 ] ] );
		this.tri( a, c, d, n, [ u0, a[ 1 ] ], [ u1, c[ 1 ] ], [ u0, d[ 1 ] ] );

	}

	tri( a, b, c, n, ua = [ 0, 0 ], ub = [ 0, 0 ], uc = [ 0, 0 ] ) {

		// counter-clockwise around n
		const e1 = [ b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] ], e2 = [ c[ 0 ] - a[ 0 ], c[ 1 ] - a[ 1 ], c[ 2 ] - a[ 2 ] ];
		const cx = e1[ 1 ] * e2[ 2 ] - e1[ 2 ] * e2[ 1 ], cy = e1[ 2 ] * e2[ 0 ] - e1[ 0 ] * e2[ 2 ], cz = e1[ 0 ] * e2[ 1 ] - e1[ 1 ] * e2[ 0 ];
		if ( cx * n[ 0 ] + cy * n[ 1 ] + cz * n[ 2 ] < 0 ) {

			[ b, c ] = [ c, b ];
			[ ub, uc ] = [ uc, ub ];

		}

		this.pos.push( ...a, ...b, ...c );
		const l = Math.hypot( n[ 0 ], n[ 1 ], n[ 2 ] ) || 1;
		for ( let i = 0; i < 3; i ++ ) this.nrm.push( n[ 0 ] / l, n[ 1 ] / l, n[ 2 ] / l );
		this.uv.push( ...ua, ...ub, ...uc );
		this.count ++;

	}

	geometry() {

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( this.pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( this.nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( this.uv, 2 ) );
		g.computeBoundingBox();
		g.computeBoundingSphere();
		return g;

	}

}

// ---------------------------------------------------------------- the surface shader

function fieldMaterial( boundary, yaw ) {

	const module = new ShaderModule( {
		name: 'ballparkField',
		deps: [ commonModule ],
		code: /* wgsl */`
const BP_FT: f32 = ${ f( FT ) };
const BP_BASE: f32 = ${ f( BASE ) };
// where the infielders stand (1B, 2B, SS, 3B)
const BP_SPOTS = array<vec2f, 4>( ${ [ [ 39, 112 ], [ 15, 148 ], [ - 13, 146 ], [ - 38, 108 ] ].map( ( [ deg, ft ] ) => { const r = deg * Math.PI / 180, d = ft * FT; return `vec2f( ${ f( Math.sin( r ) * d ) }, ${ f( - Math.cos( r ) * d ) } )`; } ).join( ', ' ) } );
${ wgslArray( 'BP_FIELD', boundary ) }

// signed distance to the fence line round the playing field (negative inside)
fn bpFieldSd( p: vec2f ) -> f32 {
	var d = 1e9;
	var inside = false;
	var j = ${ boundary.length - 1 };
	for ( var i = 0; i < ${ boundary.length }; i++ ) {
		let a = BP_FIELD[ i ];
		let b = BP_FIELD[ j ];
		let e = b - a;
		let w = p - a;
		let t = clamp( dot( w, e ) / dot( e, e ), 0.0, 1.0 );
		d = min( d, length( w - e * t ) );
		if ( ( a.y > p.y ) != ( b.y > p.y ) && p.x < e.x * ( p.y - a.y ) / e.y + a.x ) { inside = !inside; }
		j = i;
	}
	return select( d, -d, inside );
}

// antialiased 0..1 coverage of a band |d| < w (d in metres), fw = the pixel footprint
fn bpBand( d: f32, w: f32, fw: f32 ) -> f32 {
	return 1.0 - smoothstep( w - fw, w + fw, abs( d ) );
}

// outline of the rectangle lo..hi (a chalk box), line half width w
// is this (edge-roughened) field point on the infield skin?
fn bpDirt( pe: vec2f ) -> bool {
	let ae = dot( pe, vec2f( ${ f( Math.SQRT1_2 ) }, ${ f( - Math.SQRT1_2 ) } ) );
	let be = dot( pe, vec2f( ${ f( - Math.SQRT1_2 ) }, ${ f( - Math.SQRT1_2 ) } ) );
	let plate = vec2f( 0.0, ${ f( - 17 / 12 * FT / 2 ) } );
	let rubber = vec2f( 0.0, ${ f( - RUBBER_FRONT ) } );
	let moundC = vec2f( 0.0, ${ f( - MOUND_CENTER ) } );
	let first = vec2f( ${ f( BASE * Math.SQRT1_2 ) }, ${ f( - BASE * Math.SQRT1_2 ) } );
	let third = vec2f( ${ f( - BASE * Math.SQRT1_2 ) }, ${ f( - BASE * Math.SQRT1_2 ) } );
	var dirt = length( pe - rubber ) < ${ f( ARC ) } && ae > -0.35 && be > -0.35;
	let square = ae > ${ f( PATH ) } && be > ${ f( PATH ) } && ae < ${ f( BASE - GRASS_INSET ) } && be < ${ f( BASE - GRASS_INSET ) };
	if ( square ) { dirt = false; }
	if ( abs( be ) < ${ f( PATH ) } && ae > 0.0 && ae < BP_BASE ) { dirt = true; }
	if ( abs( ae ) < ${ f( PATH ) } && be > 0.0 && be < BP_BASE ) { dirt = true; }
	// the runner's lane, the last 45 ft to first: the dirt widens into foul territory
	if ( be < ${ f( 2 * FT ) } && be > ${ f( - 3.5 * FT ) } && ae > ${ f( BASE - 45 * FT ) } && ae < BP_BASE ) { dirt = true; }
	if ( length( pe - plate ) < ${ f( PLATE_CIRCLE ) } ) { dirt = true; }
	if ( length( pe - moundC ) < ${ f( MOUND_RADIUS ) } ) { dirt = true; }
	if ( length( pe - first ) < 3.2 || length( pe - third ) < 3.2 ) { dirt = true; }
	return dirt;
}

fn bpBox( p: vec2f, lo: vec2f, hi: vec2f, w: f32, fw: f32 ) -> f32 {
	let c = ( lo + hi ) * 0.5;
	let h = ( hi - lo ) * 0.5;
	let q = abs( p - c ) - h;
	let sd = length( max( q, vec2f( 0.0 ) ) ) + min( max( q.x, q.y ), 0.0 );
	return bpBand( sd, w, fw );
}
`,
	} );

	const r2 = Math.SQRT1_2;
	const mat = standard( {
		name: 'field',
		roughness: 0.95,
		modules: [ module ],
		uniforms: { fieldYaw: [ 'vec2f', new Vector2( Math.cos( yaw ), Math.sin( yaw ) ) ], wet: [ 'f32', 0 ] },
		varyings: { vField: 'vec2f' },
		vertex: 'o.vField = v.position.xz;',
		surface: /* wgsl */`
	let p = in.vs.vField;
	let fw = max( length( fwidth( p ) ) * 0.75, 0.004 );
	// the view direction in the field frame (for the mowing stripes)
	let cy = mat.fieldYaw.x; let sy = mat.fieldYaw.y;
	let Vf = normalize( vec2f( in.V.x * cy - in.V.z * sy, in.V.x * sy + in.V.z * cy ) + vec2f( 1e-4 ) );
	// along the first base line (a) and the third base line (b)
	let a = dot( p, vec2f( ${ f( r2 ) }, ${ f( - r2 ) } ) );
	let b = dot( p, vec2f( ${ f( - r2 ) }, ${ f( - r2 ) } ) );
	let sd = bpFieldSd( p );
	let n1 = mx_noise_float2( p * 0.35 );
	let n2 = mx_noise_float2( p * 2.7 );
	let n3 = mx_noise_float2( p * 19.0 );

	// ---- which surface
	let plate = vec2f( 0.0, ${ f( - 17 / 12 * FT / 2 ) } );
	let rubber = vec2f( 0.0, ${ f( - RUBBER_FRONT ) } );
	let moundC = vec2f( 0.0, ${ f( - MOUND_CENTER ) } );
	let first = vec2f( ${ f( BASE * r2 ) }, ${ f( - BASE * r2 ) } );
	let third = vec2f( ${ f( - BASE * r2 ) }, ${ f( - BASE * r2 ) } );
	// infield skin: inside the arc on the fair side, less the grass square inside the diamond (the edges
	// a little ragged, as a groundskeeper's edging is)
	let pe = p + vec2f( mx_noise_float2( p * 7.0 ), mx_noise_float2( p * 7.0 + 17.0 ) ) * 0.03;
	let ae = dot( pe, vec2f( ${ f( r2 ) }, ${ f( - r2 ) } ) );
	let be = dot( pe, vec2f( ${ f( - r2 ) }, ${ f( - r2 ) } ) );
	let square = ae > ${ f( PATH ) } && be > ${ f( PATH ) } && ae < ${ f( BASE - GRASS_INSET ) } && be < ${ f( BASE - GRASS_INSET ) };
	var dirt = bpDirt( pe );
	let track = sd > -${ f( TRACK ) };
	let outside = sd > 0.0;

	// ---- colours
	// grass: two mowing passes along the foul lines make a checkerboard; each pass looks light seen
	// along the direction it was mown and dark against it
	let cell = ${ f( 15 * FT ) };
	// (the stripes' edges soft over a hand's width: the mower's wheels don't track a ruler)
	let ma = clamp( sin( a * PI / cell ) * 9.0, -1.0, 1.0 );
	let mb = clamp( sin( b * PI / cell ) * 9.0, -1.0, 1.0 );
	let da = vec2f( ${ f( r2 ) }, ${ f( - r2 ) } );
	let db = vec2f( ${ f( - r2 ) }, ${ f( - r2 ) } );
	// the checkerboard shows from every side; looking along a pass makes it stronger; the blades lean
	// the way they were mown, so the stripes show most from low down and soften seen from above
	let graze = mix( 0.55, 1.25, 1.0 - abs( in.V.y ) );
	var mow = 1.0 + ( 0.1 * ma * mb + 0.14 * ma * dot( Vf, da ) + 0.14 * mb * dot( Vf, db ) ) * graze;
	// the infield grass: the same diagonal checkerboard, finer (6 ft squares)
	if ( square ) {
		let ia = clamp( sin( a * PI / ${ f( 6 * FT ) } ) * 5.0, -1.0, 1.0 );
		let ib = clamp( sin( b * PI / ${ f( 6 * FT ) } ) * 5.0, -1.0, 1.0 );
		mow = 1.0 + ( 0.1 * ia * ib + 0.1 * ia * dot( Vf, da ) + 0.1 * ib * dot( Vf, db ) ) * graze;
	}
	// Kentucky bluegrass in October: a bright, yellowish green
	var col = vec3f( 0.14, 0.31, 0.05 ) * mow * ( 0.9 + 0.14 * n1 ) * ( 0.93 + 0.09 * n2 ) * ( 0.95 + 0.07 * n3 ) * ( 0.95 + 0.08 * mx_noise_float2( p * 6.0 ) );
	var rough = 0.95;
	// worn where the outfielders stand, and a few divots
	let wear = max( max( 1.0 - smoothstep( 2.0, 7.0, length( p - vec2f( -46.0, -80.0 ) ) ), 1.0 - smoothstep( 2.0, 7.0, length( p - vec2f( 0.0, -97.0 ) ) ) ), 1.0 - smoothstep( 2.0, 7.0, length( p - vec2f( 46.0, -80.0 ) ) ) );
	col = mix( col, col * vec3f( 1.25, 1.02, 0.6 ), wear * ( 0.35 + 0.3 * n2 ) );
	let dc = floor( p / 1.7 );
	let dh = fract( sin( dot( dc, vec2f( 17.3, 61.9 ) ) ) * 4375.85 );
	let dvt = length( ( p - dc * 1.7 - vec2f( fract( dh * 11.0 ), fract( dh * 23.0 ) ) * 1.5 ) / vec2f( 0.05, 0.08 ) );
	if ( dh > 0.93 ) { col = mix( col, vec3f( 0.2, 0.11, 0.05 ), 1.0 - smoothstep( 0.7, 1.0, dvt ) ); }
	// up close the blades come through: fine streaks a few mm wide, clumped, their tips catching the
	// light; they fade into the average colour with distance
	let bladeK = 1.0 - smoothstep( 0.004, 0.022, fw );
	if ( bladeK > 0.0 && ! dirt && ! track && ! outside ) {
		let ang = mx_noise_float2( p * 1.3 ) * 3.0;
		let q = vec2f( p.x * cos( ang ) - p.y * sin( ang ), p.x * sin( ang ) + p.y * cos( ang ) );
		let bl = mx_noise_float2( q * vec2f( 260.0, 22.0 ) );
		let clump = mx_noise_float2( p * 9.0 );
		col = col * ( 1.0 + bladeK * ( 0.3 * bl + 0.14 * clump ) );
		let gn = vec2f( mx_noise_float2( q * vec2f( 170.0, 28.0 ) ), mx_noise_float2( q * vec2f( 28.0, 170.0 ) + 7.0 ) );
		s.normal = normalize( s.normal + vec3f( gn.x, 0.0, gn.y ) * 0.4 * bladeK );
	}
	// where the grass meets the clay it stands a few cm proud: a dark lip on the grass side
	if ( ! dirt && ! outside && fw < 0.05 ) {
		let o = 0.06;
		if ( bpDirt( pe + vec2f( o, 0.0 ) ) || bpDirt( pe - vec2f( o, 0.0 ) ) || bpDirt( pe + vec2f( 0.0, o ) ) || bpDirt( pe - vec2f( 0.0, o ) ) ) { col = col * 0.8; }
	}
	if ( dirt ) {
		// the infield clay: a warm orange-tan
		col = vec3f( 0.56, 0.27, 0.11 ) * ( 0.9 + 0.12 * n1 ) * ( 0.93 + 0.1 * n2 ) * ( 0.9 + 0.14 * n3 );
		// packed red clay, darker and scuffed: the mound's table round the rubber, the landing area a
		// stride in front of it, and the batter's boxes and catcher's box round the plate
		let tp = p - rubber;
		let tableK = 1.0 - smoothstep( 0.0, 0.25, max( abs( tp.x ) - 0.85, abs( tp.y + 0.2 ) - 0.55 ) );
		// the two holes dug by the pitchers' landing feet, a stride in front of the rubber
		let lp1 = ( p - rubber - vec2f( 0.25, 1.7 ) ) / vec2f( 0.3, 0.38 );
		let lp2 = ( p - rubber - vec2f( - 0.25, 1.7 ) ) / vec2f( 0.3, 0.38 );
		let landK = 1.0 - smoothstep( 0.0, 0.4, min( length( lp1 ), length( lp2 ) ) - 1.0 );
		let hp = p - plate;
		let boxK = 1.0 - smoothstep( 0.0, 0.35, max( abs( hp.x ) - 1.95, abs( hp.y - 0.3 ) - 1.55 ) );
		let clay = max( max( tableK, landK ), boxK );
		let scuff = 0.78 + 0.3 * mx_noise_float2( p * 5.0 ) + 0.12 * mx_noise_float2( p * 23.0 );
		// the mound's paler buff clay
		let moundK = 1.0 - smoothstep( ${ f( MOUND_RADIUS ) } - 0.08, ${ f( MOUND_RADIUS ) } + 0.02, length( p - moundC ) );
		col = mix( col, vec3f( 0.57, 0.33, 0.19 ) * ( 0.9 + 0.12 * n2 ), moundK * 0.85 );
		col = mix( col, vec3f( 0.36, 0.15, 0.07 ) * scuff, clay * 0.6 );
		col = mix( col, vec3f( 0.3, 0.1, 0.05 ) * scuff, landK * 0.45 );
		// drag arcs round the mound (the crew's mats), footwork scuffs where the infielders stand, the
		// base paths trodden darker; up close, the clay's granules
		let near = 1.0 - smoothstep( 0.004, 0.03, fw );
		let rm = length( p - moundC );
		let arcs = sin( rm * 125.0 + mx_noise_float2( p * 0.6 ) * 3.0 ) * ( 1.0 - moundK ) * ( 1.0 - clay );
		col = col * ( 1.0 + 0.035 * arcs * ( 1.0 - smoothstep( 0.01, 0.05, fw ) ) );
		let wear = max( max( 1.0 - smoothstep( 1.2, 3.2, length( p - BP_SPOTS[ 0 ] ) ), 1.0 - smoothstep( 1.2, 3.2, length( p - BP_SPOTS[ 1 ] ) ) ),
			max( 1.0 - smoothstep( 1.2, 3.2, length( p - BP_SPOTS[ 2 ] ) ), 1.0 - smoothstep( 1.2, 3.2, length( p - BP_SPOTS[ 3 ] ) ) ) );
		let bpath = max( 1.0 - smoothstep( 0.1, 0.45, abs( b ) ), 1.0 - smoothstep( 0.1, 0.45, abs( a ) ) );
		let scuffs = smoothstep( 0.35, 0.8, mx_noise_float2( p * 3.5 ) ) * wear;
		col = col * ( 1.0 - 0.14 * scuffs - 0.08 * bpath * ( 1.0 - moundK ) );
		let gcell = floor( p / 0.004 );
		let gran = fract( sin( dot( gcell, vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
		col = col * ( 1.0 + ( gran - 0.5 ) * 0.16 * near );
		rough = 0.92;
		// the edge of the grass: a soft lip, not a razor line
	}
	if ( track ) {
		col = vec3f( 0.25, 0.075, 0.045 ) * ( 0.9 + 0.12 * n1 ) * ( 0.9 + 0.15 * n3 );
		rough = 0.95;
	}

	// ---- chalk
	var chalk = 0.0;
	let lw = ${ f( 1.5 / 12 * FT ) };
	if ( ! outside ) {
		// foul lines (the lines are fair): from past the batter's boxes to the fence
		if ( a > 1.6 ) { chalk = max( chalk, bpBand( b - lw, lw, fw ) ); }
		if ( b > 1.6 ) { chalk = max( chalk, bpBand( a - lw, lw, fw ) ); }
		// batter's boxes: 4 x 6 ft, 6 in off the plate, centred on it
		let bx0 = ${ f( 17 / 12 * FT / 2 + 6 / 12 * FT ) };
		let zc = plate.y;
		chalk = max( chalk, bpBox( p, vec2f( bx0, zc - ${ f( 3 * FT ) } ), vec2f( bx0 + ${ f( 4 * FT ) }, zc + ${ f( 3 * FT ) } ), lw, fw ) );
		chalk = max( chalk, bpBox( p, vec2f( -bx0 - ${ f( 4 * FT ) }, zc - ${ f( 3 * FT ) } ), vec2f( -bx0, zc + ${ f( 3 * FT ) } ), lw, fw ) );
		// catcher's box: 43 in wide, 8 ft back from the batter's boxes
		let cb = zc + ${ f( 3 * FT ) };
		if ( p.y > cb && p.y < cb + ${ f( 8 * FT ) } ) { chalk = max( chalk, bpBand( abs( p.x ) - ${ f( 43 / 24 * FT ) }, lw, fw ) ); }
		if ( abs( p.x ) < ${ f( 43 / 24 * FT ) } ) { chalk = max( chalk, bpBand( p.y - cb - ${ f( 8 * FT ) }, lw, fw ) ); }
		// runner's lane: the last 45 ft to first base, 3 ft into foul territory
		if ( a > ${ f( BASE - 45 * FT ) } && a < BP_BASE ) { chalk = max( chalk, bpBand( b + ${ f( 3 * FT ) }, lw, fw ) ); }
		if ( b < 0.0 && b > ${ f( - 3 * FT ) } ) { chalk = max( chalk, bpBand( a - ${ f( BASE - 45 * FT ) }, lw, fw ) ); }
		// coaches' boxes: 20 x 10 ft, 15 ft off the lines by first and third
		// (only the outer 20 ft line of each was chalked, with a short tick at each end)
		for ( var cs = 0; cs < 2; cs ++ ) {
			let q = select( vec2f( b, a ), vec2f( a, b ), cs == 0 );
			if ( q.x > ${ f( BASE - 14 * FT ) } && q.x < ${ f( BASE + 6 * FT ) } ) { chalk = max( chalk, bpBand( q.y + ${ f( 25 * FT ) }, lw, fw ) ); }
			if ( q.y > ${ f( - 25 * FT ) } && q.y < ${ f( - 24 * FT ) } ) {
				chalk = max( chalk, bpBand( q.x - ${ f( BASE - 14 * FT ) }, lw, fw ) );
				chalk = max( chalk, bpBand( q.x - ${ f( BASE + 6 * FT ) }, lw, fw ) );
			}
		}
		// on-deck circles
		for ( var sgn = -1.0; sgn <= 1.0; sgn += 2.0 ) {
			chalk = max( chalk, bpBand( length( p - vec2f( sgn * 13.9, 4.6 ) ) - ${ f( 2.5 * FT ) }, lw, fw ) );
		}
	}
	if ( chalk > 0.0 ) {
		col = mix( col, vec3f( 0.8, 0.8, 0.77 ) * ( 0.95 + 0.05 * n3 ), chalk );
		rough = mix( rough, 0.8, chalk );
	}

	// ---- rain: darker and shinier as it soaks in; when it's pouring, water stands in the low spots of the
	// infield dirt (round home plate and second base went under on October 27, 2008)
	let wet = mat.wet;
	if ( wet > 0.001 && ! outside ) {
		let k = select( 0.2, 0.42, dirt || track );
		col *= 1.0 - k * wet;
		rough = mix( rough, rough * select( 0.45, 0.28, dirt || track ), wet );
		if ( dirt ) {
			let second = vec2f( 0.0, ${ f( - BASE * Math.SQRT2 ) } );
			let low = 1.0 - smoothstep( 0.0, 7.0, min( length( p - plate ), length( p - second ) ) );
			let pud = smoothstep( 0.66, 0.74, 0.35 + 0.35 * mx_noise_float2( p * 0.22 + 3.1 ) + 0.1 * mx_noise_float2( p * 1.3 ) + low * 0.55 - ( 1.0 - wet ) * 0.9 );
			col = mix( col, col * 0.3, pud );
			rough = mix( rough, 0.03, pud );
		}
	}

	// ---- outside the fence: the concrete apron (the stands go here)
	if ( outside ) {
		col = vec3f( 0.3, 0.29, 0.27 ) * ( 0.85 + 0.15 * n1 ) * ( 0.95 + 0.06 * n3 );
		rough = 0.85;
	}

	s.albedo = col;
	s.roughness = rough;
	// under the lights the field is lit evenly from every side (six banks): a lift the spots alone miss
	if ( ! outside ) { s.emissive = col * smoothstep( 0.2, 0.8, frame.night ) * 0.35; }
`,
	} );
	mat.underwaterLighting = 'none';
	return mat;

}
