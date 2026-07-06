import * as ApiEndpoints from "../config/ApiEndpoints.js";

export const accessRequestTemplate = (data) => {
    const {
        requesterName = '',
        requesterEmail = '',
        fileName = 'Untitled Document',
        grantLinksHtml = '',
        themeColor = '#1c69d5',
        companyName = '',
        logoUrl = '',
        bannerUrl = '',
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
    html += '<title>Access Request Received</title>';
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
    html += `<h2 style="font-size:24px; color:#fff; font-weight:500; margin:0; padding:15px 0;">Access Request Received</h2>`;
    html += `<img src="${fullBannerUrl}" alt="Email Banner" style="max-width:100%; height:auto; display:block; margin:0 auto;">`;
    html += '</td>';
    html += '</tr>';

    // Body Content
    html += `<tr>`;
    html += `<td style="padding:25px 30px; color:#333;">`;
    html += `<p style="font-size:15px; line-height:25px;">`;
    html += `<strong>${requesterName || requesterEmail}</strong> has requested access to your document:`;
    html += `</p>`;
    html += `<p style="font-size:16px; font-weight:600; line-height:25px;">${fileName}</p>`;
    html += `<p style="font-size:15px; line-height:25px;">Choose one of the options below to grant access for a specific duration:</p>`;

    // Access Grant Buttons
    html += `<div style="margin:20px 0;">`;
    html += `<ul style="list-style:none; padding:0; margin:0;">${grantLinksHtml}</ul>`;
    html += `</div>`;

    html += `<p style="margin-top:20px; color:#777; font-size:13px;">This link will expire in 3 days. Please do not share it with anyone.</p>`;
    html += `<p style="font-size:14px; line-height:22px;">If you believe this request was made in error, please `;
    html += `<a href="${BASE_URL}/support" style="color:${themeColor}; text-decoration:none;">contact support</a>.`;
    html += `</p>`;
    html += `</td>`;
    html += `</tr>`;

    // Footer
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
