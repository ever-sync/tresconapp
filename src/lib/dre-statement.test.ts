import test from "node:test";
import assert from "node:assert/strict";

import { buildDreStatement } from "./dre-statement";

test("buildDreStatement sums descendants of configured mapping codes", () => {
  const statement = buildDreStatement({
    year: 2025,
    movements: [
      {
        code: "03.01.01",
        name: "Conta generica",
        level: 3,
        values: [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        type: "dre",
      },
    ],
    chartAccounts: [],
    mappings: [{ account_code: "03.01", category: "Receita Bruta" }],
    activeMonthIndex: 0,
  });

  assert.equal(statement.lines.receitaBruta[0], 100);
  assert.equal(statement.lines.receitaLiquida[0], 100);
});

test("buildDreStatement prioritizes exact configured rows over descendants", () => {
  const statement = buildDreStatement({
    year: 2025,
    movements: [
      {
        code: "03.01",
        name: "Conta sintetica",
        level: 2,
        values: [50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        type: "dre",
      },
      {
        code: "03.01.01",
        name: "Conta analitica",
        level: 3,
        values: [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        type: "dre",
      },
    ],
    chartAccounts: [],
    mappings: [{ account_code: "03.01", category: "Receita Bruta" }],
    activeMonthIndex: 0,
  });

  assert.equal(statement.lines.receitaBruta[0], 50);
});
