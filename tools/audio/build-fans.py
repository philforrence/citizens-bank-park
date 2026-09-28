#!/usr/bin/env python3
"""The crowd's voices (public/audio/ballpark/fans/): many people at once, made from one person at a time.

    python tools/audio/build-fans.py              # every clip
    python tools/audio/build-fans.py letsgo boo   # some
    python tools/audio/build-fans.py --asr        # also transcribe the single shouts (faster-whisper)

Every voice is Piper TTS (MIT) with only its CC0 and public-domain voices (joe, mike, kathleen: CC0; norman, john,
bryce, kristin, ljspeech: public domain), through a WORLD vocoder (pyworld) pass of our own here: the words sung onto a
beat grid (each syllable's vowel landing on its beat, held to the next, the consonants kept their own length) at a
note, with the person's own pitch, vocal tract (formants), push (a shout's flatter spectrum), hoarseness, pitch
error, drift and vibrato. Then many of them stacked: each a little early or late, a little sharp or flat, near or
far (the far ones quieter, darker and later), men and women (the women an octave up):

  letsgo          "Let's go Phil-lies!" then clap clap, clap-clap-clap (a section, one time round; the park
                  loops it and spreads it round the bowl: Fans.js)
  charge          the yell after the organ's "Charge!"
  boo-1, boo-2    the boos (the Rays introduced, the umpire's third strike)
  aww             the "aww" of a two-strike ball
  stretch         45,000 singing "Take Me Out to the Ball Game" (Norworth and Von Tilzer, 1908: public domain) with
                  the organ at the stretch on the 29th (A's melody and tempo, phanatic/Sounds.js)
  walla-27, -29   a concourse's talk, packed in out of the rain on the 27th, keyed up on the 29th (loops)
  shout-*         one fan near you: "Eva!" at Longoria, "Come on, Cole, one more!", "We did it!"...

Dry: the game adds the stadium (the distance, the rooms, the echo). 22 kHz mono MP3s, with index.json.
"""
import importlib.util, json, os, subprocess, sys, zlib
from pathlib import Path
import numpy as np
from scipy import signal
from scipy.ndimage import gaussian_filter1d
import soundfile as sf
import pyworld as pw

ROOT = Path( __file__ ).resolve().parents[ 2 ]
spec = importlib.util.spec_from_file_location( 'home', ROOT / 'tools' / 'audio' / 'build-home.py' )
H = importlib.util.module_from_spec( spec )
spec.loader.exec_module( H )
H.VOICE_FILES[ 'kathleen' ] = ( 'en_US-kathleen-low', 'kathleen/low', 'CC0' )
OUT = ROOT / 'public' / 'audio' / 'ballpark' / 'fans'
WAVS = H.WORK / 'fans-wav'
SR = H.SRV
FP = 5.0
MIDI = lambda m: 440.0 * 2 ** ( ( m - 69 ) / 12 )
NOTE = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 }
def note( s ):
	n, o = s[ :-1 ], int( s[ -1 ] )
	return 12 * ( o + 1 ) + NOTE[ n ]

# ------------------------------------------------------------------ one voice, sung onto a grid

