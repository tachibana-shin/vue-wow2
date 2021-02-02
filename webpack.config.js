const { resolve } = require('path')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = {
   entry: resolve(__dirname, 'src/index.js'),
   output: {
      path: resolve(__dirname, 'dist'),
      filename: 'vue-wow2.js'
   },
   plugins: [
        new UglifyJsPlugin({
         exclude: [/\.min\.js$/gi] // skip pre-minified libs
      })
    ],
   module: {
      rules: [
         {
            test: /\.m?js$/,
            exclude: /(node_modules|bower_components)/,
            use: {
               loader: 'babel-loader',
               options: {
                  presets: ['@babel/preset-env'],
                  plugins: ['@babel/plugin-proposal-object-rest-spread']
               }
            }
         },
         {
           test: /\.css$/i,
           use: ["style-loader", "css-loader"],
         }
      ]
   }
}
