module.exports = computeDefault => function get(target, property, receiver) {
    if (!(property in target) && property !== 'toJSON') {
        target[property] = computeDefault(target, property, receiver);
    }
    return target[property];
};