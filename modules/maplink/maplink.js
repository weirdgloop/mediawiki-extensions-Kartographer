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
var router = require( 'mediawiki.router' ),
	kartolink = require( 'ext.kartographer.linkbox' ),
	/**
	 * References the maplinks of the page.
	 *
	 * @type {Kartographer.Linkbox.LinkClass[]}
	 */
	maplinks = [],
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
		captionText: $el.text(),
		overlays: $el.data( 'overlays' ) || []
	};
}

/**
 * This code will be executed once the article is rendered and ready.
 * FIXME: this should find from hook param, instead of body
 *
 * @ignore
 */
mw.hook( 'wikipage.content' ).add( function () {

	// `wikipage.content` may be fired more than once.
	while ( maplinks.length ) {
		maplinks.pop().$container.off( 'click.kartographer' );
	}

	// Some links might be displayed outside of $content, so we need to
	// search outside. This is an anti-pattern and should be improved...
	// Meanwhile .mw-body is better than searching the full document.
	// eslint-disable-next-line no-jquery/no-global-selector
	$( '.mw-body .mw-kartographer-maplink[data-mw="interface"]' ).each( function ( index ) {
		var data = getMapData( this );

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
} );

module.exports = maplinks;
