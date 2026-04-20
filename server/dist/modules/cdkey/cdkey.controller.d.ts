import { CdkeyService } from './cdkey.service';
export declare class CdkeyController {
    private readonly cdkeyService;
    constructor(cdkeyService: CdkeyService);
    redeem(req: any, body: {
        code?: string;
    }): Promise<{
        success: boolean;
        message: string;
        rewards: any[];
        cdkey?: undefined;
    } | {
        success: boolean;
        message: string;
        rewards: import("../../shared/cloudbase/cloudbase.types").MailAttachment[];
        cdkey: {
            id: string;
            code: string;
            title: string;
        };
    }>;
}
