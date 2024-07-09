# Documentation for writing games

All games are written in json in the games directory. Please do not have spaces in the game name, as this will render it uncompilable until you rename it. This documentation is only for the latest version(currently 1.3(1)) and earlier version will likely be added as special modes in future versions. Also note that all fields the compiler doesn't recognize, it ignores.

As of adding 1.31, the game file argument passed to the compiler can now be a directory with a game.json file in it. This is true for 1.3 and 1.31.

## `meta`

Contains meta information about the game.

### `name`

Contains the game name. This should be a string and will be written to the CUE file in the CD-Text Title field.

### `description`

Pretty much useless. This field is written to the CUE file, but won't be written to disk with most programs as it is in a REM command(aka, a comment).

### `author`

Contains the author name. This should also be a string and will also be written to the CUE file in the CD-Text Performer field.

### `beginning`

Contains the id of the starting track. This track will be automatically moved to be the first track by the compiler.

### `overrides`

Contains all overrides for built-in text. See `games/test_game.json` for all keys and their default values

### `version`

Currently please keep this at 1.3 or 1.31, as 1.1 and 1.2 have been deprecated.

## `game`

The main body of the game. All subsequent fields will be grandchildren of this field, as the key name is used as an id.

### `speech`

The speech that is used as the base for the text that will be put in to gtts. Anything in the format ` {track_id} ` will be replaced with the track number of that track id, including the spaces. This means that if you want spaces around it, you need two spaces at the start and two at the end. There also can only be one such substitution per track.

### `title`

The title of the track. Can be any string, and will be written to the CUE file in the CD-Text Title field for the track it is a part of.

### `noAppend`

Makes the compiler not append the automatically created options text to the speech field before sending it through gtts.

### `noSilence`

Makes the compiler not add a delay to the end of the speech.

### `silenceLength`

Makes the compiler add this length of a delay to the end of the track instead of the default five seconds. If `noDelay` is set, it takes precedence.

### `end`

Makes this track an ending. This means it doesn't have to have any options, and essentially enables `noAppend`.

### `file` (1.31 only)

Replaces speech with the imported audio file. The audio file should be an mp3 and in the same folder as the game file.

### `merge` and `fileVolume` (1.31 only)

Merges speech and the audio file from `file`. Sets the `file` volume to the `fileVolume` without changing the original file.
