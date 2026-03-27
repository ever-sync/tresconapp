import test from "node:test";
import assert from "node:assert/strict";

import { buildPatrimonialStatement } from "./patrimonial-statement";

test("buildPatrimonialStatement sums descendants of configured patrimonial mapping codes", () => {
  const statement = buildPatrimonialStatement({
    year: 2025,
    movements: [
      {
        code: "01.1.08.0001",
        name: "Estoque de Mercadorias",
        level: 4,
        values: [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        type: "patrimonial",
      },
    ],
    chartAccounts: [],
    mappings: [{ account_code: "01.1.08", category: "Estoques" }],
    activeMonthIndex: 0,
  });

  const row = statement.rows.find((item) => item.key === "estoques");

  assert.equal(row?.monthly[0], 100);
  assert.equal(statement.totals.ativoCirculante[0], 100);
});

test("buildPatrimonialStatement prioritizes exact configured rows over descendants", () => {
  const statement = buildPatrimonialStatement({
    year: 2025,
    movements: [
      {
        code: "01.1.08",
        name: "Estoques",
        level: 3,
        values: [50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        type: "patrimonial",
      },
      {
        code: "01.1.08.0001",
        name: "Estoque de Mercadorias",
        level: 4,
        values: [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        type: "patrimonial",
      },
    ],
    chartAccounts: [],
    mappings: [{ account_code: "01.1.08", category: "Estoques" }],
    activeMonthIndex: 0,
  });

  const row = statement.rows.find((item) => item.key === "estoques");

  assert.equal(row?.monthly[0], 50);
});
