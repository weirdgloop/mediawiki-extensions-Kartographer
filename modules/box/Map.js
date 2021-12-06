/**
 * # Kartographer Map class.
 *
 * Creates a map with layers, markers, and interactivity.
 *
 * Avoid creating a local variable "Map" as this is a native function in ES6.
 *
 * @alternateClassName KartographerMap
 * @class Kartographer.Box.MapClass
 * @extends L.Map
 */
var OpenFullScreenControl = require( './openfullscreen_control.js' ),
	dataLayerOpts = require( './dataLayerOpts.js' ),
	DataManager = require( './data.js' ),
	MapTileLayer = require('./MapTileLayer.js'),
	controls = require('ext.kartographer.controls'),
	scale,
	worldLatLng = new L.LatLngBounds([0, 0], [128000, 128000]),
	KartographerMap,
	precisionPerZoom = [ 0, 0, 1, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5 ],
	inlineDataLayerKey = 'kartographer-inline-data-layer',
	inlineDataLayerId = 0;

function bracketDevicePixelRatio() {
	var i, scale,
		brackets = mw.config.get( 'wgKartographerSrcsetScales' ),
		baseRatio = window.devicePixelRatio || 1;
	if ( !brackets ) {
		return 1;
	}
	brackets.unshift( 1 );
	for ( i = 0; i < brackets.length; i++ ) {
		scale = brackets[ i ];
		if ( scale >= baseRatio || ( baseRatio - scale ) < 0.1 ) {
			return scale;
		}
	}
	return brackets[ brackets.length - 1 ];
}

scale = bracketDevicePixelRatio();
scale = ( scale === 1 ) ? '' : ( '@' + scale + 'x' );

require( './leaflet.sleep.js' );
require( './enablePreview.js' );

L.CRS.Simple.infinite = false;
L.CRS.Simple.projection.bounds = new L.Bounds([
    [-12800, -12800],
    [12800, 12800]
]);

L.Map.mergeOptions( {
	sleepTime: 250,
	wakeTime: 500,
	sleepNote: false,
	sleepOpacity: 1,
	// the default zoom applied when `longitude` and `latitude` were
	// specified, but zoom was not.
 	fallbackZoom: 1,
 	crs: L.CRS.Simple,
 	maxBounds: [
 	    [0, 0],
 	    [128000, 128000]
 	],
 	attributionControl: false,
 	fullscreen: false,
 	maxZoom: 5,
 	minZoom: -3,
 	zoomControl: false // Replace default zoom controls with our own
} );

L.Popup.mergeOptions( {
	minWidth: 160,
	maxWidth: 300,
	autoPanPadding: [ 12, 12 ]
} );

/* eslint-disable no-underscore-dangle */
/**
 * Validate that the bounds contain no outlier.
 *
 * An outlier is a layer whom bounds do not fit into the world,
 * i.e. `-180 <= longitude <= 180  &&  -90 <= latitude <= 90`
 *
 * There is a special case for **masks** (polygons that cover the entire
 * globe with a hole to highlight a specific area). In this case the
 * algorithm tries to validate the hole bounds.
 *
 * @param {L.Layer} layer Layer to get and validate the bounds.
 * @return {L.LatLng|boolean} Bounds if valid.
 * @private
 */
function validateBounds( layer ) {
	var bounds = ( typeof layer.getBounds === 'function' ) && layer.getBounds();

	bounds = bounds || ( typeof layer.getLatLng === 'function' ) && layer.getLatLng();

	if ( bounds && worldLatLng.contains( bounds ) ) {
		return bounds;
	} else if ( layer instanceof L.Polygon && layer.getLatLngs() && layer.getLatLngs()[ 1 ] ) {
		// This is a geomask
		// We drop the outer ring (aka world) and only look at the layers that are holes
		bounds = new L.LatLngBounds( layer._convertLatLngs( layer.getLatLngs().slice( 1 ) ) );
		if ( worldLatLng.contains( bounds ) ) {
			return bounds;
		}
	}
	return false;
}

/**
 * Gets the valid bounds of a map/layer.
 *
 * @param {L.Map|L.Layer} layer
 * @return {L.LatLngBounds} Extended bounds
 * @private
 */
function getValidBounds( layer ) {
	var layerBounds = new L.LatLngBounds();
	if ( typeof layer.eachLayer === 'function' ) {
		layer.eachLayer( function ( child ) {
			layerBounds.extend( getValidBounds( child ) );
		} );
	} else {
		layerBounds.extend( validateBounds( layer ) );
	}
	return layerBounds;
}

