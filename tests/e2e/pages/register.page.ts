import { expect, type Locator, type Page } from "@playwright/test";

// Page object for /register.
export class RegisterPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly alert: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.email = page.getByLabel("Email");
    this.password = page.getByLabel("Password");
    this.submit = page.getByRole("button", { name: "Create account" });
    this.alert = page.locator("#register-form [role='alert']");
  }

  async goto(): Promise<void> {
    await this.page.goto("/register");
  }

  async register(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  // For setup steps: register and wait for the redirect, so the next step doesn't run on this page.
  async registerAndWaitForRedirect(email: string, password: string): Promise<void> {
    await this.register(email, password);
    await expect(this.page).toHaveURL(/\/login\?registered=1$/);
  }

  async expectError(message: string): Promise<void> {
    await expect(this.alert).toBeVisible();
    await expect(this.alert).toHaveText(message);
  }
}
