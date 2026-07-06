import * as ApiEndpoints from "../config/ApiEndpoints.js";

export const accessGrantedTemplate = (data) => {
    const {
        userName = 'User',
        fileName = 'Document',
        ownerName = 'Owner',
        duration = 'default',
        expiresAt = '',
        accessUrl = '#',
        companyName = '',
        logoUrl = '',
        bannerUrl = '',
        themeColor = '#1c69d5',
        BASE_URL = ApiEndpoints.API_CONFIG.baseUrl
    } = data;
    const fullLogoUrl = logoUrl ? `${BASE_URL}${logoUrl}` : ApiEndpoints.API_CONFIG.LOGO_URL;
    const fullBannerUrl = bannerUrl ? `${BASE_URL}${bannerUrl}` : ApiEndpoints.API_CONFIG.EMAIL_BANNER;
    let html = '';
    html += '<!DOCTYPE html>';
    html += '<html lang="en">';
    html += '<head>';
    html += '<meta charset="UTF-8">';
    html += '<meta name="viewport" content="width=device-width, initial-scale=1">';
    html += `<title>Access Granted - ${companyName}</title>`;
    html += '</head>';

    html += `<body style="font-family:Arial, Helvetica, sans-serif; margin:0; padding:0; background:#f6f9fc;">`;
    html += `<div style="max-width:600px; margin:auto; background:#ffffff; border-radius:8px; overflow:hidden;">`;
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
    html += `<h2 style="font-size:24px; color:#fff; font-weight:500; margin:0; padding:15px 0;">Access Granted</h2>`;
    html += `<img src="${fullBannerUrl}" alt="Email Banner" style="max-width:100%; height:auto; display:block; margin:0 auto;">`;
    html += '</td>';
    html += '</tr>';

    // Main Body
    html += `<tr>`;
    html += `<td style="padding:25px 30px; color:#333;">`;
    html += `<p style="font-size:15px; line-height:25px;">Hi ${userName},</p>`;
    html += `<p style="font-size:15px; line-height:25px;">`;
    html += `You have been granted access to the document <strong>${fileName}</strong> by <strong>${ownerName}</strong>.`;
    html += `</p>`;

    // Access duration info box
    html += `<div style="background:#f4f7fc; border-left:4px solid ${themeColor}; padding:15px; border-radius:5px; margin:20px 0;">`;
    if (duration === 'custom') {
        html += `<p style="font-size:15px; margin:0;"><strong>Access Duration:</strong> Custom (until ${expiresAt})</p>`;
    } else {
        html += `<p style="font-size:15px; margin:0;"><strong>Access Duration:</strong> ${duration}</p>`;
    }
    html += `</div>`;

    // View Document button
    html += `<p style="font-size:15px; line-height:25px;">You can view the document using the button below:</p>`;
    html += `<div style="text-align:center; margin:25px 0;">`;
    html += `<a href="${accessUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;border-radius:7px;padding:12px 25px;color:#fff;background:${themeColor};font-size:15px;display:inline-block;">`;
    html += `View Document</a>`;
    html += `</div>`;

    html += `<p style="font-size:14px; line-height:22px;">If you encounter any issues accessing the document, please `;
    html += `<a href="${BASE_URL}/support" style="color:${themeColor}; text-decoration:none;">contact support</a>.`;
    html += `</p>`;
    html += `</td>`;
    html += `</tr>`;

    // Footer (same as other templates)
    html += `<tr>`;
    html += `<td style="text-align:center; padding:20px; background:#f2f4f7;">`;
    html += `<p style="font-size:14px; line-height:22px; margin:0;">Regards,<br><strong>The ${companyName} Team</strong></p>`;
    html += `<p style="font-size:12px; color:#777; margin-top:8px;">&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>`;
    html += `</td>`;
    html += `</tr>`;

    html += `</table>`;
    html += `</div>`;
    html += `</body>`;
    html += `</html>`;

    return html;
};
