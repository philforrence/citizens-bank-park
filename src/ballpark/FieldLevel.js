import { Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, Color, mergeGeometries } from '../engine/index.js';
import { standard } from '../materials/Materials.js';
import { DUGOUT_DEPTH, DUGOUT_WIDTH } from './Field.js';
import { FieldFigures, OUTFIT } from './FieldFigures.js';

// Life and gear at field level, round the edges of the game: what's in the dugouts (the helmet cubbies,
// the bat racks, the Gatorade coolers and the cups, towels and jackets on the rail, a heater against the
// cold), who's in them (the benches: Charlie Manuel and Joe Maddon at the rails, the players in their
// jackets), the TV and photographers' wells at the dugouts' ends, the on-deck circles' doughnuts and
// pine tar, the ball kids on their stools, the grounds crew and its gear, the relievers in the pens.
// Built in the field frame, in Details2008's group. update() hides the Phillies' bench when it empties
// onto the field at the last out and moves the grounds crew with the tarp.

const D = DUGOUT_DEPTH, W = DUGOUT_WIDTH;
const rnd = ( s ) => {

	const x = Math.sin( s * 12.9898 + 78.233 ) * 43758.5453;
	return x - Math.floor( x );

};

export class FieldLevel {

	constructor( { field, parent } ) {

		this.field = field;
		this.group = new Group();
		this.group.name = 'field-level';
		parent.add( this.group );
		this.figs = new FieldFigures( this.group );
		this.m = this._materials();
		this._seed = 1;
		for ( const d of field.dugouts ) {

			this._dugoutGear( d );
			this._bench( d );

		}

		this.figs.build();

	}

	// ---------------------------------------------------------------- helpers

	// the dugout's own frame: s along it from its home plate end, t back from the wall line, y up
	_frame( d ) {

		const { a, ux, uz, nx, nz } = d;
		return {
			P: ( s, t, y = 0 ) => [ a[ 0 ] + ux * s + nx * t, y, a[ 1 ] + uz * s + nz * t ],
			// a yaw that turns a model's -z toward the field ( -n ), and its +x along the dugout ( +u )
			face: Math.atan2( nx, nz ),
			along: - Math.atan2( uz, ux ),
			// does a model faced toward the field have +x running along +s?
			xAlong: ux * nz - uz * nx > 0,
		};

	}

	// a static mesh (batched by material with the rest) at p = [ x, y, z ], turned yaw, optional tilt
	_put( geo, mat, p, yaw = 0, { rx = 0, rz = 0, shadow = true, name = '' } = {} ) {

		const m = new Mesh( geo, mat );
		m.position.set( p[ 0 ], p[ 1 ], p[ 2 ] );
		m.rotation.set( rx, yaw, rz, 'YXZ' );
		m.castShadow = shadow;
		m.receiveShadow = true;
		if ( name ) m.name = name;
		this.group.add( m );
		return m;

	}

	// a box from s0..s1, t0..t1, y0..y1 in a dugout's frame
	_box( F, mat, s0, s1, t0, t1, y0, y1, name = '' ) {

		const p = F.P( ( s0 + s1 ) / 2, ( t0 + t1 ) / 2, ( y0 + y1 ) / 2 );
		return this._put( new BoxGeometry( s1 - s0, y1 - y0, t1 - t0 ), mat, p, F.along, { name } );

	}

