// import L from 'leaflet';

// @if KARTOGRAPHER=true
module.Help =
// @endif
// @if KARTOGRAPHER=false
// module.exports.Help =
// @endif
L.Control.extend( {
  options: {
    position: 'topright',

    buttonText: '<i class="fa fa-question">?</i>', // The text set on the 'options' button.
    buttonTitle: 'Help', // The title set on the 'options' button.

    linkURL: 'https://oldschool.runescape.wiki/w/RuneScape:Map',
  },

  onAdd: function(map) {
    var containerName = 'leaflet-control-help',
      container = L.DomUtil.create('div', containerName + ' leaflet-bar'),
      options = this.options;

    this._helpButton = this._createButton(this, options.buttonText, options.buttonTitle, containerName + '-button', container, this._onClick);
    this._helpButton.dataset.micromodalTrigger = 'modal-help';

    return container;
  },

  _onClick: function(){
    window.open( this.options.linkURL, '_blank');
  },

  onRemove: function(map) {
    // Do nothing
  },
});
