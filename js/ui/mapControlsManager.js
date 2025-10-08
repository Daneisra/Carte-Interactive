import { getString } from '../i18n.js';

export class MapControlsManager {
    constructor({
        mapController,
        zoomInButton,
        zoomOutButton,
        resetButton,
        fullscreenButton,
        zoomDisplay,
        preferences
    }) {
        this.mapController = mapController;
        this.zoomInButton = zoomInButton;
        this.zoomOutButton = zoomOutButton;
        this.resetButton = resetButton;
        this.fullscreenButton = fullscreenButton;
        this.zoomDisplay = zoomDisplay;
        this.preferences = preferences;
    }

    initialize() {
        if (this.zoomInButton) {
            const label = getString('mapControls.zoomIn');
            this.zoomInButton.title = label;
            this.zoomInButton.setAttribute('aria-label', label);
            this.zoomInButton.addEventListener('click', () => this.mapController.zoomIn());
        }

        if (this.zoomOutButton) {
            const label = getString('mapControls.zoomOut');
            this.zoomOutButton.title = label;
            this.zoomOutButton.setAttribute('aria-label', label);
            this.zoomOutButton.addEventListener('click', () => this.mapController.zoomOut());
        }

        if (this.resetButton) {
            const label = getString('mapControls.recenter');
            this.resetButton.title = label;
            this.resetButton.setAttribute('aria-label', label);
            this.resetButton.addEventListener('click', () => this.mapController.resetView());
        }

        if (this.fullscreenButton) {
            const label = getString('mapControls.fullscreen');
            this.fullscreenButton.title = label;
            this.fullscreenButton.setAttribute('aria-label', label);
            this.fullscreenButton.addEventListener('click', () => this.toggleFullscreen());
        }

        this.mapController.onMapStateChange(state => {
            if (this.preferences && typeof this.preferences.setMapState === 'function') {
                this.preferences.setMapState(state);
            }
            this.updateZoomDisplay(this.mapController.getZoomPercentage());
        });

        this.updateZoomDisplay(this.mapController.getZoomPercentage());
    }

    toggleFullscreen() {
        const mapElement = document.getElementById('map');
        if (!mapElement) {
            return;
        }
        if (!document.fullscreenElement) {
            mapElement.requestFullscreen?.().catch(() => {});
        } else {
            document.exitFullscreen?.().catch(() => {});
        }
    }

    updateZoomDisplay(percentage) {
        if (!this.zoomDisplay) {
            return;
        }
        const bounded = Math.max(0, Math.min(100, Math.round(percentage)));
        this.zoomDisplay.textContent = `${bounded}%`;
    }
}
