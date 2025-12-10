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
        normalizeString,
        parseListParam,
        loadSearchFiltersModule,
        readLocationsFile,
        loadTypeMap,
        validateLocationsDataset,
        persistLocations,
        computeLocationsDiff,
        appendAuditLog,
        sendRemoteSync,
        broadcastSse,
        collectBody
    } = context;

    const log = logger.child('[locations]');

    register('GET', '/api/locations/search', async (req, res, urlObj) => {
        try {
            const {
                normalizeFilterState,
                buildLocationIndex,
                prepareFilters,
                locationMatchesFilters,
                buildFilterFacets
            } = await loadSearchFiltersModule();

            const [locationsData, typeData] = await Promise.all([
                readLocationsFile(),
                loadTypeMap()
            ]);

            const entries = [];
            Object.entries(locationsData || {}).forEach(([continent, rawLocations]) => {
                if (!Array.isArray(rawLocations)) {
                    return;
                }
                rawLocations.forEach(location => {
                    const nameKey = normalizeString(location?.name).toLowerCase();
                    const relatedEvents = Array.isArray(location?.questEvents) ? location.questEvents : [];
                    const index = buildLocationIndex(location, { continent, questEvents: relatedEvents });
                    entries.push({
                        location,
                        continent,
                        index,
                        questEvents: relatedEvents
                    });
                });
            });

            const filters = normalizeFilterState({
                text: urlObj.searchParams.get('text') || '',
                types: parseListParam(urlObj.searchParams, 'types'),
                tags: parseListParam(urlObj.searchParams, 'tags'),
                statuses: parseListParam(urlObj.searchParams, 'statuses'),
                quests: urlObj.searchParams.get('quests') || undefined
            });

            const prepared = prepareFilters(filters);
            const matchedEntries = entries.filter(entry => locationMatchesFilters(entry.index, prepared));

            const limitParam = Number(urlObj.searchParams.get('limit')) || 100;
            const limit = Math.max(0, Math.min(250, limitParam));
            const sliced = matchedEntries.slice(0, limit);

            const typeLabels = new Map(Object.entries(typeData || {}));
            const datasetFacets = buildFilterFacets(entries.map(entry => entry.index), { typeLabels });
            const matchedFacets = buildFilterFacets(matchedEntries.map(entry => entry.index), { typeLabels });

            const results = sliced.map(entry => ({
                name: entry.index.name,
                type: entry.index.type,
                continent: entry.index.continent,
                tags: entry.index.tags,
                hasQuests: entry.index.hasQuests,
                eventStatuses: entry.index.eventStatuses,
                coordinates: entry.index.coords,
                quests: Array.isArray(entry.location.quests) ? entry.location.quests : [],
                questEvents: entry.questEvents,
                location: entry.location
            }));

            json(res, 200, {
                status: 'ok',
                filters,
                total: entries.length,
                matched: matchedEntries.length,
                count: results.length,
                limit,
                facets: {
                    dataset: datasetFacets,
                    matched: matchedFacets
                },
                results
            });
        } catch (error) {
            log.error('Search failed', { error: error.message });
            json(res, 500, createErrorResponse('error', 'Recherche indisponible.'));
        }
    });

    register('POST', '/api/locations', async (req, res) => {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
            return;
        }
        let data;
        try {
            data = JSON.parse(await collectBody(req) || '{}');
        } catch (error) {
            json(res, 400, createErrorResponse('error', 'Invalid JSON'));
            return;
        }
        if (!data || typeof data !== 'object' || typeof data.locations !== 'object') {
            json(res, 400, createErrorResponse('error', 'Payload must contain a "locations" object.'));
            return;
        }

        const validation = await validateLocationsDataset(data.locations);
        if (!validation.valid) {
            json(res, 400, { status: 'error', errors: validation.errors.slice(0, 50) });
            return;
        }
        validation.warnings.forEach(message => log.warn(message));

        const normalizedDataset = validation.normalized;
        const previous = await readLocationsFile();
        const diff = computeLocationsDiff(previous, normalizedDataset);

        await persistLocations(normalizedDataset);
        await appendAuditLog({ dataset: normalizedDataset, diff });
        const syncResult = await sendRemoteSync({ dataset: normalizedDataset, diff });
        const totals = {
            continents: Object.keys(normalizedDataset || {}).length,
            locations: Object.values(normalizedDataset || {}).reduce(
                (acc, list) => acc + (Array.isArray(list) ? list.length : 0),
                0
            )
        };
        broadcastSse('locations.sync', {
            timestamp: new Date().toISOString(),
            diff,
            totals,
            sync: syncResult.status
        });
        if (syncResult.status === 'error') {
            const details = (syncResult.error || syncResult.body) || `HTTP ${syncResult.statusCode || 'unknown'}`;
            log.error('Remote export failed', { details });
        }

        json(res, 200, {
            status: 'ok',
            warnings: validation.warnings,
            changes: {
                created: diff.created.length,
                updated: diff.updated.length,
                deleted: diff.deleted.length
            },
            sync: syncResult.status,
            syncStatusCode: syncResult.statusCode ?? null,
            syncError: syncResult.status === 'error'
                ? ((syncResult.error || syncResult.body) || `HTTP ${syncResult.statusCode || 'unknown'}`)
                : null
        });
    });

    register('GET', '/api/admin/locations', async (req, res) => {
        if (!(await ensureAuthorized(req, res, 'user'))) {
            return;
        }
        const dataset = await readLocationsFile();
        json(res, 200, { status: 'ok', locations: dataset });
    });

    register('POST', '/api/admin/locations', async (req, res) => {
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

        const continentRaw = normalizeString(payload?.continent);
        const location = payload?.location;
        if (!continentRaw || !location || typeof location !== 'object') {
            json(res, 400, createErrorResponse('error', 'continent and location are required.'));
            return;
        }
        const name = normalizeString(location.name);
        if (!name) {
            json(res, 400, createErrorResponse('error', 'location.name is required.'));
            return;
        }

        const previous = await readLocationsFile();
        const dataset = { ...previous };
        const continent = continentRaw;
        const targetList = Array.isArray(dataset[continent]) ? [...dataset[continent]] : [];
        const nameKey = name.toLowerCase();
        if (targetList.some(entry => normalizeString(entry?.name).toLowerCase() === nameKey)) {
            json(res, 409, createErrorResponse('error', 'Location already exists in this continent.'));
            return;
        }
        targetList.push(location);
        dataset[continent] = targetList;

        const validation = await validateLocationsDataset(dataset);
        if (!validation.valid) {
            json(res, 400, { status: 'error', errors: validation.errors.slice(0, 50) });
            return;
        }
        validation.warnings.forEach(message => log.warn(message));

        const normalizedDataset = validation.normalized;
        const diff = computeLocationsDiff(previous, normalizedDataset);

        await persistLocations(normalizedDataset);
        await appendAuditLog({ dataset: normalizedDataset, diff });
        const syncResult = await sendRemoteSync({ dataset: normalizedDataset, diff });
        if (syncResult.status === 'error') {
            const details = (syncResult.error || syncResult.body) || `HTTP ${syncResult.statusCode || 'unknown'}`;
            log.error('Remote export failed', { details });
        }
        broadcastSse('locations.sync', {
            timestamp: new Date().toISOString(),
            diff,
            totals: {
                continents: Object.keys(normalizedDataset || {}).length,
                locations: Object.values(normalizedDataset || {}).reduce(
                    (acc, list) => acc + (Array.isArray(list) ? list.length : 0),
                    0
                )
            },
            sync: syncResult.status
        });

        json(res, 200, {
            status: 'ok',
            warnings: validation.warnings,
            continent,
            location,
            changes: diff,
            sync: syncResult.status,
            syncStatusCode: syncResult.statusCode ?? null,
            syncError: syncResult.status === 'error'
                ? ((syncResult.error || syncResult.body) || `HTTP ${syncResult.statusCode || 'unknown'}`)
                : null
        });
    });

    register('PATCH', '/api/admin/locations', async (req, res) => {
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

        const originalContinent = normalizeString(payload?.originalContinent);
        const originalName = normalizeString(payload?.originalName);
        const newContinent = normalizeString(payload?.continent);
        const location = payload?.location;
        if (!originalContinent || !originalName || !newContinent || !location || typeof location !== 'object') {
            json(res, 400, createErrorResponse('error', 'Payload incomplet.'));
            return;
        }
        const newName = normalizeString(location.name);
        if (!newName) {
            json(res, 400, createErrorResponse('error', 'location.name est requis.'));
            return;
        }

        const previous = await readLocationsFile();
        const dataset = { ...previous };
        const sourceList = Array.isArray(dataset[originalContinent]) ? [...dataset[originalContinent]] : [];
        const sourceIndex = sourceList.findIndex(entry => normalizeString(entry?.name).toLowerCase() === originalName.toLowerCase());
        if (sourceIndex === -1) {
            json(res, 404, createErrorResponse('error', 'Location not found.'));
            return;
        }
        sourceList.splice(sourceIndex, 1);
        if (sourceList.length) {
            dataset[originalContinent] = sourceList;
        } else {
            delete dataset[originalContinent];
        }

        const targetList = Array.isArray(dataset[newContinent]) ? [...dataset[newContinent]] : [];
        const newNameKey = newName.toLowerCase();
        if (targetList.some(entry => normalizeString(entry?.name).toLowerCase() === newNameKey)) {
            json(res, 409, createErrorResponse('error', 'Location already exists in target continent.'));
            return;
        }
        targetList.push(location);
        dataset[newContinent] = targetList;

        const validation = await validateLocationsDataset(dataset);
        if (!validation.valid) {
            json(res, 400, { status: 'error', errors: validation.errors.slice(0, 50) });
            return;
        }
        validation.warnings.forEach(message => log.warn(message));

        const normalizedDataset = validation.normalized;
        const diff = computeLocationsDiff(previous, normalizedDataset);

        await persistLocations(normalizedDataset);
        await appendAuditLog({ dataset: normalizedDataset, diff });
        const syncResult = await sendRemoteSync({ dataset: normalizedDataset, diff });
        if (syncResult.status === 'error') {
            const details = (syncResult.error || syncResult.body) || `HTTP ${syncResult.statusCode || 'unknown'}`;
            log.error('Remote export failed', { details });
        }
        broadcastSse('locations.sync', {
            timestamp: new Date().toISOString(),
            diff,
            totals: {
                continents: Object.keys(normalizedDataset || {}).length,
                locations: Object.values(normalizedDataset || {}).reduce(
                    (acc, list) => acc + (Array.isArray(list) ? list.length : 0),
                    0
                )
            },
            sync: syncResult.status
        });

        json(res, 200, {
            status: 'ok',
            warnings: validation.warnings,
            continent: newContinent,
            location,
            changes: diff,
            sync: syncResult.status,
            syncStatusCode: syncResult.statusCode ?? null,
            syncError: syncResult.status === 'error'
                ? ((syncResult.error || syncResult.body) || `HTTP ${syncResult.statusCode || 'unknown'}`)
                : null
        });
    });

    register('DELETE', '/api/admin/locations', async (req, res) => {
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
        const continent = normalizeString(payload?.continent);
        const name = normalizeString(payload?.name);
        if (!continent || !name) {
            json(res, 400, createErrorResponse('error', 'continent et name sont requis.'));
            return;
        }

        const previous = await readLocationsFile();
        const dataset = { ...previous };
        const list = Array.isArray(dataset[continent]) ? [...dataset[continent]] : [];
        const index = list.findIndex(entry => normalizeString(entry?.name).toLowerCase() === name.toLowerCase());
        if (index === -1) {
            json(res, 404, createErrorResponse('error', 'Location not found.'));
            return;
        }
        const removed = list.splice(index, 1)[0];
        if (list.length) {
            dataset[continent] = list;
        } else {
            delete dataset[continent];
        }

        const validation = await validateLocationsDataset(dataset);
        if (!validation.valid) {
            json(res, 400, { status: 'error', errors: validation.errors.slice(0, 50) });
            return;
        }
        validation.warnings.forEach(message => log.warn(message));

        const normalizedDataset = validation.normalized;
        const diff = computeLocationsDiff(previous, normalizedDataset);

        await persistLocations(normalizedDataset);
        await appendAuditLog({ dataset: normalizedDataset, diff });
        const syncResult = await sendRemoteSync({ dataset: normalizedDataset, diff });
        if (syncResult.status === 'error') {
            const details = (syncResult.error || syncResult.body) || `HTTP ${syncResult.statusCode || 'unknown'}`;
            log.error('Remote export failed', { details });
        }
        broadcastSse('locations.sync', {
            timestamp: new Date().toISOString(),
            diff,
            totals: {
                continents: Object.keys(normalizedDataset || {}).length,
                locations: Object.values(normalizedDataset || {}).reduce(
                    (acc, list) => acc + (Array.isArray(list) ? list.length : 0),
                    0
                )
            },
            sync: syncResult.status
        });

        json(res, 200, {
            status: 'ok',
            warnings: validation.warnings,
            continent,
            removed,
            changes: diff,
            sync: syncResult.status,
            syncStatusCode: syncResult.statusCode ?? null,
            syncError: syncResult.status === 'error'
                ? ((syncResult.error || syncResult.body) || `HTTP ${syncResult.statusCode || 'unknown'}`)
                : null
        });
    });
};
