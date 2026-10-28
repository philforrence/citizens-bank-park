import { Mesh, Group, BufferGeometry, Float32BufferAttribute, BoxGeometry, CylinderGeometry, SphereGeometry, Color, mergeGeometries } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { STAGE, CEL, MVP } from '../../game/Celebration.js';

// The trophy presentation's stage on the infield (Getty 83570999: a black-skirted platform about a metre
// up, black pipe rails round its sides and back, the Commissioner's Trophy on a clear pedestal at one front
// corner, FOX's microphone; ronniebruce 2988348008: its stairs at the side, the steel crowd barriers
// round it, the MVP's red Camaro beside it on the clay; anthonydefrancesco 2986359720: it went up on the
// first base side of second, brought out on the grounds crew's Gators). It goes up in pieces after the
// pile (the deck modules, the skirt, the rails, the stairs, the barriers, the car driven in), all as a
// function of the time since the last out (STAGE's plan in game/Celebration.js), and the trophy follows
// whoever holds it (the place gives its position).
//
// The trophy (the Commissioner's Trophy, Tiffany, 1999-): thirty gold-plated pennants, one for each club,
// round a silver baseball with its gold latitude and longitude lines, on a tiered base; about 24 in
// high.

// a group's meshes merged by material into one each (its pieces don't move apart): a few draws, not dozens
function bake( group ) {

	const by = new Map();
	group.updateMatrixWorld( true );
	for ( const o of [ ...group.children ] ) {

		if ( ! o.isMesh || ! o.geometry?.attributes?.position ) continue;
		o.updateMatrix();
		const g = o.geometry.clone();
		g.applyMatrix4( o.matrix );
		for ( const k of Object.keys( g.attributes ) ) if ( k !== 'position' && k !== 'normal' && k !== 'uv' ) g.deleteAttribute( k );
		if ( ! g.attributes.uv ) g.setAttribute( 'uv', new Float32BufferAttribute( new Float32Array( g.attributes.position.count * 2 ), 2 ) );
		( by.get( o.material ) || by.set( o.material, [] ).get( o.material ) ).push( g.index ? g : g );
		group.remove( o );

	}

	for ( const [ m, gs ] of by ) {

		const merged = mergeGeometries( gs );
		if ( ! merged ) {

			console.warn( 'stage: a group would not merge', m.name );
			continue;

		}

		const mesh = new Mesh( merged, m );
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		group.add( mesh );

	}

	return group;

}

const hash = ( n ) => {

	const s = Math.sin( n * 12.9898 ) * 43758.5453;
	return s - Math.floor( s );

};
const ease = ( x ) => {

	const t = Math.min( 1, Math.max( 0, x ) );
	return t * t * ( 3 - 2 * t );

};

export class Stage {

