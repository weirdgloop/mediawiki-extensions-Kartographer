<?php
/**
 *
 * @license MIT
 * @file
 *
 * @author Yuri Astrakhan
 */

namespace Kartographer;

use Kartographer\Tag\MapFrame;
use Kartographer\Tag\MapLink;
use Kartographer\Tag\TagHandler;
use MediaWiki\MediaWikiServices;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Storage\EditResult;
use MediaWiki\User\UserIdentity;
use Parser;
use WikiPage;

class Hooks {
	// When [[MediaWiki:Kartographer-map-version]] is edited, clear the basemaps cache.
	public static function onPageSaveComplete( WikiPage $wikiPage, UserIdentity $user, string $summary, int $flags, RevisionRecord $revisionRecord, EditResult $editResult ) {
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
	 */
	public static function onParserFirstCallInit( Parser $parser ) {
		global $wgKartographerEnableMapFrame;

		$parser->setHook( 'maplink', [ MapLink::class, 'entryPoint' ] );
		if ( $wgKartographerEnableMapFrame ) {
			$parser->setHook( 'mapframe', [ MapFrame::class, 'entryPoint' ] );
		}
	}

	/**
	 * ParserAfterParse hook handler
	 * @see https://www.mediawiki.org/wiki/Manual:Hooks/ParserAfterParse
	 * @param Parser $parser
	 */
	public static function onParserAfterParse( Parser $parser ) {
		$output = $parser->getOutput();
		$state = State::getState( $output );

		if ( $state ) {
			$options = $parser->getOptions();
			$isPreview = $options->getIsPreview() || $options->getIsSectionPreview();
			TagHandler::finalParseStep( $state, $output, $isPreview, $parser->getTitle() );
		}
	}

}
