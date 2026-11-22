import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

const backendHost = '127.0.0.1';
const backendPort = Number(process.env.INTERNAL_HTTP_PORT || 3000);
const tlsPort = Number(process.env.PORT || 3443);
const certFile = process.env.INTERNAL_TLS_CERT_FILE || '/run/secrets/internal_tls_cert';
const keyFile = process.env.INTERNAL_TLS_KEY_FILE || '/run/secrets/internal_tls_key';
const approvedCiphers = [
  'ECDHE-ECDSA-AES256-GCM-SHA384',
  'ECDHE-RSA-AES256-GCM-SHA384',
  'ECDHE-ECDSA-CHACHA20-POLY1305',
  'ECDHE-RSA-CHACHA20-POLY1305',
  'ECDHE-ECDSA-AES128-GCM-SHA256',
  'ECDHE-RSA-AES128-GCM-SHA256',
].join(':');

for (const file of [certFile, keyFile]) {
  if (!fs.existsSync(file)) {
    throw new Error(`Required internal TLS credential is missing: ${file}`);
  }
}

if (process.env.NODE_ENV === 'production') {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32 || secret.includes('placeholder') || secret.includes('change-me')) {
    throw new Error('FATAL: Insecure or default SESSION_SECRET in production environment');
  }
}

const backend = spawn(process.execPath, ['server.js'], {
  env: {
    ...process.env,
    HOSTNAME: backendHost,
    PORT: String(backendPort),
  },
  stdio: 'inherit',
});

const proxyRequest = (request, response) => {
  const upstream = http.request(
    {
      hostname: backendHost,
      port: backendPort,
      method: request.method,
      path: request.url,
      headers: request.headers,
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );

  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502);
    response.end('Bad Gateway');
  });
  request.pipe(upstream);
};

const server = https.createServer(
  {
    cert: fs.readFileSync(certFile),
    key: fs.readFileSync(keyFile),
    minVersion: 'TLSv1.2',
    ciphers: approvedCiphers,
    honorCipherOrder: true,
  },
  proxyRequest,
);

server.on('upgrade', (request, socket, head) => {
  const upstream = net.connect(backendPort, backendHost, () => {
    const headers = Object.entries(request.headers)
      .map(([name, value]) => `${name}: ${Array.isArray(value) ? value.join(', ') : value}`)
      .join('\r\n');
    upstream.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\n${headers}\r\n\r\n`);
    if (head.length > 0) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
});

server.listen(tlsPort, '0.0.0.0', () => {
  console.log(`[SEC-18] TLS gateway listening on port ${tlsPort}; Next.js is loopback-only`);
});

let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  server.close(() => process.exit(0));
  backend.kill(signal);
  setTimeout(() => process.exit(1), 10_000).unref();
}

backend.on('exit', (code) => {
  if (!stopping) {
    console.error(`[SEC-18] Next.js exited unexpectedly with code ${code ?? 1}`);
    server.close(() => process.exit(code ?? 1));
  }
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
