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
    this._map = null;
  },

  onAdd: function(map) {
    let containerName = 'leaflet-control-mapSelect',
      container = L.DomUtil.create('div', containerName + ' leaflet-bar');
    this._map = map;

    let listener = (event) => this._map.setMapID(Number(event.target.value));

    this._optionsSelect = this._createSelect(this, "", this.options.buttonTitle,
      containerName + '-select', container, listener);
    // this._map.on('newoverlaymaps', this._resetSelect, this);

    return container;
  },

  onRemove: function(map) {
    // this._map.off('newoverlaymaps', this._resetSelect, this);
  },

  _resetSelect: function(baseMaps){
    // build innerHTML
    var innerHTML = '';
    for(var layerInfo of baseMaps){
      innerHTML += '<option value="'+layerInfo.mapId+'">'+layerInfo.name+'</option>';
    }
      this._optionsSelect.innerHTML = innerHTML;
  },

  _changeSelectedOption: function(mapID){
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
