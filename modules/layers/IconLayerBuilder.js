// import L from 'leaflet';
// import {drawPath} from '../pathfind';

/**
 * Creates a IconLayer (overlayMap) for the map
 *
 * It loads a GeoJSON file and creats an overlayMap that
 * can be used by the map. It recreates different maps depending
 * on the zoomlevel, plane and selected mapId
 *
 * Icons are added to a canvas map (for performance),
 * other objects (lines, shapes,..) are added to an svg layer.
 */
module.IconLayerBuilder = (function(){
  return class IconLayerBuilder{
    constructor(iconStore, dataSource){
      this.name = name;
      this.iconStore = iconStore;
      this.dataSource = dataSource;
      this.layerData = null;
      this.dataLoader = null;
      this.canvasLayer = null;
    }

    async loadLayer(){
      var layerBuilder = this;
      this.dataLoader = new Promise(async function(resolve, reject) {
        var responceData = await fetch(layerBuilder.dataSource);
        var layerData = await responceData.json();
        layerBuilder.layerData = layerData;
        resolve(null);
      });
      this.canvasLayer = new L.CanvasLayer();
      return this.dataLoader;
    }

    createLayer(mapID, plane, zoom){
      let layer = L.layerGroup();
      let visLayer = L.visibilityLayer({ visible: true });
      var layerBuilder = this;

      var geojson = L.geoJSON(this.layerData, {
        pointToLayer: function (feature, latlng) {
          // return L.circleMarker(latlng, geojsonMarkerOptions);

          // var icon = layerBuilder.addIcon(latlng, feature.properties);
          // return icon;
        },

        filter: function (geoJsonFeature) {
          // TODO Move somewhere else are the function is not rerun when mapID changes
          // if mapID is number
          if(Number.isInteger(geoJsonFeature.properties.mapID) &&
              geoJsonFeature.properties.mapID !== mapID){
            return false;
          }
          // if mapID is array
          if(Array.isArray(geoJsonFeature.properties.mapID) &&
              !geoJsonFeature.properties.mapID.includes(mapID)){
            return false;
          }
          // Zoom level
          if(Array.isArray(geoJsonFeature.properties.zoom) &&
              (geoJsonFeature.properties.zoom[0] > zoom ||
              geoJsonFeature.properties.zoom[1] < zoom)){
            return false;
          }

          // TODO: check if on plane
          if(geoJsonFeature.geometry.type === 'Point' &&
              geoJsonFeature.geometry.coordinates.length >= 3 &&
              geoJsonFeature.geometry.coordinates[2] !== plane ){
            return false;
          }

          // For lines allow them to be drawn using path finding
          if(geoJsonFeature.geometry.type === 'LineString' &&
              geoJsonFeature.properties.navigation){
            layerBuilder.drawNavigationPath(geoJsonFeature);
            return false;
          }

          // Do not draw points, these are drawn on canvas
          if(geoJsonFeature.geometry.type === 'Point'){
            // Add to canvas
            layerBuilder._addToCanvasLayer(visLayer, geoJsonFeature);
            return false;
          }

          return true;
        },
      });
      this.canvasLayer.addLayer(visLayer);
      layer.addLayer(this.canvasLayer);
      layer.addLayer(geojson);
      return layer;
    }

    _addToCanvasLayer(layer, feature){
      var latlng = [ feature.geometry.coordinates[1], feature.geometry.coordinates[0] ];
      var icon = this.addIcon(latlng, feature.properties);
      layer.addLayer(icon);
    }

    drawNavigationPath(geoJsonFeature){
      var options = {
        startMarker: false,
        endMarker: false,
        showDirectionDetails: false,
      };
      var last = {
        x: geoJsonFeature.geometry.coordinates[0][0],
        y: geoJsonFeature.geometry.coordinates[0][1],
      };
      for(var i = 1; i < geoJsonFeature.geometry.coordinates.length; i++){
        var current = {
          x: geoJsonFeature.geometry.coordinates[i][0],
          y: geoJsonFeature.geometry.coordinates[i][1],
        };
        // drawPath(last, current, options);
        last = current;
      }
    }

    // Get the icon from provided properties
    addIcon(latlng, icondata){
      var icon = this.iconStore.getIcon(0, 'greyPin');
      // use provider and icon name
      if('providerID' in icondata && 'icon' in icondata){
        icon = this.iconStore.getIcon(icondata.providerID, icondata.icon);
      }

      // use wikilink
      if('iconWikiLink' in icondata && 'iconSize' in icondata){
        icon = this.iconStore.getIconFromWikiLink(icondata.iconWikiLink, icondata.iconSize);
      }

      var marker = new L.Marker(latlng, { icon: icon });
      return marker;
    }
  };
}() );
