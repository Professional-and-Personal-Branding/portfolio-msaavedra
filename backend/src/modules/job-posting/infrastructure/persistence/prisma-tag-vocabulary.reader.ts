import { Injectable } from '@nestjs/common';
import { collectTagVocabulary, TagVocabulary } from '../../../../shared/domain/tag-vocabulary';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { TagVocabularyReader } from '../../domain/repositories/tag-vocabulary.reader';

/**
 * Vocabulario de tags del owner (D12), solo lectura: tags y visibilidad de experiencias,
 * proyectos y skills. Las experiencias y los proyectos ocultos no aportan; las skills siempre.
 */
@Injectable()
export class PrismaTagVocabularyReader implements TagVocabularyReader {
  constructor(private readonly prisma: PrismaService) {}

  async read(): Promise<TagVocabulary> {
    const [experiences, projects, skills] = await Promise.all([
      this.prisma.experience.findMany({ select: { tags: true, visible: true } }),
      this.prisma.project.findMany({ select: { tags: true, visible: true } }),
      this.prisma.skill.findMany({ select: { tags: true } }),
    ]);
    return collectTagVocabulary([
      ...experiences,
      ...projects,
      ...skills.map((skill) => ({ tags: skill.tags, visible: true })),
    ]);
  }
}
