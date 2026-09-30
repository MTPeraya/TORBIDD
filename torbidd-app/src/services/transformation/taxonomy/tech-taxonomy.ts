// =============================================================================
// services/transformation/taxonomy/tech-taxonomy.ts
// Tech Stack Taxonomy & Normalization Pipeline (Issue #89)
// Maps heterogeneous aliases (e.g. "Postgres DB", "k8s") to canonical tags
// and categorizes into Frontend, Backend, Infra, and Security.
// =============================================================================

export type TechCategory = 'Frontend' | 'Backend' | 'Infra' | 'Security';

export interface CanonicalTechDefinition {
  canonical: string;
  category: TechCategory;
  aliases: string[];
}

export interface NormalizedTechItem {
  name: string;
  category: TechCategory;
  rawMatched?: string;
}

export interface CategorizedTechnicalRequirement {
  id: string;
  category: TechCategory;
  text: { th: string; en: string };
  mandatory?: boolean;
}

export interface ProjectTechnicalSpecs {
  projectId: string;
  categoryFilter?: TechCategory | 'All';
  technologies: NormalizedTechItem[];
  requirements: CategorizedTechnicalRequirement[];
}

/**
 * Standard Tech Taxonomy Dictionary
 */
export const TECH_TAXONOMY: CanonicalTechDefinition[] = [
  // ─── Frontend ───────────────────────────────────────────────────────────────
  { canonical: 'React', category: 'Frontend', aliases: ['react', 'react.js', 'reactjs', 'react framework'] },
  { canonical: 'Next.js', category: 'Frontend', aliases: ['next', 'next.js', 'nextjs', 'next.js 14', 'next.js 15', 'next.js 16'] },
  { canonical: 'Vue.js', category: 'Frontend', aliases: ['vue', 'vue.js', 'vuejs', 'vue 3'] },
  { canonical: 'Angular', category: 'Frontend', aliases: ['angular', 'angular.js', 'angularjs'] },
  { canonical: 'TypeScript', category: 'Frontend', aliases: ['typescript', 'ts'] },
  { canonical: 'JavaScript', category: 'Frontend', aliases: ['javascript', 'js', 'es6'] },
  { canonical: 'Flutter', category: 'Frontend', aliases: ['flutter', 'flutter framework'] },
  { canonical: 'React Native', category: 'Frontend', aliases: ['react native', 'react-native'] },
  { canonical: 'iOS (Swift)', category: 'Frontend', aliases: ['ios', 'swift', 'ios app'] },
  { canonical: 'Android (Kotlin)', category: 'Frontend', aliases: ['android', 'kotlin', 'android app'] },
  { canonical: 'HTML5 & CSS3', category: 'Frontend', aliases: ['html', 'html5', 'css', 'css3', 'web responsive'] },
  { canonical: 'TailwindCSS', category: 'Frontend', aliases: ['tailwind', 'tailwindcss'] },

  // ─── Backend ────────────────────────────────────────────────────────────────
  { canonical: 'Node.js', category: 'Backend', aliases: ['node', 'node.js', 'nodejs', 'node runtime'] },
  { canonical: 'FastAPI', category: 'Backend', aliases: ['fastapi', 'fast api'] },
  { canonical: 'Python', category: 'Backend', aliases: ['python', 'python 3', 'python3', 'py'] },
  { canonical: 'Java', category: 'Backend', aliases: ['java', 'java ee', 'java 17', 'java 21'] },
  { canonical: 'Spring Boot', category: 'Backend', aliases: ['spring', 'spring boot', 'springboot'] },
  { canonical: 'Go (Golang)', category: 'Backend', aliases: ['go', 'golang'] },
  { canonical: '.NET Core', category: 'Backend', aliases: ['.net', '.net core', 'dotnet', 'c#', 'csharp'] },
  { canonical: 'PHP / Laravel', category: 'Backend', aliases: ['php', 'laravel', 'php laravel'] },
  { canonical: 'PostgreSQL', category: 'Backend', aliases: ['postgres', 'postgresql', 'postgres db', 'psql', 'postgresql database'] },
  { canonical: 'MySQL', category: 'Backend', aliases: ['mysql', 'mariadb', 'mysql database'] },
  { canonical: 'MongoDB', category: 'Backend', aliases: ['mongo', 'mongodb', 'document database'] },
  { canonical: 'Redis', category: 'Backend', aliases: ['redis', 'redis cache', 'in-memory cache'] },
  { canonical: 'REST API', category: 'Backend', aliases: ['rest', 'rest api', 'restful', 'restful api', 'api gateway'] },
  { canonical: 'GraphQL', category: 'Backend', aliases: ['graphql', 'gql'] },
  { canonical: 'OpenAPI Specification', category: 'Backend', aliases: ['openapi', 'swagger', 'openapi 3.0', 'openapi spec'] },
  { canonical: 'Kafka & Message Queue', category: 'Backend', aliases: ['kafka', 'rabbitmq', 'message queue', 'event stream'] },

  // ─── Infra ─────────────────────────────────────────────────────────────────
  { canonical: 'Docker & Containers', category: 'Infra', aliases: ['docker', 'container', 'containers', 'containerization'] },
  { canonical: 'Kubernetes', category: 'Infra', aliases: ['k8s', 'kubernetes', 'k8s cluster'] },
  { canonical: 'Cloud Infrastructure', category: 'Infra', aliases: ['cloud', 'cloud infrastructure', 'cloud computing', 'hybrid cloud'] },
  { canonical: 'AWS', category: 'Infra', aliases: ['aws', 'amazon web services', 'amazon aws'] },
  { canonical: 'Google Cloud (GCP)', category: 'Infra', aliases: ['gcp', 'google cloud', 'google cloud platform'] },
  { canonical: 'Microsoft Azure', category: 'Infra', aliases: ['azure', 'microsoft azure'] },
  { canonical: 'VMware / Hypervisor', category: 'Infra', aliases: ['vmware', 'hypervisor', 'vsphere', 'virtualization', 'esxi'] },
  { canonical: 'Linux Enterprise', category: 'Infra', aliases: ['linux', 'linux enterprise', 'rhel', 'ubuntu', 'centos'] },
  { canonical: 'High Availability (HA)', category: 'Infra', aliases: ['ha', 'high availability', 'ha clustering', 'fault tolerant', 'sla 99.9%'] },
  { canonical: 'Backup & Disaster Recovery', category: 'Infra', aliases: ['dr', 'disaster recovery', 'backup & recovery', 'automated backup', 'rpo', 'rto'] },
  { canonical: 'Data Center Infrastructure', category: 'Infra', aliases: ['data center', 'datacenter', 'tier iii', 'ศูนย์ข้อมูล', 'precision air', 'ups'] },
  { canonical: 'Network & Firewall', category: 'Infra', aliases: ['firewall', 'network', 'waf', 'load balancer', 'vpn'] },

  // ─── Security ──────────────────────────────────────────────────────────────
  { canonical: 'ISO/IEC 27001', category: 'Security', aliases: ['iso 27001', 'iso/iec 27001', '27001', 'isms'] },
  { canonical: 'PDPA Compliance', category: 'Security', aliases: ['pdpa', 'pdpa compliance', 'privacy', 'พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล'] },
  { canonical: 'OAuth 2.0 & OpenID', category: 'Security', aliases: ['oauth', 'oauth 2.0', 'oauth2', 'sso', 'single sign-on', 'openid', 'saml'] },
  { canonical: 'Data Encryption (AES-256 / TLS)', category: 'Security', aliases: ['aes-256', 'encryption', 'tls', 'ssl', 'https', 'data at rest encryption'] },
  { canonical: 'ISO/IEC 29110 / CMMI', category: 'Security', aliases: ['iso 29110', 'iso/iec 29110', 'cmmi', 'cmmi level 3'] },
  { canonical: 'Cybersecurity & Audit Logs', category: 'Security', aliases: ['cybersecurity', 'audit logs', 'penetration testing', 'vulnerability assessment', 'owasp'] },
];

