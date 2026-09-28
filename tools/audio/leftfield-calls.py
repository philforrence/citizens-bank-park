"""Harry the K's voices (src/ballpark/places/leftfield/Sounds.js): the bartenders, the host, the servers, the
Delco boys on Crawford and Longoria, a Rays fan; and the rooms' own hubbub, two loops of a bar full of
people talking (made of many voiced lines overlapped, far off in a hard room), each a short mono MP3 in
public/audio/places/leftfield/.

    python tools/audio/leftfield-calls.py <piper voices dir>

Voices: Piper (https://github.com/rhasspy/piper, MIT) with its en_US voices, each CC0 or public domain
(their model cards): joe, mike, kathleen (CC0); norman, bryce, john, kristin, ljspeech (public domain).
Needs: piper-tts, numpy, scipy, lameenc.
"""
import os, sys
import numpy as np
from scipy import signal
import lameenc
from piper import PiperVoice, SynthesisConfig

voices_dir = sys.argv[ 1 ]
out_dir = os.path.join( os.path.dirname( __file__ ), '..', '..', 'public', 'audio', 'places', 'leftfield' )
os.makedirs( out_dir, exist_ok = True )
SR = 22050
rng = np.random.default_rng( 452 )

# name: ( voice, pace (length scale), text )
LINES = {
	# Vinnie behind the lower bar; Kitty upstairs
	'vinnie-1': ( 'joe', 0.92, "What'll it be, pal?" ),
	'vinnie-2': ( 'joe', 0.9, 'Two Yuenglings, coming up.' ),
	'kitty-1': ( 'kristin', 0.95, 'Another round, hon?' ),
	'kitty-2': ( 'kristin', 0.95, 'Lou, you want another one?' ),
	# Gloria at the host stand; the servers with the trays
	'gloria-1': ( 'kathleen', 1.0, 'Right this way, hon. Table for four.' ),
	'server-1': ( 'ljspeech', 0.95, 'Who had the cheesesteak? And the wings?' ),
	'server-2': ( 'mike', 0.95, 'Behind you! Hot plates!' ),
	# the Delco boys at the patio rail: on Crawford in left, Longoria at the plate
	'delco-crawford-1': ( 'bryce', 0.85, 'Craw-ford! Craw-ford!' ),
	'delco-crawford-2': ( 'john', 0.85, "Hey Crawford! You're in Philly now, pal!" ),
	'delco-eva': ( 'bryce', 0.8, 'E-va! E-va! E-va!' ),
	# Marcy, the one Rays fan at the counter
	'marcy-1': ( 'kristin', 0.9, "Let's go Rays!" ),
	# Lou with his radio
	'lou-1': ( 'norman', 0.95, "Shh, shh. Harry's got it. Listen." ),
}

# the hubbub: phrases heard through a crowded bar, overlapped
CHATTER = [
	"Did you see that?", "He's gotta throw strikes.", "Another round over here.", "No, no, the Schmitter.",
	"Hamels is dealing tonight.", "It's freezing out there.", "Who's got the check?", "Utley, man, Utley.",
	"I told you, Howard's due.", "Can you believe this rain?", "My brother's in the upper deck.",
	"Nineteen eighty, I was twelve.", "Pass me the ketchup.", "Honey, sit down.", "They better finish this.",
	"Lidge hasn't blown one all year.", "We're gonna win this thing.", "Yeah, two more.", "Where's the bathroom?",
	"Look at the TV.", "Werth's got a cannon.", "I got work tomorrow.", "Victorino!", "Go Phils!",
]

loaded = {}


def voice( name ):

	if name not in loaded:
		loaded[ name ] = PiperVoice.load( os.path.join( voices_dir, f'en_US-{ name }-medium.onnx' if name != 'kathleen' else 'en_US-kathleen-low.onnx' ) )
	return loaded[ name ]


def say( v, pace, text ):

	vo = voice( v )
	cfg = SynthesisConfig( length_scale = pace, noise_scale = 0.7, noise_w_scale = 0.9 )
	audio = np.concatenate( [ c.audio_float_array for c in vo.synthesize( text, syn_config = cfg ) ] ).astype( np.float32 )
	sr = vo.config.sample_rate
	if sr != SR:
		audio = signal.resample_poly( audio, SR, sr ).astype( np.float32 )
	loud = np.where( np.abs( audio ) > 0.01 )[ 0 ]
	if len( loud ):
		audio = audio[ max( 0, loud[ 0 ] - 200 ) : loud[ -1 ] + 600 ]
	return audio


