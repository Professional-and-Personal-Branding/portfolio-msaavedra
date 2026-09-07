import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { NewSkillCategoryProps, SkillCategory } from '../../domain/entities/skill-category.entity';
import { NewSkillProps, Skill } from '../../domain/entities/skill.entity';
import { SkillCategoryRepository } from '../../domain/repositories/skill-category.repository';
import { toSkillCategoryEntity, toSkillEntity } from './skill-category.prisma-mapper';

const INCLUDE_SKILLS = { skills: { orderBy: { order: 'asc' as const } } };

function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

@Injectable()
export class PrismaSkillCategoryRepository implements SkillCategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<SkillCategory[]> {
    const records = await this.prisma.skillCategory.findMany({
      include: INCLUDE_SKILLS,
      orderBy: { order: 'asc' },
    });
    return records.map(toSkillCategoryEntity);
  }

  async findById(id: string): Promise<SkillCategory | null> {
    const record = await this.prisma.skillCategory.findUnique({
      where: { id },
      include: INCLUDE_SKILLS,
    });
    return record ? toSkillCategoryEntity(record) : null;
  }

  async create(props: NewSkillCategoryProps): Promise<SkillCategory> {
    const record = await this.prisma.skillCategory.create({
      data: { name: props.name, order: props.order },
      include: INCLUDE_SKILLS,
    });
    return toSkillCategoryEntity(record);
  }

  async update(category: SkillCategory): Promise<SkillCategory | null> {
    try {
      const record = await this.prisma.skillCategory.update({
        where: { id: category.id },
        data: { name: category.name, order: category.order },
        include: INCLUDE_SKILLS,
      });
      return toSkillCategoryEntity(record);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.skillCategory.delete({ where: { id } }); // onDelete: Cascade en skills
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }

  async findSkillById(id: string): Promise<Skill | null> {
    const record = await this.prisma.skill.findUnique({ where: { id } });
    return record ? toSkillEntity(record) : null;
  }

  async createSkill(categoryId: string, props: NewSkillProps): Promise<Skill> {
    const record = await this.prisma.skill.create({
      data: { categoryId, name: props.name, tags: [...props.tags], order: props.order },
    });
    return toSkillEntity(record);
  }

  async updateSkill(skill: Skill): Promise<Skill | null> {
    try {
      const record = await this.prisma.skill.update({
        where: { id: skill.id },
        data: {
          name: skill.name,
          tags: [...skill.tags],
          order: skill.order,
          ...(skill.categoryId ? { categoryId: skill.categoryId } : {}),
        },
      });
      return toSkillEntity(record);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async deleteSkill(id: string): Promise<boolean> {
    try {
      await this.prisma.skill.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }
}
