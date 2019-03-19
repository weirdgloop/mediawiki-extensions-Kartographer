// import L from 'leaflet';

// @if KARTOGRAPHER=true
module.Plane =
// @endif
// @if KARTOGRAPHER=false
// module.exports.Plane =
// @endif
L.Control.extend({
  options: {
    position: 'bottomright',

    planeMin: 0,
    planeMax: 3,
  },

  initialize: function(options) {
    L.setOptions(this, options);
    this._map = null;
    this._plane = this.options.planeMin || 0;
  },

  onAdd: function(map) {
    this._map = map;

    let containerName = 'leaflet-control-plane';
    let container = L.DomUtil.create('div', containerName + ' leaflet-bar');
    let className = 'leaflet-disabled';

    let listenerUp = () => this.setPlane(this._plane + 1);
    let listenerDown = () => this.setPlane(this._plane - 1);
    let listenerLabel = () => this.setPlane(this.options.planeMin || 0); // Reset plane

    this._buttonUp = this._createButton(this, '+', 'Move up', containerName + '-up ' + (this._plane + 1 > this.options.planeMax ? className : ''), container, listenerUp);
    this._buttonPlane = this._createButton(this, this._plane, 'Current plane', containerName + '-plane', container, listenerLabel);
    this._buttonDown = this._createButton(this, '-', 'Move down', containerName + '-down ' + (this._plane - 1 < this.options.planeMin ? className : ''), container, listenerDown);

    map.on('planechange', this._planeChange, this);

    return container;
  },

  _planeChange: function(e) {
    let className = 'leaflet-disabled';

    this._buttonPlane.textContent = e.plane;

    // Disable buttons
    L.DomUtil.removeClass(this._buttonUp, className);
    L.DomUtil.removeClass(this._buttonDown, className);

    if(this._plane - 1 < this.options.planeMin){
      L.DomUtil.addClass(this._buttonDown, className);
    }
    if(this._plane + 1 > this.options.planeMax){
      L.DomUtil.addClass(this._buttonUp, className);
    }
  },

  setPlane: function(plane) {
    if(plane === this._plane){
      // Plane didn't change
      return;
    }

    if(plane < this.options.planeMin || plane > this.options.planeMax){
      // New plane is not within bounds
      return;
    }

    var old = this._plane;
    this._plane = plane;

    this._map.fire('planechange', {
      previous: old,
      plane: plane,
    });
  },

  getPlane: function() {
    return this._plane;
  },
});
