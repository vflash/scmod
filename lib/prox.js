'use strict';
module.exports = prox;

var fileResult = require('./file-result.js');
var config = require('./load-config.js');


function prox(req, res, options) {
    //  /prox/{type}/{module}/{vars}/{protocol}/{file}
    var qm = ('' + q.path).match(/\/prox\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(https?)\/(.+)/) || false;
    var qm = qm && {type: qm[1], module: qm[2], vars: qm[3], protocol: qm[4], file: qm[5]};

    if (!qm || !/^(?:common-js|json|js)$/) {
        endres(res, 400, '400 Bad Request')
        return;
    };

    var url = (qm.protocol === 'https' ? 'https://' : 'http://') + qm.file;
    qm.url = url;

    load(url,
        , {
            authorization: req.headers['authorization'],
            X_Forwarded_For: req.X_Forwarded_For
        }

        , function(status, result) {
            result.get(
                [
                    {
                        name: 'prox-' + qm.type,
                        module: qm.module,
                        type: qm.type,
                        vars: qm.vars
                    }
                ]
                , function(status, data) {

                }
            )

        }
    )


};


function endres(res, status, data) {
    var text = {
        '204': '204 No Content',
        '400': '400 Bad Request',
        '404': '404 Not Found'
    };

    switch(status) {
        case 'css':
            break;

        case 'js':
            break;

        case 301: case 302:
            res.writeHead(status
                , {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Location': data
                }
            );

            res.end();
            break;

        case 204: break;
        case 404: break;
        case 400: break;
        default:
            status = 400;
    };

    res.writeHead(status
        , {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Expires': 'Thu, 01 Jan 1970 00:00:01 GMT'
        }
    );

    res.end(data || text[status] || '// ups');
};

var pResult = fileResult.prototype

pResult['prox-common-js'] = function(op, data, end) {

};

