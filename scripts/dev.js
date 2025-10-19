const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

// Check if a port is free
function checkPort(port) {
  return new Promise((resolve) => {
    const srv = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => srv.once('close', () => resolve(true)).close())
      .listen(port);
  });
}

function spawnCmd(cmd, args, opts) {
  const p = spawn(cmd, args, opts);
  p.stdout.setEncoding('utf8');
  p.stderr.setEncoding('utf8');
  return p;
}

async function main() {
  const prefers = [3000, 3001];
  let port = null;
  for (const p of prefers) {
    // eslint-disable-next-line no-await-in-loop
    const free = await checkPort(p);
    if (free) {
      port = p;
      break;
    }
  }
  if (!port) port = 3001;

  console.log(`Starting dev: backend + frontend (frontend on ${port})`);

  const root = path.resolve(__dirname, '..');

  const backend = spawnCmd('npm', ['-w', 'backend', 'run', 'dev'], { cwd: root, shell: true });
  const frontendScript = port === 3001 ? 'dev:3001' : 'dev';
  const frontend = spawnCmd('npm', ['-w', 'frontend', 'run', frontendScript], {
    cwd: root,
    shell: true,
  });

  let backendReady = false;
  let frontendReady = false;
  const timeoutMs = 30000; // 30s

  function markBackendReady() {
    backendReady = true;
    checkAllReady();
  }
  function markFrontendReady() {
    frontendReady = true;
    checkAllReady();
  }

  function checkAllReady() {
    if (backendReady || frontendReady) {
      // At least one service ready -> ensure process will exit 0 when appropriate
      process.exitCode = 0;
    }
  }

  function handleStream(p, name) {
    p.stdout.on('data', (data) => {
      const text = data.toString();
      if (text.includes('Unhandled error')) {
        // show actual server errors
        process.stdout.write(`[${name}] ${text}`);
        return;
      }
      if (name === 'backend' && text.toLowerCase().includes('listening')) markBackendReady();
      if (name === 'frontend' && (text.includes('Ready') || text.includes('Local:')))
        markFrontendReady();
      // filter noisy npm workspace errors
      if (
        text.includes('ENOWORKSPACES') ||
        text.includes('This command does not support workspaces')
      )
        return;
      // filter noisy EADDRINUSE messages and stack lines from npm
      if (text.includes('EADDRINUSE') || text.includes('listen EADDRINUSE')) return;
      process.stdout.write(`[${name}] ${text}`);
    });
    p.stderr.on('data', (data) => {
      const text = data.toString();
      if (
        text.includes('ENOWORKSPACES') ||
        text.includes('This command does not support workspaces')
      )
        return;
      if (text.includes('EADDRINUSE') || text.includes('listen EADDRINUSE')) return;
      // suppress verbose npm stack traces
      if (text.match(/\bat\s+Function\.|\bat\s+Object\.|\bnode:internal/)) return;
      process.stderr.write(`[${name}] ${text}`);
    });
  }

  handleStream(backend, 'backend');
  handleStream(frontend, 'frontend');

  // If neither ready within timeout, exit with error
  const timer = setTimeout(() => {
    if (!backendReady && !frontendReady) {
      console.error('Neither backend nor frontend started within timeout. Exiting with error.');
      process.exitCode = 1;
      // kill children
      backend.kill();
      frontend.kill();
      process.exit(1);
    }
  }, timeoutMs);

  // keep process alive even if children output stops
  process.stdin.resume();

  // cleanup on SIGINT
  process.on('SIGINT', () => {
    clearTimeout(timer);
    backend.kill('SIGINT');
    frontend.kill('SIGINT');
    process.exit(0);
  });

  // if a child exits, do not immediately kill everything unless both fail
  let backendExited = false;
  let frontendExited = false;
  backend.on('exit', (code) => {
    backendExited = true;
    // if both exited and none were ready -> failure
    if (frontendExited && !backendReady && !frontendReady) {
      console.error('Both backend and frontend exited before starting. Exiting with error.');
      process.exit(1);
    }
    // if backend exited but frontend is running or ready, keep process alive
  });
  frontend.on('exit', (code) => {
    frontendExited = true;
    if (backendExited && !backendReady && !frontendReady) {
      console.error('Both backend and frontend exited before starting. Exiting with error.');
      process.exit(1);
    }
    // if frontend exited but backend is running or ready, keep process alive
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
