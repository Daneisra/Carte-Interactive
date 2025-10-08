import { clearElement, createElement, qsa } from './dom.js';
import { getString } from '../i18n.js';

export class InfoPanel {
    constructor({
        sidebar,
        titleElement,
        descriptionElement,
        descriptionContainer,
        galleryElement,
        historySection,
        questsSection,
        pnjsSection,
        loreSection,
        audioManager,
        closeButton,
        tabsSelector = '.info-tab',
        tabContentSelector = '.info-content'
    }) {
        this.sidebar = sidebar;
        this.titleElement = titleElement;
        this.descriptionElement = descriptionElement;
        this.descriptionContainer = descriptionContainer;
        this.galleryElement = galleryElement;
        this.historySection = historySection;
        this.questsSection = questsSection;
        this.pnjsSection = pnjsSection;
        this.loreSection = loreSection;
        this.audioManager = audioManager;
        this.closeButton = closeButton;
        this.onClose = () => {};
        this.tabs = tabsSelector ? qsa(tabsSelector) : [];
        this.tabContents = tabContentSelector ? qsa(tabContentSelector) : [];
    }

    initialize({ onClose }) {
        this.onClose = typeof onClose === 'function' ? onClose : () => {};
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.close());
        }
        if (this.audioManager) {
            this.audioManager.initialize();
        }
        this.bindTabs();
    }

    show(entry) {
        if (!entry || !entry.location) {
            return;
        }
        const location = entry.location;

        if (this.titleElement) {
            this.titleElement.textContent = location.name;
        }
        if (this.descriptionElement) {
            this.descriptionElement.textContent = location.description || getString('info.noDescription');
        }

        this.renderSection(this.historySection, location.history, 'info.history');
        this.renderSection(this.questsSection, location.quests, 'info.quests');
        this.renderSection(this.loreSection, location.lore, 'info.lore');
        this.renderPnjsSection(location.pnjs);
        this.renderGallery(location);

        if (this.audioManager) {
            this.audioManager.update({ location });
        }

        if (this.sidebar) {
            this.setActiveTab('description');
            this.sidebar.style.display = 'block';
            this.sidebar.classList.add('open');
        }
    }

    bindTabs() {
        if (!this.tabs.length || !this.tabContents.length) {
            return;
        }
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab || 'description';
                this.setActiveTab(target);
            });
        });
    }

    setActiveTab(target) {
        this.tabs.forEach(tab => {
            const isActive = tab.dataset.tab === target;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-pressed', String(isActive));
        });
        this.tabContents.forEach(content => {
            const isMatch = content.id === `${target}-content`;
            content.classList.toggle('active', isMatch);
            content.setAttribute('aria-hidden', String(!isMatch));
        });
    }

    renderGallery(location) {
        if (!this.galleryElement) {
            return;
        }
        clearElement(this.galleryElement);
        let hasContent = false;

        if (Array.isArray(location.images)) {
            location.images
                .filter(src => typeof src === 'string' && src.trim())
                .forEach((src, index) => {
                    const img = createElement('img', {
                        className: 'gallery-image',
                        attributes: {
                            src,
                            alt: `${location.name} - image ${index + 1}`
                        }
                    });
                    img.addEventListener('error', () => img.remove());
                    this.galleryElement.appendChild(img);
                    hasContent = true;
                });
        }

        if (Array.isArray(location.videos)) {
            location.videos
                .filter(video => typeof video === 'string' && video.trim())
                .forEach(video => {
                    const link = createElement('a', {
                        className: 'gallery-video-link',
                        text: getString('info.watchVideo') || 'Voir la vidéo',
                        attributes: { href: video, target: '_blank', rel: 'noopener noreferrer' }
                    });
                    this.galleryElement.appendChild(link);
                    hasContent = true;
                });
        }

        if (!hasContent) {
            const empty = createElement('p', {
                className: 'gallery-empty',
                text: getString('info.noMedia') || 'Aucun média disponible'
            });
            this.galleryElement.appendChild(empty);
        }
    }

    renderSection(sectionElement, items, titleKey) {
        if (!sectionElement) {
            return;
        }
        clearElement(sectionElement);

        if (!items || !items.length) {
            sectionElement.hidden = true;
            return;
        }

        sectionElement.hidden = false;
        sectionElement.classList.add('extra-section');
        const title = createElement('h4', { text: getString(`${titleKey}.title`) });
        sectionElement.appendChild(title);

        const list = createElement('ul');
        items.forEach(item => {
            if (item) {
                const li = createElement('li', { text: String(item) });
                list.appendChild(li);
            }
        });
        sectionElement.appendChild(list);
    }

    renderPnjsSection(pnjs) {
        if (!this.pnjsSection) {
            return;
        }
        clearElement(this.pnjsSection);
        if (!pnjs || !pnjs.length) {
            this.pnjsSection.hidden = true;
            return;
        }
        this.pnjsSection.hidden = false;
        this.pnjsSection.classList.add('extra-section');
        const title = createElement('h4', { text: getString('info.pnjs.title') });
        this.pnjsSection.appendChild(title);
        const list = createElement('ul');
        pnjs.forEach(pnj => {
            const item = createElement('li');
            const name = createElement('strong', { text: pnj.name || getString('info.pnjs.unknown') });
            item.appendChild(name);
            if (pnj.role) {
                item.appendChild(document.createTextNode(` — ${pnj.role}`));
            }
            if (pnj.description) {
                const desc = createElement('p', { text: pnj.description });
                item.appendChild(desc);
            }
            list.appendChild(item);
        });
        this.pnjsSection.appendChild(list);
    }

    close() {
        if (this.sidebar) {
            this.sidebar.classList.remove('open');
            setTimeout(() => {
                if (this.sidebar) {
                    this.sidebar.style.display = 'none';
                }
            }, 250);
        }
        if (this.audioManager) {
            this.audioManager.stop();
        }
        this.onClose();
    }
}
