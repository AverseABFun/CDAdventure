import { existsSync, readFileSync, mkdirSync, copyFileSync, writeFileSync, rmSync, renameSync } from 'fs';
import ffmpeg from '@ffmpeg-binary/ffmpeg';

if (process.argv.length<3) {
    console.error("\x1b[31mError: No game provided!\x1b[0m\x07")
    process.exit(1)
}
if (process.argv[2] == "--no-audio") {
    console.error("\x1b[31mPlease provide no audio option after game. If your game file is named --no-audio.json, then please change it.\x1b[0m\x07")
    process.exit(1)
}
if (!existsSync("./games/"+process.argv[2]+".json") && !(existsSync("./games/"+process.argv[2]) && existsSync("./games/"+process.argv[2]+"/game.json"))) {
    console.error(`\x1b[31mError: Game ${process.argv[2]} does not exist!\x1b[0m\x07`)
    process.exit(1)
}

var out_directory = "out"
var no_audio = false
const debug = false // Set to true to enable debug mode(breaks things but is useful for debugging)
if (process.argv.length>=4) {
    if (process.argv[3] != "--no-audio") {
        out_directory = process.argv[3];
    } else {
        no_audio = true;
    }
}
if (process.argv.length >= 5) {
    if (process.argv[4] == "--no-audio") {
        no_audio = true;
    }
}

var path = "./games/"+process.argv[2]+".json"

if (!existsSync("./games/"+process.argv[2]+".json")) {
    path = "./games/"+process.argv[2]+"/game.json"
}

var game = new Object(JSON.parse(readFileSync(path).toString("utf8")));

if (!existsSync("./"+out_directory)) {
    mkdirSync("./"+out_directory);
}

import gTTS from 'gtts';
import { exec } from 'child_process';

var overrides = {
    "options_prefix": "You can ",
    "options_item_separator": ", ",
    "last_options_item_separator": ", or ",
    "speech_options_separator": " ... ... ... ",
    "options_track_prefix": "To ",
    "options_track_forward_prefix": ", skip forward ",
    "options_track_backward_prefix": ", skip backward ",
    "options_track_go_to": ", go to track ",
    "options_track_go_to_suffix": ". ",
    "options_track_suffix_plural": " tracks. ",
    "options_track_suffix_singular": " track. ",
    "request_to_pause": "Please pause and make your decision now. "
}

let isString = value => typeof value === 'string' || value instanceof String;

var doneWithTTS = new Promise((resolve)=>{_doneWithTTSResolve = resolve})
var _doneWithTTSResolve = null
function createSpeech(text, file) {
    doneWithTTS = new Promise((resolve)=>{_doneWithTTSResolve = resolve})
    file = out_directory+"/"+file
    const gtts = new gTTS(text, 'en');
    
    gtts.save(file, function (err, result){
        if(err) { throw new Error(err); }
        //console.log(`"${text}" converted to speech`);
        _doneWithTTSResolve()
    });
}

var padPromise = new Promise((resolve)=>{_padResolve = resolve})
var _padResolve = null
function padWithSilence(inputFile, outputFile, duration) {
    padPromise = new Promise((resolve)=>{_padResolve = resolve})
    if (existsSync(outputFile)) rmSync(outputFile)
    const command = `${ffmpeg} -f lavfi -t ${duration} -i anullsrc=channel_layout=stereo:sample_rate=44100 -i ${inputFile} -filter_complex "[1:a][0:a]concat=n=2:v=0:a=1" ${outputFile}`;

    exec(command, (error, stdout, stderr) => {
        _padResolve()
        if (error) {
            console.error(`Error padding file: ${error.message}`);
            return;
        }
    });
}

var mergePromise = new Promise((resolve)=>{_mergeResolve = resolve})
var _mergeResolve = null
var merging = false
function mergeFiles(inputFile1, inputFile2, outputFile, volume1=1) {
    merging = true
    mergePromise = new Promise((resolve)=>{_mergeResolve = resolve})
    if (existsSync(outputFile)) rmSync(outputFile)
    const command = `${ffmpeg} -i ${inputFile1} -i ${inputFile2} -filter_complex "[0:a:0]volume=${volume1}:precision=fixed[a0]; [a0]aloop=loop=-1:size=2e+09[a1]; [1:a][a1]amix=duration=shortest[a]" -map [a] -ac 2 ${outputFile}`;

    exec(command, (error, stdout, stderr) => {
        _mergeResolve()
        merging = false
        if (error) {
            console.error(`Error merging files: ${error.message}`);
            return;
        }
    });
}

