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
const SESSIONS_URL = '/api/planning/sessions';
const DATED_AVAILABILITY_URL = '/api/planning/my-availability';
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
    monthGrid: document.getElementById('planning-month-grid'),
    agendaStatus: document.getElementById('planning-agenda-status'),
    agendaMonth: document.getElementById('planning-agenda-month'),
    agendaGrid: document.getElementById('planning-agenda-grid'),
    agendaList: document.getElementById('planning-agenda-list'),
    agendaPrev: document.getElementById('planning-month-prev'),
    agendaNext: document.getElementById('planning-month-next'),
    agendaToday: document.getElementById('planning-month-today'),
    datedStatus: document.getElementById('planning-dated-status'),
    datedForm: document.getElementById('planning-dated-form'),
    datedDate: document.getElementById('planning-dated-date'),
    datedStart: document.getElementById('planning-dated-start'),
    datedEnd: document.getElementById('planning-dated-end'),
    datedResponse: document.getElementById('planning-dated-response'),
    datedComment: document.getElementById('planning-dated-comment'),
    datedList: document.getElementById('planning-dated-list')
};

const state = {
    authenticated: false,
    username: 'Invite',
    timezone: resolveLocalTimezone(),
    slots: createAvailabilityStatusMatrix(),
    sessions: [],
    datedAvailability: [],
    agendaMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    summaryScopes: [],
    view: 'week',
    dirty: false,
    saving: false,
    datedSaving: false
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
const getAvailabilityChipClass = status => {
    if (status === AVAILABILITY_STATUS.BUSY) {
        return 'is-availability-busy';
    }
    if (status === AVAILABILITY_STATUS.MAYBE) {
        return 'is-availability-maybe';
    }
    return 'is-availability';
};
const setDatedStatus = (message, isError = false) => {
    if (!dom.datedStatus) {
        return;
    }
    dom.datedStatus.textContent = message;
    dom.datedStatus.classList.toggle('is-error', isError);
};
const setAgendaStatus = (message, isError = false) => {
    if (!dom.agendaStatus) {
        return;
    }
    dom.agendaStatus.textContent = message;
    dom.agendaStatus.classList.toggle('is-error', isError);
};
const formatDateKey = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
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
const formatFullDate = value => {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    try {
        return new Intl.DateTimeFormat('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(date);
    } catch (_error) {
        return value;
    }
};
const getSessionStatusLabel = status => {
    if (status === 'confirmed') {
        return 'Confirmee';
    }
    if (status === 'cancelled') {
        return 'Annulee';
    }
    return 'Candidate';
};
const getSessionStatusClass = status => {
    if (status === 'confirmed') {
        return 'is-confirmed';
    }
    if (status === 'cancelled') {
        return 'is-cancelled';
    }
    return 'is-candidate';
};
const getResponseSummaryText = summary => {
    const available = Number(summary?.available) || 0;
    const maybe = Number(summary?.maybe) || 0;
    const busy = Number(summary?.busy) || 0;
    return `${available} dispo / ${maybe} incertain / ${busy} indispo`;
};
const getPlanningInsightText = insight => {
    const dated = insight?.dated || {};
    const weekly = insight?.weekly || {};
    const signal = Number(dated.respondents) > 0 ? dated : weekly;
    const available = Number(signal.available) || 0;
    const maybe = Number(signal.maybe) || 0;
    const busy = Number(signal.busy) || 0;
    if (!insight || insight.quality === 'unknown') {
        return 'Pas assez de disponibilites pour evaluer ce creneau.';
    }
    return `${Number(dated.respondents) > 0 ? 'Disponibilites datees' : 'Creneau prevu'}: ${available} dispo / ${maybe} incertain / ${busy} conflit`;
};
const getBestSlotsText = insight => {
    const bestSlots = Array.isArray(insight?.bestSlots) ? insight.bestSlots : [];
    if (!bestSlots.length) {
        return 'Meilleurs creneaux: aucun signal pour le moment.';
    }
    const formatted = bestSlots.map(slot => (
        `${getDayLabel(slot.day)} ${getSlotLabel(slot.slot)} (${slot.available} dispo)`
    ));
    return `Meilleurs creneaux: ${formatted.join(', ')}`;
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

const getMonthDays = monthDate => {
    const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const start = new Date(firstOfMonth);
    start.setDate(firstOfMonth.getDate() - startOffset);
    return Array.from({ length: 42 }, (_entry, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        return date;
    });
};

const getSessionsForMonth = () => {
    const year = state.agendaMonth.getFullYear();
    const month = state.agendaMonth.getMonth();
    return state.sessions.filter(session => {
        const date = new Date(`${session.date}T00:00:00`);
        return !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month;
    });
};

const getDatedAvailabilityForMonth = () => {
    const year = state.agendaMonth.getFullYear();
    const month = state.agendaMonth.getMonth();
    return state.datedAvailability.filter(entry => {
        const date = new Date(`${entry.date}T00:00:00`);
        return !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month;
    });
};

const syncDatedForm = () => {
    const disabled = !state.authenticated || state.datedSaving;
    [
        dom.datedDate,
        dom.datedStart,
        dom.datedEnd,
        dom.datedResponse,
        dom.datedComment
    ].forEach(field => {
        if (field) {
            field.disabled = disabled;
        }
    });
    const button = dom.datedForm?.querySelector?.('button[type="submit"]');
    if (button) {
        button.disabled = disabled;
        button.textContent = state.datedSaving ? 'Sauvegarde...' : 'Ajouter ce creneau';
    }
};

const renderDatedAvailability = () => {
    syncDatedForm();
    if (!dom.datedList) {
        return;
    }
    if (!state.authenticated) {
        dom.datedList.replaceChildren(Object.assign(document.createElement('article'), {
            className: 'planning-dated-empty',
            textContent: 'Connectez-vous via Discord pour renseigner vos disponibilites datees.'
        }));
        return;
    }
    const entries = [...state.datedAvailability].sort((a, b) => (
        a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
    ));
    if (!entries.length) {
        dom.datedList.replaceChildren(Object.assign(document.createElement('article'), {
            className: 'planning-dated-empty',
            textContent: 'Aucune disponibilite datee enregistree.'
        }));
        return;
    }
    dom.datedList.replaceChildren(...entries.map(entry => {
        const item = document.createElement('article');
        item.className = `planning-dated-entry is-${entry.status || 'available'}`;
        const content = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = `${formatFullDate(entry.date)} - ${entry.startTime} a ${entry.endTime}`;
        const status = document.createElement('span');
        status.textContent = getStatusLabel(entry.status);
        const comment = document.createElement('small');
        comment.textContent = entry.comment || 'Sans note.';
        content.append(title, status, comment);
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'planning-dated-delete';
        deleteButton.dataset.availabilityId = entry.id;
        deleteButton.textContent = 'Supprimer';
        item.append(content, deleteButton);
        return item;
    }));
};

const renderAgenda = () => {
    if (!dom.agendaGrid || !dom.agendaList) {
        return;
    }
    setText(dom.agendaMonth, formatMonthTitle(state.agendaMonth));
    const month = state.agendaMonth.getMonth();
    const sessionsByDate = state.sessions.reduce((lookup, session) => {
        if (!lookup.has(session.date)) {
            lookup.set(session.date, []);
        }
        lookup.get(session.date).push(session);
        return lookup;
    }, new Map());
    const availabilityByDate = state.datedAvailability.reduce((lookup, entry) => {
        if (!lookup.has(entry.date)) {
            lookup.set(entry.date, []);
        }
        lookup.get(entry.date).push(entry);
        return lookup;
    }, new Map());
    const days = getMonthDays(state.agendaMonth);
    dom.agendaGrid.replaceChildren(...days.map(date => {
        const dateKey = formatDateKey(date);
        const daySessions = sessionsByDate.get(dateKey) || [];
        const dayAvailability = availabilityByDate.get(dateKey) || [];
        const item = document.createElement('article');
        item.className = 'planning-agenda-day';
        item.classList.toggle('is-outside-month', date.getMonth() !== month);
        item.classList.toggle('has-session', daySessions.length > 0);
        item.classList.toggle('has-availability', dayAvailability.length > 0);
        item.setAttribute('aria-label', `${formatFullDate(dateKey)} - ${daySessions.length} session${daySessions.length > 1 ? 's' : ''}, ${dayAvailability.length} disponibilite${dayAvailability.length > 1 ? 's' : ''}`);

        const label = document.createElement('strong');
        label.textContent = String(date.getDate());
        item.appendChild(label);

        daySessions.slice(0, 3).forEach(session => {
            const chip = document.createElement('span');
            chip.className = `planning-agenda-chip ${getSessionStatusClass(session.status)}`;
            chip.textContent = `${session.startTime || '--:--'} ${session.title}`;
            item.appendChild(chip);
        });
        dayAvailability.slice(0, Math.max(0, 3 - daySessions.length)).forEach(entry => {
            const chip = document.createElement('span');
            chip.className = `planning-agenda-chip ${getAvailabilityChipClass(entry.status)}`;
            chip.textContent = `${entry.startTime} Moi: ${getStatusLabel(entry.status)}`;
            item.appendChild(chip);
        });
        const hiddenCount = Math.max(0, (daySessions.length + dayAvailability.length) - 3);
        if (hiddenCount > 0) {
            const more = document.createElement('span');
            more.className = 'planning-agenda-more';
            more.textContent = `+${hiddenCount}`;
            item.appendChild(more);
        }
        return item;
    }));

    const monthSessions = getSessionsForMonth();
    if (!monthSessions.length) {
        dom.agendaList.replaceChildren(Object.assign(document.createElement('article'), {
            className: 'planning-agenda-empty',
            textContent: 'Aucune session candidate ou confirmee pour ce mois.'
        }));
        return;
    }
    dom.agendaList.replaceChildren(...monthSessions.map(session => {
        const item = document.createElement('article');
        item.className = `planning-agenda-session ${getSessionStatusClass(session.status)}`;
        const meta = document.createElement('span');
        meta.className = 'planning-agenda-session-meta';
        const duration = session.durationMinutes ? ` - ${session.durationMinutes} min` : '';
        meta.textContent = `${formatFullDate(session.date)} - ${session.startTime || '--:--'}${duration}`;
        const title = document.createElement('strong');
        title.textContent = session.title;
        const badge = document.createElement('span');
        badge.className = 'planning-agenda-session-badge';
        badge.textContent = getSessionStatusLabel(session.status);
        const description = document.createElement('p');
        description.textContent = session.description || 'Aucune description renseignee.';
        const group = document.createElement('small');
        group.textContent = session.groupName || session.groupId || 'Aucun groupe lie';
        const summary = document.createElement('span');
        summary.className = 'planning-agenda-response-summary';
        summary.textContent = getResponseSummaryText(session.responseSummary);
        const insight = document.createElement('div');
        insight.className = `planning-agenda-insight is-${session.planningInsight?.quality || 'unknown'}`;
        const insightText = document.createElement('span');
        insightText.textContent = getPlanningInsightText(session.planningInsight);
        const bestSlots = document.createElement('span');
        bestSlots.textContent = getBestSlotsText(session.planningInsight);
        insight.append(insightText, bestSlots);
        const actions = document.createElement('div');
        actions.className = 'planning-agenda-response-actions';
        actions.hidden = !state.authenticated;
        [
            { status: AVAILABILITY_STATUS.AVAILABLE, label: 'Disponible' },
            { status: AVAILABILITY_STATUS.MAYBE, label: 'Incertain' },
            { status: AVAILABILITY_STATUS.BUSY, label: 'Indisponible' }
        ].forEach(option => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.sessionId = session.id;
            button.dataset.responseStatus = option.status;
            button.textContent = option.label;
            actions.appendChild(button);
        });
        item.append(meta, title, badge, description, group, summary, insight, actions);
        return item;
    }));
};

const loadDatedAvailability = async () => {
    if (!state.authenticated) {
        state.datedAvailability = [];
        setDatedStatus('Connectez-vous pour renseigner vos disponibilites.', true);
        renderDatedAvailability();
        renderAgenda();
        return;
    }
    setDatedStatus('Chargement de vos disponibilites datees...');
    try {
        const response = await fetch(DATED_AVAILABILITY_URL, { credentials: 'include', cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        state.datedAvailability = Array.isArray(payload?.availability) ? payload.availability : [];
        setDatedStatus(state.datedAvailability.length
            ? `${state.datedAvailability.length} disponibilite${state.datedAvailability.length > 1 ? 's' : ''} chargee${state.datedAvailability.length > 1 ? 's' : ''}.`
            : 'Aucune disponibilite datee pour le moment.');
    } catch (error) {
        console.warn('[planning] dated availability unavailable', error);
        state.datedAvailability = [];
        setDatedStatus('Disponibilites datees indisponibles.', true);
    }
    renderDatedAvailability();
    renderAgenda();
};

const saveDatedAvailability = async event => {
    event?.preventDefault?.();
    if (!state.authenticated || state.datedSaving) {
        setDatedStatus('Connectez-vous via Discord pour renseigner vos disponibilites.', true);
        return;
    }
    const payload = {
        date: dom.datedDate?.value || '',
        startTime: dom.datedStart?.value || '',
        endTime: dom.datedEnd?.value || '',
        status: dom.datedResponse?.value || AVAILABILITY_STATUS.AVAILABLE,
        comment: dom.datedComment?.value || ''
    };
    state.datedSaving = true;
    syncDatedForm();
    setDatedStatus('Sauvegarde du creneau...');
    try {
        const response = await fetch(DATED_AVAILABILITY_URL, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const result = await response.json();
        state.datedAvailability = Array.isArray(result?.availability) ? result.availability : state.datedAvailability;
        if (dom.datedComment) {
            dom.datedComment.value = '';
        }
        setDatedStatus('Disponibilite datee enregistree.');
        renderDatedAvailability();
        renderAgenda();
        loadSessions();
    } catch (error) {
        console.error('[planning] dated availability save failed', error);
        setDatedStatus('Impossible d enregistrer ce creneau.', true);
    } finally {
        state.datedSaving = false;
        syncDatedForm();
    }
};

const deleteDatedAvailability = async id => {
    if (!state.authenticated || state.datedSaving || !id) {
        return;
    }
    state.datedSaving = true;
    syncDatedForm();
    setDatedStatus('Suppression du creneau...');
    try {
        const response = await fetch(DATED_AVAILABILITY_URL, {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const result = await response.json();
        state.datedAvailability = Array.isArray(result?.availability) ? result.availability : [];
        setDatedStatus('Disponibilite supprimee.');
        renderDatedAvailability();
        renderAgenda();
        loadSessions();
    } catch (error) {
        console.error('[planning] dated availability delete failed', error);
        setDatedStatus('Impossible de supprimer ce creneau.', true);
    } finally {
        state.datedSaving = false;
        syncDatedForm();
    }
};

const saveSessionResponse = async (sessionId, status) => {
    if (!state.authenticated || !sessionId || !status) {
        setAgendaStatus('Connectez-vous via Discord pour repondre a une session.', true);
        return;
    }
    setAgendaStatus('Sauvegarde de votre reponse...');
    try {
        const response = await fetch(`/api/planning/sessions/${encodeURIComponent(sessionId)}/response`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        const nextSession = payload?.session;
        if (nextSession?.id) {
            state.sessions = state.sessions.map(session => (
                session.id === nextSession.id ? nextSession : session
            ));
        }
        setAgendaStatus('Reponse enregistree.');
        renderAgenda();
    } catch (error) {
        console.warn('[planning] session response save failed', error);
        setAgendaStatus('Impossible d enregistrer votre reponse.', true);
    }
};

const loadSessions = async () => {
    setAgendaStatus('Chargement de l agenda...');
    try {
        const response = await fetch(SESSIONS_URL, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        state.sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
        setAgendaStatus(state.sessions.length
            ? `${state.sessions.length} session${state.sessions.length > 1 ? 's' : ''} chargee${state.sessions.length > 1 ? 's' : ''}.`
            : 'Aucune session candidate pour le moment.');
    } catch (error) {
        console.warn('[planning] sessions unavailable', error);
        state.sessions = [];
        setAgendaStatus('Agenda indisponible pour le moment.', true);
    }
    renderAgenda();
};

const shiftAgendaMonth = offset => {
    state.agendaMonth = new Date(state.agendaMonth.getFullYear(), state.agendaMonth.getMonth() + offset, 1);
    renderAgenda();
    renderDatedAvailability();
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
    renderAgenda();
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
if (dom.agendaPrev) {
    dom.agendaPrev.addEventListener('click', () => shiftAgendaMonth(-1));
}
if (dom.agendaNext) {
    dom.agendaNext.addEventListener('click', () => shiftAgendaMonth(1));
}
if (dom.agendaToday) {
    dom.agendaToday.addEventListener('click', () => {
        const today = new Date();
        state.agendaMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        renderAgenda();
        renderDatedAvailability();
    });
}
if (dom.agendaList) {
    dom.agendaList.addEventListener('click', event => {
        const button = event.target?.closest?.('[data-session-id][data-response-status]');
        if (!button || !dom.agendaList.contains(button)) {
            return;
        }
        saveSessionResponse(button.dataset.sessionId, button.dataset.responseStatus);
    });
}
if (dom.datedForm) {
    dom.datedForm.addEventListener('submit', saveDatedAvailability);
}
if (dom.datedList) {
    dom.datedList.addEventListener('click', event => {
        const button = event.target?.closest?.('[data-availability-id]');
        if (!button || !dom.datedList.contains(button)) {
            return;
        }
        deleteDatedAvailability(button.dataset.availabilityId);
    });
}

if (dom.datedDate && !dom.datedDate.value) {
    dom.datedDate.value = formatDateKey(new Date());
}
if (dom.datedStart && !dom.datedStart.value) {
    dom.datedStart.value = '20:00';
}
if (dom.datedEnd && !dom.datedEnd.value) {
    dom.datedEnd.value = '23:00';
}

setText(dom.year, String(new Date().getFullYear()));
buildCalendar();
renderAgenda();
renderDatedAvailability();
setPlanningView('week');
syncSessionCard();
loadVersion();
loadSessions();
loadSession().then(() => {
    loadDatedAvailability();
    loadSummary();
});
