import { UiState } from './ui/state.js';
import { FiltersManager } from './ui/filtersManager.js';
import { ThemeManager } from './ui/themeManager.js';
import { MapControlsManager } from './ui/mapControlsManager.js';
import { HistoryManager } from './ui/historyManager.js';
import { AudioManager } from './ui/audioManager.js';
import { InfoPanel } from './ui/infoPanel.js';
import { UserAdminPanel } from './ui/userAdminPanel.js';
import { AriaAnnouncer } from './ui/ariaAnnouncer.js';
import { qs, createElement, clearElement } from './ui/dom.js';
import { LocationEditor } from './ui/locationEditor.js';
import { EventsFeed } from './ui/eventsFeed.js';
import { getString } from './i18n.js';
import {
    sanitizeString,
    normalizeLocation,
    normalizeDataset as normalizeSharedDataset,
    serializeTextGroup,
    serializeVideos,
    serializePnjs
} from './shared/locationSchema.mjs';
import {
    buildLocationIndex,
    prepareFilters,
    locationMatchesFilters,
    buildFilterFacets,
    normalizeFilterState
} from './shared/searchFilters.mjs';

const PAGE_SIZE = 8;
const KM_PER_PIXEL = 10;

const localized = (key, fallback = '', params = undefined) => {
    const resolved = params === undefined ? getString(key) : getString(key, params);
    if (!resolved || resolved === key) {
        return fallback;
    }
    return resolved;
};

const favoriteIconActive = () => localized('favorites.iconActive', '★');
const favoriteIconInactive = () => localized('favorites.iconInactive', '☆');
const toggleAllLabel = isExpanded => localized(
    isExpanded ? 'sidebar.toggleAllCollapse' : 'sidebar.toggleAllExpand',
    isExpanded ? 'Tout masquer' : 'Tout afficher'
);
const favoritesEmptyMessage = () => localized('favorites.empty', 'Aucun favori enregistre pour le moment.');
const favoritesFilteredHint = () => localized('favorites.filtered', 'Masque par les filtres actifs.');
const randomDisabledFavoritesMessage = () => localized('filters.randomDisabledFavorites', 'Aucun favori ne correspond aux filtres actuels.');
const randomDisabledDefaultMessage = () => localized('filters.randomDisabledDefault', 'Aucun lieu ne correspond aux filtres actuels.');
const clusteringIcon = clustered => clustered
    ? localized('clustering.iconOn', 'ON')
    : localized('clustering.iconOff', 'OFF');
const clusteringEmptyIcon = () => localized('clustering.iconEmpty', '-');
const CLUSTERING_TOOLTIP_SEPARATOR = ' - ';

const isInteractiveTextField = element => {
    if (!element) {
        return false;
    }
    if (element.isContentEditable) {
        return true;
    }
    const tag = element.tagName;
    if (!tag) {
        return false;
    }
    const upper = tag.toUpperCase();
    return upper === 'INPUT' || upper === 'TEXTAREA' || element.getAttribute('role') === 'textbox';
};

export class UiController {
    constructor({
        mapController,
        preferences = null,
        sidebarId = 'sidebar',
        searchBarId = 'search-bar',
        clearSearchId = 'clear-search',
        filtersToggleId = 'filters-advanced-toggle',
        filtersPanelId = 'advanced-filters-panel',
        filterTypesId = 'filter-types',
        filterTagsId = 'filter-tags',
        filterStatusesId = 'filter-statuses',
        resetFiltersId = 'reset-filters',
        toggleAllButtonId = 'toggle-all-continents',
        infoSidebarId = 'info-sidebar',
        infoTitleId = 'info-title',
        descriptionTextId = 'description-text',
        descriptionContentId = 'description-content',
        imageGalleryId = 'image-gallery',
        audioPlayerId = 'audio-player',
        audioTitleId = 'audio-title',
        historyContainerId = 'history-container',
        historyListId = 'history-list',
        historyBackId = 'history-back',
        mapControlsId = 'map-controls'
    } = {}) {
        if (!mapController) {
            throw new Error('UiController requires a MapController instance.');
        }

        this.mapController = mapController;
        this.preferences = preferences;

        this.dom = {
            sidebar: document.getElementById(sidebarId),
            searchBar: document.getElementById(searchBarId),
            clearSearch: document.getElementById(clearSearchId),
            filtersToggle: document.getElementById(filtersToggleId),
            filtersPanel: document.getElementById(filtersPanelId),
            filterTypes: document.getElementById(filterTypesId),
            filterTags: document.getElementById(filterTagsId),
            filterStatuses: document.getElementById(filterStatusesId),
            resetFilters: document.getElementById(resetFiltersId),
            toggleAll: document.getElementById(toggleAllButtonId),
            resultsBadge: document.getElementById('search-results-count'),
            addLocation: document.getElementById('add-location'),
            authPanel: document.getElementById('auth-panel'),
            authStatus: document.getElementById('auth-status'),
            loginButton: document.getElementById('login-button'),
            logoutButton: document.getElementById('logout-button'),
            clusteringToggle: document.getElementById('clustering-toggle'),
            clusteringMetrics: document.getElementById('clustering-metrics'),
            markerScaleInput: document.getElementById('marker-size'),
            markerScaleValue: document.getElementById('marker-size-value'),
            randomButton: document.getElementById('random-location'),
            tabAll: document.getElementById('tab-all-locations'),
            tabFavorites: document.getElementById('tab-favorites'),
            favoritesContainer: document.getElementById('favorites-container'),
            continentsContainer: document.getElementById('continents-container'),
            themeToggle: document.getElementById('theme-toggle'),
            infoSidebar: document.getElementById(infoSidebarId),
            editLocation: document.getElementById('edit-location'),
            infoTitle: document.getElementById(infoTitleId),
            descriptionText: document.getElementById(descriptionTextId),
            descriptionContent: document.getElementById(descriptionContentId),
            imageGallery: document.getElementById(imageGalleryId),
            historyContainer: document.getElementById(historyContainerId),
            historyList: document.getElementById(historyListId),
            historyBack: document.getElementById(historyBackId),
            mapControls: document.getElementById(mapControlsId),
            zoomIn: qs('#zoom-in'),
            zoomOut: qs('#zoom-out'),
            resetMap: qs('#reset-map'),
            fullscreen: qs('#fullscreen-map'),
            measureDistance: document.getElementById('measure-distance'),
            captureCoordinates: document.getElementById('capture-coordinates'),
            annotationButton: document.getElementById('annotation-mode'),
            zoomLevel: document.getElementById('zoom-level'),
            favoriteToggle: document.getElementById('favorite-toggle'),
            audioPlayer: document.getElementById(audioPlayerId),
            audioTitle: document.getElementById(audioTitleId),
            audioFallback: document.getElementById('audio-fallback'),
            audioStatus: document.getElementById('audio-status'),
            locationEditor: document.getElementById('location-editor'),
            userAdminButton: document.getElementById('user-admin-button'),
            userAdminOverlay: document.getElementById('user-admin-overlay'),
            userAdminContainer: document.getElementById('user-admin-container'),
            eventsFeed: document.getElementById('events-feed'),
            eventsFeedList: document.getElementById('events-feed-list'),
            eventsFilter: document.getElementById('events-filter'),
            eventsFeedEmpty: document.getElementById('events-feed-empty')
        };

        this.announcer = new AriaAnnouncer({
            politeNode: qs('#aria-status'),
            assertiveNode: qs('#aria-alert')
        });

        this.locationEditor = null;
        this.userAdminPanel = null;
        this.locationsData = {};

        this.state = new UiState({
            filters: this.preferences?.getFilters?.(),
            favorites: this.preferences?.getFavorites?.(),
            theme: this.preferences?.getTheme?.()
        });

        this.authRequired = true;
        this.auth = { authenticated: false, role: 'guest', username: '' };

        this.pageSize = PAGE_SIZE;
        this.entries = [];
        this.continents = new Map();
        this.activeEntry = null;
        this.toggleAllState = false;
        this.typeData = {};
        this.boundKeyboardShortcuts = false;
        this.mapClickUnsubscribe = null;
        this.tooltipMeta = new WeakMap();
        this.visibleTooltips = new Set();
        this.realtimeSource = null;
        this.realtimeCleanup = null;
        this.annotations = new Map();
        this.questEvents = new Map();
        this.questEventsLoaded = false;
        this.filterFacets = { types: [], tags: [], statuses: [], quests: { with: 0, without: 0 } };
        this.annotationTool = {
            active: false,
            clickUnsubscribe: null
        };

        this.historyManager = new HistoryManager({
            container: this.dom.historyContainer,
            listElement: this.dom.historyList,
            backButton: this.dom.historyBack
        });

        this.eventsFeed = new EventsFeed({
            container: this.dom.eventsFeed,
            listElement: this.dom.eventsFeedList,
            filterSelect: this.dom.eventsFilter,
            emptyState: this.dom.eventsFeedEmpty
        });

        this.audioManager = new AudioManager({
            player: this.dom.audioPlayer,
            titleElement: this.dom.audioTitle,
            container: qs('#audio-container'),
            fallbackButton: this.dom.audioFallback,
            statusElement: this.dom.audioStatus
        });

        this.infoPanel = new InfoPanel({
            sidebar: this.dom.infoSidebar,
            titleElement: this.dom.infoTitle,
            descriptionElement: this.dom.descriptionText,
            descriptionContainer: this.dom.descriptionContent,
            galleryElement: this.dom.imageGallery,
            historySection: qs('#history-section'),
            questsSection: qs('#quests-section'),
            pnjsSection: qs('#pnjs-section'),
            loreSection: qs('#lore-section'),
            audioManager: this.audioManager,
            closeButton: qs('#close-info-sidebar'),
            lightbox: {
                container: qs('#media-lightbox'),
                image: qs('#media-lightbox-image'),
                caption: qs('#media-lightbox-caption'),
                closeButton: qs('#media-lightbox-close')
            }
        });
        this.favoriteTooltip = this.createTooltip(localized(
            'onboarding.favoritesHint',
            'Ajoutez vos lieux preferes pour y revenir rapidement.'
        ));
        this.favoriteOnboardingTooltip = this.createTooltip(localized(
            'onboarding.favoritesHint',
            'Ajoutez vos lieux preferes pour y revenir rapidement.'
        ), { persistent: true, key: 'favorites' });
        this.clusteringTooltip = this.createTooltip(localized(
            'onboarding.clusteringHint',
            'Activez le regroupement pour fluidifier la carte lorsque le zoom est eloigne.'
        ));
        this.clusteringOnboardingTooltip = this.createTooltip(localized(
            'onboarding.clusteringHint',
            'Activez le regroupement pour fluidifier la carte lorsque le zoom est eloigne.'
        ), { persistent: true, key: 'clustering' });
        this.measurement = { active: false, points: [] };
        this.measurementClickUnsubscribe = null;
        this.coordinateTool = { active: false };
        this.coordinateClickUnsubscribe = null;
        this.measureTooltip = this.createTooltip('', { persistent: false });
        this.coordinateTooltip = this.createTooltip('', { persistent: false });
        this.annotationTooltip = this.createTooltip('', { persistent: false });
        this.controlTooltipTimeouts = new Map();

        this.filtersManager = new FiltersManager({
            state: this.state,
            searchInput: this.dom.searchBar,
            clearButton: this.dom.clearSearch,
            resetButton: this.dom.resetFilters,
            resultsBadge: this.dom.resultsBadge,
            advancedToggle: this.dom.filtersToggle,
            advancedPanel: this.dom.filtersPanel,
            typeContainer: this.dom.filterTypes,
            tagContainer: this.dom.filterTags,
            statusContainer: this.dom.filterStatuses,
            onFiltersChanged: filters => {
                if (this.preferences?.setFilters) {
                    this.preferences.setFilters(filters);
                }
                this.applyFilters();
            }
        });

        this.themeManager = new ThemeManager({
            buttons: this.dom.themeToggle ? Array.from(this.dom.themeToggle.querySelectorAll('[data-theme]')) : [],
            state: this.state,
            preferences: this.preferences
        });

        this.mapControlsManager = new MapControlsManager({
            mapController: this.mapController,
            zoomInButton: this.dom.zoomIn,
            zoomOutButton: this.dom.zoomOut,
            resetButton: this.dom.resetMap,
            fullscreenButton: this.dom.fullscreen,
            zoomDisplay: this.dom.zoomLevel,
            preferences: this.preferences
        });
        this.handleTooltipReposition = () => this.repositionVisibleTooltips();
        window.addEventListener('resize', this.handleTooltipReposition);
        window.addEventListener('scroll', this.handleTooltipReposition, { capture: true, passive: true });
    }

    createTooltip(message, { persistent = false, key = null } = {}) {
        const classes = persistent ? 'ui-tooltip ui-tooltip--persistent' : 'ui-tooltip';
        const tooltip = createElement('div', {
            className: classes,
            attributes: { role: 'tooltip', 'aria-hidden': 'true' }
        });
        const text = createElement('span', { className: 'ui-tooltip-text', text: message });
        tooltip.appendChild(text);
        let dismissButton = null;
        if (persistent) {
            dismissButton = createElement('button', {
                className: 'ui-tooltip-dismiss',
                text: localized('onboarding.gotIt', 'Compris'),
                attributes: { type: 'button' }
            });
            tooltip.appendChild(dismissButton);
            dismissButton.addEventListener('click', () => {
                if (key) {
                    this.dismissOnboarding(key);
                } else {
                    this.hideTooltip(tooltip);
                }
            });
        }
        tooltip.hidden = true;
        document.body.appendChild(tooltip);
        this.tooltipMeta.set(tooltip, {
            persistent,
            key,
            target: null,
            placement: 'top',
            dismissButton
        });
        return tooltip;
    }

