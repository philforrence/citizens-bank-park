import { Group, Sphere, Vector3 } from '../../engine/index.js';
import { LEVELS } from '../layout.js';
import { domeLights } from '../ConcourseSteel.js';
import { Cast } from './Cast.js';
import { Tempo } from './Tempo.js';
import { nightState } from './Concourse3BPeople.js';
import { buildTerrace } from './terrace/Build.js';
import { TerracePeople } from './terrace/People.js';
import { TerraceSounds } from './terrace/Sounds.js';

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
// Drawn only from up there (the camera above the club level): from the field level and the TV's low
// cameras none of it shows but through the slot, and then as dark as the photos have it. Field frame.
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
		// the people: in the troupe's bounds (the whole concourse: the pool culls them one by one)
		this.cast = new Cast( { parent: this.group, max: 420 } );
		this.cast.bounds = new Sphere( new Vector3( 0, LEVELS.terraceConcourse, 0 ), 140 );
		this.people = new TerracePeople( this, this.cast, this.T, this.stands );
		this._tempo = new Tempo( [ this.cast ] );
		this.sounds = new TerraceSounds( this );
		this.up = true;

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
		// the domes as local lights, once the app has them
		if ( ! this._lit && this.app?.localLights ) {

			this._lit = true;
			domeLights( this.app, this.T.lamps );

		}

		const { up, cf } = this._where( cam );
		if ( up !== this.up ) {

			this.up = up;
			for ( const m of this.meshes ) m.visible = up;
			this.people.show( up );

		}

		const N = nightState( director );
		this.sounds.update( dt, N, cf, up, cf ? this._back( cf ) : 0.5 );
		if ( ! up ) return;
		const sdt = this._tempo.step( dt, cam );
		if ( sdt ) {

			this.people.catchUp = this._tempo.cut;
			this.people.update( Math.min( sdt, 0.25 ), N, cf );

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
