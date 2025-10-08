﻿﻿﻿const STRINGS = {
    fr: {
        sidebar: {
            title: 'Exploration',
            toggleAll: 'Tout masquer/afficher',
            tabs: {
                all: 'Tous les lieux',
                favorites: 'Favoris'
            }
        },
        search: {
            placeholder: 'Rechercher un lieu...',
            clearAria: 'Effacer la recherche',
            noResult: 'Aucun lieu',
            resultsSingle: '{count} lieu',
            resultsPlural: '{count} lieux',
            resultsFilteredSingle: '{visible} lieu / {total} {totalLabel}',
            resultsFilteredPlural: '{visible} lieux / {total} {totalLabel}'
        },
        filters: {
            allTypes: 'Tous les types',
            resetAria: 'Réinitialiser les filtres',
            randomAria: 'Choisir un lieu aléatoire',
            randomHint: 'Sélectionner un lieu aléatoire.',
            randomDisabledFavorites: 'Aucun favori ne correspond aux filtres actuels.',
            randomDisabledDefault: 'Aucun lieu ne correspond aux filtres actuels.'
        },
        favorites: {
            add: 'Ajouter aux favoris',
            addWithName: 'Ajouter {location} aux favoris',
            remove: 'Retirer des favoris',
            removeWithName: 'Retirer {location} des favoris',
            iconActive: '★',
            iconInactive: '☆',
            empty: 'Aucun favori enregistre pour le moment.',
            filtered: 'Masque par les filtres actifs.',
            summaryLabel: 'Favoris enregistres',
            summaryCountSingle: '{count} favori',
            summaryCountPlural: '{count} favoris'
        },
        info: {
            noDescription: 'Aucune description disponible.',
            history: { title: 'Histoire' },
            quests: { title: 'Quêtes' },
            lore: { title: 'Lore' },
            pnjs: { title: 'Personnages', unknown: 'PNJ' },
            watchVideo: 'Voir la vidéo',
            noMedia: 'Aucun média disponible'
        },
        audio: {
            titleDefault: 'Ambiance sonore',
            titleForLocation: 'Ambiance de {location}',
            fallbackDefault: 'Lecture audio bloquée. Cliquez pour lancer la lecture.',
            fallbackBlocked: 'Lecture bloquée par le navigateur. Cliquez pour lancer la lecture.',
            fallbackMissing: 'Audio indisponible ou corrompu.',
            fallbackButton: '▶ Lancer la lecture'
        },
        clustering: {
            iconOn: '📊',
            iconOff: '🗺️',
            iconEmpty: '—',
            tooltipBaseSingle: '{visible} lieu visible sur {total}',
            tooltipBasePlural: '{visible} lieux visibles sur {total}',
            tooltipEmpty: 'Aucun lieu chargé',
            tooltipFilters: 'filtres actifs',
            tooltipClusterOn: 'clustering activé',
            tooltipClusterOff: 'clustering désactivé'
        },
        history: {
            title: 'Historique',
            back: 'Retour'
        },
        mapControls: {
            zoomIn: 'Zoom avant',
            zoomOut: 'Zoom arrière',
            recenter: 'Recentrer la carte',
            fullscreen: 'Plein écran',
            themeDark: 'Mode sombre',
            themeLight: 'Mode clair'
        },
        icons: {
            clear: '✕',
            reset: '↺',
            random: '🎲'
        }
    }
};

const DEFAULT_LOCALE = 'fr';
let currentLocale = DEFAULT_LOCALE;

export function setLocale(locale) {
    if (locale && STRINGS[locale]) {
        currentLocale = locale;
    } else {
        currentLocale = DEFAULT_LOCALE;
    }
}

export function getCurrentLocale() {
    return currentLocale;
}

export function getString(key, params = {}) {
    if (!key) {
        return '';
    }

    const store = STRINGS[currentLocale] || STRINGS[DEFAULT_LOCALE];
    const value = key.split('.').reduce((acc, part) => {
        if (acc && typeof acc === 'object' && part in acc) {
            return acc[part];
        }
        return undefined;
    }, store);

    if (typeof value !== 'string') {
        return key;
    }

    return value.replace(/\{(\w+)\}/g, (match, token) => {
        if (Object.prototype.hasOwnProperty.call(params, token)) {
            return params[token];
        }
        return match;
    });
}



