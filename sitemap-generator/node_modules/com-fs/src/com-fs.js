//     com-fs basic io components for using with processor.js
//     (c) 2013 vadim b. https://github.com/node-components/com-fs
//     license: MIT

(function(){

    var processor = require('processor'),
        NodePrototype = processor.node_prototype,
        fs = require('fs');

    function extend(object) {
        for(var i = 1, c = arguments.length; i < c; i++) {
            var src = arguments[i];
            if (typeof src === 'object')
                for(var prop in src)
                    if (src.hasOwnProperty(prop))
                        object[prop] = src[prop];
        }
        return object;
    }

/*#include fs/path/fs.path.js*/

/*#include fs/fsobject/fs.fsobject.js*/

/*#include fs/directory/fs.directory.js*/

/*#include fs/file/fs.file.js*/

/*#include fs/filereader/fs.filereader.js*/

/*#include fs/filewriter/fs.filewriter.js*/

/*#include fs/concat/fs.concat.js*/

/*#include fs/fileconcat/fs.fileconcat.js*/

/*#include fs/copy/fs.copy.js*/

/*#include fs/list/fs.list.js*/

/*#include fs/walker/fs.walker.js*/

})();