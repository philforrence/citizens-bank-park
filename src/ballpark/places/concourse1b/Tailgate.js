import { LEVELS } from '../../layout.js';
import { PROP, TOP, COLOR, HAT, CHEST, BACK } from '../Cast.js';
import { GESTURE } from '../Concourse3BKit.js';
import { tube } from './Plaza.js';

// Across Pattison from the First Base Gate, Lot K (its light poles marked K6, K8: rdowens, Jul 2008), where
// the 2008 rules allowed tailgating (lots A-H, J-N; not west of Darien north of Pattison): behind its black
// picket fence along the sidewalk, three canopies of the ones who didn't go in (or haven't yet): a white
// pop-up with a red valance, a kettle grill smoking, coolers, camp chairs round a little TV on a folding
// table showing the game, a Phillies flag on a pole off a bumper. They watch it through the rain on the
// 27th (a poncho, hoods up, huddled under the canopy), and at the last out they're up out of their chairs
// (and a dozen of them run over to the gate: Scenes.js). Invented, from the 2008 lot and the rules.
const STREET = LEVELS.mainConcourse;
const TAU = Math.PI * 2;

// where: [ x, z ] of each canopy's middle and the way it faces (toward Pattison and the park: -z)
export const CAMPS = [ [ 88, 142, 0.25 ], [ 101, 146, - 0.1 ], [ 114, 140, 0.15 ] ];

export class Tailgates {

