const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({ target: 'http://localhost:8001' });

const server = http.createServer((req, res) => {
  proxy.web(req, res);
});

proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  res.writeHead(502, { 'Content-Type': 'text/plain' });
  res.end('Bad Gateway');
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Proxy server running on port 3000 -> 8001');
});
