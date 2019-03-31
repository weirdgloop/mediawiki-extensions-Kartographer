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
    this._defaultView = {
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
    this._changeMapID(Number(event.mapID));
    if(event.userChanged){
      this._initialView.viewSet = false;
      this._switchMapView(this._defaultView);
    }
  },

  _planeChanged: function(event){
    this._changePlane(Number(event.plane));
    if(event.userChanged){
      this._initialView.viewSet = false;
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

    this._changeMapID(this._selectedView.mapID, true);
    this._switchMapView(this._defaultView);
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

    this._loadOverlays();
  },

  setInitView: function(mapID, plane, loc, zoom){
    this._initialView = {
      viewSet: true,
      mapID: mapID,
      plane: plane,
      zoom: zoom,
      location: [ loc.lat, loc.lng ],
    };
    this._switchMapView(this._initialView);
  },

  /*
   * Switch to map to particular view
   * load a different basemap, plane or move the map
   */
  _switchMapView: function(view){
    // check if there is a view buffered in _initialView
    if(this._initialView.viewSet){
      view = {
        mapID: this._initialView.mapID,
        plane: this._initialView.plane,
        zoom: this._initialView.zoom,
        location: this._initialView.location,
      };
    }
    var current = this._selectedView;
    var changed = view;

    // Did we set a new mapID to switch to?
    if('mapID' in changed){
      // check if maps are loaded
      if(!(changed.mapID in this._baseMaps)){
        // console.error('Selected MapID does not exists: ', changed.mapID);
        return;
      }
      // Check if MapID is changed and trigger changes
      if(current.mapID !== changed.mapID){
        this._map.fire('mapidchanging', {
          current: current.mapID,
          mapID: changed.mapID,
          userChanged: false,
        });
      }
    }

    // Did we set a new plane to switch to?
    if('plane' in changed){
      // Check if Plane is changed and trigger changes
      if(current.plane !== changed.plane){
        this._map.fire('planechanging', {
          current: current.plane,
          plane: changed.plane,
          userChanged: false,
        });
      }
    }

    if('zoom' in changed || 'location' in changed){
      // if zoom not changed
      if(!('zoom' in changed)){
        this._map.setView(changed.location, current.zoom);
      }
      this._map.setView(changed.location, changed.zoom);
    }
  },

  _changeMapID: function(mapID){
    if(!(mapID in this._baseMaps)){
      console.error('Selected MapID does not exists: ', mapID);
      return;
    }

    this._loadBaseMaps(mapID);
    this._loadOverlays();

    // Set default view for this map
    this._defaultView = {
      viewSet: true,
      mapID: mapID,
      plane: 0,
      zoom: this._baseMaps[mapID].defaultZoom,
      location: [ this._baseMaps[mapID].center[1],
        this._baseMaps[mapID].center[0] ],
    };
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
