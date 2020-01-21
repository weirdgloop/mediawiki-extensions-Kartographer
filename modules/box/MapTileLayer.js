module.MapTileLayer = L.TileLayer.extend({
  initialize: function(url, options) {
    L.TileLayer.prototype.initialize.call(this, url, options);
    // L.setOptions(this, options);

    this._mapID = this.options.mapID;
  },

  onAdd: function(map) {
    L.TileLayer.prototype.onAdd.call(this, map);
  },

  onRemove: function(map) {
    L.TileLayer.prototype.onRemove.call(this, map);
  },

  // Inject plane into URL
  getTileUrl: function(coords) {
    var data = {
      r: L.Browser.retina ? '@2x' : '',
      s: this._getSubdomain(coords),
      x: coords.x,
      y: coords.y,
      z: this._getZoomForUrl(),
      p: this._map.getPlane(),
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
});