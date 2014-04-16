/*
 * Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */


/*jslint vars: true, plusplus: true, devel: true, node: true, nomen: true, indent: 4, maxerr: 50 */

"use strict";

var fs = require("fs"),
    fsextra = require("fs-extra"),
    os = require("os"),
    path = require("path"),
    sass = require("node-sass");

var _domainManager,
    tmpFolders = [];

function tmpdir() {
    var baseTmpDir = os.tmpdir();
    
    if (baseTmpDir.charAt(baseTmpDir.length - 1) !== path.sep) {
        baseTmpDir = baseTmpDir + path.sep;
    }
    
    return baseTmpDir + "brackets-sass";
}

function render(file, includePaths, imagePaths, outputStyle, sourceComments, sourceMap, callback) {
    sass.render({
        file: file,
        includePaths: includePaths,
        imagePaths: imagePaths,
        outputStyle: outputStyle,
        sourceComments: sourceComments,
        sourceMap: sourceMap,
        success: function (css, map) {
            callback(null, { css: css, map: map });
        },
        error: function (error) {
            callback(error);
        }
    });
}

/**
 * Normalize path separator, drop drive letter on windows, and
 * return new string starting with first path separator.
 * e.g. C:/Users/me/file.txt -> \Users\me\file.txt
 */
function normalize(fullPath) {
    // Convert path separator for windows
    var result = path.normalize(fullPath);
    
    // Drop drive letter
    var firstSep = result.indexOf(path.sep);
    return (firstSep >= 0) ? result.slice(firstSep) : result;
}

function preview(file, inMemoryFiles, includePaths, imagePaths, outputStyle, sourceComments, sourceMap, callback) {
    // Convert path separator for windows
    file = normalize(file);
    
    var originalParent = path.dirname(file),
        tmpDirPath = tmpdir(),
        tmpFolder = tmpDirPath + originalParent,
        tmpFile = tmpFolder + path.sep + path.basename(file);
    
    // Delete existing files if they exist
    fsextra.removeSync(tmpFolder);

    tmpFolders.push(tmpFolder);
    
    // Copy files to temp folder
    fsextra.copySync(originalParent, tmpFolder);
    
    // Write in-memory files to temp folder
    var absPaths = Object.keys(inMemoryFiles),
        inMemoryText;
    
    absPaths.forEach(function (absPath) {
        inMemoryText = inMemoryFiles[absPath];
        fs.writeFileSync(tmpDirPath + normalize(absPath), inMemoryText);
    });
    
    // Add original file dir as includePath
    includePaths = includePaths || [];
    includePaths.unshift(originalParent);
    
    render(tmpFile, includePaths, imagePaths, outputStyle, sourceComments, sourceMap, callback);
}

function deleteTempFiles() {
    tmpFolders.forEach(function (tmpFolder) {
        fsextra.removeSync(tmpFolder);
    });
    
    tmpFolders = [];
}

/**
 * Initialize the "childProcess" domain.
 * The fileWatcher domain handles watching and un-watching directories.
 */
function init(domainManager) {
    if (!domainManager.hasDomain("sass")) {
        domainManager.registerDomain("sass", {major: 0, minor: 1});
    }
    
    domainManager.registerCommand(
        "sass",
        "render",
        render,
        true,
        "Returns the path to an application",
        [
            {name: "file", type: "string"},
            {name: "data", type: "string"},
            {name: "includePaths", type: "array"},
            {name: "imagePath", type: "string"},
            {name: "outputStyle", type: "string"},
            {name: "sourceComments", type: "string"},
            {name: "sourceMap", type: "string"}
        ]
    );
    
    domainManager.registerCommand(
        "sass",
        "preview",
        preview,
        true,
        "Returns the path to an application",
        [
            {name: "file", type: "string"},
            {name: "inMemoryFiles", type: "object"},
            {name: "includePaths", type: "array"},
            {name: "imagePath", type: "string"},
            {name: "outputStyle", type: "string"},
            {name: "sourceComments", type: "string"},
            {name: "sourceMap", type: "string"}
        ]
    );
    
    domainManager.registerCommand(
        "sass",
        "deleteTempFiles",
        deleteTempFiles,
        false,
        "Delete temporary files used for Live Preview",
        []
    );
    
    _domainManager = domainManager;
}

exports.init = init;