KartographerMap = L.Map.extend( {
	/**
	 * @constructor
	 * @param {Object} options **Configuration and options:**
	 * @param {HTMLElement} options.container **Map container.**
	 * @param {boolean} [options.allowFullScreen=false] **Whether the map
	 *   can be opened in a full screen dialog.**
	 * @param {string[]} [options.dataGroups] **List of known data groups,
	 *   fetchable from the server, to add as overlays onto the map.**
	 * @param {Object|Array} [options.data] **Inline GeoJSON features to
	 *   add to the map.**
	 * @param {boolean} [options.alwaysInteractive=false] Prevents the map
	 *   from becoming static when the screen is too small.
	 * @param {Array|L.LatLng|string} [options.center] **Initial map center.**
	 * @param {number|string} [options.zoom] **Initial map zoom.**
	 * @param {string} [options.lang] Language for map labels
	 * @param {string} [options.style] Map style. _Defaults to
	 *  `mw.config.get( 'wgKartographerDfltStyle' )`, or `'osm-intl'`._
	 * @param {Kartographer.Box.MapClass} [options.parentMap] Parent map
	 *   _(internal, used by the full screen map to refer its parent map)_.
	 * @param {boolean} [options.fullscreen=false] Whether the map is a map
	 *   opened in a full screen dialog _(internal, used to indicate it is
	 *   a full screen map)_.
	 * @param {string} [options.fullScreenRoute] Route associated to this map
	 *   _(internal, used by "`<maplink>`" and "`<mapframe>`")_.
	 * @member Kartographer.Box.MapClass
	 */
	initialize: function ( options ) {

		var args,
			style = options.style || mw.config.get( 'wgKartographerDfltStyle' ) || 'osm-intl',
			map = this;

		// Set properties from arguments
		if (options.mapID === 'auto') {
		    options.mapID = -1;
		}
		this._mapID = options.mapID;
		if (options.plane === 'auto') {
		    options.plane = 0;
		}
		this._plane = options.plane;
		if ( options.center === 'auto' ) {
			options.center = undefined;
		}
		if ( options.zoom === 'auto' ) {
			options.zoom = undefined;
		}

		this.ready = {};
		$( options.container ).addClass( 'mw-kartographer-interactive' );

		args = L.extend( {}, L.Map.prototype.options, options, {
			// `center` and `zoom` are to undefined to avoid calling
			// setView now. setView is called later when the data is
			// loaded.
			center: undefined,
			zoom: undefined
		} );

		L.Map.prototype.initialize.call( this, options.container, args );

		/**
		 * @property {jQuery} $container Reference to the map
		 *   container.
		 * @protected
		 */
		this.$container = $( this._container );

		this.on( 'kartographerisready', function () {
			// eslint-disable-next-line camelcase
			map._kartographer_ready = true;
		} );

		this.readyFunction = function() {
		    if (map.ready.dataloader && map.ready.datalayers) {
		        map.initView(options.mapID, options.plane, options.center, options.zoom);
		        map.fire('kartographerisready');
		    }
			map.dragging.enable();
			map.touchZoom.enable();
		}

		this.rsMapInitialize(options, controls);

		/**
		 * @property {Kartographer.Box.MapClass} [parentMap=null] Reference
		 *   to the parent map.
		 * @protected
		 */
		this.parentMap = options.parentMap || null;

		/**
		 * @property {Kartographer.Box.MapClass} [parentLink=null] Reference
		 *   to the parent link.
		 * @protected
		 */
		this.parentLink = options.parentLink || null;

		/**
		 * @property {string} The feature type identifier.
		 * @protected
		 */
		this.featureType = options.featureType;

		/**
		 * @property {Kartographer.Box.MapClass} [fullScreenMap=null] Reference
		 *   to the child full screen map.
		 * @protected
		 */
		this.fullScreenMap = null;

		/**
		 * @property {boolean} useRouter Whether the map uses the Mediawiki Router.
		 * @protected
		 */
		this.useRouter = false;

		/**
		 * @property {string} [fullScreenRoute=null] Route associated to this map.
		 * @protected
		 */
		this.fullScreenRoute = options.fullScreenRoute || null;

		/**
		 * @property {string} [captionText=''] Caption associated to the map.
		 * @protected
		 */
		this.captionText = options.captionText || '';

		/**
		 * @property {string} lang Language code to use for labels
		 * @type {string}
		 */
		this.lang = options.lang || mw.config.get( 'wgPageContentLanguage' );

		/**
		 * @property {Object} dataLayers References to the data layers.
		 * @protected
		 */
		this.dataLayers = {};

		/* Add map controls */

		/**
		 * @property {L.Control.Attribution} attributionControl Reference
		 *   to attribution control.
		 */
		this.attributionControl.setPrefix( '' );

		if ( options.allowFullScreen ) {
			// embed maps, and full screen is allowed
			this.on( 'dblclick', function () {
				map.openFullScreen();
			} );

			/**
			 * @property {Kartographer.Box.OpenFullScreenControl|undefined} [openFullScreenControl=undefined]
			 * Reference to open full screen control.
			 */
			this.openFullScreenControl = new OpenFullScreenControl( { position: 'topright' } ).addTo( this );
		}

		/* Initialize map */

		if ( !this._container.clientWidth || !this._container.clientHeight ) {
			this._fixMapSize();
		}
		if ( !this.options.fullscreen ) {
			this.doubleClickZoom.disable();
		}

		if ( !this.options.fullscreen && !options.alwaysInteractive ) {
			this._invalidateInteractive();
		}

		// The `ready` function has not fired yet so there is no center or zoom defined.
		// Disable panning and zooming until that has happened.
		// See T257872.
		map.dragging.disable();
		map.touchZoom.disable();

		if ( this.parentMap ) {
			// eslint-disable-next-line no-jquery/no-each-util
			$.each( this.parentMap.dataLayers, function ( groupId, layer ) {
				var newLayer = map.addGeoJSONLayer( groupId, layer.getGeoJSON(), layer.options );
				newLayer.dataGroup = layer.group;
			} );
			map.ready.datalayers = true;
			map.readyFunction();
			return;
		}

		this.addDataGroups( options.dataGroups ).then( function () {
			if ( typeof options.data === 'object' ) {
				map.addDataLayer( options.data ).then( function () {
					map.ready.datalayers = true;
					map.readyFunction();

				} );
			} else {
				map.ready.datalayers = true;
				map.readyFunction();
			}
		}, function () {
			// T25787
			mw.log.error( 'Unable to add datalayers to map.' );
		} );
	},

	/**
	 * Runs the given callback **when the Kartographer map has finished
	 * loading the data layers and positioning** the map with a center and
	 * zoom, **or immediately if it happened already**.
	 *
	 * @param {Function} callback
	 * @param {Object} [context]
	 * @chainable
	 */
	doWhenReady: function ( callback, context ) {
		if ( this._kartographer_ready ) {
			callback.call( context || this, this );
		} else {
			this.on( 'kartographerisready', callback, context );
		}
		return this;
	},

	/**
	 * Sets the initial center and zoom of the map, and optionally calls
	 * {@link #setView} to reposition the map.
	 *
	 * @param {L.LatLng|number[]} [center]
	 * @param {number} [zoom]
	 * @param {boolean} [setView=true]
	 * @chainable
	 */
	initView: function ( mapID, plane, center, zoom ) {
		if ( Array.isArray( center ) ) {
			if ( !isNaN( center[ 0 ] ) && !isNaN( center[ 1 ] ) ) {
				center = L.latLng( center );
			} else {
				center = undefined;
			}
		}

		zoom = isNaN( zoom ) ? undefined : zoom;
		this._initialPosition = {
			mapID: mapID,
			plane: plane,
			center: center,
			zoom: zoom
		};
		let location = center;
		if (center != undefined) {
			location = [center.lat, center.lng];
		}
		this.setMapID(mapID, plane, zoom, location);
		return this;
	},

	/**
	 * Gets and adds known data groups as layers onto the map.
	 *
	 * The data is loaded from the server if not found in memory.
	 *
	 * @param {string[]} dataGroups
	 * @return {jQuery.Promise}
	 */
	addDataGroups: function ( dataGroups ) {
		var map = this;

		if ( !dataGroups || !dataGroups.length ) {
			return $.Deferred().resolve().promise();
		}

		return DataManager.loadGroups( dataGroups ).then( function ( dataGroups ) {
			// eslint-disable-next-line no-jquery/no-each-util
			$.each( dataGroups, function ( key, group ) {
				var layerOptions = {
						attribution: group.attribution
					},
					layer;
				if ( group.isExternal ) {
					layerOptions.name = group.attribution;
				}
				if ( !$.isEmptyObject( group.getGeoJSON() ) ) {
					layer = map.addGeoJSONLayer( group.id, group.getGeoJSON(), layerOptions );
					layer.dataGroup = group;
				} else {
					mw.log.warn( 'Layer not found or contains no data: "' + group.id + '"' );
				}
			} );
		} );
	},

	/**
	 * Creates a new GeoJSON layer and adds it to the map.
	 *
	 * @param {Object} groupData Features
	 * @param {Object} [options] Layer options
	 * @return {jQuery.Promise} Promise which resolves when the layer has been added
	 */
	addDataLayer: function ( groupData, options ) {
		var map = this;
		options = options || {};

		return DataManager.load( groupData ).then( function ( dataGroups ) {
			// eslint-disable-next-line no-jquery/no-each-util
			$.each( dataGroups, function ( key, group ) {
				var groupId = inlineDataLayerKey + inlineDataLayerId++,
					layerOptions = {
						attribution: group.attribution || options.attribution
					},
					layer;
				if ( group.isExternal ) {
					layerOptions.name = group.attribution;
				}
				if ( !$.isEmptyObject( group.getGeoJSON() ) ) {
					layer = map.addGeoJSONLayer( groupId, group.getGeoJSON(), layerOptions );
					layer.dataGroup = layer;
				} else {
					mw.log.warn( 'Layer not found or contains no data: "' + groupId + '"' );
				}
			} );
		} );
	},

	/**
	 * Creates a new GeoJSON layer and adds it to the map.
	 *
	 * @param {string} groupName The layer name (id without special
	 *   characters or spaces).
	 * @param {Object} geoJson Features
	 * @param {Object} [options] Layer options
	 * @return {L.mapbox.FeatureLayer} Added layer
	 */
	addGeoJSONLayer: function ( groupName, geoJson, options ) {
	    let map = this;
	    var layer;
	    try {
	        options.pointToLayer = function (feature, latlng) {
	            if (feature.properties.shape) {
	                let shp = feature.properties.shape.toLowerCase()
	                if (shp == 'circlemarker' || shp == 'circle') {
	                    // Cricles and circle markers
	                    if (isNaN(feature.properties.radius)) {
	                        feature.properties.radius = 10
	                    }
	                    let opts = {
	                        radius: feature.properties.radius || 10,
	                        color: feature.properties.stroke || '#3388ff',
	                        weight: feature.properties['stroke-width'] || 3,
	                        opacity: feature.properties['stroke-opacity'] || 1,
	                        fillColor: feature.properties.fill || '#3388ff',
	                        fillOpacity: feature.properties['fill-opacity'] || 0.2,
	                    }
	                    if (shp == 'circlemarker') {
	                        return L.circleMarker(latlng, opts)
	                    }
	                    return L.circle(latlng, opts)
	                } else if (shp == 'text') {
	                    // Text only markers
	                    let mk = L.marker(latlng, { opacity:0.5, keyboard:false, interactive: false,
	                        icon:L.icon({ iconUrl:map.config.iconURL + "pin_grey.svg", iconSize:[1,1], iconAnchor:[0.5,1] })
	                    })
	                    let cl = 'leaflet-vis-tooltip'
	                    if (feature.properties.class) {
	                        cl = cl + ' ' + feature.properties.class
	                    }
	                    mk.bindTooltip(feature.properties.label || 'Label', {
	                        permanent: true,
	                        className: cl,
	                        direction: feature.properties.direction || 'auto',
	                        opacity: 1,
	                        interactive: true,
	                    })
	                    return mk
	                } else if (shp == 'dot' || shp == 'squaredot') {
	                    // Dot and square dot markers
	                    let iclass = 'leaflet-dot'
	                    if (shp == 'squaredot') {
	                        iclass = 'leaflet-sqdot'
	                    }
	                    let istyle = ''
	                    if (feature.properties.fill) {
	                        istyle = ' style="background-color:'+feature.properties.fill+';"'
	                    }
	                    let html = '<div class="'+iclass+'"'+istyle+'></div>'
	                    let icon = L.divIcon({
	                        className: 'leaflet-div-dot',
	                        html: html,
	                        iconSize: feature.properties.iconSize || [12, 12],
	                    })
	                    return L.marker(latlng, {icon: icon})
	                }
	            } else if (feature.properties.radius) {
	                if (isNaN(feature.properties.radius)) {
	                    feature.properties.radius = 10
	                }
	                let opts = {
	                    radius: feature.properties.radius || 10,
	                    color: feature.properties.stroke || '#3388ff',
	                    weight: feature.properties['stroke-width'] || 3,
	                    opacity: feature.properties['stroke-opacity'] || 1,
	                    fillColor: feature.properties.fill || '#3388ff',
	                    fillOpacity: feature.properties['fill-opacity'] || 0.2,
	                }
	                return L.circleMarker(latlng, opts)
	            } else {
	                let iconUrl = map.config.iconURL + "pin_grey.svg"
	                let iconSize = [26, 42]
	                let iconAnchor = [13, 42]
	                let popupAnchor = [0, -42]
	                if (map.markerIcons[feature.properties.icon]) {
	                    iconUrl = map.config.iconURL + map.markerIcons[feature.properties.icon]
	                }
	                if (feature.properties.iconSize) {
	                    iconSize = feature.properties.iconSize
	                }
	                if (feature.properties.iconWikiLink) {
	                    iconSize = feature.properties.iconSize
	                    iconAnchor = feature.properties.iconAnchor
	                    popupAnchor = feature.properties.popupAnchor
	                    if (feature.properties.iconWikiLink.startsWith(map.config.wikiImageURL)) {
	                        iconUrl = feature.properties.iconWikiLink;
	                    } else {
	                        let filename = feature.properties.iconWikiLink
	                        iconUrl = '/images/' + filename;
	                    }
	                }
	                let icon = L.icon({iconUrl: iconUrl, iconSize: iconSize, iconAnchor: iconAnchor, popupAnchor: popupAnchor})
	                return L.marker(latlng, {icon: icon})
	            }
	        };
	        layer = L.mapbox.featureLayer( geoJson, $.extend( {}, dataLayerOpts, options ) ).setFilter(function(feature){
	            return (feature.properties.mapID == map._mapID) && (feature.properties.plane == map._plane)
	        }).addTo( this );
	        layer.getAttribution = function () {
	            return this.options.attribution;
	        };
	        this.attributionControl.addAttribution( layer.getAttribution() );
	        this.dataLayers[ groupName ] = layer;
	        return layer;
	    } catch ( e ) {
	        mw.log( e );
	    }
	},

	/**
	 * Opens the map in a full screen dialog.
	 *
	 * **Uses Resource Loader module: {@link Kartographer.Dialog ext.kartographer.dialog}**
	 *
	 * @param {Object} [position] Map `center` and `zoom`.
	 */
	openFullScreen: function ( position ) {
		this.doWhenReady( function () {
			var map = this.options.link ? this : this.fullScreenMap;
			position = position || this.getMapPosition();

			if ( map && map._updatingHash ) {
				// Skip - there is nothing to do.
				map._updatingHash = false;
				return;

			} else if ( map ) {

				this.doWhenReady( function () {
					map.initView(
						position.mapID,
						position.plane,
						position.center,
						position.zoom
					);
				} );
			} else {
				map = this.fullScreenMap = new KartographerMap( {
					container: L.DomUtil.create( 'div', 'mw-kartographer-mapDialog-map' ),
					mapID: position.mapID,
					plane: position.plane,
					center: position.center,
					zoom: position.zoom,
					lang: this.lang,
					featureType: this.featureType,
					fullscreen: true,
					captionText: this.captionText,
					fullScreenRoute: this.fullScreenRoute,
					parentMap: this,
					zoomControl: false
				} );
				// resets the right initial position silently afterwards.
				map.initView(
					position.mapID,
					position.plane,
					position.center,
					position.zoom
				);
			}
			mw.loader.using( 'ext.kartographer.dialog' ).then( function () {
				map.doWhenReady( function () {
					require( 'ext.kartographer.dialog' ).render( map );
				} );
			} );
		}, this );
	},

	/**
	 * Closes full screen dialog.
	 *
	 * @chainable
	 */
	closeFullScreen: function () {
		require( 'ext.kartographer.dialog' ).close();
		return this;
	},

	/**
	 * Gets initial map center and zoom.
	 *
	 * @return {Object}
	 * @return {L.LatLng} return.center
	 * @return {number} return.zoom
	 */
	getInitialMapPosition: function () {
		return this._initialPosition;
	},

	/**
	 * Gets current map center and zoom.
	 *
	 * @param {Object} [options]
	 * @param {boolean} [options.scaled=false] Whether you want the
	 *   coordinates to be scaled to the current zoom.
	 * @return {Object}
	 * @return {L.LatLng} return.center
	 * @return {number} return.zoom
	 */
	getMapPosition: function ( options ) {
		var mapID = this.getMapID(),
			plane = this.getPlane(),
			center = this.getCenter(),
			zoom = this.getZoom();

		options = options || {};

		if ( options.scaled ) {
			center = L.latLng( this.getScaleLatLng( center.lat, center.lng, zoom ) );
		}

		return {
			mapID: mapID,
			plane: plane,
			center: center,
			zoom: zoom
		}
	},

	/**
	 * Formats the full screen route of the map, such as:
	 *   `/map/:maptagId(/:zoom/:longitude/:latitude)`
	 *
	 * The hash will contain the portion between parenthesis if and only if
	 * one of these 3 values differs from the initial setting.
	 *
	 * @return {string} The route to open the map in full screen mode.
	 */
	getHash: function() {
	    if (!this._initialPosition) {
	        return this.fullScreenRoute;
	    }
	
	    // eslint-disable-next-line vars-on-top
	    var hash = this.fullScreenRoute,
	        currentPosition = this.getMapPosition(),
	        initialPosition = this._initialPosition,
	        newHash = currentPosition.zoom + '/' +
	        currentPosition.mapID + '/' +
	        currentPosition.plane + '/' +
	        this.getScaleLatLng(
	            currentPosition.center.lat,
	            currentPosition.center.lng,
	            currentPosition.zoom
	        ).join('/'),
	        initialHash = initialPosition.center && (
	            initialPosition.zoom + '/' +
	            initialPosition.mapID + '/' +
	            initialPosition.plane + '/' +
	            this.getScaleLatLng(
	                initialPosition.center.lat,
	                initialPosition.center.lng,
	                initialPosition.zoom
	            ).join('/')
	        );
	
	    if (newHash !== initialHash) {
	        hash += '/' + newHash;
	    }
	
	    return hash;
	},

	/**
	 * Sets the map at a certain zoom and position.
	 *
	 * When the zoom and map center are provided, it falls back to the
	 * original `L.Map#setView`.
	 *
	 * If the zoom or map center are not provided, this method will
	 * calculate some values so that all the point of interests fit within the
	 * map.
	 *
	 * **Note:** Unlike the original `L.Map#setView`, it accepts an optional
	 * fourth parameter to decide whether to update the container's data
	 * attribute with the calculated values (for performance).
	 *
	 * @param {L.LatLng|number[]|string} [center] Map center.
	 * @param {number} [zoom]
	 * @param {Object} [options] See [L.Map#setView](https://www.mapbox.com/mapbox.js/api/v2.3.0/l-map-class/)
	 *   documentation for the full list of options.
	 * @param {boolean} [save=false] Whether to update the data attributes.
	 * @chainable
	 */
	setView: function ( center, zoom, options, save ) {
		var maxBounds,
			initial = this.getInitialMapPosition();

		if ( Array.isArray( center ) ) {
			if ( !isNaN( center[ 0 ] ) && !isNaN( center[ 1 ] ) ) {
				center = L.latLng( center );
			} else {
				center = undefined;
			}
		}
		if ( center ) {
			zoom = isNaN( zoom ) ? this.options.fallbackZoom : zoom;
			L.Map.prototype.setView.call( this, center, zoom, options );
		} else {
			// Determines best center of the map
			// Bounds calulation depends on the size of the frame
			// If the frame is not visible, there is no point in calculating
			// You need to call invalidateSize when it becomes available again
			maxBounds = getValidBounds( this );

			if ( maxBounds.isValid() ) {
				this.fitBounds( maxBounds );
			} else {
				this.fitWorld();
			}
			// (Re-)Applies expected zoom

			if ( initial && !isNaN( initial.zoom ) ) {
				this.setZoom( initial.zoom );
			}

			// Save the calculated position,
			// unless we already know it is incorrect due to being loaded
			// when the frame was invisble and had no dimensions to base
			// autozoom, autocenter on.
			// eslint-disable-next-line no-jquery/no-sizzle
			if ( this.$container.is( ':visible' ) && save ) {
				// Updates map data.
				this.initView( this.getMapID(), this.getPlane(), this.getCenter(), this.getZoom() );
				// Updates container's data attributes to avoid `NaN` errors
				if ( !this.fullscreen ) {
					this.$container.closest( '.mw-kartographer-interactive' ).data( {
						zoom: this.getZoom(),
						longitude: this.getCenter().lng,
						latitude: this.getCenter().lat
					} );
				}
			}
		}
		return this;
	},

	/**
	 * Convenient method that formats the coordinates based on the zoom level.
	 *
	 * @param {number} lat
	 * @param {number} lng
	 * @param {number} [zoom]
	 * @return {Array} Array with the zoom (number), the latitude (string) and
	 *   the longitude (string).
	 */
	getScaleLatLng: function ( lat, lng, zoom ) {
		zoom = typeof zoom === 'undefined' ? this.getZoom() : zoom;

		return [
			lat.toFixed( precisionPerZoom[ zoom ] ),
			lng.toFixed( precisionPerZoom[ zoom ] )
		];
	},

	/**
	 * @localdoc Extended to also destroy the {@link #fullScreenMap} when
	 *   it exists.
	 *
	 * @override
	 * @chainable
	 */
	remove: function () {
		var parent = this.parentMap || this.parentLink;

		if ( this.fullScreenMap ) {
			L.Map.prototype.remove.call( this.fullScreenMap );
			this.fullScreenMap = null;
		}
		if ( parent ) {
			parent.fullScreenMap = null;
		}

		return L.Map.prototype.remove.call( this );
	},

	/**
	 * Fixes map size when the container is not visible yet, thus has no
	 * physical size.
	 *
	 * - In full screen, we take the viewport width and height.
	 * - Otherwise, the hack is to try jQuery which will pick up CSS
	 *   dimensions. (T125263)
	 * - Finally, if the calculated size is still [0,0], the script looks
	 *   for the first visible parent and takes its `height` and `width`
	 *   to initialize the map.
	 *
	 * @protected
	 */
	_fixMapSize: function () {
		var width, height, $visibleParent;

		if ( this.options.fullscreen ) {
			this._size = new L.Point(
				window.innerWidth,
				window.innerHeight
			);
			this._sizeChanged = false;
			return;
		}

		// eslint-disable-next-line no-jquery/no-sizzle
		$visibleParent = this.$container.closest( ':visible' );

		// Try `max` properties.
		width = $visibleParent.css( 'max-width' );
		height = $visibleParent.css( 'max-height' );
		width = ( !width || width === 'none' ) ? $visibleParent.width() : width;
		height = ( !height || height === 'none' ) ? $visibleParent.height() : height;

		while ( ( !height && $visibleParent.parent().length ) ) {
			$visibleParent = $visibleParent.parent();
			width = $visibleParent.outerWidth( true );
			height = $visibleParent.outerHeight( true );
		}

		this._size = new L.Point( width, height );
	},

	/**
	 * Adds Leaflet.Sleep handler and overrides `invalidateSize` when the map
	 * is not in full screen mode.
	 *
	 * The new `invalidateSize` method calls {@link #toggleStaticState} to
	 * determine the new state and make the map either static or interactive.
	 *
	 * @chainable
	 * @protected
	 */
	_invalidateInteractive: function () {

		// add Leaflet.Sleep when the map isn't full screen.
		this.addHandler( 'sleep', L.Map.Sleep );

		// `invalidateSize` is triggered on window `resize` events.
		this.invalidateSize = function ( options ) {
			L.Map.prototype.invalidateSize.call( this, options );

			if ( this.options.fullscreen ) {
				// skip if the map is full screen
				return this;
			}
			// Local debounce because OOjs is not yet available.
			if ( this._staticTimer ) {
				clearTimeout( this._staticTimer );
			}
			this._staticTimer = setTimeout( this.toggleStaticState, 200 );
			return this;
		};
		// Initialize static state.
		this.toggleStaticState = L.Util.bind( this.toggleStaticState, this );
		this.toggleStaticState();
		return this;
	},

	/**
	 * Makes the map interactive IIF :
	 *
	 * - the `device width > 480px`,
	 * - there is at least a 200px horizontal margin.
	 *
	 * Otherwise makes it static.
	 *
	 * @chainable
	 */
	toggleStaticState: function () {
		var deviceWidth = window.innerWidth,
			// All maps static if deviceWitdh < 480px
			isSmallWindow = deviceWidth <= 480,
			staticMap;

		// If the window is wide enough, make sure there is at least
		// a 200px margin to scroll, otherwise make the map static.
		staticMap = isSmallWindow || ( this.getSize().x + 200 ) > deviceWidth;

		// Skip if the map is already static
		if ( this._static === staticMap ) {
			return;
		}

		// Toggle static/interactive state of the map
		this._static = staticMap;

		if ( staticMap ) {
			this.sleep._sleepMap();
			this.sleep.disable();
			this.scrollWheelZoom.disable();
		} else {
			this.sleep.enable();
		}
		this.$container.toggleClass( 'mw-kartographer-static', staticMap );
		return this;
	},

	/**
	 * Reinitialize a view that was originally hidden.
	 *
	 * These views will have calculated autozoom and autoposition of shapes incorrectly
	 * because the size of the map frame will initially be 0.
	 *
	 * We need to fetch the original position information, invalidate to make sure the
	 * frame is readjusted and then reset the view, so that it will recalculate the
	 * autozoom and autoposition if needed.
	 *
	 * @override
	 * @chainable
	 */
	invalidateSizeAndSetInitialView: function () {
		var position = this.getInitialMapPosition();
		this.invalidateSize();
		if ( position ) {
			// at rare times during load fases, position might be undefined
			this.initView( this.getMapID(), this.getPlane(), position.center, position.zoom );
		}

		return this;
	}
} );

