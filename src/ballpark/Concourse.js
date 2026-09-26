import { Group, Mesh, Vector3, Color } from '../engine/index.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { standard } from '../materials/Materials.js';
import { Quads, tierSections } from './Stands.js';
import { canvasTexture, box, beam } from './geo.js';
import { offsetPolyline } from './Bowl.js';
import { LEVELS, fencePoint } from './layout.js';
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
		this._monitors( bowl );
		this._sectionSigns( bowl );

	}

	// TV monitors hung from the suite level's underside over the concourse round the infield, every
	// ~18 m, showing the broadcast (both faces)
	_monitors( bowl ) {

		const line = offsetPolyline( bowl.path.slice( 2, 10 ), bowl.top + 2.2, [ 0, - 40 ] );
		const tv = canvasTexture( 256, 144, ( ctx, w, h ) => {

			// the center field camera: the pitcher, the batter, the backstop, a score bug
			const g = ctx.createLinearGradient( 0, 0, 0, h );
			g.addColorStop( 0, '#1d2a44' ); g.addColorStop( 0.45, '#27466b' ); g.addColorStop( 0.46, '#2f6d2a' ); g.addColorStop( 1, '#3f8a31' );
			ctx.fillStyle = g;
			ctx.fillRect( 0, 0, w, h );
			ctx.fillStyle = '#b07a4e';
			ctx.beginPath(); ctx.ellipse( w / 2, h * 0.62, w * 0.3, h * 0.12, 0, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = '#ffffff';
			ctx.fillRect( w * 0.47, h * 0.35, 8, 26 ); ctx.fillRect( w * 0.55, h * 0.45, 7, 22 );
			ctx.fillStyle = 'rgba( 0, 0, 0, 0.7 )';
			ctx.fillRect( 8, h - 26, 120, 18 );
			ctx.fillStyle = '#ffffff';
			ctx.font = '700 12px "Helvetica Neue", Arial, sans-serif';
			ctx.fillText( 'TB   PHI   FOX', 14, h - 13 );

		}, 'concourseTV' );
		const screen = standard( { name: 'concourse-tv', roughness: 0.2, textures: { bpTV: tv },
			surface: 'let t = textureSample( bpTV, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.1; s.emissive = t * 0.9;' } );
		const housing = standard( { name: 'tv-housing', color: new Color( 0.02, 0.02, 0.022 ), roughness: 0.5 } );
		const q = new Quads(), sc = new Quads();
		const y = LEVELS.suites - 1.05, W = 1.15, H = 0.68;
		let acc = 9;
		for ( let i = 0; i < line.length - 1; i ++ ) {

			const [ ax, az ] = line[ i ], [ bx, bz ] = line[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			const ux = ( bx - ax ) / len, uz = ( bz - az ) / len, nx = - uz, nz = ux;
			for ( ; acc < len; acc += 18 ) {

				const cx = ax + ux * acc, cz = az + uz * acc;
				box( q, [ cx, y, cz ], [ 0.1, 0.1, 0.1 ] );
				// a flat box turned along the concourse, its screens on both broad faces
				const P = ( a, b, yy, o ) => [ cx + ux * a + nx * o, yy, cz + uz * a + nz * o ];
				for ( const side of [ - 1, 1 ] ) {

					const o = side * 0.06;
					const L = side > 0 ? - W / 2 : W / 2, R = - L;
					sc.tri( P( L, 0, y - H / 2, o ), P( R, 0, y - H / 2, o ), P( R, 0, y + H / 2, o ), [ nx * side, 0, nz * side ], [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] );
					sc.tri( P( L, 0, y - H / 2, o ), P( R, 0, y + H / 2, o ), P( L, 0, y + H / 2, o ), [ nx * side, 0, nz * side ], [ 0, 1 ], [ 1, 0 ], [ 0, 0 ] );

				}

				beam( q, P( - W / 2 - 0.04, 0, y - H / 2 - 0.04, - 0.05 ), P( W / 2 + 0.04, 0, y - H / 2 - 0.04, - 0.05 ), 0.1 );
				beam( q, P( - W / 2 - 0.04, 0, y + H / 2 + 0.04, - 0.05 ), P( W / 2 + 0.04, 0, y + H / 2 + 0.04, - 0.05 ), 0.1 );
				beam( q, P( 0, 0, y + H / 2, 0 ), P( 0, 0, LEVELS.suites - 0.3, 0 ), 0.05 );

			}

			acc -= len;

		}

		for ( const [ geo, m, name ] of [ [ q, housing, 'tv-housings' ], [ sc, screen, 'tv-screens' ] ] ) {

			m.underwaterLighting = 'none';
			const mesh = new Mesh( geo.geometry(), m );
			mesh.name = name;
			this.group.add( mesh );

		}

	}

	// A blue sign with the section number at the head of each aisle of the field level seats, facing the
	// concourse
	_sectionSigns( bowl ) {

		const tier = bowl.tiers[ 0 ];
		const secs = tierSections( tier );
		const d = tier.rows * tier.depth + 0.5;
		const atlas = canvasTexture( 1024, 1024, ( ctx, w, h ) => {

			for ( let i = 0; i < 64; i ++ ) {

				const x = ( i % 8 ) * 128, y = Math.floor( i / 8 ) * 128;
				ctx.fillStyle = '#0b2a5b';
				ctx.fillRect( x, y, 128, 128 );
				ctx.strokeStyle = '#ffffff';
				ctx.lineWidth = 3;
				ctx.strokeRect( x + 5, y + 20, 118, 88 );
				ctx.fillStyle = '#ffffff';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.font = '600 15px "Helvetica Neue", Arial, sans-serif';
				ctx.fillText( 'SECTION', x + 64, y + 36 );
				ctx.font = '800 46px "Helvetica Neue", Arial, sans-serif';
				ctx.fillText( String( 104 + i ), x + 64, y + 76 );

			}

		}, 'sectionSigns' );
		const signMat = standard( { name: 'section-signs', roughness: 0.5, textures: { bpSec: atlas },
			surface: 'let t = textureSample( bpSec, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.7; s.emissive = t * step( 0.5, t.r ) * smoothstep( 0.1, 0.7, frame.night ) * 0.8;' } );
		const post = new Quads(), face = new Quads();
		let n = 0;
		for ( let k = 0; k < secs.length && n < 64; k ++ ) {

			const S = secs[ k ];
			const s = S.len - S.m1 * d;
			const cx = S.a[ 0 ] + S.ux * s + S.nx * d, cz = S.a[ 1 ] + S.uz * s + S.nz * d;
			const y0 = STREET, y1 = STREET + 2.9;
			beam( post, [ cx, y0, cz ], [ cx, y1 - 0.4, cz ], 0.08 );
			// the sign faces away from the field (-n is the field side here: face +n)
			const ux = S.ux, uz = S.uz, o = 0.05;
			const P = ( a, yy ) => [ cx + ux * a + S.nx * o, yy, cz + uz * a + S.nz * o ];
			const u0 = ( n % 8 ) / 8, v0 = Math.floor( n / 8 ) / 8, du = 1 / 8;
			// seen from the concourse (looking along -n), left is +u when u x n points up
			const flip = ( ux * S.nz - uz * S.nx ) > 0;
			const [ L, R ] = flip ? [ 0.5, - 0.5 ] : [ - 0.5, 0.5 ];
			face.tri( P( L, y1 - 1.0 ), P( R, y1 - 1.0 ), P( R, y1 ), [ S.nx, 0, S.nz ], [ u0, v0 + du ], [ u0 + du, v0 + du ], [ u0 + du, v0 ] );
			face.tri( P( L, y1 - 1.0 ), P( R, y1 ), P( L, y1 ), [ S.nx, 0, S.nz ], [ u0, v0 + du ], [ u0 + du, v0 ], [ u0, v0 ] );
			// its back, toward the field
			const Q = ( a, yy ) => [ cx + ux * a + S.nx * ( o - 0.03 ), yy, cz + uz * a + S.nz * ( o - 0.03 ) ];
			post.add( Q( - 0.5, y1 - 1.0 ), Q( 0.5, y1 - 1.0 ), Q( 0.5, y1 ), Q( - 0.5, y1 ), [ - S.nx, 0, - S.nz ] );
			n ++;

		}

		const steel = standard( { name: 'sign-posts', color: new Color( 0.1, 0.1, 0.11 ), roughness: 0.5, metalness: 0.6 } );
		for ( const [ geo, m, name ] of [ [ post, steel, 'section-posts' ], [ face, signMat, 'section-signs' ] ] ) {

			m.underwaterLighting = 'none';
			const mesh = new Mesh( geo.geometry(), m );
			mesh.name = name;
			mesh.castShadow = true;
			this.group.add( mesh );

		}

	}

	_stands( bowl ) {

		const path = bowl.path, d0 = bowl.D.t400Back - 0.9 - DEPTH, d1 = d0 + DEPTH;
		// round the infield just inside the columns; in the outfield behind the left and right field seats
		// (under the Pavilion in right), clear of the scoreboard and the light tower in left
		const lf = bowl.tiers[ 1 ], rf = bowl.tiers[ 2 ];
		const lfTop = ( lf.start || 0 ) + lf.rows * lf.depth, rfTop = ( rf.start || 0 ) + rf.rows * rf.depth;
		const [ sbx, sbz ] = fencePoint( - 36, 452 ), [ ltx, ltz ] = fencePoint( - 24.5, 455 );
		const rows = [
			{ front: offsetPolyline( path, d0, [ 0, - 40 ] ), back: offsetPolyline( path, d1, [ 0, - 40 ] ), toward: [ 0, - 40 ] },
			{ front: offsetPolyline( rf.front, rfTop + 10, [ 0, 0 ] ), back: offsetPolyline( rf.front, rfTop + 10 + DEPTH, [ 0, 0 ] ), toward: [ 0, 0 ] },
			{ front: offsetPolyline( lf.front, lfTop + 9, [ 0, 0 ] ), back: offsetPolyline( lf.front, lfTop + 9 + DEPTH, [ 0, 0 ] ), toward: [ 0, 0 ], skip: ( x, z ) => Math.hypot( x - sbx, z - sbz ) < 26 || Math.hypot( x - ltx, z - ltz ) < 10 },
		];
		// the elevators' doors on the main concourse stay clear
		const clear = ( bowl.elevators || [] ).map( ( b ) => b.stops[ 0 ] );
		const signs = this._signs();
		const body = new Quads(), face = new Quads(), glow = new Quads(), bins = new Quads();
		let k = 0;
		for ( const { front, back, toward, skip } of rows ) for ( let i = 0; i < front.length - 1; i ++ ) {

			const [ ax, az ] = front[ i ], [ bx, bz ] = front[ i + 1 ];
			const [ cx, cz ] = back[ i ], [ ex, ez ] = back[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			const n = Math.floor( ( len - GAP ) / ( UNIT + GAP ) );
			if ( n < 1 ) continue;
			const pad = ( len - n * ( UNIT + GAP ) + GAP ) / 2;
			const ux = ( bx - ax ) / len, uz = ( bz - az ) / len;
			// toward the field
			let nx = - uz, nz = ux;
			if ( nx * ( toward[ 0 ] - ax ) + nz * ( toward[ 1 ] - az ) < 0 ) {

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
				if ( skip && skip( mid[ 0 ], mid[ 1 ] ) ) continue;
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
				// a trash can and a recycling bin in the gap after it
				if ( j < n - 1 ) for ( const [ o2, off ] of [ [ 0.35, - 0.3 ], [ 0.35, 0.3 ] ] ) {

					const g = t1 + ( GAP / 2 ) / len;
					const gx = ax + ( bx - ax ) * g + nx * o2 + ux * off, gz = az + ( bz - az ) * g + nz * o2 + uz * off;
					box( bins, [ gx, STREET + 0.5, gz ], [ 0.55, 1.0, 0.55 ] );

				}

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
		const binMat = standard( { name: 'concourse-bins', color: new Color( 0.05, 0.16, 0.08 ), roughness: 0.5, modules: [ commonModule ],
			surface: `
	// green for trash, blue for the recycling, black lids
	if ( fract( in.P.x * 0.9 + in.P.z * 0.9 ) > 0.5 ) { s.albedo = vec3f( 0.03, 0.08, 0.25 ); }
	if ( in.P.y - ${ STREET.toFixed( 3 ) } > 0.9 ) { s.albedo = vec3f( 0.08 ); }
` } );
		for ( const m of [ precast, signMat, kitchen, binMat ] ) m.underwaterLighting = 'none';
		for ( const [ q, m, name ] of [ [ body, precast, 'concession-stands' ], [ face, signMat, 'concession-signs' ], [ glow, kitchen, 'concession-kitchens' ], [ bins, binMat, 'concourse-bins' ] ] ) {

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
