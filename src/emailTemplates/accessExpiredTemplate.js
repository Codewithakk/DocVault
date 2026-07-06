/**
 * HTML page for expired access invitation
 * @param {string} documentId
 */
export const accessExpiredTemplate = (documentId) => `
<html>
<head>
    <title>Access Expired</title>
    <style>
        body { font-family: Arial; text-align: center; background:#f8f9fa; padding:60px; }
        .modal { background:#fff; border-radius:10px; padding:30px; display:inline-block; box-shadow:0 2px 8px rgba(0,0,0,0.1); }
        button { background:#007bff; color:#fff; padding:10px 20px; border:none; border-radius:5px; cursor:pointer; margin-top:20px; }
    </style>
</head>
<body>
    <div class="modal">
        <h2>Access Expired</h2>
        <p>This invitation has expired. Please request access again from the document owner.</p>
        <button onclick="window.location.href='/api/documents/${documentId}/request-access'">Request Access</button>
    </div>
</body>
</html>
`;

/**
 * Simple alert redirect template
 * @param {string} message
 * @param {string} redirectUrl
 */
export const alertRedirectTemplate = (message, redirectUrl) => `
<script>
    alert('${message}');
    window.location.href='${redirectUrl}';
</script>
`;