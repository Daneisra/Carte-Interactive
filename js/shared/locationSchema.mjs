const sanitizeString = value => (value ?? '').toString().trim();

const collectTextArray = value => {
    if (Array.isArray(value)) {
        return value.map(sanitizeString).filter(Boolean);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? [trimmed] : [];
    }
    return [];
};

const normalizePnjList = pnjs => {
    if (!Array.isArray(pnjs)) {
        return [];
    }
    return pnjs
        .filter(Boolean)
        .map(pnj => {
            const entry = {
                name: sanitizeString(pnj?.name) || 'PNJ',
                role: sanitizeString(pnj?.role),
                description: sanitizeString(pnj?.description)
            };
            return entry;
        });
};

const normalizeVideoList = (videos, { legacyTitles = [] } = {}) => {
    if (!Array.isArray(videos)) {
        return [];
    }
    return videos.reduce((accumulator, entry, index) => {
        let url = '';
        let title = '';

        if (typeof entry === 'string') {
            url = sanitizeString(entry);
        } else if (entry && typeof entry === 'object') {
            url = sanitizeString(entry.url);
            title = sanitizeString(entry.title);
        }

        if (!url) {
            return accumulator;
        }

        if (!title && typeof legacyTitles[index] === 'string') {
            const legacy = sanitizeString(legacyTitles[index]);
            if (legacy) {
                title = legacy;
            }
        }

        accumulator.push({ url, title });
        return accumulator;
    }, []);
};

const normalizeLocation = rawLocation => {
    if (!rawLocation || typeof rawLocation !== 'object') {
        return null;
    }

    const videos = normalizeVideoList(rawLocation.videos, {
        legacyTitles: Array.isArray(rawLocation.videoTitles) ? rawLocation.videoTitles : []
    });

    const normalized = {
        name: sanitizeString(rawLocation.name) || 'Lieu inconnu',
        type: sanitizeString(rawLocation.type) || 'default',
        x: Number(rawLocation.x),
        y: Number(rawLocation.y),
        description: sanitizeString(rawLocation.description),
        images: Array.isArray(rawLocation.images)
            ? rawLocation.images.map(sanitizeString).filter(Boolean)
            : [],
        videos,
        videoTitles: videos.map(video => video.title).filter(Boolean),
        audio: (() => {
            const audioPath = sanitizeString(rawLocation.audio);
            return audioPath ? audioPath : null;
        })(),
        history: collectTextArray(rawLocation.history),
        quests: collectTextArray(rawLocation.quests),
        lore: collectTextArray(rawLocation.lore),
        instances: collectTextArray(rawLocation.instances),
        pnjs: normalizePnjList(rawLocation.pnjs),
        tags: (() => {
            if (Array.isArray(rawLocation.tags)) {
                return rawLocation.tags.map(sanitizeString).filter(Boolean);
            }
            const single = sanitizeString(rawLocation.tags);
            if (!single) {
                return [];
            }
            return single
                .split(/[,;]+/)
                .map(sanitizeString)
                .filter(Boolean);
        })()
    };

    if (!Number.isFinite(normalized.x)) {
        normalized.x = 0;
    }
    if (!Number.isFinite(normalized.y)) {
        normalized.y = 0;
    }

    return normalized;
};

const normalizeDataset = (dataset, { sanitizeKeys = false } = {}) => {
    const normalizedDataset = {};

    Object.entries(dataset || {}).forEach(([continent, locations]) => {
        const key = sanitizeKeys ? sanitizeString(continent) : continent;
        if (sanitizeKeys && !key) {
            return;
        }

        normalizedDataset[key] = Array.isArray(locations)
            ? locations.map(normalizeLocation).filter(Boolean)
            : [];
    });

    return normalizedDataset;
};

const serializeTextGroup = value => {
    const list = collectTextArray(value);
    if (!list.length) {
        return '';
    }
    if (list.length === 1) {
        return list[0];
    }
    return list;
};

const serializeVideos = videos => normalizeVideoList(videos).map(video => ({
    url: video.url,
    title: video.title
}));

const serializePnjs = pnjs => normalizePnjList(pnjs).map(pnj => ({
    name: pnj.name,
    role: pnj.role,
    description: pnj.description
}));

export {
    sanitizeString,
    collectTextArray,
    normalizePnjList,
    normalizeVideoList,
    normalizeLocation,
    normalizeDataset,
    serializeTextGroup,
    serializeVideos,
    serializePnjs
};
