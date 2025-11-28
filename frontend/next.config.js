/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * Extend Webpack configuration to support top-level await, which is
   * required by @arcgis/core ESM modules (SceneView, Map, etc.).
   *
   * This keeps the rest of the build unchanged while allowing ArcGIS
   * to run correctly in the browser bundle.
   */
  webpack: (config) => {
    config.experiments = {
      ...(config.experiments || {}),
      topLevelAwait: true,
    };

    return config;
  },
};

module.exports = nextConfig;