	_materials() {

		// lit inside the dugouts by their fluorescent strips; the rest by the banks (a night lift)
		const lift = 's.emissive = s.emissive + s.albedo * mix( 0.1, 0.4, smoothstep( 0.2, 0.8, frame.night ) );';
		const mk = ( name, color, roughness, metalness = 0, extra = '', dry = true ) => {

			const m = standard( { name, color: new Color( ...color ), roughness, metalness, surface: extra + lift } );
			m.underwaterLighting = 'none';
			if ( dry ) m.setDefine( 'DRY', 1 );
			return m;

		};
		return {
			steel: mk( 'fl-steel', [ 0.07, 0.075, 0.08 ], 0.45, 0.6 ),
			cubby: mk( 'fl-cubby', [ 0.05, 0.05, 0.055 ], 0.6 ),
			helmetRed: mk( 'fl-helmet-red', [ 0.42, 0.015, 0.025 ], 0.12 ),
			helmetNavy: mk( 'fl-helmet-navy', [ 0.012, 0.02, 0.07 ], 0.12 ),
			batAsh: mk( 'fl-bat-ash', [ 0.55, 0.38, 0.22 ], 0.35 ),
			batBlack: mk( 'fl-bat-black', [ 0.02, 0.018, 0.016 ], 0.25 ),
			batCherry: mk( 'fl-bat-cherry', [ 0.22, 0.06, 0.03 ], 0.3 ),
			orange: mk( 'fl-cooler', [ 0.78, 0.22, 0.015 ], 0.35 ),
			white: mk( 'fl-white', [ 0.74, 0.73, 0.7 ], 0.5 ),
			towel: mk( 'fl-towel', [ 0.7, 0.7, 0.67 ], 0.95, 0, '', false ),
			jacketRed: mk( 'fl-jacket-red', [ 0.36, 0.015, 0.025 ], 0.6, 0, '', false ),
			jacketNavy: mk( 'fl-jacket-navy', [ 0.012, 0.02, 0.06 ], 0.6, 0, '', false ),
			grey: mk( 'fl-grey', [ 0.25, 0.25, 0.25 ], 0.6 ),
			leather: mk( 'fl-leather', [ 0.2, 0.09, 0.035 ], 0.55 ),
			black: mk( 'fl-black', [ 0.015, 0.015, 0.017 ], 0.5, 0, '', false ),
			beige: mk( 'fl-beige', [ 0.5, 0.45, 0.36 ], 0.6 ),
			green: mk( 'fl-bottle-green', [ 0.1, 0.4, 0.05 ], 0.2 ),
			// a heater's glowing grille: orange coils, hotter after dark against the cold
			heater: mk( 'fl-heater', [ 0.3, 0.05, 0.02 ], 0.5, 0, 's.emissive = vec3f( 1.0, 0.35, 0.06 ) * mix( 0.8, 2.2, smoothstep( 0.2, 0.8, frame.night ) );' ),
			paper: mk( 'fl-paper', [ 0.8, 0.8, 0.77 ], 0.9 ),
		};

	}

	// ---------------------------------------------------------------- dugouts

