export interface PlayerSave {
    _id: string;
    accountId: string;
    version: string;
    saveData: Record<string, any> | null;
    lastSaveTime: number;
    createdAt: string;
    updatedAt: string;
}
