import { Group, Mesh, Color } from '../engine/index.js';
import { standard } from '../materials/Materials.js';
import { Quads } from './Stands.js';
import { canvasTexture, beam, box } from './geo.js';
import { FT, LEVELS } from './layout.js';

// The Liberty Bell sign in right-center, as the Phillies put it up in 2004 (35 ft wide, its lip 100 ft
// over the street): a white sheet-steel channel carrying two lines of neon traces the bell, a separate
// castellated yoke over it with a row of five star lamps, a diamond lattice inside the bell with an
// eight-point star lamp on its crossings, the crack an outlined zig-zag up from the lip, the clapper a
// medallion with a star. Cool white neon, a touch blue at night; the stars warm. It hangs on the front of
// a heavy maroon lattice tower (a caged ladder, two catwalks, the power cabinets) that also carries the
// bank's green emblem and "Citizens Bank / Park" in green channel letters under the bell.
//
// After a Phillies home run, and at the last out, the bell swings in its yoke and tolls, its neon chasing
// and its stars flashing (update(), from the replay's time, so it follows scrubbing).
//
// Sign space: u across (to the right as seen from home plate), v up from the bell's lip, metres. The
// group faces home (local -z toward home plate, so local x = -u).

const STREET = LEVELS.mainConcourse;
const PIVOT = 9.25; // where the bell hangs from the yoke's crown, v
const ZF = - 1.2; // the channel's face (the tower's front legs at z = -0.3)
const DEPTH = 0.45;

export class LibertyBell {

	constructor( { parent, at, steel, field, colliders } ) {

		const [ x, z ] = at;
		const g = this.group = new Group();
		g.name = 'liberty-bell';
		g.position.set( x, 0, z );
		g.rotation.y = Math.atan2( - x, - z ) + Math.PI;
		parent.add( g );
		this.y0 = STREET + 100 * FT;
		this.steel = steel;
		this.field = field;
		this.colliders = colliders;
		this._materials();
		this._tower();
		this._sign();
		this._letters();
		this.swing = 0;
		this.ring = 0;
		this._lastToll = - 1;
		this._triggers = null;

	}

	_materials() {

		// the channel: white sheet steel, the glow of its own neon on it after dark
		this.channelMat = standard( { name: 'bell-channel', color: new Color( 0.74, 0.75, 0.73 ), roughness: 0.45, metalness: 0.3,
			surface: 's.emissive = vec3f( 0.55, 0.6, 0.7 ) * 0.06 * smoothstep( 0.1, 0.7, frame.night );' } );
		// the neon: two lines of tubes in the channel. Pale by day, cool white after dark; when it rings, the
		// light chases up and down the outline and pulses
		this.neonMat = standard( { name: 'bell-neon', color: new Color( 0.85, 0.88, 0.92 ), roughness: 0.3,
			uniforms: { ring: [ 'f32', 0 ] },
			surface: /* wgsl */`
	let ph = fract( in.P.y * 0.3 - frame.time * 1.7 + 0.15 * sin( in.P.x * 0.9 ) );
	let chase = mix( 1.0, 0.3 + 1.2 * smoothstep( 0.3, 0.45, ph ) * ( 1.0 - smoothstep( 0.8, 0.95, ph ) ), mat.ring );
	let n = smoothstep( 0.1, 0.7, frame.night );
	s.emissive = mix( vec3f( 0.9, 0.93, 1.0 ), vec3f( 0.8, 0.88, 1.0 ), n ) * mix( 0.5, 3.6, n ) * chase * ( 1.0 + 0.6 * mat.ring * sin( frame.time * 9.0 ) );
` } );
		this.latticeMat = standard( { name: 'bell-lattice', color: new Color( 0.52, 0.54, 0.54 ), roughness: 0.5, metalness: 0.5,
			surface: 's.emissive = vec3f( 0.6, 0.62, 0.7 ) * 0.035 * smoothstep( 0.1, 0.7, frame.night );' } );
		const starTex = canvasTexture( 128, 128, ( ctx, w, h ) => {

			// an eight-point star lamp: long points on the axes, short ones between, a bright bulb in the
			// middle
			ctx.clearRect( 0, 0, w, h );
			ctx.translate( w / 2, h / 2 );
			ctx.beginPath();
			for ( let i = 0; i < 16; i ++ ) {

				const a = i * Math.PI / 8 - Math.PI / 2, r = i % 4 === 0 ? 62 : i % 2 === 0 ? 44 : 16;
				ctx.lineTo( Math.cos( a ) * r, Math.sin( a ) * r );

			}

			ctx.closePath();
			ctx.fillStyle = '#d8dad6';
			ctx.fill();
			ctx.lineWidth = 3; ctx.strokeStyle = '#8a8c8a'; ctx.stroke();
			const bulb = ctx.createRadialGradient( 0, 0, 0, 0, 0, 18 );
			bulb.addColorStop( 0, '#ffffff' ); bulb.addColorStop( 1, '#fff2cc' );
			ctx.fillStyle = bulb;
			ctx.beginPath(); ctx.arc( 0, 0, 14, 0, Math.PI * 2 ); ctx.fill();

		}, 'bellStar' );
		this.starMat = standard( { name: 'bell-stars', roughness: 0.4, alphaTest: 0.4, side: 'double', textures: { bpStar: starTex },
			uniforms: { ring: [ 'f32', 0 ] },
			surface: /* wgsl */`
	let t = textureSample( bpStar, smpAnisoClamp, in.uv );
	s.alpha = t.a;
	s.albedo = t.rgb * 0.8;
	let n = smoothstep( 0.1, 0.7, frame.night );
	// flashing when it rings, each star on its own beat
	let beat = step( 0.5, fract( frame.time * 2.6 + fract( sin( dot( floor( in.P.xy * 1.3 ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 ) ) );
	s.emissive = vec3f( 1.0, 0.9, 0.7 ) * t.rgb * mix( 0.35, 2.6, n ) * mix( 1.0, 0.25 + 2.2 * beat, mat.ring );
` } );
		this.gratingMat = standard( { name: 'bell-grating', color: new Color( 0.16, 0.16, 0.16 ), roughness: 0.7, metalness: 0.5 } );
		for ( const m of [ this.channelMat, this.neonMat, this.latticeMat, this.starMat, this.gratingMat ] ) m.underwaterLighting = 'none';

	}

