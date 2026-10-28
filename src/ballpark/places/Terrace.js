import { Group, Sphere, Vector3, Color } from '../../engine/index.js';
import { LEVELS } from '../layout.js';
import { Cast } from './Cast.js';
import { Tempo } from './Tempo.js';
import { nightState } from './Concourse3BPeople.js';
import { buildTerrace } from './terrace/Build.js';
import { TerracePeople } from './terrace/People.js';
import { TerraceSounds } from './terrace/Sounds.js';
import { buildEscalator, plazaFittings } from './leftfield/Escalator.js';
import { dress, sizeOf, rng } from './Concourse3BKit.js';

// FW3 (C2W-7, gauntlet r2): the Terrace concourse, the 300s' and 400s' level, 81 ft up. It was a 2.4 m
// strip with the 400s' front row's feet on it and, behind the 400s, a bare unlit deck; the scouting found
// "one person in it". In 2008 the upper deck was "split into two smaller decks" with the concourse between,
// open to the field over the 300s ("The Terrace Level concourse provides a similar openness", the 2008
// Convenience Guide), the 400s overhead on their steel and reached by stairs (newballpark.org, June 2008;
// Anfony79, <= May 2008, behind 332), its stands where the October 2008 guide lists them. Bowl.js raises the
// 400s over it (T400) and lays its floor; here it's fitted out:
//
//   terrace/Build.js    the floor, the steel and the domes, the rail and its glass over the 300s, the
//                       sections' plates, the stairs up into the 400s' boxes, the back rail
//   Concourse.terrace() the stands, restrooms and services along the back (the main concourse's units)
//   terrace/People.js   the people (a Cast troupe on the place's Tempo)
//   terrace/Sounds.js   the wind, the murmur, the grills, the registers
//
// Drawn whole from up there (the camera above the club level). ---- FW5 (C3W-1, gauntlet r3): from below and
// outside (the seats, the field, the main concourse, Pattison) it isn't dark, as FW3 had it: the photos show
// the glass at the 300s' back with fans standing at it (Commons 2008-03-29), the lit row under the deck
// (blender13, Oct 29 2008), fans along the gate frame's upper rails (roadieshow, Oct 27 2008). So from down
// there the fabric stays (the steel and its domes, the deck, the rail and its glass, the floor: ~27k
// triangles in six draws), the stands go to their far fronts (one draw: Concourse._terraceFar), and the
// people stay but for the counter staff (the Cast's own draws: no more draws, a few hundred small
// figures). Field frame.
const UP = 15.5;

export default class Terrace {

	constructor( { app, field, bowl } ) {

		this.app = app;
		this.field = field;
		this.bowl = bowl;
		this.group = new Group();
		this.group.name = 'terrace';
		if ( ! bowl?.upper?.find( ( t ) => t.name === 'terrace-400' ) ) return;
		this.T = buildTerrace( this.group, bowl );
		this.stands = app?.concourse?.terrace ? app.concourse.terrace( bowl, this.group ) : { units: [], open: [], spots: [], doors: [], meshes: [] };
		// (CI-18) the Pavilion's and the Arcade's walkways' stands, batched with the park (always drawn)
		this.stands.gallery = app?.concourse?.galleries ? app.concourse.galleries( bowl, this.group ).spots : [];
		this.T.backRail( this.stands.open );
		this.T.finish();
		this.meshes = [ ...this.T.meshes, ...this.stands.meshes ];
		// ---- FW5 (C3W-1): what's drawn only from up there (the stands proper), and only from below (their fronts)
		this.near = this.stands.meshes;
		this.far = this.stands.far || [];
		for ( const m of this.far ) m.visible = false;
		// the people: in the troupe's bounds (the whole concourse: the pool culls them one by one) (---- FW5,
		// C3W-6: 700, was 420)
		this.cast = new Cast( { parent: this.group, max: 700 } );
		this.cast.bounds = new Sphere( new Vector3( 0, LEVELS.terraceConcourse, 0 ), 140 );
		this.people = new TerracePeople( this, this.cast, this.T, this.stands );
		this._tempo = new Tempo( [ this.cast ] );
		this.sounds = new TerraceSounds( this );
		this.up = true;
		// (CI-10, CI-12) the Left Field escalator, up from the plaza past the Schmitter to the ramp's Arcade
		// landing, and the plaza's fittings round its foot (always drawn)
		this._escalator();

	}

