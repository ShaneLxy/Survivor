import { UpsertSaveDto } from './dto/upsert-save.dto';
import { SaveService } from './save.service';
export declare class SaveController {
    private readonly saveService;
    constructor(saveService: SaveService);
    getSave(req: any): Promise<{
        success: boolean;
        message: string;
        saveData: {
            version: string;
            timestamp: number;
            data: Record<string, any>;
        };
    }>;
    save(req: any, dto: UpsertSaveDto): Promise<{
        success: boolean;
        message: string;
        saveData: {
            version: any;
            timestamp: number;
            data: any;
        };
    }>;
    deleteSave(req: any): Promise<{
        success: boolean;
        message: string;
    }>;
}
