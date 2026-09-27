import { Mesh, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { Quads } from '../../Stands.js';
import { canvasTexture } from '../../geo.js';
import { LEVELS } from '../../layout.js';

// The All-Star Walk: "granite markers featuring Phillies All-Stars since the first All-Star Game in 1933
// are on display along Ashburn Alley" (Phillies.com, October 2008). No photograph of one turned up, so
// their look is invented: two-foot squares of polished charcoal granite set flush in the pavers down the
// middle of the walk, a star and ALL-STAR cut across the top, the man's name and position engraved and
// filled in pale grey, a thin inset border. The names are Phillies All-Stars from Chuck Klein (1933) to
// Brad Lidge (2008); the markers carry no years (I couldn't check them all).

const STREET = LEVELS.mainConcourse;

const STARS = [
	[ 'CHUCK KLEIN', 'OUTFIELD' ], [ 'ROBIN ROBERTS', 'PITCHER' ], [ 'RICHIE ASHBURN', 'CENTER FIELD' ], [ 'DEL ENNIS', 'OUTFIELD' ],
	[ 'JIM KONSTANTY', 'PITCHER' ], [ 'GRANNY HAMNER', 'SHORTSTOP' ], [ 'CURT SIMMONS', 'PITCHER' ], [ 'JOHNNY CALLISON', 'RIGHT FIELD' ],
	[ 'JIM BUNNING', 'PITCHER' ], [ 'DICK ALLEN', 'THIRD BASE' ], [ 'CHRIS SHORT', 'PITCHER' ], [ 'TONY TAYLOR', 'SECOND BASE' ],
	[ 'LARRY BOWA', 'SHORTSTOP' ], [ 'GREG LUZINSKI', 'LEFT FIELD' ], [ 'MIKE SCHMIDT', 'THIRD BASE' ], [ 'STEVE CARLTON', 'PITCHER' ],
	[ 'BOB BOONE', 'CATCHER' ], [ 'PETE ROSE', 'FIRST BASE' ], [ 'MANNY TRILLO', 'SECOND BASE' ], [ 'JUAN SAMUEL', 'SECOND BASE' ],
	[ 'LENNY DYKSTRA', 'CENTER FIELD' ], [ 'JOHN KRUK', 'FIRST BASE' ], [ 'DARREN DAULTON', 'CATCHER' ], [ 'CURT SCHILLING', 'PITCHER' ],
	[ 'BOBBY ABREU', 'RIGHT FIELD' ], [ 'JIMMY ROLLINS', 'SHORTSTOP' ], [ 'JIM THOME', 'FIRST BASE' ], [ 'RYAN HOWARD', 'FIRST BASE' ],
	[ 'CHASE UTLEY', 'SECOND BASE' ], [ 'COLE HAMELS', 'PITCHER' ], [ 'AARON ROWAND', 'CENTER FIELD' ], [ 'BRAD LIDGE', 'PITCHER' ],
];

function drawMarkers( ctx, w, h ) {

	const C = 256;
	STARS.forEach( ( [ name, pos ], i ) => {

		const x = ( i % 8 ) * C, y = Math.floor( i / 8 ) * C;
		ctx.save();
		ctx.translate( x, y );
		// the granite: charcoal, flecked
		ctx.fillStyle = '#26272a'; ctx.fillRect( 0, 0, C, C );
		for ( let k = 0; k < 900; k ++ ) {

			const s = Math.sin( ( i * 977 + k ) * 12.9898 ) * 43758.5453, r = s - Math.floor( s );
			const s2 = Math.sin( ( i * 131 + k ) * 78.233 ) * 43758.5453, r2 = s2 - Math.floor( s2 );
			ctx.fillStyle = r > 0.7 ? 'rgba( 200, 200, 205, 0.35 )' : r > 0.35 ? 'rgba( 10, 10, 12, 0.5 )' : 'rgba( 120, 110, 105, 0.3 )';
			ctx.fillRect( r * C, r2 * C, 1.5, 1.5 );

		}

		// the inset border, the star and ALL-STAR, the name and his position
		ctx.strokeStyle = 'rgba( 205, 205, 208, 0.8 )'; ctx.lineWidth = 3; ctx.strokeRect( 14, 14, C - 28, C - 28 );
		ctx.fillStyle = 'rgba( 215, 215, 218, 0.9 )';
		ctx.beginPath();
		for ( let k = 0; k < 10; k ++ ) {

			const a = - Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 11 : 26;
			ctx.lineTo( C / 2 + Math.cos( a ) * rr, 62 + Math.sin( a ) * rr );

		}

		ctx.closePath(); ctx.fill();
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.font = '700 22px Georgia, "Times New Roman", serif'; ctx.fillText( 'PHILLIES ALL-STAR', C / 2, 106 );
		ctx.fillRect( 40, 124, C - 80, 2 );
		ctx.font = `700 ${ name.length > 13 ? 22 : 26 }px Georgia, "Times New Roman", serif`; ctx.fillText( name, C / 2, 158, C - 40 );
		ctx.font = 'italic 18px Georgia, serif'; ctx.fillText( pos, C / 2, 192 );
		ctx.restore();

	} );

}

// markers along the walk: [ x ] positions on the line z (skipping `avoid`: [ x0, x1 ] spans)
export function allStarWalk( parent, { z, x0, x1, avoid = [] } ) {

	const size = 0.61;
	const xs = [];
	for ( let x = x0; x < x1 && xs.length < STARS.length; x += 3.7 ) if ( ! avoid.some( ( [ a, b ] ) => x > a - 0.5 && x < b + 0.5 ) ) xs.push( x );
	const tex = canvasTexture( 2048, 1024, drawMarkers, 'allStarWalk' );
	const q = new Quads();
	const y = STREET + 0.017;
	xs.forEach( ( x, i ) => {

		const u0 = ( i % 8 ) / 8, u1 = u0 + 1 / 8, v0 = Math.floor( i / 8 ) / 4, v1 = v0 + 1 / 4;
		// read from the storefronts' side, facing the field: the top of the marker toward the field
		const a = [ x - size / 2, y, z + size / 2 ], b = [ x + size / 2, y, z + size / 2 ], c = [ x + size / 2, y, z - size / 2 ], d = [ x - size / 2, y, z - size / 2 ];
		q.tri( a, b, c, [ 0, 1, 0 ], [ u1, v0 ], [ u0, v0 ], [ u0, v1 ] );
		q.tri( a, c, d, [ 0, 1, 0 ], [ u1, v0 ], [ u0, v1 ], [ u1, v1 ] );

	} );
	const mat = standard( { name: 'all-star-walk', roughness: 0.2, textures: { bpASW: tex },
		surface: /* wgsl */`
	let t = textureSample( bpASW, smpAnisoClamp, in.uv ).rgb;
	s.albedo = t * 0.9;
	// polished, the engraving duller
	s.roughness = mix( 0.12, 0.5, smoothstep( 0.3, 0.6, t.r ) );
` } );
	mat.underwaterLighting = 'none';
	const mesh = new Mesh( q.geometry(), mat );
	mesh.name = 'all-star-walk';
	mesh.receiveShadow = true;
	parent.add( mesh );
	return xs;

}
