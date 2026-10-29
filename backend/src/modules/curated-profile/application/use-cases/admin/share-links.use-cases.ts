import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock } from '../../../../../shared/domain/clock';
import { ConflictError, NotFoundError, ValidationError } from '../../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../../shared/domain/result';
import {
  PROFILE_VIEW_REPOSITORY,
  ProfileViewRepository,
} from '../../../../analytics/domain/repositories/profile-view.repository';
import { ShareLink, validateNewShareLink } from '../../../domain/entities/share-link.entity';
import { CuratedProfileNotFoundError } from '../../../domain/errors/curated-profile-not-found.error';
import {
  CURATED_PROFILE_REPOSITORY,
  CuratedProfileRepository,
} from '../../../domain/repositories/curated-profile.repository';
import {
  SHARE_LINK_REPOSITORY,
  ShareLinkRepository,
} from '../../../domain/repositories/share-link.repository';
import { ShareLinkOutput, toShareLinkOutput } from '../../dto/share-link.output';
import { SHARE_CODE_GENERATOR, ShareCodeGenerator } from '../../ports/share-code.generator';

/** Intentos al generar un código antes de rendirse (una colisión de 50 bits es casi imposible). */
export const SHARE_CODE_ATTEMPTS = 3;

/** Portal y etiqueta del enlace que reusa «Compartir en LinkedIn» (D12). */
export const LINKEDIN_PORTAL = 'linkedin';
export const LINKEDIN_LABEL = 'Publicación en LinkedIn';

/** El enlace no existe o es de otro perfil: el panel no distingue los dos casos. */
export class ShareLinkNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Enlace de seguimiento', id);
  }
}

/** Lo que comparten los casos de uso: perfil existente, enlace del perfil y aperturas. */
abstract class ShareLinkUseCase {
  protected constructor(
    protected readonly profiles: CuratedProfileRepository,
    protected readonly links: ShareLinkRepository,
    protected readonly views: ProfileViewRepository,
  ) {}

  protected async profileExists(id: string): Promise<boolean> {
    return (await this.profiles.findById(id)) !== null;
  }

  /** El enlace solo existe si pertenece al perfil de la ruta. */
  protected async ownedLink(profileId: string, linkId: string): Promise<ShareLink | null> {
    const link = await this.links.findById(linkId);
    return link && link.belongsTo(profileId) ? link : null;
  }

  protected async toOutput(link: ShareLink): Promise<ShareLinkOutput> {
    const [opens] = await this.views.countOpensByShareLink([link.id]);
    return toShareLinkOutput(link, opens);
  }
}

/** Enlaces del perfil, más recientes primero, con sus aperturas humanas. */
@Injectable()
export class ListShareLinksUseCase {
  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly profiles: CuratedProfileRepository,
    @Inject(SHARE_LINK_REPOSITORY) private readonly links: ShareLinkRepository,
    @Inject(PROFILE_VIEW_REPOSITORY) private readonly views: ProfileViewRepository,
  ) {}

  async execute(input: {
    profileId: string;
  }): Promise<Result<ShareLinkOutput[], CuratedProfileNotFoundError>> {
    if (!(await this.profiles.findById(input.profileId))) {
      return fail(new CuratedProfileNotFoundError(input.profileId));
    }
    const links = await this.links.listByProfile(input.profileId);
    const opens = await this.views.countOpensByShareLink(links.map((link) => link.id));
    const byId = new Map(opens.map((row) => [row.shareLinkId, row]));
    return ok(links.map((link) => toShareLinkOutput(link, byId.get(link.id))));
  }
}

/** Crea un enlace `MANUAL` con un código nuevo; reintenta si el código ya existe. */
@Injectable()
export class CreateShareLinkUseCase extends ShareLinkUseCase {
  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) profiles: CuratedProfileRepository,
    @Inject(SHARE_LINK_REPOSITORY) links: ShareLinkRepository,
    @Inject(PROFILE_VIEW_REPOSITORY) views: ProfileViewRepository,
    @Inject(SHARE_CODE_GENERATOR) private readonly codes: ShareCodeGenerator,
  ) {
    super(profiles, links, views);
  }

  async execute(input: {
    profileId: string;
    label: string;
    portal?: string | null;
  }): Promise<
    Result<ShareLinkOutput, CuratedProfileNotFoundError | ValidationError | ConflictError>
  > {
    if (!(await this.profileExists(input.profileId))) {
      return fail(new CuratedProfileNotFoundError(input.profileId));
    }
    const valid = validateNewShareLink(input);
    if (!valid.ok) return valid;
    const created = await createWithFreshCode(this.links, this.codes, {
      curatedProfileId: input.profileId,
      label: valid.value.label,
      portal: valid.value.portal,
      kind: 'MANUAL',
    });
    if (!created.ok) return created;
    return ok(toShareLinkOutput(created.value));
  }
}

