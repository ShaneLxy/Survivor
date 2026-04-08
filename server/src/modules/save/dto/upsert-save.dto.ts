import { IsObject } from 'class-validator';

export class UpsertSaveDto {
  @IsObject()
  saveData: Record<string, any>;
}
