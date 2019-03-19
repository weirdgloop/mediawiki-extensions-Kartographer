/**
 * Draw image on canvas and not as different DOM elements
 * this allows for many icons to be present on map.
 *
 * Only works for image not for lines and other features,
 * this could be added.
 *
 * Based on: https://izurvive.com
 *
 * TODO: There are some issues with border clipping
 */

// import L from 'leaflet';

L.CanvasLayer = L.GridLayer.extend({
  statics: {
    Images: {},
    ImagePromises: [],
    ImagesLoaded: false,
  },

  initialize: function(options) {
    L.setOptions(this, options);

    this._layerList = [];
    this._layerGrid = [];
    this._loadingImages = false;
    this._loadingFinishedCallbacks = [];

    this._plane = 0;
    this._map = null;
  },

  onAdd: function(map) {
    L.GridLayer.prototype.onAdd.call(this, map);
    this._map = map;

    this.options.maxNativeZoom = map.options.maxNativeZoom;
    this.options.maxZoom = map.options.maxZoom;

    this._currentZoom = map.getZoom();
  },

  addLayer: async function(layer) {
    if (!(layer instanceof L.VisibilityLayer)) {
      console.log('FIX: CanvasLayer.addLayer(layer) only accepts VisibilityLayer as argument');
      return this;
    }

    var id = L.Util.stamp(layer);
    this._layerList[id] = layer;
    layer._canvasLayer = this;

    L.CanvasLayer.ImagesLoaded = false;
    for(var image of layer.getImages()) {
      this._loadImage(image);
    }
    this._addLayer(layer);

    await Promise.all(L.CanvasLayer.ImagePromises);
    L.CanvasLayer.ImagesLoaded = true;

    L.GridLayer.prototype.redraw.call(this);

    return this;
  },

  createTile: function(coords, doneCallback) {
    let canvas = document.createElement('canvas');
    let size = this.getTileSize();
    canvas.width = size.x;
    canvas.height = size.y;
    let canvasContext = canvas.getContext('2d');
    canvasContext.imageSmoothingEnabled = false;

    let zoom = coords.z;
    if(this._currentZoom !== zoom) {
      this._currentZoom = zoom;
      this._rebuildLayerGrid();
    }

    let layerGrid = this._layerGrid[coords.x] ? this._layerGrid[coords.x][coords.y] : [];
    if(layerGrid && layerGrid.length > 0) {
      // Only draw tile once all images have been loaded
      if(this._loadingImages > 0) {
        this._loadingFinishedCallbacks.push({
          method: this._drawTile,
          parameters: [ coords, doneCallback, canvas, canvasContext, size, layerGrid ],
        });
      } else {
        this._drawTile(coords, doneCallback, canvas, canvasContext, size, layerGrid);
      }
    }

    return canvas;
  },

  _drawTile: function(coords, doneCallback, canvas, canvasContext, tileSize, layerGrid) {
    if(this._map === null){
      console.error('Map is not defined when rendering CanvasLayer.');
      return;
    }
    // Sort layers
    layerGrid.sort(function(a, b) {
      a = a._latlng.lat;
      b = b._latlng.lat;
      return a > b ? 1 : b > a ? -1 : 0;
    });

    let scale = this._map.getZoomScale(this._map.getZoom(), coords.z);

    let tilePos = L.point([ coords.x * tileSize.x, coords.y * tileSize.y ]);
    for(let layer of layerGrid) {
      if(!layer._visibilityLayer.getVisible()) {
        continue;
      }
      let iconOptions = layer.options.icon.options;
      let iconUrl = iconOptions.iconUrl;

      let icon = this._getImage(iconUrl);
      if (icon) {
        let size = L.point(iconOptions.iconSize);
        let offset = L.point([ 0, 0 ]);
        if(iconOptions.iconAnchor){
          // Calculate offset from top left, not center
          let offsetReset = [ 0, 0 ];
          offsetReset[0] = iconOptions.iconAnchor[0] - iconOptions.iconSize[0]/2;
          offsetReset[1] = iconOptions.iconAnchor[1] - iconOptions.iconSize[1]/2;
          offset = L.point(offsetReset);
        }

        let bounds = layer._bounds;
        let sizeScaled = layer.getSizeForScaling(coords.z);

        // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage
        //    drawImage(image, destinationX, destinationY, destinationWidth, destinationHeight)
        canvasContext.drawImage(
          icon,
          bounds.min.x - tilePos.x - offset.x,
          bounds.min.y - tilePos.y - offset.y,
          sizeScaled.x,
          sizeScaled.y
        );
      } else {
        // TODO there might be some async issues, got this message sometimes.
        console.log('FIX: should not happen. Images should already be loaded. iconUrl: ' + iconUrl);
      }
    }

    // TODO: Doesn't load new canvas without the 1ms timeout
    setTimeout(() => doneCallback(null, canvas), 1);
  },

  _fireLoadingCallbacks: function(self) {
    if(self._loadingImages) {
      return;
    }

    for(let callback of self._loadingFinishedCallbacks) {
      let args = Array.prototype.slice.call(callback.parameters, 0);
      // TODO: check if this is being called
      callback.method.apply(this, args);
    }

    self._loadingFinishedCallbacks = [];
  },

  _loadImage: function(iconUrl) {
    if (L.CanvasLayer.Images[iconUrl]) {
      return;
    }

    let img = new Image();
    img.src = iconUrl;
    const promise = new Promise((resolve, reject) => {
      function fulfill() {
        if (img.naturalWidth) {
          resolve(img);
        } else {
          reject(img);
        }
        img.removeEventListener('load', fulfill);
        img.removeEventListener('error', fulfill);
      }
      if (img.naturalWidth) {
        // If the browser can determine the naturalWidth the
        // image is already loaded successfully
        resolve(img);
      } else if (img.complete) {
        // If the image is complete but the naturalWidth is 0px
        // it is probably broken
        reject(img);
      } else {
        img.addEventListener('load', fulfill);
        img.addEventListener('error', fulfill);
      }
    });
    promise.image = img;

    if (!L.CanvasLayer.Images[iconUrl]) {
      L.CanvasLayer.ImagePromises.push(promise);
      L.CanvasLayer.Images[iconUrl] = img;
    }
    return promise;
  },

  _getImage: function(iconUrl) {
    let img = L.CanvasLayer.Images[iconUrl];
    if(img) {
      return img;
    } else {
      console.log('FIX: should not happen? has the iconUrl changed? iconUrl: ' + iconUrl);
      return false;
    }
  },

  _addLayer: function(layer) {
    let tileSize = this.options.tileSize;

    if(typeof layer.eachLayer === 'function') {
      layer.eachLayer(_layer => {
        if(_layer instanceof L.Marker) {
          this._addMarker(_layer, tileSize);
        } else if(_layer instanceof L.VisibilityLayer) {
          this._addLayer(_layer);
        } else {
          console.log('FIX: CanvasLayer only accepts Markers or VisibilityLayers.', _layer);
        }
      });
    }
  },

  _addMarker: function(layer, tileSize) {
    var pos = L.CRS.Simple.latLngToPoint(layer.getLatLng(), this._currentZoom);
    let size = layer.getSizeForScaling(this._currentZoom);
    let center = L.point([ size.x / 2, size.y / 2 ]);

    layer._bounds = L.bounds([
      [ pos.x - center.x, pos.y - center.y ],
      [ pos.x + (size.x - center.x), pos.y + (size.y - center.y) ],
    ]);

    let boundsMin = L.point([ Math.floor(layer._bounds.min.x / tileSize), Math.floor(layer._bounds.min.y / tileSize) ]);
    let boundsMax = L.point([ Math.floor(layer._bounds.max.x / tileSize), Math.floor(layer._bounds.max.y / tileSize) ]);
    for (let y = boundsMin.y; y <= boundsMax.y; y++) {
      for (let x = boundsMin.x; x <= boundsMax.x; x++) {
        this._addMarkerToList(layer, L.point([ x, y ]));
      }
    }
  },

  _addMarkerToList: function(layer, coords) {
    if(!this._layerGrid[coords.x]) {
      this._layerGrid[coords.x] = {};
    }

    if(!this._layerGrid[coords.x][coords.y]) {
      this._layerGrid[coords.x][coords.y] = [];
    }

    this._layerGrid[coords.x][coords.y].push(layer);
  },

  _rebuildLayerGrid: function() {
    this._layerGrid = {};
    for(let id in this._layerList) {
      let layer = this._layerList[id];
      this._addLayer(layer);
    }
  },

  _planeChange: function(e) {
    this._plane = e.plane;
    this.redraw();
  },
});
L.canvasLayer = opts => new L.CanvasLayer(opts);