    attachHoverTooltip(target, tooltip, options = {}) {
        if (!target || !tooltip) {
            return;
        }
        const show = () => this.showTooltip(target, tooltip, options);
        const hide = () => this.hideTooltip(tooltip);
        target.addEventListener('mouseenter', show);
        target.addEventListener('focusin', show);
        target.addEventListener('mouseleave', hide);
        target.addEventListener('focusout', hide);
    }

    showTooltip(target, tooltip, { placement = 'top', persistent = null } = {}) {
        if (!target || !tooltip) {
            return;
        }
        const meta = this.tooltipMeta.get(tooltip);
        if (!meta) {
            return;
        }
        const isPersistent = persistent !== null ? persistent : Boolean(meta.persistent);
        this.tooltipMeta.set(tooltip, { ...meta, target, placement, persistent: meta.persistent });
        tooltip.dataset.placement = placement;
        tooltip.setAttribute('aria-hidden', 'false');
        tooltip.hidden = false;
        tooltip.classList.add('is-visible');
        tooltip.classList.toggle('is-persistent', isPersistent);
        requestAnimationFrame(() => {
            this.positionTooltip(target, tooltip, placement);
        });
        this.visibleTooltips.add(tooltip);
    }

    hideTooltip(tooltip) {
        if (!tooltip) {
            return;
        }
        tooltip.classList.remove('is-visible');
        tooltip.classList.remove('is-persistent');
        tooltip.setAttribute('aria-hidden', 'true');
        tooltip.hidden = true;
        this.visibleTooltips.delete(tooltip);
        const meta = this.tooltipMeta.get(tooltip);
        if (meta) {
            this.tooltipMeta.set(tooltip, { ...meta, target: null });
        }
    }

    positionTooltip(target, tooltip, placement = 'top') {
        if (!target || !tooltip.classList.contains('is-visible')) {
            return;
        }
        const rect = target.getBoundingClientRect();
        const spacing = 10;
        const tooltipRect = tooltip.getBoundingClientRect();
        let top = rect.top - tooltipRect.height - spacing;
        let left = rect.left + (rect.width - tooltipRect.width) / 2;

        if (placement === 'bottom') {
            top = rect.bottom + spacing;
        } else if (placement === 'left') {
            top = rect.top + (rect.height - tooltipRect.height) / 2;
            left = rect.left - tooltipRect.width - spacing;
        } else if (placement === 'right') {
            top = rect.top + (rect.height - tooltipRect.height) / 2;
            left = rect.right + spacing;
        }

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        left = Math.max(8, Math.min(left, viewportWidth - tooltipRect.width - 8));
        top = Math.max(8, Math.min(top, viewportHeight - tooltipRect.height - 8));

        tooltip.style.top = `${Math.round(top)}px`;
        tooltip.style.left = `${Math.round(left)}px`;
    }

    repositionVisibleTooltips() {
        this.visibleTooltips.forEach(tooltip => {
            const meta = this.tooltipMeta.get(tooltip);
            if (meta?.target && meta.target.isConnected) {
                this.positionTooltip(meta.target, tooltip, meta.placement || 'top');
            } else if (meta) {
                this.hideTooltip(tooltip);
            }
        });
    }

    hasSeenOnboarding(step) {
        return Boolean(this.preferences?.hasSeenOnboarding?.(step));
    }

    markOnboardingSeen(step) {
        if (!step) {
            return;
        }
        this.preferences?.setOnboardingSeen?.(step, true);
    }

    dismissOnboarding(step) {
        if (!step) {
            return;
        }
        const tooltip = step === 'favorites'
            ? this.favoriteOnboardingTooltip
            : step === 'clustering'
                ? this.clusteringOnboardingTooltip
                : null;
        if (tooltip) {
            this.hideTooltip(tooltip);
        }
        if (step === 'favorites') {
            this.hideTooltip(this.favoriteTooltip);
        }
        if (step === 'clustering') {
            this.hideTooltip(this.clusteringTooltip);
        }
        this.markOnboardingSeen(step);
    }

    maybeShowClusteringOnboarding() {
        if (this.hasSeenOnboarding('clustering')) {
            return;
        }
        const toggle = this.dom.clusteringToggle;
        if (!toggle) {
            return;
        }
        const anchor = toggle.closest('#clustering-container') || toggle;
        setTimeout(() => {
            if (this.hasSeenOnboarding('clustering') || !anchor?.isConnected) {
                return;
            }
            this.hideTooltip(this.clusteringTooltip);
            this.showTooltip(anchor, this.clusteringOnboardingTooltip, { placement: 'bottom', persistent: true });
        }, 600);
    }

    maybeShowFavoritesOnboarding() {
        if (this.hasSeenOnboarding('favorites')) {
            return;
        }
        if (!this.dom.favoriteToggle || !this.dom.favoriteToggle.isConnected || !this.dom.infoSidebar?.classList.contains('open')) {
            return;
        }
        this.hideTooltip(this.favoriteTooltip);
        this.showTooltip(this.dom.favoriteToggle, this.favoriteOnboardingTooltip, { placement: 'left', persistent: true });
    }

    initialize({ typeData, locationsData }) {
        this.typeData = typeData || {};
        this.mapController.setTypeData(this.typeData);
        this.locationsData = normalizeSharedDataset(locationsData || {}, { sanitizeKeys: true });

        this.applyLocalization();
        this.themeManager.initialize();
        this.mapControlsManager.initialize();
        this.audioManager.initialize();
        this.infoPanel.initialize({ onClose: () => this.handlePanelClosed() });
        this.historyManager.initialize({ onSelect: item => this.handleHistorySelect(item) });
        this.eventsFeed.initialize({
            onDeleteAnnotation: id => this.requestAnnotationDeletion(id),
            canDeleteAnnotation: () => this.isAdmin()
        });
        this.filtersManager.initialize();
        this.bindAuthPanel();

        this.bindTabs();
        this.bindToggleAll();
        this.bindClustering();
        this.bindMarkerScale();
        this.bindFavoriteToggle();
        this.bindRandomButton();
        this.bindMeasurementTool();
        this.bindCoordinateTool();
        this.bindAnnotationTool();
        this.bindMapKeyboardShortcuts();
        this.bindMapBackgroundDismissal();

        this.setupLocationEditor();
        this.setupUserAdminPanel();
        this.updateAuthUI();
        this.buildSidebar(this.locationsData);
        this.refreshFilterMetadata({ reapply: false });
        this.restoreMapState();

        this.state.sidebarView = 'all';
        this.applyFilters();
        this.renderFavoritesView();
        this.updateSidebarView();
        this.updateClusteringMetrics();
        this.updateRandomButtonState();
        this.restoreLastLocation();
        this.setupRealtimeStream();

        this.mapController.onMapStateChange(state => {
            if (this.preferences?.setMapState) {
                this.preferences.setMapState(state);
            }
            this.state.mapState = state;
        });

        this.loadRealtimeData();
        this.maybeShowClusteringOnboarding();
    }

    applyLocalization() {
        if (this.dom.sidebar) {
            const title = this.dom.sidebar.querySelector('h2');
            if (title) {
                title.textContent = localized('sidebar.title', title.textContent || 'Exploration');
            }
        }

        if (this.dom.toggleAll) {
            const label = localized('sidebar.toggleAll', this.dom.toggleAll.textContent?.trim() || 'Tout masquer/afficher');
            this.dom.toggleAll.textContent = label;
            this.dom.toggleAll.title = label;
            this.dom.toggleAll.setAttribute('aria-label', label);
        }

        if (this.dom.tabAll) {
            const label = localized('sidebar.tabs.all', this.dom.tabAll.textContent || 'Tous les lieux');
            this.dom.tabAll.textContent = label;
            this.dom.tabAll.setAttribute('aria-label', label);
        }

        if (this.dom.tabFavorites) {
            const label = localized('sidebar.tabs.favorites', this.dom.tabFavorites.textContent || 'Favoris');
            this.dom.tabFavorites.textContent = label;
            this.dom.tabFavorites.setAttribute('aria-label', label);
        }

        if (this.dom.filtersToggle) {
            const label = localized('filters.advancedShow', this.dom.filtersToggle.textContent || 'Filtres avancés');
            this.dom.filtersToggle.textContent = label;
        }

        const typesLegend = document.getElementById('filter-types-label');
        if (typesLegend) {
            typesLegend.textContent = localized('filters.typesLabel', typesLegend.textContent || 'Types');
        }
        const tagsLegend = document.getElementById('filter-tags-label');
        if (tagsLegend) {
            tagsLegend.textContent = localized('filters.tagsLabel', tagsLegend.textContent || 'Tags');
        }
        const questsLegend = document.getElementById('filter-quests-label');
        if (questsLegend) {
            questsLegend.textContent = localized('filters.questsLabel', questsLegend.textContent || 'Présence de quêtes');
        }
        const statusesLegend = document.getElementById('filter-statuses-label');
        if (statusesLegend) {
            statusesLegend.textContent = localized('filters.statusesLabel', statusesLegend.textContent || "Statuts d'évènement");
        }

        const typesEmpty = this.dom.filtersPanel?.querySelector('[data-empty="types"]');
        if (typesEmpty) {
            typesEmpty.textContent = localized('filters.empty.types', typesEmpty.textContent || 'Aucun type disponible');
        }
        const tagsEmpty = this.dom.filtersPanel?.querySelector('[data-empty="tags"]');
        if (tagsEmpty) {
            tagsEmpty.textContent = localized('filters.empty.tags', tagsEmpty.textContent || 'Aucun tag disponible');
        }
        const statusesEmpty = this.dom.filtersPanel?.querySelector('[data-empty="statuses"]');
        if (statusesEmpty) {
            statusesEmpty.textContent = localized('filters.empty.statuses', statusesEmpty.textContent || 'Aucun statut disponible');
        }

        if (this.dom.randomButton) {
            const icon = localized('icons.random', this.dom.randomButton.textContent || '?');
            this.dom.randomButton.textContent = icon;
            this.dom.randomButton.setAttribute('aria-label', localized('filters.randomAria', 'Choisir un lieu aleatoire'));
            this.dom.randomButton.title = localized('filters.randomHint', 'Selectionner un lieu aleatoire.');
        }

        if (this.dom.favoriteToggle) {
            const label = localized('favorites.add', 'Ajouter aux favoris');
            this.dom.favoriteToggle.textContent = favoriteIconInactive();
            this.dom.favoriteToggle.title = label;
            this.dom.favoriteToggle.setAttribute('aria-label', label);
            this.dom.favoriteToggle.setAttribute('aria-pressed', 'false');
            this.dom.favoriteToggle.disabled = true;
        }

        this.updateMeasurementButton();
        this.updateCoordinateButton();
    }
    setupLocationEditor() {
        if (!this.dom.locationEditor) {
            return;
        }
        this.locationEditor = new LocationEditor({
            container: this.dom.locationEditor,
            types: this.typeData,
            onCreate: payload => this.handleCreateLocation(payload),
            onUpdate: payload => this.handleUpdateLocation(payload),
            onDelete: payload => this.handleDeleteLocation(payload),
            onCreateQuestEvent: payload => this.createQuestEvent(payload),
            onUpdateQuestEvent: payload => this.updateQuestEvent(payload),
            onDeleteQuestEvent: eventId => this.deleteQuestEvent(eventId)
        });
        this.locationEditor.setTypes(this.typeData);
        if (this.dom.addLocation) {
            this.dom.addLocation.addEventListener('click', () => {
                if (!this.isAdmin()) {
                    this.announcer?.assertive?.('Connexion administrateur requise.');
                    return;
                }
                this.openCreateLocation();
            });
        }
        if (this.dom.editLocation) {
            this.dom.editLocation.disabled = true;
            this.dom.editLocation.addEventListener('click', () => {
                if (!this.isAdmin()) {
                    this.announcer?.assertive?.('Connexion administrateur requise.');
                    return;
                }
                this.openEditLocation();
            });
        }
        this.updateEditButton(null);
    }

    sortStateDataset() {
        const sorted = {};
        Object.keys(this.locationsData || {})
            .sort((a, b) => sanitizeString(a).localeCompare(sanitizeString(b), 'fr', { sensitivity: 'base' }))
            .forEach(continent => {
                const entries = Array.isArray(this.locationsData[continent]) ? this.locationsData[continent] : [];
                const ordered = [...entries].sort((a, b) => sanitizeString(a.name).localeCompare(sanitizeString(b.name), 'fr', { sensitivity: 'base' }));
                sorted[continent] = ordered;
            });
        this.locationsData = sorted;
    }

    prepareLocationForPersist(location) {
        const normalized = normalizeLocation(location);
        return {
            name: normalized.name,
            type: normalized.type,
            x: Math.round(normalized.x) || 0,
            y: Math.round(normalized.y) || 0,
            description: normalized.description,
            images: normalized.images,
            videos: serializeVideos(normalized.videos),
            audio: normalized.audio || '',
            history: serializeTextGroup(normalized.history),
            quests: serializeTextGroup(normalized.quests),
            lore: serializeTextGroup(normalized.lore),
            pnjs: serializePnjs(normalized.pnjs),
            tags: normalized.tags
        };
    }

    prepareLocationsForPersist(dataset) {
        const result = {};
        Object.keys(dataset || {})
            .sort((a, b) => sanitizeString(a).localeCompare(sanitizeString(b), 'fr', { sensitivity: 'base' }))
            .forEach(continent => {
                const entries = Array.isArray(dataset[continent]) ? dataset[continent] : [];
                const ordered = [...entries].sort((a, b) => sanitizeString(a.name).localeCompare(sanitizeString(b.name), 'fr', { sensitivity: 'base' }));
                result[continent] = ordered.map(entry => this.prepareLocationForPersist(entry));
            });
        return result;
    }

