import { UserAccount } from '../../users/entities/user-account.entity';
export declare class PlayerSave {
    id: number;
    accountId: number;
    account: UserAccount;
    version: string;
    saveData: Record<string, any> | null;
    lastSaveTime: number;
    createdAt: Date;
    updatedAt: Date;
}
