// import L from 'leaflet';

// @if KARTOGRAPHER=true
module.MapControler =
// @endif
// @if KARTOGRAPHER=false
// module.exports.MapControler =
// @endif
L.Control.extend({
  options: {

  },

  initialize: function(map){
    this._baseMaps = {};
    this._overlayMaps = {};
    this._visibleOverlayMaps = [];
    this._selectedView = {
      mapID: 0,
      plane: 0,
      zoom: 0,
      location: [ 0, 0 ],
    };
    this._initialView = {
      viewSet: false,
      mapID: 0,
      plane: 0,
      zoom: 0,
      location: [ 0, 0 ],
    };
    this._map = map;

    this._map.on('mapidchanged', this._mapIDChanged, this);
    this._map.on('planechanged', this._planeChanged, this);
    this._map.on('zoomend', this._zoomChanged, this);
  },

  onRemove: function() {
    this._map.off('mapidchanged', this._mapIDChanged, this);
    this._map.off('planechanged', this._planeChanged, this);
    this._map.off('zoomend', this._zoomChanged, this);
  },

  _mapIDChanged: function(event){
    if(event.userChanged){
      this._initialView.viewSet = false;
    }
    this._changeMapID(Number(event.mapID), true);
  },

  _planeChanged: function(event){
    if(event.userChanged){
      this._initialView.viewSet = false;
      this._changePlane(Number(event.plane));
    }
  },

  _zoomChanged: function(event){
    this._changeZoom(Number(event.target.getZoom()));
  },

  /*
   * Replace the current basemaps with new
   */
  setBaseMaps: function(baseMaps){
    // Remove loaded baseMaps
    if(this._selectedView.mapID !== null &&
        this._selectedView.mapID in this._baseMaps &&
        this._map !== null){
      var selectedBaseMap = this._baseMaps[this._selectedView.mapID];
      this._map.removeLayer(selectedBaseMap.layerBuilder.layer);
    }
    // Set new BaseMaps
    this._baseMaps = baseMaps;

    this._map.fire('newbasemaps', {
      baseMaps: baseMaps,
    });

    this._changeMapID(this._selectedView.mapID, false);
  },

  setOverlayMaps: function(overlayMaps){
    // Clear previous overlayMaps
    for(let i in this._visibleOverlayMaps){
      this._map.removeLayer(this._visibleOverlayMaps[i]);
    }
    this._visibleOverlayMaps.length = 0;
    // Set new OverlayMaps
    this._overlayMaps = overlayMaps;

    this._map.fire('newoverlaymaps', {
      overlayMaps: overlayMaps,
    });

    this._changeMapID(this._selectedView.mapID, false);
  },

  setView: function(mapID, plane, loc, zoom){
    this._initialView = {
      viewSet: true,
      mapID: mapID,
      plane: plane,
      zoom: zoom,
      location: [ loc.lat, loc.lng ],
    };
    var current = this._selectedView;
    var changed = this._initialView;

    // Check if MapID is changed and trigger changes
    if(current.mapID !== changed.mapID){
      this._map.fire('mapidchanging', {
        current: current.mapID,
        mapID: changed.mapID,
        userChanged: false,
      });
    }

    // Check if Plane is changed and trigger changes
    if(current.plane !== changed.plane){
      this._map.fire('planechanging', {
        current: current.plane,
        plane: changed.plane,
        userChanged: false,
      });
    }

    // If update not triggered from above, trigger it here
    if(current.mapID === changed.mapID && current.plane === changed.plane){
      this._changeView(this._initialView);
    }
  },

  _changeView: function(view){
    // Quick set
    var changed;
    if(this._initialView.viewSet){
      changed = {
        mapID: this._initialView.mapID,
        plane: this._initialView.plane,
        zoom: this._initialView.zoom,
        location: this._initialView.location,
      };
    }else{
      changed = view;
    }
    this._map.setView(changed.location, changed.zoom);
  },

  _changeMapID: function(mapId, changeView){
    if(!(mapId in this._baseMaps)){
      console.error('Selected MapID does not exists: ', mapId);
      return;
    }

    this._loadBaseMaps(mapId);
    this._loadOverlays();

    if(changeView){
      var defaultView = {
        mapID: mapId,
        plane: 0,
        zoom: this._baseMaps[mapId].defaultZoom,
        location: [ this._baseMaps[mapId].center[1],
          this._baseMaps[mapId].center[0] ],
      };

      this._changeView(defaultView);
    }
  },

  _changePlane: function(plane){
    this._selectedView.plane = Number(plane);
    this._loadOverlays();
  },

  _changeZoom: function(zoom){
    this._selectedView.zoom = Number(zoom);
    this._loadOverlays();
  },

  /*
   * == Loading new layers code below ==
   */

  _loadBaseMaps: function(mapId){
    // Check if there is a BaseMap displayed
    if(this._selectedView.mapID !== null){
      this._map.removeLayer(this._baseMaps[this._selectedView.mapID].layerBuilder.layer);
    }

    this._map.addLayer(this._baseMaps[mapId].layerBuilder.layer);
    this._map.setMaxBounds(this._translateBounds(this._baseMaps[mapId].bounds));
    this._selectedView.mapID = Number(mapId);
  },

  _loadOverlays: function(){
    // Clear previous OverlayMaps
    for(let i in this._visibleOverlayMaps){
      this._map.removeLayer(this._visibleOverlayMaps[i]);
    }
    this._visibleOverlayMaps.length = 0;

    for(let i in this._overlayMaps){
      if(this._overlayMaps[i].displayOnLoad){
        // Load overlay async and non blocking
        this._addOverlayMap(this._overlayMaps[i]);
      }
    }
  },

  _addOverlayMap: async function(layerInfo){
    await layerInfo.layerBuilder.dataLoader;
    layerInfo.layerBuilder.dataLoader = null;

    var view = this._selectedView;

    layerInfo.layer = layerInfo.layerBuilder.createLayer(view.mapID, view.plane, view.zoom);
    this._visibleOverlayMaps.push(layerInfo.layer);
    this._map.addLayer(layerInfo.layer);
  },

  _translateBounds: function(bounds){
    var newbounds = [ [ 0, 0 ], [ 12000, 12000 ] ];
    if(Array.isArray(bounds) && bounds.length === 2){
      // South-West
      if(Array.isArray(bounds[0]) && bounds[0].length === 2){
        newbounds[0][0] = bounds[0][1];
        newbounds[0][1] = bounds[0][0];
      }
      // North-East
      if(Array.isArray(bounds[1]) && bounds[1].length === 2){
        newbounds[1][0] = bounds[1][1];
        newbounds[1][1] = bounds[1][0];
      }
    }
    return newbounds;
  },

});
