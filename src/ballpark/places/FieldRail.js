import { Group } from '../../engine/index.js';

// The rail: field level round home plate and the dugouts, the strip every TV shot sees. The backstop,
// the camera wells, the front rows and the dugout surrounds, the on-deck circles and foul territory down
// to the bags, on the two nights of Game 5 (the 27th in the cold, driving rain, the 29th cold and dry).
// Built in the field frame (field.group), after the rest of the park; update() ties it to the replay.
export default class FieldRail {

	constructor( { app, field, bowl, people, colliders, scope } ) {

		this.app = app;
		this.field = field;
		this.group = new Group();
		this.group.name = 'rail';
		field.group.add( this.group );

	}

	update( dt, director, camera ) {

	}

}
