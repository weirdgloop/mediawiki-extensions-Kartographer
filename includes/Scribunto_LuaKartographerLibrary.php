<?php

namespace Kartographer;

use Kartographer\Tag\MapFrame;
use Kartographer\Tag\MapLink;

class Scribunto_LuaKartographerLibrary extends \Scribunto_LuaLibraryBase {
	public function register() {
		$lib = [
			'mapframe' => [ $this, 'getMapframe' ],
			'maplink' => [ $this, 'getMaplink' ],
		];
		return $this->getEngine()->registerInterface(
				__DIR__ . '/../lua/mw.kartographer.lua', $lib, []
		);
	}

	public function getMapframe( $args, $input ) {
		$parser = $this->getParser();
		return [ MapFrame::entryPoint( $input, $args, $parser, $parser->getPreprocessor()->newFrame() ) ];
	}

	public function getMaplink( $args, $input ) {
		$parser = $this->getParser();
		return [ MapLink::entryPoint( $input, $args, $parser, $parser->getPreprocessor()->newFrame() ) ];
	}
}