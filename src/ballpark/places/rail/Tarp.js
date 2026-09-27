import { Mesh, BufferGeometry, Float32BufferAttribute, Color, CylinderGeometry, BoxGeometry } from '../../../engine/index.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';
import { mlbLogo } from '../../Details2008.js';
import { FOUL_TERRITORY } from '../../layout.js';
import { put } from './Props.js';

// The tarp's tube: the infield tarp rolled on its pipe, lying on the warning track along the wall past
// the visitors' photographers' well toward the left field pole, about 40 m of it bent round the wall's
// corners. A loose green canvas cover over it, tied down every 3 m, bunched and tied at the ends; along
// its field side the long blue banner, WORLD SERIES '08 ON FOX, MLB's logo at each end (heston's 2008
// World Series set, flickr 2987303394; Wikimedia's 'Players rushing field', Oct 29 2008: its MLB logo
// and 'WORL...' past the 3B photo well; Getty 83571187 and puffygreenjacket 2983578054: on the third base
// side, the cover a pale grey-green). Flattened where it sits on the track, clay splashed up it,
// darker and shining in the rain. Built into Details2008's tarpRoll (which the pull shows and hides).

const R = 0.6, H = 0.52, GAP = 0.72, LENGTH = 40;

// the path along the wall: from just past the third base side's 150 ft point round the corners
export function tubePath() {

	const F = FOUL_TERRITORY;
	const pts = [ F[ 10 ], F[ 11 ], F[ 12 ], F[ 13 ] ];
	// offset toward the field by the tube's radius and a gap (n toward second base)
	const off = pts.map( ( p, i ) => {

		const nrm = ( a, b ) => {

			const l = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
			let n = [ - ( b[ 1 ] - a[ 1 ] ) / l, ( b[ 0 ] - a[ 0 ] ) / l ];
			const mx = ( a[ 0 ] + b[ 0 ] ) / 2, mz = ( a[ 1 ] + b[ 1 ] ) / 2;
			if ( n[ 0 ] * ( 0 - mx ) + n[ 1 ] * ( - 38.9 - mz ) < 0 ) n = [ - n[ 0 ], - n[ 1 ] ];
			return n;

		};
		const n0 = i > 0 ? nrm( pts[ i - 1 ], p ) : null, n1 = i < pts.length - 1 ? nrm( p, pts[ i + 1 ] ) : null;
		let n = n0 && n1 ? [ n0[ 0 ] + n1[ 0 ], n0[ 1 ] + n1[ 1 ] ] : ( n0 || n1 );
		const l = Math.hypot( ...n );
		n = [ n[ 0 ] / l, n[ 1 ] / l ];
		const k = n0 && n1 ? GAP / Math.max( 0.5, n[ 0 ] * n1[ 0 ] + n[ 1 ] * n1[ 1 ] ) : GAP;
		return [ p[ 0 ] + n[ 0 ] * k, p[ 1 ] + n[ 1 ] * k ];

	} );
	// sample it every 0.2 m, rounding the corners, from 0.8 m past the first point for LENGTH metres
	const dense = [];
	for ( let i = 0; i < off.length - 1; i ++ ) {

		const a = off[ i ], b = off[ i + 1 ], l = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
		for ( let s = 0; s < l; s += 0.2 ) dense.push( [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * s / l, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * s / l ] );

	}

	// smooth (the canvas bends round the corner over a metre or two)
	let P = dense;
	for ( let it = 0; it < 6; it ++ ) P = P.map( ( p, i ) => i === 0 || i === P.length - 1 ? p : [ ( P[ i - 1 ][ 0 ] + 2 * p[ 0 ] + P[ i + 1 ][ 0 ] ) / 4, ( P[ i - 1 ][ 1 ] + 2 * p[ 1 ] + P[ i + 1 ][ 1 ] ) / 4 ] );
	// trim to the tube's length
	const out = [];
	let acc = 0;
	for ( let i = 0; i < P.length; i ++ ) {

		if ( i > 0 ) acc += Math.hypot( P[ i ][ 0 ] - P[ i - 1 ][ 0 ], P[ i ][ 1 ] - P[ i - 1 ][ 1 ] );
		if ( acc < 0.8 ) continue;
		if ( acc > 0.8 + LENGTH ) break;
		out.push( { p: P[ i ], s: acc - 0.8 } );

	}

	return out;

}

