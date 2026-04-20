import { MailAttachment } from '../../shared/cloudbase/cloudbase.types';
import { CloudbaseService } from '../../shared/cloudbase/cloudbase.service';
export declare class CdkeyService {
    private readonly cloudbaseService;
    constructor(cloudbaseService: CloudbaseService);
    redeem(accountId: string, rawCode: string): Promise<{
        success: boolean;
        message: string;
        rewards: any[];
        cdkey?: undefined;
    } | {
        success: boolean;
        message: string;
        rewards: MailAttachment[];
        cdkey: {
            id: string;
            code: string;
            title: string;
        };
    }>;
    private isExpired;
    private normalizeRewards;
}
