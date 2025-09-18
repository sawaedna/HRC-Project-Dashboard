// Global Filter State Management
class GlobalFilterManager {
    constructor() {
        this.subscribers = new Set();
        this.currentFilters = {
            year: null,
            drugType: null,
            region: null,
            paymentType: null
        };
    }

    // Subscribe components to filter changes
    subscribe(component) {
        this.subscribers.add(component);
    }

    // Update filters and notify all components
    updateFilter(filterType, value) {
        this.currentFilters[filterType] = value;
        this.notifySubscribers();
    }

    // Notify all subscribed components of filter changes
    notifySubscribers() {
        this.subscribers.forEach(subscriber => {
            subscriber.onFilterUpdate(this.currentFilters);
        });
    }

    // Reset all filters
    resetFilters() {
        Object.keys(this.currentFilters).forEach(key => {
            this.currentFilters[key] = null;
        });
        this.notifySubscribers();
    }
}

export const filterManager = new GlobalFilterManager();
