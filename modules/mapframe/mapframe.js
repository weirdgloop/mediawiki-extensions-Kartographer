/* globals require */
/**
 * Frame module.
 *
 * Once the page is loaded and ready, turn all `<mapframe/>` tags into
 * interactive maps.
 *
 * @alias Frame
 * @alias ext.kartographer.frame
 * @class Kartographer.Frame
 * @singleton
 */
module.exports = ( function ( $, mw, kartobox, router ) {

	/**
	 * References the mapframe containers of the page.
	 *
	 * @type {HTMLElement[]}
	 */
	var maps = [],
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

		// Prevent users from adding map divs directly via wikitext
		if ( $el.attr( 'mw-data' ) !== 'interface' ) {
			return null;
		}

		if ( $caption[ 0 ] ) {
			captionText = $caption.text();
		}

		return {
      mapID: +$el.data( 'mapid' ),
      plane: +$el.data( 'plane' ),
      mapVersion: $el.data( 'mapversion' ),
			latitude: +$el.data( 'lat' ),
			longitude: +$el.data( 'lon' ),
			zoom: +$el.data( 'zoom' ),
			lang: $el.data( 'lang' ),
			style: $el.data( 'style' ),
			overlays: $el.data( 'overlays' ) || [],
			captionText: captionText
		};
	}

	/**
	 * This code will be executed once the article is rendered and ready.
	 *
	 * @ignore
	 */
	mw.hook( 'wikipage.content' ).add( function ( $content ) {
		var mapsInArticle = [],
			promises = [];

		// `wikipage.content` may be fired more than once.
		$.each( maps, function () {
			maps.pop().remove();
		} );

		$content.find( '.mw-kartographer-map' ).each( function ( index ) {
			var map, data,
				container = this,
				$container = $( this ),
				deferred = $.Deferred();

			data = getMapData( container );

			if ( data ) {
				data.enableFullScreenButton = true;

				map = kartobox.map( {
					featureType: 'mapframe',
					container: container,
          			mapID: data.mapID,
          			plane: data.plane,
          			mapVersion: data.mapVersion,
					center: [ data.latitude, data.longitude ],
					zoom: data.zoom,
					lang: data.lang,
					fullScreenRoute: '/map/' + index,
					allowFullScreen: true,
					dataGroups: data.overlays,
					captionText: data.captionText
				} );

				$container.removeAttr( 'href' );

				mw.track( 'mediawiki.kartographer', {
					action: 'view',
					isFullScreen: false,
					feature: map
				} );
				map.doWhenReady( function () {
					map.$container.css( 'backgroundImage', '' );
				} );

				mapsInArticle.push( map );
				maps[ index ] = map;

				// Special case for collapsible maps.
				// When the container is hidden Leaflet is not able to
				// calculate the expected size when visible. We need to force
				// updating the map to the new container size on `expand`.
				if ( !$container.is( ':visible' ) ) {
					$container.closest( '.mw-collapsible' )
						.on( 'afterExpand.mw-collapsible', function () {
							map.invalidateSize();
						} );
				}

				promises.push( deferred.promise() );
			}
		} );

		// Allow customizations of interactive maps in article.
		$.when( promises ).then( function () {
			mw.hook( 'wikipage.maps' ).fire( mapsInArticle, false /* isFullScreen */ );
		} );
	} );

	return maps;
}(
	jQuery,
	mediaWiki,
	require( 'ext.kartographer.box' ),
	require( 'mediawiki.router' )
) );
