const DEFAULT_BOUNDS = [[0, 0], [6144, 8192]];
const DEFAULT_IMAGE = 'assets/map.png';
const DEFAULT_POSITION = [3072, 4096];
const DEFAULT_ZOOM = -3;

export class MapController {
    constructor({
        mapId = 'map',
        bounds = DEFAULT_BOUNDS,
        imageUrl = DEFAULT_IMAGE,
        initialPosition = DEFAULT_POSITION,
        initialZoom = DEFAULT_ZOOM,
        minZoom = -3,
        maxZoom = 3
    } = {}) {
        this.map = L.map(mapId, {
            crs: L.CRS.Simple,
            minZoom,
            maxZoom,
            maxBounds: bounds,
            maxBoundsViscosity: 1.0
        });

        this.bounds = bounds;
        this.initialPosition = initialPosition;
        this.initialZoom = initialZoom;
        this.minZoom = minZoom;
        this.maxZoom = maxZoom;
        this.typeData = {};
        this.entries = [];
        this.selectedEntry = null;
        this.markerLayer = L.layerGroup().addTo(this.map);
        this.clusterGroup = null;
        this.clusteringEnabled = false;
        this.mapStateListeners = new Set();

        L.imageOverlay(imageUrl, bounds).addTo(this.map);
        this.map.fitBounds(bounds);

        this.map.on('moveend', () => this.notifyMapStateChange());
        this.map.on('zoomend', () => this.notifyMapStateChange());
        this.map.on('click', event => this.logPixelCoordinates(event));
    }

    setTypeData(typeData) {
        this.typeData = typeData || {};
        if (this.clusterGroup) {
            this.clusterGroup.options.iconCreateFunction = cluster => this.createClusterIcon(cluster);
            this.clusterGroup.refreshClusters();
        }
    }

    createEntry({ location, continent, onSelect, onHover, onLeave }) {
        const marker = L.marker([location.y, location.x], {
            icon: this.createCustomIcon(location.type),
            locationType: location.type || 'default'
        });

        this.addMarkerToLayer(marker);

        marker.bindTooltip(location.name, {
            direction: 'top',
            offset: [0, -35],
            sticky: true,
            className: 'marker-tooltip'
        });

        const entry = {
            location,
            continent,
            marker,
            visible: true
        };

        marker.on('click', () => {
            onLeave?.(entry);
            onSelect?.(entry);
        });

        marker.on('mouseover', () => {
            this.setMarkerHighlight(marker, true);
            onHover?.(entry);
        });

        marker.on('mouseout', () => {
            if (this.selectedEntry?.marker !== marker) {
                this.setMarkerHighlight(marker, false);
            }
            onLeave?.(entry);
        });

        this.entries.push(entry);
        return entry;
    }

    setEntryVisibility(entry, isVisible) {
        if (!entry || !entry.marker) {
            return;
        }

        if (isVisible) {
            if (!entry.visible) {
                this.addMarkerToLayer(entry.marker);
            }
        } else {
            if (entry.visible) {
                this.removeMarkerFromLayers(entry.marker);
            }
            if (this.selectedEntry === entry) {
                this.selectedEntry = null;
            }
        }

        entry.visible = Boolean(isVisible);
    }

    focusOnEntry(entry, { zoom = 1.5, animate = true, duration = 1.5 } = {}) {
        if (!entry || !entry.marker) {
            return;
        }
        this.map.flyTo([entry.location.y, entry.location.x], zoom, { animate, duration });
    }

    animateEntry(entry) {
        if (!entry || !entry.marker) {
            return;
        }

        this.setMarkerHighlight(entry.marker, true);

        let isVisible = true;
        const marker = entry.marker;
        const blinkInterval = setInterval(() => {
            isVisible = !isVisible;
            marker.setOpacity(isVisible ? 1 : 0.4);
        }, 300);

        setTimeout(() => {
            clearInterval(blinkInterval);
            marker.setOpacity(1);
            if (this.selectedEntry !== entry) {
                this.setMarkerHighlight(marker, false);
            }
        }, 1200);
    }

    previewEntry(entry, isActive) {
        if (!entry || !entry.marker) {
            return;
        }
        if (this.selectedEntry === entry) {
            return;
        }
        this.setMarkerHighlight(entry.marker, Boolean(isActive));
    }

    setSelectedEntry(entry) {
        if (this.selectedEntry && this.selectedEntry !== entry) {
            this.setMarkerHighlight(this.selectedEntry.marker, false);
        }

        this.selectedEntry = entry;
        if (entry) {
            this.setMarkerHighlight(entry.marker, true);
        }
    }