	constructor( group ) {

		this.root = new Group();
		this.root.name = 'stage';
		group.add( this.root );
		const lift = 's.emissive = s.emissive + s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.25;';
		const mk = ( name, color, roughness, metalness = 0, surface = '' ) => {

			const m = standard( { name, color: new Color( ...color ), roughness, metalness, surface: surface + lift } );
			m.underwaterLighting = 'none';
			return m;

		};
		this.M = {
			skirt: mk( 'stage-skirt', [ 0.012, 0.012, 0.014 ], 0.9 ),
			deck: mk( 'stage-deck', [ 0.05, 0.05, 0.055 ], 0.85, 0, 's.albedo = mat.color * ( 0.85 + 0.25 * mx_noise_float2( in.P.xz * 6.0 ) );' ),
			rail: mk( 'stage-rail', [ 0.02, 0.02, 0.022 ], 0.4, 0.6 ),
			steel: mk( 'stage-barrier', [ 0.45, 0.46, 0.47 ], 0.35, 0.85 ),
			acrylic: mk( 'stage-pedestal', [ 0.5, 0.52, 0.55 ], 0.05, 0.0 ),
		};
		// ---- FR2: the trophy's pedestal is clear acrylic (Getty 83570999: the rail and the men behind seen
		// through it, its edges catching the lights), not a grey block
		this.M.acrylic = standard( { name: 'stage-pedestal', color: new Color( 0.78, 0.82, 0.85 ), roughness: 0.04, transparent: true, depthWrite: false, side: 'double',
			surface: /* wgsl */`
	let e = max( abs( in.uv.x - 0.5 ), abs( in.uv.y - 0.5 ) ) * 2.0;
	let rim = smoothstep( 0.88, 0.985, e );
	let fres = pow( 1.0 - abs( dot( in.N, in.V ) ), 3.0 );
	s.alpha = 0.06 + 0.5 * rim + 0.3 * fres;
	s.emissive = s.albedo * ( rim * 0.5 + fres * 0.2 ) * smoothstep( 0.2, 0.8, frame.night ) * 0.4;
` } );
		this.M.acrylic.underwaterLighting = 'none';
		// ---- end FR2
		const S = STAGE;
		this.parts = [];
		// the deck: four modules (2 x 1.6 m) set down side by side on their legs, the skirt round them
		const W = 6.4, D = 3.2, H = 0.95;
		this.dims = { W, D, H };
		for ( let k = 0; k < 4; k ++ ) {

			const m = new Group();
			const x = - W / 2 + 0.8 + k * 1.6;
			const deck = new Mesh( new BoxGeometry( 1.58, 0.08, D ), this.M.deck );
			deck.position.set( x, H - 0.04, 0 );
			m.add( deck );
			const skirt = new Mesh( new BoxGeometry( 1.6, H - 0.08, D - 0.02 ), this.M.skirt );
			skirt.position.set( x, ( H - 0.08 ) / 2, 0 );
			m.add( skirt );
			// (---- FR2: carried in from the crew's Gators behind it by four men, lifted off the grass a
			// hand's breadth, walking: c, its centre in the stage's frame, and where each man holds it)
			this.parts.push( { obj: m, t: CEL.stageBuild[ 0 ] + k * 6, from: [ 0, 0, - 14 ], dur: 6, lift: 0.1, c: [ x, 0 ], carry: [ [ - 0.45, 1.85 ], [ 0.45, 1.85 ], [ - 0.45, - 1.85 ], [ 0.45, - 1.85 ] ] } );

		}

		// the rails: the back and both sides, black pipe, 1 m over the deck, with their uprights
		const rail = new Group();
		const bar = ( x0, z0, x1, z1 ) => {

			const l = Math.hypot( x1 - x0, z1 - z0 );
			for ( const y of [ 0.5, 1.02 ] ) {

				const b = new Mesh( new CylinderGeometry( 0.024, 0.024, l, 8 ), this.M.rail );
				b.rotation.z = Math.PI / 2;
				b.rotation.y = - Math.atan2( z1 - z0, x1 - x0 );
				b.position.set( ( x0 + x1 ) / 2, H + y, ( z0 + z1 ) / 2 );
				rail.add( b );

			}

			for ( let k = 0; k <= Math.round( l / 1.6 ); k ++ ) {

				const f = k / Math.round( l / 1.6 );
				const u = new Mesh( new CylinderGeometry( 0.026, 0.026, 1.04, 8 ), this.M.rail );
				u.position.set( x0 + ( x1 - x0 ) * f, H + 0.52, z0 + ( z1 - z0 ) * f );
				rail.add( u );

			}

		};
		bar( - W / 2, - D / 2, W / 2, - D / 2 );
		bar( - W / 2, - D / 2, - W / 2, D / 2 - 1.3 );
		bar( W / 2, - D / 2, W / 2, D / 2 - 0.4 );
		this.parts.push( { obj: rail, t: CEL.stageBuild[ 0 ] + 26, from: [ 0, 1.2, 0 ] } );
		// the stairs at the left-hand end as you face it, by the trophy's pedestal, with a handrail each side
		// (FR1: ronniebruce 2988347232, Getty 83570999; STAGE.stairs: they were at the right-hand end, by
		// the car)
		const stairs = new Group();
		const sx = - ( W / 2 + 0.5 );
		for ( let k = 0; k < 4; k ++ ) {

			const st = new Mesh( new BoxGeometry( 1.0, 0.04, 0.3 ), this.M.deck );
			st.position.set( sx, ( k + 1 ) * H / 5, D / 2 - 0.35 - k * 0.3 );
			stairs.add( st );
			const riser = new Mesh( new BoxGeometry( 1.0, ( k + 1 ) * H / 5, 0.3 ), this.M.skirt );
			riser.position.set( sx, ( k + 1 ) * H / 10, D / 2 - 0.35 - k * 0.3 );
			stairs.add( riser );

		}

		for ( const hx of [ sx - 0.5, sx + 0.42 ] ) {

			const hr = new Mesh( new CylinderGeometry( 0.022, 0.022, 1.6, 8 ), this.M.rail );
			hr.rotation.x = 0.62;
			hr.position.set( hx, H * 0.6 + 0.9, D / 2 - 0.8 );
			stairs.add( hr );
			for ( const [ z, h ] of [ [ D / 2 - 0.2, 0.95 ], [ D / 2 - 1.3, 1.0 + H * 0.8 ] ] ) {

				const post = new Mesh( new CylinderGeometry( 0.022, 0.022, h, 8 ), this.M.rail );
				post.position.set( hx, h / 2, z );
				stairs.add( post );

			}

		}

		this.parts.push( { obj: stairs, t: CEL.stageBuild[ 0 ] + 30, from: [ - 3, 0, 0 ], dur: 4, lift: 0.06, c: [ sx, D / 2 - 0.8 ], carry: [ [ 0, 0.85 ], [ 0, - 0.85 ] ] } ); // ---- FR2: c, carry
		// the pedestal: a clear box at the front left corner, the trophy on it
		const ped = new Mesh( new BoxGeometry( 0.55, 0.95, 0.55 ), this.M.acrylic );
		ped.position.set( - W / 2 + 0.7, H + 0.475, D / 2 - 0.6 );
		this.parts.push( { obj: ped, t: CEL.stageBuild[ 0 ] + 34, from: [ 0, 0, 2 ] } );
		this.pedTop = [ - W / 2 + 0.7, H + 0.95, D / 2 - 0.6 ];
		// the crowd barriers: a pen round the stage's front and the car, galvanized steel, set by the event staff
		const pen = new Group();
		const barrier = ( x, z, yaw ) => {

			const g = new Group();
			for ( const y of [ 0.12, 1.05 ] ) {

				const b = new Mesh( new CylinderGeometry( 0.02, 0.02, 2.2, 6 ), this.M.steel );
				b.rotation.z = Math.PI / 2;
				b.position.set( 0, y, 0 );
				g.add( b );

			}

			for ( let k = 0; k < 12; k ++ ) {

				const b = new Mesh( new CylinderGeometry( 0.008, 0.008, 0.93, 4 ), this.M.steel );
				b.position.set( - 1.0 + k * 0.18, 0.585, 0 );
				g.add( b );

			}

			for ( const sx of [ - 1.05, 1.05 ] ) {

				const f = new Mesh( new BoxGeometry( 0.04, 0.03, 0.6 ), this.M.steel );
				f.position.set( sx, 0.015, 0 );
				g.add( f );

			}

			g.position.set( x, 0, z );
			g.rotation.y = yaw;
			pen.add( g );

		};
		for ( let k = 0; k < 7; k ++ ) barrier( - W / 2 - 3 + k * 2.25, D / 2 + 4.5, 0 );
		for ( let k = 0; k < 3; k ++ ) barrier( - W / 2 - 4.1, D / 2 + 3.4 - k * 2.25, Math.PI / 2 );
		for ( let k = 0; k < 4; k ++ ) barrier( W / 2 + 7.6, D / 2 + 3.4 - k * 2.25, Math.PI / 2 );
		this.parts.push( { obj: pen, t: CEL.stageBuild[ 0 ] + 38, from: [ 0, 0, 3 ] } );
		for ( const p of this.parts ) {

			bake( p.obj.isMesh ? wrap( p ) : p.obj );
			p.obj.visible = false;
			p.home = p.obj.position.clone();
			this.root.add( p.obj );

		}

		// once it's all up: the whole stage as one mesh per material (the pieces only while they're set
		// down); only the deck and its skirt throw shadows
		{

			const whole = new Group();
			for ( const p of this.parts ) for ( const m of p.obj.children ) {

				const c = new Mesh( m.geometry, m.material );
				c.position.copy( p.obj.position );
				whole.add( c );
				if ( m.material !== this.M.deck && m.material !== this.M.skirt ) m.castShadow = false;

			}

			bake( whole );
			for ( const m of whole.children ) m.castShadow = m.material === this.M.deck || m.material === this.M.skirt;
			whole.visible = false;
			this.root.add( whole );
			this.whole = whole;
			this.built = Math.max( ...this.parts.map( ( p ) => p.t + ( p.dur || 4 ) ) ) + 0.5; // ---- FR2: each its own time

		}

		// the stage itself sits at STAGE.at, facing STAGE.yaw
		this.root.position.set( S.at[ 0 ], 0, S.at[ 1 ] );
		this.root.rotation.y = S.yaw;
		this.root.visible = false;
		this.root.userData.dynamic = true;
		// the trophy and the car
		this.trophy = trophy();
		this.trophy.visible = false;
		group.add( this.trophy );
		this.car = camaro();
		this.car.visible = false;
		group.add( this.car );
		// ---- FR1: the MVP trophy (on the car's hood until Selig takes it up)
		this.mvp = mvpTrophy();
		this.mvp.visible = false;
		group.add( this.mvp );
		// ---- end FR1

	}