def mp3( name, audio, peak = 0.7, rate = 48 ):

	audio = audio / ( np.max( np.abs( audio ) ) or 1.0 ) * peak
	pcm = ( np.clip( audio, -1, 1 ) * 32000 ).astype( np.int16 )
	enc = lameenc.Encoder()
	enc.set_bit_rate( rate )
	enc.set_in_sample_rate( SR )
	enc.set_channels( 1 )
	enc.set_quality( 2 )
	data = enc.encode( pcm.tobytes() ) + enc.flush()
	open( os.path.join( out_dir, name + '.mp3' ), 'wb' ).write( data )
	print( name, round( len( audio ) / SR, 2 ), 's', len( data ) // 1024, 'KB' )


# ---- the calls: a raised voice under a roof, the low end off, a little compression
for key, ( v, pace, text ) in LINES.items():

	a = say( v, pace, text )
	a = signal.sosfilt( signal.butter( 2, 120, btype = 'highpass', fs = SR, output = 'sos' ), a ).astype( np.float32 )
	a = a / ( np.max( np.abs( a ) ) or 1.0 )
	a = 0.6 * np.tanh( 1.8 * a ) / np.tanh( 1.8 ) + 0.4 * a
	mp3( key, a )


# ---- the hubbub: a room of talk, 24 s, looping (the start and the end cross-faded), far off and muffled,
# glasses and a laugh or two in it
def room( seconds, seed, voices, density ):

	r = np.random.default_rng( seed )
	n = int( seconds * SR )
	out = np.zeros( n + SR * 4, dtype = np.float32 )
	t = 0.0
	while t < seconds:
		text = CHATTER[ r.integers( len( CHATTER ) ) ]
		v = voices[ r.integers( len( voices ) ) ]
		a = say( v, 0.85 + 0.3 * r.random(), text )
		# some nearer, most further off
		g = 0.25 + 0.75 * r.random() ** 2
		at = int( t * SR )
		out[ at : at + len( a ) ] += a[ : len( out ) - at ] * g
		t += ( 0.15 + r.random() * 0.6 ) / density
	# glasses set down and clinking
	for k in range( int( seconds * 1.5 ) ):
		at = int( r.random() * seconds * SR )
		f = 2400 + 2600 * r.random()
		tt = np.arange( int( 0.25 * SR ) ) / SR
		ping = ( np.sin( 2 * np.pi * f * tt ) + 0.5 * np.sin( 2 * np.pi * f * 2.7 * tt ) ) * np.exp( -tt * 30 ) * ( 0.05 + 0.1 * r.random() )
		out[ at : at + len( ping ) ] += ping[ : len( out ) - at ]
	# the wrap: the tail folded back onto the head
	tail = out[ n : n + SR * 4 ]
	out = out[ : n ]
	out[ : len( tail ) ] += tail
	# a hard room: an exponential tail of noise as its reverb, the highs rolled off (heard through the talk)
	ir_t = np.arange( int( 0.9 * SR ) ) / SR
	ir = rng.standard_normal( len( ir_t ) ).astype( np.float32 ) * np.exp( -ir_t * 6 )
	ir[ 0 ] = 4.0
	wet = signal.fftconvolve( np.concatenate( [ out, out[ : len( ir ) ] ] ), ir )[ : n + len( ir ) ]
	wet = wet[ len( ir ) : len( ir ) + n ] if len( wet ) >= n + len( ir ) else wet[ : n ]
	wet = signal.sosfilt( signal.butter( 2, [ 180, 3200 ], btype = 'bandpass', fs = SR, output = 'sos' ), wet ).astype( np.float32 )
	# even out the level
	env = np.sqrt( signal.sosfilt( signal.butter( 1, 0.5, fs = SR, output = 'sos' ), wet ** 2 ) + 1e-6 )
	wet = wet / ( env / np.mean( env ) ) ** 0.6
	return wet


mp3( 'room-up', room( 24, 7, [ 'joe', 'mike', 'kristin', 'john', 'bryce', 'ljspeech', 'norman' ], 2.2 ), 0.5, 56 )
mp3( 'room-down', room( 24, 11, [ 'joe', 'mike', 'kristin', 'john', 'bryce', 'ljspeech', 'kathleen' ], 2.6 ), 0.5, 56 )
