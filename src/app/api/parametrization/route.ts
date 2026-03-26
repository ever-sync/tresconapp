import { NextRequest } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-guard";
import { success, error, handleError } from "@/lib/api-response";
import { resolveDreCategory } from "@/lib/dre-statement";
import { resolvePatrimonialCategory } from "@/lib/patrimonial-statement";

const actionSchema = z.enum([
  "add-mapping",
  "remove-mapping",
  "remove-mappings",
  "import-base",
  "auto-classify",
  "sync",
]);
const kindSchema = z.enum(["dre", "patrimonial", "dfc"]);

const bodySchema = z.object({
  action: actionSchema,
  kind: kindSchema,
  sourceClientId: z.string().uuid().optional(),
  accountCode: z.string().trim().optional(),
  accountCodes: z.array(z.string().trim()).optional(),
  target: z.string().trim().optional(),
});

async function findChartAccount(accountingId: string, code: string) {
  return prisma.chartOfAccounts.findFirst({
    where: {
      accounting_id: accountingId,
      OR: [
        { code },
        { reduced_code: code },
        { name: { contains: code, mode: "insensitive" } },
      ],
    },
  });
}

async function listGlobalAccounts(accountingId: string) {
  return prisma.chartOfAccounts.findMany({
    where: {
      accounting_id: accountingId,
      client_id: null,
    },
    orderBy: [{ level: "asc" }, { code: "asc" }],
  });
}

async function recomputeChartAccountsState(
  accountingId: string,
  accountIds: string[]
) {
  if (accountIds.length === 0) {
    return 0;
  }

  const accounts = await prisma.chartOfAccounts.findMany({
    where: {
      accounting_id: accountingId,
      client_id: null,
      id: { in: accountIds },
    },
    select: {
      id: true,
      code: true,
    },
  });

  if (accounts.length === 0) {
    return 0;
  }

  const codes = accounts.map((account) => account.code);
  const [dreMappings, patrimonialMappings, dfcMappings] = await Promise.all([
    prisma.dREMapping.findMany({
      where: {
        accounting_id: accountingId,
        client_id: null,
        account_code: { in: codes },
      },
      select: {
        account_code: true,
        category: true,
      },
    }),
    prisma.patrimonialMapping.findMany({
      where: {
        accounting_id: accountingId,
        client_id: null,
        account_code: { in: codes },
      },
      select: {
        account_code: true,
        category: true,
      },
    }),
    prisma.dFCLineMapping.findMany({
      where: {
        accounting_id: accountingId,
        client_id: null,
        chart_account_id: { in: accountIds },
      },
      select: {
        chart_account_id: true,
      },
    }),
  ]);

  const dreByCode = new Map(dreMappings.map((mapping) => [mapping.account_code, mapping.category]));
  const patrimonialByCode = new Map(
    patrimonialMappings.map((mapping) => [mapping.account_code, mapping.category])
  );
  const dfcIds = new Set(dfcMappings.map((mapping) => mapping.chart_account_id));

  for (const account of accounts) {
    const dreCategory = dreByCode.get(account.code) ?? null;
    const patrimonialCategory = patrimonialByCode.get(account.code) ?? null;
    const hasDfcMapping = dfcIds.has(account.id);

    await prisma.chartOfAccounts.update({
      where: { id: account.id },
      data: {
        report_type: dreCategory ? "dre" : patrimonialCategory ? "patrimonial" : null,
        report_category: dreCategory ?? patrimonialCategory ?? null,
        is_mapped: Boolean(dreCategory || patrimonialCategory || hasDfcMapping),
      },
    });
  }

  return accounts.length;
}

function buildMovementLike(account: {
  code: string;
  reduced_code: string | null;
  name: string;
  level: number;
  report_category: string | null;
  report_type: string | null;
}) {
  return {
    code: account.code,
    reduced_code: account.reduced_code,
    name: account.name,
    level: account.level,
    values: Array.from({ length: 12 }, () => 0),
    type: "dre" as const,
    category: null,
  };
}

function buildPatrimonialLike(account: {
  code: string;
  reduced_code: string | null;
  name: string;
  level: number;
  report_category: string | null;
  report_type: string | null;
}) {
  return {
    code: account.code,
    reduced_code: account.reduced_code,
    name: account.name,
    level: account.level,
    values: Array.from({ length: 12 }, () => 0),
    type: "patrimonial" as const,
    category: null,
  };
}

