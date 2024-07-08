import { existsSync, readFileSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'fs';

if (process.argv.length<3) {
    console.error("\x1b[31mError: No game provided!\x1b[0m\x07")
    process.exit(1)
}
if (process.argv[2] == "--debug") {
    console.error("\x1b[31mPlease provide debug option after game. If your game file is named --debug.json, then please change it.\x1b[0m\x07")
    process.exit(1)
}
if (!existsSync("./games/"+process.argv[2]+".json")) {
    console.error(`\x1b[31mError: Game ${process.argv[2]} does not exist!\x1b[0m\x07`)
    process.exit(1)
}

var out_directory = "out"
if (process.argv.length>=4) {
    if (process.argv[3] != "--debug") {
        out_directory = process.argv[3];
    } else {
        debug = true;
    }
}
if (process.argv.length >= 5) {
    if (process.argv[4] == "--debug") {
        debug = true;
    }
}
const game = new Object(JSON.parse(readFileSync("./games/"+process.argv[2]+".json").toString("utf8")));

if (!existsSync("./"+out_directory)) {
    mkdirSync("./"+out_directory);
}

import gTTS from 'gtts';
import { exec } from 'child_process';

var debug = false
var overrides = {
    "options_prefix": "You can ",
    "options_item_separator": ", ",
    "last_options_item_separator": ", or ",
    "speech_options_separator": " ... ... ... ",
    "options_track_prefix": "To ",
    "options_track_forward_prefix": ", skip forward ",
    "options_track_backward_prefix": ", skip backward ",
    "options_track_suffix_plural": " tracks. ",
    "options_track_suffix_singular": " track. ",
    "request_to_pause": "Please pause and make your decision. "
}

let isString = value => typeof value === 'string' || value instanceof String;

var speechCache = {}
var doneWithTTS = new Promise((resolve)=>{_doneWithTTSResolve = resolve})
var _doneWithTTSResolve = null
function createSpeech(text, file) {
    doneWithTTS = new Promise((resolve)=>{_doneWithTTSResolve = resolve})
    file = out_directory+"/"+file
    if (Object.keys(speechCache).includes(text)) {
        copyFileSync(speechCache[text], file);
        return
    }
    const gtts = new gTTS(text, 'en');
    
    gtts.save(file, function (err, result){
        if(err) { throw new Error(err); }
        speechCache[text] = file;
        console.log(`"${text}" converted to speech`);
        _doneWithTTSResolve()
    });
}

function padWithSilence(inputFile, outputFile, duration) {
    if (existsSync(outputFile)) rmSync(outputFile)
    const command = `ffmpeg -f lavfi -t ${duration} -i anullsrc=channel_layout=stereo:sample_rate=44100 -i ${inputFile} -filter_complex "[1:a][0:a]concat=n=2:v=0:a=1" ${outputFile}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error padding file: ${error.message}`);
            return;
        }
        rmSync(inputFile)
        if (stderr) {
            console.error(`FFmpeg stderr: ${stderr}`);
            return;
        }
    });
}
function beginPlaylist() {
    return {
        "tracks": 0,
        "data": `PERFORMER "${getGameProperty("meta.author")}"\nTITLE "${getGameProperty("meta.name")}"\n${gameHasProperty("meta.description") ? `REM ${getGameProperty("meta.description")}\n` : ""}`
    };
}
function addToPlaylist(playlist, title, filename) {
    playlist.tracks += 1
    playlist.data +=               `FILE ${filename} MP3\n`;
    playlist.data +=               `  TRACK ${String(playlist.tracks).padStart(2,'0')} AUDIO\n`
    playlist.data += title != "" ? `    TITLE "${title.replaceAll("\"","\\\"")}"\n` : ""
    playlist.data +=               `    PERFORMER "${getGameProperty("meta.author")}"\n`
    playlist.data +=               `    FLAGS DCP\n`
    playlist.data +=               `    INDEX 01 00:00:00\n`
    return playlist;
}
function finishPlaylist(playlist, path) {
    writeFileSync(path, playlist.data, 'utf8');
}

