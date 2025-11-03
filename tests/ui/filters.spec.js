
const { test, expect } = require('@playwright/test');

const expandAllContinents = async page => {
  const toggles = page.locator('.continent-toggle');
  await toggles.first().waitFor();

  const count = await toggles.count();
  for (let i = 0; i < count; i += 1) {
    const toggle = toggles.nth(i);
    const expanded = await toggle.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await toggle.click();
    }
  }
};

const waitForAppReady = async page => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await expandAllContinents(page);
  await page.waitForSelector('.location');
};

const getVisibleLocationNames = async page => {
  const names = await page.locator('.location:visible .location-label').allTextContents();
  return names.map(name => name.trim());
};

test.describe('Filtres avancés', () => {
test.beforeEach(async ({ page }) => {
  page.on('console', msg => console.log(`[console:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', error => console.log(`[pageerror] ${error.message}`));
});

  test('filtre par tag, statut et réinitialisation', async ({ page }) => {
    await waitForAppReady(page);

    await page.locator('#filters-advanced-toggle').click();
    const tagChip = page.locator('#filter-tags label', { hasText: /forteresse/i });
    await tagChip.click();

    let names = await getVisibleLocationNames(page);
    expect(names).toContain('Imossa');
    expect(names.length).toBe(1);

    // Activer le filtre "sans quêtes" doit masquer Imossa
    await page.locator('input[name="filter-quests"][value="without"]').check();
    names = await getVisibleLocationNames(page);
    expect(names.length).toBe(0);

    // Revenir à tous les lieux et basculer sur un autre tag/statut
    await page.locator('input[name="filter-quests"][value="any"]').check();
    await tagChip.click(); // retire forteresse
    await page.locator('#filter-tags label', { hasText: /commerce/i }).click();
    const completedStatus = page.locator('#filter-statuses label', { hasText: /completed/i });
    await completedStatus.click();

    names = await getVisibleLocationNames(page);
    expect(names).toContain('Kitha');
    expect(names.length).toBe(1);

    await page.locator('#reset-filters').click();
    names = await getVisibleLocationNames(page);
    expect(names.length).toBeGreaterThan(1);
  });

  test('API de recherche retourne les résultats attendus', async ({ page }) => {
    await waitForAppReady(page);

    const data = await page.evaluate(async () => {
      const response = await fetch('/api/locations/search?tags=forteresse&statuses=active');
      return response.json();
    });

    expect(data.status).toBe('ok');
    expect(data.filters.tags).toContain('forteresse');
    expect(data.results.length).toBeGreaterThan(0);
    const names = data.results.map(entry => entry.name);
    expect(names).toContain('Imossa');
    expect(Array.isArray(data.facets?.dataset?.types)).toBeTruthy();
  });

  test('les chips de filtres possèdent des attributs accessibles', async ({ page }) => {
    await waitForAppReady(page);
    await page.locator('#filters-advanced-toggle').click();

    const metadata = await page.$$eval('#filter-tags input[type="checkbox"]', inputs =>
      inputs.map(input => ({
        id: input.id,
        name: input.name,
        labelledBy: input.getAttribute('aria-labelledby')
      }))
    );
    expect(metadata.length).toBeGreaterThan(0);

    const uniqueIds = new Set(metadata.map(item => item.id));
    expect(uniqueIds.size).toBe(metadata.length);
    metadata.forEach(item => {
      expect(item.id).toMatch(/^filter-tags-/);
      expect(item.name).toBe('tags[]');
      expect(item.labelledBy).toBeTruthy();
    });

    const labelledElements = await page.$$eval('#filter-tags input[type="checkbox"]', inputs =>
      inputs.map(input => {
        const targetId = input.getAttribute('aria-labelledby');
        const target = targetId ? document.getElementById(targetId) : null;
        return Boolean(target && target.textContent.trim());
      })
    );
    expect(labelledElements.every(Boolean)).toBeTruthy();

    const firstChip = page.locator('#filter-tags label.filter-chip').first();
    const firstInput = firstChip.locator('input[type="checkbox"]');
    await firstChip.click();
    await expect(firstChip).toHaveClass(/filter-chip-active/);
    await expect(firstInput).toHaveAttribute('aria-pressed', 'true');
    await firstChip.click();
    await expect(firstInput).toHaveAttribute('aria-pressed', 'false');
  });
});
