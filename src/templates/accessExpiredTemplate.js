import * as ApiEndpoints from "../config/ApiEndpoints.js";

export const accessExpiredTemplate = (data) => {
    const {
        documentId = '',
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
    html += '<html>';
    html += '<head>';
    html += '<meta charset="utf-8">';
    html += '<meta name="viewport" content="width=device-width, initial-scale=1">';
    html += '<title>Access Expired</title>';
    html += '</head>';

    html += '<body style="font-family:Arial;margin:0;padding:0;background:#f8f9fa;">';
    html += '<div style="max-width:600px;margin:auto;">';
    html += '<table style="width:100%;background:#fff;padding:20px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">';

    // Logo (centered and ensured display)
    html += '<tr>';
    html += '<td style="text-align:center; padding:20px;">';
    html += `<img src="${fullLogoUrl}" alt="${companyName} Logo" style="max-width:120px; height:auto; display:block; margin:auto;">`;
    html += '</td>';
    html += '</tr>';

    // Banner Section (centered properly)
    html += '<tr>';
    html += `<td style="background:${themeColor}; text-align:center; border-radius:6px 6px 0 0;">`;
    html += `<h2 style="font-size:24px; color:#fff; font-weight:500; margin:0; padding:15px 0;">Access Expired</h2>`;
    html += `<img src="${fullBannerUrl}" alt="Email Banner" style="max-width:100%; height:auto; display:block; margin:0 auto;">`;
    html += '</td>';
    html += '</tr>';

    // Main Content
    html += '<tr>';
    html += '<td style="padding:20px;">';
    html += '<p style="line-height:25px; font-size:15px; text-align:center;">';
    html += `This invitation has expired. Please request access again from the document owner.`;
    html += '</p>';
    html += '<div style="text-align:center;margin:20px 0;">';
    html += `<a href="${BASE_URL}/documents/request-access/${documentId}" `;
    html += `style="text-decoration:none;border-radius:7px;padding:10px 20px;color:#fff;background:${themeColor};display:inline-block;">`;
    html += 'Request Access</a>';
    html += '</div>';
    html += '</td>';
    html += '</tr>';

    // Support Text
    html += '<tr>';
    html += '<td style="padding:10px 20px;">';
    html += `<p style="line-height:25px; font-size:14px; text-align:center;">`;
    html += `If you believe this is a mistake, please `;
    html += `<a href="${BASE_URL}/support" style="color:${themeColor};text-decoration:none;">contact support</a>.`;
    html += '</p>';
    html += '</td>';
    html += '</tr>';

    // Footer
    html += '<tr>';
    html += '<td style="text-align:center;padding-top:15px;border-top:1px solid #ddd;">';
    html += `<p style="line-height:22px; font-size:13px; color:#555;margin:0;">Regards,<br><strong>The ${companyName} Team</strong></p>`;
    html += `<p style="font-size:12px;color:#888;margin-top:8px;">&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>`;
    html += '</td>';
    html += '</tr>';

    html += '</table>';
    html += '</div>';
    html += '</body>';
    html += '</html>';

    return html;
};
