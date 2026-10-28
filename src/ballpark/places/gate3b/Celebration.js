import { Mesh, SphereGeometry, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { rng } from './Mesher.js';

// The last out, 9:58 pm on the 29th: the ones outside pour onto the plaza and into Pattison Avenue
// (YouTube 23rads and CheeseSteakHead, 29 Oct 2008: the crowd filling Pattison and the lots, the Third
// Base Gate's facade behind; Geoff Jenkins: "15,000-20,000 people ... in the player parking lot"; Flickr
// bps52769, 23:18: fans standing on Schmidt's plinth). Out of McFadden's, across from the lots, down 11th
// they come running, and then they're jumping, hugging, arms in the air, towels going round, high fives,
// a call home ("WE WON!"), the cameras flashing all over; four up on the statue's plinth with their arms
// up, the cars on Pattison stopped dead in the middle of it all.

export function buildCelebration( { group, cast, statue, lift } ) {

	const r = rng( 2008 );
	const spots = [];
	// where they end up: thickest at the south end of the plaza and out over the sidewalk into the street
	const ok = ( x, z ) => ! ( Math.hypot( x - statue[ 0 ], z - statue[ 1 ] ) < 2.6 ) && ! ( Math.hypot( x + 112, z - 78 ) < 2.0 );
	while ( spots.length < 150 ) {

		// knots of them: most round the statue and the marquee at the plaza's south end and out over the
		// sidewalk, the rest in the street
		const u = r();
		let x, z, road = false;
		if ( u < 0.5 ) { x = - 126 + r() * 44; z = 76 + r() * 21; }
		else if ( u < 0.78 ) { x = - 136 + r() * 64; z = 99 + r() * 10.5; }
		else { x = - 132 + r() * 56; z = 111.5 + r() * 15; road = true; }
		if ( ok( x, z ) ) spots.push( { x, z, road } );

	}

	// where they come from: McFadden's door, the lots across Pattison, down 11th, the store
	const sources = [ [ - 73.5, 75 ], [ - 80, 152 ], [ - 110, 152 ], [ - 150, 100 ], [ - 104, 30 ] ];
	const acts = [ 'jump', 'jump', 'jump', 'wave', 'wave', 'hug', 'jump', 'phone', 'photo', 'wave', 'jump', 'pose' ];
	const flashers = [];
	const list = [];
	spots.forEach( ( sp, i ) => {

		let act = acts[ i % acts.length ];
		const src = sources[ Math.floor( r() * sources.length ) ];
		const appear = r() * 26, speed = 2.6 + r() * 1.6;
		const dist = Math.hypot( sp.x - src[ 0 ], sp.z - src[ 1 ] );
		// the huggers face a partner (the next spot, moved in close)
		let face = [ sp.x + ( r() - 0.5 ), sp.z - 3 ];
		if ( act === 'hug' && i + 1 < spots.length ) {

			const q = r() * Math.PI * 2;
			spots[ i + 1 ].x = sp.x + Math.cos( q ) * 0.55; spots[ i + 1 ].z = sp.z + Math.sin( q ) * 0.55; spots[ i + 1 ].road = sp.road;
			spots[ i + 1 ].hugWith = sp;
			face = [ spots[ i + 1 ].x, spots[ i + 1 ].z ];

		}

		if ( sp.hugWith ) {

			act = 'hug';
			face = [ sp.hugWith.x, sp.hugWith.z ];

		}

		const c = cast.add( { at: [ sp.x, sp.z ], face, act, dry: true, onRoad: sp.road, props: act === 'wave' ? [ 'towel' ] : [], noRainGear: true,
			when: ( w ) => w.celebrate && ( w.t - w.seg.t0 ) > appear, extra: { custom: ( c, dt, w, p ) => {

				// running in from where they were, then celebrating where they stop
				const e = ( w.t - w.seg.t0 ) - appear, k = Math.min( 1, e * speed / Math.max( 1, dist ) );
				if ( k < 1 ) {

					c.f.x = src[ 0 ] + ( sp.x - src[ 0 ] ) * k; c.f.z = src[ 1 ] + ( sp.z - src[ 1 ] ) * k;
					c.f.yaw = Math.atan2( - ( sp.x - src[ 0 ] ), - ( sp.z - src[ 1 ] ) );
					c.f.walk = 1; c.f.phase += dt * speed * 3.8;
					const onRoadNow = c.f.z > 110.6 && c.f.z < 128.6 && c.f.x > - 141;
					c.f.y += ( onRoadNow ? 0.012 : lift ) - c.y0;
					p.flexL = 2.4; p.abductL = - 0.2; p.elbowL = 0.3; p.flexR = 0.3; p.elbowR = 1.2; p.pitch = 0.2;
					c.running = true;

				} else if ( c.running ) {

					c.running = false;
					c.f.x = sp.x; c.f.z = sp.z;
					c.f.yaw = Math.atan2( - ( face[ 0 ] - sp.x ), - ( face[ 1 ] - sp.z ) );

				}

				// ---- FW4 (C3W-7): once there, each goes through it his own way and at his own pace: arms up
				// and jumping for a beat, then clapping, a fist pumped, an arm round the next one, both hands on
				// his head, a phone up to film it, turning to look up Pattison, and up again (it was one pose
				// held by all: both arms straight up in a V, standing still, 25 of them along the sidewalk; the
				// photos have them every which way: ronniebruce 2988349308, jhirsch628 3000680238)
				if ( k >= 1 && ( act === 'jump' || act === 'wave' ) ) {

					const T = c.t * 0.16 + i * 0.37, beat = Math.floor( T ), u = T - beat;
					const pick = ( beat * 7 + i * 3 ) % 6;
					const s1 = Math.sin( c.t * 7 ), s2 = Math.sin( c.t * 3.1 + i );
					// (a beat's first and last moments ease from and into the next)
					const ease = Math.min( 1, u * 6, ( 1 - u ) * 6 );
					// (standing: the act's jump taken back off)
					const y0 = c.f.y - ( act === 'jump' ? Math.max( 0, Math.sin( c.t * 6 ) ) * 0.28 : Math.max( 0, Math.sin( c.t * 5 ) ) * 0.12 );
					if ( pick === 1 ) {

						// clapping, the hands up in front
						p.flexL = 1.2 * ease; p.abductL = - 0.35 + 0.25 * s1; p.elbowL = 1.3; p.flexR = 1.2 * ease; p.abductR = - 0.35 + 0.25 * s1; p.elbowR = 1.3;
						p.pitch = 0.1; c.f.y = y0;

					} else if ( pick === 2 ) {

						// a fist pumped, the other arm down
						p.flexR = 2.4 + 0.35 * s1 * ease; p.abductR = 0.15; p.elbowR = 0.9 - 0.6 * s1; p.flexL = 0.15; p.abductL = 0.1; p.elbowL = 0.4;
						p.pitch = 0.25; c.f.y = y0;

					} else if ( pick === 3 ) {

						// hands on his head, can't believe it, looking round
						p.flexL = 2.3 * ease; p.abductL = 0.55; p.elbowL = 2.4; p.flexR = 2.3 * ease; p.abductR = 0.55; p.elbowR = 2.4;
						p.yaw = 0.7 * s2; p.pitch = - 0.2; c.f.y = y0;

					} else if ( pick === 4 ) {

						// arms down, walking it off: a turn to look up the street and back
						p.flexL = 0.1; p.abductL = 0.08; p.elbowL = 0.3; p.flexR = 0.1; p.abductR = 0.08; p.elbowR = 0.3;
						p.yaw = 1.1 * Math.sin( c.t * 0.5 + i ); p.pitch = 0.05; c.f.y = y0;

					} else if ( pick === 5 ) {

						// an arm round the shoulders of the one beside him, the other up
						p.flexL = 0.9; p.abductL = 1.3; p.elbowL = 1.6; p.flexR = 2.6 * ease; p.abductR = - 0.2; p.elbowR = 0.35;
						p.pitch = 0.2; c.f.y = y0 + Math.max( 0, Math.sin( c.t * 4 ) ) * 0.05;

					}
					// (pick 0: as the act has it: arms up and jumping, or the towel going round)

				}
				// ---- end FW4

			} } } );
		if ( c ) list.push( c );
		if ( c && act === 'photo' ) flashers.push( c );

	} );

	// up on Schmidt's plinth, arms up
	for ( const [ a, b ] of [ [ - 1.2, 1.1 ], [ 1.1, 1.2 ], [ 1.3, - 1.0 ], [ - 0.9, - 1.3 ] ] ) {

		cast.add( { at: [ statue[ 0 ] + a, statue[ 1 ] + b ], face: [ statue[ 0 ] + a * 3, statue[ 1 ] + b * 3 + 2 ], act: 'jump', y: 0.55, dry: true, noRainGear: true, when: ( w ) => w.celebrate && ( w.t - w.seg.t0 ) > 12 } );

	}

	// the flashes: a white pop at a camera now and then
	const fm = standard( { name: 'w1-celebration-flash', color: new Color( 1, 1, 1 ), lit: false, surface: 's.albedo = vec3f( 0.0 ); s.emissive = vec3f( 60.0, 58.0, 55.0 );' } );
	const flashes = flashers.map( () => {

		const m = new Mesh( new SphereGeometry( 0.04, 8, 6 ), fm );
		m.userData.dynamic = true;
		m.visible = false;
		group.add( m );
		return { m, t: r() * 4, on: 0 };

	} );
	return {
		update( dt ) {

			flashers.forEach( ( c, i ) => {

				const F = flashes[ i ], f = c.f;
				if ( ! f.visible || c.running ) {

					F.m.visible = false;
					return;

				}

				F.t -= dt;
				if ( F.t <= 0 ) {

					F.on = 0.08;
					F.t = 2 + Math.random() * 5;

				}

				F.on = Math.max( 0, F.on - dt );
				F.m.visible = F.on > 0;
				F.m.position.set( f.x - Math.sin( f.yaw ) * 0.3 * f.scale, f.y + 1.6 * f.scale, f.z - Math.cos( f.yaw ) * 0.3 * f.scale );

			} );

		},
	};

}
