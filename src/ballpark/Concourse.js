import { Group, Mesh, Vector3, Color } from '../engine/index.js';
import { standard } from '../materials/Materials.js';
import { Quads } from './Stands.js';
import { canvasTexture, box } from './geo.js';
import { offsetPolyline } from './Bowl.js';
import { LEVELS } from './layout.js';
import { GATES } from './Exterior.js';

// The main concourse's concession stands: a row of them along its outer side round the infield, just
// inside the columns under the upper deck, each a counter under a lit menu board with its name over it
// (Tony Luke's, Chickie's & Pete's, Planet Hoagie, the cheesesteaks, the crab fries, the beer...). The
// kitchens glow warm behind the counters after dark. Field frame, in the Field's group.

const STREET = LEVELS.mainConcourse;
const DEPTH = 4.5, H = 4.2, UNIT = 7.5, GAP = 1.2;

// name, its colors [ sign background, letters ], and the menu board's items
const STANDS = [
	[ "TONY LUKE'S", '#b3121b', '#ffffff', [ 'CHEESESTEAK', 'ROAST PORK', 'CHICKEN CUTLET' ] ],
	[ "CHICKIE'S & PETE'S", '#0c3c7a', '#f7d117', [ 'CRAB FRIES', 'CHEESE SAUCE', 'CRAB CAKE' ] ],
	[ 'PLANET HOAGIE', '#1d6b34', '#ffffff', [ 'ITALIAN HOAGIE', 'TURKEY', 'VEGGIE' ] ],
	[ 'HATFIELD DOGS', '#c8102e', '#ffffff', [ 'HOT DOG', 'FOOT LONG', 'SAUSAGE' ] ],
	[ 'BREWERYTOWN', '#3b2314', '#f2c14e', [ 'DRAFT BEER', 'BOTTLES', 'SODA' ] ],
	[ 'PHILLY PRETZELS', '#f4f1ea', '#8a4b12', [ 'SOFT PRETZEL', 'MUSTARD', 'WATER' ] ],
	[ 'CAMPO\'S', '#0b2a5b', '#ffffff', [ 'CHEESESTEAK', 'PIZZA STEAK', 'FRIES' ] ],
	[ 'BUDWEISER', '#b5121b', '#ffffff', [ 'BUD', 'BUD LIGHT', 'SELECT' ] ],
	[ 'TASTYKAKE', '#d52b1e', '#ffffff', [ 'KRIMPETS', 'KANDY KAKES', 'PIES' ] ],
	[ 'PIZZA', '#1a1a1a', '#f5c400', [ 'CHEESE', 'PEPPERONI', 'SODA' ] ],
	[ 'SEAFOOD', '#0e5a8a', '#ffffff', [ 'SHRIMP', 'FISH', 'CLAMS' ] ],
	[ "DIPPIN' DOTS", '#7a1fa2', '#ffffff', [ 'BANANA SPLIT', 'CHOCOLATE', 'COOKIES' ] ],
];

export class Concourse {

	constructor( { field, bowl, colliders } ) {

		this.field = field;
		this.colliders = colliders;
		this.group = new Group();
		this.group.name = 'concourse';
		field.group.add( this.group );
		this._stands( bowl );

	}

