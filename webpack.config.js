// const CopyPlugin = require('copy-webpack-plugin')
const path = require('path');
const pkg = require('./package.json');
const webpack = require('webpack');

const config = {
    mode: 'production',
    target: 'webworker',
    entry: './dist/worker.js',
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: 'worker.js'
    },
    optimization: {
        minimize: false,
    },
    plugins: [
        // new CopyPlugin([
        //     { from: './build/out.wasm', to: './worker/module.wasm' },
        //   ]),
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
        new webpack.DefinePlugin({
            __NAME__: JSON.stringify(pkg.name),
            __VERSION__: JSON.stringify(pkg.version),
            __COMPILED_AT__: JSON.stringify(new Date()),
        }),
        // new webpack.ProvidePlugin({
        //     TextDecoder: ['text-encoding', 'TextDecoder'],
        //     TextEncoder: ['text-encoding', 'TextEncoder']
        //   })
    ],
    resolve: {
        fallback: {
            buffer: require.resolve('buffer'),
            crypto: require.resolve('crypto-browserify'),
            stream: require.resolve('stream-browserify'),
            vm: require.resolve("vm-browserify")
        },
    },
    performance: {
        hints: false,
    },
};

module.exports = config;