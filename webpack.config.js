const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

const paths = {
  src: path.resolve(__dirname, 'src'),
  build: path.resolve(__dirname, 'dist'),
  html: path.resolve(__dirname, 'src/index.html'),
  icon: path.resolve(__dirname, 'src/favicon.ico'),
  node_modules: path.resolve(__dirname, 'node_modules'),
};

// External request blocking proxy configuration
const createExternalBlockingProxy = () => {
  const allowedExternalDomains = [
    // Add allowed external domains here
    // 'api.yourdomain.com',
    // 'cdn.jsdelivr.net',
  ];

  const isAllowedExternal = (hostname) => {
    return allowedExternalDomains.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
  };

  const isStaticResource = (pathname) => {
    return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp|avif|mp4|webm|ogg|mp3|wav|flac|aac|json|xml|txt)$/i.test(pathname);
  };

  return {
    // Catch-all proxy to block external requests
    '**': {
      target: 'http://localhost:8000',
      router: (req) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        
        // Allow local/same-origin requests
        if (url.hostname === 'localhost' || 
            url.hostname === '127.0.0.1' || 
            url.hostname === '0.0.0.0' ||
            url.hostname === req.headers.host?.split(':')[0]) {
          return 'http://localhost:8000';
        }
        
        // Block external requests unless allowed
        if (!isAllowedExternal(url.hostname) && !isStaticResource(url.pathname)) {
          return null; // This will cause the proxy to reject the request
        }
        
        return 'http://localhost:8000';
      },
      changeOrigin: true,
      onProxyReq: (proxyReq, req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        
        // Block external requests
        if (url.hostname !== 'localhost' && 
            url.hostname !== '127.0.0.1' && 
            url.hostname !== '0.0.0.0' &&
            url.hostname !== req.headers.host?.split(':')[0] &&
            !isAllowedExternal(url.hostname) &&
            !isStaticResource(url.pathname)) {
          
          console.log(`🚫 Blocked external request: ${req.method} ${req.url}`);
          
          // Send blocked response
          res.writeHead(200, { 
            'Content-Type': 'application/json',
            'X-Request-Blocked': 'true'
          });
          res.end(JSON.stringify({
            blocked: true,
            url: req.url,
            method: req.method,
            reason: 'External request blocked by webpack proxy',
            timestamp: new Date().toISOString()
          }));
          return;
        }
      },
      onError: (err, req, res) => {
        console.log(`✅ Proxy error (likely blocked): ${req.method} ${req.url}`);
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'X-Request-Blocked': 'true'
        });
        res.end(JSON.stringify({
          blocked: true,
          url: req.url,
          method: req.method,
          reason: 'External request blocked by webpack proxy',
          timestamp: new Date().toISOString()
        }));
      }
    }
  };
};

function common() {
  return {
    mode: 'development',
    devtool: 'cheap-module-source-map',
    devServer: {
      hot: true,
      port: 8000,
      https: true,
      host: '0.0.0.0',
      useLocalIp: true,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
      // Add proxy configuration to block external requests
      proxy: createExternalBlockingProxy(),
      // Enable logging for debugging
      onBeforeSetupMiddleware: (devServer) => {
        devServer.app.use((req, res, next) => {
          console.log(`📡 Request: ${req.method} ${req.url}`);
          next();
        });
      },
    },
    target: 'web',
    entry: [paths.src],
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      modules: [paths.src, paths.node_modules],
    },
    experiments: { asyncWebAssembly: true },
    module: {
      rules: [
        { test: /\.tsx?$/, loader: 'ts-loader' },
        {
          test: /\.svg$/,
          use: [
            {
              loader: '@svgr/webpack',
              options: {
                svgo: false,
                ref: true,
              },
            },
            {
              loader: 'file-loader',
              options: {
                name: 'static/assets/[name].[ext]',
                esModule: false,
              },
            },
          ],
          exclude: paths.node_modules,
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({ template: paths.html, favicon: paths.icon }),
      new CopyPlugin({
        patterns: [
          {
            from: path.resolve(paths.node_modules, '@biosensesignal/web-sdk/dist'),
            to: path.resolve(paths.build),
            globOptions: {
              ignore: ['**/main.*'],
            },
          },
          // Copy both service workers
          {
            from: path.resolve(paths.src, 'sw.js'),
            to: path.resolve(paths.build, 'sw.js'),
          },
          {
            from: path.resolve(paths.src, 'sw-external-blocker.js'),
            to: path.resolve(paths.build, 'sw-external-blocker.js'),
          },
        ],
      }),
    ],
  };
}

module.exports = () => common();
