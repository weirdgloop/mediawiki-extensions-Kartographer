// import L from 'leaflet';

// @if KARTOGRAPHER=true
module.MapSelect =
// @endif
// @if KARTOGRAPHER=false
// module.exports.MapSelect =
// @endif
L.Control.extend({
  options: {
    position: 'bottomleft',

    buttonText: 'RuneScape Surface', // The text set on the 'options' button.
    buttonTitle: 'Select Map', // The title set on the 'options' button.
  },

  initialize: function(options){
    if(!options){
      options = {};
    }
    if('visible' in options){
      this._visible = options.visible;
    }else{
      this._visible = true;
    }
    this._map = null;
  },

  onAdd: function(map) {
    let containerName = 'leaflet-control-mapSelect',
      container = L.DomUtil.create('div', containerName + ' leaflet-bar');
    this._map = map;

    // build innerHTML
    var innerHTML = '';
    for(var i in this._baseMaps){
      var layerInfo = this._baseMaps[i];
      innerHTML += '<option value="'+layerInfo.mapId+'">'+layerInfo.name+'</option>';
    }

    if(this._visible){
      this._optionsSelect = this._createSelect(this, innerHTML, this.options.buttonTitle,
        containerName + '-select', container, this._mapIDChanging.bind(this));
    }
    this._map.on('newbasemaps', this._resetSelect, this);
    // this._map.on('newoverlaymaps', this._resetSelect, this);
    this._map.on('mapidchanged', this._mapIDChanged, this);

    return container;
  },

  onRemove: function(map) {
    this._map.off('newbasemaps', this._resetSelect, this);
    // this._map.off('newoverlaymaps', this._resetSelect, this);
    this._map.off('mapidchanged', this._mapIDChanged, this);
  },

  _resetSelect: function(e){
    // build innerHTML
    var innerHTML = '';
    for(var i in e.baseMaps){
      var layerInfo = e.baseMaps[i];
      innerHTML += '<option value="'+layerInfo.mapId+'">'+layerInfo.name+'</option>';
    }
    if(this._visible){
      this._optionsSelect.innerHTML = innerHTML;
    }
  },

  _mapIDChanging: function(event){
    var mapID = Number(event.target.value);
    var current = this._selectedMapID;
    if(mapID === current){
      // mapID did not change
      return;
    }

    this._map.fire('mapidchanging', {
      current: current,
      mapID: mapID,
      userChanged: true,
    });
  },

  _mapIDChanged: function(event){
    this._changeSelectedOption(event.mapID);
  },

  _changeSelectedOption: function(mapID){
    if(!this._visible){
      return;
    }
    var options = this._optionsSelect.options;
    var option;
    for (var i = 0; i < options.length; i++) {
      option = options[i];
      if (option.value === mapID.toString()) {
        options.selectedIndex = i;
        break;
      }
    }
  },
});
