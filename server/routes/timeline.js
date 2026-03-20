module.exports = (register, context) => {
    const { json, readTimelineFile, writeTimelineFile, ensureAuthorized, collectBody } = context;

    register('GET', '/api/timeline', async (_req, res) => {
        const timeline = await readTimelineFile();
        json(res, 200, {
            status: 'ok',
            timeline: {
                ...timeline,
                entries: Array.isArray(timeline?.entries) ? timeline.entries.filter(entry => entry?.visible !== false) : []
            }
        });
    });

    register('GET', '/api/admin/timeline', async (req, res) => {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
            return;
        }
        const timeline = await readTimelineFile();
        json(res, 200, { status: 'ok', timeline });
    });

    register('PATCH', '/api/admin/timeline', async (req, res) => {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
            return;
        }
        let payload;
        try {
            payload = JSON.parse(await collectBody(req) || '{}');
        } catch (error) {
            json(res, 400, { status: 'error', message: 'Invalid JSON' });
            return;
        }
        const nextTimeline = payload?.timeline && typeof payload.timeline === 'object' ? payload.timeline : payload;
        await writeTimelineFile(nextTimeline);
        const timeline = await readTimelineFile();
        json(res, 200, { status: 'ok', timeline });
    });

    register('PUT', '/api/admin/timeline', async (req, res) => {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
            return;
        }
        let payload;
        try {
            payload = JSON.parse(await collectBody(req) || '{}');
        } catch (error) {
            json(res, 400, { status: 'error', message: 'Invalid JSON' });
            return;
        }
        const nextTimeline = payload?.timeline && typeof payload.timeline === 'object' ? payload.timeline : payload;
        await writeTimelineFile(nextTimeline);
        const timeline = await readTimelineFile();
        json(res, 200, { status: 'ok', timeline });
    });
};