def sing( person, text, beats, notes, spb, rng, take = 0, hold = 0.92, tail = None ):
	"""text's syllables sung at beats (start of each, in beats) with notes (midi or None: speak it), each vowel
	held to hold x the gap to the next one, the last one `tail` seconds. Returns ( audio (float64, SR), where the
	output starts on the grid (s, from beat 0) )."""
	x, items = H.tts( person[ 'voice' ], text, person.get( 'ls', 1.0 ), 0.6, 0.8, take )
	# only the words (Piper can leave a breath or a click after the last one)
	spoken = [ b for p, a, b in items if p.strip() and p not in '.,!?;:$^' ]
	if spoken:
		x = x[ :min( len( x ), max( spoken ) + int( 0.05 * SR ) ) ]
	nuc = H.nuclei( items )
	n = len( nuc )
	if n != len( beats ):
		raise ValueError( f'{text!r}: {n} syllables ({"".join( p for p, a, b in items )}), {len( beats )} beats' )
	fs = SR
	f0, t = pw.harvest( x, fs, f0_floor = 60, f0_ceil = 650, frame_period = FP )
	sp = pw.cheaptrick( x, f0, t, fs )
	ap = pw.d4c( x, f0, t, fs )
	nF = len( f0 )
	hop = fs * FP / 1000
	# anchors (input frame -> output time, s): each vowel's onset on its beat; its end just before the next
	# syllable's consonants start; the consonants keep their length
	T = [ b * spb for b in beats ]
	anc = []
	for k, ( a, b, av ) in enumerate( nuc ):
		fa, fv, fb = a / hop, av / hop, b / hop
		# the consonants before the vowel: from the previous nucleus' end (or the start)
		prev_end = nuc[ k - 1 ][ 1 ] / hop if k else 0
		cons = max( 0.0, fv - prev_end ) * FP / 1000
		anc.append( ( prev_end, T[ k ] - min( cons, 0.18 ) ) )
		anc.append( ( fv, T[ k ] ) )
		nxt = T[ k + 1 ] if k + 1 < n else T[ k ] + ( tail / hold if tail else max( 0.25, ( fb - fv ) * FP / 1000 * 1.2 ) )
		# the consonants after it (to the next vowel, or the end)
		after = ( ( nuc[ k + 1 ][ 2 ] if k + 1 < n else len( x ) ) / hop - fb ) * FP / 1000
		vowel_end = T[ k ] + max( ( fb - fv ) * FP / 1000, ( nxt - T[ k ] ) * hold - min( after, 0.18 ) )
		anc.append( ( fb, vowel_end ) )
	anc.append( ( nF - 1, anc[ -1 ][ 1 ] + ( nF - 1 - nuc[ -1 ][ 1 ] / hop ) * FP / 1000 ) )
	anc = sorted( anc )
	# monotonic in both
	fi, to = [ anc[ 0 ][ 0 ] ], [ anc[ 0 ][ 1 ] ]
	for a, b in anc[ 1: ]:
		if a > fi[ -1 ] + 0.5 and b > to[ -1 ] + 0.002:
			fi.append( a )
			to.append( b )
	t0 = to[ 0 ]
	to = [ v - t0 for v in to ]   # output starts where the first consonant does
	nO = int( to[ -1 ] / ( FP / 1000 ) ) + 1
	outT = np.arange( nO ) * FP / 1000
	q = np.clip( np.interp( outT, to, fi ), 0, nF - 1 )
	k0 = np.floor( q ).astype( int )
	k1 = np.minimum( k0 + 1, nF - 1 )
	fr = ( q - k0 )[ :, None ]
	lsp = np.log( sp + 1e-16 )
	lsp_o = lsp[ k0 ] * ( 1 - fr ) + lsp[ k1 ] * fr
	ap_o = ap[ k0 ] * ( 1 - fr ) + ap[ k1 ] * fr
	voiced = ( f0 > 0 )[ np.round( q ).astype( int ) ]
	# the pitch: each syllable's note (sung), or the voice's own contour moved to the person (spoken)
	base = person[ 'base' ]
	lf = np.log( np.where( f0 > 0, f0, 1.0 ) )
	idx = np.where( f0 > 0 )[ 0 ]
	lfc = np.interp( np.arange( nF ), idx, lf[ idx ] ) if len( idx ) else np.full( nF, np.log( 120 ) )
	med = np.median( lf[ idx ] ) if len( idx ) else np.log( 120 )
	spoken = np.log( base ) + person.get( 'range', 1.2 ) * ( np.interp( q, np.arange( nF ), lfc ) - med )
	lf_o = spoken.copy()
	err = person.get( 'err', 0.0 )   # this singer's pitch error, semitones
	for k in range( n ):
		if notes[ k ] is None:
			continue
		s0 = T[ k ] - t0 - 0.03
		s1 = ( T[ k + 1 ] - t0 ) if k + 1 < n else outT[ -1 ] + 1
		m = ( outT >= s0 ) & ( outT < s1 )
		tt = outT[ m ] - s0
		target = np.log( MIDI( notes[ k ] + person.get( 'octave', 0 ) * 12 + err ) )
		# scoop up into it, a little vibrato once it's held
		scoop = person.get( 'scoop', 1.2 ) * np.exp( - tt / 0.06 )
		vib = 0.25 * np.sin( 2 * np.pi * 5.4 * tt + rng.uniform( 0, 6 ) ) * H.smoothstep( ( tt - 0.25 ) / 0.3 )
		lf_o[ m ] = target + np.log( 2 ) * ( - scoop + vib ) / 12
	drift = person.get( 'drift', 0.15 ) * H.lp_noise( rng, nO, 40 )
	lf_o = lf_o + np.log( 2 ) * drift / 12 + person.get( 'jit', 0.006 ) * rng.standard_normal( nO )
	f0_o = np.where( voiced, np.exp( lf_o ), 0.0 )
	# the person: tract, push, hoarseness
	nb = sp.shape[ 1 ]
	fftlen = ( nb - 1 ) * 2
	f = np.arange( nb ) * fs / fftlen
	src = np.clip( f / person.get( 'formant', 1.0 ) / ( fs / fftlen ), 0, nb - 1 )
	s0i = np.floor( src ).astype( int )
	s1i = np.minimum( s0i + 1, nb - 1 )
	sfr = src - s0i
	lsp_o = lsp_o[ :, s0i ] * ( 1 - sfr ) + lsp_o[ :, s1i ] * sfr
	tilt = person.get( 'tilt', 5.0 )
	gdb = tilt * np.clip( np.log2( np.maximum( f, 1 ) / 400 ) / 3, 0, 1 )
	vw = gaussian_filter1d( voiced.astype( float ), 1.5 )[ :, None ]
	lsp_o = lsp_o + ( vw * gdb[ None, : ] - ( 1 - vw ) * 3 ) * np.log( 10 ) / 10
	Hh = person.get( 'hoarse', 0.15 ) * np.clip( ( f - 600 ) / 2400, 0, 1 ) ** 0.7
	ap_o = np.clip( 1 - ( 1 - ap_o ) * ( 1 - np.clip( Hh[ None, : ], 0, 0.95 ) ), 0.001, 0.999 )
	y = pw.synthesize( np.ascontiguousarray( f0_o ), np.ascontiguousarray( np.exp( lsp_o ) ), np.ascontiguousarray( ap_o ), fs, FP )
	y = H.hp( y, fs, 90 )
	return H.fade( y, fs, 0.005, 0.04 ), t0

