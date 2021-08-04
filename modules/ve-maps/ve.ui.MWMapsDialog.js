/*!
 * VisualEditor UserInterface MWMapsDialog class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see AUTHORS.txt
 * @license The MIT License (MIT); see LICENSE.txt
 */
/**
 * Dialog for editing MW maps.
 *
 * @class
 * @extends ve.ui.MWExtensionDialog
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.MWMapsDialog = function VeUiMWMapsDialog() {
	// Parent constructor
	ve.ui.MWMapsDialog.super.apply( this, arguments );

	this.updateGeoJson = $.debounce( 300, $.proxy( this.updateGeoJson, this ) );
	this.resetMapPosition = $.debounce( 300, $.proxy( this.resetMapPosition, this ) );
};

/* Inheritance */

OO.inheritClass( ve.ui.MWMapsDialog, ve.ui.MWExtensionDialog );

/* Static Properties */

ve.ui.MWMapsDialog.static.name = 'mwMaps';

ve.ui.MWMapsDialog.static.title = OO.ui.deferMsg( 'visualeditor-mwmapsdialog-title' );

ve.ui.MWMapsDialog.static.size = 'larger';

ve.ui.MWMapsDialog.static.allowedEmpty = true;

ve.ui.MWMapsDialog.static.selfCloseEmptyBody = true;

