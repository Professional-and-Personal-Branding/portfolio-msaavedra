interface SectionHeadingProps {
  eyebrow: string;
  title: string;
}

export function SectionHeading({ eyebrow, title }: SectionHeadingProps) {
  return (
    <header className="mb-8">
      <p className="mb-1 text-xs font-bold tracking-[0.15em] text-brand-ink uppercase">{eyebrow}</p>
      <h2 className="text-3xl font-extrabold tracking-tight">{title}</h2>
    </header>
  );
}