	// The home plate end of each dugout holds the helmet cubbies and the bat rack, the far end the
	// Gatorade coolers, the cup dispenser and the trash barrel; cups, bottles and a bag of seeds on the
	// steps, towels and a jacket over the rail, a lineup card taped up by the steps, the phone to the pen
	_dugoutGear( d ) {

		const F = this._frame( d ), M = this.m;
		const home = d.side === 'first';
		const [ r0, r1 ] = d.roof;
		const floor = - D;
		// the helmet cubbies: 12 across, 3 high, over a closed base; a helmet in most
		const c0 = r0 + 0.3, NC = 12, CW = 0.3, CH = 0.3, cy0 = - 0.52;
		const c1 = c0 + NC * CW;
		this._box( F, M.cubby, c0, c1, W - 0.42, W - 0.06, floor, cy0, 'cubby-base' );
		this._box( F, M.cubby, c0, c1, W - 0.09, W - 0.06, cy0, cy0 + 3 * CH, 'cubby-back' );
		for ( let r = 0; r <= 3; r ++ ) this._box( F, M.cubby, c0, c1, W - 0.42, W - 0.06, cy0 + r * CH - 0.012, cy0 + r * CH + 0.012 );
		for ( let c = 0; c <= NC; c ++ ) this._box( F, M.cubby, c0 + c * CW - 0.01, c0 + c * CW + 0.01, W - 0.42, W - 0.06, cy0, cy0 + 3 * CH );
		const helmet = helmetGeometry();
		for ( let r = 0; r < 3; r ++ ) for ( let c = 0; c < NC; c ++ ) {

			const k = this._seed ++;
			if ( rnd( k ) < 0.12 ) continue; // out with the hitters
			const p = F.P( c0 + ( c + 0.5 ) * CW, W - 0.24, cy0 + r * CH + 0.05 );
			this._put( helmet, home ? M.helmetRed : M.helmetNavy, p, F.face + ( rnd( k * 3 ) - 0.5 ) * 0.5, { shadow: false } );

		}

		// the bat rack: a floor trough and a slotted bar, the bats standing knob up
		const b0 = c1 + 0.1, b1 = b0 + 1.25;
		this._box( F, M.cubby, b0, b1, W - 0.4, W - 0.06, floor, floor + 0.14, 'bat-trough' );
		this._box( F, M.cubby, b0, b1, W - 0.4, W - 0.06, - 0.36, - 0.32, 'bat-bar' );
		for ( const s of [ b0, b1 - 0.04 ] ) this._box( F, M.cubby, s, s + 0.04, W - 0.4, W - 0.06, floor, - 0.32 );
		const bat = batGeometry();
		const bats = [ M.batAsh, M.batAsh, M.batBlack, M.batCherry, M.batAsh, M.batBlack ];
		for ( let row = 0; row < 2; row ++ ) for ( let i = 0; i < 10; i ++ ) {

			const k = this._seed ++;
			if ( rnd( k ) < 0.1 ) continue;
			const p = F.P( b0 + 0.08 + i * 0.115, W - 0.3 + row * 0.14, floor + 0.08 );
			this._put( bat, bats[ Math.floor( rnd( k * 7 ) * bats.length ) ], p, rnd( k * 5 ) * 6.28, { rx: ( rnd( k * 11 ) - 0.5 ) * 0.08, rz: ( rnd( k * 13 ) - 0.5 ) * 0.08, shadow: false } );

		}

		// the far end: a steel table under the two big orange coolers, cups stacked beside them, the cup
		// dispenser on the wall, the trash barrel
		const g0 = r1 - 2.25, g1 = r1 - 0.95;
		this._box( F, M.steel, g0, g1, W - 0.55, W - 0.08, - 0.47, - 0.44, 'cooler-table' );
		for ( const s of [ g0 + 0.05, g1 - 0.09 ] ) for ( const t of [ W - 0.52, W - 0.14 ] ) this._box( F, M.steel, s, s + 0.04, t, t + 0.04, floor, - 0.47 );
		const cooler = new CylinderGeometry( 0.2, 0.19, 0.48, 16 );
		const lid = new CylinderGeometry( 0.205, 0.205, 0.06, 16 );
		const spigot = new BoxGeometry( 0.05, 0.04, 0.06 );
		for ( const s of [ g0 + 0.3, g0 + 0.78 ] ) {

			this._put( cooler, M.orange, F.P( s, W - 0.3, - 0.44 + 0.24 ), 0 );
			this._put( lid, M.white, F.P( s, W - 0.3, - 0.44 + 0.51 ), 0 );
			this._put( spigot, M.white, F.P( s, W - 0.52, - 0.44 + 0.06 ), F.face, { shadow: false } );

		}

		const cup = new CylinderGeometry( 0.037, 0.028, 0.09, 8 );
		for ( let k = 0; k < 9; k ++ ) this._put( cup, M.paper, F.P( g1 - 0.2 + ( k % 3 ) * 0.02, W - 0.3, - 0.44 + 0.045 + k * 0.012 ), 0, { shadow: false } );
		const dispenser = new CylinderGeometry( 0.05, 0.05, 0.5, 10 );
		this._put( dispenser, M.white, F.P( g1 + 0.2, W - 0.12, - 0.05 ), 0 );
		const barrel = new CylinderGeometry( 0.27, 0.24, 0.76, 14 );
		this._put( barrel, M.grey, F.P( r1 - 0.45, W - 0.4, floor + 0.38 ), 0 );
		// the heater by the bench, its coils glowing orange at the players' shins
		const hp = F.P( d.bench[ 0 ] + 3.2, W - 1.1, floor + 0.25 );
		this._put( new BoxGeometry( 0.42, 0.5, 0.26 ), M.steel, hp, F.face );
		this._put( new BoxGeometry( 0.32, 0.36, 0.02 ), M.heater, F.P( d.bench[ 0 ] + 3.2, W - 0.97, floor + 0.26 ), F.face, { shadow: false } );
		// cups, bottles and a seed bag on the upper step, where they lean on the rail
		for ( let k = 0; k < 7; k ++ ) {

			const n = this._seed ++;
			const s = r0 + 1.5 + rnd( n ) * ( r1 - r0 - 3 ), t = 0.4 + rnd( n * 3 ) * 0.25;
			const down = rnd( n * 5 ) < 0.35;
			this._put( cup, M.paper, F.P( s, t, - 0.4 + ( down ? 0.035 : 0.045 ) ), rnd( n * 7 ) * 6, { rx: down ? Math.PI / 2 : 0, shadow: false } );

		}

		const bottle = new CylinderGeometry( 0.035, 0.035, 0.22, 8 );
		for ( let k = 0; k < 3; k ++ ) this._put( bottle, M.green, F.P( r0 + 3 + k * 4.7, 0.62, - 0.4 + 0.11 ), 0, { shadow: false } );
		this._put( new BoxGeometry( 0.14, 0.2, 0.04 ), M.white, F.P( r0 + 6.3, 0.5, - 0.4 + 0.02 ), F.face, { rx: - Math.PI / 2 + 0.1, shadow: false } );
		// towels and a jacket over the rail (0.95 m up at 0.55 m back)
		const flap = new BoxGeometry( 0.3, 0.34, 0.012 );
		const over = new BoxGeometry( 0.3, 0.012, 0.13 );
		const towelAt = ( s, mat, wide = 1 ) => {

			for ( const t of [ 0.48, 0.62 ] ) this._put( wide === 1 ? flap : new BoxGeometry( 0.3 * wide, 0.4, 0.02 ), mat, F.P( s, t, 0.95 - ( wide === 1 ? 0.15 : 0.18 ) ), F.face, { shadow: false } );
			this._put( wide === 1 ? over : new BoxGeometry( 0.3 * wide, 0.02, 0.15 ), mat, F.P( s, 0.55, 1.01 ), F.face, { shadow: false } );

		};
		for ( const s of [ r0 + 2.1, r0 + 7.4, r0 + 12.6 ] ) towelAt( s, M.towel );
		towelAt( r0 + 9.7, home ? M.jacketRed : M.jacketNavy, 1.9 );
		// gloves left on the step, a lineup card taped to the partition by the steps, the phone to the pen
		const glove = new SphereGeometry( 0.12, 8, 5 );
		glove.scale( 1, 0.45, 0.8 );
		for ( const s of [ r0 + 4.2, r0 + 11.1 ] ) this._put( glove, M.leather, F.P( s, 0.6, - 0.4 + 0.05 ), rnd( s ) * 6, { shadow: false } );
		this._box( F, M.paper, r0 + 0.001, r0 + 0.008, 1.5, 1.75, 0.1, 0.42, 'lineup-card' );
		this._box( F, M.beige, r1 - 0.09, r1, 1.9, 2.05, 0.0, 0.24, 'pen-phone' );

	}

