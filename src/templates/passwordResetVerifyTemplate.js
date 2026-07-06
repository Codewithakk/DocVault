import * as ApiEndpoints from "../config/ApiEndpoints.js";

export const passwordResetVerifyTemplate = (data) => {
    const {
        name = '',
        resetLink = '',
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
    html += '<title>Password Verification</title>';
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
    html += `<h2 style="font-size:24px; color:#fff; font-weight:500; margin:0; padding:15px 0;">Password Verification</h2>`;
    html += `<img src="${fullBannerUrl}" alt="Email Banner" style="max-width:100%; height:auto; display:block; margin:0 auto;">`;
    html += '</td>';
    html += '</tr>';

    // Message
    html += '<tr>';
    html += '<td>';
    html += `<p style="line-height:25px; font-size:15px;">Hi ${name || 'there'},</p>`;
    html += `<p style="line-height:25px; font-size:15px;">You have requested to change your password. Click the link below to verify this change:</p>`;
    html += '<div style="text-align:center;margin:20px 0;">';
    html += `<a href="${resetLink}" style="text-decoration:none;border-radius:7px;padding:10px 20px;color:#fff;background:${themeColor};">Verify Password</a>`;
    html += `<p style="word-break:break-all; line-height:25px; font-size:14px;"><a href="${resetLink}">${resetLink}</a></p>`;
    html += '</div>';
    html += `<p style="line-height:25px; font-size:15px;">This link will expire in <strong>15 minutes</strong>.</p>`;
    html += `<p style="line-height:25px; font-size:15px;">If you didn't request this change, please ignore this email.</p>`;
    html += '</td>';
    html += '</tr>';

    // Support
    html += '<tr>';
    html += '<td>';
    html += `<p style="line-height:25px; font-size:15px;">`;
    html += `If you didn't create this account, please ignore this email or `;
    html += `<a href="${BASE_URL}/support" style="color:blue;text-decoration:none;">contact support.</a>`;
    html += '</p>';
    html += '</td>';
    html += '</tr>';
    // Footer
    html += '<tr>';
    html += '<td>';
    html += '<div style="margin:15px 0;">';
    html += '<p style="line-height:25px; font-size:15px;margin-bottom:6px;">Regards,</p>';
    html += `<h4 style="font-size:17px;margin:0;font-weight:600;">The ${companyName} Team</h4>`;
    html += '</div>';
    html += '</td>';
    html += '</tr>';

    html += '</table>';
    html += '</div>';
    html += '</body>';
    html += '</html>';

    return html;
};
