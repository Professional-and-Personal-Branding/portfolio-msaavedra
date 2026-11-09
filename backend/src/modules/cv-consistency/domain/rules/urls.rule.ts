import { isHttpsUrl, isHttpUrl } from '../../../../shared/domain/http-url';
import { CvIssue, CvRuleContext, issue } from '../cv-issue';
import { CvSnapshot } from '../cv-snapshot';

/**
 * Reglas de URLs (D4), sobre ítems visibles u ocultos. `url.invalid` es `error`: la URL no es
 * parseable o no es http(s) (en `verificationUrl` de una certificación, cualquiera que no sea
 * https, como `validateCertification`). `url.not-https` es `warning`: un `http:` válido en un
 * proyecto o un enlace.
 */
export function urlsRule(snapshot: CvSnapshot, _ctx: CvRuleContext): CvIssue[] {
  const found: CvIssue[] = [];

  for (const c of snapshot.certifications) {
    if (c.verificationUrl !== null && !isHttpsUrl(c.verificationUrl)) {
      found.push(issue('url.invalid', 'certification', c.id, 'verificationUrl'));
    }
  }

  const checkHttp = (
    entityType: 'project' | 'socialLink',
    id: string,
    url: string | null,
  ): void => {
    if (url === null) return;
    if (!isHttpUrl(url)) found.push(issue('url.invalid', entityType, id, 'url'));
    else if (!isHttpsUrl(url)) found.push(issue('url.not-https', entityType, id, 'url'));
  };
  for (const p of snapshot.projects) checkHttp('project', p.id, p.url);
  for (const s of snapshot.socialLinks) checkHttp('socialLink', s.id, s.url);

  return found;
}
