import { Group } from '../../engine/index.js';
import { buildCushions } from './rail/Backstop.js';
import { buildPlate } from './rail/Plate.js';
import { RailFigures } from './rail/RailFigures.js';
import { railMaterials } from './rail/Props.js';
import { Wells } from './rail/Wells.js';
import { OnDeck } from './rail/OnDeck.js';
import { BallGirls } from './rail/BallGirls.js';
import { buildTarpTube } from './rail/Tarp.js';
import { Crew } from './rail/Crew.js';
import { Police } from './rail/Police.js';
import { buildWalls } from './rail/Walls.js';
import { Drips } from './rail/Drips.js';

// The rail: field level round home plate and the dugouts, the strip every TV shot sees. The backstop,
// the camera wells, the front rows and the dugout surrounds, the on-deck circles and foul territory down
// to the bags, on the two nights of Game 5 (the 27th in the cold, driving rain, the 29th cold and dry).
// Built in the field frame (field.group), after the rest of the park; update() ties it to the replay.
//
//   rail/Backstop.js     the backstop's teal cushions
//   rail/Plate.js        home plate, worn, dirtier through each half inning
//   rail/Wells.js        the camera wells: FOX's cameras, the parabolic mics, the photographers
//   rail/RailFigures.js  the people (posed figures with a second pose to move toward, their gear)
//   rail/Props.js        the small static things and their materials
export default class FieldRail {

	constructor( { app, field, bowl, people, colliders, scope } ) {

		this.app = app;
		this.field = field;
		this.group = new Group();
		this.group.name = 'rail';
		field.group.add( this.group );
		this.M = railMaterials();
		this.figs = new RailFigures( this.group );
		const ctx = { group: this.group, figs: this.figs, field, bowl, people, M: this.M };
		// the backstop's teal cushions, one pad at a time
		buildCushions( this.group );
		// home plate, worn, and the dirt that builds on it through each half inning
		this.plate = buildPlate( this.group );
		// the wells at the dugouts' ends: TV cameras, the parabolic mics, the photographers
		this.wells = new Wells( ctx );
		// the on-deck mats and the hitters' things on them, the bat boys
		this.onDeck = new OnDeck( ctx );
		// the ball girls down the lines, and the kids waiting on the rail for a ball
		this.ballGirls = new BallGirls( ctx );
		// the tarp's tube down the third base side (into Details2008's roll, which the pull shows and hides)
		buildTarpTube( app?.details?.tarpRoll || this.group, this.group, this.M );
		// the grounds crew waiting by it in the rain
		this.crew = new Crew( ctx );
		// event staff on the track, and the police who line it in the 9th on the 29th
		this.police = new Police( ctx );
		// the Series' panels on the walls past the wells, the backstop net's cables
		this.walls = buildWalls( this.group, this.M );
		// the dugouts in the rain: water on their roofs, drips off their front edges
		this.drips = new Drips( ctx );
		this.figs.build();
		this.state = {};

	}

	// Where the night is: which night, how hard it's raining, how far into it, the half inning's start
	_night( d ) {

		const S = this.state;
		if ( ! this._halves ) {

			// the replay's landmarks: every half inning's start, the suspension, the last out
			this._halves = d.segments.filter( ( s ) => s.kind === 'switch' || s.kind === 'intro' ).map( ( s ) => s.t0 );
			this._susp = d.segments.find( ( s ) => s.kind === 'switch' && s.snap.inning === 6 && s.snap.half === 'bottom' );
			this._end = d.segments.find( ( s ) => s.kind === 'celebrate' ) || d.segments[ d.segments.length - 1 ];

		}

		const t = d.t;
		const seg = d.segmentAt( t );
		const { inning = 1, half = 'top' } = seg.snap || {};
		S.t = t;
		S.seg = seg;
		S.lt = t - seg.t0;
		S.snap = seg.snap || {};
		S.inning = inning;
		S.half = half;
		S.susp = seg === this._susp;
		// the 27th: the top of the 1st to the top of the 6th; its rain growing to a downpour
		S.first = t < this._susp.t0;
		const k = S.first ? Math.min( 1, ( ( inning - 1 ) * 2 + ( half === 'top' ? 0 : 1 ) ) / 10 ) : 0;
		S.rain = S.first ? 0.3 + 0.7 * k : 0;
		S.wet = S.first ? 0.35 + 0.65 * k : 0.12;
		S.celebrate = seg.kind === 'celebrate';
		// the half inning's start
		let h0 = 0;
		for ( const h of this._halves ) if ( h <= t ) h0 = h;
		S.halfStart = h0;
		// how far through the night's game (0..1): the 27th to the suspension, the 29th to the last out
		S.progress = S.first ? t / this._susp.t0 : Math.min( 1, ( t - this._susp.t0 - this._susp.dur ) / Math.max( 1, this._end.t0 - this._susp.t0 - this._susp.dur ) );
		S.ball = d.ballAt || null;
		return S;

	}

	update( dt, director, camera ) {

		if ( ! director ) return;
		dt = Math.min( dt, 0.25 );
		const S = this._night( director );
		// the chalk round the plate: fresh at first pitch, rubbed out by the 6th in the rain; chalked
		// again for the resumption on the 29th, worn less in the dry
		const wear = S.first ? Math.pow( S.progress, 0.8 ) : 0.7 * Math.max( 0, S.progress );
		this.field.surfaceMaterial.uniforms.chalkWear.value = wear;
		// the plate: dirtier through the half inning (muddier in the rain), brushed at the change
		const since = Math.max( 0, S.t - S.halfStart - 20 );
		this.plate.uniforms.dirt.value = ( 1 - Math.exp( - since / ( S.first ? 90 : 200 ) ) ) * ( S.first ? 1 : 0.7 );
		// the logos painted in the grass: the rain washes them out through the 27th; by the 29th they're
		// pale, grey-green
		const fade = S.first ? 0.05 + 0.3 * S.progress : 0.5;
		for ( const m of this.app?.details?.paintMats || [] ) m.uniforms.fade.value = fade;
		this.wells.update( S, dt );
		this.onDeck.update( S, dt, director );
		this.ballGirls.update( S, dt, director );
		this.crew.update( S, dt );
		this.police.update( S, dt, director );
		this.drips.update( S );
		// the panel past the visitors' well: State Farm on the 27th, drugfree.org on the 29th
		this.walls.swap[ 0 ].visible = ! S.first;
		this.walls.swap[ 1 ].visible = S.first;
		this.figs.update();

	}

}
