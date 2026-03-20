const { test, expect } = require('@playwright/test');

test.describe('Chronologie - UI', () => {
  test('la frise charge des evenements et affiche un detail actif', async ({ page }) => {
    await page.goto('/timeline/');
    await page.waitForLoadState('domcontentloaded');

    const cards = page.locator('.timeline-card');
    await expect(cards).toHaveCount(6);
    await expect(page.locator('.timeline-card-media')).toHaveCount(3);
    await expect(page.locator('#timeline-detail-title')).toHaveText(/.+/);
    await expect(page.locator('.timeline-detail-media img')).toBeVisible();
    await expect(page.locator('#timeline-status')).toContainText('evenements affiches');
  });

  test('les filtres periode, tag et recherche reduisent la frise', async ({ page }) => {
    await page.goto('/timeline/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.timeline-card')).toHaveCount(6);

    await page.locator('#timeline-period-filter').selectOption({ label: 'Fractures' });
    await expect(page.locator('.timeline-card')).toHaveCount(1);
    await expect(page.locator('#timeline-detail-title')).toHaveText(/Nikaius/i);

    await page.locator('#timeline-reset-filters').click();
    await expect(page.locator('.timeline-card')).toHaveCount(6);

    await page.locator('#timeline-tag-filter').selectOption({ label: 'Commerce' });
    await expect(page.locator('.timeline-card')).toHaveCount(2);

    await page.locator('#timeline-search').fill('sanctuarium');
    await expect(page.locator('.timeline-card')).toHaveCount(0);
    await expect(page.locator('#timeline-status')).toContainText('Aucun evenement');

    await page.locator('#timeline-reset-filters').click();
    await page.locator('#timeline-search').fill('nikaius');
    await expect(page.locator('.timeline-card')).toHaveCount(1);
    await expect(page.locator('#timeline-detail-title')).toHaveText(/Nikaius/i);
  });

  test('les liens profonds depuis la carte prefiltrent la chronologie', async ({ page }) => {
    await page.goto('/timeline/?event=lisboa-rises&location=Lisboa');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#timeline-search')).toHaveValue('Lisboa');
    await expect(page.locator('.timeline-card')).toHaveCount(1);
    await expect(page.locator('#timeline-detail-title')).toHaveText(/Lisboa devient une plaque tournante/i);
  });

  test('la frise est navigable au clavier', async ({ page }) => {
    await page.goto('/timeline/');
    await page.waitForLoadState('domcontentloaded');

    const firstCard = page.locator('.timeline-card').first();
    await firstCard.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#timeline-detail-title')).toHaveText(/Aguilar verrouille la frontiere/i);

    await page.keyboard.press('End');
    await expect(page.locator('#timeline-detail-title')).toHaveText(/Sanctuarium et Vardanys imposent un nouvel equilibre/i);

    await page.keyboard.press('Home');
    await expect(page.locator('#timeline-detail-title')).toHaveText(/Lisboa devient une plaque tournante/i);
  });
});

test.describe('Chronologie - mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('la page reste exploitable sur mobile', async ({ page }) => {
    await page.goto('/timeline/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.timeline-filters')).toBeVisible();
    await expect(page.locator('.timeline-card')).toHaveCount(6);

    await page.locator('.timeline-card').nth(2).click();
    await expect(page.locator('#timeline-detail-title')).toHaveText(/Brumeport ouvre une nouvelle route/i);
    await expect(page.locator('.timeline-detail-actions .timeline-link-button')).toHaveCount(2);
    await expect(page.locator('#timeline-map-link')).toBeVisible();
  });
});
