const path = require('path');

module.exports = {
  devtool: 'eval-source-map',
  entry: './src/app.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'public'),
  },
};