# ------------------------------------------------------------------ the people

VOICES_M = [ 'joe', 'mike', 'bryce', 'john', 'norman' ]
VOICES_F = [ 'kristin', 'ljspeech', 'kathleen' ]

def person( rng, woman = None, shout = 1.0 ):
	"""someone in the crowd"""
	woman = rng.random() < 0.32 if woman is None else woman
	return dict(
		voice = str( rng.choice( VOICES_F if woman else VOICES_M ) ),
		base = float( rng.uniform( 185, 250 ) if woman else rng.uniform( 98, 145 ) ),
		octave = 1 if woman else 0,
		formant = float( rng.uniform( 1.0, 1.12 ) if woman else rng.uniform( 0.9, 1.04 ) ),
		tilt = float( rng.uniform( 4, 9 ) * shout ),
		hoarse = float( rng.uniform( 0.08, 0.45 ) ),
		err = float( rng.normal( 0, 0.35 ) ),
		drift = float( rng.uniform( 0.1, 0.35 ) ),
		scoop = float( rng.uniform( 0.6, 2.0 ) ),
		range = float( rng.uniform( 1.1, 1.6 ) ),
		ls = float( rng.uniform( 0.92, 1.08 ) ),
	)

def crowd( name, parts, n, dur, spb = 0.5, seed = None, spread = 0.05, far = 0.15, woman = None, shout = 1.0, origin = 0.15, tail = None ):
	"""n people singing parts [( text, beats, notes )] on the same grid, beat 0 at `origin` s; returns the mix,
	dur seconds"""
	rng = np.random.default_rng( zlib.crc32( name.encode() ) if seed is None else seed )
	out = np.zeros( int( dur * SR ) )
	made = 0
	for i in range( n ):
		p = person( rng, woman, shout )
		late = rng.normal( 0, spread )
		dist = rng.uniform( 0, 1 ) ** 1.5
		for text, beats, notes in parts:
			try:
				y, t0 = sing( p, text, beats, notes, spb, rng, take = i % 3, tail = tail )
			except Exception as e:
				print( '   skip', p[ 'voice' ], e )
				continue
			# near or far: later, quieter, darker
			y = H.lp( y, SR, 9000 - 6500 * dist, 2 )
			y = y / ( np.max( np.abs( y ) ) + 1e-9 ) * ( 1 - 0.6 * dist ) * rng.uniform( 0.6, 1.0 )
			at = int( ( origin + t0 + late + far * dist ) * SR )
			at = max( 0, at )
			m = min( len( y ), len( out ) - at )
			if m > 0:
				out[ at:at + m ] += y[ :m ]
		made += 1
	print( f'   {name}: {made} voices' )
	return out

