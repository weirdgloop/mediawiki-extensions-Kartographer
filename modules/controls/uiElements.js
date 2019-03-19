// import L from 'leaflet';

L.Control.include( {
  _createButton: function( _this, html, title, className, container, fn ) {
    var link = L.DomUtil.create( 'a', className, container );
    link.innerHTML = html;
    link.title = title;

    /*
    * Will force screen readers like VoiceOver to read this as "Zoom in - button"
    */
    link.setAttribute( 'role', 'button' );
    link.setAttribute( 'aria-label', title );

    link.href = '#';

    L.DomEvent.disableClickPropagation( link );
    L.DomEvent.on( link, 'click', L.DomEvent.stop );
    if ( fn ) {
      L.DomEvent.on( link, 'click', fn, _this );
    }
    // TODO _this.refocusOnMap does not work should be _this._refocusOnMap
    // L.DomEvent.on( link, 'click', _this.refocusOnMap, _this );

    return link;
  },
  _createSelect: function( _this, html, title, className, container, fn ) {
    var select = L.DomUtil.create( 'select', className, container );
    select.innerHTML = html;
    select.title = title;

    /*
    * Will force screen readers like VoiceOver to read this as "Zoom in - button"
    */
    select.setAttribute( 'role', 'select' );
    select.setAttribute( 'aria-label', title );

    L.DomEvent.disableClickPropagation( select );
    // L.DomEvent.on(select, 'click', L.DomEvent.stop);
    if ( fn ) {
      L.DomEvent.on( select, 'change', fn, _this );
    }
    // L.DomEvent.on(select, 'click', _this._refocusOnMap, _this);
    // L.DomEvent.on(select, 'change', _this._refocusOnMap, _this);

    return select;
  },
} );
