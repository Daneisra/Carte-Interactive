import {
    AVAILABILITY_DAYS,
    AVAILABILITY_SLOTS,
    AVAILABILITY_STATUS,
    AVAILABILITY_STATUS_OPTIONS,
    createAvailabilityStatusMatrix,
    normalizeAvailabilityStatusPayload,
    resolveLocalTimezone
} from './ui/availability.mjs';

const SITE_CONFIG_URL = '/assets/site-config.json';
const SESSION_URL = '/auth/session';
const PROFILE_URL = '/api/profile';
const SUMMARY_URL = '/api/planning/availability-summary';

const dom = {
    year: document.getElementById('planning-year'),
    version: document.getElementById('planning-version'),
    status: document.getElementById('planning-status'),
    profileName: document.getElementById('planning-profile-name'),
    timezone: document.getElementById('planning-timezone'),
    login: document.getElementById('planning-login'),
    calendar: document.getElementById('planning-calendar'),
    save: document.getElementById('planning-save'),
    clear: document.getElementById('planning-clear'),
    summaryStatus: document.getElementById('planning-summary-status'),
    scope: document.getElementById('planning-scope'),
    bestSlots: document.getElementById('planning-best-slots'),
    viewWeek: document.getElementById('planning-view-week'),
    viewMonth: document.getElementById('planning-view-month'),
    weekView: document.getElementById('planning-week-view'),
    monthView: document.getElementById('planning-month-view'),
    monthTitle: document.getElementById('planning-month-title'),
    monthGrid: document.getElementById('planning-month-grid')
};

const state = {
    authenticated: false,
    username: 'Invite',
    timezone: resolveLocalTimezone(),
    slots: createAvailabilityStatusMatrix(),
    summaryScopes: [],
    view: 'week',
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

const setSummaryStatus = (message, isError = false) => {
    if (!dom.summaryStatus) {
        return;
    }
    dom.summaryStatus.textContent = message;
    dom.summaryStatus.classList.toggle('is-error', isError);
};

const getDayLabel = dayId => AVAILABILITY_DAYS.find(day => day.id === dayId)?.label || dayId;
const getSlotLabel = slotId => AVAILABILITY_SLOTS.find(slot => slot.id === slotId)?.label || slotId;
const getStatusLabel = status => AVAILABILITY_STATUS_OPTIONS.find(option => option.id === status)?.label || 'Non renseigne';
const formatMonthDate = date => {
    try {
        return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
    } catch (_error) {
        return `${date.getDate()}/${date.getMonth() + 1}`;
    }
};
const formatMonthTitle = date => {
    try {
        return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);
    } catch (_error) {
        return `${date.getMonth() + 1}/${date.getFullYear()}`;
    }
};
const getNextStatus = status => {
    if (!status) {
        return AVAILABILITY_STATUS.AVAILABLE;
    }
    if (status === AVAILABILITY_STATUS.AVAILABLE) {
        return AVAILABILITY_STATUS.MAYBE;
    }
    if (status === AVAILABILITY_STATUS.MAYBE) {
        return AVAILABILITY_STATUS.BUSY;
    }
    return null;
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
        state.slots[dayIndex][slotIndex] = getNextStatus(state.slots[dayIndex][slotIndex]);
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
        const status = state.slots?.[dayIndex]?.[slotIndex] || null;
        button.classList.toggle('planning-slot-available', status === AVAILABILITY_STATUS.AVAILABLE);
        button.classList.toggle('planning-slot-maybe', status === AVAILABILITY_STATUS.MAYBE);
        button.classList.toggle('planning-slot-busy', status === AVAILABILITY_STATUS.BUSY);
        button.classList.toggle('planning-slot-empty', !status);
        button.setAttribute('aria-pressed', String(Boolean(status)));
        button.setAttribute('aria-label', `${button.getAttribute('aria-label')?.split(':')[0] || ''}: ${getStatusLabel(status)}`);
        button.disabled = state.saving;
        button.textContent = status ? getStatusLabel(status) : '--';
    });
    renderMonthView();
};

const renderMonthView = () => {
    if (!dom.monthGrid) {
        return;
    }
    const today = new Date();
    const days = [];
    for (let offset = 0; offset < 35; offset += 1) {
        const date = new Date(today);
        date.setDate(today.getDate() + offset);
        days.push(date);
    }
    setText(dom.monthTitle, `Projection ${formatMonthTitle(today)}`);
    dom.monthGrid.replaceChildren(...days.map(date => {
        const dayIndex = (date.getDay() + 6) % 7;
        const daySlots = state.slots?.[dayIndex] || [];
        const item = document.createElement('article');
        item.className = 'planning-month-day';
        const title = document.createElement('strong');
        title.textContent = formatMonthDate(date);
        const weekday = document.createElement('small');
        weekday.textContent = getDayLabel(AVAILABILITY_DAYS[dayIndex]?.id || '');
        const tags = document.createElement('div');
        tags.className = 'planning-month-tags';
        daySlots.forEach((status, slotIndex) => {
            if (!status) {
                return;
            }
            const tag = document.createElement('span');
            tag.className = `planning-month-tag planning-month-tag-${status}`;
            tag.textContent = `${getSlotLabel(AVAILABILITY_SLOTS[slotIndex]?.id || '')}: ${getStatusLabel(status)}`;
            tags.appendChild(tag);
        });
        if (!tags.childElementCount) {
            const empty = document.createElement('span');
            empty.className = 'planning-month-tag';
            empty.textContent = 'Non renseigne';
            tags.appendChild(empty);
        }
        item.append(title, weekday, tags);
        return item;
    }));
};