KartographerMap = KartographerMap.extend({
    // Setup map
    rsMapInitialize: function(options, controls) {
        this._controllers = {};
        this.config = mw.config.get('wgKartographerDataConfig');
        var mesVers = mw.message('kartographer-map-version');
        if (mesVers.exists()) {
            // Backup to be safe
            var verstr = mesVers.text();
            if ( verstr != '⧼kartographer-map-version⧽') {
                this.config.mapVersion = mesVers.text();
            }
        }
        var mapVers = this.config.mapVersion;
        if (options.mapVersion) {
            mapVers = options.mapVersion;
        }
        this.config.baseMapsFile = L.Util.template(this.config.baseMapsFile, {mapVersion: this.config.mapVersion});
        this.markerIcons = {
            "greyPin": "pin_grey.svg",
            "redPin": "pin_red.svg",
            "greenPin": "pin_green.svg",
            "bluePin": "pin_blue.svg",
            "cyanPin": "pin_cyan.svg",
            "magentaPin": "pin_magenta.svg",
            "yellowPin": "pin_yellow.svg",
        };
        this._baseMaps = {}

        this.fullscreen = options.fullscreen;

        this.setupControls(controls);
        this.imageCache = {}
        if (options.parentMap) {
            this.ldl_load();
            this._plane = options.parentMap._plane;
            this._mapID = options.parentMap._mapID;
            this._mapVersion = options.parentMap._mapVersion;
            this._plainTiles = options.parentMap._plainTiles;
        } else {
            if (this._baseMaps[0]) {
                this.ready.dataloader = true;
            } else {
                this.ldl_load();
            }
            this._plane = 0;
            this._mapID = -1;
            this._mapVersion = mapVers;
            this._plainTiles = options.plainTiles || false;
        }
    },

    getMapID: function() {
        return this._mapID;
    },

    getPlane: function() {
        return this._plane;
    },

    ldl_load: async function(){
        let map = this;
        new Promise(async function(resolve, reject) {
          var responseData = await fetch(map.config.baseMapsFile);
          var data = await responseData.json();
          map.setBaseMaps(data);
          map.ready.dataloader = true;
          map.readyFunction();
          resolve();
        });
    },

    setBaseMaps: function(data){
        let baseMaps = {}
        for(let i in data) {
          baseMaps[data[i].mapId] = data[i];
        }
        this._baseMaps = baseMaps;
        if (this.fullscreen) {
          this._controllers.mapSelect._resetSelect(baseMaps);
        }
    },

    setPlane: function(plane) {
        this._plane = plane
        this.selectedLayer.redraw()
        $.each( this.dataLayers, function ( groupId, layer ) {
            layer.clearLayers();
            layer._initialize(layer._geojson);
        } );
    },

    setMapID: function(mapID, plane, zoom, location) {
        this._mapID = mapID

        this.loadBaseMap(mapID);

        if (plane === undefined) {
          plane = this._baseMaps[mapID].defaultPlane || 0
        }
        if (this.fullscreen) {
          this._controllers.mapSelect._changeSelectedOption(mapID)
          this._controllers.plane.setPlane(plane)
        } else {
            this.setPlane(plane)
        }
        if (zoom === undefined) {
          zoom = 2
        }
        if (location === undefined) {
            // TODO: ???
          location = [ this._baseMaps[mapID].center[1],
              this._baseMaps[mapID].center[0] ]
        }
        this.setView(location, zoom)
    },

    loadBaseMap: function(mapId){
        // Check if there is a BaseMap displayed
        if(this.selectedLayer !== undefined){
          this.removeLayer(this.selectedLayer);
        }

        let data = this._baseMaps[mapId] || {}
        let bounds = this._translateBounds(data.bounds)
        let baseUrl = this.config.baseTileURL
        if (this._plainTiles && this.config.basePlainTileURL) {
            baseUrl = this.config.basePlainTileURL;
        }
        this.selectedLayer = new MapTileLayer(
          baseUrl + this.config.tileURLFormat, {
          tileSize: this.config.tileSize || 256,
          bounds: bounds,
          minZoom: -3,
          maxZoom: 5,
          maxNativeZoom: this.config.maxNativeZoom || 3,
          mapID: mapId,
          mapVersion: this._mapVersion,
        });
        this.addLayer(this.selectedLayer);
        this.setMaxBounds(bounds);
    },

    _translateBounds: function(bounds){
        var newbounds = [ [ -12000, -12000 ], [ 14000, 14000 ] ];
        if(Array.isArray(bounds) && bounds.length === 2){
          // South-West
          if(Array.isArray(bounds[0]) && bounds[0].length === 2){
            newbounds[0][0] = bounds[0][1];
            newbounds[0][1] = bounds[0][0];
          }
          // North-East
          if(Array.isArray(bounds[1]) && bounds[1].length === 2){
            newbounds[1][0] = bounds[1][1];
            newbounds[1][1] = bounds[1][0];
          }
        }
        return newbounds;
    },

    setupControls: function(controls) {
        var controller;
        // this._map.fullscreenControl.setPosition('topright');
        // top left
        if (!this.fullscreen) {
            this._controllers.zoom = new controls.CustomZoom({
                position: 'topleft',
                displayZoomLevel: false
            });
        }

        // top right
        if (this.fullscreen) {
            this._controllers.zoom = new controls.CustomZoom({
                position: 'topright',
                displayZoomLevel: true
            });
            this._controllers.help = new controls.Help();
            // this._controllers.icons = new controls.Icons();
            // this._controllers.options = new controls.Options();
        }

        // bottom left
        if (this.fullscreen) {
            this._controllers.mapSelect = new controls.MapSelect({
                visible: true
            });
        }
        this._controllers.attribution = L.control.attribution({
            prefix: this.config.attribution
        });

        //bottom right
        if (this.fullscreen) {
            this._controllers.plane = new controls.Plane({
                visible: true
            });

        }

        // add controllers to map
        for (controller in this._controllers) {
            this._controllers[controller].addTo(this);
        }

        // add class to bottom-right to make vertical
        this._container.querySelector('.leaflet-control-container > .leaflet-bottom.leaflet-right').className += ' vertical';
    }
});

function map( options ) {
	return new KartographerMap( options );
}

module.exports = {
	Map: KartographerMap,
	map: map
};
