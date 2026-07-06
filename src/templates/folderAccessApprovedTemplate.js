import * as ApiEndpoints from "../config/ApiEndpoints.js";

export const folderAccessApprovedTemplate = (data) => {
    const {
        userName = 'User',
        folderName = 'Unnamed Folder',
        access = 'Read Only',
        expiresAt = null,
        folderLink = '#',
        systemName = ApiEndpoints.API_CONFIG.COMPANY_NAME,
        themeColor = '#28a745', // Green approval theme
        companyName = '',
        logoUrl = '',
        bannerUrl = '',
        BASE_URL = ApiEndpoints.API_CONFIG.baseUrl
    } = data;
    const fullLogoUrl = logoUrl ? `${BASE_URL}${logoUrl}` : ApiEndpoints.API_CONFIG.LOGO_URL;
    const fullBannerUrl = bannerUrl ? `${BASE_URL}${bannerUrl}` : ApiEndpoints.API_CONFIG.EMAIL_BANNER;
    const formattedExpiry = expiresAt
        ? new Date(expiresAt).toLocaleString()
        : 'N/A';

    let html = '';
    html += '<!DOCTYPE html>';
    html += '<html>';
    html += '<head>';
    html += '<meta charset="utf-8">';
    html += '<meta name="viewport" content="width=device-width, initial-scale=1">';
    html += '<title>Folder Access Approved</title>';
    html += '</head>';

    html += '<body style="font-family:Arial;margin:0;padding:0;">';
    html += '<div style="max-width:600px;">';
    html += '<table style="width:100%;padding:20px;">';

    // Logo (centered and ensured display)
    html += '<tr>';
    html += '<td style="text-align:center; padding:20px;">';
    html += `<img src="${fullLogoUrl}" alt="${companyName} Logo" style="max-width:120px; height:auto; display:block; margin:auto;">`;
    html += '</td>';
    html += '</tr>';

    // Banner Section (centered properly)
    html += '<tr>';
    html += `<td style="background:${themeColor}; text-align:center; border-radius:6px 6px 0 0;">`;
    html += `<h2 style="font-size:24px; color:#fff; font-weight:500; margin:0; padding:15px 0;">Folder Access Approved</h2>`;
    html += `<img src="${fullBannerUrl}" alt="Email Banner" style="max-width:100%; height:auto; display:block; margin:0 auto;">`;
    html += '</td>';
    html += '</tr>';

    // Body
    html += '<tr>';
    html += '<td>';
    html += `<p style="line-height:25px; font-size:15px;">Hello ${userName},</p>`;
    html += `<p style="line-height:25px; font-size:15px;">Your request for access to the folder <strong>${folderName}</strong> has been approved.</p>`;
    html += `<p style="line-height:25px; font-size:15px;">`;
    html += `<strong>Access Level:</strong> ${access}<br>`;
    html += `<strong>Expires At:</strong> ${formattedExpiry}`;
    html += `</p>`;
    html += '</td>';
    html += '</tr>';

    // Button
    html += '<tr>';
    html += '<td style="text-align:center;">';
    html += '<div style="margin:20px 0;">';
    html += `<a href="${folderLink}" style="text-decoration:none;border-radius:7px;padding:10px 20px;color:#fff;background:${themeColor};">`;
    html += 'Open Folder</a>';
    html += '</div>';
    html += '</td>';
    html += '</tr>';

    // Support info
    html += '<tr>';
    html += '<td>';
    html += `<p style="line-height:25px; font-size:15px;">If you experience issues accessing the folder, please <a href="${BASE_URL}/support" style="color:blue;text-decoration:none;">contact support.</a></p>`;
    html += '</td>';
    html += '</tr>';

    // Footer
    html += '<tr>';
    html += '<td>';
    html += '<div style="margin:15px 0;">';
    html += `<p style="line-height:25px; font-size:15px;margin-bottom:6px;">Best regards,</p>`;
    html += `<h4 style="font-size:17px;margin:0;font-weight:600;">${systemName}</h4>`;
    html += `<p style="font-size:13px;color:#777;margin-top:6px;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>`;
    html += '</div>';
    html += '</td>';
    html += '</tr>';

    html += '</table>';
    html += '</div>';
    html += '</body>';
    html += '</html>';

    return html;
};
