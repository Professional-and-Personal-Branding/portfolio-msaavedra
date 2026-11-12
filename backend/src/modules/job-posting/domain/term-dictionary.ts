/**
 * Diccionario versionado de términos (D11). `term` tiene el formato de los tags (`dotnet`,
 * `spring-boot`, `kubernetes`); los alias son formas ES/EN con las que aparece en una vacante.
 * El propio `term` también se busca (con los guiones como espacios y sin separador).
 *
 * Arranca con los tags del CV real y del ejemplo más tecnologías frecuentes que el owner puede
 * no tener (`kubernetes`, `go`, `rust`, `terraform`…), para poder decir «sin respaldo». No incluye
 * palabras genéricas (`performance`, `integration`): si el owner las usa como tag, se detectan
 * por la forma del propio tag. Se amplía en código, con su test.
 *
 * Los alias de una o dos letras (`go`, `r`, `c`) no se usan solos: `go` se detecta por `golang` o
 * `go lang` (ver `detect-terms.ts`).
 */
export interface DictionaryEntry {
  readonly term: string;
  readonly aliases: readonly string[];
}

export const TERM_DICTIONARY: ReadonlyArray<DictionaryEntry> = [
  // Lenguajes
  { term: 'java', aliases: ['jdk', 'jvm', 'java 8', 'java 11', 'java 17', 'java 21'] },
  { term: 'javascript', aliases: ['ecmascript', 'es6'] },
  { term: 'typescript', aliases: [] },
  { term: 'python', aliases: ['python3', 'python 3'] },
  { term: 'dotnet', aliases: ['.net', 'c#', 'asp.net', '.net core', 'dotnet core', 'net core'] },
  { term: 'vbnet', aliases: ['vb.net', 'visual basic', 'vb6'] },
  { term: 'go', aliases: ['golang', 'go lang'] },
  { term: 'rust', aliases: ['rustlang'] },
  { term: 'kotlin', aliases: [] },
  { term: 'scala', aliases: [] },
  { term: 'ruby', aliases: ['ruby on rails', 'rails'] },
  { term: 'php', aliases: [] },
  { term: 'swift', aliases: [] },
  { term: 'cpp', aliases: ['c++'] },
  { term: 'sql', aliases: ['t-sql', 'tsql', 'pl/sql', 'plsql'] },
  // Frameworks
  { term: 'spring-boot', aliases: ['spring boot', 'springboot', 'spring framework'] },
  { term: 'quarkus', aliases: [] },
  { term: 'nestjs', aliases: ['nest.js', 'nest js'] },
  { term: 'nodejs', aliases: ['node.js', 'node js', 'node'] },
  { term: 'react', aliases: ['react.js', 'reactjs', 'react js'] },
  { term: 'angular', aliases: ['angularjs'] },
  { term: 'vue', aliases: ['vue.js', 'vuejs'] },
  { term: 'nextjs', aliases: ['next.js', 'next js'] },
  { term: 'django', aliases: [] },
  { term: 'flask', aliases: [] },
  { term: 'fastapi', aliases: ['fast api'] },
  { term: 'hibernate', aliases: ['jpa'] },
  { term: 'graphql', aliases: [] },
  { term: 'grpc', aliases: [] },
  { term: 'rest', aliases: ['rest api', 'rest apis', 'restful', 'api rest', 'apis rest'] },
  { term: 'soap', aliases: [] },
  // Nube e infraestructura
  { term: 'aws', aliases: ['amazon web services'] },
  { term: 'azure', aliases: ['microsoft azure'] },
  { term: 'gcp', aliases: ['google cloud', 'google cloud platform'] },
  { term: 'cloud', aliases: ['nube', 'cloud computing'] },
  { term: 'cloud-native', aliases: ['cloud native'] },
  { term: 'serverless', aliases: ['lambda functions', 'azure functions'] },
  { term: 'kubernetes', aliases: ['k8s', 'eks', 'aks', 'gke'] },
  { term: 'docker', aliases: ['contenedores', 'containers'] },
  { term: 'terraform', aliases: [] },
  { term: 'ansible', aliases: [] },
  { term: 'helm', aliases: [] },
  { term: 'linux', aliases: [] },
  { term: 'iac', aliases: ['infrastructure as code', 'infraestructura como codigo'] },
  { term: 'devops', aliases: ['sre', 'site reliability'] },
  { term: 'ci-cd', aliases: ['ci/cd', 'cicd', 'continuous integration', 'integracion continua'] },
  { term: 'jenkins', aliases: [] },
  { term: 'github-actions', aliases: ['github actions'] },
  { term: 'gitlab-ci', aliases: ['gitlab ci', 'gitlab pipelines'] },
  { term: 'observability', aliases: ['observabilidad', 'prometheus', 'grafana', 'datadog'] },
  // Datos y mensajería
  { term: 'postgresql', aliases: ['postgres'] },
  { term: 'mysql', aliases: ['mariadb'] },
  { term: 'oracle', aliases: ['oracle db', 'oracle database'] },
  { term: 'sql-server', aliases: ['sql server', 'sqlserver', 'mssql'] },
  { term: 'mongodb', aliases: ['mongo', 'mongo db'] },
  { term: 'redis', aliases: [] },
  { term: 'elasticsearch', aliases: ['elastic search', 'opensearch'] },
  { term: 'kafka', aliases: ['apache kafka'] },
  { term: 'rabbitmq', aliases: ['rabbit mq'] },
  { term: 'messaging', aliases: ['mensajeria', 'message broker'] },
  { term: 'etl', aliases: ['data pipelines', 'pipelines de datos'] },
  { term: 'data-engineering', aliases: ['data engineering', 'ingenieria de datos'] },
  { term: 'spark', aliases: ['apache spark', 'pyspark'] },
  { term: 'airflow', aliases: ['apache airflow'] },
  // Arquitectura y prácticas
  { term: 'microservices', aliases: ['microservicios', 'microservicos', 'micro services'] },
  { term: 'event-driven', aliases: ['event driven', 'eda', 'arquitectura orientada a eventos'] },
  { term: 'ddd', aliases: ['domain driven design', 'domain-driven design'] },
  { term: 'clean-architecture', aliases: ['clean architecture', 'arquitectura limpia'] },
  { term: 'architecture', aliases: ['arquitectura de software', 'software architecture'] },
  { term: 'tdd', aliases: ['test driven development', 'test-driven development'] },
  { term: 'testing', aliases: ['unit testing', 'pruebas automatizadas', 'automated testing'] },
  { term: 'qa', aliases: ['quality assurance', 'aseguramiento de calidad'] },
  { term: 'agile', aliases: ['agil', 'scrum', 'kanban', 'metodologias agiles'] },
  // Liderazgo y gestión
  { term: 'leadership', aliases: ['liderazgo', 'team lead', 'tech lead', 'lider tecnico'] },
  { term: 'project-management', aliases: ['project management', 'gestion de proyectos'] },
  { term: 'cto', aliases: ['chief technology officer'] },
  // Dominios
  { term: 'fintech', aliases: [] },
  { term: 'payments', aliases: ['pagos', 'payment processing', 'procesamiento de pagos'] },
  { term: 'banking', aliases: ['banca', 'banca digital'] },
  { term: 'insurance', aliases: ['seguros', 'insurtech'] },
  { term: 'iso8583', aliases: ['iso 8583'] },
  { term: 'spei', aliases: [] },
  { term: 'tokenization', aliases: ['tokenizacion'] },
  { term: 'erp', aliases: ['sap'] },
  { term: 'logistics', aliases: ['logistica'] },
  { term: 'retail', aliases: [] },
  { term: 'mobile', aliases: ['android', 'ios', 'react native', 'flutter'] },
  { term: 'ai', aliases: ['inteligencia artificial', 'artificial intelligence', 'generative ai'] },
  { term: 'machine-learning', aliases: ['machine learning', 'aprendizaje automatico', 'ml'] },
];
