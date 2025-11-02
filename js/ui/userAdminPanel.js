import { createElement, clearElement } from './dom.js';

const ROLE_LABELS = {
    admin: 'Administrateur',
    user: 'Utilisateur'
};

export class UserAdminPanel {
    constructor({
        container,
        onClose = null,
        fetchUsers = null,
        onAddUser = null,
        onUpdateUser = null,
        onDeleteUser = null
    } = {}) {
        this.container = container;
        this.onClose = onClose;
        this.fetchUsers = fetchUsers;
        this.onAddUser = onAddUser;
        this.onUpdateUser = onUpdateUser;
        this.onDeleteUser = onDeleteUser;

        this.tableBody = null;
        this.addForm = null;
        this.closeButton = null;
        this.emptyState = null;

        if (this.container) {
            this.buildUI();
        }
    }

    buildUI() {
        clearElement(this.container);
        this.container.classList.add('user-admin-panel');

        const header = createElement('div', { className: 'user-admin-header' });
        const title = createElement('h3', { text: 'Administration des utilisateurs', attributes: { id: 'user-admin-title' } });
        header.appendChild(title);
        this.closeButton = createElement('button', {
            className: 'secondary-button',
            text: 'Fermer',
            attributes: { type: 'button' }
        });
        this.closeButton.addEventListener('click', () => this.onClose?.());
        header.appendChild(this.closeButton);
        this.container.appendChild(header);

        const info = createElement('p', {
            className: 'user-admin-info',
            text: 'Gerez les comptes admin/utilisateur utilises par la carte (roles, tokens API, connexion Discord).'
        });
        this.container.appendChild(info);

        const table = createElement('table', { className: 'user-admin-table' });
        const thead = createElement('thead');
        thead.appendChild(createElement('tr', {
            children: [
                createElement('th', { text: 'Nom' }),
                createElement('th', { text: 'Provider' }),
                createElement('th', { text: 'Role' }),
                createElement('th', { text: 'Tokens API' }),
                createElement('th', { text: 'Actions' })
            ]
        }));
        table.appendChild(thead);
        this.tableBody = createElement('tbody');
        table.appendChild(this.tableBody);
        this.container.appendChild(table);

        this.emptyState = createElement('p', { className: 'user-admin-empty', text: 'Aucun utilisateur enregistre.' });
        this.emptyState.hidden = true;
        this.container.appendChild(this.emptyState);

        const addSection = createElement('div', { className: 'user-admin-add' });
        addSection.appendChild(createElement('h4', { text: 'Ajouter un utilisateur (manuel)' }));
        const usernameFieldId = 'user-admin-add-username';
        const roleFieldId = 'user-admin-add-role';

        this.addForm = createElement('form', {
            className: 'user-admin-add-form',
            attributes: { autocomplete: 'off' }
        });

        const usernameGroup = createElement('div', { className: 'user-admin-field' });
        usernameGroup.appendChild(createElement('label', {
            text: 'Nom affiche',
            attributes: { for: usernameFieldId }
        }));
        const usernameInput = createElement('input', {
            attributes: {
                type: 'text',
                id: usernameFieldId,
                name: 'username',
                placeholder: 'Nom affiche',
                autocomplete: 'username'
            }
        });
        usernameGroup.appendChild(usernameInput);
        this.addForm.appendChild(usernameGroup);

        const roleGroup = createElement('div', { className: 'user-admin-field' });
        roleGroup.appendChild(createElement('label', {
            text: 'Role',
            attributes: { for: roleFieldId }
        }));
        const roleSelect = createElement('select', {
            attributes: { id: roleFieldId, name: 'role', autocomplete: 'off' }
        });
        ['admin', 'user'].forEach(role => {
            roleSelect.appendChild(createElement('option', { text: ROLE_LABELS[role], attributes: { value: role } }));
        });
        roleGroup.appendChild(roleSelect);
        this.addForm.appendChild(roleGroup);

        this.addForm.appendChild(createElement('button', {
            className: 'primary-button',
            attributes: { type: 'submit' },
            text: 'Creer'
        }));
        this.addForm.appendChild(createElement('p', {
            className: 'user-admin-add-hint',
            text: 'Un token API sera genere automatiquement.'
        }));
        this.addForm.addEventListener('submit', event => {
            event.preventDefault();
            const formData = new FormData(this.addForm);
            const payload = {
                username: (formData.get('username') || '').trim(),
                role: formData.get('role') || 'user'
            };
            this.onAddUser?.(payload);
        });
        addSection.appendChild(this.addForm);
        this.container.appendChild(addSection);
    }

    async refresh(users = []) {
        clearElement(this.tableBody);
        this.emptyState.hidden = users.length > 0;
        users.forEach(user => {
            const row = this.createRow(user);
            this.tableBody.appendChild(row);
        });
    }

    createRow(user) {
        const row = createElement('tr');
        row.appendChild(createElement('td', { text: user.username || '(sans nom)' }));
        row.appendChild(createElement('td', { text: user.provider || 'manual' }));
        row.appendChild(createElement('td', { text: ROLE_LABELS[user.role] || user.role }));

        const tokenCell = createElement('td');
        if (Array.isArray(user.apiTokens) && user.apiTokens.length) {
            const list = createElement('ul', { className: 'token-list' });
            user.apiTokens.forEach(token => {
                const item = createElement('li', { text: token });
                const removeBtn = createElement('button', {
                    className: 'token-remove',
                    text: 'X',
                    attributes: { type: 'button' }
                });
                removeBtn.addEventListener('click', () => this.onRemoveToken(user, token));
                item.appendChild(removeBtn);
                list.appendChild(item);
            });
            tokenCell.appendChild(list);
        } else {
            tokenCell.appendChild(createElement('span', { className: 'token-empty', text: '--' }));
        }
        row.appendChild(tokenCell);

        const actions = createElement('td', { className: 'user-admin-actions' });
        const promoteBtn = createElement('button', {
            className: 'secondary-button',
            text: user.role === 'admin' ? 'Passer en utilisateur' : 'Promouvoir admin',
            attributes: { type: 'button' }
        });
        promoteBtn.addEventListener('click', () => this.onPromote(user));
        actions.appendChild(promoteBtn);

        if (user.provider !== 'discord') {
            const tokenBtn = createElement('button', {
                className: 'secondary-button',
                text: 'Nouveau token',
                attributes: { type: 'button' }
            });
            tokenBtn.addEventListener('click', () => this.onGenerateToken(user));
            actions.appendChild(tokenBtn);
        }

        const deleteBtn = createElement('button', {
            className: 'danger-button',
            text: 'Supprimer',
            attributes: { type: 'button' }
        });
        deleteBtn.addEventListener('click', () => this.onDeleteUser?.(user));
        actions.appendChild(deleteBtn);

        row.appendChild(actions);
        return row;
    }

    onPromote(user) {
        const newRole = user.role === 'admin' ? 'user' : 'admin';
        this.onUpdateUser?.({ id: user.id, role: newRole });
    }

    onGenerateToken(user) {
        this.onUpdateUser?.({ id: user.id, generateToken: true });
    }

    onRemoveToken(user, token) {
        this.onUpdateUser?.({ id: user.id, removeToken: token });
    }

    resetAddForm() {
        this.addForm?.reset?.();
    }
}
