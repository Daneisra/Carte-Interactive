document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById("sidebar");
    const infoSidebar = document.getElementById("info-sidebar");
    const infoTitle = document.getElementById("info-title");
    const descriptionContent = document.getElementById("description-content");
    const closeInfoSidebar = document.getElementById("close-info-sidebar");
    const resetViewButton = document.getElementById("reset-map");
    let searchBar = document.getElementById("search-bar");
    let clearSearchButton = document.getElementById("clear-search");
    let typeFilter = document.getElementById("type-filter");
    let resetFiltersButton = document.getElementById("reset-filters");
    const historyContainer = document.getElementById("history-container");
    const historyBackButton = document.getElementById("history-back");

    let navigationHistory = [];
    let locationsData = {};
    let typeData = {}; // Secures the location types
    const markerEntries = [];
    const continentRegistry = new Map();
    let activeFilters = { text: "", type: "all" };
    let selectedEntry = null;

    function normalizeLocation(rawLocation) {
        if (!rawLocation || typeof rawLocation !== "object") {
            return null;
        }

        const normalized = {
            name: typeof rawLocation.name === "string" ? rawLocation.name.trim() : "Lieu inconnu",
            type: typeof rawLocation.type === "string" && rawLocation.type.trim().length ? rawLocation.type.trim() : "default",
            x: Number(rawLocation.x),
            y: Number(rawLocation.y),
            description: typeof rawLocation.description === "string" ? rawLocation.description.trim() : "",
            images: Array.isArray(rawLocation.images)
                ? rawLocation.images.filter(src => typeof src === "string" && src.trim().length).map(src => src.trim())
                : [],
            videos: Array.isArray(rawLocation.videos)
                ? rawLocation.videos.filter(video => typeof video === "string" && video.trim().length).map(video => video.trim())
                : [],
            audio: typeof rawLocation.audio === "string" && rawLocation.audio.trim().length ? rawLocation.audio.trim() : null,
            history: Array.isArray(rawLocation.history)
                ? rawLocation.history.filter(Boolean).map(entry => String(entry).trim())
                : rawLocation.history
                    ? [String(rawLocation.history).trim()]
                    : [],
            quests: Array.isArray(rawLocation.quests)
                ? rawLocation.quests.filter(Boolean).map(entry => String(entry).trim())
                : rawLocation.quests
                    ? [String(rawLocation.quests).trim()]
                    : [],
            pnjs: Array.isArray(rawLocation.pnjs)
                ? rawLocation.pnjs.filter(Boolean).map(pnj => ({
                    name: typeof pnj.name === "string" ? pnj.name.trim() : "PNJ",
                    role: typeof pnj.role === "string" ? pnj.role.trim() : "",
                    description: typeof pnj.description === "string" ? pnj.description.trim() : ""
                }))
                : [],
            lore: Array.isArray(rawLocation.lore)
                ? rawLocation.lore.filter(Boolean).map(entry => String(entry).trim())
                : rawLocation.lore
                    ? [String(rawLocation.lore).trim()]
                    : [],
        };

        if (Number.isNaN(normalized.x) || Number.isNaN(normalized.y)) {
            normalized.x = 0;
            normalized.y = 0;
        }

        return normalized;
    }

    function normalizeLocations(dataset) {
        const normalizedDataset = {};

        Object.entries(dataset).forEach(([continent, locations]) => {
            normalizedDataset[continent] = Array.isArray(locations)
                ? locations.map(normalizeLocation).filter(Boolean)
                : [];
        });

        return normalizedDataset;
    }

    function validateDatasets(locationsByContinent, registeredTypes) {
        const issues = [];
        const seenNames = new Set();

        Object.entries(locationsByContinent).forEach(([continent, locations]) => {
            locations.forEach((location, index) => {
                if (!location.name || location.name === "Lieu inconnu") {
                    issues.push(`${continent} index ${index} : nom manquant`);
                }

                if (!Number.isFinite(location.x) || !Number.isFinite(location.y)) {
                    issues.push(`${location.name} : coordonnÃ©es invalides`);
                }

                if (!registeredTypes[location.type] && location.type !== "default") {
                    issues.push(`${location.name} : type inconnu "${location.type}"`);
                }

                if (seenNames.has(location.name)) {
                    issues.push(`${location.name} : doublon dÃ©tectÃ©`);
                }

                seenNames.add(location.name);

                const badImages = location.images.filter(src => !src.startsWith("assets/"));
                if (badImages.length > 0) {
                    issues.push(`${location.name} : images avec chemin non valide (${badImages.join(", ")})`);
                }

                if (location.audio && !location.audio.startsWith("assets/")) {
                    issues.push(`${location.name} : audio avec chemin non valide (${location.audio})`);
                }
            });
        });

        if (issues.length) {
            console.group("Validation des donnÃ©es de carte");
            issues.forEach(issue => console.warn(issue));
            console.groupEnd();
        } else {
            console.info("Validation des donnÃ©es de carte : OK");
        }
    } // ðŸ”¥ Stockage des types de lieux

