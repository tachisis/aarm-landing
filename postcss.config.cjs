module.exports = {
  plugins: {
    // Must run first so @import inlining happens before transforms.
    "postcss-import": {},
    "postcss-preset-env": {
      stage: 2,
      features: {
        // Explicit nesting (also covered by stage 2; keeps intent obvious).
        "nesting-rules": true,
      },
    },
  },
};
