import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { makeCuratedProfileList } from '@/test/fixtures/curated-profile';
import { groupProfilesByRoleType } from './group-profiles';
import { ProfileMenuList } from './ProfileMenu';

describe('groupProfilesByRoleType', () => {
  it('agrupa 14 perfiles por roleType conservando el orden; el perfil sin roleType va primero', () => {
    const groups = groupProfilesByRoleType(makeCuratedProfileList());
    expect(groups.map((g) => g.roleType)).toEqual([
      '',
      'Fullstack',
      'DevOps',
      'Arquitecto',
      'Liderazgo',
      'Tech Lead',
      'Generalista',
      'Backend',
    ]);
    expect(groups.reduce((n, g) => n + g.profiles.length, 0)).toBe(14);
    expect(groups[0]?.profiles.map((p) => p.slug)).toEqual(['all']);
  });
});

describe('ProfileMenuList', () => {
  it('muestra los grupos, el techFocus y resalta el activo', () => {
    render(
      <MemoryRouter initialEntries={['/perfil-3?lang=en&theme=elegant&token=x']}>
        <ProfileMenuList profiles={makeCuratedProfileList()} activeSlug="perfil-3" />
      </MemoryRouter>,
    );

    // La URL lleva lang=en → la interfaz se traduce
    const nav = screen.getByRole('navigation', { name: 'Profiles' });
    expect(within(nav).getAllByRole('heading', { level: 3 })).toHaveLength(8);
    expect(within(nav).getAllByRole('heading', { level: 3 })[0]).toHaveTextContent('Full profile');
    expect(within(nav).getAllByRole('link')).toHaveLength(14);
    expect(within(nav).getByText('Tech 3')).toBeInTheDocument();

    const active = within(nav).getByRole('link', { current: 'page' });
    expect(active).toHaveTextContent('Perfil 3');
    // conserva lang/theme pero no el token
    expect(active).toHaveAttribute('href', '/perfil-3?lang=en&theme=elegant');
    expect(within(nav).getByRole('link', { name: /Perfil completo/ })).toHaveAttribute(
      'href',
      '/?lang=en&theme=elegant',
    );
  });
});
