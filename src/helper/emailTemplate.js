import { welcomeTemplate } from '../templates/welcomeTemplate.js';
import { passwordResetOtpTemplate } from '../templates/passwordResetOtpTemplate.js';

// E-Sangrah / DocuFlow templates
import { accessGrantedTemplate } from '../templates/accessGrantedTemplate.js';
import { accessExpiredTemplate } from '../templates/accessExpiredTemplate.js';
import { documentAccessRequestTemplate } from '../templates/documentAccessRequest.js';
import { folderAccessApprovedTemplate } from '../templates/folderAccessApprovedTemplate.js';
import { folderAccessRejectedTemplate } from '../templates/folderAccessRejectedTemplate.js';
import { folderAccessRequestTemplate } from '../templates/folderAccessRequestTemplate.js';
import { folderSharedTemplate } from '../templates/folderSharedTemplate.js';
import { documentInvitationTemplate } from '../templates/documentInvitationTemplate.js';
import { documentApprovalRequestTemplate } from '../templates/documentApprovalRequestTemplate.js';
import { discussionRequestedTemplate } from '../templates/discussionRequestedTemplate.js';
import { otpEmailTemplate } from '../templates/otpEmailTemplate.js';
import { folderShareOrRemovedTemplate } from '../templates/folderShareOrRemovedTemplate.js';
import { passwordResetVerifyTemplate } from '../templates/passwordResetVerifyTemplate.js';
import { fileAccessGrantedTemplate } from '../templates/fileaccessGrantedTemplate.js';

/**
 * Dynamically generate HTML email string based on type
 * @param {string} type - Type of email (welcome, passwordReset, etc.)
 * @param {object} data - Dynamic data for template rendering
 * @returns {string} - HTML email content
 */
export const generateEmailTemplate = (type, data = {}) => {
    switch (type) {
        case 'registeration':
            return welcomeTemplate(data);
        case 'passwordReset':
            return passwordResetOtpTemplate(data);
        case 'passwordVerify':
            return passwordResetVerifyTemplate(data);

        // Document / Folder Access
        case 'accessGranted':
            return accessGrantedTemplate(data);
        case 'fileaccessGranted':
            return fileAccessGrantedTemplate(data);
        case 'accessExpired':
            return accessExpiredTemplate(data);
        case 'documentAccessRequest':
            return documentAccessRequestTemplate(data);
        case 'folderAccessApproved':
            return folderAccessApprovedTemplate(data);
        case 'folderAccessRejected':
            return folderAccessRejectedTemplate(data);
        case 'folderAccessRequest':
            return folderAccessRequestTemplate(data);
        case 'folderShared':
            return folderSharedTemplate(data);
        case 'documentInvitation':
            return documentInvitationTemplate(data);
        case 'documentApprovalRequest':
            return documentApprovalRequestTemplate(data);
        case 'discussionRequested':
            return discussionRequestedTemplate(data);

        // 🔐 Security / OTP
        case 'otp':
            return otpEmailTemplate(data);
        case 'folderShareOrRemoved':
            return folderShareOrRemovedTemplate(data);

        default:
            return `<html><body><p>Hi ${data.name || 'User'}, this is a test email.</p></body></html>`;
    }
};
