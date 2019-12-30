/**
 * # Kartographer Map class.
 *
 * Creates a map with layers, markers, and interactivity.
 *
 * Avoid creating a local variable "Map" as this is a native function in ES6.
 *
 * @alias KartographerMap
 * @class Kartographer.Box.MapClass
 * @extends L.Map
 */

var markerData = {
  "folder": "https://maps.runescape.wiki/osrs/images/",
  "icons": {
    "greyPin":{
      "filename": "pin_grey.svg"
    },
    "greenPin":{
      "filename": "pin_green.svg"
    },
    "redPin":{
      "filename": "pin_red.svg"
    }
  }
}

var CanvasLayer = L.GridLayer.extend({

    options: {
        // @option minZoom: Number = 0
        // Minimum zoom number.
        minZoom: -3
    },
    binarySearch: function(arr, target) {
        let low = 0
        let high = arr.length;
        while (low != high) {
            let mid = Math.floor((low + high) / 2);
            if (arr[mid][0] < target) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low
    },

    createTile: function(coords){
        // create a <canvas> element for drawing
        var tile = L.DomUtil.create('canvas', 'leaflet-tile');
        // setup tile width and height according to the options
        var size = this.getTileSize();
        tile.width = size.x;
        tile.height = size.y;
        // get a canvas context and draw something on it using coords.x, coords.y and coords.z
        var ctx = tile.getContext('2d');
        let ICON_SIZE = 15

        if (coords.z >= 0) {
            if (this._map.minimapIconLocations[this._map._mapID]) {
                if (this._map.minimapIconLocations[this._map._mapID][this._map._plane]) {
                    let iconArr = this._map.minimapIconLocations[this._map._mapID][this._map._plane]
                    let pxPerSquare = Math.pow(2, coords.z)
                    let squaresPerTile = size.x / pxPerSquare
                    let xLow = coords.x * squaresPerTile
                    let xHigh = (coords.x + 1) * squaresPerTile - 1
                    let yLow = (-coords.y - 1) * squaresPerTile
                    let yHigh = (-coords.y) * squaresPerTile - 1
                    // OPTIMIZATION: don't look through all icons, look only at ones already sorted by x coordinate
                    let index = this.binarySearch(iconArr, xLow-ICON_SIZE)
                    for (let i = index; i < iconArr.length; i++) {
                        let x = iconArr[i][0]
                        let y = iconArr[i][1]
                        let iconType = iconArr[i][2]
                        if (x > xHigh+ICON_SIZE) break
                        if (y >= yLow-ICON_SIZE && y <= yHigh+ICON_SIZE) {
                            let src = this._map.minimapIcons.folder + this._map.minimapIcons.icons[iconType].filename
                            let canvasX = (x-xLow)*pxPerSquare
                            let canvasY = (squaresPerTile-1-(y-yLow))*pxPerSquare
                            // OPTIMIZATION: use cache for already loaded images.
                            let img = this._map.imageCache[src]
                            if (img) {
                                ctx.drawImage(img,canvasX-Math.floor(img.width/2),canvasY-Math.floor(img.height/2))
                            } else {
                                img = new Image
                                layer = this
                                img.onload = function(){
                                  ctx.drawImage(img,canvasX-Math.floor(img.width/2),canvasY-Math.floor(img.height/2))
                                  layer._map.imageCache[src] = img
                                };
                                img.src = src
                            }
                        }
                    }
                }            
            }
        }
        return tile;
    }
});

module.Map = (function(mw, OpenFullScreenControl, dataLayerOpts, ScaleControl, DataManager, controls) {
    // Skip unused variables, some have become unused because of RS Map
    var scale,
        /* urlFormat,
        mapServer = mw.config.get( 'wgKartographerMapServer' ), */
        worldLatLng = new L.LatLngBounds([0, 0], [128000, 128000]),
        KartographerMap,
        precisionPerZoom = [0, 0, 1, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5],
        inlineDataLayerKey = 'kartographer-inline-data-layer',
        inlineDataLayerId = 0;

    function bracketDevicePixelRatio() {
        var i, scale,
            brackets = mw.config.get('wgKartographerSrcsetScales'),
            baseRatio = window.devicePixelRatio || 1;
        if (!brackets) {
            return 1;
        }
        brackets.unshift(1);
        for (i = 0; i < brackets.length; i++) {
            scale = brackets[i];
            if (scale >= baseRatio || (baseRatio - scale) < 0.1) {
                return scale;
            }
        }
        return brackets[brackets.length - 1];
    }

    scale = bracketDevicePixelRatio();
    scale = (scale === 1) ? '' : ('@' + scale + 'x');
    // urlFormat = '/{z}/{x}/{y}' + scale + '.png';

    // Don't make the map infinite (it is not round anymore)
    L.CRS.Simple.infinite = false;
    L.CRS.Simple.projection.bounds = new L.Bounds([
        [0, 0],
        [12800, 12800]
    ]);

    L.Map.mergeOptions({
        sleepTime: 250,
        wakeTime: 500,
        sleepNote: false,
        sleepOpacity: 1,
        // the default zoom applied when `longitude` and `latitude` were
        // specified, but zoom was not.å
        // Change the Map to a flat map for RS
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
        zoomControl: false, // Replace default zoom controls with our own
    });

    L.Popup.mergeOptions({
        minWidth: 160,
        maxWidth: 300,
        autoPanPadding: [12, 12],
    });

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
    function validateBounds(layer) {
        var bounds = (typeof layer.getBounds === 'function') && layer.getBounds();

        bounds = bounds || (typeof layer.getLatLng === 'function') && layer.getLatLng();

        if (bounds && worldLatLng.contains(bounds)) {
            return bounds;
        } else if (layer instanceof L.Polygon && layer._holes && layer._holes[0]) {
            bounds = new L.LatLngBounds(layer._convertLatLngs(layer._holes[0]));
            if (worldLatLng.contains(bounds)) {
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
    function getValidBounds(layer) {
        var layerBounds = new L.LatLngBounds();
        if (typeof layer.eachLayer === 'function') {
            layer.eachLayer(function(child) {
                layerBounds.extend(getValidBounds(child));
            });
        } else {
            layerBounds.extend(validateBounds(layer));
        }
        return layerBounds;
    }

    KartographerMap = L.Map.extend({
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
         * @param {Array|L.LatLng} [options.center] **Initial map center.**
         * @param {number} [options.zoom] **Initial map zoom.**
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
        initialize: function(options) {

            var args,
                style = options.style || mw.config.get('wgKartographerDfltStyle') || 'osm-intl',
                map = this;

            // Set properties from arguments
            if (options.mapID === 'auto') {
                options.mapID = 0;
            }
            this._mapID = options.mapID;
            if (options.plane === 'auto') {
                options.plane = 0;
            }
            this._plane = options.plane;
            if (options.center === 'auto') {
                options.center = undefined;
            }
            if (options.zoom === 'auto') {
                options.zoom = undefined;
            }

            this.ready = {}
            $(options.container).addClass('mw-kartographer-interactive');

            args = L.extend({}, L.Map.prototype.options, options, {
                // `center` and `zoom` are to undefined to avoid calling
                // setView now. setView is called later when the data is
                // loaded.
                center: undefined,
                zoom: undefined,
            });

            L.Map.prototype.initialize.call(this, options.container, args);

            /**
             * @property {jQuery} $container Reference to the map
             *   container.
             * @protected
             */
            this.$container = $(this._container);

            this.on('kartographerisready', function() {
                // eslint-disable-next-line camelcase
                map._kartographer_ready = true;
            });

            this.readyFunction = function() {
                if (map.ready.minimap && map.ready.dataloader && map.ready.datalayers) {
                    map.initView(options.mapID, options.plane, options.center, options.zoom);
                    map.fire('kartographerisready');
                }
            }

            // Add the OSRS Init function
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
            this.lang = options.lang || mw.config.get('wgPageContentLanguage');

            /**
             * @property {Object} dataLayers References to the data layers.
             * @protected
             */
            this.dataLayers = {};


            if (options.allowFullScreen) {
                // embed maps, and full screen is allowed
                this.on('dblclick', function() {
                    // We need this hack to differentiate these events from `hashopen` events.
                    map.clicked = true;
                    mw.track('mediawiki.kartographer', {
                        action: 'open',
                        isFullScreen: true,
                        feature: map,
                    });
                    map.openFullScreen();
                });

                /**
                 * @property {Kartographer.Box.OpenFullScreenControl|undefined} [openFullScreenControl=undefined]
                 * Reference to open full screen control.
                 */
                this.openFullScreenControl = new OpenFullScreenControl({
                    position: 'topright'
                }).addTo(this);
            }

            /* Initialize map */

            if (!this._container.clientWidth || !this._container.clientHeight) {
                this._fixMapSize();
            }
            if (!this.options.fullscreen) {
                this.doubleClickZoom.disable();
            }

            if (!this.options.fullscreen && !options.alwaysInteractive) {
                this._invalidateInterative();
            }

            if (this.parentMap) {                
                $.each( this.parentMap.dataLayers, function ( groupId, layer ) {
                    var newLayer = map.addGeoJSONLayer( groupId, layer.getGeoJSON(), layer.options );
                    newLayer.dataGroup = layer.group;
                } );
                map.ready.datalayers = true
                map.readyFunction();
                return;
            }

            this.addDataGroups(options.dataGroups).then(function() {
                if (typeof options.data === 'object') {
                    map.addDataLayer(options.data).then(function() {
                        map.ready.datalayers = true
                        map.readyFunction();
                    });
                } else {
                    map.ready.datalayers = true
                    map.readyFunction();
                }
            }).then(undefined, function(err) {
                // console will catch this
                throw err;
            });
        },

        // eslint-disable-next-line valid-jsdoc
        /**
         * Runs the given callback **when the Kartographer map has finished
         * loading the data layers and positioning** the map with a center and
         * zoom, **or immediately if it happened already**.
         *
         * @param {Function} callback
         * @param {Object} [context]
         * @chainable
         */
        doWhenReady: function(callback, context) {
            if (this._kartographer_ready) {
                callback.call(context || this, this);
            } else {
                this.on('kartographerisready', callback, context);
            }
            return this;
        },

        // eslint-disable-next-line valid-jsdoc
        /**
         * Sets the initial center and zoom of the map, and optionally calls
         * {@link #setView} to reposition the map.
         *
         * @param {number} [mapID]
         * @param {number} [plane]
         * @param {L.LatLng|number[]} [center]
         * @param {number} [zoom]
         * @param {boolean} [setView=true]
         * @chainable
         */
        initView: function(mapID, plane, center, zoom) {
            // Convert array to obj
            if (Array.isArray(center)) {
                if (!isNaN(center[0]) && !isNaN(center[1])) {
                    center = L.latLng(center);
                } else {
                    center = undefined;
                }
            }

            zoom = isNaN(zoom) ? undefined : zoom;
            this._initialPosition = {
                mapID: mapID,
                plane: plane,
                center: center,
                zoom: zoom,
            };
            this.setMapID(mapID, plane, zoom, [center.lat, center.lng]);
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
                $.each( dataGroups, function ( key, group ) {
                    var groupId = inlineDataLayerKey + inlineDataLayerId++,
                        layerOptions = {
                            attribution: group.attribution || options.attribution,
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
                    let iconUrl = "https://maps.runescape.wiki/osrs/images/pin_grey.svg"
                    let iconSize = [26, 42]
                    let iconAnchor = [13, 42]
                    let popupAnchor = [0, -42]
                    if (markerData.icons[feature.properties.icon]) {
                        iconUrl = markerData.folder + markerData.icons[feature.properties.icon].filename
                    }
                    if (feature.properties.iconSize) {
                        iconSize = feature.properties.iconSize
                    }
                    if (feature.properties.iconWikiLink) {
                        iconSize = feature.properties.iconSize
                        iconAnchor = feature.properties.iconAnchor
                        popupAnchor = feature.properties.popupAnchor
                        let filename = feature.properties.iconWikiLink
                        var hash = MD5.md5(filename)
                        iconUrl = map.config.wikiImageURL +
                            hash.substr(0, 1) + '/' + hash.substr(0, 2) + '/' +
                            filename;

                    }
                    let icon = L.icon({iconUrl: iconUrl, iconSize: iconSize, iconAnchor: iconAnchor, popupAnchor: popupAnchor})
                    return L.marker(latlng, {icon: icon})
                }
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
        openFullScreen: function(position) {
            this.doWhenReady(function() {

                var map = this.options.link ? this : this.fullScreenMap;
                position = position || this.getMapPosition();
                if (map && map._updatingHash) {
                    // Skip - there is nothing to do.
                    map._updatingHash = false;
                    return;

                } else if (map) {

                    this.doWhenReady(function() {
                        map.initView(
                            position.mapID,
                            position.plane,
                            position.center,
                            position.zoom                        );
                    });
                } else {
                    map = this.fullScreenMap = new KartographerMap({
                        container: L.DomUtil.create('div', 'mw-kartographer-mapDialog-map'),
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
                        zoomControl: false, // Replace default zoom controls with our own
                    });
                        map.initView(
                            position.mapID,
                            position.plane,
                            position.center,
                            position.zoom                       
                        );
                }

                mw.loader.using('ext.kartographer.dialog').then(function() {
                    map.doWhenReady(function() {
                        require('ext.kartographer.dialog').render(map);
                    });
                });
            }, this);
        },

        // eslint-disable-next-line
        /**
         * Closes full screen dialog.
         *
         * @chainable
         */
        closeFullScreen: function() {
            require('ext.kartographer.dialog').close();
            return this;
        },

        /**
         * Gets initial map center and zoom.
         *
         * @return {Object}
         * @return {L.LatLng} return.center
         * @return {number} return.zoom
         */
        getInitialMapPosition: function() {
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
        getMapPosition: function(options) {
            var mapID = this.getMapID(),
                plane = this.getPlane(),
                center = this.getCenter(),
                zoom = this.getZoom();

            options = options || {};

            if (options.scaled) {
                center = L.latLng(this.getScaleLatLng(center.lat, center.lng, zoom));
            }
            return {
                mapID: mapID,
                plane: plane,
                center: center,
                zoom: zoom
            };
        },

        /**
         * Formats the full screen route of the map, such as:
         *   `/map/:maptagId(/:zoom/:longitude/:latitude)`
         *  RS: `/map/:maptagId(/:zoom/:mapID/:plane/:x/:y)`
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

        // eslint-disable-next-line valid-jsdoc
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
        setView: function(center, zoom, options, save) {
            var maxBounds,
                initial = this.getInitialMapPosition();

            if (Array.isArray(center)) {
                if (!isNaN(center[0]) && !isNaN(center[1])) {
                    center = L.latLng(center);
                } else {
                    center = undefined;
                }
            }
            if (center) {
                zoom = isNaN(zoom) ? this.options.fallbackZoom : zoom;
                L.Map.prototype.setView.call(this, center, zoom, options);
            } else {
                // Determines best center of the map
                maxBounds = getValidBounds(this);

                if (maxBounds.isValid()) {
                    this.fitBounds(maxBounds);
                } else {
                    this.fitWorld();
                }
                // (Re-)Applies expected zoom

                if (initial && !isNaN(initial.zoom)) {
                    this.setZoom(initial.zoom);
                } else if (this.getZoom() > this.options.fallbackZoom) {
                    this.setZoom(this.options.fallbackZoom);
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
        getScaleLatLng: function(lat, lng, zoom) {
            zoom = typeof zoom === 'undefined' ? this.getZoom() : zoom;

            return [
                lat.toFixed(precisionPerZoom[zoom]),
                lng.toFixed(precisionPerZoom[zoom]),
            ];
        },

        /**
         * @localdoc Extended to also destroy the {@link #fullScreenMap} when
         *   it exists.
         *
         * @override
         * @chainable
         */
        remove: function() {
            var parent = this.parentMap || this.parentLink;

            if (this.fullScreenMap) {
                L.Map.prototype.remove.call(this.fullScreenMap);
                this.fullScreenMap = null;
            }
            if (parent) {
                parent.fullScreenMap = null;
                mw.track('mediawiki.kartographer', {
                    action: 'close',
                    isFullScreen: true,
                    feature: parent,
                });
                parent.clicked = false;
            }

            return L.Map.prototype.remove.call(this);
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
        _fixMapSize: function() {
            var width, height, $visibleParent;

            if (this.options.fullscreen) {
                this._size = new L.Point(
                    window.innerWidth,
                    window.innerHeight
                );
                this._sizeChanged = false;
                return;
            }

            $visibleParent = this.$container.closest(':visible');

            // Try `max` properties.
            width = $visibleParent.css('max-width');
            height = $visibleParent.css('max-height');
            width = (!width || width === 'none') ? $visibleParent.width() : width;
            height = (!height || height === 'none') ? $visibleParent.height() : height;

            while ((!height && $visibleParent.parent().length)) {
                $visibleParent = $visibleParent.parent();
                width = $visibleParent.outerWidth(true);
                height = $visibleParent.outerHeight(true);
            }

            this._size = new L.Point(width, height);
        },

        // eslint-disable-next-line valid-jsdoc
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
        _invalidateInterative: function() {

            // add Leaflet.Sleep when the map isn't full screen.
            this.addHandler('sleep', L.Map.Sleep);

            // `invalidateSize` is triggered on window `resize` events.
            this.invalidateSize = function(options) {
                L.Map.prototype.invalidateSize.call(this, options);

                if (this.options.fullscreen) {
                    // skip if the map is full screen
                    return this;
                }
                // Local debounce because OOjs is not yet available.
                if (this._staticTimer) {
                    clearTimeout(this._staticTimer);
                }
                this._staticTimer = setTimeout(this.toggleStaticState, 200);
                return this;
            };
            // Initialize static state.
            this.toggleStaticState = L.Util.bind(this.toggleStaticState, this);
            this.toggleStaticState();
            return this;
        },

        // eslint-disable-next-line valid-jsdoc
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
        toggleStaticState: function() {
            var deviceWidth = window.innerWidth,
                // All maps static if deviceWitdh < 480px
                isSmallWindow = deviceWidth <= 480,
                staticMap;

            // If the window is wide enough, make sure there is at least
            // a 200px margin to scroll, otherwise make the map static.
            staticMap = isSmallWindow || (this.getSize().x + 200) > deviceWidth;

            // Skip if the map is already static
            if (this._static === staticMap) {
                return;
            }

            // Toggle static/interactive state of the map
            this._static = staticMap;

            if (staticMap) {
                this.sleep._sleepMap();
                this.sleep.disable();
                this.scrollWheelZoom.disable();
            } else {
                this.sleep.enable();
            }
            this.$container.toggleClass('mw-kartographer-static', staticMap);
            return this;
        },
    });

    /*
     * Extend the map with RS changes
     * Most of this code below is adopted from: https://gitlab.com/weirdgloop/doogle-maps
     */
    KartographerMap = KartographerMap.extend({
        // Setup map
        rsMapInitialize: function(options, controls) {
            this._controlers = {};
            this.minimapIconLocations = {}
            this.minimapIcons = {}
            this.config = mw.config.get('wgKartographerDataConfig');

            this.fullscreen = options.fullscreen;

            this.setupControls(controls);
            this.imageCache = {}
            this.canvasLayer = new CanvasLayer()
            this.addLayer(this.canvasLayer)
            if (options.parentMap) {
                this.setBaseMaps(options.parentMap._baseMaps)
                this.ready.dataloader = true
                this.minimapIconLocations = options.parentMap.minimapIconLocations
                this.minimapIcons = options.parentMap.minimapIcons
                this.ready.minimap = true
                this.readyFunction();
                this._plane = options.parentMap._plane
                this._mapID = options.parentMap._mapID
            } else {
                this.ldl_load();
                this.fetchMinimapIcons()
                this._plane = 0;
                this._mapID = 0;
            }

            this.on('kartographerisready', async function() {
                this.canvasLayer.bringToFront()
                // labels.init();
                // pathfind.init();
            });
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
              var responseData = await fetch(map.config.dataloaderFile);
              var data = await responseData.json();
              map.setBaseMaps(data.baseMaps)
              map.ready.dataloader = true
              map.readyFunction()
              resolve();
            });
        },

        fetchMinimapIcons: async function(){
            let map = this;
            new Promise(async function(resolve, reject) {
            // TODO have this as a config
              var responseData = await fetch("https://maps.runescape.wiki/osrs/data/minimap.json");
              var data = await responseData.json();
              map.minimapIconLocations = data['locations']
              map.minimapIcons = data['icons']
              map.canvasLayer.redraw()
              map.ready.minimap = true
              map.readyFunction()
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
              this._controlers.mapSelect._resetSelect(baseMaps);
            }
        },

      setPlane: function(plane) {
        this._plane = plane
        this.selectedLayer.redraw()
        $.each( this.dataLayers, function ( groupId, layer ) {
            layer.clearLayers();
            layer._initialize(layer._geojson);
        } );
        this.canvasLayer.redraw()
      },

        setMapID: function(mapID, plane, zoom, location) {
            this._mapID = mapID

            if(!(mapID in this._baseMaps)){
              console.error('Selected MapID does not exist: ', mapID);
              return;
            }

            this.loadBaseMap(mapID);

            if (plane === undefined) {
              plane = 0
            }
            if (this.fullscreen) {
              this._controlers.mapSelect._changeSelectedOption(mapID)
              this._controlers.plane.setPlane(plane)
            } else {
                this.setPlane(plane)
            }
            if (zoom === undefined) {
              zoom = this._baseMaps[mapID].defaultZoom
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

            let data = this._baseMaps[mapId]
            let bounds = this._translateBounds(data.bounds)
            // TODO: should be MapTileLayer...
            this.selectedLayer = new controls.MapControler[0](
              this.config.baseTileURL + this.config.tileURLFormat, {
              bounds: bounds,
              minZoom: data.zoomLimits[0],
              maxZoom: data.zoomLimits[1],
              maxNativeZoom: data.maxNativeZoom,
              mapID: data.mapId,
              cacheVersion: data.cacheVersion,
              attribution: data.attribution || '',
            });
            this.addLayer(this.selectedLayer);
            this.setMaxBounds(bounds);
        },

        _translateBounds: function(bounds){
            var newbounds = [ [ 0, 0 ], [ 12000, 12000 ] ];
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
            var controler;
            // this._map.fullscreenControl.setPosition('topright');
            // top left
            if (!this.fullscreen) {
                this._controlers.zoom = new controls.CustomZoom({
                    position: 'topleft',
                    displayZoomLevel: false
                });
            }

            // top right
            if (this.fullscreen) {
                this._controlers.zoom = new controls.CustomZoom({
                    position: 'topright',
                    displayZoomLevel: true
                });
                this._controlers.help = new controls.Help();
                // this._controlers.icons = new controls.Icons();
                // this._controlers.options = new controls.Options();
            }

            // bottom left
            if (this.fullscreen) {
                this._controlers.mapSelect = new controls.MapSelect({
                    visible: true
                });
            }
            this._controlers.attribution = L.control.attribution({
                prefix: this.config.attribution
            });

            //bottom right
            if (this.fullscreen) {
                this._controlers.plane = new controls.Plane({
                    visible: true
                });

            }

            // add controlers to map
            for (controler in this._controlers) {
                this._controlers[controler].addTo(this);
            }

            // add class to bottom-right to make vertical
            this._container.querySelector('.leaflet-control-container > .leaflet-bottom.leaflet-right').className += ' vertical';
        }
    });

    return KartographerMap;
}(
    mediaWiki,
    module.OpenFullScreenControl,
    module.dataLayerOpts,
    module.ScaleControl,
    module.Data,
    require('ext.kartographer.controls'),
));

module.map = (function(KartographerMap) {
    return function(options) {
        return new KartographerMap(options);
    };
}(module.Map));