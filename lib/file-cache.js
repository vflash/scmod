'use strict';

var config = require('./load-config.js');

var CACHE = {length: 0};
var CACHE_OLD = {};
var und;

var CACHE_FILE_SIZE = +config.CACHE_FILE_SIZE || 2500000;
var CACHE_EXPIRES = +config.CACHE_EXPIRES || 3000;
var CACHE_LIMIT = +config.CACHE_LIMIT || 4000;
var CACHE_SIZE = +config.CACHE_SIZE || 25000000;

module.exports = {
    FILE_SIZE: CACHE_FILE_SIZE,
    LIMIT: CACHE_LIMIT,
    SIZE: CACHE_SIZE,
    EXPIRES: CACHE_EXPIRES,

    set: function(key, value) {
        if (CACHE[key] === und) {
            CACHE.length += 1;
        };

        CACHE[key] = value != null ? value : null;
    },

    get: function(key) {
        var value = CACHE[key];

        if (value === und) {
            if (value = CACHE_OLD[key]) {
                CACHE[key] = value;
                CACHE.length += 1;
            };
        };

        return value;
    },

    clear: function() {
        if (CACHE.length > CACHE_LIMIT || CACHE.size > CACHE_SIZE) {
            CACHE_OLD = CACHE;
            CACHE = {length: 0};
        };
    },
};




