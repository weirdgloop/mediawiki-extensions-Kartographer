/* globals require */
/**
 * Link module.
 *
 * Once the page is loaded and ready, turn all `<maplink/>` tags into a link
 * that opens the map in full screen mode.
 *
 * @alias Link
 * @alias ext.kartographer.link
 * @class Kartographer.Link
 * @singleton
 */
module.exports = ( function ( $, mw, router, kartolink ) {

	/**
	 * References the maplinks of the page.
	 *
	 * @type {HTMLElement[]}
	 */
	var maplinks = [],
		/**
		 * @private
		 * @ignore
		 */
		routerInited = false;

	/**
	 * Gets the map data attached to an element.
	 *
	 * @param {HTMLElement} element Element
	 * @return {Object|null} Map properties
	 * @return {number} return.mapID MapID in RuneScape
	 * @return {number} return.plane Plane in RuneScape
	 * @return {number} return.latitude
	 * @return {number} return.longitude
	 * @return {number} return.zoom
	 * @return {string} return.style Map style
	 * @return {string[]} return.overlays Overlay groups
	 */
	function getMapData( element ) {
		var $el = $( element );
		// Prevent users from adding map divs directly via wikitext
		if ( $el.attr( 'mw-data' ) !== 'interface' ) {
			return null;
		}

		return {
      mapID: +$el.data( 'mapid' ),
      plane: +$el.data( 'plane' ),
			latitude: +$el.data( 'lat' ),
			longitude: +$el.data( 'lon' ),
			zoom: +$el.data( 'zoom' ),
			style: $el.data( 'style' ),
			captionText: $el.text(),
			overlays: $el.data( 'overlays' ) || []
		};
	}

	/**
	 * This code will be executed once the article is rendered and ready.
	 *
	 * @ignore
	 */
	mw.hook( 'wikipage.content' ).add( function () {
		console.log("hook")

		// `wikipage.content` may be fired more than once.
		$.each( maplinks, function () {
			maplinks.pop().$container.off( 'click.kartographer' );
		} );

		// Some links might be displayed outside of $content, so we need to
		// search outside. This is an anti-pattern and should be improved...
		// Meanwhile .mw-body is better than searching the full document.
		$( '.mw-kartographer-maplink', '.mw-body' ).each( function ( index ) {
			console.log('each')
			var data = getMapData( this ),
				link;

			link = maplinks[ index ] = kartolink.link( {
				featureType: 'maplink',
				container: this,
        mapID: data.mapID,
        plane: data.plane,
				center: [ data.latitude, data.longitude ],
				zoom: data.zoom,
				dataGroups: data.overlays,
				captionText: data.captionText,
				fullScreenRoute: '/maplink/' + index
			} );
			link.$container.attr('href', '#mapFullscreen')
		} );
	} );

	return maplinks;
}(
	jQuery,
	mediaWiki,
	require( 'mediawiki.router' ),
	require( 'ext.kartographer.linkbox' )
) );