L.VisibilityLayer = L.LayerGroup.extend({
  options: {
    visible: true,
  },

  initialize: function(options) {
    options = L.setOptions(this, options);
    L.LayerGroup.prototype.initialize.call(this, options);
  },

  // TODO: needed?
  onAdd: function(map) {
    L.LayerGroup.prototype.onAdd.call(this, map);
  },

  setVisible: function(newVisible, e) {
    let oldVisible = this.options.visible;
    this._setVisible(newVisible, e);

    if(oldVisible !== newVisible) {
      let canvasLayer = this._getCanvasLayer();
      if(canvasLayer !== null) {
        canvasLayer.redraw();
      }
    }
  },

  _setVisible: function(visible, e = undefined) {
    if(typeof e !== 'undefined') {
      this.eachLayer(function(layer) {
        if(layer instanceof L.VisibilityLayer) {
          layer._setVisible(visible, e);
        }
      });
    }

    this.options.visible = visible;
  },

  getVisible: function() {
    return this.options.visible;
  },

  getScaling: function() {
    return 1;
  },

  getImages: function() {
    let images = [];

    this.eachLayer(function(layer) {
      if (layer instanceof L.Marker) {
        if(layer.options.icon !== undefined){
          images.push(layer.options.icon.options.iconUrl);
        }else{
          console.log(layer);
        }
      } else if (layer instanceof L.VisibilityLayer) {
        // Merge arrays
        images.push.apply(images, layer.getImages());
      }
    });

    return images;
  },

  addLayer: function(layer) {
    if(layer instanceof L.Marker) {
      L.LayerGroup.prototype.addLayer.call(this, layer);
      layer._visibilityLayer = this;
    } else if(layer instanceof L.VisibilityLayer) {
      L.LayerGroup.prototype.addLayer.call(this, layer);
      layer._superLayer = this;
    } else {
      console.log('FIX: VisibilityLayer only accepts Markers or VisibilityLayers.', layer);
    }

    return this;
  },

  _getCanvasLayer: function() {
    let self = this;
    do {
      if(self._canvasLayer instanceof L.CanvasLayer){
        return self._canvasLayer;
      }
      self = self._superLayer;
    } while (self instanceof L.VisibilityLayer);

    return null;
  },
});
L.visibilityLayer = opts => new L.VisibilityLayer(opts);

L.Marker = L.Marker.extend({
  getSizeForScaling: function(zoom) {
    let scale = 1;
    if(typeof this.options.scaleFactor !== 'undefined') {
      scale = this.options.scaleFactor;
    }

    let width = Math.floor(this.options.icon.options.iconSize[0] * scale);
    let height = Math.floor(this.options.icon.options.iconSize[1] * scale);
    return L.point(width, height);
  },
});
