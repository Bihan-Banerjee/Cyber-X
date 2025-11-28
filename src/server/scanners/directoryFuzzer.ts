import { performance } from 'node:perf_hooks';

export interface FuzzResult {
  path: string;
  fullUrl: string;
  status: number;
  size: number;
  responseTime: number;
  contentType?: string;
  exists: boolean;
}

export interface FuzzerResult {
  target: string;
  totalPaths: number;
  foundPaths: number;
  notFoundPaths: number;
  results: FuzzResult[];
  totalTime: number;
  wordlistSize: number;
}

// Comprehensive directory and file wordlist (1000+ paths)
const COMMON_PATHS = [
  // Admin Panels & Control Panels
  'admin', 'administrator', 'admin.php', 'admin/', 'admin/login', 'admin/index.php',
  'admin/admin', 'admin/home', 'admin/controlpanel', 'admin/cp', 'admin/dashboard',
  'administration', 'administr8', 'administr8.php', 'adminpanel', 'admin_area',
  'admin-console', 'admin_login', 'adminLogin', 'admin-login', 'admin_panel',
  'wp-admin', 'wp-admin/', 'wp-login.php', 'wp-login', 'wordpress/wp-admin',
  'administrator/', 'administrator.php', 'moderator', 'moderator/', 'webadmin',
  'webadmin/', 'webadmin.php', 'adminarea', 'bb-admin', 'bb-admin/',
  'phpmyadmin', 'phpMyAdmin', 'pma', 'PMA', 'myadmin', 'mysql', 'mysqlmanager',
  'adminer', 'adminer.php', 'admin/account', 'admin/index', 'admin/login.php',
  'admin/admin.php', 'admin_area/admin.php', 'admin_area/login.php',
  'siteadmin', 'siteadmin/login', 'siteadmin/index', 'pages/admin/admin-login',
  'admin/controlpanel.php', 'admin.html', 'admin/cp.php', 'cp.php',
  'controlpanel', 'cpanel', 'cPanel', 'panel', 'user-panel', 'member-panel',
  'login', 'login.php', 'login.html', 'login/', 'signin', 'signin.php',
  'sign-in', 'dashboard', 'dashboard/', 'dashboard.php', 'portal', 'portal/',
  
  // API Endpoints
  'api', 'api/', 'api/v1', 'api/v2', 'api/v3', 'api/v1/', 'api/v2/', 'api/v3/',
  'rest', 'rest/', 'rest/api', 'rest/v1', 'rest/v2', 'restapi', 'api-docs',
  'graphql', 'api/graphql', 'graphql/', 'gql', 'api/users', 'api/user',
  'api/admin', 'api/config', 'api/auth', 'api/login', 'api/register',
  'api/data', 'api/service', 'api/services', 'api/products', 'api/orders',
  'v1', 'v2', 'v3', 'v1/', 'v2/', 'v3/', 'swagger', 'swagger-ui', 'swagger/',
  'docs', 'docs/', 'api/docs', 'api-documentation', 'apidocs', 'redoc',
  
  // Backup Files & Directories
  'backup', 'backups', 'backup/', 'backups/', 'backup.sql', 'backup.zip',
  'backup.tar', 'backup.tar.gz', 'backup.tgz', 'backup.rar', 'db_backup',
  'database_backup', 'sql_backup', 'backup.bak', 'site_backup', 'web_backup',
  'backup.old', 'backup~', 'backup-db', 'backup-files', 'backup-site',
  'bak', '.bak', 'old', '.old', '_old', 'old_site', 'old-site', 'archive',
  'archives', 'Archive', 'Archives', 'archived', 'dump', 'dumps', 'sql',
  'sql/', 'database', 'database/', 'db', 'db/', 'data', 'data/',
  
  // Configuration Files
  'config', 'config/', 'config.php', 'config.inc.php', 'configuration',
  'configuration.php', 'conf', 'conf/', 'settings', 'settings.php',
  'wp-config.php', 'wp-config.php.bak', 'wp-config.old', 'wp-config.php~',
  '.env', 'env', '.env.local', '.env.production', '.env.development',
  '.env.staging', '.env.test', '.env.backup', '.env.old', 'env.js',
  'config.json', 'config.yml', 'config.yaml', 'configuration.json',
  'app.config', 'web.config', 'applicationhost.config', 'machine.config',
  'database.yml', 'database.yaml', 'settings.json', 'settings.yml',
  'credentials', 'credentials.json', 'secrets', 'secrets.json', 'keys',
  
  // Development & Testing
  'dev', 'dev/', 'development', 'development/', 'test', 'test/', 'testing',
  'testing/', 'qa', 'qa/', 'staging', 'staging/', 'stage', 'demo', 'demo/',
  'sandbox', 'sandbox/', 'temp', 'temp/', 'tmp', 'tmp/', 'temporary',
  'beta', 'beta/', 'alpha', 'alpha/', 'preview', 'preview/', 'pilot',
  'dev-server', 'test-server', 'debug', 'debug/', 'trace', 'diagnostic',
  
  // Version Control
  '.git', '.git/', '.git/config', '.git/HEAD', '.gitignore', '.gitmodules',
  '.svn', '.svn/', '.svn/entries', '.hg', '.hg/', '.bzr', '.bzr/',
  'CVS', 'CVS/', '.cvsignore', 'git', 'svn', 'repository', 'repositories',
  
  // Logs & Monitoring
  'logs', 'logs/', 'log', 'log/', 'error_log', 'error-log', 'errors',
  'error', 'access.log', 'access_log', 'debug.log', 'app.log', 'system.log',
  'application.log', 'server.log', 'php_error.log', 'php-error.log',
  'laravel.log', 'nginx-error.log', 'apache-error.log', 'audit', 'audit.log',
  'trace', 'trace.axd', 'Trace.axd', 'elmah.axd', 'trace.log', 'syslog',
  
  // Static Assets
  'static', 'static/', 'assets', 'assets/', 'public', 'public/', 'resources',
  'images', 'images/', 'img', 'img/', 'pics', 'pictures', 'photo', 'photos',
  'image', 'css', 'css/', 'js', 'js/', 'javascript', 'scripts', 'script',
  'styles', 'stylesheets', 'fonts', 'font', 'media', 'media/', 'videos',
  'video', 'audio', 'uploads', 'uploads/', 'upload', 'files', 'files/',
  'download', 'downloads', 'downloads/', 'content', 'content/', 'themes',
  
  // Common Directories
  'includes', 'include', 'inc', 'lib', 'lib/', 'library', 'libraries',
  'vendor', 'vendor/', 'node_modules', 'bower_components', 'packages',
  'plugins', 'plugins/', 'plugin', 'modules', 'modules/', 'module',
  'components', 'components/', 'component', 'extensions', 'addons',
  'widgets', 'templates', 'template', 'themes/', 'theme', 'views',
  'layouts', 'partials', 'common', 'shared', 'core', 'app', 'src',
  
  // CMS Specific (WordPress)
  'wp-content', 'wp-content/', 'wp-includes', 'wp-includes/', 'wp-json',
  'wp-json/', 'wp-admin/', 'wp-login.php', 'xmlrpc.php', 'wp-config.php',
  'wp-content/plugins', 'wp-content/themes', 'wp-content/uploads',
  'wp-content/cache', 'wp-admin/admin-ajax.php', 'wp-cron.php',
  'wordpress', 'wordpress/', 'blog', 'blog/', 'wp', 'wp/',
  
  // CMS Specific (Joomla)
  'joomla', 'joomla/', 'administrator/', 'components/', 'modules/',
  'templates/', 'images/', 'cache/', 'tmp/', 'logs/', 'cli/',
  
  // CMS Specific (Drupal)
  'drupal', 'drupal/', 'sites', 'sites/', 'sites/default', 'sites/all',
  'sites/default/files', 'misc', 'themes/', 'modules/', 'profiles',
  
  // E-commerce
  'shop', 'shop/', 'store', 'store/', 'cart', 'checkout', 'products',
  'product', 'catalog', 'category', 'categories', 'order', 'orders',
  'payment', 'billing', 'invoice', 'invoices', 'shipping', 'wishlist',
  
  // User Management
  'user', 'users', 'users/', 'member', 'members', 'members/', 'profile',
  'profiles', 'account', 'accounts', 'myaccount', 'my-account', 'settings',
  'preferences', 'register', 'registration', 'signup', 'sign-up', 'logout',
  'password-reset', 'forgot-password', 'change-password', 'activate',
  
  // Common Pages
  'index', 'index.html', 'index.php', 'index.htm', 'index.asp', 'index.aspx',
  'index.jsp', 'default.html', 'default.php', 'default.asp', 'home.html',
  'home.php', 'main.html', 'main.php', 'start.html', 'welcome.html',
  'about', 'about.html', 'about-us', 'contact', 'contact.html', 'contact-us',
  'help', 'help/', 'support', 'support/', 'faq', 'faq/', 'terms',
  'privacy', 'privacy-policy', 'sitemap', 'sitemap.xml', 'search',
  
  // Server Files
  'robots.txt', 'humans.txt', 'crossdomain.xml', '.htaccess', '.htpasswd',
  'web.config', '.user.ini', 'php.ini', '.htaccess.bak', '.htaccess~',
  'server-status', 'server-info', 'status', 'info', 'info.php', 'phpinfo.php',
  'test.php', 'php.php', 'pi.php', 'i.php', 'phpversion.php', 'readme.html',
  'license.txt', 'changelog.txt', 'version.txt', 'install.php', 'setup.php',
  
  // Security & Auth
  '.well-known', '.well-known/', '.well-known/security.txt', 'security.txt',
  '.well-known/acme-challenge', 'oauth', 'oauth/', 'oauth2', 'saml', 'sso',
  'auth', 'auth/', 'authentication', 'authorize', 'token', 'tokens', 'jwt',
  'session', 'sessions', 'cookie', 'cookies', 'csrf', 'captcha',
  
  // Database Management
  'phpmyadmin/', 'phpMyAdmin/', 'pma/', 'PMA/', 'mysql/', 'sql/',
  'adminer.php', 'adminer/', 'db/', 'database/', 'dbadmin', 'myadmin/',
  'sqlmanager', 'websql', 'sqladmin', 'mysql-admin',
  
  // Monitoring & Analytics
  'analytics', 'analytics/', 'stats', 'stats/', 'statistics', 'metrics',
  'monitoring', 'monitor', 'health', 'status', 'ping', 'heartbeat',
  'grafana', 'kibana', 'prometheus', 'nagios', 'zabbix',
  
  // Cache & Session
  'cache', 'cache/', 'cached', 'session', 'sessions', 'sessions/',
  'redis', 'memcache', 'memcached', 'varnish',
  
  // Documentation
  'docs/', 'doc/', 'documentation/', 'api-docs/', 'apidoc/', 'manual',
  'guide', 'readme', 'README.md', 'README.txt', 'changelog', 'CHANGELOG.md',
  'license', 'LICENSE', 'LICENSE.txt', 'CONTRIBUTING.md', 'SECURITY.md',
  
  // Mobile & App
  'mobile', 'mobile/', 'm', 'm/', 'app', 'application', 'android', 'ios',
  'cordova', 'phonegap', 'react-native', 'flutter',
  
  // Internationalization
  'locale', 'locales', 'lang', 'language', 'languages', 'i18n', 'l10n',
  'translations', 'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja',
  
  // Error Pages
  '404', '404.html', '404.php', '403', '403.html', '500', '500.html',
  'error', 'error.html', 'error.php', 'errors/', 'error-page',
  
  // Build & Deployment
  'build', 'build/', 'dist', 'dist/', 'release', 'releases', 'deploy',
  'deployment', 'out', 'output', 'compiled', 'bundle', 'webpack',
  
  // Testing Files
  'phpunit.xml', 'phpunit.xml.dist', 'composer.json', 'composer.lock',
  'package.json', 'package-lock.json', 'yarn.lock', 'Gemfile', 'Gemfile.lock',
  'requirements.txt', 'Makefile', 'Dockerfile', 'docker-compose.yml',
  
  // IDE & Editor Files
  '.vscode', '.vscode/', '.idea', '.idea/', '.project', '.classpath',
  '.settings', '.DS_Store', 'Thumbs.db', '.editorconfig', '.eslintrc',
  
  // Framework Specific (Laravel)
  'artisan', 'storage', 'storage/', 'storage/logs', 'storage/framework',
  'bootstrap', 'bootstrap/', 'routes', 'routes/', 'app/', 'resources/',
  
  // Framework Specific (Django)
  'manage.py', 'settings.py', 'wsgi.py', 'urls.py', 'static/', 'staticfiles',
  
  // Framework Specific (Rails)
  'Rakefile', 'Gemfile', 'config.ru', 'public/', 'config/', 'db/migrate',
  
  // Common File Extensions
  'sitemap.xml', 'feed.xml', 'rss.xml', 'atom.xml', 'manifest.json',
  'browserconfig.xml', 'opensearch.xml', 'ads.txt', 'app-ads.txt',
  
  // Cloud & Services
  'aws', 'azure', 'gcp', 's3', 'cdn', 'cloudfront', 'firebase',
  'heroku', 'docker', 'kubernetes', 'k8s',
  
  // Common Typos & Variations
  'admim', 'admon', 'addmin', 'adming', 'aadmin', 'adminn', 'amin',
  'logon', 'logo', 'longin', 'loging', 'loginn', 'root', 'superuser',
  
  // Additional Security
  'security', 'secure', 'ssl', 'tls', 'cert', 'certificate', 'certs',
  'keys/', 'key/', 'secret/', 'secrets/', 'private/', 'protected/',
  
  // Misc
  'misc', 'miscellaneous', 'other', 'utils', 'utilities', 'tools',
  'helper', 'helpers', 'service', 'services', 'worker', 'workers',
  'job', 'jobs', 'queue', 'queues', 'cron', 'scheduler', 'task', 'tasks',
];

