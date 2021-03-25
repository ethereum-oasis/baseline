const path = require('path')
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');

module.exports = {
  mode: 'production',
  entry: path.resolve(__dirname, 'src', 'index.ts'),
  externals: [
    nodeExternals({
      modulesDir: path.resolve(__dirname, './node_modules'),
    }),
  ],
  output: {
    path: path.resolve(__dirname, 'dist', 'umd'),
    filename: 'index.js',
    libraryTarget: 'umd',
    library: 'shuttle-app',
    globalObject: 'this'
  },
  resolve: {
    extensions: ['.js', '.ts'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: "ts-loader",
        exclude: /(node_modules|test)/,
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      pkg: require('./package.json'),
      window: {},
    }),
  ]
};

