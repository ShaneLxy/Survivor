import { MailService } from './mail.service';
export declare class MailController {
    private readonly mailService;
    constructor(mailService: MailService);
    list(req: any): Promise<{
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
            attachments: import("../../shared/cloudbase/cloudbase.types").MailAttachment[];
        }[];
    }>;
    claimAll(req: any): Promise<{
        success: boolean;
        message: string;
        claimedCount: number;
        rewards: import("../../shared/cloudbase/cloudbase.types").MailAttachment[];
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
            attachments: import("../../shared/cloudbase/cloudbase.types").MailAttachment[];
        }[];
    }>;
    markRead(req: any, mailId: string): Promise<{
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
            attachments: import("../../shared/cloudbase/cloudbase.types").MailAttachment[];
        };
    }>;
    claim(req: any, mailId: string): Promise<{
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
            attachments: import("../../shared/cloudbase/cloudbase.types").MailAttachment[];
        };
        rewards: import("../../shared/cloudbase/cloudbase.types").MailAttachment[];
    }>;
}
