import { clearElement, createElement, qsa } from './dom.js';
import { getString } from '../i18n.js';
import { renderMarkdown } from './markdown.mjs';

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
        instancesSection,
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
        this.instancesSection = instancesSection;
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
        this.setupTabsAccessibility();
        this.setupLightbox();
    }

    bindTabs() {
        if (!this.tabs.length || !this.tabContents.length) {
            return;
        }
        this.tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab || 'description';
                this.setActiveTab(target);
            });
            tab.addEventListener('keydown', event => {
                this.handleTabKeydown(event, index);
            });
        });
    }

    setActiveTab(target) {
        this.tabs.forEach(tab => {
            const isActive = tab.dataset.tab === target;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
            tab.setAttribute('tabindex', isActive ? '0' : '-1');
        });
        this.tabContents.forEach(content => {
            const isMatch = content.id === `${target}-content`;
            content.classList.toggle('active', isMatch);
            content.setAttribute('aria-hidden', String(!isMatch));
            content.setAttribute('tabindex', isMatch ? '0' : '-1');
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
            this.descriptionElement.classList.add('markdown-content');
            const description = location.description || getString('info.noDescription');
            this.descriptionElement.innerHTML = renderMarkdown(description);
        }

        this.renderSection(this.historySection, location.history, 'info.history');
        this.renderSection(this.questsSection, location.quests, 'info.quests');
        this.renderSection(this.loreSection, location.lore, 'info.lore');
        this.renderSection(this.instancesSection, location.instances, 'info.instances', 'Instances');
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
            location.videos.forEach((videoEntry, index) => {
                const { element, url, title } = this.createVideoThumbnail({
                    videoEntry,
                    location,
                    index
                });

                if (element) {
                    this.galleryElement.appendChild(element);
                    hasContent = true;
                    return;
                }

                if (url) {
                    const watchLabel = title || getString('info.watchVideo') || 'Voir la vidéo';
                    const fallbackLink = createElement('a', {
                        className: 'gallery-video-link',
                        text: watchLabel,
                        attributes: { href: url, target: '_blank', rel: 'noopener noreferrer' }
                    });
                    this.galleryElement.appendChild(fallbackLink);
                    hasContent = true;
                }
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

    renderSection(sectionElement, items, titleKey, fallbackTitle = '') {
        if (!sectionElement) {
            return;
        }
        clearElement(sectionElement);

        const normalizedItems = Array.isArray(items) ? items : [items];
        const visibleItems = normalizedItems.filter(value => Boolean(value));
        if (!visibleItems.length) {
            sectionElement.hidden = true;
            return;
        }

        sectionElement.hidden = false;
        sectionElement.classList.add('extra-section');
        const localized = getString(`${titleKey}.title`);
        const titleText = localized && localized !== `${titleKey}.title`
            ? localized
            : (fallbackTitle || localized || '');
        const title = createElement('h4', { text: titleText });
        sectionElement.appendChild(title);

        const list = createElement('ul');
        visibleItems.forEach(item => {
            const li = createElement('li', { className: 'markdown-content' });
            li.innerHTML = renderMarkdown(item);
            list.appendChild(li);
        });
        sectionElement.appendChild(list);
    }

    setupTabsAccessibility() {
        if (!this.tabs.length || !this.tabContents.length) {
            return;
        }

        const tablist = this.tabs[0].parentElement;
        if (tablist) {
            tablist.setAttribute('role', 'tablist');
            const label = getString('info.tabsAriaLabel');
            if (label && label !== 'info.tabsAriaLabel') {
                tablist.setAttribute('aria-label', label);
            }
        }

        this.tabs.forEach(tab => {
            const tabId = tab.id || `info-tab-${tab.dataset.tab || ''}`;
            tab.id = tabId;
            tab.setAttribute('role', 'tab');
            const panelId = `${tab.dataset.tab || 'description'}-content`;
            tab.setAttribute('aria-controls', panelId);
        });

        this.tabContents.forEach(content => {
            const tabName = content.id.replace('-content', '');
            const controller = this.tabs.find(tab => tab.dataset.tab === tabName);
            if (controller) {
                content.setAttribute('role', 'tabpanel');
                content.setAttribute('aria-labelledby', controller.id);
            }
        });
    }

    handleTabKeydown(event, index) {
        switch (event.key) {
            case 'ArrowRight':
            case 'ArrowLeft': {
                event.preventDefault();
                const offset = event.key === 'ArrowRight' ? 1 : -1;
                this.focusTabByOffset(index, offset);
                break;
            }
            case 'Home':
                event.preventDefault();
                this.focusTab(0);
                break;
            case 'End':
                event.preventDefault();
                this.focusTab(this.tabs.length - 1);
                break;
            case 'Enter':
            case ' ': {
                event.preventDefault();
                const target = this.tabs[index]?.dataset.tab;
                if (target) {
                    this.setActiveTab(target);
                }
                break;
            }
            default:
                break;
        }
    }

    focusTabByOffset(currentIndex, offset) {
        if (!this.tabs.length) {
            return;
        }
        const count = this.tabs.length;
        const nextIndex = (currentIndex + offset + count) % count;
        this.focusTab(nextIndex);
    }

    focusTab(targetIndex) {
        const targetTab = this.tabs[targetIndex];
        if (!targetTab) {
            return;
        }
        const targetName = targetTab.dataset.tab || 'description';
        this.setActiveTab(targetName);
        targetTab.focus();
    }

    createVideoThumbnail({ videoEntry, location, index }) {
        const titles = Array.isArray(location.videoTitles) ? location.videoTitles : [];
        let url = '';
        let providedTitle = '';

        if (typeof videoEntry === 'string') {
            url = videoEntry.trim();
        } else if (videoEntry && typeof videoEntry === 'object') {
            if (typeof videoEntry.url === 'string') {
                url = videoEntry.url.trim();
            }
            if (typeof videoEntry.title === 'string') {
                providedTitle = videoEntry.title.trim();
            }
        }

        if (!url) {
            return { element: null, url: '', title: '' };
        }

        if (!providedTitle && typeof titles[index] === 'string') {
            providedTitle = titles[index].trim();
        }

        const videoId = InfoPanel.extractYoutubeId(url);
        const videoTitle = providedTitle || `${location.name} - vidéo ${index + 1}`;
        const watchLabel = getString('info.watchVideo') || 'Voir la vidéo';

        if (!videoId) {
            return { element: null, url, title: videoTitle };
        }

        const container = createElement('div', {
            className: 'gallery-video-container'
        });

        const link = createElement('a', {
            className: 'gallery-video',
            attributes: {
                href: url,
                target: '_blank',
                rel: 'noopener noreferrer',
                'aria-label': `${watchLabel} - ${videoTitle}`
            }
        });

        const thumbnail = createElement('img', {
            className: 'gallery-thumbnail',
            attributes: {
                src: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                alt: videoTitle
            }
        });

        link.appendChild(thumbnail);
        container.appendChild(link);

        container.appendChild(createElement('span', {
            className: 'gallery-video-title',
            text: videoTitle
        }));

        return { element: container, url, title: videoTitle };
    }

    static extractYoutubeId(url) {
        if (typeof url !== 'string') {
            return null;
        }

        try {
            const parsedUrl = new URL(url.trim());
            const host = parsedUrl.hostname.replace(/^www\./, '');
            const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);

            if (host === 'youtu.be') {
                return pathSegments[0] || null;
            }

            if (host === 'youtube.com' || host === 'm.youtube.com') {
                if (parsedUrl.pathname === '/watch') {
                    return parsedUrl.searchParams.get('v');
                }

                if (pathSegments[0] === 'embed' || pathSegments[0] === 'shorts' || pathSegments[0] === 'live') {
                    return pathSegments[1] || null;
                }
            }

            if (host.endsWith('youtube.com')) {
                const watchId = parsedUrl.searchParams.get('v');
                if (watchId) {
                    return watchId;
                }
            }
        } catch (error) {
            return null;
        }

        const match = url.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{6,})/);
        return match ? match[1] : null;
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
                const desc = createElement('p', { className: 'markdown-content' });
                desc.innerHTML = renderMarkdown(pnj.description);
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
