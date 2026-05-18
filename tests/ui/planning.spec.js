const { test, expect } = require('@playwright/test');

test.describe('Planning - UI', () => {
  test('la page planning affiche le socle calendrier JDR', async ({ page }) => {
    await page.goto('/planning/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.planning-nav a[aria-current="page"]')).toHaveText('Planning');
    await expect(page.locator('#planning-title')).toContainText('Trouver une date');
    await expect(page.locator('#planning-agenda-title')).toHaveText('Sessions candidates');
    await expect(page.locator('#planning-dated-title')).toHaveText("Mes disponibilites dans l'agenda");
    await expect(page.locator('#planning-week-title')).toHaveText('Semaine type (ancien systeme)');
    await expect(page.locator('.planning-agenda-day')).toHaveCount(42);
    await expect(page.locator('.planning-calendar-row')).toHaveCount(8);
    await expect(page.locator('.planning-slot').first()).toBeVisible();
    await expect(page.locator('#planning-view-week')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#planning-status')).toContainText('Connectez-vous');
    await expect(page.locator('#planning-summary-status')).toContainText('Connectez-vous');
  });

  test('un utilisateur connecte peut renseigner une disponibilite datee', async ({ page }) => {
    let savedPayload = null;
    let deletedPayload = null;

    await page.route('**/auth/session', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        username: 'Danny',
        availability: { timezone: 'Europe/Warsaw', slots: [] }
      })
    }));
    await page.route('**/api/planning/my-availability', route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ok', availability: [] })
        });
      }
      if (route.request().method() === 'DELETE') {
        deletedPayload = route.request().postDataJSON();
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ok', availability: [] })
        });
      }
      savedPayload = route.request().postDataJSON();
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          availability: [
            {
              id: 'availability-test',
              date: savedPayload.date,
              startTime: savedPayload.startTime,
              endTime: savedPayload.endTime,
              status: savedPayload.status,
              comment: savedPayload.comment
            }
          ]
        })
      });
    });
    await page.route('**/api/planning/availability-summary', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', scopes: [] })
    }));

    await page.goto('/planning/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('#planning-dated-date').fill('2026-07-12');
    await page.locator('#planning-dated-start').fill('20:30');
    await page.locator('#planning-dated-end').fill('23:30');
    await page.locator('#planning-dated-response').selectOption('available');
    await page.locator('#planning-dated-comment').fill('Disponible apres le repas');
    await page.locator('#planning-dated-save').click();

    await expect(page.locator('#planning-dated-status')).toHaveText('Disponibilite datee enregistree.');
    expect(savedPayload).toMatchObject({
      date: '2026-07-12',
      startTime: '20:30',
      endTime: '23:30',
      status: 'available',
      comment: 'Disponible apres le repas'
    });
    await expect(page.locator('.planning-dated-entry')).toContainText('Disponible apres le repas');

    await page.locator('.planning-dated-delete').click();
    await expect(page.locator('#planning-dated-status')).toHaveText('Disponibilite supprimee.');
    expect(deletedPayload.id).toBe('availability-test');
  });

  test('un admin peut creer modifier et supprimer une session candidate', async ({ page }) => {
    let sessions = [];
    const adminRequests = [];

    await page.route('**/auth/session', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        role: 'admin',
        username: 'Danny',
        availability: { timezone: 'Europe/Warsaw', slots: [] }
      })
    }));
    await page.route('**/api/planning/sessions', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', sessions })
    }));
    await page.route('**/api/planning/my-availability', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', availability: [] })
    }));
    await page.route('**/api/planning/availability-summary', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', scopes: [] })
    }));
    await page.route('**/api/admin/planning/sessions', route => {
      const method = route.request().method();
      const payload = route.request().postDataJSON();
      adminRequests.push({ method, payload });
      if (method === 'POST') {
        sessions = [
          {
            id: 'session-admin',
            title: payload.title,
            date: payload.date,
            startTime: payload.startTime,
            durationMinutes: payload.durationMinutes,
            groupName: payload.groupName,
            status: payload.status,
            description: payload.description,
            responseSummary: { available: 0, maybe: 0, busy: 0 },
            planningInsight: { quality: 'unknown', weekly: {}, dated: {}, bestSlots: [] },
            responses: {}
          }
        ];
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ok', session: sessions[0], sessions })
        });
      }
      if (method === 'PATCH') {
        sessions = sessions.map(session => session.id === payload.id ? { ...session, ...payload } : session);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ok', session: sessions[0], sessions })
        });
      }
      sessions = sessions.filter(session => session.id !== payload.id);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', removed: { id: payload.id }, sessions })
      });
    });

    await page.goto('/planning/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#planning-admin-link')).toBeVisible();
    await expect(page.locator('#planning-admin')).toBeVisible();

    await page.locator('#planning-admin-title-input').fill('Session admin test');
    await page.locator('#planning-admin-date').fill('2026-08-14');
    await page.locator('#planning-admin-start').fill('20:45');
    await page.locator('#planning-admin-duration').fill('210');
    await page.locator('#planning-admin-group').fill('Table Hesta');
    await page.locator('#planning-admin-description').fill('Session creee depuis admin planning.');
    await page.locator('#planning-admin-save').click();

    await expect(page.locator('#planning-admin-status')).toHaveText('Session creee.');
    await expect(page.locator('.planning-admin-entry')).toContainText('Session admin test');
    expect(adminRequests[0]).toMatchObject({
      method: 'POST',
      payload: {
        title: 'Session admin test',
        date: '2026-08-14',
        startTime: '20:45',
        durationMinutes: 210,
        groupName: 'Table Hesta',
        status: 'candidate'
      }
    });

    await page.locator('[data-admin-action="edit"]').click();
    await page.locator('#planning-admin-title-input').fill('Session admin modifiee');
    await page.locator('#planning-admin-session-status').selectOption('confirmed');
    await page.locator('#planning-admin-save').click();

    await expect(page.locator('#planning-admin-status')).toHaveText('Session modifiee.');
    expect(adminRequests[1]).toMatchObject({
      method: 'PATCH',
      payload: {
        id: 'session-admin',
        title: 'Session admin modifiee',
        status: 'confirmed'
      }
    });

    await page.locator('[data-admin-action="delete"]').click();
    await expect(page.locator('#planning-admin-status')).toHaveText('Session supprimee.');
    await expect(page.locator('.planning-admin-empty')).toContainText('Aucune session candidate');
    expect(adminRequests[2]).toMatchObject({
      method: 'DELETE',
      payload: { id: 'session-admin' }
    });
  });

  test('un utilisateur connecte peut modifier et enregistrer ses disponibilites', async ({ page }) => {
    const slots = Array.from({ length: 7 }, () => Array.from({ length: 4 }, () => false));
    slots[0][2] = true;
    let savedPayload = null;

    await page.route('**/auth/session', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        username: 'Danny',
        availability: { timezone: 'Europe/Warsaw', slots }
      })
    }));
    await page.route('**/api/profile', async route => {
      savedPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          profile: {
            username: 'Danny',
            availability: savedPayload.availability
          }
        })
      });
    });
    await page.route('**/api/planning/availability-summary', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        scopes: [
          {
            id: 'all',
            label: 'Tous les joueurs',
            kind: 'global',
            respondents: 2,
            totalUsers: 3,
            best: [
              { day: 'mon', slot: 'evening', count: 2 },
              { day: 'fri', slot: 'night', count: 1 }
            ]
          }
        ]
      })
    }));

    await page.goto('/planning/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#planning-profile-name')).toHaveText('Danny');
    await expect(page.locator('#planning-timezone')).toHaveText('Europe/Warsaw');
    await expect(page.locator('.planning-slot-available')).toHaveCount(1);

    await page.locator('.planning-slot').first().click();
    await expect(page.locator('#planning-save')).toBeEnabled();
    await page.locator('#planning-save').click();

    await expect(page.locator('#planning-status')).toHaveText('Disponibilites enregistrees.');
    expect(savedPayload.availability.timezone).toBe('Europe/Warsaw');
    expect(savedPayload.availability.slots[0][0]).toBe('available');
    expect(savedPayload.availability.slots[0][2]).toBe('available');
    await expect(page.locator('.planning-best-slot').first()).toContainText('Lun - Soir');
    await expect(page.locator('.planning-best-slot').first()).toContainText('2 dispo');
  });

  test('la grille planning cycle entre disponible, incertain, indisponible et vide', async ({ page }) => {
    await page.route('**/auth/session', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        username: 'Danny',
        availability: { timezone: 'Europe/Warsaw', slots: [] }
      })
    }));
    await page.route('**/api/planning/availability-summary', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', scopes: [] })
    }));

    await page.goto('/planning/');
    await page.waitForLoadState('domcontentloaded');

    const firstSlot = page.locator('.planning-slot').first();
    await firstSlot.click();
    await expect(firstSlot).toHaveText('Disponible');
    await firstSlot.click();
    await expect(firstSlot).toHaveText('Incertain');
    await firstSlot.click();
    await expect(firstSlot).toHaveText('Indisponible');
    await firstSlot.click();
    await expect(firstSlot).toHaveText('--');
  });

  test('la vue mois projette la semaine type sur les prochaines semaines', async ({ page }) => {
    const slots = Array.from({ length: 7 }, () => Array.from({ length: 4 }, () => null));
    slots[0][2] = 'available';
    slots[2][3] = 'maybe';

    await page.route('**/auth/session', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        username: 'Danny',
        availability: { timezone: 'Europe/Warsaw', slots }
      })
    }));
    await page.route('**/api/planning/availability-summary', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', scopes: [] })
    }));

    await page.goto('/planning/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('#planning-view-month').click();
    await expect(page.locator('#planning-view-month')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#planning-month-view')).toBeVisible();
    await expect(page.locator('.planning-month-day')).toHaveCount(35);
    await expect(page.locator('.planning-month-tag-available').first()).toContainText('Disponible');
    await expect(page.locator('.planning-month-tag-maybe').first()).toContainText('Incertain');

    await page.locator('#planning-view-week').click();
    await expect(page.locator('#planning-week-view')).toBeVisible();
  });

  test('la synthese planning affiche les scopes de groupe', async ({ page }) => {
    await page.route('**/auth/session', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        username: 'Danny',
        availability: { timezone: 'Europe/Warsaw', slots: [] }
      })
    }));
    await page.route('**/api/planning/availability-summary', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        scopes: [
          {
            id: 'all',
            label: 'Tous les joueurs',
            kind: 'global',
            respondents: 4,
            totalUsers: 5,
            best: [{ day: 'wed', slot: 'evening', count: 4 }]
          },
          {
            id: 'groupe-a',
            label: 'Groupe A',
            kind: 'group',
            respondents: 3,
            totalUsers: 3,
            best: [{ day: 'fri', slot: 'night', count: 3 }]
          }
        ]
      })
    }));

    await page.goto('/planning/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#planning-summary-status')).toHaveText('2 syntheses chargees.');
    await expect(page.locator('#planning-scope')).toBeEnabled();
    await expect(page.locator('.planning-best-slot').first()).toContainText('Mer - Soir');
    await page.locator('#planning-scope').selectOption('groupe-a');
    await expect(page.locator('.planning-best-slot').first()).toContainText('Ven - Nuit');
    await expect(page.locator('.planning-best-slot').first()).toContainText('3 dispo');
  });

  test('la vue agenda affiche les sessions datees et navigue par mois', async ({ page }) => {
    const now = new Date();
    const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 12);
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 8);
    const toKey = date => [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
    let savedResponse = null;

    await page.route('**/auth/session', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        username: 'Danny',
        availability: { timezone: 'Europe/Warsaw', slots: [] }
      })
    }));
    await page.route('**/api/planning/sessions', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        sessions: [
          {
            id: 'session-current',
            title: 'Conseil des routes',
            date: toKey(currentMonthDate),
            startTime: '20:30',
            durationMinutes: 180,
            groupName: 'Groupe principal',
            status: 'candidate',
            description: 'Date candidate pour organiser la prochaine partie.',
            responseSummary: { available: 0, maybe: 1, busy: 0 },
            planningInsight: {
              quality: 'conflict',
              weekly: { available: 0, maybe: 1, busy: 1, empty: 0, respondents: 2 },
              bestSlots: [
                { day: 'mon', slot: 'evening', available: 2, maybe: 0, busy: 0, score: 6 }
              ],
              conflicts: 1,
              targetUsers: 2
            },
            responses: {}
          },
          {
            id: 'session-next',
            title: 'Session confirmee',
            date: toKey(nextMonthDate),
            startTime: '21:00',
            durationMinutes: 210,
            groupName: 'Table Hesta',
            status: 'confirmed',
            description: 'Partie confirmee.',
            responseSummary: { available: 2, maybe: 0, busy: 1 },
            planningInsight: {
              quality: 'good',
              weekly: { available: 2, maybe: 0, busy: 0, empty: 0, respondents: 2 },
              bestSlots: [
                { day: 'wed', slot: 'night', available: 2, maybe: 0, busy: 0, score: 6 }
              ],
              conflicts: 1,
              targetUsers: 2
            },
            responses: {}
          }
        ]
      })
    }));
    await page.route('**/api/planning/sessions/*/response', route => {
      savedResponse = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          session: {
            id: 'session-current',
            title: 'Conseil des routes',
            date: toKey(currentMonthDate),
            startTime: '20:30',
            durationMinutes: 180,
            groupName: 'Groupe principal',
            status: 'candidate',
            description: 'Date candidate pour organiser la prochaine partie.',
            responseSummary: { available: 1, maybe: 1, busy: 0 },
            planningInsight: {
              quality: 'good',
              weekly: { available: 1, maybe: 1, busy: 0, empty: 0, respondents: 2 },
              bestSlots: [
                { day: 'mon', slot: 'evening', available: 2, maybe: 0, busy: 0, score: 6 }
              ],
              conflicts: 0,
              targetUsers: 2
            },
            responses: {}
          }
        })
      });
    });

    await page.goto('/planning/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#planning-agenda-status')).toHaveText('2 sessions chargees.');
    await expect(page.locator('.planning-agenda-session')).toHaveCount(1);
    await expect(page.locator('.planning-agenda-session').first()).toContainText('Conseil des routes');
    await expect(page.locator('.planning-agenda-chip').first()).toContainText('Conseil des routes');
    await expect(page.locator('.planning-agenda-response-summary').first()).toContainText('0 dispo / 1 incertain / 0 indispo');
    await expect(page.locator('.planning-agenda-insight').first()).toContainText('Creneau prevu: 0 dispo / 1 incertain / 1 conflit');
    await expect(page.locator('.planning-agenda-insight').first()).toContainText('Meilleurs creneaux: Lun Soir');
    await page.locator('.planning-agenda-response-actions button', { hasText: 'Disponible' }).first().click();
    expect(savedResponse.status).toBe('available');
    await expect(page.locator('#planning-agenda-status')).toHaveText('Reponse enregistree.');
    await expect(page.locator('.planning-agenda-response-summary').first()).toContainText('1 dispo / 1 incertain / 0 indispo');

    await page.locator('#planning-month-next').click();
    await expect(page.locator('.planning-agenda-session')).toHaveCount(1);
    await expect(page.locator('.planning-agenda-session').first()).toContainText('Session confirmee');
    await expect(page.locator('.planning-agenda-session').first()).toContainText('Confirmee');
  });

  test('la page planning reste exploitable sur mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/planning/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.planning-header')).toBeVisible();
    await expect(page.locator('#planning-week')).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(() => (
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
    ));
    expect(hasHorizontalOverflow).toBeFalsy();
  });
});
