import * as ApiEndpoints from "../config/ApiEndpoints.js";

export const otpEmailTemplate = (data) => {
    const {
        userName = 'User',
        otp = '000000',
        expiryMinutes = 10,
        companyName = '',
        logoUrl = '',
        bannerUrl = '',
        themeColor = '#1c69d5',
        BASE_URL = ApiEndpoints.API_CONFIG.baseUrl,
        systemName = 'System Notification'
    } = data;
    const fullLogoUrl = logoUrl ? `${BASE_URL}${logoUrl}` : ApiEndpoints.API_CONFIG.LOGO_URL;
    const fullBannerUrl = bannerUrl ? `${BASE_URL}${bannerUrl}` : ApiEndpoints.API_CONFIG.EMAIL_BANNER;
  
    let html = '';
    html += '<!DOCTYPE html>';
    html += '<html lang="en">';
    html += '<head>';
    html += '<meta charset="utf-8">';
    html += '<meta name="viewport" content="width=device-width, initial-scale=1">';
    html += `<title>${companyName} OTP Verification</title>`;
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
    html += `<h2 style="font-size:24px; color:#fff; font-weight:500; margin:0; padding:15px 0;">OTP Verification</h2>`;
    html += `<img src="${fullBannerUrl}" alt="Email Banner" style="max-width:100%; height:auto; display:block; margin:0 auto;">`;
    html += '</td>';
    html += '</tr>';

    // Body
    html += `<tr>`;
    html += `<td style="padding:30px; color:#333;">`;
    html += `<p style="font-size:15px; line-height:25px;">Hello <strong>${userName}</strong>,</p>`;
    html += `<p style="font-size:15px; line-height:25px;">Please use the following One-Time Password (OTP) to complete your verification process:</p>`;
    html += `<div style="text-align:center; margin:25px 0;">`;
    html += `<span style="display:inline-block; background:${themeColor}; color:#fff; font-size:28px; letter-spacing:5px; padding:12px 25px; border-radius:6px; font-weight:bold;">${otp}</span>`;
    html += `</div>`;
    html += `<p style="font-size:14px; color:#555;">This OTP is valid for <strong>${expiryMinutes}</strong> minutes. Do not share it with anyone.</p>`;
    html += `<p style="font-size:14px; color:#555;">If you did not request this OTP, please ignore this email.</p>`;
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
