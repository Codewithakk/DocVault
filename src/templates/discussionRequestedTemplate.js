import * as ApiEndpoints from "../config/ApiEndpoints.js";

export const discussionRequestedTemplate = (data) => {
    const {
        ownerName = 'User',
        requesterName = 'Requester',
        fileName = 'Untitled Document',
        comment = 'No remarks provided',
        companyName = '',
        logoUrl = '',
        bannerUrl = '',
        themeColor = '#1c69d5',
        documentLink,
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
    html += `<title>Discussion Requested - ${companyName}</title>`;
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
    html += `<h2 style="font-size:24px; color:#fff; font-weight:500; margin:0; padding:15px 0;">Discussion Requested</h2>`;
    html += `<img src="${fullBannerUrl}" alt="Email Banner" style="max-width:100%; height:auto; display:block; margin:0 auto;">`;
    html += '</td>';
    html += '</tr>';

    // Main Content
    html += `<tr>`;
    html += `<td style="padding:25px 30px; color:#333;">`;
    html += `<p style="font-size:15px; line-height:25px;">Hi ${ownerName},</p>`;
    html += `<p style="font-size:15px; line-height:25px;">`;
    html += `<strong>${requesterName}</strong> has requested a discussion on your document:`;
    html += `</p>`;
    html += `<p style="font-size:15px; font-weight:600; line-height:25px;">${fileName}</p>`;
    html += `<p style="font-size:15px; line-height:25px;"><strong>Remark:</strong> ${comment}</p>`;

    // Optional button (can be linked to document discussion page)
    html += `<div style="text-align:center; margin:25px 0;">`;
    html += `<a href="${documentLink}" target="_blank" rel="noopener noreferrer" style="text-decoration:none; border-radius:7px; padding:12px 25px; color:#fff; background:${themeColor}; font-size:15px; display:inline-block;">`;
    html += `View Document</a>`;
    html += `</div>`;

    html += `<p style="font-size:14px; line-height:22px;">If this discussion was not requested by you, please `;
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
