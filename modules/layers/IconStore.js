// import MD5 from './MD5';
// import L from 'leaflet';

/**
 * Simple icon store, finds an icon in all the data providers
 *
 * Given dataProviders have to be loaded before given to this store
 */
module.IconStore = (function(MD5){
  return class IconStore{
    constructor(dataProviders = {}, config = {}){
      this.dataProviders = dataProviders;
      this.config = config;
    }

    getIcon(providerId, iconID){
      if(!(providerId in this.dataProviders)){
        return this.getIcon(0, 'greyPin');
      }
      return this.dataProviders[providerId].getIcon(iconID);
    }

    getIconFromWikiLink(wikilink, iconSize){
      if(wikilink.substr(0, 5) !== 'File:'){
        console.error('WikiLink does not have \'File:\' prefix');
        return this.getIcon(0, 'greyPin');
      }
      // Create path for image file
      var hash = MD5.md5(wikilink.substr(5));
      var url = this.config.wikiImageURL +
        hash.substr(0, 1) + '/' + hash.substr(0, 2) + '/' +
        wikilink.substr(5);
      return L.icon({
        iconUrl: url,
        iconSize: iconSize,
        // popupAnchor: [-3, -76],
      });
    }
  };
}(
  module.MD5
) );
