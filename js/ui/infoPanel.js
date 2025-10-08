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
        lightbox = null,
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
        this.lightbox = {
            container: lightbox?.container || null,
            image: lightbox?.image || null,
            caption: lightbox?.caption || null,
            closeButton: lightbox?.closeButton || null,
            previousFocus: null,
            ready: false
        };
        this.boundLightboxKeyHandler = null;
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
        this.setupLightbox();
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

    renderGallery(location) {
        if (!this.galleryElement) {
            return;
        }
        clearElement(this.galleryElement);
        let hasContent = false;
        const lightboxEnabled = Boolean(this.lightbox.container && this.lightbox.image);

        if (Array.isArray(location.images)) {
            location.images
                .filter(src => typeof src === 'string' && src.trim())
                .forEach((src, index) => {
                    const attributes = {
                        src,
                        alt: `${location.name} - image ${index + 1}`
                    };
                    if (lightboxEnabled) {
                        attributes.tabindex = '0';
                        attributes.role = 'button';
                        attributes['aria-label'] = `${location.name} - agrandir l'image ${index + 1}`;
                    }
                    const img = createElement('img', {
                        className: 'gallery-image',
                        attributes
                    });
                    img.addEventListener('error', () => img.remove());
                    if (lightboxEnabled) {
                        const open = () => this.openLightbox({
                            src,
                            alt: img.alt,
                            caption: location.name
                        });
                        img.addEventListener('click', open);
                        img.addEventListener('keydown', event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                open();
                            }
                        });
                    }
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
                        text: getString('info.watchVideo') || 'Voir la video',
                        attributes: { href: video, target: '_blank', rel: 'noopener noreferrer' }
                    });
                    this.galleryElement.appendChild(link);
                    hasContent = true;
                });
        }

        if (!hasContent) {
            const empty = createElement('p', {
                className: 'gallery-empty',
                text: getString('info.noMedia') || 'Aucun media disponible'
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
                item.appendChild(document.createTextNode(` - ${pnj.role}`));
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
        this.closeLightbox();
        this.onClose();
    }

    setupLightbox() {
        const { container, closeButton } = this.lightbox;
        if (!container || this.lightbox.ready) {
            return;
        }
        container.setAttribute('tabindex', '-1');
        container.addEventListener('click', event => {
            if (event.target === container) {
                this.closeLightbox();
            }
        });
        if (closeButton) {
            closeButton.addEventListener('click', () => this.closeLightbox());
        }
        this.lightbox.ready = true;
    }

    openLightbox({ src, alt, caption }) {
        const { container, image, caption: captionElement, closeButton } = this.lightbox;
        if (!container || !image) {
            return;
        }
        this.lightbox.previousFocus = document.activeElement;
        image.src = src;
        image.alt = alt || '';
        if (captionElement) {
            const text = caption || alt || '';
            captionElement.textContent = text;
            captionElement.hidden = !text;
        }
        container.hidden = false;
        container.classList.add('open');
        this.boundLightboxKeyHandler = event => {
            if (event.key === 'Escape') {
                this.closeLightbox();
            }
        };
        document.addEventListener('keydown', this.boundLightboxKeyHandler);
        (closeButton || container).focus?.();
    }

    closeLightbox() {
        const { container, image, caption } = this.lightbox;
        if (!container || container.hidden) {
            return;
        }
        container.classList.remove('open');
        container.hidden = true;
        if (image) {
            image.src = '';
            image.alt = '';
        }
        if (caption) {
            caption.textContent = '';
            caption.hidden = true;
        }
        if (this.boundLightboxKeyHandler) {
            document.removeEventListener('keydown', this.boundLightboxKeyHandler);
            this.boundLightboxKeyHandler = null;
        }
        this.lightbox.previousFocus?.focus?.();
        this.lightbox.previousFocus = null;
    }
}
