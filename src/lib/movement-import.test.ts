import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";

import {
  buildInvalidMovementFileMessage,
  parseMonthlyBalanceteFile,
  parseMovementFile,
  parseMovementNumber,
} from "./movement-import";

function toWorkbookBuffer(rows: Record<string, unknown>[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
}

test("parseMovementNumber handles brazilian numbers and parenthetical negatives", () => {
  assert.equal(parseMovementNumber("10.678.420,31"), 10678420.31);
  assert.equal(parseMovementNumber("(1.740,69)"), -1740.69);
  assert.equal(parseMovementNumber(""), 0);
  assert.equal(parseMovementNumber("texto"), 0);
});

test("parseMovementFile accepts the official DRE csv-style layout", () => {
  const csv = [
    "Classificacao;Nome da conta contabil;01/2025;02/2025;12/2025",
    "01.1.01.02.0005;BANCO ITAU;(1.740,69);245.583,66;1,00",
  ].join("\n");

  const result = parseMovementFile(new TextEncoder().encode(csv).buffer);

  assert.equal(result.fileError, undefined);
  assert.equal(result.rows.length, 1);
  assert.deepEqual(result.layout.monthColumns, ["01/2025", "02/2025", "12/2025"]);
  assert.equal(result.rows[0]?.code, "01.1.01.02.0005");
  assert.equal(result.rows[0]?.reduced_code, "01.1.01.02.0005");
  assert.equal(result.rows[0]?.name, "BANCO ITAU");
  assert.equal(result.rows[0]?.level, 5);
  assert.equal(result.rows[0]?.values[0], -1740.69);
  assert.equal(result.rows[0]?.values[1], 245583.66);
  assert.equal(result.rows[0]?.values[11], 1);
});

test("parseMovementFile accepts the official comparative csv with accented headers", () => {
  const csv = [
    "Classificação,Nome da conta contábil,01/2025,02/2025,12/2025",
    '01.01,ATIVO CIRCULANTE,"7.492.855,31","7.449.119,01","5.492.650,63"',
  ].join("\n");

  const result = parseMovementFile(new TextEncoder().encode(csv).buffer);

  assert.equal(result.fileError, undefined);
  assert.equal(result.rows.length, 1);
  assert.equal(result.layout.codeColumn, "ClassificaÃ§Ã£o");
  assert.equal(result.layout.nameColumn, "Nome da conta contÃ¡bil");
  assert.equal(result.rows[0]?.code, "01.01");
  assert.equal(result.rows[0]?.name, "ATIVO CIRCULANTE");
  assert.equal(result.rows[0]?.values[0], 7492855.31);
  assert.equal(result.rows[0]?.values[1], 7449119.01);
  assert.equal(result.rows[0]?.values[11], 5492650.63);
});

test("parseMovementFile infers level when no level column exists", () => {
  const buffer = toWorkbookBuffer([
    {
      Classificacao: "01.1.01.02.0005",
      "Nome da conta contabil": "BANCO ITAU",
      "01/2025": "10,00",
    },
  ]);

  const result = parseMovementFile(buffer);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.level, 5);
});

test("parseMovementFile preserves legacy month aliases and forceType", () => {
  const buffer = toWorkbookBuffer([
    {
      Codigo: "03.01",
      Nome: "Receita Bruta",
      Jan: "100,00",
      Fevereiro: "250,00",
    },
  ]);

  const result = parseMovementFile(buffer, { forceType: "patrimonial" });

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.type, "patrimonial");
  assert.equal(result.rows[0]?.values[0], 100);
  assert.equal(result.rows[0]?.values[1], 250);
});

test("parseMovementFile accepts english month-year headers from comparative workbooks", () => {
  const buffer = toWorkbookBuffer([
    {
      Classificacao: "03.01",
      "Nome da conta contabil": "Receita Bruta",
      "Jan-25": "100,00",
      "Feb-25": "250,00",
      "Apr-25": "75,50",
      "May-25": "90,00",
      "Aug-25": "33,00",
      "Oct-25": "10,00",
      "Dec-25": "999,00",
    },
  ]);

  const result = parseMovementFile(buffer);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.values[0], 100);
  assert.equal(result.rows[0]?.values[1], 250);
  assert.equal(result.rows[0]?.values[3], 75.5);
  assert.equal(result.rows[0]?.values[4], 90);
  assert.equal(result.rows[0]?.values[7], 33);
  assert.equal(result.rows[0]?.values[9], 10);
  assert.equal(result.rows[0]?.values[11], 999);
});

test("parseMonthlyBalanceteFile reads saldo atual into the selected month", () => {
  const csv = [
    "CONTA;CLASSIFICACAO;NOME DA CONTA CONTABIL;SALDO ANTERIOR;DEBITO;CREDITO;SALDO ATUAL",
    "10013;01.1.01.02.0005;BANCO ITAU;2.555.617,97D;50.365.325,18;51.689.103,44;1.231.839,71D",
  ].join("\n");

  const result = parseMonthlyBalanceteFile(new TextEncoder().encode(csv).buffer, 2);

  assert.equal(result.fileError, undefined);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.code, "01.1.01.02.0005");
  assert.equal(result.rows[0]?.reduced_code, "10013");
  assert.equal(result.rows[0]?.type, "patrimonial");
  assert.equal(result.rows[0]?.values[2], 1231839.71);
  assert.equal(result.rows[0]?.values[1], 0);
});

test("buildInvalidMovementFileMessage explains the expected layout", () => {
  const message = buildInvalidMovementFileMessage({
    codeColumn: null,
    nameColumn: "Descricao",
    monthColumns: [],
  });

  assert.match(message, /layout nao foi reconhecido/i);
  assert.match(message, /01\/2025/i);
});
