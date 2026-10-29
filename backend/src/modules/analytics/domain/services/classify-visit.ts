import { ViewKind } from '../view-kind';
import { classifyUserAgent } from './classify-user-agent';

export interface ClassifyVisitInput {
  /** `true` si la petición traía una sesión de administrador válida. */
  readonly adminSession: boolean;
  readonly userAgent?: string | null;
}

/** Precedencia fija OWNER > BOT > HUMAN (D1): la sesión gana siempre al `User-Agent`. */
export function classifyVisit(input: ClassifyVisitInput): ViewKind {
  if (input.adminSession) return 'OWNER';
  return classifyUserAgent(input.userAgent);
}
