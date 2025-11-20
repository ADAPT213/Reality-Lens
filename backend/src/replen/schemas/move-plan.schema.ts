import { z } from 'zod';

export const MovePlanTypeSchema = z.enum([
  'NIGHTLY',
  'IN_SHIFT_SPIKE',
  'EMERGENCY',
  'OPTIMIZATION',
]);
export const MoveStatusSchema = z.enum([
  'PENDING',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
]);

export const QuantitySchema = z.object({
  pallets: z.number().optional(),
  cartons: z.number().optional(),
  units: z.number().optional(),
});

export const AffectedClientSchema = z.object({
  clientId: z.string(),
  clientName: z.string().optional(),
  orderCount: z.number(),
  dailyVolume: z.number().optional(),
});

export const ExpectedGainSchema = z.object({
  secondsPerPickSaved: z.number(),
  ergonomicRiskReduction: z.number(),
  affectedClients: z.array(AffectedClientSchema),
  dailyOrderImpact: z.number(),
  walkingDistanceSavedFeet: z.number().optional(),
  congestionReduction: z.number().optional(),
});

export const ActualImpactSchema = z.object({
  secondsPerPickSaved: z.number().optional(),
  ergonomicRiskReduction: z.number().optional(),
  implementationTime: z.number().optional(),
  notes: z.string().optional(),
});

export const CreateMovePlanSchema = z.object({
  warehouseId: z.string().uuid(),
  planType: MovePlanTypeSchema,
  priorityRank: z.number().int().positive(),
  skuId: z.string().uuid(),
  skuCode: z.string(),
  fromLocationId: z.string().uuid(),
  fromLocationLabel: z.string(),
  toLocationId: z.string().uuid(),
  toLocationLabel: z.string(),
  quantity: QuantitySchema,
  effortMinutes: z.number().int().positive(),
  expectedGain: ExpectedGainSchema,
  reasoning: z.string(),
  scheduledFor: z.string().datetime().optional(),
});

export const CompleteMovePlanSchema = z.object({
  actualImpact: ActualImpactSchema.optional(),
  notes: z.string().optional(),
});

export type MovePlanType = z.infer<typeof MovePlanTypeSchema>;
export type MoveStatus = z.infer<typeof MoveStatusSchema>;
export type Quantity = z.infer<typeof QuantitySchema>;
export type AffectedClient = z.infer<typeof AffectedClientSchema>;
export type ExpectedGain = z.infer<typeof ExpectedGainSchema>;
export type ActualImpact = z.infer<typeof ActualImpactSchema>;
export type CreateMovePlan = z.infer<typeof CreateMovePlanSchema>;
export type CompleteMovePlan = z.infer<typeof CompleteMovePlanSchema>;
