/**
 * Created by azu on 2014/09/27.
 * LICENSE : MIT
 */
"use strict";
/**
 *
 * @param {Node} parentNode
 * @param {object} mapping
 * @returns {Object.<string,Node>}
 */
function domMap(parentNode, mapping) {
    var mappingKeys = Object.keys(mapping);
    return mappingKeys.reduce(function (object, key) {
        var selector = mapping[key];
        object[key] = parentNode.querySelector(selector);
        return object;
    }, {});
}
module.exports = domMap;