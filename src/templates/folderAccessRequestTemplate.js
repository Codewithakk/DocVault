import * as ApiEndpoints from "../config/ApiEndpoints.js";

export const folderAccessRequestTemplate = (data) => {
    const {
        user = {},
        folder = {},
        manageLink = '#',
        systemName = ApiEndpoints.API_CONFIG.COMPANY_NAME,
        companyName = '',
        logoUrl = '',
        bannerUrl = '',
        themeColor = '#1c69d5',
        BASE_URL = ApiEndpoints.API_CONFIG.baseUrl
    } = data;
    const fullLogoUrl = logoUrl ? `${BASE_URL}${logoUrl}` : ApiEndpoints.API_CONFIG.LOGO_URL;
    const fullBannerUrl = bannerUrl ? `${BASE_URL}${bannerUrl}` : ApiEndpoints.API_CONFIG.EMAIL_BANNER;
    const requesterName = user.name || 'A user';
    const requesterEmail = user.email || 'unknown email';
    const folderName = folder.name || 'Unnamed Folder';

    let html = '';
    html += '<!DOCTYPE html>';
    html += '<html lang="en">';
    html += '<head>';
    html += '<meta charset="utf-8">';
    html += '<meta name="viewport" content="width=device-width, initial-scale=1">';
    html += '<title>Folder Access Request</title>';
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
    html += `<h2 style="font-size:24px; color:#fff; font-weight:500; margin:0; padding:15px 0;">Folder Access Request</h2>`;
    html += `<img src="${fullBannerUrl}" alt="Email Banner" style="max-width:100%; height:auto; display:block; margin:0 auto;">`;
    html += '</td>';
    html += '</tr>';

    // Body
    html += `<tr>`;
    html += `<td style="padding:25px 30px; color:#333;">`;
    html += `<p style="font-size:15px; line-height:25px;">${requesterName} (${requesterEmail}) has requested access to the folder:</p>`;

    // Info box
    html += `<div style="background:#f4f7fc; border-left:4px solid ${themeColor}; padding:12px 15px; border-radius:5px; margin:15px 0;">`;
    html += `<p style="margin:0; font-size:15px;"><strong>Folder Name:</strong> ${folderName}</p>`;
    html += `</div>`;

    html += `<p style="font-size:15px; line-height:25px;">Please review this request and grant or reject access by clicking the button below:</p>`;

    // CTA button
    html += `<div style="text-align:center; margin:25px 0;">`;
    html += `<a href="${manageLink}" target="_blank" rel="noopener noreferrer" style="background:${themeColor}; color:#fff; text-decoration:none; font-size:15px; padding:12px 25px; border-radius:6px; display:inline-block;">Manage Access</a>`;
    html += `</div>`;

    html += `<p style="font-size:14px; line-height:22px; color:#555;">If you did not expect this request, you can safely ignore this email.</p>`;
    html += `</td>`;
    html += `</tr>`;

    // Footer
    html += `<tr>`;
    html += `<td style="padding:20px 30px; background:#f2f4f7;">`;
    html += `<p style="font-size:14px; margin:0 0 8px 0;">Best regards,</p>`;
    html += `<h4 style="font-size:16px; font-weight:600; margin:0;">${companyName} / ${systemName}</h4>`;
    html += `<p style="font-size:12px; color:#777; margin-top:10px;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>`;
    html += `</td>`;
    html += `</tr>`;

    html += `</table>`;
    html += `</div>`;
    html += `</body>`;
    html += `</html>`;

    return html;
};
