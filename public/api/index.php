<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$route = trim((string) ($_GET['route'] ?? ''), '/');

if ($route === '') {
    $path = (string) (parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?? '');
    $apiPosition = strpos($path, '/api/');
    if ($apiPosition !== false) {
        $route = trim(substr($path, $apiPosition + 5), '/');
    }
}
if ($route === 'index.php') {
    $route = '';
}

try {
    if ($method === 'OPTIONS') {
        respond(null, 204);
    }

    if ($method === 'GET' && $route === '') {
        respond(['ok' => true, 'service' => 'pizzashop-api']);
    }

    if ($method === 'GET' && $route === 'health') {
        query_one('SELECT 1 AS ok');
        respond(['ok' => true]);
    }

    /* Dashboard --------------------------------------------------------- */

    if ($method === 'GET' && $route === 'dashboard/summary') {
        authenticate_admin(['superadmin', 'admin']);
        $summary = query_one(
            "SELECT
                (SELECT COUNT(*) FROM members) AS memberCount,
                (SELECT COUNT(*) FROM products) AS productCount,
                (SELECT COUNT(*) FROM orders WHERE status = 'pending') AS pendingOrderCount,
                COALESCE((
                    SELECT SUM(total)
                    FROM orders
                    WHERE status = 'completed'
                      AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
                      AND created_at < DATE_ADD(LAST_DAY(CURDATE()), INTERVAL 1 DAY)
                ), 0) AS monthlyRevenue"
        ) ?? [];
        foreach (['memberCount', 'productCount', 'pendingOrderCount'] as $key) {
            $summary[$key] = (int) ($summary[$key] ?? 0);
        }
        $summary['monthlyRevenue'] = (float) ($summary['monthlyRevenue'] ?? 0);
        respond($summary);
    }

    if ($method === 'GET' && $route === 'dashboard/order-trend') {
        authenticate_admin(['superadmin', 'admin']);
        $rows = query_all(
            "WITH RECURSIVE calendar AS (
                SELECT CURDATE() - INTERVAL 6 DAY AS day
                UNION ALL
                SELECT day + INTERVAL 1 DAY FROM calendar WHERE day < CURDATE()
            )
            SELECT
                DATE_FORMAT(calendar.day, '%Y-%m-%d') AS date,
                DATE_FORMAT(calendar.day, '%m/%d') AS label,
                COUNT(orders.id) AS totalOrders,
                COALESCE(SUM(orders.status = 'completed'), 0) AS completedOrders,
                COALESCE(SUM(orders.status = 'cancelled'), 0) AS cancelledOrders
            FROM calendar
            LEFT JOIN orders
              ON orders.created_at >= calendar.day
             AND orders.created_at < calendar.day + INTERVAL 1 DAY
            GROUP BY calendar.day
            ORDER BY calendar.day"
        );
        foreach ($rows as &$row) {
            $row['totalOrders'] = (int) $row['totalOrders'];
            $row['completedOrders'] = (int) $row['completedOrders'];
            $row['cancelledOrders'] = (int) $row['cancelledOrders'];
        }
        unset($row);
        respond($rows);
    }

    if ($method === 'GET' && $route === 'dashboard/top-products') {
        authenticate_admin(['superadmin', 'admin']);
        $days = min(max((int) ($_GET['days'] ?? 30), 1), 365);
        $orders = query_all(
            'SELECT items FROM orders WHERE status = ? AND created_at >= CURDATE() - INTERVAL ' . ($days - 1) . ' DAY',
            ['completed']
        );
        $products = [];
        foreach ($orders as $order) {
            $items = json_decode((string) ($order['items'] ?? '[]'), true);
            if (!is_array($items)) {
                continue;
            }
            foreach ($items as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $quantity = max((int) ($item['qty'] ?? 0), 0);
                $name = trim((string) ($item['name'] ?? ''));
                if ($name === '' || $quantity === 0) {
                    continue;
                }
                $key = isset($item['id']) ? 'id:' . $item['id'] : 'name:' . $name;
                $optionPrice = 0.0;
                foreach (($item['options'] ?? []) as $option) {
                    if (is_array($option)) {
                        $optionPrice += (float) ($option['price'] ?? 0);
                    }
                }
                if (!isset($products[$key])) {
                    $products[$key] = [
                        'productId' => $item['id'] ?? null,
                        'name' => $name,
                        'quantity' => 0,
                        'revenue' => 0.0,
                    ];
                }
                $products[$key]['quantity'] += $quantity;
                $products[$key]['revenue'] += ((float) ($item['price'] ?? 0) + $optionPrice) * $quantity;
            }
        }
        $top = array_values($products);
        usort($top, static function (array $a, array $b): int {
            return ($b['quantity'] <=> $a['quantity'])
                ?: ($b['revenue'] <=> $a['revenue'])
                ?: strnatcasecmp($a['name'], $b['name']);
        });
        respond(array_slice($top, 0, 5));
    }

    /* Member authentication -------------------------------------------- */

    if ($method === 'POST' && $route === 'auth/register') {
        $body = request_body();
        $name = trim((string) ($body['name'] ?? ''));
        $email = trim((string) ($body['email'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 6) {
            fail(400, '請填寫姓名、Email 與至少 6 碼的密碼');
        }
        if (query_one('SELECT id FROM members WHERE email = ?', [$email])) {
            fail(409, '此 Email 已被註冊');
        }
        execute_sql(
            'INSERT INTO members (name, email, password_hash) VALUES (?, ?, ?)',
            [$name, $email, password_hash($password, PASSWORD_BCRYPT, ['cost' => 12])]
        );
        respond(['message' => '註冊成功，請登入'], 201);
    }

    if ($method === 'POST' && $route === 'auth/login') {
        $body = request_body();
        $member = query_one(
            'SELECT id, name, email, password_hash, status, phone, address FROM members WHERE email = ?',
            [trim((string) ($body['email'] ?? ''))]
        );
        if (!$member || !verify_password_compat((string) ($body['password'] ?? ''), (string) $member['password_hash'])) {
            fail(401, '帳號或密碼錯誤');
        }
        if ($member['status'] !== 'active') {
            fail(403, '帳號已停用，請聯絡管理員', ['disabled' => true]);
        }
        $token = bin2hex(random_bytes(48));
        execute_sql('DELETE FROM member_sessions WHERE expires_at <= NOW()');
        execute_sql(
            'INSERT INTO member_sessions (member_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 8 DAY))',
            [$member['id'], token_hash($token)]
        );
        respond(['token' => $token, 'member' => public_member($member)]);
    }

    if ($method === 'POST' && $route === 'auth/logout') {
        authenticate_member();
        $token = authorization_token();
        execute_sql('DELETE FROM member_sessions WHERE token_hash = ?', [token_hash((string) $token)]);
        respond(null, 204);
    }

    /* Administrator authentication and accounts ----------------------- */

    if ($method === 'POST' && $route === 'admin/auth/login') {
        $body = request_body();
        $username = trim((string) ($body['username'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        if ($username === '' || $password === '') {
            fail(400, '請輸入帳號與密碼');
        }
        $admin = query_one('SELECT * FROM admins WHERE username = ?', [$username]);
        if (!$admin || !verify_password_compat($password, (string) $admin['password_hash'])) {
            fail(401, '帳號或密碼錯誤');
        }
        if ($admin['status'] !== 'active') {
            fail(403, '此管理員帳號已停用');
        }
        $token = bin2hex(random_bytes(48));
        execute_sql('DELETE FROM admin_sessions WHERE expires_at <= NOW()');
        execute_sql(
            'INSERT INTO admin_sessions (admin_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 8 DAY))',
            [$admin['id'], token_hash($token)]
        );
        execute_sql('UPDATE admins SET last_login_at = NOW() WHERE id = ?', [$admin['id']]);
        $admin['last_login_at'] = date('Y-m-d H:i:s');
        respond(['token' => $token, 'admin' => public_admin($admin)]);
    }

    if ($method === 'POST' && $route === 'admin/auth/logout') {
        authenticate_admin();
        $token = authorization_token();
        execute_sql('DELETE FROM admin_sessions WHERE token_hash = ?', [token_hash((string) $token)]);
        respond(null, 204);
    }

    if ($method === 'GET' && $route === 'admins') {
        authenticate_admin(['superadmin', 'admin']);
        $rows = query_all(
            "SELECT id, username, name, email, role, status, last_login_at
             FROM admins
             ORDER BY FIELD(role, 'superadmin', 'admin', 'sales'), id"
        );
        respond(array_map('public_admin', $rows));
    }

    if ($method === 'POST' && $route === 'admins') {
        $actor = authenticate_admin(['superadmin', 'admin']);
        $body = request_body();
        $username = trim((string) ($body['username'] ?? ''));
        $name = trim((string) ($body['name'] ?? ''));
        $email = trim((string) ($body['email'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        $role = (string) ($body['role'] ?? 'admin');
        if ($username === '' || $name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 6) {
            fail(400, '請填寫帳號、姓名、Email 與至少 6 碼的密碼');
        }
        if (!in_array($role, ['superadmin', 'admin', 'sales'], true)) {
            fail(400, '管理員角色不正確');
        }
        if ($actor['role'] !== 'superadmin' && $role === 'superadmin') {
            fail(403, '只有最高管理員可以新增最高管理員帳號');
        }
        if (query_one('SELECT id FROM admins WHERE username = ? OR email = ?', [$username, $email])) {
            fail(409, '帳號或 Email 已存在');
        }
        execute_sql(
            'INSERT INTO admins (username, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
            [$username, $name, $email, password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]), $role]
        );
        $id = (int) database()->lastInsertId();
        $created = query_one('SELECT id, username, name, email, role, status, last_login_at FROM admins WHERE id = ?', [$id]);
        respond(public_admin((array) $created), 201);
    }

    $params = [];
    if ($method === 'PUT' && route_matches($route, 'admins/{id}', $params)) {
        $actor = authenticate_admin(['superadmin', 'admin']);
        $target = query_one('SELECT * FROM admins WHERE id = ?', [(int) $params['id']]);
        if (!$target) {
            fail(404, '找不到管理員帳號');
        }
        if ($actor['role'] !== 'superadmin' && $target['role'] === 'superadmin') {
            fail(403, '不可修改最高管理員帳號');
        }
        $body = request_body();
        if ((int) $actor['id'] === (int) $target['id'] && ($body['status'] ?? null) === 'inactive') {
            fail(400, '不可停用目前登入的帳號');
        }
        $name = trim((string) ($body['name'] ?? ''));
        $email = trim((string) ($body['email'] ?? ''));
        $role = (string) ($body['role'] ?? $target['role']);
        $status = (string) ($body['status'] ?? $target['status']);
        if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            fail(400, '姓名與 Email 不可空白');
        }
        if (!in_array($role, ['superadmin', 'admin', 'sales'], true) || !in_array($status, ['active', 'inactive'], true)) {
            fail(400, '角色或狀態不正確');
        }
        if ($actor['role'] !== 'superadmin' && $role === 'superadmin') {
            fail(403, '只有最高管理員可以設定最高管理員角色');
        }
        if (query_one('SELECT id FROM admins WHERE email = ? AND id != ?', [$email, $target['id']])) {
            fail(409, '此 Email 已被使用');
        }
        $sets = ['name = ?', 'email = ?', 'role = ?', 'status = ?'];
        $values = [$name, $email, $role, $status];
        $password = (string) ($body['password'] ?? '');
        if ($password !== '') {
            if (strlen($password) < 6) {
                fail(400, '新密碼至少需要 6 碼');
            }
            $sets[] = 'password_hash = ?';
            $values[] = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        }
        $values[] = $target['id'];
        execute_sql('UPDATE admins SET ' . implode(', ', $sets) . ' WHERE id = ?', $values);
        $updated = query_one('SELECT id, username, name, email, role, status, last_login_at FROM admins WHERE id = ?', [$target['id']]);
        respond(public_admin((array) $updated));
    }

    $params = [];
    if ($method === 'DELETE' && route_matches($route, 'admins/{id}', $params)) {
        $actor = authenticate_admin(['superadmin', 'admin']);
        $target = query_one('SELECT id, role FROM admins WHERE id = ?', [(int) $params['id']]);
        if (!$target) {
            fail(404, '找不到管理員帳號');
        }
        if ($actor['role'] !== 'superadmin' && $target['role'] === 'superadmin') {
            fail(403, '不可刪除最高管理員帳號');
        }
        if ((int) $actor['id'] === (int) $target['id']) {
            fail(400, '不可刪除目前登入的帳號');
        }
        execute_sql('DELETE FROM admins WHERE id = ?', [$target['id']]);
        respond(null, 204);
    }

    /* Notifications ---------------------------------------------------- */

    if ($method === 'GET' && $route === 'admin/notifications') {
        $admin = authenticate_admin(['superadmin', 'admin', 'sales']);
        create_pending_overdue_notifications();
        $rows = query_all(
            'SELECT n.id, n.order_id AS orderId, o.order_number AS orderNumber, o.name AS customerName,
                    o.total, o.delivery_type AS deliveryType, o.created_at AS orderCreatedAt,
                    o.status AS orderStatus, n.type, n.title, n.message,
                    n.created_at AS createdAt, (r.notification_id IS NOT NULL) AS isRead
             FROM admin_notifications AS n
             JOIN orders AS o ON o.id = n.order_id
             LEFT JOIN admin_notification_reads AS r
               ON r.notification_id = n.id AND r.admin_id = ?
             ORDER BY n.created_at DESC
             LIMIT 30',
            [$admin['id']]
        );
        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['orderId'] = (int) $row['orderId'];
            $row['isRead'] = (bool) $row['isRead'];
        }
        unset($row);
        respond($rows);
    }

    $params = [];
    if ($method === 'POST' && route_matches($route, 'admin/notifications/{id}/read', $params)) {
        $admin = authenticate_admin(['superadmin', 'admin', 'sales']);
        if (!query_one('SELECT id FROM admin_notifications WHERE id = ?', [(int) $params['id']])) {
            fail(404, '找不到通知');
        }
        execute_sql(
            'INSERT IGNORE INTO admin_notification_reads (notification_id, admin_id) VALUES (?, ?)',
            [(int) $params['id'], $admin['id']]
        );
        respond(null, 204);
    }

    if ($method === 'POST' && $route === 'admin/notifications/read-all') {
        $admin = authenticate_admin(['superadmin', 'admin', 'sales']);
        create_pending_overdue_notifications();
        execute_sql(
            'INSERT IGNORE INTO admin_notification_reads (notification_id, admin_id)
             SELECT id, ? FROM admin_notifications',
            [$admin['id']]
        );
        respond(null, 204);
    }

    /* Uploads ---------------------------------------------------------- */

    if ($method === 'POST' && $route === 'uploads/products') {
        authenticate_admin(['superadmin', 'admin']);
        handle_image_upload('products');
    }
    if ($method === 'POST' && $route === 'uploads/news') {
        authenticate_admin(['superadmin', 'admin']);
        handle_image_upload('news');
    }

    /* Member profile --------------------------------------------------- */

    $params = [];
    if ($method === 'GET' && route_matches($route, 'me/{id}', $params)) {
        $member = authenticate_member();
        if ((int) $member['id'] !== (int) $params['id']) {
            fail(403, '無法讀取其他會員資料');
        }
        respond(public_member($member));
    }

    $params = [];
    if ($method === 'PUT' && route_matches($route, 'me/{id}', $params)) {
        $member = authenticate_member();
        if ((int) $member['id'] !== (int) $params['id']) {
            fail(403, '無法修改其他會員資料');
        }
        $body = request_body();
        $name = trim((string) ($body['name'] ?? ''));
        if ($name === '') {
            fail(400, '姓名不可為空白');
        }
        execute_sql(
            'UPDATE members SET name = ?, phone = ?, address = ? WHERE id = ?',
            [
                $name,
                trim((string) ($body['phone'] ?? '')) ?: null,
                trim((string) ($body['address'] ?? '')) ?: null,
                $member['id'],
            ]
        );
        respond(null, 204);
    }

    $params = [];
    if ($method === 'POST' && route_matches($route, 'me/{id}/password', $params)) {
        $member = authenticate_member();
        if ((int) $member['id'] !== (int) $params['id']) {
            fail(403, '無法修改其他會員密碼');
        }
        $body = request_body();
        $oldPassword = (string) ($body['oldPassword'] ?? '');
        $newPassword = (string) ($body['newPassword'] ?? '');
        if ($oldPassword === '' || strlen($newPassword) < 6) {
            fail(400, '請填寫原密碼與至少 6 碼的新密碼');
        }
        $passwordRow = query_one('SELECT password_hash FROM members WHERE id = ?', [$member['id']]);
        if (!$passwordRow || !verify_password_compat($oldPassword, (string) $passwordRow['password_hash'])) {
            fail(400, '原密碼錯誤');
        }
        execute_sql(
            'UPDATE members SET password_hash = ? WHERE id = ?',
            [password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]), $member['id']]
        );
        respond(null, 204);
    }

    /* Resource CRUD ---------------------------------------------------- */

    if ($method === 'POST' && $route === 'members') {
        authenticate_admin(['superadmin', 'admin']);
        $body = request_body();
        $name = trim((string) ($body['name'] ?? ''));
        $email = trim((string) ($body['email'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        $phone = trim((string) ($body['phone'] ?? ''));
        $address = trim((string) ($body['address'] ?? ''));
        $status = (string) ($body['status'] ?? 'active');
        if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 6) {
            fail(400, '請填寫姓名、Email 與至少 6 碼的密碼');
        }
        if (!in_array($status, ['active', 'inactive'], true)) {
            fail(400, '會員狀態不正確');
        }
        if (query_one('SELECT id FROM members WHERE email = ?', [$email])) {
            fail(409, '此 Email 已被註冊');
        }
        execute_sql(
            'INSERT INTO members (name, email, password_hash, phone, address, status) VALUES (?, ?, ?, ?, ?, ?)',
            [
                $name,
                $email,
                password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]),
                $phone ?: null,
                $address ?: null,
                $status,
            ]
        );
        respond(['id' => (int) database()->lastInsertId()], 201);
    }

    $resources = [
        'members' => [
            'table' => 'members',
            'columns' => ['name', 'email', 'phone', 'address', 'status'],
            'select' => 'id, name, email, phone, address, status, created_at AS createdAt',
            'protectedGet' => true,
        ],
        'products' => [
            'table' => 'products',
            'columns' => ['name', 'category', 'description', 'price', 'image_url', 'options', 'status', 'sort_order'],
            'select' => 'id, name, category, description AS `desc`, price, image_url AS image, options, status, sort_order AS sort, created_at AS createdAt',
            'protectedGet' => false,
        ],
        'news' => [
            'table' => 'news',
            'columns' => ['title', 'content', 'image_url', 'published_at', 'status'],
            'select' => "id, title, content AS `desc`, image_url AS image, DATE_FORMAT(published_at, '%Y-%m-%d') AS date, status, created_at AS createdAt",
            'protectedGet' => false,
        ],
    ];

    foreach ($resources as $resourceName => $config) {
        if ($method === 'GET' && $route === $resourceName) {
            if ($config['protectedGet']) {
                authenticate_admin(['superadmin', 'admin']);
            }
            $params = [];
            $where = '';
            if (isset($_GET['status']) && $_GET['status'] !== '') {
                $where = ' WHERE status = ?';
                $params[] = (string) $_GET['status'];
            }
            $rows = query_all(
                'SELECT ' . $config['select'] . ' FROM ' . $config['table'] . $where . ' ORDER BY id DESC',
                $params
            );
            respond($rows);
        }

        if ($method === 'POST' && $route === $resourceName) {
            authenticate_admin(['superadmin', 'admin']);
            $body = request_body();
            $columns = $config['columns'];
            $values = array_map(static fn (string $column): mixed => json_value($body[$column] ?? null), $columns);
            $placeholders = implode(', ', array_fill(0, count($columns), '?'));
            execute_sql(
                'INSERT INTO ' . $config['table'] . ' (`' . implode('`, `', $columns) . '`) VALUES (' . $placeholders . ')',
                $values
            );
            respond(['id' => (int) database()->lastInsertId()], 201);
        }

        $resourceParams = [];
        if ($method === 'PUT' && route_matches($route, $resourceName . '/{id}', $resourceParams)) {
            authenticate_admin(['superadmin', 'admin']);
            $body = request_body();
            $columns = $config['columns'];
            $values = array_map(static fn (string $column): mixed => json_value($body[$column] ?? null), $columns);
            $values[] = (int) $resourceParams['id'];
            $sets = implode(', ', array_map(static fn (string $column): string => '`' . $column . '` = ?', $columns));
            $statement = execute_sql('UPDATE ' . $config['table'] . ' SET ' . $sets . ' WHERE id = ?', $values);
            if ($statement->rowCount() === 0 && !query_one('SELECT id FROM ' . $config['table'] . ' WHERE id = ?', [(int) $resourceParams['id']])) {
                fail(404, '找不到資料');
            }
            respond(null, 204);
        }

        $resourceParams = [];
        if ($method === 'DELETE' && route_matches($route, $resourceName . '/{id}', $resourceParams)) {
            authenticate_admin(['superadmin', 'admin']);
            $statement = execute_sql('DELETE FROM ' . $config['table'] . ' WHERE id = ?', [(int) $resourceParams['id']]);
            if ($statement->rowCount() === 0) {
                fail(404, '找不到資料');
            }
            respond(null, 204);
        }
    }

    /* Orders ----------------------------------------------------------- */

    $orderSelect = 'SELECT id, order_number, member_id, name, phone, address,
                           delivery_type AS deliveryType, pickup_time AS pickupTime,
                           total, items, status, sub_status AS subStatus, remark,
                           status_history AS statusHistory, created_at AS createdAt
                    FROM orders';

    if ($method === 'GET' && $route === 'orders') {
        authenticate_admin(['superadmin', 'admin', 'sales']);
        respond(query_all($orderSelect . ' ORDER BY id DESC'));
    }

    if ($method === 'GET' && $route === 'orders/guest') {
        $orderNumber = trim((string) ($_GET['orderNumber'] ?? ''));
        $phone = trim((string) ($_GET['phone'] ?? ''));
        if ($orderNumber === '' || $phone === '') {
            fail(400, '請填寫訂單編號與手機號碼');
        }
        respond(query_all($orderSelect . ' WHERE order_number = ? AND phone = ?', [$orderNumber, $phone]));
    }

    $params = [];
    if ($method === 'GET' && route_matches($route, 'orders/member/{memberId}', $params)) {
        $member = authenticate_member();
        if ((int) $member['id'] !== (int) $params['memberId']) {
            fail(403, '無法查詢其他會員的訂單');
        }
        respond(query_all($orderSelect . ' WHERE member_id = ? ORDER BY id DESC', [$member['id']]));
    }

    if ($method === 'POST' && $route === 'orders') {
        $body = request_body();
        $name = trim((string) ($body['name'] ?? ''));
        $phone = trim((string) ($body['phone'] ?? ''));
        $address = trim((string) ($body['address'] ?? ''));
        $deliveryType = ($body['delivery_type'] ?? '') === 'pickup' ? 'pickup' : 'delivery';
        $pickupTime = trim((string) ($body['pickup_time'] ?? ''));
        $items = $body['items'] ?? null;
        if ($name === '' || $phone === '' || !is_array($items) || count($items) === 0) {
            fail(400, '請填寫收件人、電話與至少一件商品');
        }
        if ($deliveryType === 'delivery' && $address === '') {
            fail(400, '請填寫配送地址');
        }
        if ($deliveryType === 'pickup' && $pickupTime === '') {
            fail(400, '請選擇取貨時間');
        }

        $memberId = null;
        if (!empty($body['member_id'])) {
            $member = authenticate_member();
            if ((int) $member['id'] !== (int) $body['member_id']) {
                fail(403, '會員身分不正確');
            }
            $memberId = (int) $member['id'];
        }

        $productIds = [];
        foreach ($items as $item) {
            if (!is_array($item) || (int) ($item['id'] ?? 0) <= 0) {
                fail(400, '訂單商品資料不正確');
            }
            $productIds[] = (int) $item['id'];
        }
        $productIds = array_values(array_unique($productIds));
        $placeholders = implode(', ', array_fill(0, count($productIds), '?'));
        $productRows = query_all(
            'SELECT id, name, price, options, status FROM products WHERE id IN (' . $placeholders . ')',
            $productIds
        );
        $productMap = [];
        foreach ($productRows as $product) {
            $productMap[(int) $product['id']] = $product;
        }

        $canonicalItems = [];
        $total = 0.0;
        foreach ($items as $item) {
            $productId = (int) $item['id'];
            $product = $productMap[$productId] ?? null;
            $quantity = (int) ($item['qty'] ?? 0);
            if (!$product || $product['status'] !== 'active' || $quantity < 1 || $quantity > 99) {
                fail(400, '訂單包含不存在、未上架或數量不正確的商品');
            }

            $availableOptions = json_decode((string) ($product['options'] ?? '[]'), true);
            $availableOptions = is_array($availableOptions) ? $availableOptions : [];
            $selectedOptions = [];
            $selectedLabels = [];
            foreach (($item['options'] ?? []) as $selected) {
                if (!is_array($selected)) {
                    continue;
                }
                $label = (string) ($selected['label'] ?? '');
                if (array_key_exists($label, $selectedLabels)) {
                    continue;
                }
                $match = null;
                foreach ($availableOptions as $available) {
                    if (is_array($available) && (string) ($available['label'] ?? '') === $label) {
                        $match = $available;
                        break;
                    }
                }
                if (!$match) {
                    fail(400, '商品選項已變更，請重新選擇');
                }
                $selectedLabels[$label] = true;
                $selectedOptions[] = ['label' => $label, 'price' => (float) ($match['price'] ?? 0)];
            }

            $unitPrice = (float) $product['price'];
            foreach ($selectedOptions as $option) {
                $unitPrice += (float) $option['price'];
            }
            $total += $unitPrice * $quantity;
            $canonicalItems[] = [
                'id' => $productId,
                'name' => $product['name'],
                'price' => (float) $product['price'],
                'options' => $selectedOptions,
                'qty' => $quantity,
            ];
        }
        $total = round($total, 2);
        if ($deliveryType === 'delivery' && $total < 500) {
            fail(400, '金額不足 500 元，無法進行配送');
        }

        $pdo = database();
        $pdo->beginTransaction();
        try {
            $prefix = date('YmdHi');
            $count = query_one('SELECT COUNT(*) AS cnt FROM orders WHERE order_number LIKE ?', [$prefix . '%']);
            $sequence = str_pad((string) (((int) ($count['cnt'] ?? 0)) + 1), 3, '0', STR_PAD_LEFT);
            $orderNumber = $prefix . $sequence;
            $history = [['stage' => 'submitted', 'time' => now_iso()]];
            execute_sql(
                'INSERT INTO orders
                    (order_number, member_id, name, phone, address, delivery_type, pickup_time, total, items, status, sub_status, status_history)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $orderNumber,
                    $memberId,
                    $name,
                    $phone,
                    $deliveryType === 'delivery' ? $address : null,
                    $deliveryType,
                    $deliveryType === 'pickup' ? $pickupTime : null,
                    $total,
                    json_value($canonicalItems),
                    'pending',
                    'submitted',
                    json_value($history),
                ]
            );
            $orderId = (int) $pdo->lastInsertId();
            create_order_notification(
                $orderId,
                'new_order',
                '新訂單 #' . $orderNumber,
                'NT$' . number_format($total, 0, '.', ',') . '，等待處理。'
            );
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }
        respond(['id' => $orderId, 'order_number' => $orderNumber], 201);
    }

    $params = [];
    if ($method === 'POST' && route_matches($route, 'orders/{id}/cancel', $params)) {
        $body = request_body();
        $order = query_one(
            'SELECT id, order_number, member_id, phone, status, sub_status AS subStatus, status_history AS statusHistory
             FROM orders WHERE id = ?',
            [(int) $params['id']]
        );
        if (!$order) {
            fail(404, '找不到訂單');
        }
        if ($order['member_id']) {
            $member = authenticate_member();
            if ((int) $member['id'] !== (int) $order['member_id']) {
                fail(403, '無法取消此筆訂單');
            }
        } elseif ((string) $order['phone'] !== (string) ($body['phone'] ?? '')) {
            fail(403, '無法取消此筆訂單');
        }
        if ($order['status'] !== 'pending') {
            fail(400, '訂單已進入處理流程，無法由客戶取消');
        }
        $history = json_decode((string) ($order['statusHistory'] ?? '[]'), true);
        $history = is_array($history) ? $history : [];
        $finalHistory = build_continuous_history($history, 'cancelled', $order['subStatus'] ?? null, now_iso());
        execute_sql(
            "UPDATE orders
             SET status = 'cancelled', sub_status = 'cancelled', cancelled_by = 'customer', status_history = ?
             WHERE id = ?",
            [json_value($finalHistory), $order['id']]
        );
        create_order_notification(
            (int) $order['id'],
            'customer_cancelled',
            '客戶已取消訂單 #' . $order['order_number'],
            '此訂單已由客戶取消。'
        );
        respond(null, 204);
    }

    $params = [];
    if ($method === 'PUT' && route_matches($route, 'orders/{id}', $params)) {
        authenticate_admin(['superadmin', 'admin', 'sales']);
        $body = request_body();
        $current = query_one(
            'SELECT sub_status AS subStatus, status, delivery_type AS deliveryType FROM orders WHERE id = ?',
            [(int) $params['id']]
        );
        if (!$current) {
            fail(404, '找不到資料');
        }

        $hasStatus = array_key_exists('status', $body);
        $hasSubStatus = array_key_exists('sub_status', $body);
        $hasHistory = array_key_exists('status_history', $body);
        $hasRemark = array_key_exists('remark', $body);
        $status = $hasStatus ? (string) $body['status'] : null;
        $subStatus = $hasSubStatus ? (string) $body['sub_status'] : null;

        if (in_array($current['status'], ['cancelled', 'completed'], true)
            && $hasSubStatus && $subStatus !== $current['subStatus']) {
            fail(400, '已取消或已完成的訂單無法修改狀態');
        }

        $orderStages = ['submitted', 'received', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled'];
        $progress = ['submitted', 'received', 'preparing', 'ready', 'delivering', 'delivered'];
        $finalStatus = $status;
        if ($hasSubStatus) {
            if (!in_array($subStatus, $orderStages, true)) {
                fail(400, '訂單狀態不正確');
            }
            if ($subStatus === 'delivering' && $current['deliveryType'] !== 'delivery') {
                fail(400, '取貨訂單無法設定配送中狀態');
            }
            $currentIndex = array_search($current['subStatus'], $progress, true);
            $newIndex = array_search($subStatus, $progress, true);
            if ($subStatus !== 'cancelled' && $currentIndex !== false && $newIndex !== false && $newIndex < $currentIndex) {
                fail(400, '訂單狀態不可回溯');
            }
            $finalStatus = match ($subStatus) {
                'delivered' => 'completed',
                'cancelled' => 'cancelled',
                'submitted' => 'pending',
                default => 'processing',
            };
        }

        if ($finalStatus !== null && !in_array($finalStatus, ['pending', 'processing', 'completed', 'cancelled'], true)) {
            fail(400, '訂單狀態不正確');
        }

        $finalHistory = $hasHistory && is_array($body['status_history']) ? $body['status_history'] : null;
        if ($hasSubStatus) {
            $historyBase = is_array($finalHistory) ? $finalHistory : [];
            $last = $historyBase ? $historyBase[array_key_last($historyBase)] : [];
            $confirmTime = is_array($last) && !empty($last['time']) ? (string) $last['time'] : now_iso();
            $finalHistory = build_continuous_history(
                $historyBase,
                (string) $subStatus,
                $subStatus === 'cancelled' ? $current['subStatus'] : null,
                $confirmTime
            );
        }

        $sets = [];
        $values = [];
        if ($finalStatus !== null) {
            $sets[] = 'status = ?';
            $values[] = $finalStatus;
        }
        if ($hasSubStatus) {
            $sets[] = 'sub_status = ?';
            $values[] = $subStatus;
        }
        if ($finalHistory !== null) {
            $sets[] = 'status_history = ?';
            $values[] = json_value($finalHistory);
        }
        if ($subStatus === 'cancelled') {
            $sets[] = "cancelled_by = 'admin'";
        }
        if ($hasRemark) {
            $sets[] = 'remark = ?';
            $values[] = $body['remark'];
        }
        if (!$sets) {
            fail(400, '請提供要更新的欄位');
        }
        $values[] = (int) $params['id'];
        execute_sql('UPDATE orders SET ' . implode(', ', $sets) . ' WHERE id = ?', $values);
        respond(null, 204);
    }

    $params = [];
    if ($method === 'DELETE' && route_matches($route, 'orders/{id}', $params)) {
        authenticate_admin(['superadmin', 'admin']);
        $statement = execute_sql('DELETE FROM orders WHERE id = ?', [(int) $params['id']]);
        if ($statement->rowCount() === 0) {
            fail(404, '找不到資料');
        }
        respond(null, 204);
    }

    fail(404, '找不到 API 路由');
} catch (ApiException $error) {
    respond(['message' => $error->getMessage(), ...$error->details], $error->status);
} catch (PDOException $error) {
    error_log('Database error: ' . $error->getMessage());
    if ((string) $error->getCode() === '23000') {
        respond(['message' => '資料重複或仍被其他資料使用'], 409);
    }
    respond(['message' => '伺服器或資料庫發生錯誤'], 500);
} catch (Throwable $error) {
    error_log('API error: ' . $error->getMessage() . "\n" . $error->getTraceAsString());
    respond(['message' => '伺服器或資料庫發生錯誤'], 500);
}
