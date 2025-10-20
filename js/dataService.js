
import { normalizeDataset } from './shared/locationSchema.js';

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

        const locationsData = normalizeDataset(rawLocations);
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
