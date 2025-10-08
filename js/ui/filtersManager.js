import { getString } from '../i18n.js';

export class FiltersManager {
    constructor({
        state,
        searchInput,
        clearButton,
        typeSelect,
        resetButton,
        resultsBadge,
        onFiltersChanged
    }) {
        this.state = state;
        this.searchInput = searchInput;
        this.clearButton = clearButton;
        this.typeSelect = typeSelect;
        this.resetButton = resetButton;
        this.resultsBadge = resultsBadge;
        this.onFiltersChanged = typeof onFiltersChanged === 'function'
            ? onFiltersChanged
            : () => {};
    }

    initialize() {
        const filters = this.state.getFilters();
        if (this.searchInput) {
            this.searchInput.value = filters.text || '';
            this.searchInput.placeholder = getString('search.placeholder');
            this.searchInput.addEventListener('input', () => {
                this.state.setFilters({ text: this.searchInput.value });
                this.onFiltersChanged(this.state.getFilters());
            });
        }

        if (this.clearButton) {
            const label = getString('search.clearAria');
            this.clearButton.textContent = getString('icons.clear');
            this.clearButton.title = label;
            this.clearButton.setAttribute('aria-label', label);
            this.clearButton.addEventListener('click', () => {
                if (this.searchInput) {
                    this.searchInput.value = '';
                }
                this.state.setFilters({ text: '' });
                this.onFiltersChanged(this.state.getFilters());
            });
        }

        if (this.typeSelect) {
            this.typeSelect.value = filters.type || 'all';
            this.typeSelect.addEventListener('change', () => {
                this.state.setFilters({ type: this.typeSelect.value });
                this.onFiltersChanged(this.state.getFilters());
            });
        }

        if (this.resetButton) {
            const label = getString('filters.resetAria');
            this.resetButton.textContent = getString('icons.reset');
            this.resetButton.title = label;
            this.resetButton.setAttribute('aria-label', label);
            this.resetButton.addEventListener('click', () => {
                if (this.searchInput) {
                    this.searchInput.value = '';
                }
                if (this.typeSelect) {
                    this.typeSelect.value = 'all';
                }
                this.state.setFilters({ text: '', type: 'all' });
                this.onFiltersChanged(this.state.getFilters());
            });
        }
    }

    updateResults({ visibleCount, totalCount, filtersActive }) {
        if (!this.resultsBadge) {
            return;
        }
        const hasEntries = totalCount > 0;
        const visibleLabel = visibleCount === 1 ? getString('search.resultsSingle', { count: visibleCount }) : getString('search.resultsPlural', { count: visibleCount });
        const totalLabel = totalCount === 1 ? getString('search.resultsSingle', { count: totalCount }) : getString('search.resultsPlural', { count: totalCount });

        if (!hasEntries) {
            this.resultsBadge.textContent = getString('search.noResult');
            this.resultsBadge.dataset.state = 'empty';
            return;
        }

        if (filtersActive) {
            this.resultsBadge.textContent = getString(
                visibleCount === 1 ? 'search.resultsFilteredSingle' : 'search.resultsFilteredPlural',
                { visible: visibleCount, total: totalCount, totalLabel }
            );
            this.resultsBadge.dataset.state = 'filtered';
        } else {
            this.resultsBadge.textContent = visibleLabel;
            this.resultsBadge.dataset.state = 'all';
        }
    }
}
