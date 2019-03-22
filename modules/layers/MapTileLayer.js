// import L from 'leaflet';

// @if KARTOGRAPHER=true
module.MapTileLayer =
// @endif
// @if KARTOGRAPHER=false
module.exports.MapTileLayer =
// @endif
L.TileLayer.extend({
  initialize: function(url, options) {
    L.TileLayer.prototype.initialize.call(this, url, options);
    // L.setOptions(this, options);

    this._plane = this.options.plane || 0;
    this._mapID = this.options.mapID || 0;
  },

  onAdd: function(map) {
    L.TileLayer.prototype.onAdd.call(this, map);

    map.on('planechange', this._planeChange, this);
  },

  // Inject plane into URL
  getTileUrl: function(coords) {
    var data = {
      r: L.Browser.retina ? '@2x' : '',
      s: this._getSubdomain(coords),
      x: coords.x,
      y: coords.y,
      z: this._getZoomForUrl(),
      p: this._plane,
      mapID: this._mapID,
    };

    if (this._map && !this._map.options.crs.infinite) {
      var invertedY = this._globalTileRange.max.y - coords.y;
      if (this.options.tms) {
        data['y'] = invertedY;
      }
      data['-y'] = invertedY;
    }

    return L.Util.template(this._url, L.Util.extend(data, this.options));
  },

  _planeChange: function(e) {
    this._plane = e.plane;
    this.redraw();
  },
});
