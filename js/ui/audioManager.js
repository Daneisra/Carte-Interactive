import { getString } from '../i18n.js';

export class AudioManager {
    constructor({ player, titleElement, container, fallbackButton, statusElement }) {
        this.player = player;
        this.titleElement = titleElement;
        this.container = container;
        this.fallbackButton = fallbackButton;
        this.statusElement = statusElement;
        this.bound = false;
        this.playRequestId = 0;
    }

    initialize() {
        if (this.bound || !this.player) {
            return;
        }

        if (this.fallbackButton) {
            this.fallbackButton.textContent = getString('audio.fallbackButton');
            this.fallbackButton.addEventListener('click', () => {
                if (!this.player.src) {
                    return;
                }
                this.fallbackButton.disabled = true;
                const playback = this.player.play();
                if (playback && typeof playback.then === 'function') {
                    playback
                        .then(() => this.hideFallback())
                        .catch(() => this.showFallback(getString('audio.fallbackBlocked')))
                        .finally(() => {
                            this.fallbackButton.disabled = false;
                        });
                } else {
                    this.fallbackButton.disabled = false;
                }
            });
        }

        this.player.addEventListener('play', () => this.hideFallback());
        this.player.addEventListener('ended', () => this.hideFallback());
        this.player.addEventListener('error', () => this.showFallback(getString('audio.fallbackMissing')));

        this.bound = true;
    }

    update({ location }) {
        if (!this.player || !this.container || !this.titleElement) {
            return;
        }

        const requestId = ++this.playRequestId;

        if (!location || !location.audio) {
            this.player.removeAttribute('src');
            this.player.load();
            this.container.style.display = 'none';
            this.titleElement.textContent = `🎧 ${getString('audio.titleDefault')}`;
            this.hideFallback();
            return;
        }

        this.container.style.display = 'block';
        this.player.pause();
        this.player.currentTime = 0;
        this.player.src = location.audio;
        this.titleElement.textContent = `🎧 ${getString('audio.titleForLocation', { location: location.name })}`;
        this.player.load();
        this.hideFallback();
        this.tryAutoplay(requestId);
    }

    stop() {
        if (!this.player) {
            return;
        }
        this.playRequestId += 1;
        this.player.pause();
        this.player.currentTime = 0;
        this.player.removeAttribute('src');
        this.player.load();
        this.hideFallback();
    }

    showFallback(message) {
        if (this.fallbackButton) {
            this.fallbackButton.hidden = false;
            this.fallbackButton.disabled = false;
        }
        if (this.statusElement) {
            this.statusElement.hidden = false;
            this.statusElement.textContent = message || getString('audio.fallbackDefault');
        }
    }

    hideFallback() {
        if (this.fallbackButton) {
            this.fallbackButton.hidden = true;
        }
        if (this.statusElement) {
            this.statusElement.hidden = true;
            this.statusElement.textContent = '';
        }
    }

    tryAutoplay(requestId) {
        if (!this.player) {
            return;
        }

        const handleBlocked = error => {
            if (this.playRequestId !== requestId) {
                return;
            }
            if (error && error.name === 'AbortError') {
                return;
            }
            this.showFallback(getString('audio.fallbackBlocked'));
        };

        try {
            const playback = this.player.play();
            if (playback && typeof playback.then === 'function') {
                playback
                    .then(() => {
                        if (this.playRequestId === requestId) {
                            this.hideFallback();
                        }
                    })
                    .catch(handleBlocked);
            } else {
                this.hideFallback();
            }
        } catch (error) {
            handleBlocked(error);
        }
    }
}