	// sign space to the group's local frame (or the swinging bell's, round its pivot)
	L( p, z, swing = false ) {

		return [ - p[ 0 ], swing ? p[ 1 ] - PIVOT : this.y0 + p[ 1 ], z ];

	}

	// A white channel along a polyline in sign space, its face `w` wide, DEPTH deep, two neon lines on it
	_channel( q, nq, P, closed, w = 0.42, swing = false ) {

		const A = offsetPath( P, w / 2, closed ), B = offsetPath( P, - w / 2, closed );
		const zb = ZF + DEPTH, L = ( p, zz ) => this.L( p, zz, swing );
		const m = closed ? P.length : P.length - 1;
		for ( let i = 0; i < m; i ++ ) {

			const j = ( i + 1 ) % P.length;
			const du = P[ j ][ 0 ] - P[ i ][ 0 ], dv = P[ j ][ 1 ] - P[ i ][ 1 ], l = Math.hypot( du, dv ) || 1;
			const nu = - dv / l, nv = du / l;
			q.add( L( A[ i ], ZF ), L( A[ j ], ZF ), L( B[ j ], ZF ), L( B[ i ], ZF ), [ 0, 0, - 1 ] );
			q.add( L( A[ i ], ZF ), L( A[ j ], ZF ), L( A[ j ], zb ), L( A[ i ], zb ), [ - nu, nv, 0 ] );
			q.add( L( B[ i ], ZF ), L( B[ j ], ZF ), L( B[ j ], zb ), L( B[ i ], zb ), [ nu, - nv, 0 ] );
			q.add( L( A[ i ], zb ), L( A[ j ], zb ), L( B[ j ], zb ), L( B[ i ], zb ), [ 0, 0, 1 ] );

		}

		if ( ! closed ) for ( const [ i, k ] of [ [ 0, 1 ], [ P.length - 1, P.length - 2 ] ] ) {

			const du = P[ i ][ 0 ] - P[ k ][ 0 ], dv = P[ i ][ 1 ] - P[ k ][ 1 ], l = Math.hypot( du, dv ) || 1;
			q.add( L( A[ i ], ZF ), L( B[ i ], ZF ), L( B[ i ], zb ), L( A[ i ], zb ), [ - du / l, dv / l, 0 ] );

		}

		// the neon: two tubes along the face
		for ( const o of [ - w * 0.24, w * 0.24 ] ) {

			const T = offsetPath( P, o, closed );
			for ( let i = 0; i < m; i ++ ) beam( nq, L( T[ i ], ZF - 0.04 ), L( T[ ( i + 1 ) % T.length ], ZF - 0.04 ), 0.075 );

		}

	}

	// ---------------------------------------------------------------- the sign

