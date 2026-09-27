import { Mesh, Color, Vector3 } from '../../../engine/index.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';
import { LEVELS } from '../../layout.js';
import { Mesher } from './Mesher.js';
import { LIFT, pattisonZ } from './Street.js';
import { lookAt } from '../Cast.js';

// FOX 29 live from the Third Base Gate. FOX had the World Series, and WTXF, its Philadelphia station,
// hosted its morning show at the Third Base Gate that week (the Inquirer, 30 Oct 2008); on the game
// nights its reporters went live from the plaza for the news (invention, the likeliest thing there
// was): a white pop-up tent (white tents stood on the plaza on 25 and 27 Oct: Getty, Flickr roadieshow)
// with the station's valance, a table of gear under it; two light stands with soft boxes blazing at a
// reporter in a dark coat, the FOX 29 flag on her microphone, the gate and the crowd behind her; the
// camera on its sticks in a rain cover, the photographer on it with his headphones on; the cables run
// over the paving to the live truck at the curb on Pattison, its mast up with the microwave dish on
// top. Every minute or so she's on: talking to the lens with her free hand, and the fans behind her
// wave their towels and jump into the shot.

const STREET = LEVELS.mainConcourse;

export function buildTV( { group, colliders, field, cast } ) {

	const y = ( h ) => STREET + LIFT + h;
	// the live shot's line: the camera looks at the reporter with the gate behind her
	const cam = [ - 103.2, 64.4 ], rep = [ - 99.4, 59.2 ];
	const d = [ rep[ 0 ] - cam[ 0 ], rep[ 1 ] - cam[ 1 ] ], dl = Math.hypot( ...d );
	const f = [ d[ 0 ] / dl, d[ 1 ] / dl ], s = [ - f[ 1 ], f[ 0 ] ];
	const at = ( a, b ) => [ cam[ 0 ] + f[ 0 ] * a + s[ 0 ] * b, cam[ 1 ] + f[ 1 ] * a + s[ 1 ] * b ];
	const steel = new Mesher(), black = new Mesher(), white = new Mesher(), valance = new Mesher(), glow = new Mesher(), truck = new Mesher(), livery = new Mesher(), glass = new Mesher();
	const collide = ( x, z, r, h = 2.5 ) => {

		const w = field.toWorld( x, z );
		colliders.addCylinder( w.x, w.z, r, field.y0 + STREET, field.y0 + STREET + h );

	};

	// ---- the tent: 3 x 3 m, white, the valance printed FOX 29 NEWS, its legs weighted with sandbags
	const tc = at( 1.2, - 3.6 ), T = 1.5;
	const tp = ( a, b, h ) => [ tc[ 0 ] + f[ 0 ] * a + s[ 0 ] * b, y( h ), tc[ 1 ] + f[ 1 ] * a + s[ 1 ] * b ];
	for ( const [ a, b ] of [ [ - T, - T ], [ T, - T ], [ T, T ], [ - T, T ] ] ) {

		steel.tube( [ tp( a, b, 0 ), tp( a, b, 2.3 ) ], [ 0.025, 0.025 ], 5 );
		black.box( tp( a * 0.95, b * 0.95, 0.07 ), [ 0.3, 0.14, 0.3 ] );
		collide( tp( a, b, 0 )[ 0 ], tp( a, b, 0 )[ 2 ], 0.12 );

	}

	// the roof: a shallow pyramid; the valance round its edge
	const apex = tp( 0, 0, 3.0 );
	const corners = [ [ - T, - T ], [ T, - T ], [ T, T ], [ - T, T ] ];
	for ( let i = 0; i < 4; i ++ ) {

		const [ a0, b0 ] = corners[ i ], [ a1, b1 ] = corners[ ( i + 1 ) % 4 ];
		const A = tp( a0, b0, 2.35 ), B = tp( a1, b1, 2.35 );
		const ia = white.v( A, [ 0, 1, 0 ] ), ib = white.v( B, [ 0, 1, 0 ] ), ic = white.v( apex, [ 0, 1, 0 ] );
		white.tri( ia, ib, ic );
		// the valance: 0.3 m, the station's name on each side (reads from outside)
		const n = [ ( A[ 0 ] + B[ 0 ] ) / 2 - tc[ 0 ], 0, ( A[ 2 ] + B[ 2 ] ) / 2 - tc[ 1 ] ];
		valance.face( [ B[ 0 ], y( 2.05 ), B[ 2 ] ], [ A[ 0 ], y( 2.05 ), A[ 2 ] ], [ A[ 0 ], y( 2.35 ), A[ 2 ] ], [ B[ 0 ], y( 2.35 ), B[ 2 ] ], n, [ [ 0, 1 ], [ 1, 1 ], [ 1, 0 ], [ 0, 0 ] ] );

	}

	// the table under it: a laptop's glow, a monitor in a rain hood, a road case
	const tt = tp( - 0.2, 0.3, 0 );
	black.box( [ tt[ 0 ], y( 0.72 ), tt[ 2 ] ], [ 1.2, 0.04, 0.6 ] );
	for ( const [ a, b ] of [ [ - 0.55, - 0.25 ], [ 0.55, - 0.25 ], [ - 0.55, 0.25 ], [ 0.55, 0.25 ] ] ) steel.tube( [ [ tt[ 0 ] + f[ 0 ] * a + s[ 0 ] * b, y( 0 ), tt[ 2 ] + f[ 1 ] * a + s[ 1 ] * b ], [ tt[ 0 ] + f[ 0 ] * a + s[ 0 ] * b, y( 0.72 ), tt[ 2 ] + f[ 1 ] * a + s[ 1 ] * b ] ], [ 0.015, 0.015 ], 4 );
	black.box( [ tt[ 0 ], y( 0.95 ), tt[ 2 ] ], [ 0.45, 0.35, 0.3 ] );
	glow.face( [ tt[ 0 ] - s[ 0 ] * 0.2 + f[ 0 ] * 0.155, y( 0.8 ), tt[ 2 ] - s[ 1 ] * 0.2 + f[ 1 ] * 0.155 ], [ tt[ 0 ] + s[ 0 ] * 0.2 + f[ 0 ] * 0.155, y( 0.8 ), tt[ 2 ] + s[ 1 ] * 0.2 + f[ 1 ] * 0.155 ], [ tt[ 0 ] + s[ 0 ] * 0.2 + f[ 0 ] * 0.155, y( 1.1 ), tt[ 2 ] + s[ 1 ] * 0.2 + f[ 1 ] * 0.155 ], [ tt[ 0 ] - s[ 0 ] * 0.2 + f[ 0 ] * 0.155, y( 1.1 ), tt[ 2 ] - s[ 1 ] * 0.2 + f[ 1 ] * 0.155 ], [ f[ 0 ], 0, f[ 1 ] ] );
	black.box( [ tt[ 0 ] + s[ 0 ] * 0.9, y( 0.3 ), tt[ 2 ] + s[ 1 ] * 0.9 ], [ 0.6, 0.6, 0.45 ] );

	// ---- the lights: two stands, soft boxes angled at her face, both blazing
	const lights = [];
	for ( const b of [ - 1.1, 1.2 ] ) {

		const base = at( 1.0, b ), head = [ base[ 0 ], y( 2.3 ), base[ 1 ] ];
		for ( let k = 0; k < 3; k ++ ) {

			const q = k / 3 * Math.PI * 2;
			steel.tube( [ [ base[ 0 ] + Math.cos( q ) * 0.45, y( 0 ), base[ 1 ] + Math.sin( q ) * 0.45 ], [ base[ 0 ], y( 0.6 ), base[ 1 ] ] ], [ 0.012, 0.012 ], 4 );

		}

		steel.tube( [ [ base[ 0 ], y( 0.55 ), base[ 1 ] ], head ], [ 0.02, 0.016 ], 5 );
		// the soft box: a black shell, its white face toward her
		const to = [ rep[ 0 ] - base[ 0 ], rep[ 1 ] - base[ 1 ] ], tl = Math.hypot( ...to ), g = [ to[ 0 ] / tl, to[ 1 ] / tl ], h = [ - g[ 1 ], g[ 0 ] ];
		const F = ( a, bb, hh ) => [ head[ 0 ] + g[ 0 ] * a + h[ 0 ] * bb, head[ 1 ] + hh - a * 0.18, head[ 2 ] + g[ 1 ] * a + h[ 1 ] * bb ];
		for ( const [ A, B, C, D ] of [ [ F( 0, - 0.12, - 0.1 ), F( 0.45, - 0.35, - 0.3 ), F( 0.45, - 0.35, 0.3 ), F( 0, - 0.12, 0.1 ) ], [ F( 0, 0.12, - 0.1 ), F( 0.45, 0.35, - 0.3 ), F( 0.45, 0.35, 0.3 ), F( 0, 0.12, 0.1 ) ], [ F( 0, - 0.12, 0.1 ), F( 0.45, - 0.35, 0.3 ), F( 0.45, 0.35, 0.3 ), F( 0, 0.12, 0.1 ) ], [ F( 0, - 0.12, - 0.1 ), F( 0.45, - 0.35, - 0.3 ), F( 0.45, 0.35, - 0.3 ), F( 0, 0.12, - 0.1 ) ] ] ) {

			black.face( A, B, C, D, [ 0, 1, 0 ] );

		}

		glow.face( F( 0.46, - 0.35, - 0.3 ), F( 0.46, 0.35, - 0.3 ), F( 0.46, 0.35, 0.3 ), F( 0.46, - 0.35, 0.3 ), [ g[ 0 ], - 0.2, g[ 1 ] ] );
		lights.push( { at: F( 0.5, 0, 0 ), dir: [ g[ 0 ], - 0.25, g[ 1 ] ] } );
		collide( base[ 0 ], base[ 1 ], 0.3 );

	}

	// ---- the camera on its sticks, in its rain cover
	const cb = at( 0, 0 );
	for ( let k = 0; k < 3; k ++ ) {

		const q = k / 3 * Math.PI * 2 + 0.5;
		steel.tube( [ [ cb[ 0 ] + Math.cos( q ) * 0.5, y( 0 ), cb[ 1 ] + Math.sin( q ) * 0.5 ], [ cb[ 0 ], y( 1.25 ), cb[ 1 ] ] ], [ 0.02, 0.018 ], 4 );

	}

	black.box( [ cb[ 0 ], y( 1.3 ), cb[ 1 ] ], [ 0.2, 0.08, 0.2 ] );
	// the body along the lens axis; the lens; the viewfinder; the cover draped over
	const C = ( a, b, hh ) => [ cb[ 0 ] + f[ 0 ] * a + s[ 0 ] * b, y( hh ), cb[ 1 ] + f[ 1 ] * a + s[ 1 ] * b ];
	black.tube( [ C( - 0.3, 0, 1.47 ), C( 0.25, 0, 1.47 ) ], [ 0.13, 0.12 ], 8, { capA: true, capB: true } );
	black.tube( [ C( 0.25, 0, 1.45 ), C( 0.55, 0, 1.45 ), C( 0.6, 0, 1.45 ) ], [ 0.06, 0.07, 0.085 ], 10, { capB: true } );
	black.box( C( - 0.05, - 0.15, 1.6 ), [ 0.06, 0.08, 0.15 ] );
	white.tube( [ C( - 0.35, 0, 1.52 ), C( 0.28, 0, 1.52 ) ], [ 0.17, 0.16 ], 8 );
	// the tally light on top: red when she's on
	const tally = C( 0.2, 0, 1.7 );

	// ---- the cable run: from the tent over the plaza and the sidewalk to the truck at the curb
	const tz = pattisonZ( - 76 ) - 9 + 1.3;
	const truckAt = [ - 76, tz ];
	const cable = [ tp( - 1.0, 1.4, 0.02 ), [ tc[ 0 ] + 4, y( 0.02 ), tc[ 1 ] + 9 ], [ - 92, y( 0.02 ), 82 ], [ - 84, y( 0.02 ), 97 ], [ - 79, y( 0.02 ), 104 ], [ - 77.5, y( 0.02 ), tz - 2.4 ], [ - 77, STREET + 0.02, tz - 1.2 ] ];
	for ( let i = 0; i < cable.length - 1; i ++ ) {

		// a little wander between the points
		const A = cable[ i ], B = cable[ i + 1 ], mid = [ ( A[ 0 ] + B[ 0 ] ) / 2 + Math.sin( i * 3.1 ) * 0.4, ( A[ 1 ] + B[ 1 ] ) / 2, ( A[ 2 ] + B[ 2 ] ) / 2 + Math.cos( i * 2.3 ) * 0.4 ];
		black.tube( [ A, mid, B ], [ 0.012, 0.012, 0.012 ], 4 );

	}

	// ---- the live truck: a white Ford box van at the curb facing west, FOX 29 NEWS down its side, the
	// mast up 13 m with the microwave dish
	{

		const [ x, z ] = truckAt, H = ( a, b, hh ) => [ x + a, STREET + hh, z + b ];
		// the box body and the cab (the van's front to the west)
		truck.box( H( 0.9, 0, 1.75 ), [ 4.6, 2.3, 2.3 ] );
		truck.box( H( - 2.5, 0, 1.15 ), [ 1.8, 1.3, 2.1 ] );
		truck.box( H( - 2.2, 0, 2.05 ), [ 1.2, 0.5, 2.0 ] );
		glass.face( H( - 3.12, - 0.9, 1.75 ), H( - 3.12, 0.9, 1.75 ), H( - 2.8, 0.85, 2.25 ), H( - 2.8, - 0.85, 2.25 ), [ - 1, 0.5, 0 ] );
		for ( const side of [ - 1, 1 ] ) glass.face( H( - 2.7, side * 1.06, 1.55 ), H( - 1.9, side * 1.06, 1.55 ), H( - 1.9, side * 1.06, 2.2 ), H( - 2.7, side * 1.06, 2.2 ), [ 0, 0, side ] );
		// the livery on both sides of the box (reads from outside)
		for ( const side of [ - 1, 1 ] ) {

			const zz = side * 1.16, [ ua, ub ] = side > 0 ? [ 0, 1 ] : [ 1, 0 ];
			livery.face( H( - 1.3, zz, 0.9 ), H( 3.1, zz, 0.9 ), H( 3.1, zz, 2.8 ), H( - 1.3, zz, 2.8 ), [ 0, 0, side ], [ [ ua, 1 ], [ ub, 1 ], [ ub, 0 ], [ ua, 0 ] ] );

		}

		// the wheels, the bumper
		for ( const [ a, b ] of [ [ - 2.4, - 1.0 ], [ - 2.4, 1.0 ], [ 2.0, - 1.0 ], [ 2.0, 1.0 ], [ 2.6, - 1.0 ], [ 2.6, 1.0 ] ] ) black.tube( [ H( a, b - 0.12, 0.38 ), H( a, b + 0.12, 0.38 ) ], [ 0.38, 0.38 ], 10, { capA: true, capB: true } );
		black.box( H( - 3.4, 0, 0.55 ), [ 0.15, 0.25, 2.1 ] );
		// the mast: three telescoping sections, up from the box's rear, the dish and its radome
		steel.tube( [ H( 2.6, 0, 2.9 ), H( 2.6, 0, 7.5 ) ], [ 0.11, 0.1 ], 8 );
		steel.tube( [ H( 2.6, 0, 7.5 ), H( 2.6, 0, 11.2 ) ], [ 0.08, 0.075 ], 8 );
		steel.tube( [ H( 2.6, 0, 11.2 ), H( 2.6, 0, 13.4 ) ], [ 0.055, 0.05 ], 8 );
		black.box( H( 2.6, 0, 13.55 ), [ 0.35, 0.3, 0.35 ] );
		white.tube( [ H( 2.45, 0, 13.9 ), H( 2.3, 0, 13.9 ) ], [ 0.45, 0.4 ], 14, { capA: true, capB: true } );
		// guy lines from the mast's top section to the box's corners
		for ( const [ a, b ] of [ [ 0.2, - 1.1 ], [ 0.2, 1.1 ], [ 3.1, - 1.1 ], [ 3.1, 1.1 ] ] ) steel.tube( [ H( 2.6, 0, 10.8 ), H( a, b, 2.9 ) ], [ 0.006, 0.006 ], 3 );
		const w = field.toWorld( x + 0.2, z );
		colliders.addBox( new Vector3( w.x, field.y0 + STREET + 1.5, w.z ), new Vector3( 3.3, 1.5, 1.2 ), field.group.rotation.y, { tag: 'truck' } );

	}

	// ---- materials
	const valTex = canvasTexture( 512, 64, ( ctx, w, h ) => {

		ctx.fillStyle = '#10151f'; ctx.fillRect( 0, 0, w, h );
		ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
		ctx.font = '900 44px "Arial Black", Helvetica, sans-serif';
		ctx.fillText( 'FOX', w / 2 - 80, h / 2 + 2 );
		ctx.fillStyle = '#d4202c'; ctx.fillText( '29', w / 2 + 20, h / 2 + 2 );
		ctx.fillStyle = '#ffffff'; ctx.font = '700 30px Helvetica, sans-serif'; ctx.fillText( 'NEWS', w / 2 + 120, h / 2 + 2 );

	}, 'foxValance' );
	const liveryTex = canvasTexture( 1024, 440, ( ctx, w, h ) => {

		ctx.fillStyle = '#f2f2f0'; ctx.fillRect( 0, 0, w, h );
		// the stripes sweeping along the lower side
		ctx.fillStyle = '#16305e'; ctx.beginPath(); ctx.moveTo( 0, h * 0.72 ); ctx.lineTo( w, h * 0.5 ); ctx.lineTo( w, h * 0.66 ); ctx.lineTo( 0, h * 0.88 ); ctx.fill();
		ctx.fillStyle = '#c8202a'; ctx.beginPath(); ctx.moveTo( 0, h * 0.9 ); ctx.lineTo( w, h * 0.68 ); ctx.lineTo( w, h * 0.74 ); ctx.lineTo( 0, h * 0.96 ); ctx.fill();
		ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
		ctx.fillStyle = '#10151f'; ctx.font = '900 150px "Arial Black", Helvetica, sans-serif';
		ctx.fillText( 'FOX', 70, 150 );
		ctx.fillStyle = '#c8202a'; ctx.fillText( '29', 450, 150 );
		ctx.fillStyle = '#16305e'; ctx.font = '700 64px Helvetica, sans-serif';
		ctx.fillText( 'NEWS', 690, 160 );
		ctx.font = '600 34px Helvetica, sans-serif'; ctx.fillText( 'myfoxphilly.com', 70, 262 );

	}, 'foxLivery' );
	const mats = [
		[ steel, standard( { name: 'w1-tv-steel', color: new Color( 0.3, 0.31, 0.32 ), roughness: 0.35, metalness: 0.8 } ), 'w1-tv-steel', true ],
		[ black, standard( { name: 'w1-tv-black', color: new Color( 0.015, 0.015, 0.017 ), roughness: 0.55 } ), 'w1-tv-black', true ],
		[ white, standard( { name: 'w1-tent', color: new Color( 0.75, 0.75, 0.73 ), roughness: 0.6, side: 'double' } ), 'w1-tent', true ],
		[ valance, standard( { name: 'w1-tent-valance', roughness: 0.6, side: 'double', textures: { fvTex: valTex }, surface: 's.albedo = textureSample( fvTex, smpAnisoClamp, in.uv ).rgb;' } ), 'w1-tent-valance', false ],
		[ glow, standard( { name: 'w1-tv-lights', color: new Color( 0.9, 0.9, 0.88 ), roughness: 0.4, surface: 's.emissive = vec3f( 1.0, 0.97, 0.9 ) * 18.0;' } ), 'w1-tv-light-faces', false ],
		[ truck, standard( { name: 'w1-truck', color: new Color( 0.7, 0.7, 0.68 ), roughness: 0.35, metalness: 0.2 } ), 'w1-live-truck', true ],
		[ livery, standard( { name: 'w1-truck-livery', roughness: 0.35, textures: { flTex: liveryTex }, surface: 's.albedo = textureSample( flTex, smpAnisoClamp, in.uv ).rgb;' } ), 'w1-truck-livery', false ],
		[ glass, standard( { name: 'w1-truck-glass', color: new Color( 0.02, 0.025, 0.03 ), roughness: 0.05, metalness: 0.3 } ), 'w1-truck-glass', false ],
	];
	for ( const [ m, mat, name, cast ] of mats ) {

		mat.underwaterLighting = 'none';
		const mesh = new Mesh( m.geometry(), mat );
		mesh.name = name;
		mesh.castShadow = cast;
		mesh.receiveShadow = true;
		group.add( mesh );

	}

	// the tally light
	const tallyMat = standard( { name: 'w1-tally', color: new Color( 0.1, 0, 0 ), lit: false, surface: 's.albedo = vec3f( 0.0 ); s.emissive = vec3f( 25.0, 0.5, 0.2 );' } );
	const tm = new Mesher();
	tm.box( tally, [ 0.04, 0.03, 0.04 ] );
	const tallyMesh = new Mesh( tm.geometry(), tallyMat );
	tallyMesh.name = 'w1-tally';
	tallyMesh.userData.dynamic = true;
	group.add( tallyMesh );
	collide( cb[ 0 ], cb[ 1 ], 0.5 );

	// ---- the people: the reporter, the photographer, a producer with an umbrella, the fans behind her
	const clock = { t: 0, live: false };
	const live = () => clock.live;
	const CA = cast;
	const reporter = CA.add( { at: rep, face: cam, act: 'stand', who: 'reporter', props: [ 'mic' ], noRainGear: true, extra: { custom: ( c, dt, w, p ) => {

		// on: talking to the lens, the free hand going; off: the notes, a word with the producer
		if ( live() ) {

			p.flexR = 0.7; p.abductR = 0.12; p.elbowR = 1.75; p.pitch = 0.02;
			p.flexL = 0.35 + 0.3 * Math.max( 0, Math.sin( c.t * 2.3 ) ); p.elbowL = 1.1; p.abductL = 0.15; p.yaw = 0.15 * Math.sin( c.t * 0.7 );

		} else {

			p.flexR = 0.2; p.elbowR = 1.3; p.flexL = 0.5; p.elbowL = 1.6; p.pitch = - 0.35; p.yaw = 0;

		}

	} } } );
	CA.add( { at: at( - 0.55, - 0.15 ), face: rep, act: 'stand', who: 'crew', noRainGear: true, extra: { custom: ( c, dt, w, p ) => {

		// on the camera: a hand on the pan bar, the other at the lens, an eye at the finder
		p.flexR = 0.95; p.abductR = 0.3; p.elbowR = 1.0; p.flexL = 1.15; p.abductL = - 0.15; p.elbowL = 0.8; p.lean = 0.12; p.yaw = 0.25; p.pitch = - 0.05;

	} } } );
	CA.add( { at: at( - 1.3, 1.5 ), face: rep, act: 'listen', who: 'crew', props: [ 'umbrella' ] } ); // the producer, the umbrella up
	// the fans behind her, into the shot when she's on
	for ( const [ a, b, act ] of [ [ 6.2, - 1.2, 'wave' ], [ 6.6, 0.3, 'jump' ], [ 6.1, 1.4, 'wave' ], [ 7.2, - 0.4, 'talk' ] ] ) {

		CA.add( { at: at( a, b ), face: cam, act: 'listen', noRainGear: true, when: ( w ) => w.rate > 0.03, extra: { custom: ( c, dt, w, p ) => {

			if ( ! live() ) return;
			// the act, done by hand: they're in the shot
			const t = c.t;
			if ( act === 'wave' ) {

				c.f.props |= 1 << 11;
				p.flexL = 2.6 + 0.25 * Math.sin( t * 8 ); p.abductL = - 0.25 + 0.25 * Math.cos( t * 8 ); p.elbowL = 0.3; p.pitch = 0.2;

			} else if ( act === 'jump' ) {

				p.flexL = 2.8; p.abductL = - 0.3; p.elbowL = 0.2; p.flexR = 2.8; p.abductR = - 0.3; p.elbowR = 0.2; p.pitch = 0.35;
				c.f.y += Math.max( 0, Math.sin( t * 6 ) ) * 0.28;

			} else {

				p.flexR = 1.6; p.abductR = 0.4; p.elbowR = 0.3;

			}

		} } } );

	}

	const obstacles = [ [ cb[ 0 ], cb[ 1 ], 1.2 ], [ tc[ 0 ], tc[ 1 ], 2.4 ], [ rep[ 0 ], rep[ 1 ], 1.0 ], [ at( 1.0, - 1.1 )[ 0 ], at( 1.0, - 1.1 )[ 1 ], 0.6 ], [ at( 1.0, 1.2 )[ 0 ], at( 1.0, 1.2 )[ 1 ], 0.6 ], [ ...at( 6.6, 0 ), 2.0 ] ];
	return {
		lights, obstacles, reporter,
		update( dt ) {

			// on the air for ~20 s a minute
			clock.t += dt;
			clock.live = clock.t % 62 < 21;
			tallyMesh.visible = clock.live;
			// (P0) the ones going by look over at her while she's on, under the lights
			lookAt( 'gate-fox29', clock.live ? { x: rep[ 0 ], y: LEVELS.mainConcourse + LIFT + 1.6, z: rep[ 1 ], r: 11, k: 0.55 } : null );

		},
	};

}