// 📌 Charger les types de lieux depuis types.json
fetch("assets/types.json")
    .then(response => response.json())
    .then(data => {
        typeData = data;
        console.log("ðŸ“‚ Types de lieux chargÃ©s :", typeData);
        loadLocations(); // ðŸ”¥ Charger les lieux une fois les types disponibles
    })
    .catch(error => console.error("⚠️ Erreur lors du chargement des types de lieux :", error));

    // 📌 Initialisation de la carte Leaflet
    const map = L.map("map", {
        crs: L.CRS.Simple,
        minZoom: -3,
        maxZoom: 3,
        maxBounds: [[0, 0], [6144, 8192]],
        maxBoundsViscosity: 1.0
    });

// 📌 VÃ©rification que la carte est bien initialisÃ©e avant d'ajouter l'Ã©vÃ©nement
if (map) {
    map.on("click", function (e) {
        const x = Math.round(e.latlng.lng); // ðŸ”¥ CoordonnÃ©e X
        const y = Math.round(e.latlng.lat); // ðŸ”¥ CoordonnÃ©e Y
        console.log(`ðŸ“ CoordonnÃ©es cliquÃ©es : X = ${x}, Y = ${y}`);
    });
} else {
    console.error("⚠️ Erreur : La carte Leaflet n'est pas encore initialisÃ©e.");
}


    const bounds = [[0, 0], [6144, 8192]];
    L.imageOverlay("assets/map.png", bounds).addTo(map);
    map.fitBounds(bounds);

    console.log("ðŸ—ºï¸ Leaflet map :", map);
    console.log("ðŸ” Niveau de zoom actuel :", map.getZoom());
    
    const initialPosition = [3072, 4096]; // 📌 Position initiale de la carte
    const initialZoom = -3;  // 📌 Niveau de zoom initial
    

document.getElementById("zoom-in").onclick = function () {
        console.log("ðŸŸ¢ Zoom avant dÃ©clenchÃ© !");
        map.zoomIn();
        updateZoomLevel();
    };
    
    document.getElementById("zoom-out").onclick = function () {
        console.log("ðŸŸ¢ Zoom arriÃ¨re dÃ©clenchÃ© !");
        map.zoomOut();
        updateZoomLevel();
    };
    
    document.getElementById("reset-map").onclick = function () {
        console.log("ðŸ”„ RÃ©initialisation de la carte !");
        map.flyTo(initialPosition, initialZoom, { animate: true, duration: 0.5 });
        updateZoomLevel();
    };
    
    document.getElementById("fullscreen-map").onclick = function () {
        console.log("â›¶ Mode Plein Ã‰cran dÃ©clenchÃ© !");
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };   
    
    function updateZoomLevel() {
        const minZoom = -3; // ðŸ”¥ Assure-toi que c'est la valeur de ton `minZoom`
        const maxZoom = 3;  // ðŸ”¥ Assure-toi que c'est la valeur de ton `maxZoom`
        const currentZoom = map.getZoom();
    
        // ðŸ”¥ Conversion en pourcentage
        const zoomPercentage = Math.round(((currentZoom - minZoom) / (maxZoom - minZoom)) * 100);
        
        // ðŸ”¥ Mise Ã  jour de l'affichage
        document.getElementById("zoom-level").textContent = `${zoomPercentage}%`;
    }
    
    map.on("zoomend", updateZoomLevel); // ðŸ”¥ Met Ã  jour aprÃ¨s chaque zoom