ve.ui.MWMapsDialog.static.modelClasses = [ ve.dm.MWMapsNode, ve.dm.MWInlineMapsNode ];

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.MWMapsDialog.prototype.initialize = function () {
	var panel,
		positionPopupButton,
		$currentPositionTable;

	// Parent method
	ve.ui.MWMapsDialog.super.prototype.initialize.call( this );

	var self = this;

	this.$mapContainer = $( '<div>' ).addClass( 've-ui-mwMapsDialog-mapWidget' );
	this.$map = $( '<div>' ).appendTo( this.$mapContainer );
	this.map = null;
	this.scalable = null;
	this.updatingGeoJson = false;
	this.mapData = null;

	this.dimensions = new ve.ui.DimensionsWidget();

	this.align = new ve.ui.AlignWidget( {
		dir: this.getDir()
	} );

	this.mapSelect = new OO.ui.ComboBoxInputWidget( {
		options: [],
		classes: [ 've-ui-mwMapsDialog-mapSelWidget' ],
		menu: {
			filterFromInput: true,
			filterMode: 'substring'
		}
	} );
	this.mapName = new OO.ui.LabelWidget( {
		label: ve.msg( 'visualeditor-mwmapsdialog-reset-map' ),
		classes: [ 'visualeditor-mwmapsdialog-loadingname' ]
	} );

	this.planeSelect = new OO.ui.NumberInputWidget( {
		min: 0,
		max: 5,
		step: 1,
		classes: [ 've-ui-mwMapsDialog-planeWidget' ]
	} );

	this.input = new ve.ui.MWAceEditorWidget( {
		autosize: true,
		maxRows: 10,
		classes: [ 've-ui-mwMapsDialog-geoJSONWidget' ]
	} )
		.setLanguage( 'json' )
		.toggleLineNumbers( false )
		.setDir( 'ltr' );

	this.resetMapButton = new OO.ui.ButtonWidget( {
		label: ve.msg( 'visualeditor-mwmapsdialog-reset-map' )
	} );

	panel = new OO.ui.PanelLayout( {
		padded: true,
		expanded: false
	} );

	this.dimensionsField = new OO.ui.FieldLayout( this.dimensions, {
		align: 'right',
		label: ve.msg( 'visualeditor-mwmapsdialog-size' )
	} );

	this.alignField = new OO.ui.FieldLayout( this.align, {
		align: 'right',
		label: ve.msg( 'visualeditor-mwmapsdialog-align' )
	} );

	this.mapSelectHoriz = new OO.ui.HorizontalLayout( {
		items: [ 
			new OO.ui.LabelWidget( { label: ve.msg( 'visualeditor-mwmapsdialog-mapselect' ), classes: [ 've-ui-mwMapsDialog-mapFieldLabel' ] } ),
			this.mapSelect,
			this.mapName
		],
		classes: [ 've-ui-mwMapsDialog-mapFieldWidget' ]
	} );

	this.planeSelectField = new OO.ui.FieldLayout( this.planeSelect, {
		align: 'right',
		label: ve.msg( 'visualeditor-mwmapsdialog-planeselect' )
	} );

	this.$currentPositionLatField = $( '<td></td>' );
	this.$currentPositionLonField = $( '<td></td>' );
	this.$currentPositionZoomField = $( '<td></td>' );
	this.$currentPositionPlaneField = $( '<td></td>' );
	this.$currentPositionMapIdField = $( '<td></td>' );
	$currentPositionTable = $( '<table>' ).addClass( 've-ui-mwMapsDialog-position-table' )
		.append( $( '<tr>' ).append( '<th>' + ve.msg( 'visualeditor-mwmapsdialog-position-lon' ) + '</th>' ).append( this.$currentPositionLonField ) )
		.append( $( '<tr>' ).append( '<th>' + ve.msg( 'visualeditor-mwmapsdialog-position-lat' ) + '</th>' ).append( this.$currentPositionLatField ) )
		.append( $( '<tr>' ).append( '<th>' + ve.msg( 'visualeditor-mwmapsdialog-position-zoom' ) + '</th>' ).append( this.$currentPositionZoomField ) )
		.append( $( '<tr>' ).append( '<th>' + ve.msg( 'visualeditor-mwmapsdialog-position-plane' ) + '</th>' ).append( this.$currentPositionPlaneField ) )
		.append( $( '<tr>' ).append( '<th>' + ve.msg( 'visualeditor-mwmapsdialog-position-mapid' ) + '</th>' ).append( this.$currentPositionMapIdField ) );

	positionPopupButton = new OO.ui.PopupButtonWidget( {
		$overlay: this.$overlay,
		label: ve.msg( 'visualeditor-mwmapsdialog-position-button' ),
		icon: 'info',
		framed: false,
		popup: {
			$content: $currentPositionTable,
			padded: true,
			align: 'forwards'
		}
	} );

	this.$mapPositionContainer = $( '<div>' ).addClass( 've-ui-mwMapsDialog-position' );

	this.geoJsonField = new OO.ui.FieldLayout( this.input, {
		align: 'top',
		label: ve.msg( 'visualeditor-mwmapsdialog-geojson' )
	} );

	panel.$element.append(
		this.dimensionsField.$element,
		this.alignField.$element,
		this.mapSelectHoriz.$element,
		this.planeSelectField.$element,
		this.$mapContainer,
		this.$mapPositionContainer.append( positionPopupButton.$element, this.resetMapButton.$element ),
		this.geoJsonField.$element
	);
	this.$body.append( panel.$element );

	// Get base maps data
	this.mapsConfig = mw.config.get( 'wgKartographerDataConfig' );
	var mapVers = this.mapsConfig.mapVersion;
	var mesVers = mw.message('kartographer-map-version');
    if (mesVers.exists()) {
        mapVers = mesVers.text();
    }
    var baseUrl = this.mapsConfig.baseMapsFile;
    baseUrl = baseUrl.replace( '{mapVersion}', mapVers );
    $.getJSON( baseUrl, function (data) {
    	var mapData = {};
    	var mapList = [];
    	data.forEach( function (map) {
    		if ( !isNaN(map.mapId) ) {
    			mapList.push({ data:map.mapId, label:map.name })
    			mapData[ map.mapId ] = map;
    		}
    	} );
    	self.mapData = mapData;
    	self.mapSelect.setOptions( mapList );


    	var mwAttrs = self.selectedNode && self.selectedNode.getAttribute( 'mw' ).attrs || {};
    	if ( mwAttrs && !isNaN(mwAttrs.mapID) ) {
    		self.mapName.setLabel( self.mapData[ mwAttrs.mapID ].name );
    	}
    } );
};

/**
 * Handle change events on the dimensions widget
 *
 * @param {string} newValue
 */
ve.ui.MWMapsDialog.prototype.onDimensionsChange = function () {
	var dimensions, center;

	if ( !this.map ) {
		return;
	}

	dimensions = this.scalable.getBoundedDimensions(
		this.dimensions.getDimensions()
	);
	center = this.map && this.map.getCenter();

	// Set container width for centering
	this.$mapContainer.css( { width: dimensions.width } );
	this.$map.css( dimensions );
	this.updateSize();

	if ( center ) {
		this.map.setView( center, this.map.getZoom() );
	}
	this.map.invalidateSize();
	this.updateActions();
};

/**
 * Reset the map's position
 */
