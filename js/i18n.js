const STRINGS = {
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
            randomDisabledDefault: 'Aucun lieu ne correspond aux filtres actuels.',
            advancedShow: 'Filtres avancés',
            advancedHide: 'Masquer les filtres',
            typesLabel: 'Types',
            tagsLabel: 'Tags',
            statusesLabel: "Statuts d'évènement",
            questsLabel: 'Présence de quêtes',
            quests: {
                any: 'Toutes ({count})',
                with: 'Avec quêtes ({count})',
                without: 'Sans quête ({count})'
            },
            empty: {
                types: 'Aucun type disponible',
                tags: 'Aucun tag disponible',
                statuses: 'Aucun statut disponible'
            }
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
        onboarding: {
            favoritesHint: 'Ajoutez vos lieux préférés pour y revenir rapidement.',
            clusteringHint: 'Activez le regroupement pour fluidifier la carte lorsque le zoom est éloigné.',
            gotIt: 'Compris'
        },
        info: {
            noDescription: 'Aucune description disponible.',
            history: { title: 'Histoire' },
            quests: { title: 'Quêtes' },
            lore: { title: 'Lore' },
            pnjs: { title: 'Personnages', unknown: 'PNJ' },
            tabsAriaLabel: 'Sections d\'information du lieu',
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
        distance: {
            enable: 'Activer la mesure de distance',
            active: 'Outil de mesure actif. Cliquez deux points sur la carte pour calculer la distance.',
            pointStored: 'Point de départ enregistré : x {x}, y {y}.',
            result: 'Distance : {distance} km ({pixels} px).',
            cancelled: 'Outil de mesure désactivé.'
        },
        coords: {
            enable: 'Activer l\'outil d\'obtention des coordonnées',
            active: 'Outil de capture actif. Cliquez sur la carte pour obtenir les coordonnées.',
            result: 'Coordonnées : x {x} px, y {y} px.',
            cancelled: 'Outil de coordonnées désactivé.'
        },
        aria: {
            locationSelected: '{location} sélectionné.',
            infoClosed: 'Panneau d\'information fermé.',
            favoriteAdded: '{location} ajouté aux favoris.',
            favoriteRemoved: '{location} retiré des favoris.'
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
            back: 'Retour',
            overflowSingle: '{count} lieu plus ancien dans l\'historique',
            overflowPlural: '{count} lieux plus anciens dans l\'historique'
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



