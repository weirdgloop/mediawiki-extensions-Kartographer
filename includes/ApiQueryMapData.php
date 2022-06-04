<?php

namespace Kartographer;

use ApiBase;
use ApiQuery;
use ApiQueryBase;
use FormatJson;
use MediaWiki\Page\WikiPageFactory;
use ParserOptions;
use Wikimedia\ParamValidator\ParamValidator;
use Wikimedia\ParamValidator\TypeDef\IntegerDef;

class ApiQueryMapData extends ApiQueryBase {

	/** @var WikiPageFactory */
	private $pageFactory;

	/**
	 * @param ApiQuery $query
	 * @param string $moduleName
	 * @param WikiPageFactory $pageFactory
	 */
	public function __construct( ApiQuery $query, $moduleName,
		WikiPageFactory $pageFactory
	) {
		parent::__construct( $query, $moduleName, 'mpd' );
		$this->pageFactory = $pageFactory;
	}

	/**
	 * @inheritDoc
	 */
	public function execute() {
		$params = $this->extractRequestParams();
		$limit = $params['limit'];
		$groupIds = $params['groups'] === '' ? false : explode( '|', $params['groups'] );
		$titles = $this->getPageSet()->getGoodPages();
		if ( !$titles ) {
			return;
		}

		$count = 0;
		foreach ( $titles as $pageId => $title ) {
			if ( ++$count > $limit ) {
				$this->setContinueEnumParameter( 'continue', $pageId );
				break;
			}

			$page = $this->pageFactory->newFromTitle( $title );
			$parserOutput = $page->getParserOutput( ParserOptions::newFromAnon() );
			$state = $parserOutput ? State::getState( $parserOutput ) : null;
			if ( !$state ) {
				continue;
			}
			$data = $state->getData();

			$result = [];
			if ( $groupIds ) {
				foreach ( $groupIds as $groupId ) {
					if ( array_key_exists( $groupId, $data ) ) {
						$result[$groupId] = $data[$groupId];
					} else {
						// Let the client know there is no data found for this group
						$result[$groupId] = null;
					}
				}
			} else {
				$result = $data;
			}
			$this->normalizeGeoJson( $result );
			$result = FormatJson::encode( $result, false, FormatJson::ALL_OK );

			$fit = $this->addPageSubItem( $pageId, $result );
			if ( !$fit ) {
				$this->setContinueEnumParameter( 'continue', $pageId );
			}
		}
	}

	/**
	 * ExtensionData are stored as serialized JSON strings and deserialized with
	 * {@see FormatJson::FORCE_ASSOC} set, see {@see JsonCodec::unserialize}. This means empty
	 * objects are serialized as "{}" but deserialized as empty arrays. We need to revert this.
	 * Luckily we know everything about the data that can end here: thanks to
	 * {@see SimpleStyleParser} it's guaranteed to be valid GeoJSON.
	 *
	 * @param array &$data
	 */
	private function normalizeGeoJson( array &$data ): void {
		foreach ( $data as $key => &$value ) {
			// Properties that must be objects according to schemas/geojson.json
			if ( $value === [] && ( $key === 'geometry' || $key === 'properties' ) ) {
				$value = (object)[];
			} elseif ( is_array( $value ) ) {
				// Note: No need to dive deeper when objects are deserialized as objects.
				$this->normalizeGeoJson( $value );
			}
		}
	}

	/**
	 * @inheritDoc
	 */
	public function getAllowedParams() {
		return [
			'groups' => [
				ParamValidator::PARAM_TYPE => 'string',
				ParamValidator::PARAM_DEFAULT => '',
			],
			'limit' => [
				ParamValidator::PARAM_TYPE => 'limit',
				ParamValidator::PARAM_DEFAULT => 10,
				IntegerDef::PARAM_MIN => 1,
				IntegerDef::PARAM_MAX => ApiBase::LIMIT_BIG1,
				IntegerDef::PARAM_MAX2 => ApiBase::LIMIT_BIG2
			],
			'continue' => [
				ParamValidator::PARAM_TYPE => 'integer',
				ApiBase::PARAM_HELP_MSG => 'api-help-param-continue',
			],
		];
	}

	/**
	 * @inheritDoc
	 */
	public function getExamplesMessages() {
		return [
			'action=query&prop=mapdata&titles=Metallica' => 'apihelp-query+mapdata-example-1',
			'action=query&prop=mapdata&titles=Metallica&mpdgroups=group1|group2'
				=> 'apihelp-query+mapdata-example-2',
		];
	}

	/**
	 * @inheritDoc
	 */
	public function getCacheMode( $params ) {
		return 'public';
	}

	/**
	 * @inheritDoc
	 */
	public function isInternal() {
		return true;
	}
}
