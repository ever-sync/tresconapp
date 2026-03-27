export const DFC_BALANCETE_IMPORT_KIND_PREFIX = "client_dfc_balancete_month_";

export function getDfcBalanceteImportKind(monthIndex: number) {
  return `${DFC_BALANCETE_IMPORT_KIND_PREFIX}${monthIndex + 1}`;
}

export function parseDfcBalanceteImportMonth(kind: string) {
  if (!kind.startsWith(DFC_BALANCETE_IMPORT_KIND_PREFIX)) {
    return null;
  }

  const rawMonth = Number.parseInt(kind.slice(DFC_BALANCETE_IMPORT_KIND_PREFIX.length), 10);
  if (!Number.isInteger(rawMonth) || rawMonth < 1 || rawMonth > 12) {
    return null;
  }

  return rawMonth - 1;
}
