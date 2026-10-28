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
import BehindHome from './BehindHome.js';
import LeftField from './LeftField.js'; // ---- H
import Soundscape from './Soundscape.js'; // ---- S: the park's whole soundscape (draws nothing)
import Rituals from './Rituals.js';
import Suites from './Suites.js'; // ---- FI2: the insides (gauntlet CI-5, CI-6, CI-14)
import Club from './Club.js'; // ---- FI2
import Under from './Under.js'; // ---- FI2
import Entrance from './Entrance.js'; // ---- FI2 (CI-17)
import Terrace from './Terrace.js'; // ---- FW3 (C2W-7): the Terrace concourse
import Clubhouse from './inside/Clubhouse.js'; // ---- FI3 (C2I-3): the Majestic Clubhouse Store's inside

export const PLACES = [
	[ 'rail', FieldRail ],
	[ 'alley', AshburnAlley2008 ],
	[ 'clubhouse', Clubhouse ], // ---- FI3 (before gate3b: it takes a tree's spot out of the store's block)
	[ 'gate3b', ThirdBaseGate ],
	[ 'concourse3b', Concourse3B ],
	[ 'phanatic', Phanatic ],
	[ 'concourse1b', Concourse1B ],
	[ 'home', BehindHome ],
	[ 'leftfield', LeftField ], // ---- H
	[ 'sound', Soundscape ], // ---- S
	[ 'rituals', Rituals ],
	[ 'suites', Suites ], // ---- FI2
	[ 'club', Club ], // ---- FI2
	[ 'under', Under ], // ---- FI2
	[ 'entrance', Entrance ], // ---- FI2
	[ 'terrace', Terrace ], // ---- FW3
];
