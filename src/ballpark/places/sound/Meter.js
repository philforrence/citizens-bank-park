// For checking the soundscape's mix without ears (QA, through the render desk's js): play the replay from
// t for a few seconds of real time, the director and the sound updating (nothing drawn), with a meter on
// every bus and on the master, and report their levels.
//
//   const { listen } = await import( '/src/ballpark/places/sound/Meter.js' );
//   await listen( __app, { t: 2290, seconds: 8, at: [ 0, 8, 45 ] } )
//     -> { rows: [ { t, master, crowd, pa, music, weather, field } dB RMS per half second ], peak (dBFS) }
//
//   zones( __app, [ [ x, y, z ], ... ] ) -> the space's reading at field points (zone, weights, ceiling)

export async function listen( app, { t, seconds = 6, at = null, speed = 1 } = {} ) {

	const S = app.sound, sc = app.soundscape, d = app.director;
	S.resume();
	const F = app.field, cam = app.camera;
	if ( at ) {

		const w = F.toWorld( at[ 0 ], at[ 2 ] );
		cam.position.set( w.x, F.y0 + at[ 1 ], w.z );
		cam.updateMatrixWorld();

	}

	// let it start (the first update builds the soundscape)
	for ( let i = 0; i < 3 && ! sc.ready; i ++ ) {

		sc.update( 1 / 60, d, cam );
		await new Promise( ( r ) => setTimeout( r, 100 ) );

	}

	const names = [ 'crowd', 'pa', 'music', 'weather', 'field' ];
	const meters = {};
	for ( const n of names ) {

		const a = S.ctx.createAnalyser();
		a.fftSize = 2048;
		S.buses[ n ]?.connect( a );
		meters[ n ] = a;

	}

	const m = S.ctx.createAnalyser();
	m.fftSize = 2048;
	sc.limiter.connect( m );
	meters.master = m;
	d.seek( t );
	d.playing = true;
	d.speed = speed;
	// what a jump in the replay does: the timeline's pointer moved, the one-shots cut
	sc._jump( t );
	sc.lastT = t;
	const buf = new Float32Array( 2048 ), acc = {}, rows = [];
	let last = performance.now(), peak = 0, n = 0;
	const t0 = last;
	while ( performance.now() - t0 < seconds * 1000 ) {

		await new Promise( ( r ) => setTimeout( r, 40 ) );
		const now = performance.now(), dt = Math.min( 0.1, ( now - last ) / 1000 );
		last = now;
		d.update( dt );
		for ( const p of app.places ) if ( p.name === 'phanatic' || p.name === 'sound' ) p.update?.( dt, d, cam );
		S.listen( cam );
		for ( const [ k, a ] of Object.entries( meters ) ) {

			a.getFloatTimeDomainData( buf );
			let s = 0;
			for ( let i = 0; i < buf.length; i ++ ) {

				s += buf[ i ] * buf[ i ];
				if ( k === 'master' ) peak = Math.max( peak, Math.abs( buf[ i ] ) );

			}

			( acc[ k ] ||= [] ).push( s / buf.length );

		}

		if ( ++ n % 12 === 0 ) {

			const row = { t: Math.round( d.t * 10 ) / 10 };
			for ( const k of Object.keys( meters ) ) {

				const v = acc[ k ].reduce( ( a, b ) => a + b, 0 ) / acc[ k ].length;
				row[ k ] = Math.round( 10 * Math.log10( v + 1e-12 ) );
				acc[ k ] = [];

			}

			rows.push( row );

		}

	}

	for ( const a of Object.values( meters ) ) try {

		a.disconnect();

	} catch {}

	for ( const n of names ) try {

		S.buses[ n ]?.disconnect( meters[ n ] );

	} catch {}

	try {

		sc.limiter.disconnect( m );

	} catch {}

	return { rows, peak: Math.round( 20 * Math.log10( peak + 1e-9 ) * 10 ) / 10, zone: sc.space.zone };

}

export function zones( app, points ) {

	const sp = app.soundscape.space, F = app.field;
	return points.map( ( [ x, y, z ] ) => {

		const w = F.toWorld( x, z );
		sp.t = 0;
		sp.update( 0.3, { position: { x: w.x, y: F.y0 + y, z: w.z } } );
		const r = ( v ) => Math.round( v * 100 ) / 100;
		return { at: [ x, y, z ], zone: sp.zone, ceiling: r( sp.ceiling ), w: Object.fromEntries( Object.entries( sp.w ).map( ( [ k, v ] ) => [ k, r( v ) ] ) ) };

	} );

}

// A piece of the music rendered offline (an OfflineAudioContext, the band's or the organ's own code), as a
// 16-bit mono WAV in base64, for looking at off the page (a spectrogram).
//   await render( 'band', 'utley', 8 )  |  await render( 'organ', 'saints', 10 )
export async function render( kind, name, seconds = 8, sr = 22050 ) {

	const ctx = new OfflineAudioContext( 1, Math.ceil( seconds * sr ), sr );
	let part = null;
	if ( kind === 'band' ) {

		const { Band } = await import( './Band.js' );
		part = new Band( ctx, ctx.destination );
		part.play( name, seconds, 1 );

	} else {

		const { Organ, score } = await import( './Organ.js' );
		const { TUNES } = await import( './Tunes.js' );
		const org = new Organ( ctx, ctx.destination ), tune = TUNES[ name ], beat = 60 / tune.bpm;
		for ( const [ b, m, d, lvl, perc ] of score( tune ) ) if ( b * beat < seconds - 0.2 ) org.note( m, 0.05 + b * beat, d * beat, lvl, tune.reg, perc );
		org.spin( !! tune.fast );

	}

	for ( let now = 0; part && now < seconds; now += 0.2 ) part.update( now );
	const buf = await ctx.startRendering();
	const x = buf.getChannelData( 0 );
	let peak = 0;
	for ( let i = 0; i < x.length; i ++ ) peak = Math.max( peak, Math.abs( x[ i ] ) );
	const n = x.length, bytes = new Uint8Array( 44 + n * 2 ), dv = new DataView( bytes.buffer );
	const w = ( o, s ) => [ ...s ].forEach( ( c, i ) => dv.setUint8( o + i, c.charCodeAt( 0 ) ) );
	w( 0, 'RIFF' ); dv.setUint32( 4, 36 + n * 2, true ); w( 8, 'WAVE' ); w( 12, 'fmt ' ); dv.setUint32( 16, 16, true );
	dv.setUint16( 20, 1, true ); dv.setUint16( 22, 1, true ); dv.setUint32( 24, sr, true ); dv.setUint32( 28, sr * 2, true );
	dv.setUint16( 32, 2, true ); dv.setUint16( 34, 16, true ); w( 36, 'data' ); dv.setUint32( 40, n * 2, true );
	for ( let i = 0; i < n; i ++ ) dv.setInt16( 44 + i * 2, Math.max( - 1, Math.min( 1, x[ i ] ) ) * 32767, true );
	let s = '';
	for ( let i = 0; i < bytes.length; i += 32768 ) s += String.fromCharCode( ...bytes.subarray( i, i + 32768 ) );
	return { name, peak: Math.round( 20 * Math.log10( peak + 1e-9 ) * 10 ) / 10, wav: btoa( s ) };

}