/**
 * Normalizes a single tech string against the canonical taxonomy.
 */
export function normalizeTechTag(raw: string): NormalizedTechItem {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  for (const item of TECH_TAXONOMY) {
    if (item.canonical.toLowerCase() === lower) {
      return { name: item.canonical, category: item.category, rawMatched: trimmed };
    }
    for (const alias of item.aliases) {
      if (lower === alias || lower.includes(alias)) {
        return { name: item.canonical, category: item.category, rawMatched: trimmed };
      }
    }
  }

  // Fallback categorization heuristics for unmapped tokens
  let cat: TechCategory = 'Backend';
  if (lower.includes('ui') || lower.includes('web') || lower.includes('app') || lower.includes('css') || lower.includes('front')) {
    cat = 'Frontend';
  } else if (lower.includes('cloud') || lower.includes('server') || lower.includes('infra') || lower.includes('center') || lower.includes('network')) {
    cat = 'Infra';
  } else if (lower.includes('sec') || lower.includes('pdpa') || lower.includes('iso') || lower.includes('auth') || lower.includes('safe')) {
    cat = 'Security';
  }

  return { name: trimmed, category: cat, rawMatched: trimmed };
}

/**
 * Normalizes a list of tech tags, deduplicates canonical names, and sorts by category.
 */
