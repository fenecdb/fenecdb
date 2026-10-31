// A fennec-server of a test's own: the crash test kills it, the benchmark
// starts one per sync policy. The binary is FENNEC_SERVER, or this
// repository's release build, or its debug build.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_TOKEN, OPERATOR_TOKEN } from '../src/config.ts';
import { JWT_SECRET } from '../src/tokens.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const POLICY = fileURLToPath(new URL('../policy.txt', import.meta.url));

export function serverBinary(): string {
  const found = [process.env.FENNEC_SERVER, join(root, 'target/release/fennec-server'), join(root, 'target/debug/fennec-server')].find(
    (b) => b && existsSync(b),
  );
  if (!found) throw new Error('no fennec-server: cargo build --release -p fennec-server, or set FENNEC_SERVER');
  return found;
}

export interface Node {
  url: string;
  child: ChildProcess;
  log: () => string;
  /** SIGKILL, and wait for the process to be gone. */
  kill9(): Promise<void>;
  /** SIGTERM: the server syncs and checkpoints before it exits. */
  stop(): Promise<void>;
}

/**
 * The server on a port the system picks, which it names on its `listening
 * on:` line: a port found free and handed over was free only until someone
 * else took it, and a server of someone else's could answer in its place.
 */
export async function startNode(opts: { dir: string; sync: string; extra?: string[] }): Promise<Node> {
  mkdirSync(opts.dir, { recursive: true });
  const secret = join(opts.dir, '..', `${opts.dir.split('/').pop()}.jwt`);
  writeFileSync(secret, JWT_SECRET, { mode: 0o600 });
  const args = [
    '--dir',
    opts.dir,
    '--http',
    '127.0.0.1:0',
    '--admin-token',
    ADMIN_TOKEN,
    '--replication-token',
    'ledger-test-replication',
    '--jwt-secret-file',
    secret,
    '--policy',
    POLICY,
    '--sync',
    opts.sync,
    ...(opts.extra ?? []),
  ];
  const child = spawn(serverBinary(), args, {
    env: { ...process.env, FENNEC_HTTP_TOKEN: OPERATOR_TOKEN },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout!.on('data', (d) => (out += d));
  child.stderr!.on('data', (d) => (out += d));
  const exited = new Promise<void>((r) => child.on('exit', () => r()));
  // Read to the space after the address, so a line that came in two
  // pieces is not read short.
  const url = await new Promise<string>((resolve, reject) => {
    const t0 = Date.now();
    const look = () => {
      const at = /listening on: (http:\/\/\S+)\s/.exec(out);
      if (at) return resolve(at[1]);
      if (child.exitCode !== null) return reject(new Error(`fennec-server exited: ${out}`));
      if (Date.now() - t0 > 30_000) return reject(new Error(`fennec-server did not start: ${out}`));
      setTimeout(look, 20);
    };
    look();
  });
  return {
    url,
    child,
    log: () => out,
    kill9: async () => {
      child.kill('SIGKILL');
      await exited;
    },
    stop: async () => {
      child.kill('SIGTERM');
      await exited;
    },
  };
}
