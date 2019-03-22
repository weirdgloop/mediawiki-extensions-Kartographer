// import MapTileLayer from '../components/mapTileLayer';
/**
 * Creates an BaseLayer for the map
 *
 */
module.BaseLayerBuilder = (function(MapTileLayer){
  return class BaseLayerBuilder{
    constructor(layerData, config){
      this.name = name;
      this.layerData = layerData;
      this.layer = null;
      this.config = config;
    }

    loadLayer(){
      this.layer = new MapTileLayer(this.config.baseTileURL + this.config.tileURLFormat, {
        bounds: this._translateBounds(this.layerData.bounds),
        minZoom: this.layerData.zoomLimits[0],
        maxZoom: this.layerData.zoomLimits[1],
        maxNativeZoom: this.layerData.maxNativeZoom,
        mapID: this.layerData.mapId,
        attribution: this.layerData.attribution || '',
      });
      return null;
    }

    _translateBounds(bounds){
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
    }

    createLayer(){
      return this.layer;
    }
  };
}(
  module.MapTileLayer
) );