    clearSelectedEntry() {
        if (this.selectedEntry) {
            this.setMarkerHighlight(this.selectedEntry.marker, false);
        }
        this.selectedEntry = null;
    }

    forEachEntry(callback) {
        this.entries.forEach(callback);
    }

    clearEntries() {
        this.entries.forEach(entry => {
            if (entry.marker) {
                this.removeMarkerFromLayers(entry.marker);
            }
        });

        this.markerLayer.clearLayers();
        if (this.clusterGroup) {
            this.clusterGroup.clearLayers();
        }

        this.entries = [];
        this.selectedEntry = null;
    }

    addMarkerToLayer(marker) {
        if (!marker) {
            return;
        }

        if (this.clusteringEnabled) {
            if (!this.clusterGroup) {
                this.clusterGroup = L.markerClusterGroup({
                    showCoverageOnHover: false,
                    spiderfyOnMaxZoom: true,
                    maxClusterRadius: 80
                });
            }
            if (!this.map.hasLayer(this.clusterGroup)) {
                this.map.addLayer(this.clusterGroup);
            }
            this.clusterGroup.addLayer(marker);
        } else {
            this.markerLayer.addLayer(marker);
        }
    }

    removeMarkerFromLayers(marker) {
        if (!marker) {
            return;
        }

        if (this.markerLayer.hasLayer(marker)) {
            this.markerLayer.removeLayer(marker);
        }
        if (this.clusterGroup && this.clusterGroup.hasLayer(marker)) {
            this.clusterGroup.removeLayer(marker);
        }
    }

    setClusteringEnabled(isEnabled) {
        const nextState = Boolean(isEnabled);
        if (nextState === this.clusteringEnabled) {
            return;
        }

        this.clusteringEnabled = nextState;

        const startTime = performance.now();

        if (this.clusteringEnabled) {
            if (typeof L.markerClusterGroup !== 'function') {
                console.warn('Clustering indisponible : plugin Leaflet.markercluster manquant.');
                this.clusteringEnabled = false;
                return;
            }

            if (!this.clusterGroup) {
                this.clusterGroup = L.markerClusterGroup({
                    showCoverageOnHover: false,
                    spiderfyOnMaxZoom: true,
                    maxClusterRadius: 80,
                    disableClusteringAtZoom: this.maxZoom - 1,
                    iconCreateFunction: cluster => this.createClusterIcon(cluster)
                });
            } else {
                this.clusterGroup.options.iconCreateFunction = cluster => this.createClusterIcon(cluster);
            }

            if (!this.map.hasLayer(this.clusterGroup)) {
                this.map.addLayer(this.clusterGroup);
            }

            this.entries.forEach(entry => {
                if (!entry.marker || !entry.visible) {
                    return;
                }
                this.markerLayer.removeLayer(entry.marker);
                this.clusterGroup.addLayer(entry.marker);
            });

            this.clusterGroup.refreshClusters();
        } else if (this.clusterGroup) {
            this.entries.forEach(entry => {
                if (!entry.marker || !entry.visible) {
                    return;
                }
                this.clusterGroup.removeLayer(entry.marker);
                this.markerLayer.addLayer(entry.marker);
            });
            this.clusterGroup.clearLayers();
            if (this.map.hasLayer(this.clusterGroup)) {
                this.map.removeLayer(this.clusterGroup);
            }
        }

        const duration = Math.round(performance.now() - startTime);
        const visibleCount = this.entries.filter(entry => entry.visible).length;
        console.info(`Clustering ${this.clusteringEnabled ? 'activ\u00e9' : 'd\u00e9sactiv\u00e9'} : ${visibleCount} marqueurs visibles en ${duration} ms`);
    }

    isClusteringEnabled() {
        return this.clusteringEnabled;
    }

    getMapState() {
        const center = this.map.getCenter();
        return {
            center: [center.lat, center.lng],
            zoom: this.map.getZoom()
        };
    }

    setMapState(state = {}) {
        if (!state) {
            return;
        }
        const { center, zoom } = state;
        const hasArrayCenter = Array.isArray(center) && center.length === 2 && center.every(val => typeof val === 'number');
        const hasObjectCenter = center && typeof center.lat === 'number' && typeof center.lng === 'number';
        const targetCenter = hasArrayCenter ? center : hasObjectCenter ? [center.lat, center.lng] : null;
        const targetZoom = typeof zoom === 'number' ? zoom : null;

        if (targetCenter) {
            this.map.setView([targetCenter[0], targetCenter[1]], targetZoom ?? this.map.getZoom(), { animate: false });
        } else if (targetZoom !== null) {
            this.map.setZoom(targetZoom, { animate: false });
        }
    }

