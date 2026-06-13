// babel-preset-expo (SDK 56) automatically wires the react-native-worklets
// plugin required by Reanimated 4 when reanimated is installed, so no manual
// plugin entry is needed. This explicit config makes the toolchain obvious.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
