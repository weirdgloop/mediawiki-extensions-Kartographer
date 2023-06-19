<?php

namespace Kartographer\Tag;

use FormatJson;
use Html;
use Kartographer\RsStaticMap;


/**
 * The <mapframe> tag inserts a map into wiki page
 */
class MapFrame extends TagHandler {

	private const ALIGN_CLASSES = [
		'left' => 'floatleft',
		'center' => 'center',
		'right' => 'floatright',
		'none' => '',
	];
	private const THUMB_ALIGN_CLASSES = [
		'left' => 'tleft',
		'center' => 'tnone center',
		'right' => 'tright',
		'none' => 'tnone',
	];

	public const TAG = 'mapframe';

	/** @var int|string either a number of pixels, a percentage (e.g. "100%"), or "full" */
	private $width;
	/** @var int */
	private $height;
	/** @var string One of "left", "center", "right", or "none" */
	private $align;

	/**
	 * @inheritDoc
	 */
	protected function parseArgs(): void {
		parent::parseArgs();
		$this->state->useMapframe();
		// @todo: should these have defaults?
		$this->width = $this->getText( 'width', false, '/^(\d+|([1-9]\d?|100)%|full)$/' );
		$this->height = $this->getInt( 'height' );
		$defaultAlign = $this->getLanguage()->isRTL() ? 'left' : 'right';
		$this->align = $this->getText( 'align', $defaultAlign, '/^(left|center|right)$/' );
	}

	/**
	 * @return string
	 */
	protected function render(): string {
		$caption = (string)$this->getText( 'text', '' );
		$framed = $caption !== '' || $this->getText( 'frameless', null ) === null;

		$parserOutput = $this->parser->getOutput();
		$options = $this->parser->getOptions();

		$width = is_numeric( $this->width ) ? "{$this->width}px" : $this->width;
		$staticWidth = (int)$this->width;
		$fullWidth = false;
		if ( preg_match( '/^\d+%$/', $width ) ) {
			if ( $width === '100%' ) {
				$fullWidth = true;
				$staticWidth = 800;
				$this->align = 'none';
			} else {
				// @todo: deprecate old syntax completely
				$width = '300px';
				$this->width = 300;
				$staticWidth = 300;
			}
		} elseif ( $width === 'full' ) {
			$width = '100%';
			$this->align = 'none';
			$fullWidth = true;
			$staticWidth = 800;
		}
		// TODO if fullwidth, we really should use interactive mode..
		// BUT not possible to use both modes at the same time right now. T248023
		// Should be fixed, especially considering VE in page editing etc...

		$parserOutput->addModules( [ 'ext.kartographer.frame' ] );

		$attrs = [
			'class' => 'mw-kartographer-map',
			// We need dimensions for when there is no img (editpreview or no staticmap)
			// because an <img> element with permanent failing src has either:
			// - intrinsic dimensions of 0x0, when alt=''
			// - intrinsic dimensions of alt size
			'style' => "width: {$width}; height: {$this->height}px;",
			'data-mw' => 'interface',
			'data-width' => $this->width,
			'data-height' => $this->height,
		];
		if ( $this->zoom !== null ) {
			$staticZoom = $this->zoom;
			$attrs['data-zoom'] = $this->zoom;
		} else {
			$staticZoom = 1;
			$attrs['data-zoom'] = 1;
		}

		if ( $this->lat !== null && $this->lon !== null ) {
			$attrs['data-lat'] = $this->lat;
			$attrs['data-lon'] = $this->lon;
			$staticLat = $this->lat;
			$staticLon = $this->lon;
		} else {
			// For RS, default is Lumbridge
			$attrs['data-lat'] = 3200;
			$attrs['data-lon'] = 3200;
			$staticLat = 3200;
			$staticLon = 3200;
		}

		// RS attributes
		if ( $this->mapid !== null ) {
			$staticMapID = $this->mapid;
			$attrs['data-mapid'] = $this->mapid;
		} else {
			$staticMapID = -1;
		}

		// RS attributes
		if ( $this->plane !== null ) {
			$staticPlane = $this->plane;
			$attrs['data-plane'] = $this->plane;
		} else {
			$staticPlane = 0;
		}

		// RS attributes
		if ( $this->mapVersion !== null) {
			$attrs['data-mapversion'] = $this->mapVersion;
		}

		// RS attributes
		if ( $this->plainTiles !== null) {
			$attrs['data-plaintiles'] = $this->plainTiles;
		}

		if ( $this->specifiedLangCode !== null ) {
			$attrs['data-lang'] = $this->specifiedLangCode;
		}

		if ( $this->showGroups ) {
			$attrs['data-overlays'] = FormatJson::encode( $this->showGroups, false,
				FormatJson::ALL_OK );
			$this->state->addInteractiveGroups( $this->showGroups );
		}

		$containerClass = 'mw-kartographer-container';
		if ( $fullWidth ) {
			$containerClass .= ' mw-kartographer-full';
		}

		// Get the static initial background
		$rsmap = new RsStaticMap();
		$bgProps = $rsmap->getMap( (string)$staticMapID, $staticZoom, $staticPlane, [$staticLon, $staticLat], [$staticWidth, (int)$this->height] );
		$bgStyle = [];
		foreach ($bgProps as $key => $val) {
			if ( !empty($val) ) {
				$bgStyle[] = $key . ': ' . $val . ';';
			}
		}

		$attrs['style'] .= implode(' ', $bgStyle);

		if ( !$framed ) {
			wfDebugLog("grs", "frame");
			$attrs['class'] .= ' ' . $containerClass . ' ' . self::ALIGN_CLASSES[$this->align];
			return Html::rawElement( 'a', $attrs );
		}

		$containerClass .= ' thumb ' . self::THUMB_ALIGN_CLASSES[$this->align];

		$html = Html::rawElement( 'a', $attrs, );

		if ( $caption !== '' ) {
			$html .= Html::rawElement( 'div', [ 'class' => 'thumbcaption' ],
				$this->parser->recursiveTagParse( $caption ) );
		}

		return Html::rawElement( 'div', [ 'class' => $containerClass ],
			Html::rawElement( 'div', [
					'class' => 'thumbinner',
					'style' => "width: {$width};",
				], $html ) );
	}
}