def claps( times, n, dur, seed = 3, spread = 0.02 ):
	"""n people clapping at times (s)"""
	rng = np.random.default_rng( seed )
	out = np.zeros( int( dur * SR ) )
	L = int( 0.035 * SR )
	for c in range( n ):
		fc = rng.uniform( 900, 2300 )
		b, a = signal.butter( 2, [ fc / 1.6, fc * 1.4 ], 'bandpass', fs = SR )
		far = rng.uniform( 0, 1 ) ** 2 * 0.08
		amp = rng.uniform( 0.3, 1.0 )
		for t in times:
			if rng.random() < 0.08:
				continue
			z = rng.standard_normal( L ) * np.exp( - np.arange( L ) / SR / rng.uniform( 0.005, 0.012 ) )
			z = signal.lfilter( b, a, z ) * amp
			at = int( ( t + far + rng.normal( 0, spread ) ) * SR )
			if 0 <= at < len( out ) - L:
				out[ at:at + L ] += z
	return out

def master( y, peak = -1.0, lufs = -18.0 ):
	y = H.hp( y, SR, 80 )
	y = H.compress( y, SR, -20, 2.0 )
	return H.to_loudness( y, SR, lufs )

# ------------------------------------------------------------------ the clips

def letsgo():
	# "Let's go Phil-lies!" on four beats (Phil up, lies down), then the hands: clap, clap, clap-clap-clap
	# (quarter, quarter, eighth, eighth, quarter); eight beats at 158 bpm, one time round; it loops
	spb, O = 0.38, 0.15
	parts = [ ( "Let's go Phillies!", [ 0, 1, 2, 3 ], [ note( 'G3' ), note( 'G3' ), note( 'B3' ), note( 'G3' ) ] ) ]
	v = crowd( 'letsgo', parts, 44, 8 * spb, spb, spread = 0.035, shout = 1.3, origin = O, tail = 0.42 )
	c = claps( [ O + b * spb for b in ( 4, 5, 6, 6.5, 7 ) ], 120, 8 * spb )
	y = v / ( np.max( np.abs( v ) ) + 1e-9 ) + 0.55 * c / ( np.max( np.abs( c ) ) + 1e-9 )
	return master( y ), dict( cycle = round( 8 * spb, 3 ) )

def charge():
	parts = [ ( 'Charge!', [ 0 ], [ note( 'A3' ) ] ) ]
	v = crowd( 'charge', parts, 44, 1.6, 0.5, spread = 0.06, shout = 1.5, tail = 0.55 )
	return master( v ), {}

