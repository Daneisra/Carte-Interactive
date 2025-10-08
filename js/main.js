import { DataService } from './dataService.js';
import { MapController } from './mapController.js';
import { UiController } from './uiController.js';
import { PreferencesService } from './preferencesService.js';

const dataService = new DataService();
const preferencesService = new PreferencesService();
let mapController = null;
let uiController = null;

async function initialize() {
    try {
        mapController = new MapController({ imageUrl: 'assets/map.png' });
        uiController = new UiController({ mapController, preferences: preferencesService });
        const datasets = await dataService.load();
        uiController.initialize(datasets);
    } catch (error) {
        console.error("Erreur lors de l'initialisation de la carte :", error);
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.innerHTML = '';
            const message = document.createElement('p');
            message.className = 'error-message';
            message.textContent = 'Impossible de charger les donnÃ©es de la carte. RÃ©essayez plus tard.';
            sidebar.appendChild(message);
        }
    }
}

document.addEventListener('DOMContentLoaded', initialize);

