<?php

namespace Kartographer;

use Language;

/**
 * Formats coordinates into human-readable strings
 */
class CoordFormatter {
	/**
	 * Formats coordinates
	 *
	 * @param float $lat
	 * @param float $lon
	 * @param Language $language
	 * @return string
	 */
	public static function format( $lat, $lon, Language $language ) {
		$latStr = self::formatOneCoord( $lat, 'lat', $language );
		$lonStr = self::formatOneCoord( $lon, 'lon', $language );

		return wfMessage( 'kartographer-coord-combined' )
			->params( $latStr, $lonStr )
			->inLanguage( $language )
			->plain();
	}

	/**
	 * @param float $coord
	 * @param string $latLon 'lat' or 'lon'
	 * @param Language $language
	 * @return string
	 */
	private static function formatOneCoord( $coord, $latLon, Language $language ) {
		$val = $sign = round( $coord * 3600 );
		$val = abs( $val );
		$degrees = floor( $val / 3600 );
		$minutes = floor( ( $val - $degrees * 3600 ) / 60 );
		$seconds = $val - $degrees * 3600 - $minutes * 60;
		$plusMinus = $sign < 0 ? 'negative' : 'positive';
		$text = wfMessage( 'kartographer-coord-dms' )
			->numParams( $degrees, $minutes, round( $seconds ) )
			->inLanguage( $language )
			->plain();

		return wfMessage( "kartographer-coord-$latLon-$plusMinus" )
			->params( $text )
			->inLanguage( $language )
			->plain();
	}

	/**
	 * Formats coordinates as a decimal
	 *
	 * @param float $lat
	 * @param float $lon
	 * @param Language $language
	 * @return string
	 */
	public static function formatDecimal( $lat, $lon, Language $language ) {
		$latStr = self::formatOneCoordDecimal( $lat, 'lat', $language );
		$lonStr = self::formatOneCoordDecimal( $lon, 'lon', $language );

		return wfMessage( 'kartographer-coord-combined' )
			->params( $latStr, $lonStr )
			->inLanguage( $language )
			->plain();
	}

	/**
	 * @param float $coord
	 * @param string $latLon 'lat' or 'lon'
	 * @param Language $language
	 * @return string
	 */
	private static function formatOneCoordDecimal( $coord, $latLon, Language $language ) {
		$integ = floor( $coord );
		$decim = round( ($coord - $integ) * 100 );
		$text = wfMessage( 'kartographer-coord-decimal' )
			->params( $integ, $decim )
			->inLanguage( $language )
			->plain();

		return wfMessage( "kartographer-coord-$latLon-decimal" )
			->params( $text )
			->inLanguage( $language )
			->plain();
	}
}
