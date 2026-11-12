import { htmlToText } from './html-to-text';
import {
  detectLanguage,
  detectWorkplaceType,
  extractFromPastedText,
  pastedSourceKey,
} from './extract-from-pasted-text';

describe('extractFromPastedText (D6)', () => {
  const text =
    'Tech Lead Backend\nBuscamos un líder para nuestro equipo.\nModalidad híbrida, dos días remoto.';

  it('toma el título del argumento o de la primera línea no vacía', () => {
    expect(extractFromPastedText({ text }).title).toBe('Tech Lead Backend');
    expect(extractFromPastedText({ text: `\n\n  ${text}` }).title).toBe('Tech Lead Backend');
    expect(extractFromPastedText({ text, title: ' Otro puesto ' }).title).toBe('Otro puesto');
  });

  it('recorta el título a 200 caracteres', () => {
    expect(extractFromPastedText({ text: 'x'.repeat(300) }).title).toHaveLength(200);
  });

  it('«Modalidad híbrida, dos días remoto» es HYBRID (HYBRID > REMOTE > ONSITE)', () => {
    expect(detectWorkplaceType('Modalidad híbrida, dos días remoto')).toBe('HYBRID');
    expect(detectWorkplaceType('Hybrid: 3 days on-site, 2 remote')).toBe('HYBRID');
    expect(detectWorkplaceType('100% remote')).toBe('REMOTE');
    expect(detectWorkplaceType('Trabajo remoto, oficina opcional presencial')).toBe('REMOTE');
    expect(detectWorkplaceType('Modalidad presencial en Buenos Aires')).toBe('ONSITE');
    expect(detectWorkplaceType('On-site in our HQ')).toBe('ONSITE');
    expect(detectWorkplaceType('Sin modalidad indicada')).toBeNull();
  });

  it('detecta el tipo de empleo', () => {
    expect(extractFromPastedText({ text: 'Full-time, Buenos Aires' }).employmentType).toBe(
      'full-time',
    );
    expect(extractFromPastedText({ text: 'Jornada de tiempo completo' }).employmentType).toBe(
      'full-time',
    );
    expect(extractFromPastedText({ text: 'Part time' }).employmentType).toBe('part-time');
    expect(extractFromPastedText({ text: 'Contrato freelance por proyecto' }).employmentType).toBe(
      'contract',
    );
    expect(extractFromPastedText({ text: 'Sin datos' }).employmentType).toBeNull();
  });

  it('detecta el idioma por palabras vacías: es, en y null cuando no hay el doble', () => {
    expect(
      detectLanguage('Buscamos un equipo con experiencia en el desarrollo de los servicios'),
    ).toBe('es');
    expect(detectLanguage('We are looking for a team with the experience of our engineers')).toBe(
      'en',
    );
    expect(detectLanguage('de the la of el and en to')).toBeNull();
    expect(detectLanguage('12345 ???')).toBeNull();
  });

  it('la clave del texto pegado no depende de espacios ni de mayúsculas', () => {
    expect(pastedSourceKey('Tech  Lead\nBackend')).toBe(pastedSourceKey(' tech lead backend '));
    expect(pastedSourceKey('Tech Lead')).not.toBe(pastedSourceKey('Tech Lead 2'));
    expect(pastedSourceKey('x')).toMatch(/^pasted:[0-9a-f]{64}$/);
  });
});

describe('htmlToText (D14)', () => {
  it('decodifica entidades nombradas y numéricas', () => {
    expect(htmlToText('<p>Ni&ntilde;os &amp; &lt;3 &#233; &#xE9; &nbsp;fin &mdash; ok</p>')).toBe(
      'Niños & <3 é é fin — ok',
    );
  });

  it('el content de Greenhouse, escapado dos veces, sale sin etiquetas', () => {
    const escaped =
      '&lt;p&gt;Somos &amp;lt;b&amp;gt;Acme&amp;lt;/b&amp;gt;&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Java&lt;/li&gt;&lt;li&gt;Kafka&lt;/li&gt;&lt;/ul&gt;';
    const text = htmlToText(escaped);
    expect(text).not.toMatch(/<[a-z/]/i);
    expect(text).toContain('Somos Acme');
    expect(text).toContain('• Java');
    expect(text).toContain('• Kafka');
  });

  it('descarta <script> y <style> con su contenido', () => {
    const text = htmlToText('<style>.a{color:red}</style><p>Hola</p><script>alert("x")</script>');
    expect(text).toBe('Hola');
    expect(htmlToText('Hola<script>alert(1)')).toBe('Hola');
  });

  it('convierte listas con «• » y bloques en saltos de línea', () => {
    expect(
      htmlToText('<h2>Requisitos</h2><ul><li>Java</li><li>SQL</li></ul><p>Fin<br>otra</p>'),
    ).toBe('Requisitos\n• Java\n• SQL\nFin\notra');
  });

  it('colapsa espacios y líneas en blanco', () => {
    expect(htmlToText('<p>  a   b  </p>\n\n\n\n<p>c</p>')).toBe('a b\n\nc');
  });

  it('un `<` suelto en el texto no se toma por etiqueta', () => {
    expect(htmlToText('si a < b y c > d')).toBe('si a < b y c > d');
  });

  it('una entidad desconocida o prototípica queda tal cual', () => {
    expect(htmlToText('&foo; &constructor;')).toBe('&foo; &constructor;');
  });

  it('nunca deja etiquetas aunque estén anidadas en entidades', () => {
    expect(htmlToText('&amp;amp;lt;script&amp;amp;gt;x')).not.toMatch(/<script/i);
  });
});
