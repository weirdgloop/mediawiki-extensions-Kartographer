/*!
 * VisualEditor DataModel MWMapsNode class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * DataModel MW Maps node.
 *
 * @class
 * @extends ve.dm.MWBlockExtensionNode
 * @mixins ve.dm.ResizableNode
 *
 * @constructor
 * @param {Object} [element] Reference to element in linear model
 * @param {ve.dm.Node[]} [children]
 */
ve.dm.MWMapsNode = function VeDmMWMaps() {
	// Parent constructor
	ve.dm.MWMapsNode.super.apply( this, arguments );

	// Mixin constructors
	ve.dm.ResizableNode.call( this );
};

/* Inheritance */

OO.inheritClass( ve.dm.MWMapsNode, ve.dm.MWBlockExtensionNode );

OO.mixinClass( ve.dm.MWMapsNode, ve.dm.ResizableNode );

/* Static Properties */

ve.dm.MWMapsNode.static.name = 'mwMaps';

ve.dm.MWMapsNode.static.extensionName = 'mapframe';

ve.dm.MWMapsNode.static.matchTagNames = [ 'div' ];

/* Static methods */

ve.dm.MWMapsNode.static.toDataElement = function () {
	var dataElement = ve.dm.MWMapsNode.super.static.toDataElement.apply( this, arguments );

	dataElement.attributes.width = +dataElement.attributes.mw.attrs.width;
	dataElement.attributes.height = +dataElement.attributes.mw.attrs.height;

	return dataElement;
};

ve.dm.MWMapsNode.static.getUrl = function ( dataElement, width, height ) {
	var _tileSize = 256;
	var mwAttrs = dataElement.attributes.mw.attrs;

	var scale = Math.pow( 2, mwAttrs.zoom );
	var toCoord = function ( point, scale ) {
		return ( ( point / scale - 0 ) / 1 );
	};
	var toPoint = function ( coord, scale ) {
		return ( scale * ( 1 * coord + 0 ) );
	};
	var tileSize = toCoord( _tileSize, scale );

	// Map size
	var mapWidth = toCoord( width, scale );
	var mapHeight = toCoord( height, scale );
	// Corner low coords
	var lowX = mwAttrs.longitude - (mapWidth / 2);
	var lowY = mwAttrs.latitude - (mapHeight / 2);
	// Corner high coords
	var highX = mwAttrs.longitude + (mapWidth / 2);
	var highY = mwAttrs.latitude - (mapHeight / 2);
	// Tile low
	var tileLowX = Math.floor( lowX / tileSize );
	var tileLowY = Math.floor( lowY / tileSize );
	// Tile high
	var tileHighX = Math.floor( highX / tileSize );
	var tileHighY = Math.floor( highY / tileSize );
	// Initial offset
	var initOffX = lowX - (tileLowX * tileSize);
	initOffX = -( toPoint(initOffX, scale) );
	var initOffY = lowY - (tileLowY * tileSize);
	initOffX = toPoint(initOffX, scale) - _tileSize;

	var mapsConfig = mw.config.get( 'wgKartographerDataConfig' );
	var mapVers = mapsConfig.mapVersion;
	var mesVers = mw.message('kartographer-map-version');
    if (mesVers.exists()) {
        mapVers = mesVers.text();
    }
    var  baseUrl = mapsConfig.baseTileURL + mapsConfig.tileURLFormat;
    baseUrl = baseUrl.replace( '{mapVersion}', mapVers );
	var getTileUrl = function ( mapID, zoom, plane, x, y ) {
		var url = baseUrl.replace( '{mapID}', mapID )
			.replace( '{z}', zoom )
			.replace( '{p}', plane )
			.replace( '{x}', x )
			.replace( '{y}', y ).replace( '{-y}', y )
		return url;
	};

	// Make tiles
	var bgImages = [];
	var bgPos = [];
	var yCount = 0;
	for (let y = tileHighY; y >= tileLowY; y -= 1) {
		var yOff = initOffY + (yCount * _tileSize);
		yCount += 1;
		var xCount = 0;
		for (let x = tileLowX; x <= tileHighX; x += 1) {
			var xOff = initOffX + (xCount * _tileSize);
			xCount += 1;
			var tileUrl = getTileUrl( mwAttrs.mapID, mwAttrs.zoom, mwAttrs.plane, x, y );
			bgImages.push( "url("+tileUrl+")" );
			bgPos.push( xOff+"px "+yOff+"px" );
		}
	}

	return {
		'background-image': bgImages.join(', '),
		'background-position': bgPos.join(', '),
		'background-repeat': 'no-repeat'
	}
};

ve.dm.MWMapsNode.static.createScalable = function ( dimensions ) {
	return new ve.dm.Scalable( {
		fixedRatio: false,
		currentDimensions: {
			width: dimensions.width,
			height: dimensions.height
		},
		minDimensions: {
			width: 200,
			height: 100
		},
		maxDimensions: {
			width: 1000,
			height: 1000
		}
	} );
};

ve.dm.MWMapsNode.prototype.getCurrentDimensions = function () {
	return {
		width: +this.getAttribute( 'mw' ).attrs.width,
		height: +this.getAttribute( 'mw' ).attrs.height
	};
};

/* Methods */

ve.dm.MWMapsNode.prototype.getUrl = function ( width, height ) {
	return this.constructor.static.getUrl( this.element, width, height );
};

/**
 * @inheritdoc
 */
ve.dm.MWMapsNode.prototype.createScalable = function () {
	return this.constructor.static.createScalable( this.getCurrentDimensions() );
};

/**
 * Don't allow maps to be edited if they contain features that are not
 * supported not supported by the editor.
 *
 * @inheritdoc
 */
ve.dm.MWMapsNode.prototype.isEditable = function () {
	var containsDynamicFeatures = this.usesAutoPositioning() || this.usesExternalData();
	return !this.usesMapData() || !containsDynamicFeatures;
};

/**
 * Checks whether the map uses auto-positioning.
 *
 * @return {boolean}
 */
ve.dm.MWMapsNode.prototype.usesAutoPositioning = function () {
	var mwAttrs = this.getAttribute( 'mw' ).attrs;
	return !( mwAttrs.latitude && mwAttrs.longitude && mwAttrs.zoom );
};

/**
 * Checks whether the map uses external data.
 *
 * @return {boolean}
 */
ve.dm.MWMapsNode.prototype.usesExternalData = function () {
	var mwData = this.getAttribute( 'mw' ),
		geoJson = ( mwData.body && mwData.body.extsrc ) || '';
	return /ExternalData/.test( geoJson );
};

/**
 * Checks whether the map contains any map data.
 *
 * @return {boolean}
 */
ve.dm.MWMapsNode.prototype.usesMapData = function () {
	var mwData = this.getAttribute( 'mw' );
	return !!( mwData.body && mwData.body.extsrc );
};

/* Registration */

ve.dm.modelRegistry.register( ve.dm.MWMapsNode );
