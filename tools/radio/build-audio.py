"""The radio call as one audio track on the replay's clock (so the page just plays it in step with the
game, and seeking the game seeks the call).

    python build-audio.py tools/radio/script.json <piper voices dir> public/audio/radio/game5.mp3

Voices: Piper (https://github.com/rhasspy/piper, MIT) with its en_US-joe-medium (play-by-play; CC0) and
en_US-norman-medium (colour; public domain) voices. Each line is synthesized (cached by its text), the lines are laid
on the timeline without overlapping (a line may slip by up to its `wait`; lines that can't find room
are dropped unless they must be heard), then the mix gets an AM-radio treatment (a 300-3400 Hz band,
soft compression, a little hiss) and is written as a mono MP3 with an index of what's said when.
Needs: piper-tts, numpy, scipy, lameenc.
"""
import hashlib, json, os, sys
import numpy as np
from scipy import signal
import lameenc
from piper import PiperVoice, SynthesisConfig

script_path, voices_dir, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
script = json.load( open( script_path ) )
SR = 22050
cache = os.path.join( os.path.dirname( script_path ), '.cache' )
os.makedirs( cache, exist_ok = True )
voices = {
	'pbp': ( PiperVoice.load( os.path.join( voices_dir, 'en_US-joe-medium.onnx' ) ), 0.88 ),
	'color': ( PiperVoice.load( os.path.join( voices_dir, 'en_US-norman-medium.onnx' ) ), 0.98 ),
}

def synth( line ):
	voice, pace = voices[ line[ 'voice' ] ]
	excited = line[ 'prio' ] >= 3 and '!' in line[ 'text' ]
	cfg = SynthesisConfig( length_scale = pace * ( 0.92 if excited else 1.0 ), noise_scale = 0.7 if excited else 0.6, noise_w_scale = 0.9 )
	key = hashlib.sha1( ( line[ 'voice' ] + '|' + str( cfg.length_scale ) + '|' + line[ 'text' ] ).encode() ).hexdigest()
	path = os.path.join( cache, key + '.npy' )
	if os.path.exists( path ):
		return np.load( path )
	audio = np.concatenate( [ c.audio_float_array for c in voice.synthesize( line[ 'text' ], syn_config = cfg ) ] ).astype( np.float32 )
	# trim the silence at the ends
	loud = np.where( np.abs( audio ) > 0.01 )[ 0 ]
	if len( loud ):
		audio = audio[ max( 0, loud[ 0 ] - 200 ) : loud[ -1 ] + 400 ]
	if excited:
		audio = audio * 1.12
	np.save( path, audio )
	return audio

lines = script[ 'lines' ]
print( 'synthesizing', len( lines ), 'lines' )
clips = []
for i, l in enumerate( lines ):
	clips.append( synth( l ) )
	if i % 50 == 0:
		print( ' ', i )

# lay them out: in time order, never overlapping, a 0.2 s breath between
placed = []
busy = 0.0
for l, a in sorted( zip( lines, clips ), key = lambda x: x[ 0 ][ 't' ] ):
	dur = len( a ) / SR
	start = max( l[ 't' ], busy + 0.2 )
	if start - l[ 't' ] > l[ 'wait' ] and l[ 'prio' ] < 3:
		continue
	placed.append( ( start, dur, l, a ) )
	busy = start + dur
print( 'placed', len( placed ), 'of', len( lines ) )

total = int( ( script[ 'duration' ] + 10 ) * SR )
mix = np.zeros( total, dtype = np.float32 )
for start, dur, l, a in placed:
	i = int( start * SR )
	g = 0.95 if l[ 'voice' ] == 'pbp' else 0.9
	mix[ i : i + len( a ) ] += a[ : max( 0, min( len( a ), total - i ) ) ] * g

# AM radio: band-limit, compress, a little hiss under it
sos = signal.butter( 4, [ 300, 3400 ], btype = 'bandpass', fs = SR, output = 'sos' )
mix = signal.sosfilt( sos, mix ).astype( np.float32 )
peak = np.max( np.abs( mix ) ) or 1.0
mix = mix / peak
mix = 0.65 * np.tanh( 2.4 * mix ) / np.tanh( 2.4 ) + 0.35 * mix
hiss = signal.sosfilt( signal.butter( 2, [ 800, 3400 ], btype = 'bandpass', fs = SR, output = 'sos' ), np.random.default_rng( 1 ).standard_normal( total ) ).astype( np.float32 )
mix = mix * 0.85 + hiss * 0.004
# 11 kHz mono MP3 (the band stops at 3.4 kHz anyway)
low = signal.resample_poly( mix, 1, 2 ).astype( np.float32 )
pcm = ( np.clip( low, -1, 1 ) * 32000 ).astype( np.int16 )
enc = lameenc.Encoder()
enc.set_bit_rate( 24 )
enc.set_in_sample_rate( SR // 2 )
enc.set_channels( 1 )
enc.set_quality( 2 )
data = enc.encode( pcm.tobytes() ) + enc.flush()
os.makedirs( os.path.dirname( out_path ), exist_ok = True )
open( out_path, 'wb' ).write( data )
index = [ { 't': round( s, 2 ), 'd': round( d, 2 ), 'v': l[ 'voice' ], 'text': l[ 'text' ] } for s, d, l, a in placed ]
json.dump( index, open( out_path.replace( '.mp3', '.json' ), 'w' ) )
print( 'wrote', out_path, len( data ) // 1024, 'KB' )
