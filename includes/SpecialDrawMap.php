<?php

namespace Kartographer;

use Html;
use Kartographer\RsStaticMap;
use SpecialPage;
use Title;

/**
 * Special page that provides a helper for generating complex geoJSON to use with map
 * tags, or to generate the code for use in map modules. If js is disabled or doesn't
 * load it displays a world map for the given (or the default) location.
 * The map will try to load the given location if one is provided via url.
 * URL format: Special:DrawMap/<mapid>/<zoom>/<plane>/<Xlon>/<Ylat>
 */
class SpecialDrawMap extends SpecialPage {
	/** @var RsStaticMap */
	private $rsmap;
	/**
	 * @param string $name
	 */
	public function __construct( $name = 'DrawMap' ) {
		parent::__construct( $name, /* $restriction */ '', /* $listed */ true );
		$this->rsmap = new RsStaticMap();
	}

	/**
	 * @inheritDoc
	 */
	public function getGroupName() {
		return 'wiki';
	}

	/**
	 * @inheritDoc
	 */
	public function execute( $par ) {
		$this->setHeaders();
		$output = $this->getOutput();
		$output->addModuleStyles( 'ext.kartographer.specialDrawMap' );
		$output->addModules( 'ext.kartographer.drawmap' );
		$output->getCSP()->addDefaultSrc( $this->getConfig()->get( 'KartographerMapServer' ) );

		$coord = $this->parseSubpage( $par );
		$mapid = -1;
		$zoom = 1;
		$plane = 0;
		$lon = 3200;
		$lat = 3200;
		$coordText = '';

		if ( $coord ) {
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
			} else {
				$coordText = $this->msg( 'kartographer-specialmap-invalid-coordinates' )->text();
				if ( !$this->rsmap->mapIdIsValid( (string)$mapid ) ) {
					$mapid = -1;
				}
				$mapcenter = $this->rsmap->getCenter( (string)$mapid );
				$lon = $mapcenter[0];
				$lat = $mapcenter[1];
			}
		}

		$mapname = $this->rsmap->getName( (string)$mapid );

		$attributions = Html::rawElement( 'div', [ 'id' => 'mw-specialDrawMap-attributions' ],
			$this->msg( 'kartographer-attribution' )->title( $this->getPageTitle() )->parse() );

		$addinfo = Html::rawElement( 'p', [ 'id' => 'mw-specialDrawMap-addinfo' ],
			$this->msg( 'kartographer-map-addinfo' )->params( $mapid, $mapname, $zoom, $plane )->parse() );

		// Size is defined in ../styless/specialDrawMap.less
		$map_background = $this->rsmap->getMap( (string)$mapid, $zoom, $plane, [$lon, $lat], [256, 256] );
		$map_style = [];
		foreach ($map_background as $key => $val) {
			if ( !empty($val) ) {
				$map_style[] = $key . ': ' . $val . ';';
			}
		}

		$container_attr = [
			'id' => 'mw-specialDrawMap-container',
			'class' => 'thumb',
			'data-mapid' => $mapid,
			'data-zoom' => $zoom,
			'data-plane' => $plane,
			'data-lon' => $lon,
			'data-lat' => $lat,
		];

		$special_note = $this->msg( 'kartographer-specialdrawmap-urlnote' )->parse();
		$js_note = $this->msg( 'kartographer-specialdrawmap-jsnote' )->parse();

		$this->getOutput()->addHTML(
			Html::rawElement( 'p', [ 'id' => 'mw-specialDrawMap-note' ], $special_note )
			. Html::openElement( 'div', $container_attr )
				. Html::openElement( 'div', [ 'class' => 'thumbinner' ] )
					. Html::openElement( 'div', [ 'id' => 'mw-specialDrawMap-inner' ] )
						. Html::element( 'div', [ 'id' => 'mw-specialDrawMap-map', 'style' => implode(' ', $map_style) ] )
						. $attributions
					. Html::closeElement( 'div' )
					. Html::openElement( 'div',
						[ 'id' => 'mw-specialDrawMap-caption', 'class' => 'thumbcaption' ]
					)
						. Html::element( 'strong', [ 'id' => 'mw-specialDrawMap-jsnote' ], $js_note )
						. Html::rawElement( 'br' )
						. Html::element( 'span', [ 'id' => 'mw-specialDrawMap-coords' ], $coordText )
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
	 * @return array|false
	 */
	private function parseSubpage( $par ) {
		if ( !preg_match(
				'#^(?<mapid>-*\d+)/(?<zoom>-*\d+)/(?<plane>-*\d+)/(?<lon>-?\d+(\.\d+)?)/(?<lat>-?\d+(\.\d+)?)$#',
				$par,
				$matches
			)
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
	 * @param int $mapid
	 * @param int $plane
	 * @param int $zoom
	 * @param string $lang Optional language code. Defaults to 'local'
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
		return SpecialPage::getTitleFor( 'DrawMap', "$mapid/$zoom/$plane/$lon/$lat" );
	}
}
