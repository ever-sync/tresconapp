import { z } from "zod";

// ── Common validators ──────────────────────────────────────

export const cnpjSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 14, "CNPJ deve ter 14 dígitos");

export const emailSchema = z.string().email("Email inválido").toLowerCase().trim();

export const passwordSchema = z
  .string()
  .min(8, "Senha deve ter no mínimo 8 caracteres")
  .max(128, "Senha muito longa")
  .regex(/[A-Z]/, "Senha deve conter pelo menos uma letra maiúscula")
  .regex(/[a-z]/, "Senha deve conter pelo menos uma letra minúscula")
  .regex(/[0-9]/, "Senha deve conter pelo menos um número");

export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length >= 10 && v.length <= 11, "Telefone inválido")
  .optional();

// ── Auth schemas ───────────────────────────────────────────

export const registerSchema = z.object({
  accountingName: z.string().min(2, "Nome da contabilidade é obrigatório"),
  cnpj: cnpjSchema,
  email: emailSchema,
  password: passwordSchema,
  userName: z.string().min(2, "Nome do usuário é obrigatório"),
  phone: phoneSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Senha é obrigatória"),
});

export const clientLoginSchema = z.object({
  cnpj: cnpjSchema,
  password: z.string().min(1, "Senha é obrigatória"),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

// ── Client schemas ─────────────────────────────────────────

export const createClientSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  cnpj: cnpjSchema,
  email: emailSchema.optional(),
  phone: phoneSchema,
  industry: z.string().optional(),
  address: z.string().optional(),
  tax_regime: z.enum(["simples", "presumido", "real", "mei"]).optional(),
  representative_name: z.string().optional(),
  representative_email: emailSchema.optional(),
  password: passwordSchema.optional(),
});

export const updateClientSchema = createClientSchema.partial();

// ── User schemas ───────────────────────────────────────────

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["admin", "collaborator"]).default("collaborator"),
  phone: phoneSchema,
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true });

// ── Type exports ───────────────────────────────────────────

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ClientLoginInput = z.infer<typeof clientLoginSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