	// cel: seconds since the last out; hold: where the trophy is ({ x, y, z, yaw } in the field frame) when
	// someone has it, else it's on the pedestal
	update( cel, hold, mvp = null ) {

		const on = cel != null && cel > CEL.stageBuild[ 0 ] - 1;
		this.root.visible = on;
		this.car.visible = on && cel > CEL.carIn[ 0 ];
		this.trophy.visible = on && cel > CEL.trophyOut;
		// ---- FR1: the MVP trophy: on the hood once the car's parked, then in Selig's hands, then Hamels's
		this.mvp.visible = on && cel > CEL.carIn[ 1 ];
		if ( this.mvp.visible ) {

			const at = mvp || { x: MVP.hood[ 0 ], y: MVP.hood[ 1 ], z: MVP.hood[ 2 ], yaw: STAGE.carYaw };
			this.mvp.position.set( at.x, at.y, at.z );
			this.mvp.rotation.y = at.yaw;

		}
		// ---- end FR1
		if ( ! on ) return;
		// each piece carried in over its last few metres and set down; then all of it as one
		const done = cel > this.built;
		this.whole.visible = done;
		for ( const p of this.parts ) {

			// (---- FR2: the carried ones at a walk, held up off the grass, set down at the end: Throng.js
			// has the men carrying them)
			const k = pieceK( p, cel ), up = ( p.lift || 0 ) * Math.sin( Math.PI * Math.min( 1, k * 1.15 ) );
			p.obj.visible = cel > p.t && ! done;
			p.obj.position.set( p.home.x + p.from[ 0 ] * ( 1 - k ), p.home.y + p.from[ 1 ] * ( 1 - k ) + up, p.home.z + p.from[ 2 ] * ( 1 - k ) );

		}

		// the car: driven in slowly from the right field corner and parked beside the stage, nose out
		{

			const k = ease( ( cel - CEL.carIn[ 0 ] ) / ( CEL.carIn[ 1 ] - CEL.carIn[ 0 ] ) );
			const from = [ 50, - 44 ], to = STAGE.car;
			this.car.position.set( from[ 0 ] + ( to[ 0 ] - from[ 0 ] ) * k, 0, from[ 1 ] + ( to[ 1 ] - from[ 1 ] ) * k );
			this.car.rotation.y = k < 1 ? Math.atan2( - ( to[ 0 ] - from[ 0 ] ), - ( to[ 1 ] - from[ 1 ] ) ) : STAGE.carYaw;

		}

		// the trophy: on its pedestal until it's taken, then in whoever's hands
		if ( hold ) {

			this.trophy.position.set( hold.x, hold.y, hold.z );
			this.trophy.rotation.y = hold.yaw;

		} else {

			const c = Math.cos( STAGE.yaw ), s = Math.sin( STAGE.yaw ), p = this.pedTop;
			this.trophy.position.set( STAGE.at[ 0 ] + p[ 0 ] * c + p[ 2 ] * s, p[ 1 ], STAGE.at[ 1 ] - p[ 0 ] * s + p[ 2 ] * c );
			this.trophy.rotation.y = STAGE.yaw;

		}

	}

}

