import * as ApiEndpoints from "../config/ApiEndpoints.js";

export const documentApprovalRequestTemplate = (data) => {
    const {
        approverName = 'Approver',
        documentName = 'Untitled Document',
        description = 'No description provided',
        departmentName = 'N/A',
        requesterName = 'N/A',
        approvalLink = '#',
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
    html += '<title>Document Approval Request</title>';
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
    html += `<h2 style="font-size:24px; color:#fff; font-weight:500; margin:0; padding:15px 0;">Document Approval Request</h2>`;
    html += `<img src="${fullBannerUrl}" alt="Email Banner" style="max-width:100%; height:auto; display:block; margin:0 auto;">`;
    html += '</td>';
    html += '</tr>';

    // Body Section
    html += '<tr>';
    html += '<td>';
    html += `<p style="line-height:25px; font-size:15px;">Dear ${approverName},</p>`;
    html += `<p style="line-height:25px; font-size:15px;">You have been requested to review and approve the following document:</p>`;

    html += `<div style="background:#f4f7fc;border-left:4px solid ${themeColor};padding:15px;border-radius:5px;margin:20px 0;">`;
    html += `<p style="line-height:25px; font-size:15px;margin:0;"><strong>Document:</strong> ${documentName}</p>`;
    html += `<p style="line-height:25px; font-size:15px;margin:0;"><strong>Description:</strong> ${description}</p>`;
    html += `<p style="line-height:25px; font-size:15px;margin:0;"><strong>Department:</strong> ${departmentName}</p>`;
    html += `<p style="line-height:25px; font-size:15px;margin:0;"><strong>Requested by:</strong> ${requesterName}</p>`;
    html += '</div>';

    html += `<p style="line-height:25px; font-size:15px;">Please click the appropriate button below to review and approve or reject the document:</p>`;
    html += '</td>';
    html += '</tr>';

    // Buttons
    html += '<tr>';
    html += '<td style="text-align:center;">';
    html += '<div style="margin:20px 0;">';
    html += `<a href="${approvalLink}" style="text-decoration:none;border-radius:7px;padding:10px 20px;color:#fff;background:${themeColor};margin-right:10px;">Approve Document</a>`;
    html += '</div>';
    html += '</td>';
    html += '</tr>';

    // Info and Support
    html += '<tr>';
    html += '<td>';
    html += `<p style="line-height:25px; font-size:15px;">This approval link will expire in <strong>7 days</strong>.</p>`;
    html += `<p style="line-height:25px; font-size:15px;">If you have any issues accessing the document, please <a href="${BASE_URL}/support" style="color:blue;text-decoration:none;">contact support.</a></p>`;
    html += '</td>';
    html += '</tr>';

    // Footer
    html += '<tr>';
    html += '<td>';
    html += '<div style="margin:15px 0;">';
    html += '<p style="line-height:25px; font-size:15px;margin-bottom:6px;">Regards,</p>';
    html += `<h4 style="font-size:17px;margin:0;font-weight:600;">The ${companyName} Team</h4>`;
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
