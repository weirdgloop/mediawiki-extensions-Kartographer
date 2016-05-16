<?php
/**
 *
 * @license MIT
 * @file
 *
 * @author Yuri Astrakhan
 */

namespace Kartographer\Tag;

use Exception;
use FormatJson;
use Html;
use Kartographer\SimpleStyleParser;
use Language;
use Parser;
use ParserOutput;
use PPFrame;
use Sanitizer;
use Status;
use stdClass;

/**
 * Base class for all <map...> tags
 */
abstract class TagHandler {
	/** @var string */
	protected $tag;

	/** @var Status */
	protected $status;

	/** @var stdClass[] */
	protected $geometries = [];

	/** @var string[] */
	protected $args;

	/** @var float */
	protected $lat;

	/** @var float */
	protected $lon;

	/** @var int */
	protected $zoom;

	/** @var string */
	protected $mapStyle;

	/** @var string */
	protected $style = '';

	/** @var string name of the group, or null for private */
	protected $groupName;

	/** @var string[] list of groups to show */
	protected $showGroups = [];

	/** @var int|null */
	protected $counter = null;

	/** @var Parser */
	protected $parser;

	/** @var PPFrame */
	protected $frame;

	/** @var stdClass */
	protected $markerProperties;

	/**
	 * @return stdClass[]
	 */
	public function getGeometries() {
		return $this->geometries;
	}

	/**
	 * @return Status
	 */
	public function getStatus() {
		return $this->status;
	}

	/**
	 * Entry point for all tags
	 *
	 * @param $input
	 * @param array $args
	 * @param Parser $parser
	 * @param PPFrame $frame
	 * @return string
	 */
	public static function entryPoint( $input, array $args, Parser $parser, PPFrame $frame ) {
		$handler = new static();

		return $handler->handle( $input, $args, $parser, $frame );
	}

	/**
	 * @param string $input
	 * @param array $args
	 * @param Parser $parser
	 * @param PPFrame $frame
	 * @return string
	 */
	private final function handle( $input, array $args, Parser $parser, PPFrame $frame ) {
		$this->parser = $parser;
		$this->frame = $frame;
		$output = $parser->getOutput();
		$output->addModuleStyles( 'ext.kartographer.style' );

		$this->status = Status::newGood();
		$this->args = $args;

		$this->parseGeometries( $input, $parser, $frame );
		$this->parseGroups();
		$this->parseArgs();

		if ( !$this->status->isGood() ) {
			return $this->reportError();
		}

		$this->saveData( $output );

		$output->setExtensionData( 'kartographer_valid', true );

		return $this->render();
	}

	/**
	 * Parses and sanitizes GeoJSON+simplestyle contained inside of tags
	 *
	 * @param $input
	 * @param Parser $parser
	 * @param PPFrame $frame
	 */
	protected function parseGeometries( $input, Parser $parser, PPFrame $frame ) {
		$simpleStyle = new SimpleStyleParser( $parser, $frame );

		$this->status = $simpleStyle->parse( $input );
		if ( $this->status->isOK() ) {
			$this->geometries = $this->status->getValue();
		}
	}

	/**
	 * Parses tag attributes in $this->args
	 * @return void
	 */
	protected function parseArgs() {
		global $wgKartographerStyles, $wgKartographerDfltStyle;

		$this->lat = $this->getFloat( 'latitude' );
		$this->lon = $this->getFloat( 'longitude' );
		$this->zoom = $this->getInt( 'zoom' );
		$regexp = '/^(' . implode( '|', $wgKartographerStyles ) . ')$/';
		$this->mapStyle = $this->getText( 'mapstyle', $wgKartographerDfltStyle, $regexp );
		$this->style = Sanitizer::checkCss( trim( $this->getText( 'style', '' ) ) );
	}

	/**
	 * Returns default HTML attributes of the outermost tag of the output
	 * @param string $extraStyle
	 * @return string[]
	 */
	protected function getDefaultAttributes( $extraStyle = '' ) {
		$attrs = [ 'class' => 'mw-kartographer', 'mw-data' => 'interface' ];
		$style = trim( "{$extraStyle} {$this->style}" );
		if ( $style ) {
			$attrs['style'] = $style;
		}
		return $attrs;
	}

	/**
	 * When overridden in a descendant class, returns tag HTML
	 * @return string
	 */
	protected abstract function render();

	private function parseGroups() {
		global $wgKartographerWikivoyageMode;

		if ( !$wgKartographerWikivoyageMode ) {
			// if we ignore all the 'group' and 'show' parameters,
			// each tag stays private, and will be unable to share data
			return;
		}

		$this->groupName = $this->getText( 'group', null, '/^[a-zA-Z0-9]+$/' );

		$text = $this->getText( 'show', null, '/^[a-zA-Z0-9]+(\s*,\s*[a-zA-Z0-9]+)*$/' );
		if ( $text !== null ) {
			$this->showGroups = array_map( 'trim', explode( ',', $text ) );
		}

		// Make sure the current group is shown for this map, even if there is no geojson
		// Private group will be added during the save, as it requires hash calculation
		if ( $this->groupName !== null ) {
			$this->showGroups[] = $this->groupName;
		}

		// Make sure there are no group name duplicates
		$this->showGroups = array_unique( $this->showGroups );
	}

