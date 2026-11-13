import { expect, type Locator, type Page } from "@playwright/test";

// Page object for /login. Tests talk to this class, not to selectors, so a markup change
// only has to be fixed in one place.
export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly alert: Locator;
  readonly notice: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.email = page.getByLabel("Email");
    this.password = page.getByLabel("Password");
    this.submit = page.getByRole("button", { name: "Log in" });
    this.alert = page.locator("#login-form [role='alert']");
    this.notice = page.locator("[data-notice]");
  }

  async goto(query = ""): Promise<void> {
    await this.page.goto(`/login${query}`);
  }

  async logIn(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  async expectError(message: string): Promise<void> {
    await expect(this.alert).toBeVisible();
    await expect(this.alert).toHaveText(message);
  }
}