/** Cambia la etiqueta; el código, el portal y el perfil no cambian. */
@Injectable()
export class RenameShareLinkUseCase extends ShareLinkUseCase {
  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) profiles: CuratedProfileRepository,
    @Inject(SHARE_LINK_REPOSITORY) links: ShareLinkRepository,
    @Inject(PROFILE_VIEW_REPOSITORY) views: ProfileViewRepository,
  ) {
    super(profiles, links, views);
  }

  async execute(input: {
    profileId: string;
    linkId: string;
    label: string;
  }): Promise<Result<ShareLinkOutput, ShareLinkNotFoundError | ValidationError>> {
    const link = await this.ownedLink(input.profileId, input.linkId);
    if (!link) return fail(new ShareLinkNotFoundError(input.linkId));
    const renamed = link.rename(input.label);
    if (!renamed.ok) return renamed;
    const saved = await this.links.save(renamed.value);
    if (!saved) return fail(new ShareLinkNotFoundError(input.linkId));
    return ok(await this.toOutput(saved));
  }
}

/** Revoca (irreversible, idempotente): el link sigue abriendo, solo deja de atribuir. */
@Injectable()
export class RevokeShareLinkUseCase extends ShareLinkUseCase {
  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) profiles: CuratedProfileRepository,
    @Inject(SHARE_LINK_REPOSITORY) links: ShareLinkRepository,
    @Inject(PROFILE_VIEW_REPOSITORY) views: ProfileViewRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    super(profiles, links, views);
  }

  async execute(input: {
    profileId: string;
    linkId: string;
  }): Promise<Result<ShareLinkOutput, ShareLinkNotFoundError>> {
    const link = await this.ownedLink(input.profileId, input.linkId);
    if (!link) return fail(new ShareLinkNotFoundError(input.linkId));
    // Ya revocado: no se escribe nada y la fecha original se conserva.
    if (!link.isActive()) return ok(await this.toOutput(link));
    const saved = await this.links.save(link.revoke(this.clock.now()));
    if (!saved) return fail(new ShareLinkNotFoundError(input.linkId));
    return ok(await this.toOutput(saved));
  }
}

export interface LinkedInShareLinkOutput {
  /** true si se creó uno nuevo (201); false si se reusó el activo (200). */
  created: boolean;
  link: ShareLinkOutput;
}

/**
 * El enlace de «Compartir en LinkedIn» (D12): el `LINKEDIN_POST` activo más reciente o uno nuevo.
 * Solo para perfiles `PUBLIC` y no archivados: en otro caso la publicación mostraría un link que
 * no abre (o, si es `PROTECTED`, expondría el token).
 */
@Injectable()
export class GetOrCreateLinkedInShareLinkUseCase extends ShareLinkUseCase {
  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) profiles: CuratedProfileRepository,
    @Inject(SHARE_LINK_REPOSITORY) links: ShareLinkRepository,
    @Inject(PROFILE_VIEW_REPOSITORY) views: ProfileViewRepository,
    @Inject(SHARE_CODE_GENERATOR) private readonly codes: ShareCodeGenerator,
  ) {
    super(profiles, links, views);
  }

  async execute(input: {
    profileId: string;
  }): Promise<Result<LinkedInShareLinkOutput, CuratedProfileNotFoundError | ConflictError>> {
    const profile = await this.profiles.findById(input.profileId);
    if (!profile) return fail(new CuratedProfileNotFoundError(input.profileId));
    if (profile.visibility !== 'PUBLIC' || profile.isArchived) {
      return fail(
        new ConflictError(
          'Enlace de LinkedIn',
          'solo un perfil PUBLIC y no archivado se puede compartir en LinkedIn',
        ),
      );
    }
    const existing = await this.links.findActiveLinkedIn(input.profileId);
    if (existing) return ok({ created: false, link: await this.toOutput(existing) });
    const created = await createWithFreshCode(this.links, this.codes, {
      curatedProfileId: input.profileId,
      label: LINKEDIN_LABEL,
      portal: LINKEDIN_PORTAL,
      kind: 'LINKEDIN_POST',
    });
    if (!created.ok) return created;
    return ok({ created: true, link: toShareLinkOutput(created.value) });
  }
}

/** Genera un código y crea el enlace; ante una colisión reintenta con otro código. */
async function createWithFreshCode(
  links: ShareLinkRepository,
  codes: ShareCodeGenerator,
  props: {
    curatedProfileId: string;
    label: string;
    portal: string | null;
    kind: 'MANUAL' | 'LINKEDIN_POST';
  },
): Promise<Result<ShareLink, ConflictError>> {
  for (let attempt = 0; attempt < SHARE_CODE_ATTEMPTS; attempt += 1) {
    const result = await links.create({ ...props, code: codes.generate() });
    if (result.ok) return result;
  }
  return fail(new ConflictError('Enlace de seguimiento', 'no se pudo generar un código libre'));
}
