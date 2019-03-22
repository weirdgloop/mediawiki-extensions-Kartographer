/**
 * This provider loads and parses a iconclass file and iconlist file
 * The pre-created icons can then be accessed quickly
 */
// import L from 'leaflet';

module.IconProvider = (function(){
  return class IconProvider{
    constructor(iconClassesFile, iconFile, defaultIconClassName){
      this.iconClassesFile = iconClassesFile;
      this.iconFile = iconFile;
      this.defaultIconClassName = defaultIconClassName;
      this.DefaultIconClass = null;
      this.iconClasses = {};
      this.iconlist = {};
      this.dataPromise = null;
    }

    getIcon(id){
      if(!(id in this.iconlist)){
        return new this.DefaultIconClass({
          iconUrl: 'https://osrsmap.ralphbisschops.com/images/pin_grey.svg',
          iconSize: [ 26, 42 ],
          iconAnchor: [ 13, 42 ],
        });
      }
      return this.iconlist[id];
    }

    async load(){
      var thisIconProvider = this;
      this.dataPromise = new Promise(async function(resolve, reject) {
        await thisIconProvider.loadIconClasses();
        await thisIconProvider.loadIcons();
        resolve(true);
      });
    }

    async loadIconClasses(){
      var responceData = await fetch(this.iconClassesFile);
      var data = await responceData.json();

      for(let i in data){
        this.iconClasses[i] = this.loadIconClass(data[i]);
        if(this.defaultIconClassName === i){
          this.DefaultIconClass = this.iconClasses[i];
        }
      }
      // default to first class
      if(this.DefaultIconClass === null && Object.keys(this.iconClasses).length > 0){
        this.DefaultIconClass = this.iconClasses[Object.keys(this.iconClasses)[0]];
        console.log('use default class');
      }
    }

    loadIconClass(icondata){
      return L.Icon.extend(icondata);
      // return L.DivIcon.extend(icondata);
    }

    async loadIcons(){
      var responceData = await fetch(this.iconFile);
      var data = await responceData.json();
      // Set to default
      var IconClass = this.DefaultIconClass;

      for(let i in data.icons){
        if('iconClass' in data.icons[i] &&
          data.icons[i].iconClass in this.iconClasses){
          IconClass = this.iconClasses[data.icons[i].iconClass];
        }
        this.iconlist[i] = this.loadIcon(IconClass, data.icons[i], data.folder);
        IconClass = this.DefaultIconClass;
      }
    }

    loadIcon(IconClass, icondata, folder){
      return new IconClass({
        iconUrl: this.constructIconURL(folder, icondata.filename),
        iconSize: [ icondata.width, icondata.height ],
      });
    }

    constructIconURL(folder, filename){
      return `${folder}${filename}`;
    }
  };
}() );
