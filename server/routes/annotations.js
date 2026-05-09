const createErrorResponse = (status, message, extra = {}) => ({
    status: 'error',
    message,
    ...extra
});

module.exports = (register, context) => {
    const {
        logger,
        json,
        ensureAuthorized,
        readAnnotationsFile,
        writeAnnotationsFile,
        collectBody,
        normalizeString,
        broadcastSse
    } = context;

    const log = logger.child('[annotations]');

    register('GET', '/api/annotations', async (_req, res) => {
        const annotations = await readAnnotationsFile();
        json(res, 200, { status: 'ok', annotations });
    });

    register('POST', '/api/annotations', async (req, res) => {
        if (!(await ensureAuthorized(req, res, 'user'))) {
            return;
        }
        let payload;
        try {
            payload = JSON.parse(await collectBody(req) || '{}');
        } catch (error) {
            json(res, 400, createErrorResponse('error', 'Invalid JSON'));
            return;
        }

        const rawX = payload?.x ?? payload?.coords?.x;
        const rawY = payload?.y ?? payload?.coords?.y;
        const x = Number(rawX);
        const y = Number(rawY);
        const label = normalizeString(payload?.label);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !label) {
            json(res, 400, createErrorResponse('error', 'Annotation invalide: champs x, y et label requis.'));
            return;
        }

        const color = normalizeString(payload?.color) || '#ff8a00';
        const icon = normalizeString(payload?.icon) || null;
        const scope = normalizeString(payload?.scope) || 'public';
        const expiresAt = payload?.expiresAt ? new Date(payload.expiresAt).toISOString() : null;

        const annotation = {
            id: payload?.id && normalizeString(payload.id) ? normalizeString(payload.id) : `annotation_${Date.now()}`,
            x,
            y,
            label,
            color,
            icon,
            scope,
            createdAt: new Date().toISOString(),
            expiresAt
        };

        const annotations = await readAnnotationsFile();
        annotations.push(annotation);
        await writeAnnotationsFile(annotations);
        broadcastSse('annotation.created', { annotation });
        json(res, 201, { status: 'ok', annotation });
    });

    register('DELETE', /^\/api\/annotations\/(?<id>[^/]+)$/, async (req, res, _urlObj, params) => {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
            return;
        }
        const rawAnnotationId = params?.id || params?.groups?.id || params?.[1];
        let annotationId = '';
        try {
            annotationId = normalizeString(decodeURIComponent(rawAnnotationId || ''));
        } catch (error) {
            annotationId = normalizeString(rawAnnotationId || '');
        }
        if (!annotationId) {
            json(res, 400, createErrorResponse('error', 'Annotation ID manquant.'));
            return;
        }

        const annotations = await readAnnotationsFile();
        let deletedAnnotation = null;
        const next = annotations.filter(item => {
            const itemId = normalizeString(item?.id);
            const shouldDelete = itemId === annotationId;
            if (shouldDelete) {
                deletedAnnotation = item;
            }
            return !shouldDelete;
        });
        if (next.length === annotations.length) {
            json(res, 404, createErrorResponse('error', 'Annotation introuvable.'));
            return;
        }
        await writeAnnotationsFile(next);
        broadcastSse('annotation.deleted', { id: annotationId, annotation: deletedAnnotation });
        json(res, 204, null);
    });
};
