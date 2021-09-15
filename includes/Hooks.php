<?php
/**
 *
 * @license MIT
 * @file
 *
 * @author Yuri Astrakhan
 */

namespace Kartographer;

use Kartographer\Tag\TagHandler;
use MediaWiki\MediaWikiServices;
use Parser;
use ParserOutput;

class Hooks {
	// When [[MediaWiki:Kartographer-map-version]] is edited, clear the basemaps cache.
	public static function onPageContentSaveComplete( &$wikiPage, &$user, $content, $summary, $isMinor, $isWatch, $section, &$flags, $revision, &$status, $baseRevId, $undidRevId ) {
		if ( $wikiPage->getTitle()->getPrefixedDBkey() === 'MediaWiki:Kartographer-map-version' ) {
			$cache = MediaWikiServices::getInstance()->getMainWANObjectCache();

			$cache->delete(
				$cache->makeKey(
					'Kartographer',
					'basemaps'
				)
			);
		}

		return true;
	}

	/**
	 * ParserFirstCallInit hook handler
	 * @see https://www.mediawiki.org/wiki/Manual:Hooks/ParserFirstCallInit
	 * @param Parser $parser
	 * @return bool
	 */
	public static function onParserFirstCallInit( Parser $parser ) {
		global $wgKartographerEnableMapFrame;

		$parser->setHook( 'maplink', 'Kartographer\Tag\MapLink::entryPoint' );
		if ( $wgKartographerEnableMapFrame ) {
			$parser->setHook( 'mapframe', 'Kartographer\Tag\MapFrame::entryPoint' );
		}

		return true;
	}

	/**
	 * ParserAfterParse hook handler
	 * @see https://www.mediawiki.org/wiki/Manual:Hooks/ParserAfterParse
	 * @param Parser $parser
	 * @return bool
	 */
	public static function onParserAfterParse( Parser $parser ) {
		TagHandler::finalParseStep( $parser );
		return true;
	}

	/**
	 * RejectParserCacheValue hook handler. Rejects output with old versions of map data
	 * structures. To be enabled at a later date.
	 * @see https://www.mediawiki.org/wiki/Manual:Hooks/RejectParserCacheValue
	 * @param ParserOutput $po
	 * @return bool
	 */
	/*public static function onRejectParserCacheValue( ParserOutput $po ) {
		// One of these should be present in any output with old version of data
		if ( $po->getExtensionData( 'kartographer_valid' )
			 || $po->getExtensionData( 'kartographer_broken' )
		) {
			return false;
		}
		return true;
	}*/
}
