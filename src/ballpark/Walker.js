import * as THREE from '../engine/index.js';
import { castPool } from './places/Cast.js';

// First-person walker for the ballpark: a capsule on the ground + walkable colliders (concourses,
// stairs, seating rows). The walking part of Tidewater's player/Player.js, without the water and the
// boat.
//   W A S D move, Shift hurries, Space jumps. Steps up to STEP high are climbed without jumping, and the
// eye eases over them (it used to jump each riser in one frame). The seated fans are in the way
// (`blocked`, BallparkApp's grid of them): you go up and down the stands by the aisles, not through the
// rows.
const EYE = 1.62;
const RADIUS = 0.3;
const HEIGHT = 1.75;
const STEP = 0.62; // highest ledge you walk up onto: a stair riser is ~0.18 m, an upper deck's row 0.6
// a stroll, as the concourse crowd walks (1.2-1.4 m/s; it was 3.0, a jog that overtook everyone), and
// a hurry on Shift; G doubles both
const WALK = 1.9; // m/s
const SPRINT = 4.6;

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _e = new THREE.Euler( 0, 0, 0, 'YXZ' );
const _inv = new THREE.Matrix4();
const _f = new THREE.Vector3();

export class Walker {

	constructor( { camera, input, ground, colliders, start, audio = null } ) {

		this.camera = camera;
		this.input = input;
		this.ground = ground;
		this.colliders = colliders;
		this.audio = audio;

		this.mode = 'walk';
		this.position = new THREE.Vector3();
		this.velocity = new THREE.Vector3();
		this.yaw = 0;
		this.pitch = - 0.05;
		this.grounded = false;
		this.bob = 0;
		this.stepDist = 0;
		this.prompt = null;
		// things you can use with E: { x, y, z (world), radius, text: () => string, action: () => void }
		this.interactables = [];
		// eye height easing (critically damped), so dropping in from the free camera doesn't jump
		this.camOff = 0;
		this.camOffV = 0;
		this._camY = null;
		this.setPose( start.position, start.yaw );

	}

	setPose( position, yaw, pitch = - 0.05 ) {

		this.position.copy( position );
		// stand on the floor at (or just under) the given height: under a deck, not on top of it
		this.position.y = Math.max( this.position.y, this.groundAt( position.x, position.z, position.y + STEP + 0.05 ) );
		this.velocity.set( 0, 0, 0 );
		this.yaw = yaw;
		this.pitch = pitch;
		this.grounded = false;

	}

	groundAt( x, z, maxY ) {

		return Math.max( this.ground.heightAt( x, z ), this.colliders.groundHeightAt( x, z, maxY ) );

	}

	// ---- FW6 (C4W-5): the people close by push the walker (feet p, world) out to arm's length
	_pushFromPeople( p ) {

		// (every person in the pool, where their place put them and as far as they've stepped aside: a few
		// thousand box tests, ~20 us; the places' people stand in the field's frame)
		const pool = castPool(), L = pool?.people;
		if ( ! L || ! L.length || ! pool.group ) return;
		pool.walkerSeen = true;
		_inv.copy( pool.group.matrixWorld ).invert();
		_f.copy( p ).applyMatrix4( _inv );
		const fx = _f.x, fy = _f.y, fz = _f.z;
		let mx = 0, mz = 0;
		for ( let i = 0; i < L.length; i ++ ) {

			const q = L[ i ];
			const dx = fx - q.x - ( q._ax || 0 );
			if ( dx > 0.7 || dx < - 0.7 ) continue;
			const dz = fz - q.z - ( q._az || 0 );
			if ( dz > 0.7 || dz < - 0.7 ) continue;
			const dy = fy - q.y;
			if ( dy < - 1.2 || dy > 1.2 || ! q.visible ) continue;
			const R = RADIUS + 0.22 * ( q.scale || 1 ), d2 = dx * dx + dz * dz;
			if ( d2 >= R * R ) continue;
			const d = Math.sqrt( d2 ) || 0.001;
			const k = ( R - d ) * 0.35;
			mx += dx / d * k; mz += dz / d * k;

		}
		if ( mx === 0 && mz === 0 ) return;
		// back to the world (the field's frame is turned and moved, not scaled)
		_f.x += mx; _f.z += mz;
		_f.applyMatrix4( pool.group.matrixWorld );
		p.x = _f.x; p.z = _f.z;

	}
	// ---- end FW6

