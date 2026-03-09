import {
  test,
  expect,
  navigateTo,
  expectNoFatalOverlay,
} from './fixtures/app-fixture';

test.describe('Toolbox Page', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '/toolbox');
  });

  test('renders toolbox page shell', async ({ appPage }) => {
    await expect(appPage.getByTestId('toolbox-page-root')).toBeVisible();
    await expect(appPage.getByText('Toolbox').first()).toBeVisible();
  });

  test('view mode toggle switches between grid and list layouts', async ({ appPage }) => {
    const gridRoot = appPage.getByTestId('tool-grid-root');
    await expect(gridRoot).toBeVisible();

    await appPage.getByRole('radio', { name: /list view/i }).click();
    await expect(gridRoot).toHaveClass(/flex-col/);

    await appPage.getByRole('radio', { name: /grid view/i }).click();
    await expect(gridRoot).toHaveClass(/grid/);
  });

  test('search empty state supports clear-search recovery', async ({ appPage }) => {
    const searchInput = appPage.getByPlaceholder(/search tools/i);
    await expect(searchInput).toBeVisible();

    await searchInput.fill('definitely-no-tool-match-xyz');
    await expect(appPage.getByTestId('tool-empty-state')).toBeVisible();

    await appPage.getByRole('button', { name: /clear search/i }).click();
    await expect(appPage.getByTestId('tool-empty-state')).toHaveCount(0);
    await expect(appPage.getByTestId('tool-grid-root')).toBeVisible();
  });

  test('favorites category shows empty-state guidance by default', async ({ appPage, isMobile }) => {
    test.skip(isMobile, 'Desktop category navigation is validated in chromium only.');

    await appPage.getByRole('button', { name: /favorites/i }).first().click();
    await expect(appPage.getByTestId('tool-empty-state')).toBeVisible();
    await expect(appPage.getByText(/no favorites yet/i)).toBeVisible();
  });

  test('route remains stable after interactions', async ({ appPage }) => {
    await appPage.getByRole('radio', { name: /list view/i }).click();
    await appPage.getByPlaceholder(/search tools/i).fill('json');

    await expect(appPage.locator('main').last()).toBeVisible();
    await expectNoFatalOverlay(appPage);
  });
});
