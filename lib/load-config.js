
module.exports = new function() {
    var x
    , a = ['../config.js', '/usr/local/etc/scmod/config.js', '/etc/scmod/config.js']
    , i = 0
    ;

    while(x = a[i++]){
        try {
            return require(x);
        } catch(e) {};
    };

    return require('../config-sample.js');
};
