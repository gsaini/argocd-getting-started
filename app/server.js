'use strict';

const http = require('http');
const os = require('os');

// ---------------------------------------------------------------------------
// Two classes of configuration, on purpose:
//
//   1. BAKED-IN at build time (identical in every environment) ----------------
//      VERSION / GIT_SHA / BUILD_TIME are passed as Docker build args and frozen
//      into the image. They prove that dev, staging and prod all run the *same*
//      artifact -- this is the "build once" half of the demo.
//
//   2. INJECTED at deploy time (differs per environment) ----------------------
//      APP_ENV (and friends) come from the Kustomize overlay's ConfigMap. They
//      prove that only configuration changes between environments -- this is the
//      "deploy many" half of the demo.
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 8080;

const BUILD = {
  version: process.env.APP_VERSION || 'dev',
  gitSha: process.env.GIT_SHA || 'unknown',
  buildTime: process.env.BUILD_TIME || 'unknown',
};

const RUNTIME = {
  env: process.env.APP_ENV || 'local',
  greeting: process.env.APP_GREETING || 'Hello from Argo CD',
  pod: process.env.POD_NAME || os.hostname(),
  namespace: process.env.POD_NAMESPACE || 'n/a',
};

const ENV_COLORS = {
  local: '#6b7280',
  dev: '#3b82f6',
  staging: '#f59e0b',
  prod: '#10b981',
};

function payload() {
  return {
    message: RUNTIME.greeting,
    environment: RUNTIME.env,
    build: BUILD,
    runtime: { pod: RUNTIME.pod, namespace: RUNTIME.namespace },
  };
}

function htmlPage() {
  const color = ENV_COLORS[RUNTIME.env] || ENV_COLORS.local;
  const env = RUNTIME.env.toUpperCase();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Argo CD demo &middot; ${env}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: radial-gradient(1200px 600px at 50% -10%, #1f2937, #0b1120 60%);
      color: #e5e7eb;
    }
    .card {
      width: min(620px, 92vw); background: #0f172a; border: 1px solid #1e293b;
      border-radius: 16px; padding: 32px; box-shadow: 0 20px 60px rgba(0,0,0,.45);
    }
    .badge {
      display: inline-block; padding: 6px 14px; border-radius: 999px;
      font-weight: 700; letter-spacing: .08em; font-size: 13px;
      background: ${color}22; color: ${color}; border: 1px solid ${color}55;
    }
    h1 { margin: 18px 0 6px; font-size: 26px; }
    p.sub { margin: 0 0 22px; color: #94a3b8; }
    dl { display: grid; grid-template-columns: 160px 1fr; gap: 10px 16px; margin: 0; }
    dt { color: #94a3b8; font-size: 14px; }
    dd { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 14px; word-break: break-all; }
    .hint { margin-top: 24px; padding-top: 18px; border-top: 1px solid #1e293b; color: #64748b; font-size: 13px; }
    code { background: #1e293b; padding: 2px 6px; border-radius: 6px; }
  </style>
</head>
<body>
  <main class="card">
    <span class="badge">${env}</span>
    <h1>${RUNTIME.greeting}</h1>
    <p class="sub">One image, promoted unchanged across environments.</p>
    <dl>
      <dt>Build version</dt><dd>${BUILD.version}</dd>
      <dt>Git SHA</dt><dd>${BUILD.gitSha}</dd>
      <dt>Built at</dt><dd>${BUILD.buildTime}</dd>
      <dt>Environment</dt><dd>${RUNTIME.env}</dd>
      <dt>Pod</dt><dd>${RUNTIME.pod}</dd>
      <dt>Namespace</dt><dd>${RUNTIME.namespace}</dd>
    </dl>
    <p class="hint">
      <strong>Build version</strong> and <strong>Git SHA</strong> are baked into the
      image and are identical everywhere. Only <strong>Environment</strong> changes,
      via the Kustomize overlay. Also try <code>/healthz</code> and <code>/api/info</code>.
    </p>
  </main>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];

  if (url === '/healthz' || url === '/readyz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', environment: RUNTIME.env }));
  }

  if (url === '/api/info') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(payload(), null, 2));
  }

  if (url === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(htmlPage());
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log(
    `[${RUNTIME.env}] argocd-getting-started v${BUILD.version} (${BUILD.gitSha}) listening on :${PORT}`
  );
});

// Graceful shutdown so rolling updates are clean.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`received ${sig}, shutting down`);
    server.close(() => process.exit(0));
  });
}
