const path = require('path');
const fs = require('fs');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: ['./sandbox.js'],
    mode: "development",
    module: {
        rules: [
            {
                test: /\.m?js$/,
                exclude: [/node_modules/],
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ['@babel/preset-env'],
                        plugins: ['@babel/plugin-transform-async-to-generator']
                    }
                }
            }
        ]
    },
    plugins: [
        new CopyWebpackPlugin([
            { from: "lighthouse/**/*.html", to: "/" }
        ])
    ],
    devServer: {
        contentBase: path.join(__dirname, "../../", 'dist'),
        serveIndex: true,
        port: 9000,
    },
    resolve: {
        extensions: ['.js', '.jsx'],
        modules: [
            'node_modules'
        ]
    }
}