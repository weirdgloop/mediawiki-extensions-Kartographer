<?php
/**
 * ResourceLoader module providing extra data to the client-side.
 *
 * @file
 * @ingroup Extensions
 */

namespace Kartographer;

use MediaWiki\ResourceLoader\ResourceLoader;
use MediaWiki\ResourceLoader\Context as ResourceLoaderContext;
use MediaWiki\ResourceLoader\Module as ResourceLoaderModule;

class DataModule extends ResourceLoaderModule {

	/** @inheritDoc */
	protected $targets = [ 'desktop', 'mobile' ];

	/**
	 * @inheritDoc
	 */
	public function getScript( ResourceLoaderContext $context ) {
		$config = $this->getConfig();
		return ResourceLoader::makeConfigSetScript( [
			'wgKartographerDataConfig' => $config->get( 'KartographerDataConfig' )
		] );
	}

	/**
	 * @inheritDoc
	 */
	public function enableModuleContentVersion() {
		return true;
	}

	/**
	 * @see ResourceLoaderModule::supportsURLLoading
	 *
	 * @return bool
	 */
	public function supportsURLLoading() {
		// always use getScript() to acquire JavaScript (even in debug mode)
		return false;
	}
}