	// Pr: the prints' kit (the fence and the camps go into it now); then people( cast ), smoke( steam )
	constructor( { Pr } ) {

		this.people = [];
		this.time = 0;
		this.screens = [];
		this.grills = [];
		this.camps = [];
		this.r = r;
		function r( s ) {

			const x = Math.sin( s * 12.9898 + 78.233 ) * 43758.5453;
			return x - Math.floor( x );

		}
		// the fence along the lot's edge on Pattison: black steel pickets on two rails, the gap at the crosswalk
		for ( const [ x0, x1 ] of [ [ 44, 86 ], [ 97, 176 ] ] ) {

			const F = ( x, y, z ) => [ x, STREET + y, z ];
			F.dir = ( x, y, z ) => [ x, y, z ];
			for ( const y of [ 0.2, 1.55 ] ) Pr.use( 'black' ).box( F, ( x0 + x1 ) / 2, y, 131, x1 - x0, 0.04, 0.03 );
			for ( let x = x0; x <= x1; x += 0.14 ) {

				Pr.use( 'black' ).quad( F( x - 0.009, 0, 131.02 ), F( x + 0.009, 0, 131.02 ), F( x + 0.009, 1.7, 131.02 ), F( x - 0.009, 1.7, 131.02 ), [ 0, 0, 1 ] );
				Pr.use( 'black' ).quad( F( x + 0.009, 0, 130.98 ), F( x - 0.009, 0, 130.98 ), F( x - 0.009, 1.7, 130.98 ), F( x + 0.009, 1.7, 130.98 ), [ 0, 0, - 1 ] );

			}

			for ( let x = x0; x <= x1; x += 2.4 ) Pr.use( 'black' ).box( F, x, 0.9, 131, 0.06, 1.8, 0.06 );

		}

		CAMPS.forEach( ( [ cx, cz, yaw ], i ) => {

			const c = Math.cos( yaw ), s = Math.sin( yaw );
			// the camp's frame: x across, z back from the front (the front faces -z, the park)
			const Q = ( x, y, z ) => [ cx + x * c + z * s, STREET + y, cz - x * s + z * c ];
			Q.dir = ( x, y, z ) => [ x * c + z * s, y, - x * s + z * c ];
			// the canopy: four legs, the white top peaked a little, the red valance round it
			const H = 2.3, W = 1.5;
			for ( const [ x, z ] of [ [ - W, - W ], [ W, - W ], [ W, W ], [ - W, W ] ] ) tube( Pr.use( 'steel' ), Q( x, 0, z ), Q( x, H, z ), 0.022, 5, false );
			const top = Q( 0, H + 0.35, 0 );
			const corners = [ Q( - W, H, - W ), Q( W, H, - W ), Q( W, H, W ), Q( - W, H, W ) ];
			for ( let k = 0; k < 4; k ++ ) {

				const a = corners[ k ], b = corners[ ( k + 1 ) % 4 ];
				const n = [ ( a[ 0 ] + b[ 0 ] ) / 2 - cx, 1.2, ( a[ 2 ] + b[ 2 ] ) / 2 - cz ];
				Pr.use( 'white' ).tri( a, b, top, n, n, n );
				Pr.use( 'white' ).tri( a, top, b, n.map( ( v ) => - v ), n.map( ( v ) => - v ), n.map( ( v ) => - v ) );
				// the valance, printed on its outside
				const v = [ ( a[ 0 ] + b[ 0 ] ) / 2 - cx, 0, ( a[ 2 ] + b[ 2 ] ) / 2 - cz ];
				Pr.quad( [ a[ 0 ], a[ 1 ] - 0.25, a[ 2 ] ], [ b[ 0 ], b[ 1 ] - 0.25, b[ 2 ] ], b, a, v, Pr.uvOf( 'valance' ) );
				Pr.use( 'red' ).quad( b, a, [ a[ 0 ], a[ 1 ] - 0.25, a[ 2 ] ], [ b[ 0 ], b[ 1 ] - 0.25, b[ 2 ] ], v.map( ( q ) => - q ) );

			}

			// the folding table with the little TV on it, the coolers, the grill off to the side
			Pr.use( 'white' ).box( Q, 0.4, 0.72, - 0.6, 1.2, 0.03, 0.6 );
			for ( const [ x, z ] of [ [ - 0.15, - 0.85 ], [ 0.95, - 0.85 ], [ - 0.15, - 0.35 ], [ 0.95, - 0.35 ] ] ) Pr.use( 'grey' ).box( Q, x, 0.36, z, 0.03, 0.72, 0.03 );
			Pr.use( 'black' ).box( Q, 0.4, 0.93, - 0.72, 0.5, 0.4, 0.32 );
			this.screens.push( [ Q( 0.19, 0.78, - 0.555 ), Q( 0.61, 0.78, - 0.555 ), Q( 0.61, 1.1, - 0.555 ), Q( 0.19, 1.1, - 0.555 ), Q.dir( 0, 0, 1 ) ] );
			Pr.use( 'red' ).box( Q, - 1.1, 0.22, 0.6, 0.75, 0.44, 0.45 );
			Pr.use( 'white' ).box( Q, - 1.1, 0.46, 0.6, 0.77, 0.05, 0.47 );
			Pr.use( 'royal' ).box( Q, - 0.35, 0.18, 1.0, 0.55, 0.36, 0.38 );
			const g = [ W + 0.8, 0, 0.3 ];
			for ( let k = 0; k < 3; k ++ ) {

				const a = k / 3 * TAU;
				tube( Pr.use( 'black' ), Q( g[ 0 ] + Math.cos( a ) * 0.22, 0, g[ 2 ] + Math.sin( a ) * 0.22 ), Q( g[ 0 ] + Math.cos( a ) * 0.12, 0.62, g[ 2 ] + Math.sin( a ) * 0.12 ), 0.015, 4, false );

			}

			Pr.use( 'black' ).cyl( Q, g[ 0 ], g[ 2 ], 0.6, 0.8, 0.2, 0.28, 12, { top: false } );
			Pr.use( 'black' ).cyl( Q, g[ 0 ], g[ 2 ], 0.8, 0.98, 0.28, 0.08, 12 );
			this.grills.push( Q( g[ 0 ], 1.0, g[ 2 ] ) );
			// the camp chairs round the TV
			const chairs = [ [ - 0.5, 0.5 ], [ 0.4, 0.8 ], [ 1.3, 0.5 ] ];
			for ( const [ x, z ] of chairs ) {

				Pr.use( i === 1 ? 'royal' : 'red' ).box( Q, x, 0.42, z, 0.5, 0.04, 0.45 );
				Pr.use( i === 1 ? 'royal' : 'red' ).box( Q, x, 0.7, z + 0.24, 0.5, 0.55, 0.04 );
				for ( const dx of [ - 0.24, 0.24 ] ) tube( Pr.use( 'steel' ), Q( x + dx, 0, z - 0.2 ), Q( x + dx, 0.42, z + 0.2 ), 0.012, 4, false );

			}

			// the flag on its pole
			tube( Pr.use( 'steel' ), Q( - W - 0.6, 0, - W ), Q( - W - 0.6, 3.6, - W ), 0.025, 5, false );
			Pr.sheet( Q, - W - 0.6 + 0.75, 3.15, - W, 1.5, 0.9, 'flag', 0.05 );
			this.camps.push( { Q, chairs, W, i } );

		} );

	}

	// the grills' smoke
	smoke( steam ) {

		for ( const g of this.grills ) steam.emit( { x: g[ 0 ], y: g[ 1 ], z: g[ 2 ], rate: 3, kind: 0, spread: [ 0.25, 0.25 ], drift: [ 0.1, 0.05 ], rise: 0.6, life: 4 } );

	}

