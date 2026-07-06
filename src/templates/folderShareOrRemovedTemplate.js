import * as ApiEndpoints from "../config/ApiEndpoints.js";

export const folderShareOrRemovedTemplate = (data) => {
    const {
        subject = 'Folder Notification',
        action = 'shared', // 'shared' or 'removed'
        sharedBy = 'Someone',
        folderName = 'Untitled Folder',
        accessLevel = 'Viewer',
        message = '',
        folderId = '',
        APP_URL = ApiEndpoints.API_CONFIG.baseUrl,
        companyName = '',
        logoUrl = '',
        bannerUrl = '',
        themeColor = '#1c69d5',
        systemName = 'System Notification',
    } = data;

    const isShared = action === 'shared';
    const actionColor = isShared ? themeColor : '#dc3545'; // Blue for shared, red for removed
    const fullLogoUrl = logoUrl ? `${BASE_URL}${logoUrl}` : ApiEndpoints.API_CONFIG.LOGO_URL;
    const fullBannerUrl = bannerUrl ? `${BASE_URL}${bannerUrl}` : ApiEndpoints.API_CONFIG.EMAIL_BANNER;
    let html = '';
    html += '<!DOCTYPE html>';
    html += '<html lang="en">';
    html += '<head>';
    html += '<meta charset="utf-8">';
    html += '<meta name="viewport" content="width=device-width, initial-scale=1">';
    html += `<title>${subject}</title>`;
    html += '</head>';

    html += `<body style="font-family:Arial, Helvetica, sans-serif; margin:0; padding:0; background:#f6f9fc;">`;
    html += `<div style="max-width:600px; margin:auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.05);">`;
    html += `<table style="width:100%; border-collapse:collapse;">`;

    // Logo (centered and ensured display)
    html += '<tr>';
    html += '<td style="text-align:center; padding:20px;">';
    html += `<img src="${fullLogoUrl}" alt="${companyName} Logo" style="max-width:120px; height:auto; display:block; margin:auto;">`;
    html += '</td>';
    html += '</tr>';

    // Banner Section (centered properly)
    html += '<tr>';
    html += `<td style="background:${themeColor}; text-align:center; border-radius:6px 6px 0 0;">`;
    html += `<h2 style="font-size:24px; color:#fff; font-weight:500; margin:0; padding:15px 0;">Folder Shared/Removed</h2>`;
    html += `<img src="${fullBannerUrl}" alt="Email Banner" style="max-width:100%; height:auto; display:block; margin:0 auto;">`;
    html += '</td>';
    html += '</tr>';

    // Body
    html += `<tr>`;
    html += `<td style="padding:25px 30px; color:#333;">`;

    if (isShared) {
        html += `<p style="font-size:15px; line-height:25px;">Hello,</p>`;
        html += `<p style="font-size:15px; line-height:25px;"><strong>${sharedBy}</strong> has shared a folder with you.</p>`;

        html += `<div style="background:#f4f7fc; border-left:4px solid ${themeColor}; padding:12px 15px; border-radius:5px; margin:15px 0;">`;
        html += `<p style="margin:0; font-size:15px;">`;
        html += `<strong>Folder Name:</strong> ${folderName}<br>`;
        html += `<strong>Access Level:</strong> ${accessLevel}`;
        html += `</p>`;
        html += `</div>`;

        if (message) {
            html += `<p style="font-size:14px; line-height:22px; color:#555;">`;
            html += `<strong>Message from ${sharedBy}:</strong><br>${message}`;
            html += `</p>`;
        }

        html += `<div style="text-align:center; margin:25px 0;">`;
        html += `<a href="${APP_URL}/folders/${folderId}" target="_blank" rel="noopener noreferrer" style="background:${themeColor}; color:#fff; text-decoration:none; font-size:15px; padding:12px 25px; border-radius:6px; display:inline-block;">Open Folder</a>`;
        html += `</div>`;
    } else {
        html += `<p style="font-size:15px; line-height:25px;">Hello,</p>`;
        html += `<p style="font-size:15px; line-height:25px;">Your access to the folder <strong>${folderName}</strong> has been removed by <strong>${sharedBy}</strong>.</p>`;
        html += `<p style="font-size:14px; line-height:22px; color:#555;">You will no longer be able to view or edit the contents of this folder. If this was unexpected, please contact your system administrator.</p>`;
    }

    html += `</td>`;
    html += `</tr>`;

    // Footer
    html += `<tr>`;
    html += `<td style="background:#f2f4f7; padding:20px 30px;">`;
    html += `<p style="font-size:14px; margin:0 0 8px 0;">Best regards,</p>`;
    html += `<h4 style="font-size:16px; font-weight:600; margin:0;">${companyName}</h4>`;
    html += `<p style="font-size:12px; color:#777; margin-top:10px;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>`;
    html += `</td>`;
    html += `</tr>`;

    html += `</table>`;
    html += `</div>`;
    html += `</body>`;
    html += `</html>`;

    return html;
};
