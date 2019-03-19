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
        bounds: this.layerData.bounds,
        minZoom: this.layerData.zoomLimits[0],
        maxZoom: this.layerData.zoomLimits[1],
        maxNativeZoom: this.layerData.maxNativeZoom,
        mapID: this.layerData.mapId,
        attribution: this.layerData.attribution || '',
      });
      return null;
    }

    createLayer(){
      return this.layer;
    }
  };
}(
  module.MapTileLayer
) );
