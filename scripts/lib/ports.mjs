// Port helpers for local development.
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';

/** Free only if nothing listens on it on any interface (a Docker 0.0.0.0 bind counts). */
export async function isPortFree(port) {
  for (const host of ['127.0.0.1', '0.0.0.0']) {
    if (!(await canListen(port, host))) return false;
  }
  return true;
}

function canListen(port, host) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen({ port, host, exclusive: true }, () => server.close(() => resolve(true)));
  });
}

/** Ports published by this project's own running containers (they are ours, not a clash). */
export function portsOwnedByCompose() {
  try {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- local dev tool: runs the developer's docker, pnpm and node
    const output = execFileSync('docker', ['compose', 'ps', '--format', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const containers = output
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    return new Set(
      containers.flatMap((c) => (c.Publishers ?? []).map((p) => p.PublishedPort)).filter(Boolean),
    );
  } catch {
    return new Set();
  }
}