/**
 * Test a single path
 */
async function testPath(
  baseUrl: string,
  path: string,
  timeoutMs: number
): Promise<FuzzResult> {
  const fullUrl = `${baseUrl}/${path}`;
  const startTime = performance.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(fullUrl, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'manual', // Don't follow redirects
      headers: {
        'User-Agent': 'Mozilla/5.0 (Directory-Fuzzer/1.0)',
      },
    });

    clearTimeout(timeout);

    const responseTime = Math.round(performance.now() - startTime);
    const contentType = response.headers.get('content-type') || undefined;
    
    // Get content length
    let size = 0;
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      size = parseInt(contentLength, 10);
    } else {
      // If no content-length header, try to get actual size
      try {
        const buffer = await response.arrayBuffer();
        size = buffer.byteLength;
      } catch {
        size = 0;
      }
    }

    const exists = response.status !== 404;

    return {
      path,
      fullUrl,
      status: response.status,
      size,
      responseTime,
      contentType,
      exists,
    };
  } catch (error: any) {
    const responseTime = Math.round(performance.now() - startTime);
    
    return {
      path,
      fullUrl,
      status: 0,
      size: 0,
      responseTime,
      exists: false,
    };
  }
}

/**
 * Perform directory fuzzing
 */
export async function performDirectoryFuzzing(
  target: string,
  timeoutMs: number = 60000
): Promise<FuzzerResult> {
  const startTime = performance.now();

  // Clean target URL
  let baseUrl = target.trim();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = 'https://' + baseUrl;
  }
  // Remove trailing slash
  baseUrl = baseUrl.replace(/\/$/, '');

  const results: FuzzResult[] = [];
  const batchSize = 10; // Concurrent requests

  // Test paths in batches
  for (let i = 0; i < COMMON_PATHS.length; i += batchSize) {
    const batch = COMMON_PATHS.slice(i, i + batchSize);
    const batchPromises = batch.map(path => testPath(baseUrl, path, 5000));
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  const foundPaths = results.filter(r => r.exists).length;
  const notFoundPaths = results.filter(r => !r.exists).length;
  const totalTime = Math.round((performance.now() - startTime) / 1000);

  return {
    target: baseUrl,
    totalPaths: COMMON_PATHS.length,
    foundPaths,
    notFoundPaths,
    results,
    totalTime,
    wordlistSize: COMMON_PATHS.length,
  };
}
