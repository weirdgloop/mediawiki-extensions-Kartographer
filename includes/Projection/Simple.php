<?php

namespace Kartographer\Projection;

/**
 * Simple CRS equivalents
 *
 * Converted to PHP from L.CRS.Simple (leaflet.js)
 */
class Simple {

    /**
     * (lonLat) -> Point
     *
     * @param float[] $lonLat
     * @return float[]
     */
    public static function project( $lonLat ) {
        return $lonLat;
    }

    /**
     * (Point) -> lonLat
     *
     * @param float[] $point
     * @return array
     */
    public static function unproject( $point ) {
        return $point;
    }

    /**
     * (lonLat, Number) -> Point
     *
     * @param float[] $lonLat
     * @param int $zoom
     * @return array
     */
    public static function LonLatToPoint( $lonLat, $zoom ) {
        $scale = self::scale( $zoom );
        $projectedPoint = self::project( $lonLat );

        return self::transform( $projectedPoint, $scale );
    }

    /**
     * (Point, Number[, Boolean]) -> lonLat
     *
     * @param array $point
     * @param float $zoom
     * @return array
     */
    public static function pointToLonLat( $point, $zoom ) {
        $scale = self::scale( $zoom );
        $untransformedPoint = self::untransform( $point, $scale );

        return self::unproject( $untransformedPoint );
    }

    public static function scale( $zoom ) {
        return pow( 2, $zoom );
    }

    public static function getSize( $zoom ) {
        $size = self::scale( $zoom );

        return [ $size, $size ];
    }

    /**
     * (lonLat) -> Point
     *
     * @param float[] $point
     * @param int $scale
     * @return float[]
     */
    public static function transform( $point, $scale = 1 ) {
        $x = $point[0];
        $y = $point[1];

        $x = $scale * ( 1 * $x + 0 );
        $y = $scale * ( 1 * $y + 0 );

        return [ $x, $y ];
    }

    public static function untransform( $point, $scale = 1 ) {
        $x = $point[0];
        $y = $point[1];

        $x = ( $x / $scale - 0 ) / 1;
        $y = ( $y / $scale - 0 ) / 1;

        return [ $x, $y ];
    }
}