export function normalizeTechList(tags: (string | undefined | null)[]): NormalizedTechItem[] {
  const seen = new Set<string>();
  const result: NormalizedTechItem[] = [];

  for (const tag of tags) {
    if (!tag || typeof tag !== 'string' || !tag.trim()) continue;
    const normalized = normalizeTechTag(tag);
    if (!seen.has(normalized.name)) {
      seen.add(normalized.name);
      result.push(normalized);
    }
  }

  return result;
}

/**
 * Categorize a technical requirement statement into Frontend, Backend, Infra, or Security.
 */
export function categorizeTechnicalRequirement(
  textTh: string,
  textEn = '',
): TechCategory {
  const combined = `${textTh} ${textEn}`.toLowerCase();

  if (
    combined.includes('pdpa') ||
    combined.includes('iso') ||
    combined.includes('ความมั่นคงปลอดภัย') ||
    combined.includes('security') ||
    combined.includes('เข้ารหัส') ||
    combined.includes('encryption') ||
    combined.includes('ยืนยันตัวตน') ||
    combined.includes('audit')
  ) {
    return 'Security';
  }

  if (
    combined.includes('tier') ||
    combined.includes('ศูนย์ข้อมูล') ||
    combined.includes('data center') ||
    combined.includes('cloud') ||
    combined.includes('สำรอง') ||
    combined.includes('backup') ||
    combined.includes('disaster recovery') ||
    combined.includes('ha') ||
    combined.includes('high availability') ||
    combined.includes('sla') ||
    combined.includes('uptime') ||
    combined.includes('ups') ||
    combined.includes('precision air') ||
    combined.includes('firewall') ||
    combined.includes('server')
  ) {
    return 'Infra';
  }

  if (
    combined.includes('หน้าจอ') ||
    combined.includes('ui') ||
    combined.includes('ux') ||
    combined.includes('web') ||
    combined.includes('mobile') ||
    combined.includes('แอป') ||
    combined.includes('responsive') ||
    combined.includes('ผู้ใช้') ||
    combined.includes('portal')
  ) {
    return 'Frontend';
  }

  return 'Backend';
}

/**
 * Scan raw document text to detect and extract technology stack keywords.
 */
export function extractTechEntitiesFromText(text: string): NormalizedTechItem[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const matched: NormalizedTechItem[] = [];
  const seen = new Set<string>();

  for (const item of TECH_TAXONOMY) {
    for (const alias of item.aliases) {
      // Word boundary match
      const regex = new RegExp(`(?:^|[\\s,;()\\/.])${alias.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}(?:$|[\\s,;()\\/.])`, 'i');
      if (regex.test(lower)) {
        if (!seen.has(item.canonical)) {
          seen.add(item.canonical);
          matched.push({ name: item.canonical, category: item.category, rawMatched: alias });
        }
        break;
      }
    }
  }

  return matched;
}
