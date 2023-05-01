<?php

namespace Kartographer;

use MediaWiki\MediaWikiServices;
use Kartographer\Projection\Simple;

/**
 * Handles static versions of maps for Runescape
 */
class RsStaticMap {

	const TILE_SIZE = 256;
	const MAX_BOUNDS = [[0, 12800], [0, 12800]];
	const ZOOM_RANGE = [-3, 5];

	/** @var array */
	protected $mapsConfig;

	/** @var string */
	protected $mapVersion;

	/** @var string */
	protected $tileURL;

	public function __construct( $name = 'Map' ) {
		$this->mapsConfig =  MediaWikiServices::getInstance()
			->getMainConfig()
			->get( 'KartographerDataConfig' );

		$vers = $this->mapsConfig['mapVersion'];
		if ( !wfMessage( 'kartographer-map-version' )->isDisabled() ) {
			$vers = wfMessage( 'kartographer-map-version' )->plain();
		}
		$this->mapVersion = $vers;

		$tileUrl = $this->mapsConfig['baseTileURL'] . $this->mapsConfig['tileURLFormat'];
		$this->tileURL = str_replace('{mapVersion}', $this->mapVersion, $tileUrl);
	}

	private function getTileUrl( $mapid, $zoom, $plane, $x, $y ) {
		$invY = $y;
		$vars = ['{mapID}', '{z}', '{p}', '{x}', '{y}', '{-y}'];
		$args = [ $mapid, $zoom, $plane, $x, $y, $invY ];
		$url = $this->tileURL;
		$url = str_replace($vars, $args, $url);
		return $url;
	}

	public function getMap( $mapid, $zoom, $plane, $center, $size ) {
		$mapid = $mapid ?? '-1';
		$plane = $plane ?? 0;

		if ( !is_array($center) || !is_numeric($center[0]) || !is_numeric($center[1]) ) {
			$center = [3200, 3200]; // Lumbridge
		}
		if ( !isset($zoom) || $zoom < self::ZOOM_RANGE[0] || $zoom > self::ZOOM_RANGE[1] ) {
			$zoom = 1;
		}

		// Map dimension in game tiles
		$map_size = Simple::pointToLonLat( $size, $zoom );
		// Coords for corners
		$corner_low = [ $center[0] - ($map_size[0] / 2), $center[1] - ($map_size[1] / 2) ];
		$corner_high = [ $center[0] + ($map_size[0] / 2), $center[1] + ($map_size[1] / 2) ];
		// Map tile size in game squares
		$tile_size = Simple::pointToLonLat( [self::TILE_SIZE, self::TILE_SIZE], $zoom );
		// Low tile
		$tile_low = [ floor( $corner_low[0] / $tile_size[0] ), floor( $corner_low[1] / $tile_size[1] ) ];
		// High tile
		$tile_high = [ floor( $corner_high[0] / $tile_size[0] ), floor( $corner_high[1] / $tile_size[1] ) ];
		// Offset for tiles
		$init_offset = [ $corner_low[0] - ($tile_low[0] * $tile_size[0]), $corner_high[1] - ($tile_high[1] * $tile_size[1]) ];
		$init_px = Simple::LonLatToPoint( $init_offset, $zoom );
		$init_px[0] = -$init_px[0];
		$init_px[1] = $init_px[1] - self::TILE_SIZE;

		$bg_images = [];
		$bg_pos = [];
		$y_count = 0;
		for ($y = $tile_high[1]; $y >= $tile_low[1]; $y--) {
			$y_off = $init_px[1] + ($y_count * self::TILE_SIZE);
			$y_count++;
			$x_count = 0;
			for ($x = $tile_low[0]; $x <= $tile_high[0]; $x++) {
				$x_off = $init_px[0] + ($x_count * self::TILE_SIZE);
				$x_count++;
				$tileUrl = $this->getTileUrl( $mapid, $zoom, $plane, $x, $y );

				$bg_images[] = "url({$tileUrl })";
				$bg_pos[] = "{$x_off}px {$y_off}px";
			}
		}

		return array(
			"background-image" => implode(", ", $bg_images),
			"background-position" => implode(", ", $bg_pos),
			"background-repeat" => "no-repeat",
		);
	}
}