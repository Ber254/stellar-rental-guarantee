import { describe, expect, it } from "vitest";

import { getDictionary } from "@/lib/i18n";
import { renderNotification } from "./notifications";

const row = {
  template: "returnUnilateral",
  params: { actor: "Beto", amount: "300.00", reference: "SFX-2026-000001" },
  title: "Funds returned",
  body: "Beto returned 300.00 USDC from SFX-2026-000001 unilaterally.",
};

describe("renderNotification", () => {
  it("renders the stored template in the reader's language", () => {
    expect(renderNotification(getDictionary("es"), row).body).toBe(
      "Beto devolvió 300.00 USDC de SFX-2026-000001 sin pedir nada a cambio.",
    );
    expect(renderNotification(getDictionary("en"), row).title).toBe("Funds returned");
  });

  it("falls back to the stored text for rows written before templates", () => {
    const legacy = { ...row, template: null, params: null };
    expect(renderNotification(getDictionary("es"), legacy)).toEqual({
      title: row.title,
      body: row.body,
    });
  });

  it("leaves unknown placeholders untouched instead of printing undefined", () => {
    const partial = { ...row, params: { actor: "Beto" } };
    expect(renderNotification(getDictionary("en"), partial).body).toContain("{amount}");
  });
});
