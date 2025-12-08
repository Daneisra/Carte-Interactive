const createErrorResponse = (status, message, extra = {}) => ({
    status: 'error',
    message,
    ...extra
});

const extractProgress = payload => {
    if (!payload || typeof payload !== 'object') {
        return null;
    }
    return {
        current: Number(payload.current) || 0,
        max: Number(payload.max) || null
    };
};

module.exports = (register, context) => {
    const {
        logger,
        json,
        ensureAuthorized,
        readQuestEventsFile,
        writeQuestEventsFile,
        collectBody,
        normalizeString,
        broadcastSse
    } = context;

    const log = logger.child('[questEvents]');

    register('GET', '/api/quest-events', async (_req, res) => {
        const events = await readQuestEventsFile();
        json(res, 200, { status: 'ok', events });
    });

    register('POST', '/api/quest-events', async (req, res) => {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
            return;
        }
        let payload;
        try {
            payload = JSON.parse(await collectBody(req) || '{}');
        } catch (error) {
            json(res, 400, createErrorResponse('error', 'Invalid JSON'));
            return;
        }
        const questId = normalizeString(payload?.questId);
        const locationName = normalizeString(payload?.locationName);
        const status = normalizeString(payload?.status);
        const milestone = normalizeString(payload?.milestone);
        if (!questId || !locationName || !status) {
            json(res, 400, createErrorResponse('error', 'Champs questId, locationName et status requis.'));
            return;
        }
        const progress = extractProgress(payload?.progress);
        const note = normalizeString(payload?.note) || '';
        const event = {
            id: payload?.id && normalizeString(payload.id) ? normalizeString(payload.id) : `quest_${Date.now()}`,
            questId,
            locationName,
            status,
            milestone: milestone || null,
            progress,
            note,
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        const events = await readQuestEventsFile();
        events.push(event);
        await writeQuestEventsFile(events);
        broadcastSse('quest.updated', { event });
        json(res, 201, { status: 'ok', event });
    });

    register('PATCH', /^\/api\/quest-events\/(?<id>[^/]+)$/, async (req, res, _urlObj, params) => {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
            return;
        }
        let payload;
        try {
            payload = JSON.parse(await collectBody(req) || '{}');
        } catch (error) {
            json(res, 400, createErrorResponse('error', 'Invalid JSON'));
            return;
        }
        const questEventId = params?.groups ? params.groups.id : params[1];
        const events = await readQuestEventsFile();
        const index = events.findIndex(event => event?.id === questEventId);
        if (index === -1) {
            json(res, 404, createErrorResponse('error', 'Evenement de quete introuvable.'));
            return;
        }
        const current = events[index];
        const partial = typeof payload === 'object' ? payload : {};
        const questId = normalizeString(partial.questId) || current.questId;
        const locationName = normalizeString(partial.locationName) || current.locationName;
        const status = normalizeString(partial.status) || current.status;
        if (!questId || !locationName || !status) {
            json(res, 400, createErrorResponse('error', 'Champs questId, locationName et status requis.'));
            return;
        }
        const updated = {
            ...current,
            questId,
            locationName,
            status,
            milestone: normalizeString(partial.milestone) || current.milestone || null,
            note: normalizeString(partial.note) || current.note || '',
            progress: partial.progress ? extractProgress(partial.progress) : current.progress,
            updatedAt: new Date().toISOString()
        };
        events[index] = updated;
        await writeQuestEventsFile(events);
        broadcastSse('quest.updated', { event: updated });
        json(res, 200, { status: 'ok', event: updated });
    });

    register('DELETE', /^\/api\/quest-events\/(?<id>[^/]+)$/, async (req, res, _urlObj, params) => {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
            return;
        }
        const questEventId = params?.groups ? params.groups.id : params[1];
        const events = await readQuestEventsFile();
        const index = events.findIndex(event => event?.id === questEventId);
        if (index === -1) {
            json(res, 404, createErrorResponse('error', 'Evenement de quete introuvable.'));
            return;
        }
        const existing = events[index];
        events.splice(index, 1);
        await writeQuestEventsFile(events);
        broadcastSse('quest.deleted', { id: questEventId });
        json(res, 200, { status: 'ok', event: existing });
    });
};
