import { ProfileViewRepository } from '../../../analytics/domain/repositories/profile-view.repository';
import { ApplicationWithRefs } from '../../domain/repositories/application.repository';
import { ApplicationOutput } from '../dto/application.output';
import { toApplicationOutput } from '../mappers/application.mapper';

/**
 * Salida de varias postulaciones con las aperturas de sus enlaces (D8): **una** llamada a
 * `countOpensByShareLink` con todos los ids no nulos, y ninguna si no hay enlaces. Así la lista
 * cuesta dos consultas sea cual sea la cantidad de filas.
 */
export async function buildApplicationOutputs(
  views: ProfileViewRepository,
  rows: readonly ApplicationWithRefs[],
): Promise<ApplicationOutput[]> {
  const ids = rows.flatMap((row) => (row.shareLink ? [row.shareLink.id] : []));
  const opens = ids.length > 0 ? await views.countOpensByShareLink(ids) : [];
  const byId = new Map(opens.map((entry) => [entry.shareLinkId, entry]));
  return rows.map((row) =>
    toApplicationOutput(row, row.shareLink ? byId.get(row.shareLink.id) : undefined),
  );
}