// ---- FR2: how far a piece has come (0..1) at cel: eased at the ends, walked steadily between for the
// carried ones (Throng.js puts the men round it from the same)
export function pieceK( p, cel ) {

	const x = Math.min( 1, Math.max( 0, ( cel - p.t ) / ( p.dur || 4 ) ) );
	if ( ! p.carry ) return x * x * ( 3 - 2 * x );
	const a = 0.18;
	if ( x < a ) return x * x / ( 2 * a * ( 1 - a ) );
	if ( x > 1 - a ) return 1 - ( 1 - x ) * ( 1 - x ) / ( 2 * a * ( 1 - a ) );
	return ( x - a / 2 ) / ( 1 - a );

}

// a lone mesh part into a group of its own (so every part is baked the same way)
function wrap( p ) {

	const g = new Group();
	g.add( p.obj );
	p.obj = g;
	return g;

}

// ---------------------------------------------------------------- the trophy

function trophy() {

	const g = new Group();
	g.name = 'commissioners-trophy';
	const gold = standard( { name: 'trophy-gold', color: new Color( 0.95, 0.68, 0.25 ), roughness: 0.18, metalness: 1.0,
		surface: 's.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.35;' } );
	const silver = standard( { name: 'trophy-silver', color: new Color( 0.85, 0.86, 0.88 ), roughness: 0.14, metalness: 1.0,
		surface: 's.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.3;' } );
	const wood = standard( { name: 'trophy-base', color: new Color( 0.03, 0.02, 0.015 ), roughness: 0.35 } );
	for ( const m of [ gold, silver, wood ] ) m.underwaterLighting = 'none';
	// the base: a dark plinth, the silver tiers
	const add = ( geo, m, y ) => {

		const o = new Mesh( geo, m );
		o.position.y = y;
		o.castShadow = true;
		g.add( o );
		return o;

	};
	add( new CylinderGeometry( 0.13, 0.14, 0.07, 24 ), wood, 0.035 );
	add( new CylinderGeometry( 0.115, 0.13, 0.04, 24 ), silver, 0.09 );
	add( new CylinderGeometry( 0.06, 0.1, 0.06, 20 ), silver, 0.14 );
	// the baseball at the centre, gold lines on silver
	add( new SphereGeometry( 0.06, 16, 12 ), silver, 0.33 );
	add( new CylinderGeometry( 0.062, 0.062, 0.006, 24 ), gold, 0.33 );
	add( new CylinderGeometry( 0.018, 0.03, 0.2, 12 ), silver, 0.23 );
	// the thirty pennants: gold staffs leaning out from the base, each flying a small pennant
	for ( let k = 0; k < 30; k ++ ) {

		const a = k / 30 * Math.PI * 2;
		const staff = new Mesh( new CylinderGeometry( 0.0035, 0.0045, 0.5, 5 ), gold );
		const tilt = 0.22;
		staff.position.set( Math.cos( a ) * ( 0.1 + Math.sin( tilt ) * 0.25 ), 0.17 + 0.25 * Math.cos( tilt ), Math.sin( a ) * ( 0.1 + Math.sin( tilt ) * 0.25 ) );
		staff.rotation.set( 0, - a, 0 );
		staff.rotateZ( - tilt );
		g.add( staff );
		const flag = new Mesh( new BoxGeometry( 0.004, 0.07, 0.085 ), gold );
		const r = 0.1 + Math.sin( tilt ) * 0.47;
		flag.position.set( Math.cos( a ) * r + Math.cos( a + 1.5708 ) * 0.04, 0.17 + 0.47 * Math.cos( tilt ), Math.sin( a ) * r + Math.sin( a + 1.5708 ) * 0.04 );
		flag.rotation.y = - a - 1.5708;
		g.add( flag );

	}

	g.userData.dynamic = true;
	return bake( g );

}

