import { TERM_DICTIONARY } from '../term-dictionary';
import { detectTerms, tokenize } from './detect-terms';

const detect = (text: string, vocabulary: string[] = []) =>
  detectTerms(text, TERM_DICTIONARY, vocabulary);

describe('detectTerms (D11)', () => {
  it('«.NET Core y C#» detecta dotnet', () => {
    expect(detect('Experiencia en .NET Core y C#')).toEqual(['dotnet']);
  });

  it('JavaScript no da java', () => {
    const terms = detect('Buscamos experiencia con JavaScript y React');
    expect(terms).toContain('javascript');
    expect(terms).toContain('react');
    expect(terms).not.toContain('java');
  });

  it('Java solo y Java 17 sí dan java', () => {
    expect(detect('Java')).toContain('java');
    expect(detect('Backend con Java 17')).toContain('java');
  });

  it('«Spring Boot» y «springboot» dan spring-boot del vocabulario', () => {
    expect(detect('Spring Boot, Kafka', ['spring-boot'])).toContain('spring-boot');
    expect(detect('springboot', ['spring-boot'])).toContain('spring-boot');
    expect(detect('Spring-Boot', [])).toContain('spring-boot');
  });

  it('un tag del vocabulario que no está en el diccionario se detecta por su forma', () => {
    expect(detect('Experiencia con ISO 8583 y SPEI', ['iso8583', 'spei'])).toEqual(
      expect.arrayContaining(['iso8583', 'spei']),
    );
    expect(detect('Event Sourcing con event-store', ['event-store'])).toContain('event-store');
  });

  it('go suelto no detecta y Golang sí', () => {
    expect(detect('Ready to go the extra mile; go to market')).not.toContain('go');
    expect(detect('Servicios en Golang')).toContain('go');
    expect(detect('Servicios en go lang')).toContain('go');
  });

  it('un tag de una o dos letras del vocabulario tampoco se usa solo', () => {
    expect(detect('plan c y la letra r', ['c', 'r', 'go'])).toEqual([]);
  });

  it('c# y c++ no son ambiguos', () => {
    expect(detect('Conocimiento de C++')).toContain('cpp');
    expect(detect('C# avanzado')).toContain('dotnet');
  });

  it('ignora tildes y mayúsculas', () => {
    expect(detect('Arquitectura de microservicios')).toContain('microservices');
    expect(detect('Arquitectura de Microservícios')).toContain('microservices');
    expect(detect('LIDERAZGO de equipos')).toContain('leadership');
  });

  it('el punto final de una oración no impide la detección', () => {
    expect(detect('Deseable: Kubernetes.')).toContain('kubernetes');
    expect(detect('Stack: .NET.')).toContain('dotnet');
    expect(detect('Usamos Node.js.')).toContain('nodejs');
  });

  it('separadores comunes: barras, comas, paréntesis', () => {
    const terms = detect('CI/CD (Jenkins, GitHub Actions), AWS/Azure');
    expect(terms).toEqual(
      expect.arrayContaining(['ci-cd', 'jenkins', 'github-actions', 'aws', 'azure']),
    );
  });

  it('el resultado es único y ordenado: diccionario por term, luego vocabulario por tag', () => {
    const terms = detect('Kubernetes, Docker, kubernetes, zebra-tool y alpha-tool', [
      'zebra-tool',
      'alpha-tool',
    ]);
    expect(terms).toEqual(['docker', 'kubernetes', 'alpha-tool', 'zebra-tool']);
  });

  it('sin coincidencias devuelve vacío', () => {
    expect(detect('Un texto sin tecnologías conocidas.')).toEqual([]);
  });

  it('un tag del vocabulario con el mismo nombre que un término no se repite', () => {
    expect(detect('Java y Kubernetes', ['java', 'kubernetes'])).toEqual(['java', 'kubernetes']);
  });
});

describe('tokenize', () => {
  it('quita diacríticos, baja a minúsculas y conserva # + .', () => {
    expect(tokenize('Microservícios en C#/.NET, C++.')).toEqual([
      'microservicios',
      'en',
      'c#',
      '.net',
      'c++',
    ]);
  });

  it('un punto suelto no es un token', () => {
    expect(tokenize('a . b ...')).toEqual(['a', 'b']);
  });
});
