import * as ApiEndpoints from "../config/ApiEndpoints.js";

export const welcomeTemplate = (data) => {
    const {
        name = '',
        email = '',
        password = '',
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
    html += '<title>Registered</title>';
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
    html += `<h2 style="font-size:24px; color:#fff; font-weight:500; margin:0; padding:15px 0;">Welcome ${name}</h2>`;
    html += `<img src="${fullBannerUrl}" alt="Email Banner" style="max-width:100%; height:auto; display:block; margin:0 auto;">`;
    html += '</td>';
    html += '</tr>';

    // Welcome Message
    html += '<tr>';
    html += '<td>';
    html += `<p style="line-height:25px; font-size:15px;">Hi ${name},</p>`;
    html += '<p style="line-height:25px; font-size:15px;">';
    html += `We're thrilled to have you join us! Your account has been successfully created. `;
    html += `You can now log in and start using all the amazing features ${companyName} offers.`;
    html += '</p>';
    html += `<p style="line-height:25px; font-size:15px;">`;
    html += `<strong>Email:</strong> ${email}<br>`;
    html += `<strong>Password:</strong> ${password}`;
    html += '</p>';
    html += '</td>';
    html += '</tr>';

    // Button
    html += '<tr>';
    html += '<td style="text-align:center;">';
    html += '<div style="margin:20px 0;">';
    html += `<a href="${BASE_URL}/login" style="text-decoration:none;border-radius:7px;padding:10px 20px;color:#fff;background:${themeColor};">`;
    html += 'Please Login</a>';
    html += '</div>';
    html += '</td>';
    html += '</tr>';

    // Support Text
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