function produceManifest() {
    var manifest = {
        "version": 1,
        "meta": getGameProperty("meta"),
        "tracks": Object.keys(getGameProperty("game")).map((key)=>{return {"id": key, ...getGameProperty(`game.${key}`)} })
    }
    writeFileSync("./"+out_directory+"/manifest.json", JSON.stringify(manifest), 'utf8');
}

async function createOutput(trackId, playlist) {
    if (version >= 1.31 && (gameHasProperty(`game.${trackId}.file`) || gameHasProperty(`meta.defaults.file`))) {
        var file = getGameProperty(`game.${trackId}.file`)
        if (version >= 1.32 && file == undefined) {
            if (gameHasProperty(`meta.defaults.file`)) {
                file = getGameProperty(`meta.defaults.file`)
            }
        }
        var path2 = path.replace(/[a-zA-Z_\-.\s]+$/g, "")
        file = path2+file
        if (!file.endsWith(".mp3")) {
            console.error(`\x1b[31mError: File "${file}" is not an mp3 file. If it is, please change the file extension to mp3.\x1b[0m\x07`)
            process.exit(2)
        }
        if (((gameHasProperty(`game.${trackId}.merge`) && getGameProperty(`game.${trackId}.merge`)) || (gameHasProperty(`meta.defaults.merge`) && getGameProperty(`meta.defaults.merge`))) && gameHasProperty(`game.${trackId}.speech`) && (gameHasProperty(`game.${trackId}.fileVolume`) || gameHasProperty(`meta.defaults.fileVolume`))) {
            createSpeech(getGameProperty(`game.${trackId}.speech`), trackId.replace(/(\W+)/g, '-')+".temp.mp3")
            await doneWithTTS

            padWithSilence("./"+out_directory+"/"+trackId.replace(/(\W+)/g, '-')+".temp.mp3", "./"+out_directory+"/"+trackId.replace(/(\W+)/g, '-')+".mp3", getGameProperty(`game.${trackId}.silenceLength`, false) || (getGameProperty(`meta.defaults.silenceLength`, false) || 5))
            await padPromise

            rmSync("./"+out_directory+"/"+trackId.replace(/(\W+)/g, '-')+".temp.mp3")
            renameSync("./"+out_directory+"/"+trackId.replace(/(\W+)/g, '-')+".mp3", "./"+out_directory+"/"+trackId.replace(/(\W+)/g, '-')+".temp.mp3")
            mergeFiles(file, "./"+out_directory+"/"+trackId.replace(/(\W+)/g, '-')+".temp.mp3", "./"+out_directory+"/"+trackId.replace(/(\W+)/g, '-')+".mp3", getGameProperty(`game.${trackId}.fileVolume`) || getGameProperty(`meta.defaults.fileVolume`))
        } else {
            copyFileSync(file, "./"+out_directory+"/"+trackId.replace(/(\W+)/g, '-')+".mp3")
        }
        playlist = addToPlaylist(playlist, gameHasProperty(`game.${trackId}.title`) ? getGameProperty(`game.${trackId}.title`) : "", "./"+trackId.replace(/(\W+)/g, '-')+".mp3")
    } else {
        createSpeech(getGameProperty(`game.${trackId}.speech`), trackId.replace(/(\W+)/g, '-')+".temp.mp3")
        await doneWithTTS
        padWithSilence("./"+out_directory+"/"+trackId.replace(/(\W+)/g, '-')+".temp.mp3", "./"+out_directory+"/"+trackId.replace(/(\W+)/g, '-')+".mp3", 5)
        playlist = addToPlaylist(playlist, gameHasProperty(`game.${trackId}.title`) ? getGameProperty(`game.${trackId}.title`) : "", "./"+trackId.replace(/(\W+)/g, '-')+".mp3")
    }
    return playlist
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

function getGameProperty(string, shouldAssert=true) {
    if (shouldAssert) {
        assertGameHasProperty(string)
    }
    var stringSplit = string.split(".")
    var item = game
    for (var split of stringSplit) {
        item = item[split]
    }
    if (!item) {
        return 0
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

const version = getGameProperty("meta.version")

var defaults = {}

switch (version) {
    case 1.3:
    case 1.31:
    case 1.32:
        var keys = Object.keys(getGameProperty("game"))
        if (!debug) {
            assertGameHasProperty("meta.name")
            assertGameHasProperty("meta.author")
            assertGameHasProperty("game."+getGameProperty("meta.beginning"))
            if (version >= 1.32 && gameHasProperty("meta.defaults")) {
                defaults = getGameProperty("meta.defaults")
            }
            for (var item of Object.keys(getGameProperty("game"))) {
                if (version >= 1.32) {
                    for (var defaul of Object.keys(defaults)) {
                        if (!gameHasProperty(`game.${item}.${defaul}`)) {
                            setGameProperty(`game.${item}.${defaul}`, defaults[item])
                        }
                    }
                }
                if (!(version >= 1.31 && gameHasProperty(`game.${item}.file`))) {
                    assertGameHasProperty(`game.${item}.speech`)
                }
                if (gameHasProperty(`game.${key}.options`)) {
                    assert(Object.keys(getGameProperty(`game.${item}.options`)).length>0, 2, `Game track ${item}'s options has a length of 0!`)
                }
            }
            if (gameHasProperty("meta.overrides")) {
                for (var item of Object.keys(getGameProperty("meta.overrides"))) {
                    assert(isString(getGameProperty(`meta.overrides.${item}`)), 2, `Overriden text ${item}'s value isn't a string!`)
                }
                overrides = getGameProperty("meta.overrides")
            }
            for (var key of keys) {
                if (version >= 1.31 && gameHasProperty(`game.${item}.file`) && !gameHasProperty(`game.${item}.merge`)) {
                    continue
                }
                setGameProperty(`game.${key}.originalSpeech`, getGameProperty(`game.${key}.speech`))
                var regex = / ({.*?[^\\]})(?:\s|$)/m
                var matches = String(getGameProperty(`game.${key}.speech`)).match(regex)
                if (matches != null) {
                    console.log(getGameProperty(`game.${key}.speech`))
                    setGameProperty(`game.${key}.speech`, getGameProperty(`game.${key}.speech`).replace(matches[0], keys.indexOf(matches[0].replace(" {","").replace("} ",""))+1))
                    console.log(getGameProperty(`game.${key}.speech`))
                }
                if (gameHasProperty(`game.${key}.noAppend`) && getGameProperty(`game.${key}.noAppend`)) {
                    continue
                }
                if (gameHasProperty(`game.${key}.end`) && getGameProperty(`game.${key}.end`)) {
                    continue
                }
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
                    var offset = options[key2]+1
                    console.log(key2)
                    console.log(offset)
                    options_out += `${overrides.options_track_prefix}${key2}${overrides.options_track_go_to}${Math.abs(offset).toString()}${overrides.options_track_go_to_suffix}`
                }
                setGameProperty(`game.${key}.speech`, getGameProperty(`game.${key}.speech`)+options_out)
            }
        }
        if (!no_audio) {
            var playlist = beginPlaylist();
            var beginning = getGameProperty("meta.beginning")
            playlist = await createOutput(beginning, playlist)
            for (var key of keys) {
                if (key == beginning) {
                    continue;
                }
                playlist = await createOutput(key, playlist)
            }
            finishPlaylist(playlist, "./"+out_directory+"/"+"playlist.cue")
        }
        if (keys.length >= 100) {
            console.error(`\x1b[33mWarning: Over 99 game tracks. Please note that some CD players may not support having this many.\x1b[0m\x07`)
        }
        produceManifest()
        break;
    default:
        assert(false, 3, "Invalid version, expected 1.3-1.32! Note: If you are for some reason trying to compile a 1.1 or 1.2 game(which shouldn't be possible), 1.1 and 1.2 have been removed from the compiler.")
}