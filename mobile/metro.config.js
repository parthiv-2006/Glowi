// Sentry's Metro config is the stock Expo one plus source-map generation, which is
// what turns a production stack trace from minified noise into a file and a line.
// Required by @sentry/react-native; drop this file and the traces stop being readable.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