// ---------------------------------------------------------------- FR1: the MVP trophy

// the World Series MVP's trophy as Selig handed it to Hamels (Getty 83486314, 83486297; the FOX MVP frames):
// a tall faceted silver spire, three slim tapering blades leaning together and twisting a little, on a
// round silver base with a dark band; about half a metre
function mvpTrophy() {

	const g = new Group();
	g.name = 'mvp-trophy';
	const silver = standard( { name: 'mvp-silver', color: new Color( 0.86, 0.87, 0.9 ), roughness: 0.1, metalness: 1.0,
		surface: 's.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.3;' } );
	const band = standard( { name: 'mvp-band', color: new Color( 0.03, 0.03, 0.035 ), roughness: 0.3 } );
	for ( const m of [ silver, band ] ) m.underwaterLighting = 'none';
	const add = ( geo, m, x, y, z, rx = 0, ry = 0, rz = 0 ) => {

		const o = new Mesh( geo, m );
		o.position.set( x, y, z );
		o.rotation.set( rx, ry, rz );
		o.castShadow = true;
		g.add( o );
		return o;

	};
	add( new CylinderGeometry( 0.085, 0.095, 0.035, 24 ), silver, 0, 0.0175, 0 );
	add( new CylinderGeometry( 0.083, 0.083, 0.03, 24 ), band, 0, 0.05, 0 );
	add( new CylinderGeometry( 0.075, 0.083, 0.02, 24 ), silver, 0, 0.075, 0 );
	for ( let k = 0; k < 3; k ++ ) {

		const a = k / 3 * Math.PI * 2;
		const blade = new CylinderGeometry( 0.004, 0.022, 0.42, 3 );
		add( blade, silver, Math.cos( a ) * 0.025, 0.29, Math.sin( a ) * 0.025, Math.sin( a ) * 0.09, a + 0.5, - Math.cos( a ) * 0.09 );

	}

	g.userData.dynamic = true;
	return bake( g );

}
// ---- end FR1

