<?php

namespace Kartographer;

use Html;
use SpecialPage;
use Title;
use Kartographer\RsStaticMap;

/**
 * Special page that works as a fallback destination for non-JS users
 * who click on map links. It displays a world map with a dot for the given location.
 * URL format: Special:Map/<mapid>/<zoom>/<plane>/<Xlon>/<Ylat>
 * Zoom isn't used anywhere yet.
 */
class SpecialMap extends SpecialPage {
	/** @var RsStaticMap */
	private $rsmap;

	public function __construct( $name = 'Map' ) {
		parent::__construct( $name, /* $restriction */ '', /* $listed */ false );
		$this->rsmap = new RsStaticMap();
	}

	public function execute( $par ) {
		$this->setHeaders();
		$this->getOutput()->addModuleStyles( 'ext.kartographer.specialMap' );

		$coord = self::parseSubpage( $par );
		$mapid = -1;
		$zoom = 1;
		$plane = 0;
		$lon = 3200;
		$lat = 3200;
		if ( !$coord ) {
			$coordText = $this->msg( 'kartographer-specialmap-invalid-coordinates' )->text();
			$markerHtml = '';
		} else {
			list( $mapid, $zoom, $plane, $lon, $lat ) = $coord;
			// Auto set plane by mapid if negative
			if ($plane < 0) {
				$plane = $this->rsmap->getDefaultPlane( (string)$mapid );
			}

			// Validate coords by mapid
			if ( $this->rsmap->coordinatesAreValid( $lon, $lat, (string)$mapid ) ) {
				$coordText = CoordFormatter::formatDecimal( $lat, $lon, $this->getLanguage() );
				$x = 128;
				$y = 128;
				$markerHtml = Html::element( 'div',
					[
						'id' => 'mw-specialMap-marker',
						'style' => "left:{$x}px; top:{$y}px;"
					]
				);
			} else {
				$coordText = $this->msg( 'kartographer-specialmap-invalid-coordinates' )->text();
				$markerHtml = '';
				if ( !$this->rsmap->mapIdIsValid( (string)$mapid ) ) {
					$mapid = -1;
				}
				$mapcenter = $this->rsmap->getCenter( (string)$mapid );
				$lon = $mapcenter[0];
				$lat = $mapcenter[1];
			}
		}

		$mapname = $this->rsmap->getName( (string)$mapid );

		$attributions = Html::rawElement( 'div', [ 'id' => 'mw-specialMap-attributions' ],
			$this->msg( 'kartographer-attribution' )->title( $this->getPageTitle() )->parse() );
		$addinfo = Html::rawElement( 'p', [ 'id' => 'mw-specialMap-addinfo' ],
			$this->msg( 'kartographer-map-addinfo' )->params( $mapid, $mapname, $zoom, $plane )->parse() );

		// Size is defined in ../styless/specialMap.less
		$map_background = $this->rsmap->getMap( (string)$mapid, $zoom, $plane, [$lon, $lat], [256, 256] );
		$map_style = [];
		foreach ($map_background as $key => $val) {
			if ( !empty($val) ) {
				$map_style[] = $key . ': ' . $val . ';';
			}
		}

		$special_note = $this->msg( 'kartographer-specialmap-note' )->parse();

		$this->getOutput()->addHTML(
			Html::rawElement( 'p', [ 'id' => 'mw-specialMap-note' ], $special_note )
			. Html::openElement( 'div', [ 'id' => 'mw-specialMap-container', 'class' => 'thumb' ] )
				. Html::openElement( 'div', [ 'class' => 'thumbinner' ] )
					. Html::openElement( 'div', [ 'id' => 'mw-specialMap-inner' ] )
						. Html::element( 'div', [ 'id' => 'mw-specialMap-map', 'style' => implode(' ', $map_style) ] )
						. $markerHtml
						. $attributions
					. Html::closeElement( 'div' )
					. Html::openElement( 'div',
						[ 'id' => 'mw-specialMap-caption', 'class' => 'thumbcaption' ]
					)
						. Html::element( 'span', [ 'id' => 'mw-specialMap-icon' ] )
						. Html::element( 'span', [ 'id' => 'mw-specialMap-coords' ], $coordText )
						. $addinfo
					. Html::closeElement( 'div' )
				. Html::closeElement( 'div' )
			. Html::closeElement( 'div' )
		);
	}

	/**
	 * Parses subpage parameter to this special page into zoom / lat /lon
	 *
	 * @param string $par
	 * @return array|bool
	 */
	public static function parseSubpage( $par ) {
		if ( !preg_match(
			'#^(?<mapid>-*\d+)/(?<zoom>-*\d+)/(?<plane>-*\d+)/(?<lon>-?\d+(\.\d+)?)/(?<lat>-?\d+(\.\d+)?)$#', $par, $matches )
		) {
			return false;
		}

		// Max bounds for RS are in RsStaticMap
		if ( $matches['lon'] > RsStaticMap::MAX_BOUNDS[0][1] || $matches['lon'] < RsStaticMap::MAX_BOUNDS[0][0]
			|| $matches['lat'] > RsStaticMap::MAX_BOUNDS[1][1] || $matches['lat'] < RsStaticMap::MAX_BOUNDS[1][0] ) {
			return false;
		}

		// Zoom also defined in RsStaticMap
		if ( $matches['zoom'] > RsStaticMap::ZOOM_RANGE[1] || $matches['zoom'] < RsStaticMap::ZOOM_RANGE[0] ) {
			return false;
		}

		return [ (int)$matches['mapid'], (int)$matches['zoom'], (int)$matches['plane'], (float)$matches['lon'], (float)$matches['lat'] ];
	}

	/**
	 * Returns a Title for a link to the coordinates provided
	 *
	 * @param float $lat
	 * @param float $lon
	 * @param int $zoom
	 * @param int $mapid
	 * @param int $plane
	 * @return Title
	 */
	public static function link( $lon = 3200, $lat = 3200, $zoom = 1, $mapid = -1, $plane = -1 ) {
		if ($lat == null || $lon == null) {
			$lat = 3200;
			$lon = 3200;
		}
		if ($zoom == null) $zoom = 1;
		if ($mapid == null) $mapid = -1;
		if ($plane == null) $plane = -1; // -1 auto sets plane by mapid
		return SpecialPage::getTitleFor( 'Map', "$mapid/$zoom/$plane/$lon/$lat" );
	}
}
