/**
 * Dialog for displaying maps in full screen mode.
 *
 * See [OO.ui.Dialog](https://doc.wikimedia.org/oojs-ui/master/js/#!/api/OO.ui.Dialog)
 * documentation for more details.
 *
 * @class Kartographer.Dialog.DialogClass
 * @extends OO.ui.Dialog
 */
var CloseFullScreenControl = require( './closefullscreen_control.js' ),
	router = require( 'mediawiki.router' ),
	// Opens the sidebar when the screen is wide enough (greater than 1024px)
	FOOTER_HEIGHT = 63,
	SIDEBAR_WIDTH = 320;

/**
 * @constructor
 * @type {Kartographer.Dialog.DialogClass}
 */
function MapDialog() {
	// Parent method
	MapDialog.super.apply( this, arguments );
}

/* Inheritance */

OO.inheritClass( MapDialog, OO.ui.Dialog );

/* Static Properties */

MapDialog.static.name = 'mapDialog';
MapDialog.static.size = 'full';

/* Methods */

MapDialog.prototype.initialize = function () {
	this.mapDetailsButton = null;

	// Parent method
	MapDialog.super.prototype.initialize.apply( this, arguments );

	this.$body
		.append( $( '<div>' ).addClass( 'kartographer-mapDialog-loading' ) );
	this.$foot
		.addClass( 'mw-kartographer-mapDialog-foot' );

	this.map = null;
};

MapDialog.prototype.setMap = function ( map ) {
	var dialog = this;
	// remove older map
	if ( dialog.map ) {
		dialog.map.remove();
		dialog.$body.empty();
	}
	// set new map
	dialog.map = map;

	if ( !dialog.map ) {
		return;
	}
	// update the view
	if ( dialog.isOpening() || dialog.isOpened() ) {
		dialog.map.closeFullScreenControl = new CloseFullScreenControl( { position: 'topright' } )
			.addTo( dialog.map );
	}

	dialog.$body.append(
		dialog.map.$container.css( 'position', '' )
	);

	dialog.$captionContainer
		.attr( 'title', dialog.map.captionText )
		.text( dialog.map.captionText );

	// The button exists, the sidebar was not open, simply run `offsetMap`
	dialog.map.doWhenReady( function () {
		dialog.offsetMap( false );
	} );
	// If the window was already open, trigger wikipage.maps
	// otherwise let the ready() of the window handle this.
	if ( dialog.isOpened() ) {
		mw.hook( 'wikipage.maps' ).fire( dialog.map, true /* isFullScreen */ );
	}
};

MapDialog.prototype.addFooterButton = function () {
	var dialog = this,
		$buttonContainer, $inlineContainer;

	// Create footer toggle button
	dialog.$captionContainer = dialog.$element.find( '.mw-kartographer-captionfoot' );
	$buttonContainer = dialog.$element.find( '.mw-kartographer-buttonfoot' );
	$inlineContainer = dialog.$element.find( '.mw-kartographer-inlinefoot' );

	if ( !dialog.mapDetailsButton ) {
		dialog.mapDetailsButton = new OO.ui.ToggleButtonWidget( {
			label: mw.msg( 'kartographer-sidebar-togglebutton' ),
			icon: 'newWindow',
			title: mw.msg( 'kartographer-sidebar-togglebutton' )
		} );
		dialog.mapDetailsButton.connect( dialog, { change: 'openURL' } );
	}

	if ( !dialog.$captionContainer.length ) {
		dialog.$captionContainer = $( '<div>' )
			.addClass( 'mw-kartographer-captionfoot' );
	}

	if ( !$buttonContainer.length ) {
		$buttonContainer = $( '<div>' )
			.addClass( 'mw-kartographer-buttonfoot' );
	}

	if ( !$inlineContainer.length ) {
		$inlineContainer = $( '<div>' )
			.addClass( 'mw-kartographer-inlinefoot' );
	}
	$inlineContainer.append(
		$buttonContainer.append( dialog.mapDetailsButton.$element ),
		dialog.$captionContainer
	);

	// Add the button to the footer
	dialog.$foot.append( $inlineContainer );

	if ( dialog.map ) {
		dialog.$captionContainer
			.attr( 'title', dialog.map.captionText )
			.text( dialog.map.captionText );
	}
};

MapDialog.prototype.openURL = function ( ) {
  var url = this.createURL();
  window.open(url, '_blank');
};

/*
 * Added for direct link creation, no sidebar needed.
 */
