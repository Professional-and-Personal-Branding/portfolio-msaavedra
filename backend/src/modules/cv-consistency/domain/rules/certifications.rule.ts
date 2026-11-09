import { CvIssue, CvRuleContext, issue } from '../cv-issue';
import { CvSnapshot } from '../cv-snapshot';

const EXPIRES_AT = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/;

/**
 * `certification.expired` (info, D4): certificación visible con `expiresAt` anterior a
 * `asOf`. Misma regla que `certificationValidity` del cliente: `AAAA-MM` vence al terminar ese
 * mes y `AAAA`, al terminar ese año. Un formato inválido lo reporta `date.invalid-format`.
 */
export function certificationsRule(snapshot: CvSnapshot, ctx: CvRuleContext): CvIssue[] {
  const asOf = EXPIRES_AT.exec(ctx.asOf);
  if (asOf === null || asOf[2] === undefined) return [];
  const asOfYear = Number(asOf[1]);
  const asOfMonth = Number(asOf[2]);

  const found: CvIssue[] = [];
  for (const c of snapshot.certifications) {
    if (!c.visible || c.expiresAt === null) continue;
    const match = EXPIRES_AT.exec(c.expiresAt);
    if (match === null) continue;
    const year = Number(match[1]);
    const expired =
      match[2] === undefined
        ? asOfYear > year
        : asOfYear > year || (asOfYear === year && asOfMonth > Number(match[2]));
    if (expired) {
      found.push(
        issue('certification.expired', 'certification', c.id, 'expiresAt', {
          expiresAt: c.expiresAt,
        }),
      );
    }
  }
  return found;
}