// the tube's surface between angles th0..th1 (0 = toward the field, up is +PI/2), radius out by dr
function tubeGeometry( P, th0, th1, dr, seg, seedK ) {

	const pos = [], nrm = [], uv = [], index = [];
	const L = P[ P.length - 1 ].s;
	for ( let i = 0; i < P.length; i ++ ) {

		const { p, s } = P[ i ];
		const q = P[ Math.min( P.length - 1, i + 1 ) ].p, o = P[ Math.max( 0, i - 1 ) ].p;
		const tx = q[ 0 ] - o[ 0 ], tz = q[ 1 ] - o[ 1 ], tl = Math.hypot( tx, tz ) || 1;
		// across: toward the field ( the path was offset toward it: the wall is behind )
		let nx = - tz / tl, nz = tx / tl;
		if ( nx * ( 0 - p[ 0 ] ) + nz * ( - 38.9 - p[ 1 ] ) < 0 ) { nx = - nx; nz = - nz; }
		// the ends bunched and tied: the radius pulls in over the last 0.7 m
		const end = Math.min( s, L - s );
		const taper = end < 0.7 ? 0.55 + 0.45 * Math.sin( Math.min( 1, end / 0.7 ) * Math.PI / 2 ) : 1;
		for ( let k = 0; k <= seg; k ++ ) {

			const th = th0 + ( th1 - th0 ) * k / seg;
			// loose canvas: slack folds along it, sag between the tie-downs (every 3 m)
			const strap = Math.abs( ( ( s % 3 ) + 3 ) % 3 - 1.5 ) / 1.5; // 1 at a strap, 0 between
			const fold = 0.025 * Math.sin( s * 2.3 + Math.sin( th * 3 + seedK ) * 2 ) + 0.02 * Math.sin( th * 7 + s * 0.7 ) - 0.03 * Math.pow( strap, 12 );
			const r = ( R + fold ) * taper + dr;
			const cx = Math.cos( th ) * r, cy = Math.sin( th ) * r * ( H / R );
			// flattened on the track: nothing below its footprint
			const y = Math.max( 0.015, H + cy );
			pos.push( p[ 0 ] + nx * cx, y, p[ 1 ] + nz * cx );
			const gx = Math.cos( th ) * ( H / R ), gy = Math.sin( th ), gl = Math.hypot( gx, gy );
			nrm.push( nx * gx / gl, gy / gl, nz * gx / gl );
			uv.push( s, ( th - th0 ) / ( th1 - th0 ) );

		}

	}

	for ( let i = 0; i < P.length - 1; i ++ ) for ( let k = 0; k < seg; k ++ ) {

		const A = i * ( seg + 1 ) + k, B = A + 1, C = A + seg + 1, D = C + 1;
		index.push( A, B, C, B, D, C );

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
	g.setIndex( index );
	// wind every triangle outward
	const I = g.index.array, V = pos, Nn = nrm;
	for ( let t = 0; t < I.length; t += 3 ) {

		const a = I[ t ], b = I[ t + 1 ], c = I[ t + 2 ];
		const e1 = [ V[ b * 3 ] - V[ a * 3 ], V[ b * 3 + 1 ] - V[ a * 3 + 1 ], V[ b * 3 + 2 ] - V[ a * 3 + 2 ] ];
		const e2 = [ V[ c * 3 ] - V[ a * 3 ], V[ c * 3 + 1 ] - V[ a * 3 + 1 ], V[ c * 3 + 2 ] - V[ a * 3 + 2 ] ];
		const f = [ e1[ 1 ] * e2[ 2 ] - e1[ 2 ] * e2[ 1 ], e1[ 2 ] * e2[ 0 ] - e1[ 0 ] * e2[ 2 ], e1[ 0 ] * e2[ 1 ] - e1[ 1 ] * e2[ 0 ] ];
		if ( f[ 0 ] * Nn[ a * 3 ] + f[ 1 ] * Nn[ a * 3 + 1 ] + f[ 2 ] * Nn[ a * 3 + 2 ] < 0 ) {

			I[ t + 1 ] = c; I[ t + 2 ] = b;

		}

	}

	g.computeBoundingSphere();
	return g;

}

// a sandbag, slumped
let _bag = null;
function sandbag() {

	if ( _bag ) return _bag;
	const g = new CylinderGeometry( 0.12, 0.13, 0.5, 8, 1 );
	g.rotateZ( Math.PI / 2 );
	const p = g.getAttribute( 'position' );
	for ( let i = 0; i < p.count; i ++ ) p.setY( i, Math.max( - 0.05, p.getY( i ) * 0.45 ) );
	g.computeVertexNormals();
	_bag = g;
	return g;

}

// the banner: WORLD SERIES '08 ON FOX, twice along its length, MLB's logo at each end
function drawBanner( ctx, w, h ) {

	const g = ctx.createLinearGradient( 0, 0, 0, h );
	g.addColorStop( 0, '#2c64b8' );
	g.addColorStop( 1, '#1c3f8e' );
	ctx.fillStyle = g;
	ctx.fillRect( 0, 0, w, h );
	ctx.fillStyle = '#e3b23c';
	ctx.fillRect( 0, 3, w, 3 );
	ctx.fillRect( 0, h - 6, w, 3 );
	const half = w / 2;
	for ( let k = 0; k < 2; k ++ ) {

		const x0 = k * half;
		mlbLogo( ctx, x0 + 40, h * 0.2, 118, h * 0.6 );
		ctx.textBaseline = 'middle';
		ctx.textAlign = 'left';
		ctx.fillStyle = '#ffffff';
		ctx.font = `700 ${ Math.round( h * 0.62 ) }px Georgia, "Times New Roman", serif`;
		const ws = 'WORLD SERIES ';
		const x1 = x0 + 220;
		ctx.fillText( ws, x1, h * 0.54 );
		let x = x1 + ctx.measureText( ws ).width;
		ctx.fillStyle = '#e3b23c';
		ctx.fillText( '’08', x, h * 0.54 );
		x += ctx.measureText( '’08 ' ).width + 20;
		ctx.fillStyle = '#ffffff';
		ctx.font = `italic 900 ${ Math.round( h * 0.66 ) }px "Helvetica Neue", Arial, sans-serif`;
		ctx.fillText( 'ON FOX', x, h * 0.55 );
		mlbLogo( ctx, x0 + half - 160, h * 0.2, 118, h * 0.6 );

	}

}

export function buildTarpTube( parent, staticParent, M ) {

	const P = tubePath();
	if ( P.length < 2 ) return null;
	// (pale grey-green: Getty 83571187, the 29th)
	const cover = standard( { name: 'tarp-tube-cover', color: new Color( 0.14, 0.18, 0.15 ), roughness: 0.75, modules: [ commonModule ],
		surface: /* wgsl */`
	let sa = in.uv.x; let a = in.uv.y;
	// grey-green canvas: the weave up close, faded along the top where the weather gets it, grimy low down,
	// clay splashed up off the track, the creases of its folds
	var c = mat.color * ( 0.88 + 0.12 * mx_noise_float2( vec2f( sa * 1.5, a * 6.0 ) ) );
	c = c * mix( 1.0, 1.25, smoothstep( 0.4, 0.55, a ) * ( 1.0 - smoothstep( 0.6, 0.75, a ) ) );
	c = mix( c, vec3f( 0.15, 0.06, 0.03 ), ( 1.0 - smoothstep( 0.0, 0.1, a ) ) * 0.55 + ( 1.0 - smoothstep( 0.9, 1.0, a ) ) * 0.4 );
	c = c * ( 1.0 - 0.25 * smoothstep( 0.6, 0.9, mx_noise_float2( vec2f( sa * 3.0, a * 25.0 ) ) ) );
	// the tie-down straps every 3 m: black webbing round it
	let st = abs( fract( sa / 3.0 ) - 0.5 ) * 3.0;
	var strap = 1.0 - smoothstep( 0.022, 0.03, abs( st - 1.5 ) );
	// and the ties round the bunched ends
	strap = max( strap, 1.0 - smoothstep( 0.03, 0.04, min( abs( sa - 0.4 ), abs( sa - ${ ( LENGTH - 0.4 ).toFixed( 2 ) } ) ) ) );
	c = mix( c, vec3f( 0.012 ), strap );
	s.albedo = c;
	s.roughness = mix( 0.75, 0.35, frame.wet );
	s.emissive = c * smoothstep( 0.2, 0.8, frame.night ) * 0.3;
` } );
	cover.underwaterLighting = 'none';
	const tube = new Mesh( tubeGeometry( P, - Math.PI / 2 - 0.3, Math.PI * 1.5 + 0.3, 0, 22, 1 ), cover );
	tube.name = 'tarp-tube';
	tube.castShadow = true;
	tube.receiveShadow = true;
	parent.add( tube );

	// the banner round its field side (0 = toward the field; from low on the face up over the shoulder)
	const tex = typeof OffscreenCanvas === 'undefined' ? null : canvasTexture( 4096, 128, drawBanner, 'tarpBanner' );
	const L = P[ P.length - 1 ].s;
	const banner = standard( { name: 'tarp-banner', roughness: 0.45, color: new Color( 0.05, 0.12, 0.35 ), textures: tex ? { tbTex: tex } : {},
		surface: ( tex ? `let bu = clamp( ( in.uv.x - 1.2 ) / ${ ( L - 2.4 ).toFixed( 2 ) }, 0.0, 1.0 ); s.albedo = textureSample( tbTex, smpAnisoClamp, vec2f( bu, 1.0 - in.uv.y ) ).rgb * 0.85;` : '' ) +
			's.roughness = mix( 0.45, 0.2, frame.wet ); s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.35;' } );
	banner.underwaterLighting = 'none';
	const BP = P.filter( ( q ) => q.s > 1.2 && q.s < L - 1.2 );
	const bm = new Mesh( tubeGeometry( BP, - 0.35, 0.75, 0.012, 8, 1 ), banner );
	bm.name = 'tarp-banner';
	bm.receiveShadow = true;
	parent.add( bm );
	// sandbags on the canvas's skirt against the wind (they stay on the track when the tarp goes out)
	for ( let k = 0; k < 6; k ++ ) {

		const q = P[ Math.floor( ( k + 0.5 ) / 6 * ( P.length - 1 ) ) ];
		const r = P[ Math.min( P.length - 1, Math.floor( ( k + 0.5 ) / 6 * ( P.length - 1 ) ) + 1 ) ];
		const yaw = Math.atan2( r.p[ 0 ] - q.p[ 0 ], r.p[ 1 ] - q.p[ 1 ] );
		// on the wall side, where the skirt lies on the track
		const nx = Math.cos( yaw ), nz = - Math.sin( yaw );
		const side = nx * ( 0 - q.p[ 0 ] ) + nz * ( - 38.9 - q.p[ 1 ] ) > 0 ? - 1 : 1;
		put( staticParent, sandbag(), M.nylon, [ q.p[ 0 ] + nx * side * ( R + 0.12 ), 0.06, q.p[ 1 ] + nz * side * ( R + 0.12 ) ], yaw + k );

	}

	return { tube, banner: bm };

}
