/**
 * Link module.
 *
 * Once the page is loaded and ready, turn all `<maplink/>` tags into a link
 * that opens the map in full screen mode.
 *
 * @alternateClassName Link
 * @alternateClassName ext.kartographer.link
 * @class Kartographer.Link
 * @singleton
 */
var kartolink = require( 'ext.kartographer.linkbox' ),
	/**
	 * References the maplinks of the page.
	 *
	 * @type {Kartographer.Linkbox.LinkClass[]}
	 */
	maplinks = [];

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
 * @return {string} return.style Map style
 * @return {string[]} return.overlays Overlay groups
 */
function getMapData( element ) {
	var $el = $( element );
	return {
	    mapID: +$el.data( 'mapid' ),
	    plane: +$el.data( 'plane' ),
	    mapVersion: $el.data( 'mapversion' ),
	    plainTiles: $el.data( 'plaintiles' ),
		latitude: +$el.data( 'lat' ),
		longitude: +$el.data( 'lon' ),
		zoom: +$el.data( 'zoom' ),
		lang: $el.data( 'lang' ),
		style: $el.data( 'style' ),
		captionText: $el.get( 0 ).innerText,
		overlays: $el.data( 'overlays' ) || []
	};
}

/**
 * Attach the maplink handler.
 *
 * @param {jQuery} jQuery element with the content
 */
function handleMapLinks( $content ) {
	$content.find( '.mw-kartographer-maplink[data-mw="interface"]' ).each( function () {
		var data = getMapData( this );

		var index = maplinks.length;
		maplinks[ index ] = kartolink.link( {
			featureType: 'maplink',
			container: this,
	        mapID: data.mapID,
	        plane: data.plane,
	        mapVersion: data.mapVersion,
	        plainTiles: data.plainTiles,
			center: [ data.latitude, data.longitude ],
			zoom: data.zoom,
			lang: data.lang,
			dataGroups: data.overlays,
			captionText: data.captionText
		} );
		maplinks[ index ].$container.attr('href', '#mapFullscreen')
	} );
}

mw.hook( 'wikipage.indicators' ).add( handleMapLinks );
mw.hook( 'wikipage.content' ).add( handleMapLinks );

module.exports = maplinks;
