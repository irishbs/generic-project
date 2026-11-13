import { expect, type Locator, type Page } from "@playwright/test";

// Page object for the home page (/), which shows the signed-in state.
export class HomePage {
  readonly signedIn: Locator;
  readonly signedOut: Locator;
  readonly userEmail: Locator;
  readonly logoutButton: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.signedIn = page.locator("#signed-in");
    this.signedOut = page.locator("#signed-out");
    this.userEmail = page.locator("#user-email");
    this.logoutButton = page.getByRole("button", { name: "Log out" });
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
  }

  async logOut(): Promise<void> {
    await this.logoutButton.click();
    await expect(this.signedOut).toBeVisible();
  }
}
