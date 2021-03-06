(function( window, $, undefined ) {
	'use strict';

	var historySuccess, originalSuccess,
		mePlayerInit = mejs.MediaElementPlayer.prototype.init;

	/**
	 * Proxy the MediaElementPlayer init method to proxy the success callback.
	 */
	mejs.MediaElementPlayer.prototype.init = function() {
		// Set up if the cuehistory feature is declared.
		if ( -1 !== $.inArray( 'cuehistory', this.options.features ) ) {
			originalSuccess = this.options.success;
			this.options.success = historySuccess;
		}
		mePlayerInit.call( this );
	};

	/**
	 * Proxied MediaElementPlayer success callback.
	 */
	historySuccess = function( media, domObject, player ) {
		var isPlaying, status, volume,
			history = new History( player.options.cueId || '', player.options.cueSignature || '' ),
			autoplay = ( 'autoplay' === media.getAttribute( 'autoplay' ) ),
			mf = mejs.MediaFeatures;

		if ( history && undefined !== history.get( 'volume' ) ) {
			media.setVolume( history.get( 'volume' ) );
		}

		if ( history && undefined !== history.get( 'trackIndex' ) ) {
			// Don't start playing if on a mobile device or if autoplay is active.
			status = history ? history.get( 'status' ) : '';
			isPlaying = ( 'playing' === status && ! mf.isiOS && ! mf.isAndroid && ! autoplay );

			if ( 'cuePlaylistTracks' in player.options && player.options.cuePlaylistTracks.length ) {
				player.cueSetCurrentTrack( history.get( 'trackIndex' ), isPlaying );
			} else if ( isPlaying ) {
				player.cuePlay();
			}
		}

		originalSuccess.call( this, media, domObject, player );
	};

	$.extend( mejs.MepDefaults, {
		cueId: 'cue',
		cueSignature: ''
	});

	$.extend( MediaElementPlayer.prototype, {
		cueHistory: null,

		buildcuehistory: function( player, controls, layers, media ) {
			var currentTime, history,
				$container = player.container.closest( player.options.cueSelectors.playlist ),
				isLoaded = false,
				mf = mejs.MediaFeatures;

			history = player.cueHistory = new History( player.options.cueId, player.options.cueSignature );
			currentTime = history.get( 'currentTime' );

			media.addEventListener( 'play', function() {
				history.set( 'trackIndex', player.cueCurrentTrack );
				history.set( 'status', 'playing' );
			});

			media.addEventListener( 'pause', function() {
				history.set( 'status', 'paused' );
			});

			media.addEventListener( 'timeupdate', function() {
				history.set( 'currentTime', media.currentTime );
			});

			media.addEventListener( 'volumechange', function() {
				history.set( 'volume', media.volume );
			});

			// Only set the current time on initial load.
			media.addEventListener( 'playing', function() {
				if ( isLoaded || currentTime < 1 ) {
					return;
				}

				if ( mf.isiOS ) {
					// Tested on iOS 7 on an iPad, may need to update for other devices.

					// The currentTime can't be set in iOS until the desired time
					// has been buffered. Poll the buffered end time until it's
					// possible to set currentTime. The audio may begin playing from
					// the beginning before skipping ahead.
					var intervalId = setInterval(function() {
						if ( currentTime < media.buffered.end( 0 ) ) {
							clearInterval( intervalId );
							player.setCurrentTime( currentTime );
							player.setCurrentRail();
						}
					}, 50 );
				} else {
					try {
						player.setCurrentTime( currentTime );
						player.setCurrentRail();
					} catch ( exp ) { }
				}

				isLoaded = true;
			});
		}

	});

	function History( id, signature ) {
		var data = sessionStorage || {},
			signatureProp = id + '-signature';

		this.set = function( key, value ) {
			var prop = id + '-' + key;
			data[ prop ] = value;
		};

		this.get = function( key ) {
			var value,
				prop = id + '-' + key;

			if ( 'undefined' !== typeof data[ prop ] ) {
				value = data[ prop ];

				if ( 'currentTime' === key ) {
					value = parseFloat( value );
				} else if ( 'status' === key ) {
					value = ( 'playing' === value ) ? 'playing' : 'paused';
				} else if ( 'trackIndex' === key ) {
					value = parseInt( value, 10 );
				} else if ( 'volume' === key ) {
					value = parseFloat( value );
				}
			}

			return value;
		};

		this.clear = function() {
			var prop;

			for ( prop in data ) {
				if ( data.hasOwnProperty( prop ) && 0 === prop.indexOf( id + '-' ) ) {
					delete data[ prop ];
				}
			}
		};

		// Clear the history if the signature changed.
		if ( 'undefined' === typeof data[ signatureProp ] || data[ signatureProp ] !== signature ) {
			this.clear();
		}

		data[ signatureProp ] = signature;
	}

})( this, jQuery );
