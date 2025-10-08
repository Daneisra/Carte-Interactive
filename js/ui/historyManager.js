export class HistoryManager {
    constructor({ container, listElement, backButton }) {
        this.container = container;
        this.listElement = listElement;
        this.backButton = backButton;
        this.stack = [];
        this.onSelect = () => {};
    }

    initialize({ onSelect }) {
        this.onSelect = typeof onSelect === 'function' ? onSelect : () => {};
        if (this.backButton) {
            this.backButton.addEventListener('click', () => this.goBack());
        }
        this.render();
    }

    push(entry) {
        if (!entry) {
            return;
        }
        if (this.stack.length && this.stack[this.stack.length - 1].locationName === entry.locationName) {
            this.stack[this.stack.length - 1] = entry;
        } else {
            this.stack.push(entry);
        }
        this.render();
    }

    goBack() {
        if (this.stack.length <= 1) {
            return;
        }
        this.stack.pop();
        const previous = this.stack[this.stack.length - 1];
        if (previous) {
            this.onSelect(previous);
        }
        this.render();
    }

    render() {
        if (this.listElement) {
            this.listElement.innerHTML = '';
            this.stack.forEach((item, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'history-item';
                button.textContent = item.locationName;
                button.disabled = index === this.stack.length - 1;
                button.addEventListener('click', () => this.onSelect(item));
                this.listElement.appendChild(button);
            });
        }
        if (this.container) {
            this.container.hidden = this.stack.length === 0;
        }
        if (this.backButton) {
            this.backButton.disabled = this.stack.length <= 1;
        }
    }
}
