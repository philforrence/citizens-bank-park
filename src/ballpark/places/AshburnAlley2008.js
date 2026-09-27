import { Group } from '../../engine/index.js';
import { when } from './alley/Night.js';

// Ashburn Alley and the bullpens on the World Series nights, October 27 and 29, 2008: the park's living
// room. The promenade behind center field (its bricks and the All-Star Walk in them, the Wall of Fame,
// the rail over the pens and the fans on it), the street fair along it (Bull's BBQ and its smoke, Greg
// Luzinski signing, the stands and their lines, the giant pinball machine, the ATM, the carts), the
// rooftop bleachers, and down in the pens the relievers getting loose, both nights, in step with the
// replay. The buildings, the clock and the flags are Landmarks.js's; the pens' structure is Field.js's.
// Field frame (x, z metres from the back of home plate, -z toward center field, y up from the field;
// the Alley is at street level, LEVELS.mainConcourse).

export default class AshburnAlley2008 {

	constructor( { app, field, bowl, people, colliders, scope } ) {

		this.app = app;
		this.field = field;
		this.bowl = bowl;
		this.people = people;
		this.colliders = colliders;
		this.scope = scope;
		this.group = new Group();
		this.group.name = 'ashburn-alley-2008';

	}

	update( dt, director ) {

		if ( ! director ) return;
		const w = when( director );
		// the clock over center field keeps the replay's time
		this.app.landmarks?.setClock?.( w.clock );

	}

}