updateZoomLevel(); // ðŸ”¥ Mise Ã  jour au chargement initial

    // 📌 Fermer le panneau latÃ©ral en cliquant sur la carte
    map.on("click", function () {
    if (infoSidebar.classList.contains("open")) {
        infoSidebar.classList.remove("open");
        setTimeout(() => {
            infoSidebar.style.display = "none";
            }, 400);
        }
    });

    // 📌 Gestion des onglets dans le panneau latÃ©ral (Ajoute ce bloc ICI)
    document.querySelectorAll(".info-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            // DÃ©sactive tous les onglets
            document.querySelectorAll(".info-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
    
            // Cache tout le contenu des onglets
            document.querySelectorAll(".info-content").forEach(content => content.classList.remove("active"));
    
            // Affiche uniquement le bon contenu
            const tabContent = document.getElementById(`${tab.dataset.tab}-content`);
            if (tabContent) {
                tabContent.classList.add("active");
            }
        });
    });
    
    // 📌 Chargement des lieux depuis `locations.json`
    function loadLocations() {
        fetch("assets/locations.json")
            .then(response => response.json())
            .then(data => {
                locationsData = data;
                generateSidebarAndMarkers();
            })
            .catch(error => console.error("⚠️ Erreur lors du chargement des lieux :", error));
    }    

    function generateSidebarAndMarkers() {
        if (markerEntries.length) {
            markerEntries.forEach(entry => {
                if (map.hasLayer(entry.marker)) {
                    map.removeLayer(entry.marker);
                }
            });
        }
        markerEntries.length = 0;
        continentRegistry.clear();
        selectedEntry = null;

        sidebar.innerHTML = `
            <h2>Exploration</h2>
            <button id="toggle-all-continents" class="continent-toggle global-toggle">
                Tout masquer/afficher
            </button>
            <div id="search-container">
                <input type="text" id="search-bar" placeholder="Rechercher un lieu..." />
                <button id="clear-search" aria-label="Effacer la recherche">✖</button>
            </div>
            <div id="filters-container">
                <select id="type-filter" aria-label="Filtrer par type de lieu">
                    <option value="all">Tous les types</option>
                </select>
                <button id="reset-filters" class="icon-button" aria-label="Réinitialiser les filtres">🧹</button>
            </div>
        `;

        searchBar = document.getElementById("search-bar");
        clearSearchButton = document.getElementById("clear-search");
        typeFilter = document.getElementById("type-filter");
        resetFiltersButton = document.getElementById("reset-filters");
        const toggleAllButton = document.getElementById("toggle-all-continents");

        const continentsFragment = document.createDocumentFragment();

        Object.keys(locationsData).forEach(continent => {
            const continentDiv = document.createElement("div");
            continentDiv.classList.add("continent");
            continentDiv.dataset.continent = continent;

            const button = document.createElement("button");
            button.classList.add("continent-toggle");
            const locations = locationsData[continent] || [];
            button.innerHTML = `${continent} <span class="location-count">(${locations.length})</span>`;

            const contentDiv = document.createElement("div");
            contentDiv.classList.add("continent-content");
            contentDiv.style.display = "none";

            const continentInfo = {
                name: continent,
                wrapper: continentDiv,
                toggle: button,
                content: contentDiv,
                isOpen: false
            };
            continentRegistry.set(continent, continentInfo);

            locations.forEach(location => {
                const locationElement = document.createElement("div");
                locationElement.classList.add("location");
                locationElement.dataset.name = location.name;
                locationElement.dataset.continent = continent;
                locationElement.dataset.type = location.type;
                locationElement.textContent = location.name;

                contentDiv.appendChild(locationElement);

                const marker = L.marker([location.y, location.x], { icon: createCustomIcon(location.type) }).addTo(map);
                marker.bindPopup(`<h3>${location.name}</h3>`);

                marker.on('mouseover', () => {
                    setMarkerHighlight(marker, true);
                    locationElement.classList.add('hover');
                });

                marker.on('mouseout', () => {
                    if (!locationElement.classList.contains('active')) {
                        setMarkerHighlight(marker, false);
                    }
                    locationElement.classList.remove('hover');
                });

                marker.on("click", () => {
                    locationElement.classList.remove('hover');
                    selectLocation(location);
                    animateMarker(marker);
                });

                locationElement.addEventListener("click", () => {
                    locationElement.classList.remove('hover');
                    selectLocation(location);
                    animateMarker(marker);
                });

                locationElement.addEventListener("mouseenter", () => {
                    setMarkerHighlight(marker, true);
                    locationElement.classList.add('hover');
                });

                locationElement.addEventListener("mouseleave", () => {
                    if (!locationElement.classList.contains('active')) {
                        setMarkerHighlight(marker, false);
                    }
                    locationElement.classList.remove('hover');
                });

                markerEntries.push({
                    continent,
                    location,
                    element: locationElement,
                    marker
                });
            });

            button.addEventListener("click", () => {
                const info = continentRegistry.get(continent);
                info.isOpen = !info.isOpen;
                info.content.style.display = info.isOpen ? "block" : "none";
            });

            continentDiv.appendChild(button);
            continentDiv.appendChild(contentDiv);
            continentsFragment.appendChild(continentDiv);
        });

        sidebar.appendChild(continentsFragment);

        let allExpanded = false;
        toggleAllButton.addEventListener("click", () => {
            allExpanded = !allExpanded;
            continentRegistry.forEach(info => {
                info.isOpen = allExpanded;
                info.content.style.display = allExpanded ? "block" : "none";
            });
            toggleAllButton.textContent = allExpanded ? "Tout masquer" : "Tout afficher";
        });

        if (searchBar) {
            searchBar.addEventListener("input", () => {
                activeFilters.text = searchBar.value.trim().toLowerCase();
                applyFilters();
            });
        }

        if (clearSearchButton) {
            clearSearchButton.addEventListener("click", () => {
                if (searchBar) {
                    searchBar.value = "";
                }
                activeFilters.text = "";
                applyFilters();
                if (searchBar) {
                    searchBar.focus();
                }
            });
        }

        populateTypeFilter();

        if (typeFilter) {
            typeFilter.addEventListener("change", () => {
                activeFilters.type = typeFilter.value;
                applyFilters();
            });
        }

        if (resetFiltersButton) {
            resetFiltersButton.addEventListener("click", () => {
                activeFilters = { text: "", type: "all" };
                if (searchBar) {
                    searchBar.value = "";
                }
                if (typeFilter) {
                    typeFilter.value = "all";
                }
                applyFilters();
            });
        }

        applyFilters();
        updateHistoryUI();
    }

    function populateTypeFilter() {
        if (!typeFilter) {
            return;
        }

        const uniqueTypes = new Set();
        markerEntries.forEach(entry => {
            if (entry.location.type && entry.location.type !== 'default') {
                uniqueTypes.add(entry.location.type);
            }
        });

        const options = ['<option value="all">Tous les types</option>'];
        Array.from(uniqueTypes).sort((a, b) => a.localeCompare(b, 'fr')).forEach(type => {
            options.push(`<option value="${type}">${type}</option>`);
        });

        typeFilter.innerHTML = options.join('');
        if (activeFilters.type && uniqueTypes.has(activeFilters.type)) {
            typeFilter.value = activeFilters.type;
        } else {
            typeFilter.value = 'all';
            activeFilters.type = 'all';
        }
    }

    function applyFilters() {
        const query = (activeFilters.text || '').toLowerCase();
        const selectedType = activeFilters.type || 'all';
        const hasQuery = query.length > 0;
        const hasType = selectedType !== 'all';
        const visibleContinents = new Map();

        markerEntries.forEach(entry => {
            const matchesText = !hasQuery || entry.location.name.toLowerCase().includes(query);
            const matchesType = !hasType || entry.location.type === selectedType;
            const isVisible = matchesText && matchesType;

            entry.element.style.display = isVisible ? 'block' : 'none';

            const marker = entry.marker;
            if (isVisible) {
                if (!map.hasLayer(marker)) {
                    marker.addTo(map);
                }
                marker.setOpacity(1);
                if (entry === selectedEntry) {
                    setMarkerHighlight(marker, true);
                }
                visibleContinents.set(entry.continent, true);
            } else {
                marker.setOpacity(0);
                setMarkerHighlight(marker, false);
                entry.element.classList.remove('active');
                if (map.hasLayer(marker)) {
                    map.removeLayer(marker);
                }
                if (selectedEntry === entry) {
                    selectedEntry = null;
                }
            }
        });

        continentRegistry.forEach(info => {
            const hasVisible = visibleContinents.has(info.name);
            info.wrapper.style.display = hasVisible ? 'block' : 'none';

            if (!hasVisible) {
                info.content.style.display = 'none';
            } else if (hasQuery || hasType || info.isOpen) {
                info.content.style.display = 'block';
            } else {
                info.content.style.display = 'none';
            }
        });
    }

    function findEntryByLocation(location) {
        return markerEntries.find(entry => entry.location === location) || null;
    }

    function setMarkerHighlight(marker, isActive) {
        const icon = marker.getElement();
        if (!icon) {
            return;
        }
        icon.classList.toggle('marker-highlight', Boolean(isActive));
    }

    function createCustomIcon(type) {
        const iconBase = 'assets/icons/';
        const pinSize = [40, 50];
        const pinAnchor = [20, 50];
        const popupAnchor = [0, -40];
        const iconPath = (typeData[type] && typeData[type].icon) || `${iconBase}default.png`;

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

    function selectLocation(location) {
        const entry = findEntryByLocation(location);
        if (!entry) {
            console.warn(`Impossible de retrouver ${location.name} dans le panneau Exploration.`);
            return;
        }

        if (activeFilters.type !== 'all' && activeFilters.type !== (location.type || 'default')) {
            activeFilters.type = 'all';
            if (typeFilter) {
                typeFilter.value = 'all';
            }
        }

        if (activeFilters.text && !location.name.toLowerCase().includes(activeFilters.text)) {
            activeFilters.text = '';
            if (searchBar) {
                searchBar.value = '';
            }
        }

        applyFilters();

        console.log(`📍 Sélection de l'emplacement : ${location.name}`);

        openInfoSidebar(location);
        highlightSelectedLocation(entry);
        openContinentCategory(entry);

        const zoomLevel = getZoomLevel(location.type || 'default');
        map.flyTo([location.y, location.x], zoomLevel, {
            animate: true,
            duration: 1.5
        });

        addToHistory(location);

        const infoSidebar = document.getElementById('info-sidebar');
        if (infoSidebar) {
            infoSidebar.dataset.location = JSON.stringify(location);
        } else {
            console.error('⚠️ Erreur : `info-sidebar` introuvable.');
        }

        requestAnimationFrame(() => {
            const gallery = document.getElementById('image-gallery');
            if (gallery) {
                updateGallery(location);
            } else {
                console.error('⚠️ Erreur : `image-gallery` introuvable.');
            }
        });

        if (location.audio && typeof location.audio === 'string') {
            playAudio(location);
        } else {
            console.warn('⚠️ Aucun fichier audio défini pour ce lieu.');
        }

        requestAnimationFrame(() => {
            updateExtraInfo(location);
        });
    }


    function updateGallery(location) {
        const galleryContainer = document.getElementById("image-gallery");
    
        // 📌 VÃ©rifier si `image-gallery` existe
        if (!galleryContainer) {
            console.error("⚠️ Erreur : `image-gallery` n'est pas encore chargÃ©.");
            return;
        }
    
        // 📌 RÃ©initialiser la galerie
        galleryContainer.innerHTML = "";
    
        let hasContent = false; // VÃ©rifier si on doit afficher la galerie
    
        // 📌 Ajouter les images si elles existent
        if (location.images && location.images.length > 0) {
            location.images.forEach((imgSrc, index) => {
                const imgElement = document.createElement("img");
                imgElement.src = imgSrc;
                imgElement.classList.add("gallery-image");
                imgElement.alt = `Image ${index + 1} de ${location.name}`;
                imgElement.onerror = () => {
                    console.error(`⚠️ Impossible de charger l'image : ${imgSrc}`);
                    imgElement.style.display = "none";
                };
                galleryContainer.appendChild(imgElement);
            });
            hasContent = true;
        }
    
        // 📌 Ajouter les vidÃ©os YouTube sous forme de miniatures cliquables avec titre
        if (location.videos && location.videos.length > 0) {
            location.videos.forEach((videoUrl) => {
                const videoId = extractYouTubeId(videoUrl);
                if (videoId) {
                    const videoContainer = document.createElement("div");
                    videoContainer.classList.add("gallery-video-container");

                    // 📌 Ajouter le titre de la vidÃ©o
                    const videoTitle = document.createElement("p");
                    videoTitle.classList.add("gallery-video-title");
                    videoTitle.textContent = "Chargement du titre..."; // Texte temporaire
                    fetchYouTubeTitle(videoId, videoTitle); // ðŸ”¥ RÃ©cupÃ©rer le vrai titre

                    // 📌 Ajouter le lien cliquable
                    const videoLink = document.createElement("a");
                    videoLink.href = videoUrl;
                    videoLink.target = "_blank";
                    videoLink.classList.add("gallery-video");

                    // 📌 Ajouter la miniature YouTube
                    const videoThumbnail = document.createElement("img");
                    videoThumbnail.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                    videoThumbnail.alt = "Miniature YouTube";
                    videoThumbnail.classList.add("gallery-thumbnail");

                    videoLink.appendChild(videoThumbnail);
                    videoContainer.appendChild(videoLink);
                    videoContainer.appendChild(videoTitle);
                    galleryContainer.appendChild(videoContainer);
        }
    });
    hasContent = true;
}

    
        // 📌 Cacher la galerie si elle est vide
        galleryContainer.style.display = hasContent ? "block" : "none";
    }
    
    // 📌 Fonction pour extraire l'ID d'une URL YouTube
    function extractYouTubeId(url) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }
    
    function fetchYouTubeTitle(videoId, titleElement) {
        fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`)
            .then(response => response.json())
            .then(data => {
                if (data.title) {
                    titleElement.textContent = data.title; // ðŸ”¥ Afficher le vrai titre
                } else {
                    titleElement.textContent = "VidÃ©o YouTube";
                }
            })
            .catch(() => {
                titleElement.textContent = "VidÃ©o YouTube";
            });
    }    

    let currentAudio = null; // 📌 Variable pour stocker l'audio en cours

function playAudio(location) {
    const audioPlayer = document.getElementById("audio-player");

    // 📌 VÃ©rifier si le lieu a un son
    if (!location.audio) {
        console.warn(`âš ï¸ Aucun son pour ${location.name}.`);
        if (currentAudio) {
            currentAudio.pause(); // ðŸ”‡ Coupe l'ancien son
            currentAudio.currentTime = 0;
            currentAudio = null;
        }
        return;
    }

    // 📌 Met Ã  jour la source audio
    audioPlayer.src = location.audio;
    audioPlayer.play().catch(error => console.error("⚠️ Impossible de jouer le son :", error));

    currentAudio = audioPlayer; // ðŸ”¥ Stocke le son en cours
}
    
    function getZoomLevel(locationType) {
        return typeData[locationType]?.zoom || 3; // ðŸ”¥ RÃ©cupÃ¨re le zoom dÃ©fini dans types.json ou utilise 3 par dÃ©faut
    }    

    function animateMarker(marker) {
        setMarkerHighlight(marker, true);
        let isVisible = true;
        const blinkInterval = setInterval(() => {
            isVisible = !isVisible;
            marker.setOpacity(isVisible ? 1 : 0.4);
        }, 300);

        setTimeout(() => {
            clearInterval(blinkInterval);
            marker.setOpacity(1);
            if (!selectedEntry || selectedEntry.marker !== marker) {
                setMarkerHighlight(marker, false);
            }
        }, 1200);
    }

    function openInfoSidebar(location) {
        console.log(`📌 Ouverture de la barre latÃ©rale pour : ${location.name}`);
    
        const infoSidebar = document.getElementById("info-sidebar");
        const infoTitle = document.getElementById("info-title");
        const descriptionText = document.getElementById("description-text");
        const galleryContainer = document.getElementById("image-gallery");
        
        // 📌 VÃ©rifier que tous les Ã©lÃ©ments existent
        if (!infoSidebar || !infoTitle || !descriptionText || !galleryContainer) {
            console.error("⚠️ Erreur : Un des Ã©lÃ©ments de la barre latÃ©rale est introuvable.");
            return;
        }
    
        // 📌 Met Ã  jour les Ã©lÃ©ments avec les infos du lieu
        infoTitle.textContent = location.name;
        descriptionText.textContent = location.description || "Aucune description disponible.";
    
        // 📌 Met Ã  jour la galerie dâ€™images
        updateGallery(location);
    
        // 📌 VÃ©rifier et mettre Ã  jour les informations supplÃ©mentaires
        updateExtraInfo(location);
    
        // 📌 Afficher la barre latÃ©rale correctement
        if (!infoSidebar.classList.contains("open")) {
            infoSidebar.style.display = "block"; // 📌 La rendre visible avant l'animation
            setTimeout(() => {
                infoSidebar.classList.add("open"); // 📌 Animation d'ouverture fluide
            }, 10);
        }
    }

    function updateExtraInfo(location) {
        const historySection = document.getElementById("history-section");
        const questsSection = document.getElementById("quests-section");
        const pnjsSection = document.getElementById("pnjs-section");
        const loreSection = document.getElementById("lore-section");

        if (!historySection || !questsSection || !pnjsSection || !loreSection) {
            console.error("⚠️ Erreur : Un des conteneurs d'informations est introuvable.");
            return;
        }

        historySection.innerHTML = "";
        questsSection.innerHTML = "";
        pnjsSection.innerHTML = "";
        loreSection.innerHTML = "";

        const historyEntries = [];
        if (Array.isArray(location.history)) {
            location.history.filter(Boolean).forEach(entry => historyEntries.push(String(entry).trim()));
        } else if (typeof location.history === "string" && location.history.trim()) {
            historyEntries.push(location.history.trim());
        }

        if (historyEntries.length > 0) {
            const historyHTML = historyEntries.map(entry => `<p>${entry}</p>`).join("");
            historySection.innerHTML = `
                <div class="extra-section" data-section="history">
                    <h4>Histoire</h4>
                    ${historyHTML}
                </div>
            `;
            historySection.style.display = "block";
        } else {
            historySection.style.display = "none";
        }

        const quests = Array.isArray(location.quests)
            ? location.quests.filter(Boolean).map(entry => String(entry).trim())
            : typeof location.quests === "string" && location.quests.trim()
                ? [location.quests.trim()]
                : [];

        if (quests.length > 0) {
            let questsHTML = `
                <div class="extra-section" data-section="quests">
                    <h4>Quêtes associées</h4>
                    <ul>
            `;
            quests.forEach(quest => {
                questsHTML += `<li>${quest}</li>`;
            });
            questsHTML += `</ul></div>`;
            questsSection.innerHTML = questsHTML;
            questsSection.style.display = "block";
        } else {
            questsSection.style.display = "none";
        }

        const pnjs = Array.isArray(location.pnjs)
            ? location.pnjs.filter(Boolean)
            : [];

        if (pnjs.length > 0) {
            let pnjsHTML = `
                <div class="extra-section" data-section="pnj">
                    <h4>PNJ importants</h4>
                    <ul>
            `;
            pnjs.forEach(pnj => {
                const name = pnj && pnj.name ? pnj.name : "PNJ";
                const roleText = pnj && pnj.role ? ` - <em>${pnj.role}</em>` : "";
                const descriptionText = pnj && pnj.description ? `: ${pnj.description}` : "";
                pnjsHTML += `<li><strong>${name}</strong>${roleText}${descriptionText}</li>`;
            });
            pnjsHTML += `</ul></div>`;
            pnjsSection.innerHTML = pnjsHTML;
            pnjsSection.style.display = "block";
        } else {
            pnjsSection.style.display = "none";
        }

        const loreEntries = Array.isArray(location.lore)
            ? location.lore.filter(Boolean).map(entry => String(entry).trim())
            : typeof location.lore === "string" && location.lore.trim()
                ? [location.lore.trim()]
                : [];

        if (loreEntries.length > 0) {
            const loreHTML = loreEntries.map(entry => `<p>${entry}</p>`).join("");
            loreSection.innerHTML = `
                <div class="extra-section" data-section="lore">
                    <h4>Lore détaillé</h4>
                    ${loreHTML}
                </div>
            `;
            loreSection.style.display = "block";
        } else {
            loreSection.style.display = "none";
        }
    }






    function addToHistory(location) {
        if (!navigationHistory.some(item => item.name === location.name)) {
            navigationHistory.unshift(location);
            if (navigationHistory.length > 5) {
                navigationHistory.pop(); // ðŸ”¥ Garde seulement les 5 derniers lieux visitÃ©s
            }
            updateHistoryUI();
        }
    }
    
    function goBackInHistory() {
        if (navigationHistory.length > 1) {
            navigationHistory.shift();
            selectLocation(navigationHistory[0]);
            updateHistoryUI();
        }
    }
    
    function updateHistoryUI() {
        const historyList = document.getElementById("history-list");
        historyList.innerHTML = "";
    
        navigationHistory.forEach((location, index) => {
            if (index === 0) return; // ðŸ”¥ Ne pas afficher le lieu actuel dans l'historique
            const historyItem = document.createElement("button");
            historyItem.textContent = location.name;
            historyItem.classList.add("history-item");
            historyItem.addEventListener("click", () => selectLocation(location));
            historyList.appendChild(historyItem);
        });
    
    // ðŸ”¥ Afficher ou masquer le bouton Retour selon l'historique
    const historyBackButton = document.getElementById("history-back");
    historyBackButton.style.display = navigationHistory.length > 1 ? "block" : "none";
}
    

// 📌 Ã‰couteurs dâ€™Ã©vÃ©nements pour le bouton Retour
document.getElementById("history-back").addEventListener("click", goBackInHistory);
    
    resetViewButton.addEventListener("click", () => {
        console.log("ðŸ”„ RÃ©initialisation de la carte !");
        map.flyTo([3072, 4096], -3, { animate: true, duration: 0.5 });
        updateZoomLevel();
    });
    
    // 📌 Fermer le panneau latÃ©ral
    closeInfoSidebar.addEventListener("click", () => {
        infoSidebar.classList.remove("open");
        setTimeout(() => {
            infoSidebar.style.display = "none";
        }, 400);
    });    

function highlightSelectedLocation(entry) {
    markerEntries.forEach(item => {
        if (item !== entry) {
            item.element.classList.remove('active');
            setMarkerHighlight(item.marker, false);
        }
    });

    if (entry) {
        entry.element.classList.add('active');
        setMarkerHighlight(entry.marker, true);
        selectedEntry = entry;
    } else {
        selectedEntry = null;
    }
}



function openContinentCategory(entry) {
    const info = continentRegistry.get(entry.continent);
    if (info) {
        info.isOpen = true;
        info.wrapper.style.display = 'block';
        info.content.style.display = 'block';
    }
}

});

// 📌 Gestion de la fermeture du panneau latÃ©ral
document.getElementById("close-info-sidebar").addEventListener("click", () => {
    console.log("⚠️ Fermeture du panneau latÃ©ral...");
    const infoSidebar = document.getElementById("info-sidebar");
    infoSidebar.classList.remove("open"); // ðŸ”¥ Masquer le panneau

    // ðŸ”¥ Ajoute une animation pour le rendre plus fluide
    setTimeout(() => {
        infoSidebar.style.display = "none";
    }, 300);
});






















