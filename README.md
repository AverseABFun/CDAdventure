# CDAdventure

Put a choose-your-own-adventure on a CD! Also, a warning: Don't play trench_journey. It is incredibly boring. I don't know why I made it like that. Also, there are weird spelling errors.

WARNING FOR WRITERS: Version 1.3 is the only version guarenteed to work. 1.1 and 1.2 may not work and may have tons of bugs and lack new features that I am not adding. I am not fixing this, I built the code in a terrible way, but 1.3 is overall the best based on my testing and research.

## Required tools to use

* ffmpeg
* node.js

## Use instructions

If you want to use this program, first clone it to your local machine(obviously). Then, you'll want to make sure node is installed and run `npm install`. After that, just run `node compile.js (game name) [output directory]` with the game name necessary and the output directory optional. If the output directory is omitted, then it will default to `./out`. However, note that it will not remove any previous files in the output directory, but it will overwrite any files that it tries to write itself. After running the program, open the `playlist.cue` file in a program like imgburn and burn it to a disc! Also note that the game name argument should just be the filename of the json file without the extension, and all games have to be in the games directory.