    notifyMapStateChange() {
        if (!this.mapStateListeners.size) {
            return;
        }
        const snapshot = this.getMapState();
        this.mapStateListeners.forEach(callback => {
            try {
                callback(snapshot);
            } catch (error) {
                console.error("Erreur lors de la notification de l'état de la carte :", error);
            }
        });
    }

    onMapStateChange(callback) {
        if (typeof callback === 'function') {
            this.mapStateListeners.add(callback);
        }
    }

    resetView({ animate = true, duration = 0.5 } = {}) {
        const defaultCenter = this.map.getCenter();
        const targetCenter = Array.isArray(this.initialPosition) && this.initialPosition.length === 2
            ? [this.initialPosition[0], this.initialPosition[1]]
            : [defaultCenter.lat, defaultCenter.lng];
        const targetZoom = typeof this.initialZoom === 'number' ? this.initialZoom : this.map.getZoom();
        this.map.flyTo([targetCenter[0], targetCenter[1]], targetZoom, { animate, duration });
    }

    onMapClick(callback) {
        if (typeof callback !== 'function') {
            return () => {};
        }
        this.map.on('click', callback);
        return () => {
            this.map.off('click', callback);
        };
    }

    zoomIn(step = 1) {
        this.map.zoomIn(step);
    }

    zoomOut(step = 1) {
        this.map.zoomOut(step);
    }

    getZoomPercentage() {
        if (typeof this.minZoom !== 'number' || typeof this.maxZoom !== 'number' || this.maxZoom === this.minZoom) {
            return 100;
        }
        const zoom = this.map.getZoom();
        const ratio = (zoom - this.minZoom) / (this.maxZoom - this.minZoom);
        const clamped = Math.max(0, Math.min(1, ratio));
        return clamped * 100;
    }

    logPixelCoordinates(event) {
        if (!event?.latlng) {
            return;
        }
        const { lat, lng } = event.latlng;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return;
        }
        const x = Math.round(lng);
        const y = Math.round(lat);
        console.info(`Carte · coordonnées px → x: ${x}, y: ${y}`);
    }

    createClusterIcon(cluster) {
        const markers = cluster.getAllChildMarkers();
        const total = markers.length;
        const typeCounts = new Map();
        let dominantType = 'default';
        let dominantCount = 0;

        markers.forEach(marker => {
            const type = marker.options?.locationType || 'default';
            const nextValue = (typeCounts.get(type) || 0) + 1;
            typeCounts.set(type, nextValue);
            if (nextValue > dominantCount) {
                dominantCount = nextValue;
                dominantType = type;
            }
        });

        const iconPath = (this.typeData[dominantType] && this.typeData[dominantType].icon) || 'assets/icons/default.png';
        const sizeClass = total >= 50 ? 'cluster-large' : total >= 15 ? 'cluster-medium' : 'cluster-small';

        const html = `
            <div class="cluster-shell">
                <span class="cluster-count">${total}</span>
                <img src="${iconPath}" alt="Icône ${dominantType}" class="cluster-type" />
            </div>
        `;

        return L.divIcon({
            html,
            className: `marker-cluster custom-cluster ${sizeClass}`,
            iconSize: L.point(52, 52)
        });
    }

    createCustomIcon(type) {
        const iconBase = 'assets/icons/';
        const pinSize = [40, 50];
        const pinAnchor = [20, 50];
        const popupAnchor = [0, -40];
        const iconPath = (this.typeData[type] && this.typeData[type].icon) || `${iconBase}default.png`;

        return L.divIcon({
            className: 'custom-marker',
            iconSize: pinSize,
            iconAnchor: pinAnchor,
            popupAnchor,
            html: `
                <div class="marker-container">
                    <svg class="pin-shape" width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
                        <path d="M 20 5 C 32 10, 38 22, 30 36 L 20 48 L 10 36 C 2 22, 8 10, 20 5 Z" fill="white" stroke="black" stroke-width="3" />
                    </svg>
                    <img src="${iconPath}" class="marker-icon" alt="Icône de ${type || 'lieu'}" />
                </div>
            `
        });
    }

    setMarkerHighlight(marker, isActive) {
        const icon = marker?.getElement();
        if (!icon) {
            return;
        }
        icon.classList.toggle('marker-highlight', Boolean(isActive));
    }
}
