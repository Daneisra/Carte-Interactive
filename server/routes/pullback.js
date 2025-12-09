const { execFile } = require('child_process');
const path = require('path');

module.exports = (register, context) => {
    const {
        logger,
        json,
        ensureAuthorized,
        assetsPath
    } = context;

    const log = logger.child('[pull-back]');
    const pullbackHost = (process.env.PULLBACK_HOST || process.env.VPS_HOST || '').trim();
    const pullbackUser = (process.env.PULLBACK_USER || process.env.VPS_USER || '').trim();
    const pullbackPath = (process.env.PULLBACK_PATH || `${(process.env.VPS_APP_DIR || '').replace(/\/$/, '')}/assets/`).trim();
    const explicitSource = (process.env.PULLBACK_SOURCE || '').trim(); // ex: user@host:/var/www/app/assets/
    const PULLBACK_SOURCE = explicitSource || (
        pullbackHost && pullbackUser && pullbackPath
            ? `${pullbackUser}@${pullbackHost}:${pullbackPath}`
            : ''
    );
    const PULLBACK_TIMEOUT = Math.max(10_000, Number(process.env.PULLBACK_TIMEOUT_MS) || 60_000);
    const PULLBACK_EXCLUDES = (process.env.PULLBACK_EXCLUDES || 'logs/,icons/README.md').split(',').map(s => s.trim()).filter(Boolean);

    const runRsync = () => new Promise((resolve, reject) => {
        const args = ['-azvr', '--delete'];
        PULLBACK_EXCLUDES.forEach(entry => args.push(`--exclude=${entry}`));
        const destination = path.join(assetsPath, path.sep);
        args.push(PULLBACK_SOURCE, destination);

        const child = execFile('rsync', args, { timeout: PULLBACK_TIMEOUT }, (error, stdout = '', stderr = '') => {
            if (error) {
                reject({ error, stdout, stderr });
                return;
            }
            resolve({ stdout, stderr });
        });

        child.on('error', err => reject({ error: err, stdout: '', stderr: '' }));
    });

    register('POST', '/api/admin/pull-back', async (req, res) => {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
            return;
        }
        if (!PULLBACK_SOURCE) {
            json(res, 501, { status: 'error', message: 'PULLBACK_SOURCE non configure (ex: user@host:/path/assets/).' });
            return;
        }
        try {
            const result = await runRsync();
            log.info('Pull-back termine', { source: PULLBACK_SOURCE, excludes: PULLBACK_EXCLUDES });
            json(res, 200, {
                status: 'ok',
                source: PULLBACK_SOURCE,
                excludes: PULLBACK_EXCLUDES,
                stdout: result.stdout?.slice(-2000) || '',
                stderr: result.stderr?.slice(-2000) || ''
            });
        } catch (failure) {
            const message = failure?.error?.message || 'rsync echoue';
            log.error('Pull-back echoue', { error: message });
            json(res, 500, {
                status: 'error',
                message,
                stderr: failure?.stderr?.slice(-2000) || '',
                stdout: failure?.stdout?.slice(-2000) || ''
            });
        }
    });
};
