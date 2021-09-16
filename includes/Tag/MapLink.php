<?php

namespace Kartographer\Tag;

use FormatJson;
use Html;
use Kartographer\CoordFormatter;
use Kartographer\SpecialMap;

/**
 * The <maplink> tag creates a link that, when clicked,
 */
class MapLink extends TagHandler {
	protected $tag = 'maplink';

	protected $cssClass;

	protected function parseArgs() {
		$this->state->useMaplink();
		parent::parseArgs();
		$this->cssClass = $this->getText( 'class', '', '/^(|[a-zA-Z][-_a-zA-Z0-9]*)$/' );
	}

	protected function render() {
		$output = $this->parser->getOutput();
		$output->addModules( 'ext.kartographer.link' );

		// @todo: Mapbox markers don't support localized numbers yet
		$text = $this->getText( 'text', null, '/\S+/' );
		if ( $text === null ) {
			$text = $this->counter
				?: CoordFormatter::format( $this->lat, $this->lon, $this->getLanguage() );
		}
		$text = $this->parser->recursiveTagParse( $text, $this->frame );

		// For RS, default is Lumbridge
		if ( $this->lat == null || $this->lon == null ) {
			$this->lat = 3200;
			$this->lon = 3200;
		}

		$attrs = [
			'class' => 'mw-kartographer-maplink',
			'mw-data' => 'interface',
			'data-style' => $this->mapStyle,
			'href' => SpecialMap::link( $this->lon, $this->lat, $this->zoom, $this->mapid, $this->plane )->getLocalURL()
		];
		if ( $this->zoom !== null ) {
			$attrs['data-zoom'] = $this->zoom;
		}
		if ( $this->lat !== null && $this->lon !== null ) {
			$attrs['data-lat'] = $this->lat;
			$attrs['data-lon'] = $this->lon;
		}
		// RS attributes
		if ( $this->mapid !== null ) {
			$attrs['data-mapid'] = $this->mapid;
		}
		// RS attributes
		if ( $this->plane !== null ) {
			$attrs['data-plane'] = $this->plane;
		}
		// RS attributes
		if ( $this->mapVersion !== null ) {
			$attrs['data-mapversion'] = $this->mapVersion;
		}
		// RS attributes
		if ( $this->plainTiles !== null) {
			$attrs['data-plaintiles'] = $this->plainTiles;
		}

		$style = $this->extractMarkerCss();
		if ( $style ) {
			$attrs['class'] .= ' mw-kartographer-autostyled';
			$attrs['style'] = $style;
		}
		if ( $this->cssClass !== '' ) {
			$attrs['class'] .= ' ' . $this->cssClass;
		}
		if ( $this->showGroups ) {
			$attrs['data-overlays'] = FormatJson::encode( $this->showGroups, false,
				FormatJson::ALL_OK );
		}

		return Html::rawElement( 'a', $attrs, $text );
	}

	/**
	 * Extracts CSS style to be used by the link from GeoJSON
	 * @return string
	 */
	private function extractMarkerCss() {
		global $wgKartographerUseMarkerStyle;

		if ( $wgKartographerUseMarkerStyle
			&& $this->markerProperties
			&& property_exists( $this->markerProperties, 'marker-color' )
		) {
			// JsonSchema already validates this value for us, however this regex will also fail
			// if the color is invalid
			preg_match( '/^#?(([0-9a-fA-F]{3}){1,2})$/', $this->markerProperties->{'marker-color'}, $m );
			if ( $m && $m[2] ) {
				return "background: #{$m[1]};";
			}
		}

		return '';
	}
}
