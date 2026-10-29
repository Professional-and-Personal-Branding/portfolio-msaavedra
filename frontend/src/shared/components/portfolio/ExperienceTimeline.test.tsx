import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeCuratedProfile, makeExperience } from '@/test/fixtures/curated-profile';
import { renderWithProviders } from '@/test/render';
import { ThemeProvider } from '@/themes/theme-provider';
import { ExperienceTimeline } from './ExperienceTimeline';

describe('ExperienceTimeline — insignia «Actual» (fix-admin-contrast, D2)', () => {
  it('usa el verde derivado del tema y ningún color literal de Tailwind', () => {
    renderWithProviders(
      <ThemeProvider presetSlug="modern-light">
        <ExperienceTimeline
          data={makeCuratedProfile({
            experiences: [
              makeExperience({ id: 'a', current: true }),
              makeExperience({ id: 'b', current: false, company: 'Initech' }),
            ],
          })}
        />
      </ThemeProvider>,
    );

    const badges = screen.getAllByText('Actual');
    expect(badges).toHaveLength(1);
    const badge = badges[0] as HTMLElement;
    expect(badge).toHaveClass('text-success-ink', 'bg-success/15', 'border-success/30');
    expect(badge.className).not.toMatch(/emerald/);
  });
});
