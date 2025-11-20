import { z } from 'zod';

export const ErgonomicSnapshotEventSchema = z.object({
  event_id: z.string().uuid(),
  event_time: z.string().datetime(),
  ingest_time: z.string().datetime(),
  warehouse_id: z.string().uuid(),
  zone_id: z.string().uuid(),
  camera_id: z.string(),
  worker_id: z.string().uuid().nullable(),
  model_version: z.string(),
  risk_score: z.number().min(0).max(100),
  posture_keypoints: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
  source: z.enum(['camera', 'wearable', 'manual']),
});

export const ShiftSnapshotEventSchema = z.object({
  event_id: z.string().uuid(),
  event_time: z.string().datetime(),
  warehouse_id: z.string().uuid(),
  zone_id: z.string().uuid(),
  worker_id: z.string().uuid().nullable(),
  risk_score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
});

export const AlertEventSchema = z.object({
  alert_id: z.string().uuid(),
  alert_time: z.string().datetime(),
  warehouse_id: z.string().uuid(),
  zone_id: z.string().uuid(),
  worker_id: z.string().uuid().nullable(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  alert_type: z.enum(['high_risk_posture', 'repeated_violation', 'zone_threshold']),
  message: z.string(),
  related_event_ids: z.array(z.string().uuid()),
  metadata: z.record(z.unknown()).optional(),
});

export type ErgonomicSnapshotEvent = z.infer<typeof ErgonomicSnapshotEventSchema>;
export type ShiftSnapshotEvent = z.infer<typeof ShiftSnapshotEventSchema>;
export type AlertEvent = z.infer<typeof AlertEventSchema>;