    async persistLocations() {
        try {
            const payload = this.prepareLocationsForPersist(this.locationsData);
            const response = await fetch('/api/locations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ locations: payload })
            });
            if (!response.ok) {
                let message = `HTTP ${response.status}`;
                try {
                    const errorPayload = await response.json();
                    if (Array.isArray(errorPayload?.errors) && errorPayload.errors.length) {
                        message = errorPayload.errors.join('\n');
                    } else if (errorPayload?.message) {
                        message = errorPayload.message;
                    }
                } catch (parseError) {
                    // ignore parse failures
                }
                const error = new Error(message);
                error.status = response.status;
                throw error;
            }
            console.info('Sauvegarde des lieux terminee.');
        } catch (error) {
            console.error('Erreur lors de la sauvegarde des lieux :', error);
            if (this.announcer) {
                this.announcer.assertive(error?.message || 'Erreur lors de la sauvegarde des donnees.');
            }
            if (this.locationEditor?.showError) {
                this.locationEditor.showError('form', error?.message || 'Erreur lors de la sauvegarde des donnees.');
            }
        }
    }

    buildSidebar(locationsByContinent) {
        this.mapController.clearEntries();
        this.entries = [];
        this.continents.clear();

        if (this.dom.continentsContainer) {
            clearElement(this.dom.continentsContainer);
        }

        const continents = Object.entries(locationsByContinent || {});
        continents.forEach(([continentName, locations], index) => {
            const list = Array.isArray(locations) ? [...locations] : [];
            list.sort((a, b) => (a?.name || '').localeCompare(b?.name || '', 'fr', { sensitivity: 'base' }));
            const section = this.createContinentSection(continentName, list, index);
            this.continents.set(continentName, section);
            if (this.dom.continentsContainer) {
                this.dom.continentsContainer.appendChild(section.wrapper);
            }
        });

        if (!continents.length && this.dom.continentsContainer) {
            const empty = createElement('p', { className: 'empty-sidebar', text: localized('search.noResult', 'Aucun lieu') });
            this.dom.continentsContainer.appendChild(empty);
        }

        this.updateToggleAllState();
    }



    buildFilterIndexForEntry(entry) {
        if (!entry || !entry.location) {
            return null;
        }
        const questEvents = this.getQuestEventsForLocation(entry.location.name);
        return buildLocationIndex(entry.location, {
            continent: entry.continent,
            questEvents
        });
    }

    refreshFilterMetadata({ reapply = false } = {}) {
        if (!Array.isArray(this.entries) || !this.entries.length) {
            if (this.filtersManager?.setAvailableFilters) {
                this.filtersManager.setAvailableFilters({ types: [], tags: [], statuses: [], quests: { with: 0, without: 0 } });
            }
            return;
        }
        const typeLabels = new Map(Object.entries(this.typeData || {}));
        const indices = [];
        this.entries.forEach(entry => {
            entry.filterIndex = this.buildFilterIndexForEntry(entry);
            if (entry.filterIndex) {
                indices.push(entry.filterIndex);
            }
        });
        this.filterFacets = buildFilterFacets(indices, { typeLabels });
        if (this.filtersManager?.setAvailableFilters) {
            this.filtersManager.setAvailableFilters(this.filterFacets);
        }
        if (reapply) {
            this.applyFilters();
        }
    }

    collectExistingNames(exceptName = null) {
        const names = [];
        const except = exceptName ? sanitizeString(exceptName).toLowerCase() : null;
        Object.values(this.locationsData || {}).forEach(list => {
            if (!Array.isArray(list)) {
                return;
            }
            list.forEach(location => {
                const normalizedName = sanitizeString(location?.name).toLowerCase();
                if (!normalizedName) {
                    return;
                }
                if (except && normalizedName === except) {
                    return;
                }
                names.push(normalizedName);
            });
        });
        return names;
    }

    getQuestEventsForLocation(locationName) {
        const key = sanitizeString(locationName).toLowerCase();
        if (!key) {
            return [];
        }
        const events = [];
        this.questEvents.forEach(event => {
            const target = sanitizeString(event?.locationName).toLowerCase();
            if (target === key) {
                events.push(event);
            }
        });
        events.sort((a, b) => {
            const left = new Date(b?.updatedAt || b?.timestamp || b?.createdAt || 0).getTime();
            const right = new Date(a?.updatedAt || a?.timestamp || a?.createdAt || 0).getTime();
            return left - right;
        });
        return events;
    }

    openCreateLocation() {
        if (!this.locationEditor) {
            return;
        }
        if (!this.isAdmin()) {
            this.announcer?.assertive?.('Connexion administrateur requise.');
            return;
        }
        const disallowed = this.collectExistingNames();
        this.locationEditor.open({
            mode: 'create',
            location: null,
            continent: '',
            disallowedNames: disallowed,
            questEvents: []
        });
    }

    openEditLocation() {
        if (!this.locationEditor || !this.activeEntry) {
            return;
        }
        if (!this.isAdmin()) {
            this.announcer?.assertive?.('Connexion administrateur requise.');
            return;
        }
        const entry = this.activeEntry;
        const disallowed = this.collectExistingNames(entry.location.name);
        this.locationEditor.open({
            mode: 'edit',
            location: entry.location,
            continent: entry.continent,
            disallowedNames: disallowed,
            questEvents: this.getQuestEventsForLocation(entry.location.name)
        });
    }

    handleCreateLocation({ continent, location }) {
        if (!location) {
            return;
        }
        const normalized = normalizeLocation(location);
        if (!normalized.name) {
            console.warn('Impossible de creer un lieu sans nom.');
            return;
        }
        const target = sanitizeString(continent) || 'Divers';
        if (!Array.isArray(this.locationsData[target])) {
            this.locationsData[target] = [];
        }
        this.locationsData[target].push(normalized);
        this.refreshLocations({ focusName: normalized.name });
        this.persistLocations();
    }

    handleDeleteLocation({ originalContinent, originalName }) {
        const continentKey = sanitizeString(originalContinent) || 'Divers';
        const nameKey = sanitizeString(originalName);
        if (!nameKey) {
            return;
        }
        const sourceList = Array.isArray(this.locationsData[continentKey]) ? this.locationsData[continentKey] : [];
        const index = sourceList.findIndex(item => sanitizeString(item?.name) === nameKey);
        if (index === -1) {
            return;
        }
        const [removed] = sourceList.splice(index, 1);
        if (sourceList.length) {
            this.locationsData[continentKey] = sourceList;
        } else {
            delete this.locationsData[continentKey];
        }

        const removedName = removed?.name || originalName || '';
        if (removedName && this.state.hasFavorite(removedName)) {
            this.state.removeFavorite(removedName);
            this.preferences?.setFavorites?.(this.state.getFavorites());
        }
        if (removedName && this.preferences?.getLastLocation?.() === removedName) {
            this.preferences.setLastLocation(null);
        }
        if (this.activeEntry && sanitizeString(this.activeEntry.location?.name) === nameKey) {
            this.infoPanel?.close();
        }

        this.refreshLocations();
        this.persistLocations();

        if (removedName && this.announcer) {
            const message = localized('aria.locationDeleted', `${removedName} supprime.`, { location: removedName });
            this.announcer.polite(message);
        }
    }

    handleUpdateLocation({ continent, location, originalContinent, originalName }) {
        if (!location) {
            return;
        }
        const normalized = normalizeLocation(location);
        if (!normalized.name) {
            console.warn('Impossible de mettre a jour un lieu sans nom.');
            return;
        }
        const currentName = sanitizeString(originalName);
        const source = sanitizeString(originalContinent) || 'Divers';
        const target = sanitizeString(continent) || 'Divers';
        const sourceList = Array.isArray(this.locationsData[source]) ? this.locationsData[source] : [];
        const index = sourceList.findIndex(item => sanitizeString(item?.name) === currentName);
        if (index !== -1) {
            sourceList.splice(index, 1);
        }
        this.locationsData[source] = sourceList;
        if (!Array.isArray(this.locationsData[target])) {
            this.locationsData[target] = [];
        }
        this.locationsData[target].push(normalized);
        if (!this.locationsData[source].length && source !== target) {
            delete this.locationsData[source];
        }
        if (currentName && normalized.name && currentName !== normalized.name) {
            if (this.state.hasFavorite(currentName)) {
                this.state.removeFavorite(currentName);
                this.state.addFavorite(normalized.name);
                this.preferences?.setFavorites?.(this.state.getFavorites());
            }
            if (this.preferences?.getLastLocation?.() === currentName) {
                this.preferences.setLastLocation(normalized.name);
            }
        }
        this.refreshLocations({ focusName: normalized.name });
        this.persistLocations();
    }

    refreshLocations({ focusName } = {}) {
        this.sortStateDataset();
        this.buildSidebar(this.locationsData);
        this.refreshFilterMetadata({ reapply: false });
        this.state.sidebarView = 'all';
        this.applyFilters();
        this.renderFavoritesView();
        this.updateSidebarView();
        this.updateClusteringMetrics();
        this.updateRandomButtonState();
        if (focusName) {
            const entry = this.entries.find(candidate => candidate.location.name === focusName);
            if (entry) {
                this.ensureEntryVisible(entry);
                this.selectEntry(entry, { focusOnList: true, source: 'editor' });
                return;
            }
        }
        this.updateEditButton(null);
    }

    updateEditButton(location) {
        if (!this.dom.editLocation) {
            return;
        }
        const isAdmin = this.isAdmin();
        if (!isAdmin || !location) {
            this.dom.editLocation.disabled = true;
            this.dom.editLocation.setAttribute('aria-label', 'Modifier le lieu');
            return;
        }
        this.dom.editLocation.disabled = false;
        this.dom.editLocation.setAttribute('aria-label', `Modifier ${location.name}`);
    }
    createContinentSection(continentName, locations, index) {
        const wrapper = createElement('section', {
            className: 'continent',
            dataset: { continent: continentName }
        });

        const toggleButton = createElement('button', {
            className: 'continent-toggle',
            html: `${continentName} <span class="location-count">(${locations.length})</span>`,
            attributes: {
                type: 'button',
                'aria-expanded': 'false',
                'aria-controls': `continent-${index}`
            }
        });

        const content = createElement('div', {
            className: 'continent-content',
            attributes: {
                id: `continent-${index}`,
                'aria-hidden': 'true'
            }
        });
        content.style.display = 'none';

        const section = {
            name: continentName,
            wrapper,
            toggleButton,
            content,
            entries: [],
            pagination: {
                currentPage: Math.max(0, Number(this.preferences?.getPagination?.(continentName)) || 0),
                totalPages: 1,
                controls: null
            }
        };

        toggleButton.addEventListener('click', () => {
            this.setContinentExpanded(section, !this.isContinentExpanded(section));
            this.updateToggleAllState();
        });

        section.entries = locations.map(location => this.createLocationEntry(location, continentName));
        section.pagination.controls = section.entries.length > this.pageSize
            ? this.createPaginationControls(continentName)
            : null;
        section.pagination.totalPages = Math.max(1, Math.ceil(section.entries.length / this.pageSize));

        wrapper.appendChild(toggleButton);
        wrapper.appendChild(content);

        this.renderContinentEntries(section.entries, section.pagination, content);

        return section;
    }

    createLocationEntry(location, continentName) {
        const entry = {
            location,
            continent: continentName,
            matchesFilters: true,
            element: null,
            favoriteButton: null,
            markerEntry: null
        };

        const element = createElement('div', {
            className: 'location',
            dataset: { locationName: location.name },
            attributes: { tabindex: '0' }
        });

        const label = createElement('span', {
            className: 'location-label',
            text: location.name
        });

        const isFavorite = this.state.hasFavorite(location.name);
        const favoriteButton = createElement('button', {
            className: 'location-favorite-toggle',
            text: isFavorite ? favoriteIconActive() : favoriteIconInactive(),
            attributes: { type: 'button' }
        });

        favoriteButton.setAttribute('aria-pressed', String(isFavorite));
        favoriteButton.classList.toggle('active', isFavorite);
        const favoriteTitle = isFavorite
            ? localized('favorites.removeWithName', `Retirer ${location.name} des favoris`, { location: location.name })
            : localized('favorites.addWithName', `Ajouter ${location.name} aux favoris`, { location: location.name });
        favoriteButton.title = favoriteTitle;
        favoriteButton.setAttribute('aria-label', favoriteTitle);

        favoriteButton.addEventListener('click', event => {
            event.stopPropagation();
            this.setFavoriteState(location, !this.state.hasFavorite(location.name));
        });

        this.attachHoverTooltip(favoriteButton, this.favoriteTooltip, { placement: 'left' });

        element.appendChild(label);
        element.appendChild(favoriteButton);

        element.addEventListener('click', () => this.selectEntry(entry, { focusOnList: false, source: 'list' }));
        element.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.selectEntry(entry, { focusOnList: false, source: 'keyboard' });
            }
        });
        element.addEventListener('focus', () => element.classList.add('keyboard-focus'));
        element.addEventListener('blur', () => element.classList.remove('keyboard-focus'));

        entry.element = element;
        entry.favoriteButton = favoriteButton;
        entry.element.classList.toggle('is-favorite', isFavorite);
        entry.element.classList.toggle('favorite', isFavorite);

        entry.markerEntry = this.mapController.createEntry({
            location,
            continent: continentName,
            onSelect: () => {
                this.ensureEntryVisible(entry);
                this.selectEntry(entry, { focusOnList: false, source: 'map' });
            },
            onHover: () => element.classList.add('hover'),
            onLeave: () => element.classList.remove('hover')
        });

        entry.filterIndex = this.buildFilterIndexForEntry(entry);
        this.entries.push(entry);
        return entry;
    }

    createPaginationControls(continentName) {
        const container = createElement('div', { className: 'pagination-controls' });
        const previous = createElement('button', {
            className: 'pagination-button pagination-previous',
            text: '<',
            attributes: { type: 'button', 'aria-label': localized('pagination.previous', 'Page precedente') }
        });
        const next = createElement('button', {
            className: 'pagination-button pagination-next',
            text: '>',
            attributes: { type: 'button', 'aria-label': localized('pagination.next', 'Page suivante') }
        });
        const info = createElement('span', { className: 'pagination-info', text: '1/1' });

        container.appendChild(previous);
        container.appendChild(info);
        container.appendChild(next);

        return {
            container,
            previous,
            next,
            info,
            continentName
        };
    }

    renderContinentEntries(entries, pagination, container) {
        if (!container || !pagination) {
            return;
        }

        const controls = pagination.controls;
        if (controls?.container && controls.container.parentElement === container) {
            container.removeChild(controls.container);
        }

        clearElement(container);

        if (!entries.length) {
            const empty = createElement('p', {
                className: 'empty-continent',
                text: localized('search.noResult', 'Aucun lieu')
            });
            container.appendChild(empty);
            if (controls?.container) {
                controls.container.style.display = 'none';
                container.appendChild(controls.container);
            }
            container.style.maxHeight = '0';
            return;
        }

        pagination.totalPages = Math.max(1, Math.ceil(entries.length / this.pageSize));
        pagination.currentPage = Math.min(pagination.currentPage, pagination.totalPages - 1);

        const startIndex = pagination.currentPage * this.pageSize;
        const pageEntries = entries.slice(startIndex, startIndex + this.pageSize);
        pageEntries.forEach(entry => container.appendChild(entry.element));

        const scheduleHeightUpdate = () => {
            if (container.style.display === 'none') {
                return;
            }
            const applyHeight = () => {
                container.style.maxHeight = `${container.scrollHeight}px`;
            };
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(applyHeight);
            } else {
                applyHeight();
            }
        };

        scheduleHeightUpdate();

        if (!controls?.container) {
            return;
        }

        controls.info.textContent = `${pagination.currentPage + 1}/${pagination.totalPages}`;
        controls.previous.disabled = pagination.currentPage === 0;
        controls.next.disabled = pagination.currentPage >= pagination.totalPages - 1;
        controls.container.style.display = pagination.totalPages > 1 ? '' : 'none';

        controls.previous.onclick = () => {
            if (pagination.currentPage === 0) {
                return;
            }
            pagination.currentPage -= 1;
            this.renderContinentEntries(entries, pagination, container);
            if (this.preferences?.setPagination) {
                this.preferences.setPagination(controls.continentName, pagination.currentPage);
            }
        };

        controls.next.onclick = () => {
            if (pagination.currentPage >= pagination.totalPages - 1) {
                return;
            }
            pagination.currentPage += 1;
            this.renderContinentEntries(entries, pagination, container);
            if (this.preferences?.setPagination) {
                this.preferences.setPagination(controls.continentName, pagination.currentPage);
            }
        };

        controls.container.innerHTML = '';
        controls.container.appendChild(controls.previous);
        controls.container.appendChild(controls.info);
        controls.container.appendChild(controls.next);
        container.appendChild(controls.container);

        scheduleHeightUpdate();
    }
    isAdmin() {
        if (!this.authRequired) {
            return Boolean(this.auth?.authenticated);
        }
        return (this.auth?.role || '').toLowerCase() === 'admin';
    }

    setAuthState({ authenticated = false, role = 'guest', username = '' } = {}) {
        const previouslyAuthenticated = Boolean(this.auth?.authenticated);
        if (!this.authRequired) {
            if (authenticated) {
                this.auth = { authenticated: true, role: 'admin', username: username || this.auth.username || '' };
            } else {
                this.auth = { authenticated: false, role: 'guest', username: '' };
            }
        } else {
            this.auth = {
                authenticated: Boolean(authenticated),
                role: (role || 'guest').toLowerCase(),
                username: username || ''
            };
        }
        const nowAuthenticated = Boolean(this.auth?.authenticated);
        if (this.authRequired && !nowAuthenticated) {
            if (this.questEvents.size) {
                const affectedLocations = new Set();
                this.questEvents.forEach(event => {
                    const name = sanitizeString(event?.locationName);
                    if (name) {
                        affectedLocations.add(name);
                    }
                });
                this.questEvents.clear();
                affectedLocations.forEach(name => this.rebuildQuestSummariesForLocation(name));
                this.refreshFilterMetadata({ reapply: true });
                this.syncLocationEditorQuestEvents();
            }
            this.questEventsLoaded = false;
        }
        if (this.authRequired && !previouslyAuthenticated && nowAuthenticated && !this.questEventsLoaded) {
            this.fetchQuestEvents();
        }
        this.updateAuthUI();
    }

    updateAuthUI() {
        const authenticated = Boolean(this.auth?.authenticated);
        const isAdmin = this.isAdmin();
        if (this.dom.authPanel) {
            const hidePanel = !this.authRequired && authenticated;
            this.dom.authPanel.hidden = hidePanel;
        }
        if (this.dom.authStatus) {
            if (!this.authRequired) {
                if (authenticated) {
                    this.dom.authStatus.textContent = 'Edition locale active.';
                } else {
                    this.dom.authStatus.textContent = 'Edition reservee aux administrateurs (Discord non configure).';
                }
            } else if (authenticated) {
                const name = this.auth?.username ? ` (${this.auth.username})` : '';
                if (isAdmin) {
                    this.dom.authStatus.textContent = `Connecte en tant qu'administrateur${name}.`;
                } else {
                    this.dom.authStatus.textContent = `Connecte en tant qu'utilisateur${name}. Edition reservee aux administrateurs.`;
                }
            } else {
                this.dom.authStatus.textContent = 'Connexion requise pour modifier les lieux.';
            }
        }
        if (this.dom.loginButton) {
            this.dom.loginButton.hidden = !this.authRequired || authenticated;
        }
        if (this.dom.logoutButton) {
            this.dom.logoutButton.hidden = !this.authRequired || !authenticated;
        }
        if (this.dom.userAdminButton) {
            this.dom.userAdminButton.hidden = !isAdmin;
        }
        if (!isAdmin) {
            this.closeUserAdminPanel(true);
        }
        if (this.dom.addLocation) {
            this.dom.addLocation.disabled = !isAdmin;
            this.dom.addLocation.setAttribute('aria-disabled', String(!isAdmin));
        }
        if (this.locationEditor?.deleteButton) {
            this.locationEditor.deleteButton.disabled = !isAdmin;
            this.locationEditor.deleteButton.hidden = !isAdmin;
        }
        this.updateEditButton(this.activeEntry?.location || null);
        this.updateAnnotationButton();
        if (this.eventsFeed) {
            this.eventsFeed.setCanDeleteResolver(() => this.isAdmin());
        }
    }

    async fetchSession() {
        if (typeof fetch !== 'function') {
            this.authRequired = false;
            this.setAuthState({ authenticated: true, role: 'admin', username: '' });
            return;
        }
        try {
            const response = await fetch('/auth/session', { credentials: 'include' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const payload = await response.json();
            this.authRequired = payload?.authRequired !== false;
            const authenticated = Boolean(payload?.authenticated);
            const role = payload?.role || (authenticated ? 'user' : 'guest');
            const username = payload?.username || '';
            this.setAuthState({ authenticated, role, username });
        } catch (error) {
            console.error('[auth] session fetch failed', error);
            this.authRequired = true;
            this.setAuthState({ authenticated: false, role: 'guest', username: '' });
        }
    }

    bindAuthPanel() {
        if (!this.dom.authPanel) {
            this.authRequired = false;
            this.setAuthState({ authenticated: true, role: 'admin', username: '' });
            return;
        }
        if (this.dom.loginButton) {
            this.dom.loginButton.addEventListener('click', () => {
                window.location.href = '/auth/discord/login';
            });
        }
        if (this.dom.logoutButton) {
            this.dom.logoutButton.addEventListener('click', async () => {
                try {
                    await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
                } catch (error) {
                    console.error('[auth] logout failed', error);
                }
                await this.fetchSession();
            });
        }
        this.updateAuthUI();
        this.fetchSession();
    }

    setupUserAdminPanel() {
        if (!this.dom.userAdminContainer) {
            return;
        }
        if (!this.userAdminPanel) {
            this.userAdminPanel = new UserAdminPanel({
                container: this.dom.userAdminContainer,
                onClose: () => this.closeUserAdminPanel(true),
                fetchUsers: () => this.fetchUsersList(),
                onAddUser: payload => this.createUser(payload),
                onUpdateUser: payload => this.updateUser(payload),
                onDeleteUser: user => this.removeUser(user)
            });
        }
        if (this.dom.userAdminButton && !this.dom.userAdminButton.dataset.bound) {
            this.dom.userAdminButton.addEventListener('click', () => this.openUserAdminPanel());
            this.dom.userAdminButton.dataset.bound = 'true';
        }
        if (this.dom.userAdminOverlay && !this.dom.userAdminOverlay.dataset.bound) {
            this.dom.userAdminOverlay.addEventListener('click', event => {
                if (event.target === this.dom.userAdminOverlay) {
                    this.closeUserAdminPanel(true);
                }
            });
            this.dom.userAdminOverlay.dataset.bound = 'true';
        }
        this.closeUserAdminPanel(true);
    }

    async fetchUsersList() {
        const response = await fetch('/api/admin/users', { credentials: 'include' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        return Array.isArray(payload?.users) ? payload.users : [];
    }

    async createUser(payload) {
        try {
            const response = await fetch('/api/admin/users', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: 'manual',
                    username: payload.username,
                    role: payload.role
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const result = await response.json();
            if (result?.token) {
                window.prompt('Nouvel utilisateur cree. Copiez le token API :', result.token);
            }
            await this.refreshUserAdminPanel();
            this.userAdminPanel?.resetAddForm();
            this.announcer?.polite?.('Utilisateur manuel ajoute.');
        } catch (error) {
            console.error('[admin] create user failed', error);
            this.announcer?.assertive?.("Impossible de creer l'utilisateur.");
        }
    }

    async updateUser(payload) {
        try {
            const response = await fetch('/api/admin/users', {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const result = await response.json();
            if (result?.token) {
                window.prompt('Nouveau token genere :', result.token);
            }
            await this.refreshUserAdminPanel();
            this.announcer?.polite?.('Utilisateur mis a jour.');
        } catch (error) {
            console.error('[admin] update user failed', error);
            this.announcer?.assertive?.('Mise a jour impossible.');
        }
    }

    async removeUser(user) {
        const confirmed = window.confirm(`Supprimer l'utilisateur "${user.username || user.id}" ?`);
        if (!confirmed) {
            return;
        }
        try {
            const response = await fetch('/api/admin/users', {
                method: 'DELETE',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: user.id })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            await this.refreshUserAdminPanel();
            this.announcer?.polite?.('Utilisateur supprime.');
        } catch (error) {
            console.error('[admin] delete user failed', error);
            this.announcer?.assertive?.('Suppression impossible.');
        }
    }

    async refreshUserAdminPanel() {
        if (!this.userAdminPanel) {
            return;
        }
        try {
            const users = await this.fetchUsersList();
            await this.userAdminPanel.refresh(users);
        } catch (error) {
            console.error('[admin] fetch users failed', error);
            this.announcer?.assertive?.('Impossible de charger la liste des utilisateurs.');
        }
    }

    async openUserAdminPanel() {
        if (!this.isAdmin()) {
            this.announcer?.assertive?.('Connexion administrateur requise.');
            return;
        }
        if (!this.dom.userAdminOverlay || !this.userAdminPanel) {
            return;
        }
        await this.refreshUserAdminPanel();
        this.dom.userAdminOverlay.hidden = false;
        this.dom.userAdminOverlay.classList.add('open');
    }

    closeUserAdminPanel(force = false) {
        if (!this.dom.userAdminOverlay) {
            return;
        }
        this.dom.userAdminOverlay.classList.remove('open');
        this.dom.userAdminOverlay.hidden = true;
        if (force) {
            this.dom.userAdminOverlay.scrollTop = 0;
        }
    }

    bindTabs() {
        const attach = (button, view) => {
            if (!button) {
                return;
            }
            button.addEventListener('click', () => this.setSidebarView(view));
            button.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.setSidebarView(view);
                }
            });
        };

        attach(this.dom.tabAll, 'all');
        attach(this.dom.tabFavorites, 'favorites');
    }

    bindToggleAll() {
        if (!this.dom.toggleAll) {
            return;
        }
        this.updateToggleAllLabel();
        this.dom.toggleAll.addEventListener('click', () => {
            this.toggleAllState = !this.toggleAllState;
            this.continents.forEach(section => this.setContinentExpanded(section, this.toggleAllState));
            this.updateToggleAllLabel();
        });
    }

    bindClustering() {
        const toggle = this.dom.clusteringToggle;
        if (!toggle) {
            return;
        }
        const stored = Boolean(this.preferences?.getClustering?.());
        toggle.checked = stored;
        this.mapController.setClusteringEnabled(stored);

        toggle.addEventListener('change', () => {
            const enabled = toggle.checked;
            this.mapController.setClusteringEnabled(enabled);
            if (this.preferences?.setClustering) {
                this.preferences.setClustering(enabled);
            }
            this.updateClusteringMetrics();
            this.dismissOnboarding('clustering');
        });

        const container = toggle.closest('#clustering-container') || toggle;
        this.attachHoverTooltip(container, this.clusteringTooltip, { placement: 'bottom' });
    }

    bindMarkerScale() {
        const input = this.dom.markerScaleInput;
        if (!input) {
            return;
        }
        const stored = this.preferences?.getMarkerScale?.();
        if (typeof stored === 'number') {
            this.setMarkerScale(stored, { persist: false });
            input.value = String(Math.round(stored));
        } else {
            this.setMarkerScale(Number(input.value) || 100, { persist: false });
        }

        input.addEventListener('input', () => {
            this.setMarkerScale(input.value, { persist: false });
        });

        input.addEventListener('change', () => {
            this.setMarkerScale(input.value, { persist: true });
        });
    }

    bindFavoriteToggle() {
        if (!this.dom.favoriteToggle) {
            return;
        }
        this.dom.favoriteToggle.addEventListener('click', () => {
            if (!this.activeEntry) {
                return;
            }
            const location = this.activeEntry.location;
            this.setFavoriteState(location, !this.state.hasFavorite(location.name));
        });
        this.attachHoverTooltip(this.dom.favoriteToggle, this.favoriteTooltip, { placement: 'left' });
    }

    bindRandomButton() {
        if (!this.dom.randomButton) {
            return;
        }
        this.dom.randomButton.addEventListener('click', () => this.goToRandomLocation());
    }

    bindCoordinateTool() {
        const button = this.dom.captureCoordinates;
        if (!button) {
            return;
        }

        this.updateCoordinateButton();
        button.addEventListener('click', () => {
            if (this.coordinateTool.active) {
                this.stopCoordinateMode(true);
            } else {
                this.startCoordinateMode();
            }
        });
    }

    bindMeasurementTool() {
        const button = this.dom.measureDistance;
        if (!button) {
            return;
        }

        this.updateMeasurementButton();
        button.addEventListener('click', () => {
            if (this.measurement.active) {
                this.stopMeasurementMode(true);
            } else {
                this.startMeasurementMode();
            }
        });
    }

    startMeasurementMode() {
        if (this.measurement.active) {
            return;
        }
        if (this.coordinateTool.active) {
            this.stopCoordinateMode(false);
        }
        if (this.annotationTool.active) {
            this.stopAnnotationMode(false);
        }
        this.measurement.active = true;
        this.measurement.points = [];
        if (!this.measurementClickUnsubscribe && this.mapController) {
            this.measurementClickUnsubscribe = this.mapController.onMapClick(event => this.handleMeasurementClick(event));
        }
        this.updateMeasurementButton();
        const message = localized('distance.active', 'Outil de mesure actif. Cliquez deux points sur la carte pour calculer la distance.');
        this.announcer?.polite(message);
        this.showControlMessage({
            button: this.dom.measureDistance,
            tooltip: this.measureTooltip,
            message,
            duration: 3000
        });
    }

    stopMeasurementMode(announce = false) {
        if (!this.measurement.active) {
            return;
        }
        this.measurement.active = false;
        this.measurement.points = [];
        if (this.measurementClickUnsubscribe) {
            this.measurementClickUnsubscribe();
            this.measurementClickUnsubscribe = null;
        }
        this.updateMeasurementButton();
        this.clearControlMessage(this.measureTooltip);
        if (announce) {
            const message = localized('distance.cancelled', 'Outil de mesure desactive.');
            this.announcer?.polite(message);
        }
    }

    handleMeasurementClick(event) {
        if (!this.measurement.active) {
            return;
        }
        const coords = this.mapController?.toPixelCoordinates(event?.latlng);
        if (!coords) {
            return;
        }
        const roundedX = Math.round(coords.x);
        const roundedY = Math.round(coords.y);
        this.measurement.points.push({ x: coords.x, y: coords.y });
        console.info(`Mesure - point ${this.measurement.points.length} -> x: ${roundedX}, y: ${roundedY}`);

        if (this.measurement.points.length === 1) {
            const message = localized('distance.pointStored', `Point de depart enregistre : x ${roundedX}, y ${roundedY}.`, { x: roundedX, y: roundedY });
            this.announcer?.polite(message);
            this.showControlMessage({
                button: this.dom.measureDistance,
                tooltip: this.measureTooltip,
                message,
                duration: 3000
            });
            return;
        }

        const start = this.measurement.points.shift();
        const dx = coords.x - start.x;
        const dy = coords.y - start.y;
        const distancePx = Math.hypot(dx, dy);
        const distanceKm = distancePx * KM_PER_PIXEL;
        const message = localized(
            'distance.result',
            `Distance : ${distanceKm.toFixed(1)} km (${distancePx.toFixed(1)} px).`,
            { distance: distanceKm.toFixed(1), pixels: distancePx.toFixed(1) }
        );
        console.info(`Mesure - distance = ${distancePx.toFixed(2)} px (${distanceKm.toFixed(2)} km)`);
        this.announcer?.polite(message);
        this.showControlMessage({
            button: this.dom.measureDistance,
            tooltip: this.measureTooltip,
            message,
            duration: 5000
        });
        this.measurement.points = [];
    }

    updateMeasurementButton() {
        const button = this.dom.measureDistance;
        if (!button) {
            return;
        }
        const active = Boolean(this.measurement.active);
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
        const label = localized(
            active ? 'distance.active' : 'distance.enable',
            active
                ? 'Outil de mesure actif. Cliquez deux points sur la carte pour calculer la distance.'
                : 'Activer la mesure de distance'
        );
        button.setAttribute('aria-label', label);
        button.title = label;
    }

    updateCoordinateButton() {
        const button = this.dom.captureCoordinates;
        if (!button) {
            return;
        }
        const active = Boolean(this.coordinateTool.active);
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
        const label = localized(
            active ? 'coords.active' : 'coords.enable',
            active
                ? 'Outil de capture actif. Cliquez sur la carte pour obtenir les coordonnees.'
                : 'Activer l\'outil d\'obtention des coordonnees'
        );
        button.setAttribute('aria-label', label);
        button.title = label;
    }

    startCoordinateMode() {
        if (this.coordinateTool.active) {
            return;
        }
        if (this.measurement.active) {
            this.stopMeasurementMode(false);
        }
        if (this.annotationTool.active) {
            this.stopAnnotationMode(false);
        }
        this.coordinateTool.active = true;
        if (!this.coordinateClickUnsubscribe && this.mapController) {
            this.coordinateClickUnsubscribe = this.mapController.onMapClick(event => this.handleCoordinateClick(event));
        }
        this.updateCoordinateButton();
        const message = localized('coords.active', 'Outil de capture actif. Cliquez sur la carte pour obtenir les coordonnees.');
        this.announcer?.polite(message);
        this.showControlMessage({
            button: this.dom.captureCoordinates,
            tooltip: this.coordinateTooltip,
            message,
            duration: 3000
        });
    }

    stopCoordinateMode(announce = false) {
        if (!this.coordinateTool.active) {
            return;
        }
        this.coordinateTool.active = false;
        if (this.coordinateClickUnsubscribe) {
            this.coordinateClickUnsubscribe();
            this.coordinateClickUnsubscribe = null;
        }
        this.updateCoordinateButton();
        this.clearControlMessage(this.coordinateTooltip);
        if (announce) {
            const message = localized('coords.cancelled', 'Outil de coordonnees desactive.');
            this.announcer?.polite(message);
        }
    }

    handleCoordinateClick(event) {
        if (!this.coordinateTool.active) {
            return;
        }
        const coords = this.mapController?.toPixelCoordinates(event?.latlng);
        if (!coords) {
            return;
        }
        const roundedX = Math.round(coords.x);
        const roundedY = Math.round(coords.y);
        console.info(`Coordonnees - x: ${roundedX}, y: ${roundedY}`);
        const message = localized('coords.result', `Coordonnees : x ${roundedX} px, y ${roundedY} px.`, { x: roundedX, y: roundedY });
        this.announcer?.polite(message);
        this.showControlMessage({
            button: this.dom.captureCoordinates,
            tooltip: this.coordinateTooltip,
            message,
            duration: 4000
        });
    }

    bindAnnotationTool() {
        const button = this.dom.annotationButton;
        if (!button) {
            return;
        }
        this.updateAnnotationButton();
        button.addEventListener('click', () => {
            if (this.annotationTool.active) {
                this.stopAnnotationMode(true);
            } else {
                this.startAnnotationMode();
            }
        });
    }

    updateAnnotationButton() {
        const button = this.dom.annotationButton;
        if (!button) {
            return;
        }
        button.setAttribute('aria-pressed', String(Boolean(this.annotationTool.active)));
        const disabled = !this.auth?.authenticated;
        button.disabled = disabled;
        button.setAttribute('aria-disabled', String(disabled));
        if (disabled && this.annotationTool.active) {
            this.stopAnnotationMode(false);
        }
    }

    startAnnotationMode() {
        if (this.annotationTool.active) {
            return;
        }
        if (!this.auth?.authenticated) {
            this.announcer?.assertive?.('Connexion requise pour ajouter une annotation.');
            return;
        }
        if (this.measurement.active) {
            this.stopMeasurementMode(false);
        }
        if (this.coordinateTool.active) {
            this.stopCoordinateMode(false);
        }
        this.annotationTool.active = true;
        if (!this.annotationTool.clickUnsubscribe && this.mapController) {
            this.annotationTool.clickUnsubscribe = this.mapController.onMapClick(event => this.handleAnnotationClick(event));
        }
        this.updateAnnotationButton();
        const message = 'Cliquez sur la carte pour placer une annotation.';
        this.announcer?.polite(message);
        this.showControlMessage({
            button: this.dom.annotationButton,
            tooltip: this.annotationTooltip,
            message,
            duration: 4000
        });
    }

    stopAnnotationMode(announce = false) {
        if (!this.annotationTool.active) {
            return;
        }
        this.annotationTool.active = false;
        if (this.annotationTool.clickUnsubscribe) {
            this.annotationTool.clickUnsubscribe();
            this.annotationTool.clickUnsubscribe = null;
        }
        this.updateAnnotationButton();
        this.clearControlMessage(this.annotationTooltip);
        if (announce) {
            this.announcer?.polite('Mode annotation desactive.');
        }
    }

    async handleAnnotationClick(event) {
        if (!this.annotationTool.active) {
            return;
        }
        const coords = this.mapController?.toPixelCoordinates(event?.latlng);
        if (!coords) {
            return;
        }
        const roundedX = Math.round(coords.x);
        const roundedY = Math.round(coords.y);
        const details = this.promptAnnotationDetails({ x: roundedX, y: roundedY });
        if (!details) {
            this.stopAnnotationMode(false);
            return;
        }
        await this.createAnnotation({
            x: roundedX,
            y: roundedY,
            label: details.label,
            color: details.color,
            icon: details.icon || null,
            scope: details.scope
        });
        this.stopAnnotationMode(false);
    }

    promptAnnotationDetails({ x, y }) {
        const labelInput = window.prompt(`Annotation - (${x}, ${y})\nTitre de l'annotation :`, '');
        const label = labelInput ? labelInput.trim() : '';
        if (!label) {
            this.announcer?.polite('Annotation annulee.');
            return null;
        }
        const colorInput = window.prompt('Couleur hex (ex: #ff8a00) ou laissez vide :', '#ff8a00') || '#ff8a00';
        const color = this.normalizeAnnotationColor(colorInput);
        const scopeInput = window.prompt('Portee (public, party, private) :', 'public') || 'public';
        const normalizedScope = (() => {
            const candidate = scopeInput.toLowerCase().trim();
            const allowed = ['public', 'party', 'private'];
            return allowed.includes(candidate) ? candidate : 'public';
        })();
        return {
            label,
            color,
            scope: normalizedScope
        };
    }

    normalizeAnnotationColor(value) {
        const normalized = (value || '').toString().trim();
        if (!normalized) {
            return '#ff8a00';
        }
        if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) {
            return normalized;
        }
        if (/^[0-9a-f]{3}$/i.test(normalized)) {
            return `#${normalized}`;
        }
        if (/^[0-9a-f]{6}$/i.test(normalized)) {
            return `#${normalized}`;
        }
        return '#ff8a00';
    }

    async createAnnotation(annotation) {
        if (!annotation || !this.auth?.authenticated) {
            return;
        }
        try {
            const locationName = this.activeEntry?.location?.name || '';
            const response = await fetch('/api/annotations', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    x: annotation.x,
                    y: annotation.y,
                    label: annotation.label,
                    color: annotation.color,
                    scope: annotation.scope,
                    locationName: locationName
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const payload = await response.json();
            if (payload?.annotation) {
                this.announcer?.polite('Annotation ajoutee. Elle apparaitra sur la carte.');
                this.annotations.set(payload.annotation.id, payload.annotation);
                this.mapController.addAnnotation(payload.annotation);
            }
        } catch (error) {
            console.error('[annotations] creation failed', error);
            this.announcer?.assertive?.('Impossible de creer l\'annotation.');
        }
    }

    async requestAnnotationDeletion(annotationId) {
        if (!this.isAdmin() || !annotationId) {
            return;
        }
        const confirmation = window.confirm('Supprimer cette annotation ?');
        if (!confirmation) {
            return;
        }
        try {
            const response = await fetch(`/api/annotations/${encodeURIComponent(annotationId)}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!response.ok && response.status !== 204) {
                throw new Error(`HTTP ${response.status}`);
            }
            this.announcer?.polite('Annotation supprimee.');
            this.annotations.delete(annotationId);
            this.mapController.removeAnnotation(annotationId);
        } catch (error) {
            console.error('[annotations] suppression impossible', error);
            this.announcer?.assertive?.('Erreur lors de la suppression de l\'annotation.');
        }
    }

    async createQuestEvent({ locationName, questId, status, milestone, progress, note }) {
        if (!this.isAdmin()) {
            throw new Error('Droits administrateur requis pour creer un evenement de quete.');
        }
        const payload = {
            locationName,
            questId,
            status,
            milestone: milestone || undefined,
            note: note || undefined
        };
        if (progress && typeof progress === 'object') {
            const normalized = {};
            if (Number.isFinite(progress.current)) {
                normalized.current = Number(progress.current);
            }
            if (Number.isFinite(progress.max)) {
                normalized.max = Number(progress.max);
            }
            if (Object.keys(normalized).length) {
                payload.progress = normalized;
            }
        }

        try {
            const response = await fetch('/api/quest-events', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                let message = `HTTP ${response.status}`;
                try {
                    const errorPayload = await response.json();
                    if (errorPayload?.message) {
                        message = errorPayload.message;
                    }
                } catch (error) {
                    // ignore parse errors
                }
                throw new Error(message);
            }
            const result = await response.json();
            if (result?.event) {
                this.handleQuestUpdated({ event: result.event });
            }
            return result;
        } catch (error) {
            console.error('[quest-event] creation failed', error);
            throw error;
        }
    }

    async updateQuestEvent({ id, locationName, questId, status, milestone, progress, note }) {
        if (!this.isAdmin()) {
            throw new Error('Droits administrateur requis pour modifier un evenement de quete.');
        }
        if (!id) {
            throw new Error('Identifiant de evenement requis.');
        }
        const payload = {
            questId,
            locationName,
            status,
            milestone: milestone || undefined,
            note: note || undefined
        };
        if (progress && typeof progress === 'object') {
            const normalized = {};
            if (Number.isFinite(progress.current)) {
                normalized.current = Number(progress.current);
            }
            if (Number.isFinite(progress.max)) {
                normalized.max = Number(progress.max);
            }
            if (Object.keys(normalized).length) {
                payload.progress = normalized;
            }
        }
        try {
            const response = await fetch(`/api/quest-events/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                let message = `HTTP ${response.status}`;
                try {
                    const errorPayload = await response.json();
                    if (errorPayload?.message) {
                        message = errorPayload.message;
                    }
                } catch (error) {
                    // ignore parse errors
                }
                throw new Error(message);
            }
            const result = await response.json();
            if (result?.event) {
                this.handleQuestUpdated({ event: result.event });
            }
            return result;
        } catch (error) {
            console.error('[quest-event] update failed', error);
            throw error;
        }
    }

    async deleteQuestEvent(eventId) {
        if (!this.isAdmin()) {
            throw new Error('Droits administrateur requis pour supprimer un evenement de quete.');
        }
        if (!eventId) {
            return;
        }
        const existing = this.questEvents.get(eventId) || null;
        const response = await fetch(`/api/quest-events/${encodeURIComponent(eventId)}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!response.ok && response.status !== 204) {
            let message = `HTTP ${response.status}`;
            try {
                const errorPayload = await response.json();
                if (errorPayload?.message) {
                    message = errorPayload.message;
                }
            } catch (error) {
                // ignore parse errors
            }
            throw new Error(message);
        }
        if (existing) {
            this.questEvents.delete(existing.id);
            this.removeQuestEventFromLocation(existing);
            this.eventsFeed.addEvent({
                id: `quest-delete-${existing.id}-${Date.now()}`,
                type: 'quests',
                title: 'Quete supprimee',
                description: existing.questId ? `Quete ${existing.questId} retiree.` : 'Quete retiree.',
                timestamp: new Date().toISOString(),
                questId: existing.questId || null
            });
        }
        this.syncLocationEditorQuestEvents();
    }

    removeQuestEventFromLocation(event) {
        const locationName = sanitizeString(event?.locationName);
        if (!locationName) {
            return;
        }
        this.rebuildQuestSummariesForLocation(locationName);
    }

    rebuildQuestSummariesForLocation(locationName) {
        const normalizedTarget = sanitizeString(locationName).toLowerCase();
        if (!normalizedTarget) {
            return;
        }
        Object.values(this.locationsData || {}).forEach(list => {
            list?.forEach(location => {
                if (sanitizeString(location.name).toLowerCase() !== normalizedTarget) {
                    return;
                }
                const base = Array.isArray(location.quests) ? location.quests : [];
                location.quests = base.filter(entry => !entry.startsWith('[LIVE]'));
            });
        });
        const entry = this.entries.find(candidate => sanitizeString(candidate.location.name).toLowerCase() === normalizedTarget);
        if (entry) {
            const base = Array.isArray(entry.location.quests) ? entry.location.quests : [];
            entry.location.quests = base.filter(item => !item.startsWith('[LIVE]'));
        }
        const relevant = Array.from(this.questEvents.values()).filter(event => sanitizeString(event.locationName).toLowerCase() === normalizedTarget);
        relevant
            .slice()
            .sort((a, b) => new Date(a?.updatedAt || a?.createdAt || 0).getTime() - new Date(b?.updatedAt || b?.createdAt || 0).getTime())
            .forEach(event => this.applyQuestEventToLocation(event));
    }

    showControlMessage({ button, tooltip, message, duration = 4000, placement = 'top' }) {
        if (!button || !tooltip || !message) {
            return;
        }
        this.clearControlMessage(tooltip, false);
        const textNode = tooltip.querySelector('.ui-tooltip-text');
        if (textNode) {
            textNode.textContent = message;
        } else {
            tooltip.textContent = message;
        }
        this.showTooltip(button, tooltip, { placement, persistent: false });
        const timeoutId = window.setTimeout(() => {
            this.hideTooltip(tooltip);
            this.controlTooltipTimeouts.delete(tooltip);
        }, Math.max(1500, duration));
        this.controlTooltipTimeouts.set(tooltip, timeoutId);
    }

    clearControlMessage(tooltip, hide = true) {
        if (!tooltip) {
            return;
        }
        const timeoutId = this.controlTooltipTimeouts.get(tooltip);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.controlTooltipTimeouts.delete(tooltip);
        }
        if (hide) {
            this.hideTooltip(tooltip);
        }
    }

    bindMapKeyboardShortcuts() {
        if (this.boundKeyboardShortcuts) {
            return;
        }
        this.keyboardHandler = event => {
            if (event.defaultPrevented || isInteractiveTextField(event.target)) {
                return;
            }
            if (event.key === 'f' || event.key === 'F') {
                if (this.activeEntry) {
                    this.setFavoriteState(this.activeEntry.location, !this.state.hasFavorite(this.activeEntry.location.name));
                }
            } else if (event.key === 'r' || event.key === 'R') {
                this.goToRandomLocation();
            } else if (event.key === 'm' || event.key === 'M') {
                if (this.measurement.active) {
                    this.stopMeasurementMode(true);
                } else {
                    this.startMeasurementMode();
                }
            } else if (event.key === 'o' || event.key === 'O') {
                if (this.coordinateTool.active) {
                    this.stopCoordinateMode(true);
                } else {
                    this.startCoordinateMode();
                }
            } else if (event.key === 'c' || event.key === 'C') {
                if (this.dom.clusteringToggle) {
                    this.dom.clusteringToggle.checked = !this.dom.clusteringToggle.checked;
                    this.dom.clusteringToggle.dispatchEvent(new Event('change'));
                }
            }
        };
        document.addEventListener('keydown', this.keyboardHandler);
        this.boundKeyboardShortcuts = true;
    }

    bindMapBackgroundDismissal() {
        if (!this.mapController || !this.infoPanel) {
            return;
        }

        if (typeof this.mapClickUnsubscribe === 'function') {
            this.mapClickUnsubscribe();
        }

        this.mapClickUnsubscribe = this.mapController.onMapClick(event => {
            if (this.measurement?.active || this.coordinateTool?.active || this.annotationTool?.active) {
                return;
            }
            const sidebar = this.dom.infoSidebar;
            if (!sidebar?.classList.contains('open')) {
                return;
            }

            const originalEvent = event?.originalEvent;
            if (originalEvent?.defaultPrevented) {
                return;
            }

            if (typeof originalEvent?.button === 'number' && originalEvent.button !== 0) {
                return;
            }

            const target = originalEvent?.target;
            if (target && typeof target.closest === 'function') {
                if (target.closest('.leaflet-interactive') || target.closest('.leaflet-control')) {
                    return;
                }
            }

            this.infoPanel.close();
        });
    }

    restoreMapState() {
        const mapState = this.preferences?.getMapState?.();
        if (mapState) {
            this.mapController.setMapState(mapState);
            this.state.mapState = mapState;
        }
    }

    restoreLastLocation() {
        const lastLocationName = this.preferences?.getLastLocation?.();
        if (!lastLocationName) {
            return;
        }
        const entry = this.entries.find(candidate => candidate.location.name === lastLocationName);
        if (!entry || !entry.matchesFilters) {
            return;
        }
        this.ensureEntryVisible(entry);
        this.selectEntry(entry, { focusOnList: false, source: 'restore' });
    }

    async loadRealtimeData() {
        try {
            await Promise.allSettled([
                this.fetchAnnotations(),
                this.fetchQuestEvents()
            ]);
        } catch (error) {
            console.warn('[realtime] Erreur lors du chargement des donnees temps reel', error);
        }
    }

    async fetchAnnotations() {
        try {
            const response = await fetch('/api/annotations', { cache: 'no-store', credentials: 'include' });
            if (!response.ok) {
                return;
            }
            const payload = await response.json();
            if (!Array.isArray(payload?.annotations)) {
                return;
            }
            this.applyAnnotationBootstrap(payload.annotations);
        } catch (error) {
            console.warn('[realtime] Impossible de charger les annotations', error);
        }
    }

    applyAnnotationBootstrap(list = []) {
        const registry = new Map();
        list.forEach(annotation => {
            if (annotation?.id) {
                registry.set(annotation.id, annotation);
            }
        });
        this.annotations = registry;
        this.mapController.setAnnotations(Array.from(registry.values()));
    }

    handleAnnotationCreated(data) {
        if (!data || typeof data !== 'object') {
            return;
        }
        const annotation = data.annotation || data;
        if (!annotation?.id) {
            return;
        }
        this.annotations.set(annotation.id, annotation);
        this.mapController.addAnnotation(annotation);
        const locationLabel = sanitizeString(annotation.locationName);
        const messageParts = [
            annotation.label || 'Annotation ajoutee',
            locationLabel ? `@ ${locationLabel}` : null
        ].filter(Boolean);
        if (messageParts.length) {
            this.announcer?.polite(messageParts.join(' - '));
        }
        const descriptionParts = [
            locationLabel ? `@ ${locationLabel}` : null,
            annotation.scope ? `Portee : ${annotation.scope}` : null,
            Number.isFinite(annotation.x) && Number.isFinite(annotation.y)
                ? `(${Math.round(annotation.x)}, ${Math.round(annotation.y)})`
                : null
        ].filter(Boolean);
        this.eventsFeed.addEvent({
            id: `annotation-${annotation.id}-${annotation.updatedAt || annotation.createdAt || Date.now()}`,
            type: 'annotations',
            title: annotation.label || 'Annotation ajoutee',
            description: descriptionParts.join(' - ') || 'Annotation creee.',
            timestamp: annotation.updatedAt || annotation.createdAt || new Date().toISOString(),
            annotationId: annotation.id
        });
    }

    handleAnnotationDeleted(payload) {
        const annotationId = payload?.id;
        if (!annotationId || !this.annotations.has(annotationId)) {
            return;
        }
        const previous = this.annotations.get(annotationId);
        this.annotations.delete(annotationId);
        this.mapController.removeAnnotation(annotationId);
        const label = previous?.label ? ` "${previous.label}"` : '';
        this.announcer?.polite(`Annotation${label} supprimee.`);
        const descriptionParts = [
            previous?.locationName ? `@ ${sanitizeString(previous.locationName)}` : null,
            Number.isFinite(previous?.x) && Number.isFinite(previous?.y)
                ? `(${Math.round(previous.x)}, ${Math.round(previous.y)})`
                : null
        ].filter(Boolean);
        this.eventsFeed.addEvent({
            id: `annotation-delete-${annotationId}-${Date.now()}`,
            type: 'annotations',
            title: 'Annotation supprimee',
            description: descriptionParts.join(' - ') || 'Annotation retiree de la carte.',
            timestamp: new Date().toISOString(),
            annotationId
        });
    }

    async fetchQuestEvents() {
        if (this.authRequired && !this.auth?.authenticated) {
            return;
        }
        try {
            const response = await fetch('/api/quest-events', { cache: 'no-store', credentials: 'include' });
            if (!response.ok) {
                return;
            }
            const payload = await response.json();
            if (!Array.isArray(payload?.events)) {
                return;
            }
            this.applyQuestEventBootstrap(payload.events);
            this.questEventsLoaded = true;
        } catch (error) {
            console.warn('[realtime] Impossible de charger les evenements de quete', error);
        }
    }

    applyQuestEventBootstrap(events = []) {
        const registry = new Map();
        events.forEach(event => {
            if (event?.id) {
                registry.set(event.id, event);
            }
        });
        this.questEvents = registry;
        this.questEventsLoaded = true;
        registry.forEach(event => this.applyQuestEventToLocation(event));
        const recent = events.slice(-5);
        recent.forEach(event => {
            this.eventsFeed.addEvent({
                id: `quest-${event.id}`,
                type: 'quests',
                title: this.formatQuestEventLabel(event),
                description: event.note || `Quete ${event.questId || 'inconnue'} mise a jour.`,
                timestamp: event.updatedAt || new Date().toISOString(),
                questId: event.questId || null
            });
        });
        this.refreshFilterMetadata({ reapply: true });
        this.syncLocationEditorQuestEvents();
    }

    handleQuestUpdated(payload) {
        const event = payload?.event || payload;
        if (!event?.id) {
            return;
        }
        this.questEvents.set(event.id, event);
        this.applyQuestEventToLocation(event);
        const message = [
            event.questId,
            event.status,
            event.milestone,
            event.locationName ? `@ ${event.locationName}` : null,
            event.progress && Number.isFinite(event.progress.current)
                ? (Number.isFinite(event.progress.max)
                    ? `${event.progress.current}/${event.progress.max}`
                    : `${event.progress.current}`)
                : null
        ].filter(Boolean).join(' - ');
        if (message) {
            this.announcer?.polite(message);
        }
        this.eventsFeed.addEvent({
            id: `quest-${event.id}-${event.updatedAt || Date.now()}`,
            type: 'quests',
            title: this.formatQuestEventLabel(event),
            description: event.note || `Quete ${event.questId || 'inconnue'} mise a jour.`,
            timestamp: event.updatedAt || new Date().toISOString(),
            questId: event.questId || null
        });
        this.refreshFilterMetadata({ reapply: true });
        this.syncLocationEditorQuestEvents();
    }

    handleQuestDeleted(payload) {
        const id = payload?.id;
        if (!id) {
            return;
        }
        const existing = this.questEvents.get(id);
        if (!existing) {
            return;
        }
        this.questEvents.delete(id);
        this.removeQuestEventFromLocation(existing);
        this.eventsFeed.addEvent({
            id: `quest-delete-${id}-${Date.now()}`,
            type: 'quests',
            title: 'Quete supprimee',
            description: existing.questId ? `Quete ${existing.questId} retiree.` : 'Quete retiree.',
            timestamp: new Date().toISOString(),
            questId: existing.questId || null
        });
        this.refreshFilterMetadata({ reapply: true });
        this.syncLocationEditorQuestEvents();
    }

    formatQuestEventLabel(event) {
        if (!event) {
            return '';
        }
        const parts = [
            event.questId,
            event.milestone,
            event.status,
            event.progress && Number.isFinite(event.progress.current)
                ? (Number.isFinite(event.progress.max)
                    ? `${event.progress.current}/${event.progress.max}`
                    : `${event.progress.current}`)
                : null,
            event.note,
            event.locationName ? `@ ${event.locationName}` : null
        ].filter(Boolean);
        return parts.length ? `[LIVE] ${parts.join(' - ')}` : '[LIVE] Mise a jour de quete';
    }

    applyQuestEventToLocation(event) {
        const locationName = sanitizeString(event?.locationName);
        if (!locationName) {
            return;
        }
        const label = this.formatQuestEventLabel(event);
        const questId = sanitizeString(event?.questId);
        const isSameQuest = entry => {
            if (!questId) {
                return false;
            }
            return entry.startsWith('[LIVE]') && entry.includes(questId);
        };
        const normalizedTarget = locationName.toLowerCase();

        Object.values(this.locationsData || {}).forEach(list => {
            list?.forEach(location => {
                if (sanitizeString(location.name).toLowerCase() !== normalizedTarget) {
                    return;
                }
                const current = Array.isArray(location.quests) ? location.quests.slice() : [];
                const filtered = questId ? current.filter(entry => !isSameQuest(entry)) : current;
                filtered.push(label);
                location.quests = filtered;
            });
        });

        const entry = this.entries.find(candidate => sanitizeString(candidate.location.name).toLowerCase() === normalizedTarget);
        if (entry) {
            const current = Array.isArray(entry.location.quests) ? entry.location.quests.slice() : [];
            const filtered = questId ? current.filter(item => !isSameQuest(item)) : current;
            filtered.push(label);
            entry.location.quests = filtered;
            if (this.activeEntry && this.activeEntry.location === entry.location) {
                this.infoPanel.show(this.activeEntry);
            }
        }
    }

    syncLocationEditorQuestEvents() {
        if (!this.locationEditor?.isOpen || typeof this.locationEditor.getLocationName !== 'function') {
            return;
        }
        const name = this.locationEditor.getLocationName();
        if (!name) {
            return;
        }
        const events = this.getQuestEventsForLocation(name);
        this.locationEditor.setQuestEvents(events);
    }

    async handleLocationsSync(payload) {
        if (!payload || payload.sync === 'error') {
            return;
        }
        const created = Array.isArray(payload?.diff?.created) ? payload.diff.created.length : 0;
        const updated = Array.isArray(payload?.diff?.updated) ? payload.diff.updated.length : 0;
        const deleted = Array.isArray(payload?.diff?.deleted) ? payload.diff.deleted.length : 0;
        this.eventsFeed.addEvent({
            id: `sync-${payload?.timestamp || Date.now()}`,
            type: 'sync',
            title: 'Donnees synchronisees',
            description: `Creees: ${created} - Modifiees: ${updated} - Supprimees: ${deleted}`,
            timestamp: payload?.timestamp || new Date().toISOString()
        });
        await this.refreshLocationsDataset();
    }

    async refreshLocationsDataset() {
        try {
            const response = await fetch('/api/admin/locations', { cache: 'no-store', credentials: 'include' });
            if (!response.ok) {
                return;
            }
            const payload = await response.json();
            if (payload?.status !== 'ok' || typeof payload.locations !== 'object') {
                return;
            }

            const previousSelection = this.activeEntry?.location?.name || null;
            this.locationsData = normalizeSharedDataset(payload.locations, { sanitizeKeys: true });
            this.buildSidebar(this.locationsData);
            this.refreshFilterMetadata({ reapply: false });
            this.applyFilters();
            this.updateSidebarView();
            this.updateClusteringMetrics();
            this.updateRandomButtonState();
            if (previousSelection) {
                this.focusLocationByName(previousSelection);
            }
            this.questEvents.forEach(event => this.applyQuestEventToLocation(event));
            this.mapController.setAnnotations(Array.from(this.annotations.values()));
            this.syncLocationEditorQuestEvents();
        } catch (error) {
            console.warn('[realtime] Impossible de rafraichir le dataset', error);
        }
    }

    focusLocationByName(name) {
        const target = sanitizeString(name).toLowerCase();
        if (!target) {
            return;
        }
        const entry = this.entries.find(candidate => sanitizeString(candidate.location.name).toLowerCase() === target);
        if (entry) {
            this.ensureEntryVisible(entry);
            this.selectEntry(entry, { focusOnList: false, source: 'sync' });
        }
    }

    setupRealtimeStream() {
        if (typeof window === 'undefined' || typeof window.EventSource !== 'function') {
            return;
        }

        if (this.realtimeSource) {
            this.realtimeCleanup?.();
            this.realtimeSource.close();
            this.realtimeSource = null;
        }

        try {
            const source = new window.EventSource('/api/events/stream');
            this.realtimeSource = source;

            const handleConnected = event => {
                let payload = null;
                try {
                    payload = event?.data ? JSON.parse(event.data) : null;
                } catch (error) {
                    payload = null;
                }
                if (payload?.timestamp) {
                    this.announcer?.polite('Flux temps reel synchronise.');
                }
            };

            const handleLocationsSync = event => {
                if (!event?.data) {
                    return;
                }
                try {
                    const payload = JSON.parse(event.data);
                    this.handleLocationsSync(payload);
                } catch (error) {
                    console.warn('[sse] Flux locations.sync invalide', error);
                }
            };

            const handleAnnotationCreated = event => {
                if (!event?.data) {
                    return;
                }
                try {
                    const payload = JSON.parse(event.data);
                    this.handleAnnotationCreated(payload);
                } catch (error) {
                    console.warn('[sse] Annotation created invalide', error);
                }
            };

            const handleAnnotationDeleted = event => {
                if (!event?.data) {
                    return;
                }
                try {
                    const payload = JSON.parse(event.data);
                    this.handleAnnotationDeleted(payload);
                } catch (error) {
                    console.warn('[sse] Annotation deleted invalide', error);
                }
            };

            const handleQuestUpdated = event => {
                if (!event?.data) {
                    return;
                }
                try {
                    const payload = JSON.parse(event.data);
                    this.handleQuestUpdated(payload);
                } catch (error) {
                    console.warn('[sse] Quest updated invalide', error);
                }
            };

            const handleQuestDeleted = event => {
                if (!event?.data) {
                    return;
                }
                try {
                    const payload = JSON.parse(event.data);
                    this.handleQuestDeleted(payload);
                } catch (error) {
                    console.warn('[sse] Quest deleted invalide', error);
                }
            };

            source.addEventListener('connected', handleConnected);
            source.addEventListener('locations.sync', handleLocationsSync);
            source.addEventListener('annotation.created', handleAnnotationCreated);
            source.addEventListener('annotation.deleted', handleAnnotationDeleted);
            source.addEventListener('quest.updated', handleQuestUpdated);
            source.addEventListener('quest.deleted', handleQuestDeleted);
            source.addEventListener('heartbeat', () => {});
            source.onerror = error => {
                console.warn('[sse] Flux temps reel en erreur, EventSource gere la reconnexion automatique.', error?.message || error);
            };

            const handleUnload = () => {
                source.close();
            };
            window.addEventListener('beforeunload', handleUnload, { once: true });

            this.realtimeCleanup = () => {
                window.removeEventListener('beforeunload', handleUnload);
                source.removeEventListener('connected', handleConnected);
                source.removeEventListener('locations.sync', handleLocationsSync);
                source.removeEventListener('annotation.created', handleAnnotationCreated);
                source.removeEventListener('annotation.deleted', handleAnnotationDeleted);
                source.removeEventListener('quest.updated', handleQuestUpdated);
                source.removeEventListener('quest.deleted', handleQuestDeleted);
            };
        } catch (error) {
            console.error('[sse] Impossible d\'ouvrir le flux SSE', error);
        }
    }

    applyFilters() {
        const filters = this.state.getFilters();
        const prepared = prepareFilters(filters);

        let visibleCount = 0;

        this.continents.forEach(section => {
            const visibleEntries = section.entries.filter(entry => {
                if (!entry.filterIndex) {
                    entry.filterIndex = this.buildFilterIndexForEntry(entry);
                }
                const matches = locationMatchesFilters(entry.filterIndex, prepared);
                entry.matchesFilters = matches;

                if (entry.element) {
                    entry.element.style.display = matches ? '' : 'none';
                }

                this.mapController.setEntryVisibility(entry.markerEntry, matches);
                entry.element?.classList.toggle('is-favorite', this.state.hasFavorite(entry.location.name));

                if (matches) {
                    visibleCount += 1;
                }
                return matches;
            });

            const countSpan = section.toggleButton?.querySelector('.location-count');
            if (countSpan) {
                countSpan.textContent = `(${visibleEntries.length}/${section.entries.length})`;
            }

            this.renderContinentEntries(visibleEntries, section.pagination, section.content);
        });

        this.filtersManager.updateResults({
            visibleCount,
            totalCount: this.entries.length
        });

        if (this.activeEntry && !this.activeEntry.matchesFilters) {
            this.infoPanel.close();
        }

        if (this.state.sidebarView === 'favorites') {
            this.renderFavoritesView();
        }

        this.updateClusteringMetrics();
        this.updateRandomButtonState();
    }

    renderFavoritesView() {
        const container = this.dom.favoritesContainer;
        if (!container) {
            return;
        }
        clearElement(container);

        const favorites = this.state.getFavorites();
        const totalFavorites = favorites.length;

        const summary = createElement('div', {
            className: 'favorites-summary',
            attributes: { 'aria-live': 'polite' }
        });
        summary.appendChild(createElement('span', {
            className: 'favorites-summary-label',
            text: localized('favorites.summaryLabel', 'Favoris enregistres')
        }));
        const summaryCountKey = totalFavorites === 1 ? 'favorites.summaryCountSingle' : 'favorites.summaryCountPlural';
        const summaryCountText = localized(summaryCountKey, `${totalFavorites} favoris`, { count: totalFavorites });
        summary.appendChild(createElement('span', {
            className: 'favorites-summary-count',
            text: summaryCountText
        }));
        container.appendChild(summary);

        if (!favorites.length) {
            container.appendChild(createElement('p', {
                className: 'favorites-empty',
                text: favoritesEmptyMessage()
            }));
            return;
        }

        const list = createElement('div', { className: 'favorites-list' });

        favorites
            .map(name => this.entries.find(entry => entry.location.name === name))
            .filter(Boolean)
            .sort((a, b) => a.location.name.localeCompare(b.location.name, 'fr', { sensitivity: 'base' }))
            .forEach(entry => {
                const isActive = this.activeEntry && this.activeEntry.location.name === entry.location.name;
                const isFilteredOut = !entry.matchesFilters;

                const classes = ['location', 'favorite-entry'];
                if (isActive) {
                    classes.push('active');
                }
                if (isFilteredOut) {
                    classes.push('is-filtered');
                }

                const item = createElement('div', {
                    className: classes.join(' '),
                    dataset: { locationName: entry.location.name },
                    attributes: {
                        tabindex: isFilteredOut ? '-1' : '0',
                        role: 'button',
                        'aria-disabled': String(isFilteredOut)
                    }
                });

                const info = createElement('div', { className: 'favorite-info' });
                info.appendChild(createElement('span', {
                    className: 'favorite-name',
                    text: entry.location.name
                }));

                const tags = createElement('div', { className: 'favorite-tags' });
                const typeLabel = entry.location.type && entry.location.type !== 'default'
                    ? (this.typeData[entry.location.type]?.label || entry.location.type)
                    : '';
                if (typeLabel) {
                    tags.appendChild(createElement('span', {
                        className: 'favorite-chip favorite-chip-type',
                        text: typeLabel
                    }));
                }
                if (entry.continent) {
                    tags.appendChild(createElement('span', {
                        className: 'favorite-chip favorite-chip-continent',
                        text: entry.continent
                    }));
                }
                if (tags.childElementCount > 0) {
                    info.appendChild(tags);
                }

                item.appendChild(info);

                const removeButton = createElement('button', {
                    className: 'location-favorite-toggle active',
                    text: favoriteIconActive(),
                    attributes: {
                        type: 'button',
                        'aria-label': localized('favorites.removeWithName', `Retirer ${entry.location.name} des favoris`, { location: entry.location.name })
                    }
                });
                removeButton.addEventListener('click', event => {
                    event.stopPropagation();
                    this.setFavoriteState(entry.location, false);
                });
                this.attachHoverTooltip(removeButton, this.favoriteTooltip, { placement: 'left' });
                item.appendChild(removeButton);

                if (isFilteredOut) {
                    item.title = favoritesFilteredHint();
                } else {
                    const openEntry = () => {
                        if (this.state.sidebarView !== 'all') {
                            this.setSidebarView('all');
                        }
                        this.ensureEntryVisible(entry);
                        this.selectEntry(entry, { focusOnList: false, source: 'favorites' });
                    };
                    item.addEventListener('click', openEntry);
                    item.addEventListener('keydown', event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openEntry();
                        }
                    });
                }

                list.appendChild(item);
            });

        container.appendChild(list);
    }

    updateClusteringMetrics() {
        const metrics = this.dom.clusteringMetrics;
        if (!metrics) {
            return;
        }

        const total = this.entries.length;
        if (!total) {
            metrics.textContent = `${clusteringEmptyIcon()} 0/0`;
            metrics.title = localized('clustering.tooltipEmpty', 'Aucun lieu charge');
            metrics.dataset.state = 'empty';
            return;
        }

        const visible = this.entries.filter(entry => entry.matchesFilters).length;
        const clustered = this.mapController.isClusteringEnabled();
        const icon = clusteringIcon(clustered);

        metrics.textContent = `${icon} ${visible}/${total}`;

        const baseTooltip = visible === 1
            ? localized('clustering.tooltipBaseSingle', `${visible} lieu visible sur ${total}`, { visible, total })
            : localized('clustering.tooltipBasePlural', `${visible} lieux visibles sur ${total}`, { visible, total });

        const filters = normalizeFilterState(this.state.getFilters());
        const parts = [baseTooltip];

        if ((filters.text && filters.text.trim()) || filters.types.length || filters.tags.length || filters.statuses.length || filters.quests !== 'any') {
            parts.push(localized('clustering.tooltipFilters', 'filtres actifs'));
        }

        parts.push(clustered
            ? localized('clustering.tooltipClusterOn', 'clustering active')
            : localized('clustering.tooltipClusterOff', 'clustering desactive')
        );

        metrics.title = parts.filter(Boolean).join(CLUSTERING_TOOLTIP_SEPARATOR);
        metrics.dataset.state = clustered ? 'on' : 'off';
    }

    updateRandomButtonState() {
        if (!this.dom.randomButton) {
            return;
        }
        const isFavoritesView = this.state.sidebarView === 'favorites';
        const pool = this.entries.filter(entry => {
            if (!entry.matchesFilters) {
                return false;
            }
            if (isFavoritesView && !this.state.hasFavorite(entry.location.name)) {
                return false;
            }
            return true;
        });
        const disabled = pool.length === 0;
        this.dom.randomButton.disabled = disabled;
        this.dom.randomButton.setAttribute('aria-disabled', String(disabled));
        this.dom.randomButton.title = disabled
            ? (isFavoritesView ? randomDisabledFavoritesMessage() : randomDisabledDefaultMessage())
            : localized('filters.randomHint', 'Selectionner un lieu aleatoire.');
    }

    goToRandomLocation() {
        const isFavoritesView = this.state.sidebarView === 'favorites';
        const pool = this.entries.filter(entry => {
            if (!entry.matchesFilters) {
                return false;
            }
            if (isFavoritesView && !this.state.hasFavorite(entry.location.name)) {
                return false;
            }
            return true;
        });
        if (!pool.length) {
            return;
        }
        const entry = pool[Math.floor(Math.random() * pool.length)];
        if (this.state.sidebarView !== 'all') {
            this.setSidebarView('all');
        }
        this.ensureEntryVisible(entry);
        this.selectEntry(entry, { focusOnList: true, source: 'random' });
    }

    ensureEntryVisible(entry) {
        if (!entry) {
            return;
        }
        const section = this.continents.get(entry.continent);
        if (!section) {
            return;
        }
        const index = section.entries.indexOf(entry);
        if (index === -1) {
            return;
        }
        const targetPage = Math.floor(index / this.pageSize);
        if (section.pagination.currentPage !== targetPage) {
            section.pagination.currentPage = targetPage;
            const visibleEntries = section.entries.filter(candidate => candidate.matchesFilters);
            this.renderContinentEntries(visibleEntries, section.pagination, section.content);
            if (this.preferences?.setPagination) {
                this.preferences.setPagination(section.name, targetPage);
            }
        }
        if (section.content.style.display === 'none') {
            this.setContinentExpanded(section, true);
        }
    }

    selectEntry(entry, { focusOnList = true, source = 'unknown', pushHistory = true } = {}) {
        if (!entry) {
            return;
        }

        if (this.activeEntry?.element) {
            this.activeEntry.element.classList.remove('active');
        }

        this.activeEntry = entry;

        if (entry.element) {
            entry.element.classList.add('active');
            if (focusOnList) {
                entry.element.scrollIntoView({ block: 'nearest' });
            }
        }

        this.state.activeLocationName = entry.location.name;

        this.infoPanel.show(entry);
        this.updateEditButton(entry.location);
        this.updateFavoriteToggle(entry.location);

        if (this.announcer) {
            const message = localized(
                'aria.locationSelected',
                `${entry.location.name} selectionne.`,
                { location: entry.location.name }
            );
            this.announcer.polite(message);
        }

        this.mapController.setSelectedEntry(entry.markerEntry);
        this.mapController.focusOnEntry(entry.markerEntry, { animate: source !== 'history' });

        this.maybeShowFavoritesOnboarding();

        if (pushHistory) {
            this.historyManager.push({
                locationName: entry.location.name,
                mapState: this.mapController.getMapState()
            });
        }

        if (this.preferences?.setLastLocation) {
            this.preferences.setLastLocation(entry.location.name);
        }
    }

    handleHistorySelect(item) {
        if (!item) {
            return;
        }
        const entry = this.entries.find(candidate => candidate.location.name === item.locationName);
        if (entry) {
            this.ensureEntryVisible(entry);
            this.selectEntry(entry, { focusOnList: false, source: 'history', pushHistory: false });
        }
        if (item.mapState) {
            this.mapController.setMapState(item.mapState);
        }
    }

    handlePanelClosed() {
        this.mapController.clearSelectedEntry();
        this.activeEntry = null;
        this.updateFavoriteToggle(null);
        this.updateEditButton(null);
        this.updateRandomButtonState();
        this.hideTooltip(this.favoriteTooltip);
        this.hideTooltip(this.favoriteOnboardingTooltip);
        if (this.announcer) {
            const message = localized('aria.infoClosed', 'Panneau d\'information ferme.');
            this.announcer.polite(message);
        }
    }

    updateFavoriteToggle(location) {
        if (!this.dom.favoriteToggle) {
            return;
        }
        const hasLocation = Boolean(location?.name);
        const isFavorite = hasLocation && this.state.hasFavorite(location.name);

        this.dom.favoriteToggle.disabled = !hasLocation;
        this.dom.favoriteToggle.textContent = isFavorite ? favoriteIconActive() : favoriteIconInactive();

        const label = hasLocation
            ? (isFavorite
                ? localized('favorites.removeWithName', `Retirer ${location.name} des favoris`, { location: location.name })
                : localized('favorites.addWithName', `Ajouter ${location.name} aux favoris`, { location: location.name }))
            : localized('favorites.add', 'Ajouter aux favoris');

        this.dom.favoriteToggle.title = label;
        this.dom.favoriteToggle.setAttribute('aria-label', label);
        this.dom.favoriteToggle.setAttribute('aria-pressed', String(isFavorite));
        this.dom.favoriteToggle.classList.toggle('active', isFavorite);
    }

    setFavoriteState(location, shouldFavorite) {
        if (!location?.name) {
            return;
        }

        const name = location.name;

        if (shouldFavorite) {
            this.state.addFavorite(name);
        } else {
            this.state.removeFavorite(name);
        }

        const favorites = this.state.getFavorites();
        if (this.preferences?.setFavorites) {
            this.preferences.setFavorites(favorites);
        }

        const entry = this.entries.find(candidate => candidate.location.name === name);
        if (entry?.favoriteButton) {
            entry.favoriteButton.textContent = shouldFavorite ? favoriteIconActive() : favoriteIconInactive();
            entry.favoriteButton.setAttribute('aria-pressed', String(shouldFavorite));
            entry.favoriteButton.classList.toggle('active', shouldFavorite);
            const label = shouldFavorite
                ? localized('favorites.removeWithName', `Retirer ${name} des favoris`, { location: name })
                : localized('favorites.addWithName', `Ajouter ${name} aux favoris`, { location: name });
            entry.favoriteButton.title = label;
            entry.favoriteButton.setAttribute('aria-label', label);
            entry.element?.classList.toggle('is-favorite', shouldFavorite);
            entry.element?.classList.toggle('favorite', shouldFavorite);
        }

        if (this.activeEntry && this.activeEntry.location.name === name) {
            this.updateFavoriteToggle(this.activeEntry.location);
        }

        this.dismissOnboarding('favorites');

        if (this.announcer) {
            const message = localized(
                shouldFavorite ? 'aria.favoriteAdded' : 'aria.favoriteRemoved',
                shouldFavorite ? `${name} ajoute aux favoris.` : `${name} retire des favoris.`,
                { location: name }
            );
            this.announcer.polite(message);
        }

        this.renderFavoritesView();
        this.updateRandomButtonState();
    }

    setSidebarView(view) {
        if (view !== 'all' && view !== 'favorites') {
            return;
        }
        if (this.state.sidebarView === view) {
            return;
        }
        this.state.sidebarView = view;
        this.updateSidebarView();
        this.updateRandomButtonState();
        if (view === 'favorites') {
            this.renderFavoritesView();
        }
    }

    updateSidebarView() {
        const view = this.state.sidebarView;

        if (this.dom.tabAll) {
            const isAll = view === 'all';
            this.dom.tabAll.classList.toggle('active', isAll);
            this.dom.tabAll.setAttribute('aria-pressed', String(isAll));
        }

        if (this.dom.tabFavorites) {
            const isFavorites = view === 'favorites';
            this.dom.tabFavorites.classList.toggle('active', isFavorites);
            this.dom.tabFavorites.setAttribute('aria-pressed', String(isFavorites));
        }

        if (this.dom.continentsContainer) {
            this.dom.continentsContainer.hidden = view !== 'all';
        }

        if (this.dom.favoritesContainer) {
            this.dom.favoritesContainer.hidden = view !== 'favorites';
        }
    }

    setMarkerScale(value, { persist = true } = {}) {
        const numeric = Number(value);
        const normalized = Number.isFinite(numeric) ? Math.max(70, Math.min(130, numeric)) : 100;
        document.documentElement.style.setProperty('--marker-scale', (normalized / 100).toFixed(2));

        if (this.dom.markerScaleValue) {
            this.dom.markerScaleValue.textContent = `${normalized}%`;
        }
        if (this.dom.markerScaleInput && this.dom.markerScaleInput.value !== String(normalized)) {
            this.dom.markerScaleInput.value = String(normalized);
        }
        if (persist && this.preferences?.setMarkerScale) {
            this.preferences.setMarkerScale(normalized);
        }
    }

    setContinentExpanded(section, shouldExpand) {
        if (!section?.content || !section?.toggleButton) {
            return;
        }
        const content = section.content;
        const button = section.toggleButton;
        const wasHidden = content.style.display === 'none';

        if (shouldExpand) {
            content.style.display = 'block';
            content.classList.add('is-open');
            content.setAttribute('aria-hidden', 'false');
            button.setAttribute('aria-expanded', 'true');

            // force reflow before calculating height
            if (wasHidden) {
                content.style.maxHeight = '0';
            }
            const targetHeight = content.scrollHeight;
            content.style.maxHeight = `${targetHeight}px`;

            const handleTransitionEnd = event => {
                if (event.target === content) {
                    content.removeEventListener('transitionend', handleTransitionEnd);
                }
            };
            content.addEventListener('transitionend', handleTransitionEnd, { once: true });
        } else {
            content.classList.remove('is-open');
            content.setAttribute('aria-hidden', 'true');
            button.setAttribute('aria-expanded', 'false');
            content.style.maxHeight = '0';

            // hide content after collapsing to avoid keyboard focus
            const handleTransitionEnd = event => {
                if (event.target === content && !content.classList.contains('is-open')) {
                    content.style.display = 'none';
                    content.removeEventListener('transitionend', handleTransitionEnd);
                }
            };

            content.addEventListener('transitionend', handleTransitionEnd, { once: true });

            // fallback in case transitions are disabled
            if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
                handleTransitionEnd({ target: content });
            }
        }
        button.classList.toggle('is-open', shouldExpand);
    }

    isContinentExpanded(section) {
        return section?.content?.style.display !== 'none';
    }

    updateToggleAllLabel() {
        if (!this.dom.toggleAll) {
            return;
        }
        const label = toggleAllLabel(this.toggleAllState);
        if (label) {
            this.dom.toggleAll.textContent = label;
            this.dom.toggleAll.title = label;
            this.dom.toggleAll.setAttribute('aria-label', label);
        }
    }

    updateToggleAllState() {
        const sections = Array.from(this.continents.values());
        if (!sections.length) {
            this.toggleAllState = false;
            this.updateToggleAllLabel();
            return;
        }
        this.toggleAllState = sections.every(section => this.isContinentExpanded(section));
        this.updateToggleAllLabel();
    }
}
