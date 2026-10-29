export type CertificationValidity = 'none' | 'valid' | 'expired';

/**
 * Vigencia de una certificación a partir de su `expiresAt` (`AAAA-MM` o `AAAA`), contra `now`
 * (decisión D5 de `add-certification-verification`). Se deriva en el cliente con la fecha del
 * lector: el backend no la calcula. Con `AAAA-MM` vence al terminar ese mes y con `AAAA`, al
 * terminar ese año; un valor ausente o con otro formato no marca nada.
 */
export function certificationValidity(
  expiresAt: string | null | undefined,
  now: Date,
): CertificationValidity {
  if (!expiresAt) return 'none';
  const match = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/.exec(expiresAt);
  if (!match) return 'none';
  const year = Number(match[1]);
  const currentYear = now.getFullYear();
  if (match[2] === undefined) return currentYear > year ? 'expired' : 'valid';
  const month = Number(match[2]);
  const expired = currentYear > year || (currentYear === year && now.getMonth() + 1 > month);
  return expired ? 'expired' : 'valid';
}
