const path = require('path');
const pkg = require('./package.json');
const webpack = require('webpack');

const config = {
    mode: 'production',
    target: 'webworker',
    entry: './dist/worker.js',
    output: {
        path: path.resolve(__dirname, 'build'),
        publicPath: "build",
        filename: 'worker.js',
    },
    optimization: {
        minimize: false
      },
    plugins: [
        // new webpack.ProvidePlugin({
        //     Buffer: ['buffer', 'Buffer'],
        // }),
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer'],
        }),
        // new webpack.EnvironmentPlugin({
        //     NODE_ENV: 'production',
        //     DEBUG: false,
        //     READABLE_STREAM: '',
        // }),
        new webpack.DefinePlugin({
            __NAME__: JSON.stringify(pkg.name),
            __VERSION__: JSON.stringify(pkg.version),
            __COMPILED_AT__: JSON.stringify(new Date()),
            // 'process.env.NODE_ENV': JSON.stringify('development'),
            // 'process.env.DEBUG': JSON.stringify(false),
            // 'process.env.READABLE_STREAM': JSON.stringify(''),
        })
    ],
    resolve: {
        fallback: {
            buffer: require.resolve('buffer'),
            crypto: require.resolve('crypto-browserify'),
            path: require.resolve('path-browserify'),
            stream: require.resolve('stream-browserify'),
            fs: require.resolve('browserify-fs'),
            vm: require.resolve( 'vm-browserify'),
            // crypto: require.resolve('node:crypto'),
            // path: require.resolve('node:path'),
            // stream: require.resolve('node:stream'),
            // fs: require.resolve('node:fs'),
            'process/browser': require.resolve('process/browser'),
            // buffer: require.resolve('node:buffer'),
            // crypto: require.resolve('node:crypto'),
            // path: require.resolve('node:path'),
            // stream: require.resolve('node:stream'),
            // fs: require.resolve('node:fs'),
            // vm: require.resolve( 'node:vm')
        }
    },
    performance: {
        hints: false,
    },
};

module.exports = config;