ve.ui.MWMapsDialog.prototype.resetMapPosition = function () {
	var position,
		dialog = this;

	if ( !this.map ) {
		return;
	}

	position = this.getInitialMapPosition();

	this.resetMapButton.setDisabled( true );
	this.map.once( 'moveend', function () {
		dialog.resetMapButton.setDisabled( false );
	} );

	this.map.setView( position.center, position.zoom );

	this.updateActions();
};

/**
 * Update action states
 */
ve.ui.MWMapsDialog.prototype.updateActions = function () {
	var newMwData, modified,
		mwData = this.selectedNode && this.selectedNode.getAttribute( 'mw' );

	if ( mwData ) {
		newMwData = ve.copy( mwData );
		this.updateMwData( newMwData );
		modified = !ve.compare( mwData, newMwData );
	} else {
		modified = true;
	}
	this.actions.setAbilities( { done: modified } );
};

/**
 * Change the mapID
 */
ve.ui.MWMapsDialog.prototype.updateMapID = function ( mapID ) {
	if ( !this.map ) {
		return;
	}
	if ( isNaN(mapID) || mapID === '' ) {
		return;
	}
	var dialog = this,
		zoom = this.map.getZoom(),
		plane = this.map.getPlane(),
		mapName = this.mapData[mapID].name ;

	this.mapSelect.setValue( mapID );
	this.mapName.setLabel( mapName );

	this.mapSelect.setDisabled( true );
	this.map.once( 'layeradd', function () {
		dialog.mapSelect.setDisabled( false );
		dialog.planeSelect.setDisabled( false );
	} );

	// setMapID(mapID, plane, zoom, location)
	this.map.setMapID(mapID, plane, zoom, undefined);

	this.updateActions();
}

/**
 * Change the map plane
 */
ve.ui.MWMapsDialog.prototype.updateMapPlane = function ( plane ) {
	if ( !this.map ) {
		return;
	}
	if ( isNaN(plane) ) {
		return;
	}
	var dialog = this;

	this.planeSelect.setDisabled( true );
	this.map.selectedLayer.once( 'tileload tileerror', function () {
		dialog.planeSelect.setDisabled( false );
	} );

	this.map.setPlane(plane);

	this.updateActions();
}

/**
 * @inheritdoc ve.ui.MWExtensionWindow
 */
ve.ui.MWMapsDialog.prototype.insertOrUpdateNode = function () {
	// Parent method
	ve.ui.MWMapsDialog.super.prototype.insertOrUpdateNode.apply( this, arguments );

	// Update scalable
	this.scalable.setCurrentDimensions(
		this.scalable.getBoundedDimensions(
			this.dimensions.getDimensions()
		)
	);
};

/**
 * @inheritdoc ve.ui.MWExtensionWindow
 */
ve.ui.MWMapsDialog.prototype.updateMwData = function ( mwData ) {
	var center, scaled, latitude, longitude, zoom, mapID, plane
		dimensions = this.scalable.getBoundedDimensions(
			this.dimensions.getDimensions()
		);

	// Parent method
	ve.ui.MWMapsDialog.super.prototype.updateMwData.call( this, mwData );

	if ( this.map ) {
		mapID = this.map.getMapID();
		plane = this.map.getPlane();
		center = this.map.getCenter();
		zoom = this.map.getZoom();
		scaled = this.map.getScaleLatLng( center.lat, center.lng, zoom );
		latitude = scaled[ 0 ];
		longitude = scaled[ 1 ];
	} else {
		// Map not loaded in insert, can't insert
		return;
	}
	mwData.attrs.latitude = latitude.toString();
	mwData.attrs.longitude = longitude.toString();
	mwData.attrs.zoom = zoom.toString();
	mwData.attrs.mapID = mapID.toString();
	mwData.attrs.plane = plane.toString();
	if ( !( this.selectedNode instanceof ve.dm.MWInlineMapsNode ) ) {
		mwData.attrs.width = dimensions.width.toString();
		mwData.attrs.height = dimensions.height.toString();
		mwData.attrs.align = this.align.findSelectedItem().getData();
	}
};

/**
 * @inheritdoc
 */
ve.ui.MWMapsDialog.prototype.getReadyProcess = function ( data ) {
	return ve.ui.MWMapsDialog.super.prototype.getReadyProcess.call( this, data )
		.next( function () {
			this.setupMap();
		}, this );
};

/**
 * @inheritdoc
 */
