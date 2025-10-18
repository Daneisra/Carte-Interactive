import { createElement, clearElement } from './dom.js';

const DEFAULT_LOCATION = {
    name: '',
    type: 'default',
    x: 0,
    y: 0,
    description: '',
    audio: '',
    images: [],
    videos: [],
    history: [],
    quests: [],
    lore: [],
    pnjs: []
};

const isValidUrl = value => {
    if (!value || typeof value !== 'string') {
        return false;
    }
    const trimmed = value.trim();
    if (!trimmed.length) {
        return false;
    }
    if (trimmed.startsWith('assets/')) {
        return true;
    }
    try {
        const url = new URL(trimmed);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (error) {
        return false;
    }
};

const splitLines = value => (value || '')
    .split(/\r?\n/)
    .map(entry => entry.trim())
    .filter(Boolean);

const copyLocation = source => {
    if (!source) {
        return { ...DEFAULT_LOCATION };
    }
    return {
        ...DEFAULT_LOCATION,
        ...source,
        images: Array.isArray(source.images) ? [...source.images] : [],
        videos: Array.isArray(source.videos) ? source.videos.map(video => ({ ...video })) : [],
        history: Array.isArray(source.history) ? [...source.history] : [],
        quests: Array.isArray(source.quests) ? [...source.quests] : [],
        lore: Array.isArray(source.lore) ? [...source.lore] : [],
        pnjs: Array.isArray(source.pnjs) ? source.pnjs.map(pnj => ({ ...pnj })) : []
    };
};

const extractYouTubeId = url => {
    if (!url) {
        return null;
    }
    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes('youtu.be')) {
            return parsed.pathname.split('/').filter(Boolean)[0] || null;
        }
        if (parsed.hostname.includes('youtube.com')) {
            const id = parsed.searchParams.get('v') || parsed.pathname.split('/').pop();
            return id || null;
        }
    } catch (error) {
        // fall through
    }
    const match = url.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{6,})/);
    return match ? match[1] : null;
};

export class LocationEditor {
    constructor({
        container,
        types = {},
        onCreate = null,
        onUpdate = null
    } = {}) {
        this.container = container;
        this.dialog = container?.querySelector('.editor-dialog') || null;
        this.form = container?.querySelector('#location-editor-form') || null;
        this.closeButton = container?.querySelector('#location-editor-close') || null;
        this.cancelButton = this.form?.querySelector('[data-action="cancel"]') || null;
        this.submitButton = this.form?.querySelector('[data-action="submit"]') || null;
        this.headerTitle = container?.querySelector('#location-editor-title') || null;
        this.imageList = this.form?.querySelector('[data-role="image-list"]') || null;
        this.videoList = this.form?.querySelector('[data-role="video-list"]') || null;
        this.pnjList = this.form?.querySelector('[data-role="pnj-list"]') || null;
        this.addImageButton = this.form?.querySelector('[data-action="add-image"]') || null;
        this.addVideoButton = this.form?.querySelector('[data-action="add-video"]') || null;
        this.addPnjButton = this.form?.querySelector('[data-action="add-pnj"]') || null;
        this.imagePreview = this.form?.querySelector('[data-preview="images"]') || null;
        this.videoPreview = this.form?.querySelector('[data-preview="videos"]') || null;
        this.pnjPreview = this.form?.querySelector('[data-preview="pnjs"]') || null;
        this.typeSelect = this.form?.querySelector('#editor-type') || null;

        this.callbacks = { onCreate, onUpdate };
        this.types = types || {};
        this.mode = 'create';
        this.currentContext = null;
        this.disallowedNames = new Set();
        this.boundKeyHandler = null;
        this.previousFocus = null;
        this.isOpen = false;

        if (this.form) {
            this.registerEvents();
            this.renderTypeOptions();
        }
    }