	_escalator() {

		// along the main concourse's row of stands from the Schmitter's (behind 137) toward the left field
		// corner, 1.5 m in front of it; up to the Left Field ramp's landing at the Arcade's level (Ramp.js:
		// its fourth run arrives at z -64..-67.6 at 15.84 m)
		const sch = this.app?.concourse?.units?.find( ( U ) => U.what === 'schmitter' );
		if ( ! sch ) return;
		const a = [ - sch.a[ 0 ], - sch.a[ 1 ] ], n = sch.n;
		const along = Math.sign( a[ 0 ] * - 0.58 + a[ 1 ] * - 0.81 ) || 1;
		const u = [ a[ 0 ] * along, a[ 1 ] * along ];
		const foot = [ sch.mid[ 0 ] + u[ 0 ] * 8.2 + n[ 0 ] * 1.5, sch.mid[ 1 ] + u[ 1 ] * 8.2 + n[ 1 ] * 1.5 ];
		const y0 = LEVELS.mainConcourse, y1 = y0 + 4 * ( LEVELS.terraceConcourse - LEVELS.mainConcourse ) / 8;
		const L = ( y1 - y0 ) / Math.tan( Math.PI / 6 );
		const top = [ foot[ 0 ] + u[ 0 ] * L, foot[ 1 ] + u[ 1 ] * L ];
		const E = this.esc = buildEscalator( this.group, { foot, top, y0, y1, land: [ - 120.1, - 65.8 ] } );
		const at = ( s, t ) => [ foot[ 0 ] + u[ 0 ] * s + n[ 0 ] * t, foot[ 1 ] + u[ 1 ] * s + n[ 1 ] * t ];
		this.plaza = plazaFittings( this.group, {
			lamps: [ at( - 3, 3.6 ), at( 6, 3.6 ), at( 15, 3.6 ) ], bins: [ at( - 2.4, 3.4 ), at( 9, 3.2 ) ],
			kiosk: at( 2, 7.5 ), carts: [ at( - 6, 7 ), at( 12, 7.5 ) ],
		} );
		// the riders: standing on the steps, a hand on the rail, stepping off at the top (a troupe of their
		// own, always drawn)
		this.escCast = new Cast( { parent: this.group, max: 12 } );
		const r = rng( 140 );
		this.riders = [];
		const total = E.L + 4.4;
		for ( let i = 0; i < 7; i ++ ) {

			const L2 = dress( r, {} );
			const p = this.escCast.add( L2 );
			if ( ! p ) break;
			p.scale = sizeOf( L2, r );
			this.riders.push( { p, s: i / 7 * total - 2.2, side: ( r() - 0.5 ) * 0.5, seed: r() } );

		}

		this._escTempo = new Tempo( [ this.escCast ] );

	}