function assert(condition, error_code=2, message="Assertion failed") {
    if (!condition) {
        console.error(`\x1b[31m${message}\x1b[0m\x07`)
        process.exit(error_code)
    }
    return true
}

function gameHasProperty(string) {
    var stringSplit = string.split(".")
    var item = game[stringSplit[0]]
    stringSplit.splice(0,1)
    for (var split of stringSplit) {
        if(!item.hasOwnProperty(split)) {
            return false
        }
        item = item[split]
    }
    return true
}

function assertGameHasProperty(string) {
    var stringSplit = string.split(".")
    var item = game[stringSplit[0]]
    var debugString = stringSplit[0]
    stringSplit.splice(0,1)
    for (var split of stringSplit) {
        debugString = debugString+"."+split
        assert(item.hasOwnProperty(split), 2, `Game doesn't have ${debugString} property!`);
        item = item[split]
    }
    return true
}

function getGameProperty(string) {
    assertGameHasProperty(string);
    var stringSplit = string.split(".")
    var item = game
    for (var split of stringSplit) {
        item = item[split]
    }
    return item
}
function setGameProperty(string, value) {
    var stringSplit = string.split(".")
    stringSplit.splice(stringSplit.length-1,1)
    var item = game
    for (var split of stringSplit) {
        item = item[split]
    }
    item[string.split(".")[stringSplit.length]] = value
}

