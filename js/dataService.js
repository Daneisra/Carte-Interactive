const DEFAULT_TYPES_URL = 'assets/types.json';
const DEFAULT_LOCATIONS_URL = 'assets/locations.json';

export class DataService {
    constructor({ typesUrl = DEFAULT_TYPES_URL, locationsUrl = DEFAULT_LOCATIONS_URL } = {}) {
        this.typesUrl = typesUrl;
        this.locationsUrl = locationsUrl;
    }

    async load() {
        const [typeData, rawLocations] = await Promise.all([
            this.fetchJson(this.typesUrl),
            this.fetchJson(this.locationsUrl)
        ]);

        const locationsData = this.normalizeLocations(rawLocations);
        this.validateDatasets(locationsData, typeData);

        return { typeData, locationsData };
    }

    async fetchJson(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Impossible de charger la ressource : ${url} (${response.status})`);
        }
        return response.json();
    }

    normalizeLocation(rawLocation) {
        if (!rawLocation || typeof rawLocation !== 'object') {
            return null;
        }

        const normalized = {
            name: typeof rawLocation.name === 'string' ? rawLocation.name.trim() : 'Lieu inconnu',
            type: typeof rawLocation.type === 'string' && rawLocation.type.trim().length ? rawLocation.type.trim() : 'default',
            x: Number(rawLocation.x),
            y: Number(rawLocation.y),
            description: typeof rawLocation.description === 'string' ? rawLocation.description.trim() : '',
            images: Array.isArray(rawLocation.images)
                ? rawLocation.images.filter(src => typeof src === 'string' && src.trim().length).map(src => src.trim())
                : [],
            videos: Array.isArray(rawLocation.videos)
                ? rawLocation.videos.filter(video => typeof video === 'string' && video.trim().length).map(video => video.trim())
                : [],
            audio: typeof rawLocation.audio === 'string' && rawLocation.audio.trim().length ? rawLocation.audio.trim() : null,
            history: Array.isArray(rawLocation.history)
                ? rawLocation.history.filter(Boolean).map(entry => String(entry).trim())
                : typeof rawLocation.history === 'string' && rawLocation.history.trim()
                    ? [rawLocation.history.trim()]
                    : [],
            quests: Array.isArray(rawLocation.quests)
                ? rawLocation.quests.filter(Boolean).map(entry => String(entry).trim())
                : typeof rawLocation.quests === 'string' && rawLocation.quests.trim()
                    ? [rawLocation.quests.trim()]
                    : [],
            pnjs: Array.isArray(rawLocation.pnjs)
                ? rawLocation.pnjs.filter(Boolean).map(pnj => ({
                    name: typeof pnj.name === 'string' ? pnj.name.trim() : 'PNJ',
                    role: typeof pnj.role === 'string' ? pnj.role.trim() : '',
                    description: typeof pnj.description === 'string' ? pnj.description.trim() : ''
                }))
                : [],
            lore: Array.isArray(rawLocation.lore)
                ? rawLocation.lore.filter(Boolean).map(entry => String(entry).trim())
                : typeof rawLocation.lore === 'string' && rawLocation.lore.trim()
                    ? [rawLocation.lore.trim()]
                    : []
        };

        if (Number.isNaN(normalized.x) || Number.isNaN(normalized.y)) {
            normalized.x = 0;
            normalized.y = 0;
        }

        return normalized;
    }

    normalizeLocations(dataset) {
        const normalizedDataset = {};

        Object.entries(dataset || {}).forEach(([continent, locations]) => {
            normalizedDataset[continent] = Array.isArray(locations)
                ? locations.map(location => this.normalizeLocation(location)).filter(Boolean)
                : [];
        });

        return normalizedDataset;
    }

    validateDatasets(locationsByContinent, registeredTypes) {
        const issues = [];
        const seenNames = new Set();

        Object.entries(locationsByContinent).forEach(([continent, locations]) => {
            locations.forEach((location, index) => {
                if (!location.name || location.name === 'Lieu inconnu') {
                    issues.push(`${continent} index ${index} : nom manquant`);
                }

                if (!Number.isFinite(location.x) || !Number.isFinite(location.y)) {
                    issues.push(`${location.name} : coordonnées invalides`);
                }

                if (!registeredTypes[location.type] && location.type !== 'default') {
                    issues.push(`${location.name} : type inconnu "${location.type}"`);
                }

                if (seenNames.has(location.name)) {
                    issues.push(`${location.name} : doublon détecté`);
                }

                seenNames.add(location.name);

                const invalidImages = location.images.filter(src => typeof src === 'string' && !src.startsWith('assets/'));
                if (invalidImages.length > 0) {
                    issues.push(`${location.name} : images avec chemin non valide (${invalidImages.join(', ')})`);
                }

                if (location.audio && typeof location.audio === 'string' && !location.audio.startsWith('assets/')) {
                    issues.push(`${location.name} : audio avec chemin non valide (${location.audio})`);
                }
            });
        });

        if (issues.length) {
            console.group('Validation des données de carte');
            issues.forEach(issue => console.warn(issue));
            console.groupEnd();
        } else {
            console.info('Validation des données de carte : OK');
        }
    }
}
