/**
 * Special:DrawMaps User interface class
 *
 * @alternateClassName DrawMap
 * @alternateClassName ext.kartographer.drawmap
 * @class Kartographer.DrawMap
 */

MapDialog = {
	defTempInfo: {
		combinefeatures: false,
		singlefeature: false,
		template: 'Map params:\n${params}\nMap type: ${mtype}\nFeatures:\n${features}',
		params: '${name} = ${value}',
		paramsSeperator: '\n',
		feature: '\nFeature #${n}\nType/shape: ${type}\nProperties:\n${properties}\nCoords:\n${coords}',
		featSeparator: '\n\n---\n',
		coords: '${x},${y}',
		coordsSeparator: '\n',
		coordsSeparator2: '\n-\n',
		featProps: '${name} = ${value}',
		featPropsSeperator: '\n'
	},

	init: function () {
		var self = this;
		this.mapsConfig = mw.config.get( 'wgKartographerDataConfig' );

		// Overall container (contains static map loaded by page)
		this.$container = $('#mw-specialDrawMap-container');

		// Help button
		this.helpLink = new OO.ui.ButtonWidget( {
			icon: 'help',
			classes: [ 'drawmap-dialog-help' ],
			title: mw.message( 'kartographer-drawmap-help-title' ).plain(),
			href: mw.message( 'kartographer-drawmap-help-url' ).plain(),
			target: '_blank'
		} );

		// Map container
		this.$map = $('<div>').addClass('drawmap-mapWidget');

		this.initpos = { mapID:-1, plane:0, zoom:2, lat:3200, lon:3200 };
		if ( this.$container.attr( 'data-mapid' ) && !isNaN(this.$container.attr( 'data-mapid' )) ) {
			this.initpos.mapID = parseInt(this.$container.attr( 'data-mapid' ), 10);
		}
		if ( this.$container.attr( 'data-plane' ) && !isNaN(this.$container.attr( 'data-plane' )) ) {
			this.initpos.plane = parseInt(this.$container.attr( 'data-plane' ), 10);
		}
		if ( this.$container.attr( 'data-zoom' ) && !isNaN(this.$container.attr( 'data-zoom' )) ) {
			this.initpos.zoom = parseInt(this.$container.attr( 'data-zoom' ), 10);
		}
		if ( this.$container.attr( 'data-lon' ) && !isNaN(this.$container.attr( 'data-lon' )) ) {
			this.initpos.lon = parseInt(this.$container.attr( 'data-lon' ), 10);
		}
		if ( this.$container.attr( 'data-lat' ) && !isNaN(this.$container.attr( 'data-lat' )) ) {
			this.initpos.lat = parseInt(this.$container.attr( 'data-lat' ), 10);
		}
		var geoJsonLayer,
			deferred = $.Deferred(),
			editing = require( 'ext.kartographer.editing' ),
			util = require( 'ext.kartographer.util' ),
			defaultShapeOptions = { shapeOptions: L.mapbox.simplestyle.style( {} ) };

		// Map
		this.map = require( 'ext.kartographer.box' ).map( {
			//container: this.$map,
			container: self.$map[ 0 ],
			center:[self.initpos.lat, self.initpos.lon],
			zoom: self.initpos.zoom,
			mapID: self.initpos.mapID,
			plane: self.initpos.plane,
			allowFullScreen: true,
			alwaysInteractive: true
		} );
		this.map.doWhenReady( function () {
			// max bounds [[0, 12800], [0, 12800]]
			geoJsonLayer = editing.getKartographerLayer( self.map );
			self.contentsDraw = new L.Control.Draw( {
				position: 'bottomleft',
				edit: { featureGroup: geoJsonLayer },
				draw: {
					circle: defaultShapeOptions,
					circlemarker: defaultShapeOptions,
					polyline: defaultShapeOptions,
					polygon: defaultShapeOptions,
					rectangle: defaultShapeOptions,
					marker: { icon: L.icon( {
						icon: "pin_blue.svg",
						iconUrl: (self.mapsConfig.iconURL + "pin_blue.svg"),
						iconSize: [26, 42],
						iconAnchor: [13, 42],
						popupAnchor: [0, -42]
					} ) }
				}
			} );
			self.contentsDraw.addTo( self.map );

			function update() {
				var geoJson;
				// Prevent circular update of map
				self.updatingGeoJson = true;
				try {
					geoJson = geoJsonLayer.toGeoJSON();
					// Undo the sanitization step's parsing of wikitext
					editing.restoreUnparsedText( geoJson );
					self.geoinput.setValue( JSON.stringify( geoJson, null, '  ' ) );
					self.templateCode( geoJson );
				} finally {
					self.updatingGeoJson = false;
				}
			}
			function created( e ) {
				e.layer.addTo( geoJsonLayer );
				update();
			}
			self.map
				.on( 'draw:edited', update )
				.on( 'draw:deleted', update )
				.on( 'draw:created', created );
			deferred.resolve();
		});

		// Panels
		this.indexLayout = new OO.ui.IndexLayout( {
			expanded: false,
			classes: [ 'drawmap-indexLayout' ]
		} );
		this.settingsPanel = new OO.ui.TabPanelLayout( 'settings', {
			expanded: false,
			label: mw.msg( 'kartographer-drawmapdialog-settings' )
		} );
		this.geojsonPanel = new OO.ui.TabPanelLayout( 'geojson', {
			expanded: false,
			label: mw.msg( 'kartographer-drawmapdialog-geojson' )
		} );
		this.templatePanel = new OO.ui.TabPanelLayout( 'template', {
			expanded: false,
			label: mw.msg( 'kartographer-drawmapdialog-template' )
		} );

		// Settings panel
		// Map name/id fields
		this.mapID = new OO.ui.NumberInputWidget( { min: -1, max: 99999, step: 1, showButtons: false, classes: [ 'drawmap-dialog-mapID' ] } );
		this.mapName = new OO.ui.ComboBoxInputWidget( { options: [], classes: [ 'drawmap-dialog-mapName' ], menu: { filterFromInput: true, filterMode: 'substring' } } );
		this.mapField = new OO.ui.HorizontalLayout({ items:[
			new OO.ui.LabelWidget( { label: mw.msg( 'visualeditor-mwmapsdialog-mapselect' ) } ),
			this.mapName,
			this.mapID
		], classes: [ 'drawmap-dialog-mapFieldLayout' ] });
		// Get base maps data and use
		//this.mapsConfig = mw.config.get( 'wgKartographerDataConfig' );
		var mapVers = this.mapsConfig.mapVersion;
		var mesVers = mw.message('kartographer-map-version');
		if (mesVers.exists()) {
			mapVers = mesVers.text();
		}
		var baseUrl = this.mapsConfig.baseMapsFile;
		baseUrl = baseUrl.replace( '{mapVersion}', mapVers );
		$.getJSON( baseUrl, function (data) {
			var mapData = {},
				mapNameIDs = {},
				mapList = [];
			data.forEach( function (map) {
				if ( !isNaN(map.mapId) ) {
					mapList.push({ data:map.name, label:map.name });
					mapData[ map.mapId ] = map;
					mapNameIDs[ map.name ] = map.mapId;
				}
			} );
			self.mapData = mapData;
			self.mapNameIDs = mapNameIDs;
			self.mapName.setOptions( mapList );
			self.mapID.setValue( self.initpos.mapID );
			self.mapName.setValue( self.mapData[self.initpos.mapID].name );
		} ).fail( function (er) {
			console.warn(er);
		} );

		this.plane = new OO.ui.NumberInputWidget( { min: 0, max: 5, step: 1, value: this.initpos.plane } );
		this.planeField = new OO.ui.FieldLayout( this.plane, {
			align: 'left',
			label: mw.msg( 'visualeditor-mwmapsdialog-position-plane' )
		} );

		this.latitude = new OO.ui.NumberInputWidget( { min: 0, max: 12800, step: 0.5, buttonStep: 1, value: this.initpos.lat } );
		this.latitudeField = new OO.ui.FieldLayout( this.latitude, {
			align: 'left',
			label: mw.msg( 'visualeditor-mwmapsdialog-position-lat' )
		} );

		this.longitude = new OO.ui.NumberInputWidget( { min: 0, max: 12800, step: 0.5, buttonStep: 1, value: this.initpos.lon } );
		this.longitudeField = new OO.ui.FieldLayout( this.longitude, {
			align: 'left',
			label: mw.msg( 'visualeditor-mwmapsdialog-position-lon' )
		} );

		this.height = new OO.ui.NumberInputWidget( { min: 300, max: 1000, step: 1, buttonStep: 10, value: 300 } );
		this.heightField = new OO.ui.FieldLayout( this.height, {
			align: 'left',
			label: mw.msg( 'kartographer-drawmapdialog-height' )
		} );

		this.settingsPanel.$element.append(
			this.mapField.$element,
			this.planeField.$element,
			this.latitudeField.$element,
			this.longitudeField.$element,
			this.heightField.$element
		);

		// GeoJSON panel
		this.updatingGeoJson = false;

		this.geoinput = new OO.ui.MWAceEditorWidget( {
			autosize: true,
			maxRows: 20,
			rows: 10,
			classes: [ 'drawmap-dialog-geoJSONWidget' ],
		} )
			.setLanguage( 'json' )
			.toggleLineNumbers( false )
			.setDir( 'ltr' );
		this.geoJsonField = new OO.ui.FieldLayout( this.geoinput, {
			align: 'top',
			label: mw.msg( 'visualeditor-mwmapsdialog-geojson' )
		} );

		this.geojsonPanel.$element.append(
			this.geoJsonField.$element
		);

		// Template panel
		this.template = new OO.ui.DropdownInputWidget( { options: [] } );
		this.templateField = new OO.ui.FieldLayout( this.template, {
			align: 'top',
			label: mw.msg( 'kartographer-drawmapdialog-templatefield' )
		} );
		// Get base maps data and use
		this.tempInfo = { 'Plain coordinates': this.defTempInfo };
		var tempList = [ {data:'Plain coordinates', label:'Plain coordinates'} ],
			mesTemps = mw.message('kartographer-map-templates.json');
		if (mesTemps.exists()) {
			mesTemps = mesTemps.plain();
			try {
				mesTemps = JSON.parse( mesTemps );
			} catch (er) {
				console.warn('Error parsing "kartographer-map-templates.json":', er);
				mesTemps = {};
			}
			if ( mesTemps && typeof mesTemps == 'object' && mesTemps !== null ) {
				for (var t in mesTemps) {
					if ( mesTemps[t] && mesTemps[t].template ) {
						this.tempInfo[t] = mesTemps[t];
						tempList.push({ label:t, data:t });
					}
				}
			}
		} else {
			console.warn('Kartographer-map-templates.json does not exist, no templates loaded.');
		}
		this.template.setOptions( tempList );

		this.features = new OO.ui.ToggleSwitchWidget({ disabled: true });
		this.featuresField = new OO.ui.FieldLayout( this.features, {
			align: 'top',
			label: mw.msg( 'kartographer-drawmapdialog-features' ),
			help: mw.msg( 'kartographer-drawmapdialog-features-help' )
		} );

		this.wikiout = new OO.ui.MWAceEditorWidget( {
			autosize: true,
			maxRows: 20,
			rows: 10,
			classes: [ 'drawmap-dialog-wikiWidget' ],
		} )
			.setLanguage( 'mediawiki' )
			.toggleLineNumbers( false )
			.setDir( 'ltr' );
		this.wikitextField = new OO.ui.FieldLayout( this.wikiout, {
			align: 'top',
			label: mw.msg( 'kartographer-drawmapdialog-wikitext' ),
			help: mw.msg( 'kartographer-drawmapdialog-wikitext-help' )
		} );

		this.refreshWiki = new OO.ui.ButtonWidget({
			icon: 'reload',
			label: mw.message( 'kartographer-drawmap-refresh-label' ).plain(),
			title: mw.message( 'kartographer-drawmap-refresh-title' ).plain()
		});
		this.selectWiki = new OO.ui.ButtonWidget({
			icon: 'checkAll',
			label: mw.message( 'kartographer-drawmap-select-label' ).plain(),
			title: mw.message( 'kartographer-drawmap-select-title' ).plain()
		});
		this.copyWiki = new OO.ui.ButtonWidget({
			icon: 'newWindow',
			label: mw.message( 'kartographer-drawmap-copy-label' ).plain(),
			title: mw.message( 'kartographer-drawmap-copy-title' ).plain()
		});
		this.wikiButtons = new OO.ui.HorizontalLayout({
			items: [ this.refreshWiki, this.selectWiki, this.copyWiki ],
			classes: [ 'drawmap-dialog-wikibuttons' ]
		});

		this.templatePanel.$element.append(
			this.templateField.$element,
			this.featuresField.$element,
			this.wikitextField.$element,
			this.wikiButtons.$element
		);

		this.updateMapContentsDebounced = OO.ui.debounce( self.updateMapContents.bind( self ), 300 );
		this.onHeightChangeDebounced = OO.ui.debounce( self.onHeightChange.bind( self ), 300 );

		// Events
		this.mapID.connect( this, { change: 'onMapIDChange' } );
		this.mapName.connect( this, { change: 'onMapNameChange' } );
		this.plane.connect( this, { change: 'onPlaneChange' } );
		this.latitude.connect( this, { change: 'onCoordsChange' } );
		this.longitude.connect( this, { change: 'onCoordsChange' } );
		this.height.connect( this, { change: 'onHeightChangeDebounced' } );
		this.geoinput.connect( this, { change: 'updateMapContentsDebounced' } );
		this.template.connect( this, { change: 'onTemplateChange' } );
		this.features.connect( this, { change: 'onFeaturesChange' } );
		this.refreshWiki.connect( this, { click: 'getTemplateCode' } );
		this.selectWiki.connect( this, { click: 'selectWikicode' } );
		this.copyWiki.connect( this, { click: 'copyWikicode' } );
		this.indexLayout.connect( this, { set: 'onIndexLayoutSet' } );

		// Initialize
		this.indexLayout.addTabPanels( [
			this.settingsPanel,
			this.geojsonPanel,
			this.templatePanel
		] );
		// Replace static map with form
		this.$container.empty().append(
			this.$map,
			this.indexLayout.$element,
			this.helpLink.$element
		);
	},

	onMapIDChange: function () {
		if ( !this.map ) {
			return;
		}
		// Set the mapID (default the plane and position)
		var mapID = this.mapID.getValue();
		if ( !mapID || isNaN(mapID) ) {
			return;
		}
		if ( !this.mapData[mapID] || this.mapData[mapID].name == this.mapName.getValue() ) {
			return;
		}
		this.map.setMapID(mapID);
		this.mapName.setValue(this.mapData[mapID].name);
		// Update the plane and position inputs
		var pos = this.map.getMapPosition();
		this.plane.setValue( pos.plane );
		this.latitude.setValue( pos.center.lat );
		this.longitude.setValue( pos.center.lng );
	},

	onMapNameChange: function () {
		if ( !this.map ) {
			return;
		}
		// Set the mapID (default the plane and position)
		var mapName = this.mapName.getValue();
		if ( !mapName || isNaN(this.mapNameIDs[mapName]) ) {
			return;
		}
		var mapID = this.mapNameIDs[mapName];
		if ( mapID == this.mapID.getValue() ) {
			return;
		}
		this.map.setMapID(mapID);
		this.mapID.setValue(mapID);
		// Update the plane and position inputs
		var pos = this.map.getMapPosition();
		this.plane.setValue( pos.plane );
		this.latitude.setValue( pos.center.lat );
		this.longitude.setValue( pos.center.lng );
	},

	onPlaneChange: function () {
		if ( !this.map ) {
			return;
		}
		var plane = this.plane.getValue();
		if ( !plane || isNaN(plane) ) {
			return;
		}
		this.map.setPlane(plane);
	},

	onCoordsChange: function () {
		if ( this.wasDragging ) {
			return;
		}
		this.map.panTo( [ this.latitude.getValue(), this.longitude.getValue() ], { animate: true } );
	},

	onHeightChange: function () {
		this.$map.css('height', this.height.getValue()+'px');
		var self = this;
		function endSizing () { clearInterval(self.invalSize); }
		this.invalSize = setInterval( function() { self.map.invalidateSize(); }, 50 );
		setTimeout(endSizing, 251);
	},

	onTemplateChange: function () {
		var templ = this.template.getValue();
		if ( this.tempInfo[templ].combinefeatures ) {
			this.features.setDisabled(false);
		} else {
			this.features.setDisabled(true);
		}
		this.getTemplateCode();
	},

	onFeaturesChange: function () {
		this.getTemplateCode();
	},

	updateMapContents: function () {
		var self = this;

		if ( !this.map || this.updatingGeoJson ) {
			return;
		}

		this.geoinput.pushPending();
		require( 'ext.kartographer.editing' )
			.updateKartographerLayer( this.map, this.geoinput.getValue() )
			.done( function () {
				self.getTemplateCode();
				self.geoinput.setValidityFlag( true );
				self.wikiout.setValidityFlag( true );
			} )
			.fail( function (er) {
				console.error(er);
				self.geoinput.setValidityFlag( false );
				self.wikiout.setValidityFlag( false );
			} )
			.always( function () {
				self.geoinput.popPending();
			} );
	},

	getTemplateCode: function ( geoJson ) {
		var self = this;
		this.geoinput.getValidity()
		.fail( function (er) {
			console.warn(er);
			self.wikiout.setValidityFlag( false );
			self.wikiout.setValue( mw.msg('kartographer-drawmapdialog-invalidjson') );
		} )
		.done( function () {
			try {
				var geoJson = JSON.parse( self.geoinput.getValue() );
				self.templateCode( geoJson );
			} catch (er) {
				console.warn(er);
				self.wikiout.setValidityFlag( false );
				self.wikiout.setValue( mw.msg('kartographer-drawmapdialog-invalidjson') );
			}
		} );
	},

	templateCode: function ( geoJson ) {
		var templ = this.template.getValue(),
			feats = this.features.getValue(),
			templInfo = this.tempInfo[templ],
			defInfo = this.defTempInfo,
			features = [];
		if ( geoJson.features ) { features = geoJson.features; }
		else if ( Array.isArray(geoJson) ) { features = geoJson; }
		else if ( geoJson.geometry ) { features = [geoJson]; }

		if ( !features || features.length === 0 ) {
			this.wikiout.setValue( mw.msg('kartographer-drawmap-nofeatures') );
			console.warn( mw.message( 'kartographer-drawmap-nofeatures' ).plain() );
			return false;
		}

		function strTemplate(str, params) {
			return str.replace(/\$\{[^}]+\}/g, (match) => 
				match
					.slice(2, -1)
					.trim()
					.split(".")
					.reduce(
						//(searchObject, key) => searchObject[key] || String(searchObject[key]) || '' || match, params
						(searchObject, key) => searchObject[key] || String(searchObject[key]) || '', params
					)
			);
		}
		function coordRound(val) {
			return Math.round((val + Number.EPSILON) * 100) / 100;
		}
		function coordPrint(coords) {
			var str = templInfo.coords || defInfo.coords,
				params = {
					x: coordRound(coords[0]),
					lon: coordRound(coords[0]),
					y: coordRound(coords[1]),
					lat: coordRound(coords[1]),
				};
			if ( coords[2] || coords[2] === 0 ) {
				params.plane = coordRound(coords[2]);
				params.p = coordRound(coords[2]);
			}
			return strTemplate(str, params);
		}

		var featStrings = [],
			combinedFeats = {},
			mtypes = [];
		for (var i = 0, len = features.length; i < len; i++) {
			// For each feature
			var feature = features[i];
			if ( feature.geometry && feature.geometry.coordinates ) {
				var coords = feature.geometry.coordinates,
					coordStrings = [],
					hasSub = false;
				if ( Array.isArray(coords[0]) ) {
					for (var j = 0, lenj = coords.length; j < lenj; j++) {
						// For each coordinate set
						var loc = coords[j];
						if ( Array.isArray(loc[0]) ) {
							hasSub = true;
							var coordSubs = [];
							for (var k = 0, lenk = loc.length; k < lenk; k++) {
								coordSubs.push( coordPrint(loc[k]) );
							}
							coordStrings.push( coordSubs.join(templInfo.coordsSeparator || defInfo.coordsSeparator) );
						} else {
							coordStrings.push( coordPrint(loc) );
						}
					}
				} else {
					coordStrings.push( coordPrint(coords) );
				}
				var featParams = { n:i+1 };
				if (hasSub) {
					featParams.coords = coordStrings.join(templInfo.coordsSeparator2 || defInfo.coordsSeparator2);
				} else {
					featParams.coords = coordStrings.join(templInfo.coordsSeparator || defInfo.coordsSeparator);
				}
				// Get feature properties if set
				var props = [];
				if ( feature.properties ) {
					for (var prop in feature.properties) {
						if ( prop == 'mapID' || prop == 'plane' ) {
							featParams[prop] = feature.properties[prop];
						} else if ( prop == 'shape' ) {
							mtypes.push(feature.properties[prop]);
							featParams.type = feature.properties[prop];
						} else {
							props.push( strTemplate(
								templInfo.featProps || defInfo.featProps,
								{ name:prop, value:feature.properties[prop], n:i+1 }
							) );
						}
					}
					featParams.properties = props.join( templInfo.featPropsSeperator || defInfo.featPropsSeperator ) || '';
				}
				if ( feature.geometry.type && !featParams.type ) {
					mtypes.push(feature.geometry.type);
					featParams.type = feature.geometry.type;
				}
				if ( featParams.type == 'Point' ) {
					featParams.type = 'Pin';
					mtypes.pop();
					mtypes.push('Pin');
				}
				if ( templInfo.combinefeatures && feats ) {
					// Combine same feature types
					if ( combinedFeats[featParams.type] ) {
						combinedFeats[featParams.type].coords.push( featParams.coords );
					} else {
						combinedFeats[featParams.type] = {
							coords: [ featParams.coords ],
							properties: featParams.properties,
							type: featParams.type,
							n: i + 1
						};
					}
				} else {
					featStrings.push( strTemplate(templInfo.feature || defInfo.feature, featParams) );
				}
			}
		}
		if ( templInfo.combinefeatures ) {
			var l = 1;
			for (var feat in combinedFeats) {
				combinedFeats[feat].n = l;
				combinedFeats[feat].coords = combinedFeats[feat].coords.join( templInfo.coordsSeparator2 || defInfo.coordsSeparator2 );
				featStrings.push( strTemplate(templInfo.feature || defInfo.feature, combinedFeats[feat]) );
				l++;
			}
		}

		var tempParam = templInfo.params || defInfo.params;
		var	params = [
				strTemplate( tempParam, {name:'mapID', value:this.map.getMapID()} ),
				strTemplate( tempParam, {name:'plane', value:this.map.getPlane()} ),
				strTemplate( tempParam, {name:'zoom', value:this.map.getZoom()} ),
			];

		var tempStrings = {
			params: params.join( templInfo.paramsSeperator || defInfo.paramsSeperator )//,
		};
		var ret = '';
		if ( templInfo.singlefeature ) {
			var templs = [];
			featStrings.forEach(function (feat, n) {
				tempStrings.mtype = mtypes[n];
				tempStrings.features = feat;
				templs.push( strTemplate( templInfo.template || defInfo.template, tempStrings ) );
			});
			ret = templs.join( '\n' );
		} else {
			tempStrings.mtype = mtypes.pop();
			tempStrings.features = featStrings.join( templInfo.featSeparator || defInfo.featSeparator );
			ret = strTemplate( templInfo.template || defInfo.template, tempStrings );
		}

		this.wikiout.setValue(ret);
		return true;
	},

	selectWikicode: function () {
		this.wikiout.select();
	},

	copyWikicode: function () {
		this.wikiout.select();
		document.execCommand('copy');
	},

	onIndexLayoutSet: function ( tabPanel ) {
		if ( tabPanel === this.geojsonPanel ) {
			this.geoinput.popPending();
		} else if ( tabPanel === this.templatePanel ) {
			this.wikiout.popPending();
		}
	}
};

mw.hook( 'wikipage.content' ).add( function() {
	MapDialog.init();
});