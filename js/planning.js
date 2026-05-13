const SITE_CONFIG_URL = '/assets/site-config.json';

const dom = {
    year: document.getElementById('planning-year'),
    version: document.getElementById('planning-version')
};

const setText = (node, value) => {
    if (node) {
        node.textContent = value;
    }
};

const loadVersion = async () => {
    try {
        const response = await fetch(SITE_CONFIG_URL, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const config = await response.json();
        if (config?.version) {
            setText(dom.version, config.version);
        }
    } catch (error) {
        console.warn('[planning] site config unavailable, keeping static version', error);
    }
};

setText(dom.year, String(new Date().getFullYear()));
loadVersion();
