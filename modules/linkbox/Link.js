/**
 * # Kartographer Link class
 *
 * Binds a `click` event to a `container`, that opens a {@link Kartographer.Box.MapClass map with
 * layers, markers, and interactivity} in a full screen dialog.
 *
 * @class Kartographer.Linkbox.LinkClass
 */

/**
 * @constructor
 * @param {Object} options **Configuration and options:**
 * @param {HTMLElement} options.container **Link container.**
 * @param {string[]} [options.dataGroups] **List of known data groups,
 *   fetchable from the server, to add as overlays onto the map.**
 * @param {Object|Array} [options.data] **Inline GeoJSON features to
 *   add to the map.**
 * @param {Array|L.LatLng} [options.center] **Initial map center.**
 * @param {number} [options.zoom] **Initial map zoom.**
 * @param {string} [options.lang] Language code
 * @param {string} [options.fullScreenRoute] Route associated to this map
 *   _(internal, used by "`<maplink>`")_.
 * @member Kartographer.Linkbox.LinkClass
 * @type {Kartographer.Linkbox.LinkClass}
 * @method
 */
function Link( options ) {
	var link = this;

	/**
	 * Reference to the link container.
	 *
	 * @type {HTMLElement}
	 */
	link.container = options.container;

	/**
	 * Reference to the map container as a jQuery element.
	 *
	 * @type {jQuery}
	 */
	link.$container = $( link.container );
	link.$container.addClass( 'mw-kartographer-link' );

	link.mapID = 'auto';
	if ( !isNaN(options.mapID) ) {
		link.mapID = options.mapID;
	}
	link.plane = 'auto';
	if ( !isNaN(options.plane) ) {
		link.plane = options.plane;
	}
	link.mapVersion = options.mapVersion || null;
	link.plainTiles = options.plainTiles || false;
	link.center = options.center || 'auto';
	link.zoom = options.zoom || 'auto';
	link.lang = options.lang || require( 'ext.kartographer.util' ).getDefaultLanguage();

	link.opened = false;
	link.useRouter = false;
	link.fullScreenRoute = options.fullScreenRoute || null;
	link.captionText = options.captionText || '';
	link.dataGroups = options.dataGroups;
	link.data = options.data;
	link.featureType = options.featureType;

	/**
	 * @property {Kartographer.Box.MapClass} [fullScreenMap=null] Reference
	 *   to the associated full screen map.
	 * @protected
	 */
	link.fullScreenMap = null;
	link.$container.on( 'click.kartographer', function () {
		link.openFullScreen();
	} );
}

/**
 * Opens the map associated to the link in a full screen dialog.
 *
 * **Uses Resource Loader module: {@link Kartographer.Dialog ext.kartographer.dialog}**
 *
 * @param {Object} [position] Map `center` and `zoom`.
 * @member Kartographer.Linkbox.LinkClass
 */
Link.prototype.openFullScreen = function ( position ) {

	var link = this,
		map = link.fullScreenMap,
		mapObject,
		el;

	position = position || {};
	position.center = position.center || link.center;
	position.zoom = typeof position.zoom === 'number' ? position.zoom : link.zoom;
	if ( isNaN(position.mapID) ) {
		position.mapID = link.mapID;
	}
	if ( isNaN(position.plane) ) {
		position.plane = link.plane;
	}
	position.mapVersion = position.mapVersion || link.mapVersion || null;
	position.plainTiles = position.plainTiles || link.plainTiles || false;
	/* eslint-disable no-underscore-dangle */
	if ( map && map._container._leaflet_id ) {
		map.setView(
			position.center,
			position.zoom
		);

		mw.loader.using( 'ext.kartographer.dialog' ).then( function () {
			require( 'ext.kartographer.dialog' ).render( map );
		} );
	/* eslint-enable no-underscore-dangle */
	} else {
		el = document.createElement( 'div' );
		el.className = 'mw-kartographer-mapDialog-map';
		mapObject = {
			container: el,
			featureType: link.featureType,
			fullscreen: true,
			link: true,
			parentLink: this,
			mapID: position.mapID,
			plane: position.plane,
			mapVersion: position.mapVersion,
			plainTiles: position.plainTiles,
			center: position.center,
			zoom: position.zoom,
			lang: link.lang,
			captionText: link.captionText,
			dataGroups: link.dataGroups,
			data: link.data,
			fullScreenRoute: link.fullScreenRoute
		};

		mw.loader.using( 'ext.kartographer.dialog' ).then( function () {
			require( 'ext.kartographer.dialog' ).renderNewMap( mapObject ).then( function ( map ) {
				link.fullScreenMap = map;
			} );
		} );
	}
};

module.exports = Link;
