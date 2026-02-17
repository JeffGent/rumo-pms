<?php
/**
 * Rumo PMS — Email Relay
 * Receives JSON POST, sends via SMTP using PHPMailer-style fsockopen.
 * Upload to Combell: /www/api/send-email.php
 *
 * IMPORTANT: Update SMTP credentials below before deploying.
 * TODO PRODUCTION: Move credentials to Supabase Edge Function secrets.
 */

// ── CORS (allow PMS from any origin during dev) ────────────────────────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── SMTP Configuration ─────────────────────────────────────────────────────
// Load from env file if it exists, otherwise use defaults
$envFile = __DIR__ . '/.smtp-config.php';
if (file_exists($envFile)) {
    require $envFile;
} else {
    // Fallback defaults — override via .smtp-config.php
    define('SMTP_HOST', 'smtp-auth.mailprotect.be');
    define('SMTP_PORT', 587);
    define('SMTP_USER', '');
    define('SMTP_PASS', '');
    define('SMTP_FROM', '');
    define('SMTP_FROM_NAME', 'Hotel');
}

// ── Parse request ───────────────────────────────────────────────────────────
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['to']) || empty($input['subject']) || empty($input['html'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: to, subject, html']);
    exit;
}

$to = filter_var($input['to'], FILTER_VALIDATE_EMAIL);
if (!$to) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid email address']);
    exit;
}

// Optional: API key check (simple shared secret)
if (defined('API_KEY') && API_KEY !== '') {
    $provided = $input['api_key'] ?? ($_SERVER['HTTP_X_API_KEY'] ?? '');
    if ($provided !== API_KEY) {
        http_response_code(403);
        echo json_encode(['error' => 'Invalid API key']);
        exit;
    }
}

$subject  = $input['subject'];
$htmlBody = $input['html'];
$fromEmail = defined('SMTP_FROM') && SMTP_FROM ? SMTP_FROM : SMTP_USER;
$fromName  = $input['from_name'] ?? (defined('SMTP_FROM_NAME') ? SMTP_FROM_NAME : 'Hotel');
$replyTo   = $input['reply_to'] ?? $fromEmail;

// ── Send via SMTP using PHP's built-in mail() with SMTP stream ─────────────
// Combell supports mail() out of the box, but for authenticated SMTP we need
// a socket-based approach. We'll try PHPMailer if available, otherwise use
// a minimal SMTP implementation.

function sendViaSMTP($host, $port, $user, $pass, $from, $fromName, $to, $replyTo, $subject, $html) {
    $timeout = 15;
    $newline = "\r\n";

    // Connect
    $context = stream_context_create();
    if ($port == 465) {
        $sock = stream_socket_client("ssl://{$host}:{$port}", $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $context);
    } else {
        $sock = stream_socket_client("tcp://{$host}:{$port}", $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $context);
    }

    if (!$sock) {
        return ['ok' => false, 'error' => "Connection failed: {$errstr} ({$errno})"];
    }

    $resp = fgets($sock, 512);
    if (substr($resp, 0, 3) !== '220') {
        fclose($sock);
        return ['ok' => false, 'error' => "Unexpected greeting: {$resp}"];
    }

    // Helper to send command and check response
    $send = function($cmd, $expect = '250') use ($sock, $newline) {
        fwrite($sock, $cmd . $newline);
        $resp = '';
        while ($line = fgets($sock, 512)) {
            $resp .= $line;
            // Multi-line response: lines have dash after code, last line has space
            if (isset($line[3]) && $line[3] === ' ') break;
        }
        $code = substr($resp, 0, 3);
        $expectCodes = is_array($expect) ? $expect : [$expect];
        if (!in_array($code, $expectCodes)) {
            return ['ok' => false, 'error' => "SMTP error on '{$cmd}': {$resp}"];
        }
        return ['ok' => true, 'response' => $resp];
    };

    // EHLO
    $r = $send("EHLO rumo-pms", ['250']);
    if (!$r['ok']) { fclose($sock); return $r; }

    // STARTTLS for port 587
    if ($port == 587) {
        $r = $send("STARTTLS", ['220']);
        if (!$r['ok']) { fclose($sock); return $r; }
        stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        $r = $send("EHLO rumo-pms", ['250']);
        if (!$r['ok']) { fclose($sock); return $r; }
    }

    // AUTH LOGIN
    $r = $send("AUTH LOGIN", ['334']);
    if (!$r['ok']) { fclose($sock); return $r; }
    $r = $send(base64_encode($user), ['334']);
    if (!$r['ok']) { fclose($sock); return $r; }
    $r = $send(base64_encode($pass), ['235']);
    if (!$r['ok']) { fclose($sock); return $r; }

    // MAIL FROM / RCPT TO
    $r = $send("MAIL FROM:<{$from}>", ['250']);
    if (!$r['ok']) { fclose($sock); return $r; }
    $r = $send("RCPT TO:<{$to}>", ['250', '251']);
    if (!$r['ok']) { fclose($sock); return $r; }

    // DATA
    $r = $send("DATA", ['354']);
    if (!$r['ok']) { fclose($sock); return $r; }

    // RFC 2047 encode for non-ASCII header values
    $encodeHeader = function($value) {
        if (preg_match('/[^\x20-\x7E]/', $value)) {
            return '=?UTF-8?B?' . base64_encode($value) . '?=';
        }
        return $value;
    };

    // Compose message
    $encodedSubject = $encodeHeader($subject);
    $encodedFromName = $encodeHeader($fromName);
    $headers = implode($newline, [
        "From: {$encodedFromName} <{$from}>",
        "Reply-To: {$replyTo}",
        "To: {$to}",
        "Subject: {$encodedSubject}",
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "X-Mailer: Rumo-PMS/1.0",
    ]);

    $body = $headers . $newline . $newline . chunk_split(base64_encode($html));

    // Escape dots at start of lines
    $body = str_replace("\r\n.\r\n", "\r\n..\r\n", $body);

    fwrite($sock, $body . $newline);
    $r = $send(".", ['250']);
    if (!$r['ok']) { fclose($sock); return $r; }

    // QUIT
    $send("QUIT", ['221']);
    fclose($sock);

    return ['ok' => true];
}

// ── Execute ────────────────────────────────────────────────────────────────
$result = sendViaSMTP(
    SMTP_HOST, SMTP_PORT,
    SMTP_USER, SMTP_PASS,
    $fromEmail, $fromName,
    $to, $replyTo,
    $subject, $htmlBody
);

if ($result['ok']) {
    echo json_encode(['success' => true, 'message' => "Email sent to {$to}"]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $result['error']]);
}