const setPlanningView = view => {
    state.view = view === 'month' ? 'month' : 'week';
    const isMonth = state.view === 'month';
    if (dom.weekView) {
        dom.weekView.hidden = isMonth;
    }
    if (dom.monthView) {
        dom.monthView.hidden = !isMonth;
    }
    if (dom.viewWeek) {
        dom.viewWeek.classList.toggle('is-active', !isMonth);
        dom.viewWeek.setAttribute('aria-selected', String(!isMonth));
    }
    if (dom.viewMonth) {
        dom.viewMonth.classList.toggle('is-active', isMonth);
        dom.viewMonth.setAttribute('aria-selected', String(isMonth));
    }
    renderMonthView();
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
        const normalized = normalizeAvailabilityStatusPayload(session?.availability, state.timezone);
        state.timezone = normalized?.timezone || state.timezone || resolveLocalTimezone();
        state.slots = normalized?.slots || createAvailabilityStatusMatrix();
        state.dirty = false;
        setStatus(state.authenticated
            ? 'Cochez les creneaux ou vous etes disponible, puis enregistrez.'
            : 'Connectez-vous via Discord pour renseigner vos disponibilites.',
        !state.authenticated);
    } catch (error) {
        console.warn('[planning] session unavailable', error);
        state.authenticated = false;
        state.slots = createAvailabilityStatusMatrix();
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
        const normalized = normalizeAvailabilityStatusPayload(payload?.profile?.availability, state.timezone);
        if (normalized) {
            state.timezone = normalized.timezone || state.timezone;
            state.slots = normalized.slots;
        }
        state.dirty = false;
        setStatus('Disponibilites enregistrees.');
        renderCalendar();
        loadSummary();
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
    state.slots = createAvailabilityStatusMatrix();
    state.dirty = true;
    setStatus('Semaine vide. Enregistrez pour confirmer.');
    renderCalendar();
    syncActions();
};

const renderSummary = () => {
    if (!dom.scope || !dom.bestSlots) {
        return;
    }
    const requestedScopeId = dom.scope.value;
    dom.scope.replaceChildren(...state.summaryScopes.map(scope => {
        const option = document.createElement('option');
        option.value = scope.id;
        option.textContent = scope.kind === 'group' ? `Groupe - ${scope.label}` : scope.label;
        return option;
    }));
    dom.scope.disabled = !state.authenticated || state.summaryScopes.length <= 1;
    const selected = state.summaryScopes.find(scope => scope.id === requestedScopeId) || state.summaryScopes[0] || null;
    if (!selected) {
        dom.bestSlots.replaceChildren(Object.assign(document.createElement('article'), {
            className: 'planning-best-empty',
            textContent: state.authenticated ? 'Aucune synthese disponible.' : 'Connectez-vous pour charger la synthese.'
        }));
        return;
    }
    dom.scope.value = selected.id;
    if (!Array.isArray(selected.best) || !selected.best.length) {
        dom.bestSlots.replaceChildren(Object.assign(document.createElement('article'), {
            className: 'planning-best-empty',
            textContent: `${selected.label}: aucun creneau commun renseigne.`
        }));
        return;
    }
    dom.bestSlots.replaceChildren(...selected.best.map(slot => {
        const item = document.createElement('article');
        item.className = 'planning-best-slot';
        const title = document.createElement('strong');
        title.textContent = `${getDayLabel(slot.day)} - ${getSlotLabel(slot.slot)}`;
        const detail = document.createElement('span');
        detail.textContent = `${selected.label} - ${selected.respondents} repondant${selected.respondents > 1 ? 's' : ''}`;
        const count = document.createElement('span');
        count.className = 'planning-best-slot-count';
        count.textContent = `${slot.count} dispo`;
        item.append(title, detail, count);
        return item;
    }));
};

const loadSummary = async () => {
    if (!state.authenticated) {
        state.summaryScopes = [];
        setSummaryStatus('Connectez-vous pour charger la synthese.', true);
        renderSummary();
        return;
    }
    setSummaryStatus('Chargement des creneaux communs...');
    try {
        const response = await fetch(SUMMARY_URL, { credentials: 'include', cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        state.summaryScopes = Array.isArray(payload?.scopes) ? payload.scopes : [];
        const scopeCount = state.summaryScopes.length;
        setSummaryStatus(scopeCount
            ? `${scopeCount} synthese${scopeCount > 1 ? 's' : ''} chargee${scopeCount > 1 ? 's' : ''}.`
            : 'Aucun creneau commun disponible.');
    } catch (error) {
        console.warn('[planning] availability summary unavailable', error);
        state.summaryScopes = [];
        setSummaryStatus('Synthese indisponible pour le moment.', true);
    }
    renderSummary();
};

if (dom.scope) {
    dom.scope.addEventListener('change', renderSummary);
}

if (dom.save) {
    dom.save.addEventListener('click', saveAvailability);
}
if (dom.clear) {
    dom.clear.addEventListener('click', clearAvailability);
}
if (dom.viewWeek) {
    dom.viewWeek.addEventListener('click', () => setPlanningView('week'));
}
if (dom.viewMonth) {
    dom.viewMonth.addEventListener('click', () => setPlanningView('month'));
}

setText(dom.year, String(new Date().getFullYear()));
buildCalendar();
setPlanningView('week');
syncSessionCard();
loadVersion();
loadSession().then(loadSummary);
