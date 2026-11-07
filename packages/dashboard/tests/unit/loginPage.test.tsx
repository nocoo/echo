import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, test } from "vitest";
import { BasaltProviders } from "../../src/app/BasaltProviders";
import LoginPage from "../../src/app/login/LoginPage";

afterEach(() => {
  cleanup();
});

function renderLogin(entry = "/admin/login") {
  return render(
    <MemoryRouter basename="/admin" initialEntries={[entry]}>
      <BasaltProviders>
        <LoginPage />
      </BasaltProviders>
    </MemoryRouter>,
  );
}

describe("login page", () => {
  test("renders the badge card with the google action", () => {
    renderLogin();

    expect(screen.getByRole("button", { name: "使用 Google 登录" })).toBeTruthy();
    expect(screen.getByText("仅限白名单邮箱可登录")).toBeTruthy();
    expect(screen.getByAltText("", { exact: true })).toBeTruthy();
  });

  test("explains a rejected sign in", () => {
    renderLogin("/admin/login?error=access_denied");

    expect(screen.getByText("该邮箱不在白名单内。")).toBeTruthy();
  });

  test("falls back for an unknown error code", () => {
    renderLogin("/admin/login?error=unexpected");

    expect(screen.getByText("登录失败，请重试。")).toBeTruthy();
  });
});
