"""The first base concourse's voices (src/ballpark/places/concourse1b/Sounds.js): the vendors' calls, the
ticket taker, the bag check, the usher, a few fans, each a short mono MP3 in
public/audio/places/concourse1b/.

    python tools/audio/concourse1b-calls.py <piper voices dir>

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
out_dir = os.path.join( os.path.dirname( __file__ ), '..', '..', 'public', 'audio', 'places', 'concourse1b' )
os.makedirs( out_dir, exist_ok = True )
SR = 22050

# name: ( voice, pace (length scale), text )
LINES = {
	# Gus at the program kiosk behind 115-116 (the program was $15)
	'gus-1': ( 'norman', 0.9, 'Programs! Get your World Series programs! Fifteen dollars!' ),
	'gus-2': ( 'norman', 0.92, 'Programs here! Official World Series program!' ),
	# the beer man in the yellow shirt
	'beer-1': ( 'joe', 0.85, 'Cold beer! Beer here!' ),
	'beer-2': ( 'joe', 0.88, 'Beer here! Who needs a beer?' ),
	# Loretta on the Market's register
	'loretta-1': ( 'kristin', 0.95, 'What can I get you, baby?' ),
	'loretta-2': ( 'kristin', 0.95, 'There you go, baby. Next!' ),
	# the hot chocolate at the water ice cart, the Phanatic Phood cart
	'cocoa-1': ( 'mike', 0.9, 'Hot chocolate! Get your hot chocolate here!' ),
	'phood-1': ( 'ljspeech', 0.95, 'Phanatic Phood! Hot dogs for the kids!' ),
	# at the gate: Dee scanning, the bag check, security
	'dee-1': ( 'kathleen', 1.0, 'Enjoy the game, hon.' ),
	'dee-2': ( 'kathleen', 1.0, "Tickets out, folks. Have 'em ready." ),
	'dee-3': ( 'kathleen', 1.0, 'Welcome back, hon. Go get em.' ),
	'bags-1': ( 'bryce', 0.95, 'Bags open, please. Open your bags.' ),
	'bags-2': ( 'bryce', 0.95, "Sorry, sir. No thermoses. It's gotta go." ),
	'bernie-1': ( 'john', 0.95, "Aw, come on! It's coffee! It's forty degrees out here!" ),
	'guard-1': ( 'mike', 0.95, 'Keep it moving, folks. Plenty of room inside.' ),
	# the ushers at the aisles
	'usher-1': ( 'john', 0.95, "Let me see your ticket. All the way down, on your right." ),
	# Leo with his radio; a fan ribbing the Rays fan; Marty to his sitter
	'leo-1': ( 'norman', 0.9, 'Did you hear Harry? Did you hear that?' ),
	'fan-tampa': ( 'joe', 0.9, 'Hey, Tampa! Nice shirt!' ),
	'marty-1': ( 'joe', 1.0, 'Hold still, sweetheart. Almost done.' ),
}

loaded = {}


def voice( name ):

	if name not in loaded:
		loaded[ name ] = PiperVoice.load( os.path.join( voices_dir, f'en_US-{ name }-medium.onnx' if name != 'kathleen' else 'en_US-kathleen-low.onnx' ) )
	return loaded[ name ]


for key, ( v, pace, text ) in LINES.items():

	vo = voice( v )
	cfg = SynthesisConfig( length_scale = pace, noise_scale = 0.7, noise_w_scale = 0.9 )
	audio = np.concatenate( [ c.audio_float_array for c in vo.synthesize( text, syn_config = cfg ) ] ).astype( np.float32 )
	sr = vo.config.sample_rate
	if sr != SR:
		audio = signal.resample_poly( audio, SR, sr ).astype( np.float32 )
	loud = np.where( np.abs( audio ) > 0.01 )[ 0 ]
	if len( loud ):
		audio = audio[ max( 0, loud[ 0 ] - 200 ) : loud[ -1 ] + 600 ]
	# a raised voice in a big hard room: the low end off, a little compression, peak at -3 dB
	audio = signal.sosfilt( signal.butter( 2, 120, btype = 'highpass', fs = SR, output = 'sos' ), audio ).astype( np.float32 )
	audio = audio / ( np.max( np.abs( audio ) ) or 1.0 )
	audio = 0.6 * np.tanh( 1.8 * audio ) / np.tanh( 1.8 ) + 0.4 * audio
	audio = audio / ( np.max( np.abs( audio ) ) or 1.0 ) * 0.7
	pcm = ( np.clip( audio, -1, 1 ) * 32000 ).astype( np.int16 )
	enc = lameenc.Encoder()
	enc.set_bit_rate( 48 )
	enc.set_in_sample_rate( SR )
	enc.set_channels( 1 )
	enc.set_quality( 2 )
	data = enc.encode( pcm.tobytes() ) + enc.flush()
	path = os.path.join( out_dir, key + '.mp3' )
	open( path, 'wb' ).write( data )
	print( key, round( len( audio ) / SR, 2 ), 's', len( data ) // 1024, 'KB' )
