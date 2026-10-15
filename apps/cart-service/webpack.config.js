const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/cart-service'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      // Off on purpose: each service's Prisma client is generated into
      // node_modules/@ecom-db/* and is not an installable package, so a generated
      // package.json would list a dependency npm cannot resolve. The Dockerfile
      // installs the workspace's node_modules and runs `prisma generate` instead.
      generatePackageJson: false,
      sourceMap: true,
      externalDependencies: 'all',
    }),
  ],
};