	protected function getInt( $name, $default = false ) {
		$value = $this->getText( $name, $default, '/^-?[0-9]+$/' );
		if ( $value !== false ) {
			$value = intval( $value );
		}

		return $value;
	}

	/**
	 * @param $name
	 * @param bool $default
	 * @return float|string
	 */
	protected function getFloat( $name, $default = false ) {
		$value = $this->getText( $name, $default, '/^-?[0-9]*\.?[0-9]+$/' );
		if ( $value !== false ) {
			$value = floatval( $value );
		}

		return $value;
	}

	/**
	 * Returns value of a named tag attribute with optional validation
	 *
	 * @param string $name Attribute name
	 * @param string|bool $default Default value or false to trigger error if absent
	 * @param string|bool $regexp Regular expression to validate against or false to not validate
	 * @return string
	 */
	protected function getText( $name, $default, $regexp = false ) {
		if ( !isset( $this->args[$name] ) ) {
			if ( $default === false ) {
				$this->status->fatal( 'kartographer-error-missing-attr', $name );
			}
			return $default;
		}
		$value = trim( $this->args[$name] );
		if ( $regexp && !preg_match( $regexp, $value ) ) {
			$value = false;
			$this->status->fatal( 'kartographer-error-bad_attr', $name );
		}

		return $value;
	}


	protected function saveData( ParserOutput $output ) {
		if ( !$this->geometries ) {
			return;
		}

		// Merge existing data with the new tag's data under the same group name

		// For all GeoJSON items whose marker-symbol value begins with '-counter' and '-letter',
		// recursively replace them with an automatically incremented marker icon.
		$counters = $output->getExtensionData( 'kartographer_counters' ) ?: new stdClass();
		$marker = SimpleStyleParser::doCountersRecursive( $this->geometries, $counters );
		if ( $marker ) {
			list( $this->counter, $this->markerProperties ) = $marker;
		}
		$output->setExtensionData( 'kartographer_counters', $counters );

		if ( $this->groupName === null ) {
			$group = '_' . sha1( FormatJson::encode( $this->geometries, false, FormatJson::ALL_OK ) );
			$this->groupName = $group;
			$this->showGroups[] = $group;
			// no need to array_unique() because it's impossible to manually add a private group
		} else {
			$group = $this->groupName;
		}

		$data = $output->getExtensionData( 'kartographer_data' ) ?: new stdClass();
		if ( isset( $data->$group ) ) {
			$data->$group = array_merge( $data->$group, $this->geometries );
		} else {
			$data->$group = $this->geometries;
		}
		$output->setExtensionData( 'kartographer_data', $data );
	}

	/**
	 * Handles the last step of parse process
	 * @param Parser $parser
	 */
	public static function finalParseStep( Parser $parser ) {
		$output = $parser->getOutput();

		$data = $output->getExtensionData( 'kartographer_data' );
		if ( $data ) {
			$json = FormatJson::encode( $data, false, FormatJson::ALL_OK );
			$output->setProperty( 'kartographer', gzencode( $json ) );
		}

		if ( $output->getExtensionData( 'kartographer_broken' ) ) {
			$output->addTrackingCategory( 'kartographer-broken-category', $parser->getTitle() );
		}
		if ( $output->getExtensionData( 'kartographer_valid' ) ) {
			$output->addTrackingCategory( 'kartographer-tracking-category', $parser->getTitle() );
		}

		$interact = $output->getExtensionData( 'kartographer_interact' );
		if ( $interact ) {
			$interact = array_flip( array_unique( $interact ) );
			$liveData = array_intersect_key( (array)$data, $interact );
			$output->addJsConfigVars( 'wgKartographerLiveData', $liveData );
		}
	}

	/**
	 * @return string
	 * @throws Exception
	 */
	private function reportError() {
		$this->parser->getOutput()->setExtensionData( 'kartographer_broken', true );
		$errors = array_merge( $this->status->getErrorsByType( 'error' ),
			$this->status->getErrorsByType( 'warning' )
		);
		if ( !count( $errors ) ) {
			throw new Exception( __METHOD__ . '(): attempt to report error when none took place' );
		}
		$message = count( $errors ) > 1 ? 'kartographer-error-context-multi'
			: 'kartographer-error-context';
		// Status sucks, redoing a bunch of its code here
		$errorText = implode( "\n* ", array_map( function( array $err ) {
				return wfMessage( $err['message'] )
					->params( $err['params'] )
					->inLanguage( $this->getLanguage() )
					->plain();
			}, $errors ) );
		if ( count( $errors ) > 1 ) {
			$errorText = '* ' . $errorText;
		}
		return Html::rawElement( 'div', array( 'class' => 'mw-kartographer mw-kartographer-error' ),
			wfMessage( $message, $this->tag, $errorText )->inLanguage( $this->getLanguage() )->parse() );
	}

	/**
	 * @return Language
	 */
	protected function getLanguage() {
		return $this->parser->getTitle()->getPageLanguage();
	}
}