def boo( k ):
	# a long "boo", each his own pitch and length, sliding down a little
	rng = np.random.default_rng( 70 + k )
	out = np.zeros( int( 3.4 * SR ) )
	for i in range( 40 ):
		p = person( rng, shout = 1.2 )
		ln = rng.uniform( 1.2, 2.6 )
		start = rng.uniform( 0, 0.7 )
		m0 = 50 + rng.uniform( -3, 5 )
		try:
			y, t0 = sing( p, 'Boo!', [ 0 ], [ m0 ], 1.0, rng, take = i % 3, tail = ln )
		except Exception as e:
			continue
		dist = rng.uniform( 0, 1 ) ** 1.5
		y = H.lp( y, SR, 8000 - 5000 * dist, 2 )
		y = y / ( np.max( np.abs( y ) ) + 1e-9 ) * ( 1 - 0.55 * dist )
		at = int( ( start + 0.12 * dist ) * SR )
		m = min( len( y ), len( out ) - at )
		out[ at:at + m ] += y[ :m ] * np.linspace( 1, 0.7, m )
	return master( H.fade( out, SR, 0.08, 0.5 ) ), {}

def aww():
	parts = [ ( '[[ ˈɔː ]]', [ 0 ], [ note( 'D4' ) ] ) ]
	v = crowd( 'aww', parts, 36, 1.8, 1.2, spread = 0.07, tail = 0.9 )
	# the "aww" falls
	return master( H.fade( v, SR, 0.02, 0.4 ) ), {}

# "Take Me Out to the Ball Game", the chorus, on A's melody and tempo (phanatic/Sounds.js TAKE_ME_OUT: 180 bpm,
# 3/4, 96 beats): each line's syllables on A's notes
STRETCH = [
	( 'Take me out to the ball game,', [ ( 'G3', 2 ), ( 'G4', 1 ), ( 'E4', 1 ), ( 'D4', 1 ), ( 'B3', 1 ), ( 'D4', 3 ), ( 'A3', 3 ) ] ),
	( 'take me out with the crowd.', [ ( 'G3', 2 ), ( 'G4', 1 ), ( 'E4', 1 ), ( 'D4', 1 ), ( 'B3', 1 ), ( 'D4', 6 ) ] ),
	( 'Buy me some peanuts and Cracker Jack,', [ ( 'E4', 1 ), ( 'D#4', 1 ), ( 'E4', 1 ), ( 'B3', 1 ), ( 'C4', 1 ), ( 'D4', 1 ), ( 'E4', 2 ), ( 'C4', 1 ), ( 'A3', 3 ) ] ),
	( "I don't care if I never get back. Let me", [ ( 'E4', 2 ), ( 'E4', 1 ), ( 'E4', 1 ), ( 'F#4', 1 ), ( 'G4', 1 ), ( 'A4', 1 ), ( 'F#4', 1 ), ( 'E4', 1 ), ( 'D4', 1 ), ( 'B3', 1 ), ( 'A3', 1 ) ] ),
	( 'root, root, root for the home team,', [ ( 'G3', 2 ), ( 'G4', 1 ), ( 'E4', 1 ), ( 'D4', 1 ), ( 'B3', 1 ), ( 'D4', 3 ), ( 'A3', 3 ) ] ),
	( "if they don't win, it's a shame.", [ ( 'A3', 2 ), ( 'G3', 1 ), ( 'A3', 1 ), ( 'B3', 1 ), ( 'C4', 1 ), ( 'D4', 2 ), ( 'E4', 4 ) ] ),
	( "For it's one, two, three strikes, you're", [ ( 'E4', 2 ), ( 'F#4', 1 ), ( 'G4', 3 ), ( 'G4', 3 ), ( 'G4', 1 ), ( 'F#4', 1 ), ( 'E4', 1 ) ] ),
	( 'out at the old ball game!', [ ( 'D4', 2 ), ( 'C#4', 1 ), ( 'D4', 1 ), ( 'E4', 2 ), ( 'F#4', 3 ), ( 'G4', 3 ) ] ),
]

