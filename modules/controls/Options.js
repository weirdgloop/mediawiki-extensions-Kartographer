// import L from 'leaflet';

// @if KARTOGRAPHER=true
module.Options =
// @endif
// @if KARTOGRAPHER=false
// module.exports.Options =
// @endif
L.Control.extend({
  options: {
    position: 'topright',

    buttonText: '<i class="fa fa-cog"></i>', // The text set on the 'options' button.
    buttonTitle: 'Options', // The title set on the 'options' button.
  },

  onAdd: function(map) {
    let containerName = 'leaflet-control-options';
    let container = L.DomUtil.create('div', containerName + ' leaflet-bar');
    let options = this.options;

    this._optionsButton = this._createButton(this, options.buttonText, options.buttonTitle, containerName + '-button', container);
    this._optionsButton.dataset.micromodalTrigger = 'modal-options';

    return container;
  },

  onRemove: function(map) {
    // Do nothing
  },
});
