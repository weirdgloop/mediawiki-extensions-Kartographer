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

	/** @var array */
	protected $baseMaps;

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

		$this->getMapData();
		$tileUrl = $this->mapsConfig['baseTileURL'] . $this->mapsConfig['tileURLFormat'];
		$this->tileURL = str_replace('{mapVersion}', $this->mapVersion, $tileUrl);
	}

	private function getMapData() {
		$cache = MediaWikiServices::getInstance()->getMainWANObjectCache();
		$url = $this->mapsConfig['baseMapsFile'];
		$url = str_replace('{mapVersion}', $this->mapVersion, $url);

		$this->baseMaps = $cache->getWithSetCallback(
			$cache->makeKey(
				'Kartographer',
				'basemaps'
			),
			3600, // 1 hour cache time since this shouldn't change often.
			function () use ( $url ) {
				// Default to no baseMaps incase of errors fetching or decoding basemaps.json.
				$baseMaps = false;
				$json = false;

				$json = MediaWikiServices::getInstance()->getHttpRequestFactory()->get( $url, [], __METHOD__ );

				if ( $json ) {
					$obj = json_decode($json, true);

					if ( $obj !== null ) {
						$data = [];
						foreach ( $obj as $map ) {
							$data[ (string)$map['mapId'] ] = $map;
						}

						if ( !empty($data) ) {
							$baseMaps = $data;
						}
					}
				}
				return $baseMaps;
			}
		);
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
		if ( !isset($this->baseMaps[$mapid]) ) {
			$mapid = '-1';
		}
		$mapData = $this->baseMaps[$mapid] ?? [];

		if ( !is_array($center) || !$this->coordinatesAreValid( $center[0], $center[1], $mapid ) ) {
			$center = $mapData['center'] ?? [3200, 3200]; // Lumbridge
		}
		if ( !isset($plane) || $plane < 0 ) {
			$plane = $mapData['defaultPlane'] ?? 0;
		}
		if ( !isset($zoom) || $zoom < self::ZOOM_RANGE[0] || $zoom > self::ZOOM_RANGE[1] ) {
			$zoom = 2;
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

	public function coordinatesAreValid( $lon, $lat, $mapid = null ) {
		if ( $this->baseMaps && $mapid != null ) {
			if ( !isset($this->baseMaps[$mapid]) ) {
				return false;
			}

			$map = $this->baseMaps[$mapid];
			if ( $lon > $map['bounds'][1][0] || $lon < $map['bounds'][0][0] || $lat > $map['bounds'][1][1] || $lat < $map['bounds'][0][1] ) {
				return false;
			}
		}

		// Fall back too absolute RS map bounds
		if ( $lon > self::MAX_BOUNDS[0][1] || $lon < self::MAX_BOUNDS[0][0] || $lat > self::MAX_BOUNDS[1][1] || $lat < self::MAX_BOUNDS[1][0] ) {
			return false;
		}

		return true;
	}

	public function mapIdIsValid( $mapid ) {
		if ( isset($this->baseMaps[$mapid]) ) {
			return true;
		}
		return false;
	}

	public function getDefaultPlane( $mapid = '-1' ) {
		if ( isset($this->baseMaps[$mapid]) ) {
			$map = $this->baseMaps[$mapid];
			if ( isset($map['defaultPlane']) ) {
				return $map['defaultPlane'];
			}
		}
		return 0;
	}

	public function getName( $mapid = '-1' ) {
		if ( isset($this->baseMaps[$mapid]) ) {
			$map = $this->baseMaps[$mapid];
			if ( isset($map['name']) ) {
				return $map['name'];
			}
		}
		return 'unknown';
	}

	public function getCenter( $mapid = '-1' ) {
		if ( isset($this->baseMaps[$mapid]) ) {
			$map = $this->baseMaps[$mapid];
			if ( isset($map['center']) ) {
				return $map['center'];
			}
		}
		return [3200, 3200];
	}
}