	// the people: two in the chairs watching, one at the grill with the tongs, one standing with a beer
	addPeople( cast ) {

		const r = this.r;
		this.cast = cast;
		for ( const { Q, chairs, W, i } of this.camps ) {

			const looks = [
				{ age: 0, skin: 0, hair: 1, facial: 4, build: 3, top: TOP.hoodie, color: COLOR.red, sleeves: COLOR.red, chest: CHEST.block, hat: HAT.knitRed, pants: 0, shoes: 2 },
				{ female: true, age: 0, skin: 1, hair: 4, hairStyle: 2, top: TOP.puffer, color: COLOR.black, sleeves: COLOR.black, hat: HAT.knitRed, pants: 1, shoes: 2, scarf: 1 },
				{ age: 0, skin: 5, hair: 0, facial: 2, build: 2, top: TOP.homeJersey, color: COLOR.white, sleeves: COLOR.grey, back: BACK.HOWARD, chest: CHEST.script, hat: HAT.capRed, pants: 1, shoes: 1 },
				{ age: 1, skin: 0, hair: 7, build: 1, top: TOP.work, color: COLOR.tan, sleeves: COLOR.tan, hat: HAT.cap1980, pants: 2, shoes: 3, gloves: true },
			];
			looks.forEach( ( L, k ) => {

				const dry = { skin: 0, hair: 2, hairStyle: 0, facial: 0, glasses: false, female: false, age: 0, build: 1, back: 0, chest: 0, pants: 0, shoes: 0, hat: HAT.none, poncho: 0, scarf: 0, gloves: false, ...L, seed: Math.floor( r( i * 7 + k ) * 65536 ) };
				const p = cast.add( dry );
				if ( ! p ) return;
				p.looks = { dry, wet: { ...dry, poncho: k === 3 ? 1 : 0, hat: k === 2 ? HAT.hood : dry.hat } };
				p.visible = true;
				p.scale = 0.95 + r( i + k ) * 0.08;
				const spot = k < 2 ? chairs[ k * 2 ] : k === 2 ? [ W + 0.8, 0.95 ] : [ 0.9, - 1.5 ];
				this.people.push( { p, k, Q, spot, order: r( i * 3 + k * 5 ), face: k === 2 ? [ 0, - 1 ] : [ 0.4 - spot[ 0 ], - 0.6 - spot[ 1 ] ] } );

			} );

		}

	}

	update( dt, ns, react ) {

		this.time += dt;
		const t = this.time;
		if ( this._first !== ns.first ) {

			this._first = ns.first;
			for ( const a of this.people ) this.cast.setLook( a.p, ns.first ? a.p.looks.wet : a.p.looks.dry );

		}

		const cheer = ns.celebrate || ( react && ( react.kind === 'cheer' || react.kind === 'champions' ) );
		for ( const a of this.people ) {

			const p = a.p, P = p.pose, [ x, z ] = a.spot;
			const w = a.Q( x, 0, z ), f = a.Q.dir( a.face[ 0 ], 0, a.face[ 1 ] );
			p.x = w[ 0 ]; p.z = w[ 2 ]; p.y = STREET;
			p.yaw = Math.atan2( - f[ 0 ], - f[ 2 ] );
			P.walk = 0; P.lean = 0; P.twist = 0; P.drop = 0; P.hipL = P.hipR = P.kneeL = P.kneeR = 0; P.mouth = 0;
			P.armL = GESTURE.pockets[ 0 ].slice(); P.propL = PROP.pocket;
			P.armR = [ 0.05, 0.08, 0, 0.2 ]; P.propR = 0;
			P.headPitch = 0.1; P.headYaw = 0;
			P.blink = ( t * 0.3 + a.order * 3 ) % 1 < 0.04 ? 1 : 0;
			if ( a.k < 2 && ! cheer ) {

				// in the chair, a beer, watching the little TV
				P.hipL = P.hipR = 1.45; P.kneeL = P.kneeR = 1.4; P.drop = Math.max( 0, 0.93 - 0.47 / p.scale );
				P.armR = GESTURE.carry[ 1 ].slice(); P.propR = a.k ? PROP.cocoa : PROP.beer;
				P.headPitch = 0.2;

			} else if ( a.k === 2 && ! cheer ) {

				// at the grill with the tongs, turning the sausages
				P.armR = [ 0.9 + 0.1 * Math.sin( t * 2 ), 0.2, 0.3, 1.0 ]; P.propR = PROP.tongs ?? PROP.pencil;
				P.headPitch = 0.45; P.lean = 0.12;

			} else if ( ! cheer ) {

				P.armR = GESTURE.carry[ 1 ].slice(); P.propR = PROP.beer;
				P.mouth = Math.max( 0, 0.3 * Math.sin( t * 7 + a.order * 5 ) ) * ( Math.sin( t * 0.3 + a.order ) > 0 ? 1 : 0 );

			} else {

				// up out of the chairs: arms up, jumping
				P.armL = [ 2.6, 0.3, 0, 0.4 ]; P.armR = [ 2.6 + 0.3 * Math.sin( t * 9 + a.k ), 0.3, 0, 0.4 ]; P.propL = 0;
				P.propR = a.k === 3 ? PROP.beer : 0;
				P.drop = - Math.max( 0, Math.sin( t * 8 + a.k ) ) * 0.08;
				P.mouth = 0.8; P.headPitch = - 0.25;

			}

		}

	}

}