switch (getGameProperty("meta.version")) {
    case 1.1:
        assertGameHasProperty("meta.name")
        assertGameHasProperty("meta.author")
        assertGameHasProperty("game."+getGameProperty("meta.beginning"))
        for (var item of Object.keys(getGameProperty("game"))) {
            assertGameHasProperty(`game.${item}.speech`)
            assertGameHasProperty(`game.${item}.options`)
            assert(Object.keys(getGameProperty(`game.${item}.options`)).length>0, 2, `Game track ${item}'s options has a length of 0!`)
        }
        if (gameHasProperty("meta.overrides")) {
            for (var item of Object.keys(getGameProperty("meta.overrides"))) {
                assert(isString(getGameProperty(`meta.overrides.${item}`)), 2, `Overriden text ${item}'s value isn't a string!`)
            }
            overrides = getGameProperty("meta.overrides")
        }
        var keys = Object.keys(getGameProperty("game"))
        for (var key of keys) {
            const index = keys.indexOf(key)
            setGameProperty(`game.${key}.speech`, getGameProperty(`game.${key}.speech`)+overrides.speech_options_separator+overrides.options_prefix)
            var options = getGameProperty(`game.${key}.options`)
            var options_out = ""
            var optionsKeys = Object.keys(options)
            for (var key2 of optionsKeys) {
                var option = key2
                options[option] = keys.indexOf(options[option])
                var optionsIndex = optionsKeys.indexOf(key2)
                if (optionsIndex != 0 && optionsIndex != optionsKeys.length-1) {
                    option = overrides.options_item_separator+option
                } else if (optionsIndex != 0) {
                    option = overrides.last_options_item_separator+option
                }
                options_out += option
            }
            options_out += ". ";
            for (var key2 of optionsKeys) {
                var offset = (options[key2]+1)-(index+1)
                console.log(key2)
                console.log(offset)
                options_out += `${overrides.options_track_prefix}${key2}${(offset)<0 ? overrides.options_track_backward_prefix : overrides.options_track_forward_prefix}${Math.abs(offset).toString()}${offset > 1 || offset < -1 ? overrides.options_track_suffix_plural : overrides.options_track_suffix_singular}`
            }
            setGameProperty(`game.${key}.speech`, getGameProperty(`game.${key}.speech`)+options_out)
        }
        var playlist = beginPlaylist();
        var beginning = getGameProperty("meta.beginning")
        createSpeech(getGameProperty(`game.${beginning}.speech`), beginning.replace(/(\W+)/g, '-')+".temp.mp3")
        await doneWithTTS
        padWithSilence("./"+out_directory+"/"+beginning.replace(/(\W+)/g, '-')+".temp.mp3", "./"+out_directory+"/"+beginning.replace(/(\W+)/g, '-')+".mp3", 20)
        playlist = addToPlaylist(playlist, getGameProperty(`game.${beginning}.title`), "./"+beginning.replace(/(\W+)/g, '-')+".mp3")
        for (var key of keys) {
            if (key == beginning) {
                continue;
            }
            createSpeech(getGameProperty(`game.${key}.speech`), key.replace(/(\W+)/g, '-')+".temp.mp3")
            await doneWithTTS
            padWithSilence("./"+out_directory+"/"+key.replace(/(\W+)/g, '-')+".temp.mp3", "./"+out_directory+"/"+key.replace(/(\W+)/g, '-')+".mp3", 20)
            playlist = addToPlaylist(playlist, getGameProperty(`game.${key}.title`), "./"+key.replace(/(\W+)/g, '-')+".mp3")
        }
        finishPlaylist(playlist, "./"+out_directory+"/"+"playlist.cue")
        break;
    case 1.1:
        assertGameHasProperty("meta.name")
        assertGameHasProperty("meta.author")
        assertGameHasProperty("game."+getGameProperty("meta.beginning"))
        for (var item of Object.keys(getGameProperty("game"))) {
            assertGameHasProperty(`game.${item}.speech`)
            assertGameHasProperty(`game.${item}.options`)
            assert(Object.keys(getGameProperty(`game.${item}.options`)).length>0, 2, `Game track ${item}'s options has a length of 0!`)
        }
        if (gameHasProperty("meta.overrides")) {
            for (var item of Object.keys(getGameProperty("meta.overrides"))) {
                assert(isString(getGameProperty(`meta.overrides.${item}`)), 2, `Overriden text ${item}'s value isn't a string!`)
            }
            overrides = getGameProperty("meta.overrides")
        }
        var keys = Object.keys(getGameProperty("game"))
        for (var key of keys) {
            const index = keys.indexOf(key)
            setGameProperty(`game.${key}.speech`, getGameProperty(`game.${key}.speech`)+overrides.speech_options_separator+overrides.options_prefix)
            var options = getGameProperty(`game.${key}.options`)
            var options_out = ""
            var optionsKeys = Object.keys(options)
            for (var key2 of optionsKeys) {
                var option = key2
                options[option] = keys.indexOf(options[option])
                var optionsIndex = optionsKeys.indexOf(key2)
                if (optionsIndex != 0 && optionsIndex != optionsKeys.length-1) {
                    option = overrides.options_item_separator+option
                } else if (optionsIndex != 0) {
                    option = overrides.last_options_item_separator+option
                }
                options_out += option
            }
            options_out += ". ";
            for (var key2 of optionsKeys) {
                var offset = (options[key2]+1)-(index+1)
                console.log(key2)
                console.log(offset)
                options_out += `${overrides.options_track_prefix}${key2}${(offset)<0 ? overrides.options_track_backward_prefix : overrides.options_track_forward_prefix}${Math.abs(offset).toString()}${offset > 1 || offset < -1 ? overrides.options_track_suffix_plural : overrides.options_track_suffix_singular}`
            }
            setGameProperty(`game.${key}.speech`, getGameProperty(`game.${key}.speech`)+options_out)
        }
        var playlist = beginPlaylist();
        var beginning = getGameProperty("meta.beginning")
        createSpeech(getGameProperty(`game.${beginning}.speech`), beginning.replace(/(\W+)/g, '-')+".temp.mp3")
        await doneWithTTS
        padWithSilence("./"+out_directory+"/"+beginning.replace(/(\W+)/g, '-')+".temp.mp3", "./"+out_directory+"/"+beginning.replace(/(\W+)/g, '-')+".mp3", 20)
        playlist = addToPlaylist(playlist, getGameProperty(`game.${beginning}.title`), "./"+beginning.replace(/(\W+)/g, '-')+".mp3")
        for (var key of keys) {
            if (key == beginning) {
                continue;
            }
            createSpeech(getGameProperty(`game.${key}.speech`), key.replace(/(\W+)/g, '-')+".temp.mp3")
            await doneWithTTS
            padWithSilence("./"+out_directory+"/"+key.replace(/(\W+)/g, '-')+".temp.mp3", "./"+out_directory+"/"+key.replace(/(\W+)/g, '-')+".mp3", 20)
            playlist = addToPlaylist(playlist, getGameProperty(`game.${key}.title`), "./"+key.replace(/(\W+)/g, '-')+".mp3")
        }
        finishPlaylist(playlist, "./"+out_directory+"/"+"playlist.cue")
        break;
    case 1.2:
        assertGameHasProperty("meta.name")
        assertGameHasProperty("meta.author")
        assertGameHasProperty("game."+getGameProperty("meta.beginning"))
        for (var item of Object.keys(getGameProperty("game"))) {
            assertGameHasProperty(`game.${item}.speech`)
            assertGameHasProperty(`game.${item}.options`)
            assert(Object.keys(getGameProperty(`game.${item}.options`)).length>0, 2, `Game track ${item}'s options has a length of 0!`)
        }
        if (gameHasProperty("meta.overrides")) {
            for (var item of Object.keys(getGameProperty("meta.overrides"))) {
                assert(isString(getGameProperty(`meta.overrides.${item}`)), 2, `Overriden text ${item}'s value isn't a string!`)
            }
            overrides = getGameProperty("meta.overrides")
        }
        var keys = Object.keys(getGameProperty("game"))
        for (var key of keys) {
            const index = keys.indexOf(key)
            setGameProperty(`game.${key}.speech`, getGameProperty(`game.${key}.speech`)+overrides.speech_options_separator+overrides.options_prefix)
            var options = getGameProperty(`game.${key}.options`)
            var options_out = ""
            var optionsKeys = Object.keys(options)
            for (var key2 of optionsKeys) {
                var option = key2
                options[option] = keys.indexOf(options[option])
                var optionsIndex = optionsKeys.indexOf(key2)
                if (optionsIndex != 0 && optionsIndex != optionsKeys.length-1) {
                    option = overrides.options_item_separator+option
                } else if (optionsIndex != 0) {
                    option = overrides.last_options_item_separator+option
                }
                options_out += option
            }
            options_out += ". ";
            for (var key2 of optionsKeys) {
                var offset = (options[key2]+1)-(index+1)
                console.log(key2)
                console.log(offset)
                options_out += `${overrides.options_track_prefix}${key2}${(offset)<0 ? overrides.options_track_backward_prefix : overrides.options_track_forward_prefix}${Math.abs(offset).toString()}${offset > 1 || offset < -1 ? overrides.options_track_suffix_plural : overrides.options_track_suffix_singular}`
            }
            options_out += overrides.request_to_pause;
            setGameProperty(`game.${key}.speech`, getGameProperty(`game.${key}.speech`)+options_out)
        }
        var playlist = beginPlaylist();
        var beginning = getGameProperty("meta.beginning")
        createSpeech(getGameProperty(`game.${beginning}.speech`), beginning.replace(/(\W+)/g, '-')+".temp.mp3")
        await doneWithTTS
        padWithSilence("./"+out_directory+"/"+beginning.replace(/(\W+)/g, '-')+".temp.mp3", "./"+out_directory+"/"+beginning.replace(/(\W+)/g, '-')+".mp3", 5)
        playlist = addToPlaylist(playlist, getGameProperty(`game.${beginning}.title`), "./"+beginning.replace(/(\W+)/g, '-')+".mp3")
        for (var key of keys) {
            if (key == beginning) {
                continue;
            }
            createSpeech(getGameProperty(`game.${key}.speech`), key.replace(/(\W+)/g, '-')+".temp.mp3")
            await doneWithTTS
            padWithSilence("./"+out_directory+"/"+key.replace(/(\W+)/g, '-')+".temp.mp3", "./"+out_directory+"/"+key.replace(/(\W+)/g, '-')+".mp3", 5)
            playlist = addToPlaylist(playlist, gameHasProperty(`game.${key}.title`) ? getGameProperty(`game.${key}.title`) : "", "./"+key.replace(/(\W+)/g, '-')+".mp3")
        }
        finishPlaylist(playlist, "./"+out_directory+"/"+"playlist.cue")
        break;
    default:
        assert(false, 3, "Invalid version, expected 1.1 or 1.2!")
}