def stretch():
	spb = 60 / 180
	parts, b = [], 0
	for text, ns in STRETCH:
		beats, notes = [], []
		for nm, d in ns:
			beats.append( b )
			notes.append( note( nm ) )
			b += d
		parts.append( ( text, [ x - beats[ 0 ] for x in beats ], notes, beats[ 0 ], ns[ -1 ][ 1 ] ) )
	dur = b * spb + 1.5
	rng = np.random.default_rng( 1908 )
	out = np.zeros( int( dur * SR ) )
	for i in range( 34 ):
		p = person( rng, shout = 0.8 )
		late = rng.normal( 0, 0.05 )
		dist = rng.uniform( 0, 1 ) ** 1.5
		for text, beats, notes, b0, last in parts:
			# some sing every line, some drop out and come back
			if rng.random() < 0.12:
				continue
			try:
				y, t0 = sing( p, text, beats, notes, spb, rng, take = i % 3, hold = 0.95, tail = last * spb * 0.9 )
			except Exception as e:
				print( '   skip', e )
				continue
			y = H.lp( y, SR, 9000 - 6000 * dist, 2 )
			y = y / ( np.max( np.abs( y ) ) + 1e-9 ) * ( 1 - 0.6 * dist )
			at = max( 0, int( ( b0 * spb + t0 + late + 0.12 * dist ) * SR ) )
			m = min( len( y ), len( out ) - at )
			out[ at:at + m ] += y[ :m ]
	return master( out ), dict( bpm = 180, beats = 96 )

WALLA = {
	27: [ "It's really coming down out there.", "I can't feel my feet.", 'You want a hot chocolate?', 'Where are we, one thirty-two?',
		"They're never gonna finish this.", 'Hamels was dealing, too.', 'My poncho ripped.', 'Is that line even moving?',
		"Let's just wait under here.", 'Twenty-eight years, and now this.', 'Did they say anything yet?', 'Hold my beer.',
		"I'm soaked.", 'Two more outs, come on.', 'Excuse me, sorry.', 'This is ridiculous.', "Should've brought gloves.",
		'Is the tarp coming out?', 'Grab some napkins.', "We're not leaving." ],
	29: [ 'Nine more outs.', "Let's go, it's starting.", 'Where are our seats?', 'Jenkins is leading off!', "I didn't sleep.",
		"It's freezing tonight.", 'Get a beer before the sixth.', 'Tonight, it ends tonight.', 'Did you bring the towel?',
		'Come on, come on, we gotta go.', 'I was here Monday, in the rain.', 'Hamels is done, right?', 'Excuse me, pardon me.',
		'This is it.', 'I love this team.', 'You got the tickets?', 'Hurry up!', 'Twenty-eight years!', 'Here we go.' ],
}

def walla( night ):
	"""a concourse full of people talking: each says a few things, near or far, in their own time"""
	rng = np.random.default_rng( 2000 + night )
	dur = 14.0
	out = np.zeros( int( dur * SR ) )
	lines = WALLA[ night ]
	for i in range( 30 if night == 27 else 26 ):
		p = person( rng, shout = 0.5 )
		t = rng.uniform( -1.5, 2 )
		dist = rng.uniform( 0.1, 1 )
		while t < dur:
			text = str( rng.choice( lines ) )
			x, items = H.tts( p[ 'voice' ], text, p[ 'ls' ], 0.667, 0.8, i % 3 )
			x = x / ( np.max( np.abs( x ) ) + 1e-9 )
			# moved to the person's pitch (a resample: quick, and a crowd doesn't mind)
			r = p[ 'base' ] / 120.0
			x = signal.resample_poly( x, 100, int( 100 * r ) ) if abs( r - 1 ) > 0.03 else x
			x = H.lp( x, SR, 7000 - 4500 * dist, 2 ) * ( 1 - 0.7 * dist ) * rng.uniform( 0.5, 1 )
			at = int( t * SR )
			if at >= 0:
				m = min( len( x ), len( out ) - at )
				if m > 0:
					out[ at:at + m ] += x[ :m ]
			else:
				m = min( len( x ) + at, len( out ) )
				if m > 0:
					out[ :m ] += x[ -at:-at + m ]
			t += len( x ) / SR + rng.uniform( 0.6, 3.5 )
	# a loop: the end folded into the start
	n = int( 1.0 * SR )
	y = out[ :-n ].copy()
	w = np.sin( np.linspace( 0, np.pi / 2, n ) )
	y[ :n ] = y[ :n ] * w + out[ -n: ] * w[ ::-1 ]
	return master( y, lufs = -22 ), dict( loop = True )

