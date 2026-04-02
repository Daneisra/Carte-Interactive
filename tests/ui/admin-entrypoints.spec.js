const { test, expect } = require('@playwright/test');

const loginAsAdmin = async page => {
  const loginResponse = await page.request.get('/auth/discord/login', { maxRedirects: 0 });
  expect(loginResponse.status()).toBe(302);

  const redirect = loginResponse.headers()['location'];
  expect(redirect).toBeTruthy();

  const state = new URL(redirect).searchParams.get('state');
  expect(state).toBeTruthy();

  const callbackResponse = await page.request.get(`/auth/discord/callback?code=stub-code&state=${state}`, {
    maxRedirects: 0
  });
  expect(callbackResponse.status()).toBe(302);
};

const mockAdminPatch = async (page, routePattern, payloadKey) => {
  let captured = null;
  await page.route(routePattern, async route => {
    const request = route.request();
    if (request.method() !== 'PATCH') {
      await route.continue();
      return;
    }
    captured = JSON.parse(request.postData() || '{}');
    const body = captured?.[payloadKey] ?? captured;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', [payloadKey]: body })
    });
  });
  return () => captured;
};

test.describe('Points d\'entree admin', () => {
  test('les panneaux admin dedies restent fermes pour un visiteur', async ({ page }) => {
    await page.goto('/?admin=home');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#home-admin-entry')).toBeHidden();
    await expect(page.locator('#home-admin-overlay')).toBeHidden();

    await page.goto('/timeline/?admin=timeline');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#timeline-admin-entry')).toBeHidden();
    await expect(page.locator('#timeline-admin-overlay')).toBeHidden();
  });

  test('l accueil expose un acces admin dedie vers la section accueil', async ({ page }) => {
    await loginAsAdmin(page);
    const requests = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/admin/home-config') || url.includes('/api/admin/timeline-config')) {
        requests.push(url);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const adminEntry = page.locator('#home-admin-entry');
    await expect(adminEntry).toBeVisible();
    await expect(adminEntry).toHaveAttribute('href', '/?admin=home');

    await adminEntry.click();
    await expect(page.locator('#home-admin-overlay')).toBeVisible();
    await expect(page.locator('#home-admin-overlay a[href="/timeline/?admin=timeline"]')).toBeVisible();
    await expect(page.locator('#home-admin-overlay a[href="/map/"]')).toBeVisible();
    await page.waitForTimeout(300);
    expect(requests.some(url => url.includes('/api/admin/home-config'))).toBeTruthy();
    expect(requests.some(url => url.includes('/api/admin/timeline-config'))).toBeFalsy();
  });

  test('le panneau admin accueil se ferme avec Escape et rend le focus au declencheur', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/?admin=home');
    await page.waitForLoadState('domcontentloaded');

    const adminEntry = page.locator('#home-admin-entry');
    await expect(page.locator('#home-admin-overlay')).toBeVisible();
    await expect(page).not.toHaveURL(/\?admin=home$/);
    await expect(page.locator('body')).toHaveClass(/admin-surface-open/);

    await page.keyboard.press('Escape');
    await expect(page.locator('#home-admin-overlay')).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/admin-surface-open/);
    await expect(adminEntry).toBeFocused();
  });

  test('la chronologie expose un acces admin dedie vers la section chronologie', async ({ page }) => {
    await loginAsAdmin(page);
    const requests = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/admin/home-config') || url.includes('/api/admin/timeline-config')) {
        requests.push(url);
      }
    });

    await page.goto('/timeline/');
    await page.waitForLoadState('domcontentloaded');

    const adminEntry = page.locator('#timeline-admin-entry');
    await expect(adminEntry).toBeVisible();
    await expect(adminEntry).toHaveAttribute('href', '/timeline/?admin=timeline');

    await adminEntry.click();
    await expect(page.locator('#timeline-admin-overlay')).toBeVisible();
    await expect(page.locator('#timeline-admin-overlay a[href="/?admin=home"]')).toBeVisible();
    await expect(page.locator('#timeline-admin-overlay a[href="/map/"]')).toBeVisible();
    await page.waitForTimeout(300);
    expect(requests.some(url => url.includes('/api/admin/timeline-config'))).toBeTruthy();
    expect(requests.some(url => url.includes('/api/admin/home-config'))).toBeFalsy();
  });

  test('le panneau admin chronologie se ferme avec le bouton close et rend le focus au declencheur', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/timeline/');
    await page.waitForLoadState('domcontentloaded');

    const adminEntry = page.locator('#timeline-admin-entry');
    await adminEntry.click();
    await expect(page.locator('#timeline-admin-overlay')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/admin-surface-open/);

    await page.locator('#timeline-admin-close').click();
    await expect(page.locator('#timeline-admin-overlay')).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/admin-surface-open/);
    await expect(adminEntry).toBeFocused();
  });

  test('les anciens deep links admin carte redirigent vers les panneaux dedies', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/map/?adminSection=home');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('#home-admin-overlay')).toBeVisible();

    await page.goto('/map/?adminSection=timeline');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/timeline\/(?:\?.*)?$/);
    await expect(page.locator('#timeline-admin-overlay')).toBeVisible();
  });

  test('l alias admin timeline legacy reste compatible pendant la transition', async ({ page }) => {
    await loginAsAdmin(page);

    const response = await page.request.get('/api/admin/timeline');
    expect(response.ok()).toBeTruthy();

    const payload = await response.json();
    expect(payload?.status).toBe('ok');
    expect(Array.isArray(payload?.timeline?.entries)).toBeTruthy();
  });

  test('la sauvegarde admin accueil passe bien par home-config', async ({ page }) => {
    await loginAsAdmin(page);
    const readCaptured = await mockAdminPatch(page, '**/api/admin/home-config', 'config');

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#home-admin-entry').click();
    await expect(page.locator('#home-admin-overlay')).toBeVisible();

    const nextTitle = 'Accueil admin test';
    await page.locator('#admin-home-title').fill(nextTitle);
    await page.locator('#admin-home-save').click();

    await expect.poll(() => readCaptured()?.config?.home?.title || null).toBe(nextTitle);
  });

  test('la sauvegarde admin chronologie passe bien par timeline-config', async ({ page }) => {
    await loginAsAdmin(page);
    const readCaptured = await mockAdminPatch(page, '**/api/admin/timeline-config', 'timeline');

    await page.goto('/timeline/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#timeline-admin-entry').click();
    await expect(page.locator('#timeline-admin-overlay')).toBeVisible();

    const nextTitle = 'Chronologie admin test';
    await page.locator('#admin-timeline-title').fill(nextTitle);
    await page.locator('.admin-timeline-card').first().locator('select').first().selectOption('player');
    await page.locator('#admin-timeline-save').click();

    await expect.poll(() => readCaptured()?.timeline?.title || null).toBe(nextTitle);
    await expect.poll(() => readCaptured()?.timeline?.entries?.[0]?.eventKind || null).toBe('player');
  });

  test('la saisie dans un evenement de chronologie ne remonte pas le panneau en haut', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/timeline/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#timeline-admin-entry').click();
    await expect(page.locator('#timeline-admin-overlay')).toBeVisible();

    const content = page.locator('#timeline-admin-dialog .admin-content');
    const targetInput = page.locator('.admin-timeline-card').last().getByLabel('Titre');
    await targetInput.scrollIntoViewIfNeeded();
    await targetInput.click();

    const scrollBefore = await content.evaluate(node => node.scrollTop);
    await targetInput.fill('Titre sans saut de scroll');

    const scrollAfter = await content.evaluate(node => node.scrollTop);
    await expect(targetInput).toHaveValue('Titre sans saut de scroll');
    expect(scrollAfter).toBeGreaterThan(0);
    expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThan(120);
  });

  test('le panneau admin carte n ouvre pas les chargements accueil et chronologie par defaut', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/map/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('#profile-button').click();
    const adminButton = page.locator('#quick-admin-panel');
    await expect(adminButton).toBeVisible();

    const requests = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/admin/home-config') || url.includes('/api/admin/timeline-config')) {
        requests.push(url);
      }
    });

    await adminButton.click();
    await expect(page.locator('#admin-overlay')).toBeVisible();
    await expect(page.locator('#admin-section-home-config')).toHaveCount(0);
    await expect(page.locator('#admin-section-timeline-config')).toHaveCount(0);
    await expect(page.locator('#admin-overlay a[href="/?admin=home"]')).toBeVisible();
    await expect(page.locator('#admin-overlay a[href="/timeline/?admin=timeline"]')).toBeVisible();
    await page.waitForTimeout(300);
    expect(requests).toHaveLength(0);
  });

  test('le panneau admin carte charge l audit global des descriptions', async ({ page }) => {
    await loginAsAdmin(page);

    let auditRequests = 0;
    await page.route('**/api/admin/locations/description-audit', async route => {
      auditRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          summary: {
            locationsFlagged: 2,
            issueCount: 3
          },
          items: [
            {
              continent: 'Vruliwen',
              name: 'Brumeport',
              issues: ['Description tres longue sans Historique ni Lore distincts.']
            },
            {
              continent: 'Dipovia',
              name: 'Irisk',
              issues: ['Historique/lore renseignes sans resume court dans description.']
            }
          ]
        })
      });
    });

    await page.goto('/map/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#profile-button').click();
    await page.locator('#quick-admin-panel').click();

    await expect.poll(() => auditRequests).toBeGreaterThan(0);
    await expect(page.locator('#admin-description-audit-summary')).toContainText(/2 lieu\(x\) a revoir/i);
    await expect(page.locator('#admin-description-audit-list')).toContainText(/Brumeport/i);
    await expect(page.locator('#admin-description-audit-list')).toContainText(/Irisk/i);
  });

  test('l editeur de lieu peut generer une description depuis lore et historique', async ({ page }) => {
    await loginAsAdmin(page);

    let captured = null;
    await page.route('**/api/admin/locations/generate-description', async route => {
      const request = route.request();
      if (request.method() !== 'POST') {
        await route.continue();
        return;
      }
      captured = JSON.parse(request.postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          description: 'Description generee de test.',
          meta: { usedSources: ['history', 'lore'] }
        })
      });
    });

    await page.goto('/map/');
    await page.waitForLoadState('domcontentloaded');

    const addButton = page.locator('#add-location');
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    await expect(page.locator('#location-editor')).toBeVisible();
    await page.locator('[data-role="history-list"] textarea').first().fill('La ville a ete fondee pour proteger le detroit.');
    await page.locator('[data-role="lore-list"] textarea').first().fill('Elle reste connue pour ses marchands et sa brume epaisse.');

    await page.getByRole('button', { name: /Generer depuis lore \/ historique/i }).click();

    await expect.poll(() => captured?.action || null).toBe('generate');
    await expect(page.locator('#editor-description')).toHaveValue('Description generee de test.');
    await expect(page.locator('[data-role="description-assistant-note"]')).toContainText(/Relisez la description/i);
    await expect(page.getByRole('button', { name: /Regenerer depuis lore \/ historique/i })).toBeVisible();
  });

  test('l editeur signale une description trop longue sans sources narratives distinctes', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/map/');
    await page.waitForLoadState('domcontentloaded');

    const addButton = page.locator('#add-location');
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    const description = page.locator('#editor-description');
    await expect(description).toBeVisible();
    await description.fill(
      '# Titre long\n' +
      'Une longue entree de description qui ressemble deja a un bloc de lore complet. '.repeat(12)
    );

    const warningsPanel = page.locator('#location-editor [data-role="validation-warnings"]');
    await expect(warningsPanel).toBeVisible();
    await expect(warningsPanel).toContainText(/Description tres longue sans Historique ni Lore/i);
    await expect(warningsPanel).toContainText(/Description structuree en titres ou listes/i);
  });

  test('l editeur de lieu affiche les apercus d icones de type et synchronise le select', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/map/');
    await page.waitForLoadState('domcontentloaded');

    const addButton = page.locator('#add-location');
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    const typeGrid = page.locator('[data-role="type-option-grid"]');
    await expect(typeGrid).toBeVisible();
    await expect(typeGrid.locator('img')).not.toHaveCount(0);

    const fortressButton = typeGrid.getByRole('button', { name: /^Fortress$/i }).first();
    await fortressButton.click();

    await expect(page.locator('#editor-type')).toHaveValue('Fortress');
    await expect(fortressButton).toHaveAttribute('aria-pressed', 'true');
  });
});
