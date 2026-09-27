import { Mesh, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { Quads } from '../../Stands.js';
import { canvasTexture } from '../../geo.js';
import { FieldFigures, OUTFIT, POSES } from '../../FieldFigures.js';
import * as M from '../../game/Motions.js';
import { look as lookFor } from '../../game/Looks.js';
import { ROLE } from '../../game/Players.js';
import { RUBBER_FRONT } from '../../layout.js';

// Life in the pens on the two nights. What's in them: in the Phillies' recess under the visitors' floor a
// long slat bench on steel frames, the orange Gatorade cooler on its red stand, a bucket of balls, the
// propane heater blowing at the bench (47 F and raining, then 44 and blowing), folding chairs, towels, the
// bullpen phone on the back wall; up in the Rays' pen the same under their shelter. Who's in them: the
// relievers in their team jackets on the benches, the bullpen coaches, the bullpen catchers. And when the
// replay's pitching changes come, the phone rings, the coach takes it, the next man peels off his
// jacket, walks to the mound and throws, the catcher in his mask down behind the plate, pitch after pitch
// until he's called in (the Director jogs him to the mound from there). At the last out the Phillies'
// pen empties onto the field.
//
// The warm-ups use the detailed rig (game/Players.js: a few slots of its own), the rest FieldFigures.

// the bullpen staffs in October 2008: Roly de Armas (#29), the Phillies' interim bullpen coach (Ramon Henderson
// was on leave), Mick Billmeyer (#17), the catching instructor, catching the warm-ups; Bobby Ramos (#7) and
// the Rays' bullpen catcher Scott Cursi (#77) (the rosters on Wikipedia; the Phillies' 2008 bullpen catcher
// isn't recorded)
const STAFF = {
	home: { coach: 'de Armas', catcher: { number: '17', name: '', look: { skin: [ 0.56, 0.36, 0.25 ], hair: [ 0.25, 0.2, 0.15 ], beard: 1, height: 0.99, girth: 1.12, belly: 0.3, age: 0.7 } } },
	away: { coach: 'Ramos', catcher: { number: '77', name: 'CURSI', look: { skin: [ 0.55, 0.37, 0.26 ], beard: 0, height: 0.95, girth: 1.02 } } },
};

// who sits in each pen: the relievers, left to right along the bench (ids from the game's rosters)
const BENCH = {
	home: [ 239795 /* Durbin */, 113961 /* Eyre */, 424925 /* Condrey */, 425492 /* Madson */, 457918 /* Happ */, 240694 /* Romero */, 400058 /* Lidge */ ],
	away: [ 235095 /* Wheeler */, 346797 /* Balfour */, 434442 /* Howell */, 136268 /* Bradford */, 456034 /* Price */ ],
};

// the coach on the phone to the dugout: the receiver at his ear, the other hand on his hip
POSES.penPhone = POSES.penPhone || {
	elbow: [ 0.28, 1.3, - 0.02 ], wrist: [ 0.15, 1.5, - 0.03 ], hand: [ 0.1, 1.56, - 0.01 ],
	'L:elbow': [ - 0.3, 1.05, 0.05 ], 'L:wrist': [ - 0.2, 0.95, 0.03 ], 'L:hand': [ - 0.17, 0.92, 0.0 ],
};

const PAL = [ 'wood', 'steel', 'orange', 'red', 'white', 'grey', 'heater', 'beige', 'black', 'towel', 'green', 'cup', 'leather' ];
const P = Object.fromEntries( PAL.map( ( k, i ) => [ k, i ] ) );

function gearMaterial() {

	const m = standard( {
		name: 'pen-gear', roughness: 0.6,
		surface: /* wgsl */`
	let k = i32( in.uv.x * ${ PAL.length }.0 );
	var c = vec3f( 0.5 );
	var r = 0.6;
	var mt = 0.0;
	var e = vec3f( 0.0 );
	switch k {
		case 0: { c = vec3f( 0.28, 0.16, 0.08 ) * ( 0.85 + 0.2 * fract( sin( floor( in.P.y * 40.0 ) * 12.9 ) * 437.5 ) ); r = 0.7; }
		case 1: { c = vec3f( 0.12, 0.12, 0.13 ); r = 0.4; mt = 0.7; }
		case 2: { c = vec3f( 0.8, 0.24, 0.015 ); r = 0.35; }
		case 3: { c = vec3f( 0.42, 0.02, 0.03 ); r = 0.5; }
		case 4: { c = vec3f( 0.78, 0.77, 0.74 ); r = 0.5; }
		case 5: { c = vec3f( 0.3, 0.31, 0.32 ); r = 0.45; mt = 0.5; }
		case 6: { c = vec3f( 0.3, 0.05, 0.02 ); e = vec3f( 1.0, 0.33, 0.05 ) * mix( 0.9, 2.4, smoothstep( 0.2, 0.8, frame.night ) ); }
		case 7: { c = vec3f( 0.6, 0.55, 0.45 ); r = 0.4; }
		case 8: { c = vec3f( 0.02 ); r = 0.5; }
		case 9: { c = vec3f( 0.72, 0.72, 0.7 ); r = 0.95; }
		case 10: { c = vec3f( 0.015, 0.06, 0.03 ); r = 0.55; }
		case 11: { c = vec3f( 0.8, 0.78, 0.72 ); r = 0.3; }
		default: { c = vec3f( 0.2, 0.09, 0.035 ); r = 0.5; }
	}
	s.albedo = c;
	s.roughness = r;
	s.metalness = mt;
	// under the soffit's strip lights, and the park's lights at night
	s.emissive = e + c * mix( 0.12, 0.3, smoothstep( 0.2, 0.8, frame.night ) );
` } );
	m.underwaterLighting = 'none';
	m.setDefine( 'DRY', 1 );
	return m;

}

export class Pens {

	// frame: Field.penFrame (s along the fence from 401, t back from it, at( s, t ) -> [ x, z ])
	constructor( { parent, frame } ) {

		this.F = frame;
		this.parent = parent;
		const F = frame;
		this.gear = new Quads();
		const g = this.gear;
		// an oriented box in the pen's frame: s0..s1 along, t0..t1 back, y0..y1 up, one palette colour
		const pbox = ( s0, s1, t0, t1, y0, y1, pal ) => {

			const u = ( pal + 0.5 ) / PAL.length;
			const C = ( s, t, y ) => {

				const [ x, z ] = F.at( s, t );
				return [ x, y, z ];

			};

			const faces = [
				[ C( s0, t0, y0 ), C( s1, t0, y0 ), C( s1, t0, y1 ), C( s0, t0, y1 ), [ - F.nx, 0, - F.nz ] ],
				[ C( s1, t1, y0 ), C( s0, t1, y0 ), C( s0, t1, y1 ), C( s1, t1, y1 ), [ F.nx, 0, F.nz ] ],
				[ C( s0, t1, y0 ), C( s0, t0, y0 ), C( s0, t0, y1 ), C( s0, t1, y1 ), [ - F.ux, 0, - F.uz ] ],
				[ C( s1, t0, y0 ), C( s1, t1, y0 ), C( s1, t1, y1 ), C( s1, t0, y1 ), [ F.ux, 0, F.uz ] ],
				[ C( s0, t0, y1 ), C( s1, t0, y1 ), C( s1, t1, y1 ), C( s0, t1, y1 ), [ 0, 1, 0 ] ],
				[ C( s0, t1, y0 ), C( s1, t1, y0 ), C( s1, t0, y0 ), C( s0, t0, y0 ), [ 0, - 1, 0 ] ],
			];
			for ( const [ a, b, c, d, n ] of faces ) {

				g.tri( a, b, c, n, [ u, 0.5 ], [ u, 0.5 ], [ u, 0.5 ] );
				g.tri( a, c, d, n, [ u, 0.5 ], [ u, 0.5 ], [ u, 0.5 ] );

			}

		};

		this.pbox = pbox;
		this.figs = new FieldFigures( parent );
		this.benchSpots = { home: [], away: [] };
		// the Phillies' recess: the back wall at t = T0 + D
		const wallT = F.T0 + F.D;
		this._bench( 'home', 3.6, 18.4, wallT, 0 );
		this._kit( 'home', wallT, 0, { cooler: 19.3, bucket: 2.6, heater: 9.5, chairs: [ 20.6, 21.6 ], phone: 2.2, can: 22.8 } );
		// the Rays': their shelter's bench against the back wall at the 398 end
		const [ sA, sB ] = F.shelter;
		this._bench( 'away', sA + 0.5, sB - 1.6, F.TB, F.R );
		this._kit( 'away', F.TB, F.R, { cooler: sB - 0.9, bucket: sA - 1.0, heater: ( sA + sB ) / 2, chairs: [ sA - 2.4 ], phone: sA - 0.4, can: sA - 1.8 } );
		// the people
		this.sitters = { home: [], away: [] };
		for ( const side of [ 'home', 'away' ] ) {

			const spots = this.benchSpots[ side ];
			const ids = BENCH[ side ];
			ids.forEach( ( id, i ) => {

				const sp = spots[ Math.floor( ( i + 0.5 ) * spots.length / ids.length ) ];
				const pose = [ 'sitFwd', 'sit', 'sitFold' ][ ( i * 7 + ( side === 'home' ? 0 : 1 ) ) % 3 ];
				const f = this.figs.add( pose, { x: sp.x, y: sp.y, z: sp.z, yaw: sp.yaw, outfit: side === 'home' ? OUTFIT.phiJacket : OUTFIT.rayJacket, group: side + '-sit-' + id, scale: 1.0 + ( ( id * 7 ) % 5 ) * 0.012 } );
				this.sitters[ side ].push( { id, f, group: side + '-sit-' + id, spot: sp } );

			} );

		}

		// the bullpen coaches: standing at the front of the bench watching, or on the phone
		this.coach = {};
		for ( const side of [ 'home', 'away' ] ) {

			const y = side === 'home' ? 0 : F.R;
			const tFront = side === 'home' ? wallT - 2.2 : F.TB - 2.6;
			const [ wx, wz ] = F.at( side === 'home' ? 8.0 : sA + 1.2, tFront );
			const [ px, pz ] = side === 'home' ? F.at( 2.2, wallT - 0.45 ) : F.at( sA - 0.4, F.TB - 0.45 );
			const face = Math.atan2( F.nx, F.nz ); // facing the field (-n)
			const out = this.figs.add( 'pockets', { x: wx, y, z: wz, yaw: face + 0.5, outfit: side === 'home' ? OUTFIT.coachPhi : OUTFIT.coachRay, group: side + '-coach' } );
			const phone = this.figs.add( 'penPhone', { x: px, y, z: pz, yaw: face, outfit: side === 'home' ? OUTFIT.coachPhi : OUTFIT.coachRay, group: side + '-coach-phone' } );
			this.coach[ side ] = { out, phone };

		}

		this.figs.build();
		this._powerball( parent );
		const gm = new Mesh( g.geometry(), gearMaterial() );
		gm.name = 'pen-gear';
		gm.castShadow = true;
		gm.receiveShadow = true;
		parent.add( gm );
		// the warm-ups (the rig slots are taken on the first frame, once the players exist)
		this.rig = null;

	}

	// The Pennsylvania Lottery's green Powerball sign on the visitors' back wall at the 398 end, where the
	// 2008 photos have it (the jackpot's figure unreadable in them: this one invented), backlit at night
	_powerball( parent ) {

		const F = this.F;
		const tex = canvasTexture( 512, 192, ( ctx, w, h ) => {

			ctx.fillStyle = '#0d5a2c'; ctx.fillRect( 0, 0, w, h );
			ctx.strokeStyle = '#e8e4d8'; ctx.lineWidth = 5; ctx.strokeRect( 6, 6, w - 12, h - 12 );
			// the red ball and the word
			ctx.fillStyle = '#d0202e'; ctx.beginPath(); ctx.arc( 70, 62, 34, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.font = '900 30px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'PB', 70, 64 );
			ctx.font = '900 54px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'POWERBALL', 300, 62 );
			ctx.fillStyle = '#f7d117'; ctx.font = '900 64px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( '$ 50 MILLION', w / 2, 142 );

		}, 'powerball' );
		const mat = standard( { name: 'pen-powerball', roughness: 0.4, textures: { bpPB: tex },
			surface: 'let t = textureSample( bpPB, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.6; s.emissive = t * mix( 0.15, 0.8, smoothstep( 0.2, 0.8, frame.night ) );' } );
		mat.underwaterLighting = 'none';
		const q = new Quads();
		const s0 = F.S1 - 4.1, s1 = F.S1 - 0.7, y0 = F.R + 1.35, y1 = F.R + 2.35, t = F.TB - 0.02;
		const P = ( s, y ) => {

			const [ x, z ] = F.at( s, t );
			return [ x, y, z ];

		};

		// seen from the field, +s runs to the viewer's right
		q.tri( P( s0, y0 ), P( s1, y0 ), P( s1, y1 ), [ - F.nx, 0, - F.nz ], [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] );
		q.tri( P( s0, y0 ), P( s1, y1 ), P( s0, y1 ), [ - F.nx, 0, - F.nz ], [ 0, 1 ], [ 1, 0 ], [ 0, 0 ] );
		const m = new Mesh( q.geometry(), mat );
		m.name = 'pen-powerball';
		parent.add( m );

	}

	// a slat bench on steel frames against the back wall (t = wall), from s0 to s1, floor y
	_bench( side, s0, s1, wall, y ) {

		const F = this.F, b = this.pbox;
		const t0 = wall - 0.62, t1 = wall - 0.1;
		// three slats and a two-slat back
		for ( let k = 0; k < 3; k ++ ) b( s0, s1, t0 + k * 0.18, t0 + k * 0.18 + 0.14, y + 0.43, y + 0.46, P.wood );
		for ( const yy of [ 0.62, 0.8 ] ) b( s0, s1, wall - 0.14, wall - 0.08, y + yy, y + yy + 0.1, P.wood );
		for ( let s = s0 + 0.2; s < s1; s += 2.0 ) {

			b( s, s + 0.05, t0 + 0.05, t1, y, y + 0.43, P.steel );
			b( s, s + 0.05, wall - 0.14, wall - 0.1, y + 0.43, y + 0.92, P.steel );

		}

		// where they sit: every 0.75 m, facing the field
		const face = Math.atan2( F.nx, F.nz );
		for ( let s = s0 + 0.5; s < s1 - 0.3; s += 0.75 ) {

			const [ x, z ] = F.at( s, t0 + 0.34 );
			this.benchSpots[ side ].push( { x, y, z, yaw: face, s } );

		}

		// towels over the bench's back, a jacket left on it, gloves, sunflower-seed bags, cups under it
		for ( let s = s0 + 0.9; s < s1 - 0.5; s += 2.7 ) b( s, s + 0.4, wall - 0.16, wall - 0.06, y + 0.55, y + 0.92, P.towel );
		for ( let s = s0 + 1.6; s < s1 - 0.5; s += 3.1 ) {

			b( s, s + 0.22, t0 + 0.1, t0 + 0.3, y + 0.46, y + 0.52, P.leather );
			b( s + 0.6, s + 0.68, t0 + 0.05, t0 + 0.13, y, y + 0.12, P.cup );
			b( s + 1.1, s + 1.16, t0 - 0.1, t0 - 0.04, y, y + 0.12, P.cup );

		}

	}

	// the cooler on its stand, the ball bucket, the heater, the chairs, the phone, the trash can
	_kit( side, wall, y, at ) {

		const b = this.pbox;
		// the Gatorade cooler: orange, a white lid, on a red stand, a sleeve of cups beside it
		const c = at.cooler;
		b( c - 0.35, c + 0.35, wall - 0.75, wall - 0.15, y, y + 0.55, P.red );
		b( c - 0.28, c + 0.28, wall - 0.7, wall - 0.2, y + 0.55, y + 1.05, P.orange );
		b( c - 0.29, c + 0.29, wall - 0.71, wall - 0.19, y + 1.05, y + 1.1, P.white );
		b( c + 0.36, c + 0.44, wall - 0.5, wall - 0.42, y + 0.55, y + 0.95, P.cup );
		// a white bucket of balls by the plates' end, a few in the grass
		const k = at.bucket;
		b( k - 0.16, k + 0.16, wall - 1.9, wall - 1.58, y, y + 0.4, P.white );
		b( k - 0.14, k + 0.14, wall - 1.88, wall - 1.6, y + 0.4, y + 0.44, P.cup );
		// the propane heater on its stand, the grille glowing at the bench
		const h = at.heater;
		b( h - 0.2, h + 0.2, wall - 2.6, wall - 2.2, y, y + 0.35, P.grey );
		b( h - 0.35, h + 0.35, wall - 2.55, wall - 2.25, y + 0.35, y + 0.75, P.grey );
		b( h - 0.3, h + 0.3, wall - 2.24, wall - 2.2, y + 0.4, y + 0.7, P.heater );
		// folding chairs, facing the field
		for ( const f of at.chairs ) {

			b( f - 0.22, f + 0.22, wall - 1.3, wall - 0.9, y + 0.44, y + 0.47, P.black );
			b( f - 0.22, f + 0.22, wall - 0.9, wall - 0.87, y + 0.47, y + 0.85, P.black );
			for ( const [ ds, dt ] of [ [ - 0.2, 0 ], [ 0.18, 0 ], [ - 0.2, 0.38 ], [ 0.18, 0.38 ] ] ) b( f + ds, f + ds + 0.03, wall - 1.3 + dt, wall - 1.27 + dt, y, y + 0.44, P.steel );

		}

		// the phone to the dugout: a beige handset on a box on the back wall
		b( at.phone - 0.12, at.phone + 0.12, wall - 0.12, wall - 0.01, y + 1.35, y + 1.65, P.beige );
		b( at.phone - 0.09, at.phone - 0.03, wall - 0.16, wall - 0.12, y + 1.4, y + 1.62, P.black );
		// the trash can
		b( at.can - 0.25, at.can + 0.25, wall - 0.7, wall - 0.2, y, y + 0.85, P.green );

	}

	// ---------------------------------------------------------------- per frame

	// players: the rig (app.players); w: alley/Night.js's when()
	update( dt, director, players, w ) {

		if ( ! players ) return;
		if ( ! this.rig ) this._takeSlots( director, players );
		const t = director.t;
		const cel = w.celebrate;
		this.warming = { home: false, away: false };
		this.warmingId = { home: null, away: null };
		this.tossFrom = null;
		for ( const side of [ 'home', 'away' ] ) {

			const S = this.rig[ side ];
			// who's warming now, and who's gone (in the game already, or never coming back)
			const warm = this.schedule[ side ].find( ( j ) => t >= j.from - 25 && t < j.to );
			const gone = new Set( this.schedule[ side ].filter( ( j ) => t >= j.to && ! j.stays ).map( ( j ) => j.id ) );
			// the Phillies' pen goes over the fence at the last out
			const empty = cel && side === 'home';
			for ( const s of this.sitters[ side ] ) this.figs.setGroup( s.group, ! empty && ! gone.has( s.id ) && ! ( warm && warm.id === s.id && t >= warm.from ) );
			// the coach: on the phone just before a man gets up, else out in front watching
			const calling = warm && t < warm.from;
			this.figs.setGroup( side + '-coach', ! empty && ! calling );
			this.figs.setGroup( side + '-coach-phone', ! empty && !! calling );
			// the warm-up
			if ( warm && t >= warm.from && ! empty ) {

				if ( S.pitcherId !== warm.id ) this._dress( S, side, warm.id, players );
				this._warm( S, side, warm, t - warm.from );
				this.warming[ side ] = true;
				this.warmingId[ side ] = warm.id;

			} else {

				if ( S.pitcher ) S.pitcher.visible = false;
				// the visitors' catcher comes over under the rail and lobs a ball up to a kid (Cast.js asks)
				const toss = side === 'away' && this.toss && t > this.toss.t - 3 && t < this.toss.t + 1.5 ? this.toss : null;
				if ( toss ) this._toss( S, toss, t );
				else this._idleCatcher( S, side, t, empty );

			}

		}

		this.figs.update();

	}

	_takeSlots( director, players ) {

		this.players = players;
		this.rig = {};
		for ( const side of [ 'home', 'away' ] ) {

			const c = STAFF[ side ].catcher;
			const catcher = players.add( { team: side, number: c.number, gloveHand: 'L', name: c.name, look: { ...lookFor( null, side === 'home' ? 3.3 : 7.7 ), ...c.look } } );
			catcher.seed = side === 'home' ? 0.31 : 0.77;
			this.rig[ side ] = { catcher, pitcher: null, pitcherId: null };

		}

		// the warm-ups: every pitching change in the replay, the new man up in his pen for the few minutes
		// before it (not before the night's first pitch, nor across the two nights); and on the 27th Chad
		// Durbin up in the rain in the 6th, when the Rays tied it
		const segs = director.segments, P = director.game.players;
		const iSusp = segs.findIndex( ( s ) => s.kind === 'switch' && s.snap.inning === 6 && s.snap.half === 'bottom' );
		const tResume = iSusp >= 0 ? segs[ iSusp ].t0 + segs[ iSusp ].dur : 0, tSusp = iSusp >= 0 ? segs[ iSusp ].t0 : 0;
		this.schedule = { home: [], away: [] };
		const last = { home: 0, away: 0 };
		for ( const s of segs ) {

			if ( s.kind !== 'change' ) continue;
			const side = s.snap.fielding, id = s.snap.pitcher;
			let from = Math.max( s.t0 - 240, last[ side ] + 20 );
			if ( s.t0 > tResume ) from = Math.max( from, tResume + 2 );
			this.schedule[ side ].push( { id, from, to: s.t0, throws: P[ id ]?.throws || 'R' } );
			last[ side ] = s.t0;

		}

		// (Durbin sits back down when they stop: he never went in, so he isn't "gone" after)
		if ( tSusp ) this.schedule.home.unshift( { id: 239795, from: tSusp - 200, to: tSusp, throws: 'R', stays: true } );
		// and Balfour loose again in the visitors' pen before the resumption (Getty, October 29: he and Jim
		// Hickey walked in from the pen to start it)
		if ( tSusp ) this.schedule.away.push( { id: 346797, from: tSusp + 6, to: tResume, throws: 'R', stays: true } );
		this.schedule.away.sort( ( a, b ) => a.from - b.from );

	}

	// put this reliever in the side's pitcher slot (his number, his name, his face)
	_dress( S, side, id, players ) {

		if ( S.pitcher ) players.remove( S.pitcher );
		const p = players.add( { team: side, number: this._num( id ), gloveHand: this._throws( id ) === 'L' ? 'R' : 'L', name: this._last( id ), look: lookFor( id, id * 0.001 ) } );
		p.seed = ( id % 97 ) / 97;
		S.pitcher = p;
		S.pitcherId = id;

	}

	// the pen's geometry for a side: the lane, the rubber and the plate, where the catcher crouches
	_lane( side ) {

		const F = this.F;
		const t = side === 'home' ? 4.5 : F.TU + 3.7;
		const y = side === 'home' ? 0 : F.R;
		const sR = F.SM + 0.35; // the mounds at the 401 end (Field._buildBullpens)
		const sC = sR + RUBBER_FRONT + 0.45;
		return { t, y, rubber: F.at( sR, t ), plate: F.at( sC, t ), toPlate: Math.atan2( - F.ux, - F.uz ), toMound: Math.atan2( F.ux, F.uz ) };

	}

	// one warm-up: walk out from the bench, then pitch every 11 s; the catcher down behind the plate
	_warm( S, side, job, lt ) {

		const Ln = this._lane( side );
		const lefty = job.throws === 'L';
		const hand = ( pose ) => lefty ? M.mirror( pose ) : pose;
		const p = S.pitcher, c = S.catcher;
		p.visible = true;
		p.role = 0;
		p.dirt = 0;
		// from the bench to the rubber
		const sp = this.benchSpots[ side ][ Math.floor( this.benchSpots[ side ].length * 0.6 ) ];
		const walkT = Math.hypot( Ln.rubber[ 0 ] - sp.x, Ln.rubber[ 1 ] - sp.z ) / 1.4;
		if ( lt < walkT ) {

			const k = lt / walkT;
			p.x = sp.x + ( Ln.rubber[ 0 ] - sp.x ) * k;
			p.z = sp.z + ( Ln.rubber[ 1 ] - sp.z ) * k;
			p.y = Ln.y;
			p.yaw = Math.atan2( - ( Ln.rubber[ 0 ] - sp.x ), - ( Ln.rubber[ 1 ] - sp.z ) );
			p.pose = M.walk( lt * 0.9 );
			p.role = ROLE.jacket;

		} else {

			const T = 11, u = ( lt - walkT ) % T, n = Math.floor( ( lt - walkT ) / T );
			p.x = Ln.rubber[ 0 ]; p.z = Ln.rubber[ 1 ]; p.y = Ln.y + 0.25; p.yaw = Ln.toPlate;
			// the first few easy, off the front of the mound: all of them from the rubber here
			let pose;
			if ( u < 1.6 ) pose = M.lookIn( u, Math.max( 0, Math.min( 1, ( u - 0.9 ) / 0.4 ) ) );
			else if ( u < 2.4 ) pose = M.pitcherSet();
			else if ( u < 2.4 + 2.2 ) pose = M.delivery( u - 2.4 );
			else if ( u < 6.4 ) pose = M.stand( u );
			else if ( u < 7.2 ) pose = M.catchHigh( u );
			else pose = M.stand( u );
			p.pose = hand( pose );
			void n;

		}

		// the catcher: down behind the plate, up to throw it back
		c.visible = true;
		c.x = Ln.plate[ 0 ]; c.z = Ln.plate[ 1 ]; c.y = Ln.y; c.yaw = Ln.toMound;
		c.role = ROLE.gear | ROLE.mask | ROLE.mittC | ROLE.ccap;
		const u = lt < walkT ? - 1 : ( lt - walkT ) % 11;
		if ( u < 0 ) c.pose = M.stand( lt );
		else if ( u < 5.2 ) c.pose = M.catcherCrouch( u );
		else if ( u < 5.6 ) c.pose = M.blend( M.catcherCrouch( u ), M.stand( u ), ( u - 5.2 ) / 0.4 );
		else if ( u < 6.6 ) c.pose = M.throwBall( ( u - 5.6 ) * 0.7 );
		else if ( u < 7.4 ) c.pose = M.blend( M.stand( u ), M.catcherCrouch( u ), ( u - 6.6 ) / 0.8 );
		else c.pose = M.catcherCrouch( u );

	}

	// under the rail, facing up at it: stands, then the throw (released at toss.t)
	_toss( S, toss, t ) {

		const F = this.F, c = S.catcher;
		const [ ax, az ] = F.at( 0, 0 );
		const s = ( toss.to[ 0 ] - ax ) * F.ux + ( toss.to[ 1 ] - az ) * F.uz;
		const [ x, z ] = F.at( s, F.TB - F.overhang - 1.3 ); // out in front of the cave, clear of the deck over it
		c.visible = true;
		c.x = x; c.z = z; c.y = F.R;
		c.yaw = Math.atan2( - F.nx, - F.nz );
		c.role = ROLE.ccap | ROLE.mittC;
		const u = t - ( toss.t - M.THROW_REL );
		c.pose = u < 0 ? M.stand( t ) : M.throwBall( Math.min( u, 1.2 ) );
		this.tossFrom = [ x + F.nx * 0.35, F.R + 2.05, z + F.nz * 0.35 ];

	}

	// no one throwing: the catcher sits on the bench with his mask on his knee
	_idleCatcher( S, side, t, empty ) {

		const c = S.catcher;
		if ( empty ) {

			c.visible = false;
			return;

		}

		const spots = this.benchSpots[ side ], sp = spots[ spots.length - 1 ];
		c.visible = true;
		c.x = sp.x; c.z = sp.z; c.y = sp.y; c.yaw = sp.yaw;
		c.role = ROLE.gear | ROLE.ccap | ROLE.mittC;
		c.pose = M.sit( t, 0.46 );

	}

	setGame( game ) {

		this._game = game;

	}

	_num( id ) {

		return this._game?.players?.[ id ]?.num || '';

	}

	_last( id ) {

		return this._game?.players?.[ id ]?.last || '';

	}

	_throws( id ) {

		return this._game?.players?.[ id ]?.throws || 'R';

	}

}
