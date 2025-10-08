export class UiState {
    constructor({
        filters = { text: '', type: 'all' },
        favorites = [],
        theme = 'dark'
    } = {}) {
        this.filters = {
            text: (filters.text || '').trim().toLowerCase(),
            type: filters.type || 'all'
        };
        this.favorites = new Set(
            Array.isArray(favorites)
                ? favorites.filter(name => typeof name === 'string' && name.trim())
                : []
        );
        this.theme = theme === 'light' ? 'light' : 'dark';
        this.sidebarView = 'all';
        this.activeLocationName = null;
        this.mapState = null;
    }

    setFilters({ text, type }) {
        if (typeof text === 'string') {
            this.filters.text = text.trim().toLowerCase();
        }
        if (typeof type === 'string') {
            this.filters.type = type || 'all';
        }
    }

    getFilters() {
        return { ...this.filters };
    }

    setTheme(theme) {
        this.theme = theme === 'light' ? 'light' : 'dark';
    }

    addFavorite(name) {
        if (name && typeof name === 'string') {
            this.favorites.add(name);
        }
    }

    removeFavorite(name) {
        this.favorites.delete(name);
    }

    setFavorites(list) {
        this.favorites = new Set(
            Array.isArray(list)
                ? list.filter(name => typeof name === 'string' && name.trim())
                : []
        );
    }

    hasFavorite(name) {
        return this.favorites.has(name);
    }

    getFavorites() {
        return Array.from(this.favorites);
    }
}
