# CDAdventure

Put a choose-your-own-adventure on a CD!

## Required tools to use

* ffmpeg
* node.js

## Use instructions

If you want to use this program, first clone it to your local machine(obviously). Then, you'll want to make sure node is installed and run `npm install`. After that, just run `node compile.js (game name) [output directory]` with the game name necessary and the output directory optional. If the output directory is omitted, then it will default to `./out`. However, note that it will not remove any previous files in the output directory, but it will overwrite any files that it tries to write itself. After running the program, open the `playlist.cue` file in a program like imgburn and burn it to a disc! Also note that the game name argument should just be the filename of the json file without the extension, and all games have to be in the games directory.
