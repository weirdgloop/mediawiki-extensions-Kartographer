<?php

namespace Kartographer\Tag;

use FormatJson;
use Html;
use Kartographer\CoordFormatter;

/**
 * The <maplink> tag creates a link that, when clicked,
 */
class MapLink extends TagHandler {

	public const TAG = 'maplink';

	/** @var string */
	private $cssClass = '';

	/**
	 * @inheritDoc
	 */
	protected function parseArgs(): void {
		$this->state->useMaplink();
		parent::parseArgs();
		$this->cssClass = $this->getText( 'class', '', '/^(|[a-zA-Z][-_a-zA-Z0-9]*)$/' );
	}

	/**
	 * @inheritDoc
	 */
	protected function render(): string {
		$parserOutput = $this->parser->getOutput();
		$parserOutput->addModules( [ 'ext.kartographer.link' ] );

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
			'data-mw' => 'interface',
		];

		if ( $this->zoom !== null ) {
			$attrs['data-zoom'] = $this->zoom;
		}
		if ( $this->lat !== null && $this->lon !== null ) {
			$attrs['data-lat'] = $this->lat;
			$attrs['data-lon'] = $this->lon;
		}
		if ( $this->specifiedLangCode !== null ) {
			$attrs['data-lang'] = $this->specifiedLangCode;
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

		if ( $this->cssClass !== '' ) {
			$attrs['class'] .= ' ' . $this->cssClass;
		}
		if ( $this->showGroups ) {
			$attrs['data-overlays'] = FormatJson::encode( $this->showGroups, false,
				FormatJson::ALL_OK );
		}
		return Html::rawElement( 'a', $attrs, $text );
	}
}
