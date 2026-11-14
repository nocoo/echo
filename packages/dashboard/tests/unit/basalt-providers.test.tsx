import { Link } from "@nocoo/basalt/components/link";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import { BasaltProviders } from "../../src/app/BasaltProviders";

afterEach(cleanup);

test("router adapter preserves accessible names, handlers, state and focus refs", () => {
  const onClick = vi.fn();
  const ref = createRef<HTMLAnchorElement>();
  render(
    <MemoryRouter basename="/admin" initialEntries={["/admin/tools"]}>
      <BasaltProviders>
        <Link href="/lookup" aria-label="查询" aria-current="page" onClick={onClick} ref={ref}>
          <span aria-hidden="true">Icon</span>
        </Link>
      </BasaltProviders>
    </MemoryRouter>,
  );
  const link = screen.getByRole("link", { name: "查询" });
  expect(link.getAttribute("href")).toBe("/admin/lookup");
  expect(link.getAttribute("aria-current")).toBe("page");
  expect(ref.current).toBe(link);
  ref.current?.focus();
  expect(document.activeElement).toBe(link);
  fireEvent.click(link);
  expect(onClick).toHaveBeenCalledOnce();
});
