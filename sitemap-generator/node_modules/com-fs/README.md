com-fs 
======

### basic io components for using with [processor.js](http://aplib.github.io/processor.js) library

[![NPM version](https://badge.fury.io/js/com-fs.png)](http://badge.fury.io/js/com-fs)

### Installing

    npm install com-fs

### using


    var processor = require('processor'),
        create = processor.create;
    // using
        require('com-fs');


    // recursively walk and build file list
    create('fs.walker raw', [/.*\.js/, '/src'])
        .listSync(function(path) {
            ...
        });
    });

### components

[See documentation](http://node-components.github.io/com-fs/)