# one fan near you: (key, text, who: fan persona, when: the situations, for: whose at-bat / pitching)
SHOUTS = [
	( 'shout-eva-1', 'Eva!', 'fan', 'away', 'Longoria' ),
	( 'shout-eva-2', 'Hey, Eva!', 'grump', 'away', 'Longoria' ),
	( 'shout-eva-3', 'Eva Longoria!', 'fan2', 'away', 'Longoria' ),
	( 'shout-cole-1', 'Come on, Cole!', 'fan', 'pitch,two', 'Hamels' ),
	( 'shout-cole-2', 'One more, Cole, one more!', 'fan2', 'two', 'Hamels' ),
	( 'shout-brad-1', "Let's go, Brad!", 'fan', 'pitch,two', 'Lidge' ),
	( 'shout-brad-2', 'One more! One more!', 'grump', 'two', 'Lidge' ),
	( 'shout-strike-1', 'Strike him out!', 'fan2', 'two', '' ),
	( 'shout-strike-2', 'Sit him down!', 'grump', 'two', '' ),
	( 'shout-strikes', 'Throw strikes!', 'grump', 'pitch', '' ),
	( 'shout-nice', 'Nice pitch!', 'fan', 'pitch', '' ),
	( 'shout-herewego', 'Here we go!', 'fan2', 'pitch,bat', '' ),
	( 'shout-chase', 'Come on, Chase!', 'fan', 'bat', 'Utley' ),
	( 'shout-ryan', 'Let\'s go, Ryan!', 'fan2', 'bat', 'Howard' ),
	( 'shout-jimmy', "Let's go, Jimmy!", 'fan', 'bat', 'Rollins' ),
	( 'shout-pat', 'Come on, Pat!', 'grump', 'bat', 'Burrell' ),
	( 'shout-shane', "Let's go, Shane!", 'woman', 'bat', 'Victorino' ),
	( 'shout-hit', 'Get a hit!', 'fan', 'bat', '' ),
	( 'shout-drive', 'Drive him in!', 'grump', 'bat', '' ),
	( 'shout-upton', 'Upton, you bum!', 'grump', 'away', 'Upton' ),
	( 'shout-siddown', 'Siddown!', 'grump', 'away', '' ),
	( 'shout-cold', "It's freezing!", 'woman', 'any', '' ),
	( 'shout-lets', "Let's go Phillies!", 'fan', 'any', '' ),
	( 'shout-woo', 'Woo!', 'fan2', 'win,bat', '' ),
	( 'shout-win-1', 'We did it!', 'fan', 'win', '' ),
	( 'shout-win-2', 'World champions!', 'fan2', 'win', '' ),
	( 'shout-win-3', 'Twenty-eight years!', 'grump', 'win', '' ),
	( 'shout-win-4', 'Finally!', 'woman', 'win', '' ),
]
FANS = {
	'fan': dict( mode = 'speak', voice = 'joe', base = 150, range = 1.5, formant = 0.97, f1 = 0.08, tilt = 8, hoarse = 0.2, jit = 0.01, drive = 1.8, ls = 0.95 ),
	'fan2': dict( mode = 'speak', voice = 'mike', base = 160, range = 1.5, formant = 1.0, f1 = 0.08, tilt = 8, hoarse = 0.25, jit = 0.012, drive = 1.9, ls = 0.93 ),
	'grump': dict( mode = 'speak', voice = 'john', base = 140, range = 1.6, formant = 0.98, f1 = 0.1, tilt = 9, hoarse = 0.35, jit = 0.014, drive = 2.2, ls = 0.95 ),
	'woman': dict( mode = 'speak', voice = 'kristin', base = 270, range = 1.4, formant = 1.02, f1 = 0.06, tilt = 7, hoarse = 0.15, jit = 0.01, drive = 1.7, hpf = 130, ls = 0.93 ),
}

