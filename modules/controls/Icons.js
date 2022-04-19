// import L from 'leaflet';

// @if KARTOGRAPHER=true
module.Icons =
// @endif
// @if KARTOGRAPHER=false
// module.exports.Icons =
// @endif
L.Control.extend({
  options: {
    position: 'topright',

    enabled: true,

    buttonText: '', // The text set on the 'options' button.
    buttonTitle: 'Toggle icons', // The title set on the 'options' button.
  },

  _updateLayers: function() {
    var add = this.options.enabled;

    var _layers = false, _map = false;
    if(!_layers) {
      console.warn('Tried to setup icon layers but they don\'t seem bo be loaded yet...');
      return;
    }

    // Updating control icon
    if(add) {
      L.DomUtil.addClass(this._button, 'visible');
      L.DomUtil.removeClass(this._button, 'invisible');
    } else {
      L.DomUtil.removeClass(this._button, 'visible');
      L.DomUtil.addClass(this._button, 'invisible');
    }

    // Update icon layers visibility
    for(var layer of _layers) {
      if(add) {
        _map.addLayer(layer);
      } else {
        _map.removeLayer(layer);
      }
    }
  },

  _toggle: function() {
    this.options.enabled = !this.options.enabled;
    this._updateLayers();
  },

  onAdd: function(map) {
    let containerName = 'leaflet-control-icons',
      container = L.DomUtil.create('div', containerName + ' leaflet-bar'),
      options = this.options;

    this._button = this._createButton(this, options.buttonText, options.buttonTitle, containerName + '-button', container, this._toggle);

    // Setup layers
    this._updateLayers();

    return container;
  },

  onRemove: function(map) {
    // Do nothing
  },
});
