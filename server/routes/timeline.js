module.exports = (register, context) => {
    const { json, readTimelineFile, writeTimelineFile, ensureAuthorized, collectBody } = context;
    const adminTimelinePaths = ['/api/admin/timeline-config', '/api/admin/timeline'];
    const sortTimelineEntries = entries => (
        Array.isArray(entries)
            ? entries
                .map((entry, index) => ({ entry, index }))
                .sort((left, right) => {
                    const leftYear = Number(left.entry?.year);
                    const rightYear = Number(right.entry?.year);
                    const leftSafeYear = Number.isFinite(leftYear) ? leftYear : left.index;
                    const rightSafeYear = Number.isFinite(rightYear) ? rightYear : right.index;
                    return leftSafeYear - rightSafeYear || left.index - right.index;
                })
                .map(item => item.entry)
            : []
    );

    register('GET', '/api/timeline', async (_req, res) => {
        const timeline = await readTimelineFile();
        const visibleEntries = Array.isArray(timeline?.entries)
            ? timeline.entries.filter(entry => entry?.visible !== false)
            : [];
        json(res, 200, {
            status: 'ok',
            timeline: {
                ...timeline,
                entries: sortTimelineEntries(visibleEntries)
            }
        });
    });

    adminTimelinePaths.forEach(path => {
        register('GET', path, async (req, res) => {
            if (!(await ensureAuthorized(req, res, 'admin'))) {
                return;
            }
            const timeline = await readTimelineFile();
            json(res, 200, { status: 'ok', timeline });
        });

        register('PATCH', path, async (req, res) => {
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

        register('PUT', path, async (req, res) => {
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
    });
};
