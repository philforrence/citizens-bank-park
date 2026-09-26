import * as THREE from '../engine/index.js';

// First-person walker for the ballpark: a capsule on the ground + walkable colliders (concourses,
// stairs, seating rows). The walking part of Tidewater's player/Player.js, without the water and the
// boat.
//   W A S D move, Shift sprints, Space jumps. Steps up to STEP high are climbed without jumping.
const EYE = 1.62;
const RADIUS = 0.3;
const HEIGHT = 1.75;
const STEP = 0.62; // highest ledge you walk up onto: a stair riser is ~0.18 m, an upper deck's row 0.6
const WALK = 3.0; // m/s
const SPRINT = 6.2;

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _e = new THREE.Euler( 0, 0, 0, 'YXZ' );

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
		const speed = sprint ? SPRINT : WALK;
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
		this.colliders.resolveCapsule( p, RADIUS, HEIGHT, STEP );
		const g = this.groundAt( p.x, p.z, p.y + STEP + 0.05 );
		if ( p.y <= g ) {

			p.y = g;
			if ( this.velocity.y < 0 ) this.velocity.y = 0;
			this.grounded = true;

		} else if ( this.grounded && this.velocity.y <= 0 && p.y - g < STEP ) {

			// walking down stairs: stay on them instead of hopping off each step
			p.y = g;
			this.velocity.y = 0;

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
