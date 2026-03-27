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

test("buildPatrimonialStatement uses DRE mappings for resultado do exercicio when they provide fuller coverage", () => {
  const statement = buildPatrimonialStatement({
    year: 2025,
    movements: [
      {
        code: "01.1.01.0001",
        name: "Disponivel",
        level: 4,
        values: [65, 135, 200, 270],
        type: "patrimonial",
      },
      {
        code: "02.4.04.05",
        name: "Resultado do Exercicio",
        level: 4,
        values: [5, 10, 15, 20],
        type: "patrimonial",
      },
    ],
    dreMovements: [
      {
        code: "03.1.01.0001",
        name: "Receita Bruta",
        level: 4,
        values: [100, 110, 120, 130, 0, 0, 0, 0, 0, 0, 0, 0],
        type: "dre",
      },
      {
        code: "04.1.01.0001",
        name: "Custos e Despesas",
        level: 4,
        values: [40, 50, 70, 80, 0, 0, 0, 0, 0, 0, 0, 0],
        type: "dre",
      },
    ],
    chartAccounts: [],
    mappings: [
      { account_code: "02.4.04.05", category: "Resultado Do Exercicio" },
      { account_code: "03", category: "Resultado Do Exercicio" },
      { account_code: "04", category: "Resultado Do Exercicio" },
    ],
    activeMonthIndex: 3,
  });

  const row = statement.rows.find((item) => item.key === "resultado_exercicio");

  assert.deepEqual(row?.monthly.slice(0, 4), [65, 135, 200, 270]);
  assert.equal(row?.accumulated, 670);
});
