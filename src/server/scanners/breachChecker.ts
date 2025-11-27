export interface Breach {
  name: string;
  title: string;
  domain: string;
  breachDate: string;
  addedDate: string;
  modifiedDate: string;
  pwnCount: number;
  description: string;
  dataClasses: string[];
  isVerified: boolean;
  isFabricated: boolean;
  isSensitive: boolean;
  isRetired: boolean;
  isSpamList: boolean;
  logoPath?: string;
}

export interface BreachCheckResult {
  email: string;
  isBreached: boolean;
  totalBreaches: number;
  breaches: Breach[];
  riskScore: number;
  dataClassSummary: Record<string, number>;
  oldestBreach?: string;
  newestBreach?: string;
}

/**
 * Mock breach database (in production, this would call Have I Been Pwned API or similar)
 */
const MOCK_BREACHES: Breach[] = [
  {
    name: 'Adobe',
    title: 'Adobe',
    domain: 'adobe.com',
    breachDate: '2013-10-04',
    addedDate: '2013-12-04',
    modifiedDate: '2022-05-15',
    pwnCount: 152445165,
    description: 'In October 2013, 153 million Adobe accounts were breached with each containing an internal ID, username, email, encrypted password and a password hint in plain text. The password cryptography was poorly done and many were quickly resolved back to plain text.',
    dataClasses: ['Email addresses', 'Password hints', 'Passwords', 'Usernames'],
    isVerified: true,
    isFabricated: false,
    isSensitive: false,
    isRetired: false,
    isSpamList: false,
  },
  {
    name: 'LinkedIn',
    title: 'LinkedIn',
    domain: 'linkedin.com',
    breachDate: '2012-05-05',
    addedDate: '2016-05-21',
    modifiedDate: '2016-05-21',
    pwnCount: 164611595,
    description: 'In May 2012, LinkedIn had 6.5 million of its member passwords leaked. In 2016, a further 165 million accounts were discovered for sale online.',
    dataClasses: ['Email addresses', 'Passwords'],
    isVerified: true,
    isFabricated: false,
    isSensitive: false,
    isRetired: false,
    isSpamList: false,
  },
  {
    name: 'Dropbox',
    title: 'Dropbox',
    domain: 'dropbox.com',
    breachDate: '2012-07-01',
    addedDate: '2016-08-31',
    modifiedDate: '2016-08-31',
    pwnCount: 68648009,
    description: 'In mid-2012, Dropbox suffered a data breach which exposed the stored credentials of tens of millions of their customers.',
    dataClasses: ['Email addresses', 'Passwords'],
    isVerified: true,
    isFabricated: false,
    isSensitive: false,
    isRetired: false,
    isSpamList: false,
  },
  {
    name: 'MyFitnessPal',
    title: 'MyFitnessPal',
    domain: 'myfitnesspal.com',
    breachDate: '2018-02-01',
    addedDate: '2018-03-30',
    modifiedDate: '2018-03-30',
    pwnCount: 143606147,
    description: 'In February 2018, the diet and exercise service MyFitnessPal suffered a data breach. The incident exposed 144 million unique email addresses alongside usernames, IP addresses and passwords stored as SHA-1 and bcrypt hashes.',
    dataClasses: ['Email addresses', 'IP addresses', 'Passwords', 'Usernames'],
    isVerified: true,
    isFabricated: false,
    isSensitive: false,
    isRetired: false,
    isSpamList: false,
  },
  {
    name: 'Twitter',
    title: 'Twitter',
    domain: 'twitter.com',
    breachDate: '2022-12-01',
    addedDate: '2023-01-06',
    modifiedDate: '2023-01-06',
    pwnCount: 235894991,
    description: 'In December 2022, data originating from Twitter was leaked online. The data included phone numbers, email addresses, names, and Twitter IDs.',
    dataClasses: ['Email addresses', 'Names', 'Phone numbers', 'Usernames'],
    isVerified: true,
    isFabricated: false,
    isSensitive: false,
    isRetired: false,
    isSpamList: false,
  },
];

/**
 * Calculate risk score based on breaches
 */
function calculateRiskScore(breaches: Breach[]): number {
  if (breaches.length === 0) return 0;

  let score = 0;

  // More breaches = higher risk
  score += Math.min(breaches.length * 10, 40);

  // Recent breaches are more concerning
  const recentBreaches = breaches.filter(b => {
    const breachYear = new Date(b.breachDate).getFullYear();
    const currentYear = new Date().getFullYear();
    return currentYear - breachYear <= 2;
  });
  score += recentBreaches.length * 5;

  // Sensitive data exposure
  const sensitiveDataClasses = ['Passwords', 'Credit cards', 'Social security numbers', 'Bank account numbers'];
  breaches.forEach(b => {
    const hasSensitiveData = b.dataClasses.some(dc => 
      sensitiveDataClasses.some(sdc => dc.toLowerCase().includes(sdc.toLowerCase()))
    );
    if (hasSensitiveData) score += 15;
  });

  // Large breaches indicate more exposure
  const largeBreaches = breaches.filter(b => b.pwnCount > 10000000);
  score += largeBreaches.length * 5;

  return Math.min(score, 100);
}

/**
 * Perform breach check for an email
 */
export async function performBreachCheck(email: string): Promise<BreachCheckResult> {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }

  // In a real implementation, you would call the Have I Been Pwned API here
  // For demonstration, we'll use mock data with a probability-based approach

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // For demo: certain email patterns trigger breaches
  const shouldShowBreaches = 
    email.includes('test') || 
    email.includes('demo') || 
    email.includes('example') ||
    Math.random() > 0.5; // 50% chance for other emails

  if (!shouldShowBreaches) {
    return {
      email,
      isBreached: false,
      totalBreaches: 0,
      breaches: [],
      riskScore: 0,
      dataClassSummary: {},
    };
  }

  // Select random breaches (2-5)
  const numBreaches = Math.floor(Math.random() * 4) + 2;
  const selectedBreaches = MOCK_BREACHES
    .sort(() => Math.random() - 0.5)
    .slice(0, numBreaches);

  // Calculate data class summary
  const dataClassSummary: Record<string, number> = {};
  selectedBreaches.forEach(breach => {
    breach.dataClasses.forEach(dc => {
      dataClassSummary[dc] = (dataClassSummary[dc] || 0) + 1;
    });
  });

  // Find oldest and newest breaches
  const sortedByDate = [...selectedBreaches].sort((a, b) => 
    new Date(a.breachDate).getTime() - new Date(b.breachDate).getTime()
  );

  const oldestBreach = new Date(sortedByDate[0].breachDate).getFullYear().toString();
  const newestBreach = new Date(sortedByDate[sortedByDate.length - 1].breachDate).getFullYear().toString();

  const riskScore = calculateRiskScore(selectedBreaches);

  return {
    email,
    isBreached: true,
    totalBreaches: selectedBreaches.length,
    breaches: selectedBreaches,
    riskScore,
    dataClassSummary,
    oldestBreach,
    newestBreach,
  };
}