ve.ui.MWMapsDialog.prototype.getSetupProcess = function ( data ) {
	data = data || {};
	return ve.ui.MWMapsDialog.super.prototype.getSetupProcess.call( this, data )
		.next( function () {
			var inline = this.selectedNode instanceof ve.dm.MWInlineMapsNode,
				mwAttrs = this.selectedNode && this.selectedNode.getAttribute( 'mw' ).attrs || {};

			this.input.clearUndoStack();

			this.actions.setMode( this.selectedNode ? 'edit' : 'insert' );

			if ( this.selectedNode && !inline ) {
				this.scalable = this.selectedNode.getScalable();
			} else {
				this.scalable = ve.dm.MWMapsNode.static.createScalable(
					inline ? { width: 850, height: 400 } : { width: 300, height: 300 }
				);
			}

			// Events
			this.input.connect( this, {
				change: 'updateGeoJson',
				resize: 'updateSize'
			} );
			this.dimensions.connect( this, {
				widthChange: 'onDimensionsChange',
				heightChange: 'onDimensionsChange'
			} );
			this.align.connect( this, { choose: 'updateActions' } );
			this.mapSelect.connect( this, { change: 'updateMapID' } );
			this.planeSelect.connect( this, { change: 'updateMapPlane' } );
			this.resetMapButton.connect( this, { click: 'resetMapPosition' } );

			this.dimensionsField.toggle( !inline );

			this.alignField.toggle( !inline );

			// TODO: Support block/inline conversion
			this.align.selectItemByData( mwAttrs.align || 'right' );

			if ( !isNaN(mwAttrs.mapID) ) {
				this.mapSelect.setValue( mwAttrs.mapID );
				if ( this.mapData ) {
					this.mapName.setLabel( this.mapData[ mwAttrs.mapID ].name );
				} else {
					this.mapName.setLabel( ve.msg('visualeditor-mwmapsdialog-loadingname') );
				}
			} else {
				this.mapSelect.setValue( 28 );
				if ( this.mapData ) {
					this.mapName.setLabel( this.mapData[28].name );
				} else {
					this.mapName.setLabel( ve.msg('visualeditor-mwmapsdialog-loadingname') );
				}
			}

			this.planeSelect.setValue( mwAttrs.plane || 0);

			this.resetMapButton.$element.toggle( !!this.selectedNode );

			this.dimensions.setDimensions( this.scalable.getCurrentDimensions() );

			this.updateActions();
		}, this );
};

/**
 * Setup the map control
 */
ve.ui.MWMapsDialog.prototype.setupMap = function () {
	var dialog = this;

	if ( this.map ) {
		return;
	}

	mw.loader.using( 'ext.kartographer.editor' ).then( function () {
		var geoJsonLayer,
			editing = require( 'ext.kartographer.editing' ),
			defaultShapeOptions = { shapeOptions: L.mapbox.simplestyle.style( {} ) },
			mapPosition = dialog.getInitialMapPosition(),
			mwData = dialog.selectedNode && dialog.selectedNode.getAttribute( 'mw' ),
			mwAttrs = mwData && mwData.attrs;

		if ( !mwAttrs ) { mwAttrs = {}; }

		// TODO: Support 'style' editing
		dialog.map = require( 'ext.kartographer.box' ).map( {
			container: dialog.$map[ 0 ],
			center: mapPosition.center,
			zoom: mapPosition.zoom,
			mapID: mapPosition.mapID,
			plane: mapPosition.plane,
			lang: mwAttrs.lang || mw.config.get( 'wgPageContentLanguage' ),
			alwaysInteractive: true
		} );

		dialog.map.doWhenReady( function () {

			dialog.updateGeoJson();
			dialog.onDimensionsChange();
			// Wait for dialog to resize as this triggers map move events
			setTimeout( function () {
				dialog.resetMapPosition();
			}, OO.ui.theme.getDialogTransitionDuration() );

			dialog.planeSelect.setDisabled( false );
			dialog.mapSelect.setDisabled( false );

			// if geojson and no center, we need the map to automatically
			// position itself when the feature layer is added.
			if (
				dialog.input.getValue() &&
				( !mapPosition.center || isNaN( mapPosition.center[ 0 ] ) || isNaN( mapPosition.center[ 1 ] ) )
			) {
				dialog.map.on( 'layeradd', function () {
					dialog.map.setView( null, mapPosition.zoom );
					dialog.updateActions();
				} );
			}

			geoJsonLayer = editing.getKartographerLayer( dialog.map );
			new L.Control.Draw( {
				position: 'topright',
				edit: { featureGroup: geoJsonLayer },
				draw: {
					circle: defaultShapeOptions,
					circlemarker: defaultShapeOptions,
					// TODO: Determine metric preference from locale information
					polyline: defaultShapeOptions,
					polygon: defaultShapeOptions,
					rectangle: defaultShapeOptions,
					marker: { icon: L.icon( {
						icon: "pin_blue.svg",
						iconUrl: (dialog.mapsConfig.iconURL + "pin_blue.svg"),
						iconSize: [26, 42],
						iconAnchor: [13, 42],
						popupAnchor: [0, -42]
					} ) }
				}
			} ).addTo( dialog.map );

			function update() {
				var geoJson;
				// Prevent circular update of map
				dialog.updatingGeoJson = true;
				try {
					geoJson = geoJsonLayer.toGeoJSON();
					// Undo the sanitization step's parsing of wikitext
					editing.restoreUnparsedText( geoJson );
					dialog.input.setValue( JSON.stringify( geoJson, null, '  ' ) );
				} finally {
					dialog.updatingGeoJson = false;
				}
				dialog.updateActions();
			}

			function created( e ) {
				e.layer.addTo( geoJsonLayer );
				update();
			}

			function updatePositionContainer() {
				var position = dialog.map.getMapPosition(),
					scaled = dialog.map.getScaleLatLng( position.center.lat, position.center.lng, position.zoom );
				dialog.$currentPositionLatField.text( scaled[ 0 ] );
				dialog.$currentPositionLonField.text( scaled[ 1 ] );
				dialog.$currentPositionZoomField.text( position.zoom );
				dialog.$currentPositionMapIdField.text( position.mapID );
				dialog.$currentPositionPlaneField.text( position.plane );
			}

			function onMapMove() {
				dialog.updateActions();
				updatePositionContainer();
			}

			dialog.map
				.on( 'draw:edited', update )
				.on( 'draw:deleted', update )
				.on( 'draw:created', created )
				.on( 'moveend', onMapMove );

		} );
	} );
};

