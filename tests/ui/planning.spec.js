const { test, expect } = require('@playwright/test');

test.describe('Planning - UI', () => {
  test('la page planning affiche le socle calendrier JDR', async ({ page }) => {
    await page.goto('/planning/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.planning-nav a[aria-current="page"]')).toHaveText('Planning');
    await expect(page.locator('#planning-title')).toContainText('Trouver une date');
    await expect(page.locator('#planning-week-title')).toHaveText('Semaine type');
    await expect(page.locator('.planning-calendar-row')).toHaveCount(8);
    await expect(page.locator('.planning-slot').first()).toBeVisible();
    await expect(page.locator('#planning-status')).toContainText('Connectez-vous');
    await expect(page.locator('#planning-summary-status')).toContainText('Connectez-vous');
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
    expect(savedPayload.availability.slots[0][0]).toBe(true);
    expect(savedPayload.availability.slots[0][2]).toBe(true);
    await expect(page.locator('.planning-best-slot').first()).toContainText('Lun - Soir');
    await expect(page.locator('.planning-best-slot').first()).toContainText('2 dispo');
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
