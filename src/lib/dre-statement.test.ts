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

test("buildDreStatement includes Outras Despesas in DRE calculations", () => {
  const statement = buildDreStatement({
    year: 2025,
    movements: [
      {
        code: "09.01",
        name: "Despesa eventual",
        level: 2,
        values: [30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        type: "dre",
      },
    ],
    chartAccounts: [],
    mappings: [{ account_code: "09.01", category: "Outras Despesas" }],
    activeMonthIndex: 0,
  });

  assert.equal(statement.lines.outrasDespesas[0], -30);
  assert.equal(statement.lines.lair[0], -30);
});

test("buildDreStatement preserves the source sign for mapped DRE rows", () => {
  const statement = buildDreStatement({
    year: 2025,
    movements: [
      {
        code: "07.01",
        name: "Recuperacao comercial",
        level: 2,
        values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 13536, 0, 0],
        type: "dre",
      },
    ],
    chartAccounts: [],
    mappings: [{ account_code: "07.01", category: "Despesas Comerciais" }],
    activeMonthIndex: 9,
  });

  assert.equal(statement.lines.despesasComerciais[9], 13536);
  assert.equal(statement.lines.lair[9], 13536);
});