	_ride( dt ) {

		const E = this.esc;
		if ( ! E ) return;
		const sdt = this._escTempo.step( dt, this.app?.camera );
		if ( ! sdt ) return;
		const [ p0, p1, p2, p3 ] = E.path, total = E.L + 4.4;
		for ( const R of this.riders ) {

			// on the steps half a metre a second along the slope, walking on and off the flats
			const s = R.s, flat = s < 0 || s > E.L;
			R.s += sdt * ( flat ? 1.1 : 0.5 * Math.cos( Math.PI / 6 ) );
			if ( R.s > E.L + 2.2 ) R.s -= total;
			const t = Math.max( - 2.2, Math.min( E.L + 2.2, R.s ) );
			const A = t < 0 ? p0 : t < E.L ? p1 : p2, B = t < 0 ? p1 : t < E.L ? p2 : p3;
			const f = t < 0 ? ( t + 2.2 ) / 2.2 : t < E.L ? t / E.L : ( t - E.L ) / 2.2;
			const p = R.p, a = p.pose;
			p.x = A[ 0 ] + ( B[ 0 ] - A[ 0 ] ) * f + E.w[ 0 ] * R.side;
			p.y = A[ 1 ] + ( B[ 1 ] - A[ 1 ] ) * f - 0.05;
			p.z = A[ 2 ] + ( B[ 2 ] - A[ 2 ] ) * f + E.w[ 1 ] * R.side;
			p.yaw = Math.atan2( - E.u[ 0 ], - E.u[ 1 ] );
			a.walk = flat ? 1 : 0;
			if ( flat ) a.phase = ( a.phase + sdt * 1.1 / 1.15 * Math.PI * 2 ) % ( Math.PI * 2 );
			// the right hand on the rubber rail
			a.armR = flat ? [ Math.sin( a.phase ) * 0.3, 0.07, 0, 0.18 ] : [ 0.35, 0.35, 0, 0.9 ];
			a.armL = flat ? [ - Math.sin( a.phase ) * 0.3, 0.07, 0, 0.18 ] : [ 0.05, 0.06, 0, 0.12 ];
			a.headYaw = Math.sin( this._escT * 0.3 + R.seed * 9 ) * 0.5;
			p.visible = R.s > - 2.15 && R.s < E.L + 2.15;

		}

		this._escT = ( this._escT || 0 ) + sdt;
		this.escCast.update();

	}

	// is the camera up here (above the club level), and where across the concourse ( 0 at the rail over the
	// 300s, 1 at the back)
	_where( cam ) {

		if ( ! cam ) return { up: false };
		const y = cam.position.y - this.field.y0;
		return { up: y > UP, cf: this.field.toField( cam.position.x, cam.position.z ) };

	}

	update( dt, director, camera ) {

		if ( ! this.T ) return;
		const cam = camera || this.app?.camera;
		// the domes as local lights, once the app has them (as ConcourseSteel's domeLights, a third as strong:
		// they hang 4-6 m over this floor, not 7 over the main concourse's, and the floor came out white)
		if ( ! this._lit && this.app?.localLights ) {

			this._lit = true;
			const F = this.field;
			for ( const [ x, y, z ] of this.T.lamps ) {

				const w = F.toWorld( x, z );
				this.app.localLights.add( { position: new Vector3( w.x, F.y0 + y, w.z ), dir: new Vector3( 0, - 1, 0 ), color: new Color( 1.0, 0.92, 0.8 ), intensity: 16, range: 12,
					cosInner: Math.cos( 0.9 ), cosOuter: Math.cos( 1.75 ), kind: 'dome' } );

			}

		}

		const { up, cf } = this._where( cam );
		if ( up !== this.up ) {

			// ---- FW5 (C3W-1): the stands and their far fronts change places; the fabric stays
			this.up = up;
			for ( const m of this.near ) m.visible = up;
			for ( const m of this.far ) m.visible = ! up;
			this.people.show( up ? 2 : 1 );

		}

		const N = nightState( director );
		this.sounds.update( dt, N, cf, up, cf ? this._back( cf ) : 0.5 );
		this._ride( dt );
		// (---- FW5: the people are moved from below too, on the place's Tempo: asleep while none is seen)
		const sdt = this._tempo.step( dt, cam );
		if ( sdt ) {

			this.people.catchUp = this._tempo.cut;
			// (---- FW5: from below, the people drawn out to ~9 px tall: the lens's focal length decides how far)
			const reach = up || ! cam?.projectionMatrix ? Infinity : 1.75 * Math.abs( cam.projectionMatrix.elements[ 5 ] ) * 0.5 / 0.011;
			this.people.update( Math.min( sdt, 0.25 ), N, cf, reach );

		}

		this.cast.update();

	}

	// how far across the concourse the camera stands (0 at the rail, 1 at the back)
	_back( cf ) {

		const D = this.bowl.D;
		// its distance back from the path, roughly: from the field's middle
		const r = Math.hypot( cf[ 0 ], cf[ 1 ] + 40 ), r0 = Math.hypot( 0, 15 + 40 );
		const d = r - r0;
		return Math.max( 0, Math.min( 1, ( d - D.t300Back ) / ( D.t400Back - D.t300Back ) ) );

	}

}
