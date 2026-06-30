import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';
import { env } from '$env/dynamic/private';
import pkg from '../../../../../package.json';

const exec = promisify(execFile);

async function requireOwner(locals: App.Locals): Promise<string | null> {
  if (!locals.user) return 'unauthorized';
  try {
    const ov = await rpc<{ is_owner: boolean }>('dashboard.overview', {}, authFromUser(locals.user));
    if (!ov.is_owner) return 'forbidden';
  } catch (e) {
    return e instanceof RpcError ? e.message : 'Gateway-Fehler';
  }
  return null;
}

// git ohne "dubious ownership"-Abbruch (egal welcher User das Repo besitzt) und ohne
// die globalen ignore/attributes-Dateien zu lesen – analog zu deploy/update.sh.
function gitArgs(cwd: string, rest: string[]): string[] {
  return [
    '-c', `safe.directory=${cwd}`,
    '-c', 'safe.directory=*',
    '-c', 'core.excludesFile=/dev/null',
    '-c', 'core.attributesFile=/dev/null',
    ...rest
  ];
}

// Update-Pruefung: vergleicht die laufende Version (package.json) mit der Version
// aus dem Remote-Branch, ohne das Self-Update auszufuehren. Wirft NIE zur Seite –
// bei Fehlern kommt { available:false, error }.
export const GET: RequestHandler = async ({ locals }) => {
  const err = await requireOwner(locals);
  if (err) return json({ error: err }, { status: err === 'unauthorized' ? 401 : 403 });

  const current = pkg.version;
  const cwd = process.cwd();

  try {
    // Aktuellen Stand des Remotes holen (gleiche Branch-Logik wie deploy/update.sh).
    await exec('git', gitArgs(cwd, ['fetch', '--quiet', '--prune', 'origin']), { cwd });

    const branch =
      env.DEPLOY_BRANCH ||
      (await exec('git', gitArgs(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']), { cwd })).stdout.trim() ||
      'main';

    const { stdout } = await exec('git', gitArgs(cwd, ['show', `origin/${branch}:package.json`]), { cwd });
    const latest: string = JSON.parse(stdout).version ?? '';

    if (!latest) return json({ available: false, current, error: 'Remote-Version nicht gefunden' });

    return json({ available: current !== latest, current, latest });
  } catch (e) {
    return json({
      available: false,
      current,
      error: e instanceof Error ? e.message : 'Pruefung fehlgeschlagen'
    });
  }
};
