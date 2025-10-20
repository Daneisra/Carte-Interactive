const MAX_EVENTS = 60;

const formatTimestamp = isoString => {
    if (!isoString) {
        return '';
    }
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    const options = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    return date.toLocaleTimeString('fr-FR', options);
};

export class EventsFeed {
    constructor({
        container,
        listElement,
        filterSelect,
        emptyState
    } = {}) {
        this.container = container;
        this.listElement = listElement;
        this.filterSelect = filterSelect;
        this.emptyState = emptyState;

        this.events = [];
        this.filter = 'all';
        this.onDeleteAnnotation = () => {};
        this.canDeleteAnnotation = () => false;
        this.storageKey = 'interactive-map-events-filter';
    }

    initialize({ onDeleteAnnotation, canDeleteAnnotation } = {}) {
        if (typeof onDeleteAnnotation === 'function') {
            this.onDeleteAnnotation = onDeleteAnnotation;
        }
        if (typeof canDeleteAnnotation === 'function') {
            this.canDeleteAnnotation = canDeleteAnnotation;
        }

        if (this.filterSelect) {
            const persisted = this.readPersistedFilter();
            if (persisted) {
                this.filter = persisted;
                this.filterSelect.value = persisted;
            }
            this.filterSelect.addEventListener('change', () => {
                const value = this.filterSelect.value || 'all';
                this.setFilter(value);
            });
        }

        this.render();
    }

    readPersistedFilter() {
        try {
            const raw = window.localStorage?.getItem(this.storageKey);
            if (!raw) {
                return null;
            }
            return raw;
        } catch (error) {
            return null;
        }
    }

    persistFilter(value) {
        try {
            window.localStorage?.setItem(this.storageKey, value);
        } catch (error) {
            // storage might be disabled - ignore
        }
    }

    setFilter(filterValue) {
        this.filter = filterValue || 'all';
        this.persistFilter(this.filter);
        this.render();
    }

    setCanDeleteResolver(resolver) {
        if (typeof resolver === 'function') {
            this.canDeleteAnnotation = resolver;
            this.render();
        }
    }

    clear() {
        this.events = [];
        this.render();
    }

    addEvent(event) {
        if (!event || typeof event !== 'object') {
            return;
        }
        const entry = {
            id: event.id || `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            type: event.type || 'generic',
            title: event.title || 'Événement',
            description: event.description || '',
            timestamp: event.timestamp || new Date().toISOString(),
            annotationId: event.annotationId || null,
            questId: event.questId || null,
            meta: event.meta || {}
        };
        this.events.unshift(entry);
        if (this.events.length > MAX_EVENTS) {
            this.events.length = MAX_EVENTS;
        }
        this.render();
    }

    render() {
        if (!this.listElement) {
            return;
        }
        const events = this.events.filter(event => this.filter === 'all' || event.type === this.filter);

        this.listElement.innerHTML = '';

        const isEmpty = events.length === 0;
        if (this.emptyState) {
            this.emptyState.hidden = !isEmpty;
        }
        if (!this.container) {
            return;
        }
        if (isEmpty) {
            this.container.classList.toggle('is-empty', true);
            return;
        }
        this.container.classList.toggle('is-empty', false);

        events.forEach(event => {
            const item = document.createElement('li');
            item.className = `${event.type}-event`;

            const title = document.createElement('span');
            title.className = 'event-title';
            title.textContent = event.title;

            const time = document.createElement('span');
            time.className = 'event-time';
            time.textContent = formatTimestamp(event.timestamp);

            const description = document.createElement('p');
            description.className = 'event-description';
            description.textContent = event.description;

            const badge = document.createElement('span');
            badge.className = 'event-badge';
            badge.textContent = this.resolveBadgeLabel(event.type);

            item.appendChild(title);
            item.appendChild(time);
            item.appendChild(badge);
            item.appendChild(description);

            if (event.annotationId && this.canDeleteAnnotation?.()) {
                const actions = document.createElement('div');
                actions.className = 'event-actions';
                const deleteButton = document.createElement('button');
                deleteButton.type = 'button';
                deleteButton.textContent = 'Supprimer';
                deleteButton.addEventListener('click', () => {
                    this.onDeleteAnnotation?.(event.annotationId);
                });
                actions.appendChild(deleteButton);
                item.appendChild(actions);
            }

            this.listElement.appendChild(item);
        });
        if (this.listElement.scrollTo) {
            this.listElement.scrollTo({ top: 0 });
        } else {
            this.listElement.scrollTop = 0;
        }
    }

    resolveBadgeLabel(type) {
        switch (type) {
            case 'annotations':
            case 'annotation':
                return 'Annotation';
            case 'quests':
            case 'quest':
                return 'Quête';
            case 'sync':
                return 'Sync';
            default:
                return 'Info';
        }
    }
}
