import { Mesh, BufferGeometry, Float32BufferAttribute, CylinderGeometry, BoxGeometry, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { RAIL, FLAG } from './RailFigures.js';
import { rnd, put, cable, stool, hardCase, rollerBag, laptop, pedestal } from './Props.js';

// The camera wells at the dugouts' ends, full for the World Series.
//
// At each dugout's home plate end, where the backstop meets it (heston 2987300364, 2986440011): FOX's
// low home camera on its pedestal, the operator at the eyepiece, and a clear parabolic dish on a stand
// aimed at the plate, its sound man on a case with the mixer on his knees and the cans on.
//
// At each far end: FOX's low first / third base camera with its big box lens, then the photographers,
// packed in: a front row on tall stools with the long glass (white Canons, black Nikons) on monopods
// poked between the rails, a row standing behind shooting over their heads, one changing lenses, one
// checking the back of his camera; hard cases, rolling bags, a laptop moving pictures to the desk, a
// coffee on the ledge; on the 27th the cameras in their rain covers and the men in their hoods.
//
// Invented, where the record is silent (their names are ours):
//   - Ed, the AP's veteran, grey beard and a watch cap, his tenth Series, on the stool nearest home
//     at the Phillies' end: he shot the 1980 parade as a stringer;
//   - Marisa, a freelancer on her first Series, changing to the 70-200 for the dugout;
//   - the Inquirer's man in a Phillies cap (a Philly guy; he'd deny it), checking his last frame;
//   - FOX's low-third operator, whose tally goes red when the truck takes his picture.

const FLOOR = - 0.7; // the wells' raised floor below the field

export class Wells {

	constructor( { group, figs, field, M } ) {

		this.group = group;
		this.figs = figs;
		this.M = M;
		this.cams = []; // TV cameras: { head, op, x, y, z, yaw, pitch, box }
		this.photogs = []; // { f, x, z, aim, subject, rest, changer }
		this.sound = [];
		let seed = 1;
		for ( const d of field.dugouts ) {

			const home = d.side === 'first';
			const { a, ux, uz, nx, nz, len } = d;
			const P = ( s, t, y = FLOOR ) => [ a[ 0 ] + ux * s + nx * t, y, a[ 1 ] + uz * s + nz * t ];
			const face = Math.atan2( nx, nz ); // -z toward the field
			const r0 = d.roof[ 0 ], r1 = d.roof[ 1 ];

			// ---- the home plate end: the low home camera and the parabolic mic
			this._camera( P( 1.0, 0.95 ), face, false, home ? 'low home 1B' : 'low home 3B' );
			this._dish( P( r0 - 0.55, 0.62 ), P( r0 - 0.55, 0.62, 0 ) );
			const snd = this.figs.add( 'sound', { ...xyz( P( r0 - 0.5, 1.75 ) ), yaw: face + ( home ? - 0.5 : 0.5 ), outfit: RAIL.sound, flags: 0, seed: rnd( seed ++ ), stout: 0.4 } );
			this.sound.push( snd );
			hardCase( group, M, P( r0 - 0.5, 1.72 ), face + 0.2, [ 0.5, 0.42, 0.34 ] );
			hardCase( group, M, P( 0.45, 2.15 ), face - 0.1 );
			cable( group, M.cable, [ P( 1.0, 0.95 ), P( 1.0, 1.6 ), P( 0.6, 2.3 ), P( 0.2, 2.5 ) ] );
			cable( group, M.cable, [ P( r0 - 0.55, 0.62 ), P( r0 - 0.4, 1.3 ), P( r0 - 0.5, 1.72 ) ], 0.006 );

			// ---- the far end: the low base line camera, then the photographers
			const f0 = r1 + 0.2; // the well's inner end (the partition)
			this._camera( P( f0 + 0.95, 0.95 ), face, true, home ? 'low 1B' : 'low 3B' );
			cable( group, M.cable, [ P( f0 + 0.95, 0.95 ), P( f0 + 0.9, 1.8 ), P( f0 + 0.3, 2.45 ) ] );
			cable( group, M.orange, [ P( f0 + 0.3, 2.45 ), P( len - 1.0, 2.5 ), P( len - 0.6, 2.2 ) ], 0.009 );
			// the front row on stools, the lenses between the rails
			const front = [ len - 3.55, len - 2.7, len - 1.85, len - 1.0 ];
			front.forEach( ( s, i ) => {

				const k = seed ++;
				stool( group, M, P( s, 0.83 ), 0.55, rnd( k ) );
				this._photog( 'photoSit', P( s, 0.83 ), face, k, { veteran: home && i === 0, inquirer: ! home && i === 2 } );

			} );
			// the back row standing
			[ len - 3.15, len - 2.25, len - 1.4 ].forEach( ( s ) => {

				const k = seed ++;
				this._photog( 'photoStand', P( s, 1.75 ), face, k, {} );

			} );
			// the one changing lenses at the far corner, turned away along the well
			this._photog( 'lensChange', P( len - 0.45, 1.95 ), face + ( home ? 0.9 : - 0.9 ), seed ++, { changer: true } );
			// their gear along the back wall: hard cases, rolling bags, a laptop on a case, coffee
			hardCase( group, M, P( len - 3.4, 2.3 ), face + 0.05 );
			rollerBag( group, M, P( len - 2.6, 2.35 ), face + 0.2 );
			hardCase( group, M, P( len - 1.75, 2.3 ), face - 0.1, [ 0.62, 0.3, 0.4 ] );
			laptop( group, M, P( len - 1.75, 2.25, FLOOR + 0.3 ), face + Math.PI + 0.3 );
			rollerBag( group, M, P( len - 0.9, 2.4 ), face - 0.15 );
			// extra glass standing on end, a coffee (a Wawa cup) on the case
			put( group, new CylinderGeometry( 0.06, 0.06, 0.34, 10 ), M.white, P( len - 3.1, 2.2, FLOOR + 0.3 + 0.17 ), 0 );
			put( group, new CylinderGeometry( 0.045, 0.035, 0.13, 10 ), M.paper, P( len - 1.5, 2.1, FLOOR + 0.3 + 0.065 ), 0 );
			put( group, new CylinderGeometry( 0.048, 0.048, 0.012, 10 ), M.red, P( len - 1.5, 2.1, FLOOR + 0.3 + 0.13 ), 0 );

		}

	}

	// a TV camera: its pedestal (static), its head (a figure that pans and tilts) and its operator
	_camera( p, face, box, name ) {

		const G = this.group, M = this.M;
		pedestal( G, M, p, 1.32 );
		const head = this.figs.add( box ? 'tvHeadBox' : 'tvHead', { ...xyz( p ), yaw: face, outfit: RAIL.fox, flags: 0, seed: 0.5 } );
		const op = this.figs.add( 'tvCam', { ...xyz( p ), yaw: face, outfit: RAIL.fox, flags: FLAG.cap, seed: rnd( p[ 0 ] * 7 + p[ 2 ] ), stout: rnd( p[ 2 ] ) * 0.6 } );
		this.cams.push( { head, op, x: p[ 0 ], y: p[ 1 ], z: p[ 2 ], face, yaw: face, pitch: 0, box, name } );

	}

	// the parabolic dish: clear polycarbonate on a light stand, the mic at its focus, aimed at the plate
	_dish( p, aimFrom ) {

		const G = this.group, M = this.M;
		const R = 0.28, F = 0.15, cy = 1.25;
		// where it points: home plate
		const yaw = Math.atan2( - ( 0 - aimFrom[ 0 ] ), - ( 0 - aimFrom[ 2 ] ) );
		const c = Math.cos( yaw ), s = Math.sin( yaw );
		// the stand: three legs, the pole
		for ( let k = 0; k < 3; k ++ ) {

			const a = k * Math.PI * 2 / 3;
			put( G, new CylinderGeometry( 0.01, 0.01, 0.62, 5 ), M.black, [ p[ 0 ] + Math.cos( a ) * 0.13, p[ 1 ] + 0.28, p[ 2 ] + Math.sin( a ) * 0.13 ], 0, { rx: Math.sin( a ) * 0.45, rz: - Math.cos( a ) * 0.45 } );

		}

		put( G, new CylinderGeometry( 0.013, 0.013, cy - 0.5, 6 ), M.black, [ p[ 0 ], p[ 1 ] + 0.5 + ( cy - 0.5 ) / 2 - 0.25, p[ 2 ] ] );
		// the mic in the dish (pointing back into it) and the pistol grip behind
		const at = ( lx, ly, lz ) => [ p[ 0 ] + lx * c + lz * s, p[ 1 ] + ly, p[ 2 ] - lx * s + lz * c ];
		put( G, new CylinderGeometry( 0.012, 0.012, F + 0.02, 8 ), M.black, at( 0, cy, - F / 2 + 0.03 ), yaw, { rx: Math.PI / 2 } );
		put( G, new CylinderGeometry( 0.02, 0.02, 0.05, 8 ), M.black, at( 0, cy, - F + 0.02 ), yaw, { rx: Math.PI / 2 } );
		put( G, new BoxGeometry( 0.035, 0.13, 0.05 ), M.black, at( 0, cy - 0.1, 0.1 ), yaw, { rx: 0.3 } );
		// the dish: a paraboloid opening toward the plate (-z), its rim
		const pos = [], nrm = [], uv = [], index = [];
		const RINGS = 6, SEG = 28;
		for ( let r = 0; r <= RINGS; r ++ ) for ( let k = 0; k <= SEG; k ++ ) {

			const rad = R * r / RINGS, a = k / SEG * Math.PI * 2;
			const x = Math.cos( a ) * rad, y = Math.sin( a ) * rad, z = - rad * rad / ( 4 * F ) + 0.05;
			pos.push( ...at( x, cy + y, z ) );
			// the normal: of z = -r^2/4F + c, facing into the dish (toward -z)
			const nx0 = x / ( 2 * F ), ny0 = y / ( 2 * F ), nz0 = - 1, l = Math.hypot( nx0, ny0, nz0 );
			nrm.push( ( nx0 * c + nz0 * s ) / l, ny0 / l, ( - nx0 * s + nz0 * c ) / l );
			uv.push( r / RINGS, k / SEG );

		}

		for ( let r = 0; r < RINGS; r ++ ) for ( let k = 0; k < SEG; k ++ ) {

			const A = r * ( SEG + 1 ) + k, B = A + 1, C = A + SEG + 1, D = C + 1;
			index.push( A, C, B, B, C, D );

		}

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
		g.setIndex( index );
		g.computeBoundingSphere();
		if ( ! this._dishMat ) {

			// clear polycarbonate: nearly invisible face on, catching the lights toward its rim; a
			// scuffed dark band at the rim
			this._dishMat = standard( { name: 'parabolic-dish', color: new Color( 0.75, 0.8, 0.85 ), roughness: 0.08, side: 'double', transparent: true, depthWrite: false,
				surface: /* wgsl */`
	let rim = smoothstep( 0.9, 0.98, in.uv.x );
	let edgeOn = 1.0 - abs( dot( normalize( in.N ), normalize( in.V ) ) );
	s.alpha = clamp( 0.1 + 0.5 * edgeOn * edgeOn + 0.8 * rim, 0.0, 0.95 );
	s.albedo = mix( mat.color, vec3f( 0.02 ), rim );
	s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.15;
` } );
			this._dishMat.underwaterLighting = 'none';

		}

		const m = new Mesh( g, this._dishMat );
		m.name = 'parabolic-dish';
		m.layers.set( 2 ); // the late (transparent) pass
		G.add( m );

	}

	// a photographer: his kind, where, which way the well faces; his look from his seed
	_photog( kind, p, face, k, { veteran = false, inquirer = false, changer = false } ) {

		const h = rnd( k * 3.7 ), h2 = rnd( k * 9.1 );
		let flags = h < 0.45 ? FLAG.cap : h < 0.7 ? FLAG.beanie : 0;
		if ( h2 < 0.3 ) flags |= FLAG.glasses;
		if ( veteran ) flags = FLAG.beanie | FLAG.glasses;
		if ( inquirer ) flags = FLAG.cap;
		// Ed's grey beard (the seed picks grey hair and a beard), the Inquirer man's red cap
		const seed = veteran ? 0.901 : inquirer ? 0.207 : rnd( k * 5.3 );
		const f = this.figs.add( kind, { ...xyz( p ), yaw: face, outfit: RAIL.photog, flags, seed, stout: rnd( k * 2.1 ) * 0.8, scale: 0.94 + rnd( k * 4.4 ) * 0.12 } );
		this.photogs.push( {
			f, x: p[ 0 ], z: p[ 2 ], face, base: flags, hoodie: rnd( k * 6.6 ) < 0.45,
			// his subject between the plays: the plate or the mound
			subject: rnd( k * 8.8 ) < 0.65 ? [ 0, - 0.2 ] : [ 0, - 18.3 ],
			lag: 0.4 + rnd( k * 1.9 ) * 0.8, phase: rnd( k * 7.7 ) * 40, changer, sit: kind === 'photoSit',
		} );

	}

	// per frame: the cameras and the long lenses follow the play; between pitches the photographers sit
	// back and check their shots; the tally lights; the rain covers and hoods on the 27th
	update( S, dt ) {

		const ball = S.ball;
		const inPlay = S.seg.kind === 'inplay' && ball;
		const k = 1 - Math.exp( - dt * 3.5 );
		const wetFlags = S.first ? FLAG.cover : 0;
		// FOX's truck cuts between the cameras: one of the low ones is on the air now and then (the
		// batter between pitches, the replays after a play)
		const cut = Math.floor( S.t / 9 );
		const onAir = S.seg.kind === 'pitch' || S.seg.kind === 'inplay' ? - 1 : Math.floor( rnd( cut ) * ( this.cams.length + 2 ) );
		this.cams.forEach( ( c, i ) => {

			const tgt = inPlay ? ball : [ 0, 1.0, - 0.2 ];
			const dx = tgt[ 0 ] - c.x, dz = tgt[ 2 ] - c.z;
			const yaw = clampTurn( Math.atan2( - dx, - dz ), c.face, 1.3 );
			c.yaw += wrap( yaw - c.yaw ) * k;
			const pitch = Math.atan2( ( tgt[ 1 ] ?? 1 ) - ( c.y + 1.42 ), Math.hypot( dx, dz ) );
			c.pitch += ( pitch - c.pitch ) * k;
			c.head.yaw = c.yaw;
			c.head.look[ 1 ] = - c.pitch;
			c.head.flags = wetFlags | ( i === onAir ? FLAG.onAir : 0 );
			// the operator behind it, turned with it; off the eyepiece between the plays
			c.op.x = c.x + Math.sin( c.yaw ) * 0.6;
			c.op.z = c.z + Math.cos( c.yaw ) * 0.6;
			c.op.y = c.y;
			c.op.yaw = c.yaw;
			const off = S.seg.kind === 'switch' || S.seg.kind === 'change' || S.seg.kind === 'intro';
			c.op.morph += ( ( off ? 1 : 0 ) - c.op.morph ) * k;
			c.op.flags = ( S.first ? FLAG.hood : FLAG.cap );
			c.op.wet = S.first ? S.rain * 0.8 : 0;

		} );

		// the photographers
		const breakK = S.seg.kind === 'walkup' || S.seg.kind === 'switch' || S.seg.kind === 'change' || S.seg.kind === 'intro';
		for ( const p of this.photogs ) {

			const f = p.f;
			// what he's on: the ball in play, the pile at the end, else his subject
			const tgt = S.celebrate ? [ 0, - 18 ] : inPlay ? [ ball[ 0 ], ball[ 2 ] ] : p.subject;
			const yaw = clampTurn( Math.atan2( - ( tgt[ 0 ] - p.x ), - ( tgt[ 1 ] - p.z ) ), p.face, 1.2 );
			if ( ! p.changer ) f.yaw += wrap( yaw - f.yaw ) * ( 1 - Math.exp( - dt * 3.5 / p.lag ) );
			// between batters he sits back and checks the back of the camera (each in his own time)
			let rest = breakK && ( ( S.lt + p.phase ) % 23 ) < 15 ? 1 : 0;
			if ( S.celebrate ) rest = 0;
			if ( p.changer ) {

				// the lens change: a slow cycle, twisting the zoom off and the next one on
				const c = ( S.t + p.phase ) % 45;
				rest = c < 2 ? c / 2 : c < 8 ? 1 : c < 10 ? 1 - ( c - 8 ) / 2 : 0;

			}

			f.morph += ( rest - f.morph ) * ( 1 - Math.exp( - dt * 2.5 ) );
			// his head: down at the camera's back when he's checking it
			f.look[ 1 ] = p.sit ? f.morph * 0.35 : p.changer ? 0.45 : f.morph * 0.1;
			// the 27th: rain covers on the glass, hoods up on some
			f.flags = p.base | wetFlags | ( S.first && p.hoodie ? FLAG.hood : 0 );
			if ( S.first && p.hoodie ) f.flags &= ~ ( FLAG.cap | FLAG.beanie );
			f.wet = S.first ? S.rain * 0.9 : 0;

		}

		for ( const s of this.sound ) {

			s.morph = 0.5 + 0.5 * Math.sin( S.t * 0.2 + s.seed * 9 );
			s.flags = S.first ? FLAG.hood : 0;
			s.wet = S.first ? S.rain * 0.8 : 0;

		}

	}

}

const xyz = ( p ) => ( { x: p[ 0 ], y: p[ 1 ], z: p[ 2 ] } );
const wrap = ( a ) => {

	while ( a > Math.PI ) a -= 2 * Math.PI;
	while ( a < - Math.PI ) a += 2 * Math.PI;
	return a;

};
// a heading, kept within `max` of the well's facing (they can't shoot through the partition)
const clampTurn = ( a, face, max ) => face + Math.max( - max, Math.min( max, wrap( a - face ) ) );
