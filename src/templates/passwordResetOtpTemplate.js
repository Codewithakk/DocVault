import * as ApiEndpoints from "../config/ApiEndpoints.js";

export const passwordResetOtpTemplate = (data) => {
    const {
        userName = '',
        otp = '',
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
    html += '<title>Password Reset OTP</title>';
    html += '</head>';

    html += '<body style="font-family:Arial, Helvetica, sans-serif; margin:0; padding:0; background:#f6f9fc;">';
    html += '<div style="max-width:600px; margin:auto; background:#ffffff; border-radius:8px; overflow:hidden;">';
    html += '<table style="width:100%; border-collapse:collapse;">';

    // Logo
    html += '<tr>';
    html += '<td style="text-align:center; padding:20px;">';
    html += `<img src="${fullLogoUrl}" alt="${companyName} Logo" style="max-width:120px; height:auto; display:block; margin:auto;">`;
    html += '</td>';
    html += '</tr>';

    // Banner Section
    html += '<tr>';
    html += `<td style="background:${themeColor}; text-align:center; border-radius:6px 6px 0 0;">`;
    html += `<h2 style="font-size:24px; color:#fff; font-weight:500; margin:0; padding:15px 0;">Password Reset Request</h2>`;
    html += `<img src="${fullBannerUrl}" alt="Email Banner" style="max-width:100%; height:auto; display:block; margin:0 auto;">`;
    html += '</td>';
    html += '</tr>';

    // Body
    html += '<tr>';
    html += '<td style="padding:25px 30px; color:#333; text-align:center;">';
    html += `<p style="line-height:25px; font-size:15px;">Hi ${userName},</p>`;
    html += '<p style="font-size:15px; line-height:25px; margin-bottom:20px;">You requested to reset your password. Please use the One-Time Password (OTP) below:</p>';
    html += `<h1 style="color:${themeColor}; letter-spacing:5px; font-size:36px; margin:20px 0;">${otp}</h1>`;
    html += '<p style="font-size:15px; line-height:25px;">This OTP will expire in <strong>10 minutes</strong>.</p>';
    html += `<p style="font-size:14px; line-height:22px; margin-top:20px;">If you did not request this, please ignore this email or <a href="${BASE_URL}/support" style="color:${themeColor}; text-decoration:none;">contact support</a>.</p>`;
    html += '</td>';
    html += '</tr>';

    // Footer
    html += '<tr>';
    html += '<td style="padding:20px 30px; background:#f2f4f7; text-align:center;">';
    html += `<p style="font-size:14px; margin:0 0 8px 0;">— The ${companyName} Team</p>`;
    html += `<p style="font-size:12px; color:#777; margin-top:10px;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>`;
    html += '</td>';
    html += '</tr>';

    html += '</table>';
    html += '</div>';
    html += '</body>';
    html += '</html>';

    return html;
};
