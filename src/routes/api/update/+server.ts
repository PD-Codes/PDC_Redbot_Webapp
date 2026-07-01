import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';
import { env } from '$env/dynamic/private';

const LOG_FILE = path.join(process.cwd(), '.update.log');
const DONE_MARKER = '===UPDATE_DONE===';
const ERROR_MARKER = '===UPDATE_ERROR===';
const RESTART_SKIPPED_MARKER = '===RESTART_SKIPPED===';
const MIGRATION_MARKER = '===MIGRATION_RECOMMENDED===';
const LEGACY_MARKER = '===LEGACY_INSTALL===';

// Eindeutige ID dieses Server-Prozesses. Ändert sich bei jedem (Neu-)Start →
// die /system-Seite erkennt daran zuverlässig, dass der Dienst neu gestartet ist,
// und lädt dann selbst neu (unabhängig davon, ob das kurze Down-Fenster getroffen wurde).
const BOOT_ID = `${process.pid}-${Date.now()}`;

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

// Status abfragen: liefert das bisherige Log + ob der Build fertig ist.
export const GET: RequestHandler = async ({ locals }) => {
  const err = await requireOwner(locals);
  if (err) return json({ error: err }, { status: err === 'unauthorized' ? 401 : 403 });
  let log = '';
  try {
    log = fs.readFileSync(LOG_FILE, 'utf8');
  } catch {
    /* noch kein Log */
  }
  return json({
    log: log.slice(-6000),
    done: log.includes(DONE_MARKER),
    failed: log.includes(ERROR_MARKER),
    restartSkipped: log.includes(RESTART_SKIPPED_MARKER),
    migrationRecommended: log.includes(MIGRATION_MARKER),
    legacyInstall: log.includes(LEGACY_MARKER),
    boot: BOOT_ID
  });
};

// Update starten (owner-only, opt-in).
export const POST: RequestHandler = async ({ locals }) => {
  const err = await requireOwner(locals);
  if (err) return json({ error: err }, { status: err === 'unauthorized' ? 401 : 403 });

  if ((env.ENABLE_SELF_UPDATE ?? '').toLowerCase() !== 'true') {
    return json(
      {
        error:
          'Self-Update ist deaktiviert. Setze ENABLE_SELF_UPDATE=true in der .env und erlaube ' +
          'dem Dienst-User den Service-Neustart (sudoers/polkit NOPASSWD für den aktiven Dienst, ' +
          'z. B. `systemctl restart pdc-redbot-webapp` bzw. Legacy `dks-dashboard`).'
      },
      { status: 400 }
    );
  }

  try {
    fs.writeFileSync(LOG_FILE, `Update gestartet: ${new Date().toISOString()}\n`);
    const out = fs.openSync(LOG_FILE, 'a');
    const child = spawn('bash', ['deploy/update.sh'], {
      cwd: process.cwd(),
      detached: true,
      stdio: ['ignore', out, out]
    });
    child.unref();
    return json({ ok: true, message: 'Update gestartet.' });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Start fehlgeschlagen' }, { status: 500 });
  }
};
