import { Repository } from 'typeorm';
import { UserAccount } from '../users/entities/user-account.entity';
import { UpsertSaveDto } from './dto/upsert-save.dto';
import { PlayerSave } from './entities/player-save.entity';
export declare class SaveService {
    private readonly saveRepository;
    constructor(saveRepository: Repository<PlayerSave>);
    getSaveByAccountId(accountId: number): Promise<{
        success: boolean;
        message: string;
        saveData: {
            version: string;
            timestamp: number;
            data: Record<string, any>;
        };
    }>;
    upsertSave(user: UserAccount, dto: UpsertSaveDto): Promise<{
        success: boolean;
        message: string;
        saveData: {
            version: string;
            timestamp: number;
            data: Record<string, any>;
        };
    }>;
    deleteSave(accountId: number): Promise<{
        success: boolean;
        message: string;
    }>;
}
