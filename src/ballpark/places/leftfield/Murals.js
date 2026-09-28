import { Mesh, BufferGeometry, Float32BufferAttribute } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';

// Three murals on the brick of Harry the K's lower level (the Phillies' 'Not your typical ballpark' page,
// 2008: 'a renowned local artist has three murals displayed in Harry the K's'; the 2009 photos: big, bright,
// painterly, over the tables). These three are our own, painted in that spirit and kept to no one's
// likeness: the fans on a summer night with the skyline behind them, the booth (its microphone, its
// scorecard, the diamond through the window), and a kid reaching for a ball with his glove.
const W = 2048, H = 256, PW = 680;

function rng( seed ) {

	let s = seed >>> 0;
	return () => {

		s = ( s + 0x6D2B79F5 ) >>> 0;
		let t = s;
		t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
		t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;

	};

}

function paint( ctx ) {

	const r = rng( 1971 );
	ctx.fillStyle = '#2a1a12';
	ctx.fillRect( 0, 0, W, H );
	// brushwork over a panel: short strokes in a colour's neighbours
	const strokes = ( x0, y0, w, h, cols, n, len = 14 ) => {

		for ( let k = 0; k < n; k ++ ) {

			const x = x0 + r() * w, y = y0 + r() * h, a = r() * Math.PI;
			ctx.strokeStyle = cols[ Math.floor( r() * cols.length ) ];
			ctx.lineWidth = 2 + r() * 4;
			ctx.globalAlpha = 0.35 + 0.4 * r();
			ctx.beginPath();
			ctx.moveTo( x, y );
			ctx.lineTo( x + Math.cos( a ) * len * ( 0.5 + r() ), y + Math.sin( a ) * len * ( 0.5 + r() ) );
			ctx.stroke();

		}

		ctx.globalAlpha = 1;

	};

	// ---- 1: the fans on a summer night, the skyline behind
	{

		const x0 = 4;
		const g = ctx.createLinearGradient( 0, 0, 0, H );
		g.addColorStop( 0, '#1d2a6b' ); g.addColorStop( 0.45, '#c2552a' ); g.addColorStop( 0.62, '#f2b04a' );
		ctx.fillStyle = g; ctx.fillRect( x0, 0, PW, H );
		strokes( x0, 0, PW, H * 0.6, [ '#2b3c86', '#d0703a', '#f0c060', '#8a3a50' ], 600, 20 );
		// the skyline
		ctx.fillStyle = '#231a3a';
		let bx = x0 + 20;
		while ( bx < x0 + PW - 20 ) {

			const bw = 16 + r() * 30, bh = 30 + r() * 70;
			ctx.fillRect( bx, H * 0.62 - bh, bw, bh );
			if ( r() < 0.25 ) {

				ctx.beginPath(); ctx.moveTo( bx, H * 0.62 - bh ); ctx.lineTo( bx + bw / 2, H * 0.62 - bh - 22 ); ctx.lineTo( bx + bw, H * 0.62 - bh ); ctx.fill();

			}

			bx += bw + 2 + r() * 8;

		}

		// the crowd: rows of heads and shoulders in red, arms up here and there
		for ( let row = 0; row < 6; row ++ ) {

			const y = H * 0.6 + row * 18, sc = 0.7 + row * 0.12;
			for ( let x = x0 + ( row % 2 ) * 12; x < x0 + PW; x += 22 * sc ) {

				const c = [ '#b3121b', '#d62a2a', '#8a0f18', '#f4f0e6', '#1a2a5a' ][ Math.floor( r() * 5 ) ];
				ctx.fillStyle = c;
				ctx.beginPath(); ctx.ellipse( x, y + 16 * sc, 11 * sc, 10 * sc, 0, Math.PI, 0 ); ctx.fill();
				ctx.fillStyle = [ '#f0c8a0', '#c8905a', '#8a5a3a', '#5a3a28' ][ Math.floor( r() * 4 ) ];
				ctx.beginPath(); ctx.arc( x, y + 2 * sc, 6 * sc, 0, Math.PI * 2 ); ctx.fill();
				if ( r() < 0.12 ) {

					ctx.strokeStyle = c; ctx.lineWidth = 4 * sc;
					ctx.beginPath(); ctx.moveTo( x - 6 * sc, y + 8 * sc ); ctx.lineTo( x - 12 * sc, y - 14 * sc ); ctx.stroke();
					ctx.beginPath(); ctx.moveTo( x + 6 * sc, y + 8 * sc ); ctx.lineTo( x + 12 * sc, y - 14 * sc ); ctx.stroke();

				}

			}

		}

		strokes( x0, H * 0.58, PW, H * 0.42, [ '#b3121b', '#f4f0e6', '#7a0e14' ], 500, 10 );

	}

	// ---- 2: the booth: the big microphone, the scorecard, the diamond through the window
	{

		const x0 = 4 + PW + 10;
		ctx.fillStyle = '#e7b24a'; ctx.fillRect( x0, 0, PW, H );
		strokes( x0, 0, PW, H, [ '#f0c060', '#d08a30', '#f6d890' ], 700, 18 );
		// the window, the field through it
		ctx.fillStyle = '#20356e'; ctx.fillRect( x0 + 300, 30, 340, 150 );
		ctx.fillStyle = '#2f7a3b'; ctx.fillRect( x0 + 300, 110, 340, 70 );
		ctx.fillStyle = '#b8864f';
		ctx.beginPath(); ctx.moveTo( x0 + 470, 175 ); ctx.lineTo( x0 + 540, 135 ); ctx.lineTo( x0 + 470, 112 ); ctx.lineTo( x0 + 400, 135 ); ctx.fill();
		strokes( x0 + 300, 30, 340, 80, [ '#2b3c86', '#3a4c9a', '#f6e0a0' ], 200, 12 );
		ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 10; ctx.strokeRect( x0 + 300, 30, 340, 150 );
		// the microphone, big
		ctx.fillStyle = '#c9c9c9';
		ctx.beginPath(); ctx.ellipse( x0 + 160, 110, 58, 84, 0, 0, Math.PI * 2 ); ctx.fill();
		ctx.strokeStyle = '#6a6a6a'; ctx.lineWidth = 3;
		for ( let k = - 60; k < 60; k += 9 ) {

			ctx.beginPath(); ctx.moveTo( x0 + 110, 110 + k ); ctx.lineTo( x0 + 210, 110 + k ); ctx.stroke();

		}

		ctx.fillStyle = '#3a3a3a'; ctx.fillRect( x0 + 152, 190, 16, 50 ); ctx.fillRect( x0 + 110, 236, 100, 14 );
		ctx.fillStyle = '#b3121b'; ctx.fillRect( x0 + 120, 150, 80, 22 );
		ctx.fillStyle = '#ffffff'; ctx.font = '800 16px "Helvetica Neue", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.fillText( 'ON AIR', x0 + 160, 162 );
		// the scorecard on the desk
		ctx.save(); ctx.translate( x0 + 250, 215 ); ctx.rotate( - 0.12 );
		ctx.fillStyle = '#f4efe0'; ctx.fillRect( - 40, - 30, 140, 60 );
		ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 1;
		for ( let k = 0; k < 6; k ++ ) {

			ctx.beginPath(); ctx.moveTo( - 40, - 30 + k * 12 ); ctx.lineTo( 100, - 30 + k * 12 ); ctx.stroke();

		}

		ctx.restore();

	}

	// ---- 3: a kid reaching up with his glove for a ball, the upper deck behind
	{

		const x0 = 4 + 2 * ( PW + 10 );
		const g = ctx.createLinearGradient( 0, 0, 0, H );
		g.addColorStop( 0, '#4a9ad0' ); g.addColorStop( 1, '#c8e0f0' );
		ctx.fillStyle = g; ctx.fillRect( x0, 0, PW, H );
		strokes( x0, 0, PW, H * 0.5, [ '#5aa8dc', '#8ac0e4', '#ffffff' ], 500, 22 );
		// the upper deck: blue seats in rows
		for ( let row = 0; row < 7; row ++ ) {

			ctx.fillStyle = row % 2 ? '#1d3a8a' : '#23449a';
			ctx.fillRect( x0, 120 + row * 12, PW, 10 );

		}

		strokes( x0, 120, PW, 90, [ '#b3121b', '#f4f0e6', '#1d3a8a' ], 400, 6 );
		// the kid: red cap and jersey, arm up, the glove, the ball above it
		const kx = x0 + 420;
		ctx.fillStyle = '#b3121b';
		ctx.beginPath(); ctx.ellipse( kx, 230, 60, 70, 0, Math.PI, 0 ); ctx.fill();
		ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc( kx, 150, 32, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#b3121b'; ctx.beginPath(); ctx.arc( kx, 138, 34, Math.PI, 0 ); ctx.fill(); ctx.fillRect( kx - 10, 132, 60, 8 );
		ctx.strokeStyle = '#b3121b'; ctx.lineWidth = 22;
		ctx.beginPath(); ctx.moveTo( kx + 40, 200 ); ctx.lineTo( kx + 90, 90 ); ctx.stroke();
		ctx.fillStyle = '#7a4a1a'; ctx.beginPath(); ctx.ellipse( kx + 96, 74, 30, 36, 0.3, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#f7f3ea'; ctx.beginPath(); ctx.arc( kx + 110, 30, 14, 0, Math.PI * 2 ); ctx.fill();
		ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 2;
		ctx.beginPath(); ctx.arc( kx + 104, 30, 10, - 1, 1 ); ctx.stroke();
		strokes( kx - 70, 90, 220, 160, [ '#b3121b', '#8a0f18', '#e05050' ], 250, 10 );

	}

	// the brushwork's grain over the three, and a varnish's sheen
	for ( let k = 0; k < 4000; k ++ ) {

		ctx.fillStyle = r() < 0.5 ? 'rgba( 0, 0, 0, 0.06 )' : 'rgba( 255, 255, 255, 0.05 )';
		ctx.fillRect( r() * W, r() * H, 2, 2 );

	}

}

// the three murals on the house's brick over the lower bar's front: centre ( x ), bottom y0, each w x h
export function buildMurals( place, F, { x0, x1, y0, h, z } ) {

	const tex = canvasTexture( W, H, paint, 'harrysMurals' );
	const mat = standard( { name: 'harrys-murals', roughness: 0.6, side: 'double', textures: { hkMural: tex },
		surface: 'let t = textureSample( hkMural, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.85; s.emissive = t * mix( 0.04, 0.22, frame.night );' } );
	mat.underwaterLighting = 'none';
	mat.setDefine( 'DRY', 1 );
	const pos = [], nrm = [], uv = [];
	const [ nx, nz ] = F.dir( 0, - 1 );
	const w = ( x1 - x0 - 1.0 ) / 3;
	for ( let k = 0; k < 3; k ++ ) {

		// facing home, the frame's +x is on the viewer's left: the panel's left edge at the higher x
		const xl = x1 - k * ( w + 0.5 ), xr = xl - w;
		const u0 = ( 4 + k * ( PW + 10 ) ) / W, u1 = ( 4 + k * ( PW + 10 ) + PW ) / W;
		const P = ( x, y ) => {

			const [ fx, fz ] = F.field( x, z );
			return [ fx, y, fz ];

		};
		const quad = [ [ P( xl, y0 ), [ u0, 1 ] ], [ P( xr, y0 ), [ u1, 1 ] ], [ P( xr, y0 + h ), [ u1, 0 ] ], [ P( xl, y0 + h ), [ u0, 0 ] ] ];
		for ( const i of [ 0, 1, 2, 0, 2, 3 ] ) {

			pos.push( ...quad[ i ][ 0 ] );
			nrm.push( nx, 0, nz );
			uv.push( ...quad[ i ][ 1 ] );

		}

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
	g.computeBoundingBox();
	g.computeBoundingSphere();
	const m = new Mesh( g, mat );
	m.name = 'harrys-murals';
	m.receiveShadow = true;
	place.group.add( m );
	return m;

}