async function syncGlobalFlags(accountingId: string) {
  const [dreMappings, patrimonialMappings, dfcMappings] = await Promise.all([
    prisma.dREMapping.findMany({
      where: {
        accounting_id: accountingId,
        client_id: null,
      },
      select: {
        account_code: true,
        category: true,
      },
    }),
    prisma.patrimonialMapping.findMany({
      where: {
        accounting_id: accountingId,
        client_id: null,
      },
      select: {
        account_code: true,
        category: true,
      },
    }),
    prisma.dFCLineMapping.findMany({
      where: {
        accounting_id: accountingId,
        client_id: null,
      },
      select: {
        chart_account_id: true,
      },
    }),
  ]);

  await prisma.chartOfAccounts.updateMany({
    where: {
      accounting_id: accountingId,
      client_id: null,
    },
    data: {
      report_category: null,
      is_mapped: false,
    },
  });

  for (const mapping of dreMappings) {
    await prisma.chartOfAccounts.updateMany({
      where: {
        accounting_id: accountingId,
        client_id: null,
        code: mapping.account_code,
      },
      data: {
        report_type: "dre",
        report_category: mapping.category,
        is_mapped: true,
      },
    });
  }

  for (const mapping of patrimonialMappings) {
    await prisma.chartOfAccounts.updateMany({
      where: {
        accounting_id: accountingId,
        client_id: null,
        code: mapping.account_code,
      },
      data: {
        report_type: "patrimonial",
        report_category: mapping.category,
        is_mapped: true,
      },
    });
  }

  const dfcIds = dfcMappings.map((mapping) => mapping.chart_account_id);
  if (dfcIds.length > 0) {
    await prisma.chartOfAccounts.updateMany({
      where: {
        accounting_id: accountingId,
        client_id: null,
        id: { in: dfcIds },
      },
      data: {
        is_mapped: true,
      },
    });
  }

  return {
    dre: dreMappings.length,
    patrimonial: patrimonialMappings.length,
    dfc: dfcMappings.length,
  };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaff();
    const body = bodySchema.parse(await request.json());

    if (body.action === "add-mapping") {
      if (!body.accountCode || !body.target) {
        return error("Conta e destino sao obrigatorios", 400);
      }

      const chartAccount = await findChartAccount(auth.accountingId, body.accountCode);
      if (!chartAccount) {
        return error("Conta nao encontrada", 404);
      }

      if (body.kind === "dfc") {
        await prisma.dFCLineMapping.deleteMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
            line_key: body.target,
            chart_account_id: chartAccount.id,
          },
        });

        const mapping = await prisma.dFCLineMapping.create({
          data: {
            accounting_id: auth.accountingId,
            client_id: null,
            line_key: body.target,
            chart_account_id: chartAccount.id,
            account_code_snapshot: chartAccount.code,
            reduced_code_snapshot: chartAccount.reduced_code,
            source_type: chartAccount.report_type ?? "manual",
            multiplier: 1,
            include_children: true,
          },
        });

        await recomputeChartAccountsState(auth.accountingId, [chartAccount.id]);

        return success({
          mapping: {
            id: mapping.id,
            line_key: mapping.line_key,
            account_code_snapshot: mapping.account_code_snapshot,
          },
        });
      }

      const category = body.target;

      if (body.kind === "dre") {
        await prisma.dREMapping.deleteMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
            account_code: chartAccount.code,
          },
        });

        await prisma.dREMapping.create({
          data: {
            accounting_id: auth.accountingId,
            client_id: null,
            account_code: chartAccount.code,
            account_name: chartAccount.name,
            category,
          },
        });
      } else {
        await prisma.patrimonialMapping.deleteMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
            account_code: chartAccount.code,
          },
        });

        await prisma.patrimonialMapping.create({
          data: {
            accounting_id: auth.accountingId,
            client_id: null,
            account_code: chartAccount.code,
            account_name: chartAccount.name,
            category,
          },
        });
      }

      await recomputeChartAccountsState(auth.accountingId, [chartAccount.id]);

      return success({
        mapping: {
          account_code: chartAccount.code,
          account_name: chartAccount.name,
          category,
        },
      });
    }

    if (body.action === "remove-mapping") {
      const accountCodes = body.accountCodes?.length
        ? body.accountCodes
        : body.accountCode
          ? [body.accountCode]
          : [];

      if (accountCodes.length === 0) {
        return error("Conta obrigatoria", 400);
      }

      const chartAccounts = await prisma.chartOfAccounts.findMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: null,
          OR: accountCodes.flatMap((code) => [{ code }, { reduced_code: code }]),
        },
        select: { id: true, code: true },
      });

      if (chartAccounts.length === 0) {
        return error("Conta nao encontrada", 404);
      }

      if (body.kind === "dfc") {
        if (!body.target) {
          return error("Linha de DFC obrigatoria", 400);
        }

        const ids = chartAccounts.map((account) => account.id);
        await prisma.dFCLineMapping.deleteMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
            line_key: body.target,
            chart_account_id: { in: ids },
          },
        });

        await recomputeChartAccountsState(auth.accountingId, ids);

        return success({
          removed: true,
          removed_count: ids.length,
        });
      }

      if (body.kind === "dre") {
        await prisma.dREMapping.deleteMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
            account_code: { in: accountCodes },
          },
        });
      } else {
        await prisma.patrimonialMapping.deleteMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
            account_code: { in: accountCodes },
          },
        });
      }

      await recomputeChartAccountsState(
        auth.accountingId,
        chartAccounts.map((account) => account.id)
      );

      return success({
        removed: true,
        removed_count: chartAccounts.length,
      });
    }

    if (body.action === "import-base") {
      if (body.kind === "dfc") {
        const sourceMappings = body.sourceClientId
          ? await prisma.dFCLineMapping.findMany({
              where: {
                accounting_id: auth.accountingId,
                client_id: body.sourceClientId,
              },
            })
          : [];

        const globalAccounts = await listGlobalAccounts(auth.accountingId);
        const byCode = new Map(globalAccounts.map((account) => [account.code, account]));

        const records = sourceMappings
          .map((mapping) => {
            const account =
              byCode.get(mapping.account_code_snapshot) ??
              globalAccounts.find(
                (item) => item.reduced_code && item.reduced_code === mapping.reduced_code_snapshot
              );
            if (!account) return null;
            return {
              accounting_id: auth.accountingId,
              client_id: null,
              line_key: mapping.line_key,
              chart_account_id: account.id,
              account_code_snapshot: account.code,
              reduced_code_snapshot: account.reduced_code,
              source_type: mapping.source_type,
              multiplier: mapping.multiplier,
              include_children: mapping.include_children,
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item));

        await prisma.dFCLineMapping.deleteMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
          },
        });

        if (records.length > 0) {
          await prisma.dFCLineMapping.createMany({ data: records });
        }

        await recomputeChartAccountsState(
          auth.accountingId,
          records.map((record) => record.chart_account_id)
        );
        return success({ imported: records.length });
      }

      const sourceMappings =
        body.kind === "dre"
          ? body.sourceClientId
            ? await prisma.dREMapping.findMany({
                where: {
                  accounting_id: auth.accountingId,
                  client_id: body.sourceClientId,
                },
              })
            : []
          : body.sourceClientId
            ? await prisma.patrimonialMapping.findMany({
                where: {
                  accounting_id: auth.accountingId,
                  client_id: body.sourceClientId,
                },
              })
            : [];

      const globalAccounts = await listGlobalAccounts(auth.accountingId);
      const records =
        sourceMappings.length > 0
          ? sourceMappings.map((mapping) => ({
              accounting_id: auth.accountingId,
              client_id: null,
              account_code: mapping.account_code,
              account_name: mapping.account_name,
              category: mapping.category,
            }))
          : globalAccounts
              .map((account) => {
                const category =
                  body.kind === "dre"
                    ? resolveDreCategory({
                        movement: buildMovementLike(account),
                        chartAccount: account,
                        mapping: null,
                      })
                    : resolvePatrimonialCategory({
                        movement: buildPatrimonialLike(account),
                        chartAccount: account,
                        mapping: null,
                      });

                if (!category) return null;

                return {
                  accounting_id: auth.accountingId,
                  client_id: null,
                  account_code: account.code,
                  account_name: account.name,
                  category,
                };
              })
              .filter((item): item is NonNullable<typeof item> => Boolean(item));

      if (body.kind === "dre") {
        await prisma.dREMapping.deleteMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
          },
        });
        if (records.length > 0) {
          await prisma.dREMapping.createMany({ data: records });
        }
      } else {
        await prisma.patrimonialMapping.deleteMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
          },
        });
        if (records.length > 0) {
          await prisma.patrimonialMapping.createMany({ data: records });
        }
      }

      const synced = await syncGlobalFlags(auth.accountingId);
      return success({ imported: records.length, synced });
    }

    if (body.action === "auto-classify") {
      if (body.kind === "dfc") {
        return success({ imported: 0 });
      }

      const existing =
        body.kind === "dre"
          ? await prisma.dREMapping.findMany({
              where: {
                accounting_id: auth.accountingId,
                client_id: null,
              },
            })
          : await prisma.patrimonialMapping.findMany({
              where: {
                accounting_id: auth.accountingId,
                client_id: null,
              },
            });

      const existingCodes = new Set(existing.map((item) => item.account_code));
      const globalAccounts = await listGlobalAccounts(auth.accountingId);
      const records = globalAccounts
        .filter((account) => !existingCodes.has(account.code))
        .map((account) => {
          const category =
            body.kind === "dre"
              ? resolveDreCategory({
                  movement: buildMovementLike(account),
                  chartAccount: account,
                  mapping: null,
                })
              : resolvePatrimonialCategory({
                  movement: buildPatrimonialLike(account),
                  chartAccount: account,
                  mapping: null,
                });

          if (!category) return null;

          return {
            accounting_id: auth.accountingId,
            client_id: null,
            account_code: account.code,
            account_name: account.name,
            category,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      if (records.length > 0) {
        if (body.kind === "dre") {
          await prisma.dREMapping.createMany({ data: records });
        } else {
          await prisma.patrimonialMapping.createMany({ data: records });
        }
      }

      const synced = await syncGlobalFlags(auth.accountingId);
      return success({ imported: records.length, synced });
    }

      const synced = await syncGlobalFlags(auth.accountingId);
      return success({ synced });
  } catch (err) {
    return handleError(err);
  }
}