	update( dt ) {

		const inp = this.input;
		this.prompt = null;
		const look = inp.consumeLook();
		this.yaw -= look.x * 0.0022;
		this.pitch = THREE.MathUtils.clamp( this.pitch - look.y * 0.0022, - 1.5, 1.5 );

		this.updateWalk( dt );
		this.updateInteract();

		const eye = this.position.clone();
		eye.y += EYE + Math.sin( this.bob ) * 0.035;
		if ( this._camY === null || this.camera.position.y !== this._camY ) {

			// something else drove the camera since our last frame (the free camera): start fresh
			this.camOff = 0;
			this.camOffV = 0;

		}

		const w = 6, e = Math.exp( - w * dt ), j = ( this.camOffV + w * this.camOff ) * dt;
		this.camOff = ( this.camOff + j ) * e;
		this.camOffV = ( this.camOffV - w * j ) * e;
		eye.y += this.camOff;
		this.camera.position.copy( eye );
		this._camY = this.camera.position.y;
		this.camera.quaternion.setFromEuler( _e.set( this.pitch, this.yaw, 0 ) );

	}

	// the nearest thing in reach gets the E prompt; E uses it
	updateInteract() {

		let best = null, bestD = Infinity;
		const p = this.position;
		for ( const it of this.interactables ) {

			const d = Math.hypot( it.x - p.x, it.z - p.z );
			if ( d < it.radius && Math.abs( it.y - p.y ) < 1.5 && d < bestD ) {

				best = it;
				bestD = d;

			}

		}

		if ( ! best ) return;
		this.prompt = { key: 'E', text: best.text() };
		if ( this.input.hit( 'KeyE' ) ) best.action();

	}

	updateWalk( dt ) {

		const inp = this.input;
		_fwd.set( - Math.sin( this.yaw ), 0, - Math.cos( this.yaw ) );
		_right.set( - _fwd.z, 0, _fwd.x );
		const wish = new THREE.Vector3();
		if ( inp.down( 'KeyW' ) ) wish.add( _fwd );
		if ( inp.down( 'KeyS' ) ) wish.sub( _fwd );
		if ( inp.down( 'KeyD' ) ) wish.add( _right );
		if ( inp.down( 'KeyA' ) ) wish.sub( _right );
		if ( wish.lengthSq() > 0 ) wish.normalize();

		const sprint = inp.down( 'ShiftLeft' ) || inp.down( 'ShiftRight' );
		// G doubles it (speedScale, BallparkApp)
		const speed = ( sprint ? SPRINT : WALK ) * ( this.speedScale || 1 );
		const accel = this.grounded ? 14 : 2.5;
		const k = 1 - Math.exp( - accel * dt );
		this.velocity.x += ( wish.x * speed - this.velocity.x ) * k;
		this.velocity.z += ( wish.z * speed - this.velocity.z ) * k;

		if ( this.grounded && inp.hit( 'Space' ) ) {

			this.velocity.y = 4.6;
			this.grounded = false;

		}

		this.velocity.y -= 9.81 * dt;

		const p = this.position;
		const old = p.clone();
		p.addScaledVector( this.velocity, dt );
		// ---- FW6 (C4W-5): the people standing and walking about (everyone in the Cast's pool, where they
		// were last drawn): each pushes you out to arm's length softly, a part of the overlap a step, so
		// you're held behind a line or the rail's crowd and ease past someone as they step aside (they make
		// way in the pool). You walked through them: a crowd of holograms. (Before the colliders, which have
		// the last word: a push never puts you in a wall)
		this._pushFromPeople( p );
		this.colliders.resolveCapsule( p, RADIUS, HEIGHT, STEP );
		// the seated fans: pushed back out from among them (the aisles are clear)
		if ( this.blocked ) this.blocked( p, RADIUS );
		const g = this.groundAt( p.x, p.z, p.y + STEP + 0.05 );
		const y0 = p.y;
		if ( p.y <= g ) {

			p.y = g;
			if ( this.velocity.y < 0 ) this.velocity.y = 0;
			// up a step: the eye follows over a moment instead of in one frame
			if ( this.grounded && g - y0 > 0.03 ) this.camOff -= g - y0;
			this.grounded = true;

		} else if ( this.grounded && this.velocity.y <= 0 && p.y - g < STEP ) {

			// walking down stairs: stay on them instead of hopping off each step (the eye eased down)
			p.y = g;
			this.velocity.y = 0;
			if ( y0 - g > 0.03 ) this.camOff += y0 - g;

		} else {

			this.grounded = p.y - g < 0.06;

		}

		// head bob + footsteps
		const moved = Math.hypot( p.x - old.x, p.z - old.z );
		if ( this.grounded ) {

			this.bob += moved * 2.4;
			this.stepDist += moved;
			const stride = sprint ? 0.9 : 0.62;
			if ( this.stepDist > stride ) {

				this.stepDist = 0;
				if ( this.audio && this.audio.footstep ) this.audio.footstep( 'concrete' );

			}

		}

	}

}
