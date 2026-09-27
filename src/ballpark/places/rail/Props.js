import { Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, BufferGeometry, Float32BufferAttribute, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';

// The rail's small static things (the stools, cases and bags in the wells, the camera pedestals, the
// cables, the laptops, the on-deck gear, the crew's tools), in a handful of materials so the park's
// static batching merges them into a few draws. Placed in the field frame.

export const rnd = ( s ) => {

	const x = Math.sin( s * 12.9898 + 78.233 ) * 43758.5453;
	return x - Math.floor( x );

};

export function railMaterials() {

	// a lift under the lights (the banks all round light the pit), as the field's own surfaces have
	const lift = 's.emissive = s.emissive + s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.3;';
	const mk = ( name, color, roughness, metalness = 0, extra = '' ) => {

		const m = standard( { name, color: new Color( ...color ), roughness, metalness, surface: extra + lift } );
		m.underwaterLighting = 'none';
		return m;

	};

	// a laptop's screen: Photo Mechanic's contact sheet, a grid of thumbnails on dark grey (the shots
	// going out to the desks between innings)
	const sheet = typeof OffscreenCanvas === 'undefined' ? null : canvasTexture( 128, 80, ( ctx, w, h ) => {

		ctx.fillStyle = '#2a2c30';
		ctx.fillRect( 0, 0, w, h );
		ctx.fillStyle = '#43464c';
		ctx.fillRect( 0, 0, w, 7 );
		const tones = [ '#5a3a2c', '#3c5a2a', '#6a2a2a', '#2c3c5a', '#7a6a4a', '#4a5a3a', '#8a3030', '#3a3a3a' ];
		for ( let r = 0; r < 4; r ++ ) for ( let c = 0; c < 6; c ++ ) {

			ctx.fillStyle = '#1c1d20';
			ctx.fillRect( 4 + c * 20.5, 10 + r * 17, 18, 15 );
			ctx.fillStyle = tones[ ( r * 7 + c * 3 ) % tones.length ];
			ctx.fillRect( 5 + c * 20.5, 11 + r * 17, 16, 10 );
			ctx.fillStyle = '#c8c8c8';
			ctx.fillRect( 6 + c * 20.5, 22.5 + r * 17, 10, 1 );

		}

	}, 'railLaptop' );
	const screen = sheet ? standard( { name: 'rail-laptop-screen', roughness: 0.2, textures: { rlSheet: sheet },
		surface: 'let t = textureSample( rlSheet, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.1; s.emissive = t * 1.6;' } )
		: standard( { name: 'rail-laptop-screen', roughness: 0.2, color: new Color( 0.02, 0.02, 0.02 ), emissive: new Color( 0.2, 0.2, 0.22 ) } );
	screen.underwaterLighting = 'none';
	screen.setDefine( 'DRY', 1 );

	return {
		black: mk( 'rail-black', [ 0.014, 0.014, 0.016 ], 0.45 ),
		case: mk( 'rail-case', [ 0.02, 0.02, 0.022 ], 0.55 ),
		metal: mk( 'rail-metal', [ 0.3, 0.3, 0.31 ], 0.35, 0.7 ),
		steelDark: mk( 'rail-steel', [ 0.06, 0.06, 0.065 ], 0.4, 0.6 ),
		nylon: mk( 'rail-nylon', [ 0.05, 0.052, 0.058 ], 0.85 ),
		cable: mk( 'rail-cable', [ 0.01, 0.01, 0.01 ], 0.5 ),
		orange: mk( 'rail-orange', [ 0.7, 0.2, 0.02 ], 0.5 ),
		yellow: mk( 'rail-yellow', [ 0.75, 0.55, 0.02 ], 0.5 ),
		white: mk( 'rail-white', [ 0.74, 0.73, 0.7 ], 0.55 ),
		paper: mk( 'rail-paper', [ 0.8, 0.79, 0.75 ], 0.8 ),
		wood: mk( 'rail-wood', [ 0.45, 0.3, 0.16 ], 0.45 ),
		pineTar: mk( 'rail-pine-tar', [ 0.09, 0.045, 0.015 ], 0.3 ),
		leather: mk( 'rail-leather', [ 0.2, 0.09, 0.035 ], 0.55 ),
		red: mk( 'rail-red', [ 0.42, 0.018, 0.028 ], 0.5 ),
		navy: mk( 'rail-navy', [ 0.012, 0.02, 0.06 ], 0.5 ),
		green: mk( 'rail-green', [ 0.02, 0.1, 0.05 ], 0.6 ),
		blueTarp: mk( 'rail-blue-tarp', [ 0.02, 0.07, 0.25 ], 0.35 ),
		clear: mk( 'rail-clear-bag', [ 0.3, 0.31, 0.32 ], 0.15 ),
		screen,
	};

}

// place a geometry (a static mesh, merged later by material) at [ x, y, z ], turned yaw (about y) then
// tilted ( rx about x, rz about z )
export function put( group, geo, mat, p, yaw = 0, { rx = 0, rz = 0, shadow = false, name = '' } = {} ) {

	const m = new Mesh( geo, mat );
	m.position.set( p[ 0 ], p[ 1 ], p[ 2 ] );
	m.rotation.set( rx, yaw, rz, 'YXZ' );
	m.castShadow = shadow;
	m.receiveShadow = true;
	if ( name ) m.name = name;
	group.add( m );
	return m;

}

// a cable lying on the floor through the points ( [ x, y, z ] ): a string of thin boxes
export function cable( group, mat, pts, r = 0.012 ) {

	for ( let i = 0; i < pts.length - 1; i ++ ) {

		const a = pts[ i ], b = pts[ i + 1 ];
		const dx = b[ 0 ] - a[ 0 ], dy = b[ 1 ] - a[ 1 ], dz = b[ 2 ] - a[ 2 ];
		const l = Math.hypot( dx, dy, dz );
		if ( l < 1e-3 ) continue;
		const g = new BoxGeometry( r * 2, r * 1.6, l + r );
		const m = put( group, g, mat, [ ( a[ 0 ] + b[ 0 ] ) / 2, ( a[ 1 ] + b[ 1 ] ) / 2 + r * 0.8, ( a[ 2 ] + b[ 2 ] ) / 2 ], Math.atan2( dx, dz ) );
		m.rotation.x = - Math.atan2( dy, Math.hypot( dx, dz ) );

	}

}

// a photographer's tall stool: a round seat on three splayed legs, a foot ring
export function stool( group, M, p, h = 0.55, seed = 0 ) {

	put( group, new CylinderGeometry( 0.16, 0.16, 0.04, 14 ), M.black, [ p[ 0 ], p[ 1 ] + h - 0.02, p[ 2 ] ], seed * 3 );
	for ( let k = 0; k < 3; k ++ ) {

		const a = seed * 5 + k * Math.PI * 2 / 3;
		const leg = new CylinderGeometry( 0.012, 0.012, h / Math.cos( 0.18 ), 6 );
		put( group, leg, M.metal, [ p[ 0 ] + Math.cos( a ) * 0.13, p[ 1 ] + h / 2 - 0.02, p[ 2 ] + Math.sin( a ) * 0.13 ], 0, { rx: Math.sin( a ) * 0.18, rz: - Math.cos( a ) * 0.18 } );

	}

	put( group, new CylinderGeometry( 0.17, 0.17, 0.015, 14, 1, true ), M.metal, [ p[ 0 ], p[ 1 ] + h * 0.35, p[ 2 ] ] );

}

// a hard case (a Pelican): black, its latches and handle
export function hardCase( group, M, p, yaw, [ l, h, w ] = [ 0.55, 0.22, 0.36 ] ) {

	put( group, new BoxGeometry( l, h, w ), M.case, [ p[ 0 ], p[ 1 ] + h / 2, p[ 2 ] ], yaw, { shadow: true } );
	put( group, new BoxGeometry( l * 0.3, 0.025, 0.03 ), M.black, [ p[ 0 ], p[ 1 ] + h + 0.012, p[ 2 ] ], yaw );

}

// a rolling camera bag: nylon, the handle up
export function rollerBag( group, M, p, yaw ) {

	put( group, new BoxGeometry( 0.36, 0.56, 0.24 ), M.nylon, [ p[ 0 ], p[ 1 ] + 0.28, p[ 2 ] ], yaw, { shadow: true } );
	const c = Math.cos( yaw ), s = Math.sin( yaw );
	for ( const k of [ - 0.12, 0.12 ] ) put( group, new BoxGeometry( 0.015, 0.4, 0.015 ), M.metal, [ p[ 0 ] + c * k + s * 0.1, p[ 1 ] + 0.76, p[ 2 ] - s * k + c * 0.1 ], yaw );

}

// a laptop open on something (p: the middle of its base), its user on its +z side (turned by yaw)
export function laptop( group, M, p, yaw ) {

	const c = Math.cos( yaw ), s = Math.sin( yaw );
	const at = ( lx, ly, lz ) => [ p[ 0 ] + lx * c + lz * s, p[ 1 ] + ly, p[ 2 ] - lx * s + lz * c ];
	put( group, new BoxGeometry( 0.34, 0.02, 0.24 ), M.black, at( 0, 0.01, 0 ), yaw );
	// the lid, leaning back from the hinge at the far edge
	const tilt = 0.25, lz = - 0.12 - Math.sin( tilt ) * 0.115, ly = 0.02 + Math.cos( tilt ) * 0.115;
	put( group, new BoxGeometry( 0.34, 0.23, 0.012 ), M.black, at( 0, ly, lz ), yaw, { rx: - tilt } );
	// the screen, a hair in front of the lid
	const sg = new BufferGeometry();
	const W = 0.3, H = 0.19;
	sg.setAttribute( 'position', new Float32BufferAttribute( [ - W / 2, - H / 2, 0, W / 2, - H / 2, 0, W / 2, H / 2, 0, - W / 2, H / 2, 0 ], 3 ) );
	sg.setAttribute( 'normal', new Float32BufferAttribute( [ 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1 ], 3 ) );
	sg.setAttribute( 'uv', new Float32BufferAttribute( [ 0, 1, 1, 1, 1, 0, 0, 0 ], 2 ) );
	sg.setIndex( [ 0, 1, 2, 0, 2, 3 ] );
	put( group, sg, M.screen, at( 0, ly + Math.sin( tilt ) * 0.007, lz + Math.cos( tilt ) * 0.007 ), yaw, { rx: - tilt } );

}

// a TV camera's pedestal: the column, its base with three feet on casters, a cable off the back
export function pedestal( group, M, p, top = 1.3 ) {

	put( group, new CylinderGeometry( 0.07, 0.09, top - 0.12, 10 ), M.steelDark, [ p[ 0 ], p[ 1 ] + ( top + 0.12 ) / 2, p[ 2 ] ], 0, { shadow: true } );
	put( group, new CylinderGeometry( 0.14, 0.16, 0.1, 10 ), M.steelDark, [ p[ 0 ], p[ 1 ] + 0.17, p[ 2 ] ] );
	for ( let k = 0; k < 3; k ++ ) {

		const a = k * Math.PI * 2 / 3 + 0.3;
		put( group, new BoxGeometry( 0.44, 0.05, 0.07 ), M.steelDark, [ p[ 0 ] + Math.cos( a ) * 0.22, p[ 1 ] + 0.1, p[ 2 ] + Math.sin( a ) * 0.22 ], - a );
		put( group, new SphereGeometry( 0.04, 8, 5 ), M.black, [ p[ 0 ] + Math.cos( a ) * 0.42, p[ 1 ] + 0.04, p[ 2 ] + Math.sin( a ) * 0.42 ] );

	}

}
