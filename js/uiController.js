import { UiState } from './ui/state.js';
import { FiltersManager } from './ui/filtersManager.js';
import { ThemeManager } from './ui/themeManager.js';
import { MapControlsManager } from './ui/mapControlsManager.js';
import { HistoryManager } from './ui/historyManager.js';
import { AudioManager } from './ui/audioManager.js';
import { InfoPanel } from './ui/infoPanel.js';
import { AriaAnnouncer } from './ui/ariaAnnouncer.js';
import { qs, createElement, clearElement } from './ui/dom.js';
import { getString } from './i18n.js';

const PAGE_SIZE = 8;

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
        typeFilterId = 'type-filter',
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
            typeFilter: document.getElementById(typeFilterId),
            resetFilters: document.getElementById(resetFiltersId),
            toggleAll: document.getElementById(toggleAllButtonId),
            resultsBadge: document.getElementById('search-results-count'),
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
            zoomLevel: document.getElementById('zoom-level'),
            favoriteToggle: document.getElementById('favorite-toggle'),
            audioPlayer: document.getElementById(audioPlayerId),
            audioTitle: document.getElementById(audioTitleId),
            audioFallback: document.getElementById('audio-fallback'),
            audioStatus: document.getElementById('audio-status')
        };

        this.announcer = new AriaAnnouncer({
            politeNode: qs('#aria-status'),
            assertiveNode: qs('#aria-alert')
        });

        this.state = new UiState({
            filters: this.preferences?.getFilters?.(),
            favorites: this.preferences?.getFavorites?.(),
            theme: this.preferences?.getTheme?.()
        });

        this.pageSize = PAGE_SIZE;
        this.entries = [];
        this.continents = new Map();
        this.activeEntry = null;
        this.toggleAllState = false;
        this.typeData = {};
        this.boundKeyboardShortcuts = false;
        this.mapClickUnsubscribe = null;

        this.historyManager = new HistoryManager({
            container: this.dom.historyContainer,
            listElement: this.dom.historyList,
            backButton: this.dom.historyBack
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

        this.filtersManager = new FiltersManager({
            state: this.state,
            searchInput: this.dom.searchBar,
            clearButton: this.dom.clearSearch,
            typeSelect: this.dom.typeFilter,
            resetButton: this.dom.resetFilters,
            resultsBadge: this.dom.resultsBadge,
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
    }
    initialize({ typeData, locationsData }) {
        this.typeData = typeData || {};
        this.mapController.setTypeData(this.typeData);

        this.applyLocalization();
        this.themeManager.initialize();
        this.mapControlsManager.initialize();
        this.audioManager.initialize();
        this.infoPanel.initialize({ onClose: () => this.handlePanelClosed() });
        this.historyManager.initialize({ onSelect: item => this.handleHistorySelect(item) });
        this.filtersManager.initialize();

        this.bindTabs();
        this.bindToggleAll();
        this.bindClustering();
        this.bindMarkerScale();
        this.bindFavoriteToggle();
        this.bindRandomButton();
        this.bindMapKeyboardShortcuts();
        this.bindMapBackgroundDismissal();

        this.populateTypeFilterOptions();
        this.buildSidebar(locationsData || {});
        this.restoreMapState();

        this.state.sidebarView = 'all';
        this.applyFilters();
        this.renderFavoritesView();
        this.updateSidebarView();
        this.updateClusteringMetrics();
        this.updateRandomButtonState();
        this.restoreLastLocation();

        this.mapController.onMapStateChange(state => {
            if (this.preferences?.setMapState) {
                this.preferences.setMapState(state);
            }
            this.state.mapState = state;
        });
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
    }

    populateTypeFilterOptions() {
        if (!this.dom.typeFilter) {
            return;
        }
        const fragment = document.createDocumentFragment();
        fragment.appendChild(createElement('option', {
            text: localized('filters.allTypes', 'Tous les types'),
            attributes: { value: 'all' }
        }));

        Object.entries(this.typeData)
            .sort(([, left], [, right]) => {
                const a = (left?.label || '').toLowerCase();
                const b = (right?.label || '').toLowerCase();
                return a.localeCompare(b, 'fr');
            })
            .forEach(([value, meta]) => {
                fragment.appendChild(createElement('option', {
                    text: meta?.label || value,
                    attributes: { value }
                }));
            });

        clearElement(this.dom.typeFilter);
        this.dom.typeFilter.appendChild(fragment);

        const currentType = this.state.filters.type || 'all';
        this.dom.typeFilter.value = currentType;
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
        });
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
    }

    bindRandomButton() {
        if (!this.dom.randomButton) {
            return;
        }
        this.dom.randomButton.addEventListener('click', () => this.goToRandomLocation());
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

    applyFilters() {
        const { text, type } = this.state.getFilters();
        const query = (text || '').trim().toLowerCase();
        const selectedType = type || 'all';
        const hasQuery = query.length > 0;
        const hasType = selectedType !== 'all';

        let visibleCount = 0;

        this.continents.forEach(section => {
            const visibleEntries = section.entries.filter(entry => {
                const matchesText = !hasQuery || this.entryMatchesQuery(entry, query);
                const matchesType = !hasType || entry.location.type === selectedType;
                const matches = matchesText && matchesType;
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

        const filtersActive = hasQuery || hasType;
        this.filtersManager.updateResults({
            visibleCount,
            totalCount: this.entries.length,
            filtersActive
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

    entryMatchesQuery(entry, query) {
        if (!entry || !entry.location || !query) {
            return true;
        }
        const { location } = entry;
        const candidates = [
            location.name,
            location.description,
            ...(location.history || []),
            ...(location.quests || []),
            ...(location.lore || []),
            ...(Array.isArray(location.pnjs)
                ? location.pnjs.map(pnj => `${pnj.name || ''} ${pnj.role || ''} ${pnj.description || ''}`)
                : [])
        ];
        return candidates.some(value => typeof value === 'string' && value.toLowerCase().includes(query));
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
            text: localized('favorites.summaryLabel', 'Favoris enregistrés')
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

        const filters = this.state.getFilters();
        const parts = [baseTooltip];

        if ((filters.text && filters.text.length) || (filters.type && filters.type !== 'all')) {
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
        this.updateFavoriteToggle(entry.location);

        if (this.announcer) {
            const message = localized(
                'aria.locationSelected',
                `${entry.location.name} sélectionné.`,
                { location: entry.location.name }
            );
            this.announcer.polite(message);
        }

        this.mapController.setSelectedEntry(entry.markerEntry);
        this.mapController.focusOnEntry(entry.markerEntry, { animate: source !== 'history' });

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
        this.updateRandomButtonState();
        if (this.announcer) {
            const message = localized('aria.infoClosed', 'Panneau d\'information fermé.');
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

        if (this.announcer) {
            const message = localized(
                shouldFavorite ? 'aria.favoriteAdded' : 'aria.favoriteRemoved',
                shouldFavorite ? `${name} ajouté aux favoris.` : `${name} retiré des favoris.`,
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