    registerEvents() {
        this.form.addEventListener('submit', event => {
            event.preventDefault();
            this.handleSubmit();
        });

        this.form.addEventListener('input', event => {
            const target = event.target;
            if (!target) {
                return;
            }
            if (target.name === 'name' || target.name === 'continent') {
                this.validateField(target.name);
            }
            if (target.name === 'x' || target.name === 'y') {
                this.validateCoordinates();
            }
            if (target.dataset?.role === 'image-input') {
                this.validateImages();
                this.updateImagePreview();
            }
            if (target.dataset?.role === 'video-url' || target.dataset?.role === 'video-title') {
                this.validateVideos();
                this.updateVideoPreview();
            }
            if (target.dataset?.role === 'pnj-name' || target.dataset?.role === 'pnj-role' || target.dataset?.role === 'pnj-description') {
                this.validatePnjs();
                this.updatePnjPreview();
            }
            if (target.name === 'type') {
                this.validateField('type');
            }
            if (target.name === 'audio') {
                this.validateAudio();
            }
        });

        if (this.addImageButton) {
            this.addImageButton.addEventListener('click', () => {
                this.addImageField('');
                this.validateImages();
            });
        }

        if (this.addVideoButton) {
            this.addVideoButton.addEventListener('click', () => {
                this.addVideoField({ url: '', title: '' });
                this.validateVideos();
            });
        }
        if (this.addPnjButton) {
            this.addPnjButton.addEventListener('click', () => {
                this.addPnjField({ name: '', role: '', description: '' });
                this.validatePnjs();
            });
        }

        if (this.imageList) {
            this.imageList.addEventListener('click', event => {
                if (event.target?.dataset?.action === 'remove-image') {
                    const row = event.target.closest('.editor-list-row');
                    row?.remove();
                    this.validateImages();
                    this.updateImagePreview();
                }
            });
        }

        if (this.videoList) {
            this.videoList.addEventListener('click', event => {
                if (event.target?.dataset?.action === 'remove-video') {
                    const row = event.target.closest('.editor-list-row');
                    row?.remove();
                    this.validateVideos();
                    this.updateVideoPreview();
                }
            });
        }

        if (this.pnjList) {
            this.pnjList.addEventListener('click', event => {
                if (event.target?.dataset?.action === 'remove-pnj') {
                    const row = event.target.closest('.editor-list-row');
                    row?.remove();
                    this.validatePnjs();
                    this.updatePnjPreview();
                }
            });
        }

        if (this.cancelButton) {
            this.cancelButton.addEventListener('click', () => this.close());
        }

        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.close());
        }

        if (this.container) {
            this.container.addEventListener('click', event => {
                if (event.target === this.container) {
                    this.close();
                }
            });
        }
    }

    setTypes(types = {}) {
        this.types = types || {};
        this.renderTypeOptions();
    }

    renderTypeOptions() {
        if (!this.typeSelect) {
            return;
        }
        const current = this.typeSelect.value;
        clearElement(this.typeSelect);
        const entries = Object.keys(this.types || {}).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
        entries.unshift('default');
        entries.forEach(typeName => {
            const option = createElement('option', { text: typeName, attributes: { value: typeName } });
            this.typeSelect.appendChild(option);
        });
        if (current && entries.includes(current)) {
            this.typeSelect.value = current;
        }
    }

    open({ mode = 'create', location = null, continent = '', disallowedNames = [] } = {}) {
        if (!this.container) {
            return;
        }
        this.mode = mode;
        this.disallowedNames = new Set(
            (Array.isArray(disallowedNames) ? disallowedNames : [])
                .map(name => (name ?? '').toString().trim().toLowerCase())
                .filter(Boolean)
        );
        this.currentContext = {
            location: copyLocation(location),
            continent: continent || (location?.continent || ''),
            originalName: location?.name || ''
        };

        this.populateForm();
        this.resetErrors();
        this.updateImagePreview();
        this.updateVideoPreview();
        this.updatePnjPreview();

        if (this.headerTitle) {
            this.headerTitle.textContent = mode === 'edit' ? 'Modifier un lieu' : 'Créer un lieu';
        }
        if (this.submitButton) {
            this.submitButton.textContent = mode === 'edit' ? 'Enregistrer' : 'Créer';
        }

        this.previousFocus = document.activeElement;
        this.container.hidden = false;
        this.container.classList.add('open');
        this.dialog?.focus?.();
        this.isOpen = true;

        this.boundKeyHandler = event => {
            if (event.key === 'Escape') {
                this.close();
            }
        };
        document.addEventListener('keydown', this.boundKeyHandler);
    }

    close() {
        if (!this.container || !this.isOpen) {
            return;
        }
        this.container.classList.remove('open');
        this.container.hidden = true;
        if (this.boundKeyHandler) {
            document.removeEventListener('keydown', this.boundKeyHandler);
            this.boundKeyHandler = null;
        }
        this.isOpen = false;
        this.currentContext = null;
        this.disallowedNames.clear();
        this.previousFocus?.focus?.();
        this.previousFocus = null;
    }

    populateForm() {
        if (!this.form || !this.currentContext) {
            return;
        }
        const { location, continent } = this.currentContext;
        this.form.reset();
        this.form.elements.name.value = location.name || '';
        this.form.elements.continent.value = continent || '';
        if (this.typeSelect) {
            this.typeSelect.value = location.type && this.types[location.type] ? location.type : 'default';
        }
        this.form.elements.x.value = Number.isFinite(location.x) ? Math.round(location.x) : '';
        this.form.elements.y.value = Number.isFinite(location.y) ? Math.round(location.y) : '';
        this.form.elements.description.value = location.description || '';
        this.form.elements.audio.value = location.audio || '';
        this.form.elements.history.value = (location.history || []).join('\n');
        this.form.elements.quests.value = (location.quests || []).join('\n');
        this.form.elements.lore.value = (location.lore || []).join('\n');

        if (this.imageList) {
            clearElement(this.imageList);
            const images = Array.isArray(location.images) && location.images.length ? location.images : [''];
            images.forEach(url => this.addImageField(url));
        }

        if (this.videoList) {
            clearElement(this.videoList);
            const videos = Array.isArray(location.videos) && location.videos.length
                ? location.videos
                : [{ url: '', title: '' }];
            videos.forEach(video => this.addVideoField(video));
        }

        if (this.pnjList) {
            clearElement(this.pnjList);
            const pnjs = Array.isArray(location.pnjs) && location.pnjs.length
                ? location.pnjs
                : [{ name: '', role: '', description: '' }];
            pnjs.forEach(pnj => this.addPnjField(pnj));
        }
        this.updateImagePreview();
        this.updateVideoPreview();
        this.updatePnjPreview();

    }

    addImageField(value = '') {
        if (!this.imageList) {
            return;
        }
        const row = createElement('div', { className: 'editor-list-row' });
        const input = createElement('input', {
            attributes: {
                type: 'url',
                placeholder: 'https://example.com/image.jpg',
                'data-role': 'image-input'
            }
        });
        input.value = value || '';
        row.appendChild(input);
        const remove = createElement('button', {
            className: 'tertiary-button',
            text: 'Supprimer',
            attributes: { type: 'button', 'data-action': 'remove-image' }
        });
        row.appendChild(remove);
        this.imageList.appendChild(row);
    }

    addVideoField(video = { url: '', title: '' }) {
        if (!this.videoList) {
            return;
        }
        const row = createElement('div', { className: 'editor-list-row video-row' });
        const titleInput = createElement('input', {
            attributes: {
                type: 'text',
                placeholder: 'Titre',
                'data-role': 'video-title'
            }
        });
        titleInput.value = video?.title || '';
        const urlInput = createElement('input', {
            attributes: {
                type: 'url',
                placeholder: 'https://youtu.be/…',
                'data-role': 'video-url'
            }
        });
        urlInput.value = video?.url || '';
        const remove = createElement('button', {
            className: 'tertiary-button',
            text: 'Supprimer',
            attributes: { type: 'button', 'data-action': 'remove-video' }
        });
        row.appendChild(titleInput);
        row.appendChild(urlInput);
        row.appendChild(remove);
        this.videoList.appendChild(row);
    }

    addPnjField(pnj = { name: '', role: '', description: '' }) {
        if (!this.pnjList) {
            return;
        }
        const row = createElement('div', { className: 'editor-list-row' });
        const nameInput = createElement('input', {
            attributes: {
                type: 'text',
                placeholder: 'Nom',
                'data-role': 'pnj-name'
            }
        });
        nameInput.value = pnj?.name || '';
        const roleInput = createElement('input', {
            attributes: {
                type: 'text',
                placeholder: 'Rôle',
                'data-role': 'pnj-role'
            }
        });
        roleInput.value = pnj?.role || '';
        const descriptionInput = createElement('input', {
            attributes: {
                type: 'text',
                placeholder: 'Description',
                'data-role': 'pnj-description'
            }
        });
        descriptionInput.value = pnj?.description || '';
        const remove = createElement('button', {
            className: 'tertiary-button',
            text: 'Supprimer',
            attributes: { type: 'button', 'data-action': 'remove-pnj' }
        });
        row.appendChild(nameInput);
        row.appendChild(roleInput);
        row.appendChild(descriptionInput);
        row.appendChild(remove);
        this.pnjList.appendChild(row);
    }

    handleSubmit() {
        const result = this.collectFormData();
        this.resetErrors();
        Object.entries(result.errors).forEach(([key, message]) => {
            this.showError(key, message);
        });

        if (!result.valid) {
            this.showError('form', 'Merci de corriger les champs indiqués avant de continuer.');
            return;
        }

        if (this.mode === 'edit' && typeof this.callbacks.onUpdate === 'function') {
            this.callbacks.onUpdate({
                continent: result.continent,
                location: result.location,
                originalContinent: this.currentContext?.continent || '',
                originalName: this.currentContext?.originalName || ''
            });
        }

        if (this.mode !== 'edit' && typeof this.callbacks.onCreate === 'function') {
            this.callbacks.onCreate({
                continent: result.continent,
                location: result.location
            });
        }

        this.close();
    }

    collectFormData() {
        const errors = {};
        const location = copyLocation(this.currentContext?.location || {});

        const name = (this.form.elements.name.value || '').trim();
        const continent = (this.form.elements.continent.value || '').trim();
        const type = this.typeSelect?.value || 'default';
        const xRaw = this.form.elements.x.value;
        const yRaw = this.form.elements.y.value;
        const description = (this.form.elements.description.value || '').trim();
        const audio = (this.form.elements.audio.value || '').trim();

        const x = Number(xRaw);
        const y = Number(yRaw);

        if (!name) {
            errors.name = 'Le nom est obligatoire.';
        } else if (this.mode === 'create' && this.disallowedNames.has(name.toLowerCase())) {
            errors.name = 'Un lieu avec ce nom existe déjà.';
        } else if (this.mode === 'edit' && name.toLowerCase() !== (this.currentContext?.originalName || '').toLowerCase() && this.disallowedNames.has(name.toLowerCase())) {
            errors.name = 'Un lieu avec ce nom existe déjà.';
        }

        if (!continent) {
            errors.continent = 'Le continent est obligatoire.';
        }

        if (!this.types[type]) {
            errors.type = 'Sélectionnez un type valide.';
        }

        if (!Number.isFinite(x)) {
            errors.x = 'Coordonnée invalide.';
        }
        if (!Number.isFinite(y)) {
            errors.y = 'Coordonnée invalide.';
        }

        if (audio && !isValidUrl(audio)) {
            errors.audio = 'Lien audio invalide (URL ou chemin assets/).';
        }

        const images = this.collectImages();
        if (images.some(image => !isValidUrl(image))) {
            errors.images = 'Toutes les images doivent être des URLs valides ou des chemins commençant par assets/.';
        }

        const videos = this.collectVideos();
        const invalidVideos = videos.filter(video => video.url && !isValidUrl(video.url));
        if (invalidVideos.length || videos.some(video => !video.url && video.title)) {
            errors.videos = 'Chaque vidéo doit avoir une URL valide.';
        }

        const pnjs = this.collectPnjs();
        const invalidPnjs = pnjs.filter(pnj => !pnj.name);
        if (invalidPnjs.length) {
            errors.pnjs = 'Chaque PNJ doit avoir un nom.';
        }

        location.name = name;
        location.type = type;
        location.x = Number.isFinite(x) ? x : 0;
        location.y = Number.isFinite(y) ? y : 0;
        location.description = description;
        location.audio = audio || '';
        location.images = images.filter(Boolean);
        location.videos = videos.filter(video => video.url);
        location.pnjs = pnjs;
        location.history = splitLines(this.form.elements.history.value);
        location.quests = splitLines(this.form.elements.quests.value);
        location.lore = splitLines(this.form.elements.lore.value);

        const valid = Object.keys(errors).length === 0;
        return {
            valid,
            errors,
            continent,
            location
        };
    }

    collectImages() {
        if (!this.imageList) {
            return [];
        }
        return Array.from(this.imageList.querySelectorAll('input[data-role="image-input"]'))
            .map(input => (input.value || '').trim())
            .filter(value => value.length);
    }

    collectVideos() {
        if (!this.videoList) {
            return [];
        }
        const rows = Array.from(this.videoList.querySelectorAll('.editor-list-row'));
        return rows.map(row => {
            const title = (row.querySelector('input[data-role="video-title"]')?.value || '').trim();
            const url = (row.querySelector('input[data-role="video-url"]')?.value || '').trim();
            return { title, url };
        }).filter(video => video.url || video.title);
    }

    collectPnjs() {
        if (!this.pnjList) {
            return [];
        }
        const rows = Array.from(this.pnjList.querySelectorAll('.editor-list-row'));
        return rows.map(row => {
            const name = (row.querySelector('input[data-role="pnj-name"]')?.value || '').trim();
            const role = (row.querySelector('input[data-role="pnj-role"]')?.value || '').trim();
            const description = (row.querySelector('input[data-role="pnj-description"]')?.value || '').trim();
            if (!name && !role && !description) {
                return null;
            }
            return { name, role, description };
        }).filter(Boolean);
    }

    validateField(name) {
        if (name === 'name') {
            const value = (this.form.elements.name.value || '').trim();
            if (!value) {
                this.showError('name', 'Le nom est obligatoire.');
            } else if (this.mode === 'create' && this.disallowedNames.has(value.toLowerCase())) {
                this.showError('name', 'Un lieu avec ce nom existe déjà.');
            } else if (this.mode === 'edit' && value.toLowerCase() !== (this.currentContext?.originalName || '').toLowerCase() && this.disallowedNames.has(value.toLowerCase())) {
                this.showError('name', 'Un lieu avec ce nom existe déjà.');
            } else {
                this.clearError('name');
            }
        }

        if (name === 'continent') {
            const value = (this.form.elements.continent.value || '').trim();
            if (!value) {
                this.showError('continent', 'Le continent est obligatoire.');
            } else {
                this.clearError('continent');
            }
        }

        if (name === 'type' && this.typeSelect) {
            const value = this.typeSelect.value;
            if (!this.types[value]) {
                this.showError('type', 'Sélectionnez un type valide.');
            } else {
                this.clearError('type');
            }
        }
    }

    validateCoordinates() {
        const x = Number(this.form.elements.x.value);
        const y = Number(this.form.elements.y.value);
        if (!Number.isFinite(x)) {
            this.showError('x', 'Coordonnée invalide.');
        } else {
            this.clearError('x');
        }
        if (!Number.isFinite(y)) {
            this.showError('y', 'Coordonnée invalide.');
        } else {
            this.clearError('y');
        }
    }

    validateImages() {
        const images = this.collectImages();
        if (images.length === 0) {
            this.clearError('images');
            return;
        }
        const hasInvalid = images.some(url => !isValidUrl(url));
        if (hasInvalid) {
            this.showError('images', 'Chaque image doit être une URL valide ou un chemin assets/.');
        } else {
            this.clearError('images');
        }
    }

    validateVideos() {
        const videos = this.collectVideos();
        if (!videos.length) {
            this.clearError('videos');
            return;
        }
        const hasInvalid = videos.some(video => video.url && !isValidUrl(video.url));
        if (hasInvalid) {
            this.showError('videos', 'Chaque vidéo doit avoir une URL valide.');
        } else {
            this.clearError('videos');
        }
    }

    validatePnjs() {
        const pnjs = this.collectPnjs();
        if (!pnjs.length) {
            this.clearError('pnjs');
            return;
        }
        const hasInvalid = pnjs.some(pnj => !pnj.name);
        if (hasInvalid) {
            this.showError('pnjs', 'Chaque PNJ doit avoir un nom.');
        } else {
            this.clearError('pnjs');
        }
    }

    validateAudio() {
        const audio = (this.form.elements.audio.value || '').trim();
        if (audio && !isValidUrl(audio)) {
            this.showError('audio', 'Lien audio invalide (URL ou chemin assets/).');
        } else {
            this.clearError('audio');
        }
    }

    updateImagePreview() {
        if (!this.imagePreview) {
            return;
        }
        clearElement(this.imagePreview);
        const images = this.collectImages();
        if (!images.length) {
            const empty = createElement('p', { className: 'preview-empty', text: 'Ajoutez une image pour la prévisualiser.' });
            this.imagePreview.appendChild(empty);
            return;
        }
        images.forEach(url => {
            const figure = createElement('figure', { className: 'preview-card' });
            const img = createElement('img', { attributes: { src: url, alt: '' } });
            img.addEventListener('error', () => figure.classList.add('preview-error'));
            figure.appendChild(img);
            const caption = createElement('figcaption', { text: url });
            figure.appendChild(caption);
            this.imagePreview.appendChild(figure);
        });
    }

    updateVideoPreview() {
        if (!this.videoPreview) {
            return;
        }
        clearElement(this.videoPreview);
        const videos = this.collectVideos().filter(video => video.url);
        if (!videos.length) {
            const empty = createElement('p', { className: 'preview-empty', text: 'Ajoutez une vidéo pour la prévisualiser.' });
            this.videoPreview.appendChild(empty);
            return;
        }
        videos.forEach(video => {
            const wrapper = createElement('div', { className: 'preview-card video-preview' });
            const title = createElement('p', { className: 'preview-title', text: video.title || 'Sans titre' });
            wrapper.appendChild(title);
            const youtubeId = extractYouTubeId(video.url);
            if (youtubeId) {
                const iframe = createElement('iframe', {
                    attributes: {
                        src: `https://www.youtube.com/embed/${youtubeId}`,
                        title: video.title || 'Aperçu vidéo',
                        allowfullscreen: 'true'
                    }
                });
                wrapper.appendChild(iframe);
            } else {
                const link = createElement('a', { text: video.url, attributes: { href: video.url, target: '_blank', rel: 'noopener noreferrer' } });
                wrapper.appendChild(link);
            }
            this.videoPreview.appendChild(wrapper);
        });
    }
    updatePnjPreview() {
        if (!this.pnjPreview) {
            return;
        }
        clearElement(this.pnjPreview);
        const pnjs = this.collectPnjs();
        if (!pnjs.length) {
            const empty = createElement('p', { className: 'preview-empty', text: 'Ajoutez un PNJ pour le prévisualiser.' });
            this.pnjPreview.appendChild(empty);
            return;
        }
        pnjs.forEach(pnj => {
            const card = createElement('div', { className: 'preview-card pnj-preview' });
            const title = createElement('p', { className: 'preview-title', text: pnj.name });
            card.appendChild(title);
            if (pnj.role) {
                card.appendChild(createElement('p', { className: 'preview-sub', text: pnj.role }));
            }
            if (pnj.description) {
                card.appendChild(createElement('p', { text: pnj.description }));
            }
            this.pnjPreview.appendChild(card);
        });
    }


    resetErrors() {
        if (!this.form) {
            return;
        }
        const messages = this.form.querySelectorAll('.form-error');
        messages.forEach(message => {
            message.textContent = '';
            message.hidden = true;
        });
    }

    showError(field, message) {
        const target = this.form.querySelector(`.form-error[data-error-for="${field}"]`);
        if (target) {
            target.textContent = message;
            target.hidden = false;
        }
    }

    clearError(field) {
        const target = this.form.querySelector(`.form-error[data-error-for="${field}"]`);
        if (target) {
            target.textContent = '';
            target.hidden = true;
        }
    }
}
