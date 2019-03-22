// import IconStore from './IconStore';
// import IconProvider from './IconProvider';
// import BaseLayerBuilder from './BaseLayerBuilder';
// import IconLayerBuilder from './IconLayerBuilder';

/**
 * Load the datafile and create the BaseMaps and OverlayMaps
 * add those maps to the mapSelector to display them
 *
 * Load Basemaps first
 * Load dataproviders and iconlayers
 */
module.LayerDataLoader = (function(BaseLayerBuilder, IconLayerBuilder, IconProvider, IconStore){
  return class LayerDataLoader{
    constructor(controlers = null, config = {}){
      this.dataProviders = {};
      this.baseMaps = {};
      this.overlayMaps = {};
      this.addedOverlayMapsGeoJson = [];
      this.iconStore = null;
      this.loader = null;
      this.controlers = controlers;
      this.config = config;
    }

    setConfig(config){
      this.config = config;
    }

    setControlers(controlers){
      this.controlers = controlers;
    }

    setAddedOverlayMaps(addedOverlayMaps){
      this.addedOverlayMapsGeoJson = addedOverlayMaps;
    }

    async load(){
      var ldl = this;
      this.loader = new Promise(async function(resolve, reject) {
        // Load Data loader file
        var responceData = await fetch(ldl.config.dataloaderFile);
        var data = await responceData.json();
        // Load baseMaps
        ldl.loadBaseMaps(data);

        // Load overlayMaps
        ldl.loadProviders(data.datasources);
        ldl.iconStore = new IconStore(ldl.dataProviders, ldl.config);
        await ldl.waitForProvidersToLoad();
        ldl.loadOverlayMaps(data);
        resolve();
      });
    }

    async waitForProvidersToLoad(){
      var promises = [];
      // Create list of promises
      for(let i in this.dataProviders){
        promises.push(this.dataProviders[i].dataPromise);
      }

      await Promise.all(promises);
    }

    async getIconStore(){
      await this.loader;
      return this.iconStore;
    }

    loadProviders(dataSources){
      for(let i in dataSources){
        this.dataProviders[dataSources[i].id] = this.loadProvider(dataSources[i]);
      }
    }

    loadProvider(data){
      switch (data.type) {
        case 'icons':
          var provider = new IconProvider(data.dataproviders.iconclasses, data.dataproviders.iconlist, data.dataproviders.defaultIconClass);
          provider.load();
          return provider;
        case 'labels':
          break;
        case 'shapes':
          break;
      }
    }

    async loadBaseMaps(data){
      // Load baseMaps
      for(let i in data.baseMaps){
        data.baseMaps[i].layerBuilder = this.loadBaseLayer(data.baseMaps[i]);

        this.baseMaps[data.baseMaps[i].mapId] = data.baseMaps[i];
      }
      this.controlers.mapSelect.setBaseMaps(this.baseMaps);
    }

    loadOverlayMaps(data){
      // Load overlayMaps
      for(let i in data.overlayMaps){
        data.overlayMaps[i].layerBuilder = this.loadOverlayLayer(data.overlayMaps[i]);
        this.overlayMaps[data.overlayMaps[i].id] = data.overlayMaps[i];
      }
      // load addedOverlayMaps
      for(let i in this.addedOverlayMapsGeoJson){
        this.overlayMaps[i+'-added'] = {
          id: i+'-added',
          name: 'Inline content',
          dataSource: 'Inline',
          parentLayer: 'icons',
          displayOnLoad: true,
          layerBuilder: this.loadOverlayLayerFromData(this.addedOverlayMapsGeoJson[i][0], false),
        };
      }
      // Add layers to controler (menu)
      this.controlers.mapSelect.setOverlayMaps(this.overlayMaps);
    }

    loadBaseLayer(layerData){
      var lb = new BaseLayerBuilder(layerData, this.config);
      lb.loadLayer();
      return lb;
    }

    loadOverlayLayer(layerData){
      var lb = new IconLayerBuilder(this.iconStore, layerData.dataSource);
      lb.loadLayer();
      return lb;
    }

    loadOverlayLayerFromData(data, drawOnCanvas = true){
      var lb = new IconLayerBuilder(this.iconStore, 'inline');
      lb.loadLayerFromData(data);
      lb.setDrawOnCanvas(drawOnCanvas);
      return lb;
    }
  };
}(
  module.BaseLayerBuilder,
  module.IconLayerBuilder,
  module.IconProvider,
  module.IconStore
) );
