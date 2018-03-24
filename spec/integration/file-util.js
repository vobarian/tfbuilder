const {mkdirSync, unlinkSync, readFileSync} = require('fs');

module.exports.createDirectoryIfNotExists = function(dir) {
    try {
        mkdirSync(dir);
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

module.exports.createDirectories = function(path) {
    path.split('/').reduce((combined, segment) => {
        combined += segment + '/';
        module.exports.createDirectoryIfNotExists(combined);
        return combined;
    }, '');
}

module.exports.deleteFileIfExists = function(file) {
    try {
        unlinkSync(file);
    } catch (err) {
        if (err.code !== 'ENOENT') throw err;
    }
}

module.exports.readText = function(fileName) {
    return readFileSync(fileName, {encoding: 'utf8'});
}
