'use strict';

module.exports = loadReplaceFile;

var config = require('./load-config.js');
var genReplaceHash = require('./tools.js').genReplaceHash;
var load = require('./load.js');
var URL = require('url');

function loadReplaceFile(req, url_replace, end) {
    var xStartHost = req.xStartHost;

    load(url_replace
        , {
            authorization: req.headerAuthorization,
            X_Forwarded_For: req.X_Forwarded_For
        }

        , function(status, result) {
            if (status !== true) {
                end(false, '// error load "replace" file. status - ' + status + '\n');
                return;
            };

            result.get(['json'], function(status, data) {
                if (status !== true) {
                    end(false, '// error "replace" file. status - ' + status + '\n');
                    return;
                };

                if (!data.replace || typeof data.replace !== 'object') {
                    end(false, '// error "replace" file. no [replace] properties\n')
                    return;
                };

                req.replaceHash = genReplaceHash(URL.parse(url_replace)
                    , data.replace
                    , xStartHost
                );

                end(true);
            });
        }
    );
};
