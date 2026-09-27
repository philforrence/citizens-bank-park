import { Vector3, Sphere } from '../engine/index.js';

// Build and draw only part of the park, for work on one area (a shot of the dugouts shouldn't pay for
// 45,000 fans and the skyline):
//
//   ?only=field,players      just these parts (the names below); the rest isn't built, or, where
//                            another part needs it (the bowl: the seats, the light towers, the
//                            elevators), is built but not drawn
//   ?focus=x,z,r             only what reaches within r metres of the field point (x, z) (home plate is
//                            the origin, -z is toward center field): the pieces wholly outside are
//                            dropped before the static batching, so they're never merged, compiled or
//                            drawn
//
// The sky, the ground round the park and the lighting are always there. The game's timeline runs
// whatever the scope (it sets the weather, the tarp and the boards), with the players drawn only when
// 'players' is in it.
export const PARTS = {
	field: 'the grass, dirt, walls, dugouts and pens (Field.js)',
	bowl: 'the stands, decks, suites, booths, light towers and netting (Bowl.js, Stands.js)',
	crowd: 'the fans in the seats (Crowd.js)',
	exterior: 'the facade, plaza, gates and frontages (Exterior.js, Frontages.js)',
	surroundings: 'the streets, lots and skyline round the park (Surroundings.js)',
	complex: 'the sports complex: the Linc, the Wachovia Center, the Spectrum (Complex.js)',
	landmarks: 'the Liberty Bell, Phanavision, the scoreboards, Ashburn Alley, the flags (Landmarks.js)',
	details: 'the 2008 field-level details: the tarp, the dugouts\' contents, signage (Details2008.js)',
	fascia: 'the ribbon boards on the fascia (Fascia.js)',
	concourse: 'the concourse stands and kitchens (Concourse.js)',
	people: 'the staff, vendors, ushers and people walking about (People.js)',
	players: 'the players, umpires and the ball (game/Players.js, game/Ball.js)',
};

export class Scope {

	// places: the little worlds' names (places/index.js), parts too
	constructor( qs, places = [] ) {

		const only = qs.get( 'only' );
		this.only = only ? new Set( only.split( ',' ).map( ( s ) => s.trim() ).filter( Boolean ) ) : null;
		const names = [ ...Object.keys( PARTS ), ...places ];
		if ( this.only ) for ( const p of this.only ) if ( ! names.includes( p ) ) console.warn( `?only: no part "${ p }" (parts: ${ names.join( ', ' ) })` );
		// a place may use any part of the park (it stands on it, adds people to it): with one in scope
		// everything is built (the build is quick), and only what's named is drawn
		this.placeInScope = !! this.only && places.some( ( p ) => this.only.has( p ) );
		const f = ( qs.get( 'focus' ) || '' ).split( ',' ).map( Number );
		this.focus = f.length === 3 && f.every( Number.isFinite ) ? { x: f[ 0 ], z: f[ 1 ], r: f[ 2 ] } : null;
		this.full = ! this.only && ! this.focus;

	}

	// is this part drawn?
	has( part ) {

		return ! this.only || this.only.has( part );

	}

	// is it built (drawn, or needed by a part that is)? The bowl is always built: everything stands on it
	builds( part ) {

		if ( this.has( part ) || this.placeInScope ) return true;
		// the people stand at the concourse's stands and the Alley's, and queue at the gates
		const needs = { concourse: [ 'people' ], landmarks: [ 'people' ], exterior: [ 'people' ] };
		return ( needs[ part ] || [] ).some( ( p ) => this.has( p ) );

	}

	// Take out what isn't drawn, then what's outside the focus. Before the static batching (which merges
	// every part's little meshes by material, so a part can't be hidden after it) and before the players
	// and the ball are added (they go anywhere on the field). `parts`: name -> objects; returns what was
	// removed.
	apply( root, parts, toField ) {

		const out = { parts: [], focus: 0 };
		for ( const [ name, objs ] of Object.entries( parts ) ) {

			if ( this.has( name ) ) continue;
			for ( const o of objs ) if ( o && o.parent ) o.parent.remove( o );
			out.parts.push( name );

		}

		if ( this.focus ) out.focus = this._focus( root, parts, toField );
		return out;

	}

	_focus( root, parts, toField ) {

		const { x, z, r } = this.focus;
		const s = new Sphere(), c = new Vector3();
		const outside = ( o ) => {

			// the world bounding sphere, in the field frame (a turn about the vertical at home plate)
			if ( o.isInstancedMesh || o.boundingSphere ) {

				if ( ! o.boundingSphere ) o.computeBoundingSphere();
				s.copy( o.boundingSphere );

			} else {

				const g = o.geometry;
				if ( ! g ) return false;
				if ( ! g.boundingSphere ) g.computeBoundingSphere();
				s.copy( g.boundingSphere );

			}

			s.applyMatrix4( o.matrixWorld );
			c.copy( s.center );
			const [ fx, fz ] = toField( c.x, c.z );
			return Math.hypot( fx - x, fz - z ) - s.radius > r;

		};

		root.updateMatrixWorld( true );
		const drop = [];
		root.traverse( ( o ) => {

			if ( o.isMesh && outside( o ) ) drop.push( o );

		} );
		for ( const o of drop ) o.parent.remove( o );
		return drop.length;

	}

}