// ---------------------------------------------------------------- the MVP's car

// the red 2010 Camaro the MVP got (ronniebruce 2988348008): long hood, the high beltline and low roof,
// the sunroof, silver five-spoke wheels
function camaro() {

	const g = new Group();
	g.name = 'mvp-camaro';
	const paint = standard( { name: 'camaro-paint', color: new Color( 0.5, 0.02, 0.02 ), roughness: 0.12, metalness: 0.4,
		surface: 's.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.15;' } );
	// (---- FB4, C4B-11: glass that reads as glass under the lights, the stands' glow sliding across it at a
	// slant, not a black slab: Getty 83486314, ronniebruce 2988348008)
	const glass = standard( { name: 'camaro-glass', color: new Color( 0.045, 0.05, 0.06 ), roughness: 0.05, metalness: 0.0,
		surface: 'let gf = pow( 1.0 - abs( dot( normalize( in.N ), in.V ) ), 2.2 ); s.emissive = mix( vec3f( 0.025, 0.03, 0.04 ), vec3f( 0.3, 0.32, 0.38 ), gf ) * ( 0.75 + 0.25 * sin( in.P.y * 9.0 + in.P.x * 3.0 ) ) * smoothstep( 0.2, 0.8, frame.night );' } );
	const tyre = standard( { name: 'camaro-tyre', color: new Color( 0.02 ), roughness: 0.8 } );
	// (---- FB4, C4B-11: brushed silver that reads silver under the lights: full metal mirrored the night
	// and went black)
	const rim = standard( { name: 'camaro-rim', color: new Color( 0.72, 0.73, 0.75 ), roughness: 0.35, metalness: 0.55,
		surface: 's.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.22;' } );
	const lamp = standard( { name: 'camaro-lamp', color: new Color( 0.8 ), roughness: 0.1, emissive: new Color( 0.5, 0.48, 0.44 ) } );
	for ( const m of [ paint, glass, tyre, rim, lamp ] ) m.underwaterLighting = 'none';
	// the body lofted from sections along its length (x across, y up, z along: -z the nose)
	const secs = [
		// z, half width, sill, beltline, roof (0: no cabin)
		[ - 2.4, 0.82, 0.28, 0.66, 0 ], [ - 2.15, 0.93, 0.22, 0.8, 0 ], [ - 1.2, 0.97, 0.2, 0.9, 0 ], [ - 0.55, 0.98, 0.2, 0.95, 0 ],
		[ - 0.25, 0.98, 0.2, 0.97, 1.22 ], [ 0.6, 0.99, 0.2, 1.0, 1.3 ], [ 1.25, 0.99, 0.21, 1.02, 1.2 ], [ 1.75, 0.97, 0.23, 1.0, 0 ], [ 2.35, 0.9, 0.3, 0.92, 0 ],
	];
	const pos = [], idx = [];
	const ring = ( s ) => {

		const [ z, w, sill, belt ] = s;
		return [ [ - w * 0.9, sill, z ], [ - w, ( sill + belt ) * 0.5, z ], [ - w * 0.94, belt, z ], [ - w * 0.6, belt + 0.04, z ], [ w * 0.6, belt + 0.04, z ], [ w * 0.94, belt, z ], [ w, ( sill + belt ) * 0.5, z ], [ w * 0.9, sill, z ] ];

	};
	secs.forEach( ( s ) => ring( s ).forEach( ( p ) => pos.push( ...p ) ) );
	const n = 8;
	for ( let i = 0; i < secs.length - 1; i ++ ) for ( let k = 0; k < n - 1; k ++ ) {

		const a = i * n + k, b = a + 1, c = a + n, d = c + 1;
		idx.push( a, c, b, b, c, d );

	}

	// the ends and the underside
	for ( const i of [ 0, secs.length - 1 ] ) for ( let k = 1; k < n - 1; k ++ ) idx.push( i * n, i * n + k, i * n + k + 1 );
	const body = new BufferGeometry();
	body.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	body.setIndex( idx );
	body.computeVertexNormals();
	const bm = new Mesh( body, paint );
	bm.castShadow = true;
	g.add( bm );
	// ---- FR1: the greenhouse lofted, not a box with a slab on it (the TV's MVP close-ups): the raked
	// windshield, the low roof in body colour with its sunroof, the fast back glass, the sides tumbling in
	{

		// z, the sill's half width and height, the roof's half width and height
		const gh = [ [ - 0.32, 0.86, 0.96, 0.84, 0.975 ], [ 0.18, 0.88, 0.985, 0.62, 1.255 ], [ 0.9, 0.9, 1.0, 0.63, 1.275 ], [ 1.62, 0.89, 1.02, 0.8, 1.035 ] ];
		const gp = [], gi = [];
		for ( const [ z, wb, yb, wt, yt ] of gh ) gp.push( - wb, yb, z, - wt, yt, z, wt, yt, z, wb, yb, z );
		for ( let i = 0; i < gh.length - 1; i ++ ) for ( let k = 0; k < 3; k ++ ) {

			const a = i * 4 + k, b = a + 1, c = a + 4, d = c + 1;
			gi.push( a, c, b, b, c, d );

		}

		const geo = new BufferGeometry();
		geo.setAttribute( 'position', new Float32BufferAttribute( gp, 3 ) );
		geo.setIndex( gi );
		geo.computeVertexNormals();
		g.add( new Mesh( geo, glass ) );
		// the roof panel over the glass between the pillars, and the sunroof in it
		const roof = new Mesh( new BoxGeometry( 1.2, 0.03, 0.66 ), paint );
		roof.position.set( 0, 1.27, 0.55 );
		g.add( roof );
		const sun = new Mesh( new BoxGeometry( 0.62, 0.012, 0.4 ), glass );
		sun.position.set( 0, 1.288, 0.5 );
		g.add( sun );

	}
	// ---- end FR1
	// ---- FB4 (C4B-11): the wheels out flush with the body in their dark arches, the 2010's silver five-spoke
	// rims standing out from the black tyres (they were black discs sunk under the sills); the B-pillar
	// breaking the side glass; the front's quad lamps, the black grille slot and the intake under it
	const put = ( geo, mat, x, y, z, rx = 0, rz = 0 ) => {

		const m = new Mesh( geo, mat );
		m.rotation.set( rx, 0, rz );
		m.position.set( x, y, z );
		g.add( m );

	};
	for ( const [ sx, z ] of [ [ - 1, - 1.45 ], [ 1, - 1.45 ], [ - 1, 1.5 ], [ 1, 1.5 ] ] ) {

		// the arch's shadow on the body's side, the tyre, the rim's barrel, the dark between the spokes, the
		// five spokes and the hub
		put( new CylinderGeometry( 0.44, 0.44, 0.01, 24 ), tyre, sx * 0.975, 0.38, z, 0, Math.PI / 2 );
		put( new CylinderGeometry( 0.36, 0.36, 0.25, 22 ), tyre, sx * 0.9, 0.36, z, 0, Math.PI / 2 );
		put( new CylinderGeometry( 0.245, 0.245, 0.02, 20 ), rim, sx * 1.02, 0.36, z, 0, Math.PI / 2 );
		put( new CylinderGeometry( 0.21, 0.21, 0.01, 20 ), tyre, sx * 1.031, 0.36, z, 0, Math.PI / 2 );
		for ( let k = 0; k < 5; k ++ ) {

			const a = k * Math.PI * 2 / 5 + 0.3;
			put( new BoxGeometry( 0.02, 0.2, 0.05 ), rim, sx * 1.038, 0.36 + Math.cos( a ) * 0.11, z + Math.sin( a ) * 0.11, a );

		}

		put( new CylinderGeometry( 0.05, 0.05, 0.03, 10 ), rim, sx * 1.045, 0.36, z, 0, Math.PI / 2 );

	}

	for ( const sx of [ - 1, 1 ] ) put( new BoxGeometry( 0.035, 0.38, 0.1 ), tyre, sx * 0.755, 1.12, 0.55, 0, - sx * 0.765 );
	for ( const x of [ - 0.72, - 0.5, 0.5, 0.72 ] ) put( new BoxGeometry( 0.17, 0.075, 0.05 ), lamp, x, 0.715, - 2.385 );
	put( new BoxGeometry( 1.05, 0.13, 0.05 ), tyre, 0, 0.57, - 2.405 );
	put( new BoxGeometry( 1.3, 0.09, 0.05 ), tyre, 0, 0.38, - 2.4 );
	put( new BoxGeometry( 0.12, 0.045, 0.02 ), rim, 0, 0.57, - 2.44 );
	// ---- end FB4

	g.userData.dynamic = true;
	void hash;
	return bake( g );

}
