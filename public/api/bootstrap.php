<?php

declare(strict_types=1);

date_default_timezone_set('Asia/Taipei');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

final class ApiException extends RuntimeException
{
    public function __construct(
        public readonly int $status,
        string $message,
        public readonly array $details = []
    ) {
        parent::__construct($message);
    }
}

function respond(mixed $data = null, int $status = 200): never
{
    http_response_code($status);
    if ($status !== 204) {
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    }
    exit;
}

function fail(int $status, string $message, array $details = []): never
{
    throw new ApiException($status, $message, $details);
}

function request_body(): array
{
    static $body;
    if (is_array($body)) {
        return $body;
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return $body = [];
    }

    try {
        $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        fail(400, '請求內容不是有效的 JSON');
    }

    if (!is_array($decoded)) {
        fail(400, '請求內容格式不正確');
    }

    return $body = $decoded;
}

function database(): PDO
{
    static $pdo;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = require __DIR__ . '/config.php';
    foreach (['host', 'database', 'username'] as $key) {
        if (empty($config[$key])) {
            fail(500, '尚未完成資料庫連線設定');
        }
    }
    if (($config['password'] ?? '') === 'PUT_DATABASE_PASSWORD_HERE') {
        fail(500, '請先在 api/config.local.php 填入資料庫密碼');
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $config['host'],
        (int) ($config['port'] ?? 3306),
        $config['database']
    );

    try {
        $pdo = new PDO($dsn, (string) $config['username'], (string) ($config['password'] ?? ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
        $pdo->exec("SET time_zone = '+08:00'");
    } catch (PDOException $error) {
        error_log('Database connection failed: ' . $error->getMessage());
        fail(500, '資料庫連線失敗，請檢查 ByetHost 資料庫設定');
    }

    return $pdo;
}

function query_all(string $sql, array $params = []): array
{
    $statement = database()->prepare($sql);
    $statement->execute($params);
    return $statement->fetchAll();
}

function query_one(string $sql, array $params = []): ?array
{
    $statement = database()->prepare($sql);
    $statement->execute($params);
    $row = $statement->fetch();
    return $row === false ? null : $row;
}

function execute_sql(string $sql, array $params = []): PDOStatement
{
    $statement = database()->prepare($sql);
    $statement->execute($params);
    return $statement;
}

function authorization_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? null;

    if (!$header && function_exists('getallheaders')) {
        $headers = getallheaders();
        $header = $headers['Authorization'] ?? $headers['authorization'] ?? null;
    }

    if (!is_string($header) || !preg_match('/^Bearer\s+(.+)$/i', trim($header), $matches)) {
        return null;
    }

    return trim($matches[1]);
}

function token_hash(string $token): string
{
    return hash('sha256', $token);
}

function verify_password_compat(string $password, string $hash): bool
{
    // bcryptjs creates $2b$ hashes while PHP commonly emits $2y$ hashes.
    // The algorithms are compatible; normalizing the marker keeps imported
    // Node-created accounts usable on PHP.
    if (str_starts_with($hash, '$2b$')) {
        $hash = '$2y$' . substr($hash, 4);
    }
    return password_verify($password, $hash);
}

function authenticate_admin(array $roles = []): array
{
    $token = authorization_token();
    if (!$token) {
        fail(401, '請先登入後台');
    }

    $admin = query_one(
        'SELECT a.id, a.username, a.name, a.email, a.role, a.status, a.last_login_at
         FROM admin_sessions AS s
         JOIN admins AS a ON a.id = s.admin_id
         WHERE s.token_hash = ? AND s.expires_at > NOW()',
        [token_hash($token)]
    );

    if (!$admin || $admin['status'] !== 'active') {
        fail(401, '登入已失效，請重新登入');
    }
    if ($roles && !in_array($admin['role'], $roles, true)) {
        fail(403, '你沒有使用此功能的權限');
    }

    return $admin;
}

function authenticate_member(): array
{
    $token = authorization_token();
    if (!$token) {
        fail(401, '請先登入會員');
    }

    $member = query_one(
        'SELECT m.id, m.name, m.email, m.phone, m.address, m.status
         FROM member_sessions AS s
         JOIN members AS m ON m.id = s.member_id
         WHERE s.token_hash = ? AND s.expires_at > NOW()',
        [token_hash($token)]
    );

    if (!$member || $member['status'] !== 'active') {
        fail(401, '會員登入已失效，請重新登入');
    }

    return $member;
}

function public_admin(array $admin): array
{
    return [
        'id' => (int) $admin['id'],
        'username' => $admin['username'],
        'name' => $admin['name'],
        'email' => $admin['email'],
        'role' => $admin['role'],
        'status' => $admin['status'],
        'lastLoginAt' => $admin['last_login_at'] ?? $admin['lastLoginAt'] ?? null,
    ];
}

function public_member(array $member): array
{
    return [
        'id' => (int) $member['id'],
        'name' => $member['name'],
        'email' => $member['email'],
        'phone' => $member['phone'] ?? null,
        'address' => $member['address'] ?? null,
    ];
}

function route_matches(string $route, string $pattern, array &$params = []): bool
{
    $names = [];
    $parts = explode('/', trim($pattern, '/'));
    $regexParts = array_map(static function (string $part) use (&$names): string {
        if (preg_match('/^\{([A-Za-z][A-Za-z0-9_]*)\}$/', $part, $match)) {
            $names[] = $match[1];
            return '([^/]+)';
        }
        return preg_quote($part, '#');
    }, $parts);
    $regex = implode('/', $regexParts);

    if (!preg_match('#^' . $regex . '$#', trim($route, '/'), $matches)) {
        return false;
    }

    array_shift($matches);
    $params = [];
    foreach ($names as $index => $name) {
        $params[$name] = rawurldecode($matches[$index] ?? '');
    }
    return true;
}

function json_value(mixed $value): mixed
{
    return is_array($value)
        ? json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        : $value;
}

function now_iso(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('Asia/Taipei')))->format(DATE_ATOM);
}

