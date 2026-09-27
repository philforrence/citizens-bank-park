// The little worlds: a place in the park built out in depth (its own props, people and goings-on). Each
// is a module under places/ whose default export is a class:
//
//   constructor( { app, field, bowl, people, colliders, scope } )   builds, after the rest of the park
//                                          (so it can use any part); puts what it draws in this.group
//                                          (added to field.group: the field frame)
//   update( dt, director, camera )         every frame (optional)
//
// and is listed here as [ name, class ] (imported above). The name is also its part for ?only=
// (Scope.js): with a place in ?only= the whole park is built (it may use any part) and only the parts
// named are drawn, e.g. ?only=gate,exterior,people.
import FieldRail from './FieldRail.js';
import AshburnAlley2008 from './AshburnAlley2008.js';
import ThirdBaseGate from './ThirdBaseGate.js';
import Concourse3B from './Concourse3B.js';
import Phanatic from './Phanatic.js';
import Concourse1B from './Concourse1B.js';

export const PLACES = [
	[ 'rail', FieldRail ],
	[ 'alley', AshburnAlley2008 ],
	[ 'gate3b', ThirdBaseGate ],
	[ 'concourse3b', Concourse3B ],
	[ 'phanatic', Phanatic ],
	[ 'concourse1b', Concourse1B ],
];
