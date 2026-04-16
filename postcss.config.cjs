module.exports = (ctx) => {
  const isProd = ctx?.env === "production";

  return {
    plugins: {
      // Must run first so @import inlining happens before transforms.
      "postcss-import": {},
      // Expands @extend rules after all imports are inlined.
      "postcss-extend-rule": {},
      "postcss-preset-env": {
        stage: 2,
        features: {
          // Explicit nesting (also covered by stage 2; keeps intent obvious).
          "nesting-rules": true,
        },
      },
      ...(isProd
        ? {
            cssnano: {
              preset: "default",
            },
          }
        : {}),
    },
  };
};