function build_continuous_history(array $history, string $finalStage, ?string $cancelAtStage, string $backfillTime): array
{
    $progress = ['submitted', 'received', 'preparing', 'ready', 'delivering', 'delivered'];
    $known = [];
    foreach ($history as $item) {
        if (is_array($item) && !empty($item['stage'])) {
            $known[$item['stage']] = $item['time'] ?? $backfillTime;
        }
    }

    if ($finalStage === 'cancelled') {
        $lastProgress = in_array($cancelAtStage, $progress, true)
            ? $cancelAtStage
            : (array_key_exists('submitted', $known) ? 'submitted' : $progress[0]);
        $targets = array_slice($progress, 0, array_search($lastProgress, $progress, true) + 1);
        $targets[] = 'cancelled';
    } else {
        $index = array_search($finalStage, $progress, true);
        $targets = $index === false ? [] : array_slice($progress, 0, $index + 1);
    }

    return array_map(
        static fn (string $stage): array => ['stage' => $stage, 'time' => $known[$stage] ?? $backfillTime],
        $targets
    );
}

function create_order_notification(int $orderId, string $type, string $title, string $message): void
{
    execute_sql(
        'INSERT IGNORE INTO admin_notifications (order_id, type, title, message) VALUES (?, ?, ?, ?)',
        [$orderId, $type, $title, $message]
    );
}

function create_pending_overdue_notifications(): void
{
    execute_sql(
        "INSERT IGNORE INTO admin_notifications (order_id, type, title, message)
         SELECT id, 'pending_overdue', CONCAT('訂單 #', order_number, ' 尚未處理'),
                '已等待超過 10 分鐘，請盡快接收訂單。'
         FROM orders
         WHERE status = 'pending' AND created_at <= DATE_SUB(NOW(), INTERVAL 10 MINUTE)"
    );
}

function handle_image_upload(string $kind): never
{
    if (!in_array($kind, ['products', 'news'], true)) {
        fail(400, '上傳類型不正確');
    }

    $file = $_FILES['image'] ?? null;
    if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if (in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            fail(400, '圖片不可超過 5 MB');
        }
        fail(400, '請選擇 JPG、PNG 或 WebP 圖片（最多 5 MB）');
    }
    if ((int) ($file['size'] ?? 0) > 5 * 1024 * 1024) {
        fail(400, '圖片不可超過 5 MB');
    }

    $mime = null;
    if (class_exists('finfo')) {
        $info = new finfo(FILEINFO_MIME_TYPE);
        $mime = $info->file((string) $file['tmp_name']);
    }
    if (!$mime && function_exists('mime_content_type')) {
        $mime = mime_content_type((string) $file['tmp_name']);
    }

    $extensions = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];
    if (!isset($extensions[$mime])) {
        fail(400, '請選擇 JPG、PNG 或 WebP 圖片（最多 5 MB）');
    }

    $uploadRoot = dirname(__DIR__) . '/uploads/' . $kind;
    if (!is_dir($uploadRoot) && !mkdir($uploadRoot, 0755, true) && !is_dir($uploadRoot)) {
        fail(500, '無法建立圖片上傳資料夾');
    }

    $filename = date('YmdHis') . '-' . bin2hex(random_bytes(8)) . '.' . $extensions[$mime];
    $destination = $uploadRoot . '/' . $filename;
    if (!move_uploaded_file((string) $file['tmp_name'], $destination)) {
        fail(500, '圖片儲存失敗，請檢查 uploads 資料夾權限');
    }

    respond(['image_url' => '/uploads/' . $kind . '/' . $filename], 201);
}