	_sign() {

		const y0 = this.y0;
		// the bell's outline: a flat lip turned up at its corners, the flare, straight sides narrowing a
		// little to the rounded shoulders, a flat crown
		const half = [ [ 0, 0 ], [ 4.85, 0 ], [ 5.15, 0.07 ], [ 5.27, 0.25 ] ];
		for ( let k = 1; k <= 9; k ++ ) {

			const s = k / 9, v = 0.25 + s * 3.35;
			half.push( [ 2.86 + 2.41 * Math.pow( 1 - s, 2.3 ), v ] );

		}

		half.push( [ 2.83, 5.3 ], [ 2.78, 7.1 ] );
		for ( let k = 1; k <= 7; k ++ ) {

			const a = k / 7 * Math.PI / 2;
			half.push( [ 1.58 + 1.2 * Math.cos( a ), 7.1 + 1.2 * Math.sin( a ) ] );

		}

		half.push( [ 0, 8.3 ] );
		const outline = [ ...half.slice( 0, - 1 ), ...half.slice( 1 ).reverse().map( ( [ u, v ] ) => [ - u, v ] ) ];
		// the half-width inside the outline at a height
		const widthAt = ( v ) => {

			for ( let i = 0; i < half.length - 1; i ++ ) {

				const [ u0, v0 ] = half[ i ], [ u1, v1 ] = half[ i + 1 ];
				if ( v >= Math.min( v0, v1 ) && v <= Math.max( v0, v1 ) && v1 !== v0 ) return u0 + ( u1 - u0 ) * ( v - v0 ) / ( v1 - v0 );

			}

			return 0;

		};

		// the swinging part: everything below the crown, hung from a pivot under the yoke
		const sw = this.bellGroup = new Group();
		sw.name = 'liberty-bell-swing';
		sw.position.set( 0, y0 + PIVOT, 0 );
		sw.userData.dynamic = true;
		this.group.add( sw );
		const cq = new Quads(), nq = new Quads(), lq = new Quads(), sq = new Quads();
		this._channel( cq, nq, outline, true, 0.44, true );
		// the crack: an outlined zig-zag ribbon from the lip, on the left as you look at it
		const crack = [ [ - 1.2, 0.05 ], [ - 1.38, 0.9 ], [ - 1.12, 1.7 ], [ - 1.44, 2.6 ], [ - 1.2, 3.35 ], [ - 1.34, 4.2 ], [ - 1.2, 4.95 ] ];
		this._channel( cq, nq, crack, false, 0.3, true );
		// the clapper: a stem through the lip, a ring, the medallion with a star in it
		const circle = ( cu, cv, r, n ) => Array.from( { length: n }, ( _, i ) => [ cu + r * Math.sin( i / n * Math.PI * 2 ), cv + r * Math.cos( i / n * Math.PI * 2 ) ] );
		this._channel( cq, nq, circle( 0, - 1.4, 0.62, 20 ), true, 0.26, true );
		this._channel( cq, nq, circle( 0, - 0.55, 0.2, 10 ), true, 0.12, true );
		beam( lq, this.L( [ 0, 0.3 ], ZF + 0.2, true ), this.L( [ 0, - 0.36 ], ZF + 0.2, true ), 0.12 );
		beam( lq, this.L( [ 0, - 0.75 ], ZF + 0.2, true ), this.L( [ 0, - 0.78 ], ZF + 0.2, true ), 0.12 );
		const star = ( sq, u, v, size, swing ) => {

			const [ x, y, z ] = this.L( [ u, v ], ZF - 0.02, swing );
			const h = size / 2;
			sq.tri( [ x - h, y - h, z ], [ x + h, y - h, z ], [ x + h, y + h, z ], [ 0, 0, - 1 ], [ 1, 1 ], [ 0, 1 ], [ 0, 0 ] );
			sq.tri( [ x - h, y - h, z ], [ x + h, y + h, z ], [ x - h, y + h, z ], [ 0, 0, - 1 ], [ 1, 1 ], [ 0, 0 ], [ 1, 0 ] );

		};

		star( sq, 0, - 1.4, 0.8, true );
		// the lattice: horizontals every 1.05 m and diagonals at 60 degrees through the same nodes (a
		// field of triangles, diamonds where the diagonals cross), clipped to the inside of the outline
		const zl = ZF + 0.22, dv = 1.05, du = 2 * dv / Math.tan( Math.PI / 3 ), vb = 0.95;
		const inside = ( u, v, m ) => v > 0.3 + m && v < 8.3 - 0.3 - m && Math.abs( u ) < widthAt( v ) - 0.3 - m;
		const runs = ( a, b ) => {

			// the stretches of the segment a -> b inside the bell
			const n = Math.ceil( Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] ) / 0.05 );
			let start = null;
			for ( let i = 0; i <= n; i ++ ) {

				const t = i / n, p = [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t ];
				const inn = inside( p[ 0 ], p[ 1 ], 0 );
				if ( inn && ! start ) start = p;
				if ( ( ! inn || i === n ) && start ) {

					if ( Math.hypot( p[ 0 ] - start[ 0 ], p[ 1 ] - start[ 1 ] ) > 0.3 ) beam( lq, this.L( start, zl, true ), this.L( p, zl, true ), 0.13 );
					start = null;

				}

			}

		};

		for ( let r = 0; r < 8; r ++ ) runs( [ - 6, vb + r * dv ], [ 6, vb + r * dv ] );
		for ( let j = - 14; j <= 14; j ++ ) {

			const u = j * du;
			for ( const s of [ - 1, 1 ] ) runs( [ u - s * vb / Math.tan( Math.PI / 3 ), 0 ], [ u + s * ( 9 - vb ) / Math.tan( Math.PI / 3 ), 9 ] );

		}

		// the star lamps on the crossings
		for ( let r = 0; r < 8; r ++ ) for ( let j = - 6; j <= 6; j ++ ) {

			const u = j * du + ( r % 2 ? du / 2 : 0 ), v = vb + r * dv;
			if ( inside( u, v, 0.28 ) ) star( sq, u, v, 0.62, true );

		}

		// brackets from the channel back to the lattice plane, round the outline
		for ( let i = 0; i < outline.length; i += 3 ) {

			const [ u, v ] = outline[ i ];
			const k = 1 - 0.35 / Math.max( 0.5, Math.hypot( u, v - 4 ) );
			beam( lq, this.L( [ u, v ], ZF + DEPTH, true ), this.L( [ u * k, 4 + ( v - 4 ) * k ], zl, true ), 0.08 );

		}

		const add = ( parent, q, mat, name, shadow = true ) => {

			const m = new Mesh( q.geometry(), mat );
			m.name = name;
			m.castShadow = shadow;
			m.userData.dynamic = parent === sw;
			parent.add( m );
			return m;

		};

		add( sw, cq, this.channelMat, 'bell-channel' );
		add( sw, nq, this.neonMat, 'bell-neon', false );
		add( sw, lq, this.latticeMat, 'bell-lattice' );
		add( sw, sq, this.starMat, 'bell-stars', false );

		// the yoke, fixed to the tower: a castellated outline stepping up to a raised middle, its ends
		// dropping past the bell's shoulders, its underside hung with the crown's loops; a bar across it
		// with five star lamps, and the steel behind
		const yh = [ [ 0, 12.75 ], [ 1.3, 12.75 ], [ 1.3, 12.52 ], [ 2.55, 12.52 ], [ 2.55, 12.3 ], [ 4.2, 12.3 ], [ 4.2, 12.12 ], [ 5.35, 12.12 ], [ 5.35, 8.1 ], [ 3.65, 8.1 ], [ 3.65, 8.8 ], [ 3.1, 8.8 ], [ 3.1, 9.55 ], [ 1.55, 9.55 ] ];
		for ( let k = 1; k < 8; k ++ ) {

			const a = - k / 8 * Math.PI;
			yh.push( [ 1.05 + 0.48 * Math.cos( a ), 9.55 + 0.48 * Math.sin( a ) ] );

		}

		yh.push( [ 0.55, 9.55 ] );
		for ( let k = 1; k < 4; k ++ ) {

			const a = - k / 4 * Math.PI / 2;
			yh.push( [ 0.48 * Math.cos( a ), 9.55 + 0.48 * Math.sin( a ) ] );

		}

		yh.push( [ 0, 9.07 ] );
		// clockwise from the top middle round the right half, then the left half mirrored back up
		const yoke = [ ...yh.slice( 0, - 1 ), ...yh.slice( 1 ).reverse().map( ( [ u, v ] ) => [ - u, v ] ) ];
		const ycq = new Quads(), ynq = new Quads(), ylq = new Quads(), ysq = new Quads();
		this._channel( ycq, ynq, yoke, true, 0.38 );
		beam( ylq, this.L( [ - 5.1, 10.95 ], zl ), this.L( [ 5.1, 10.95 ], zl ), 0.16 );
		for ( const u of [ - 3.1, - 1.3, 1.3, 3.1 ] ) beam( ylq, this.L( [ u, 9.7 ], zl ), this.L( [ u, 12.1 ], zl ), 0.12 );
		for ( const u of [ - 4.1, - 2.05, 0, 2.05, 4.1 ] ) star( ysq, u, 10.95, 0.72, false );
		// the hanger: the crown's steel from the yoke down to the pivot
		for ( const u of [ - 0.3, 0.3 ] ) beam( ylq, this.L( [ u, 9.1 ], zl ), this.L( [ u, 9.7 ], zl ), 0.14 );
		add( this.group, ycq, this.channelMat, 'bell-yoke' );
		add( this.group, ynq, this.neonMat, 'bell-yoke-neon', false );
		add( this.group, ylq, this.latticeMat, 'bell-yoke-steel' );
		add( this.group, ysq, this.starMat, 'bell-yoke-stars', false );

	}

	// ---------------------------------------------------------------- the tower

	// A heavy maroon lattice tower, 6 x 3.2 m on four wide-flange legs, girts and K-bracing every 3 m, from
	// the Alley up behind the yoke; a caged ladder up its side, two catwalks with rails (one under the
	// bell with the power cabinets on it, one at the crown), the sign's brackets on its front
	_tower() {

		const y0 = this.y0, q = new Quads(), gq = new Quads();
		const X = 2.9, Z0 = - 0.3, Z1 = 2.9, top = y0 + 13.3;
		const legs = [ [ - X, Z0 ], [ X, Z0 ], [ - X, Z1 ], [ X, Z1 ] ];
		for ( const [ x, z ] of legs ) {

			// a wide-flange column: web and flanges
			beam( q, [ x, STREET, z ], [ x, top, z ], 0.36 );
			beam( q, [ x, STREET, z ], [ x, STREET + 0.4, z ], 0.7 );

		}

		const step = 3.0;
		const faces = [ [ legs[ 0 ], legs[ 1 ] ], [ legs[ 2 ], legs[ 3 ] ], [ legs[ 0 ], legs[ 2 ] ], [ legs[ 1 ], legs[ 3 ] ] ];
		for ( let y = STREET + step; y <= top + 0.01; y += step ) {

			for ( const [ a, b ] of faces ) {

				beam( q, [ a[ 0 ], y, a[ 1 ] ], [ b[ 0 ], y, b[ 1 ] ], 0.22 );
				// K-bracing: from the panel's lower corners up to the middle of the girt above
				const mx = ( a[ 0 ] + b[ 0 ] ) / 2, mz = ( a[ 1 ] + b[ 1 ] ) / 2;
				beam( q, [ a[ 0 ], y - step, a[ 1 ] ], [ mx, y, mz ], 0.14 );
				beam( q, [ b[ 0 ], y - step, b[ 1 ] ], [ mx, y, mz ], 0.14 );

			}

		}

		// the caged ladder up the left side (as you look from home: local +x), to the upper catwalk
		const lx = X + 0.55, lz = ( Z0 + Z1 ) / 2, ly1 = y0 + 8.6;
		for ( const o of [ - 0.23, 0.23 ] ) beam( q, [ lx, STREET, lz + o ], [ lx, ly1 + 1.1, lz + o ], 0.06 );
		for ( let y = STREET + 0.3; y < ly1; y += 0.3 ) beam( q, [ lx, y, lz - 0.23 ], [ lx, y, lz + 0.23 ], 0.03 );
		for ( let y = STREET + 2.4; y < ly1 + 1; y += 1.2 ) {

			const r = [ [ lx, lz - 0.36 ], [ lx + 0.72, lz - 0.36 ], [ lx + 0.72, lz + 0.36 ], [ lx, lz + 0.36 ] ];
			for ( let i = 0; i < 3; i ++ ) beam( q, [ r[ i ][ 0 ], y, r[ i ][ 1 ] ], [ r[ i + 1 ][ 0 ], y, r[ i + 1 ][ 1 ] ], 0.05 );

		}

		for ( const [ ox, oz ] of [ [ 0.72, - 0.2 ], [ 0.72, 0.2 ], [ 0.4, - 0.36 ], [ 0.4, 0.36 ] ] ) beam( q, [ lx + ox, STREET + 2.4, lz + oz ], [ lx + ox, ly1 + 1, lz + oz ], 0.035 );
		// the catwalks: grating on outriggers round the sides and back, a rail with a mid rail and toe board
		const catwalk = ( y, w ) => {

			const x0 = - X - w, x1 = X + w, z0 = Z0 + 0.1, z1 = Z1 + w;
			box( gq, [ 0, y - 0.04, ( Z1 + z1 ) / 2 ], [ x1 - x0, 0.08, z1 - Z1 ] );
			for ( const s of [ - 1, 1 ] ) box( gq, [ s * ( X + w / 2 ), y - 0.04, ( z0 + Z1 ) / 2 ], [ w, 0.08, Z1 - z0 ] );
			const path = [ [ x0, z0 ], [ x0, z1 ], [ x1, z1 ], [ x1, z0 ] ];
			for ( let i = 0; i < 3; i ++ ) {

				const [ ax, az ] = path[ i ], [ bx, bz ] = path[ i + 1 ];
				for ( const h of [ 1.07, 0.55 ] ) beam( q, [ ax, y + h, az ], [ bx, y + h, bz ], 0.05 );
				box( gq, [ ( ax + bx ) / 2, y + 0.06, ( az + bz ) / 2 ], [ Math.abs( bx - ax ) + 0.02, 0.12, Math.abs( bz - az ) + 0.02 ] );
				const l = Math.hypot( bx - ax, bz - az ), n = Math.ceil( l / 1.5 );
				for ( let k = 0; k <= n; k ++ ) beam( q, [ ax + ( bx - ax ) * k / n, y, az + ( bz - az ) * k / n ], [ ax + ( bx - ax ) * k / n, y + 1.07, az + ( bz - az ) * k / n ], 0.05 );

			}

			// outriggers under it
			for ( const [ x, z ] of legs ) beam( q, [ x, y - 0.1, z ], [ x + Math.sign( x ) * w, y - 0.1, z + ( z > 0 ? w : 0 ) ], 0.12 );

		};

		catwalk( y0 - 2.3, 1.1 );
		catwalk( ly1, 1.3 );
		// the power and dimmer cabinets on the upper catwalk, conduit down the back leg
		box( gq, [ - X - 0.6, ly1 + 0.8, Z1 - 0.8 ], [ 0.7, 1.6, 1.2 ] );
		box( gq, [ X + 0.65, ly1 + 0.6, Z1 + 0.5 ], [ 0.6, 1.2, 0.9 ] );
		beam( gq, [ - X + 0.25, STREET + 1, Z1 + 0.2 ], [ - X + 0.25, ly1, Z1 + 0.2 ], 0.09 );
		// the sign's brackets: outriggers from the front legs to the channel's back
		const zb = ZF + DEPTH;
		for ( const v of [ 0.6, 3.2, 6.2, 8.9, 10.2, 11.9 ] ) {

			for ( const s of [ - 1, 1 ] ) beam( q, [ s * X, y0 + v, Z0 ], [ s * ( X + 1.2 ), y0 + v, zb ], 0.16 );
			beam( q, [ - X, y0 + v, Z0 ], [ X, y0 + v, Z0 ], 0.2 );

		}

		// the frame the letters are hung on
		for ( const v of [ - 3.9, - 7.6, - 9.4 ] ) beam( q, [ - 5.6, y0 + v, Z0 - 0.4 ], [ 5.6, y0 + v, Z0 - 0.4 ], 0.14 );
		// a lightning rod and its bar on the top
		beam( q, [ - X - 0.8, top + 0.2, Z0 ], [ X + 0.8, top + 0.2, Z0 ], 0.14 );
		beam( q, [ 0, top, Z0 ], [ 0, top + 2.6, Z0 ], 0.05 );
		const m = new Mesh( q.geometry(), this.steel );
		m.name = 'bell-tower';
		m.castShadow = true;
		m.receiveShadow = true;
		this.group.add( m );
		const gm = new Mesh( gq.geometry(), this.gratingMat );
		gm.name = 'bell-catwalks';
		gm.castShadow = true;
		this.group.add( gm );
		// you walk between its legs on the Alley
		const F = this.field, g = this.group, c = Math.cos( g.rotation.y ), s = Math.sin( g.rotation.y );
		if ( F && this.colliders ) for ( const [ x, z ] of legs ) {

			const w = F.toWorld( g.position.x + x * c + z * s, g.position.z - x * s + z * c );
			this.colliders.addCylinder( w.x, w.z, 0.3, F.y0 + STREET, F.y0 + STREET + 4 );

		}

	}

	// ---------------------------------------------------------------- the bank's emblem and letters

	_letters() {

		const W = 1536, H = 972;
		const tex = canvasTexture( W, H, ( ctx, w, h ) => {

			ctx.clearRect( 0, 0, w, h );
			// the emblem: eight green arrowheads pointing in round a hole
			const cx = w / 2, cy = h * 0.17, R = h * 0.15;
			ctx.fillStyle = '#1b9a55';
			ctx.strokeStyle = '#6fd69b';
			ctx.lineWidth = 5;
			ctx.lineJoin = 'round';
			for ( let k = 0; k < 8; k ++ ) {

				const a0 = k * Math.PI / 4;
				const P = ( r, da ) => [ cx + Math.cos( a0 + da ) * r * R, cy + Math.sin( a0 + da ) * r * R ];
				ctx.beginPath();
				for ( const [ r, da ] of [ [ 0.3, 0 ], [ 0.98, 0.26 ], [ 1.0, 0.13 ], [ 0.64, 0 ], [ 1.0, - 0.13 ], [ 0.98, - 0.26 ] ] ) ctx.lineTo( ...P( r, da ) );
				ctx.closePath();
				ctx.fill();
				ctx.stroke();

			}

			// the name in the bank's humanist sans, green faces with a lighter tube round each letter
			ctx.textAlign = 'center';
			ctx.textBaseline = 'alphabetic';
			const font = ( px ) => `600 ${ px }px "Frutiger", "Myriad Pro", "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
			const line = ( t, y, px ) => {

				ctx.font = font( px );
				ctx.lineWidth = 9;
				ctx.strokeStyle = '#74dca2';
				ctx.strokeText( t, w / 2, y, w - 40 );
				ctx.fillStyle = '#16904c';
				ctx.fillText( t, w / 2, y, w - 40 );

			};

			line( 'Citizens Bank', h * 0.7, 240 );
			line( 'Park', h * 0.93, 240 );

		}, 'bellLetters' );
		const face = standard( { name: 'bell-letters', roughness: 0.45, alphaTest: 0.35, textures: { bpNeon: tex },
			surface: 'let t = textureSample( bpNeon, smpAnisoClamp, in.uv ); s.alpha = t.a; s.albedo = t.rgb * 0.7; let n = smoothstep( 0.1, 0.7, frame.night ); s.emissive = mix( t.rgb * 0.25, t.rgb * vec3f( 0.75, 1.25, 0.95 ) * 2.4, n );' } );
		const back = standard( { name: 'bell-letter-returns', color: new Color( 0.03, 0.14, 0.07 ), roughness: 0.6, alphaTest: 0.35, side: 'double', textures: { bpNeon: tex },
			surface: 'let t = textureSample( bpNeon, smpAnisoClamp, in.uv ); s.alpha = t.a; s.emissive = mat.color * 0.8 * smoothstep( 0.1, 0.7, frame.night );' } );
		for ( const m of [ face, back ] ) m.underwaterLighting = 'none';
		const LW = 12.6, LH = LW * H / W, top = this.y0 - 2.5;
		const quad = ( z ) => {

			const q = new Quads();
			q.tri( [ LW / 2, top - LH, z ], [ - LW / 2, top - LH, z ], [ - LW / 2, top, z ], [ 0, 0, - 1 ], [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] );
			q.tri( [ LW / 2, top - LH, z ], [ - LW / 2, top, z ], [ LW / 2, top, z ], [ 0, 0, - 1 ], [ 0, 1 ], [ 1, 0 ], [ 0, 0 ] );
			return q.geometry();

		};

		const f = new Mesh( quad( - 0.95 ), face );
		f.name = 'bell-letters';
		this.group.add( f );
		for ( let k = 1; k <= 3; k ++ ) this.group.add( new Mesh( quad( - 0.95 + k * 0.1 ), back ) );

	}

	// ---------------------------------------------------------------- ringing

	// the moments it rings: a Phillies home run landing, and the last out
	_findTriggers( d ) {

		this._triggers = [];
		for ( const s of d.segments ) {

			if ( s.kind === 'celebrate' ) this._triggers.push( s.t0 + 0.3 );
			if ( s.kind === 'inplay' && s.plan?.hr && s.snap?.batting === 'home' ) this._triggers.push( s.t0 + ( s.plan.bb?.time || 3 ) );

		}

	}

	update( dt, d, sound ) {

		if ( ! d ) return;
		if ( ! this._triggers ) this._findTriggers( d );
		// how long since the last trigger (the replay's time)
		let since = - 1;
		for ( const t of this._triggers ) if ( d.t >= t && d.t - t < 40 ) since = d.t - t;
		// a swing of about 9 degrees each way, 2.6 s a cycle, for half a minute, dying away
		const PERIOD = 2.6, RINGS = 30;
		let env = 0;
		if ( since >= 0 ) env = Math.min( 1, since / 2.5 ) * ( 1 - smooth( RINGS - 8, RINGS, since ) );
		const ang = 0.16 * env * Math.sin( since * Math.PI * 2 / PERIOD );
		this.bellGroup.rotation.z = ang;
		this.ring += ( ( since >= 0 ? Math.max( env, 0.5 ) : 0 ) - this.ring ) * Math.min( 1, dt * 3 );
		this.neonMat.uniforms.ring.value = this.ring;
		this.starMat.uniforms.ring.value = this.ring;
		// a toll at each end of the swing, while the replay plays forward
		if ( since >= 0 && env > 0.15 && d.playing ) {

			const k = Math.floor( ( since + PERIOD / 4 ) / ( PERIOD / 2 ) );
			if ( k !== this._lastToll ) {

				if ( this._lastToll >= 0 || since < 1 ) toll( sound, 0.5 * env, k % 2 );
				this._lastToll = k;

			}

		} else if ( since < 0 ) this._lastToll = - 1;

	}

}

const smooth = ( a, b, x ) => {

	const t = Math.max( 0, Math.min( 1, ( x - a ) / ( b - a ) ) );
	return t * t * ( 3 - 2 * t );

};

// A struck bell in Web Audio: the partials of a big cast bell (hum, prime, tierce, quint, nominal and
// above, each dying at its own rate) over a clank of the clapper, through the park's reverb. The
// Liberty Bell's note is E flat.
function toll( sound, vol, side ) {

	const ctx = sound?.ctx;
	if ( ! ctx || sound.muted || vol <= 0.01 ) return;
	const t = ctx.currentTime + 0.02;
	const f = 155.6 * ( side ? 1.0 : 0.997 );
	const out = ctx.createGain();
	out.gain.value = vol;
	// ---- S: the ring out of the park's speakers, with the bowl's echo (phillies.com, 2007-08: "its ring
	// can be heard throughout the park"); straight out if the soundscape isn't there
	out.connect( sound.buses?.pa || sound.master );
	// ---- end S
	if ( sound.reverb ) out.connect( sound.reverb );
	for ( const [ r, a, decay ] of [ [ 0.5, 0.3, 7 ], [ 1, 0.55, 5 ], [ 1.19, 0.4, 3.5 ], [ 1.5, 0.22, 2.5 ], [ 2, 0.5, 3 ], [ 2.51, 0.16, 1.6 ], [ 2.66, 0.14, 1.4 ], [ 3.01, 0.12, 1.2 ], [ 4.07, 0.06, 0.8 ], [ 5.2, 0.03, 0.5 ] ] ) {

		const o = ctx.createOscillator();
		o.frequency.value = f * r * ( 1 + ( Math.random() - 0.5 ) * 0.002 );
		const g = ctx.createGain();
		g.gain.setValueAtTime( 0, t );
		g.gain.linearRampToValueAtTime( a * 0.25, t + 0.006 );
		g.gain.exponentialRampToValueAtTime( 0.0001, t + decay );
		o.connect( g ).connect( out );
		o.start( t );
		o.stop( t + decay + 0.1 );

	}

	// the clapper's clank
	if ( sound.noise ) {

		const src = ctx.createBufferSource();
		src.buffer = sound.noise;
		const bp = ctx.createBiquadFilter();
		bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 3;
		const g = ctx.createGain();
		g.gain.setValueAtTime( 0.12, t );
		g.gain.exponentialRampToValueAtTime( 0.0001, t + 0.12 );
		src.connect( bp ).connect( g ).connect( out );
		src.start( t, Math.random() );
		src.stop( t + 0.15 );

	}

}

// a polyline offset sideways by d (mitred corners); closed or open
function offsetPath( P, d, closed ) {

	const n = P.length, out = [];
	for ( let i = 0; i < n; i ++ ) {

		const cur = P[ i ];
		const prev = closed ? P[ ( i + n - 1 ) % n ] : P[ Math.max( 0, i - 1 ) ];
		const next = closed ? P[ ( i + 1 ) % n ] : P[ Math.min( n - 1, i + 1 ) ];
		let d1 = [ cur[ 0 ] - prev[ 0 ], cur[ 1 ] - prev[ 1 ] ], d2 = [ next[ 0 ] - cur[ 0 ], next[ 1 ] - cur[ 1 ] ];
		if ( ! closed && i === 0 ) d1 = d2;
		if ( ! closed && i === n - 1 ) d2 = d1;
		const l1 = Math.hypot( d1[ 0 ], d1[ 1 ] ) || 1, l2 = Math.hypot( d2[ 0 ], d2[ 1 ] ) || 1;
		const n1 = [ - d1[ 1 ] / l1, d1[ 0 ] / l1 ], n2 = [ - d2[ 1 ] / l2, d2[ 0 ] / l2 ];
		let mx = n1[ 0 ] + n2[ 0 ], my = n1[ 1 ] + n2[ 1 ];
		const ml = Math.hypot( mx, my ) || 1;
		mx /= ml; my /= ml;
		const k = d / Math.max( 0.35, mx * n2[ 0 ] + my * n2[ 1 ] );
		out.push( [ cur[ 0 ] + mx * k, cur[ 1 ] + my * k ] );

	}

	return out;

}