	// The benches. The Phillies (first base): Charlie Manuel at the rail by the steps with his pitching
	// coach Rich Dubee, a few at the rail leaning on their forearms, the rest on the bench in their red
	// jackets (a couple in uniform, the next hitters), the bat boy by the bat rack. The Rays the same in
	// navy and grey, Joe Maddon in his glasses at the rail.
	_bench( d ) {

		const F = this._frame( d );
		const home = d.side === 'first';
		const group = home ? 'phiBench' : 'rayBench';
		const [ r0, r1 ] = d.roof, [ b0, b1 ] = d.bench;
		const jacket = home ? OUTFIT.phiJacket : OUTFIT.rayJacket, uniform = home ? OUTFIT.phiUniform : OUTFIT.rayUniform;
		const coach = home ? OUTFIT.coachPhi : OUTFIT.coachRay;
		const add = ( pose, s, t, y, outfit, extra = {} ) => {

			const [ x, , z ] = F.P( s, t );
			return this.figs.add( pose, { x, y, z, yaw: F.face + ( extra.turn || 0 ), outfit, group, scale: extra.scale || 0.97 + rnd( this._seed ++ ) * 0.08 } );

		};

		// at the rail on the upper step (the rail 0.95 m up, the step 0.4 m down)
		add( 'rail', r0 + 1.1, 0.66, - 0.4, coach, { scale: home ? 1.07 : 1.0, turn: home ? - 0.25 : 0.25 } );
		add( 'pockets', r0 + 1.8, 0.64, - 0.4, coach, { turn: 0.1 } );
		const railAt = home ? [ 4.3, 5.0, 8.9, 12.2 ] : [ 3.8, 7.6, 8.3, 11.6 ];
		railAt.forEach( ( s, i ) => add( 'lean', r0 + s, 0.66, - 0.4, i === 2 ? uniform : jacket, { turn: ( rnd( s ) - 0.5 ) * 0.4 } ) );
		// on the bench
		const poses = [ 'sit', 'sitFwd', 'sitFold', 'sitFwd', 'sit', 'sitFold', 'sitFwd', 'sit' ];
		const n = 8;
		for ( let i = 0; i < n; i ++ ) {

			const k = this._seed ++;
			const s = b0 + 0.45 + ( b1 - b0 - 0.9 ) * ( i + 0.5 * rnd( k ) ) / n;
			add( poses[ i ], s, W - 0.36, - D, i === 3 ? uniform : jacket, { turn: ( rnd( k * 3 ) - 0.5 ) * 0.3 } );

		}

		// standing by the coolers, and the bat boy in his helmet by the rack
		add( 'pockets', r1 - 1.7, W - 1.1, - D, jacket, { turn: 0.8 } );
		add( 'stand', r1 - 1.0, W - 1.25, - D, uniform, { turn: - 0.6 } );
		if ( home ) add( 'stand', r0 + 4.6, 1.5, - D, OUTFIT.batBoy, { scale: 0.9, turn: 0.2 } );

	}

