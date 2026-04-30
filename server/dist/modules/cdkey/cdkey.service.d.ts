import { MongoService } from '../../shared/mongo/mongo.service';
import { MailAttachment } from '../../shared/mongo/mongo.types';
export declare class CdkeyService {
    private readonly mongoService;
    constructor(mongoService: MongoService);
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
