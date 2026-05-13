import {
    AVAILABILITY_DAYS,
    AVAILABILITY_SLOTS,
    createAvailabilityMatrix,
    normalizeAvailabilityPayload,
    resolveLocalTimezone
} from './ui/availability.mjs';

const SITE_CONFIG_URL = '/assets/site-config.json';
const SESSION_URL = '/auth/session';
const PROFILE_URL = '/api/profile';

const dom = {
    year: document.getElementById('planning-year'),
    version: document.getElementById('planning-version'),
    status: document.getElementById('planning-status'),
    profileName: document.getElementById('planning-profile-name'),
    timezone: document.getElementById('planning-timezone'),
    login: document.getElementById('planning-login'),
    calendar: document.getElementById('planning-calendar'),
    save: document.getElementById('planning-save'),
    clear: document.getElementById('planning-clear')
};

const state = {
    authenticated: false,
    username: 'Invite',
    timezone: resolveLocalTimezone(),
    slots: createAvailabilityMatrix(),
    dirty: false,
    saving: false
};

const setText = (node, value) => {
    if (node) {
        node.textContent = value;
    }
};

const setStatus = (message, isError = false) => {
    if (!dom.status) {
        return;
    }
    dom.status.textContent = message;
    dom.status.classList.toggle('is-error', isError);
};

const getAvailabilityFromState = () => ({
    timezone: state.timezone || resolveLocalTimezone(),
    slots: state.slots
});

const syncActions = () => {
    if (dom.save) {
        dom.save.disabled = !state.authenticated || state.saving || !state.dirty;
    }
    if (dom.clear) {
        dom.clear.disabled = !state.authenticated || state.saving;
    }
    if (dom.login) {
        dom.login.hidden = state.authenticated;
    }
};

const syncSessionCard = () => {
    setText(dom.profileName, state.authenticated ? state.username : 'Invite');
    setText(dom.timezone, state.timezone || '--');
    syncActions();
};

const buildCalendar = () => {
    if (!dom.calendar || dom.calendar.dataset.ready === 'true') {
        return;
    }
    const header = document.createElement('div');
    header.className = 'planning-calendar-row planning-calendar-head';
    header.setAttribute('role', 'row');
    header.appendChild(Object.assign(document.createElement('span'), { textContent: 'Jour' }));
    header.lastElementChild.setAttribute('role', 'columnheader');
    AVAILABILITY_SLOTS.forEach(slot => {
        const cell = document.createElement('span');
        cell.setAttribute('role', 'columnheader');
        cell.textContent = slot.label;
        cell.title = slot.range ? `${slot.label} (${slot.range})` : slot.label;
        header.appendChild(cell);
    });
    dom.calendar.appendChild(header);

    AVAILABILITY_DAYS.forEach((day, dayIndex) => {
        const row = document.createElement('div');
        row.className = 'planning-calendar-row';
        row.setAttribute('role', 'row');

        const label = document.createElement('strong');
        label.setAttribute('role', 'rowheader');
        label.textContent = day.label;
        row.appendChild(label);

        AVAILABILITY_SLOTS.forEach((slot, slotIndex) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'planning-slot planning-slot-empty';
            button.setAttribute('role', 'cell');
            button.setAttribute('aria-pressed', 'false');
            button.setAttribute('aria-label', `${day.label} ${slot.label}`);
            button.dataset.dayIndex = String(dayIndex);
            button.dataset.slotIndex = String(slotIndex);
            button.title = slot.range ? `${slot.label} (${slot.range})` : slot.label;
            button.textContent = '--';
            row.appendChild(button);
        });

        dom.calendar.appendChild(row);
    });

    dom.calendar.addEventListener('click', event => {
        const button = event.target?.closest?.('.planning-slot');
        if (!button || !dom.calendar.contains(button)) {
            return;
        }
        if (!state.authenticated) {
            setStatus('Connectez-vous via Discord pour renseigner vos disponibilites.', true);
            return;
        }
        const dayIndex = Number(button.dataset.dayIndex);
        const slotIndex = Number(button.dataset.slotIndex);
        if (!Number.isFinite(dayIndex) || !Number.isFinite(slotIndex) || !state.slots[dayIndex]) {
            return;
        }
        state.slots[dayIndex][slotIndex] = !state.slots[dayIndex][slotIndex];
        state.dirty = true;
        setStatus('Modifications en attente.');
        renderCalendar();
        syncActions();
    });

    dom.calendar.dataset.ready = 'true';
};

const renderCalendar = () => {
    buildCalendar();
    if (!dom.calendar) {
        return;
    }
    dom.calendar.classList.toggle('is-disabled', !state.authenticated);
    dom.calendar.querySelectorAll('.planning-slot').forEach(button => {
        const dayIndex = Number(button.dataset.dayIndex);
        const slotIndex = Number(button.dataset.slotIndex);
        const active = Boolean(state.slots?.[dayIndex]?.[slotIndex]);
        button.classList.toggle('planning-slot-available', active);
        button.classList.toggle('planning-slot-empty', !active);
        button.setAttribute('aria-pressed', String(active));
        button.disabled = state.saving;
        button.textContent = active ? 'Dispo' : '--';
    });
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

const loadSession = async () => {
    try {
        const response = await fetch(SESSION_URL, { credentials: 'include', cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const session = await response.json();
        state.authenticated = Boolean(session?.authenticated);
        state.username = session?.username || 'Invite';
        const normalized = normalizeAvailabilityPayload(session?.availability, state.timezone);
        state.timezone = normalized?.timezone || state.timezone || resolveLocalTimezone();
        state.slots = normalized?.slots || createAvailabilityMatrix();
        state.dirty = false;
        setStatus(state.authenticated
            ? 'Cochez les creneaux ou vous etes disponible, puis enregistrez.'
            : 'Connectez-vous via Discord pour renseigner vos disponibilites.',
        !state.authenticated);
    } catch (error) {
        console.warn('[planning] session unavailable', error);
        state.authenticated = false;
        state.slots = createAvailabilityMatrix();
        setStatus('Session indisponible. Reessayez plus tard.', true);
    }
    syncSessionCard();
    renderCalendar();
};

const saveAvailability = async () => {
    if (!state.authenticated || state.saving) {
        return;
    }
    state.saving = true;
    syncActions();
    setStatus('Sauvegarde des disponibilites...');
    try {
        const response = await fetch(PROFILE_URL, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ availability: getAvailabilityFromState() })
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        const normalized = normalizeAvailabilityPayload(payload?.profile?.availability, state.timezone);
        if (normalized) {
            state.timezone = normalized.timezone || state.timezone;
            state.slots = normalized.slots;
        }
        state.dirty = false;
        setStatus('Disponibilites enregistrees.');
        renderCalendar();
    } catch (error) {
        console.error('[planning] availability save failed', error);
        setStatus('Impossible d enregistrer les disponibilites.', true);
    } finally {
        state.saving = false;
        syncSessionCard();
        renderCalendar();
    }
};

const clearAvailability = () => {
    if (!state.authenticated || state.saving) {
        return;
    }
    state.slots = createAvailabilityMatrix();
    state.dirty = true;
    setStatus('Semaine vide. Enregistrez pour confirmer.');
    renderCalendar();
    syncActions();
};

if (dom.save) {
    dom.save.addEventListener('click', saveAvailability);
}
if (dom.clear) {
    dom.clear.addEventListener('click', clearAvailability);
}

setText(dom.year, String(new Date().getFullYear()));
buildCalendar();
syncSessionCard();
loadVersion();
loadSession();
