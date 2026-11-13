import { IntegrationSetting } from '../entities/integration-setting.entity';

export const INTEGRATION_SETTING_REPOSITORY = Symbol('INTEGRATION_SETTING_REPOSITORY');

export interface IntegrationSettingRepository {
  /** Devuelve la fila del proveedor y la crea (valores por defecto) si no existía. */
  getOrCreate(provider: string, now: Date): Promise<IntegrationSetting>;
  /** Una consulta para varios proveedores; crea las filas que falten. */
  getOrCreateMany(
    providers: readonly string[],
    now: Date,
  ): Promise<ReadonlyMap<string, IntegrationSetting>>;
  /** Solo pausa, breaker y último éxito: no pisa `enabled` si el panel lo cambió en el medio. */
  saveHealth(setting: IntegrationSetting): Promise<void>;
  /** Solo `enabled`, `enabledSince` y la pausa (kill switch desde el panel). */
  saveEnabled(setting: IntegrationSetting): Promise<void>;
}
