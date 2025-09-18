// Filter Bar Component
class FilterBar {
    constructor() {
        this.initializeFilters();
        this.attachEventListeners();
    }

    initializeFilters() {
        // Year Filter
        this.yearFilter = document.getElementById('yearFilter');
        this.drugTypeFilter = document.getElementById('drugTypeFilter');
        this.regionFilter = document.getElementById('regionFilter');
        
        filterManager.subscribe(this);
    }

    attachEventListeners() {
        this.yearFilter.addEventListener('change', (e) => {
            filterManager.updateFilter('year', e.target.value);
        });

        this.drugTypeFilter.addEventListener('change', (e) => {
            filterManager.updateFilter('drugType', e.target.value);
        });

        this.regionFilter.addEventListener('change', (e) => {
            filterManager.updateFilter('region', e.target.value);
        });
    }

    onFilterUpdate(filters) {
        // Update filter UI to reflect current state
        this.yearFilter.value = filters.year;
        this.drugTypeFilter.value = filters.drugType;
        this.regionFilter.value = filters.region;
    }
}