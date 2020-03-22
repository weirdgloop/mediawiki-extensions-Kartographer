local kartographer = {}
local php

function kartographer.setupInterface()
	-- Interface setup
	kartographer.setupInterface = nil
	php = mw_interface
	mw_interface = nil

	-- Register library within the "mw.kartographer" namespace
	mw = mw or {}
	mw.kartographer = kartographer

	package.loaded['mw.kartographer'] = kartographer
end

-- mapframe
function kartographer.mapframe( args, geoJson )
    geoJson = geoJson or ''
	return php.mapframe( args, geoJson )
end

-- maplink
function kartographer.maplink( args, geoJson )
    geoJson = geoJson or ''
	return php.maplink( args, geoJson )
end