	// ---------------------------------------------------------------- per frame

	update( dt, director ) {

		const seg = director ? director.segmentAt( director.t ) : null;
		// the Phillies' bench (and pen) run out to the pile at the last out; both teams went in to the
		// clubhouses in the rain delay
		const cel = seg?.kind === 'celebrate';
		// ---- R (rituals): in the clubhouses only through the 27th's part of the suspension
		const susp = seg?.kind === 'switch' && seg.snap?.inning === 6 && seg.snap?.half === 'bottom' && ( director.night ? director.night( director.t ).delay : true );
		// ---- end R
		this.figs.setGroup( 'phiBench', ! cel && ! susp );
		this.figs.setGroup( 'rayBench', ! susp );
		this.figs.update();

	}

}

// ---------------------------------------------------------------- geometry

// a batting helmet: the shell, the bill, one ear flap; origin at the rim's centre, the bill toward -z
let _helmet = null;
function helmetGeometry() {

	if ( _helmet ) return _helmet;
	const shell = new SphereGeometry( 0.12, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.58 );
	shell.scale( 1, 0.95, 1.12 );
	shell.translate( 0, 0.03, 0 );
	const bill = new BoxGeometry( 0.19, 0.012, 0.07 );
	bill.rotateX( 0.18 );
	bill.translate( 0, 0.03, - 0.155 );
	const flap = new BoxGeometry( 0.018, 0.1, 0.12 );
	flap.translate( 0.118, - 0.01, 0.02 );
	_helmet = mergeGeometries( [ shell, bill, flap ] );
	return _helmet;

}

// a bat standing barrel down: 34 in, the barrel 2.5 in, the handle 1 in, a knob on top; origin at its
// barrel end
let _bat = null;
function batGeometry() {

	if ( _bat ) return _bat;
	const body = new CylinderGeometry( 0.012, 0.032, 0.86, 8 );
	body.translate( 0, 0.43, 0 );
	const knob = new CylinderGeometry( 0.02, 0.02, 0.014, 8 );
	knob.translate( 0, 0.865, 0 );
	_bat = mergeGeometries( [ body, knob ] );
	return _bat;

}

