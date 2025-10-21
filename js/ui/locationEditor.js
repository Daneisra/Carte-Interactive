import { createElement, clearElement } from './dom.js';
import { renderMarkdown } from './markdown.js';

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

const UPLOAD_ENDPOINT = '/api/upload';
const UPLOAD_TYPES = { image: 'image', audio: 'audio' };
const MAX_UPLOAD_SIZE = 15 * 1024 * 1024;
const UPLOAD_FILE_RULES = {
    [UPLOAD_TYPES.image]: {
        mimePrefix: 'image/',
        extensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']
    },
    [UPLOAD_TYPES.audio]: {
        mimePrefix: 'audio/',
        extensions: ['.mp3', '.ogg', '.wav', '.flac', '.aac', '.m4a']
    }
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

const partitionFilesByType = (files = [], uploadType) => {
    const rule = UPLOAD_FILE_RULES[uploadType];
    if (!rule) {
        return { accepted: [], rejected: [] };
    }
    const accepted = [];
    const rejected = [];
    files.forEach(file => {
        if (!file) {
            return;
        }
        const name = (file.name || '').toLowerCase();
        const matchesMime = file.type && rule.mimePrefix && file.type.startsWith(rule.mimePrefix);
        const matchesExtension = rule.extensions.some(ext => name.endsWith(ext));
        if (matchesMime || matchesExtension) {
            accepted.push(file);
        } else {
            rejected.push(file);
        }
    });
    return { accepted, rejected };
};

const describeAllowedExtensions = uploadType => {
    const rule = UPLOAD_FILE_RULES[uploadType];
    if (!rule) {
        return '';
    }
    return rule.extensions
        .map(ext => ext.replace(/^\./, '').toUpperCase())
        .join(', ');
};

const buildDeleteConfirmation = name => {
    if (name) {
        return `Supprimer definitivement "${name}" ?`;
    }
    return 'Supprimer ce lieu ?';
};

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

const sanitizeText = value => (value ?? '').toString().trim();

const formatQuestTimestamp = value => {
    if (!value) {
        return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

const formatQuestProgress = progress => {
    if (!progress || typeof progress !== 'object') {
        return '';
    }
    const { current, max } = progress;
    const hasCurrent = Number.isFinite(current);
    const hasMax = Number.isFinite(max);
    if (hasCurrent && hasMax) {
        return `${current}/${max}`;
    }
    if (hasCurrent) {
        return `${current}`;
    }
    return '';
};

export class LocationEditor {
    constructor({
        container,
        types = {},
        onCreate = null,
        onUpdate = null,
        onDelete = null,
        onCreateQuestEvent = null,
        onUpdateQuestEvent = null,
        onDeleteQuestEvent = null
    } = {}) {
        this.container = container;
        this.dialog = container?.querySelector('.editor-dialog') || null;
        this.form = container?.querySelector('#location-editor-form') || null;
        this.closeButton = container?.querySelector('#location-editor-close') || null;
        this.cancelButton = this.form?.querySelector('[data-action="cancel"]') || null;
        this.submitButton = this.form?.querySelector('[data-action="submit"]') || null;
        this.deleteButton = this.form?.querySelector('[data-action="delete"]') || null;
        this.headerTitle = container?.querySelector('#location-editor-title') || null;
        this.imageList = this.form?.querySelector('[data-role="image-list"]') || null;
        this.videoList = this.form?.querySelector('[data-role="video-list"]') || null;
        this.pnjList = this.form?.querySelector('[data-role="pnj-list"]') || null;
        this.addImageButton = this.form?.querySelector('[data-action="add-image"]') || null;
        this.addVideoButton = this.form?.querySelector('[data-action="add-video"]') || null;
        this.addPnjButton = this.form?.querySelector('[data-action="add-pnj"]') || null;
        this.uploadImageButton = this.form?.querySelector('[data-action="upload-image"]') || null;
        this.uploadAudioButton = this.form?.querySelector('[data-action="upload-audio"]') || null;
        this.imageUploadInput = this.form?.querySelector('#editor-image-upload') || null;
        this.audioUploadInput = this.form?.querySelector('#editor-audio-upload') || null;
        this.imagePreview = this.form?.querySelector('[data-preview="images"]') || null;
        this.videoPreview = this.form?.querySelector('[data-preview="videos"]') || null;
        this.pnjPreview = this.form?.querySelector('[data-preview="pnjs"]') || null;
        this.typeSelect = this.form?.querySelector('#editor-type') || null;
        this.imageDropZone = this.form?.querySelector('[data-drop-zone="image"]') || null;
        this.audioDropZone = this.form?.querySelector('[data-drop-zone="audio"]') || null;
        this.descriptionInput = this.form?.elements?.description || null;
        this.descriptionToolbar = this.form?.querySelector('[data-role="description-toolbar"]') || null;
        this.descriptionPreview = this.form?.querySelector('[data-preview="description-markdown"]') || null;
        this.descriptionPreviewBody = this.form?.querySelector('[data-role="description-preview-body"]') || null;
        this.descriptionPreviewEmpty = this.descriptionPreview?.querySelector('.markdown-preview-empty') || null;
        this.questEventsContainer = this.form?.querySelector('[data-role="quest-events"]') || null;
        this.questEventsList = this.form?.querySelector('[data-role="quest-events-list"]') || null;
        this.questEventsEmpty = this.form?.querySelector('[data-role="quest-events-empty"]') || null;
        this.questEventsDisabled = this.form?.querySelector('[data-role="quest-events-disabled"]') || null;
        this.questEventForm = this.form?.querySelector('[data-role="quest-event-form"]') || null;
        this.questEventSubmitButton = this.form?.querySelector('[data-action="quest-event-submit"]') || null;
        this.questEventError = this.form?.querySelector('.form-error[data-error-for="quest-events"]') || null;
        this.questEventQuestId = this.form?.querySelector('[data-role="quest-event-quest-id"]') || null;
        this.questEventStatus = this.form?.querySelector('[data-role="quest-event-status"]') || null;
        this.questEventMilestone = this.form?.querySelector('[data-role="quest-event-milestone"]') || null;
        this.questEventProgressCurrent = this.form?.querySelector('[data-role="quest-event-progress-current"]') || null;
        this.questEventProgressMax = this.form?.querySelector('[data-role="quest-event-progress-max"]') || null;
        this.questEventNote = this.form?.querySelector('[data-role="quest-event-note"]') || null;
        this.questEventCancelButton = this.form?.querySelector('[data-action="quest-event-cancel"]') || null;
        this.editingQuestEventId = null;

        this.callbacks = {
            onCreate,
            onUpdate,
            onDelete,
            onCreateQuestEvent,
            onUpdateQuestEvent,
            onDeleteQuestEvent
        };
        this.types = types || {};
        this.mode = 'create';
        this.currentContext = null;
        this.disallowedNames = new Set();
        this.boundKeyHandler = null;
        this.previousFocus = null;
        this.isOpen = false;
        this.questEvents = [];
        this.isSubmittingQuestEvent = false;
        if (this.descriptionPreviewBody) {
            this.descriptionPreviewBody.hidden = true;
        }
        this.descriptionToolbarButtons = this.descriptionToolbar ? Array.from(this.descriptionToolbar.querySelectorAll('[data-md]')) : [];

        this.updateDescriptionPreview();


        if (this.deleteButton) {
            this.deleteButton.hidden = true;
            this.deleteButton.disabled = true;
        }

        if (this.form) {
            this.registerEvents();
            this.renderTypeOptions();
        }
    }

    registerEvents() {
        if (this.descriptionInput) {
            this.descriptionInput.addEventListener('input', () => this.updateDescriptionPreview());
        }
        if (this.descriptionToolbarButtons && this.descriptionToolbarButtons.length) {
            this.descriptionToolbarButtons.forEach(button => {
                button.addEventListener('click', () => this.insertMarkdownSnippet(button.dataset.md || ''));
            });
        }

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

        if (this.uploadImageButton && this.imageUploadInput) {
            this.uploadImageButton.addEventListener('click', () => this.imageUploadInput.click());
        }

        if (this.uploadAudioButton && this.audioUploadInput) {
            this.uploadAudioButton.addEventListener('click', () => this.audioUploadInput.click());
        }

        if (this.questEventSubmitButton) {
            this.questEventSubmitButton.addEventListener('click', () => this.handleQuestEventSubmit());
        }
        if (this.questEventCancelButton) {
            this.questEventCancelButton.addEventListener('click', () => this.cancelQuestEventEdit());
        }

        if (this.imageUploadInput) {
            this.imageUploadInput.addEventListener('change', event => {
                const files = Array.from(event.target?.files || []);
                if (files.length) {
                    this.handleImageFiles(files);
                }
                event.target.value = '';
            });
        }

        if (this.audioUploadInput) {
            this.audioUploadInput.addEventListener('change', event => {
                const files = Array.from(event.target?.files || []);
                if (files.length) {
                    this.handleAudioFiles(files);
                }
                event.target.value = '';
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

        this.setupDropZone(this.imageDropZone, UPLOAD_TYPES.image);
        this.setupDropZone(this.audioDropZone, UPLOAD_TYPES.audio);

        if (this.deleteButton) {
            this.deleteButton.addEventListener('click', () => this.handleDelete());
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

    open({ mode = 'create', location = null, continent = '', disallowedNames = [], questEvents = [] } = {}) {
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
        this.questEvents = Array.isArray(questEvents) ? [...questEvents] : [];

        if (this.deleteButton) {
            const isEditMode = mode === 'edit';
            this.deleteButton.hidden = !isEditMode;
            this.deleteButton.disabled = !isEditMode;
            const name = this.currentContext?.originalName || '';
            const label = isEditMode && name
                ? `Supprimer ${name}`
                : 'Supprimer ce lieu';
            this.deleteButton.setAttribute('aria-label', label);
        }

        this.populateForm();
        this.resetErrors();
        this.updateImagePreview();
        this.updateVideoPreview();
        this.updatePnjPreview();
        this.updateQuestEventsSection();

        if (this.headerTitle) {
            this.headerTitle.textContent = mode === 'edit' ? 'Modifier un lieu' : 'Creer un lieu';
        }
        if (this.submitButton) {
            this.submitButton.textContent = mode === 'edit' ? 'Enregistrer' : 'Creer';
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
        if (this.deleteButton) {
            this.deleteButton.disabled = true;
            this.deleteButton.hidden = true;
            this.deleteButton.removeAttribute('aria-label');
        }
        this.isOpen = false;
        this.currentContext = null;
        this.disallowedNames.clear();
        this.questEvents = [];
        this.clearQuestEventForm();
        this.setQuestEventError('');
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
        if (this.descriptionInput) {
            this.descriptionInput.value = location.description || '';
            this.updateDescriptionPreview();
        }
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

    updateDescriptionPreview() {
        if (!this.descriptionPreview || !this.descriptionInput) {
            return;
        }
        const value = this.descriptionInput.value || '';
        const html = renderMarkdown(value);
        if (!html.trim()) {
            if (this.descriptionPreviewBody) {
                this.descriptionPreviewBody.innerHTML = '';
                this.descriptionPreviewBody.hidden = true;
            } else {
                this.descriptionPreview.innerHTML = '';
            }
            if (this.descriptionPreviewEmpty) {
                this.descriptionPreviewEmpty.hidden = false;
                if (!this.descriptionPreview.contains(this.descriptionPreviewEmpty)) {
                    this.descriptionPreview.appendChild(this.descriptionPreviewEmpty);
                }
            }
            return;
        }
        if (this.descriptionPreviewEmpty) {
            this.descriptionPreviewEmpty.hidden = true;
        }
        if (this.descriptionPreviewBody) {
            this.descriptionPreviewBody.hidden = false;
            this.descriptionPreviewBody.innerHTML = html;
        } else {
            this.descriptionPreview.innerHTML = html;
        }
    }

    insertMarkdownSnippet(snippet) {
        if (!this.descriptionInput || !snippet) {
            return;
        }
        const textarea = this.descriptionInput;
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? start;
        const placeholderIndex = snippet.indexOf('|');
        let insertText = snippet;
        let caretPosition = start;
        if (placeholderIndex !== -1) {
            insertText = snippet.replace('|', '');
            caretPosition = start + placeholderIndex;
        } else {
            caretPosition = start + insertText.length;
        }
        const before = textarea.value.slice(0, start);
        const after = textarea.value.slice(end);
        textarea.value = before + insertText + after;
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = caretPosition;
        this.updateDescriptionPreview();
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    setQuestEvents(events = []) {
        this.questEvents = Array.isArray(events) ? [...events] : [];
        this.renderQuestEvents();
    }

    updateQuestEventsSection() {
        const locationName = this.getLocationName();
        const isEditMode = this.mode === 'edit' && Boolean(locationName);

        if (this.questEventsDisabled) {
            this.questEventsDisabled.hidden = isEditMode;
        }
        if (this.questEventsContainer) {
            this.questEventsContainer.hidden = !isEditMode;
        }
        if (this.questEventForm) {
            this.questEventForm.hidden = !isEditMode;
            const fields = this.questEventForm.querySelectorAll('input, textarea, select, button');
            fields.forEach(field => {
                field.disabled = !isEditMode;
            });
        }

        if (!isEditMode) {
            this.clearQuestEventForm();
            this.setQuestEventError('');
        }
        this.renderQuestEvents();
    }

    renderQuestEvents() {
        if (!this.questEventsList) {
            return;
        }
        clearElement(this.questEventsList);
        const events = Array.isArray(this.questEvents) ? [...this.questEvents] : [];
        events.sort((eventA, eventB) => {
            const timeA = new Date(eventA?.updatedAt || eventA?.timestamp || eventA?.createdAt || 0).getTime();
            const timeB = new Date(eventB?.updatedAt || eventB?.timestamp || eventB?.createdAt || 0).getTime();
            return timeB - timeA;
        });

        if (this.questEventsEmpty) {
            this.questEventsEmpty.hidden = events.length > 0;
        }

        if (!events.length) {
            return;
        }

        events.forEach(event => {
            const questId = sanitizeText(event?.questId) || 'Quete';
            const status = sanitizeText(event?.status);
            const milestone = sanitizeText(event?.milestone);
            const progressLabel = formatQuestProgress(event?.progress);
            const timestamp = formatQuestTimestamp(event?.updatedAt || event?.timestamp || event?.createdAt);
            const note = sanitizeText(event?.note);

            const item = createElement('li', { className: 'quest-events-item', dataset: { eventId: event?.id || '' } });
            const header = createElement('div', { className: 'quest-events-item-header' });
            header.appendChild(createElement('span', { text: questId }));
            if (status) {
                header.appendChild(createElement('span', { className: 'quest-events-item-status', text: status }));
            }
            item.appendChild(header);

            const meta = createElement('div', { className: 'quest-events-item-meta' });
            const metaEntries = [];
            if (milestone) {
                metaEntries.push(`Jalon : ${milestone}`);
            }
            if (progressLabel) {
                metaEntries.push(`Progression : ${progressLabel}`);
            }
            if (timestamp) {
                metaEntries.push(timestamp);
            }
            metaEntries.forEach(entry => {
                meta.appendChild(createElement('span', { text: entry }));
            });
            if (metaEntries.length) {
                item.appendChild(meta);
            }

            if (note) {
                item.appendChild(createElement('p', {
                    className: 'quest-events-item-note',
                    text: note
                }));
            }

            const actions = createElement('div', { className: 'quest-events-item-actions' });
            const editButton = createElement('button', {
                className: 'secondary-button',
                text: 'Modifier',
                attributes: { type: 'button' }
            });
            editButton.addEventListener('click', () => this.loadQuestEventForEdit(event));
            actions.appendChild(editButton);

            if (typeof this.callbacks.onDeleteQuestEvent === 'function') {
                const deleteButton = createElement('button', {
                    className: 'danger-button',
                    text: 'Supprimer',
                    attributes: { type: 'button' }
                });
                deleteButton.addEventListener('click', () => this.handleQuestEventDelete(event));
                actions.appendChild(deleteButton);
            }
            item.appendChild(actions);

            this.questEventsList.appendChild(item);
        });
    }

    loadQuestEventForEdit(event) {
        if (!event || !event.id) {
            return;
        }
        this.editingQuestEventId = event.id;
        if (this.questEventQuestId) {
            this.questEventQuestId.value = sanitizeText(event.questId);
        }
        if (this.questEventStatus) {
            this.questEventStatus.value = sanitizeText(event.status) || 'en cours';
        }
        if (this.questEventMilestone) {
            this.questEventMilestone.value = sanitizeText(event.milestone);
        }
        if (this.questEventProgressCurrent) {
            this.questEventProgressCurrent.value = event.progress && Number.isFinite(event.progress.current) ? event.progress.current : '';
        }
        if (this.questEventProgressMax) {
            this.questEventProgressMax.value = event.progress && Number.isFinite(event.progress.max) ? event.progress.max : '';
        }
        if (this.questEventNote) {
            this.questEventNote.value = sanitizeText(event.note);
        }
        if (this.questEventSubmitButton) {
            this.questEventSubmitButton.textContent = 'Mettre a jour l\'evenement';
        }
        if (this.questEventCancelButton) {
            this.questEventCancelButton.hidden = false;
        }
        this.setQuestEventError('');
    }

    cancelQuestEventEdit() {
        this.clearQuestEventForm();
        this.setQuestEventError('');
    }

    async handleQuestEventDelete(event) {
        if (!event?.id || typeof this.callbacks.onDeleteQuestEvent !== 'function') {
            return;
        }
        const confirmed = window.confirm('Supprimer cet evenement de quete ?');
        if (!confirmed) {
            return;
        }
        try {
            await this.callbacks.onDeleteQuestEvent(event.id);
            this.questEvents = Array.isArray(this.questEvents) ? this.questEvents.filter(item => item?.id !== event.id) : [];
            this.renderQuestEvents();
            if (this.editingQuestEventId === event.id) {
                this.clearQuestEventForm();
            }
        } catch (error) {
            console.error('[quest-event] suppression impossible', error);
            this.setQuestEventError(error?.message || 'Suppression impossible.');
        }
    }

    clearQuestEventForm() {
        this.editingQuestEventId = null;
        if (this.questEventQuestId) {
            this.questEventQuestId.value = '';
        }
        if (this.questEventStatus) {
            this.questEventStatus.value = 'en cours';
        }
        if (this.questEventMilestone) {
            this.questEventMilestone.value = '';
        }
        if (this.questEventProgressCurrent) {
            this.questEventProgressCurrent.value = '';
        }
        if (this.questEventProgressMax) {
            this.questEventProgressMax.value = '';
        }
        if (this.questEventNote) {
            this.questEventNote.value = '';
        }
        if (this.questEventSubmitButton) {
            this.questEventSubmitButton.textContent = 'Enregistrer un evenement';
        }
        if (this.questEventCancelButton) {
            this.questEventCancelButton.hidden = true;
        }
    }

    setQuestEventError(message) {
        if (this.questEventError) {
            if (message) {
                this.questEventError.textContent = message;
                this.questEventError.hidden = false;
            } else {
                this.questEventError.textContent = '';
                this.questEventError.hidden = true;
            }
        }
    }

    getLocationName() {
        const formName = this.form?.elements?.name?.value;
        const fallback = this.currentContext?.originalName || this.currentContext?.location?.name || '';
        if (this.mode === 'edit' && fallback) {
            return sanitizeText(fallback);
        }
        return sanitizeText(formName || fallback);
    }    async handleQuestEventSubmit() {
        if (this.mode !== 'edit' || this.isSubmittingQuestEvent) {
            return;
        }
        const isEditing = Boolean(this.editingQuestEventId);
        const callback = isEditing ? this.callbacks.onUpdateQuestEvent : this.callbacks.onCreateQuestEvent;
        if (typeof callback !== 'function') {
            return;
        }

        const locationName = this.getLocationName();
        if (!locationName) {
            this.setQuestEventError('Impossible de determiner le lieu cible.');
            return;
        }

        const questId = sanitizeText(this.questEventQuestId?.value);
        if (!questId) {
            this.setQuestEventError('Identifiant de quete requis.');
            this.questEventQuestId?.focus();
            return;
        }

        const status = sanitizeText(this.questEventStatus?.value) || 'en cours';
        const milestone = sanitizeText(this.questEventMilestone?.value);
        const note = sanitizeText(this.questEventNote?.value);

        const progressCurrentRaw = sanitizeText(this.questEventProgressCurrent?.value);
        const progressMaxRaw = sanitizeText(this.questEventProgressMax?.value);

        let progress = null;
        if (progressCurrentRaw || progressMaxRaw) {
            const current = progressCurrentRaw ? Number(progressCurrentRaw) : null;
            const max = progressMaxRaw ? Number(progressMaxRaw) : null;
            if (progressCurrentRaw && !Number.isFinite(current)) {
                this.setQuestEventError('Progression actuelle invalide.');
                this.questEventProgressCurrent?.focus();
                return;
            }
            if (progressMaxRaw && !Number.isFinite(max)) {
                this.setQuestEventError('Progression maximale invalide.');
                this.questEventProgressMax?.focus();
                return;
            }
            progress = {
                current: Number.isFinite(current) ? current : null,
                max: Number.isFinite(max) ? max : null
            };
        }

        this.setQuestEventError('');
        this.isSubmittingQuestEvent = true;
        if (this.questEventSubmitButton) {
            this.questEventSubmitButton.disabled = true;
            this.questEventSubmitButton.textContent = isEditing ? 'Mise a jour...' : 'Enregistrement...';
        }

        try {
            const payload = {
                locationName,
                questId,
                status,
                milestone,
                progress,
                note
            };
            if (isEditing) {
                payload.id = this.editingQuestEventId;
            }
            const result = await callback(payload);
            this.clearQuestEventForm();
            this.setQuestEventError('');
            if (result?.event) {
                const next = Array.isArray(this.questEvents) ? this.questEvents.filter(evt => evt?.id !== result.event.id) : [];
                next.push(result.event);
                this.setQuestEvents(next);
            }
        } catch (error) {
            console.error('[quest-event] submit failed', error);
            this.setQuestEventError(error?.message || 'Impossible de traiter l\'evenement de quete.');
        } finally {
            this.isSubmittingQuestEvent = false;
            if (this.questEventSubmitButton) {
                this.questEventSubmitButton.disabled = false;
                this.questEventSubmitButton.textContent = isEditing ? 'Mettre a jour l\'evenement' : 'Enregistrer un evenement';
            }
        }
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
            this.showError('form', 'Merci de corriger les champs indiques avant de continuer.');
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
            errors.name = 'Un lieu avec ce nom existe deja.';
        } else if (this.mode === 'edit' && name.toLowerCase() !== (this.currentContext?.originalName || '').toLowerCase() && this.disallowedNames.has(name.toLowerCase())) {
            errors.name = 'Un lieu avec ce nom existe deja.';
        }

        if (!continent) {
            errors.continent = 'Le continent est obligatoire.';
        }

        if (!this.types[type]) {
            errors.type = 'Selectionnez un type valide.';
        }

        if (!Number.isFinite(x)) {
            errors.x = 'Coordonnee invalide.';
        }
        if (!Number.isFinite(y)) {
            errors.y = 'Coordonnee invalide.';
        }

        if (audio && !isValidUrl(audio)) {
            errors.audio = 'Lien audio invalide (URL ou chemin assets/).';
        }

        const images = this.collectImages();
        if (images.some(image => !isValidUrl(image))) {
            errors.images = 'Toutes les images doivent etre des URLs valides ou des chemins commençant par assets/.';
        }

        const videos = this.collectVideos();
        const invalidVideos = videos.filter(video => video.url && !isValidUrl(video.url));
        if (invalidVideos.length || videos.some(video => !video.url && video.title)) {
            errors.videos = 'Chaque video doit avoir une URL valide.';
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
                this.showError('name', 'Un lieu avec ce nom existe deja.');
            } else if (this.mode === 'edit' && value.toLowerCase() !== (this.currentContext?.originalName || '').toLowerCase() && this.disallowedNames.has(value.toLowerCase())) {
                this.showError('name', 'Un lieu avec ce nom existe deja.');
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
                this.showError('type', 'Selectionnez un type valide.');
            } else {
                this.clearError('type');
            }
        }
    }

    validateCoordinates() {
        const x = Number(this.form.elements.x.value);
        const y = Number(this.form.elements.y.value);
        if (!Number.isFinite(x)) {
            this.showError('x', 'Coordonnee invalide.');
        } else {
            this.clearError('x');
        }
        if (!Number.isFinite(y)) {
            this.showError('y', 'Coordonnee invalide.');
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
            this.showError('images', 'Chaque image doit etre une URL valide ou un chemin assets/.');
        } else {
            this.clearError('images');
        }
    }

    async handleImageFiles(fileList) {
        const { accepted: files } = partitionFilesByType(Array.from(fileList || []), UPLOAD_TYPES.image);
        if (!files.length) {
            const formats = describeAllowedExtensions(UPLOAD_TYPES.image);
            this.showError('form', 'Aucune image valide detectee (formats acceptes : ' + formats + ').');
            return;
        }
        this.clearError('form');
        for (const file of files) {
            try {
                const uploadedPath = await this.processFileUpload(file, UPLOAD_TYPES.image);
                const emptyInput = Array.from(this.imageList?.querySelectorAll('input[data-role="image-input"]') || []).find(input => !input.value);
                if (emptyInput) {
                    emptyInput.value = uploadedPath;
                } else {
                    this.addImageField(uploadedPath);
                }
            } catch (error) {
                this.showError('form', error?.message || 'Erreur lors de l\'import de l\'image.');
                return;
            }
        }
        this.validateImages();
        this.updateImagePreview();
    }

    async handleAudioFiles(fileList) {
        const { accepted: files } = partitionFilesByType(Array.from(fileList || []), UPLOAD_TYPES.audio);
        if (!files.length) {
            const formats = describeAllowedExtensions(UPLOAD_TYPES.audio);
            this.showError('form', 'Aucun fichier audio valide (formats acceptes : ' + formats + ').');
            return;
        }
        const audioFile = files[0];
        try {
            const uploadedPath = await this.processFileUpload(audioFile, UPLOAD_TYPES.audio);
            if (this.form?.elements?.audio) {
                this.form.elements.audio.value = uploadedPath;
            }
            this.validateAudio();
            this.clearError('form');
        } catch (error) {
            this.showError('form', error?.message || 'Erreur lors de l\'import audio.');
        }
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Impossible de lire le fichier.'));
            reader.readAsDataURL(file);
        });
    }

    async processFileUpload(file, uploadType) {
        if (!file) {
            throw new Error('Fichier manquant.');
        }
        if (file.size > MAX_UPLOAD_SIZE) {
            throw new Error('Fichier trop volumineux (limite 15 Mo).');
        }
        const dataUrl = await this.readFileAsDataURL(file);
        let response;
        try {
            response = await fetch(UPLOAD_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: uploadType,
                    filename: file.name,
                    data: dataUrl
                })
            });
        } catch (error) {
            throw new Error('Serveur indisponible pendant le televersement.');
        }
        let payload = {};
        try {
            payload = await response.json();
        } catch (error) {
            // ignore
        }
        if (!response.ok || payload.status !== 'ok' || !payload.path) {
            throw new Error(payload?.message || 'Televersement echoue.');
        }
        return payload.path;
    }

    setupDropZone(element, type) {
        if (!element) {
            return;
        }
        let dragDepth = 0;
        const addHighlight = () => element.classList.add('is-drag-over');
        const removeHighlight = () => element.classList.remove('is-drag-over');
        const onDragEnter = event => {
            event.preventDefault();
            dragDepth += 1;
            addHighlight();
        };
        const onDragOver = event => {
            event.preventDefault();
        };
        const onDragLeave = event => {
            event.preventDefault();
            dragDepth = Math.max(dragDepth - 1, 0);
            if (dragDepth === 0) {
                removeHighlight();
            }
        };
        const onDrop = event => {
            event.preventDefault();
            dragDepth = 0;
            removeHighlight();
            const files = Array.from(event.dataTransfer?.files || []);
            if (!files.length) {
                return;
            }
            if (type === UPLOAD_TYPES.image) {
                this.handleImageFiles(files);
            } else if (type === UPLOAD_TYPES.audio) {
                this.handleAudioFiles(files);
            }
            event.dataTransfer?.clearData?.();
        };
        element.addEventListener('dragenter', onDragEnter);
        element.addEventListener('dragover', onDragOver);
        element.addEventListener('dragleave', onDragLeave);
        element.addEventListener('drop', onDrop);
    }

    handleDelete() {
        if (this.mode !== 'edit' || !this.currentContext) {
            return;
        }
        const originalName = this.currentContext.originalName || '';
        const confirmation = buildDeleteConfirmation(originalName);
        let confirmed = true;
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
            confirmed = window.confirm(confirmation);
        }
        if (!confirmed) {
            return;
        }
        if (typeof this.callbacks.onDelete === 'function') {
            this.callbacks.onDelete({
                continent: this.currentContext.continent || '',
                originalContinent: this.currentContext.continent || '',
                originalName: originalName
            });
        }
        this.close();
    }

    validateVideos() {
        const videos = this.collectVideos();
        if (!videos.length) {
            this.clearError('videos');
            return;
        }
        const hasInvalid = videos.some(video => video.url && !isValidUrl(video.url));
        if (hasInvalid) {
            this.showError('videos', 'Chaque video doit avoir une URL valide.');
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
            const empty = createElement('p', { className: 'preview-empty', text: 'Ajoutez une image pour la previsualiser.' });
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
            const empty = createElement('p', { className: 'preview-empty', text: 'Ajoutez une video pour la previsualiser.' });
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
                        title: video.title || 'Aperçu video',
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
            const empty = createElement('p', { className: 'preview-empty', text: 'Ajoutez un PNJ pour le previsualiser.' });
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
