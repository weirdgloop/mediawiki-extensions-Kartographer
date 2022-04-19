// import L from 'leaflet';

// @if KARTOGRAPHER=true
module.CustomZoom =
// @endif
// @if KARTOGRAPHER=false
// module.exports.CustomZoom =
// @endif
L.Control.Zoom.extend({
  options: {
    position: 'topright',

    zoomInText: '<i class="fa fa-plus"></i>', // '+', // The text set on the 'zoom in' button.
    zoomInTitle: 'Zoom in', // The title set on the 'zoom in' button.
    zoomOutText: '<i class="fa fa-minus"></i>', // '&#x2212;', // The text set on the 'zoom out' button.
    zoomOutTitle: 'Zoom out', // The title set on the 'zoom out' button.

    defaultZoom: 2,
    displayZoomLevel: true,
  },

  initialize: function(options) {
    L.setOptions(this, options);
    this._map = null;
    this._displayZoomLevel = options.displayZoomLevel;
  },

  onAdd: function(map) {
    this._map = map;

    var containerName = 'leaflet-control-zoom';
    var container = L.DomUtil.create('div', containerName + ' leaflet-bar');
    var options = this.options;

    this._zoomInButton = L.Control.prototype._createButton(this, options.zoomInText, options.zoomInTitle, containerName + '-in', container, this._zoomIn);
    if(this._displayZoomLevel){
      this._zoomLevel = L.Control.prototype._createButton(this, '', 'Zoom level', containerName + '-level', container, this._resetZoom);
    }
    this._zoomOutButton = L.Control.prototype._createButton(this, options.zoomOutText, options.zoomOutTitle, containerName + '-out', container, this._zoomOut);

    this._updateDisabled();
    map.on('zoomend zoomlevelschange', this._updateDisabled, this);

    return container;
  },

  _updateDisabled: function() {
    L.Control.Zoom.prototype._updateDisabled.call(this);

    if(this._displayZoomLevel){
      // Update displayed zoom level
      this._zoomLevel.textContent = (this.getZoomPercentage() * 100) + '%';
    }
  },

  getZoomPercentage: function(zoom) {
    if (!zoom){
      zoom = this.options.defaultZoom;
    }
    return 1 / this._map.getZoomScale(zoom);
  },

  _resetZoom: function() {
    this._map.setZoom(this.options.defaultZoom);
  },
});