/**
 * Get the initial map position (coordinates and zoom level)
 *
 * @return {Object} Object containing latitude, longitude and zoom
 */
ve.ui.MWMapsDialog.prototype.getInitialMapPosition = function () {
	var latitude, longitude, zoom, mapID, plane
		pageCoords = mw.config.get( 'wgCoordinates' ),
		mwData = this.selectedNode && this.selectedNode.getAttribute( 'mw' ),
		mwAttrs = mwData && mwData.attrs;

	if ( mwAttrs && mwAttrs.zoom ) {
		latitude = +mwAttrs.latitude;
		longitude = +mwAttrs.longitude;
		zoom = +mwAttrs.zoom;
		mapID = +mwAttrs.mapID;
		plane = +mwAttrs.plane;
	} else if ( pageCoords ) {
		// Use page coordinates if Extension:GeoData is available
		latitude = pageCoords.lat;
		longitude = pageCoords.lon;
		mapID = pageCoords.mapID;
		plane = pageCoords.plane;
		zoom = 2;
	} else if ( !mwAttrs || !mwAttrs.extsrc ) {
		latitude = 3200;
		longitude = 3200;
		mapID = 28;
		plane = 0;
		zoom = 2;
	}

	return {
		center: [ latitude, longitude ],
		zoom: zoom,
		mapID: mapID,
		plane: plane
	};
};

/**
 * Update the GeoJSON layer from the current input state
 */
ve.ui.MWMapsDialog.prototype.updateGeoJson = function () {
	var self = this;

	if ( !this.map || this.updatingGeoJson ) {
		return;
	}

	require( 'ext.kartographer.editing' )
		.updateKartographerLayer( this.map, this.input.getValue() )
		.done( function () {
			self.input.setValidityFlag( true );
		} )
		.fail( function () {
			self.input.setValidityFlag( false );
		} )
		.always( function () {
			self.updateActions();
		} );
};

/**
 * @inheritdoc
 */
ve.ui.MWMapsDialog.prototype.getTeardownProcess = function ( data ) {
	return ve.ui.MWMapsDialog.super.prototype.getTeardownProcess.call( this, data )
		.first( function () {
			// Events
			this.input.disconnect( this );
			this.dimensions.disconnect( this );
			this.resetMapButton.disconnect( this );
			this.planeSelect.disconnect( this );

			this.dimensions.clear();
			if ( this.map ) {
				this.map.remove();
				this.map = null;
			}
		}, this );
};

/* Registration */

ve.ui.windowFactory.register( ve.ui.MWMapsDialog );
