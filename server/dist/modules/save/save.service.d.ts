import { CloudbaseService } from '../../shared/cloudbase/cloudbase.service';
import { UserAccountDocument } from '../../shared/cloudbase/cloudbase.types';
import { UpsertSaveDto } from './dto/upsert-save.dto';
export declare class SaveService {
    private readonly cloudbaseService;
    constructor(cloudbaseService: CloudbaseService);
    getSaveByAccountId(accountId: string): Promise<{
        success: boolean;
        message: string;
        saveData: {
            version: string;
            timestamp: number;
            data: Record<string, any>;
        };
    }>;
    upsertSave(user: {
        id: string;
    } | UserAccountDocument, dto: UpsertSaveDto): Promise<{
        success: boolean;
        message: string;
        saveData: {
            version: any;
            timestamp: number;
            data: any;
        };
    }>;
    deleteSave(accountId: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