def shout( key, text, who ):
	y = H.call( key, FANS[ who ], [ dict( t = text ) ] )
	return H.to_loudness( y, SR, -16.0 ), {}

# the plate umpire, heard only close (the rail, the seats behind home, the camera wells): the calls barked
# and sung the way umpires do, "Stee-rike!" up and then down. (key, text, notes per syllable: start, end
# semitones, stretch)
UMP = dict( mode = 'sing', voice = 'john', base = 128, formant = 0.95, f1 = 0.1, tilt = 10, hoarse = 0.4, jit = 0.014, shim = 0.06,
	drive = 2.4, comp = ( -22, 3 ), scoop = 2.0, glide = 0.5 )
UMPS = [
	( 'ump-strike-1', 'Strike!', [ ( 3, -4, 1.8 ) ] ),
	( 'ump-strike-2', '[[ stˈiːɹaɪk ]]', [ ( 3, 6, 2.6 ), ( 5, -4, 1.5 ) ] ),
	( 'ump-three', 'Strike three!', [ ( 4, 6, 2.4 ), ( 3, -5, 1.6 ) ] ),
	( 'ump-foul', 'Foul ball!', [ ( 2, 2, 1.2 ), ( 3, -3, 1.5 ) ] ),
	( 'ump-playball', 'Play ball!', [ ( 2, 3, 1.3 ), ( 4, -3, 1.9 ) ] ),
	( 'ump-time', 'Time!', [ ( 3, -3, 1.5 ) ] ),
]

def ump( key, text, notes ):
	y = H.call( key, UMP, [ dict( t = text, n = notes ) ] )
	return H.to_loudness( y, SR, -15.0 ), {}

CLIPS = {
	'letsgo': letsgo, 'charge': charge, 'boo-1': lambda: boo( 1 ), 'boo-2': lambda: boo( 2 ), 'aww': aww,
	'stretch': stretch, 'walla-27': lambda: walla( 27 ), 'walla-29': lambda: walla( 29 ),
}
for k, text, who, when, whom in SHOUTS:
	CLIPS[ k ] = ( lambda k = k, text = text, who = who: shout( k, text, who ) )
for k, text, notes in UMPS:
	CLIPS[ k ] = ( lambda k = k, text = text, notes = notes: ump( k, text, notes ) )
META = { k: dict( when = when, who = whom, text = text ) for k, text, who, when, whom in SHOUTS }

def main():
	args = [ a for a in sys.argv[ 1: ] if not a.startswith( '--' ) ]
	keys = args or list( CLIPS )
	OUT.mkdir( parents = True, exist_ok = True )
	WAVS.mkdir( parents = True, exist_ok = True )
	idx_path = OUT / 'index.json'
	index = json.loads( idx_path.read_text() ) if idx_path.exists() else {}
	for k in keys:
		y, meta = CLIPS[ k ]()
		sf.write( str( WAVS / ( k + '.wav' ) ), y, SR, subtype = 'FLOAT' )
		kbps = 32 if k.startswith( ( 'shout', 'ump' ) ) else 40
		size = H.write_mp3( OUT / ( k + '.mp3' ), y, SR, kbps )
		index[ k ] = dict( f = k + '.mp3', d = round( len( y ) / SR, 2 ), **meta, **META.get( k, {} ) )
		print( f'{k:18s} {len( y ) / SR:5.2f}s {size / 1024:6.1f} KB' )
	index = { k: v for k, v in index.items() if k in CLIPS }
	idx_path.write_text( json.dumps( index, indent = '\t' ) )
	print( 'total', round( sum( ( OUT / v[ 'f' ] ).stat().st_size for v in index.values() ) / 1024 ), 'KB' )
	if '--asr' in sys.argv:
		subprocess.run( [ sys.executable, str( H.WORK / 'asr.py' ) ] + [ str( WAVS / ( k + '.wav' ) ) for k in keys if k.startswith( ( 'shout', 'ump' ) ) or k == 'charge' ] )

if __name__ == '__main__':
	main()
