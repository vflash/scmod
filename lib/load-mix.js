'use strict';

var config = require('./load-config.js');
var load = require('./load.js');

module.exports = mix;

function mix(urlMap, options, end) {
    var u
    , self = this
    , zstatus = {}
    , zresult = {}
    , error = false
    , keys = []
    , j = 0
    , i
    ;

    for (i in urlMap) {
        if (urlMap[i]) keys.push(i);
    };

    for(i = keys.length; i--;) {
        new function() {
            var url = urlMap[keys[i]];
            var key = keys[i];

            url = typeof url === 'object' ? urlModifier(url[0], url[1]) : url+'';

            load(url, options, function(status, result) {
                zstatus[key] = status;
                zresult[key] = result;

                if (status !== true) {
                    error = true;
                    complete();
                    return
                };

                complete()
            })
        };
    };

    function complete() {
        if (++j !== keys.length) return;

        end(error ? zstatus : true
            , zresult
        );
    };
};
