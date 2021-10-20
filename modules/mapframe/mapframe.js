/**
 * Frame module.
 *
 * Once the page is loaded and ready, turn all `<mapframe/>` tags into
 * interactive maps.
 *
 * @alternateClassName Frame
 * @alternateClassName ext.kartographer.frame
 * @class Kartographer.Frame
 * @singleton
 */
var util = require( 'ext.kartographer.util' ),
	kartobox = require( 'ext.kartographer.box' ),
	router = require( 'mediawiki.router' ),
	/**
	 * References the mapframe containers of the page.
	 *
	 * @type {HTMLElement[]}
	 */
	maps = [],
	/**
	 * @private
	 * @ignore
	 */
	routerInited = false;

/**
 * Gets the map data attached to an element.
 *
 * @param {HTMLElement} element Element
 * @return {Object} Map properties
 * @return {number} return.mapID MapID in RuneScape
 * @return {number} return.plane Plane in RuneScape
 * @return {string} return.mapVersion Map version
 * @return {number} return.latitude
 * @return {number} return.longitude
 * @return {number} return.zoom
 * @return {string} return.lang Language code
 * @return {string} return.style Map style
 * @return {string[]} return.overlays Overlay groups
 * @return {string} return.captionText
 */
function getMapData( element ) {
	var $el = $( element ),
		$caption = $el.parent().find( '.thumbcaption' ),
		captionText = '';

	if ( $caption[ 0 ] ) {
		captionText = $caption.text();
	}

	return {
		mapID: +$el.data( 'mapid' ),
		plane: +$el.data( 'plane' ),
		mapVersion: $el.data( 'mapversion' ),
		plainTiles: $el.data( 'plaintiles' ),
		latitude: +$el.data( 'lat' ),
		longitude: +$el.data( 'lon' ),
		zoom: +$el.data( 'zoom' ),
		lang: $el.data( 'lang' ) || util.getDefaultLanguage(),
		style: $el.data( 'style' ),
		overlays: $el.data( 'overlays' ) || [],
		captionText: captionText
	};
}

/**
 * @param {Object} data
 * @param {jQuery} $container
 * @return {Object} map KartographerMap
 */
function initMapBox( data, $container ) {
	var map,
		index = maps.length,
		container = $container.get( 0 );

	data.enableFullScreenButton = true;

	map = kartobox.map( {
		featureType: 'mapframe',
		container: container,
		mapID: data.mapID,
		plane: data.plane,
		mapVersion: data.mapVersion,
		plainTiles: data.plainTiles,
		center: [ data.latitude, data.longitude ],
		zoom: data.zoom,
		lang: data.lang,
		fullScreenRoute: '/map/' + index,
		allowFullScreen: true,
		dataGroups: data.overlays,
		captionText: data.captionText
	} );

	$container.removeAttr( 'href' );
	$container.find( 'img' ).remove();

	map.doWhenReady( function () {
		map.$container.css( {
			['backgroundImage']: '',
			['background-position']: '',
			['background-repeat']: ''
		} );
	} );

	maps[ index ] = map;

	// Special case for collapsed maps.
	// When the container is initially hidden Leaflet is not able to
	// calculate the expected size when visible. We need to force
	// updating the map to the new container size on `expand`.
	// eslint-disable-next-line no-jquery/no-sizzle
	if ( !$container.is( ':visible' ) ) {
		$container.closest( '.mw-collapsible' )
			.on( 'afterExpand.mw-collapsible', map.invalidateSizeAndSetInitialView.bind( map ) );

		// If MobileFrontend is active do the same for collapsible sections
		// Unfortunately doesn't work when those sections are immediately
		// made visible again on page load.
		mw.loader.using( 'mobile.startup', function () {
			// this will not complete when target != desktop
			mw.mobileFrontend.require( 'mobile.startup' ).eventBusSingleton
				.on( 'section-toggled', map.invalidateSizeAndSetInitialView.bind( map ) );
		} );
	}

	return map;
}

/**
 * Create a mapbox from a given element.
 *
 * @param {HTMLElement} element Parsed <mapframe> element
 */
function initMapframeFromElement( element ) {
	var map,
		container = element,
		$container = $( element ),
		data = getMapData( container );

	map = initMapBox( data, $container );
	mw.hook( 'wikipage.maps' ).fire( [ map ], false /* isFullScreen */ );
}

/**
 * This code will be executed once the article is rendered and ready.
 *
 * @ignore
 */
mw.hook( 'wikipage.content' ).add( function ( $content ) {
	// `wikipage.content` may be fired more than once.
	while ( maps.length ) {
		maps.pop().remove();
	}

	$content.find( '.mw-kartographer-map[data-mw="interface"]' ).each( function () {
		var data,
			container = this,
			$container = $( this );

		data = getMapData( container );
		initMapBox( data, $container );
	} );

	// Allow customizations of interactive maps in article.
	mw.hook( 'wikipage.maps' ).fire( maps, false /* isFullScreen */ );
} );

module.exports = {
	initMapframeFromElement: initMapframeFromElement
};
