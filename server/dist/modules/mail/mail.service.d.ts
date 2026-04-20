import { MailAttachment } from '../../shared/cloudbase/cloudbase.types';
import { CloudbaseService } from '../../shared/cloudbase/cloudbase.service';
export declare class MailService {
    private readonly cloudbaseService;
    constructor(cloudbaseService: CloudbaseService);
    listMails(accountId: string): Promise<{
        success: boolean;
        mails: {
            id: string;
            title: string;
            body: string;
            sender: string;
            accountId: string;
            createdAt: string;
            expireAt: string;
            readAt: string;
            claimedAt: string;
            attachments: MailAttachment[];
        }[];
    }>;
    markRead(accountId: string, mailId: string): Promise<{
        success: boolean;
        mail: {
            id: string;
            title: string;
            body: string;
            sender: string;
            accountId: string;
            createdAt: string;
            expireAt: string;
            readAt: string;
            claimedAt: string;
            attachments: MailAttachment[];
        };
    }>;
    claim(accountId: string, mailId: string): Promise<{
        success: boolean;
        message: string;
        mail: {
            id: string;
            title: string;
            body: string;
            sender: string;
            accountId: string;
            createdAt: string;
            expireAt: string;
            readAt: string;
            claimedAt: string;
            attachments: MailAttachment[];
        };
        rewards: MailAttachment[];
    }>;
    claimAll(accountId: string): Promise<{
        success: boolean;
        message: string;
        claimedCount: number;
        rewards: MailAttachment[];
        mails: {
            id: string;
            title: string;
            body: string;
            sender: string;
            accountId: string;
            createdAt: string;
            expireAt: string;
            readAt: string;
            claimedAt: string;
            attachments: MailAttachment[];
        }[];
    }>;
    private requireMail;
    private isExpired;
    private normalizeAttachments;
    private serializeMail;
}