	_stands( bowl ) {

		const path = bowl.path, d0 = bowl.D.t400Back - 0.9 - DEPTH, d1 = d0 + DEPTH;
		const front = offsetPolyline( path, d0, [ 0, - 40 ] ), back = offsetPolyline( path, d1, [ 0, - 40 ] );
		// the elevators' doors on the main concourse stay clear
		const clear = ( bowl.elevators || [] ).map( ( b ) => b.stops[ 0 ] );
		const signs = this._signs();
		const body = new Quads(), face = new Quads(), glow = new Quads();
		let k = 0;
		for ( let i = 0; i < front.length - 1; i ++ ) {

			const [ ax, az ] = front[ i ], [ bx, bz ] = front[ i + 1 ];
			const [ cx, cz ] = back[ i ], [ ex, ez ] = back[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			const n = Math.floor( ( len - GAP ) / ( UNIT + GAP ) );
			if ( n < 1 ) continue;
			const pad = ( len - n * ( UNIT + GAP ) + GAP ) / 2;
			const ux = ( bx - ax ) / len, uz = ( bz - az ) / len;
			// toward the field
			let nx = - uz, nz = ux;
			if ( nx * ( 0 - ax ) + nz * ( - 40 - az ) < 0 ) {

				nx = - nx; nz = - nz;

			}

			// seen from the field, left to right
			const flip = ( ux * nz - uz * nx ) > 0;
			for ( let j = 0; j < n; j ++ ) {

				const t0 = ( pad + j * ( UNIT + GAP ) ) / len, t1 = ( pad + j * ( UNIT + GAP ) + UNIT ) / len;
				const F0 = [ ax + ( bx - ax ) * t0, az + ( bz - az ) * t0 ], F1 = [ ax + ( bx - ax ) * t1, az + ( bz - az ) * t1 ];
				const B0 = [ cx + ( ex - cx ) * t0, cz + ( ez - cz ) * t0 ], B1 = [ cx + ( ex - cx ) * t1, cz + ( ez - cz ) * t1 ];
				const mid = [ ( F0[ 0 ] + F1[ 0 ] ) / 2, ( F0[ 1 ] + F1[ 1 ] ) / 2 ];
				if ( clear.some( ( c ) => Math.hypot( c.x - mid[ 0 ], c.z - mid[ 1 ] ) < 7 ) ) continue;
				// nor the way in from each gate
				if ( GATES.some( ( g ) => {

					if ( ! g.edge ) return false;
					const dx = mid[ 0 ] - g.at[ 0 ], dz = mid[ 1 ] - g.at[ 1 ];
					const across = Math.abs( dx * g.edge.ux + dz * g.edge.uz ), inward = - ( dx * g.edge.nx + dz * g.edge.nz );
					return inward > - 2 && inward < 40 && across < g.width / 2 + UNIT / 2 + 2;

				} ) ) continue;
				const st = k ++ % STANDS.length;
				const y0 = STREET, y1 = STREET + H;
				const P = ( p, y ) => [ p[ 0 ], y, p[ 1 ] ];
				// the box: sides, back and roof in the concourse's precast; the front, below the counter,
				// in steel
				body.add( P( B0, y0 ), P( B1, y0 ), P( B1, y1 ), P( B0, y1 ), [ - nx, 0, - nz ] );
				body.add( P( F0, y0 ), P( B0, y0 ), P( B0, y1 ), P( F0, y1 ), [ - ux, 0, - uz ] );
				body.add( P( F1, y0 ), P( B1, y0 ), P( B1, y1 ), P( F1, y1 ), [ ux, 0, uz ] );
				body.add( P( F0, y1 ), P( F1, y1 ), P( B1, y1 ), P( B0, y1 ), [ 0, 1, 0 ] );
				// the counter: a ledge out front
				const o = 0.35;
				const Fo0 = [ F0[ 0 ] + nx * o, F0[ 1 ] + nz * o ], Fo1 = [ F1[ 0 ] + nx * o, F1[ 1 ] + nz * o ];
				body.add( P( Fo0, y0 + 1.1 ), P( Fo1, y0 + 1.1 ), P( F1, y0 + 1.1 ), P( F0, y0 + 1.1 ), [ 0, 1, 0 ] );
				body.add( P( Fo0, y0 ), P( Fo1, y0 ), P( Fo1, y0 + 1.1 ), P( Fo0, y0 + 1.1 ), [ nx, 0, nz ] );
				// the front: the kitchen through the opening, the menu board over it, the name at the top
				const [ L, R ] = flip ? [ F0, F1 ] : [ F1, F0 ];
				const f = ( a, b, ya, yb, v0, v1, q = face ) => {

					q.tri( P( a, ya ), P( b, ya ), P( b, yb ), [ nx, 0, nz ], [ 0, v1 ], [ 1, v1 ], [ 1, v0 ] );
					q.tri( P( a, ya ), P( b, yb ), P( a, yb ), [ nx, 0, nz ], [ 0, v1 ], [ 1, v0 ], [ 0, v0 ] );

				};

				const row = ( r ) => ( st * 2 + r ) / ( STANDS.length * 2 );
				f( L, R, y0 + 3.3, y0 + H, row( 0 ), row( 1 ) ); // the name
				f( L, R, y0 + 2.45, y0 + 3.3, row( 1 ), row( 2 ) ); // the menu
				f( L, R, y0 + 1.1, y0 + 2.45, 0, 1, glow ); // the kitchen
				// can't walk through it
				const c = [ ( F0[ 0 ] + B1[ 0 ] ) / 2, ( F0[ 1 ] + B1[ 1 ] ) / 2 ], w = this.field.toWorld( c[ 0 ], c[ 1 ] );
				this.colliders.addBox( new Vector3( w.x, this.field.y0 + STREET + H / 2, w.z ), new Vector3( UNIT / 2 + 0.3, H / 2, DEPTH / 2 + 0.3 ), this.field.group.rotation.y - Math.atan2( uz, ux ), { tag: 'concession' } );

			}

		}

		const precast = standard( { name: 'concession-body', color: new Color( 0.5, 0.47, 0.42 ), roughness: 0.75 } );
		const signMat = standard( { name: 'concession-signs', roughness: 0.4, textures: { bpStand: signs },
			surface: 'let t = textureSample( bpStand, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.5; s.emissive = t * mix( 0.25, 0.55, frame.night );' } );
		const kitchen = standard( { name: 'concession-kitchen', color: new Color( 0.06, 0.055, 0.05 ), roughness: 0.6,
			surface: /* wgsl */`
	// stainless and shelves in the back, lit warm
	let v = in.uv.y;
	let shelf = step( 0.92, fract( v * 3.0 ) );
	let steel = 0.6 + 0.4 * step( 0.5, fract( in.uv.x * 6.0 ) );
	s.albedo = mix( vec3f( 0.08, 0.075, 0.07 ) * steel, vec3f( 0.4 ), shelf );
	s.emissive = vec3f( 1.0, 0.78, 0.5 ) * ( 0.12 + 0.1 * shelf ) * mix( 0.6, 1.0, frame.night );
` } );
		for ( const m of [ precast, signMat, kitchen ] ) m.underwaterLighting = 'none';
		for ( const [ q, m, name ] of [ [ body, precast, 'concession-stands' ], [ face, signMat, 'concession-signs' ], [ glow, kitchen, 'concession-kitchens' ] ] ) {

			const mesh = new Mesh( q.geometry(), m );
			mesh.name = name;
			mesh.castShadow = m === precast;
			mesh.receiveShadow = true;
			this.group.add( mesh );

		}

		this.count = k;

	}

	// the signs: two rows per stand, its name, then its menu board
	_signs() {

		const W = 1024, RH = 112;
		return canvasTexture( W, RH * 2 * STANDS.length, ( ctx ) => {

			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			STANDS.forEach( ( [ name, bg, fg, menu ], i ) => {

				const y = i * RH * 2;
				ctx.fillStyle = bg;
				ctx.fillRect( 0, y, W, RH );
				ctx.fillStyle = fg;
				ctx.font = '900 68px "Helvetica Neue", Helvetica, Arial, sans-serif';
				ctx.fillText( name, W / 2, y + RH / 2 + 3, W - 60 );
				// the menu board: black, items and prices in white and yellow
				ctx.fillStyle = '#0c0c0e';
				ctx.fillRect( 0, y + RH, W, RH );
				ctx.font = '700 26px "Helvetica Neue", Helvetica, Arial, sans-serif';
				menu.forEach( ( item, j ) => {

					const x = W * ( j + 0.5 ) / 3;
					ctx.fillStyle = '#f4f1ea';
					ctx.fillText( item, x, y + RH + 38, W / 3 - 20 );
					ctx.fillStyle = '#f5c400';
					ctx.fillText( '$' + ( 4.25 + ( ( i * 3 + j ) * 1.75 ) % 6 ).toFixed( 2 ), x, y + RH + 76 );

				} );

			} );

		}, 'concessions' );

	}

}