MapDialog.prototype.createURL = function ( ) {
  var externalLinks = mw.config.get( 'wgKartographerExternalLinks' );
  // select first url in list
  var url = mw.config.get( 'wgKartographerDataConfig' ).standaloneURL;
  // Replace parts
  var view; // = this.map.getInitialMapPosition();
  view = {
    center: this.map.getCenter(),
    zoom: this.map.getZoom(),
    mapID: this.map.getMapID(),
    plane: this.map.getPlane(),
  };
  var scale = Math.round( Math.pow( 2, Math.min( 3, Math.max( 0, 18 - view.zoom ) ) ) * 1000 );
  url = url.replace( new RegExp( '{latitude}', 'g' ), view.center.lat );
  url = url.replace( new RegExp( '{longitude}', 'g' ), view.center.lng );
  url = url.replace( new RegExp( '{x}', 'g' ), Math.floor(view.center.lat) );
  url = url.replace( new RegExp( '{y}', 'g' ), Math.floor(view.center.lng) );
  url = url.replace( new RegExp( '{zoom}', 'g' ), view.zoom );
  url = url.replace( new RegExp( '{title}', 'g' ), mw.config.get( 'wgTitle' ) );
  url = url.replace( new RegExp( '{language}', 'g' ), this.map.lang );
  url = url.replace( new RegExp( '{scale}', 'g' ), scale );
  url = url.replace( new RegExp( '{mapID}', 'g' ), view.mapID );
  url = url.replace( new RegExp( '{plane}', 'g' ), view.plane );

  return url;
};

MapDialog.prototype.getActionProcess = function ( action ) {
	var dialog = this;

	if ( !action ) {
		return new OO.ui.Process( function () {
			if ( dialog.map ) {
				dialog.map.closeFullScreen();
				dialog.map.remove();
				dialog.map = null;
			}
		} );
	}
	return MapDialog.super.prototype.getActionProcess.call( this, action );
};

/**
 * Adds an offset to the center of the map.
 *
 * @param {boolean} isSidebarOpen Whether the sidebar is open.
 */
MapDialog.prototype.offsetMap = function ( isSidebarOpen ) {
	var map = this.map,
		offsetX = isSidebarOpen ? SIDEBAR_WIDTH / -2 : 0,
		offsetY = FOOTER_HEIGHT / -2,
		targetPoint = map.project( map.getCenter(), map.getZoom() ).subtract( [ offsetX, offsetY ] ),
		targetLatLng = map.unproject( targetPoint, map.getZoom() );

	map.setView( targetLatLng, map.getZoom() );
};

/**
 * Tells the router to navigate to the current full screen map route.
 */
MapDialog.prototype.updateHash = function () {
	var hash = this.map.getHash();

	// Avoid extra operations
	if ( this.lastHash !== hash ) {
		/* eslint-disable no-underscore-dangle */
		this.map._updatingHash = true;
		/* eslint-enable no-underscore-dangle */
		router.navigate( hash );
		this.lastHash = hash;
	}
};

/**
 * Listens to `moveend` event and calls {@link #updateHash}.
 *
 * This method is throttled, meaning the method will be called at most once per
 * every 250 milliseconds.
 */
MapDialog.prototype.onMapMove = OO.ui.throttle( function () {
	// Stop listening to `moveend` event while we're
	// manually moving the map (updating from a hash),
	// or if the map is not yet loaded.
	/* eslint-disable no-underscore-dangle */
	if ( this.movingMap || !this.map || !this.map._loaded ) {
		return false;
	}
	/* eslint-enable no-underscore-dangle */
	this.updateHash();
}, 250 );

MapDialog.prototype.getSetupProcess = function ( options ) {
	return MapDialog.super.prototype.getSetupProcess.call( this, options )
		.next( function () {
			var dialog = this,
				isFirstTimeOpen = !dialog.mapDetailsButton;

			if ( isFirstTimeOpen ) {
				// The button does not exist yet, add it
				dialog.addFooterButton();
			}

			if ( options.map && options.map !== dialog.map ) {
				this.setMap( options.map );
			}
		}, this );
};

MapDialog.prototype.getReadyProcess = function ( data ) {
	return MapDialog.super.prototype.getReadyProcess.call( this, data )
		.next( function () {

			if ( !this.map ) {
				return;
			}
			this.map.doWhenReady( function () {
				mw.hook( 'wikipage.maps' ).fire( this.map, true /* isFullScreen */ );
			}, this );
		}, this );
};

MapDialog.prototype.getTeardownProcess = function ( data ) {
	return MapDialog.super.prototype.getTeardownProcess.call( this, data )
		.next( function () {
			if ( this.map ) {
				this.map.remove();
				this.map = null;
			}
			this.$body.empty();
		}, this );
};

module.exports = MapDialog;
